import { configureStore } from '@reduxjs/toolkit';
import authReducer from './authSlice';
import chatReducer from './chatSlice';

/**
 * Redux store configuration for React Native
 * Combines all slices: auth, chat
 */

const store = configureStore({
  reducer: {
    auth: authReducer,
    chat: chatReducer,
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

export default store;
