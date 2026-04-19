import axiosClient from './axiosClient';

export const userApi = {
  searchUser: (phoneNumber) => axiosClient.get(`/users/search?phoneNumber=${phoneNumber}`),
  updateProfile: (data) => axiosClient.put('/users/me', data),
  syncContacts: (phoneNumbers) => axiosClient.post('/users/sync-contacts', { phoneNumbers }),
  getUserById: (id) => axiosClient.get(`/users/${id}`),
  deleteAccount: () => axiosClient.delete('/users/me'),
};

export default userApi;
