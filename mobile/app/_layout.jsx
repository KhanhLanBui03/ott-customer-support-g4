import React, { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { Provider, useDispatch, useSelector } from 'react-redux';
import * as SplashScreen from 'expo-splash-screen';
import * as SecureStore from 'expo-secure-store';
import { store } from '../src/store/store';
import { restoreState } from '../src/store/authSlice';

// Keep splash screen visible while we fetch auth state
SplashScreen.preventAutoHideAsync();

function RootLayoutNav() {
  const [isReady, setIsReady] = useState(false);
  const dispatch = useDispatch();
  const accessToken = useSelector((state) => state.auth.accessToken);
  const isLoading = useSelector((state) => state.auth.loading);

  useEffect(() => {
    const initiateApp = async () => {
      try {
        // Restore state from SecureStore
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

    if (!isLoading) {
      initiateApp();
    }
  }, [isLoading, dispatch]);

  if (!isReady) {
    return null;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: accessToken ? 'fade' : 'none',
      }}
    >
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(main)" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <Provider store={store}>
      <RootLayoutNav />
    </Provider>
  );
}
