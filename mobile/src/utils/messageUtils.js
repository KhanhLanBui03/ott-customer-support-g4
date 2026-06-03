export const isVoiceMessage = (message) => {
  if (!message) return false;
  if (message.type === 'VOICE') return true;
  const content = typeof message === 'string' ? message : (message.content || '');
  if (typeof content !== 'string') return false;
  return content.includes('voice-messages/') || 
         content.includes('s3.ap-southeast-1') ||
         content.match(/\.(webm|m4a|mp3|wav|ogg|opus)(\?|$)/i);
};

export const getPreviewText = (lastMessage) => {
  const raw = String(typeof lastMessage === 'string' ? lastMessage : (lastMessage?.content || '')).trim();
  if (!raw) return 'Chưa có tin nhắn';

  // Handle recalled messages
  if (raw === '[Tin nhắn đã bị thu hồi]') return raw;

  if (isVoiceMessage(lastMessage)) return 'Tin nhắn thoại';

  // Handle call JSON
  if (raw.startsWith('{') && raw.includes('callType')) {
    try {
      const data = JSON.parse(raw);
      return data.callType === 'video' ? '[Cuộc gọi video]' : '[Cuộc gọi thoại]';
    } catch (e) {
      // Fallback to raw if parsing fails
    }
  }

  const type = lastMessage?.type || '';

  // Handle URLs
  if (raw.startsWith('http://') || raw.startsWith('https://')) {
    if (isVoiceMessage(raw)) return 'Tin nhắn thoại';
    const lowerRaw = raw.toLowerCase();
    if (type === 'STICKER' || lowerRaw.includes('searchfilter=sticker') || lowerRaw.includes('dicebear.com')) {
      return '[Sticker]';
    }
    if (lowerRaw.includes('.gif') || lowerRaw.includes('tenor.com')) {
      return '[GIF]';
    }
    return `🔗 ${raw}`;
  }

  if (type === 'STICKER') return '[Sticker]';

  // Handle explicit tags
  const tags = ['attachment', 'đính kèm', 'file', 'tin nhắn thoại', 'cuộc gọi video', 'cuộc gọi thoại', 'sticker', 'gif', 'hình ảnh'];
  if (tags.some(tag => raw.toLowerCase() === `[${tag}]`)) {
    return raw;
  }

  return raw;
};

export const getCallLogText = (messageContent, isOwn) => {
  try {
    const callData = typeof messageContent === 'string' ? JSON.parse(messageContent) : (messageContent || {});
    const cType = callData.callType || 'audio';
    const status = callData.status;
    const duration = callData.duration || 0;
    const isOngoing = status === 'ONGOING';

    const mins = Math.floor(duration / 60);
    const secs = duration % 60;
    const durationStr = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

    if (isOngoing) {
      return cType === 'video' ? 'Cuộc gọi video đang diễn ra' : 'Cuộc gọi thoại đang diễn ra';
    }

    if (isOwn) {
      if (status === 'SUCCESS') {
        return cType === 'video' ? `Cuộc gọi video đi (${durationStr})` : `Cuộc gọi thoại đi (${durationStr})`;
      } else {
        const statusText = status === 'REJECTED' ? 'Bị từ chối' : 'Không trả lời';
        return cType === 'video' ? `Cuộc gọi video đi (${statusText})` : `Cuộc gọi thoại đi (${statusText})`;
      }
    } else {
      if (status === 'SUCCESS') {
        return cType === 'video' ? `Cuộc gọi video đến (${durationStr})` : `Cuộc gọi thoại đến (${durationStr})`;
      } else {
        return cType === 'video' ? 'Cuộc gọi video nhỡ' : 'Cuộc gọi thoại nhỡ';
      }
    }
  } catch (e) {
    return 'Cuộc gọi';
  }
};
