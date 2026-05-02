import axiosClient from './axiosClient';

export const friendApi = {
    sendRequest: (friendId) => axiosClient.post('/friends/request', { friendId }),
    sendFriendRequest: (friendId) => axiosClient.post('/friends/request', { friendId }),
    cancelRequest: (friendId) => axiosClient.delete(`/friends/cancel/${encodeURIComponent(friendId)}`),
    acceptRequest: (requesterId) => axiosClient.post(`/friends/accept/${requesterId}`),
    rejectRequest: (requesterId) => axiosClient.post(`/friends/reject/${requesterId}`),
    getFriends: () => axiosClient.get('/friends'),
    getPendingRequests: () => axiosClient.get('/friends/pending'),
    deleteFriend: (friendId) => axiosClient.delete(`/friends/${friendId}`),
    blockUser: (friendId) => axiosClient.post(`/friends/block/${encodeURIComponent(friendId)}`),
    unblockUser: (friendId) => axiosClient.post(`/friends/unblock/${encodeURIComponent(friendId)}`),
};

export default friendApi;
