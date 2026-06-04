import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Image,
  SafeAreaView,
  ActivityIndicator,
  RefreshControl,
  DeviceEventEmitter,
} from 'react-native';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { useDispatch, useSelector } from 'react-redux';
import { fetchNotifications, markAsRead, removeNotification } from '../../src/store/notificationSlice';
import { fetchConversations } from '../../src/store/chatSlice';
import { friendApi } from '../../src/api/friendApi';
import { conversationApi } from '../../src/api/chatApi';
import { Alert } from 'react-native';
import { useTheme } from '../../src/context/ThemeContext';
import { useRouter } from 'expo-router';
import { notificationApi } from '../../src/api/userApi';
import CONFIG from '../../src/config';
import { useTranslation } from 'react-i18next';
import { translateNotificationMessage, translateNotificationTitle } from '../../src/utils/notificationMessageTranslator';


const formatDate = (date) => {
  if (!date) return '';
  const d = new Date(date);
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
};

const formatFullDate = (date) => {
  if (!date) return '';
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

const NotificationsScreen = () => {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const dispatch = useDispatch();

  const currentUser = useSelector((state) => state.auth.user);
  const router = useRouter();
  const { notifications, loading } = useSelector((state) => state.notifications);
  const [refreshing, setRefreshing] = useState(false);

  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);

  useEffect(() => {
    const myId = currentUser?.userId || currentUser?.id;
    dispatch(fetchNotifications(myId));
  }, [dispatch, currentUser]);

  const onRefresh = async () => {
    setRefreshing(true);
    const myId = currentUser?.userId || currentUser?.id;
    await dispatch(fetchNotifications(myId));
    setRefreshing(false);
  };

  const handleNotificationPress = (item) => {
    if (!(item.isRead || item.read)) {
      dispatch(markAsRead(item.id || item.notificationId));
    }
    if (item.type === 'FRIEND_ACCEPT' || item.type === 'FRIEND_ACCEPTED') {
      router.push({
        pathname: `/chat/SINGLE#${item.senderId}`,
        params: {
          name: item.fullName || item.message || 'Bạn bè',
          avatar: item.avatarUrl || '',
          type: 'SINGLE'
        }
      });
    }
  };

  const handleItemLongPress = (item) => {
    const id = item.id || item.notificationId;
    if (!isSelectionMode) {
      setIsSelectionMode(true);
      setSelectedIds([id]);
    }
  };

  const handleItemPress = (item) => {
    const id = item.id || item.notificationId;
    if (isSelectionMode) {
      if (selectedIds.includes(id)) {
        setSelectedIds(prev => prev.filter(x => x !== id));
      } else {
        setSelectedIds(prev => [...prev, id]);
      }
    } else {
      handleNotificationPress(item);
    }
  };

  const handleCancelSelection = () => {
    setIsSelectionMode(false);
    setSelectedIds([]);
  };

  const handleDeleteSelected = () => {
    if (selectedIds.length === 0) return;
    Alert.alert(
      t('notifications.delete_title'),
      t('notifications.delete_confirm_desc', { count: selectedIds.length }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { 
          text: t('common.delete'), 
          style: 'destructive',
          onPress: async () => {
            try {
              // Extract real IDs
              const realIds = selectedIds.filter(id => !id.startsWith('fr_') && !id.startsWith('gi_'));

              // Delete general notifications from DB
              if (realIds.length > 0) {
                await Promise.all(realIds.map(id => notificationApi.deleteNotification(id)));
              }

              // Delete locally in Redux
              for (const id of selectedIds) {
                dispatch(removeNotification(id));
              }

              Alert.alert(t('common.success'), t('notifications.delete_success'));
              onRefresh();
              handleCancelSelection();
            } catch (err) {
              console.warn(err);
              Alert.alert(t('common.error'), t('notifications.delete_failed'));
            }
          }
        }
      ]
    );
  };

  const handleDeleteAll = () => {
    Alert.alert(
      t('notifications.delete_all_title'),
      t('notifications.delete_all_desc'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { 
          text: t('notifications.opt_delete_all'), 
          style: 'destructive',
          onPress: async () => {
            try {
              const myId = currentUser?.userId || currentUser?.id;
              if (myId) {
                await notificationApi.deleteAllNotifications(myId);
                // Also clear pending locally
                notifications.forEach(n => {
                  dispatch(removeNotification(n.id || n.notificationId));
                });
                Alert.alert(t('common.success'), t('notifications.delete_all_success'));
                onRefresh();
                handleCancelSelection();
              }
            } catch (err) {
              console.warn(err);
              Alert.alert(t('common.error'), t('notifications.delete_failed'));
            }
          }
        }
      ]
    );
  };

  const handleMarkAllAsRead = async () => {
    try {
      const myId = currentUser?.userId || currentUser?.id;
      if (myId) {
        await notificationApi.markAllAsRead(myId);
        dispatch(fetchNotifications(myId));
        Alert.alert(t('common.success'), t('notifications.mark_all_read_success'));
      }
    } catch (e) {
      console.warn(e);
    }
  };

  const showThreeDotMenu = () => {
    Alert.alert(
      t('notifications.options_title'),
      t('notifications.options_desc'),
      [
        { text: t('notifications.opt_select_multiple'), onPress: () => setIsSelectionMode(true) },
        { text: t('notifications.opt_mark_all_read'), onPress: handleMarkAllAsRead },
        { text: t('notifications.opt_delete_all'), style: 'destructive', onPress: handleDeleteAll },
        { text: t('notifications.opt_close'), style: 'cancel' }
      ]
    );
  };

  const BASE_URL = CONFIG.BASE_URL;

  const getAvatarUrl = (url, name) => {
    if (!url) return `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'U')}&background=667eea&color=fff&size=128&bold=true`;
    if (url.startsWith('http')) return url;
    const baseUrl = BASE_URL.includes('/api') ? BASE_URL.split('/api')[0] : BASE_URL;
    return `${baseUrl}${url.startsWith('/') ? '' : '/'}${url}`;
  };

  const handleAcceptFriendRequest = async (senderId, notificationId) => {
    try {
      await friendApi.acceptFriendRequest(senderId);
      Alert.alert(t('common.success'), t('notifications.friend_accept_success'));
      dispatch(markAsRead(notificationId));
      onRefresh(); 
      DeviceEventEmitter.emit('friendship_changed');
    } catch (err) {
      Alert.alert(t('common.error'), t('notifications.accept_friend_failed'));
    }
  };

  const handleRejectFriendRequest = async (senderId, notificationId, senderName) => {
    Alert.alert(
      t('notifications.confirm_title'),
      t('notifications.friend_reject_confirm', { name: senderName || t('notifications.someone') }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { 
          text: t('notifications.decline_group'), 
          style: 'destructive',
          onPress: async () => {
            try {
              await friendApi.rejectFriendRequest(senderId);
              Alert.alert(t('notifications.title'), t('notifications.friend_reject_notif', { name: senderName || t('notifications.someone') }), [
                { text: 'OK', onPress: () => dispatch(removeNotification(notificationId)) }
              ]);
            } catch (err) {
              Alert.alert(t('common.error'), t('notifications.reject_friend_failed'));
            }
          }
        }
      ]
    );
  };

  const handleAcceptGroupInvite = async (invitationId, notificationId) => {
    try {
      await conversationApi.acceptInvitation(invitationId);
      Alert.alert(t('common.success'), t('notifications.group_accept_success'));
      dispatch(markAsRead(notificationId));
      onRefresh();
    } catch (err) {
      const errorMessage = err.response?.data?.message || '';
      if (errorMessage === 'Bạn đã là thành viên của nhóm này') {
        Alert.alert(t('notifications.title'), t('notifications.group_already_joined'), [
          { text: 'OK', onPress: () => dispatch(removeNotification(notificationId)) }
        ]);
      } else {
        Alert.alert(t('common.error'), t('notifications.join_group_failed'));
      }
    }
  };

  const handleRejectGroupInvite = async (invitationId, notificationId) => {
    try {
      await conversationApi.rejectInvitation(invitationId);
      Alert.alert(t('notifications.title'), t('notifications.group_reject_success'));
      dispatch(removeNotification(notificationId));
      onRefresh();
    } catch (err) {
      Alert.alert(t('common.error'), t('notifications.reject_friend_failed'));
    }
  };

  const renderNotificationItem = ({ item }) => {
    const isUnread = !(item.isRead || item.read);
    const date = item.createdAt ? new Date(item.createdAt) : new Date();
    const isActionable = item.type === 'FRIEND_REQUEST' || item.type === 'GROUP_INVITE';
    const itemId = item.id || item.notificationId;
    const isSelected = selectedIds.includes(itemId);
    const CardContainer = (isSelectionMode || !isActionable) ? TouchableOpacity : View;

    return (
      <CardContainer
        onPress={() => handleItemPress(item)}
        onLongPress={() => handleItemLongPress(item)}
        activeOpacity={0.8}
        style={[
          styles.notificationItem, 
          { backgroundColor: colors.background, borderBottomColor: colors.border },
          isUnread && [styles.unreadItem, { backgroundColor: isDark ? colors.surface200 : '#f0f7ff' }],
          isSelected && { backgroundColor: isDark ? colors.surface300 : '#e2f0fe' }
        ]}
      >
        <View style={styles.itemMainContent}>
          {isSelectionMode && (
            <View style={styles.checkboxContainer}>
              <MaterialIcons 
                name={isSelected ? 'check-box' : 'check-box-outline-blank'} 
                size={24} 
                color={isSelected ? colors.primary : colors.textSubtle} 
              />
            </View>
          )}

          <View style={styles.iconContainer}>
            {(item.avatarUrl || item.type === 'FRIEND_REQUEST' || item.type === 'GROUP_INVITE' || item.type === 'FRIEND_ACCEPT' || item.type === 'FRIEND_ACCEPTED') ? (
              <Image 
                source={{ uri: getAvatarUrl(item.avatarUrl, item.fullName || item.message) }} 
                style={[styles.senderAvatar, { backgroundColor: colors.surface200 }]} 
              />
            ) : (
              <View style={[styles.iconBg, { backgroundColor: getIconColor(item.type) }]}>
                <MaterialIcons name={getIconName(item.type)} size={24} color="#fff" />
              </View>
            )}
            {isUnread && <View style={[styles.unreadDot, { borderColor: isDark ? colors.surface200 : '#fff' }]} />}
          </View>

          <View style={styles.contentContainer}>
            <View style={styles.headerRow}>
              <Text style={[styles.title, { color: colors.textMuted }, isUnread && [styles.unreadText, { color: colors.foreground }]]}>{translateNotificationTitle(item.title, t) || t('notifications.title')}</Text>
              <Text style={[styles.time, { color: colors.textSubtle }]}>{formatDate(date)}</Text>
            </View>

            <Text style={[styles.message, { color: colors.textMuted }]}>
              <Text style={[styles.boldText, { color: colors.foreground }]}>{translateNotificationMessage(item.message, t)}</Text>
              {item.subMessage ? ` ${item.subMessage}` : ''}
            </Text>
            
            {!(isActionable && isUnread) && <Text style={[styles.dateText, { color: colors.textSubtle }]}>{formatFullDate(date)}</Text>}

            {item.type === 'FRIEND_REQUEST' && isUnread && !isSelectionMode && (
              <View style={styles.actionRow}>
                <TouchableOpacity 
                  style={[styles.acceptButton, { backgroundColor: colors.primary, shadowColor: colors.primary }]}
                  onPress={() => handleAcceptFriendRequest(item.senderId, itemId)}
                >
                  <Text style={styles.acceptButtonText}>{t('notifications.accept')}</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.rejectButton, { backgroundColor: colors.card, borderColor: colors.border }]}
                  onPress={() => handleRejectFriendRequest(item.senderId, itemId, item.fullName)}
                >
                  <Text style={[styles.rejectButtonText, { color: colors.textMuted }]}>{t('notifications.decline')}</Text>
                </TouchableOpacity>
              </View>
            )}

            {item.type === 'GROUP_INVITE' && isUnread && !isSelectionMode && (
              <View style={styles.actionRow}>
                <TouchableOpacity 
                  style={[styles.acceptButton, { backgroundColor: colors.primary, shadowColor: colors.primary }]}
                  onPress={() => handleAcceptGroupInvite(item.invitationId || item.id, itemId)}
                >
                  <Text style={styles.acceptButtonText}>{t('notifications.join')}</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.rejectButton, { backgroundColor: colors.card, borderColor: colors.border }]}
                  onPress={() => handleRejectGroupInvite(item.invitationId || item.id, itemId)}
                >
                  <Text style={[styles.rejectButtonText, { color: colors.textMuted }]}>{t('notifications.decline_group')}</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </CardContainer>
    );
  };

  const getIconName = (type) => {
    switch (type) {
      case 'MESSAGE': return 'chat';
      case 'FRIEND_REQUEST': return 'person-add';
      case 'SYSTEM': return 'settings';
      default: return 'notifications';
    }
  };

  const getIconColor = (type) => {
    switch (type) {
      case 'MESSAGE': return '#667eea';
      case 'FRIEND_REQUEST': return '#10b981';
      case 'SYSTEM': return '#f59e0b';
      default: return '#64748b';
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        {isSelectionMode ? (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <TouchableOpacity onPress={handleCancelSelection} style={{ padding: 5 }}>
                <MaterialIcons name="close" size={24} color={colors.foreground} />
              </TouchableOpacity>
              <Text style={[styles.headerTitle, { fontSize: 20, color: colors.foreground }]}>
                {t('notifications.selected_count', { count: selectedIds.length })}
              </Text>
            </View>
            <TouchableOpacity 
              onPress={handleDeleteSelected} 
              disabled={selectedIds.length === 0} 
              style={{ padding: 5, opacity: selectedIds.length === 0 ? 0.4 : 1 }}
            >
              <MaterialIcons name="delete" size={24} color="#ef4444" />
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={[styles.headerTitle, { color: colors.foreground }]}>{t('notifications.title')}</Text>
            <TouchableOpacity style={{ padding: 5 }} onPress={showThreeDotMenu}>
              <MaterialIcons name="more-vert" size={24} color={colors.foreground} />
            </TouchableOpacity>
          </>
        )}
      </View>


      {loading && !refreshing && notifications.length === 0 ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>

      ) : (
        <FlatList
          data={notifications}
          renderItem={renderNotificationItem}
          keyExtractor={(item) => (item.id || item.notificationId || Math.random().toString())}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#667eea" />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MaterialIcons name="notifications-none" size={64} color="#cbd5e1" />
              <Text style={styles.emptyText}>{t('notifications.no_notifications')}</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#1e293b' },
  markAllBtn: { padding: 5 },
  markAllText: { fontSize: 13, color: '#667eea', fontWeight: '600' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { paddingBottom: 120 },
  notificationItem: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  unreadItem: { backgroundColor: '#f0f7ff' },
  iconContainer: { position: 'relative', marginRight: 15 },
  iconBg: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  unreadDot: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#ef4444',
    borderWidth: 2,
    borderColor: '#fff',
  },
  contentContainer: { flex: 1 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  title: { fontSize: 16, fontWeight: '600', color: '#334155' },
  unreadText: { color: '#1e293b' },
  time: { fontSize: 12, color: '#94a3b8' },
  message: { fontSize: 14, color: '#64748b', marginBottom: 6 },
  dateText: { fontSize: 11, color: '#94a3b8' },
  itemMainContent: { flexDirection: 'row', flex: 1 },
  boldText: { fontWeight: 'bold', color: '#1e293b' },
  senderAvatar: { width: 48, height: 48, borderRadius: 24 },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  acceptButton: {
    flex: 1,
    backgroundColor: '#6366f1',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  rejectButton: {
    flex: 1,
    backgroundColor: '#fff',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  rejectButtonText: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  acceptButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  emptyContainer: { flex: 1, alignItems: 'center', marginTop: 100 },
  emptyText: { marginTop: 15, color: '#94a3b8', fontSize: 16 },
  checkboxContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
});

export default NotificationsScreen;
