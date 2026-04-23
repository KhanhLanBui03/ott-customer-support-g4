import { useEffect, useCallback, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { addMessage, recallMessage, removeMessage, fetchConversations, fetchFriends, setTyping, updateMessage, updateMessageStatus } from '../store/chatSlice';
import { addPendingFriend, addPendingGroup } from '../store/notificationSlice';
import { initSocket, getStompClient } from '../utils/socket';

// Flag dùng chung giữa các instance của hook
let _globalSubscription = null;

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
            } else if (event.eventType === 'FRIEND_REQUEST' || event.eventType === 'FRIEND_ACCEPT') {
                const data = event.payload?.data || event.payload;
                if (event.eventType === 'FRIEND_REQUEST') {
                    dispatch(addPendingFriend(data));
                } else {
                    dispatch(fetchConversations());
                    dispatch(fetchFriends());
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
            } else if (event.eventType === 'CONVERSATION_UPDATE') {
                dispatch(fetchConversations());
            }
        } catch (err) {
            console.error('[STOMP] Error in message handler:', err);
        }
    }, [dispatch]);

    const connect = useCallback(() => {
        if (!token) return;

        const client = initSocket(token);

        const setupSubscription = () => {
            if (_globalSubscription) {
                console.log('[STOMP] Cleaning up old subscription...');
                _globalSubscription.unsubscribe();
            }
            console.log('[STOMP] 📡 Subscribing to /user/queue/messages');
            _globalSubscription = client.subscribe('/user/queue/messages', handleIncomingMessage);
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
            _globalSubscription = null;
        };

    }, [token, handleIncomingMessage]);

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

    return { sendMessage, sendTyping };
};

export default useWebSocket;
