import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, Image, ActivityIndicator, Alert, ImageBackground } from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { MaterialIcons, Feather, Ionicons } from '@expo/vector-icons';
import { useDispatch, useSelector } from 'react-redux';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import MessageList from '../../../src/components/MessageList';
import MessageInput from '../../../src/components/MessageInput';
import MessageModal from '../../../src/components/MessageModal';
import { fetchMessages, sendMessage, setCurrentConversation, clearCurrentConversation, getRealId, fetchConversations, setReplyingTo, clearReplyingTo, toggleMessageReaction, markConversationRead, recallMessage, deleteMessage } from '../../../src/store/chatSlice';
import { useWebSocket } from '../../../src/hooks/useWebSocket';
import { conversationApi } from '../../../src/api/chatApi';
import { formatLastSeen } from '../../../src/utils/dateUtils';

const ChatDetailScreen = () => {
  const insets = useSafeAreaInsets();
  const dispatch = useDispatch();
  const router = useRouter();
  const { id: rawConversationId } = useLocalSearchParams();
  const conversationId = useMemo(() => decodeURIComponent(rawConversationId || ''), [rawConversationId]);

  const [selectedMessage, setSelectedMessage] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);

  // KÍCH HOẠT WEBSOCKET TRỰC TIẾP TẠI ĐÂY
  const { sendMessageRealtime, sendReadReceipt, sendTypingStart, sendTypingStop } = useWebSocket();

  // Track screen focus state - khi screen mất focus (user back ra), chặn read receipts
  const isFocusedRef = React.useRef(true);

  const chatState = useSelector((state) => state.chat);
  const currentUser = useSelector((state) => state.auth.user);
  const conversations = chatState.conversations || [];

  // Xác định ID chuẩn
  const realId = useMemo(() => getRealId(chatState, conversationId, currentUser?.userId || currentUser?.id), [chatState, conversationId, currentUser]);
  const messages = chatState.messages[realId] || [];
  const conversation = conversations.find(c => c.conversationId === realId);
  const wallpaperUrl = conversation?.wallpaperUrl || null;
  const isLoading = chatState.loading;
  
  const myRole = useMemo(() => 
    conversation?.members?.find(m => String(m.userId || m.id) === String(currentUser?.userId || currentUser?.id))?.role || 'MEMBER',
    [conversation, currentUser]
  );
  const isAdmin = myRole === 'OWNER' || myRole === 'ADMIN';
  const isRestricted = conversation?.onlyAdminsCanChat && !isAdmin;

  // Ref để truy cập messages mới nhất bên trong useFocusEffect mà không cần thêm deps
  const messagesRef = React.useRef(messages);
  React.useEffect(() => { messagesRef.current = messages; }, [messages]);

  // Effect 1: Tải dữ liệu ban đầu - chỉ chạy khi conversationId thay đổi
  useEffect(() => {
    if (!conversationId || !currentUser) return;

    // Đồng bộ danh sách hội thoại nếu cần
    if (conversations.length === 0) {
      dispatch(fetchConversations());
    }

    // Tải tin nhắn
    dispatch(fetchMessages(conversationId));
  }, [conversationId, currentUser?.userId, currentUser?.id, dispatch]);

  // Effect 2: Xử lý focus/blur - CORE LOGIC cho seen/delivered
  // Y như web: vào chat = set active + gửi read receipt (→ seen)
  //           rời chat = clear active (→ đã nhận)
  useFocusEffect(
    useCallback(() => {
      // === KHI SCREEN ĐƯỢC FOCUS (user vào/quay lại chat) ===
      isFocusedRef.current = true;
      console.log('[Chat] Screen gained focus, realId:', realId);

      if (realId) {
        // 1. Set conversation hiện tại để useWebSocket auto-read cho tin nhắn mới
        dispatch(setCurrentConversation(realId));

        // 2. Reset unread count local
        dispatch(markConversationRead(realId));

        // 3. Reset unread count trên server
        conversationApi.markAsRead(realId).catch(e =>
          console.warn('[Chat] markAsRead API error:', e.message)
        );

        // 4. Gửi read receipt cho tin nhắn mới nhất từ người khác
        //    → server broadcast MESSAGE_READ → web chuyển từ "Đã nhận" sang "seen"
        const myId = String(currentUser?.userId || currentUser?.id || '');
        const currentMessages = messagesRef.current;
        const latestFromOther = [...currentMessages].reverse().find(m =>
          String(m.senderId) !== myId &&
          m.messageId &&
          !String(m.messageId).startsWith('temp-')
        );
        if (latestFromOther) {
          console.log('[Chat] Sending read receipt for latest unread:', latestFromOther.messageId);
          sendReadReceipt(latestFromOther.messageId, realId);
        }
      }

      // === KHI SCREEN MẤT FOCUS (user rời chat) ===
      return () => {
        isFocusedRef.current = false;
        console.log('[Chat] Screen lost focus, clearing current conversation');
        dispatch(clearCurrentConversation());
        dispatch(clearReplyingTo());
      };
    }, [dispatch, realId, sendReadReceipt, currentUser?.userId, currentUser?.id])
  );

  // Wrap sendReadReceipt - chỉ gửi khi screen đang focused
  const guardedSendReadReceipt = useCallback((messageId, convId) => {
    if (!isFocusedRef.current) {
      return;
    }
    sendReadReceipt(messageId, convId);
  }, [sendReadReceipt]);

  // Effect 2: Refresh thông tin hội thoại định kỳ (avatar, status) - KHÔNG re-fetch messages
  useEffect(() => {
    const interval = setInterval(() => {
      dispatch(fetchConversations());
    }, 30000);

    return () => clearInterval(interval);
  }, [dispatch]);

  const flatListRef = useRef(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState(null);

  const handleScrollToMessage = (messageId) => {
    const index = messages.findIndex(m => m.messageId === messageId);
    if (index !== -1 && flatListRef.current) {
      flatListRef.current.scrollToIndex({ index, animated: true, viewPosition: 0.5 });
      setHighlightedMessageId(messageId);
      setTimeout(() => setHighlightedMessageId(null), 2000);
    }
  };

  const handleSendMessage = (content, replyToMessageId, type = 'TEXT', mediaUrls = []) => {
    const isMedia = mediaUrls.length > 0;
    if ((!content.trim() && !isMedia) || !realId) return;

    dispatch(sendMessage({
      conversationId: realId,
      content: content || '',
      type,
      replyToMessageId,
      mediaUrls
    }));
  };

  const handlePressMessage = (message) => {
    if (!message || !realId || !message.messageId) return;
    if (String(message.senderId) === String(currentUser?.userId || currentUser?.id)) return;

    // Chỉ gửi read receipt khi người dùng thật sự click vào tin nhắn trong màn chat
    guardedSendReadReceipt(String(message.messageId), realId);
    dispatch(markConversationRead(realId));
  };

  const handleReaction = async (messageId, emoji) => {
    if (!realId || !messageId) return;

    const currentUserId = currentUser?.userId || currentUser?.id;
    const msg = messages.find(m => m.messageId === messageId);
    if (!msg) return;

    // Kiểm tra xem đã react với emoji này chưa
    const alreadyReacted = msg.reactions?.[emoji]?.some(uid => String(uid) === String(currentUserId));

    // 1. Optimistic Update: Cập nhật UI ngay lập tức
    dispatch(toggleMessageReaction({
      conversationId: realId,
      messageId,
      emoji,
      userId: currentUserId
    }));

    try {
      const { chatApi } = require('../../../src/api/chatApi');
      if (alreadyReacted) {
        await chatApi.removeReaction(messageId, realId, { emoji });
      } else {
        await chatApi.addReaction(messageId, realId, { emoji });
      }
    } catch (error) {
      // Nếu lỗi, thực hiện toggle lại để hoàn tác (revert)
      dispatch(toggleMessageReaction({
        conversationId: realId,
        messageId,
        emoji,
        userId: currentUserId
      }));
      console.error('Reaction error:', error);
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
    return String(otherMember?.status || '').toUpperCase() === 'ONLINE' || otherMember?.isOnline === true;
  }, [conversation, otherMember]);

  const onlineUsers = useMemo(() => {
    const currentUserIdStr = String(currentUser?.userId || currentUser?.id || '');
    return (conversation?.members || [])
      .filter(member => {
        const memberId = String(member.userId || member.id || '');
        return memberId && memberId !== currentUserIdStr &&
          (String(member.status || member.presence || '').toUpperCase() === 'ONLINE' || member.isOnline === true);
      })
      .map(member => String(member.userId || member.id || ''));
  }, [conversation, currentUser]);

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
        Alert.alert('Xác nhận', 'Bạn có muốn xóa tin nhắn này ở phía bạn?', [
          { text: 'Hủy', style: 'cancel' },
          { 
            text: 'Xóa', 
            style: 'destructive',
            onPress: () => {
              dispatch(deleteMessage({ 
                messageId: message.messageId, 
                conversationId: realId 
              }));
            } 
          } 
        ]);
        break;
      case 'recall':
        Alert.alert('Thu hồi tin nhắn', 'Tin nhắn này sẽ bị thu hồi với tất cả mọi người. Bạn có chắc chắn?', [
          { text: 'Hủy', style: 'cancel' },
          { 
            text: 'Thu hồi', 
            style: 'destructive',
            onPress: () => {
              dispatch(recallMessage({ 
                messageId: message.messageId, 
                conversationId: realId 
              }));
            } 
          }
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
            <Ionicons name="chevron-back" size={28} color="#6366f1" />
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
              <View style={styles.nameRow}>
                <Text style={styles.headerTitle} numberOfLines={1}>{displayName}</Text>
                {conversation?.type === 'SINGLE' && (
                  <View style={[
                    styles.miniTag, 
                    friendshipStatus === 'ACCEPTED' ? styles.friendMiniTag : styles.strangerMiniTag
                  ]}>
                    <Text style={[
                      styles.miniTagText,
                      friendshipStatus === 'ACCEPTED' ? styles.friendMiniTagText : styles.strangerMiniTagText
                    ]}>
                      {friendshipStatus === 'ACCEPTED' ? 'BẠN' : 'LẠ'}
                    </Text>
                  </View>
                )}
              </View>
              <Text style={[styles.headerStatus, isOnline ? styles.statusOnline : styles.statusOffline]} numberOfLines={1}>
                {otherMember 
                  ? formatLastSeen(otherMember.status || otherMember.presence, otherMember.lastSeenAt || otherMember.last_seen_at) 
                  : (conversation?.type === 'GROUP' 
                      ? `${conversation?.members?.length || 0} thành viên` 
                      : (isOnline ? 'Đang hoạt động' : 'Ngoại tuyến')
                    )
                }
              </Text>
            </View>
          </TouchableOpacity>

          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.headerActionButton}>
              <MaterialIcons name="call" size={24} color="#6366f1" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerActionButton}>
              <MaterialIcons name="videocam" size={24} color="#6366f1" />
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.headerActionButton}
              onPress={() => router.push(`/chat-info/${encodeURIComponent(realId)}`)}
            >
              <MaterialIcons name="info-outline" size={24} color="#6366f1" />
            </TouchableOpacity>
          </View>
        </View>
 
        <View style={styles.chatArea}>
          {isLoading && messages.length === 0 ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#667eea" />
            </View>
          ) : wallpaperUrl ? (
            <View style={{ flex: 1, backgroundColor: '#000' }}>
              <ImageBackground
                source={{ uri: wallpaperUrl }}
                style={styles.wallpaperBackground}
                imageStyle={styles.wallpaperImage}
                blurRadius={10}
              >
                <MessageList
                  ref={flatListRef}
                  messages={messages}
                  conversationId={realId}
                  currentUserId={currentUser?.userId || currentUser?.id}
                  onlineUsers={onlineUsers}
                  typingUsers={chatState.typingUsers?.[realId] || []}
                  sendReadReceipt={guardedSendReadReceipt}
                  onLoadMore={handleLoadMore}
                  onReact={handleReaction}
                  onLongPress={handleLongPressMessage}
                  onPressReply={handleScrollToMessage}
                  highlightedMessageId={highlightedMessageId}
                />
              </ImageBackground>
            </View>
          ) : (
            <MessageList
              ref={flatListRef}
              messages={messages}
              conversationId={realId}
              currentUserId={currentUser?.userId || currentUser?.id}
              onlineUsers={onlineUsers}
              typingUsers={chatState.typingUsers?.[realId] || []}
              sendReadReceipt={guardedSendReadReceipt}
              onPressMessage={handlePressMessage}
              onLoadMore={handleLoadMore}
              onReact={handleReaction}
              onLongPress={handleLongPressMessage}
              onPressReply={handleScrollToMessage}
              highlightedMessageId={highlightedMessageId}
            />
          )}
        </View>

        <View style={{ paddingBottom: Math.max(insets.bottom, 12), backgroundColor: '#fff' }}>
          {isRestricted ? (
            <View style={styles.restrictedContainer}>
              <MaterialIcons name="lock-outline" size={20} color="#64748b" />
              <Text style={styles.restrictedText}>Chỉ quản trị viên mới có thể gửi tin nhắn</Text>
            </View>
          ) : (
            <MessageInput 
              onSendMessage={handleSendMessage} 
              onTypingChange={(isTyping) => {
                if (isTyping) {
                  sendTypingStart(realId);
                } else {
                  sendTypingStop(realId);
                }
              }}
            />
          )}
        </View>

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
  wallpaperBackground: { flex: 1, overflow: 'hidden' },
  wallpaperImage: { resizeMode: 'cover', opacity: 0.7 }, // Giảm opacity để màu background trộn vào
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
  headerStatus: { fontSize: 12, color: '#64748b', fontWeight: '400' },
  statusOnline: { color: '#10b981' },
  statusOffline: { color: '#94a3b8' },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  miniTag: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
    borderWidth: 1,
  },
  friendMiniTag: {
    backgroundColor: '#f0fdf4',
    borderColor: '#bbf7d0',
  },
  strangerMiniTag: {
    backgroundColor: '#fff7ed',
    borderColor: '#ffedd5',
  },
  miniTagText: {
    fontSize: 9,
    fontWeight: '800',
  },
  friendMiniTagText: {
    color: '#16a34a',
  },
  strangerMiniTagText: {
    color: '#ea580c',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  headerActionButton: {
    padding: 8,
  },
  restrictedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    backgroundColor: '#f8fafc',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    gap: 8,
  },
  restrictedText: {
    color: '#64748b',
    fontSize: 14,
    fontWeight: '500',
  },
});

export default ChatDetailScreen;
