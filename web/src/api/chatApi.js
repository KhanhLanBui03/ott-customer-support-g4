import axiosClient from './axiosClient';

export const chatApi = {
  getConversations: () => axiosClient.get('/conversations'),
  getMessages: (conversationId) => axiosClient.get(`/messages/${encodeURIComponent(conversationId)}`),
  markConversationAsRead: (conversationId) => axiosClient.put(`/conversations/${encodeURIComponent(conversationId)}/read`),
  createConversation: (data) => axiosClient.post('/conversations', data),
  
  // Member & Invitation management
  inviteMember: (conversationId, userId) => axiosClient.post(`/conversations/${encodeURIComponent(conversationId)}/invite`, { userId }),
  acceptGroupInvitation: (invitationId) => axiosClient.post(`/conversations/invitations/${encodeURIComponent(invitationId)}/accept`),
  rejectGroupInvitation: (invitationId) => axiosClient.post(`/conversations/invitations/${encodeURIComponent(invitationId)}/reject`),
  getPendingInvitations: () => axiosClient.get('/conversations/invitations/pending'),
  removeMember: (conversationId, userId) => axiosClient.delete(`/conversations/${encodeURIComponent(conversationId)}/members/${encodeURIComponent(userId)}`),
  assignRole: (conversationId, userId, role) => axiosClient.put(`/conversations/${encodeURIComponent(conversationId)}/members/${encodeURIComponent(userId)}/role`, { role }),
  updateNickname: (conversationId, userId, nickname) => axiosClient.put(`/conversations/${encodeURIComponent(conversationId)}/members/${encodeURIComponent(userId)}/nickname`, { nickname }),
  
  // Group actions
  disbandGroup: (id) => axiosClient.delete(`/conversations/${encodeURIComponent(id)}`),
  leaveConversation: (id) => axiosClient.delete(`/conversations/${encodeURIComponent(id)}/me`),
  deleteConversation: (id) => axiosClient.delete(`/conversations/${encodeURIComponent(id)}/me`), // Alias for backward compatibility
  updateWallpaper: (conversationId, wallpaperUrl) =>
    axiosClient.put(`/conversations/${encodeURIComponent(conversationId)}/wallpaper`, { wallpaperUrl }),
  
  uploadMedia: (file, folder = 'chat') => {
    const formData = new FormData();
    formData.append('file', file);
    return axiosClient.post(`/media/upload?folder=${folder}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  addReaction: (conversationId, messageId, emoji) => axiosClient.post(`/messages/${messageId}/reactions?conversationId=${encodeURIComponent(conversationId)}`, { emoji }),
  removeReaction: (conversationId, messageId, emoji) => axiosClient.delete(`/messages/${messageId}/reactions?conversationId=${encodeURIComponent(conversationId)}`, { data: { emoji } }),
  recallMessage: (conversationId, messageId) => axiosClient.post(`/messages/${messageId}/recall?conversationId=${encodeURIComponent(conversationId)}`),
  deleteMessage: (conversationId, messageId) => axiosClient.delete(`/messages/${messageId}?conversationId=${encodeURIComponent(conversationId)}`),
  pinMessage: (conversationId, messageId) => axiosClient.post(`/conversations/${encodeURIComponent(conversationId)}/pin/${messageId}`),
  unpinMessage: (conversationId, messageId) => axiosClient.delete(`/conversations/${encodeURIComponent(conversationId)}/pin/${messageId}`),
  togglePinConversation: (conversationId) => axiosClient.post(`/conversations/${encodeURIComponent(conversationId)}/toggle-pin`),
  
  // Vote actions
  createVote: (conversationId, data) => axiosClient.post(`/messages/${encodeURIComponent(conversationId)}/vote`, data),
  submitVote: (conversationId, messageId, data) => axiosClient.put(`/messages/${encodeURIComponent(conversationId)}/vote/${messageId}`, data),
  closeVote: (conversationId, messageId) => axiosClient.put(`/messages/${encodeURIComponent(conversationId)}/vote/${messageId}/close`),
  
  // AI assistant actions
  getGroupSummary: (conversationId, timeRange = 0) => axiosClient.post(`/ai/group/${encodeURIComponent(conversationId)}/summary?timeRange=${timeRange}`),
  getGroupStats: (conversationId) => axiosClient.post(`/ai/group/${encodeURIComponent(conversationId)}/stats`),
  draftAnnouncement: (conversationId) => axiosClient.post(`/ai/group/${encodeURIComponent(conversationId)}/announcement`),
  askAI: (conversationId, question) => axiosClient.post(`/ai/group/${encodeURIComponent(conversationId)}/ask`, { question }),
  translateText: (content, targetLang = 'Tiếng Việt') => axiosClient.post('/ai/translate', { content, targetLang }),
  getSmartReplies: (conversationId) => axiosClient.post(`/ai/group/${encodeURIComponent(conversationId)}/suggest-replies`),
  extractTasks: (conversationId) => axiosClient.post(`/ai/group/${encodeURIComponent(conversationId)}/extract-tasks`),
};

export default chatApi;
