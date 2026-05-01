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

const ConversationItem = ({ conversation, onPress, isActive }) => {
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
      style={[styles.container, isActive && styles.active]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Image
        source={{ uri: conversation.avatar || 'https://via.placeholder.com/48' }}
        style={styles.avatar}
      />

      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.name} numberOfLines={1}>
            {conversation.name}
          </Text>
          <Text style={styles.time}>{formatTime(conversation.lastMessageTime)}</Text>
        </View>

        <Text style={styles.preview} numberOfLines={1}>
          {getPreviewText(conversation.lastMessage)}
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
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },

  active: {
    backgroundColor: '#f0f2ff',
    borderLeftColor: '#667eea',
  },

  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
    backgroundColor: '#e5e7eb',
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
    color: '#333',
    flex: 1,
  },

  time: {
    fontSize: 12,
    color: '#999',
    marginLeft: 8,
  },

  preview: {
    fontSize: 13,
    color: '#666',
    marginTop: 4,
  },
});

export default ConversationItem;
