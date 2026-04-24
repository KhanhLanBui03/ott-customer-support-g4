import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useDispatch, useSelector } from 'react-redux';
import { clearReplyingTo } from '../store/chatSlice';

const MessageInput = ({ onSendMessage, isLoading = false, onTypingChange }) => {
  const [message, setMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const dispatch = useDispatch();
  const { user } = useSelector(state => state.auth);
  const { replyingTo } = useSelector(state => state.chat);
  const currentUserId = user?.userId || user?.id;

  const handleChange = (text) => {
    setMessage(text);
    if (!isTyping && text.length > 0) {
      setIsTyping(true);
      onTypingChange && onTypingChange(true);
    }
  };

  const handleSendMessage = () => {
    if (message.trim() && !isLoading) {
      onSendMessage(message.trim(), replyingTo?.messageId);
      setMessage('');
      setIsTyping(false);
      onTypingChange && onTypingChange(false);
      dispatch(clearReplyingTo());
    }
  };

  return (
    <View style={styles.root}>
      {replyingTo && (
        <View style={styles.replyPreview}>
          <View style={styles.replyPreviewLine} />
          <View style={styles.replyPreviewContent}>
            <Text style={styles.replyPreviewSender}>
              Trả lời {String(replyingTo.senderId) === String(user?.userId) || String(replyingTo.senderId) === String(user?.id) 
                ? 'chính mình' 
                : replyingTo.senderName}
            </Text>
            <Text style={styles.replyPreviewText} numberOfLines={1}>{replyingTo.content}</Text>
          </View>
          <TouchableOpacity onPress={() => dispatch(clearReplyingTo())} style={styles.closeButton}>
            <MaterialIcons name="close" size={20} color="#9ca3af" />
          </TouchableOpacity>
        </View>
      )}
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
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  replyPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  replyPreviewLine: {
    width: 3,
    height: '100%',
    backgroundColor: '#3b82f6',
    borderRadius: 2,
    marginRight: 12,
  },
  replyPreviewContent: {
    flex: 1,
  },
  replyPreviewSender: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  replyPreviewText: {
    fontSize: 13,
    color: '#6b7280',
  },
  closeButton: {
    padding: 4,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 8,
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
