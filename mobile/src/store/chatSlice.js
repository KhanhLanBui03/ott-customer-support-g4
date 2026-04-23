import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { chatApi, conversationApi } from '../api/chatApi';
import { sendMessageViaSocket } from '../utils/socket';

// Hàm hỗ trợ tìm Conversation ID chuẩn - ĐÃ NÂNG CẤP ĐỂ THÔNG MINH HƠN
export const getRealId = (state, id) => {
  if (!id) return id;
  // Nếu ID đã có định dạng chuẩn (có dấu #), dùng luôn
  if (id.includes('#')) return id;
  
  // 1. Tìm trong danh sách conversations (đây là nguồn chuẩn nhất)
  const conv = (state.conversations || []).find(c => 
    c.conversationId === id || 
    c.conversationId.includes(id) || 
    id.includes(c.conversationId)
  );
  if (conv) return conv.conversationId;

  // 2. Tìm trong danh sách tin nhắn hiện có
  const keys = Object.keys(state.messages || {});
  const longKey = keys.find(key => key.includes('#') && key.includes(id));
  if (longKey) return longKey;

  return id;
};

export const fetchConversations = createAsyncThunk('chat/fetchConversations', async (params, { rejectWithValue }) => {
  try {
    const response = await conversationApi.getConversations(params);
    const data = response.data.data || response.data;
    return Array.isArray(data) ? data : (data.conversations || []);
  } catch (error) { return rejectWithValue(error.response?.data?.message); }
});

export const fetchMessages = createAsyncThunk('chat/fetchMessages', async (arg, { rejectWithValue, getState }) => {
  try {
    const id = typeof arg === 'string' ? arg : arg.conversationId;
    const state = getState().chat;
    const realId = getRealId(state, id);
    
    const response = await chatApi.getMessages(realId, arg?.params);
    const data = response.data.data || response.data;
    const messages = Array.isArray(data) ? data : (data.messages || []);

    const serverConversationId = messages.length > 0 ? messages[0].conversationId : realId;
    return { conversationId: serverConversationId, originalId: id, messages };
  } catch (error) { return rejectWithValue(error.response?.data?.message); }
});

export const sendMessage = createAsyncThunk('chat/sendMessage', async (messageData, { rejectWithValue, getState }) => {
  try {
    const state = getState();
    const currentUser = state.auth.user;
    const realId = getRealId(state.chat, messageData.conversationId);

    const payload = {
      conversationId: realId,
      content: messageData.content,
      type: 'TEXT',
      senderId: currentUser?.userId || currentUser?.id
    };

    sendMessageViaSocket(payload);
    const response = await chatApi.sendMessage(payload);
    return response.data.data || response.data;
  } catch (error) { return rejectWithValue(error.response?.data?.message); }
});

const chatSlice = createSlice({
  name: 'chat',
  initialState: { conversations: [], messages: {}, currentConversationId: null, loading: false },
  reducers: {
    setCurrentConversation: (state, action) => {
      state.currentConversationId = action.payload;
    },
    addMessage: (state, action) => {
      const { conversationId, message } = action.payload;
      if (!message || !message.content) return;

      const incomingId = message.conversationId || conversationId;
      const realId = getRealId(state, incomingId);

      console.log(`[Store] Adding message to ${realId} (from incoming: ${incomingId})`);

      if (!state.messages[realId]) state.messages[realId] = [];

      const isDuplicate = message.messageId 
        ? state.messages[realId].some(m => m.messageId === message.messageId)
        : state.messages[realId].some(m => m.content === message.content && Math.abs((m.createdAt || 0) - (message.createdAt || 0)) < 1000);

      if (!isDuplicate) {
        state.messages[realId] = [...state.messages[realId], message];
        
        const convIdx = state.conversations.findIndex(c => c.conversationId === realId);
        if (convIdx !== -1) {
            state.conversations[convIdx].lastMessage = message.content;
            state.conversations[convIdx].updatedAt = message.createdAt || Date.now();
        }
      }
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchConversations.fulfilled, (state, action) => {
        state.conversations = action.payload;
      })
      .addCase(fetchMessages.fulfilled, (state, action) => {
        const { conversationId, originalId, messages } = action.payload;
        state.messages[conversationId] = messages;
        if (originalId && originalId !== conversationId && state.messages[originalId]) {
           delete state.messages[originalId];
        }
      })
      .addCase(sendMessage.fulfilled, (state, action) => {
        const msg = action.payload;
        if (msg) {
            const rid = getRealId(state, msg.conversationId);
            if (!state.messages[rid]) state.messages[rid] = [];
            if (!state.messages[rid].some(m => m.messageId === msg.messageId)) {
                state.messages[rid] = [...state.messages[rid], msg];
            }
        }
      });
  },
});

export const { addMessage, setCurrentConversation } = chatSlice.actions;
export default chatSlice.reducer;
