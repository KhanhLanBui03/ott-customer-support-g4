import { useCallback, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchConversations,
  fetchMessages,
  sendMessage,
  createConversation,
  setCurrentConversation,
  addMessage,
  updateMessage,
  removeMessage,
  setTypingUser,
  addReaction,
  clearError,
} from '../store/chatSlice';
import { chatApi } from '../api/chatApi';

/**
 * Custom hook for chat functionality (React Native)
 * Same interface as Web version
 */

export const useChat = () => {
  const dispatch = useDispatch();
  const {
    conversations,
    currentConversation,
    currentConversationId,
    messages,
    loading,
    error,
    typingUsers,
    unreadCount,
  } = useSelector((state) => state.chat);

  // Load conversations on mount
  useEffect(() => {
    dispatch(fetchConversations({ offset: 0, limit: 20 }));
  }, [dispatch]);

  const loadConversations = useCallback(
    (offset = 0, limit = 20) => {
      return dispatch(fetchConversations({ offset, limit }));
    },
    [dispatch]
  );

  const loadMessages = useCallback(
    (conversationId, fromMessageId = null, limit = 20) => {
      return dispatch(
        fetchMessages({
          conversationId,
          params: { fromMessageId, limit },
        })
      );
    },
    [dispatch]
  );

  const send = useCallback(
    (conversationId, content, type = 'TEXT', mediaUrls = []) => {
      return dispatch(
        sendMessage({
          conversationId,
          content,
          type,
          mediaUrls,
        })
      );
    },
    [dispatch]
  );

  const create = useCallback(
    (type = 'SINGLE', members = [], name = '') => {
      return dispatch(
        createConversation({
          type,
          members,
          name,
        })
      );
    },
    [dispatch]
  );

  const edit = useCallback(
    async (messageId, content) => {
      try {
        const response = await chatApi.editMessage(messageId, currentConversationId, { content });
        dispatch(
          updateMessage({
            conversationId: currentConversationId,
            messageId,
            updates: { content, editedAt: response.data.editedAt },
          })
        );
        return response;
      } catch (error) {
        console.error('Failed to edit message:', error);
        throw error;
      }
    },
    [dispatch, currentConversationId]
  );

  const deleteMsg = useCallback(
    async (messageId) => {
      try {
        await chatApi.deleteMessage(messageId, currentConversationId);
        dispatch(
          removeMessage({
            conversationId: currentConversationId,
            messageId,
          })
        );
      } catch (error) {
        console.error('Failed to delete message:', error);
        throw error;
      }
    },
    [dispatch, currentConversationId]
  );

  const recall = useCallback(
    async (messageId) => {
      try {
        await chatApi.recallMessage(messageId, currentConversationId);
        dispatch(
          updateMessage({
            conversationId: currentConversationId,
            messageId,
            updates: { recalled: true, content: '[This message was recalled]' },
          })
        );
      } catch (error) {
        console.error('Failed to recall message:', error);
        throw error;
      }
    },
    [dispatch, currentConversationId]
  );

  const react = useCallback(
    async (messageId, emoji) => {
      try {
        await chatApi.addReaction(messageId, currentConversationId, { emoji });
        dispatch(
          addReaction({
            conversationId: currentConversationId,
            messageId,
            emoji,
          })
        );
      } catch (error) {
        console.error('Failed to add reaction:', error);
        throw error;
      }
    },
    [dispatch, currentConversationId]
  );

  const selectConversation = useCallback(
    (conversationId) => {
      dispatch(setCurrentConversation(conversationId));
      if (conversationId && !messages[conversationId]) {
        dispatch(
          fetchMessages({
            conversationId,
            params: { limit: 20 },
          })
        );
      }
    },
    [dispatch, messages]
  );

  const onUserTyping = useCallback(
    (conversationId, userId, isTyping) => {
      dispatch(
        setTypingUser({
          conversationId,
          userId,
          isTyping,
        })
      );
    },
    [dispatch]
  );

  const handleClearError = useCallback(() => {
    dispatch(clearError());
  }, [dispatch]);

  return {
    conversations,
    currentConversation,
    currentConversationId,
    messages: messages[currentConversationId] || [],
    allMessages: messages,
    loading,
    error,
    typingUsers: typingUsers[currentConversationId] || new Set(),
    unreadCount,
    loadConversations,
    loadMessages,
    send,
    create,
    edit,
    delete: deleteMsg,
    recall,
    react,
    selectConversation,
    onUserTyping,
    clearError: handleClearError,
  };
};

export default useChat;
