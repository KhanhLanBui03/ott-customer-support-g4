import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { chatApi, conversationApi } from '../api/chatApi';

/**
 * Chat Slice - Redux state management for messages and conversations
 * Same implementation for Web and Mobile
 */

export const fetchConversations = createAsyncThunk(
  'chat/fetchConversations',
  async (params, { rejectWithValue }) => {
    try {
      const response = await conversationApi.getConversations(params);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch conversations');
    }
  }
);

export const fetchMessages = createAsyncThunk(
  'chat/fetchMessages',
  async ({ conversationId, params }, { rejectWithValue }) => {
    try {
      const response = await chatApi.getMessages(conversationId, params);
      return { conversationId, messages: response.data.messages };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch messages');
    }
  }
);

export const sendMessage = createAsyncThunk(
  'chat/sendMessage',
  async (messageData, { rejectWithValue }) => {
    try {
      const response = await chatApi.sendMessage(messageData);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to send message');
    }
  }
);

export const createConversation = createAsyncThunk(
  'chat/createConversation',
  async (conversationData, { rejectWithValue }) => {
    try {
      const response = await conversationApi.createConversation(conversationData);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to create conversation');
    }
  }
);

export const markMessageAsRead = createAsyncThunk(
  'chat/markMessageAsRead',
  async (messageId, { rejectWithValue }) => {
    try {
      const response = await chatApi.markAsRead(messageId);
      return { messageId, ...response.data };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to mark as read');
    }
  }
);

export const togglePinConversation = createAsyncThunk(
  'chat/togglePinConversation',
  async (conversationId, { rejectWithValue }) => {
    try {
      await conversationApi.togglePinConversation(conversationId);
      return { conversationId };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to toggle pin');
    }
  }
);

const initialState = {
  conversations: [],
  currentConversation: null,
  currentConversationId: null,
  messages: {},
  typingUsers: {},
  loading: false,
  error: null,
  unreadCount: 0,
};

const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    setCurrentConversation: (state, action) => {
      state.currentConversationId = action.payload;
      state.currentConversation = state.conversations.find(
        (c) => c.conversationId === action.payload
      );
    },
    addMessage: (state, action) => {
      const { conversationId, message } = action.payload;
      if (!state.messages[conversationId]) {
        state.messages[conversationId] = [];
      }
      state.messages[conversationId].push(message);
    },
    updateMessage: (state, action) => {
      const { conversationId, messageId, updates } = action.payload;
      if (state.messages[conversationId]) {
        const msgIndex = state.messages[conversationId].findIndex(
          (m) => m.messageId === messageId
        );
        if (msgIndex !== -1) {
          state.messages[conversationId][msgIndex] = {
            ...state.messages[conversationId][msgIndex],
            ...updates,
          };
        }
      }
    },
    removeMessage: (state, action) => {
      const { conversationId, messageId } = action.payload;
      if (state.messages[conversationId]) {
        state.messages[conversationId] = state.messages[conversationId].filter(
          (m) => m.messageId !== messageId
        );
      }
    },
    setTypingUser: (state, action) => {
      const { conversationId, userId, isTyping } = action.payload;
      if (!state.typingUsers[conversationId]) {
        state.typingUsers[conversationId] = new Set();
      }
      if (isTyping) {
        state.typingUsers[conversationId].add(userId);
      } else {
        state.typingUsers[conversationId].delete(userId);
      }
    },
    clearTypingUsers: (state, action) => {
      const { conversationId } = action.payload;
      if (state.typingUsers[conversationId]) {
        state.typingUsers[conversationId].clear();
      }
    },
    addReaction: (state, action) => {
      const { conversationId, messageId, emoji } = action.payload;
      if (state.messages[conversationId]) {
        const msgIndex = state.messages[conversationId].findIndex(
          (m) => m.messageId === messageId
        );
        if (msgIndex !== -1) {
          const msg = state.messages[conversationId][msgIndex];
          if (!msg.reactions) {
            msg.reactions = {};
          }
          if (!msg.reactions[emoji]) {
            msg.reactions[emoji] = [];
          }
          msg.reactions[emoji].push(new Date().getTime());
        }
      }
    },
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    // Fetch conversations
    builder
      .addCase(fetchConversations.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchConversations.fulfilled, (state, action) => {
        state.loading = false;
        state.conversations = action.payload.conversations || [];
        state.unreadCount = action.payload.unreadCount || 0;
      })
      .addCase(fetchConversations.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });

    // Fetch messages
    builder
      .addCase(fetchMessages.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchMessages.fulfilled, (state, action) => {
        state.loading = false;
        const { conversationId, messages } = action.payload;
        state.messages[conversationId] = messages;
      })
      .addCase(fetchMessages.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });

    // Send message
    builder
      .addCase(sendMessage.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(sendMessage.fulfilled, (state, action) => {
        state.loading = false;
        const { conversationId, messageId } = action.payload;
        if (!state.messages[conversationId]) {
          state.messages[conversationId] = [];
        }
        state.messages[conversationId].push(action.payload);
      })
      .addCase(sendMessage.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });

    // Create conversation
    builder
      .addCase(createConversation.pending, (state) => {
        state.loading = true;
      })
      .addCase(createConversation.fulfilled, (state, action) => {
        state.loading = false;
        state.conversations.unshift(action.payload);
        state.currentConversationId = action.payload.conversationId;
        state.currentConversation = action.payload;
      })
      .addCase(createConversation.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });

    // Mark message as read
    builder.addCase(markMessageAsRead.fulfilled, (state, action) => {
      const messageIndex = state.messages[state.currentConversationId]?.findIndex(
        (m) => m.messageId === action.payload.messageId
      );
      if (messageIndex !== -1) {
        state.messages[state.currentConversationId][messageIndex].read = true;
      }
    });

    // Toggle pin conversation
    builder.addCase(togglePinConversation.fulfilled, (state, action) => {
      const { conversationId } = action.payload;
      const conversation = state.conversations.find(c => c.conversationId === conversationId);
      if (conversation) {
        conversation.pinned = !conversation.pinned;
        // Re-sort conversations: pinned first, then by last message time
        state.conversations.sort((a, b) => {
          if (a.pinned && !b.pinned) return -1;
          if (!a.pinned && b.pinned) return 1;
          return (b.lastMessageTime || 0) - (a.lastMessageTime || 0);
        });
      }
    });
  },
});

export const {
  setCurrentConversation,
  addMessage,
  updateMessage,
  removeMessage,
  setTypingUser,
  clearTypingUsers,
  addReaction,
  clearError,
} = chatSlice.actions;

export default chatSlice.reducer;
