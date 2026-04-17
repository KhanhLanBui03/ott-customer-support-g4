import axiosClient from './axiosClient';

export const userApi = {
  searchUser: (phoneNumber) => axiosClient.get(`/users/search?phoneNumber=${phoneNumber}`),
  updateProfile: (data) => axiosClient.patch('/users/profile', data),
  syncContacts: (phoneNumbers) => axiosClient.post('/users/sync-contacts', { phoneNumbers }),
  getUserById: (id) => axiosClient.get(`/users/${id}`),
};

export default userApi;
