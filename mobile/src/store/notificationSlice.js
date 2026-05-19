import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { notificationApi } from '../api/userApi';
import { friendApi } from '../api/friendApi';
import { conversationApi } from '../api/chatApi';

export const fetchNotifications = createAsyncThunk(
  'notifications/fetchNotifications',
  async (userId, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const myId = userId || state.auth.user?.userId || state.auth.user?.id;

      const promises = [
        friendApi.getPendingRequests(),
        conversationApi.getPendingInvitations()
      ];

      if (myId) {
        promises.push(notificationApi.getNotificationsByReceiver(myId));
      }

      const [friendRes, groupRes, generalRes] = await Promise.all(promises);

      const friendRequests = (friendRes.data || friendRes || []).map(fr => ({
        id: `fr_${fr.userId}_${fr.createdAt}`,
        notificationId: `fr_${fr.userId}`,
        title: 'Lời mời kết bạn',
        message: fr.fullName || fr.phoneNumber || 'Ai đó',
        subMessage: 'muốn kết bạn với bạn',
        type: 'FRIEND_REQUEST',
        senderId: fr.userId,
        avatarUrl: fr.avatarUrl,
        fullName: fr.fullName,
        createdAt: fr.createdAt,
        isRead: false
      }));

      const groupInvites = (groupRes.data || groupRes || []).map(gi => ({
        id: gi.invitationId,
        notificationId: gi.invitationId,
        invitationId: gi.invitationId,
        title: 'Lời mời vào nhóm',
        message: gi.groupName || 'Nhóm mới',
        subMessage: `được mời bởi ${gi.inviterName || 'ai đó'}`,
        type: 'GROUP_INVITE',
        conversationId: gi.conversationId,
        senderId: gi.inviterId,
        avatarUrl: gi.inviterAvatar || gi.groupAvatar,
        fullName: gi.inviterName || gi.groupName || 'Ai đó',
        createdAt: gi.createdAt,
        isRead: false
      }));

      const generalData = generalRes ? (generalRes.data || generalRes || []) : [];
      const generalList = Array.isArray(generalData) ? generalData : (generalData.data || []);
      const generalNotifications = generalList.map(item => {
        const type = item.type || 'OTHER';
        let title = 'Thông báo';
        let subMessage = '';
        if (type === 'FRIEND_ACCEPT' || type === 'FRIEND_ACCEPTED') {
          title = 'Chấp nhận kết bạn';
          if (!item.message) {
            subMessage = 'đã chấp nhận lời mời kết bạn';
          }
        } else if (type === 'SYSTEM') {
          title = 'Hệ thống';
        }

        return {
          id: item.notificationId || item.id || `gen_${Date.now()}_${Math.random()}`,
          notificationId: item.notificationId || item.id,
          title: item.title || title,
          message: item.message || '',
          subMessage: item.subMessage || subMessage,
          type: type,
          senderId: item.senderId,
          avatarUrl: item.senderAvatar || item.avatarUrl || (item.sender ? (item.sender.avatarUrl || item.sender.avatar) : null),
          fullName: item.senderName || item.fullName || (item.sender ? (item.sender.fullName || item.sender.name) : ''),
          createdAt: item.createdAt || item.timestamp,
          isRead: Boolean(item.isRead || item.read)
        };
      });

      // Combine and sort by date descending
      // Deduplicate general notifications that are already present in pending friendRequests or groupInvites
      const filteredGeneral = generalNotifications.filter(gn => {
        if (gn.type === 'FRIEND_REQUEST') {
          return !friendRequests.some(fr => String(fr.senderId) === String(gn.senderId));
        }
        if (gn.type === 'GROUP_INVITE') {
          return !groupInvites.some(gi => String(gi.conversationId) === String(gn.conversationId));
        }
        return true;
      });

      const allNotifications = [...friendRequests, ...groupInvites, ...filteredGeneral].sort((a, b) => {
        const dateA = new Date(a.createdAt || 0);
        const dateB = new Date(b.createdAt || 0);
        return dateB - dateA;
      });

      return allNotifications;
    } catch (error) {
      console.error('Fetch notifications error:', error);
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch notifications');
    }
  }
);

export const markAsRead = createAsyncThunk(
  'notifications/markAsRead',
  async (notificationId, { rejectWithValue }) => {
    try {
      await notificationApi.markNotificationAsRead(notificationId);
      return notificationId;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to mark as read');
    }
  }
);

const notificationSlice = createSlice({
  name: 'notifications',
  initialState: {
    notifications: [],
    unreadCount: 0,
    loading: false,
    error: null,
    inAppNotification: null,
  },
  reducers: {
    setUnreadCount: (state, action) => {
      state.unreadCount = action.payload;
    },
    addNotification: (state, action) => {
      const exists = state.notifications.some(n => (n.id || n.notificationId) === (action.payload.id || action.payload.notificationId));
      if (!exists) {
        state.notifications.unshift(action.payload);
        state.unreadCount += 1;
      }
    },
    clearNotifications: (state) => {
      state.notifications = [];
      state.unreadCount = 0;
    },
    removeNotification: (state, action) => {
      const idToRemove = action.payload;
      const index = state.notifications.findIndex(n => (n.id === idToRemove || n.notificationId === idToRemove));
      if (index !== -1) {
        if (!(state.notifications[index].isRead || state.notifications[index].read)) {
          state.unreadCount = Math.max(0, state.unreadCount - 1);
        }
        state.notifications.splice(index, 1);
      }
    },
    setInAppNotification: (state, action) => {
      state.inAppNotification = action.payload;
    },
    clearInAppNotification: (state) => {
      state.inAppNotification = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchNotifications.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchNotifications.fulfilled, (state, action) => {
        state.loading = false;
        state.notifications = action.payload;
        // Giả sử có trường isRead, tính toán unreadCount
        state.unreadCount = action.payload.filter(n => !n.isRead && !n.read).length;
      })
      .addCase(fetchNotifications.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(markAsRead.fulfilled, (state, action) => {
        const notification = state.notifications.find(n => n.id === action.payload || n.notificationId === action.payload);
        if (notification && !(notification.isRead || notification.read)) {
          notification.isRead = true;
          notification.read = true;
          state.unreadCount = Math.max(0, state.unreadCount - 1);
        }
      });
  },
});

export const { 
  setUnreadCount, 
  addNotification, 
  clearNotifications, 
  removeNotification,
  setInAppNotification,
  clearInAppNotification
} = notificationSlice.actions;
export default notificationSlice.reducer;
