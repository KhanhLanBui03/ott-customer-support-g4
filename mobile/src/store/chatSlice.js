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
    
    const params = { ...arg?.params, limit: -1 };
    if (isLoadMore && state.messages[realId]?.length > 0) {
      params.fromMessageId = state.messages[realId][0].messageId;
    }

    const response = await chatApi.getMessages(realId, params);
    const data = response.data.data || response.data;
    const messages = Array.isArray(data) ? data : (data.messages || []);

    return { conversationId: realId, originalId: id, messages, isLoadMore };
  } catch (error) { return rejectWithValue(error.response?.data?.message); }
});

export const recallMessage = createAsyncThunk('chat/recallMessage', async ({ messageId, conversationId }, { rejectWithValue, getState }) => {
  try {
    const state = getState().chat;
    const myId = getState().auth.user?.userId || getState().auth.user?.id;
    const realId = getRealId(state, conversationId, myId);
    
    const response = await chatApi.recallMessage(messageId, realId);
    return { messageId, conversationId: realId };
  } catch (error) {
    return rejectWithValue(error.response?.data?.message || 'Không thể thu hồi tin nhắn');
  }
});

export const deleteMessage = createAsyncThunk('chat/deleteMessage', async ({ messageId, conversationId }, { rejectWithValue, getState }) => {
  try {
    const state = getState().chat;
    const myId = getState().auth.user?.userId || getState().auth.user?.id;
    const realId = getRealId(state, conversationId, myId);
    
    await chatApi.deleteMessage(messageId, realId);
    return { messageId, conversationId: realId };
  } catch (error) {
    return rejectWithValue(error.response?.data?.message || 'Không thể xóa tin nhắn');
  }
});

export const sendMessage = createAsyncThunk('chat/sendMessage', async (messageData, { rejectWithValue, getState }) => {
  try {
    const state = getState();
    const myId = state.auth.user?.userId || state.auth.user?.id;
    const realId = getRealId(state.chat, messageData.conversationId, myId);

    // Chuẩn hóa content: Nếu là VOICE, content nên chứa URL để đồng bộ với Web
    const finalContent = (messageData.type === 'VOICE' && !messageData.content && messageData.mediaUrls?.length > 0) 
      ? messageData.mediaUrls[0] 
      : messageData.content;

    const payload = {
      conversationId: realId,
      content: finalContent || '',
      type: messageData.type || 'TEXT',
      senderId: myId,
      replyToMessageId: messageData.replyToMessageId,
      mediaUrls: messageData.mediaUrls || [],
      forwardedFrom: messageData.forwardedFrom
    };

    sendMessageViaSocket(payload);
    return null; 
  } catch (error) { return rejectWithValue(error.response?.data?.message); }
});

export const pinMessage = createAsyncThunk('chat/pinMessage', async ({ messageId, conversationId }, { rejectWithValue, getState }) => {
  try {
    const state = getState().chat;
    const myId = getState().auth.user?.userId || getState().auth.user?.id;
    const realId = getRealId(state, conversationId, myId);
    await conversationApi.pinMessage(realId, messageId);
    return { messageId, conversationId: realId };
  } catch (error) {
    return rejectWithValue(error.response?.data?.message || 'Không thể ghim tin nhắn');
  }
});

export const unpinMessage = createAsyncThunk('chat/unpinMessage', async ({ messageId, conversationId }, { rejectWithValue, getState }) => {
  try {
    const state = getState().chat;
    const myId = getState().auth.user?.userId || getState().auth.user?.id;
    const realId = getRealId(state, conversationId, myId);
    await conversationApi.unpinMessage(realId, messageId);
    return { messageId, conversationId: realId };
  } catch (error) {
    return rejectWithValue(error.response?.data?.message || 'Không thể bỏ ghim tin nhắn');
  }
});

