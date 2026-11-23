import React, { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { Provider, useDispatch, useSelector } from 'react-redux';
import * as SplashScreen from 'expo-splash-screen';
import * as SecureStore from 'expo-secure-store';
import store from '../src/store/store';
import { restoreState, sessionExpired } from '../src/store/authSlice';
import { Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { TamaguiProvider, Theme } from 'tamagui';
import tamaguiConfig from '../tamagui.config';
import { ThemeProvider, useTheme } from '../src/context/ThemeContext';
import InAppNotification from '../src/components/common/InAppNotification';
import { configureNotificationHandler } from '../src/utils/pushNotificationService';
import { useTranslation } from 'react-i18next';
import '../src/locales/i18n';

// Configure OS notification behavior early at startup
try {
  configureNotificationHandler();
} catch (e) {
  console.warn('Notification handler init skipped:', e);
}

// Keep splash screen visible while we fetch auth state
SplashScreen.preventAutoHideAsync().catch(() => {});

class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, errorMessage: String(error?.stack || error?.message || error) };
  }

  componentDidCatch(error, info) {
    console.error('[AppErrorBoundary]', error, info?.componentStack);
    SplashScreen.hideAsync().catch(() => {});
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, backgroundColor: '#050507', padding: 24, justifyContent: 'center' }}>
          <Text style={{ color: '#60A5FA', fontSize: 18, fontWeight: '800', marginBottom: 12 }}>
            F5 Chat gặp lỗi khởi chạy
          </Text>
          <ScrollView style={{ maxHeight: 360, backgroundColor: '#101013', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#2E2C2E' }}>
            <Text style={{ color: '#F2F2F2', fontSize: 12 }} selectable>
              {this.state.errorMessage}
            </Text>
          </ScrollView>
          <TouchableOpacity
            onPress={() => this.setState({ hasError: false, errorMessage: '' })}
            style={{ marginTop: 16, backgroundColor: '#3B82F6', paddingVertical: 14, borderRadius: 14, alignItems: 'center' }}
          >
            <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>Thử lại</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

function RootLayoutNav() {
  const { i18n } = useTranslation();
  const [isReady, setIsReady] = useState(false);
  const dispatch = useDispatch();
  const router = useRouter();
  const segments = useSegments();

  const { accessToken, loading: authLoading, user } = useSelector((state) => state.auth);

  // Sync translation language with user's preferred language
  useEffect(() => {
    if (user?.preferredLanguage) {
      const LANGUAGE_MAP = {
        'vie_Latn': 'vi',
        'eng_Latn': 'en',
        'zho_Hans': 'zh',
        'jpn_Jpan': 'ja',
        'kor_Hang': 'ko',
        'fra_Latn': 'fr',
      };
      const i18nCode = LANGUAGE_MAP[user.preferredLanguage];
      if (i18nCode && i18n.language !== i18nCode) {
        i18n.changeLanguage(i18nCode);
      }
    }
  }, [user?.preferredLanguage]);

  // 1. Restore State on mount
  useEffect(() => {
    const initiateApp = async () => {
      try {
        const token = await SecureStore.getItemAsync('accessToken');
        const refreshToken = await SecureStore.getItemAsync('refreshToken');
        const userJson = await SecureStore.getItemAsync('user');
        const sessionId = await SecureStore.getItemAsync('sessionId');
        
        if (token) {
          dispatch(restoreState({
            accessToken: token,
            refreshToken: refreshToken,
            user: userJson ? JSON.parse(userJson) : null,
            sessionId: sessionId
          }));
        }
      } catch (err) {
        console.error('Failed to restore token:', err);
      } finally {
        setIsReady(true);
        try {
          await SplashScreen.hideAsync();
        } catch {}
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

  const isAuthenticated = Boolean(accessToken);

  return (
    <SafeAreaProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={!isAuthenticated}>
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        </Stack.Protected>
        <Stack.Protected guard={isAuthenticated}>
          <Stack.Screen name="(main)" options={{ headerShown: false }} />
        </Stack.Protected>
      </Stack>
      {isAuthenticated ? <InAppNotification /> : null}
    </SafeAreaProvider>
  );
}

function TamaguiBridge({ children }) {
  const { isDark } = useTheme();
  const activeTheme = isDark ? 'dark' : 'light';

  return (
    <TamaguiProvider config={tamaguiConfig} defaultTheme={activeTheme}>
      <Theme name={activeTheme}>{children}</Theme>
    </TamaguiProvider>
  );
}

export default function RootLayout() {
  return (
    <AppErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <Provider store={store}>
          <ThemeProvider>
            <TamaguiBridge>
              <RootLayoutNav />
            </TamaguiBridge>
          </ThemeProvider>
        </Provider>
      </GestureHandlerRootView>
    </AppErrorBoundary>
  );
}
