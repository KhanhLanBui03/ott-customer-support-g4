import axiosClient from './axiosClient';

/**
 * Friendship/Contacts API
 */
export const friendApi = {
  // Send friend request
  sendFriendRequest: (friendId) => {
    return axiosClient.post('/friends/request', { friendId });
  },

  // Accept friend request
  acceptFriendRequest: (requesterId) => {
    return axiosClient.post(`/friends/accept/${requesterId}`);
  },

  // Reject friend request
  rejectFriendRequest: (requesterId) => {
    return axiosClient.post(`/friends/reject/${requesterId}`);
  },

  // Get friends list
  getFriends: () => {
    return axiosClient.get('/friends');
  },

  // Get pending friend requests
  getPendingRequests: () => {
    return axiosClient.get('/friends/pending');
  },

  // Block user
  blockUser: (friendId) => {
    return axiosClient.post(`/friends/block/${friendId}`);
  },

  // Unblock user
  unblockUser: (friendId) => {
    return axiosClient.post(`/friends/unblock/${friendId}`);
  },

  // Unfriend
  unfriend: (friendId) => {
    return axiosClient.delete(`/friends/${friendId}`);
  }
};

export default friendApi;
