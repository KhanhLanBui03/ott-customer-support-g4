import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Pressable, Platform, Image } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { MaterialIcons } from '@expo/vector-icons';
import { clearInAppNotification } from '../../store/notificationSlice';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

const InAppNotification = () => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { inAppNotification } = useSelector((state) => state.notifications);
  const slideAnim = useRef(new Animated.Value(-150)).current;

  useEffect(() => {
    if (inAppNotification) {
      // Slide down
      Animated.spring(slideAnim, {
        toValue: insets.top + 10,
        useNativeDriver: true,
        bounciness: 8,
      }).start();

      // Auto hide after 5 seconds
      const timer = setTimeout(() => {
        hideNotification();
      }, 5000);

      return () => clearTimeout(timer);
    } else {
      // Slide up
      Animated.timing(slideAnim, {
        toValue: -150,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [inAppNotification]);

  const hideNotification = () => {
    Animated.timing(slideAnim, {
      toValue: -150,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      dispatch(clearInAppNotification());
    });
  };

  const handlePress = () => {
    if (inAppNotification?.conversationId) {
      router.push(`/chat/${encodeURIComponent(inAppNotification.conversationId)}`);
      hideNotification();
    }
  };

  if (!inAppNotification) return null;

  return (
    <Animated.View 
      style={[
        styles.container, 
        { transform: [{ translateY: slideAnim }] }
      ]}
    >
      <Pressable onPress={handlePress} style={styles.content}>
        <View style={styles.iconContainer}>
          {inAppNotification.avatarUrl ? (
            <Image source={{ uri: inAppNotification.avatarUrl }} style={styles.avatar} />
          ) : (
            <MaterialIcons name="chat" size={24} color="#6366f1" />
          )}
        </View>
        <View style={styles.textContainer}>
          <Text style={styles.title} numberOfLines={1}>
            {inAppNotification.title || t('chat.title', 'Tin nhắn mới')}
          </Text>
          <Text style={styles.message} numberOfLines={1}>
            {(() => {
              const msg = inAppNotification.message || '';
              if (!msg) return t('components.common.new_message_notif', 'Bạn có một tin nhắn mới');
              const lower = msg.toLowerCase();
              if (lower === 'tin nhắn thoại' || lower === '[tin nhắn thoại]') return t('chat.voice_bracket', '[Tin nhắn thoại]');
              if (lower === '[sticker]' || lower === '[nhãn dán]') return t('sidebar.sticker', '[Sticker]');
              if (lower === '[gif]') return t('sidebar.gif', '[GIF]');
              if (lower === '[hình ảnh]' || lower === '[image]') return t('chat.image_bracket', '[Hình ảnh]');
              if (lower === '[video]') return t('chat.video_preview', '[Video]');
              if (lower === '[tệp tin]' || lower === '[file]') return t('chat.file_bracket', '[Tệp tin]');
              if (lower === '[bình chọn]') return t('chat.poll', '[Bình chọn]');
              if (lower === 'đã gửi một tệp đính kèm') return t('chat.attachment', 'Đã gửi một tệp đính kèm');
              return msg;
            })()}
          </Text>
        </View>
        <Pressable onPress={hideNotification} style={styles.closeButton}>
          <MaterialIcons name="close" size={20} color="#94a3b8" />
        </Pressable>
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 9999,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
    borderWidth: 1,
    borderColor: 'rgba(226, 232, 240, 0.8)',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  textContainer: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1e293b',
  },
  message: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  closeButton: {
    padding: 4,
  },
});

export default InAppNotification;
