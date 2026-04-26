import { useEffect, useCallback, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { 
    addMessage, 
    recallMessage, 
    removeMessage, 
    fetchConversations, 
    fetchFriends, 
    setTyping, 
    updateConversationWallpaper, 
    updateMessage, 
    updateMessageStatus,
    setMessageRead,
    setUserStatus
} from '../store/chatSlice';
import { addPendingFriend, addPendingGroup, addActivity } from '../store/notificationSlice';
import { initSocket, getStompClient } from '../utils/socket';

// Shared state between hook instances
let _globalSubscriptions = [];
let _presenceSubscription = null;

export const useWebSocket = () => {
    const dispatch = useDispatch();
    const { token, user } = useSelector(state => state.auth);

    const userRef = useRef(user);

    // Cập nhật ref mỗi khi user thay đổi để callback luôn có user mới nhất
    useEffect(() => {
        userRef.current = user;
    }, [user]);

    const handleIncomingMessage = useCallback((message) => {
        try {
            const event = JSON.parse(message.body);
            console.log(`[STOMP] 📥 Web received: ${event.eventType}`, event);

            const currentUser = userRef.current;
            const currentUserId = currentUser?.userId || currentUser?.id;

            if (event.eventType === 'MESSAGE_SEND') {
                dispatch(addMessage({
                    conversationId: event.conversationId,
                    message: event.payload,
                    currentUserId
                }));
            } else if (event.eventType === 'MESSAGE_RECALL') {
                dispatch(recallMessage({
                    conversationId: event.conversationId,
                    messageId: event.payload.messageId || event.payload
                }));
            } else if (event.eventType === 'MESSAGE_DELETE') {
                dispatch(removeMessage({
                    conversationId: event.conversationId,
                    messageId: event.payload.messageId || event.payload
                }));
            } else if (event.eventType === 'FRIEND_REQUEST' || event.eventType === 'FRIEND_ACCEPT' || event.eventType === 'FRIEND_DELETE') {
                const data = event.payload?.data || event.payload;
                if (event.eventType === 'FRIEND_REQUEST') {
                    dispatch(addPendingFriend(data));
                } else if (event.eventType === 'FRIEND_ACCEPT') {
                    dispatch(addActivity({
                        type: 'FRIEND_ACCEPT',
                        user: data,
                        message: `${data.fullName || 'Ai đó'} đã chấp nhận lời mời kết bạn.`
                    }));
                    dispatch(fetchConversations());
                    dispatch(fetchFriends());
                } else if (event.eventType === 'FRIEND_DELETE') {
                    dispatch(addActivity({
                        type: 'FRIEND_DELETE',
                        user: data,
                        message: `${data.fullName || 'Ai đó'} đã hủy kết bạn.`
                    }));
                    dispatch(fetchFriends());
                    dispatch(fetchConversations());
                }
            } else if (event.eventType === 'MESSAGE_STATUS_UPDATE' || event.eventType === 'MESSAGE_UPDATE') {
                const conversationId = event.conversationId;
                const msg = event.payload;
                if (msg && msg.messageId) {
                    dispatch(updateMessage({ conversationId, message: msg }));
                } else {
                    dispatch(updateMessageStatus({
                        conversationId: event.conversationId,
                        messageId: event.payload.messageId || event.payload,
                        status: event.payload.status
                    }));
                }
            } else if (event.eventType === 'USER_TYPING') {
                dispatch(setTyping({
                    conversationId: event.conversationId,
                    userId: event.payload.userId,
                    isTyping: event.payload.isTyping,
                    name: 'Ai đó'
                }));

            } else if (event.eventType === 'MESSAGE_READ') {
                const payload = event.payload || {};
                dispatch(setMessageRead({
                    conversationId: event.conversationId,
                    messageId: payload.messageId || payload,
                    userId: payload.userId || event.userId
                }));
            } else if (event.eventType === 'CONVERSATION_UPDATE' || event.eventType === 'MESSAGE_PIN' || event.eventType === 'MESSAGE_UNPIN') {

            } else if (event.eventType === 'WALLPAPER_UPDATED') {
                const payload = event.payload || {};
                const conversationId = event.conversationId || payload.conversationId;
                if (conversationId) {
                    dispatch(updateConversationWallpaper({
                        conversationId,
                        wallpaperUrl: payload.wallpaperUrl ?? null
                    }));
                } else {
                    dispatch(fetchConversations());
                }
            } else if (event.eventType === 'CONVERSATION_UPDATE') {
                const payload = event.payload || {};
                const conversationId = event.conversationId || payload.conversationId || payload.id;

                if (conversationId && Object.prototype.hasOwnProperty.call(payload, 'wallpaperUrl')) {
                    dispatch(updateConversationWallpaper({
                        conversationId,
                        wallpaperUrl: payload.wallpaperUrl ?? null
                    }));
                } else {
                    dispatch(fetchConversations());
                }
            } else if (event.eventType === 'MESSAGE_PIN' || event.eventType === 'MESSAGE_UNPIN') {

                dispatch(fetchConversations());
            }
        } catch (err) {
            console.error('[STOMP] Error in message handler:', err);
        }
    }, [dispatch]);

    const handlePresenceUpdate = useCallback((message) => {
        try {
            const payload = JSON.parse(message.body);
            console.log('[STOMP] 🟢 Presence update:', payload);
            dispatch(setUserStatus({
                userId: payload.userId,
                status: payload.status,
                lastSeenAt: payload.lastSeenAt
            }));
        } catch (err) {
            console.error('[STOMP] Error in presence handler:', err);
        }
    }, [dispatch]);

    const connect = useCallback(() => {
        if (!token) return;

        const client = initSocket(token);

        const setupSubscription = () => {
            if (_globalSubscriptions.length > 0) {
                console.log('[STOMP] Cleaning up old subscriptions...');
                _globalSubscriptions.forEach(sub => sub.unsubscribe());
                _globalSubscriptions = [];
            }

            if (_presenceSubscription) {
                _presenceSubscription.unsubscribe();
            }

            console.log('[STOMP] 📡 Subscribing to message, conversation, and presence queues');
            
            _presenceSubscription = client.subscribe('/topic/presence', handlePresenceUpdate);

            const messagesSub = client.subscribe('/user/queue/messages', handleIncomingMessage);
            const conversationsSub = client.subscribe('/user/queue/conversations', handleIncomingMessage);
            
            _globalSubscriptions = [messagesSub, conversationsSub];
        };

        if (client.connected) {
            setupSubscription();
        }

        // Đăng ký callback khi connect/reconnect
        const originalOnConnect = client.onConnect;
        client.onConnect = (frame) => {
            if (originalOnConnect) originalOnConnect(frame);
            setupSubscription();
        };

        // Quan trọng: Nếu socket bị đóng, reset subscription
        const originalOnClose = client.onWebSocketClose;
        client.onWebSocketClose = (evt) => {
            if (originalOnClose) originalOnClose(evt);
            _presenceSubscription = null;
            _globalSubscriptions = [];
        };

    }, [token, handleIncomingMessage, handlePresenceUpdate]);

    useEffect(() => {
        connect();
        // Không unsubscribe khi unmount hook vì app có nhiều component dùng chung 1 socket
    }, [connect]);

    const sendMessage = useCallback((conversationId, content, type = 'TEXT', mediaUrls = [], replyToMessageId = null, forwardedFrom = null) => {
        const client = getStompClient();
        if (client?.connected) {
            client.publish({
                destination: '/app/chat.send',
                body: JSON.stringify({ conversationId, content, type, mediaUrls, replyToMessageId, forwardedFrom })
            });
        }
    }, []);

    const sendTyping = useCallback((conversationId, isTyping) => {
        const client = getStompClient();
        if (client?.connected) {
            client.publish({
                destination: '/app/chat.typing',
                body: JSON.stringify({ conversationId, isTyping })
            });
        }
    }, []);

    const sendRead = useCallback((conversationId, messageId) => {
        const client = getStompClient();
        if (client?.connected) {
            client.publish({
                destination: '/app/message.read',
                body: JSON.stringify({ conversationId, messageId })
            });
        }
    }, []);

    return { sendMessage, sendTyping, sendRead };
};

export default useWebSocket;
