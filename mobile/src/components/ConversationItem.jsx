import React from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useSelector } from 'react-redux';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../utils/theme';
import CONFIG from '../config';

/**
 * Premium ConversationItem Component
 * Displays a single conversation item with avatar, name, last message, and status indicators.
 */

const ConversationItem = ({ conversation, onPress, isActive }) => {
  const themeMode = useSelector((state) => state.auth.theme || 'light');
  const theme = COLORS[themeMode];
  
  // Check if it's an AI chat
  const isAI = conversation.conversationId.includes(CONFIG.AI_BOT_ID) || 
               conversation.participants?.some(p => p.userId === CONFIG.AI_BOT_ID);

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now - date) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <TouchableOpacity
      style={[
        styles.container, 
        { 
          backgroundColor: isActive ? theme.surfaceSecondary : theme.background,
          borderBottomColor: theme.border
        },
        isActive && styles.active
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.avatarContainer}>
        <Image
          source={{ uri: conversation.avatarUrl || 'https://via.placeholder.com/100' }}
          style={[styles.avatar, { backgroundColor: theme.surfaceSecondary }]}
        />
        {isAI && (
          <View style={styles.aiBadge}>
            <Text style={styles.aiBadgeText}>✨</Text>
          </View>
        )}
      </View>

      <View style={styles.content}>
        <View style={styles.header}>
          <Text 
            style={[styles.name, { color: theme.text }]} 
            numberOfLines={1}
          >
            {isAI ? CONFIG.AI_BOT_NAME : conversation.name}
          </Text>
          <Text style={[styles.time, { color: theme.textMuted }]}>
            {formatTime(conversation.lastMessageTime)}
          </Text>
        </View>

        <View style={styles.footer}>
          <Text 
            style={[styles.preview, { color: theme.textSecondary }]} 
            numberOfLines={1}
          >
            {conversation.lastMessage || 'Bắt đầu cuộc trò chuyện mới'}
          </Text>
          
          {conversation.pinned && (
            <View style={[styles.pinIndicator, { backgroundColor: theme.surfaceSecondary }]}>
               <Text style={{ fontSize: 10 }}>📌</Text>
            </View>
          )}

          {conversation.unreadCount > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadText}>{conversation.unreadCount}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    borderBottomWidth: 1,
  },

  active: {
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
  },

  avatarContainer: {
    position: 'relative',
    marginRight: SPACING.md,
  },

  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },

  aiBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: COLORS.background,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.accent,
  },

  aiBadgeText: {
    fontSize: 10,
  },

  content: {
    flex: 1,
    justifyContent: 'center',
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },

  name: {
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
  },

  time: {
    fontSize: 12,
    marginLeft: 8,
  },

  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  preview: {
    fontSize: 14,
    flex: 1,
    paddingRight: 8,
  },

  pinIndicator: {
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
  },

  unreadBadge: {
    backgroundColor: COLORS.primary,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 6,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },

  unreadText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
});

export default ConversationItem;
