import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { notificationApi } from '../api/notificationApi';

const normalizeNotification = (item = {}) => {
  const notificationId = item.notificationId ?? item.id ?? item.notification_id ?? null;
  const senderId = item.senderId ?? item.sender?.userId ?? item.sender?.id ?? item.userId ?? item.user?.id ?? null;
  const receiverId = item.receiverId ?? item.receiver?.userId ?? item.receiver?.id ?? null;
  const createdAt = item.createdAt ?? item.timestamp ?? item.created_at ?? Date.now();
  const message = item.message ?? '';
  const type = item.type ?? 'OTHER';

  return {
    ...item,
    id: notificationId ?? item.id ?? `${type}-${senderId ?? 'unknown'}-${receiverId ?? 'unknown'}-${createdAt}`,
    notificationId,
    senderId,
    receiverId,
    type,
    message,
    isRead: Boolean(item.isRead),
    createdAt,
    dedupeKey: item.dedupeKey ?? (notificationId ? `id:${notificationId}` : `${type}:${senderId ?? ''}:${receiverId ?? ''}:${message}`),
  };
};

const normalizeList = (items) => (Array.isArray(items) ? items.map(normalizeNotification) : []);

const mergeByDedupeKey = (existing, incoming) => {
  const map = new Map();
  [...existing, ...incoming].forEach((item) => {
    const key = item.dedupeKey ?? item.id;
    map.set(key, item);
  });
  return Array.from(map.values()).sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
};

const recalculateUnreadCount = (state) => {
  state.unreadCount = state.pendingFriends.length + state.pendingGroups.length + state.activities.filter((activity) => !activity.isRead).length;
};

const getCurrentReceiverId = (state) => state.auth.user?.userId || state.auth.user?.id || null;

export const fetchNotifications = createAsyncThunk(
  'notification/fetchNotifications',
  async (receiverId, { getState, rejectWithValue }) => {
    try {
      const resolvedReceiverId = receiverId || getCurrentReceiverId(getState());
      if (!resolvedReceiverId) {
        return [];
      }

      const toList = (response) => {
        const payload = response?.data ?? response;
        return Array.isArray(payload) ? payload : (Array.isArray(payload?.data) ? payload.data : []);
      };
      const receiverResponse = await notificationApi.getNotificationsByReceiverId(resolvedReceiverId);
      const receiverList = toList(receiverResponse);
      const normalized = normalizeList(receiverList);

      return normalized.filter((notification) => notification.type !== 'FRIEND_REQUEST');
    } catch (err) {
      return rejectWithValue(err.response?.data || err.message);
    }
  },
  {
    condition: (_, { getState }) => {
      const state = getState();
      return !state.notification.isFetching;
    },
  }
);

export const markActivitiesAsRead = createAsyncThunk(
  'notification/markActivitiesAsRead',
  async (_, { dispatch, getState, rejectWithValue }) => {
    try {
      const state = getState();
      const unreadActivities = state.notification.activities.filter((activity) => !activity.isRead);
      const notificationsWithIds = unreadActivities.filter((activity) => activity.notificationId);

      dispatch({ type: 'notification/markActivitiesAsReadLocal' });

      if (notificationsWithIds.length > 0) {
        await Promise.all(
          notificationsWithIds.map((activity) =>
            notificationApi.markNotificationAsRead(activity.notificationId)
          )
        );
      }

      return unreadActivities.map((activity) => activity.id);
    } catch (err) {
      return rejectWithValue(err.response?.data || err.message);
    }
  }
);

const notificationSlice = createSlice({
  name: 'notification',
  initialState: {
    pendingFriends: [],
    pendingGroups: [],
    activities: [],
    unreadCount: 0,
    isFetching: false,
    lastError: null,
  },
  reducers: {
    setPendingRequests: (state, action) => {
      state.pendingFriends = normalizeList(action.payload);
      recalculateUnreadCount(state);
    },
    setPendingGroups: (state, action) => {
      state.pendingGroups = normalizeList(action.payload);
      recalculateUnreadCount(state);
    },
    addPendingFriend: (state, action) => {
      const normalized = normalizeNotification(action.payload);
      const exists = state.pendingFriends.find((r) => String(r.userId) === String(normalized.userId));
      if (!exists) {
        state.pendingFriends.unshift(normalized);
        recalculateUnreadCount(state);
      }
    },
    addPendingGroup: (state, action) => {
      const normalized = normalizeNotification(action.payload);
      const exists = state.pendingGroups.find((g) => String(g.invitationId) === String(normalized.invitationId));
      if (!exists) {
        state.pendingGroups.unshift(normalized);
        recalculateUnreadCount(state);
      }
    },
    removePendingFriend: (state, action) => {
      state.pendingFriends = state.pendingFriends.filter((r) => String(r.userId) !== String(action.payload));
      recalculateUnreadCount(state);
    },
    removePendingGroup: (state, action) => {
      state.pendingGroups = state.pendingGroups.filter((g) => String(g.invitationId) !== String(action.payload));
      recalculateUnreadCount(state);
    },
    addActivity: (state, action) => {
      const activity = normalizeNotification({
        id: Date.now(),
        isRead: false,
        timestamp: Date.now(),
        ...action.payload,
      });

      state.activities = mergeByDedupeKey([activity], state.activities).slice(0, 20);
      recalculateUnreadCount(state);
    },
    setActivities: (state, action) => {
      state.activities = mergeByDedupeKey(state.activities, normalizeList(action.payload)).slice(0, 20);
      recalculateUnreadCount(state);
    },
    markActivitiesAsReadLocal: (state) => {
      state.activities.forEach((activity) => {
        activity.isRead = true;
      });
      recalculateUnreadCount(state);
    },
    clearNotifications: (state) => {
      state.unreadCount = 0;
      state.activities.forEach((activity) => {
        activity.isRead = true;
      });
    }
  },
  extraReducers: (builder) => {
    builder.addCase(fetchNotifications.pending, (state) => {
      state.isFetching = true;
      state.lastError = null;
    });
    builder.addCase(fetchNotifications.fulfilled, (state, action) => {
      state.activities = mergeByDedupeKey(state.activities, action.payload || []).slice(0, 20);
      recalculateUnreadCount(state);
      state.isFetching = false;
      state.lastError = null;
    });
    builder.addCase(fetchNotifications.rejected, (state, action) => {
      state.isFetching = false;
      state.lastError = action.payload || action.error?.message || 'Không thể tải thông báo từ cloud';
    });
    builder.addCase(markActivitiesAsRead.fulfilled, (state) => {
      state.activities.forEach((activity) => {
        activity.isRead = true;
      });
      recalculateUnreadCount(state);
    });
  },
});

export const { 
    setPendingRequests, 
    setPendingGroups, 
    addPendingFriend, 
    addPendingGroup, 
    removePendingFriend, 
    removePendingGroup, 
    addActivity,
    setActivities,
    markActivitiesAsReadLocal,
    clearNotifications 
} = notificationSlice.actions;
export default notificationSlice.reducer;
