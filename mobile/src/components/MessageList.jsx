import React, { useEffect, useRef } from 'react';
import {
  View,
  FlatList,
  Text,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import ChatBubble from './ChatBubble';

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
  const [isLoadingMoreMessages, setIsLoadingMoreMessages] = React.useState(false);
  const [isNearBottom, setIsNearBottom] = React.useState(true); // Track if user is near bottom
  const readMessageIds = useRef(new Set());

  const normalizeReaderId = (reader) => {
    if (!reader) return '';
    if (typeof reader === 'object') return String(reader.userId || reader.id || '');
    return String(reader);
  };

  const isLatestReadBy = (message, readerId, index) => {
    return !messages.slice(index + 1).some((nextMessage) => {
      return Array.isArray(nextMessage.readBy) && nextMessage.readBy.some((reader) => normalizeReaderId(reader) === readerId);
    });
  };

  const getLatestReadBy = (message, index) => {
    if (!Array.isArray(message.readBy) || message.readBy.length === 0) return [];
    const uniqueIds = new Set();
    return message.readBy.reduce((latest, reader) => {
      const readerId = normalizeReaderId(reader);
      if (!readerId || uniqueIds.has(readerId)) return latest;
      if (isLatestReadBy(message, readerId, index)) {
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

  const isAtBottom = useRef(true);
  const isLoadingMore = useRef(false);

  const handleScroll = (event) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    // Kiểm tra xem có đang ở gần cuối danh sách không (cách đáy 100px để trừ hao)
    const paddingToBottom = 100;
    const isCloseToBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom;
    isAtBottom.current = isCloseToBottom;
    setIsNearBottom(isCloseToBottom); // Update state for button visibility

    // Kiểm tra nếu scroll gần đầu danh sách để load tin nhắn cũ hơn
    // Trigger khi contentOffset.y < 100px (người dùng kéo lên)
    const paddingToTop = 100;
    const isNearTop = contentOffset.y < paddingToTop;
    
    console.log(`[MessageList] Scroll: y=${Math.round(contentOffset.y)}, nearTop=${isNearTop}, loading=${isLoadingMoreMessages}, hasCallback=${!!onLoadMore}`);
    
    if (isNearTop && !isLoadingMoreMessages && !isRefreshing && onLoadMore && messages.length > 0) {
      console.log('[MessageList] 🔝 Near top detected, triggering onLoadMore');
      setIsLoadingMoreMessages(true);
      onLoadMore().finally(() => {
        setIsLoadingMoreMessages(false);
      });
    }
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

      // Không gửi read receipt cho tin nhắn của chính mình
      const senderId = String(item.senderId || '');
      const selfId = String(uId || '');

      if (senderId === selfId) return;

      // Kiểm tra xem đã đọc chưa
      const hasRead = Array.isArray(item.readBy) &&
        item.readBy.some((reader) => normalizeReaderId(reader) === selfId);

      if (!hasRead) {
        console.log(`[MessageList] Marking visible message as read: ${messageId}`);
        sRR(messageId, cId);
      }
    });
  }).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

  useEffect(() => {
    readMessageIds.current.clear();
    isAtBottom.current = true; // Reset khi đổi hội thoại
  }, [conversationId]);

  useEffect(() => {
    if (messages.length > 0 && !isRefreshing && !isLoadingMoreMessages) {
      // Chỉ tự động cuộn xuống nếu:
      // 1. Đang ở đáy (isAtBottom.current = true)
      // 2. Hoặc tin nhắn mới nhất là của mình
      // 3. Và KHÔNG phải đang load more messages
      const lastMessage = messages[messages.length - 1];
      const isMyMessage = String(lastMessage?.senderId) === String(currentUserId);
      
      if (isAtBottom.current || isMyMessage) {
        setTimeout(() => {
          const listRef = ref?.current || null;
          listRef?.scrollToEnd({ animated: true });
        }, 100);
      }
    }
  }, [messages.length, typingUsers, isRefreshing, isLoadingMoreMessages, currentUserId]);

  const onRefresh = async () => {
    if (onLoadMore && !isRefreshing) {
      setIsRefreshing(true);
      await onLoadMore();
      setIsRefreshing(false);
    }
  };

  const renderMessage = ({ item, index }) => {
    const otherOnline = onlineUsers.some(id => String(id) !== String(currentUserId || ''));
    const latestReadBy = getLatestReadBy(item, index);
    const hasReadByOther = Array.isArray(latestReadBy) && latestReadBy.length > 0;
    const shouldShowStatus = !hasReadByOther && !messages.slice(index + 1).some((nextMessage) => {
      return Array.isArray(nextMessage.readBy) && nextMessage.readBy.some((reader) => normalizeReaderId(reader) !== String(currentUserId || ''));
    });

    return (
      <ChatBubble
        message={item}
        isOwn={String(item.senderId || '') === String(currentUserId || '')}
        isOnline={otherOnline}
        latestReadBy={latestReadBy}
        showReadStatus={shouldShowStatus}
        onReact={onReact}
        onLongPress={() => onLongPress(item)}
        onPressMessage={(msgId) => {
          // Khi nhấn vào reply để scroll, tạm thời tắt auto scroll tới đáy
          if (typeof msgId === 'string' || typeof msgId === 'number') {
            isAtBottom.current = false;
          }
          onPressReply?.(msgId);
        }}
        isHighlighted={highlightedMessageId === (item.messageId || item.id)}
        allMessages={messages}
      />
    );
  };

  const renderTypingIndicator = () => {
    if (!typingUsers || typingUsers.length === 0) return null;

    // Lọc bỏ chính mình nếu có (dù server thường không gửi lại cho sender)
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

  const renderLoadingMoreIndicator = () => {
    if (!isLoadingMoreMessages || messages.length === 0) return null;
    return (
      <View style={styles.loadingMoreContainer}>
        <ActivityIndicator size="small" color="#667eea" />
        <Text style={styles.loadingMoreText}>Đang tải tin nhắn cũ hơn...</Text>
      </View>
    );
  };

  if (isLoading && messages.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#667eea" />
        <Text style={styles.loadingText}>Loading messages...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        ref={ref}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item, index) => item.messageId || item.id || String(item.createdAt) || index.toString()}
        ListHeaderComponent={renderLoadingMoreIndicator}
        ListFooterComponent={renderTypingIndicator}
        contentContainerStyle={styles.listContent}
        onContentSizeChange={(w, h) => {
          // Chỉ scroll xuống nếu đang ở đáy và không phải đang refresh/load more
          if (isAtBottom.current && !isRefreshing && !isLoadingMoreMessages) {
            const listRef = ref?.current || null;
            listRef?.scrollToEnd({ animated: true });
          }
        }}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        refreshing={false}
        onRefresh={onRefresh}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
      />
      
      {/* Jump to Latest Button */}
      {!isNearBottom && (
        <TouchableOpacity 
          style={styles.jumpToLatestButton}
          onPress={() => {
            const listRef = ref?.current || null;
            listRef?.scrollToEnd({ animated: true });
          }}
        >
          <Text style={styles.jumpToLatestIcon}>↓</Text>
        </TouchableOpacity>
      )}
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
  jumpToLatestButton: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#667eea',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 5,
  },
  jumpToLatestIcon: {
    fontSize: 24,
    color: '#fff',
    fontWeight: 'bold',
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
    paddingLeft: 48, // Căn lề để khớp với tin nhắn có avatar
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
  loadingMoreContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    flexDirection: 'row',
    gap: 8,
  },
  loadingMoreText: {
    fontSize: 12,
    color: '#9ca3af',
    fontWeight: '500',
  },
});

export default MessageList;
