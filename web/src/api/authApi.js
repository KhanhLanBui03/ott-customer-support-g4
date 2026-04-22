import axiosClient from './axiosClient';

export const authApi = {
  login: (data) => axiosClient.post('/auth/login', data),
  register: (data) => axiosClient.post('/auth/register', data),
  sendOtp: (email, purpose = 'GENERAL') =>
    axiosClient.post('/auth/send-otp', null, {
      params: { email, purpose },
    }),
  verifyOtp: (data) => axiosClient.post('/auth/verify-otp', data),
  refreshToken: (data) => axiosClient.post('/auth/refresh', data),
  checkUserStatus: (phoneNumber) => axiosClient.post('/auth/check', { phoneNumber }),
  logout: () => axiosClient.post('/auth/logout', {}),
  getProfile: () => axiosClient.get('/users/me'),
  forgotPassword: (email) => axiosClient.post('/auth/forgot-password', { email }),
  resetPassword: (data) => axiosClient.post('/auth/reset-password', data),
  changePassword: (data) => axiosClient.post('/auth/change-password', data),
};

export default authApi;
