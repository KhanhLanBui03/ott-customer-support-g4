import { useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { chatApi } from '../api/chatApi';
import { setConversations, setActiveConversation, setMessages, addMessage, fetchConversations, fetchFriends } from '../store/chatSlice';

export const useChat = () => {
  const dispatch = useDispatch();
  const { conversations, activeConversationId, messages, friends, loading } = useSelector(state => state.chat);
  const [messagesLoading, setMessagesLoading] = useState(false);

  const fetchConversationsAction = useCallback(async () => {
    dispatch(fetchConversations());
  }, [dispatch]);
  
  const fetchFriendsAction = useCallback(async () => {
    dispatch(fetchFriends());
  }, [dispatch]);

  const fetchMessages = useCallback(async (conversationId) => {
    if (!conversationId) return;
    setMessagesLoading(true);
    try {
      const data = await chatApi.getMessages(conversationId);
      // Backend returns ApiResponse<Map<String, Object>> where the map contains "messages"
      const messagesList = data.data?.messages || data.data || data;
      dispatch(setMessages({ conversationId, messages: messagesList }));
    } catch (err) {
      console.error("Failed to fetch messages", err);
    } finally {
      setMessagesLoading(false);
    }
  }, [dispatch]);

  const selectConversation = useCallback((id) => {
    dispatch(setActiveConversation(id));
    fetchMessages(id);
  }, [dispatch, fetchMessages]);

  const create = useCallback(async (type, memberIds, name = null) => {
    try {
      const result = await chatApi.createConversation({ 
        type, 
        memberIds,
        name,
        isGroup: type === 'GROUP' 
      });
      await fetchConversations();
      return { payload: result.data || result };
    } catch (err) {
      return { error: err };
    }
  }, [fetchConversations]);

  const inviteMember = useCallback(async (conversationId, userId) => {
    try {
      await chatApi.inviteMember(conversationId, userId);
    } catch (err) {
      console.error("Failed to invite member", err);
    }
  }, []);

  const acceptGroupInvitation = useCallback(async (invitationId) => {
    try {
      await chatApi.acceptGroupInvitation(invitationId);
      await fetchConversationsAction();
    } catch (err) {
      console.error("Failed to accept group invite", err);
    }
  }, [fetchConversationsAction]);

  const removeMember = useCallback(async (conversationId, userId) => {
    try {
      await chatApi.removeMember(conversationId, userId);
      await fetchConversations();
    } catch (err) {
      console.error("Failed to remove member", err);
    }
  }, [fetchConversations]);

  return {
    conversations,
    activeConversationId,
    messages,
    loading,
    messagesLoading,
    fetchConversations: fetchConversationsAction,
    fetchMessages,
    selectConversation,
    create,
    inviteMember,
    acceptGroupInvitation,
    removeMember,
    friends,
    fetchFriends: fetchFriendsAction
  };
};

export default useChat;
