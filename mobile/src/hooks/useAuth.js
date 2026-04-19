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
    (phoneNumber, password, deviceId = 'mobile-device', deviceName = 'Mobile App') => {
      return dispatch(
        loginUser({
          phoneNumber,
          password,
          deviceId,
          deviceName,
        })
      );
    },
    [dispatch]
  );

  const register = useCallback(
    (phoneNumber, password, confirmPassword, fullName) => {
      const nameParts = (fullName || '').trim().split(/\s+/).filter(Boolean);
      const firstName = nameParts[0] || 'User';
      const lastName = nameParts.slice(1).join(' ') || 'Mobile';

      return dispatch(
        registerUser({
          phoneNumber,
          password,
          confirmPassword,
          firstName,
          lastName,
        })
      );
    },
    [dispatch]
  );

  const verify = useCallback(
    (phoneNumber, otp) => {
      return dispatch(
        verifyOtp({
          phoneNumber,
          otpCode: otp,
          purpose: 'REGISTRATION',
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
    verify,
    resend,
    logout,
    clearError: handleClearError,
  };
};

export default useAuth;
