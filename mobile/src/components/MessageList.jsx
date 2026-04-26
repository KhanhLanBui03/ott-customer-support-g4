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
  currentUserId,
  typingUsers = [],
  onlineUsers = [],
  isLoading = false,
  onLoadMore,
  onReact,
  onLongPress,
}) => {
  const flatListRef = useRef(null);
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  useEffect(() => {
    if (messages.length > 0 && !isRefreshing) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length, typingUsers, isRefreshing]);

  const onRefresh = async () => {
    if (onLoadMore && !isRefreshing) {
      setIsRefreshing(true);
      await onLoadMore();
      setIsRefreshing(false);
    }
  };

  const renderMessage = ({ item }) => (
    <ChatBubble
      message={item}
      isOwn={String(item.senderId || '') === String(currentUserId || '')}
      isOnline={onlineUsers.includes(item.senderId)}
      onReact={onReact}
      onLongPress={() => onLongPress(item)}
    />
  );

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
        keyExtractor={(item) => item.messageId || item.id || Math.random().toString()}
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
    backgroundColor: '#fff',
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
