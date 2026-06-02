import axiosClient from './axiosClient';

/**
 * User/Profile API endpoints
 * GET  /users/me - Get current logged-in user profile
 * PUT  /users/me - Update current user profile
 * GET  /users/{userId} - Get other user's public profile
 * PUT  /users/{userId}/status - Update user status/status message
 * POST /notifications/device-token - Register device token (for push notifications)
 * DELETE /notifications/device-token/{token} - Unregister device token
 * GET  /contacts - Get user's contacts
 * POST /contacts/sync - Sync phone contacts
 */

export const userApi = {
  // Get current logged-in user profile
  getProfile: () => {
    return axiosClient.get('/users/me');
  },

  // Update current user profile
  updateProfile: (data) => {
    // Expected: { firstName, lastName, avatarUrl, bio, status }
    return axiosClient.put('/users/me', data);
  },

  // Get other user's public profile
  getUserProfile: (userId) => {
    return axiosClient.get(`/users/${userId}`);
  },

  // Update user status and status message
  updateStatus: (data) => {
    // Expected: { status, statusMessage }
    // status: ONLINE, OFFLINE, AWAY, DO_NOT_DISTURB
    return axiosClient.put('/users/me/status', data);
  },

  // Search for users by phone number
  searchUser: (phoneNumber) => {
    return axiosClient.get('/users/search', { params: { phoneNumber } });
  },

  // Delete account (lock for 30 days or delete permanently)
  deleteAccount: (data) => {
    return axiosClient.delete('/users/me', { data });
  },
};

/**
 * Contact Management API
 */
export const contactApi = {
  // Get user's contacts
  getContacts: (params) => {
    // Expected params: { offset, limit }
    return axiosClient.get('/contacts', { params });
  },

  // Sync phone contacts (hash-based privacy)
  syncPhoneContacts: (data) => {
    // Expected: { phoneNumberHashes: [hash1, hash2, ...] }
    // Hashes are SHA-256 of E.164 formatted phone numbers
    return axiosClient.post('/contacts/sync', data);
  },

  // Get contact by phone number hash
  getContact: (phoneNumberHash) => {
    return axiosClient.get(`/contacts/${phoneNumberHash}`);
  },

  // Add contact
  addContact: (data) => {
    // Expected: { phoneNumber, label }
    return axiosClient.post('/contacts', data);
  },

  // Remove contact
  removeContact: (contactId) => {
    return axiosClient.delete(`/contacts/${contactId}`);
  },

  // Block contact
  blockContact: (contactId) => {
    return axiosClient.post(`/contacts/${contactId}/block`);
  },

  // Unblock contact
  unblockContact: (contactId) => {
    return axiosClient.post(`/contacts/${contactId}/unblock`);
  },
};

/**
 * Notification/Device Token API
 */
export const notificationApi = {
  // Register device token for push notifications
  registerDeviceToken: (data) => {
    // Expected: { token, platform, osVersion }
    // platform: ANDROID, IOS, WEB
    return axiosClient.post('/notifications/device-token', data);
  },

  // Unregister device token
  unregisterDeviceToken: (token) => {
    return axiosClient.delete(`/notifications/device-token/${token}`);
  },

  // Get notifications by receiver ID
  getNotificationsByReceiver: (receiverId) => {
    return axiosClient.get(`/notifications/receiver/${encodeURIComponent(receiverId)}`);
  },

  // Mark notification as read
  markNotificationAsRead: (notificationId) => {
    return axiosClient.put(`/notifications/update/isread`, null, {
      params: { id: notificationId, isRead: true }
    });
  },

  // Mark all notifications as read for a receiver
  markAllAsRead: async (receiverId) => {
    try {
      const res = await axiosClient.get(`/notifications/receiver/${encodeURIComponent(receiverId)}`);
      const list = res.data || res || [];
      const listData = Array.isArray(list) ? list : (list.data || []);
      const unread = listData.filter(item => !item.isRead && !item.read);
      await Promise.all(unread.map(item => 
        axiosClient.put(`/notifications/update/isread`, null, {
          params: { id: item.id || item.notificationId, isRead: true }
        })
      ));
    } catch (e) {
      console.warn('Failed to mark all as read', e);
    }
  },

  // Delete notification
  deleteNotification: (notificationId) => {
    return axiosClient.delete(`/notifications/delete`, {
      params: { id: notificationId }
    });
  },

  // Delete multiple notifications
  deleteMultipleNotifications: (ids) => {
    return axiosClient.delete(`/notifications/delete-multiple`, {
      data: ids
    });
  },

  // Delete all notifications for a receiver
  deleteAllNotifications: (receiverId) => {
    return axiosClient.delete(`/notifications/clean/receiver/${encodeURIComponent(receiverId)}`);
  },
};

export default { userApi, contactApi, notificationApi };
