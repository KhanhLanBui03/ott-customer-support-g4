import axiosClient from './axiosClient';

export const adminApi = {
  submitReport: (targetId, targetType, reason, details) => {
    return axiosClient.post('/reports', { targetId, targetType, reason, details });
  },
};

export default adminApi;
