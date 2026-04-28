import React, { useEffect, useRef } from 'react';
import {
  View,
  FlatList,
  Text,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import ChatBubble from './ChatBubble';

const MessageList = ({
  messages = [],
  conversationId,
  currentUserId,
  typingUsers = [],
  onlineUsers = [],
  isLoading = false,
  onLoadMore,
  onReact,
  onLongPress,
  sendReadReceipt,
}) => {
  const flatListRef = useRef(null);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const readReceiptSent = useRef(new Set());
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 10, minimumViewTime: 200 }).current;

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
    const selfId = String(currentUserId || '');
    const uniqueIds = new Set();
    return message.readBy.reduce((latest, reader) => {
      const readerId = normalizeReaderId(reader);
      if (!readerId || readerId === selfId || uniqueIds.has(readerId)) return latest;
      if (isLatestReadBy(message, readerId, index)) {
        uniqueIds.add(readerId);
        latest.push(reader);
      }
      return latest;
    }, []);
  };

  const onViewableItemsChanged = React.useCallback(({ viewableItems }) => {
    if (!conversationId || !sendReadReceipt) return;

    viewableItems.forEach(({ item }) => {
      if (!item || String(item.senderId) === String(currentUserId)) return;
      const messageId = String(item.messageId || '');
      if (!messageId || messageId.startsWith('temp-') || readReceiptSent.current.has(messageId)) return;

      const alreadyRead = Array.isArray(item.readBy) && item.readBy.some((id) => normalizeReaderId(id) === String(currentUserId));
      if (alreadyRead) return;

      sendReadReceipt(messageId, conversationId);
      readReceiptSent.current.add(messageId);
    });
  }, [conversationId, currentUserId, sendReadReceipt]);

  useEffect(() => {
    if (messages.length > 0 && !isRefreshing) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length, typingUsers, isRefreshing]);

  useEffect(() => {
    readReceiptSent.current.clear();
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
      />
    );
  };

  const renderTypingIndicator = () => {
    if (!typingUsers || typingUsers.length === 0) return null;

    return (
      <View style={styles.typingContainer}>
        <View style={styles.typingBubble}>
          <View style={styles.typingDot} />
          <View style={styles.typingDot} />
          <View style={styles.typingDot} />
        </View>
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
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item, index) => item.messageId || item.id || String(item.createdAt) || index.toString()}
        viewabilityConfig={viewabilityConfig}
        onViewableItemsChanged={onViewableItemsChanged}
        ListFooterComponent={renderTypingIndicator}
        contentContainerStyle={styles.listContent}
        onContentSizeChange={(w, h) => {
          // Chỉ scroll xuống nếu không phải đang refresh (tải tin nhắn cũ)
          if (!isRefreshing) {
            flatListRef.current?.scrollToEnd({ animated: true });
          }
        }}
        refreshing={isRefreshing}
        onRefresh={onRefresh}
      />
    </View>
  );
};

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
    paddingLeft: 48, // Căn lề để khớp với tin nhắn có avatar
    paddingVertical: 8,
  },
  typingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#f3f4f6',
    borderRadius: 18,
    alignSelf: 'flex-start',
  },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#d1d5db',
  },
});

export default MessageList;
