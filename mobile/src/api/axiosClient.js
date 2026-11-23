import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { Alert } from 'react-native';
import CONFIG from '../config';

// Sử dụng biến môi trường từ Expo (có fallback an toàn qua CONFIG)
const API_BASE_URL = CONFIG.API_URL;

const PUBLIC_AUTH_PATHS = [
  '/auth/login',
  '/auth/register',
  '/auth/verify-otp',
  '/auth/resend-otp',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/send-otp',
  '/auth/check',
  '/auth/refresh-token',
];

const isPublicAuthRequest = (url = '') =>
  PUBLIC_AUTH_PATHS.some((path) => String(url).includes(path));

const axiosClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 60000, // Tăng lên 60s để hỗ trợ upload nhiều ảnh/file lớn
});

// Interceptor cho Request: Luôn đính kèm Token, Session ID và User ID mới nhất
axiosClient.interceptors.request.use(
  async (config) => {
    try {
      const token = await SecureStore.getItemAsync('accessToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }

      const sessionId = await SecureStore.getItemAsync('sessionId');
      if (sessionId) {
        config.headers['X-Session-Id'] = sessionId;
      }

      const userRaw = await SecureStore.getItemAsync('user');
      if (userRaw) {
        try {
          const userObj = JSON.parse(userRaw);
          const userId = userObj?.userId || userObj?.id;
          if (userId) {
            config.headers['X-User-Id'] = userId;
          }
        } catch (e) {
          console.error('Error parsing user object in request interceptor:', e);
        }
      }
    } catch (error) {
      console.error('Request Interceptor Error:', error);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

let store;

export const injectStore = (_store) => {
  store = _store;
};

let isUnauthorizedAlertShowing = false;
let refreshPromise = null;

const clearAuthAndExpireSession = async () => {
  const hadAuth = Boolean(store?.getState?.()?.auth?.accessToken);
  await Promise.allSettled([
    SecureStore.deleteItemAsync('accessToken'),
    SecureStore.deleteItemAsync('refreshToken'),
    SecureStore.deleteItemAsync('sessionId'),
    SecureStore.deleteItemAsync('user'),
  ]);

  if (store && hadAuth && !isUnauthorizedAlertShowing) {
    isUnauthorizedAlertShowing = true;
    store.dispatch({ type: 'auth/sessionExpired' });
    Alert.alert(
      'Phiên đăng nhập hết hạn',
      'Vui lòng đăng nhập lại để tiếp tục.',
      [{
        text: 'OK',
        onPress: () => { isUnauthorizedAlertShowing = false; },
      }]
    );
  }
};

const performSingleFlightRefresh = () => {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const refreshToken = await SecureStore.getItemAsync('refreshToken');
      if (!refreshToken) {
        throw new Error('No refresh token');
      }

      const res = await axios.post(`${API_BASE_URL}/auth/refresh-token`, {
        refreshToken,
        deviceId: 'mobile-device',
      });

      const data = res.data?.data || res.data || {};
      const { accessToken, refreshToken: newRefreshToken, sessionId: newSessionId } = data;
      if (!accessToken) {
        throw new Error('Refresh response missing accessToken');
      }

      await SecureStore.setItemAsync('accessToken', accessToken);
      if (newRefreshToken) {
        await SecureStore.setItemAsync('refreshToken', newRefreshToken);
      }
      if (newSessionId) {
        await SecureStore.setItemAsync('sessionId', newSessionId);
      }

      return { accessToken, refreshToken: newRefreshToken, sessionId: newSessionId };
    })().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
};

// Interceptor cho Response: Xử lý bóc tách dữ liệu và lỗi 401 (gom 1 request refresh duy nhất)
axiosClient.interceptors.response.use(
  (response) => {
    return response.data;
  },
  async (error) => {
    const originalRequest = error.config;
    const status = error.response?.status;

    if (status === 401 && originalRequest && !isPublicAuthRequest(originalRequest.url)) {
      if (!originalRequest._retry) {
        originalRequest._retry = true;

        try {
          const { accessToken, sessionId } = await performSingleFlightRefresh();
          originalRequest.headers = originalRequest.headers || {};
          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          if (sessionId) {
            originalRequest.headers['X-Session-Id'] = sessionId;
          }
          return axiosClient(originalRequest);
        } catch (refreshError) {
          await clearAuthAndExpireSession();
          const expiredError = new Error('Session expired');
          expiredError.isSessionExpired = true;
          expiredError.status = 401;
          expiredError.cause = refreshError;
          return Promise.reject(expiredError);
        }
      }

      await clearAuthAndExpireSession();
      error.isSessionExpired = true;
    }

    return Promise.reject(error);
  }
);

export default axiosClient;
