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
  initialState: { conversations: [], messages: {}, typingUsers: {}, currentConversationId: null, currentUserId: null, loading: false, replyingTo: null },
  reducers: {
    setCurrentConversation: (state, action) => { state.currentConversationId = action.payload; },
    setCurrentUserId: (state, action) => { state.currentUserId = action.payload; },
    setReplyingTo: (state, action) => { state.replyingTo = action.payload; },
    clearReplyingTo: (state) => { state.replyingTo = null; },
    setTyping: (state, action) => {
      const { conversationId, userId, isTyping } = action.payload;
      if (!state.typingUsers[conversationId]) {
        state.typingUsers[conversationId] = [];
      }

      if (isTyping) {
        if (!state.typingUsers[conversationId].includes(userId)) {
          state.typingUsers[conversationId].push(userId);
        }
      } else {
        state.typingUsers[conversationId] = state.typingUsers[conversationId].filter(id => id !== userId);
      }
    },
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
        const existing = state.messages[realId][msgIdx];
        const mergedMessage = { ...existing, ...message };
        if (Array.isArray(existing.readBy) && Array.isArray(message.readBy)) {
          mergedMessage.readBy = Array.from(new Set([...existing.readBy, ...message.readBy]));
        }
        state.messages[realId][msgIdx] = mergedMessage;
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
    updateConversationWallpaper: (state, action) => {
      const { conversationId, wallpaperUrl } = action.payload || {};
      if (!conversationId) return;
      const convIdx = state.conversations.findIndex(c => c.conversationId === conversationId);
      if (convIdx !== -1) {
        state.conversations[convIdx].wallpaperUrl = wallpaperUrl ?? null;
      }
    },
    updateMemberInfo: (state, action) => {
      const { userId, fullName, avatarUrl } = action.payload;
      if (!userId) return;

      state.conversations.forEach((conv, idx) => {
        // 1. Update in members list
        if (conv.members) {
          const memberIdx = conv.members.findIndex(m => String(m.userId || m.id) === String(userId));
          if (memberIdx !== -1) {
            if (fullName) state.conversations[idx].members[memberIdx].fullName = fullName;
            if (avatarUrl !== undefined) state.conversations[idx].members[memberIdx].avatarUrl = avatarUrl;
          }
        }

        // 2. If it's a SINGLE conversation, update the conversation's own name/avatar
        if (conv.type === 'SINGLE') {
          const parts = conv.conversationId.split('#');
          const otherMemberId = parts.find(id => id !== 'SINGLE' && id !== String(state.currentUserId));
          if (String(otherMemberId) === String(userId)) {
            if (fullName) state.conversations[idx].name = fullName;
            if (avatarUrl !== undefined) state.conversations[idx].avatarUrl = avatarUrl;
          }
        }
      });
    },
    addMessage: (state, action) => {
      const { conversationId, message, currentUserId } = action.payload;
      if (!message || (!message.content && !message.type)) return;
      const realId = getRealId(state, message.conversationId || conversationId, currentUserId || state.currentUserId);
      const currentUserIdStr = String(currentUserId || state.currentUserId || '');

      if (!state.messages[realId]) state.messages[realId] = [];
      const isDuplicate = message.messageId
        ? state.messages[realId].some(m => m.messageId === message.messageId)
        : state.messages[realId].some(m => m.content === message.content && Math.abs((new Date(m.createdAt).getTime() || 0) - (new Date(message.createdAt).getTime() || 0)) < 1000);

      if (!isDuplicate) {
        state.messages[realId] = [...state.messages[realId], message];

        // Implicit Read Receipt: Nếu nhận được tin nhắn từ người khác, họ đã đọc hết tin nhắn trước đó của mình
        if (message.senderId) {
          const senderIdStr = String(message.senderId);
          state.messages[realId].forEach(m => {
            if (String(m.senderId) !== senderIdStr) {
              if (!m.readBy) m.readBy = [];
              if (!m.readBy.some(id => String(id) === senderIdStr)) {
                m.readBy.push(senderIdStr);
              }
            }
          });
        }

        const convIdx = state.conversations.findIndex(c => c.conversationId === realId);
        if (convIdx !== -1) {
            state.conversations[convIdx].lastMessage = message.content;
            state.conversations[convIdx].updatedAt = message.createdAt || new Date().toISOString();
        }
      }
    },
    setMessageRead: (state, action) => {
      const { conversationId, messageId, userId } = action.payload;
      const realId = getRealId(state, conversationId, state.currentUserId);
      const messages = state.messages[realId];
      if (messages) {
        const targetIdx = messages.findIndex(m => String(m.messageId) === String(messageId));
        if (targetIdx !== -1) {
          const userIdStr = String(userId);
          // Đánh dấu tin nhắn này và tất cả tin nhắn trước đó là đã đọc
          for (let i = 0; i <= targetIdx; i++) {
            if (!messages[i].readBy) messages[i].readBy = [];
            if (!messages[i].readBy.some(id => String(id) === userIdStr)) {
              messages[i].readBy.push(userIdStr);
            }
          }
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

export const { addMessage, setCurrentConversation, setCurrentUserId, setReplyingTo, clearReplyingTo, updateMessage, updateMessageReactions, updateConversationWallpaper, updateMemberInfo, setTyping, setMessageRead } = chatSlice.actions;
export default chatSlice.reducer;
