import axiosClient from './axiosClient';

const resolveApiOrigin = () => {
  const configuredBase = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:8080/api/v1`;
  return configuredBase.replace(/\/api(?:\/v1)?\/?$/, '');
};

const API_ORIGIN = resolveApiOrigin();

const notificationPath = (path) => `${API_ORIGIN}/api/notifications${path}`;

export const notificationApi = {
  createNotification: (payload) => axiosClient.post(notificationPath('/create'), payload),
  getNotificationsByReceiverId: (receiverId) => axiosClient.get(notificationPath(`/receiver/${encodeURIComponent(receiverId)}`)),
  getNotificationsBySenderId: (senderId) => axiosClient.get(notificationPath(`/sender/${encodeURIComponent(senderId)}`)),
  markNotificationAsRead: (id) => axiosClient.put(notificationPath('/update/isread'), null, { params: { id } }),
  deleteNotification: (notificationId) => axiosClient.delete(notificationPath('/delete'), { data: { notificationId } }),
};

export default notificationApi;