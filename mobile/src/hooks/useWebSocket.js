import { useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  addMessage,
  fetchConversations,
  updateMessage,
  updateConversationWallpaper,
  updateMemberInfo,
  setTyping,
  setMessageRead,
} from '../store/chatSlice';
import {
  initializeSocket,
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
  onWallpaperUpdated,
  offWallpaperUpdated,
  onUserUpdate,
  offUserUpdate,
  emitSendMessage,
  emitTypingStart,
  emitTypingStop,
  emitReadReceipt,
} from '../utils/socket';

export const useWebSocket = () => {
  const { accessToken, user } = useSelector((state) => state.auth);
  const dispatch = useDispatch();

  useEffect(() => {
    if (accessToken && user) {
      initializeSocket(accessToken);
    }
  }, [accessToken, user]);

  // Nhận tin nhắn mới
  useEffect(() => {
    const handleMessageReceive = (message) => {
      console.log('[WS] Mobile received message:', message.messageId);
      dispatch(
        addMessage({
          conversationId: message.conversationId,
          message: message,
          currentUserId: user?.userId || user?.id,
        })
      );
      // Khi có tin nhắn mới, cập nhật lại danh sách hội thoại để sắp xếp lại
      dispatch(fetchConversations());
    };

    onMessageReceive(handleMessageReceive);
    return () => offMessageReceive(handleMessageReceive);
  }, [dispatch, user]);

  // Nhận cập nhật trạng thái online/offline
  useEffect(() => {
    const handleStatusChange = (statusData) => {
      console.log('[WS] User status changed:', statusData.userId, statusData.status);
      // Fetch lại conversations để cập nhật member status
      dispatch(fetchConversations());
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
  };
};

export default useWebSocket;
