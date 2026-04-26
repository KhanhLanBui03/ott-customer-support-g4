import { useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  addMessage,
  fetchConversations,
  updateMessage,
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
        })
      );
      // Khi có tin nhắn mới, cập nhật lại danh sách hội thoại để sắp xếp lại
      dispatch(fetchConversations());
    };

    onMessageReceive(handleMessageReceive);
    return () => offMessageReceive(handleMessageReceive);
  }, [dispatch]);

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
