import axiosClient from './axiosClient';

export const friendApi = {
    sendRequest: (friendId) => axiosClient.post('/friends/request', { friendId }),
    acceptRequest: (requesterId) => axiosClient.post(`/friends/accept/${requesterId}`),
    rejectRequest: (requesterId) => axiosClient.post(`/friends/reject/${requesterId}`),
    getFriends: () => axiosClient.get('/friends'),
    getPendingRequests: () => axiosClient.get('/friends/pending'),
};

export default friendApi;
