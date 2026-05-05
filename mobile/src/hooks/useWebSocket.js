import { useEffect, useCallback, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import {
  addMessage,
  fetchConversations,
  updateMessage,
  updateConversationWallpaper,
  updateMemberInfo,
  setTyping,
  setMessageRead,
  markConversationRead,
  setUserStatus,
  updateConversation,
  removeMemberLocal,
  updateMemberRoleLocal,
  fetchMessages,
} from '../store/chatSlice';
import { setInAppNotification } from '../store/notificationSlice';
import {
  onMessageReceive,
  offMessageReceive,
  onUserTyping,
  offUserTyping,
  onUserStatusChange,
  offUserStatusChange,
  onMessageUpdate,
  offMessageUpdate,
  onMessageRead,
  offMessageRead,
  onMessageRecall,
  offMessageRecall,
  onMessageDelete,
  offMessageDelete,
  onWallpaperUpdated,
  offWallpaperUpdated,
  onUserUpdate,
  offUserUpdate,
  onConversationUpdate,
  offConversationUpdate,
  emitSendMessage,
  emitTypingStart,
  emitTypingStop,
  emitReadReceipt,
  emitRecallMessage,
} from '../utils/socket';

export const useWebSocket = () => {
  const { accessToken, user } = useSelector((state) => state.auth);
  const currentConversationId = useSelector((state) => state.chat.currentConversationId);
  const conversations = useSelector((state) => state.chat.conversations || []);
  const dispatch = useDispatch();
  const [appState, setAppState] = useState(AppState.currentState);
  const appStateRef = useRef(AppState.currentState);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      setAppState(nextAppState);
      appStateRef.current = nextAppState;
    });
    return () => subscription.remove();
  }, []);

  const activeConvIdRef = useRef(currentConversationId);
  activeConvIdRef.current = currentConversationId; // Đồng bộ lập tức trong render

  const userRef = useRef(user);
  useEffect(() => {
    userRef.current = user;
  }, [user]);
  
  const conversationsRef = useRef(conversations);
  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  // Socket đã được khởi tạo trong _layout.jsx với globalHandler
  // KHÔNG gọi initializeSocket ở đây vì sẽ xóa globalHandler của _layout.jsx

  // Nhận tin nhắn mới
  useEffect(() => {
    const handleMessageReceive = (message) => {
      console.log('[WS] Mobile received message:', message.messageId);
      const currentUser = userRef.current;
      const currentUserId = userRef.current?.userId || userRef.current?.id || null;

      dispatch(
        addMessage({
          conversationId: message.conversationId,
          message: message,
          currentUserId: currentUserId,
        })
      );

      // Tự động gửi Read Receipt nếu đang mở hội thoại này VÀ app đang active
      const activeConversationId = activeConvIdRef.current;
      const currentAppState = appStateRef.current;

      const isFromMe = currentUserId && String(message.senderId) === String(currentUserId);

      if (activeConversationId &&
        activeConversationId === message.conversationId &&
        currentAppState === 'active' &&
        !isFromMe &&
        message.messageId && !message.messageId.startsWith('temp-')) {
        console.log('[WS] ✅ Sending auto-read receipt for:', message.messageId);
        emitReadReceipt(message.messageId, message.conversationId);
        dispatch(markConversationRead(message.conversationId));
      } else if (!isFromMe && activeConversationId !== message.conversationId) {
        // THÔNG BÁO TRONG APP (NHƯ WEB)
        // Nếu nhận tin nhắn từ hội thoại KHÁC hội thoại đang mở
        const conversations = conversationsRef.current;
        const conv = conversations.find(c => c.conversationId === message.conversationId);
        
        dispatch(setInAppNotification({
          conversationId: message.conversationId,
          title: conv?.name || message.senderName || message.fullName || "Tin nhắn mới",
          message: message.content || "Đã gửi một tệp đính kèm",
          avatarUrl: conv?.avatarUrl || message.avatarUrl || null,
        }));
      }

      // Khi có tin nhắn mới, Redux addMessage đã cập nhật lastMessage và unreadCount
      // Không gọi fetchConversations ở đây để tránh ghi đè state local bằng data server cũ (race condition)
    };

    onMessageReceive(handleMessageReceive);
    return () => offMessageReceive(handleMessageReceive);
  }, [dispatch]);

  // Nhận cập nhật trạng thái online/offline
  useEffect(() => {
    const handleStatusChange = (statusData) => {
      console.log('[WS] User status changed:', statusData.userId, statusData.status);
      // Cập nhật trực tiếp member.status trong store để UI phản ánh ngay lập tức
      dispatch(setUserStatus({
        userId: statusData.userId,
        status: statusData.status,
        lastSeenAt: statusData.lastSeenAt,
      }));
    };

    onUserStatusChange(handleStatusChange);
    return () => offUserStatusChange(handleStatusChange);
  }, [dispatch]);

  // Nhận cập nhật tin nhắn (cập nhật reaction / edit / recalls / message status updates)
  useEffect(() => {
    const handleMessageUpdate = (message) => {
      if (!message || !message.messageId) return;
      console.log('[WS] Mobile received message update:', message.messageId);
      dispatch(updateMessage({ conversationId: message.conversationId, message }));
    };

    onMessageUpdate(handleMessageUpdate);
    return () => offMessageUpdate(handleMessageUpdate);
  }, [dispatch]);

  // Nhận sự kiện read receipt từ server
  useEffect(() => {
    const handleMessageRead = (payload) => {
      if (!payload || !payload.messageId || !payload.conversationId) return;
      console.log('[WS] Mobile received message read:', payload.messageId, payload.userId);
      dispatch(setMessageRead({
        conversationId: payload.conversationId,
        messageId: payload.messageId,
        userId: payload.userId,
      }));
    };

    onMessageRead(handleMessageRead);
    return () => offMessageRead(handleMessageRead);
  }, [dispatch]);

  // Nhận sự kiện thu hồi tin nhắn
  useEffect(() => {
    const handleMessageRecall = (payload) => {
      if (!payload || !payload.messageId) return;
      console.log('[WS] Mobile received recall:', payload.messageId);
      dispatch(updateMessage({
        conversationId: payload.conversationId,
        message: {
          ...payload,
          status: 'RECALLED',
          isRecalled: true,
          content: 'Tin nhắn đã bị thu hồi'
        }
      }));
    };

    onMessageRecall(handleMessageRecall);
    return () => offMessageRecall(handleMessageRecall);
  }, [dispatch]);

  // Nhận sự kiện xóa tin nhắn
  useEffect(() => {
    const handleMessageDelete = (payload) => {
      if (!payload || !payload.messageId) return;
      console.log('[WS] Mobile received delete:', payload.messageId);
      // Ở đây có thể dispatch action xóa tin nhắn khỏi store nếu cần
    };

    onMessageDelete(handleMessageDelete);
    return () => offMessageDelete(handleMessageDelete);
  }, [dispatch]);

  useEffect(() => {
    const handleWallpaperUpdate = (payload) => {
      if (!payload || !payload.conversationId) return;
      console.log('[WS] Mobile received wallpaper update:', payload.conversationId, payload.wallpaperUrl);
      dispatch(updateConversationWallpaper({
        conversationId: payload.conversationId,
        wallpaperUrl: payload.wallpaperUrl ?? null,
      }));
    };

    onWallpaperUpdated(handleWallpaperUpdate);
    return () => offWallpaperUpdated(handleWallpaperUpdate);
  }, [dispatch]);

  useEffect(() => {
    const handleUserUpdate = (payload) => {
      if (!payload || !payload.userId) return;
      console.log('[WS] Mobile received user update:', payload.userId);
      dispatch(updateMemberInfo(payload));
    };

    onUserUpdate(handleUserUpdate);
    return () => offUserUpdate(handleUserUpdate);
  }, [dispatch]);

  // Nhận cập nhật hội thoại (Tên, Ảnh, Quyền admin, Member)
  useEffect(() => {
    const handleConversationUpdate = (payload) => {
      if (!payload || !payload.conversationId) return;
      console.log('[WS] Mobile received conversation update:', payload.eventType);
      
      const { conversationId, eventType, payload: data } = payload;
      
      if (eventType === 'CONVERSATION_RECREATED' || eventType === 'GROUP_INVITE') {
        dispatch(fetchConversations());
      } else if (eventType === 'CONVERSATION_UPDATE') {
        dispatch(updateConversation({
          conversationId,
          ...data
        }));
      } else if (eventType === 'MEMBER_UPDATE') {
        // Cập nhật role hoặc info thành viên
        if (data.userId && data.role) {
          dispatch(updateMemberRoleLocal({
            conversationId,
            userId: data.userId,
            role: data.role
          }));
        }
        // Thường thì nên fetch lại để chắc chắn
        dispatch(fetchConversations());
      }
    };

    onConversationUpdate(handleConversationUpdate);
    return () => offConversationUpdate(handleConversationUpdate);
  }, [dispatch]);

  // Nhận sự kiện typing
  useEffect(() => {
    const handleUserTyping = (payload) => {
      if (!payload || !payload.userId || !payload.conversationId) return;
      console.log('[WS] Mobile received typing:', payload.userId, payload.isTyping);
      dispatch(setTyping({
        conversationId: payload.conversationId,
        userId: payload.userId,
        isTyping: payload.isTyping
      }));
    };

    onUserTyping(handleUserTyping);
    return () => offUserTyping(handleUserTyping);
  }, [dispatch]);

  const sendMessageRealtime = useCallback((conversationId, messageData) => {
    emitSendMessage(conversationId, messageData);
  }, []);

  const sendTypingStart = useCallback((conversationId) => {
    emitTypingStart(conversationId);
  }, []);

  const sendTypingStop = useCallback((conversationId) => {
    emitTypingStop(conversationId);
  }, []);

  const sendReadReceipt = useCallback((messageId, conversationId) => {
    emitReadReceipt(messageId, conversationId);
  }, []);

  return {
    sendMessageRealtime,
    sendTypingStart,
    sendTypingStop,
    sendReadReceipt,
    sendRecallMessage: emitRecallMessage,
  };
};

export default useWebSocket;
