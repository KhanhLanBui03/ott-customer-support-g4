import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  Pressable,
  Switch,
  Platform,
  Modal,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { useDispatch, useSelector } from 'react-redux';
import { useTheme } from '../../../src/context/ThemeContext';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  getRealId,
  updateConversation,
  updateConversationWallpaper,
  updateMemberRoleLocal,
  removeMemberLocal,
  removeConversationLocal,
  updateMemberFriendshipStatus
} from '../../../src/store/chatSlice';
import { conversationApi } from '../../../src/api/chatApi';
import { mediaApi } from '../../../src/api/mediaApi';
import { friendApi } from '../../../src/api/friendApi';
import * as ImagePicker from 'expo-image-picker';
import InviteMemberModal from '../../../src/components/chat/InviteMemberModal';
import AIAssistantPanel from '../../../src/components/chat/AIAssistantPanel';
import ReportModal from '../../../src/components/ReportModal';

// Helper Components defined outside to prevent re-mounting on every render
const InfoItem = ({ icon, label, description, onPress, colors, isDark, color = '#fff', showArrow = true, rightElement, disabled }) => (
  <Pressable
    style={({ pressed }) => [
      styles.infoItem,
      { backgroundColor: isDark ? 'rgba(30, 41, 59, 0.5)' : colors.surface100, borderBottomColor: colors.border },
      disabled && styles.disabledOpacity,
      { opacity: (pressed && !disabled) ? 0.7 : 1 }
    ]}
    onPress={!disabled ? onPress : null}
  >
    <View style={styles.infoItemLeft}>
      <View style={styles.iconContainer}>{icon}</View>
      <View style={styles.privacyTextContainer}>
        <Text style={[styles.infoItemLabel, { color: disabled ? colors.textSubtle : (color === '#fff' ? colors.foreground : color), marginLeft: 0 }]}>{label}</Text>
        {description && <Text style={[styles.disabledText, { color: colors.textSubtle }]}>{description}</Text>}
      </View>
    </View>
    {rightElement ? (
      <View style={styles.rightElementContainer}>{rightElement}</View>
    ) : (
      showArrow && <MaterialIcons name="chevron-right" size={24} color={disabled ? colors.textSubtle : (color !== '#fff' ? color : colors.textMuted)} />
    )}
  </Pressable>
);

const SectionHeader = ({ title, colors }) => (
  <View style={styles.sectionHeader}>
    <Text style={[styles.sectionHeaderText, { color: colors.textSubtle }]}>{title}</Text>
  </View>
);

