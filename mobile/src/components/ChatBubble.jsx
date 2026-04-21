import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSelector } from 'react-redux';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../utils/theme';
import CONFIG from '../config';

/**
 * Premium ChatBubble Component
 * Displays a single message with distinct styling for own, other, and AI messages.
 */

const ChatBubble = ({ message, isOwn, onLongPress }) => {
  const themeMode = useSelector((state) => state.auth.theme || 'light');
  const theme = COLORS[themeMode];
  const isAI = message.senderId === CONFIG.AI_BOT_ID;

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    return new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getBubbleStyle = () => {
    if (isAI) {
      return [
        styles.bubble,
        styles.aiBubble,
        { backgroundColor: theme.surfaceSecondary, borderColor: COLORS.accent, borderLevel: 1 }
      ];
    }
    if (isOwn) {
      return [styles.bubble, styles.ownBubble, { backgroundColor: theme.bubbleOwn }];
    }
    return [styles.bubble, styles.otherBubble, { backgroundColor: theme.bubbleOther }];
  };

  const getTextStyle = () => {
    if (isAI) return [styles.text, { color: theme.text }];
    if (isOwn) return [styles.text, { color: theme.textOwn }];
    return [styles.text, { color: theme.textOther }];
  };

  return (
    <View
      style={[
        styles.container,
        isOwn ? styles.ownContainer : styles.otherContainer,
      ]}
    >
      <TouchableOpacity
        activeOpacity={0.8}
        onLongPress={() => onLongPress && onLongPress(message)}
        style={[
          ...getBubbleStyle(),
          isAI && styles.aiGlow
        ]}
      >
        {isAI && (
          <Text style={styles.aiLabel}>✨ {CONFIG.AI_BOT_NAME}</Text>
        )}
        <Text style={getTextStyle()}>
          {message.recalled ? '[Tin nhắn đã bị thu hồi]' : message.content}
        </Text>
      </TouchableOpacity>

      <Text style={[styles.time, { color: theme.textMuted }]}>
        {formatTime(message.createdAt)}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: SPACING.xs,
    paddingHorizontal: SPACING.md,
    flexDirection: 'row',
    alignItems: 'flex-end',
  },

  ownContainer: {
    justifyContent: 'flex-end',
  },

  otherContainer: {
    justifyContent: 'flex-start',
  },

  bubble: {
    maxWidth: '80%',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: RADIUS.lg,
    ...SHADOWS.sm,
  },

  ownBubble: {
    borderBottomRightRadius: 2,
  },

  otherBubble: {
    borderBottomLeftRadius: 2,
  },

  aiBubble: {
    borderWidth: 1,
    borderBottomLeftRadius: 2,
  },
  
  aiGlow: {
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 3,
  },

  aiLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.accent,
    marginBottom: 4,
    textTransform: 'uppercase',
  },

  text: {
    fontSize: 15,
    lineHeight: 22,
  },

  time: {
    fontSize: 10,
    marginHorizontal: 6,
    marginBottom: 2,
  },
});

export default ChatBubble;
