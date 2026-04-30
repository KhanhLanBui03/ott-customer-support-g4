import axiosClient from './axiosClient';

/**
 * Media Upload/Download API endpoints
 * POST /media/upload - Upload file to S3 (multipart/form-data)
 * GET  /media/{mediaId}/presigned-url - Get presigned URL for download
 * DELETE /media/{mediaId} - Delete media file
 * GET  /media/{mediaId} - Get media details
 */

export const mediaApi = {
  // Upload file to S3
  uploadMedia: (formData, folder = 'chat') => {
    // Expected formData: FormData object with 'file' and 'conversationId'
    return axiosClient.post(`/media/upload?folder=${folder}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },

  // Get presigned URL for file download
  getPresignedUrl: (mediaId) => {
    return axiosClient.get(`/media/${mediaId}/presigned-url`);
  },

  // Delete media file
  deleteMedia: (mediaId) => {
    return axiosClient.delete(`/media/${mediaId}`);
  },

  // Get media details
  getMediaDetails: (mediaId) => {
    return axiosClient.get(`/media/${mediaId}`);
  },

  // List media in conversation
  listMedia: (conversationId, params) => {
    // Expected params: { offset, limit }
    return axiosClient.get(`/media/conversation/${conversationId}`, { params });
  },
};

/**
 * Story API endpoints
 * POST /stories - Create new story
 * GET  /stories - Get stories feed (from friends)
 * GET  /stories/{storyId} - Get story details
 * DELETE /stories/{storyId} - Delete story
 * POST /stories/{storyId}/view - Mark story as viewed
 */

export const storyApi = {
  // Create new story
  createStory: (formData) => {
    // Expected formData: FormData object with 'media', 'caption', 'privacy'
    // privacy: PUBLIC, FRIENDS, PRIVATE
    return axiosClient.post('/stories', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },

  // Get stories feed (from friends)
  getStoriesFeed: (params) => {
    // Expected params: { offset, limit }
    return axiosClient.get('/stories', { params });
  },

  // Get story details
  getStory: (storyId) => {
    return axiosClient.get(`/stories/${storyId}`);
  },

  // Delete story
  deleteStory: (storyId) => {
    return axiosClient.delete(`/stories/${storyId}`);
  },

  // Mark story as viewed
  markStoryAsViewed: (storyId) => {
    return axiosClient.post(`/stories/${storyId}/view`);
  },

  // Get user's own stories
  getMyStories: () => {
    return axiosClient.get('/stories/my-stories');
  },

  // Get viewers of my story
  getStoryViewers: (storyId) => {
    return axiosClient.get(`/stories/${storyId}/viewers`);
  },
};

/**
 * AI Chat API endpoints
 * POST /ai/chat - Send message to AI chatbot
 * GET  /ai/conversations/{conversationId} - Get AI conversation history
 * DELETE /ai/conversations/{conversationId} - Delete AI conversation
 */

export const aiApi = {
  // Send message to AI chatbot
  sendAiMessage: (data) => {
    // Expected: { conversationId?, message }
    // If no conversationId, creates new AI conversation
    return axiosClient.post('/ai/chat', data);
  },

  // Get AI conversation history
  getAiConversation: (conversationId) => {
    return axiosClient.get(`/ai/conversations/${conversationId}`);
  },

  // Delete AI conversation
  deleteAiConversation: (conversationId) => {
    return axiosClient.delete(`/ai/conversations/${conversationId}`);
  },

  // Get all AI conversations
  getAiConversations: (params) => {
    // Expected params: { offset, limit }
    return axiosClient.get('/ai/conversations', { params });
  },

  // Clear AI conversation history
  clearAiConversation: (conversationId) => {
    return axiosClient.post(`/ai/conversations/${conversationId}/clear`);
  },
};

export default { mediaApi, storyApi, aiApi };
