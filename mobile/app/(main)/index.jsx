import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Image, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useDispatch, useSelector } from 'react-redux';
import { fetchConversations, setCurrentUserId } from '../../src/store/chatSlice';
import { MaterialIcons } from '@expo/vector-icons';
import CONFIG from '../../src/config';
import SearchModal from '../../src/components/SearchModal';

const HomeScreen = () => {
  const router = useRouter();
  const dispatch = useDispatch();
  const { conversations, loading } = useSelector((state) => state.chat);
  const currentUser = useSelector((state) => state.auth.user);
  const [refreshing, setRefreshing] = useState(false);
  const [searchVisible, setSearchVisible] = useState(false);

  const BASE_URL = CONFIG.API_URL.split('/api')[0];

  useEffect(() => {
    dispatch(fetchConversations());
    if (currentUser?.userId || currentUser?.id) {
      dispatch(setCurrentUserId(String(currentUser.userId || currentUser.id)));
    }
  }, [currentUser, dispatch]);

  const onRefresh = async () => {
    setRefreshing(true);
    await dispatch(fetchConversations());
    setRefreshing(false);
  };

  const getAvatarUrl = (url, name) => {
    if (!url) return `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'U')}&background=667eea&color=fff&size=128&bold=true`;
    if (url.startsWith('http')) return url;
    return `${BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
  };

  const renderConversationItem = ({ item }) => {
    const currentUserId = String(currentUser?.userId || currentUser?.id || '');
    const members = item.members || item.participants || [];
    const otherMember = item.type === 'SINGLE'
      ? members.find(m => {
          const mId = String(m.userId || m.id || '');
          return mId !== '' && mId !== currentUserId;
        })
      : null;

    const displayName = item.type === 'SINGLE'
      ? (otherMember?.fullName || otherMember?.name || otherMember?.firstName || item.name || 'Người dùng')
      : (item.name || 'Nhóm chat');

    const avatarUrl = getAvatarUrl(
      item.type === 'SINGLE'
        ? (otherMember?.avatarUrl || otherMember?.avatar || otherMember?.profilePic)
        : (item.avatarUrl || item.avatar),
      displayName
    );

    const isOnline = otherMember?.status === 'ONLINE' || otherMember?.isOnline === true;

    const isUnread = item.isUnread === true;
    const unreadCount = item.unreadCount || 0;
    const unreadText = unreadCount > 9 ? '9+' : String(unreadCount);
    const isOwnLastMessage = String(item.lastMessageSenderId || item.lastSenderId || '') === currentUserId;
    const lastMessagePreview = item.lastMessage || 'Chưa có tin nhắn';
    const previewText = isOwnLastMessage ? `Bạn: ${lastMessagePreview}` : lastMessagePreview;

    return (
      <TouchableOpacity
        style={[styles.conversationItem, isUnread && styles.conversationItemUnread]}
        onPress={() => router.push(`/chat/${encodeURIComponent(item.conversationId)}`)}
      >
        <View style={styles.avatarContainer}>
          <Image source={{ uri: avatarUrl }} style={styles.avatar} />
          {isOnline && <View style={styles.onlineBadge} />}
        </View>
        <View style={styles.conversationInfo}>
          <View style={styles.conversationHeader}>
            <Text style={styles.conversationName} numberOfLines={1}>{displayName}</Text>
            <View style={styles.rightLabel}>
              {unreadCount > 0 && (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadBadgeText}>{unreadText}</Text>
                </View>
              )}
              <Text style={styles.conversationTime}>
                {item.updatedAt ? new Date(item.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
              </Text>
            </View>
          </View>
          <Text style={[styles.lastMessage, isUnread && styles.lastMessageUnread]} numberOfLines={1}>
            {previewText}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Messages</Text>
        <TouchableOpacity style={styles.searchButton} onPress={() => setSearchVisible(true)}>
          <MaterialIcons name="search" size={24} color="#1f2937" />
        </TouchableOpacity>
      </View>

      {loading && !refreshing && conversations.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#667eea" />
        </View>
      ) : (
        <FlatList
          data={conversations}
          renderItem={renderConversationItem}
          keyExtractor={(item) => item.conversationId}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>Chưa có cuộc hội thoại nào</Text>
            </View>
          }
        />
      )}

      <SearchModal 
        visible={searchVisible} 
        onClose={() => setSearchVisible(false)} 
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  headerTitle: { fontSize: 28, fontWeight: 'bold', color: '#1f2937' },
  searchButton: { padding: 8, backgroundColor: '#f3f4f6', borderRadius: 12 },
  listContent: { paddingHorizontal: 16 },
  conversationItem: {
    flexDirection: 'row',
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  conversationItemUnread: {
    backgroundColor: '#eef2ff',
  },
  rightLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  unreadBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#4338ca',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  unreadBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  lastMessageUnread: {
    fontWeight: '700',
    color: '#111827',
  },
  avatarContainer: { position: 'relative' },
  avatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#f3f4f6' },
  onlineBadge: {
    position: 'absolute',
    right: 2,
    bottom: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#4ade80',
    borderWidth: 2,
    borderColor: '#fff',
  },
  conversationInfo: { flex: 1, marginLeft: 16 },
  conversationHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  conversationName: { fontSize: 16, fontWeight: '600', color: '#1f2937' },
  conversationTime: { fontSize: 12, color: '#9ca3af' },
  lastMessage: { fontSize: 14, color: '#6b7280' },
  lastMessageUnread: { fontWeight: '700', color: '#111827' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyContainer: { flex: 1, alignItems: 'center', marginTop: 100 },
  emptyText: { color: '#9ca3af', fontSize: 16 },
});

export default HomeScreen;
