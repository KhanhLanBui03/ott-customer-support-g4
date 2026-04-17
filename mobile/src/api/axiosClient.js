import axios from 'axios';
import * as SecureStore from 'expo-secure-store'; // For mobile (optional for web - use localStorage)
import CONFIG from '../config';

const API_BASE_URL = CONFIG.API_URL;

/**
 * Axios client with interceptors for JWT token management
 * Works for both Web (localStorage) and Mobile (SecureStore)
 */
const axiosClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: CONFIG.API_TIMEOUT,
});

// ==================== Request Interceptor ====================
axiosClient.interceptors.request.use(
  async (config) => {
    try {
      // Get token from localStorage (Web) or SecureStore (Mobile)
      let token;
      if (typeof window !== 'undefined' && window.localStorage) {
        // Web (Browser) environment
        token = localStorage.getItem('accessToken');
      } else {
        // Mobile (React Native) environment - using SecureStore
        try {
          token = await SecureStore.getItemAsync('accessToken');
        } catch (error) {
          console.warn('Failed to get token from SecureStore:', error);
        }
      }

      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.error('Error in request interceptor:', error);
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// ==================== Response Interceptor ====================
axiosClient.interceptors.response.use(
  (response) => {
    // Success response
    return response.data;
  },
  async (error) => {
    const originalRequest = error.config;

    // Handle 401 Unauthorized
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const isWeb = typeof window !== 'undefined' && typeof localStorage !== 'undefined';
        const refreshToken = isWeb
          ? localStorage.getItem('refreshToken')
          : await SecureStore.getItemAsync('refreshToken');

        if (!refreshToken) {
          // No refresh token - redirect to login
          if (typeof window !== 'undefined') {
            window.location.href = '/login';
          }
          return Promise.reject(error);
        }

        // Try to refresh token
        const response = await axios.post(`${API_BASE_URL}/auth/refresh-token`, {
          refreshToken,
        });

        const { accessToken, refreshToken: newRefreshToken } = response.data.data;

        // Save new tokens
        if (typeof window !== 'undefined' && window.localStorage) {
          localStorage.setItem('accessToken', accessToken);
          localStorage.setItem('refreshToken', newRefreshToken);
        } else {
          await SecureStore.setItemAsync?.('accessToken', accessToken);
          await SecureStore.setItemAsync?.('refreshToken', newRefreshToken);
        }

        // Retry original request with new token
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return axiosClient(originalRequest);
      } catch (refreshError) {
        console.error('Token refresh failed:', refreshError);
        // Clear tokens and redirect to login
        if (typeof window !== 'undefined' && window.localStorage) {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          localStorage.removeItem('user');
          window.location.href = '/login';
        }
        return Promise.reject(refreshError);
      }
    }

    // Handle 403 Forbidden
    if (error.response?.status === 403) {
      console.error('Access forbidden:', error.response.data);
      return Promise.reject(error);
    }

    // Handle 404 Not Found
    if (error.response?.status === 404) {
      console.error('Resource not found:', error.response.data);
      return Promise.reject(error);
    }

    // Handle 429 Too Many Requests (Rate Limiting)
    if (error.response?.status === 429) {
      console.error('Rate limited. Please try again later.');
      return Promise.reject(error);
    }

    // Handle 500 Server Error
    if (error.response?.status >= 500) {
      console.error('Server error:', error.response.data);
      return Promise.reject(error);
    }

    // Network error or timeout
    if (!error.response) {
      console.error('Network error or timeout:', error.message);
      return Promise.reject(new Error('Network error. Please check your connection.'));
    }

    return Promise.reject(error);
  }
);

export default axiosClient;
