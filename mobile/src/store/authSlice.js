import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import authApi from '../api/authApi';

/**
 * Auth Slice - Redux state management for authentication
 * Handles: Login, Register, Logout, Token refresh, OTP verification
 * Works for both Web and Mobile
 */

export const loginUser = createAsyncThunk(
  'auth/loginUser',
  async (credentials, { rejectWithValue }) => {
    try {
      const response = await authApi.login(credentials);
      const payload = response?.data || response || {};

      // Save tokens to SecureStore (Mobile) or localStorage (Web)
      const { accessToken, refreshToken, sessionId } = payload;
      const userObj = {
        userId: payload.userId,
        phoneNumber: payload.phoneNumber,
        firstName: payload.firstName,
        lastName: payload.lastName,
        avatarUrl: payload.avatarUrl,
      };

      if (Platform.OS !== 'web') {
        if (accessToken) await SecureStore.setItemAsync('accessToken', String(accessToken));
        if (refreshToken) await SecureStore.setItemAsync('refreshToken', String(refreshToken));
        if (sessionId) await SecureStore.setItemAsync('sessionId', String(sessionId));
        if (userObj.userId) await SecureStore.setItemAsync('user', JSON.stringify(userObj));
      } else {
        if (accessToken) localStorage.setItem('accessToken', String(accessToken));
        if (refreshToken) localStorage.setItem('refreshToken', String(refreshToken));
        if (sessionId) localStorage.setItem('sessionId', String(sessionId));
        if (userObj.userId) localStorage.setItem('user', JSON.stringify(userObj));
      }

      return payload;
    } catch (error) {
      return rejectWithValue(error.response?.data || { message: error.message || 'Login failed' });
    }
  }
);

export const registerUser = createAsyncThunk(
  'auth/registerUser',
  async (userData, { rejectWithValue }) => {
    try {
      const response = await authApi.register(userData);
      // Backend /auth/register trả thẳng Map { email, registered: true } (không bọc ApiResponse.data)
      return response?.data || response || {};
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message ||
        error.response?.data?.error?.message ||
        error.message ||
        'Đăng ký thất bại'
      );
    }
  }
);

export const verifyOtp = createAsyncThunk(
  'auth/verifyOtp',
  async (otpData, { rejectWithValue }) => {
    try {
      const response = await authApi.verifyOtp(otpData);
      // Backend /auth/verify-otp trả thẳng Map { email, verified: true, purpose } (không có accessToken)
      const payload = response?.data || response || {};
      const { accessToken, refreshToken, sessionId } = payload;

      // Chỉ lưu token vào SecureStore/localStorage nếu backend thực sự trả token (tránh lỗi SecureStore nhận undefined)
      if (accessToken) {
        const userToSave = payload.user || {
          userId: payload.userId,
          phoneNumber: payload.phoneNumber,
          firstName: payload.firstName,
          lastName: payload.lastName,
          avatarUrl: payload.avatarUrl,
        };

        if (Platform.OS !== 'web') {
          await SecureStore.setItemAsync('accessToken', String(accessToken));
          if (refreshToken) await SecureStore.setItemAsync('refreshToken', String(refreshToken));
          if (sessionId) await SecureStore.setItemAsync('sessionId', String(sessionId));
          await SecureStore.setItemAsync('user', JSON.stringify(userToSave));
        } else {
          localStorage.setItem('accessToken', String(accessToken));
          if (refreshToken) localStorage.setItem('refreshToken', String(refreshToken));
          if (sessionId) localStorage.setItem('sessionId', String(sessionId));
          localStorage.setItem('user', JSON.stringify(userToSave));
        }
      }

      return payload;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message ||
        error.response?.data?.error?.message ||
        error.message ||
        'Xác thực OTP thất bại'
      );
    }
  }
);

export const resendOtp = createAsyncThunk(
  'auth/resendOtp',
  async (identifier, { rejectWithValue }) => {
    try {
      const body = typeof identifier === 'string' && identifier.includes('@')
        ? { email: identifier }
        : { phoneNumber: identifier };
      const response = await authApi.resendOtp(body);
      return response?.data || response || {};
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || error.message || 'Gửi lại OTP thất bại');
    }
  }
);

