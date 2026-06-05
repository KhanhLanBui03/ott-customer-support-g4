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

  // Handle explicit tags and fallback phrases
  const lowerRaw = raw.toLowerCase();
  if (lowerRaw === '[tin nhắn thoại]' || lowerRaw === 'tin nhắn thoại' || lowerRaw.includes('tin nhắn thoại')) {
    return i18n.t('sidebar.voice_message');
  }
  if (lowerRaw === '[cuộc gọi video]' || lowerRaw === 'cuộc gọi video' || lowerRaw.includes('cuộc gọi video')) {
    return i18n.t('sidebar.video_call');
  }
  if (lowerRaw === '[cuộc gọi thoại]' || lowerRaw === 'cuộc gọi thoại' || lowerRaw.includes('cuộc gọi thoại')) {
    return i18n.t('sidebar.voice_call');
  }
  if (lowerRaw === '[sticker]' || lowerRaw === 'sticker' || lowerRaw === '[nhãn dán]' || lowerRaw === 'nhãn dán' || lowerRaw.includes('nhãn dán')) {
    return i18n.t('sidebar.sticker');
  }
  if (lowerRaw === '[gif]' || lowerRaw === 'gif' || lowerRaw.includes('gif')) {
    return i18n.t('sidebar.gif');
  }
  if (lowerRaw === '[đính kèm]' || lowerRaw === 'đính kèm' || lowerRaw === '[file]' || lowerRaw === 'file' || lowerRaw === '[attachment]' || lowerRaw === 'attachment' || lowerRaw === '[tệp tin]' || lowerRaw === 'tệp tin' || lowerRaw.includes('đính kèm') || lowerRaw.includes('tệp tin')) {
    return i18n.t('sidebar.attachment');
  }
  if (lowerRaw === '[hình ảnh]' || lowerRaw === 'hình ảnh' || lowerRaw.includes('hình ảnh')) {
    return i18n.t('chat.image_bracket');
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

