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
let messageUpdateHandlers = new Set();
let readHandlers = new Set();
let statusHandlers = new Set();
let userUpdateHandlers = new Set();
let wallpaperUpdateHandlers = new Set();
let conversationUpdateHandlers = new Set();
let globalHandlers = new Set();
let callHandlers = new Set(); // Thêm cho Calling

export const clearAllHandlers = () => {
  messageHandlers.clear();
  typingHandlers.clear();
  editHandlers.clear();
  deleteHandlers.clear();
  recallHandlers.clear();
  reactionHandlers.clear();
  messageUpdateHandlers.clear();
  readHandlers.clear();
  statusHandlers.clear();
  userUpdateHandlers.clear();
  wallpaperUpdateHandlers.clear();
  conversationUpdateHandlers.clear();
  globalHandlers.clear();
  callHandlers.clear(); // Thêm cho Calling
  console.log('🧹 All socket handlers cleared');
};

export const initializeSocket = (token, userId, globalHandler = null) => {
  clearAllHandlers();
  
  if (globalHandler) globalHandlers.add(globalHandler);

  if (stompClient) {
    console.log('🔌 Deactivating old socket for fresh initialization...');
    stompClient.deactivate();
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
      
      // 1. Subscribe to presence (online/offline)
      stompClient.subscribe('/topic/presence', (message) => {
        try {
          const payload = JSON.parse(message.body);
          statusHandlers.forEach(handler => handler(payload));
        } catch (e) {
          console.error('❌ Error parsing presence message:', e);
        }
      });

      // 2. Subscribe to user-specific queues
      const handleEvent = (message) => {
        try {
          const event = JSON.parse(message.body);
          globalHandlers.forEach(handler => handler(event));

          if (event.eventType === 'MESSAGE_SEND' || event.eventType === 'MESSAGE_NEW') {
            const msg = event.payload;
            messageHandlers.forEach(handler => handler(msg));
          } else if (event.eventType === 'USER_TYPING') {
            typingHandlers.forEach(handler => handler({ ...event.payload, conversationId: event.conversationId }));
          } else if (event.eventType === 'MESSAGE_EDIT') {
            editHandlers.forEach(handler => handler(event.payload));
          } else if (event.eventType === 'MESSAGE_DELETE') {
            deleteHandlers.forEach(handler => handler(event.payload));
          } else if (event.eventType === 'MESSAGE_RECALL') {
            recallHandlers.forEach(handler => handler({ ...event.payload, conversationId: event.conversationId }));
          } else if (event.eventType === 'MESSAGE_REACTION') {
            reactionHandlers.forEach(handler => handler({ ...event.payload, conversationId: event.conversationId }));
          } else if (event.eventType === 'MESSAGE_STATUS_UPDATE' || event.eventType === 'MESSAGE_UPDATE') {
            messageUpdateHandlers.forEach(handler => handler({ ...event.payload, conversationId: event.conversationId }));
          } else if (event.eventType === 'MESSAGE_READ') {
            readHandlers.forEach(handler => handler({ ...event.payload, conversationId: event.conversationId }));
          } else if (event.eventType === 'WALLPAPER_UPDATED') {
            const wallpaperPayload = { conversationId: event.conversationId, wallpaperUrl: event.payload?.wallpaperUrl ?? null };
            wallpaperUpdateHandlers.forEach(handler => handler(wallpaperPayload));
          } else if (event.eventType === 'CONVERSATION_UPDATE' || event.eventType === 'MEMBER_UPDATE' || event.eventType === 'CONVERSATION_RECREATED' || event.eventType === 'GROUP_INVITE') {
            conversationUpdateHandlers.forEach(handler => handler({
              conversationId: event.conversationId,
              eventType: event.eventType,
              payload: event.payload
            }));
          } else if (event.eventType === 'USER_UPDATE') {
            userUpdateHandlers.forEach(handler => handler(event.payload));
          } else if (event.eventType === 'USER_STATUS_CHANGED') {
            statusHandlers.forEach(handler => handler(event.payload));
          }
        } catch (e) {
          console.error('❌ Error parsing STOMP message:', e);
        }
      };

      stompClient.subscribe('/user/queue/messages', handleEvent);
      stompClient.subscribe('/user/queue/conversations', handleEvent);

      // 3. Subscribe to calls (Tích hợp thêm)
      if (userId) {
        console.log(`📡 Mobile Subscribing to /topic/calls.${userId}`);
        stompClient.subscribe(`/topic/calls.${userId}`, (message) => {
          try {
            const data = JSON.parse(message.body);
            const signalType = data?.signal?.type || data?.payload?.signal?.type;
            console.log('📞 [Socket] Call signal received:', signalType);
            callHandlers.forEach(handler => handler(data));
          } catch (e) {
            console.error('❌ Error parsing call signal:', e);
          }
        });
      }
    },
    onStompError: (frame) => console.error('❌ STOMP error:', frame.headers['message']),
    onWebSocketClose: () => console.log('🔌 Mobile WebSocket closed')
  });

  stompClient.activate();
  return stompClient;
};

