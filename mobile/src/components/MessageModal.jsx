import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Dimensions,
  Image,
  ScrollView,
} from 'react-native';
import { MaterialIcons, Ionicons, FontAwesome5, Feather } from '@expo/vector-icons';

import { useSelector } from 'react-redux';
import CONFIG from '../config';

const { width, height } = Dimensions.get('window');

const EMOJIS = ['❤️', '👍', '😂', '😮', '😢', '😡'];

const MessageModal = ({ visible, message, onClose, onAction, onReact, isOwn }) => {
  const BASE_URL = CONFIG.API_URL.split('/api')[0];
  if (!message) return null;

  const handleAction = (type) => {
    onAction(type, message);
    onClose();
  };

  const handleReact = (emoji) => {
    onReact(message.messageId, emoji);
    onClose();
  };

  const MenuButton = ({ icon, label, color = '#333', type, iconType = 'material' }) => (
    <TouchableOpacity style={styles.menuItem} onPress={() => handleAction(type)}>
      <View style={styles.menuIconContainer}>
        {iconType === 'material' && <MaterialIcons name={icon} size={24} color={color} />}
        {iconType === 'ionicons' && <Ionicons name={icon} size={24} color={color} />}
        {iconType === 'feather' && <Feather name={icon} size={24} color={color} />}
      </View>
      <Text style={styles.menuLabel}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.modalContent}>
              {/* Message Focus Area */}
              <View style={[styles.focusContainer, isOwn ? styles.ownFocus : styles.otherFocus]}>
                <View style={[
                  styles.bubble, 
                  isOwn ? styles.ownBubble : styles.otherBubble, 
                  (message.type === 'IMAGE' || message.type === 'VIDEO') && styles.mediaBubble,
                  message.type === 'FILE' && styles.fileBubbleModal
                ]}>
                  {/* Image/Video Preview */}
                  {message.type === 'IMAGE' && message.mediaUrls?.[0] && (
                    <Image 
                      source={{ uri: message.mediaUrls[0].startsWith('http') ? message.mediaUrls[0] : `${BASE_URL}${message.mediaUrls[0].startsWith('/') ? '' : '/'}${message.mediaUrls[0]}` }} 
                      style={styles.focusMedia}
                      resizeMode="cover"
                    />
                  )}
                  {message.type === 'VIDEO' && (
                    <View style={styles.focusVideoPlaceholder}>
                      <Ionicons name="play-circle" size={48} color="#fff" />
                    </View>
                  )}

                  {/* File Preview */}
                  {message.type === 'FILE' && (
                    <View style={styles.fileRow}>
                      <View style={[styles.fileIcon, { backgroundColor: '#6366f1' }]}>
                        <MaterialIcons name="insert-drive-file" size={24} color="#fff" />
                      </View>
                      <View style={styles.fileInfo}>
                        <Text style={[styles.fileName, { color: isOwn ? '#fff' : '#1e293b' }]} numberOfLines={1}>
                          {(message.mediaUrls?.[0] || 'file').split('/').pop().split('?')[0].replace(/^[0-9a-f-]{36}_/, '')}
                        </Text>
                        <Text style={[styles.fileSize, { color: isOwn ? 'rgba(255,255,255,0.7)' : '#64748b' }]}>
                          FILE • 22 KB
                        </Text>
                      </View>
                    </View>
                  )}

                  {/* Voice Preview */}
                  {message.type === 'VOICE' && (
                    <View style={styles.voiceRow}>
                      <MaterialIcons name="mic" size={24} color={isOwn ? '#fff' : '#6366f1'} />
                      <View style={styles.voiceWaves}>
                        {[1, 2, 3, 4, 5].map(i => (
                          <View key={i} style={[styles.voiceWave, { height: 10 + Math.random() * 15, backgroundColor: isOwn ? 'rgba(255,255,255,0.5)' : 'rgba(99, 102, 241, 0.3)' }]} />
                        ))}
                      </View>
                      <Text style={[styles.voiceDuration, { color: isOwn ? '#fff' : '#64748b' }]}>0:05</Text>
                    </View>
                  )}

                  {/* Text Content - Hidden for VOICE to avoid showing raw URLs */}
                  {message.content && message.type !== 'VOICE' ? (
                    <Text style={[
                      styles.messageText, 
                      isOwn ? styles.ownText : styles.otherText, 
                      (message.type === 'IMAGE' || message.type === 'VIDEO' || message.type === 'FILE') && { marginTop: 8 }
                    ]}>
                      {message.content}
                    </Text>
                  ) : null}
                </View>
              </View>

              {/* Emoji Bar */}
              <View style={styles.emojiBar}>
                {EMOJIS.map((emoji) => (
                  <TouchableOpacity
                    key={emoji}
                    style={styles.emojiButton}
                    onPress={() => handleReact(emoji)}
                  >
                    <Text style={styles.emojiText}>{emoji}</Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity style={styles.emojiMore}>
                  <MaterialIcons name="add" size={20} color="#666" />
                </TouchableOpacity>
              </View>

              {/* Menu Grid */}
              <View style={styles.menuGrid}>
                <View style={styles.menuRow}>
                  <MenuButton icon="reply" label="Trả lời" type="reply" color="#6366f1" />
                  <MenuButton icon="content-copy" label="Sao chép" type="copy" color="#6b7280" />
                  <MenuButton icon="arrow-forward" label="Chuyển tiếp" type="forward" color="#3b82f6" />
                  <MenuButton icon="share" label="Chia sẻ" type="share" color="#8b5cf6" />
                </View>
                <View style={styles.menuRow}>
                  <MenuButton icon="push-pin" label="Ghim" type="pin" color="#f59e0b" />
                  <MenuButton icon="folder-open" label="Lưu tin nhắn" type="save" color="#10b981" />
                  <MenuButton icon="notifications" label="Nhắc hẹn" type="remind" color="#ec4899" />
                  <MenuButton icon="info" label="Chi tiết" type="info" color="#6b7280" />
                </View>
                <View style={styles.menuRow}>
                  {isOwn && (
                    <MenuButton icon="history" label="Thu hồi" type="recall" color="#ef4444" />
                  )}
                  <MenuButton icon="delete" label="Xóa ở tôi" type="delete" color="#ef4444" />
                  <MenuButton icon="g-translate" label="Dịch" type="translate" color="#10b981" />
                  <MenuButton icon="check-box" label="Chọn nhiều" type="select" color="#8b5cf6" />
                </View>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: width * 0.9,
    alignItems: 'center',
  },
  focusContainer: {
    width: '100%',
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  ownFocus: {
    alignItems: 'flex-end',
  },
  otherFocus: {
    alignItems: 'flex-start',
  },
  bubble: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 20,
    maxWidth: '85%',
  },
  ownBubble: {
    backgroundColor: '#667eea',
    borderBottomRightRadius: 4,
  },
  otherBubble: {
    backgroundColor: '#fff',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  ownText: {
    color: '#fff',
  },
  otherText: {
    color: '#000',
  },
  emojiBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 30,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 15,
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  emojiButton: {
    paddingHorizontal: 8,
  },
  emojiText: {
    fontSize: 28,
  },
  emojiMore: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 5,
  },
  menuGrid: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 15,
    elevation: 5,
  },
  menuRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  menuItem: {
    width: (width * 0.9 - 60) / 4,
    alignItems: 'center',
  },
  menuIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f8fafc',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  menuLabel: {
    fontSize: 11,
    color: '#475569',
    textAlign: 'center',
  },
  mediaBubble: {
    padding: 4,
    overflow: 'hidden',
    width: width * 0.7,
  },
  focusMedia: {
    width: '100%',
    height: width * 0.7,
    borderRadius: 16,
  },
  focusVideoPlaceholder: {
    width: '100%',
    height: 180,
    backgroundColor: '#1f2937',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fileBubbleModal: {
    minWidth: 240,
    padding: 12,
  },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  fileIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  fileInfo: {
    flex: 1,
  },
  fileName: {
    fontSize: 15,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  fileSize: {
    fontSize: 12,
  },
  voiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 200,
    height: 40,
  },
  voiceWaves: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    marginHorizontal: 12,
  },
  voiceWave: {
    width: 3,
    borderRadius: 1.5,
  },
  voiceDuration: {
    fontSize: 12,
    fontWeight: '600',
  },
});

export default MessageModal;
