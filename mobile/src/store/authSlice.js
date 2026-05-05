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
      
      // Save tokens to SecureStore (Mobile) or localStorage (Web)
      const { accessToken, refreshToken } = response.data;
      if (Platform.OS !== 'web') {
        await SecureStore.setItemAsync('accessToken', accessToken);
        await SecureStore.setItemAsync('refreshToken', refreshToken);
        await SecureStore.setItemAsync('user', JSON.stringify({
           userId: response.data.userId,
           phoneNumber: response.data.phoneNumber,
           firstName: response.data.firstName,
           lastName: response.data.lastName,
           avatarUrl: response.data.avatarUrl
        }));
      } else {
        localStorage.setItem('accessToken', accessToken);
        localStorage.setItem('refreshToken', refreshToken);
        localStorage.setItem('user', JSON.stringify({
           userId: response.data.userId,
           phoneNumber: response.data.phoneNumber,
           firstName: response.data.firstName,
           lastName: response.data.lastName,
           avatarUrl: response.data.avatarUrl
        }));
      }

      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Login failed');
    }
  }
);

export const registerUser = createAsyncThunk(
  'auth/registerUser',
  async (userData, { rejectWithValue }) => {
    try {
      const response = await authApi.register(userData);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Registration failed');
    }
  }
);

export const verifyOtp = createAsyncThunk(
  'auth/verifyOtp',
  async (otpData, { rejectWithValue }) => {
    try {
      const response = await authApi.verifyOtp(otpData);
      
      // Save tokens to SecureStore (Mobile) or localStorage (Web)
      const { accessToken, refreshToken } = response.data;
      if (Platform.OS !== 'web') {
        await SecureStore.setItemAsync('accessToken', accessToken);
        await SecureStore.setItemAsync('refreshToken', refreshToken);
        
        let userToSave = response.data.user;
        if (!userToSave) {
          userToSave = {
            userId: response.data.userId,
            phoneNumber: response.data.phoneNumber,
            firstName: response.data.firstName,
            lastName: response.data.lastName,
            avatarUrl: response.data.avatarUrl
          };
        }
        await SecureStore.setItemAsync('user', JSON.stringify(userToSave));
      } else {
        localStorage.setItem('accessToken', accessToken);
        localStorage.setItem('refreshToken', refreshToken);
        localStorage.setItem('user', JSON.stringify(response.data.user || {
            userId: response.data.userId,
            phoneNumber: response.data.phoneNumber,
            firstName: response.data.firstName,
            lastName: response.data.lastName,
            avatarUrl: response.data.avatarUrl
        }));
      }

      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'OTP verification failed');
    }
  }
);

export const resendOtp = createAsyncThunk(
  'auth/resendOtp',
  async (phoneNumber, { rejectWithValue }) => {
    try {
      const response = await authApi.resendOtp({ phoneNumber });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Resend OTP failed');
    }
  }
);

export const logoutUser = createAsyncThunk(
  'auth/logoutUser',
  async (_, { rejectWithValue }) => {
    try {
      // Always clear local storage first
      await SecureStore.deleteItemAsync('accessToken');
      await SecureStore.deleteItemAsync('refreshToken');
      await SecureStore.deleteItemAsync('user');

      // Try to notify backend, but don't wait for it if it fails
      authApi.logout().catch(err => console.log('Logout API failed, but local state cleared'));
      
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
      const { user, accessToken, refreshToken } = action.payload;
      state.user = user;
      state.accessToken = accessToken;
      state.refreshToken = refreshToken;
      state.isAuthenticated = !!accessToken;
    },
    sessionExpired: (state) => {
      state.user = null;
      state.accessToken = null;
      state.refreshToken = null;
      state.isAuthenticated = false;
      state.error = 'Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.';
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

        const { userId, phoneNumber, firstName, lastName, avatarUrl, accessToken, refreshToken } = responseData;
        state.user = { userId, phoneNumber, firstName, lastName, avatarUrl };
        state.accessToken = accessToken;
        state.refreshToken = refreshToken;
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
        state.otpPhone = action.payload.phoneNumber;
        state.otpSent = true;
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
        state.isAuthenticated = true;
        // Use user object if provided, otherwise reconstruct from payload
        if (action.payload.user) {
          state.user = action.payload.user;
        } else {
          const { userId, phoneNumber, firstName, lastName, avatarUrl } = action.payload;
          state.user = { userId, phoneNumber, firstName, lastName, avatarUrl };
        }
        state.accessToken = action.payload.accessToken;
        state.refreshToken = action.payload.refreshToken;
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
        state.isAuthenticated = false;
        state.error = null;
      })
      .addCase(logoutUser.rejected, (state, action) => {
        state.error = action.payload;
      });
  },
});

export const { clearError, setOtpPhoneNumber, restoreState, sessionExpired } = authSlice.actions;
export default authSlice.reducer;
