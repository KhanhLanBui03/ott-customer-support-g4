import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { chatApi } from '../api/chatApi';

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

const initialState = {
  conversations: [],
  activeConversationId: null,
  messages: {},
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
      const { conversationId, message } = action.payload;
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
    recallMessage: (state, action) => {
      const { conversationId, messageId } = action.payload;
      if (state.messages[conversationId]) {
        const msg = state.messages[conversationId].find(m => m.messageId === messageId);
        if (msg) {
          msg.isRecalled = true;
          msg.content = "[This message was recalled]";
        }
      }
    },
    removeMessage: (state, action) => {
      const { conversationId, messageId } = action.payload;
      if (state.messages[conversationId]) {
        state.messages[conversationId] = state.messages[conversationId].filter(m => m.messageId !== messageId);
      }
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
    removeMessage 
} = chatSlice.actions;
export default chatSlice.reducer;
