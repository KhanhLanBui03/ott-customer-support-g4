import { useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { chatApi } from '../api/chatApi';
import { setConversations, setActiveConversation, setMessages, addMessage, fetchConversations, fetchFriends, resetUnreadCount } from '../store/chatSlice';

export const useChat = () => {
  const dispatch = useDispatch();
  const { conversations, activeConversationId, messages, friends, loading } = useSelector(state => state.chat);
  const [messagesLoading, setMessagesLoading] = useState(false);

  const fetchConversationsAction = useCallback(async () => {
    return dispatch(fetchConversations());
  }, [dispatch]);
  
  const fetchFriendsAction = useCallback(async () => {
    dispatch(fetchFriends());
  }, [dispatch]);

  const fetchMessages = useCallback(async (conversationId) => {
    if (!conversationId) return;
    setMessagesLoading(true);
    try {
      const data = await chatApi.getMessages(conversationId);
      // Debug log to inspect server payload for messages (temporary)
      try {
        console.debug('[useChat] fetchMessages payload for', conversationId, data);
      } catch (e) {}
      // Backend returns ApiResponse<Map<String, Object>> where the map contains "messages"
      let messagesList = data.data?.messages || data.data || data;

      // Normalize messages: ensure mediaUrls exists when server returns attachments/files or inline URLs
      try {
        const urlRegex = /(https?:\/\/[^\s"'<>]+\.(?:mp3|m4a|webm|wav|ogg|opus|mp4|jpg|jpeg|png|gif|svg)(?:\?[^\s"'<>]*)?)/gi;

        const normalize = (m) => {
          const msg = { ...m };

          if (!msg.mediaUrls || msg.mediaUrls.length === 0) {
            const candidates = [];

            const pushCandidate = (value) => {
              if (!value) return;
              if (Array.isArray(value)) {
                value.forEach(pushCandidate);
                return;
              }
              if (typeof value === 'string') {
                candidates.push(value);
                return;
              }
              if (typeof value === 'object') {
                ['url', 'fileUrl', 'mediaUrl', 'voiceUrl', 'audioUrl', 'attachmentUrl', 'src'].forEach((key) => {
                  if (value[key]) pushCandidate(value[key]);
                });
              }
            };

            if (Array.isArray(msg.attachments)) {
              msg.attachments.forEach(pushCandidate);
            }

            if (Array.isArray(msg.files)) {
              msg.files.forEach(pushCandidate);
            }

            ['fileUrl', 'mediaUrl', 'voiceUrl', 'audioUrl', 'attachmentUrl', 'url', 'src'].forEach((key) => {
              if (msg[key]) pushCandidate(msg[key]);
            });

            if (msg.payload) pushCandidate(msg.payload);

            const text = String(msg.content || '');
            const matches = text.match(urlRegex);
            if (matches && matches.length > 0) candidates.push(...matches);

            // Last resort: scan the whole message object for obvious S3/audio URLs.
            const serialized = JSON.stringify(msg);
            const deepMatches = serialized.match(urlRegex);
            if (deepMatches && deepMatches.length > 0) candidates.push(...deepMatches);

            const uniqueCandidates = Array.from(new Set(candidates.filter(Boolean)));

            if (uniqueCandidates.length > 0) {
              msg.mediaUrls = uniqueCandidates;
              // If first candidate is audio, mark type as VOICE so UI shows player
              if (uniqueCandidates[0].match(/\.(mp3|m4a|webm|wav|ogg|opus)(\?|$)/i)) {
                msg.type = 'VOICE';
              }
            }
          }

          return msg;
        };

        if (Array.isArray(messagesList)) messagesList = messagesList.map(normalize);
      } catch (e) {
        console.warn('[useChat] normalize messages failed', e);
      }

      try { console.debug('[useChat] normalized messages for', conversationId, messagesList); } catch(e){}

      dispatch(setMessages({ conversationId, messages: messagesList }));
    } catch (err) {
      console.error("Failed to fetch messages", err);
    } finally {
      setMessagesLoading(false);
    }
  }, [dispatch]);

  const selectConversation = useCallback((id) => {
    if (!id) {
      dispatch(setActiveConversation(null));
      return;
    }
    
    // Always reset unread count when selected, even if already active
    dispatch(resetUnreadCount(id));
    // Mark read in backend
    chatApi.markConversationAsRead(id).catch(err => console.error("Failed to mark as read", err));

    if (id === activeConversationId) return;
    
    dispatch(setActiveConversation(id));
    fetchMessages(id);
  }, [dispatch, fetchMessages, activeConversationId]);

  const create = useCallback(async (type, memberIds, name = null) => {
    try {
      const result = await chatApi.createConversation({ 
        type, 
        memberIds,
        name,
        isGroup: type === 'GROUP' 
      });
      await fetchConversationsAction();
      return { payload: result.data || result };
    } catch (err) {
      return { error: err };
    }
  }, [fetchConversationsAction]);

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
      await fetchConversationsAction();
    } catch (err) {
      console.error("Failed to remove member", err);
    }
  }, [fetchConversationsAction]);

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
