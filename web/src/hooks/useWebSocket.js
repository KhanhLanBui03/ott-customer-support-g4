import { useEffect, useCallback, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { addMessage, recallMessage, removeMessage, fetchConversations, fetchFriends, setTyping } from '../store/chatSlice';
import { addPendingFriend, addPendingGroup } from '../store/notificationSlice';
import { initSocket, getStompClient } from '../utils/socket';

export const useWebSocket = () => {
    const dispatch = useDispatch();
    const { token, user } = useSelector(state => state.auth);
    const subscriptionRef = useRef(null);

    const connect = useCallback(() => {
        if (!token) return;

        const client = initSocket(token);

        const subscribe = () => {
            if (!client.connected) {
                setTimeout(subscribe, 500);
                return;
            }

            if (!subscriptionRef.current) {
                console.log('[STOMP] Subscribing to personal message queue: /user/queue/messages');
                subscriptionRef.current = client.subscribe('/user/queue/messages', (message) => {
                    const event = JSON.parse(message.body);

                    if (event.eventType === 'MESSAGE_SEND') {
                        dispatch(addMessage({
                            conversationId: event.conversationId,
                            message: event.payload
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
                    } else if (event.eventType === 'READ_RECEIPT') {
                        // Handle
                    } else if (event.eventType === 'FRIEND_REQUEST' || event.eventType === 'FRIEND_ACCEPT') {
                        const data = event.payload?.data || event.payload;
                        if (event.eventType === 'FRIEND_REQUEST') {
                            dispatch(addPendingFriend(data));
                        } else {
                            dispatch(fetchConversations());
                            dispatch(fetchFriends());
                        }
                    } else if (event.eventType === 'GROUP_INVITE') {
                        const data = event.payload?.data || event.payload;
                        dispatch(addPendingGroup(data));
                    } else if (event.eventType === 'CONVERSATION_UPDATE' || event.eventType === 'MESSAGE_PIN' || event.eventType === 'MESSAGE_UNPIN') {
                        dispatch(fetchConversations());
                    } else if (event.eventType === 'USER_TYPING') {
                        const conversationId = event.conversationId;
                        const { userId, isTyping } = event.payload;
                        dispatch(setTyping({
                            conversationId,
                            userId,
                            isTyping,
                            name: 'Ai đó'
                        }));
                    }
                });
            }
        };

        subscribe();
    }, [token, dispatch]);

    useEffect(() => {
        connect();
    }, [connect]);

    const sendMessage = useCallback((conversationId, content, type = 'TEXT', mediaUrls = [], replyToMessageId = null, forwardedFrom = null) => {
        const client = getStompClient();
        if (client && client.connected) {
            client.publish({
                destination: '/app/chat.send',
                body: JSON.stringify({
                    conversationId,
                    content,
                    type,
                    mediaUrls,
                    replyToMessageId,
                    forwardedFrom
                })
            });
        }
    }, []);

    const sendTyping = useCallback((conversationId, isTyping) => {
        const client = getStompClient();
        if (client && client.connected) {
            client.publish({
                destination: '/app/chat.typing',
                body: JSON.stringify({
                    conversationId,
                    isTyping
                })
            });
        }
    }, []);

    return { sendMessage, sendTyping };
};

export default useWebSocket;
