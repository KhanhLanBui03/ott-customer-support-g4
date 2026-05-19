import React from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
  Animated,
  TouchableWithoutFeedback,
  Platform,
} from 'react-native';

import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const UserActionModal = ({ visible, onClose, user, onMention, onMessage, onCall }) => {
  const { colors, isDark } = useTheme();
  const slideAnim = React.useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  React.useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 50,
        friction: 8,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: SCREEN_HEIGHT,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  if (!user && visible) return null;

  const handleAction = (callback) => {
    onClose();
    setTimeout(() => {
      callback && callback(user);
    }, 300);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={styles.backdrop} />
        </TouchableWithoutFeedback>

        <Animated.View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.card,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <View style={[styles.dragHandle, { backgroundColor: isDark ? '#334155' : '#e2e8f0' }]} />

          <View style={styles.header}>
            <View style={[styles.avatarContainer, { borderColor: colors.background }]}>
              <Image
                source={{
                  uri: user?.avatarUrl || user?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.fullName || 'U')}&background=random&color=fff&size=200`,
                }}
                style={styles.avatar}
              />
              <View style={[styles.statusDot, { backgroundColor: user?.isOnline ? '#10b981' : '#9ca3af', borderColor: colors.card }]} />
            </View>
            <Text style={[styles.userName, { color: colors.foreground }]}>{user?.fullName || 'Người dùng'}</Text>
            <Text style={[styles.userStatus, { color: colors.textSubtle }]}>
              {user?.isOnline ? 'Đang hoạt động' : 'Ngoại tuyến'}
            </Text>
          </View>

          <View style={styles.actionsGrid}>
            <TouchableOpacity 
              style={[styles.actionItem, { backgroundColor: isDark ? colors.surface200 : '#f8fafc' }]}
              onPress={() => handleAction(onMention)}
            >
              <View style={[styles.iconCircle, { backgroundColor: 'rgba(99, 102, 241, 0.1)' }]}>
                <MaterialIcons name="alternate-email" size={24} color="#6366f1" />
              </View>
              <Text style={[styles.actionLabel, { color: colors.foreground }]}>@ Nhắc đến</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.actionItem, { backgroundColor: isDark ? colors.surface200 : '#f8fafc' }]}
              onPress={() => handleAction(onMessage)}
            >
              <View style={[styles.iconCircle, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}>
                <Ionicons name="chatbubble-ellipses-outline" size={24} color="#10b981" />
              </View>
              <Text style={[styles.actionLabel, { color: colors.foreground }]}>Nhắn tin riêng</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.actionItem, { backgroundColor: isDark ? colors.surface200 : '#f8fafc' }]}
              onPress={() => handleAction(onCall)}
            >
              <View style={[styles.iconCircle, { backgroundColor: 'rgba(59, 130, 246, 0.1)' }]}>
                <Ionicons name="call-outline" size={24} color="#3b82f6" />
              </View>
              <Text style={[styles.actionLabel, { color: colors.foreground }]}>Gọi điện thoại</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={[styles.cancelButton, { backgroundColor: isDark ? colors.surface300 : '#f1f5f9' }]} onPress={onClose}>
            <Text style={[styles.cancelText, { color: colors.textMuted }]}>Đóng</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  sheet: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 20,
  },
  dragHandle: {
    width: 40,
    height: 5,
    borderRadius: 2.5,
    alignSelf: 'center',
    marginBottom: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
    padding: 4,
    borderWidth: 1,
    borderRadius: 54,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  statusDot: {
    position: 'absolute',
    bottom: 5,
    right: 5,
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 3,
  },
  userName: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 4,
  },
  userStatus: {
    fontSize: 14,
    fontWeight: '500',
  },
  actionsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
    gap: 12,
  },
  actionItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 20,
    borderRadius: 24,
    gap: 12,
  },
  iconCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  cancelButton: {
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '700',
  },
});

export default UserActionModal;
