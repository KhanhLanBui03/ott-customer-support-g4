import { Client } from '@stomp/stompjs';
import CONFIG from '../config';
import 'text-encoding';

let stompClient = null;
let messageHandlers = new Set();
let typingHandlers = new Set();
let editHandlers = new Set();
let deleteHandlers = new Set();
let recallHandlers = new Set();
let reactionHandlers = new Set();
let statusHandlers = new Set();
let globalHandlers = new Set();

export const initializeSocket = (token, userId, globalHandler) => {
  globalHandlers.clear();
  if (globalHandler) globalHandlers.add(globalHandler);
  if (stompClient && stompClient.connected) {
    console.log('📡 Mobile socket already connected');
    return stompClient;
  }

  const baseUrl = CONFIG.API_URL.split('/api')[0];
  const socketUrl = baseUrl.replace('http', 'ws') + '/ws/mobile';

  console.log('🔌 Mobile Connecting to:', socketUrl);

  stompClient = new Client({
    brokerURL: socketUrl,
    connectHeaders: { Authorization: `Bearer ${token}` },
    forceBinaryWSFrames: true,
    appendMissingNULLonIncoming: true,
    reconnectDelay: 5000,
    heartbeatIncoming: 10000,
    heartbeatOutgoing: 10000,
    
    debug: (str) => {
      if (str.includes('MESSAGE') || str.includes('SUBSCRIBE')) {
        console.log('[STOMP-DEBUG]', str);
      }
    },

    onConnect: (frame) => {
      console.log('✅ Mobile STOMP Connected. User:', frame.headers['user-name']);
      
      // Đảm bảo luôn subscribe lại khi connect/reconnect
      console.log('📡 Mobile Subscribing to /user/queue/messages...');
      stompClient.subscribe('/user/queue/messages', (message) => {
        try {
          const event = JSON.parse(message.body);
          console.log('📥 Mobile received event:', event.eventType, 'for conversation:', event.conversationId);

          // Phát sự kiện toàn cục cho Layout xử lý thông báo
          globalHandlers.forEach(handler => handler(event));

          if (event.eventType === 'MESSAGE_SEND') {
            const msg = event.payload;
            console.log('💬 Processing MESSAGE_SEND:', msg.messageId);
            messageHandlers.forEach(handler => handler(msg));
          } else if (event.eventType === 'USER_TYPING') {
            typingHandlers.forEach(handler => handler(event.payload));
          } else if (event.eventType === 'MESSAGE_EDIT') {
            editHandlers.forEach(handler => handler(event.payload));
          } else if (event.eventType === 'MESSAGE_DELETE') {
            deleteHandlers.forEach(handler => handler(event.payload));
          } else if (event.eventType === 'MESSAGE_RECALL') {
            recallHandlers.forEach(handler => handler(event.payload));
          } else if (event.eventType === 'MESSAGE_REACTION') {
            reactionHandlers.forEach(handler => handler(event.payload));
          } else if (event.eventType === 'USER_STATUS_CHANGED') {
            console.log('👤 User status changed:', event.payload.userId, event.payload.status);
            statusHandlers.forEach(handler => handler(event.payload));
          }
        } catch (e) {
          console.error('❌ Error parsing STOMP message:', e);
        }
      });
    },
    onStompError: (frame) => {
      console.error('❌ STOMP error:', frame.headers['message']);
      console.error('Details:', frame.body);
    },
    onWebSocketClose: () => {
      console.log('🔌 Mobile WebSocket closed');
    }
  });

  stompClient.activate();
  return stompClient;
};

export const onMessageReceive = (handler) => {
    messageHandlers.add(handler);
    console.log('➕ Added message handler. Total:', messageHandlers.size);
};
export const offMessageReceive = (handler) => messageHandlers.delete(handler);

export const onUserTyping = (handler) => typingHandlers.add(handler);
export const offUserTyping = (handler) => typingHandlers.delete(handler);

export const onMessageEdit = (handler) => editHandlers.add(handler);
export const onMessageDelete = (handler) => deleteHandlers.add(handler);
export const onMessageRecall = (handler) => recallHandlers.add(handler);
export const onReaction = (handler) => reactionHandlers.add(handler);
export const onUserStatusChange = (handler) => statusHandlers.add(handler);
export const offUserStatusChange = (handler) => statusHandlers.delete(handler);

export const sendMessageViaSocket = (messageData) => {
  if (stompClient?.connected) {
    console.log('📤 Sending via socket:', messageData.content);
    stompClient.publish({
      destination: '/app/chat.send',
      body: JSON.stringify(messageData),
    });
    return true;
  }
  console.warn('⚠️ Cannot send: STOMP not connected');
  return false;
};

export const emitSendMessage = (conversationId, messageData) => {
  return sendMessageViaSocket({ ...messageData, conversationId });
};

export const emitTypingStart = (conversationId) => {
  if (stompClient?.connected) {
    stompClient.publish({
      destination: '/app/chat.typing',
      body: JSON.stringify({ conversationId, isTyping: true }),
    });
  }
};

export const emitTypingStop = (conversationId) => {
  if (stompClient?.connected) {
    stompClient.publish({
      destination: '/app/chat.typing',
      body: JSON.stringify({ conversationId, isTyping: false }),
    });
  }
};

export const emitReadReceipt = (messageId, conversationId) => {
  if (stompClient?.connected) {
    stompClient.publish({
      destination: '/app/message.read',
      body: JSON.stringify({ messageId, conversationId }),
    });
  }
};

export const disconnectSocket = () => {
  if (stompClient) {
    stompClient.deactivate();
    stompClient = null;
    console.log('🛑 Mobile socket deactivated');
  }
};

export default {
  initializeSocket,
  disconnectSocket,
  onMessageReceive,
  offMessageReceive,
  onUserTyping,
  offUserTyping,
  onUserStatusChange,
  offUserStatusChange,
  onMessageEdit,
  onMessageDelete,
  onMessageRecall,
  onReaction,
  sendMessageViaSocket,
  emitSendMessage,
  emitTypingStart,
  emitTypingStop,
  emitReadReceipt
};
