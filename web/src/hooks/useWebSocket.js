import { useEffect, useCallback, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { addMessage, recallMessage, removeMessage, fetchConversations, fetchFriends, setTyping, updateUserPresence } from '../store/chatSlice';
import { addPendingFriend, addPendingGroup } from '../store/notificationSlice';
import { initSocket, getStompClient } from '../utils/socket';

// Toast notification utility - creates a temporary popup
const showToast = (message, type = 'info') => {
    // Remove existing toasts
    document.querySelectorAll('.ws-toast').forEach(el => el.remove());

    const toast = document.createElement('div');
    toast.className = 'ws-toast';
    toast.style.cssText = `
        position: fixed; top: 24px; right: 24px; z-index: 99999;
        max-width: 380px; padding: 16px 20px;
        background: ${type === 'group' ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : 'linear-gradient(135deg, #10b981, #059669)'};
        color: white; border-radius: 20px;
        font-size: 14px; font-weight: 700;
        box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        display: flex; align-items: center; gap: 12px;
        animation: toastSlideIn 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        cursor: pointer; backdrop-filter: blur(20px);
        border: 1px solid rgba(255,255,255,0.2);
    `;
    
    const icon = type === 'group' ? '👥' : '🤝';
    toast.innerHTML = `<span style="font-size:24px">${icon}</span><div><div style="font-size:11px;opacity:0.8;text-transform:uppercase;letter-spacing:2px;margin-bottom:2px">Thông báo mới</div><div>${message}</div></div>`;
    
    // Add animation keyframes if not exists
    if (!document.getElementById('toast-styles')) {
        const style = document.createElement('style');
        style.id = 'toast-styles';
        style.textContent = `
            @keyframes toastSlideIn { from { transform: translateX(120%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
            @keyframes toastSlideOut { from { transform: translateX(0); opacity: 1; } to { transform: translateX(120%); opacity: 0; } }
        `;
        document.head.appendChild(style);
    }

    toast.onclick = () => {
        toast.style.animation = 'toastSlideOut 0.3s ease-in forwards';
        setTimeout(() => toast.remove(), 300);
    };

    document.body.appendChild(toast);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (toast.parentNode) {
            toast.style.animation = 'toastSlideOut 0.3s ease-in forwards';
            setTimeout(() => toast.remove(), 300);
        }
    }, 5000);
};

export const useWebSocket = () => {
    const dispatch = useDispatch();
    const { token, user } = useSelector(state => state.auth);
    const subscriptionRef = useRef(null);

    const connect = useCallback(() => {
        if (!token) return;

        const client = initSocket(token);

        // Define subscription logic
        const performSubscribe = () => {
            console.log('[STOMP] Subscribing to personal message queue: /user/queue/messages');
            
            // Clean up old subscription just in case
            if (subscriptionRef.current) {
                try { subscriptionRef.current.unsubscribe(); } catch(e){}
            }
            
            subscriptionRef.current = client.subscribe('/user/queue/messages', (message) => {
                const event = JSON.parse(message.body);

                if (event.eventType === 'MESSAGE_SEND') {
                    dispatch(addMessage({
                        conversationId: event.conversationId,
                        message: event.payload,
                        currentUserId: user?.userId || user?.id
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
                        showToast(`${data.fullName || 'Ai đó'} đã gửi lời mời kết bạn`, 'friend');
                    } else {
                        dispatch(fetchConversations());
                        dispatch(fetchFriends());
                    }
                } else if (event.eventType === 'GROUP_INVITE') {
                    const data = event.payload?.data || event.payload;
                    dispatch(addPendingGroup(data));
                    showToast(`Bạn được mời vào nhóm "${data.groupName || 'Nhóm mới'}"`, 'group');
                } else if (event.eventType === 'MESSAGE_STATUS_UPDATE' || event.eventType === 'MESSAGE_UPDATE') {
                    // If it's a full updated message (like a vote), use updateMessage
                    const conversationId = event.conversationId;
                    const message = event.payload;
                    if (message && message.messageId) {
                        dispatch(updateMessage({ conversationId, message }));
                    } else {
                        // Otherwise standard status update
                        dispatch(updateMessageStatus({
                            conversationId: event.conversationId,
                            messageId: event.payload.messageId || event.payload,
                            status: event.payload.status
                        }));
                    }
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

            // Subscribe to global presence updates
            client.subscribe('/topic/presence', (message) => {
                try {
                    const data = JSON.parse(message.body);
                    dispatch(updateUserPresence(data));
                } catch (err) {
                    console.error('[STOMP] Failed to process presence', err);
                }
            });
        };

        // If client is already fully connected, subscribe immediately
        if (client.connected) {
            performSubscribe();
        }

        // Override onConnect to handle reconnects cleanly
        const originalOnConnect = client.onConnect;
        client.onConnect = (frame) => {
            if (originalOnConnect) originalOnConnect(frame);
            performSubscribe();
        };
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