export const logoutUser = createAsyncThunk(
  'auth/logoutUser',
  async (_, { rejectWithValue }) => {
    try {
      // 1. Try to notify backend first while tokens are still present in SecureStore
      try {
        await authApi.logout();
      } catch (err) {
        console.log('Logout API failed, but local state will be cleared:', err);
      }

      // 2. Clear local storage
      if (Platform.OS !== 'web') {
        await SecureStore.deleteItemAsync('accessToken');
        await SecureStore.deleteItemAsync('refreshToken');
        await SecureStore.deleteItemAsync('sessionId');
        await SecureStore.deleteItemAsync('user');
      } else {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('sessionId');
        localStorage.removeItem('user');
      }
      
      return null;
    } catch (error) {
      return rejectWithValue('Logout failed');
    }
  }
);

const initialState = {
  user: null,
  accessToken: null,
  refreshToken: null,
  sessionId: null,
  isAuthenticated: false,
  loading: false,
  error: null,
  otpSent: false,
  otpPhone: null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    setOtpPhoneNumber: (state, action) => {
      state.otpPhone = action.payload;
      state.otpSent = true;
    },
    restoreState: (state, action) => {
      const { user, accessToken, refreshToken, sessionId } = action.payload;
      state.user = user;
      state.accessToken = accessToken;
      state.refreshToken = refreshToken;
      if (sessionId !== undefined) {
        state.sessionId = sessionId;
      }
      state.isAuthenticated = !!accessToken;
    },
    sessionExpired: (state) => {
      state.user = null;
      state.accessToken = null;
      state.refreshToken = null;
      state.sessionId = null;
      state.isAuthenticated = false;
      state.error = 'Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.';
    },
    updateUser: (state, action) => {
      if (state.user) {
        state.user = { ...state.user, ...action.payload };
        // Sync with SecureStore
        SecureStore.setItemAsync('user', JSON.stringify(state.user));
      }
    },
  },
  extraReducers: (builder) => {
    // Login user
    builder
      .addCase(loginUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.loading = false;
        state.isAuthenticated = true;

        // Backend bọc dữ liệu trong ApiResponse: { success, message, data: { userId, ... } }
        const responseData = action.payload.data || action.payload;

        const { userId, phoneNumber, firstName, lastName, avatarUrl, accessToken, refreshToken, sessionId } = responseData;
        state.user = { userId, phoneNumber, firstName, lastName, avatarUrl };
        state.accessToken = accessToken;
        state.refreshToken = refreshToken;
        state.sessionId = sessionId || null;
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
        state.isAuthenticated = false;
      });

    // Register user
    builder
      .addCase(registerUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(registerUser.fulfilled, (state, action) => {
        state.loading = false;
        const payload = action.payload?.data || action.payload || {};
        state.otpPhone = payload.phoneNumber || null;
        state.otpSent = !payload.registered;
      })
      .addCase(registerUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });

    // Verify OTP
    builder
      .addCase(verifyOtp.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(verifyOtp.fulfilled, (state, action) => {
        state.loading = false;

        const payload = action.payload?.data || action.payload || {};
        // Chỉ đặt isAuthenticated nếu có token (trường hợp login sau OTP)
        // Với REGISTRATION, backend trả { email, verified: true, purpose } không kèm token
        if (payload.accessToken) {
          state.isAuthenticated = true;
          state.accessToken = payload.accessToken;
          state.refreshToken = payload.refreshToken;
          state.sessionId = payload.sessionId || null;

          if (payload.user) {
            state.user = payload.user;
          } else {
            const { userId, phoneNumber, firstName, lastName, avatarUrl } = payload;
            state.user = { userId, phoneNumber, firstName, lastName, avatarUrl };
          }
        }

        state.otpSent = false;
      })
      .addCase(verifyOtp.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });

    builder
      .addCase(resendOtp.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(resendOtp.fulfilled, (state, action) => {
        state.loading = false;
        state.otpPhone = action.meta.arg;
        state.otpSent = true;
      })
      .addCase(resendOtp.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });

    // Logout user
    builder
      .addCase(logoutUser.fulfilled, (state) => {
        state.loading = false;
        state.user = null;
        state.accessToken = null;
        state.refreshToken = null;
        state.sessionId = null;
        state.isAuthenticated = false;
        state.error = null;
      })
      .addCase(logoutUser.rejected, (state, action) => {
        state.error = action.payload;
      });
  },
});

export const { clearError, setOtpPhoneNumber, restoreState, sessionExpired, updateUser } = authSlice.actions;
export default authSlice.reducer;
