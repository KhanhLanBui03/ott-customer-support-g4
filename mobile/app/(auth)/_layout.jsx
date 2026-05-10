import React from 'react';
import { Stack } from 'expo-router';

/**
 * Auth Stack Layout
 * Screens: Login, Register, OTP
 */
export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animationEnabled: true,
        gestureEnabled: false, // Prevent accidental back navigation
      }}
    >
      <Stack.Screen
        name="login"
        options={{
          title: 'Sign In',
        }}
      />
      <Stack.Screen
        name="register"
        options={{
          title: 'Create Account',
          animationEnabled: true,
        }}
      />
      <Stack.Screen
        name="otp"
        options={{
          title: 'Verify OTP',
          animationEnabled: true,
        }}
      />
      <Stack.Screen
        name="forgot-password"
        options={{
          title: 'Forgot Password',
          animationEnabled: true,
        }}
      />
    </Stack>
  );
}
