import React, { useEffect, useRef } from 'react';
import {
  View,
  FlatList,
  Text,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useSelector } from 'react-redux';
import { COLORS, SPACING, RADIUS } from '../utils/theme';
import ChatBubble from './ChatBubble';

/**
 * Premium MessageList Component
 * Displays list of messages with theme support and auto-scroll.
 */

const MessageList = ({
  messages = [],
  currentUserId,
  typingUsers = [],
  isLoading = false,
}) => {
  const flatListRef = useRef(null);
  const themeMode = useSelector((state) => state.auth.theme || 'light');
  const theme = COLORS[themeMode];

  // Auto-scroll to bottom when new message arrives
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  const renderMessage = ({ item }) => (
    <ChatBubble
      message={item}
      isOwn={item.senderId === currentUserId}
    />
  );

  const renderTypingIndicator = () => {
    if (typingUsers.length === 0) return null;

    return (
      <View style={styles.typingContainer}>
        <View style={[styles.typingBubble, { backgroundColor: theme.surfaceSecondary }]}>
          <Text style={[styles.typingText, { color: theme.textSecondary }]}>
             Đang nhập...
          </Text>
        </View>
      </View>
    );
  };

  if (isLoading) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (messages.length === 0) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: theme.background }]}>
        <Text style={[styles.emptyTitle, { color: theme.text }]}>Chưa có tin nhắn</Text>
        <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>Hãy bắt đầu cuộc trò chuyện!</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.messageId || item.id}
        ListFooterComponent={renderTypingIndicator}
        contentContainerStyle={styles.listContent}
        keyboardDismissMode="interactive"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  listContent: {
    paddingVertical: SPACING.md,
  },

  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },

  emptySubtitle: {
    fontSize: 15,
  },

  typingContainer: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },

  typingBubble: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: RADIUS.md,
    alignSelf: 'flex-start',
  },

  typingText: {
    fontSize: 12,
    fontStyle: 'italic',
  },
});

export default MessageList;
