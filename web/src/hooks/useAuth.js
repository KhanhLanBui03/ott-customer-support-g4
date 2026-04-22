import { useDispatch, useSelector } from 'react-redux';
import { setCredentials, logout as logoutAction } from '../store/authSlice';
import { authApi } from '../api/authApi';

const mapAuthPayload = (data) => ({
  token: data.accessToken,
  refreshToken: data.refreshToken,
  sessionId: data.sessionId,
  user: {
    id: data.userId,
    phoneNumber: data.phoneNumber,
    firstName: data.firstName,
    lastName: data.lastName,
    fullName:
      data.fullName ||
      [data.lastName, data.firstName].filter(Boolean).join(' ').trim() ||
      data.phoneNumber,
    avatar: data.avatarUrl || data.avatar,
    bio: data.bio,
    email: data.email,
  },
});

export const useAuth = () => {
  const dispatch = useDispatch();
  const { user, token, isAuthenticated, loading, refreshToken, sessionId } = useSelector((state) => state.auth);

  const login = async (credentials) => {
    const response = await authApi.login(credentials);
    const data = response.data || response;

    const authData = mapAuthPayload(data);
    dispatch(setCredentials(authData));
    return authData;
  };

  const register = async (userData) => {
    const response = await authApi.register(userData);
    return response.data || response;
  };

  const sendOtp = async (email, purpose = 'REGISTRATION') => {
    const response = await authApi.sendOtp(email, purpose);
    return response.data || response;
  };

  const verifyOtp = async (payload, options = {}) => {
    const { autoLogin = true } = options;
    const response = await authApi.verifyOtp(payload);
    const data = response.data || response;
    if (autoLogin && data?.accessToken) {
      const authData = mapAuthPayload(data);
      dispatch(setCredentials(authData));
      return authData;
    }
    return data;
  };

  const forgotPassword = async (email) => {
    const response = await authApi.forgotPassword(email);
    return response.data || response;
  };

  const resetPassword = async (payload) => {
    const response = await authApi.resetPassword(payload);
    return response.data || response;
  };

  const refreshAuthToken = async (deviceId) => {
    if (!refreshToken) {
      throw new Error('Missing refresh token');
    }
    const response = await authApi.refreshToken({ refreshToken, deviceId });
    return response.data || response;
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch (err) {
      // Always clear local auth state even if backend logout fails.
      console.warn('Logout request failed', err);
    }
    dispatch(logoutAction());
  };

  return {
    user,
    token,
    refreshToken,
    sessionId,
    isAuthenticated,
    loading,
    login,
    register,
    sendOtp,
    verifyOtp,
    forgotPassword,
    resetPassword,
    refreshAuthToken,
    logout,
  };
};
