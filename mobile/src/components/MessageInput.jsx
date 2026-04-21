import React, { useState } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSelector } from 'react-redux';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../utils/theme';

/**
 * Premium MessageInput Component
 * Redesigned input with theme support and improved interactive feel.
 */

const MessageInput = ({ onSendMessage, isLoading = false, onTypingChange }) => {
  const themeMode = useSelector((state) => state.auth.theme || 'light');
  const theme = COLORS[themeMode];
  const [message, setMessage] = useState('');

  const handleChange = (text) => {
    const wasEmpty = message.length === 0;
    const isNowEmpty = text.length === 0;
    
    setMessage(text);

    if (wasEmpty && !isNowEmpty) {
      onTypingChange && onTypingChange(true);
    } else if (!wasEmpty && isNowEmpty) {
      onTypingChange && onTypingChange(false);
    }
  };

  const handleSendMessage = () => {
    if (message.trim() && !isLoading) {
      onSendMessage(message.trim());
      setMessage('');
      onTypingChange && onTypingChange(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background, borderTopColor: theme.border }]}>
      <TouchableOpacity 
        style={[styles.iconButton, { backgroundColor: theme.surfaceSecondary }]} 
        disabled={isLoading}
      >
        <MaterialCommunityIcons name="plus" size={24} color={theme.textSecondary} />
      </TouchableOpacity>

      <View style={[styles.inputContainer, { backgroundColor: theme.surfaceSecondary }]}>
        <TextInput
          style={[styles.input, { color: theme.text }]}
          placeholder="Viết tin nhắn..."
          placeholderTextColor={theme.textMuted}
          value={message}
          onChangeText={handleChange}
          editable={!isLoading}
          multiline
          maxHeight={100}
        />
        
        <TouchableOpacity 
          style={styles.emojiButton}
          disabled={isLoading}
        >
          <MaterialCommunityIcons name="emoticon-outline" size={22} color={theme.textMuted} />
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[
          styles.sendButton, 
          { backgroundColor: message.trim() ? COLORS.primary : theme.surfaceSecondary },
          !message.trim() && styles.sendButtonDisabled
        ]}
        onPress={handleSendMessage}
        disabled={!message.trim() || isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <MaterialCommunityIcons 
            name="send" 
            size={20} 
            color={message.trim() ? '#ffffff' : theme.textMuted} 
          />
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderTopWidth: 1,
    gap: SPACING.sm,
  },

  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },

  inputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: RADIUS.xl,
    paddingHorizontal: SPACING.md,
    minHeight: 40,
  },

  input: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 10,
    maxHeight: 100,
  },

  emojiButton: {
    padding: 4,
  },

  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.sm,
  },

  sendButtonDisabled: {
    elevation: 0,
    shadowOpacity: 0,
  },
});

export default MessageInput;
