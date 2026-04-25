import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, Image, ActivityIndicator, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useDispatch, useSelector } from 'react-redux';
import { SafeAreaView } from 'react-native-safe-area-context';
import MessageList from '../../../src/components/MessageList';
import MessageInput from '../../../src/components/MessageInput';
import MessageModal from '../../../src/components/MessageModal';
import { fetchMessages, sendMessage, setCurrentConversation, getRealId, fetchConversations, setReplyingTo, clearReplyingTo, updateMessageReactions } from '../../../src/store/chatSlice';
import { useWebSocket } from '../../../src/hooks/useWebSocket';

const ChatDetailScreen = () => {
  const dispatch = useDispatch();
  const router = useRouter();
  const { id: rawConversationId } = useLocalSearchParams();
  const conversationId = useMemo(() => decodeURIComponent(rawConversationId || ''), [rawConversationId]);

  const [selectedMessage, setSelectedMessage] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);

  // KÍCH HOẠT WEBSOCKET TRỰC TIẾP TẠI ĐÂY
  const { sendMessageRealtime } = useWebSocket();

  const chatState = useSelector((state) => state.chat);
  const currentUser = useSelector((state) => state.auth.user);
  const conversations = chatState.conversations || [];

  // Xác định ID chuẩn
  const realId = useMemo(() => getRealId(chatState, conversationId, currentUser?.userId || currentUser?.id), [chatState, conversationId, currentUser]);
  const messages = chatState.messages[realId] || [];
  const conversation = conversations.find(c => c.conversationId === realId);
  const isLoading = chatState.loading;

  // Effect 1: Khởi tạo chat - chạy khi conversationId hoặc currentUser thay đổi
  useEffect(() => {
    if (!conversationId || !currentUser) return;

    const initChat = async () => {
      // 1. Đồng bộ danh sách hội thoại nếu cần
      if (conversations.length === 0) {
        await dispatch(fetchConversations());
      }

      // 2. Tải tin nhắn - Để fetchMessages tự giải quyết realId bằng getState() mới nhất
      dispatch(fetchMessages(conversationId));
      
      // 3. Cập nhật ID hiện tại vào store (dùng để highlight hoặc socket)
      // Chúng ta gọi getRealId ở đây với dữ liệu mới nhất từ selector
      const latestRealId = getRealId(chatState, conversationId, currentUser.userId || currentUser.id);
      dispatch(setCurrentConversation(latestRealId));
    };

    initChat();

    return () => {
      dispatch(setCurrentConversation(null));
      dispatch(clearReplyingTo());
    };
  }, [conversationId, currentUser?.userId, currentUser?.id, dispatch]);

  // Effect 2: Refresh thông tin hội thoại định kỳ (avatar, status) - KHÔNG re-fetch messages
  useEffect(() => {
    const interval = setInterval(() => {
      dispatch(fetchConversations());
    }, 30000);

    return () => clearInterval(interval);
  }, [dispatch]);

  const handleSendMessage = (content, replyToMessageId) => {
    if (!content.trim() || !realId) return;

    dispatch(sendMessage({
      conversationId: realId,
      content,
      type: 'TEXT',
      replyToMessageId
    }));
  };

  const handleReaction = async (messageId, emoji) => {
    try {
      await dispatch(updateMessageReactions({ conversationId: realId, messageId, reactions: { [emoji]: [currentUser.userId] } }));
      // Gọi API thực tế
      const { chatApi } = require('../../../src/api/chatApi');
      await chatApi.addReaction(messageId, realId, { emoji });
    } catch (error) {
      if (error.response?.status !== 401) {
        console.error('Reaction error:', error);
      }
    }
  };

  const displayName = useMemo(() => {
    if (conversation?.type === 'GROUP') return conversation.name || 'Nhóm chat';
    
    if (conversation?.type === 'SINGLE') {
      const currentUserId = String(currentUser?.userId || currentUser?.id || '');
      const otherParticipant = (conversation.members || []).find(p => {
        const pId = String(p.userId || p.id || '');
        return pId !== '' && pId !== currentUserId;
      });
      return otherParticipant?.fullName || otherParticipant?.name || otherParticipant?.username || 'Người dùng';
    }
    
    return conversation?.name || 'Chat';
  }, [conversation, currentUser]);

  const otherMember = useMemo(() => {
    if (conversation?.type !== 'SINGLE') return null;
    const currentUserId = String(currentUser?.userId || currentUser?.id || '');
    return (conversation.members || []).find(p => {
      const pId = String(p.userId || p.id || '');
      return pId !== '' && pId !== currentUserId;
    });
  }, [conversation, currentUser]);

  const friendshipStatus = otherMember?.friendshipStatus || 'NONE';

  const otherAvatar = useMemo(() => {
    if (conversation?.type === 'GROUP') return conversation.avatarUrl || conversation.avatar;
    return otherMember?.avatarUrl || otherMember?.avatar || otherMember?.profilePic;
  }, [conversation, otherMember]);

  const isOnline = useMemo(() => {
    if (conversation?.type === 'GROUP') return false;
    return otherMember?.status === 'ONLINE' || otherMember?.isOnline === true;
  }, [conversation, otherMember]);

  const headerAvatarUrl = otherAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=667eea&color=fff&size=128&bold=true`;

  const handleLoadMore = async () => {
    if (realId) {
      await dispatch(fetchMessages({ conversationId: realId, loadMore: true }));
    }
  };

  const handleLongPressMessage = (message) => {
    setSelectedMessage(message);
    setModalVisible(true);
  };

  const handleModalAction = (type, message) => {
    switch (type) {
      case 'reply':
        dispatch(setReplyingTo(message));
        break;
      case 'copy':
        // Sử dụng Clipboard an toàn
        try {
          const { Clipboard } = require('react-native');
          if (Clipboard && Clipboard.setString) {
            Clipboard.setString(message.content);
          } else {
             const { NativeModules } = require('react-native');
             if (NativeModules.Clipboard) {
               NativeModules.Clipboard.setString(message.content);
             }
          }
        } catch (e) {
          console.log('Clipboard not available');
        }
        break;
      case 'delete':
        Alert.alert('Xác nhận', 'Bạn có muốn xóa tin nhắn này?', [
          { text: 'Hủy', style: 'cancel' },
          { text: 'Xóa', onPress: () => {} } // Sẽ implement API sau
        ]);
        break;
      default:
        console.log('Action not implemented:', type);
    }
  };

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
          <TouchableOpacity 
            style={styles.headerContent} 
            onPress={() => router.push(`/chat-info/${encodeURIComponent(realId)}`)}
          >
            <View style={styles.headerAvatarContainer}>
              <Image source={{ uri: headerAvatarUrl }} style={styles.headerAvatar} />
              {isOnline && <View style={styles.headerOnlineBadge} />}
            </View>
            <View style={styles.headerInfo}>
              <View style={styles.nameContainer}>
                <Text style={styles.headerTitle} numberOfLines={1}>{displayName}</Text>
                <MaterialIcons name="verified-user" size={16} color="#6366f1" style={styles.shieldIcon} />
              </View>
              <View style={styles.statusRow}>
                <Text style={[styles.headerStatus, isOnline ? styles.statusOnline : styles.statusOffline]}>
                  {isOnline ? 'Online' : 'Offline'}
                </Text>
                {conversation?.type === 'SINGLE' && (
                  <View style={[
                    styles.statusTag, 
                    friendshipStatus === 'ACCEPTED' ? styles.friendTag : styles.strangerTag
                  ]}>
                    <Text style={[
                      styles.statusTagText,
                      friendshipStatus === 'ACCEPTED' ? styles.friendTagText : styles.strangerTagText
                    ]}>
                      {friendshipStatus === 'ACCEPTED' ? 'BẠN BÈ' : 'NGƯỜI LẠ'}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </TouchableOpacity>
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
              onLoadMore={handleLoadMore}
              onReact={handleReaction}
              onLongPress={handleLongPressMessage}
            />
          )}
        </View>

        <MessageInput onSendMessage={handleSendMessage} />

        <MessageModal
          visible={modalVisible}
          message={selectedMessage}
          isOwn={selectedMessage?.senderId === (currentUser?.userId || currentUser?.id)}
          onClose={() => setModalVisible(false)}
          onAction={handleModalAction}
          onReact={handleReaction}
        />
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
  nameContainer: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  headerTitle: { fontSize: 16, fontWeight: 'bold', color: '#111827' },
  shieldIcon: { marginLeft: 2 },
  headerAvatarContainer: { position: 'relative', width: 40, height: 40 },
  headerAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f3f4f6' },
  headerOnlineBadge: { position: 'absolute', right: 0, bottom: 0, width: 12, height: 12, borderRadius: 6, backgroundColor: '#4ade80', borderWidth: 2, borderColor: '#fff' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  headerStatus: { fontSize: 12, fontWeight: '500' },
  statusOnline: { color: '#10b981' },
  statusOffline: { color: '#9ca3af' },
  statusTag: {
    paddingHorizontal: 8,
    paddingVertical: 1,
    borderRadius: 10,
    borderWidth: 1,
  },
  friendTag: {
    backgroundColor: '#ecfdf5',
    borderColor: '#10b981',
  },
  strangerTag: {
    backgroundColor: '#fff7ed',
    borderColor: '#f97316',
  },
  statusTagText: {
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  friendTagText: {
    color: '#10b981',
  },
  strangerTagText: {
    color: '#f97316',
  },
});

export default ChatDetailScreen;
