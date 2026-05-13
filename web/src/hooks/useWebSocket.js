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
    setUserStatus,
    updateMemberInfo,
    updateConversation,
    updateFriendStatus
} from '../store/chatSlice';
import { chatApi } from '../api/chatApi';
import { addPendingFriend, addPendingGroup, addActivity } from '../store/notificationSlice';
import { initSocket, getStompClient, subscribeToCalls } from '../utils/socket';

// Shared state between hook instances
let _globalSubscriptions = [];
let _presenceSubscription = null;
let _activeConvId = null; // Lưu trữ ID hội thoại đang mở toàn cục để các callback cũ cũng nhận được

export const useWebSocket = () => {
    const dispatch = useDispatch();
    const { token, user } = useSelector(state => state.auth);
    const { conversations, activeConversationId } = useSelector(state => state.chat);
    const conversationsRef = useRef(conversations);
    const userRef = useRef(user);

    useEffect(() => {
        conversationsRef.current = conversations;
    }, [conversations]);

    useEffect(() => {
        userRef.current = user;
        _activeConvId = activeConversationId;
    }, [user, activeConversationId]);

    const handleIncomingMessage = useCallback((message) => {
        try {
            const event = JSON.parse(message.body);
            console.log(`[STOMP] 📥 Web received: ${event.eventType}`, event);

            const currentUser = userRef.current;
            const currentUserId = currentUser?.userId || currentUser?.id;

            if (event.eventType === 'MESSAGE_SEND' || event.eventType === 'MESSAGE_NEW') {
                const msg = event.payload;

                // If we receive a message for a conversation we don't have yet (e.g. new group), fetch all
                const existing = (conversationsRef.current || []).find(c => c.conversationId === event.conversationId);
                if (!existing) {
                    console.log(`[STOMP] Received message for unknown conversation ${event.conversationId}, fetching...`);
                    dispatch(fetchConversations());
                }

                try { console.debug('[useWebSocket] incoming MESSAGE_SEND payload', event.conversationId, msg); } catch(e){}
                dispatch(addMessage({
                    conversationId: event.conversationId,
                    message: msg,
                    currentUserId,
                    currentUserName: currentUser?.fullName || currentUser?.name
                }));

                // Auto-read if conversation is active AND tab is visible
                // NOTE: Removed document.hasFocus() check because when web-to-web on same machine,
                // the other browser window loses focus, preventing auto-read receipts
                if (_activeConvId === event.conversationId &&
                    document.visibilityState === 'visible' &&
                    String(msg.senderId) !== String(currentUserId) &&
                    msg.messageId && !String(msg.messageId).startsWith('temp-')) {

                    const client = getStompClient();
                    if (client?.connected) {
                        client.publish({
                            destination: '/app/message.read',
                            body: JSON.stringify({
                                conversationId: event.conversationId,
                                messageId: msg.messageId
                            })
                        });

                        // Reset unread count locally if we're in the chat
                        dispatch(updateConversation({
                            conversationId: event.conversationId,
                            unreadCount: 0
                        }));
                    }
                }
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
            } else if (event.eventType === 'GROUP_INVITE') {
                const data = event.payload?.data || event.payload;
                dispatch(addPendingGroup(data));
            } else if (event.eventType === 'FRIEND_REQUEST' || event.eventType === 'FRIEND_ACCEPT' || event.eventType === 'FRIEND_DELETE' || event.eventType === 'FRIEND_BLOCK' || event.eventType === 'FRIEND_UNBLOCK' || event.eventType === 'FRIEND_REQUEST_REJECTED' || event.eventType === 'FRIEND_REQUEST_CANCELLED') {
                const data = event.payload?.data || event.payload;
                
                // Always update friends list for any friendship event
                if (data && data.userId) {
                    dispatch(updateFriendStatus(data));
                }
                dispatch(fetchFriends());
                dispatch(fetchConversations());

                if (event.eventType === 'FRIEND_REQUEST') {
                    dispatch(addPendingFriend(data));
                } else if (event.eventType === 'FRIEND_ACCEPT') {
                    dispatch(addActivity({
                        type: 'FRIEND_ACCEPT',
                        user: data,
                        message: `${data.fullName || 'Ai đó'} đã chấp nhận lời mời kết bạn.`
                    }));
                } else if (event.eventType === 'FRIEND_DELETE') {
                    dispatch(addActivity({
                        type: 'FRIEND_DELETE',
                        user: data,
                        message: `${data.fullName || 'Ai đó'} đã hủy kết bạn.`
                    }));
                } else if (event.eventType === 'FRIEND_REQUEST_REJECTED') {
                    dispatch(addActivity({
                        type: 'FRIEND_REQUEST_REJECTED',
                        user: data,
                        message: `${data.fullName || 'Ai đó'} đã từ chối lời mời kết bạn.`
                    }));
                } else if (event.eventType === 'FRIEND_REQUEST_CANCELLED') {
                    dispatch(addActivity({
                        type: 'FRIEND_REQUEST_CANCELLED',
                        user: data,
                        message: `${data.fullName || 'Ai đó'} đã hủy lời mời kết bạn.`
                    }));
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
                    userId: payload.userId || event.userId,
                    currentUserId: currentUserId
                }));
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
                
                if (conversationId) {
                    const existing = (conversationsRef.current || []).find(c => c.conversationId === conversationId);
                    if (existing) {
                        dispatch(updateConversation({
                            conversationId,
                            ...payload
                        }));
                    } else {
                        // New conversation for us (e.g. added to group)
                        dispatch(fetchConversations());
                    }
                } else {
                    dispatch(fetchConversations());
                }
            } else if (event.eventType === 'CONVERSATION_RECREATED') {
                // Conversation was recreated (e.g., user deleted it but received new message)
                // Fetch conversations to add it back to the list
                console.log('[STOMP] Conversation recreated:', event.conversationId);
                dispatch(fetchConversations());
            } else if (event.eventType === 'MESSAGE_PIN' || event.eventType === 'MESSAGE_UNPIN' || event.eventType === 'MEMBER_UPDATE' || event.eventType === 'CONVERSATION_DELETE') {
                dispatch(fetchConversations());
            } else if (event.eventType === 'USER_UPDATE') {
                dispatch(updateMemberInfo(event.payload));
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

            console.log('[STOMP] 📡 Subscribing to message, conversation, presence and call queues');

            _presenceSubscription = client.subscribe('/topic/presence', handlePresenceUpdate);

            const messagesSub = client.subscribe('/user/queue/messages', handleIncomingMessage);
            const conversationsSub = client.subscribe('/user/queue/conversations', handleIncomingMessage);

            // ✅ FIX: Subscribe call signals để callee nhận được cuộc gọi đến
            const currentUser = userRef.current;
            const userId = currentUser?.userId || currentUser?.id;
            if (userId) {
                subscribeToCalls(userId);
                console.log('[STOMP] 📞 Subscribed to call signals for user:', userId);
            }

            _globalSubscriptions = [messagesSub, conversationsSub];
        };

        if (client.connected) {
            setupSubscription();
        }

        const originalOnConnect = client.onConnect;
        client.onConnect = (frame) => {
            if (originalOnConnect) originalOnConnect(frame);
            setupSubscription();
        };

        const originalOnClose = client.onWebSocketClose;
        client.onWebSocketClose = (evt) => {
            if (originalOnClose) originalOnClose(evt);
            _presenceSubscription = null;
            _globalSubscriptions = [];
        };

    }, [token, handleIncomingMessage, handlePresenceUpdate]);

    useEffect(() => {
        connect();
    }, [connect]);

    const sendMessage = useCallback(async (conversationId, content, type = 'TEXT', mediaUrls = [], replyToMessageId = null, forwardedFrom = null) => {
        const payload = {
            conversationId,
            content: content ?? '',
            type,
            mediaUrls,
            replyToMessageId,
            isEncrypted: false,
            forwardedFrom
        };

        try {
            return await chatApi.sendMessage(payload);
        } catch (err) {
            console.warn('[Message] REST send failed, fallback to STOMP:', err?.message || err);
            const client = getStompClient();
            if (client?.connected) {
                client.publish({
                    destination: '/app/chat.send',
                    body: JSON.stringify(payload)
                });
            }
            throw err;
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