import { Platform, AppState } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { notificationApi } from '../api/userApi';

const PUSH_TOKEN_STORAGE_KEY = 'expo_push_token';
const PREF_MESSAGE_NOTIF_KEY = 'pref_message_notifications';
const PREF_SOUND_KEY = 'pref_notification_sounds';
const PREF_CALL_RINGTONE_KEY = 'pref_call_ringtone';
const PREF_NOTIFICATION_SOUND_KEY = 'pref_notification_sound';

const ANDROID_NOTIFICATION_CHANNELS = [
  { id: 'default', name: 'Thông báo F5 Chat (Mặc định)', sound: 'default' },
  { id: 'f5_notif_ding', name: 'F5 Chat - Tiếng Ting', sound: 'notif_ding.wav' },
  { id: 'f5_notif_pop', name: 'F5 Chat - Bong bóng Pop', sound: 'notif_pop.wav' },
  { id: 'f5_notif_chime', name: 'F5 Chat - Chuông gió', sound: 'notif_chime.wav' },
  { id: 'f5_notif_tri', name: 'F5 Chat - Ba âm sắc', sound: 'notif_tri.wav' },
  { id: 'f5_notif_silent', name: 'F5 Chat - Im lặng', sound: null },
];

const SOUND_TO_CHANNEL = {
  default: 'default',
  ding: 'f5_notif_ding',
  pop: 'f5_notif_pop',
  chime: 'f5_notif_chime',
  tri: 'f5_notif_tri',
  silent: 'f5_notif_silent',
};

const SOUND_TO_NATIVE_FILE = {
  default: 'default',
  ding: 'notif_ding.wav',
  pop: 'notif_pop.wav',
  chime: 'notif_chime.wav',
  tri: 'notif_tri.wav',
  silent: null,
};

let notificationPrefs = {
  messageNotifications: true,
  soundEnabled: true,
  callRingtone: 'classic',
  notificationSound: 'default',
};
let prefsLoaded = false;

export const loadNotificationPreferences = async () => {
  if (Platform.OS === 'web') {
    prefsLoaded = true;
    return { ...notificationPrefs };
  }
  try {
    const [msgVal, soundVal, ringtoneVal, notifSoundVal] = await Promise.all([
      SecureStore.getItemAsync(PREF_MESSAGE_NOTIF_KEY),
      SecureStore.getItemAsync(PREF_SOUND_KEY),
      SecureStore.getItemAsync(PREF_CALL_RINGTONE_KEY),
      SecureStore.getItemAsync(PREF_NOTIFICATION_SOUND_KEY),
    ]);
    notificationPrefs = {
      messageNotifications: msgVal === null ? true : msgVal === 'true',
      soundEnabled: soundVal === null ? true : soundVal === 'true',
      callRingtone: ringtoneVal || 'classic',
      notificationSound: notifSoundVal || 'default',
    };
  } catch (err) {
    console.warn('[PUSH] Failed to load notification preferences:', err);
  }
  prefsLoaded = true;
  return { ...notificationPrefs };
};

export const getNotificationPreferencesSync = () => ({ ...notificationPrefs });

export const updateNotificationPreferences = async (partialPrefs) => {
  if (!prefsLoaded) {
    await loadNotificationPreferences();
  }
  notificationPrefs = {
    ...notificationPrefs,
    ...partialPrefs,
  };

  if (Platform.OS !== 'web') {
    try {
      if (partialPrefs.messageNotifications !== undefined) {
        await SecureStore.setItemAsync(PREF_MESSAGE_NOTIF_KEY, String(Boolean(partialPrefs.messageNotifications)));
      }
      if (partialPrefs.soundEnabled !== undefined) {
        await SecureStore.setItemAsync(PREF_SOUND_KEY, String(Boolean(partialPrefs.soundEnabled)));
      }
      if (partialPrefs.callRingtone !== undefined) {
        await SecureStore.setItemAsync(PREF_CALL_RINGTONE_KEY, String(partialPrefs.callRingtone));
      }
      if (partialPrefs.notificationSound !== undefined) {
        await SecureStore.setItemAsync(PREF_NOTIFICATION_SOUND_KEY, String(partialPrefs.notificationSound));
      }
    } catch (err) {
      console.warn('[PUSH] Failed to save notification preferences locally:', err);
    }
  }

  try {
    const token = Platform.OS !== 'web' ? await SecureStore.getItemAsync(PUSH_TOKEN_STORAGE_KEY) : null;
    await notificationApi.updateDevicePreferences({
      token,
      notificationsEnabled: notificationPrefs.messageNotifications,
      soundEnabled: notificationPrefs.soundEnabled,
      notificationSound: notificationPrefs.notificationSound,
    });
  } catch (err) {
    console.warn('[PUSH] Failed to sync notification preferences to backend:', err?.message || err);
  }

  return { ...notificationPrefs };
};

/**
 * Configure how expo-notifications handles notifications while app is in foreground.
 * When app is active, we suppress OS alert banners so our custom InAppNotification
 * banner handles foreground UX cleanly without duplicate banners.
 */
