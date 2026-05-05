import React, { useEffect, useRef, useMemo } from 'react';
import {
  View,
  FlatList,
  Text,
  ActivityIndicator,
  StyleSheet,
  Platform,
} from 'react-native';
import ChatBubble from './ChatBubble';
import { formatMessageDateSeparator } from '../utils/dateUtils';

const MessageList = React.forwardRef(({
  messages = [],
  conversationId,
  currentUserId,
  typingUsers = [],
  onlineUsers = [],
  isLoading = false,
  onLoadMore,
  onReact,
  onLongPress,
  onPressMessage,
  onPressReply,
  sendReadReceipt,
  highlightedMessageId = null,
}, ref) => {
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const readMessageIds = useRef(new Set());
  
  // Đảo ngược danh sách tin nhắn để dùng với inverted FlatList
  // Tin nhắn mới nhất sẽ ở index 0 (đáy màn hình)
  const reversedMessages = useMemo(() => [...messages].reverse(), [messages]);

  const normalizeReaderId = (reader) => {
    if (!reader) return '';
    if (typeof reader === 'object') return String(reader.userId || reader.id || '');
    return String(reader);
  };

  const isLatestReadBy = (message, readerId, messageIndex) => {
    // Trong danh sách gốc (messages), tin nhắn sau nó là index + 1
    // Nhưng ở đây ta dùng messages để check cho chuẩn
    const originalIndex = messages.findIndex(m => m.messageId === message.messageId);
    if (originalIndex === -1) return false;
    
    return !messages.slice(originalIndex + 1).some((nextMessage) => {
      return Array.isArray(nextMessage.readBy) && nextMessage.readBy.some((reader) => normalizeReaderId(reader) === readerId);
    });
  };

  const getLatestReadBy = (message) => {
    if (!Array.isArray(message.readBy) || message.readBy.length === 0) return [];
    const uniqueIds = new Set();
    return message.readBy.reduce((latest, reader) => {
      const readerId = normalizeReaderId(reader);
      if (!readerId || uniqueIds.has(readerId)) return latest;
      if (isLatestReadBy(message, readerId)) {
        uniqueIds.add(readerId);
        latest.push(reader);
      }
      return latest;
    }, []);
  };

  const handlePressMessage = (item) => {
    if (!conversationId || !onPressMessage || !item || String(item.senderId) === String(currentUserId)) return;
    const messageId = String(item.messageId || '');
    if (!messageId || messageId.startsWith('temp-') || readMessageIds.current.has(messageId)) return;

    const alreadyRead = Array.isArray(item.readBy) && item.readBy.some((id) => normalizeReaderId(id) === String(currentUserId));
    if (alreadyRead) return;

    readMessageIds.current.add(messageId);
    onPressMessage(item);
  };

  // Sử dụng Ref để lưu trữ props mới nhất cho callback ổn định
  const propsRef = useRef({ conversationId, sendReadReceipt, currentUserId });
  useEffect(() => {
    propsRef.current = { conversationId, sendReadReceipt, currentUserId };
  }, [conversationId, sendReadReceipt, currentUserId]);

  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    viewableItems.forEach(({ item }) => {
      const { conversationId: cId, sendReadReceipt: sRR, currentUserId: uId } = propsRef.current;
      
      if (!item || !cId || !sRR) return;

      const messageId = item.messageId || item.id;
      if (!messageId || String(messageId).startsWith('temp-')) return;

      const senderId = String(item.senderId || '');
      const selfId = String(uId || '');

      if (senderId === selfId) return;

      const hasRead = Array.isArray(item.readBy) &&
        item.readBy.some((reader) => normalizeReaderId(reader) === selfId);

      if (!hasRead) {
        sRR(messageId, cId);
      }
    });
  }).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

  useEffect(() => {
    readMessageIds.current.clear();
  }, [conversationId]);

  const onRefresh = async () => {
    if (onLoadMore && !isRefreshing) {
      setIsRefreshing(true);
      await onLoadMore();
      setIsRefreshing(false);
    }
  };

  const renderMessage = ({ item, index }) => {
    const otherOnline = onlineUsers.some(id => String(id) !== String(currentUserId || ''));
    const latestReadBy = getLatestReadBy(item);
    
    // Logic hiển thị trạng thái "Đã gửi/Đã nhận"
    const originalIndex = messages.findIndex(m => m.messageId === item.messageId);
    const shouldShowStatus = !latestReadBy.length && !messages.slice(originalIndex + 1).some((nextMessage) => {
      return Array.isArray(nextMessage.readBy) && nextMessage.readBy.some((reader) => normalizeReaderId(reader) !== String(currentUserId || ''));
    });

    // Logic Date Separator cho danh sách Inverted
    const currentMsgDate = item.createdAt ? new Date(item.createdAt).toDateString() : null;
    // Tin nhắn cũ hơn trong danh sách đảo ngược là index + 1
    const olderMsgDate = index < reversedMessages.length - 1 && reversedMessages[index + 1].createdAt
      ? new Date(reversedMessages[index + 1].createdAt).toDateString()
      : null;
    
    const showSeparator = currentMsgDate !== olderMsgDate;

    return (
      <View>
        {showSeparator && item.createdAt && (
          <View style={styles.dateSeparatorContainer}>
            <View style={styles.dateBadge}>
              <Text style={styles.dateText}>
                {formatMessageDateSeparator(item.createdAt)}
              </Text>
            </View>
          </View>
        )}
        <ChatBubble
          message={item}
          isOwn={String(item.senderId || '') === String(currentUserId || '')}
          isOnline={otherOnline}
          latestReadBy={latestReadBy}
          showReadStatus={shouldShowStatus}
          onReact={onReact}
          onLongPress={() => onLongPress(item)}
          onPressMessage={(msgId) => {
            onPressReply?.(msgId);
          }}
          isHighlighted={highlightedMessageId === (item.messageId || item.id)}
          allMessages={messages}
        />
      </View>
    );
  };

  const renderTypingIndicator = () => {
    if (!typingUsers || typingUsers.length === 0) return null;

    const activeTyping = typingUsers.filter(u => String(u.userId) !== String(currentUserId));
    if (activeTyping.length === 0) return null;

    const firstTypingUser = activeTyping[0];
    const typingText = activeTyping.length > 1 
      ? `${activeTyping.length} người đang soạn tin...`
      : `${firstTypingUser.name} đang soạn tin...`;

    return (
      <View style={styles.typingContainer}>
        <View style={styles.typingBubble}>
          <View style={styles.dotsContainer}>
            <View style={styles.typingDot} />
            <View style={styles.typingDot} />
            <View style={styles.typingDot} />
          </View>
          <Text style={styles.typingText}>{typingText}</Text>
        </View>
      </View>
    );
  };

  if (isLoading && messages.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#667eea" />
        <Text style={styles.loadingText}>Đang tải tin nhắn...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        ref={ref}
        inverted // QUAN TRỌNG: Đảo ngược danh sách để luôn bắt đầu từ đáy
        data={reversedMessages}
        renderItem={renderMessage}
        keyExtractor={(item, index) => item.messageId || item.id || String(item.createdAt) || index.toString()}
        // Với inverted, Header sẽ nằm ở đáy màn hình
        ListHeaderComponent={renderTypingIndicator}
        contentContainerStyle={styles.listContent}
        scrollEventThrottle={16}
        refreshing={isRefreshing}
        onRefresh={onRefresh}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        // Tối ưu hiệu năng cuộn
        removeClippedSubviews={Platform.OS === 'android'}
        initialNumToRender={15}
        maxToRenderPerBatch={10}
        windowSize={10}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  listContent: {
    paddingVertical: 16,
    paddingHorizontal: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#667eea',
  },
  typingContainer: {
    paddingLeft: 48,
    paddingVertical: 8,
  },
  typingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#f3f4f6',
    borderRadius: 20,
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginRight: 8,
  },
  typingDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#9ca3af',
  },
  typingText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
  },
  dateSeparatorContainer: {
    alignItems: 'center',
    marginVertical: 20,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  dateBadge: {
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
  },
  dateText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
});

export default MessageList;
