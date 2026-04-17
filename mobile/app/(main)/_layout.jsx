import React from 'react';
import { Tabs } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { Platform } from 'react-native';

/**
 * Main App Navigation with Expo Router Tabs
 */
export default function MainLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#667eea',
        tabBarInactiveTintColor: '#9ca3af',
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopWidth: 1,
          borderTopColor: '#e5e7eb',
          paddingBottom: Platform.OS === 'ios' ? 24 : 8,
          paddingTop: 8,
          height: Platform.OS === 'ios' ? 88 : 56,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Chats',
          tabBarIcon: ({ focused, color, size }) => (
            <MaterialIcons 
              name={focused ? 'message' : 'message'} 
              size={size} 
              color={color} 
              style={{ opacity: focused ? 1 : 0.6 }}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ focused, color, size }) => (
            <MaterialIcons 
              name={focused ? 'person' : 'person'} 
              size={size} 
              color={color} 
              style={{ opacity: focused ? 1 : 0.6 }}
            />
          ),
        }}
      />
      {/* 
        The [id] route is automatically handled by expo-router. 
        We hide it from the tab bar.
      */}
      <Tabs.Screen
        name="chat/[id]"
        options={{
          href: null, // Hide from tab bar
        }}
      />
    </Tabs>
  );
}