// --- Handlers ---
export const onMessageReceive = (handler) => messageHandlers.add(handler);
export const offMessageReceive = (handler) => messageHandlers.delete(handler);
export const onUserTyping = (handler) => typingHandlers.add(handler);
export const offUserTyping = (handler) => typingHandlers.delete(handler);
export const onUserStatusChange = (handler) => statusHandlers.add(handler);
export const offUserStatusChange = (handler) => statusHandlers.delete(handler);
export const onConversationUpdate = (handler) => conversationUpdateHandlers.add(handler);
export const offConversationUpdate = (handler) => conversationUpdateHandlers.delete(handler);
export const onCallSignal = (handler) => callHandlers.add(handler);
export const offCallSignal = (handler) => callHandlers.delete(handler);

export const onMessageEdit = (handler) => editHandlers.add(handler);
export const offMessageEdit = (handler) => editHandlers.delete(handler);
export const onMessageDelete = (handler) => deleteHandlers.add(handler);
export const offMessageDelete = (handler) => deleteHandlers.delete(handler);
export const onMessageRecall = (handler) => recallHandlers.add(handler);
export const offMessageRecall = (handler) => recallHandlers.delete(handler);
export const onReaction = (handler) => reactionHandlers.add(handler);
export const offReaction = (handler) => reactionHandlers.delete(handler);
export const onMessageUpdate = (handler) => messageUpdateHandlers.add(handler);
export const offMessageUpdate = (handler) => messageUpdateHandlers.delete(handler);
export const onMessageRead = (handler) => readHandlers.add(handler);
export const offMessageRead = (handler) => readHandlers.delete(handler);
export const onWallpaperUpdated = (handler) => wallpaperUpdateHandlers.add(handler);
export const offWallpaperUpdated = (handler) => wallpaperUpdateHandlers.delete(handler);
export const onUserUpdate = (handler) => userUpdateHandlers.add(handler);
export const offUserUpdate = (handler) => userUpdateHandlers.delete(handler);
export const onStatusUpdate = onUserStatusChange;
export const offStatusUpdate = offUserStatusChange;

// --- Emitters ---
export const sendMessageViaSocket = (messageData) => {
  if (stompClient?.connected) {
    stompClient.publish({
      destination: '/app/chat.send',
      body: JSON.stringify(messageData),
    });
    return true;
  }
  return false;
};

export const emitSendMessage = (conversationId, messageData) => {
  return sendMessageViaSocket({ ...messageData, conversationId });
};

export const emitCallSignal = (conversationId, signal, senderName = 'Người dùng') => {
  if (stompClient?.connected) {
    stompClient.publish({
      destination: '/app/call.signal',
      body: JSON.stringify({ conversationId, signal, senderName }),
    });
  }
};

export const emitTypingStart = (conversationId) => {
  if (stompClient?.connected) {
    stompClient.publish({ destination: '/app/chat.typing', body: JSON.stringify({ conversationId, isTyping: true }) });
  }
};

export const emitTypingStop = (conversationId) => {
  if (stompClient?.connected) {
    stompClient.publish({ destination: '/app/chat.typing', body: JSON.stringify({ conversationId, isTyping: false }) });
  }
};

export const emitReadReceipt = (messageId, conversationId) => {
  if (stompClient?.connected) {
    stompClient.publish({ destination: '/app/message.read', body: JSON.stringify({ messageId, conversationId }) });
  }
};

export const emitRecallMessage = (messageId, conversationId) => {
  if (stompClient?.connected) {
    stompClient.publish({ destination: '/app/message.recall', body: JSON.stringify({ messageId, conversationId }) });
  }
};

export const disconnectSocket = () => {
  if (stompClient) {
    stompClient.deactivate();
    stompClient = null;
    console.log('🛑 Mobile socket deactivated');
  }
  clearAllHandlers();
};

export default {
  initializeSocket, disconnectSocket, 
  onMessageReceive, offMessageReceive, 
  onUserTyping, offUserTyping, 
  onUserStatusChange, offUserStatusChange,
  onConversationUpdate, offConversationUpdate,
  onCallSignal, offCallSignal,
  onMessageEdit, offMessageEdit, onMessageDelete, offMessageDelete, onMessageRecall, offMessageRecall,
  onReaction, offReaction, onMessageUpdate, offMessageUpdate, onMessageRead, offMessageRead,
  onWallpaperUpdated, offWallpaperUpdated, onUserUpdate, offUserUpdate, onStatusUpdate, offStatusUpdate,
  sendMessageViaSocket, emitSendMessage, emitCallSignal,
  emitTypingStart, emitTypingStop, emitReadReceipt, emitRecallMessage,
};
