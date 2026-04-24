import React, { useEffect } from 'react';
import { Tabs } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { Platform } from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { initializeSocket, disconnectSocket } from '../../src/utils/socket';
import { addMessage, setCurrentUserId } from '../../src/store/chatSlice';

export default function MainLayout() {
  const { accessToken, user } = useSelector((state) => state.auth);
  const dispatch = useDispatch();

  useEffect(() => {
    if (accessToken && (user?.userId || user?.id)) {
      const myId = user.userId || user.id;
      // Đảm bảo Store biết ID của mình TRƯỚC KHI socket chạy
      dispatch(setCurrentUserId(String(myId)));

      // KÍCH HOẠT SOCKET: Đây là phần quan trọng nhất để nhận tin nhắn từ Web
      initializeSocket(accessToken, myId, (event) => {
        const { eventType, conversationId, payload } = event;
        if (eventType === 'MESSAGE_SEND') {
          dispatch(addMessage({ conversationId, message: payload, myId }));
        }
      });
    }
    return () => disconnectSocket();
  }, [accessToken, user?.userId]);

  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: '#667eea',
      tabBarStyle: { height: Platform.OS === 'ios' ? 88 : 56 },
    }}>
      <Tabs.Screen name="index" options={{ title: 'Chats', tabBarIcon: ({ color, size }) => <MaterialIcons name="message" size={size} color={color} /> }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: ({ color, size }) => <MaterialIcons name="person" size={size} color={color} /> }} />
      <Tabs.Screen name="edit-profile" options={{ href: null }} />
      <Tabs.Screen name="change-password" options={{ href: null }} />
      <Tabs.Screen name="chat/[id]" options={{ href: null }} />
      <Tabs.Screen name="chat-info/[id]" options={{ href: null }} />
    </Tabs>
  );
}
