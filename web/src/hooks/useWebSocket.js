import { useEffect, useCallback, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { addMessage, recallMessage, removeMessage, fetchConversations } from '../store/chatSlice';
import { addPendingFriend, addPendingGroup } from '../store/notificationSlice';
import { logout as authLogout } from '../store/authSlice';
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
          console.log('[STOMP] RAW Message Body:', message.body);
          const event = JSON.parse(message.body);
          console.log('[STOMP] Parsed Event:', event);
          
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
            // Handle read receipt if needed
          } else if (event.eventType === 'FRIEND_REQUEST' || event.eventType === 'FRIEND_ACCEPT') {
            console.log('[STOMP] Processing FRIEND event:', event.eventType);
            const data = event.payload?.data || event.payload; 
            if (event.eventType === 'FRIEND_REQUEST') {
                dispatch(addPendingFriend(data));
            } else {
                dispatch(fetchConversations());
            }
          } else if (event.eventType === 'FORCE_LOGOUT') {
            console.log('[STOMP] Force logout received:', event);
            dispatch(authLogout());
            window.location.href = '/login';
          } else if (event.eventType === 'GROUP_INVITE') {
            const data = event.payload?.data || event.payload; 
            console.log('[STOMP] Processing GROUP INVITE:', data);
            dispatch(addPendingGroup(data));
          } else if (event.eventType === 'CONVERSATION_UPDATE' || event.eventType === 'MESSAGE_PIN' || event.eventType === 'MESSAGE_UNPIN') {
            dispatch(fetchConversations());
          }
        });
      }
    };
    
    subscribe();
  }, [token, dispatch]);

  useEffect(() => {
    connect();
  }, [connect]);

  const sendMessage = useCallback((conversationId, content, type = 'TEXT', mediaUrls = []) => {
    const client = getStompClient();
    if (client && client.connected) {
      console.log('[STOMP] Sending message to /app/chat.send');
      client.publish({
        destination: '/app/chat.send',
        body: JSON.stringify({
          conversationId,
          content,
          type,
          mediaUrls
        })
      });
    } else {
      console.warn('[STOMP] Cannot send message: not connected');
    }
  }, []);

  return { sendMessage };
};

export default useWebSocket;