const ChatInfoScreen = () => {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  const router = useRouter();
  const { id: encodedId, name: paramName, avatar: paramAvatar, type: paramType } = useLocalSearchParams();
  const conversationId = decodeURIComponent(encodedId || '');

  const chatState = useSelector((state) => state.chat);
  const currentUser = useSelector((state) => state.auth.user);
  const dispatch = useDispatch();

  const realId = useMemo(() => {
    return getRealId(chatState, conversationId, currentUser?.userId || currentUser?.id);
  }, [chatState, conversationId, currentUser]);

  const isAI = useMemo(() => {
    return realId?.includes('shop-expert-ai-bot') || conversationId?.includes('shop-expert-ai-bot');
  }, [realId, conversationId]);

  const conversation = (chatState.conversations || []).find(c => c.conversationId === realId);
  const [isWallpaperLoading, setIsWallpaperLoading] = useState(false);
  const [isAvatarLoading, setIsAvatarLoading] = useState(false);
  const [isInviteModalVisible, setIsInviteModalVisible] = useState(false);
  const [isQRModalVisible, setIsQRModalVisible] = useState(false);
  const [isReportModalVisible, setIsReportModalVisible] = useState(false);

  // Local state cho Switch để mượt mà 100%
  const [isRestrictedLocal, setIsRestrictedLocal] = useState(conversation?.onlyAdminsCanChat || false);
  const [isApprovalRequiredLocal, setIsApprovalRequiredLocal] = useState(conversation?.memberApprovalRequired || false);

  const [isBlockLoading, setIsBlockLoading] = useState(false);
  const wallpaperUrl = conversation?.wallpaperUrl || null;

  const otherParticipant = useMemo(() => {
    if (!conversation?.members) return null;
    return conversation.members.find(p => p.userId !== (currentUser?.userId || currentUser?.id));
  }, [conversation, currentUser]);

  const isGroup = conversation?.type === 'GROUP' || paramType === 'GROUP';
  const displayName = isGroup ? (conversation?.name || paramName || t('info.group_chat')) : (otherParticipant?.fullName || otherParticipant?.name || paramName || t('info.title'));
  const avatarUrl = isGroup ? (conversation?.avatarUrl || paramAvatar) : (otherParticipant?.avatarUrl || otherParticipant?.avatar || otherParticipant?.profilePic || paramAvatar);
  const isOnline = !isGroup && (isAI || otherParticipant?.status === 'ONLINE' || otherParticipant?.isOnline === true);

  const finalAvatarUrl = avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=667eea&color=fff&size=256&bold=true`;

  const myId = String(currentUser?.userId || currentUser?.id || '');
  const myRole = conversation?.members?.find(m => String(m.userId || m.id) === myId)?.role || 'MEMBER';
  const isOwner = myRole === 'OWNER';
  const isAdmin = myRole === 'ADMIN' || isOwner;

  const [joinRequests, setJoinRequests] = useState([]);

  // Block status - derived from otherParticipant's friendshipStatus in the conversation member data
  // This reads directly from Redux so it stays in sync with chat screen changes
  const blockStatus = useMemo(() => {
    if (isGroup || !otherParticipant) return { isBlocked: false, isBlockedByOther: false };
    const status = otherParticipant?.friendshipStatus;
    const requester = otherParticipant?.isRequester; // true = tôi block, false = họ block tôi
    const isBlocked = status === 'BLOCKED' && requester === true;      // Tôi chủ động chặn họ
    const isBlockedByOther = status === 'BLOCKED' && requester === false; // Họ chặn tôi
    return { isBlocked, isBlockedByOther };
  }, [otherParticipant, isGroup]);

  const otherUserId = String(otherParticipant?.userId || otherParticipant?.id || '');

  const handleBlock = useCallback(() => {
    Alert.alert(
      t('info.block_user'),
      t('info.block_user_confirm', { name: displayName }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('info.block_user'),
          style: 'destructive',
          onPress: async () => {
            if (!otherUserId) return;
            setIsBlockLoading(true);
            // Optimistic update: update Redux store immediately so both screens sync
            dispatch(updateMemberFriendshipStatus({
              userId: otherUserId,
              friendshipStatus: 'BLOCKED',
              isRequester: true,
            }));
            try {
              await friendApi.blockUser(otherUserId);
              Alert.alert(t('info.blocked'), t('info.blocked_success_msg', { name: displayName }));
            } catch (err) {
              // Rollback
              dispatch(updateMemberFriendshipStatus({
                userId: otherUserId,
                friendshipStatus: 'NONE',
                isRequester: null,
              }));
              Alert.alert(t('common.error'), t('info.block_failed'));
            } finally {
              setIsBlockLoading(false);
            }
          }
        }
      ]
    );
  }, [otherUserId, displayName, dispatch, t]);

  const handleUnblock = useCallback(() => {
    Alert.alert(
      t('info.unblock_user'),
      t('info.unblock_user_confirm', { name: displayName }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('info.unblock_user'),
          onPress: async () => {
            if (!otherUserId) return;
            setIsBlockLoading(true);
            // Optimistic update: update Redux store immediately so both screens sync
            dispatch(updateMemberFriendshipStatus({
              userId: otherUserId,
              friendshipStatus: 'NONE',
              isRequester: null,
            }));
            try {
              await friendApi.unblockUser(otherUserId);
              Alert.alert(t('info.unblocked'), t('info.unblocked_success_msg', { name: displayName }));
            } catch (err) {
              // Rollback
              dispatch(updateMemberFriendshipStatus({
                userId: otherUserId,
                friendshipStatus: 'BLOCKED',
                isRequester: true,
              }));
              Alert.alert(t('common.error'), t('info.unblock_failed'));
            } finally {
              setIsBlockLoading(false);
            }
          }
        }
      ]
    );
  }, [otherUserId, displayName, dispatch, t]);

  const handleWallpaperChange = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert(t('common.error'), t('profile.avatar_failed'));
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

      Alert.alert(t('common.success'), t('info.wallpaper_updated'));
    } catch (error) {
      Alert.alert(t('common.error'), t('info.wallpaper_update_failed'));
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
      Alert.alert(t('common.success'), t('info.wallpaper_removed'));
    } catch (error) {
      Alert.alert(t('common.error'), t('info.wallpaper_remove_failed'));
    } finally {
      setIsWallpaperLoading(false);
    }
  };

  const handleAvatarChange = async () => {
    if (!isGroup || !isAdmin) return;

    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert(t('common.error'), t('profile.avatar_failed'));
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

      Alert.alert(t('common.success'), t('info.group_avatar_updated'));
    } catch (error) {
      console.error('[AvatarChangeError]', error);
      Alert.alert(t('common.error'), t('info.group_avatar_update_failed'));
    } finally {
      setIsAvatarLoading(false);
    }
  };

  const handleLeaveGroup = () => {
    Alert.alert(
      t('common.confirm'),
      t('info.leave_group_confirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('info.leave_group'),
          style: 'destructive',
          onPress: async () => {
            try {
              await conversationApi.deleteConversationForMe(realId);
              dispatch(removeConversationLocal({ conversationId: realId }));
              router.replace('/(main)');
            } catch (err) {
              const msg = err.response?.data?.message || t('info.leave_group_error');
              Alert.alert(t('common.error'), msg);
            }
          }
        }
      ]
    );
  };

  const handleDisbandGroup = () => {
    Alert.alert(
      t('info.disband_group'),
      t('info.disband_group_confirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('info.disband'),
          style: 'destructive',
          onPress: async () => {
            try {
              await conversationApi.disbandGroup(realId);
              dispatch(removeConversationLocal({ conversationId: realId }));
              router.replace('/(main)');
            } catch (err) {
              const msg = err.response?.data?.message || t('info.disband_group_error');
              Alert.alert(t('common.error'), msg);
            }
          }
        }
      ]
    );
  };

  // --- TOGGLE HANDLERS (Optimistic Updates) ---

  // Đồng bộ local state khi conversation từ Redux thay đổi
  useEffect(() => {
    if (conversation?.onlyAdminsCanChat !== undefined) {
      setIsRestrictedLocal(conversation.onlyAdminsCanChat);
    }
  }, [conversation?.onlyAdminsCanChat]);

  useEffect(() => {
    if (conversation?.memberApprovalRequired !== undefined) {
      setIsApprovalRequiredLocal(conversation.memberApprovalRequired);
    }
  }, [conversation?.memberApprovalRequired]);

  const handleToggleChatRestriction = async (value) => {
    if (!isAdmin) return;

    // Nếu value là boolean thì dùng nó, nếu không (do click row) thì đảo ngược state hiện tại
    const newValue = typeof value === 'boolean' ? value : !isRestrictedLocal;
    if (newValue === isRestrictedLocal) return;

    const originalValue = isRestrictedLocal;

    // 1. Cập nhật UI ngay lập tức
    setIsRestrictedLocal(newValue);

    // 2. Cập nhật Redux (Optimistic Update)
    dispatch(updateConversation({
      conversationId: realId,
      onlyAdminsCanChat: newValue
    }));

    try {
      // 3. Gọi API
      await conversationApi.toggleChatRestriction(realId);
    } catch (err) {
      // 4. Rollback nếu lỗi
      setIsRestrictedLocal(originalValue);
      dispatch(updateConversation({
        conversationId: realId,
        onlyAdminsCanChat: originalValue
      }));
      Alert.alert(t('common.error'), t('info.chat_restriction_error'));
    }
  };

  const handleToggleMemberApproval = async (value) => {
    if (!isAdmin) return;

    const newValue = typeof value === 'boolean' ? value : !isApprovalRequiredLocal;
    if (newValue === isApprovalRequiredLocal) return;

    const originalValue = isApprovalRequiredLocal;

    // 1. UI update
    setIsApprovalRequiredLocal(newValue);

    // 2. Redux update
    dispatch(updateConversation({
      conversationId: realId,
      memberApprovalRequired: newValue
    }));

    try {
      // 3. API Call
      await conversationApi.toggleMemberApproval(realId);
    } catch (err) {
      // 4. Rollback
      setIsApprovalRequiredLocal(originalValue);
      dispatch(updateConversation({
        conversationId: realId,
        memberApprovalRequired: originalValue
      }));
      Alert.alert(t('common.error'), t('info.member_approval_error'));
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
          text: t('info.demote_admin'),
          onPress: () => updateMemberRole(memberId, 'MEMBER')
        });
      } else {
        actions.push({
          text: t('info.promote_admin'),
          onPress: () => updateMemberRole(memberId, 'ADMIN')
        });
      }
      actions.push({
        text: t('info.remove_from_group'),
        style: 'destructive',
        onPress: () => removeFromGroup(memberId, member.fullName)
      });
    }
    // Nếu tôi là ADMIN (phó nhóm)
    else if (myRole === 'ADMIN' && !isMemberAdmin) {
      actions.push({
        text: t('info.remove_from_group'),
        style: 'destructive',
        onPress: () => removeFromGroup(memberId, member.fullName)
      });
    }

    if (actions.length > 0) {
      Alert.alert(
        member.fullName,
        t('info.member_actions_title'),
        [...actions, { text: t('common.close'), style: 'cancel' }]
      );
    }
  };

  const updateMemberRole = async (userId, role) => {
    try {
      await conversationApi.assignRole(realId, userId, role);
      dispatch(updateMemberRoleLocal({ conversationId: realId, userId, role }));
      Alert.alert(t('common.success'), role === 'ADMIN' ? t('info.promote_success') : t('info.demote_success'));
    } catch (err) {
      Alert.alert(t('common.error'), t('info.update_role_error'));
    }
  };

  const removeFromGroup = async (userId, name) => {
    Alert.alert(
      t('common.confirm'),
      t('info.remove_member_confirm', { name }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await conversationApi.removeMember(realId, userId);
              dispatch(removeMemberLocal({ conversationId: realId, userId }));
              Alert.alert(t('common.success'), t('info.remove_member_success'));
            } catch (err) {
              Alert.alert(t('common.error'), t('info.remove_member_error'));
            }
          }
        }
      ]
    );
  };

  const fetchJoinRequests = async () => {
    if (!isGroup || !isAdmin || !realId) return;
    try {
      const response = await conversationApi.getPendingJoinRequests(realId);
      if (response?.success) {
        setJoinRequests(response.data || []);
      }
    } catch (err) {
      console.log('Error fetching join requests:', err);
    }
  };

  useEffect(() => {
    fetchJoinRequests();

    // Lắng nghe sự kiện socket khi có yêu cầu gia nhập mới (Real-time)
    const socketModule = require('../../../src/utils/socket');
    if (socketModule && realId && isAdmin) {
      const handleJoinRequestEvent = (data) => {
        if (data.conversationId === realId) {
          console.log('[Socket] Join Request Event:', data.eventType);

          if (data.eventType === 'JOIN_REQUEST' || data.eventType === 'NEW_JOIN_REQUEST' || data.eventType === 'GROUP_JOIN_REQUEST') {
            fetchJoinRequests(); // Tải lại danh sách khi có yêu cầu mới
          } else if (data.eventType === 'JOIN_REQUEST_PROCESSED' || data.eventType === 'GROUP_JOIN_REQUEST_PROCESSED') {
            // Khi một admin khác đã duyệt/từ chối, xóa khỏi danh sách local hoặc fetch lại
            fetchJoinRequests();
          }
        }
      };

      socketModule.onJoinRequest(handleJoinRequestEvent);

      return () => {
        socketModule.offJoinRequest(handleJoinRequestEvent);
      };
    }
  }, [realId, isGroup, isAdmin]);

  const handleApproveRequest = async (requestId) => {
    try {
      const res = await conversationApi.approveJoinRequest(requestId);
      if (res?.success) {
        Alert.alert(t('common.success'), t('info.approve_join_success'));
        fetchJoinRequests();
      }
    } catch (err) {
      const msg = err.response?.data?.message || t('info.approve_join_error');
      Alert.alert(t('common.error'), msg);
    }
  };

  const handleRejectRequest = async (requestId) => {
    try {
      const res = await conversationApi.rejectJoinRequest(requestId);
      if (res?.success) {
        Alert.alert(t('common.success'), t('info.reject_join_success'));
        fetchJoinRequests();
      }
    } catch (err) {
      const msg = err.response?.data?.message || t('info.reject_join_error');
      Alert.alert(t('common.error'), msg);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable
          onPress={() => {
            router.replace({
              pathname: `/chat/${encodeURIComponent(realId)}`,
              params: {
                name: displayName,
                avatar: avatarUrl,
                type: isGroup ? 'GROUP' : 'SINGLE'
              }
            });
          }}
          style={styles.backButton}
        >
          <Ionicons name="close" size={28} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>{t('info.conversation_info_type', { type: isGroup ? t('chat.group').toLowerCase() : t('info.conversation').toLowerCase() })}</Text>
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
            {isAI ? (
              <View style={[styles.avatar, { backgroundColor: isDark ? 'rgba(99, 102, 241, 0.2)' : 'rgba(99, 102, 241, 0.1)', alignItems: 'center', justifyContent: 'center', borderColor: colors.border }]}>
                <Ionicons name="sparkles" size={54} color="#6366f1" />
              </View>
            ) : (
              <Image source={{ uri: finalAvatarUrl }} style={[styles.avatar, { borderColor: colors.border }, isAvatarLoading && { opacity: 0.5 }]} />
            )}
            {isOnline && <View style={[styles.onlineBadge, { borderColor: colors.background }]} />}

            {isGroup && isAdmin && (
              <View style={[styles.avatarEditBadge, { borderColor: colors.background, backgroundColor: colors.primary }]}>
                <MaterialIcons name="camera-alt" size={16} color="#fff" />
              </View>
            )}
            {isAvatarLoading && (
              <View style={styles.avatarLoadingOverlay}>
                <ActivityIndicator color="#fff" size="small" />
              </View>
            )}
          </TouchableOpacity>
          <Text style={[styles.userName, { color: colors.foreground }]}>{displayName}</Text>
          {isGroup ? (
            <Text style={[styles.memberCountText, { color: colors.textMuted }]}>{t('info.member_count', { count: conversation?.members?.length || 0 })}</Text>
          ) : (
            <View style={[styles.statusBadge, isOnline ? styles.statusActive : styles.statusInactive]}>
              <Text style={styles.statusText}>{isOnline ? t('chat.online').toUpperCase() : t('chat.offline').toUpperCase()}</Text>
            </View>
          )}
        </View>

        {/* Group QR Code Section */}
        {isGroup && (
          <>
            <View style={[styles.separator, { backgroundColor: isDark ? 'rgba(30, 41, 59, 0.5)' : colors.surface100 }]} />
            <SectionHeader title={t('info.group_qr').toUpperCase()} colors={colors} />
            <View style={styles.section}>
              <InfoItem
                icon={<MaterialIcons name="qr-code" size={22} color={colors.primary} />}
                label={t('info.group_qr')}
                description={t('info.group_qr_desc')}
                color={colors.primary}
                onPress={() => setIsQRModalVisible(true)}
                colors={colors}
                isDark={isDark}
              />
            </View>

            {isAdmin && joinRequests.length > 0 && (
              <>
                <View style={[styles.separator, { backgroundColor: isDark ? 'rgba(30, 41, 59, 0.5)' : colors.surface100 }]} />
                <SectionHeader title={t('info.pending_join_requests', { count: joinRequests.length }).toUpperCase()} colors={colors} />
                <View style={styles.section}>
                  {joinRequests.map((req) => (
                    <View key={req.requestId || req.id} style={[styles.infoItem, { backgroundColor: isDark ? 'rgba(245, 158, 11, 0.1)' : 'rgba(245, 158, 11, 0.05)', borderColor: '#f59e0b', borderWidth: 0.5 }]}>
                      <View style={styles.infoItemLeft}>
                        <Image
                          source={{ uri: req.avatarUrl || req.user?.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(req.fullName || req.user?.fullName || 'U')}&background=667eea&color=fff&size=128&bold=true` }}
                          style={styles.memberAvatar}
                        />
                        <View style={styles.memberInfo}>
                          <Text style={[styles.memberName, { color: colors.foreground }]}>{req.fullName || req.user?.fullName}</Text>
                          <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>{t('info.wants_to_join')}</Text>
                        </View>
                      </View>
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <TouchableOpacity
                          style={{ backgroundColor: colors.primary, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 }}
                          onPress={() => handleApproveRequest(req.requestId || req.id)}
                        >
                          <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>{t('info.approve')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 }}
                          onPress={() => handleRejectRequest(req.requestId || req.id)}
                        >
                          <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: '600' }}>{t('info.reject')}</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </View>
              </>
            )}
          </>
        )}

        {/* AI Assistant Section for Group */}
        {isGroup && (
          <>
            <View style={[styles.separator, { backgroundColor: isDark ? 'rgba(30, 41, 59, 0.5)' : colors.surface100 }]} />
            <AIAssistantPanel conversationId={realId} />
          </>
        )}

        {/* Members Section for Group */}
        {isGroup && (
          <>
            <SectionHeader title={t('info.members').toUpperCase()} colors={colors} />
            <View style={styles.section}>
              {(isAdmin || !isApprovalRequiredLocal) && (
                <InfoItem
                  icon={<MaterialIcons name="person-add" size={22} color="#667eea" />}
                  label={t('info.add_member')}
                  color="#667eea"
                  onPress={() => setIsInviteModalVisible(true)}
                  colors={colors}
                  isDark={isDark}
                />
              )}
              {conversation?.members?.map((member, idx) => {
                const isMe = String(member.userId || member.id) === myId;
                return (
                  <View key={member.userId || idx} style={styles.memberItem}>
                    <Image
                      source={{ uri: member.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(member.fullName || 'U')}&background=667eea&color=fff&size=128&bold=true` }}
                      style={[styles.memberAvatar, { borderColor: colors.border }]}
                    />
                    <View style={styles.memberInfo}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={[styles.memberName, { color: colors.foreground }]}>{member.fullName}</Text>
                        {isMe && <Text style={[styles.meLabel, { color: colors.textSubtle }]}> ({t('common.you')})</Text>}
                      </View>
                      <View style={styles.roleContainer}>
                        {member.role === 'OWNER' ? (
                          <Text style={styles.roleTextOwner}>{t('info.role_owner').toUpperCase()}</Text>
                        ) : member.role === 'ADMIN' ? (
                          <Text style={styles.roleTextAdmin}>{t('info.role_admin').toUpperCase()}</Text>
                        ) : (
                          <Text style={styles.roleTextMember}>{t('info.role_member').toUpperCase()}</Text>
                        )}
                      </View>
                    </View>
                    {isAdmin && !isMe && (
                      <TouchableOpacity onPress={() => handleMemberAction(member)}>
                        <MaterialIcons name="more-vert" size={24} color={colors.textSubtle} />
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
            </View>
          </>
        )}

        {/* Media & Files */}
        <SectionHeader title={t('info.shared_data').toUpperCase()} colors={colors} />
        <View style={styles.section}>
          <InfoItem
            icon={<MaterialIcons name="image" size={22} color={colors.textMuted} />}
            label={t('info.shared_media').toUpperCase()}
            onPress={() => router.push(`/shared-media/${encodeURIComponent(realId || conversationId)}`)}
            colors={colors}
            isDark={isDark}
          />
          <InfoItem
            icon={<MaterialIcons name="insert-drive-file" size={22} color={colors.textMuted} />}
            label={t('info.shared_files').toUpperCase()}
            onPress={() => router.push(`/shared-files/${encodeURIComponent(realId || conversationId)}`)}
            colors={colors}
            isDark={isDark}
          />
          <InfoItem
            icon={<MaterialIcons name="link" size={22} color={colors.textMuted} />}
            label={t('info.shared_links').toUpperCase()}
            onPress={() => router.push(`/shared-links/${encodeURIComponent(realId || conversationId)}`)}
            colors={colors}
            isDark={isDark}
          />
        </View>

        {/* Interface Customization */}
        <SectionHeader title={t('info.customization').toUpperCase()} colors={colors} />

        {wallpaperUrl && (
          <View style={styles.previewContainer}>
            <View style={styles.wallpaperPreviewCard}>
              <Image source={{ uri: wallpaperUrl }} style={styles.wallpaperPreviewImage} />
              <View style={styles.previewOverlay}>
                <Text style={styles.previewText}>{t('info.current_wallpaper')}</Text>
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
              { backgroundColor: colors.card },
              { opacity: (pressed || isWallpaperLoading) ? 0.7 : 1 }
            ]}
          >
            <View style={[styles.customActionIcon, { backgroundColor: colors.primary }]}>
              <MaterialIcons name="wallpaper" size={22} color="#fff" />
            </View>
            <View style={styles.customActionContent}>
              <Text style={[styles.customActionTitle, { color: colors.foreground }]}>{t('info.change_wallpaper')}</Text>
              <Text style={[styles.customActionSub, { color: colors.textMuted }]}>
                {isWallpaperLoading ? t('common.loading') : t('info.change_wallpaper_desc')}
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
            <View style={[styles.deleteActionIcon, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.2)' : 'rgba(239, 68, 68, 0.1)' }]}>
              <MaterialIcons name="delete-outline" size={22} color="#ef4444" />
            </View>
            <View style={styles.deleteActionContent}>
              <Text style={styles.deleteActionTitle}>{t('info.remove_wallpaper')}</Text>
              <Text style={[styles.deleteActionSub, { color: colors.textMuted }]}>{t('info.remove_wallpaper_desc')}</Text>
            </View>
          </Pressable>
        </View>

        {/* Privacy & Danger Zone */}
        <SectionHeader title={t('chat.privacy_management').toUpperCase()} colors={colors} />
        <View style={styles.section}>
          {isGroup ? (
            <>
              {/* Rời nhóm - Ai cũng thấy */}
              <InfoItem
                icon={<MaterialIcons name="exit-to-app" size={22} color="#ef4444" />}
                label={t('info.leave_group')}
                color="#ef4444"
                onPress={handleLeaveGroup}
                showArrow={false}
                colors={colors}
                isDark={isDark}
              />

              {/* Giải tán nhóm - Chỉ Chủ nhóm (Owner) thấy */}
              <SectionHeader title={t('info.privacy_management').toUpperCase()} colors={colors} />
              <InfoItem
                icon={<MaterialIcons name="delete-forever" size={22} color={isOwner ? "#ef4444" : "#4b5563"} />}
                label={t('info.disband_group')}
                description={!isOwner ? t('info.owner_only_permission') : t('info.disband_group_desc')}
                color={isOwner ? "#ef4444" : "#4b5563"}
                onPress={handleDisbandGroup}
                disabled={!isOwner}
                showArrow={isOwner}
                colors={colors}
                isDark={isDark}
              />

              {/* Chỉ Admin có thể chat - Chủ nhóm và Phó nhóm thấy */}
              <InfoItem
                icon={<MaterialIcons name="chat-bubble-outline" size={22} color={isAdmin ? colors.foreground : colors.textSubtle} />}
                label={t('info.only_admin_can_chat_toggle')}
                description={isAdmin ? t('info.only_admin_can_chat_desc') : t('info.admin_only_permission')}
                disabled={!isAdmin}
                onPress={() => handleToggleChatRestriction(!isRestrictedLocal)}
                showArrow={false}
                colors={colors}
                isDark={isDark}
                rightElement={
                  <View style={styles.switchContainer}>
                    <Switch
                      value={isRestrictedLocal}
                      onValueChange={handleToggleChatRestriction}
                      disabled={!isAdmin}
                      trackColor={{ false: isDark ? colors.surface300 : '#cbd5e1', true: colors.primary }}
                      thumbColor={Platform.OS === 'ios' ? '#fff' : '#fff'}
                    />
                  </View>
                }
              />

              {/* Kiểm soát thêm thành viên */}
              <InfoItem
                icon={<MaterialIcons name="security" size={22} color={isAdmin ? colors.foreground : colors.textSubtle} />}
                label={t('info.member_approval_toggle')}
                description={isAdmin ? t('info.member_approval_desc') : t('info.admin_only_permission')}
                disabled={!isAdmin}
                onPress={() => handleToggleMemberApproval(!isApprovalRequiredLocal)}
                showArrow={false}
                colors={colors}
                isDark={isDark}
                rightElement={
                  <View style={styles.switchContainer}>
                    <Switch
                      value={isApprovalRequiredLocal}
                      onValueChange={handleToggleMemberApproval}
                      disabled={!isAdmin}
                      trackColor={{ false: isDark ? colors.surface300 : '#cbd5e1', true: colors.primary }}
                      thumbColor={Platform.OS === 'ios' ? '#fff' : '#fff'}
                    />
                  </View>
                }
              />
            </>
          ) : (
            /* Hội thoại 1-1: Nút chặn / bỏ chặn */
            <>
              {blockStatus.isBlocked ? (
                /* Đang chặn người này → Nút BỎ CHẶN */
                <Pressable
                  onPress={handleUnblock}
                  disabled={isBlockLoading}
                  style={({ pressed }) => [
                    styles.blockActionCard,
                    { backgroundColor: isDark ? 'rgba(239,68,68,0.12)' : 'rgba(239,68,68,0.07)', borderColor: '#ef4444' },
                    { opacity: (pressed || isBlockLoading) ? 0.6 : 1 }
                  ]}
                >
                  <View style={[styles.blockActionIcon, { backgroundColor: 'rgba(239,68,68,0.15)' }]}>
                    {isBlockLoading
                      ? <ActivityIndicator size="small" color="#ef4444" />
                      : <MaterialIcons name="lock-open" size={22} color="#ef4444" />
                    }
                  </View>
                  <View style={styles.blockActionContent}>
                    <Text style={[styles.blockActionTitle, { color: '#ef4444' }]}>{t('info.unblock_user_btn', { name: displayName })}</Text>
                    <Text style={[styles.blockActionSub, { color: colors.textMuted }]}>{t('info.unblock_desc')}</Text>
                  </View>
                  <MaterialIcons name="chevron-right" size={22} color="#ef4444" />
                </Pressable>
              ) : (
                /* Chưa chặn → Nút CHẶN */
                <Pressable
                  onPress={handleBlock}
                  disabled={isBlockLoading}
                  style={({ pressed }) => [
                    styles.blockActionCard,
                    { backgroundColor: isDark ? 'rgba(107,114,128,0.1)' : colors.surface100, borderColor: colors.border },
                    { opacity: (pressed || isBlockLoading) ? 0.6 : 1 }
                  ]}
                >
                  <View style={[styles.blockActionIcon, { backgroundColor: isDark ? 'rgba(107,114,128,0.2)' : 'rgba(107,114,128,0.1)' }]}>
                    {isBlockLoading
                      ? <ActivityIndicator size="small" color={colors.textSubtle} />
                      : <MaterialIcons name="block" size={22} color={colors.textSubtle} />
                    }
                  </View>
                  <View style={styles.blockActionContent}>
                    <Text style={[styles.blockActionTitle, { color: colors.foreground }]}>{t('info.block_user_btn', { name: displayName })}</Text>
                    <Text style={[styles.blockActionSub, { color: colors.textMuted }]}>{t('info.block_desc')}</Text>
                  </View>
                  <MaterialIcons name="chevron-right" size={22} color={colors.textMuted} />
                </Pressable>
              )}

              {/* Thông báo nếu bị người kia chặn */}
              {blockStatus.isBlockedByOther && (
                <View style={[styles.blockedByBanner, { backgroundColor: isDark ? 'rgba(234,179,8,0.1)' : 'rgba(234,179,8,0.08)', borderColor: 'rgba(234,179,8,0.3)' }]}>
                  <MaterialIcons name="info-outline" size={18} color="#eab308" style={{ marginRight: 8 }} />
                  <Text style={{ fontSize: 13, color: '#eab308', fontWeight: '600', flex: 1 }}>
                    {t('info.blocked_by_other')}
                  </Text>
                </View>
              )}
            </>
          )}

          <InfoItem
            icon={<MaterialIcons name="report" size={22} color="#f43f5e" />}
            label={t('info.report_violation')}
            description={t('info.report_violation_desc')}
            color="#f43f5e"
            onPress={() => setIsReportModalVisible(true)}
            showArrow={true}
            colors={colors}
            isDark={isDark}
          />
        </View>

        <View style={{ height: 40 + insets.bottom }} />
      </ScrollView>

      <InviteMemberModal
        visible={isInviteModalVisible}
        onClose={() => setIsInviteModalVisible(false)}
        conversationId={realId}
        existingMemberIds={conversation?.members?.map(m => String(m.userId || m.id)) || []}
      />

      {/* Modal hiển thị mã QR nhóm */}
      {isGroup && (
        <Modal
          visible={isQRModalVisible}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setIsQRModalVisible(false)}
        >
          <Pressable
            style={styles.modalOverlay}
            onPress={() => setIsQRModalVisible(false)}
          >
            <Pressable style={[styles.qrModalContent, { backgroundColor: colors.background, borderColor: colors.border }]} onPress={(e) => e.stopPropagation()}>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setIsQRModalVisible(false)}
              >
                <MaterialIcons name="close" size={24} color={colors.foreground} />
              </TouchableOpacity>

              <Text style={[styles.qrTitle, { color: colors.foreground }]}>{t('info.group_qr')}</Text>
              <Text style={[styles.qrSubtitle, { color: colors.textMuted }]}>
                {t('info.group_qr_modal_desc')}
              </Text>

              <View style={[styles.qrCodeWrapper, { backgroundColor: '#ffffff', borderColor: colors.border }]}>
                <Image
                  source={{ uri: `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=GROUP_JOIN:${realId}` }}
                  style={styles.qrImage}
                  resizeMode="contain"
                />
              </View>

              <Text style={[styles.qrGroupName, { color: colors.foreground }]} numberOfLines={2}>
                {conversation?.name || displayName}
              </Text>
              <Text style={[styles.qrGroupInfo, { color: colors.primary }]}>
                {t('info.member_count', { count: conversation?.members?.length || 0 })}
              </Text>
            </Pressable>
          </Pressable>
        </Modal>
      )}
      <ReportModal
        visible={isReportModalVisible}
        onClose={() => setIsReportModalVisible(false)}
        targetId={isGroup ? (realId || conversationId) : otherUserId}
        targetType={isGroup ? 'GROUP' : 'USER'}
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
  separator: { height: 8, marginTop: 10 },
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
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    borderRadius: 16,
    marginBottom: 8,
  },
  infoItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1, // Đảm bảo phần bên trái chiếm không gian còn lại và co dãn
  },
  iconContainer: { width: 32, alignItems: 'center' },
  infoItemLabel: { fontSize: 15, fontWeight: '600', marginLeft: 12 },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  memberAvatar: { width: 44, height: 44, borderRadius: 22, marginRight: 12, borderWidth: 1 },
  memberInfo: { flex: 1 },
  memberName: { fontSize: 15, fontWeight: '700', color: '#fff' },
  meLabel: { fontSize: 14, fontWeight: '600' },
  roleContainer: { flexDirection: 'row', marginTop: 2 },
  roleTextOwner: { fontSize: 10, color: '#6366f1', fontWeight: '800', letterSpacing: 0.5 },
  roleTextAdmin: { fontSize: 10, color: '#10b981', fontWeight: '800', letterSpacing: 0.5 },
  roleTextMember: { fontSize: 10, color: '#94a3b8', fontWeight: '800', letterSpacing: 0.5 },
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

  blockActionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    marginBottom: 10,
    borderWidth: 1,
  },
  blockActionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  blockActionContent: { flex: 1 },
  blockActionTitle: { fontSize: 15, fontWeight: '700' },
  blockActionSub: { fontSize: 12, marginTop: 2 },

  blockedByBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginTop: 4,
    marginBottom: 4,
    borderWidth: 1,
  },

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
    flex: 1,
    paddingRight: 8,
  },
  rightElementContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  switchContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 48,
    minHeight: 32,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  qrModalContent: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 24,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    position: 'relative',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    padding: 8,
    borderRadius: 20,
  },
  qrTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
    marginTop: 8,
  },
  qrSubtitle: {
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 18,
  },
  qrCodeWrapper: {
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  qrImage: {
    width: 200,
    height: 200,
  },
  qrGroupName: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 6,
  },
  qrGroupInfo: {
    fontSize: 12,
    fontWeight: '600',
  },
});

export default ChatInfoScreen;
