import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  Alert,
  Platform,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { useDispatch, useSelector } from 'react-redux';
import { getRealId, updateConversationWallpaper } from '../../../src/store/chatSlice';
import { conversationApi } from '../../../src/api/chatApi';
import { mediaApi } from '../../../src/api/mediaApi';

const ChatInfoScreen = () => {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id: encodedId } = useLocalSearchParams();
  const conversationId = decodeURIComponent(encodedId || '');
  
  const chatState = useSelector((state) => state.chat);
  const currentUser = useSelector((state) => state.auth.user);
  const dispatch = useDispatch();

  const realId = useMemo(() => {
    return getRealId(chatState, conversationId, currentUser?.userId || currentUser?.id);
  }, [chatState, conversationId, currentUser]);

  const conversation = (chatState.conversations || []).find(c => c.conversationId === realId);
  const [isWallpaperLoading, setIsWallpaperLoading] = useState(false);
  const wallpaperUrl = conversation?.wallpaperUrl || null;

  const otherParticipant = useMemo(() => {
    if (!conversation?.members) return null;
    return conversation.members.find(p => p.userId !== (currentUser?.userId || currentUser?.id));
  }, [conversation, currentUser]);

  const displayName = otherParticipant?.fullName || otherParticipant?.name || conversation?.name || 'Thông tin hội thoại';
  const avatarUrl = otherParticipant?.avatarUrl || otherParticipant?.avatar || otherParticipant?.profilePic || conversation?.avatarUrl || conversation?.avatar;
  const isOnline = otherParticipant?.status === 'ONLINE' || otherParticipant?.isOnline === true;

  const handleWallpaperChange = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Quyền truy cập bị từ chối', 'Vui lòng cấp quyền truy cập ảnh.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.7,
      });

      if (result.canceled || !result.assets?.[0]) return;

      const targetId = realId || conversationId;
      const localUri = result.assets[0].uri;
      setIsWallpaperLoading(true);

      const fileName = localUri.split('/').pop();
      const match = /\.([a-zA-Z0-9]+)$/.exec(fileName || '');
      const fileType = match ? `image/${match[1].toLowerCase()}` : 'image/jpeg';

      const formData = new FormData();
      formData.append('file', {
        uri: Platform.OS === 'ios' ? localUri.replace('file://', '') : localUri,
        name: fileName || 'wallpaper.jpg',
        type: fileType,
      });

      const uploadRes = await mediaApi.uploadMedia(formData, 'chat-wallpaper');
      const uploadedUrl = uploadRes?.data?.data?.mediaUrl || uploadRes?.data?.mediaUrl || uploadRes?.mediaUrl || uploadRes?.url || uploadRes?.data?.url;

      if (!uploadedUrl) throw new Error('No URL');

      await conversationApi.updateConversationWallpaper(targetId, uploadedUrl);
      dispatch(updateConversationWallpaper({ conversationId: targetId, wallpaperUrl: uploadedUrl }));

      console.log('✅ [WALLPAPER] Updated successfully');
      Alert.alert('Thành công', 'Đã cập nhật ảnh nền.');
    } catch (error) {
      console.error('❌ [WALLPAPER] Update Error:', error);
      Alert.alert('Lỗi', 'Không thể cập nhật ảnh nền.');
    } finally {
      setIsWallpaperLoading(false);
    }
  };

  const handleClearWallpaper = async () => {
    const targetId = realId || conversationId;
    setIsWallpaperLoading(true);
    try {
      await conversationApi.updateConversationWallpaper(targetId, null);
      dispatch(updateConversationWallpaper({ conversationId: targetId, wallpaperUrl: null }));
      console.log('✅ [WALLPAPER] Cleared successfully');
      Alert.alert('Thành công', 'Đã xóa ảnh nền.');
    } catch (error) {
      Alert.alert('Lỗi', 'Không thể xóa ảnh nền.');
    } finally {
      setIsWallpaperLoading(false);
    }
  };

  const InfoItem = ({ icon, label, onPress, color = '#fff', showArrow = true }) => (
    <Pressable
      style={({ pressed }) => [styles.infoItem, { opacity: pressed ? 0.6 : 1 }]}
      onPress={onPress}
    >
      <View style={styles.infoItemLeft}>
        <View style={styles.iconContainer}>{icon}</View>
        <Text style={[styles.infoItemLabel, { color }]}>{label}</Text>
      </View>
      {showArrow && <MaterialIcons name="chevron-right" size={24} color="#4b5563" />}
    </Pressable>
  );

  const SectionHeader = ({ title }) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionHeaderText}>{title}</Text>
    </View>
  );

  const finalAvatarUrl = avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=667eea&color=fff&size=256&bold=true`;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="close" size={28} color="#fff" />
        </Pressable>
        <Text style={styles.headerTitle}>Thông tin hội thoại</Text>
        <View style={{ width: 48 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarWrapper}>
            <Image source={{ uri: finalAvatarUrl }} style={styles.avatar} />
            {isOnline && <View style={styles.onlineBadge} />}
          </View>
          <Text style={styles.userName}>{displayName}</Text>
          <View style={[styles.statusBadge, isOnline ? styles.statusActive : styles.statusInactive]}>
            <Text style={styles.statusText}>{isOnline ? 'ĐANG HOẠT ĐỘNG' : 'NGOẠI TUYẾN'}</Text>
          </View>
        </View>

        {/* Media & Files */}
        <View style={styles.section}>
          <InfoItem
            icon={<MaterialIcons name="image" size={22} color="#94a3b8" />}
            label="ẢNH/VIDEO ĐÃ CHIA SẺ"
            onPress={() => {}}
          />
          <InfoItem
            icon={<MaterialIcons name="insert-drive-file" size={22} color="#94a3b8" />}
            label="FILE ĐÃ CHIA SẺ"
            onPress={() => {}}
          />
        </View>

        {/* Interface Customization */}
        <SectionHeader title="TÙY CHỈNH GIAO DIỆN" />

        {wallpaperUrl && (
          <View style={styles.previewContainer}>
            <View style={styles.wallpaperPreviewCard}>
              <Image source={{ uri: wallpaperUrl }} style={styles.wallpaperPreviewImage} />
              <View style={styles.previewOverlay}>
                <Text style={styles.previewText}>Ảnh nền hiện tại</Text>
              </View>
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Pressable
            onPress={handleWallpaperChange}
            disabled={isWallpaperLoading}
            style={({ pressed }) => [
              styles.customActionCard,
              { opacity: (pressed || isWallpaperLoading) ? 0.7 : 1 }
            ]}
          >
            <View style={[styles.customActionIcon, { backgroundColor: '#4f46e5' }]}>
              <MaterialIcons name="wallpaper" size={22} color="#fff" />
            </View>
            <View style={styles.customActionContent}>
              <Text style={styles.customActionTitle}>Thay đổi ảnh nền</Text>
              <Text style={styles.customActionSub}>
                {isWallpaperLoading ? 'Đang tải...' : 'Tùy chỉnh hình nền cho cuộc trò chuyện'}
              </Text>
            </View>
          </Pressable>

          <Pressable
            onPress={handleClearWallpaper}
            disabled={isWallpaperLoading || !wallpaperUrl}
            style={({ pressed }) => [
              styles.deleteAction,
              { opacity: (pressed || !wallpaperUrl) ? 0.5 : 1 }
            ]}
          >
            <View style={styles.deleteActionIcon}>
              <MaterialIcons name="delete-outline" size={22} color="#ef4444" />
            </View>
            <View style={styles.deleteActionContent}>
              <Text style={styles.deleteActionTitle}>Xóa ảnh nền</Text>
              <Text style={styles.deleteActionSub}>Quay về giao diện mặc định</Text>
            </View>
          </Pressable>
        </View>

        {/* Privacy */}
        <SectionHeader title="QUYỀN RIÊNG TƯ" />
        <View style={styles.section}>
          <InfoItem
            icon={<MaterialIcons name="history" size={22} color="#ef4444" />}
            label="Xóa lịch sử trò chuyện"
            color="#ef4444"
            onPress={() => {}}
            showArrow={false}
          />
        </View>

        <View style={{ height: 40 + insets.bottom }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
  backButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  content: { flex: 1 },
  profileCard: { alignItems: 'center', paddingVertical: 40 },
  avatarWrapper: { position: 'relative', marginBottom: 20 },
  avatar: { width: 120, height: 120, borderRadius: 60, borderWidth: 4, borderColor: '#1e293b' },
  onlineBadge: {
    position: 'absolute',
    right: 5,
    bottom: 5,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#10b981',
    borderWidth: 3,
    borderColor: '#0f172a',
  },
  userName: { fontSize: 24, fontWeight: '800', color: '#fff', marginBottom: 12 },
  statusBadge: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20 },
  statusActive: { backgroundColor: 'rgba(16, 185, 129, 0.1)' },
  statusInactive: { backgroundColor: 'rgba(148, 163, 184, 0.1)' },
  statusText: { fontSize: 12, fontWeight: '700', color: '#10b981', letterSpacing: 1 },
  section: { paddingHorizontal: 16 },
  sectionHeader: { paddingHorizontal: 20, paddingVertical: 15, marginTop: 10 },
  sectionHeaderText: { fontSize: 13, fontWeight: '700', color: '#94a3b8', letterSpacing: 0.5 },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  infoItemLeft: { flexDirection: 'row', alignItems: 'center' },
  iconContainer: { width: 32, alignItems: 'center' },
  infoItemLabel: { fontSize: 15, fontWeight: '600', marginLeft: 12 },

  previewContainer: { paddingHorizontal: 16, marginBottom: 16 },
  wallpaperPreviewCard: { borderRadius: 20, overflow: 'hidden', height: 160, position: 'relative', borderWidth: 1, borderColor: '#1e293b' },
  wallpaperPreviewImage: { width: '100%', height: '100%' },
  previewOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.6)', padding: 10 },
  previewText: { color: '#fff', fontSize: 13, textAlign: 'center', fontWeight: '600' },

  customActionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    padding: 16,
    borderRadius: 20,
    marginBottom: 16,
  },
  customActionIcon: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  customActionContent: { flex: 1, marginLeft: 16 },
  customActionTitle: { fontSize: 15, fontWeight: '700', color: '#fff' },
  customActionSub: { fontSize: 12, color: '#94a3b8', marginTop: 2 },

  deleteAction: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 4 },
  deleteActionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteActionContent: { flex: 1, marginLeft: 16 },
  deleteActionTitle: { fontSize: 15, fontWeight: '700', color: '#ef4444' },
  deleteActionSub: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
});

export default ChatInfoScreen;
