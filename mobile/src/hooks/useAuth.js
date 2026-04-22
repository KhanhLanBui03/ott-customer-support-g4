import { useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { loginUser, registerUser, verifyOtp, resendOtp, logoutUser, clearError } from '../store/authSlice';

/**
 * Custom hook for authentication (React Native)
 * Provides: login, register, verifyOtp, logout, user data, loading, error
 * Same interface as Web version
 */

export const useAuth = () => {
  const dispatch = useDispatch();
  const { user, isAuthenticated, loading, error, otpSent, otpPhone, accessToken } = useSelector(
    (state) => state.auth
  );

  const login = useCallback(
    (identifier, password, deviceId = 'mobile-device', deviceName = 'Mobile App') => {
      // Identifier can be email or phoneNumber
      const loginData = identifier.includes('@')
        ? { email: identifier, password, deviceId, deviceName }
        : { phoneNumber: identifier, password, deviceId, deviceName };

      return dispatch(loginUser(loginData));
    },
    [dispatch]
  );

  const register = useCallback(
    (registerData) => {
      return dispatch(registerUser(registerData));
    },
    [dispatch]
  );

  const sendOtp = useCallback(
    (email, purpose = 'REGISTRATION') => {
      return authApi.sendOtp(email, purpose);
    },
    []
  );

  const checkPhone = useCallback(
    (phone) => {
      return authApi.checkUserStatus(phone);
    },
    []
  );

  const verify = useCallback(
    (email, otp, purpose = 'REGISTRATION') => {
      return dispatch(
        verifyOtp({
          email,
          otpCode: otp,
          purpose,
        })
      );
    },
    [dispatch]
  );

  const logout = useCallback(() => {
    return dispatch(logoutUser());
  }, [dispatch]);

  const resend = useCallback(
    (phoneNumber) => {
      return dispatch(resendOtp(phoneNumber));
    },
    [dispatch]
  );

  const handleClearError = useCallback(() => {
    dispatch(clearError());
  }, [dispatch]);

  return {
    user,
    isAuthenticated,
    loading,
    error,
    otpSent,
    otpPhone,
    accessToken,
    login,
    register,
    sendOtp,
    checkPhone,
    verify,
    resend,
    logout,
    clearError: handleClearError,
  };
};

export default useAuth;
