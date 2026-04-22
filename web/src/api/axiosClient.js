import axios from 'axios';
import { clearAuthValues, getAuthValue } from '../utils/storage';

const clearAuthStorage = () => {
  clearAuthValues();
};

const axiosClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

axiosClient.interceptors.request.use(
  (config) => {
    const token = getAuthValue('token');
    const userRaw = getAuthValue('user');
    const sessionId = getAuthValue('sessionId');
    const userId = userRaw ? JSON.parse(userRaw)?.id : null;

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    if (sessionId) {
      config.headers['X-Session-Id'] = sessionId;
    }
    if (userId) {
      config.headers['X-User-Id'] = userId;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

axiosClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401) {
      const isPublicEndpoint =
        originalRequest?.url?.includes('/auth/login') ||
        originalRequest?.url?.includes('/auth/register') ||
        originalRequest?.url?.includes('/auth/verify-otp') ||
        originalRequest?.url?.includes('/auth/check') ||
        originalRequest?.url?.includes('/auth/send-otp') ||
        originalRequest?.url?.includes('/auth/forgot-password') ||
        originalRequest?.url?.includes('/auth/reset-password');

      if (isPublicEndpoint) {
        return Promise.reject(error);
      }
      clearAuthStorage();
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default axiosClient;
