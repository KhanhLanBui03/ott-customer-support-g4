import React, { useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useDispatch, useSelector } from 'react-redux';
import MessageList from '../../components/MessageList';
import MessageInput from '../../components/MessageInput';
import { fetchMessages, sendMessage } from '../../store/chatSlice';

/**
 * ChatDetailScreen (Mobile)
 * Detailed chat view for a specific conversation with Redux integration
 */

const ChatDetailScreen = () => {
  const dispatch = useDispatch();
  const router = useRouter();
  const { id: conversationId } = useLocalSearchParams();

  // Redux selectors
  const messages = useSelector((state) => state.chat.messages);
  const isLoading = useSelector((state) => state.chat.isLoading);
  const isSending = useSelector((state) => state.chat.isSending || false);
  const typingUsers = useSelector((state) => state.chat.typingUsers || []);
  const onlineUsers = useSelector((state) => state.chat.onlineUsers || []);
  const currentUser = useSelector((state) => state.auth.user);
  const conversations = useSelector((state) => state.chat.conversations);

  // Get conversation details from Redux
  const conversation = conversations?.find((c) => c.conversationId === conversationId);

  // Fetch messages on mount when conversationId is available
  useEffect(() => {
    if (conversationId) {
      dispatch(fetchMessages(conversationId));
    }
  }, [conversationId, dispatch]);

  const handleSendMessage = (content) => {
    if (!content.trim() || !conversationId) return;

    dispatch(
      sendMessage({
        conversationId,
        content,
        type: 'TEXT',
      })
    );
  };

  const handleBack = () => {
    router.back();
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        {/* Messages Header */}
        <View style={styles.messagesHeader}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <MaterialIcons name="arrow-back" size={24} color="#667eea" />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            {conversation?.avatar ? (
              <Image
                source={{ uri: conversation.avatar }}
                style={styles.headerAvatar}
              />
            ) : (
              <View style={styles.headerAvatarPlaceholder}>
                <Text style={styles.headerAvatarText}>
                  {(conversation?.name || 'U')[0].toUpperCase()}
                </Text>
              </View>
            )}
            <View style={styles.headerInfo}>
              <Text style={styles.headerTitle}>{conversation?.name || 'Chat'}</Text>
              {onlineUsers?.length > 0 && (
                <Text style={styles.headerStatus}>Online</Text>
              )}
            </View>
          </View>
          <TouchableOpacity style={styles.headerActionButton}>
            <MaterialIcons name="info" size={24} color="#667eea" />
          </TouchableOpacity>
        </View>

        {/* Messages List or Loading */}
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#667eea" />
            <Text style={styles.loadingText}>Loading messages...</Text>
          </View>
        ) : (
          <MessageList
            messages={messages || []}
            currentUserId={currentUser?.userId}
            typingUsers={typingUsers}
            onlineUsers={onlineUsers}
            isLoading={false}
          />
        )}

        {/* Message Input */}
        <MessageInput
          onSendMessage={handleSendMessage}
          isLoading={isSending}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6b7280',
  },

  messagesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    gap: 12,
  },

  backButton: {
    padding: 8,
  },

  headerContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  headerInfo: {
    flex: 1,
  },

  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },

  headerAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#667eea',
    justifyContent: 'center',
    alignItems: 'center',
  },

  headerAvatarText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },

  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },

  headerStatus: {
    fontSize: 12,
    color: '#4ade80',
    marginTop: 2,
    fontWeight: '500',
  },

  headerActionButton: {
    padding: 8,
  },
});

export default ChatDetailScreen;
