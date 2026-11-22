import React, { useEffect, useState, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  PermissionsAndroid,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { Camera } from 'expo-camera';
import {
  getRecordingPermissionsAsync,
  requestRecordingPermissionsAsync,
} from 'expo-audio';
import { useTheme } from '../../context/ThemeContext';

const PERMISSION_ONBOARDING_KEY = 'f5chat_media_permissions_prompted_v1';

const checkMediaPermissions = async () => {
  try {
    if (Platform.OS === 'android') {
      const mic = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
      const cam = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.CAMERA);
      return { mic, cam };
    }
    const [micRes, camRes] = await Promise.all([
      getRecordingPermissionsAsync().catch(() => ({ granted: false })),
      Camera.getCameraPermissionsAsync().catch(() => ({ granted: false })),
    ]);
    return {
      mic: Boolean(micRes?.granted || micRes?.status === 'granted'),
      cam: Boolean(camRes?.granted || camRes?.status === 'granted'),
    };
  } catch {
    return { mic: false, cam: false };
  }
};

const requestAllMediaPermissions = async () => {
  let micGranted = false;
  let camGranted = false;
  let permanentlyDenied = false;

  try {
    if (Platform.OS === 'android') {
      const results = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        PermissionsAndroid.PERMISSIONS.CAMERA,
      ]);
      const micResult = results[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO];
      const camResult = results[PermissionsAndroid.PERMISSIONS.CAMERA];

      micGranted = micResult === PermissionsAndroid.RESULTS.GRANTED;
      camGranted = camResult === PermissionsAndroid.RESULTS.GRANTED;
      permanentlyDenied =
        micResult === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN ||
        camResult === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN;
    } else {
      const micAudioRes = await requestRecordingPermissionsAsync().catch(() => ({ granted: false }));
      const micCamRes = await Camera.requestMicrophonePermissionsAsync().catch(() => ({ granted: false }));
      const camRes = await Camera.requestCameraPermissionsAsync().catch(() => ({ granted: false }));

      micGranted = Boolean(
        micAudioRes?.granted ||
        micAudioRes?.status === 'granted' ||
        micCamRes?.granted ||
        micCamRes?.status === 'granted'
      );
      camGranted = Boolean(camRes?.granted || camRes?.status === 'granted');
      permanentlyDenied =
        (!micGranted && micAudioRes?.canAskAgain === false) ||
        (!camGranted && camRes?.canAskAgain === false);
    }
  } catch (e) {
    console.warn('[MediaPermissionOnboarding] Request error:', e);
  }

  return { mic: micGranted, cam: camGranted, permanentlyDenied };
};

