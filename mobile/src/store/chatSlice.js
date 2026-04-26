import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { chatApi, conversationApi } from '../api/chatApi';
import { sendMessageViaSocket } from '../utils/socket';

// FIX: Logic lấy ID chuẩn - Ưu tiên ID từ Server
export const getRealId = (state, id, currentUserId = null) => {
  if (!id) return id;
  const decodedId = decodeURIComponent(id);
  
  // 1. Nếu ID đã chứa '#', đó là ID chuẩn từ Database, dùng luôn.
  if (decodedId.includes('#')) return decodedId;

  // 2. Tìm trong danh sách hội thoại xem có cái nào khớp hoàn toàn không
  const exactConv = (state.conversations || []).find(c => c.conversationId === decodedId);
  if (exactConv) return exactConv.conversationId;

  // 3. Nếu không tìm thấy, có thể đây là ID người dùng (UserId).
  // Tìm hội thoại SINGLE chứa UserId này và UserId của mình.
  const myId = String(currentUserId || state.currentUserId || '');
  if (myId !== '') {
    const singleConv = (state.conversations || []).find(c => {
      if (c.type !== 'SINGLE') return false;
      const parts = c.conversationId.split('#');
      return parts.includes(decodedId) && parts.includes(myId);
    });
    if (singleConv) return singleConv.conversationId;

    // 4. Nếu vẫn không thấy, tự tạo ID SINGLE chuẩn (ĐỒNG BỘ VỚI WEB)
    const participants = [myId, decodedId].sort();
    return `SINGLE#${participants[0]}#${participants[1]}`;
  }

  return decodedId;
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
    const isLoadMore = arg?.loadMore || false;
    const state = getState().chat;
    const myId = getState().auth.user?.userId || getState().auth.user?.id;
    const realId = getRealId(state, id, myId);
    
    const params = { ...arg?.params, limit: 50 };
    if (isLoadMore && state.messages[realId]?.length > 0) {
      params.fromMessageId = state.messages[realId][0].messageId;
    }

    const response = await chatApi.getMessages(realId, params);
    const data = response.data.data || response.data;
    const messages = Array.isArray(data) ? data : (data.messages || []);

    return { conversationId: realId, originalId: id, messages, isLoadMore };
  } catch (error) { return rejectWithValue(error.response?.data?.message); }
});

export const sendMessage = createAsyncThunk('chat/sendMessage', async (messageData, { rejectWithValue, getState }) => {
  try {
    const state = getState();
    const myId = state.auth.user?.userId || state.auth.user?.id;
    const realId = getRealId(state.chat, messageData.conversationId, myId);

    const payload = {
      conversationId: realId,
      content: messageData.content,
      type: 'TEXT',
      senderId: myId,
      replyToMessageId: messageData.replyToMessageId
    };

    sendMessageViaSocket(payload);
    return null; 
  } catch (error) { return rejectWithValue(error.response?.data?.message); }
});

const chatSlice = createSlice({
  name: 'chat',
  initialState: { conversations: [], messages: {}, currentConversationId: null, currentUserId: null, loading: false, replyingTo: null },
  reducers: {
    setCurrentConversation: (state, action) => { state.currentConversationId = action.payload; },
    setCurrentUserId: (state, action) => { state.currentUserId = action.payload; },
    setReplyingTo: (state, action) => { state.replyingTo = action.payload; },
    clearReplyingTo: (state) => { state.replyingTo = null; },
    updateMessage: (state, action) => {
      const { conversationId, message } = action.payload;
      const realId = getRealId(state, conversationId, state.currentUserId);
      if (!message || !message.messageId) return;

      if (!state.messages[realId]) {
        state.messages[realId] = [message];
        return;
      }

      const msgIdx = state.messages[realId].findIndex(m => m.messageId === message.messageId);
      if (msgIdx === -1) {
        state.messages[realId] = [...state.messages[realId], message];
      } else {
        state.messages[realId][msgIdx] = {
          ...state.messages[realId][msgIdx],
          ...message,
        };
      }
    },
    updateMessageReactions: (state, action) => {
      const { conversationId, messageId, reactions } = action.payload;
      const realId = getRealId(state, conversationId, state.currentUserId);
      if (state.messages[realId]) {
        const msgIdx = state.messages[realId].findIndex(m => m.messageId === messageId);
        if (msgIdx !== -1) {
          state.messages[realId][msgIdx] = {
            ...state.messages[realId][msgIdx],
            reactions,
          };
        }
      }
    },
    addMessage: (state, action) => {
      const { conversationId, message } = action.payload;
      if (!message || (!message.content && !message.type)) return;
      const realId = getRealId(state, message.conversationId || conversationId, state.currentUserId);
      
      if (!state.messages[realId]) state.messages[realId] = [];
      const isDuplicate = message.messageId
        ? state.messages[realId].some(m => m.messageId === message.messageId)
        : state.messages[realId].some(m => m.content === message.content && Math.abs((new Date(m.createdAt).getTime() || 0) - (new Date(message.createdAt).getTime() || 0)) < 1000);

      if (!isDuplicate) {
        state.messages[realId] = [...state.messages[realId], message];
        const convIdx = state.conversations.findIndex(c => c.conversationId === realId);
        if (convIdx !== -1) {
            state.conversations[convIdx].lastMessage = message.content;
            state.conversations[convIdx].updatedAt = message.createdAt || new Date().toISOString();
        }
      }
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchConversations.fulfilled, (state, action) => { state.conversations = action.payload; })
      .addCase(fetchMessages.fulfilled, (state, action) => {
        const { conversationId, messages, isLoadMore } = action.payload;
        if (isLoadMore) {
          const existing = state.messages[conversationId] || [];
          const filtered = messages.filter(nm => !existing.some(em => em.messageId === nm.messageId));
          state.messages[conversationId] = [...filtered, ...existing];
        } else {
          state.messages[conversationId] = messages;
        }
      });
  },
});

export const { addMessage, setCurrentConversation, setCurrentUserId, setReplyingTo, clearReplyingTo, updateMessage, updateMessageReactions } = chatSlice.actions;
export default chatSlice.reducer;
