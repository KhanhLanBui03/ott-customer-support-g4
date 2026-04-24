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

const { width, height } = Dimensions.get('window');

const EMOJIS = ['❤️', '👍', '😂', '😮', '😢', '😡'];

const MessageModal = ({ visible, message, onClose, onAction, onReact, isOwn }) => {
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
                <View style={[styles.bubble, isOwn ? styles.ownBubble : styles.otherBubble]}>
                  <Text style={[styles.messageText, isOwn ? styles.ownText : styles.otherText]}>
                    {message.content}
                  </Text>
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
                  <MenuButton icon="arrow-forward" label="Chuyển tiếp" type="forward" color="#3b82f6" />
                  <MenuButton icon="folder-open" label="Lưu tin nhắn" type="save" color="#10b981" />
                  <MenuButton icon="content-copy" label="Sao chép" type="copy" color="#6b7280" />
                </View>
                <View style={styles.menuRow}>
                  <MenuButton icon="push-pin" label="Ghim" type="pin" color="#f59e0b" />
                  <MenuButton icon="notifications" label="Nhắc hẹn" type="remind" color="#ec4899" />
                  <MenuButton icon="check-box" label="Chọn nhiều" type="select" color="#8b5cf6" />
                  <MenuButton icon="flash-on" label="Tin nhanh" type="quick" color="#06b6d4" />
                </View>
                <View style={styles.menuRow}>
                  <MenuButton icon="g-translate" label="Dịch" type="translate" color="#10b981" />
                  <MenuButton icon="visibility" label="Đọc văn bản" type="read" color="#f43f5e" />
                  <MenuButton icon="info" label="Chi tiết" type="info" color="#6b7280" />
                  <MenuButton icon="delete" label="Xóa" type="delete" color="#ef4444" />
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
});

export default MessageModal;
