import React, { useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, Image, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useDispatch, useSelector } from 'react-redux';
import { SafeAreaView } from 'react-native-safe-area-context';
import MessageList from '../../../src/components/MessageList';
import MessageInput from '../../../src/components/MessageInput';
import { fetchMessages, sendMessage, setCurrentConversation, getRealId, fetchConversations } from '../../../src/store/chatSlice';
import { useWebSocket } from '../../../src/hooks/useWebSocket';

const ChatDetailScreen = () => {
  const dispatch = useDispatch();
  const router = useRouter();
  const { id: conversationId } = useLocalSearchParams();
  
  // KÍCH HOẠT WEBSOCKET TRỰC TIẾP TẠI ĐÂY
  const { sendMessageRealtime } = useWebSocket();

  const chatState = useSelector((state) => state.chat);
  const currentUser = useSelector((state) => state.auth.user);
  const conversations = chatState.conversations || [];

  // Xác định ID chuẩn
  const realId = useMemo(() => getRealId(chatState, conversationId), [chatState, conversationId]);
  const messages = chatState.messages[realId] || [];
  const conversation = conversations.find(c => c.conversationId === realId);
  const isLoading = chatState.loading;

  useEffect(() => {
    const initChat = async () => {
      if (!conversationId) return;

      // 1. Đồng bộ danh sách hội thoại nếu cần
      if (conversations.length === 0) {
        await dispatch(fetchConversations());
      }

      // 2. Thiết lập ID hiện tại
      const actualId = getRealId(chatState, conversationId);
      dispatch(setCurrentConversation(actualId));
      
      // 3. Tải tin nhắn cũ
      dispatch(fetchMessages(conversationId));
    };

    initChat();
    
    return () => {
      dispatch(setCurrentConversation(null));
    };
  }, [conversationId, dispatch, conversations.length]);

  const handleSendMessage = (content) => {
    if (!content.trim() || !realId) return;

    // Gửi qua Redux (để lưu DB và cập nhật UI)
    dispatch(sendMessage({
      conversationId: realId,
      content,
      type: 'TEXT'
    }));
  };

  const otherParticipant = useMemo(() => {
    if (!conversation?.participants) return null;
    return conversation.participants.find(p => p.userId !== (currentUser?.userId || currentUser?.id));
  }, [conversation, currentUser]);

  const displayName = otherParticipant?.name || conversation?.name || 'Chat';
  const otherAvatar = otherParticipant?.avatar || otherParticipant?.avatarUrl || otherParticipant?.profilePic || conversation?.avatar;
  const isOnline = otherParticipant?.status === 'ONLINE' || otherParticipant?.isOnline === true;

  const headerAvatarUrl = otherAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=667eea&color=fff&size=128&bold=true`;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
        style={styles.container} 
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
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
              <Text style={styles.headerTitle} numberOfLines={1}>{displayName}</Text>
              <Text style={[styles.headerStatus, isOnline ? styles.statusOnline : styles.statusOffline]}>
                {isOnline ? 'Online' : 'Offline'}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.chatArea}>
          {isLoading && messages.length === 0 ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#667eea" />
            </View>
          ) : (
            <MessageList 
                messages={messages} 
                currentUserId={currentUser?.userId || currentUser?.id} 
            />
          )}
        </View>

        <MessageInput onSendMessage={handleSendMessage} />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  chatArea: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  messagesHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#e5e7eb', gap: 12 },
  backButton: { padding: 8 },
  headerContent: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerInfo: { flex: 1 },
  headerTitle: { fontSize: 16, fontWeight: '600', color: '#111827' },
  headerAvatarContainer: { position: 'relative', width: 40, height: 40 },
  headerAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f3f4f6' },
  headerOnlineBadge: { position: 'absolute', right: 0, bottom: 0, width: 12, height: 12, borderRadius: 6, backgroundColor: '#4ade80', borderWidth: 2, borderColor: '#fff' },
  statusOnline: { color: '#4ade80' },
  statusOffline: { color: '#9ca3af' },
  headerStatus: { fontSize: 12, marginTop: 2, fontWeight: '500' },
});

export default ChatDetailScreen;
