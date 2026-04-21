import React, { useState } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

/**
 * MessageInput Component
 * Input field for typing and sending messages
 */

const MessageInput = ({ onSendMessage, isLoading = false, onTypingChange }) => {
  const [message, setMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  const handleChange = (text) => {
    setMessage(text);

    // Typing indicator
    if (!isTyping && text.length > 0) {
      setIsTyping(true);
      onTypingChange && onTypingChange(true);
    }
  };

  const handleSendMessage = () => {
    if (message.trim() && !isLoading) {
      onSendMessage(message.trim());
      setMessage('');
      setIsTyping(false);
      onTypingChange && onTypingChange(false);
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.actionButton} disabled={isLoading}>
        <MaterialIcons name="attach-file" size={24} color="#667eea" />
      </TouchableOpacity>

      <TextInput
        style={styles.input}
        placeholder="Type a message..."
        placeholderTextColor="#999"
        value={message}
        onChangeText={handleChange}
        editable={!isLoading}
        multiline
        maxHeight={100}
      />

      <TouchableOpacity
        style={[styles.sendButton, !message.trim() && styles.sendButtonDisabled]}
        onPress={handleSendMessage}
        disabled={!message.trim() || isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color="#667eea" size="small" />
        ) : (
          <MaterialIcons name="send" size={20} color="#667eea" />
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    gap: 8,
  },

  actionButton: {
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },

  input: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#f3f4f6',
    borderRadius: 20,
    fontSize: 14,
    maxHeight: 100,
    minHeight: 40,
  },

  sendButton: {
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },

  sendButtonDisabled: {
    opacity: 0.5,
  },
});

export default MessageInput;
