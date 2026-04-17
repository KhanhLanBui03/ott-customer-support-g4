import { createSlice } from '@reduxjs/toolkit';

const notificationSlice = createSlice({
  name: 'notification',
  initialState: {
    pendingFriends: [],
    pendingGroups: [],
    unreadCount: 0
  },
  reducers: {
    setPendingRequests: (state, action) => {
      state.pendingFriends = action.payload;
      state.unreadCount = state.pendingFriends.length + state.pendingGroups.length;
    },
    setPendingGroups: (state, action) => {
      state.pendingGroups = action.payload;
      state.unreadCount = state.pendingFriends.length + state.pendingGroups.length;
    },
    addPendingFriend: (state, action) => {
      const exists = state.pendingFriends.find(r => r.userId === action.payload.userId);
      if (!exists) {
        state.pendingFriends.unshift(action.payload);
        state.unreadCount += 1;
      }
    },
    addPendingGroup: (state, action) => {
      const exists = state.pendingGroups.find(g => g.invitationId === action.payload.invitationId);
      if (!exists) {
        state.pendingGroups.unshift(action.payload);
        state.unreadCount += 1;
      }
    },
    removePendingFriend: (state, action) => {
      state.pendingFriends = state.pendingFriends.filter(r => r.userId !== action.payload);
      state.unreadCount = Math.max(0, state.pendingFriends.length + state.pendingGroups.length);
    },
    removePendingGroup: (state, action) => {
      state.pendingGroups = state.pendingGroups.filter(g => g.invitationId !== action.payload);
      state.unreadCount = Math.max(0, state.pendingFriends.length + state.pendingGroups.length);
    },
    clearNotifications: (state) => {
      state.unreadCount = 0;
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
    clearNotifications 
} = notificationSlice.actions;
export default notificationSlice.reducer;
