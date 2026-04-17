import axiosClient from './axiosClient';

export const authApi = {
  login: (data) => axiosClient.post('/auth/login', data),
  register: (data) => axiosClient.post('/auth/register', data),
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  },
  getProfile: () => axiosClient.get('/users/profile'),
  forgotPassword: (phoneNumber) => axiosClient.post('/auth/forgot-password', { phoneNumber }),
};

export default authApi;
