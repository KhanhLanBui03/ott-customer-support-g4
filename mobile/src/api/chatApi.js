import axiosClient from './axiosClient';
import { Platform } from 'react-native';

/**
 * Messages API endpoints
 * GET  /messages/{conversationId} - Get message history
 * POST /messages/send - Send new message
 * PUT  /messages/{messageId} - Edit message
 * DELETE /messages/{messageId} - Delete message
 * POST /messages/{messageId}/recall - Recall message (5-min window)
 * POST /messages/{messageId}/reactions - Add reaction to message
 * PUT  /messages/{messageId}/read - Mark message as read
 */

export const chatApi = {
  // Get conversation messages with pagination
  getMessages: (conversationId, params) => {
    // Expected params: { fromMessageId, limit }
    // fromMessageId: messageId to fetch from (for pagination)
    // limit: number of messages to fetch (default 20)
    return axiosClient.get(`/messages/${encodeURIComponent(conversationId)}`, { params });
  },

  // Send new message to conversation
  sendMessage: (data) => {
    // Expected: { conversationId, content, type, mediaUrls?, replyTo?, forwardedFrom? }
    // type: TEXT, IMAGE, FILE, VIDEO, AUDIO, STICKER
    return axiosClient.post('/messages/send', data);
  },

  // Edit message (15-min window)
  editMessage: (messageId, conversationId, data) => {
    // Expected: { content }
    return axiosClient.put(`/messages/${messageId}`, data, { params: { conversationId } });
  },

  // Delete message (owner or admin only)
  deleteMessage: (messageId, conversationId) => {
    return axiosClient.delete(`/messages/${messageId}`, { params: { conversationId } });
  },

  // Recall message (5-min window only)
  recallMessage: (messageId, conversationId) => {
    return axiosClient.post(`/messages/${messageId}/recall`, null, { params: { conversationId } });
  },

  // Add emoji reaction to message
  addReaction: (messageId, conversationId, data) => {
    // Expected: { emoji }
    return axiosClient.post(`/messages/${messageId}/reactions`, data, { params: { conversationId } });
  },

  // Remove emoji reaction from message
  removeReaction: (messageId, conversationId, data) => {
    // Expected: { emoji }
    return axiosClient.delete(`/messages/${messageId}/reactions`, { data, params: { conversationId } });
  },

  // Mark message as read
  markAsRead: (messageId, conversationId) => {
    return axiosClient.put(`/messages/${messageId}/read`, null, { params: { conversationId } });
  },
};

/**
 * Conversations API endpoints
 * POST /conversations - Create new conversation (1:1 or group)
 * GET  /conversations - Get user's conversations
 * GET  /conversations/{id} - Get conversation details
 * PUT  /conversations/{id} - Update conversation (name, avatar)
 * PUT  /conversations/{id}/mute - Mute/unmute conversation
 */

export const conversationApi = {
  // Create new conversation
  createConversation: (data) => {
    // Expected: { type, members, name? }
    // type: SINGLE (1:1) or GROUP (group chat)
    // members: [userId1, userId2, ...]
    return axiosClient.post('/conversations', data);
  },

  // Get list of user's conversations
  getConversations: (params) => {
    // Expected params: { offset, limit }
    return axiosClient.get('/conversations', { params });
  },

  // Get conversation details by ID
  getConversation: (conversationId) => {
    return axiosClient.get(`/conversations/${encodeURIComponent(conversationId)}`);
  },

  // Update conversation (name, avatar)
  updateConversation: (conversationId, data) => {
    // Expected: { name, avatar }
    return axiosClient.put(`/conversations/${encodeURIComponent(conversationId)}`, data);
  },

  // Update conversation avatar
  updateAvatar: (conversationId, avatarUrl) => {
    return axiosClient.put(`/conversations/${encodeURIComponent(conversationId)}/avatar`, { avatarUrl });
  },

  // Update conversation wallpaper
  updateConversationWallpaper: (conversationId, wallpaperUrl) => {
    return axiosClient.put(`/conversations/${encodeURIComponent(conversationId)}/wallpaper`, { wallpaperUrl });
  },

  // Mute/unmute conversation
  muteConversation: (conversationId, data) => {
    // Expected: { mutedUntil } - null to unmute, timestamp to mute until
    return axiosClient.put(`/conversations/${encodeURIComponent(conversationId)}/mute`, data);
  },

  // Mark all messages in conversation as read
  markAsRead: (conversationId) => {
    return axiosClient.put(`/conversations/${encodeURIComponent(conversationId)}/read`);
  },

  // Invite member to group
  inviteMember: (conversationId, userId) => {
    return axiosClient.post(`/conversations/${encodeURIComponent(conversationId)}/invite`, { userId });
  },

  // Get pending group invitations
  getPendingInvitations: () => {
    return axiosClient.get('/conversations/invitations/pending');
  },

  // Accept group invitation
  acceptInvitation: (invitationId) => {
    return axiosClient.post(`/conversations/invitations/${encodeURIComponent(invitationId)}/accept`);
  },

  // Reject group invitation
  rejectInvitation: (invitationId) => {
    return axiosClient.post(`/conversations/invitations/${encodeURIComponent(invitationId)}/reject`);
  },

  // Remove member from group (Admin/Owner only)
  removeMember: (conversationId, userId) => {
    return axiosClient.delete(`/conversations/${encodeURIComponent(conversationId)}/members/${encodeURIComponent(userId)}`);
  },

  // Assign role to member (Owner only)
  assignRole: (conversationId, userId, role) => {
    // role: MEMBER, ADMIN
    return axiosClient.put(`/conversations/${encodeURIComponent(conversationId)}/members/${encodeURIComponent(userId)}/role`, { role });
  },

  // Disband group (Owner only)
  disbandGroup: (conversationId) => {
    return axiosClient.delete(`/conversations/${encodeURIComponent(conversationId)}`);
  },

  // Leave group/conversation
  deleteConversationForMe: (conversationId) => {
    return axiosClient.delete(`/conversations/${encodeURIComponent(conversationId)}/me`);
  },

  // Rename conversation
  renameConversation: (conversationId, name) => {
    return axiosClient.put(`/conversations/${encodeURIComponent(conversationId)}/name`, { name });
  },

  // Update conversation tag
  updateTag: (conversationId, tag) => {
    return axiosClient.put(`/conversations/${encodeURIComponent(conversationId)}/tag`, { tag });
  },

  // Toggle chat restriction (Admin/Owner only)
  toggleChatRestriction: (conversationId) => {
    return axiosClient.post(`/conversations/${encodeURIComponent(conversationId)}/toggle-restriction`);
  },
};

export const mediaApi = {
  uploadFile: (file, folder = 'chat-media') => {
    const formData = new FormData();
    formData.append('file', {
      uri: Platform.OS === 'android' ? file.uri : file.uri.replace('file://', ''),
      type: file.type || 'image/jpeg',
      name: file.name || 'file.jpg',
    });
    formData.append('folder', folder);

    return axiosClient.post('/media/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
};

export default { chatApi, conversationApi, mediaApi };
