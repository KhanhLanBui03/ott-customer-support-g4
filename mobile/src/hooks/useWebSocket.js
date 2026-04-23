import { useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  addMessage,
  fetchConversations,
} from '../store/chatSlice';
import {
  initializeSocket,
  onMessageReceive,
  offMessageReceive,
  onUserTyping,
  offUserTyping,
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
