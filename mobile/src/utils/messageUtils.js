import i18n from '../locales/i18n';
import { translateSystemMessage } from './systemMessageTranslator';

export const isVoiceMessage = (message) => {
  if (!message) return false;
  if (message.type === 'VOICE') return true;
  const content = typeof message === 'string' ? message : (message.content || '');
  if (typeof content !== 'string') return false;
  return content.includes('voice-messages/') || 
         content.includes('s3.ap-southeast-1') ||
         content.match(/\.(webm|m4a|mp3|wav|ogg|opus)(\?|$)/i);
};

export const getPreviewText = (lastMessage, senderId = null) => {
  const raw = String(typeof lastMessage === 'string' ? lastMessage : (lastMessage?.content || '')).trim();
  if (!raw) return i18n.t('sidebar.start_conversation');

  const actualSenderId = senderId || lastMessage?.senderId || lastMessage?.sender || lastMessage?.lastMessageSenderId;

  // Handle system messages
  if (actualSenderId === 'SYSTEM') {
    return translateSystemMessage(raw, i18n.t);
  }

  // Handle recalled messages
  if (raw === '[Tin nhắn đã bị thu hồi]') return i18n.t('sidebar.recalled');

  if (isVoiceMessage(lastMessage)) return i18n.t('sidebar.voice_message');

  // Handle call JSON
  if (raw.startsWith('{') && raw.includes('callType')) {
    try {
      const data = JSON.parse(raw);
      return data.callType === 'video' ? i18n.t('sidebar.video_call') : i18n.t('sidebar.voice_call');
    } catch (e) {
      // Fallback to raw if parsing fails
    }
  }

  const type = lastMessage?.type || '';

  // Handle URLs
  if (raw.startsWith('http://') || raw.startsWith('https://')) {
    if (isVoiceMessage(raw)) return i18n.t('sidebar.voice_message');
    const lowerRaw = raw.toLowerCase();
    if (type === 'STICKER' || lowerRaw.includes('searchfilter=sticker') || lowerRaw.includes('dicebear.com')) {
      return i18n.t('sidebar.sticker');
    }
    if (lowerRaw.includes('.gif') || lowerRaw.includes('tenor.com')) {
      return i18n.t('sidebar.gif');
    }
    return `🔗 ${raw}`;
  }

  if (type === 'STICKER') return i18n.t('sidebar.sticker');

  // Handle explicit tags
  const tags = ['attachment', 'đính kèm', 'file', 'tin nhắn thoại', 'cuộc gọi video', 'cuộc gọi thoại', 'sticker', 'gif', 'hình ảnh'];
  if (tags.some(tag => raw.toLowerCase() === `[${tag}]`)) {
    const lower = raw.toLowerCase();
    if (lower.includes('thoại')) return i18n.t('sidebar.voice_message');
    if (lower.includes('video')) return i18n.t('sidebar.video_call');
    if (lower.includes('đính kèm') || lower.includes('file') || lower.includes('attachment')) return i18n.t('sidebar.attachment');
    if (lower.includes('sticker') || lower.includes('nhãn dán')) return i18n.t('sidebar.sticker');
    if (lower.includes('gif')) return i18n.t('sidebar.gif');
    if (lower.includes('hình ảnh') || lower.includes('image')) return i18n.t('chat.image_bracket');
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
      return cType === 'video' 
        ? i18n.t('chat.video_call_ongoing') 
        : i18n.t('chat.voice_call_ongoing');
    }

    if (isOwn) {
      if (status === 'SUCCESS') {
        return cType === 'video' 
          ? `${i18n.t('chat.outgoing_video_call')} (${durationStr})` 
          : `${i18n.t('chat.outgoing_voice_call')} (${durationStr})`;
      } else {
        const statusKey = status === 'REJECTED' ? 'chat.rejected' : 'chat.no_answer';
        const statusText = i18n.t(statusKey);
        return cType === 'video' 
          ? `${i18n.t('chat.outgoing_video_call')} (${statusText})` 
          : `${i18n.t('chat.outgoing_voice_call')} (${statusText})`;
      }
    } else {
      if (status === 'SUCCESS') {
        return cType === 'video' 
          ? `${i18n.t('chat.incoming_video_call')} (${durationStr})` 
          : `${i18n.t('chat.incoming_voice_call')} (${durationStr})`;
      } else {
        return cType === 'video' 
          ? i18n.t('chat.missed_video_call') 
          : i18n.t('chat.missed_voice_call');
      }
    }
  } catch (e) {
    return i18n.t('chat.video_call_ongoing');
  }
};

