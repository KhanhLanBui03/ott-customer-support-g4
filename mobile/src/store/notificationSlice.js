import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { notificationApi } from '../api/userApi';

export const fetchNotifications = createAsyncThunk(
  'notifications/fetchNotifications',
  async (params, { rejectWithValue }) => {
    try {
      const response = await notificationApi.getNotifications(params);
      return response.data.data || response.data || [];
    } catch (error) {
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

export const { setUnreadCount, addNotification, clearNotifications, removeNotification } = notificationSlice.actions;
export default notificationSlice.reducer;
