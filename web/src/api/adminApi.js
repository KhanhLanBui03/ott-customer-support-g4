import axiosClient from './axiosClient';

const adminApi = {
  getDashboardStats: (range = '7d') => {
    return axiosClient.get(`/admin/dashboard/stats?range=${range}`);
  },
  getAllUsers: () => {
    return axiosClient.get('/admin/users');
  },
  getAllGroups: () => {
    return axiosClient.get('/admin/conversations');
  },
  lockUser: (userId) => {
    return axiosClient.post(`/admin/users/${userId}/lock`);
  },
  unlockUser: (userId) => {
    return axiosClient.post(`/admin/users/${userId}/unlock`);
  },
  updateUserRole: (userId, role) => {
    return axiosClient.post(`/admin/users/${userId}/role`, { role });
  },
  getAllReports: () => {
    return axiosClient.get('/admin/reports');
  },
  resolveReport: (reportId, action) => {
    return axiosClient.post(`/admin/reports/${reportId}/action`, { action });
  },
  submitReport: (targetId, targetType, reason, details) => {
    return axiosClient.post('/reports', { targetId, targetType, reason, details });
  },
  deleteUser: (userId) => {
    return axiosClient.delete(`/admin/users/${userId}`);
  },
};

export default adminApi;
