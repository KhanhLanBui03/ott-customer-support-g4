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
  replyingTo: null,
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

      const messages = state.messages[conversationId];
      const myId = String(currentUserId);

      // If we find an optimistic message from the same sender (sent within last 10s), replace it
      const now = Date.now();
      const optimisticIdx = messages.findIndex(m =>
        m.status === 'SENDING' &&
        String(m.senderId) === myId &&
        (m.type === message.type) &&
        (message.type === 'TEXT' ? m.content === message.content : true) &&
        (now - (m.createdAt || 0)) < 10000
      );

      if (optimisticIdx !== -1) {
        messages[optimisticIdx] = {
          ...message,
          status: 'SENT',
          mediaUrls: message.mediaUrls && message.mediaUrls.length > 0 ? message.mediaUrls : messages[optimisticIdx].mediaUrls
        };
      } else if (!messages.find(m => m.messageId === message.messageId)) {
        messages.push(message);
      }

      // 2. Cập nhật danh sách hội thoại
      const conv = state.conversations.find(c => c.conversationId === conversationId);
      if (conv) {
        const isOtherSender = String(message.senderId) !== myId;
        const isOpenConversation = String(state.activeConversationId) === String(conversationId);

        conv.lastMessage = message.content;
        conv.lastMessageTime = message.createdAt;

        conv.lastMessageSenderId = message.senderId;
        conv.lastMessageSenderName = message.senderName;

        if (isOpenConversation) {
          // Nếu đang mở hội thoại này, luôn đảm bảo unreadCount là 0
          conv.unreadCount = 0;
        } else if (isOtherSender) {
          // Nếu đang ở ngoài và là tin nhắn từ người khác, tăng số tin nhắn chưa đọc
          conv.unreadCount = (conv.unreadCount || 0) + 1;
        }

        // Đưa hội thoại lên đầu danh sách
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
          // Merge fields instead of replacing to avoid losing data like senderName/mediaUrls
          state.messages[conversationId][idx] = {
            ...state.messages[conversationId][idx],
            ...message
          };
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
          msg.type = "TEXT";
          msg.mediaUrls = [];
        }
      }

      // Update last message in conversation list
      const conv = state.conversations.find(c => c.conversationId === conversationId);
      if (conv) {
        const messages = state.messages[conversationId];
        if (messages && messages.length > 0) {
          const lastMsg = messages[messages.length - 1];
          if (lastMsg.messageId === messageId) {
            conv.lastMessage = "[Tin nhắn đã bị thu hồi]";
          }
        }
      }
    },
    removeMessage: (state, action) => {
      const { conversationId, messageId } = action.payload;
      if (state.messages[conversationId]) {
        state.messages[conversationId] = state.messages[conversationId].filter(m => m.messageId !== messageId);
      }

      // Update last message in conversation list if needed
      const conv = state.conversations.find(c => c.conversationId === conversationId);
      if (conv) {
        const messages = state.messages[conversationId];
        if (messages && messages.length > 0) {
          const lastMsg = messages[messages.length - 1];
          conv.lastMessage = lastMsg.isRecalled ? "[Tin nhắn đã bị thu hồi]" : lastMsg.content;
          conv.lastMessageTime = lastMsg.createdAt;
        } else {
          conv.lastMessage = "";
          conv.lastMessageTime = null;
        }
      }
    },
    setTyping: (state, action) => {
      const { conversationId, userId, isTyping } = action.payload;
      
      // Normalize ID (Same logic as other reducers)
      let realId = conversationId;
      if (conversationId && !conversationId.includes('#')) {
        const myId = state.currentUserId || '';
        const exactConv = state.conversations.find(c => c.conversationId === conversationId);
        if (!exactConv) {
          const participants = [String(myId), String(conversationId)].sort();
          realId = `SINGLE#${participants[0]}#${participants[1]}`;
        }
      }

      if (!state.typingUsers[realId]) {
        state.typingUsers[realId] = [];
      }

      if (isTyping) {
        if (!state.typingUsers[realId].find(u => String(u.userId) === String(userId))) {
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
    setUserStatus: (state, action) => {
      const { userId, status, lastSeenAt } = action.payload;

      // Update in all conversations where this user is a member
      state.conversations.forEach(conv => {
        if (conv.members) {
          const member = conv.members.find(m => String(m.userId || m.id) === String(userId));
          if (member) {
            member.status = status;
            member.presence = status; // Some parts use presence, some use status
            if (lastSeenAt) member.lastSeenAt = lastSeenAt;
          }
        }
      });
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

    updateMemberInfo: (state, action) => {
      const { userId, fullName, avatarUrl } = action.payload;
      if (!userId) return;

      state.conversations = state.conversations.map(conv => {
        let hasChange = false;

        // 1. Cập nhật danh sách thành viên
        const newMembers = conv.members?.map(member => {
          if (String(member.userId || member.id) === String(userId)) {
            hasChange = true;
            return {
              ...member,
              ...(fullName && { fullName }),
              ...(avatarUrl !== undefined && { avatarUrl })
            };
          }
          return member;
        });

        if (!hasChange) return conv;

        // 2. Nếu là SINGLE, cập nhật luôn thông tin hiển thị chính của hội thoại
        let newConv = { ...conv, members: newMembers };
        if (conv.type === 'SINGLE') {
          const otherMember = newMembers.find(m => String(m.userId || m.id) === String(userId));
          if (otherMember) {
            if (fullName) newConv.name = fullName;
            if (avatarUrl !== undefined) newConv.avatarUrl = avatarUrl;
          }
        }

        return newConv;
      });
    },

    setMessageRead: (state, action) => {
      const { conversationId, messageId, userId, currentUserId } = action.payload;
      const messages = state.messages[conversationId];
      if (messages) {
        // Find the index of the message that was read
        const targetIdx = messages.findIndex(m => String(m.messageId) === String(messageId));
        if (targetIdx !== -1) {
          // Mark this message and ALL previous messages as read by this user
          for (let i = 0; i <= targetIdx; i++) {
            if (!messages[i].readBy) messages[i].readBy = [];
            if (!messages[i].readBy.includes(userId)) {
              messages[i].readBy.push(userId);
            }
          }
        }
      }

      // Reset unread count locally if the reader is me
      if (currentUserId && String(userId) === String(currentUserId)) {
        const conv = state.conversations.find(c => c.conversationId === conversationId);
        if (conv) {
          conv.unreadCount = 0;
        }
      }
    },
    

    updateConversationWallpaper: (state, action) => {
      const { conversationId, wallpaperUrl } = action.payload || {};
      if (!conversationId) return;
      const conv = state.conversations.find(c => c.conversationId === conversationId);
      if (conv) {
        conv.wallpaperUrl = wallpaperUrl || null;
      }
    },

    updateConversation: (state, action) => {
      const { conversationId, ...updates } = action.payload || {};
      if (!conversationId) return;
      const index = state.conversations.findIndex(c => c.conversationId === conversationId);
      if (index !== -1) {
        // Guard: Nếu đây là hội thoại đang mở, không cho phép unreadCount > 0
        if (state.activeConversationId === conversationId && updates.unreadCount > 0) {
          updates.unreadCount = 0;
        }
        
        state.conversations[index] = {
          ...state.conversations[index],
          ...updates
        };
      }
    },
    setReplyingTo: (state, action) => {
      state.replyingTo = action.payload;
    },
    updateFriendStatus: (state, action) => {
      const friend = action.payload; // This is a FriendshipResponse
      if (!friend || !friend.userId) return;
      
      if (!state.friends) state.friends = [];
      const idx = state.friends.findIndex(f => String(f.userId || f.id) === String(friend.userId));
      if (idx !== -1) {
        state.friends[idx] = { ...state.friends[idx], ...friend };
      } else {
        state.friends.push(friend);
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchConversations.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchConversations.fulfilled, (state, action) => {
        const uniqueConvs = (action.payload || []).reduce((acc, current) => {
          const x = acc.find(item => String(item.conversationId) === String(current.conversationId));
          if (!x) {
            return acc.concat([current]);
          } else {
            return acc;
          }
        }, []);
        state.conversations = uniqueConvs;
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
  setUserStatus,
  pinMessageOptimistic,
  unpinMessageOptimistic,
  updateUserPresence,
  updateMessage,
  optimisticVote,
  resetUnreadCount,
  setMessageRead,
  updateMemberInfo,
  updateConversation,
  updateConversationWallpaper,
  setReplyingTo,
  updateFriendStatus
} = chatSlice.actions;

export default chatSlice.reducer;
