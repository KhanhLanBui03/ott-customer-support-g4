import { TurboModuleRegistry, NativeModules } from 'react-native';

let cachedAvailability = null;
let cachedSdk = null;

/**
 * Kiểm tra an toàn xem binary hiện tại có chứa Agora Native SDK hay không.
 * - Development Build / APK / IPA: trả về true (TurboModule 'AgoraRtcNg' tồn tại).
 * - Expo Go: trả về false (không gọi require('react-native-agora') để tránh lỗi getEnforcing).
 */
export const isNativeAgoraAvailable = () => {
  if (cachedAvailability !== null) return cachedAvailability;
  try {
    const turbo = TurboModuleRegistry?.get?.('AgoraRtcNg');
    const legacy = NativeModules?.AgoraRtcNg;
    cachedAvailability = Boolean(turbo || legacy);
  } catch {
    cachedAvailability = false;
  }
  return cachedAvailability;
};

export const getAgoraNativeSdk = () => {
  if (!isNativeAgoraAvailable()) return null;
  if (cachedSdk) return cachedSdk;
  try {
    // Lazy require chỉ khi native module thực sự có mặt trong binary
    cachedSdk = require('react-native-agora');
    return cachedSdk;
  } catch (e) {
    console.warn('[AgoraNative] Failed to load react-native-agora:', e);
    cachedAvailability = false;
    return null;
  }
};
