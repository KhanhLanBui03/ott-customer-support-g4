import React, { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { Provider, useDispatch, useSelector } from 'react-redux';
import * as SplashScreen from 'expo-splash-screen';
import * as SecureStore from 'expo-secure-store';
import store from '../src/store/store';
import { restoreState, sessionExpired } from '../src/store/authSlice';
import { Alert } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import InAppNotification from '../src/components/common/InAppNotification';

// Keep splash screen visible while we fetch auth state
SplashScreen.preventAutoHideAsync();

function RootLayoutNav() {
  const [isReady, setIsReady] = useState(false);
  const dispatch = useDispatch();
  const router = useRouter();
  const segments = useSegments();

  const { accessToken, loading: authLoading } = useSelector((state) => state.auth);

  // 1. Restore State on mount
  useEffect(() => {
    const initiateApp = async () => {
      try {
        const token = await SecureStore.getItemAsync('accessToken');
        const refreshToken = await SecureStore.getItemAsync('refreshToken');
        const userJson = await SecureStore.getItemAsync('user');
        
        if (token) {
          dispatch(restoreState({
            accessToken: token,
            refreshToken: refreshToken,
            user: userJson ? JSON.parse(userJson) : null
          }));
        }
      } catch (err) {
        console.error('Failed to restore token:', err);
      } finally {
        setIsReady(true);
        await SplashScreen.hideAsync();
      }
    };

    initiateApp();
  }, [dispatch]);

  // 2. Handle Redirects based on Auth State
  useEffect(() => {
    if (!isReady) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!accessToken && !inAuthGroup) {
      // Not logged in and trying to access main app -> Redirect to login
      router.replace('/(auth)/login');
    } else if (accessToken && inAuthGroup) {
      // Logged in and trying to access auth screens -> Redirect to home
      router.replace('/(main)');
    }
  }, [accessToken, isReady, segments]);

  if (!isReady) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <InAppNotification />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(main)" options={{ headerShown: false }} />
      </Stack>
    </SafeAreaProvider>
  );
}

export default function RootLayout() {
  return (
    <Provider store={store}>
      <RootLayoutNav />
    </Provider>
  );
}
