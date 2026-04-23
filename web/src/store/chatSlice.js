import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { chatApi } from '../api/chatApi';
import { friendApi } from '../api/friendApi';

export const fetchConversations = createAsyncThunk(
  'chat/fetchConversations',
  async (_, { rejectWithValue }) => {
    try {
      const data = await chatApi.getConversations();
      return data.data || data;
    } catch (err) {
      return rejectWithValue(err.response?.data || err.message);
    }
  }
);

export const fetchFriends = createAsyncThunk(
  'chat/fetchFriends',
  async (_, { rejectWithValue }) => {
    try {
      const response = await friendApi.getFriends();
      return response.data || response;
    } catch (err) {
      return rejectWithValue(err.response?.data || err.message);
    }
  }
);

const initialState = {
  conversations: [],
  activeConversationId: null,
  messages: {},
  typingUsers: {}, // { conversationId: [ { userId, name } ] }
  friends: [],
  loading: false,
};

const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    setConversations: (state, action) => {
      state.conversations = action.payload;
    },
    setActiveConversation: (state, action) => {
      state.activeConversationId = action.payload;
    },
    setMessages: (state, action) => {
      const { conversationId, messages } = action.payload;
      state.messages[conversationId] = messages;
    },
    addMessage: (state, action) => {
      const { conversationId, message, currentUserId } = action.payload;
      if (!state.messages[conversationId]) {
        state.messages[conversationId] = [];
      }
      
      // If we find an optimistic message with the same content and sender (sent within last 5s), replace it
      const now = Date.now();
      const optimisticIdx = state.messages[conversationId].findIndex(m => 
        m.status === 'SENDING' && 
        m.content === message.content && 
        m.senderId === message.senderId &&
        (now - (m.createdAt || 0)) < 5000
      );

      if (optimisticIdx !== -1) {
        state.messages[conversationId][optimisticIdx] = message;
      } else if (!state.messages[conversationId].find(m => m.messageId === message.messageId)) {
        state.messages[conversationId].push(message);
      }
      
      // Update last message in conversation list
      const conv = state.conversations.find(c => c.conversationId === conversationId);
      if (conv) {
        conv.lastMessage = message.content;
        conv.lastMessageTime = message.createdAt;

        // Increment unread count if it's not the active conversation and NOT from current user
        if (state.activeConversationId !== conversationId && message.senderId !== currentUserId) {
          conv.unreadCount = (conv.unreadCount || 0) + 1;
        }

        // Move the conversation to the top
        const idx = state.conversations.findIndex(c => c.conversationId === conversationId);
        if (idx !== -1) {
           const [item] = state.conversations.splice(idx, 1);
           state.conversations.unshift(item);
        }
      }
    },
    addOptimisticMessage: (state, action) => {
      const { conversationId, message } = action.payload;
      if (!state.messages[conversationId]) {
        state.messages[conversationId] = [];
      }
      state.messages[conversationId].push({
        ...message,
        status: 'SENDING',
        createdAt: Date.now(),
        messageId: `temp-${Date.now()}`
      });
    },
    updateMessageStatus: (state, action) => {
      const { conversationId, messageId, status } = action.payload;
      if (state.messages[conversationId]) {
        const msg = state.messages[conversationId].find(m => m.messageId === messageId);
        if (msg) msg.status = status;
      }
    },
    updateMessage: (state, action) => {
      const { conversationId, message } = action.payload;
      if (state.messages[conversationId]) {
        const idx = state.messages[conversationId].findIndex(m => m.messageId === message.messageId);
        if (idx !== -1) {
          state.messages[conversationId][idx] = message;
        }
      }
    },
    recallMessage: (state, action) => {
      const { conversationId, messageId } = action.payload;
      if (state.messages[conversationId]) {
        const msg = state.messages[conversationId].find(m => m.messageId === messageId);
        if (msg) {
          msg.isRecalled = true;
          msg.content = "[Tin nhắn đã bị thu hồi]";
        }
      }
    },
    removeMessage: (state, action) => {
      const { conversationId, messageId } = action.payload;
      if (state.messages[conversationId]) {
        state.messages[conversationId] = state.messages[conversationId].filter(m => m.messageId !== messageId);
      }
    },
    setTyping: (state, action) => {
      const { conversationId, userId, name, isTyping } = action.payload;
      if (!state.typingUsers[conversationId]) {
        state.typingUsers[conversationId] = [];
      }
      
      if (isTyping) {
        if (!state.typingUsers[conversationId].find(u => u.userId === userId)) {
          state.typingUsers[conversationId].push({ userId, name });
        }
      } else {
        state.typingUsers[conversationId] = state.typingUsers[conversationId].filter(u => u.userId !== userId);
      }
    },
    pinMessageOptimistic: (state, action) => {
      const { conversationId, messageId } = action.payload;
      const conv = state.conversations.find(c => c.conversationId === conversationId);
      if (conv) {
        if (!conv.pinnedMessages) conv.pinnedMessages = [];
        if (!conv.pinnedMessages.find(m => m.messageId === messageId)) {
          conv.pinnedMessages.push({ messageId });
        }
      }
    },
    unpinMessageOptimistic: (state, action) => {
      const { conversationId, messageId } = action.payload;
      const conv = state.conversations.find(c => c.conversationId === conversationId);
      if (conv && conv.pinnedMessages) {
        conv.pinnedMessages = conv.pinnedMessages.filter(m => m.messageId !== messageId);
      }
    },
    optimisticVote: (state, action) => {
      const { conversationId, messageId, optionIds, userId } = action.payload;
      const messages = state.messages[conversationId];
      if (!messages) return;

      const msg = messages.find(m => m.messageId === messageId);
      if (msg && msg.type === 'VOTE' && msg.vote) {
        msg.vote.options.forEach(opt => {
          if (!opt.voterIds) opt.voterIds = [];
          
          if (optionIds.includes(opt.optionId)) {
            if (!opt.voterIds.includes(userId)) {
              opt.voterIds.push(userId);
            }
          } else {
            opt.voterIds = opt.voterIds.filter(id => id !== userId);
          }
        });
      }
    },
    resetUnreadCount: (state, action) => {
      const conversationId = action.payload;
      const conv = state.conversations.find(c => c.conversationId === conversationId);
      if (conv) {
        conv.unreadCount = 0;
      }
    },
    updateUserPresence: (state, action) => {
      const { userId, status } = action.payload || {};
      if (!userId) return;
      // Update presence across all conversations that include this user
      state.conversations.forEach(conv => {
        if (conv.members && Array.isArray(conv.members)) {
          const member = conv.members.find(m => (m.userId || m.id) === userId);
          if (member) {
            member.status = status;
          }
        }
      });
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchConversations.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchConversations.fulfilled, (state, action) => {
        state.conversations = action.payload;
        state.loading = false;
      })
      .addCase(fetchConversations.rejected, (state) => {
        state.loading = false;
      })
      .addCase(fetchFriends.fulfilled, (state, action) => {
        state.friends = action.payload;
      });
  },
});

export const { 
    setConversations, 
    setActiveConversation, 
    setMessages, 
    addMessage, 
    addOptimisticMessage,
    updateMessageStatus,
    recallMessage,
    removeMessage,
    setTyping,
    pinMessageOptimistic,
    unpinMessageOptimistic,
    updateUserPresence,
    updateMessage,
    optimisticVote,
    resetUnreadCount
} = chatSlice.actions;
export default chatSlice.reducer;
