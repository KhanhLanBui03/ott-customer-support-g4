import axiosClient from './axiosClient';

/**
 * API calls liên quan đến Video Call (Agora).
 */
export const callApi = {
    /**
     * Lấy Agora RTC Token từ backend để join channel video call.
     *
     * @param {string} channelId - conversationId, dùng làm Agora channel name
     * @returns {Promise<{token, appId, channelId, uid}>}
     */
    getAgoraToken: (channelId, uid) =>
        axiosClient.get(`/call/token`, { params: { channelId, uid } }),

    /**
     * Lấy thời gian server để đồng bộ.
     */
    getServerTime: () =>
        axiosClient.get(`/call/time`),
};
