import { useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  addMessage,
  updateMessage,
  removeMessage,
  setTypingUser,
  addReaction,
} from '../store/chatSlice';
import {
  initializeSocket,
  disconnectSocket,
  onMessageReceive,
  offMessageReceive,
  onMessageEdit,
  onMessageDelete,
  onMessageRecall,
  onReaction,
  onUserTyping,
  offUserTyping,
  emitSendMessage,
  emitTypingStart,
  emitTypingStop,
  emitReadReceipt,
} from '../utils/socket';

/**
 * Custom hook for WebSocket connection (React Native)
 * Same interface as Web version
 */

export const useWebSocket = () => {
  const { accessToken, user } = useSelector((state) => state.auth);
  const { currentConversationId } = useSelector((state) => state.chat);
  const dispatch = useDispatch();

  // Initialize socket on mount or when token changes
  useEffect(() => {
    if (accessToken && user) {
      try {
        initializeSocket(accessToken);
        console.log('✓ WebSocket initialized');
      } catch (error) {
        console.error('Failed to initialize socket:', error);
      }
    }

    return () => {
      // Cleanup on unmount (don't disconnect to keep persistent connection)
    };
  }, [accessToken, user]);

  // Listen for incoming messages
  useEffect(() => {
    const handleMessageReceive = (data) => {
      if (data.conversationId === currentConversationId) {
        dispatch(
          addMessage({
            conversationId: data.conversationId,
            message: data,
          })
        );
      }
    };

    onMessageReceive(handleMessageReceive);

    return () => {
      offMessageReceive(handleMessageReceive);
    };
  }, [dispatch, currentConversationId]);

  // Listen for message edits
  useEffect(() => {
    const handleMessageEdit = (data) => {
      dispatch(
        updateMessage({
          conversationId: data.conversationId,
          messageId: data.messageId,
          updates: { content: data.content, editedAt: data.editedAt },
        })
      );
    };

    onMessageEdit(handleMessageEdit);

    return () => {
      // Socket.io cleanup
    };
  }, [dispatch]);

  // Listen for message deletes
  useEffect(() => {
    const handleMessageDelete = (data) => {
      dispatch(
        removeMessage({
          conversationId: data.conversationId,
          messageId: data.messageId,
        })
      );
    };

    onMessageDelete(handleMessageDelete);

    return () => {
      // Socket.io cleanup
    };
  }, [dispatch]);

  // Listen for typing indicators
  useEffect(() => {
    const handleUserTyping = (data) => {
      if (data.conversationId === currentConversationId) {
        dispatch(
          setTypingUser({
            conversationId: data.conversationId,
            userId: data.userId,
            isTyping: data.isTyping,
          })
        );

        // Clear typing indicator after 3 seconds
        if (data.isTyping) {
          setTimeout(() => {
            dispatch(
              setTypingUser({
                conversationId: data.conversationId,
                userId: data.userId,
                isTyping: false,
              })
            );
          }, 3000);
        }
      }
    };

    onUserTyping(handleUserTyping);

    return () => {
      offUserTyping(handleUserTyping);
    };
  }, [dispatch, currentConversationId]);

  // Listen for reactions
  useEffect(() => {
    const handleReaction = (data) => {
      if (data.conversationId === currentConversationId) {
        dispatch(
          addReaction({
            conversationId: data.conversationId,
            messageId: data.messageId,
            emoji: data.emoji,
          })
        );
      }
    };

    onReaction(handleReaction);

    return () => {
      // Socket.io cleanup
    };
  }, [dispatch, currentConversationId]);

  // Method to send message in real-time
  const sendMessageRealtime = useCallback(
    (conversationId, messageData) => {
      emitSendMessage(conversationId, messageData);
    },
    []
  );

  // Method to emit typing indicator
  const sendTypingStart = useCallback((conversationId) => {
    emitTypingStart(conversationId);
  }, []);

  const sendTypingStop = useCallback((conversationId) => {
    emitTypingStop(conversationId);
  }, []);

  // Method to mark message as read
  const sendReadReceipt = useCallback((messageId) => {
    emitReadReceipt(messageId);
  }, []);

  // Disconnect socket on logout
  const disconnect = useCallback(() => {
    disconnectSocket();
  }, []);

  return {
    sendMessageRealtime,
    sendTypingStart,
    sendTypingStop,
    sendReadReceipt,
    disconnect,
  };
};

export default useWebSocket;
