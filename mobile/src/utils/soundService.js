import { Platform } from 'react-native';
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { getNotificationPreferencesSync, loadNotificationPreferences } from './pushNotificationService';

export const RINGTONE_OPTIONS = [
  {
    id: 'classic',
    labelKey: 'settings.sound_ringtone_classic',
    fallbackLabel: 'Cổ điển (Mặc định)',
    source: require('../../assets/sounds/ringtone.wav'),
  },
  {
    id: 'melody',
    labelKey: 'settings.sound_ringtone_melody',
    fallbackLabel: 'Giai điệu Marimba',
    source: require('../../assets/sounds/ringtone_melody.wav'),
  },
  {
    id: 'chime',
    labelKey: 'settings.sound_ringtone_chime',
    fallbackLabel: 'Chuông Pha Lê',
    source: require('../../assets/sounds/ringtone_chime.wav'),
  },
  {
    id: 'pulse',
    labelKey: 'settings.sound_ringtone_pulse',
    fallbackLabel: 'Nhịp Hiện Đại',
    source: require('../../assets/sounds/ringtone_pulse.wav'),
  },
  {
    id: 'silent',
    labelKey: 'settings.sound_silent',
    fallbackLabel: 'Im lặng (Chỉ rung)',
    source: null,
  },
];

export const NOTIFICATION_SOUND_OPTIONS = [
  {
    id: 'default',
    labelKey: 'settings.sound_notif_default',
    fallbackLabel: 'Mặc định hệ thống',
    channelId: 'default',
    nativeSound: 'default',
    previewSource: require('../../assets/sounds/notif_ding.wav'),
  },
  {
    id: 'ding',
    labelKey: 'settings.sound_notif_ding',
    fallbackLabel: 'Tiếng Ting trong trẻo',
    channelId: 'f5_notif_ding',
    nativeSound: 'notif_ding.wav',
    previewSource: require('../../assets/sounds/notif_ding.wav'),
  },
  {
    id: 'pop',
    labelKey: 'settings.sound_notif_pop',
    fallbackLabel: 'Bong bóng Pop',
    channelId: 'f5_notif_pop',
    nativeSound: 'notif_pop.wav',
    previewSource: require('../../assets/sounds/notif_pop.wav'),
  },
  {
    id: 'chime',
    labelKey: 'settings.sound_notif_chime',
    fallbackLabel: 'Chuông gió dịu nhẹ',
    channelId: 'f5_notif_chime',
    nativeSound: 'notif_chime.wav',
    previewSource: require('../../assets/sounds/notif_chime.wav'),
  },
  {
    id: 'tri',
    labelKey: 'settings.sound_notif_tri',
    fallbackLabel: 'Ba âm sắc hiện đại',
    channelId: 'f5_notif_tri',
    nativeSound: 'notif_tri.wav',
    previewSource: require('../../assets/sounds/notif_tri.wav'),
  },
  {
    id: 'silent',
    labelKey: 'settings.sound_silent',
    fallbackLabel: 'Im lặng',
    channelId: 'f5_notif_silent',
    nativeSound: null,
    previewSource: null,
  },
];

export const getRingtoneOption = (id) =>
  RINGTONE_OPTIONS.find((item) => item.id === id) || RINGTONE_OPTIONS[0];

export const getNotificationSoundOption = (id) =>
  NOTIFICATION_SOUND_OPTIONS.find((item) => item.id === id) || NOTIFICATION_SOUND_OPTIONS[0];

export const getSelectedRingtoneSourceAsync = async () => {
  const prefs = await loadNotificationPreferences();
  const option = getRingtoneOption(prefs.callRingtone);
  return option.source;
};

let activePreviewPlayer = null;
let previewStopTimer = null;

export const stopSoundPreview = () => {
  if (previewStopTimer) {
    clearTimeout(previewStopTimer);
    previewStopTimer = null;
  }
  if (activePreviewPlayer) {
    try { activePreviewPlayer.pause(); } catch {}
    try { activePreviewPlayer.remove(); } catch {}
    activePreviewPlayer = null;
  }
};

export const playSoundPreview = async (source, { durationMs = 3500, loop = false } = {}) => {
  stopSoundPreview();
  if (!source || Platform.OS === 'web') return;

  try {
    await setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: false,
      interruptionMode: 'duckOthers',
      allowsRecording: false,
      shouldRouteThroughEarpiece: false,
    });

    const player = createAudioPlayer(source);
    player.loop = loop;
    player.volume = 1.0;
    player.play();
    activePreviewPlayer = player;

    previewStopTimer = setTimeout(() => {
      if (activePreviewPlayer === player) {
        stopSoundPreview();
      }
    }, durationMs);
  } catch (err) {
    console.warn('[SOUND] Preview playback failed:', err?.message || err);
  }
};

let lastNotifPlayedAt = 0;

export const playInAppNotificationSound = async () => {
  if (Platform.OS === 'web') return;
  const prefs = getNotificationPreferencesSync();
  if (!prefs.messageNotifications || !prefs.soundEnabled) return;

  const option = getNotificationSoundOption(prefs.notificationSound);
  if (!option || option.id === 'silent' || !option.previewSource) return;

  const now = Date.now();
  if (now - lastNotifPlayedAt < 700) return;
  lastNotifPlayedAt = now;

  try {
    await setAudioModeAsync({
      playsInSilentMode: false,
      shouldPlayInBackground: false,
      interruptionMode: 'mixWithOthers',
      allowsRecording: false,
      shouldRouteThroughEarpiece: false,
    });

    const player = createAudioPlayer(option.previewSource);
    player.loop = false;
    player.volume = 0.85;
    player.play();

    setTimeout(() => {
      try { player.pause(); } catch {}
      try { player.remove(); } catch {}
    }, 2000);
  } catch (err) {
    console.warn('[SOUND] Failed to play in-app notification sound:', err?.message || err);
  }
};
