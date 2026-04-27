import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';

let stompClient = null;
let currentToken = null;
const signalHandlers = new Set();
let callSubscription = null;

export const initSocket = (token) => {
    if (stompClient && currentToken === token) return stompClient;

    if (stompClient) {
        console.log('[STOMP] Deactivating existing client due to token change');
        stompClient.deactivate();
        stompClient = null;
        callSubscription = null;
    }

    currentToken = token;
    const socketUrl = import.meta.env.VITE_WS_URL_STOMP || 'http://localhost:8080/ws/chat';

    console.log('[STOMP] Creating new STOMP client, URL:', socketUrl);

    stompClient = new Client({
        webSocketFactory: () => new SockJS(socketUrl),
        connectHeaders: {
            Authorization: `Bearer ${token}`,
        },
        reconnectDelay: 5000,
        heartbeatIncoming: 10000,
        heartbeatOutgoing: 10000,
        onConnect: () => {
            console.log('[STOMP] ✅ Connected to server');
        },
        onStompError: (frame) => {
            console.error('[STOMP] ❌ STOMP Error:', frame.headers['message']);
            console.error('[STOMP] Error details:', frame.body);
        },
        onWebSocketClose: () => {
            console.log('[STOMP] 🔌 WebSocket Disconnected, will auto-reconnect...');
            callSubscription = null;
        },
        onWebSocketError: (evt) => {
            console.error('[STOMP] ❌ WebSocket Error:', evt);
        }
    });

    stompClient.activate();
    return stompClient;
};

/**
 * Subscribe to call signals for a specific user.
 * All incoming CALL_SIGNAL events are bridged to signalHandlers (used by useVideoCall).
 */
export const subscribeToCalls = (userId) => {
    if (!stompClient || !stompClient.connected) {
        console.warn('[STOMP] Cannot subscribe to calls: not connected');
        return null;
    }

    if (callSubscription) {
        callSubscription.unsubscribe();
        callSubscription = null;
    }

    const topic = `/topic/calls.${userId}`;
    console.log('[STOMP] Subscribing to', topic);

    callSubscription = stompClient.subscribe(topic, (message) => {
        try {
            const data = JSON.parse(message.body);
            console.log('🔥 RAW SIGNAL:', data); // 👈 thêm dòng này
            if (data.eventType === 'CALL_SIGNAL') {
                // Backend wraps signal inside data.payload: { senderId, signal }
                // We need to normalise into the shape useVideoCall.handleSignal expects:
                // { senderId, signal, conversationId }
                const normalised = {
                    senderId: data.payload?.senderId,
                    signal: data.payload?.signal,
                    conversationId: data.conversationId,
                };
                console.log('[STOMP] 📡 Call signal received:', normalised.signal?.type, 'from', normalised.senderId);
                broadcastSignal(normalised);
            }
        } catch (e) {
            console.error('[STOMP] Failed to parse call signal:', e);
        }
    });

    return callSubscription;
};

export const emitCallSignal = (conversationId, signal) => {
    if (!stompClient || !stompClient.connected) {
        console.warn('[STOMP] Cannot emit signal: not connected');
        return;
    }

    stompClient.publish({
        destination: '/app/call.signal',
        body: JSON.stringify({ conversationId, signal }),
    });
};

// ── Legacy pub/sub used by useVideoCall ──────────────────────────────────────

export const onCallSignal = (handler) => {
    signalHandlers.add(handler);
};

export const offCallSignal = (handler) => {
    signalHandlers.delete(handler);
};

/** Broadcast a normalised signal object to all registered handlers. */
export const broadcastSignal = (data) => {
    signalHandlers.forEach((handler) => handler(data));
};

export const getStompClient = () => stompClient;

export default {
    initSocket,
    subscribeToCalls,
    emitCallSignal,
    onCallSignal,
    offCallSignal,
    broadcastSignal,
};