export const configureNotificationHandler = () => {
  if (Platform.OS === 'web') return;
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => {
        const isForeground = AppState.currentState === 'active';
        const prefs = getNotificationPreferencesSync();
        if (!prefs.messageNotifications) {
          return {
            shouldShowBanner: false,
            shouldShowList: false,
            shouldPlaySound: false,
            shouldSetBadge: false,
          };
        }
        return {
          shouldShowBanner: !isForeground,
          shouldShowList: !isForeground,
          shouldPlaySound: !isForeground && prefs.soundEnabled,
          shouldSetBadge: true,
        };
      },
    });
  } catch (err) {
    console.warn('[PUSH] setNotificationHandler failed:', err?.message || err);
  }
};

export const setupAndroidNotificationChannel = async () => {
  if (Platform.OS !== 'android') return;
  for (const ch of ANDROID_NOTIFICATION_CHANNELS) {
    try {
      await Notifications.setNotificationChannelAsync(ch.id, {
        name: ch.name,
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#6366f1',
        sound: ch.sound,
        enableVibrate: true,
        showBadge: true,
      });
    } catch (err) {
      console.warn(`[PUSH] Failed to set Android notification channel ${ch.id}:`, err?.message || err);
    }
  }
};

export const registerForPushNotificationsAsync = async () => {
  if (Platform.OS === 'web') return null;

  await loadNotificationPreferences();
  await setupAndroidNotificationChannel();

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.warn('[PUSH] Notification permission not granted:', finalStatus);
      return null;
    }

    if (!Device.isDevice) {
      console.log('[PUSH] Running on emulator/simulator — remote Expo push token may be unavailable, local notifications still work.');
    }

    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ??
      Constants?.easConfig?.projectId;

    if (!projectId) {
      console.warn('[PUSH] Missing EAS projectId in app.json; cannot fetch Expo push token');
      return null;
    }

    const tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId });
    const expoPushToken = tokenResponse?.data;
    if (!expoPushToken) {
      return null;
    }

    await SecureStore.setItemAsync(PUSH_TOKEN_STORAGE_KEY, expoPushToken);

    const prefs = getNotificationPreferencesSync();
    await notificationApi.registerDeviceToken({
      token: expoPushToken,
      platform: Platform.OS.toUpperCase(),
      osVersion: String(Platform.Version ?? ''),
      deviceName: Device.modelName || Device.deviceName || Platform.OS,
      notificationsEnabled: prefs.messageNotifications,
      soundEnabled: prefs.soundEnabled,
      notificationSound: prefs.notificationSound,
    });

    console.log('[PUSH] Registered Expo Push Token:', expoPushToken);
    return expoPushToken;
  } catch (err) {
    if (!err?.isSessionExpired && err?.response?.status !== 401) {
      console.warn('[PUSH] Failed to register Expo push token:', err?.message || err);
    }
    return null;
  }
};

export const unregisterPushTokenAsync = async () => {
  if (Platform.OS === 'web') return;
  try {
    const token = await SecureStore.getItemAsync(PUSH_TOKEN_STORAGE_KEY);
    if (token) {
      try {
        await notificationApi.unregisterDeviceToken(token);
      } catch (apiErr) {
        console.warn('[PUSH] Failed to unregister token from backend:', apiErr?.message || apiErr);
      }
      await SecureStore.deleteItemAsync(PUSH_TOKEN_STORAGE_KEY);
    }
  } catch (err) {
    console.warn('[PUSH] Error cleaning up push token:', err?.message || err);
  }
};

/**
 * Fallback local notification when app is in background/inactive and WebSocket is still alive
 * (helpful on emulators or before FCM server credentials are uploaded to EAS).
 */
export const scheduleLocalNotificationAsync = async ({ title, body, data = {} }) => {
  if (Platform.OS === 'web') return;
  const prefs = getNotificationPreferencesSync();
  if (!prefs.messageNotifications) return;

  const effectiveSoundId = prefs.soundEnabled ? (prefs.notificationSound || 'default') : 'silent';
  const channelId = SOUND_TO_CHANNEL[effectiveSoundId] || 'default';
  const nativeSound = SOUND_TO_NATIVE_FILE[effectiveSoundId];

  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: title || 'F5 Chat',
        body: body || 'Bạn có thông báo mới',
        data,
        ...(nativeSound ? { sound: nativeSound } : { sound: false }),
      },
      trigger: Platform.OS === 'android' ? { channelId } : null,
    });
  } catch (err) {
    console.warn('[PUSH] Failed to schedule local notification:', err?.message || err);
  }
};

export const handleNotificationNavigation = (data, router) => {
  if (!data || !router) return;
  const type = data.type;
  if (type === 'MESSAGE' && data.conversationId) {
    router.push({
      pathname: `/chat/${encodeURIComponent(data.conversationId)}`,
      params: {
        name: data.conversationName || '',
        type: data.conversationType || 'SINGLE',
      },
    });
    return;
  }
  if (type === 'GROUP_JOIN_APPROVED' && data.conversationId) {
    router.push(`/chat/${encodeURIComponent(data.conversationId)}`);
    return;
  }
  if (type === 'FRIEND_REQUEST' || type === 'FRIEND_ACCEPTED' || type === 'FRIEND_ACCEPT' || type === 'GROUP_INVITE' || type === 'FRIEND_REJECTED' || type === 'GROUP_JOIN_REJECTED') {
    router.push('/(main)/notifications');
  }
};
