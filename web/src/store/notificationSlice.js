import { createSlice } from '@reduxjs/toolkit';

const loadState = (key, defaultValue) => {
  try {
    const serializedState = localStorage.getItem(key);
    if (serializedState === null) {
      return defaultValue;
    }
    return JSON.parse(serializedState);
  } catch (err) {
    return defaultValue;
  }
};

const saveState = (key, state) => {
  try {
    const serializedState = JSON.stringify(state);
    localStorage.setItem(key, serializedState);
  } catch {
    // ignore
  }
};

const initialPendingFriends = loadState('chat_pendingFriends', []);
const initialPendingGroups = loadState('chat_pendingGroups', []);
const initialActivities = loadState('chat_activities', []);

// Helper to merge arrays of objects by key (keeps local if API fails to fetch)
const mergeUnique = (arr1, arr2, key) => {
  const map = new Map();
  // We put array 1 (local) first, then array 2 (API) overrides if exists
  [...arr1, ...arr2].forEach(item => {
    map.set(item[key], item);
  });
  return Array.from(map.values());
};

const notificationSlice = createSlice({
  name: 'notification',
  initialState: {
    pendingFriends: initialPendingFriends,
    pendingGroups: initialPendingGroups,
    activities: initialActivities,
    unreadCount: initialPendingFriends.length + initialPendingGroups.length + initialActivities.filter(a => !a.isRead).length
  },
  reducers: {
    setPendingRequests: (state, action) => {
      state.pendingFriends = mergeUnique(state.pendingFriends, action.payload, 'userId');
      state.unreadCount = state.pendingFriends.length + state.pendingGroups.length;
      saveState('chat_pendingFriends', state.pendingFriends);
    },
    setPendingGroups: (state, action) => {
      state.pendingGroups = mergeUnique(state.pendingGroups, action.payload, 'invitationId');
      state.unreadCount = state.pendingFriends.length + state.pendingGroups.length;
      saveState('chat_pendingGroups', state.pendingGroups);
    },
    addPendingFriend: (state, action) => {
      const exists = state.pendingFriends.find(r => r.userId === action.payload.userId);
      if (!exists) {
        state.pendingFriends.unshift(action.payload);
        state.unreadCount += 1;
        saveState('chat_pendingFriends', state.pendingFriends);
      }
    },
    addPendingGroup: (state, action) => {
      const exists = state.pendingGroups.find(g => g.invitationId === action.payload.invitationId);
      if (!exists) {
        state.pendingGroups.unshift(action.payload);
        state.unreadCount += 1;
        saveState('chat_pendingGroups', state.pendingGroups);
      }
    },
    removePendingFriend: (state, action) => {
      state.pendingFriends = state.pendingFriends.filter(r => r.userId !== action.payload);
      state.unreadCount = Math.max(0, state.pendingFriends.length + state.pendingGroups.length);
      saveState('chat_pendingFriends', state.pendingFriends);
    },
    removePendingGroup: (state, action) => {
      state.pendingGroups = state.pendingGroups.filter(g => g.invitationId !== action.payload);
      state.unreadCount = Math.max(0, state.pendingFriends.length + state.pendingGroups.length);
      saveState('chat_pendingGroups', state.pendingGroups);
    },
    addActivity: (state, action) => {
      const activity = {
        id: Date.now(),
        isRead: false,
        timestamp: Date.now(),
        ...action.payload
      };
      state.activities.unshift(activity);
      // Keep only last 20 activities
      if (state.activities.length > 20) state.activities.pop();
      state.unreadCount = state.pendingFriends.length + state.pendingGroups.length + state.activities.filter(a => !a.isRead).length;
      saveState('chat_activities', state.activities);
    },
    markActivitiesAsRead: (state) => {
      state.activities.forEach(a => a.isRead = true);
      state.unreadCount = state.pendingFriends.length + state.pendingGroups.length;
      saveState('chat_activities', state.activities);
    },
    clearNotifications: (state) => {
      state.unreadCount = 0;
      // Also mark activities as read
      state.activities.forEach(a => a.isRead = true);
      saveState('chat_activities', state.activities);
    }
  }
});

export const { 
    setPendingRequests, 
    setPendingGroups, 
    addPendingFriend, 
    addPendingGroup, 
    removePendingFriend, 
    removePendingGroup, 
    addActivity,
    markActivitiesAsRead,
    clearNotifications 
} = notificationSlice.actions;
export default notificationSlice.reducer;