export const pinConversation = createAsyncThunk('chat/pinConversation', async (conversationId, { rejectWithValue, getState }) => {
  try {
    const state = getState().chat;
    const myId = getState().auth.user?.userId || getState().auth.user?.id;
    const realId = getRealId(state, conversationId, myId);
    await conversationApi.togglePinConversation(realId);
    return realId;
  } catch (error) {
    return rejectWithValue(error.response?.data?.message || 'Không thể ghim hội thoại');
  }
});

export const unpinConversation = createAsyncThunk('chat/unpinConversation', async (conversationId, { rejectWithValue, getState }) => {
  try {
    const state = getState().chat;
    const myId = getState().auth.user?.userId || getState().auth.user?.id;
    const realId = getRealId(state, conversationId, myId);
    await conversationApi.togglePinConversation(realId);
    return realId;
  } catch (error) {
    return rejectWithValue(error.response?.data?.message || 'Không thể bỏ ghim hội thoại');
  }
});

const isVoiceMessage = (message) => {
  if (!message) return false;
  if (message.type === 'VOICE') return true;
  const content = message.content || '';
  if (typeof content !== 'string') return false;
  return content.includes('voice-messages/') || 
         content.includes('s3.ap-southeast-1') ||
         content.match(/\.(webm|m4a|mp3|wav|ogg|opus)(\?|$)/i);
};

