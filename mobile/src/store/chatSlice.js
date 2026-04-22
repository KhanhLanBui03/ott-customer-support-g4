import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { chatApi, conversationApi } from '../api/chatApi';
import { sendMessageViaSocket } from '../utils/socket';

const getRealId = (state, id) => {
  if (!id) return id;
  if (id.includes('#')) return id;
  const conv = state.conversations.find(c => c.conversationId.includes(id) || id.includes(c.conversationId));
  return conv ? conv.conversationId : id;
};

export const fetchConversations = createAsyncThunk('chat/fetchConversations', async (params, { rejectWithValue }) => {
  try {
    const response = await conversationApi.getConversations(params);
    return response.data.data || response.data;
  } catch (error) { return rejectWithValue(error.response?.data?.message); }
});

export const fetchMessages = createAsyncThunk('chat/fetchMessages', async (arg, { rejectWithValue, getState }) => {
  try {
    const id = typeof arg === 'string' ? arg : arg.conversationId;
    const state = getState().chat;
    const realId = getRealId(state, id);
    const response = await chatApi.getMessages(realId, arg?.params);
    const data = response.data.data || response.data;
    const messages = data.messages || data || [];

    // Lấy ID thật từ server trả về để đồng bộ hóa
    const serverId = messages[0]?.conversationId || realId;
    return { conversationId: serverId, originalId: id, messages };
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
      senderId: currentUser?.userId
    };

    sendMessageViaSocket(payload);
    const response = await chatApi.sendMessage(payload);
    return response.data.data || response.data;
  } catch (error) { return rejectWithValue(error.response?.data?.message); }
});

const chatSlice = createSlice({
  name: 'chat',
  initialState: { conversations: [], messages: {}, loading: false },
  reducers: {
    addMessage: (state, action) => {
      const { conversationId, message } = action.payload;
      const msg = message.payload || message;
      if (!msg?.content) return;

      const realId = msg.conversationId || getRealId(state, conversationId);
      if (!state.messages[realId]) state.messages[realId] = [];

      const isDuplicate = state.messages[realId].some(m => {
        if (msg.messageId && m.messageId === msg.messageId) return true;
        const t1 = new Date(m.createdAt || Date.now()).getTime();
        const t2 = new Date(msg.createdAt || Date.now()).getTime();
        return m.content === msg.content && Math.abs(t1 - t2) < 2000;
      });

      if (!isDuplicate) {
        state.messages[realId].push(msg);
        const conv = state.conversations.find(c => c.conversationId === realId);
        if (conv) {
          conv.lastMessage = msg.content;
          conv.updatedAt = msg.createdAt || new Date().toISOString();
        }
      }
    },
    clearChatState: (state) => {
      state.conversations = [];
      state.messages = {};
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchConversations.fulfilled, (state, action) => {
        state.conversations = action.payload.conversations || action.payload || [];
      })
      .addCase(fetchMessages.fulfilled, (state, action) => {
        const { conversationId, originalId, messages } = action.payload;
        // Double-mapping: Lưu vào cả ID thật và ID từ URL để không bao giờ mất tin
        state.messages[conversationId] = messages;
        if (originalId && originalId !== conversationId) {
          state.messages[originalId] = messages;
        }
      })
      .addCase(sendMessage.fulfilled, (state, action) => {
        const msg = action.payload;
        const rid = msg.conversationId;
        if (!state.messages[rid]) state.messages[rid] = [];
        const isDuplicate = state.messages[rid].some(m =>
          (msg.messageId && m.messageId === msg.messageId) ||
          (m.content === msg.content && Math.abs(new Date(m.createdAt || Date.now()).getTime() - new Date(msg.createdAt || Date.now()).getTime()) < 2000)
        );
        if (!isDuplicate) state.messages[rid].push(msg);
      });
  },
});

export const { addMessage, clearChatState } = chatSlice.actions;
export default chatSlice.reducer;
