import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

/**
 * ChatBubble Component
 * Displays a single message in the chat
 */

const ChatBubble = ({ message, isOwn, onLongPress }) => {
  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <View
      style={[
        styles.container,
        isOwn ? styles.ownContainer : styles.otherContainer,
      ]}
    >
      <TouchableOpacity
        activeOpacity={0.7}
        onLongPress={() => onLongPress && onLongPress(message)}
        style={[styles.bubble, isOwn ? styles.ownBubble : styles.otherBubble]}
      >
        <Text
          style={[
            styles.text,
            isOwn ? styles.ownText : styles.otherText,
          ]}
        >
          {message.recalled ? '[This message was recalled]' : message.content}
        </Text>
      </TouchableOpacity>

      <Text style={[styles.time, isOwn ? styles.ownTime : styles.otherTime]}>
        {formatTime(message.createdAt)}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
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
    maxWidth: '70%',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
  },

  ownBubble: {
    backgroundColor: '#667eea',
    borderBottomRightRadius: 4,
  },

  otherBubble: {
    backgroundColor: '#f0f2f5',
    borderBottomLeftRadius: 4,
  },

  text: {
    fontSize: 14,
    lineHeight: 20,
  },

  ownText: {
    color: '#fff',
  },

  otherText: {
    color: '#333',
  },

  time: {
    fontSize: 11,
    marginHorizontal: 8,
    marginBottom: 2,
  },

  ownTime: {
    color: '#999',
  },

  otherTime: {
    color: '#999',
  },
});

export default ChatBubble;