const chatSlice = createSlice({
  name: 'chat',
  initialState: { conversations: [], messages: {}, typingUsers: {}, currentConversationId: null, currentUserId: null, loading: false, replyingTo: null },
  reducers: {
    setCurrentConversation: (state, action) => { state.currentConversationId = action.payload; },
    clearCurrentConversation: (state) => { state.currentConversationId = null; },
    setCurrentUserId: (state, action) => { state.currentUserId = action.payload; },
    setReplyingTo: (state, action) => { state.replyingTo = action.payload; },
    clearReplyingTo: (state) => { state.replyingTo = null; },
    setTyping: (state, action) => {
      const { conversationId, userId, isTyping } = action.payload;
      const realId = getRealId(state, conversationId, state.currentUserId);
      
      if (!state.typingUsers[realId]) {
        state.typingUsers[realId] = [];
      }

      if (isTyping) {
        // Tránh trùng lặp
        if (!state.typingUsers[realId].some(u => String(u.userId) === String(userId))) {
          // Tìm tên người dùng từ danh sách thành viên hội thoại
          const conv = state.conversations.find(c => c.conversationId === realId);
          const member = conv?.members?.find(m => String(m.userId || m.id) === String(userId));
          const name = member?.fullName || member?.name || 'Ai đó';
          
          state.typingUsers[realId].push({ userId, name });
        }
      } else {
        state.typingUsers[realId] = state.typingUsers[realId].filter(u => String(u.userId) !== String(userId));
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
    toggleMessageReaction: (state, action) => {
      const { conversationId, messageId, emoji, userId } = action.payload;
      const realId = getRealId(state, conversationId, state.currentUserId);
      const messages = state.messages[realId];
      if (!messages) return;

      const msgIdx = messages.findIndex(m => m.messageId === messageId);
      if (msgIdx === -1) return;

      const message = messages[msgIdx];
      const reactions = { ...(message.reactions || {}) };
      const userIds = Array.isArray(reactions[emoji]) ? [...reactions[emoji]] : [];

      const userIdStr = String(userId);
      const index = userIds.findIndex(id => String(id) === userIdStr);

      if (index !== -1) {
        userIds.splice(index, 1);
      } else {
        userIds.push(userIdStr);
      }

      if (userIds.length === 0) {
        delete reactions[emoji];
      } else {
        reactions[emoji] = userIds;
      }

      state.messages[realId][msgIdx] = {
        ...message,
        reactions
      };
    },
    updateConversationWallpaper: (state, action) => {
      const { conversationId, wallpaperUrl } = action.payload || {};
      if (!conversationId) return;
      const convIdx = state.conversations.findIndex(c => c.conversationId === conversationId);
      if (convIdx !== -1) {
        state.conversations[convIdx].wallpaperUrl = wallpaperUrl ?? null;
      }
    },
    markConversationRead: (state, action) => {
      const conversationId = action.payload;
      const convIdx = state.conversations.findIndex(c => c.conversationId === conversationId);
      if (convIdx !== -1) {
        state.conversations[convIdx].isUnread = false;
        state.conversations[convIdx].unreadCount = 0;
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

      const myId = String(currentUserId || state.currentUserId || '');
      const realId = getRealId(state, message.conversationId || conversationId, myId);

      if (!state.messages[realId]) state.messages[realId] = [];
      const isDuplicate = message.messageId
        ? state.messages[realId].some(m => m.messageId === message.messageId)
        : false;

      if (!isDuplicate) {
        state.messages[realId] = [...state.messages[realId], message];

        // Cập nhật và đưa hội thoại lên đầu danh sách
        const convIdx = state.conversations.findIndex(c => c.conversationId === realId);
        if (convIdx !== -1) {
          const isOtherSender = String(message.senderId) !== myId;
          const isOpenConversation = state.currentConversationId === realId;

          let preview = message.content;
          if (message.isRecalled) {
            preview = "[Tin nhắn đã bị thu hồi]";
          } else if (isVoiceMessage(message)) {
            preview = "Tin nhắn thoại";
          } else if (message.type === 'IMAGE') {
            preview = "[Hình ảnh]";
          } else if (message.type === 'VIDEO') {
            preview = "[Video]";
          } else if (message.type === 'FILE') {
            preview = "[Tệp tin]";
          } else if (message.type === 'VOTE') {
            preview = "[Bình chọn]";
          }

          // Cập nhật thông tin tin nhắn cuối
          const updatedConv = {
            ...state.conversations[convIdx],
            lastMessage: preview,
            lastMessageSenderId: message.senderId,
            updatedAt: message.createdAt || new Date().toISOString()
          };

          if (isOtherSender && !isOpenConversation) {
            updatedConv.unreadCount = (updatedConv.unreadCount || 0) + 1;
            updatedConv.isUnread = true;
          }

          // Đưa lên đầu danh sách
          state.conversations.splice(convIdx, 1);
          state.conversations.unshift(updatedConv);
        }
      }
    },
    setUserStatus: (state, action) => {
      const { userId, status, lastSeenAt } = action.payload;
      const statusUpper = String(status || '').toUpperCase();
      const isOnline = statusUpper === 'ONLINE';

      // Update member status in all conversations that include this user
      state.conversations = state.conversations.map(conv => {
        if (!conv.members) return conv;
        
        const memberIdx = conv.members.findIndex(m => String(m.userId || m.id) === String(userId));
        if (memberIdx === -1) return conv;

        const updatedMembers = [...conv.members];
        updatedMembers[memberIdx] = {
          ...updatedMembers[memberIdx],
          status: statusUpper,
          presence: statusUpper,
          isOnline: isOnline,
          lastSeenAt: lastSeenAt || updatedMembers[memberIdx].lastSeenAt
        };

        // Nếu là SINGLE chat, cập nhật luôn trạng thái của hội thoại
        const isOtherMember = conv.type === 'SINGLE' && String(userId) !== String(state.currentUserId);
        
        return {
          ...conv,
          members: updatedMembers,
          status: isOtherMember ? statusUpper : conv.status,
          isOnline: isOtherMember ? isOnline : conv.isOnline
        };
      });
    },
    setMessageRead: (state, action) => {
      const { conversationId, messageId, userId } = action.payload;
      const myId = String(state.currentUserId || '');
      const userIdStr = String(userId);
      const realId = getRealId(state, conversationId, myId);

      const messages = state.messages[realId];
      if (messages) {
        const targetIdx = messages.findIndex(m => String(m.messageId) === String(messageId));
        if (targetIdx !== -1) {
          // Đánh dấu tin nhắn này và tất cả tin nhắn trước đó là đã đọc bởi userId này
          for (let i = 0; i <= targetIdx; i++) {
            if (!messages[i].readBy) messages[i].readBy = [];
            if (!messages[i].readBy.some(id => String(id) === userIdStr)) {
              messages[i].readBy.push(userIdStr);
            }
          }
        }
      }

      // CHỈ reset unread count nếu người đọc là CHÍNH MÌNH
      if (userIdStr === myId) {
        const convIdx = state.conversations.findIndex(c => c.conversationId === realId);
        if (convIdx !== -1) {
          state.conversations[convIdx].isUnread = false;
          state.conversations[convIdx].unreadCount = 0;
        }
      }
    },
    pinMessageOptimistic: (state, action) => {
      const { conversationId, messageId, content, senderName, type } = action.payload;
      const conv = state.conversations.find(c => c.conversationId === conversationId);
      if (conv) {
        if (!conv.pinnedMessages) conv.pinnedMessages = [];
        if (!conv.pinnedMessages.find(m => String(m.messageId) === String(messageId))) {
          conv.pinnedMessages.push({ messageId, content, senderName, type });
        }
      }
    },
    unpinMessageOptimistic: (state, action) => {
      const { conversationId, messageId } = action.payload;
      const conv = state.conversations.find(c => c.conversationId === conversationId);
      if (conv && conv.pinnedMessages) {
        conv.pinnedMessages = conv.pinnedMessages.filter(m => String(m.messageId) !== String(messageId));
      }
    },
    updateConversation: (state, action) => {
      const { conversationId, ...updates } = action.payload;
      const idx = state.conversations.findIndex(c => c.conversationId === conversationId);
      if (idx !== -1) {
        state.conversations[idx] = { ...state.conversations[idx], ...updates };
      }
    },
    removeMemberLocal: (state, action) => {
      const { conversationId, userId } = action.payload;
      const idx = state.conversations.findIndex(c => c.conversationId === conversationId);
      if (idx !== -1 && state.conversations[idx].members) {
        state.conversations[idx].members = state.conversations[idx].members.filter(
          m => String(m.userId || m.id) !== String(userId)
        );
      }
    },
    updateMemberRoleLocal: (state, action) => {
      const { conversationId, userId, role } = action.payload;
      const idx = state.conversations.findIndex(c => c.conversationId === conversationId);
      if (idx !== -1 && state.conversations[idx].members) {
        const memberIdx = state.conversations[idx].members.findIndex(
          m => String(m.userId || m.id) === String(userId)
        );
        if (memberIdx !== -1) {
          state.conversations[idx].members[memberIdx].role = role;
        }
      }
    },
    removeMessage: (state, action) => {
      const { conversationId, messageId } = action.payload;
      const realId = getRealId(state, conversationId, state.currentUserId);
      if (state.messages[realId]) {
        state.messages[realId] = state.messages[realId].filter(
          m => String(m.messageId) !== String(messageId)
        );
      }
    },
    removeConversationLocal: (state, action) => {
      const { conversationId } = action.payload;
      state.conversations = state.conversations.filter(c => c.conversationId !== conversationId);
      delete state.messages[conversationId];
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchConversations.fulfilled, (state, action) => {
        const sortedConvs = (action.payload || []).map(conv => {
          let lastMessage = conv.lastMessage;
          if (lastMessage && (lastMessage.includes('chat-media/') || lastMessage.includes('voice-messages/') || lastMessage.includes('s3.ap-southeast-1') || lastMessage.match(/\.(webm|m4a|mp3|wav|ogg|opus)(\?|$)/i))) {
            lastMessage = "Tin nhắn thoại";
          }
          
          return {
            ...conv,
            lastMessage,
            unreadCount: conv.unreadCount ?? 0,
            isUnread: (conv.unreadCount ?? 0) > 0,
            lastMessageSenderId: conv.lastMessageSenderId || conv.lastSenderId,
          };
        });

        // Sắp xếp theo updatedAt mới nhất lên đầu
        state.conversations = sortedConvs.sort((a, b) => {
          const dateA = new Date(a.updatedAt || 0);
          const dateB = new Date(b.updatedAt || 0);
          return dateB - dateA;
        });
      })
      .addCase(fetchMessages.fulfilled, (state, action) => {
        const { conversationId, messages, isLoadMore } = action.payload;
        if (isLoadMore) {
          const existing = state.messages[conversationId] || [];
          const filtered = messages.filter(nm => !existing.some(em => em.messageId === nm.messageId));
          state.messages[conversationId] = [...filtered, ...existing];
        } else {
          state.messages[conversationId] = messages;
        }
      })
      .addCase(recallMessage.fulfilled, (state, action) => {
        const { messageId, conversationId } = action.payload;
        const realId = getRealId(state, conversationId, state.currentUserId);
        if (state.messages[realId]) {
          const msgIdx = state.messages[realId].findIndex(m => String(m.messageId) === String(messageId));
          if (msgIdx !== -1) {
            state.messages[realId][msgIdx] = {
              ...state.messages[realId][msgIdx],
              status: 'RECALLED',
              isRecalled: true,
              content: 'Tin nhắn đã bị thu hồi'
            };
            
            // Cập nhật cả lastMessage trong danh sách hội thoại
            const convIdx = state.conversations.findIndex(c => c.conversationId === realId);
            if (convIdx !== -1) {
              state.conversations[convIdx].lastMessage = "[Tin nhắn đã bị thu hồi]";
            }
          }
        }
      })
      .addCase(deleteMessage.fulfilled, (state, action) => {
        const { messageId, conversationId } = action.payload;
        const realId = getRealId(state, conversationId, state.currentUserId);
        if (state.messages[realId]) {
          state.messages[realId] = state.messages[realId].filter(
            m => String(m.messageId) !== String(messageId)
          );
        }
      })
      .addCase(pinMessage.fulfilled, (state, action) => {
        const { messageId, conversationId } = action.payload;
        const conv = state.conversations.find(c => c.conversationId === conversationId);
        if (conv) {
          if (!conv.pinnedMessages) conv.pinnedMessages = [];
          if (!conv.pinnedMessages.find(m => String(m.messageId) === String(messageId))) {
            // Find message details from messages state if possible
            const msgDetails = state.messages[conversationId]?.find(m => String(m.messageId) === String(messageId));
            conv.pinnedMessages.push({
              messageId,
              content: msgDetails?.content || 'Tin nhắn',
              senderName: msgDetails?.senderName || 'Người dùng',
              type: msgDetails?.type || 'TEXT'
            });
          }
        }
      })
      .addCase(unpinMessage.fulfilled, (state, action) => {
        const { messageId, conversationId } = action.payload;
        const conv = state.conversations.find(c => c.conversationId === conversationId);
        if (conv && conv.pinnedMessages) {
          conv.pinnedMessages = conv.pinnedMessages.filter(m => String(m.messageId) !== String(messageId));
        }
      })
      .addCase(pinConversation.fulfilled, (state, action) => {
        const conversationId = action.payload;
        const conv = state.conversations.find(c => c.conversationId === conversationId);
        if (conv) {
          conv.isPinned = true;
        }
      })
      .addCase(unpinConversation.fulfilled, (state, action) => {
        const conversationId = action.payload;
        const conv = state.conversations.find(c => c.conversationId === conversationId);
        if (conv) {
          conv.isPinned = false;
        }
      });
  },
});

export const {
  addMessage,
  setCurrentConversation,
  clearCurrentConversation,
  setCurrentUserId,
  setReplyingTo,
  clearReplyingTo,
  updateMessage,
  toggleMessageReaction,
  updateConversationWallpaper,
  markConversationRead,
  updateMemberInfo,
  setTyping,
  setUserStatus,
  setMessageRead,
  pinMessageOptimistic,
  unpinMessageOptimistic,
  updateConversation,
  removeMemberLocal,
  updateMemberRoleLocal,
  removeMessage,
  removeConversationLocal
} = chatSlice.actions;
export default chatSlice.reducer;
