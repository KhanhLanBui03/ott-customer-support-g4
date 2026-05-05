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
} from 'react-native';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { useDispatch, useSelector } from 'react-redux';
import { fetchNotifications, markAsRead, removeNotification } from '../../src/store/notificationSlice';
import { fetchConversations } from '../../src/store/chatSlice';
import { friendApi } from '../../src/api/friendApi';
import { conversationApi } from '../../src/api/chatApi';
import { Alert } from 'react-native';

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
  const dispatch = useDispatch();
  const { notifications, loading } = useSelector((state) => state.notifications);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    dispatch(fetchNotifications());
  }, [dispatch]);

  const onRefresh = async () => {
    setRefreshing(true);
    await dispatch(fetchNotifications());
    setRefreshing(false);
  };

  const handleNotificationPress = (item) => {
    if (!(item.isRead || item.read)) {
      dispatch(markAsRead(item.id || item.notificationId));
    }
    // Handle navigation if needed
  };

  const BASE_URL = useSelector(state => state.chat?.BASE_URL) || 'http://192.168.1.98:8080'; // Fallback if needed

  const getAvatarUrl = (url, name) => {
    if (!url) return `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'U')}&background=667eea&color=fff&size=128&bold=true`;
    if (url.startsWith('http')) return url;
    const baseUrl = BASE_URL.includes('/api') ? BASE_URL.split('/api')[0] : BASE_URL;
    return `${baseUrl}${url.startsWith('/') ? '' : '/'}${url}`;
  };

  const handleAcceptFriendRequest = async (senderId, notificationId) => {
    try {
      await friendApi.acceptFriendRequest(senderId);
      Alert.alert('Thành công', 'Bạn và người ấy đã trở thành bạn bè!');
      dispatch(markAsRead(notificationId));
      onRefresh(); 
    } catch (err) {
      Alert.alert('Lỗi', 'Không thể chấp nhận lời mời lúc này.');
    }
  };

  const handleRejectFriendRequest = async (senderId, notificationId, senderName) => {
    Alert.alert(
      'Xác nhận',
      `Bạn có chắc chắn muốn từ chối lời mời kết bạn từ ${senderName || 'người này'}?`,
      [
        { text: 'Hủy', style: 'cancel' },
        { 
          text: 'Từ chối', 
          style: 'destructive',
          onPress: async () => {
            try {
              await friendApi.rejectFriendRequest(senderId);
              Alert.alert('Thông báo', `Bạn đã từ chối lời mời kết bạn từ ${senderName || 'người này'}.`, [
                { text: 'OK', onPress: () => dispatch(removeNotification(notificationId)) }
              ]);
            } catch (err) {
              Alert.alert('Lỗi', 'Không thể từ chối lời mời lúc này.');
            }
          }
        }
      ]
    );
  };

  const handleAcceptGroupInvite = async (invitationId, notificationId) => {
    try {
      await conversationApi.acceptInvitation(invitationId);
      Alert.alert('Thành công', 'Bạn đã tham gia nhóm!');
      dispatch(markAsRead(notificationId));
      onRefresh();
    } catch (err) {
      const errorMessage = err.response?.data?.message || '';
      if (errorMessage === 'Bạn đã là thành viên của nhóm này') {
        Alert.alert('Thông báo', 'Bạn đã tham gia vào nhóm rồi.', [
          { text: 'OK', onPress: () => dispatch(removeNotification(notificationId)) }
        ]);
      } else {
        Alert.alert('Lỗi', 'Không thể tham gia nhóm lúc này.');
      }
    }
  };

  const handleRejectGroupInvite = async (invitationId, notificationId) => {
    try {
      await conversationApi.rejectInvitation(invitationId);
      Alert.alert('Thông báo', 'Đã từ chối lời mời vào nhóm.');
      dispatch(removeNotification(notificationId));
      onRefresh();
    } catch (err) {
      Alert.alert('Lỗi', 'Không thể từ chối lời mời lúc này.');
    }
  };

  const renderNotificationItem = ({ item }) => {
    const isUnread = !(item.isRead || item.read);
    const date = item.createdAt ? new Date(item.createdAt) : new Date();
    const isActionable = item.type === 'FRIEND_REQUEST' || item.type === 'GROUP_INVITE';

    return (
      <View style={[styles.notificationItem, isUnread && styles.unreadItem]}>
        <View style={styles.itemMainContent}>
          <View style={styles.iconContainer}>
            {item.avatarUrl ? (
              <Image 
                source={{ uri: getAvatarUrl(item.avatarUrl, item.fullName) }} 
                style={styles.senderAvatar} 
              />
            ) : (
              <View style={[styles.iconBg, { backgroundColor: getIconColor(item.type) }]}>
                <MaterialIcons name={getIconName(item.type)} size={24} color="#fff" />
              </View>
            )}
            {isUnread && <View style={styles.unreadDot} />}
          </View>

          <View style={styles.contentContainer}>
            <View style={styles.headerRow}>
              <Text style={[styles.title, isUnread && styles.unreadText]}>{item.title || 'Thông báo'}</Text>
              <Text style={styles.time}>{formatDate(date)}</Text>
            </View>
            
            <Text style={styles.message}>
              <Text style={styles.boldText}>{item.message}</Text>
              {item.subMessage ? ` ${item.subMessage}` : ''}
            </Text>
            
            {!(isActionable && isUnread) && <Text style={styles.dateText}>{formatFullDate(date)}</Text>}
            
            {item.type === 'FRIEND_REQUEST' && isUnread && (
              <View style={styles.actionRow}>
                <TouchableOpacity 
                  style={styles.acceptButton}
                  onPress={() => handleAcceptFriendRequest(item.senderId, item.id || item.notificationId)}
                >
                  <Text style={styles.acceptButtonText}>CHẤP NHẬN</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.rejectButton}
                  onPress={() => handleRejectFriendRequest(item.senderId, item.id || item.notificationId, item.fullName)}
                >
                  <Text style={styles.rejectButtonText}>HỦY</Text>
                </TouchableOpacity>
              </View>
            )}

            {item.type === 'GROUP_INVITE' && isUnread && (
              <View style={styles.actionRow}>
                <TouchableOpacity 
                  style={styles.acceptButton}
                  onPress={() => handleAcceptGroupInvite(item.invitationId || item.id, item.id || item.notificationId)}
                >
                  <Text style={styles.acceptButtonText}>THAM GIA</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.rejectButton}
                  onPress={() => handleRejectGroupInvite(item.invitationId || item.id, item.id || item.notificationId)}
                >
                  <Text style={styles.rejectButtonText}>TỪ CHỐI</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </View>
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
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Thông báo</Text>
        <TouchableOpacity style={styles.markAllBtn}>
          <Text style={styles.markAllText}>Đánh dấu đã đọc</Text>
        </TouchableOpacity>
      </View>

      {loading && !refreshing && notifications.length === 0 ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#667eea" />
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
              <Text style={styles.emptyText}>Chưa có thông báo nào</Text>
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
  listContent: { paddingBottom: 20 },
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
});

export default NotificationsScreen;
