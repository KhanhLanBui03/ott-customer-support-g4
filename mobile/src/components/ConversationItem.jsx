import React from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
} from 'react-native';

import { getPreviewText } from '../utils/messageUtils';

/**
 * ConversationItem Component
 * Displays a single conversation item with avatar, name, and last message
 */

import { useTheme } from '../context/ThemeContext';

const ConversationItem = ({ conversation, onPress, isActive }) => {
  const { colors, isDark } = useTheme();
  
  const formatTime = (timestamp) => {
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
          backgroundColor: colors.background, 
          borderBottomColor: colors.border 
        },
        isActive && { 
          backgroundColor: isDark ? colors.surface200 : 'rgba(99, 102, 241, 0.1)',
          borderLeftColor: colors.primary 
        }
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Image
        source={{ uri: conversation.avatar || 'https://via.placeholder.com/48' }}
        style={[styles.avatar, { backgroundColor: colors.surface200 }]}
      />

      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>
            {conversation.name}
          </Text>
          <Text style={[styles.time, { color: colors.textSubtle }]}>{formatTime(conversation.lastMessageTime)}</Text>
        </View>

        <Text style={[styles.preview, { color: colors.textMuted }]} numberOfLines={1}>
          {getPreviewText(conversation.lastMessage, conversation.lastMessageSenderId || conversation.lastSenderId)}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: 'transparent',
    borderBottomWidth: 1,
  },

  active: {
  },

  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
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
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },

  time: {
    fontSize: 12,
    marginLeft: 8,
  },

  preview: {
    fontSize: 13,
    marginTop: 4,
  },
});

export default ConversationItem;
