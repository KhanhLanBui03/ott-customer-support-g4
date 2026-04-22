import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, KeyboardAvoidingView, Platform, Image, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useDispatch, useSelector } from 'react-redux';
import MessageList from '../../../src/components/MessageList';
import MessageInput from '../../../src/components/MessageInput';
import { fetchMessages, sendMessage } from '../../../src/store/chatSlice';

const ChatDetailScreen = () => {
  const dispatch = useDispatch();
  const router = useRouter();
  const { id: conversationId } = useLocalSearchParams();

  const chatState = useSelector((state) => state.chat);
  const currentUser = useSelector((state) => state.auth.user);
  const conversations = chatState.conversations || [];

  // Tìm cuộc hội thoại chuẩn (khớp cả ID ngắn và ID dài)
  const conversation = React.useMemo(() =>
    conversations.find((c) => c.conversationId === conversationId || c.conversationId.includes(conversationId)),
    [conversations, conversationId]
  );

  // VÁ LỖI: Lấy ID chuẩn để truy xuất tin nhắn (Tránh việc ID ngắn không thấy tin nhắn của ID dài)
  const realId = conversation?.conversationId || conversationId;
  const messages = chatState.messages[realId] || [];

  const isLoading = chatState.loading;

  useEffect(() => {
    if (conversationId) {
      dispatch(fetchMessages(conversationId));
    }
  }, [conversationId]);

  const handleSendMessage = (content) => {
    if (!content.trim() || !conversationId) return;

    // Sử dụng ID chuẩn từ Backend (Ví dụ: SINGLE#UUID1#UUID2)
    // thay vì ID ngắn từ URL nếu có
    const actualId = conversation?.conversationId || conversationId;

    dispatch(sendMessage({
      conversationId: actualId,
      content,
      type: 'TEXT'
    }));
  };

  const otherParticipant = React.useMemo(() => {
    if (!conversation?.participants) return null;
    return conversation.participants.find(p => p.userId !== currentUser?.userId);
  }, [conversation, currentUser]);

  const displayName = otherParticipant?.name || conversation?.name || 'Chat';
  const otherAvatar = otherParticipant?.avatar || otherParticipant?.avatarUrl || otherParticipant?.profilePic || conversation?.avatar;
  const isOnline = otherParticipant?.status === 'ONLINE' || otherParticipant?.isOnline === true;

  const headerAvatarUrl = otherAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=667eea&color=fff&size=128&bold=true`;

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container} keyboardVerticalOffset={90}>
        <View style={styles.messagesHeader}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <MaterialIcons name="arrow-back" size={24} color="#667eea" />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <View style={styles.headerAvatarContainer}>
              <Image source={{ uri: headerAvatarUrl }} style={styles.headerAvatar} />
              {isOnline && <View style={styles.headerOnlineBadge} />}
            </View>
            <View style={styles.headerInfo}>
              <Text style={styles.headerTitle}>{displayName}</Text>
              <Text style={[styles.headerStatus, isOnline ? styles.statusOnline : styles.statusOffline]}>
                {isOnline ? 'Online' : 'Offline'}
              </Text>
            </View>
          </View>
        </View>

        {isLoading && messages.length === 0 ? (
          <View style={styles.loadingContainer}><ActivityIndicator size="large" color="#667eea" /></View>
        ) : (
          <MessageList messages={messages} currentUserId={currentUser?.userId} />
        )}

        <MessageInput onSendMessage={handleSendMessage} />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  messagesHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#e5e7eb', gap: 12 },
  backButton: { padding: 8 },
  headerContent: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerInfo: { flex: 1 },
  headerAvatarContainer: {
    position: 'relative',
    width: 40,
    height: 40,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
  },
  headerAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#667eea',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerOnlineBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#4ade80',
    borderWidth: 2,
    borderColor: '#fff',
  },
  statusOnline: {
    color: '#4ade80',
  },
  statusOffline: {
    color: '#9ca3af',
  },
  headerStatus: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: '500',
  },
});

export default ChatDetailScreen;
