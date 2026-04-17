import io from 'socket.io-client';
import CONFIG from '../config';

/**
 * WebSocket (Socket.io) configuration for React Native mobile app
 * Handles:
 * - Message events (send, receive, edit, delete, reactions)
 * - Typing indicators
 * - User presence (online/offline/typing)
 * - Read receipts
 */

let socket = null;

const SOCKET_EVENTS = {
  // Connection events
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  RECONNECT: 'reconnect',
  RECONNECT_ATTEMPT: 'reconnect_attempt',

  // Message events
  MESSAGE_SEND: 'message:send',
  MESSAGE_RECEIVE: 'message:receive',
  MESSAGE_EDIT: 'message:edit',
  MESSAGE_DELETE: 'message:delete',
  MESSAGE_RECALL: 'message:recall',
  MESSAGE_REACTION: 'message:reaction',

  // Typing events
  TYPING_START: 'typing:start',
  TYPING_STOP: 'typing:stop',
  USER_TYPING: 'user:typing',

  // Read receipt events
  READ_RECEIPT: 'message:read',
  USER_READ: 'user:read',

  // User presence events
  USER_ONLINE: 'user:online',
  USER_OFFLINE: 'user:offline',
  USER_STATUS: 'user:status',

  // Error events
  ERROR: 'error',
};

/**
 * Initialize Socket.io connection with JWT token
 * Works on both Android and iOS
 * @param {string} token - JWT access token
 * @returns {object} socket instance
 */
export const initializeSocket = (token) => {
  if (socket?.connected) {
    return socket;
  }

  socket = io(CONFIG.SOCKET_URL, {
    auth: {
      token: `Bearer ${token}`,
    },
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 5,
    // For React Native, use websocket transport
    transports: ['websocket'],
    // Reduce polling to avoid battery drain
    upgrade: false,
  });

  // Connection success
  socket.on(SOCKET_EVENTS.CONNECT, () => {
    console.log('✓ WebSocket connected:', socket.id);
  });

  // Disconnection
  socket.on(SOCKET_EVENTS.DISCONNECT, (reason) => {
    console.warn('✗ WebSocket disconnected:', reason);
  });

  // Reconnection
  socket.on(SOCKET_EVENTS.RECONNECT, (attemptNumber) => {
    console.log('↺ WebSocket reconnected after', attemptNumber, 'attempts');
  });

  // Error handling
  socket.on(SOCKET_EVENTS.ERROR, (error) => {
    console.error('WebSocket error:', error);
  });

  return socket;
};

/**
 * Get socket instance (must be initialized first)
 */
export const getSocket = () => {
  if (!socket) {
    throw new Error('Socket not initialized. Call initializeSocket first.');
  }
  return socket;
};

/**
 * Disconnect socket
 */
export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

/**
 * ==================== Message Events ====================
 */

// Send message in real-time
export const emitSendMessage = (conversationId, messageData) => {
  getSocket().emit(SOCKET_EVENTS.MESSAGE_SEND, {
    conversationId,
    ...messageData,
  });
};

// Listen for message receive
export const onMessageReceive = (callback) => {
  getSocket().on(SOCKET_EVENTS.MESSAGE_RECEIVE, callback);
};

// Remove message receive listener
export const offMessageReceive = (callback) => {
  getSocket().off(SOCKET_EVENTS.MESSAGE_RECEIVE, callback);
};

// Edit message
export const emitEditMessage = (messageId, content) => {
  getSocket().emit(SOCKET_EVENTS.MESSAGE_EDIT, { messageId, content });
};

// Listen for message edit
export const onMessageEdit = (callback) => {
  getSocket().on(SOCKET_EVENTS.MESSAGE_EDIT, callback);
};

// Delete message
export const emitDeleteMessage = (messageId) => {
  getSocket().emit(SOCKET_EVENTS.MESSAGE_DELETE, { messageId });
};

// Listen for message delete
export const onMessageDelete = (callback) => {
  getSocket().on(SOCKET_EVENTS.MESSAGE_DELETE, callback);
};

// Recall message
export const emitRecallMessage = (messageId) => {
  getSocket().emit(SOCKET_EVENTS.MESSAGE_RECALL, { messageId });
};

// Listen for message recall
export const onMessageRecall = (callback) => {
  getSocket().on(SOCKET_EVENTS.MESSAGE_RECALL, callback);
};

// Add reaction
export const emitReaction = (messageId, emoji) => {
  getSocket().emit(SOCKET_EVENTS.MESSAGE_REACTION, { messageId, emoji });
};

// Listen for reaction
export const onReaction = (callback) => {
  getSocket().on(SOCKET_EVENTS.MESSAGE_REACTION, callback);
};

/**
 * ==================== Typing Events ====================
 */

// Start typing
export const emitTypingStart = (conversationId) => {
  getSocket().emit(SOCKET_EVENTS.TYPING_START, { conversationId });
};

// Stop typing
export const emitTypingStop = (conversationId) => {
  getSocket().emit(SOCKET_EVENTS.TYPING_STOP, { conversationId });
};

// Listen for user typing
export const onUserTyping = (callback) => {
  getSocket().on(SOCKET_EVENTS.USER_TYPING, callback);
};

// Remove user typing listener
export const offUserTyping = (callback) => {
  getSocket().off(SOCKET_EVENTS.USER_TYPING, callback);
};

/**
 * ==================== Read Receipt Events ====================
 */

// Mark message as read
export const emitReadReceipt = (messageId) => {
  getSocket().emit(SOCKET_EVENTS.READ_RECEIPT, { messageId });
};

// Listen for user read receipt
export const onUserRead = (callback) => {
  getSocket().on(SOCKET_EVENTS.USER_READ, callback);
};

// Remove user read listener
export const offUserRead = (callback) => {
  getSocket().off(SOCKET_EVENTS.USER_READ, callback);
};

/**
 * ==================== User Presence Events ====================
 */

// Listen for user online
export const onUserOnline = (callback) => {
  getSocket().on(SOCKET_EVENTS.USER_ONLINE, callback);
};

// Listen for user offline
export const onUserOffline = (callback) => {
  getSocket().on(SOCKET_EVENTS.USER_OFFLINE, callback);
};

// Listen for user status change
export const onUserStatus = (callback) => {
  getSocket().on(SOCKET_EVENTS.USER_STATUS, callback);
};

export const SOCKET_EVENTS_EXPORT = SOCKET_EVENTS;
export default {
  initializeSocket,
  getSocket,
  disconnectSocket,
  SOCKET_EVENTS,
  // Message events
  emitSendMessage,
  onMessageReceive,
  emitEditMessage,
  onMessageEdit,
  emitDeleteMessage,
  onMessageDelete,
  emitRecallMessage,
  onMessageRecall,
  emitReaction,
  onReaction,
  // Typing events
  emitTypingStart,
  emitTypingStop,
  onUserTyping,
  // Read receipt events
  emitReadReceipt,
  onUserRead,
  // Presence events
  onUserOnline,
  onUserOffline,
  onUserStatus,
};
