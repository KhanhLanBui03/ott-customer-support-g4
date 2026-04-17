import axiosClient from './axiosClient';

/**
 * Authentication API endpoints
 * POST /register - Register new user
 * POST /login - Login user
 * POST /verify-otp - Verify OTP
 * POST /refresh-token - Refresh JWT token
 * POST /logout - Logout user
 * POST /logout-all-devices - Logout from all devices
 * POST /change-password - Change user password
 */

export const authApi = {
  // Register new user with phone number
  register: (data) => {
    // Expected: { phoneNumber, password, confirmPassword, fullName }
    return axiosClient.post('/auth/register', data);
  },

  // Login with phone number and password
  login: (data) => {
    // Expected: { phoneNumber, password, deviceId, deviceName }
    return axiosClient.post('/auth/login', data);
  },

  // Verify OTP (6-digit code)
  verifyOtp: (data) => {
    // Expected: { phoneNumber, otpCode, purpose? }
    return axiosClient.post('/auth/verify-otp', data);
  },

  resendOtp: (data) => {
    // Expected: { phoneNumber }
    return axiosClient.post('/auth/resend-otp', data);
  },

  // Refresh JWT token using refresh token
  refreshToken: (data) => {
    // Expected: { refreshToken }
    return axiosClient.post('/auth/refresh-token', data);
  },

  // Logout from current device
  logout: () => {
    return axiosClient.post('/auth/logout');
  },

  // Logout from all devices (invalidates all sessions)
  logoutAllDevices: () => {
    return axiosClient.post('/auth/logout-all-devices');
  },

  // Change user password
  changePassword: (data) => {
    // Expected: { currentPassword, newPassword }
    return axiosClient.post('/auth/change-password', data);
  },
};

export default authApi;
