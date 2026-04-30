import React, { useEffect } from 'react';
import { Tabs } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { Platform } from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { initializeSocket, disconnectSocket } from '../../src/utils/socket';
import { addMessage, setCurrentUserId } from '../../src/store/chatSlice';
import { addNotification } from '../../src/store/notificationSlice';

export default function MainLayout() {
  const { accessToken, user } = useSelector((state) => state.auth);
  const dispatch = useDispatch();

  useEffect(() => {
    if (accessToken && (user?.userId || user?.id)) {
      const myId = user.userId || user.id;
      // Đảm bảo Store biết ID của mình TRƯỚC KHI socket chạy
      dispatch(setCurrentUserId(String(myId)));

      // KÍCH HOẠT SOCKET
      initializeSocket(accessToken, myId, (event) => {
        const { eventType, conversationId, payload } = event;

        if (eventType === 'MESSAGE_SEND') {
          dispatch(addMessage({ conversationId, message: payload, myId }));
        } else if (eventType === 'NOTIFICATION' || eventType === 'FRIEND_REQUEST' || eventType === 'FRIEND_ACCEPT') {
          // Chuẩn hóa payload cho FRIEND_REQUEST
          let finalPayload = payload;
          if (eventType === 'FRIEND_REQUEST') {
            finalPayload = {
              id: `fr_${Date.now()}`,
              title: 'Lời mời kết bạn',
              message: payload.fullName || 'Ai đó', // Sẽ dùng trường này để in đậm riêng trong UI
              subMessage: 'muốn kết bạn với bạn',
              type: 'FRIEND_REQUEST',
              senderId: payload.userId,
              avatarUrl: payload.avatarUrl,
              fullName: payload.fullName,
              createdAt: new Date().toISOString(),
              isRead: false
            };
          } else if (eventType === 'FRIEND_ACCEPT') {
            finalPayload = {
              id: `fa_${Date.now()}`,
              title: 'Chấp nhận kết bạn',
              message: payload.fullName || 'Ai đó',
              subMessage: 'đã chấp nhận lời mời kết bạn',
              type: 'FRIEND_ACCEPT',
              senderId: payload.userId,
              avatarUrl: payload.avatarUrl,
              fullName: payload.fullName,
              createdAt: new Date().toISOString(),
              isRead: false
            };
          }
          dispatch(addNotification(finalPayload));
        }
      });
    }
    return () => disconnectSocket();
  }, [accessToken, user?.userId]);

  const { unreadCount } = useSelector((state) => state.notifications);

  // Logic hiển thị badge: 1-5 hiện số, >5 hiện 5+
  const badgeValue = unreadCount > 0 ? (unreadCount > 5 ? '5+' : unreadCount) : null;

  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: '#667eea',
      tabBarStyle: {
        height: Platform.OS === 'ios' ? 88 : 65,
        paddingBottom: Platform.OS === 'ios' ? 30 : 10,
        paddingTop: 10,
      },
      tabBarLabelStyle: {
        fontSize: 12,
        fontWeight: '500',
      }
    }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Tin nhắn',
          tabBarIcon: ({ color, size }) => <MaterialIcons name="message" size={size} color={color} />
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: 'Thông báo',
          tabBarIcon: ({ color, size }) => <MaterialIcons name="notifications" size={size} color={color} />,
          tabBarBadge: badgeValue,
          tabBarBadgeStyle: {
            backgroundColor: '#ef4444',
            color: '#fff',
            fontSize: 10,
            lineHeight: 15,
          }
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Cá nhân',
          tabBarIcon: ({ color, size }) => <MaterialIcons name="person" size={size} color={color} />
        }}
      />
      <Tabs.Screen name="edit-profile" options={{ href: null, tabBarStyle: { display: 'none' } }} />
      <Tabs.Screen name="change-password" options={{ href: null, tabBarStyle: { display: 'none' } }} />
      <Tabs.Screen name="chat/[id]" options={{ href: null, tabBarStyle: { display: 'none' } }} />
      <Tabs.Screen name="chat-info/[id]" options={{ href: null, tabBarStyle: { display: 'none' } }} />
      <Tabs.Screen name="shared-media/[id]" options={{ href: null, tabBarStyle: { display: 'none' } }} />
      <Tabs.Screen name="shared-files/[id]" options={{ href: null, tabBarStyle: { display: 'none' } }} />
    </Tabs>
  );
}
