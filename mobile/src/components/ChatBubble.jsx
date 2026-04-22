import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { useSelector } from 'react-redux';
import CONFIG from '../config';

const ChatBubble = ({ message, isOwn }) => {
  const conversations = useSelector(state => state.chat.conversations);
  const BASE_URL = CONFIG.API_URL.split('/api')[0];

  const getAvatarUrl = (url, name) => {
    if (!url) return `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'U')}&background=random&color=fff&size=128&bold=true`;
    if (url.startsWith('http')) return url;
    return `${BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
  };

  const senderInfo = React.useMemo(() => {
    if (isOwn) return null;
    for (const conv of conversations) {
      const members = conv.members || conv.participants || [];
      const found = members.find(m => m.userId === message.senderId);
      if (found) return found;
    }
    return null;
  }, [conversations, message.senderId, isOwn]);

  const avatarUrl = getAvatarUrl(message.senderAvatar || senderInfo?.avatar || senderInfo?.profilePic, message.senderName || senderInfo?.name);

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    try {
      const date = new Date(timestamp);
      return isNaN(date.getTime()) ? '' : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) { return ''; }
  };

  return (
    <View style={[styles.container, isOwn ? styles.ownContainer : styles.otherContainer]}>
      {!isOwn && (
        <View style={styles.avatarContainer}>
          <Image source={{ uri: avatarUrl }} style={styles.avatar} />
        </View>
      )}

      <View style={[styles.messageWrapper, isOwn ? styles.ownWrapper : styles.otherWrapper]}>
        {!isOwn && <Text style={styles.senderName}>{message.senderName || senderInfo?.name || 'User'}</Text>}
        <View style={[styles.bubble, isOwn ? styles.ownBubble : styles.otherBubble]}>
          <Text style={[styles.text, isOwn ? styles.ownText : styles.otherText]}>
            {message.isRecalled ? '[Tin nhắn đã thu hồi]' : message.content}
          </Text>
        </View>
        <Text style={styles.time}>{formatTime(message.createdAt || Date.now())}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { marginVertical: 4, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'flex-end' },
  ownContainer: { justifyContent: 'flex-end' },
  otherContainer: { justifyContent: 'flex-start' },
  avatarContainer: { marginRight: 8, marginBottom: 16 },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#eee' },
  messageWrapper: { maxWidth: '75%' },
  ownWrapper: { alignItems: 'flex-end' },
  otherWrapper: { alignItems: 'flex-start' },
  senderName: { fontSize: 11, color: '#6b7280', marginBottom: 2, marginLeft: 4 },
  bubble: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 20 },
  ownBubble: { backgroundColor: '#667eea', borderBottomRightRadius: 4 },
  otherBubble: { backgroundColor: '#f3f4f6', borderBottomLeftRadius: 4 },
  text: { fontSize: 15, lineHeight: 20 },
  ownText: { color: '#fff' },
  otherText: { color: '#1f2937' },
  time: { fontSize: 10, color: '#9ca3af', marginTop: 2 },
});

export default ChatBubble;
