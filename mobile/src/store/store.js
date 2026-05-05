import { configureStore } from '@reduxjs/toolkit';
import authReducer from './authSlice';
import chatReducer from './chatSlice';
import notificationReducer from './notificationSlice';
import { injectStore } from '../api/axiosClient';

/**
 * Redux store configuration for React Native
 * Combines all slices: auth, chat, notifications
 */

const store = configureStore({
  reducer: {
    auth: authReducer,
    chat: chatReducer,
    notifications: notificationReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Ignore Socket.io and other non-serializable objects
        ignoredActions: ['chat/setTypingUser', 'chat/clearTypingUsers'],
        ignoredActionPaths: ['payload.socket'],
        ignoredPaths: ['socket'],
      },
    }),
});

// Inject store to axiosClient to handle 401 globally
injectStore(store);

export default store;
