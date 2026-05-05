import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

// Sử dụng biến môi trường từ Expo
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL;

const axiosClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 60000, // Tăng lên 60s để hỗ trợ upload nhiều ảnh/file lớn
});

// Interceptor cho Request: Luôn đính kèm Token mới nhất
axiosClient.interceptors.request.use(
  async (config) => {
    try {
      const token = await SecureStore.getItemAsync('accessToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.error('Request Interceptor Error:', error);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

import { Alert } from 'react-native';

let store;

export const injectStore = (_store) => {
  store = _store;
};

let isUnauthorizedAlertShowing = false;

// Interceptor cho Response: Xử lý bóc tách dữ liệu và lỗi 401
axiosClient.interceptors.response.use(
  (response) => {
    // Trả về response.data (chính là object ApiResponse { success, message, data })
    return response.data;
  },
  async (error) => {
    const originalRequest = error.config;

    // Nếu lỗi 401 và chưa thử retry
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = await SecureStore.getItemAsync('refreshToken');
        if (!refreshToken) throw new Error('No refresh token');

        // Gọi API refresh token (sử dụng instance axios sạch để tránh loop)
        const res = await axios.post(`${API_BASE_URL}/auth/refresh-token`, { refreshToken });

        // Giả sử data trả về có dạng { accessToken, refreshToken } hoặc { data: { accessToken, ... } }
        const data = res.data.data || res.data;
        const { accessToken, refreshToken: newRefreshToken } = data;

        if (accessToken) {
          await SecureStore.setItemAsync('accessToken', accessToken);
          if (newRefreshToken) await SecureStore.setItemAsync('refreshToken', newRefreshToken);

          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          return axios(originalRequest);
        }
      } catch (refreshError) {
        // Nếu refresh thất bại -> Logout
        await SecureStore.deleteItemAsync('accessToken');
        await SecureStore.deleteItemAsync('refreshToken');
        await SecureStore.deleteItemAsync('user');
        
        if (store && !isUnauthorizedAlertShowing) {
          isUnauthorizedAlertShowing = true;
          store.dispatch({ type: 'auth/sessionExpired' });
          Alert.alert(
            'Phiên đăng nhập hết hạn',
            'Vui lòng đăng nhập lại để tiếp tục.',
            [{ 
              text: 'OK', 
              onPress: () => { isUnauthorizedAlertShowing = false; } 
            }]
          );
        }
        
        return Promise.reject(refreshError);
      }
    }

    // Nếu lỗi 401 ngay cả khi đã retry hoặc không thể retry
    if (error.response?.status === 401) {
       await SecureStore.deleteItemAsync('accessToken');
       await SecureStore.deleteItemAsync('refreshToken');
       await SecureStore.deleteItemAsync('user');
       
       if (store && !isUnauthorizedAlertShowing) {
         isUnauthorizedAlertShowing = true;
         store.dispatch({ type: 'auth/sessionExpired' });
         Alert.alert(
           'Phiên đăng nhập hết hạn',
           'Vui lòng đăng nhập lại để tiếp tục.',
           [{ 
             text: 'OK', 
             onPress: () => { isUnauthorizedAlertShowing = false; } 
           }]
         );
       }
    }

    return Promise.reject(error);
  }
);

export default axiosClient;