const MediaPermissionOnboardingModal = ({ isAuthenticated }) => {
  const { colors, isDark } = useTheme();
  const [visible, setVisible] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [status, setStatus] = useState({ mic: false, cam: false });
  const [needsSettings, setNeedsSettings] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;

    const timer = setTimeout(async () => {
      try {
        const current = await checkMediaPermissions();
        if (cancelled) return;
        setStatus(current);

        // Nếu cả 2 quyền đều đã được cấp rồi thì lưu cờ và không làm phiền người dùng
        if (current.mic && current.cam) {
          await SecureStore.setItemAsync(PERMISSION_ONBOARDING_KEY, 'granted').catch(() => {});
          return;
        }

        const promptedBefore = await SecureStore.getItemAsync(PERMISSION_ONBOARDING_KEY);
        if (!promptedBefore && !cancelled) {
          setVisible(true);
        }
      } catch (e) {
        console.warn('[MediaPermissionOnboarding] Check error:', e);
      }
    }, 700);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [isAuthenticated]);

  const handleDismiss = useCallback(async () => {
    setVisible(false);
    await SecureStore.setItemAsync(PERMISSION_ONBOARDING_KEY, 'dismissed').catch(() => {});
  }, []);

  const handleGrant = useCallback(async () => {
    if (requesting) return;
    setRequesting(true);
    try {
      const result = await requestAllMediaPermissions();
      setStatus({ mic: result.mic, cam: result.cam });

      if (result.mic && result.cam) {
        await SecureStore.setItemAsync(PERMISSION_ONBOARDING_KEY, 'granted').catch(() => {});
        setVisible(false);
      } else if (result.permanentlyDenied) {
        setNeedsSettings(true);
      } else {
        setNeedsSettings(true);
      }
    } finally {
      setRequesting(false);
    }
  }, [requesting]);

  const handleOpenSettings = useCallback(async () => {
    await SecureStore.setItemAsync(PERMISSION_ONBOARDING_KEY, 'settings_opened').catch(() => {});
    setVisible(false);
    Linking.openSettings().catch(() => {});
  }, []);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={handleDismiss}
    >
      {visible ? (
        <View style={styles.backdrop}>
          <View
            style={[
              styles.card,
              {
                backgroundColor: isDark ? '#111827' : '#ffffff',
                borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(15,23,42,0.08)',
              },
            ]}
          >
            <View style={styles.heroIconWrap}>
              <View style={styles.heroIconBg}>
                <Ionicons name="videocam" size={28} color="#ffffff" />
              </View>
              <View style={styles.heroBadge}>
                <MaterialCommunityIcons name="microphone" size={14} color="#ffffff" />
              </View>
            </View>

            <Text style={[styles.title, { color: colors.foreground }]}>
              Cấp quyền Micro & Camera
            </Text>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>
              Cho phép F5 Chat sử dụng micro và máy ảnh để bạn có thể gọi thoại, gọi video và gửi tin nhắn thoại ngay lập tức.
            </Text>

            <View style={styles.permissionList}>
              <View
                style={[
                  styles.permissionRow,
                  {
                    backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#f8fafc',
                    borderColor: isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0',
                  },
                ]}
              >
                <View style={[styles.rowIcon, { backgroundColor: 'rgba(99, 102, 241, 0.14)' }]}>
                  <Ionicons name="mic" size={20} color="#6366f1" />
                </View>
                <View style={styles.rowTextWrap}>
                  <Text style={[styles.rowTitle, { color: colors.foreground }]}>Micro (Âm thanh)</Text>
                  <Text style={[styles.rowDesc, { color: colors.textSubtle }]}>
                    Nghe nói hai chiều khi gọi điện và ghi âm tin nhắn thoại
                  </Text>
                </View>
                <View style={[styles.stateChip, status.mic ? styles.chipGranted : styles.chipPending]}>
                  <Ionicons
                    name={status.mic ? 'checkmark' : 'alert-circle-outline'}
                    size={14}
                    color={status.mic ? '#10b981' : '#f59e0b'}
                  />
                </View>
              </View>

              <View
                style={[
                  styles.permissionRow,
                  {
                    backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#f8fafc',
                    borderColor: isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0',
                  },
                ]}
              >
                <View style={[styles.rowIcon, { backgroundColor: 'rgba(14, 165, 233, 0.14)' }]}>
                  <Ionicons name="videocam" size={20} color="#0ea5e9" />
                </View>
                <View style={styles.rowTextWrap}>
                  <Text style={[styles.rowTitle, { color: colors.foreground }]}>Camera (Máy ảnh)</Text>
                  <Text style={[styles.rowDesc, { color: colors.textSubtle }]}>
                    Hiển thị hình ảnh khi gọi video, chụp ảnh và quét mã QR
                  </Text>
                </View>
                <View style={[styles.stateChip, status.cam ? styles.chipGranted : styles.chipPending]}>
                  <Ionicons
                    name={status.cam ? 'checkmark' : 'alert-circle-outline'}
                    size={14}
                    color={status.cam ? '#10b981' : '#f59e0b'}
                  />
                </View>
              </View>
            </View>

            {needsSettings && (
              <View style={styles.settingsHint}>
                <Ionicons name="information-circle-outline" size={16} color="#f59e0b" />
                <Text style={[styles.settingsHintText, { color: isDark ? '#fde68a' : '#92400e' }]}>
                  Thiết bị đang tắt quyền Micro hoặc Camera. Hãy mở Cài đặt để bật cho ứng dụng.
                </Text>
              </View>
            )}

            <View style={styles.actions}>
              {needsSettings ? (
                <TouchableOpacity
                  style={styles.primaryBtn}
                  onPress={handleOpenSettings}
                  activeOpacity={0.85}
                >
                  <Ionicons name="settings-outline" size={18} color="#ffffff" />
                  <Text style={styles.primaryBtnText}>Mở Cài đặt thiết bị</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.primaryBtn, requesting && styles.primaryBtnDisabled]}
                  onPress={handleGrant}
                  disabled={requesting}
                  activeOpacity={0.85}
                >
                  {requesting ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <>
                      <Ionicons name="shield-checkmark-outline" size={18} color="#ffffff" />
                      <Text style={styles.primaryBtnText}>Cho phép Micro & Camera</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[
                  styles.secondaryBtn,
                  { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#f1f5f9' },
                ]}
                onPress={handleDismiss}
                activeOpacity={0.75}
              >
                <Text style={[styles.secondaryBtnText, { color: colors.textMuted }]}>Để sau</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      ) : null}
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 28,
    padding: 24,
    borderWidth: 1,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 16,
  },
  heroIconWrap: {
    width: 68,
    height: 68,
    marginBottom: 16,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroIconBg: {
    width: 64,
    height: 64,
    borderRadius: 22,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  heroBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#10b981',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2.5,
    borderColor: '#111827',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  permissionList: {
    width: '100%',
    gap: 10,
    marginBottom: 18,
  },
  permissionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rowTextWrap: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  rowDesc: {
    fontSize: 12,
    lineHeight: 16,
  },
  stateChip: {
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chipGranted: {
    backgroundColor: 'rgba(16, 185, 129, 0.14)',
  },
  chipPending: {
    backgroundColor: 'rgba(245, 158, 11, 0.14)',
  },
  settingsHint: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.28)',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
  },
  settingsHintText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
  },
  actions: {
    width: '100%',
    gap: 10,
  },
  primaryBtn: {
    height: 50,
    borderRadius: 16,
    backgroundColor: '#6366f1',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  primaryBtnDisabled: {
    opacity: 0.7,
  },
  primaryBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryBtn: {
    height: 46,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
});

export default MediaPermissionOnboardingModal;
