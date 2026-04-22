import { Client } from '@stomp/stompjs';
import CONFIG from '../config';
import 'text-encoding';

let stompClient = null;

export const initializeSocket = (token, userId, onMessageReceived) => {
  if (stompClient && stompClient.connected) {
    return stompClient;
  }

  const baseUrl = CONFIG.API_URL.split('/api')[0];
  const socketUrl = baseUrl.replace('http', 'ws') + '/ws/mobile';

  console.log('🔌 Connecting to Dedicated Mobile WebSocket:', socketUrl);

  stompClient = new Client({
    brokerURL: socketUrl,
    connectHeaders: { Authorization: `Bearer ${token}` },
    forceBinaryWSFrames: true,
    appendMissingNULLonIncoming: true,
    reconnectDelay: 5000,
    heartbeatIncoming: 4000,
    heartbeatOutgoing: 4000,

    onConnect: (frame) => {
      console.log('✅ STOMP Connected Successfully');
      stompClient.subscribe(`/user/${userId}/queue/messages`, (message) => {
        try {
          const data = JSON.parse(message.body);
          if (onMessageReceived) onMessageReceived(data);
        } catch (e) {
          console.error('Error parsing message body:', e);
        }
      });
    },
    onStompError: (frame) => console.error('❌ STOMP error:', frame.headers['message']),
  });

  stompClient.activate();
  return stompClient;
};

// HÀM MỚI: Gửi tin nhắn qua Socket để Web nhận được ngay
export const sendMessageViaSocket = (messageData) => {
  if (stompClient && stompClient.connected) {
    stompClient.publish({
      destination: '/app/chat.send', // Phải khớp với @MessageMapping trên Backend
      body: JSON.stringify(messageData),
    });
    return true;
  }
  return false;
};

export const disconnectSocket = () => {
  if (stompClient) {
    stompClient.deactivate();
    stompClient = null;
  }
};

export default { initializeSocket, disconnectSocket, sendMessageViaSocket };
