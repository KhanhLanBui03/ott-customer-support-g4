export const isAudioUrl = (value) => 
  typeof value === 'string' && /\.(mp3|m4a|webm|wav|ogg|opus)(\?|$)/i.test(value);

export const getPreviewText = (lastMessage) => {
  const raw = String(lastMessage || '').trim();
  if (!raw) return 'Chưa có tin nhắn';

  // Handle recalled messages
  if (raw === '[Tin nhắn đã bị thu hồi]') return raw;

  // Handle call JSON
  if (raw.startsWith('{') && raw.includes('callType')) {
    try {
      const data = JSON.parse(raw);
      return data.callType === 'video' ? '[Cuộc gọi video]' : '[Cuộc gọi thoại]';
    } catch (e) {
      // Fallback to raw if parsing fails
    }
  }

  // Handle URLs
  if (raw.startsWith('http://') || raw.startsWith('https://')) {
    if (isAudioUrl(raw)) return '[Tin nhắn thoại]';
    return '[Đính kèm]';
  }

  // Handle explicit tags
  const tags = ['attachment', 'đính kèm', 'file', 'tin nhắn thoại', 'cuộc gọi video', 'cuộc gọi thoại'];
  if (tags.some(tag => raw.toLowerCase() === `[${tag}]`)) {
    return raw;
  }

  return raw;
};
