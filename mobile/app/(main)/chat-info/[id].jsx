import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  Alert,
  Platform,
  TouchableOpacity,
  Pressable,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { useDispatch, useSelector } from 'react-redux';
import { getRealId, updateConversationWallpaper, updateConversation, removeMemberLocal, updateMemberRoleLocal } from '../../../src/store/chatSlice';
import { conversationApi } from '../../../src/api/chatApi';
import { mediaApi } from '../../../src/api/mediaApi';
import InviteMemberModal from '../../../src/components/chat/InviteMemberModal';

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
  const [isAvatarLoading, setIsAvatarLoading] = useState(false);
  const [isInviteModalVisible, setIsInviteModalVisible] = useState(false);
  const wallpaperUrl = conversation?.wallpaperUrl || null;

  const otherParticipant = useMemo(() => {
    if (!conversation?.members) return null;
    return conversation.members.find(p => p.userId !== (currentUser?.userId || currentUser?.id));
  }, [conversation, currentUser]);

  const isGroup = conversation?.type === 'GROUP';
  const displayName = isGroup ? (conversation?.name || 'Nhóm chat') : (otherParticipant?.fullName || otherParticipant?.name || 'Thông tin hội thoại');
  const avatarUrl = isGroup ? conversation?.avatarUrl : (otherParticipant?.avatarUrl || otherParticipant?.avatar || otherParticipant?.profilePic);
  const isOnline = !isGroup && (otherParticipant?.status === 'ONLINE' || otherParticipant?.isOnline === true);

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

      Alert.alert('Thành công', 'Đã cập nhật ảnh nền.');
    } catch (error) {
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
      Alert.alert('Thành công', 'Đã xóa ảnh nền.');
    } catch (error) {
      Alert.alert('Lỗi', 'Không thể xóa ảnh nền.');
    } finally {
      setIsWallpaperLoading(false);
    }
  };

  const handleAvatarChange = async () => {
    if (!isGroup || !isAdmin) return;

    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Quyền truy cập bị từ chối', 'Vui lòng cấp quyền truy cập ảnh.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });

      if (result.canceled || !result.assets?.[0]) return;

      setIsAvatarLoading(true);
      const localUri = result.assets[0].uri;
      const fileName = localUri.split('/').pop();
      const match = /\.([a-zA-Z0-9]+)$/.exec(fileName || '');
      const fileType = match ? `image/${match[1].toLowerCase()}` : 'image/jpeg';

      const formData = new FormData();
      formData.append('file', {
        uri: Platform.OS === 'ios' ? localUri.replace('file://', '') : localUri,
        name: fileName || 'avatar.jpg',
        type: fileType,
      });

      const uploadRes = await mediaApi.uploadMedia(formData, 'conversation-avatars');
      const uploadedUrl = uploadRes?.data?.data?.mediaUrl || uploadRes?.data?.mediaUrl || uploadRes?.mediaUrl || uploadRes?.url || uploadRes?.data?.url;

      if (!uploadedUrl) throw new Error('No URL');

      await conversationApi.updateAvatar(realId, uploadedUrl);

      // Cập nhật local store
      dispatch(updateConversation({
        conversationId: realId,
        avatarUrl: uploadedUrl
      }));

      Alert.alert('Thành công', 'Đã cập nhật ảnh đại diện nhóm.');
    } catch (error) {
      console.error('[AvatarChangeError]', error);
      Alert.alert('Lỗi', 'Không thể cập nhật ảnh đại diện nhóm.');
    } finally {
      setIsAvatarLoading(false);
    }
  };

  const handleLeaveGroup = () => {
    Alert.alert(
      'Xác nhận',
      'Bạn có chắc chắn muốn rời khỏi nhóm này?',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Rời nhóm',
          style: 'destructive',
          onPress: async () => {
            try {
              await conversationApi.deleteConversationForMe(realId);
              router.replace('/(main)');
            } catch (err) {
              Alert.alert('Lỗi', 'Không thể rời nhóm lúc này.');
            }
          }
        }
      ]
    );
  };

  const handleDisbandGroup = () => {
    Alert.alert(
      'Giải tán nhóm',
      'Bạn có chắc chắn muốn giải tán nhóm này? Toàn bộ tin nhắn và thành viên sẽ bị xóa.',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Giải tán',
          style: 'destructive',
          onPress: async () => {
            try {
              await conversationApi.disbandGroup(realId);
              router.replace('/(main)');
            } catch (err) {
              Alert.alert('Lỗi', 'Không thể giải tán nhóm lúc này.');
            }
          }
        }
      ]
    );
  };

  // Local state cho Switch để mượt mà 100%
  const [isRestrictedLocal, setIsRestrictedLocal] = useState(conversation?.onlyAdminsCanChat || false);

  // Đồng bộ local state khi conversation từ Redux thay đổi (ví dụ do WebSocket hoặc API khác)
  React.useEffect(() => {
    if (conversation?.onlyAdminsCanChat !== undefined) {
      setIsRestrictedLocal(conversation.onlyAdminsCanChat);
    }
  }, [conversation?.onlyAdminsCanChat]);

  const handleToggleChatRestriction = async () => {
    const originalValue = isRestrictedLocal;
    const newValue = !originalValue;

    // 1. Cập nhật UI ngay lập tức qua local state
    setIsRestrictedLocal(newValue);

    // 2. Cập nhật Redux ngay lập tức (Optimistic Update)
    dispatch(updateConversation({
      conversationId: realId,
      onlyAdminsCanChat: newValue
    }));

    try {
      // 3. Gọi API trong background
      await conversationApi.toggleChatRestriction(realId);
    } catch (err) {
      // 4. Rollback nếu lỗi
      setIsRestrictedLocal(originalValue);
      dispatch(updateConversation({
        conversationId: realId,
        onlyAdminsCanChat: originalValue
      }));
      Alert.alert('Lỗi', 'Không thể thay đổi quyền gửi tin nhắn. Vui lòng thử lại.');
    }
  };

  const handleMemberAction = (member) => {
    const memberId = String(member.userId || member.id);
    const isMemberAdmin = member.role === 'ADMIN';
    const isMemberOwner = member.role === 'OWNER';

    if (isMemberOwner) return; // Không thể thao tác với chủ nhóm

    const actions = [];

    // Nếu tôi là OWNER
    if (isOwner) {
      if (isMemberAdmin) {
        actions.push({
          text: 'Gỡ chức phó nhóm',
          onPress: () => updateMemberRole(memberId, 'MEMBER')
        });
      } else {
        actions.push({
          text: 'Bổ nhiệm phó nhóm',
          onPress: () => updateMemberRole(memberId, 'ADMIN')
        });
      }
      actions.push({
        text: 'Xóa khỏi nhóm',
        style: 'destructive',
        onPress: () => removeFromGroup(memberId, member.fullName)
      });
    }
    // Nếu tôi là ADMIN (phó nhóm)
    else if (myRole === 'ADMIN' && !isMemberAdmin) {
      actions.push({
        text: 'Xóa khỏi nhóm',
        style: 'destructive',
        onPress: () => removeFromGroup(memberId, member.fullName)
      });
    }

    if (actions.length > 0) {
      Alert.alert(
        member.fullName,
        'Chọn hành động quản lý thành viên',
        [...actions, { text: 'Đóng', style: 'cancel' }]
      );
    }
  };

  const updateMemberRole = async (userId, role) => {
    try {
      await conversationApi.assignRole(realId, userId, role);
      dispatch(updateMemberRoleLocal({ conversationId: realId, userId, role }));
      Alert.alert('Thành công', `Đã ${role === 'ADMIN' ? 'bổ nhiệm' : 'gỡ chức'} phó nhóm.`);
    } catch (err) {
      Alert.alert('Lỗi', 'Không thể cập nhật quyền thành viên.');
    }
  };

  const removeFromGroup = async (userId, name) => {
    Alert.alert(
      'Xác nhận',
      `Bạn có chắc chắn muốn xóa ${name} ra khỏi nhóm?`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa',
          style: 'destructive',
          onPress: async () => {
            try {
              await conversationApi.removeMember(realId, userId);
              dispatch(removeMemberLocal({ conversationId: realId, userId }));
              Alert.alert('Thành công', 'Đã xóa thành viên.');
            } catch (err) {
              Alert.alert('Lỗi', 'Không thể xóa thành viên.');
            }
          }
        }
      ]
    );
  };

  const InfoItem = ({ icon, label, description, onPress, color = '#fff', showArrow = true, rightElement, disabled }) => (
    <Pressable
      style={({ pressed }) => [
        styles.infoItem,
        disabled && styles.disabledOpacity,
        { opacity: (pressed && !disabled) ? 0.6 : 1 }
      ]}
      onPress={!disabled ? onPress : null}
    >
      <View style={styles.infoItemLeft}>
        <View style={styles.iconContainer}>{icon}</View>
        <View style={styles.privacyTextContainer}>
          <Text style={[styles.infoItemLabel, { color: disabled ? "#4b5563" : color, marginLeft: 0 }]}>{label}</Text>
          {description && <Text style={styles.disabledText}>{description}</Text>}
        </View>
      </View>
      {rightElement ? rightElement : (showArrow && <MaterialIcons name="chevron-right" size={24} color={disabled ? "#374151" : (color !== '#fff' ? color : "#4b5563")} />)}
    </Pressable>
  );

  const SectionHeader = ({ title }) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionHeaderText}>{title}</Text>
    </View>
  );

  const finalAvatarUrl = avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=667eea&color=fff&size=256&bold=true`;

  const myId = String(currentUser?.userId || currentUser?.id || '');
  const myRole = conversation?.members?.find(m => String(m.userId || m.id) === myId)?.role || 'MEMBER';
  const isOwner = myRole === 'OWNER';
  const isAdmin = myRole === 'ADMIN' || isOwner;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.replace(`/chat/${encodeURIComponent(realId)}`)} style={styles.backButton}>
          <Ionicons name="close" size={28} color="#fff" />
        </Pressable>
        <Text style={styles.headerTitle}>Thông tin {isGroup ? 'nhóm' : 'hội thoại'}</Text>
        <View style={{ width: 48 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Profile Card */}
        <View style={styles.profileCard}>
          <TouchableOpacity
            style={styles.avatarWrapper}
            onPress={handleAvatarChange}
            disabled={!isGroup || !isAdmin || isAvatarLoading}
          >
            <Image source={{ uri: finalAvatarUrl }} style={[styles.avatar, isAvatarLoading && { opacity: 0.5 }]} />
            {isOnline && <View style={styles.onlineBadge} />}
            {isGroup && isAdmin && (
              <View style={styles.avatarEditBadge}>
                <MaterialIcons name="camera-alt" size={16} color="#fff" />
              </View>
            )}
            {isAvatarLoading && (
              <View style={styles.avatarLoadingOverlay}>
                <ActivityIndicator color="#fff" size="small" />
              </View>
            )}
          </TouchableOpacity>
          <Text style={styles.userName}>{displayName}</Text>
          {isGroup ? (
            <Text style={styles.memberCountText}>{conversation?.members?.length || 0} thành viên</Text>
          ) : (
            <View style={[styles.statusBadge, isOnline ? styles.statusActive : styles.statusInactive]}>
              <Text style={styles.statusText}>{isOnline ? 'ĐANG HOẠT ĐỘNG' : 'NGOẠI TUYẾN'}</Text>
            </View>
          )}
        </View>

        {/* Members Section for Group */}
        {isGroup && (
          <>
            <SectionHeader title="THÀNH VIÊN NHÓM" />
            <View style={styles.section}>
              {isAdmin && (
                <InfoItem
                  icon={<MaterialIcons name="person-add" size={22} color="#667eea" />}
                  label="Thêm thành viên"
                  color="#667eea"
                  onPress={() => setIsInviteModalVisible(true)}
                />
              )}
              {conversation?.members?.map((member, idx) => (
                <View key={member.userId || idx} style={styles.memberItem}>
                  <Image
                    source={{ uri: member.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(member.fullName || 'U')}&background=667eea&color=fff&size=128&bold=true` }}
                    style={styles.memberAvatar}
                  />
                  <View style={styles.memberInfo}>
                    <Text style={styles.memberName}>{member.fullName}</Text>
                    <View style={styles.roleContainer}>
                      {member.role === 'OWNER' && <Text style={styles.roleBadgeOwner}>Trưởng nhóm</Text>}
                      {member.role === 'ADMIN' && <Text style={styles.roleBadgeAdmin}>Phó nhóm</Text>}
                    </View>
                  </View>
                  {isAdmin && String(member.userId || member.id) !== myId && (
                    <TouchableOpacity onPress={() => handleMemberAction(member)}>
                      <MaterialIcons name="more-vert" size={24} color="#94a3b8" />
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </View>
          </>
        )}

        {/* Media & Files */}
        <SectionHeader title="DỮ LIỆU CHIA SẺ" />
        <View style={styles.section}>
          <InfoItem
            icon={<MaterialIcons name="image" size={22} color="#94a3b8" />}
            label="ẢNH/VIDEO ĐÃ CHIA SẺ"
            onPress={() => router.push(`/shared-media/${encodeURIComponent(realId || conversationId)}`)}
          />
          <InfoItem
            icon={<MaterialIcons name="insert-drive-file" size={22} color="#94a3b8" />}
            label="FILE ĐÃ CHIA SẺ"
            onPress={() => router.push(`/shared-files/${encodeURIComponent(realId || conversationId)}`)}
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

        {/* Privacy & Danger Zone */}
        <SectionHeader title="QUYỀN RIÊNG TƯ & QUẢN LÝ" />
        <View style={styles.section}>
          {isGroup ? (
            <>
              {/* Rời nhóm - Ai cũng thấy */}
              <InfoItem
                icon={<MaterialIcons name="exit-to-app" size={22} color="#ef4444" />}
                label="Rời khỏi nhóm"
                color="#ef4444"
                onPress={handleLeaveGroup}
                showArrow={false}
              />

              {/* Giải tán nhóm - Chỉ Chủ nhóm (Owner) thấy */}
              <InfoItem
                icon={<MaterialIcons name="delete-forever" size={22} color={isOwner ? "#ef4444" : "#4b5563"} />}
                label="Giải tán nhóm"
                description={!isOwner ? "Chỉ trưởng nhóm mới có quyền" : "Xóa toàn bộ tin nhắn và thành viên"}
                color={isOwner ? "#ef4444" : "#4b5563"}
                onPress={handleDisbandGroup}
                disabled={!isOwner}
                showArrow={isOwner}
              />

              {/* Chỉ Admin có thể chat - Chủ nhóm và Phó nhóm thấy */}
              <InfoItem
                icon={<MaterialIcons name="chat-bubble-outline" size={22} color={isAdmin ? "#fff" : "#4b5563"} />}
                label="Chỉ Admin mới có thể chat"
                description={isAdmin ? 'Cho phép Trưởng/ Phó nhóm gửi tin nhắn' : 'Chỉ quản trị viên mới có quyền'}
                disabled={!isAdmin}
                showArrow={false}
                rightElement={
                  <View style={styles.switchContainer}>
                    <Switch
                      value={isRestrictedLocal}
                      onValueChange={handleToggleChatRestriction}
                      disabled={!isAdmin}
                      trackColor={{ false: '#334155', true: '#4f46e5' }}
                      thumbColor={Platform.OS === 'ios' ? '#fff' : (isRestrictedLocal ? '#818cf8' : '#94a3b8')}
                    />
                  </View>
                }
              />
            </>
          ) : null}
        </View>

        <View style={{ height: 40 + insets.bottom }} />
      </ScrollView>

      <InviteMemberModal
        visible={isInviteModalVisible}
        onClose={() => setIsInviteModalVisible(false)}
        conversationId={realId}
        existingMemberIds={conversation?.members?.map(m => String(m.userId || m.id)) || []}
      />
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
  avatarEditBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#0f172a',
  },
  avatarLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userName: { fontSize: 24, fontWeight: '800', color: '#fff', marginBottom: 12 },
  memberCountText: { fontSize: 14, color: '#94a3b8', fontWeight: '600' },
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
    paddingHorizontal: 12, // Thêm padding để không bị sát mép
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    backgroundColor: 'rgba(30, 41, 59, 0.5)', // Thêm nền nhẹ để phân biệt
    borderRadius: 16,
    marginBottom: 8,
  },
  infoItemLeft: { flexDirection: 'row', alignItems: 'center' },
  iconContainer: { width: 32, alignItems: 'center' },
  infoItemLabel: { fontSize: 15, fontWeight: '600', marginLeft: 12 },

  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  memberAvatar: { width: 44, height: 44, borderRadius: 22, marginRight: 12 },
  memberInfo: { flex: 1 },
  memberName: { fontSize: 15, fontWeight: '600', color: '#fff' },
  roleContainer: { flexDirection: 'row', marginTop: 2 },
  roleBadgeOwner: { fontSize: 10, color: '#f59e0b', backgroundColor: 'rgba(245, 158, 11, 0.1)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, fontWeight: '700', overflow: 'hidden' },
  roleBadgeAdmin: { fontSize: 10, color: '#3b82f6', backgroundColor: 'rgba(59, 130, 246, 0.1)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, fontWeight: '700', overflow: 'hidden' },

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

  privacyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  disabledOpacity: {
    opacity: 0.5,
  },
  disabledText: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  privacyTextContainer: {
    marginLeft: 12,
    flexShrink: 1, // Để chữ tự co giãn thay vì đẩy hết cỡ
    paddingRight: 8,
  },
  switchContainer: {
    paddingRight: 4,
    marginLeft: 8,
  },
});

export default ChatInfoScreen;
