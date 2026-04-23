import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';

let stompClient = null;
let currentToken = null;
const signalHandlers = new Set();

export const initSocket = (token) => {
  if (stompClient && currentToken === token) return stompClient;
  
  if (stompClient) {
    console.log('[STOMP] Deactivating existing client due to token change');
    stompClient.deactivate();
    stompClient = null;
  }

  currentToken = token;
  const socketUrl = import.meta.env.VITE_WS_URL_STOMP || 'http://localhost:8080/ws/chat';
  
  console.log('[STOMP] Creating new STOMP client, URL:', socketUrl);

  stompClient = new Client({
    webSocketFactory: () => new SockJS(socketUrl),
    connectHeaders: {
      Authorization: `Bearer ${token}`,
    },
    // Auto-reconnect every 5 seconds when disconnected
    reconnectDelay: 5000,
    // Heartbeat: client sends every 10s, expects server every 10s
    heartbeatIncoming: 10000,
    heartbeatOutgoing: 10000,
    onConnect: () => {
      console.log('[STOMP] ✅ Connected to server');
    },
    onStompError: (frame) => {
      console.error('[STOMP] ❌ STOMP Error:', frame.headers['message']);
      console.error('[STOMP] Error details:', frame.body);
    },
    onWebSocketClose: (evt) => {
      console.log('[STOMP] 🔌 WebSocket Disconnected, will auto-reconnect...');
    },
    onWebSocketError: (evt) => {
      console.error('[STOMP] ❌ WebSocket Error:', evt);
    }
  });

  stompClient.activate();
  return stompClient;
};

export const subscribeToCalls = (userId, onSignal) => {
    if (!stompClient || !stompClient.connected) {
        console.warn('[STOMP] Cannot subscribe: not connected');
        return;
    }
    
    console.log('[STOMP] Subscribing to /topic/calls.' + userId);
    return stompClient.subscribe(`/topic/calls.${userId}`, (message) => {
        const data = JSON.parse(message.body);
        if (data.eventType === 'CALL_SIGNAL') {
            onSignal(data.payload);
        }
    });
};

export const emitCallSignal = (conversationId, signal) => {
    if (!stompClient || !stompClient.connected) {
        console.warn('[STOMP] Cannot emit signal: not connected');
        return;
    }
    
    stompClient.publish({
        destination: '/app/call.signal',
        body: JSON.stringify({
            conversationId,
            signal
        })
    });
};

// Legacy support for useVideoCall.js
export const onCallSignal = (handler) => {
    signalHandlers.add(handler);
};

export const offCallSignal = (handler) => {
    signalHandlers.delete(handler);
};

export const broadcastSignal = (data) => {
    signalHandlers.forEach(handler => handler(data));
};

export const getStompClient = () => stompClient;

export default {
    initSocket,
    subscribeToCalls,
    emitCallSignal,
    onCallSignal,
    offCallSignal
};
