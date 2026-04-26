import React, { useState, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Image, 
  TouchableOpacity, 
  Animated, 
  Modal, 
  ScrollView,
  PanResponder, 
} from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { useRouter } from 'expo-router';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import CONFIG from '../config';
import { setReplyingTo } from '../store/chatSlice';

const ChatBubble = ({ message, isOwn: initialIsOwn, onReact, onLongPress }) => {
  const router = useRouter();
  const dispatch = useDispatch();
  const { user } = useSelector(state => state.auth);
  const conversations = useSelector(state => state.chat.conversations);
  const BASE_URL = CONFIG.API_URL.split('/api')[0];

  const currentUserIdStr = String(user?.userId || user?.id || '');
  const isOwn = initialIsOwn || (currentUserIdStr !== '' && String(message.senderId || '') === currentUserIdStr);
  const [reactionModalVisible, setReactionModalVisible] = useState(false);
  const [selectedReactionEmoji, setSelectedReactionEmoji] = useState('');

  const openReactionDetail = (emoji) => {
    setSelectedReactionEmoji(emoji);
    setReactionModalVisible(true);
  };

  const closeReactionDetail = () => setReactionModalVisible(false);

  const getReactionUserName = (userId) => {
    const id = String(userId || '');
    if (!id) return 'Người dùng';
    if (id === currentUserIdStr) return 'Bạn';

    const found = conversations
      .flatMap(conv => conv.members || conv.participants || [])
      .find(member => String(member.userId || member.id || '') === id);

    return found?.fullName || found?.name || found?.username || 'Người dùng';
  };

  // Animation for swipe to reply
  const translateX = useRef(new Animated.Value(0)).current;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Nhạy hơn (dx > 10) và đảm bảo là vuốt ngang
        return Math.abs(gestureState.dx) > 10 && Math.abs(gestureState.dy) < 10;
      },
      onPanResponderMove: (_, gestureState) => {
        // Cho phép vuốt sang trái (âm), giới hạn tối đa -80 để tạo cảm giác chắc chắn
        if (gestureState.dx < 0) {
          const limitedDx = Math.max(gestureState.dx, -30);
          translateX.setValue(limitedDx);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        // Rút ngắn biên độ kích hoạt từ -50 xuống -40
        if (gestureState.dx < -10) {
          // Kích hoạt trả lời
          dispatch(setReplyingTo(message));
        }
        // Luôn trả về vị trí cũ mượt mà với hiệu ứng Spring nhanh hơn
        Animated.spring(translateX, {
          toValue: 0,
          useNativeDriver: true,
          tension: 100, // Tăng độ nảy
          friction: 8
        }).start();
      },
      onPanResponderTerminate: () => {
        // Đảm bảo không bị kẹt khi bị gián đoạn
        Animated.spring(translateX, {
          toValue: 0,
          useNativeDriver: true
        }).start();
      }
    })
  ).current;

  const getAvatarUrl = (url, name) => {
    if (!url) return `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'U')}&background=random&color=fff&size=128&bold=true`;
    if (url.startsWith('http')) return url;
    return `${BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
  };

  const senderInfo = React.useMemo(() => {
    if (isOwn) return null;
    const msgSenderId = String(message.senderId || '');
    for (const conv of conversations) {
      const members = conv.members || conv.participants || [];
      const found = members.find(m => String(m.userId || m.id || '') === msgSenderId);
      if (found) return found;
    }
    return null;
  }, [conversations, message.senderId, isOwn]);

  const avatarUrl = getAvatarUrl(
    senderInfo?.avatarUrl || senderInfo?.avatar || senderInfo?.profilePic || message.senderAvatar,
    senderInfo?.fullName || senderInfo?.name || message.senderName
  );

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    try {
      const date = new Date(timestamp);
      return isNaN(date.getTime()) ? '' : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) { return ''; }
  };

  const reactionUserNamesFor = (emoji) => {
    if (!message.reactions || !message.reactions[emoji]) return [];
    return message.reactions[emoji].map(getReactionUserName);
  };

  const renderReactions = () => {
    if (!message.reactions || Object.keys(message.reactions).length === 0) return null;

    return (
      <View style={[styles.reactionsContainer, isOwn ? styles.ownReactions : styles.otherReactions]}>
        {Object.entries(message.reactions).map(([emoji, users]) => {
          if (!Array.isArray(users) || users.length === 0) return null;
          return (
            <TouchableOpacity
              key={emoji}
              style={styles.reactionBadge}
              activeOpacity={0.75}
              onPress={() => openReactionDetail(emoji)}
            >
              <Text style={styles.reactionEmoji}>{emoji}</Text>
              <Text style={styles.reactionCount}>{users.length > 1 ? users.length : ''}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  return (
    <Animated.View 
      {...panResponder.panHandlers}
      style={[
        styles.container, 
        isOwn ? styles.ownContainer : styles.otherContainer,
        { transform: [{ translateX }] }
      ]}
    >
      {!isOwn && (
        <TouchableOpacity 
          style={styles.avatarContainer}
          onPress={() => router.push(`/chat-info/${encodeURIComponent(message.conversationId)}`)}
        >
          <Image source={{ uri: avatarUrl }} style={styles.avatar} />
        </TouchableOpacity>
      )}

      <TouchableOpacity 
        activeOpacity={0.8}
        onLongPress={onLongPress}
        style={[styles.messageWrapper, isOwn ? styles.ownWrapper : styles.otherWrapper]}
      >
        {!isOwn && (
          <Text style={styles.senderName}>
            {senderInfo?.fullName || senderInfo?.name || message.senderName || 'User'}
          </Text>
        )}
        
        <View style={[styles.bubble, isOwn ? styles.ownBubble : styles.otherBubble]}>
          {/* Reply Section - SỬA LẠI LAYOUT NGANG */}
          {message.replyTo && (
            <View style={[styles.replyBubble, isOwn ? styles.ownReplyBubble : styles.otherReplyBubble]}>
              <View style={styles.replyLine} />
              <View style={styles.replyContent}>
                <Text style={styles.replySender} numberOfLines={1}>
                  {(() => {
                    const repliedUserId = String(message.replyTo.senderId || '');
                    const currentMeId = String(user?.userId || user?.id || '');
                    const isMeReplied = repliedUserId !== '' && repliedUserId === currentMeId;
                    if (isMeReplied) return 'Bạn';
                    
                    // Tìm tên mới nhất trong danh sách hội thoại với so sánh String an toàn
                    let freshRepliedName = message.replyTo.senderName;
                    for (const conv of conversations) {
                      const found = (conv.members || []).find(m => String(m.userId || m.id || '') === repliedUserId);
                      if (found) {
                        freshRepliedName = found.fullName || found.name || found.username;
                        break;
                      }
                    }
                    return freshRepliedName;
                  })()}
                </Text>
                <Text style={styles.replyText} numberOfLines={1}>{message.replyTo.content}</Text>
              </View>
            </View>
          )}

          <Text style={[styles.text, isOwn ? styles.ownText : styles.otherText]}>
            {message.isRecalled ? '[Tin nhắn đã thu hồi]' : message.content}
          </Text>
        </View>
        
        {renderReactions()}
        
        <Text style={styles.time}>{formatTime(message.createdAt || Date.now())}</Text>
      </TouchableOpacity>

      <Modal visible={reactionModalVisible} transparent animationType="fade" onRequestClose={closeReactionDetail}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Chi tiết cảm xúc</Text>
              <TouchableOpacity onPress={closeReactionDetail} style={styles.closeButton}>
                <Ionicons name="close" size={22} color="#fff" />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <View style={styles.modalEmojiColumn}>
                {Object.entries(message.reactions || {}).map(([emoji, users]) => (
                  <TouchableOpacity
                    key={emoji}
                    style={[styles.modalEmojiButton, selectedReactionEmoji === emoji && styles.modalEmojiButtonActive]}
                    onPress={() => setSelectedReactionEmoji(emoji)}
                  >
                    <Text style={styles.modalEmoji}>{emoji}</Text>
                    <Text style={styles.modalEmojiCount}>{Array.isArray(users) ? users.length : 0}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.modalUserColumn}>
                <Text style={styles.modalSectionLabel}>Người đã chọn</Text>
                <ScrollView contentContainerStyle={styles.modalUserList}>
                  {(reactionUserNamesFor(selectedReactionEmoji) || []).length > 0 ? (
                    reactionUserNamesFor(selectedReactionEmoji).map((name, index) => (
                      <View key={`${selectedReactionEmoji}-${index}`} style={styles.modalUserItem}>
                        <Text style={styles.modalUserText}>{name}</Text>
                      </View>
                    ))
                  ) : (
                    <View style={styles.modalUserItem}>
                      <Text style={styles.modalUserText}>Chưa có ai phản ứng</Text>
                    </View>
                  )}
                </ScrollView>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </Animated.View>
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
  
  // Reply styles
  replyBubble: {
    flexDirection: 'row',
    borderRadius: 8,
    padding: 8,
    marginBottom: 6,
    minWidth: 150,
    alignSelf: 'stretch',
  },
  ownReplyBubble: {
    backgroundColor: 'rgba(255, 255, 255, 1)',
  },
  otherReplyBubble: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  replyLine: {
    width: 3,
    backgroundColor: '#667eea',
    borderRadius: 2,
    marginRight: 8,
  },
  replyContent: {
    flex: 1,
    justifyContent: 'center',
  },
  replySender: {
    fontSize: 12,
    fontWeight: '700',
    color: '#667eea',
    marginBottom: 2,
  },
  replyText: {
    fontSize: 12,
    color: '#6b7280',
  },

  // Reactions
  reactionsContainer: {
    flexDirection: 'row',
    marginTop: -8,
    flexWrap: 'wrap',
  },
  ownReactions: {
    alignSelf: 'flex-end',
    marginRight: 8,
  },
  otherReactions: {
    alignSelf: 'flex-start',
    marginLeft: 8,
  },
  reactionBadgeWrapper: {
    marginRight: 6,
    marginBottom: 4,
    alignItems: 'flex-start',
  },
  reactionBadge: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  reactionDetails: {
    marginTop: 2,
    backgroundColor: '#f9fafb',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    maxWidth: 200,
  },
  reactionDetailsText: {
    fontSize: 10,
    color: '#374151',
  },
  reactionEmoji: {
    fontSize: 12,
  },
  reactionCount: {
    fontSize: 10,
    fontWeight: '700',
    marginLeft: 2,
    color: '#6b7280',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    width: '100%',
    maxWidth: 520,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#0f172a',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  modalTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  closeButton: {
    padding: 8,
  },
  modalBody: {
    flexDirection: 'row',
    minHeight: 220,
  },
  modalEmojiColumn: {
    width: 90,
    paddingVertical: 14,
    paddingHorizontal: 10,
    backgroundColor: '#111827',
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.08)',
  },
  modalEmojiButton: {
    marginBottom: 10,
    backgroundColor: '#0f172a',
    borderRadius: 18,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  modalEmojiButtonActive: {
    backgroundColor: '#2563eb',
  },
  modalEmoji: {
    fontSize: 20,
  },
  modalEmojiCount: {
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 4,
  },
  modalUserColumn: {
    flex: 1,
    padding: 16,
  },
  modalSectionLabel: {
    color: '#94a3b8',
    marginBottom: 12,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  modalUserList: {
    paddingBottom: 18,
  },
  modalUserItem: {
    marginBottom: 10,
    backgroundColor: '#1e293b',
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  modalUserText: {
    color: '#fff',
    fontSize: 14,
  },
});

export default ChatBubble;
