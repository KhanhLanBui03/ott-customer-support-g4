import React, { useEffect, useState, useMemo, useRef } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Image, ActivityIndicator, RefreshControl, Modal, TouchableWithoutFeedback, ScrollView, Alert, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { useDispatch, useSelector } from 'react-redux';
import { fetchConversations, setCurrentUserId, updateConversation, removeConversationLocal } from '../../src/store/chatSlice';
import { MaterialIcons, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { GestureHandlerRootView, Swipeable } from 'react-native-gesture-handler';
import CONFIG from '../../src/config';
import SearchModal from '../../src/components/SearchModal';
import CreateGroupModal from '../../src/components/CreateGroupModal';
import { TAGS, getTagByKey } from '../../src/constants/tags';
import { conversationApi } from '../../src/api/chatApi';

const HomeScreen = () => {
  const router = useRouter();
  const dispatch = useDispatch();
  const { conversations, loading } = useSelector((state) => state.chat);
  const currentUser = useSelector((state) => state.auth.user);
  const [refreshing, setRefreshing] = useState(false);
  const [searchVisible, setSearchVisible] = useState(false);
  const [createGroupVisible, setCreateGroupVisible] = useState(false);
  
  // States cho phân loại
  const [filterType, setFilterType] = useState('all'); // 'all', 'unread'
  const [selectedTags, setSelectedTags] = useState([]);
  const [filterVisible, setFilterVisible] = useState(false);
  const [actionModalVisible, setActionModalVisible] = useState(false);
  const [selectedConv, setSelectedConv] = useState(null);

  // Refs để quản lý các item đang mở swipe
  const swipeableRefs = useRef(new Map());

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

  // Logic lọc danh sách
  const filteredConversations = useMemo(() => {
    return conversations.filter(conv => {
      // 1. Lọc theo trạng thái chưa đọc
      if (filterType === 'unread' && (conv.unreadCount || 0) === 0) return false;
      
      // 2. Lọc theo các nhãn đã chọn
      if (selectedTags.length > 0) {
        if (!conv.tag || !selectedTags.includes(conv.tag)) return false;
      }
      
      return true;
    });
  }, [conversations, filterType, selectedTags]);

  const handleUpdateTag = async (conversationId, tagKey) => {
    try {
      await conversationApi.updateTag(conversationId, tagKey);
      dispatch(updateConversation({ conversationId, tag: tagKey }));
      setActionModalVisible(false);
    } catch (err) {
      console.error('Update tag error:', err);
    }
  };

  const handleDeleteConversation = (conversationId, name) => {
    // Đóng swipe trước khi hiện Alert
    const ref = swipeableRefs.current.get(conversationId);
    if (ref) ref.close();

    Alert.alert(
      'Xóa cuộc trò chuyện',
      `Bạn có chắc chắn muốn xóa cuộc trò chuyện với "${name}"? Hành động này không thể hoàn tác.`,
      [
        { text: 'Hủy', style: 'cancel' },
        { 
          text: 'Xóa', 
          style: 'destructive',
          onPress: async () => {
            try {
              await conversationApi.deleteConversationForMe(conversationId);
              dispatch(removeConversationLocal({ conversationId }));
            } catch (err) {
              console.error('Delete conversation error:', err);
              Alert.alert('Lỗi', 'Không thể xóa cuộc trò chuyện lúc này.');
            }
          }
        }
      ]
    );
  };

  const renderRightActions = (progress, dragX, item, displayName) => {
    const trans = dragX.interpolate({
      inputRange: [-100, 0],
      outputRange: [0, 100],
    });

    return (
      <TouchableOpacity 
        style={styles.deleteActionContainer} 
        onPress={() => handleDeleteConversation(item.conversationId, displayName)}
      >
        <Animated.View style={[styles.deleteActionItem, { transform: [{ translateX: 0 }] }]}>
          <MaterialCommunityIcons name="trash-can-outline" size={28} color="#fff" />
          <Text style={styles.deleteActionText}>Xóa</Text>
        </Animated.View>
      </TouchableOpacity>
    );
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
    
    // Lấy thông tin tag
    const tagInfo = item.tag ? getTagByKey(item.tag) : null;

    return (
      <Swipeable
        ref={ref => {
          if (ref) swipeableRefs.current.set(item.conversationId, ref);
        }}
        renderRightActions={(progress, dragX) => renderRightActions(progress, dragX, item, displayName)}
        friction={2}
        rightThreshold={40}
      >
        <TouchableOpacity
          style={[styles.conversationItem, isUnread && styles.conversationItemUnread]}
          onPress={() => router.push(`/chat/${encodeURIComponent(item.conversationId)}`)}
          onLongPress={() => {
            setSelectedConv(item);
            setActionModalVisible(true);
          }}
          activeOpacity={0.7}
        >
          <View style={styles.avatarContainer}>
            <Image source={{ uri: avatarUrl }} style={styles.avatar} />
            {isOnline && <View style={styles.onlineBadge} />}
          </View>
          <View style={styles.conversationInfo}>
            <View style={styles.conversationHeader}>
              <View style={styles.nameRow}>
                <Text style={styles.conversationName} numberOfLines={1}>{displayName}</Text>
                {tagInfo && (
                  <View style={[styles.tagDot, { backgroundColor: tagInfo.color }]} />
                )}
              </View>
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
      </Swipeable>
    );
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={styles.container}>
        {/* Header chính */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Tin nhắn</Text>
          <View style={styles.headerButtons}>
            <TouchableOpacity style={styles.headerButton} onPress={() => setCreateGroupVisible(true)}>
              <MaterialIcons name="group-add" size={24} color="#1f2937" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerButton} onPress={() => setSearchVisible(true)}>
              <MaterialIcons name="search" size={24} color="#1f2937" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Tabs Phân loại (Đồng bộ Web) */}
        <View style={styles.filterTabs}>
          <TouchableOpacity style={styles.tabItem}>
            <Text style={styles.tabTextActive}>Ưu tiên</Text>
            <View style={styles.tabIndicator} />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.filterButton, (filterType !== 'all' || selectedTags.length > 0) && styles.filterButtonActive]} 
            onPress={() => setFilterVisible(true)}
          >
            <Text style={[styles.filterButtonText, (filterType !== 'all' || selectedTags.length > 0) && styles.filterButtonTextActive]}>
              {filterType === 'unread' ? 'Chưa đọc' : selectedTags.length > 0 ? `Phân loại (${selectedTags.length})` : 'Phân loại'}
            </Text>
            <Ionicons 
              name="chevron-down" 
              size={14} 
              color={filterType !== 'all' || selectedTags.length > 0 ? "#fff" : "#64748b"} 
            />
          </TouchableOpacity>
        </View>

        {loading && !refreshing && conversations.length === 0 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#667eea" />
          </View>
        ) : (
          <FlatList
            data={filteredConversations}
            renderItem={renderConversationItem}
            keyExtractor={(item) => item.conversationId}
            contentContainerStyle={styles.listContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>Không tìm thấy hội thoại nào</Text>
              </View>
            }
          />
        )}

        {/* Modal Bộ lọc (Filter) */}
        <Modal visible={filterVisible} transparent animationType="fade">
          <TouchableWithoutFeedback onPress={() => setFilterVisible(false)}>
            <View style={styles.modalOverlay}>
              <TouchableWithoutFeedback>
                <View style={styles.filterModalContainer}>
                  <Text style={styles.modalLabel}>THEO TRẠNG THÁI</Text>
                  <TouchableOpacity 
                    style={styles.filterOption} 
                    onPress={() => { setFilterType('all'); setFilterVisible(false); }}
                  >
                    <Text style={[styles.optionText, filterType === 'all' && styles.optionTextActive]}>Tất cả</Text>
                    <View style={[styles.radioCircle, filterType === 'all' && styles.radioActive]}>
                      {filterType === 'all' && <View style={styles.radioDot} />}
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.filterOption} 
                    onPress={() => { setFilterType('unread'); setFilterVisible(false); }}
                  >
                    <View style={styles.nameRow}>
                      <Text style={[styles.optionText, filterType === 'unread' && styles.optionTextActive]}>Chưa đọc</Text>
                      {conversations.filter(c => c.unreadCount > 0).length > 0 && (
                        <View style={styles.countBadge}>
                          <Text style={styles.countBadgeText}>{conversations.filter(c => c.unreadCount > 0).length}</Text>
                        </View>
                      )}
                    </View>
                    <View style={[styles.radioCircle, filterType === 'unread' && styles.radioActive]}>
                      {filterType === 'unread' && <View style={styles.radioDot} />}
                    </View>
                  </TouchableOpacity>

                  <View style={styles.modalDivider} />
                  
                  <View style={styles.modalHeaderRow}>
                    <Text style={styles.modalLabel}>THEO THẺ PHÂN LOẠI</Text>
                    {selectedTags.length > 0 && (
                      <TouchableOpacity onPress={() => setSelectedTags([])}>
                        <Text style={styles.clearText}>XÓA</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  <ScrollView style={styles.tagList} showsVerticalScrollIndicator={false}>
                    {TAGS.map(tag => {
                      const isSelected = selectedTags.includes(tag.key);
                      return (
                        <TouchableOpacity 
                          key={tag.key} 
                          style={styles.filterOption}
                          onPress={() => {
                            setSelectedTags(prev => isSelected ? prev.filter(k => k !== tag.key) : [...prev, tag.key]);
                          }}
                        >
                          <View style={styles.tagLabel}>
                            <View style={[styles.tagIcon, { backgroundColor: tag.color }]} />
                            <Text style={[styles.optionText, isSelected && styles.optionTextActive]}>{tag.label}</Text>
                          </View>
                          <View style={[styles.checkbox, isSelected && { backgroundColor: '#4f46e5', borderColor: '#4f46e5' }]}>
                            {isSelected && <Ionicons name="checkmark" size={12} color="#fff" />}
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </Modal>

        {/* Modal Tác vụ (Long Press Actions) */}
        <Modal visible={actionModalVisible} transparent animationType="slide">
          <TouchableWithoutFeedback onPress={() => setActionModalVisible(false)}>
            <View style={styles.bottomOverlay}>
              <TouchableWithoutFeedback>
                <View style={styles.actionSheet}>
                  <View style={styles.sheetHeader}>
                    <Text style={styles.sheetTitle}>Phân loại hội thoại</Text>
                    <View style={styles.sheetHandle} />
                  </View>
                  
                  <ScrollView contentContainerStyle={styles.actionGrid}>
                    <TouchableOpacity 
                      style={styles.actionGridItem} 
                      onPress={() => handleUpdateTag(selectedConv.conversationId, null)}
                    >
                      <View style={[styles.actionIcon, { backgroundColor: '#f3f4f6' }]}>
                        <MaterialCommunityIcons name="tag-off" size={24} color="#64748b" />
                      </View>
                      <Text style={styles.actionLabel}>Bỏ nhãn</Text>
                    </TouchableOpacity>

                    {TAGS.map(tag => (
                      <TouchableOpacity 
                        key={tag.key} 
                        style={styles.actionGridItem}
                        onPress={() => handleUpdateTag(selectedConv.conversationId, tag.key)}
                      >
                        <View style={[styles.actionIcon, { backgroundColor: tag.color + '20' }]}>
                          <MaterialCommunityIcons name="tag" size={24} color={tag.color} />
                        </View>
                        <Text style={styles.actionLabel}>{tag.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </Modal>

        <SearchModal 
          visible={searchVisible} 
          onClose={() => setSearchVisible(false)} 
        />
        <CreateGroupModal
          visible={createGroupVisible}
          onClose={() => setCreateGroupVisible(false)}
        />
      </View>
    </GestureHandlerRootView>
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
    paddingBottom: 10,
  },
  headerTitle: { fontSize: 28, fontWeight: 'bold', color: '#1f2937' },
  headerButtons: { flexDirection: 'row', gap: 10 },
  headerButton: { padding: 8, backgroundColor: '#f3f4f6', borderRadius: 12 },
  
  // Filter Tabs Styles
  filterTabs: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  tabItem: {
    paddingBottom: 8,
    position: 'relative',
  },
  tabTextActive: {
    fontSize: 14,
    fontWeight: '800',
    color: '#3b82f6',
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: '#3b82f6',
    borderRadius: 2,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  filterButtonActive: {
    backgroundColor: '#3b82f6',
  },
  filterButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748b',
  },
  filterButtonTextActive: {
    color: '#fff',
  },

  listContent: { paddingHorizontal: 16 },
  conversationItem: {
    flexDirection: 'row',
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    backgroundColor: '#fff',
  },
  conversationItemUnread: {
    backgroundColor: '#eef2ff',
  },
  nameRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginRight: 8,
  },
  tagDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
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
  conversationHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  conversationName: { fontSize: 16, fontWeight: '600', color: '#1f2937' },
  conversationTime: { fontSize: 12, color: '#9ca3af' },
  lastMessage: { fontSize: 14, color: '#6b7280' },
  lastMessageUnread: { fontWeight: '700', color: '#111827' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyContainer: { flex: 1, alignItems: 'center', marginTop: 100 },
  emptyText: { color: '#9ca3af', fontSize: 16 },

  // Swipe Actions Styles
  deleteActionContainer: {
    width: 80,
    backgroundColor: '#ef4444',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteActionItem: {
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
  },
  deleteActionText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterModalContainer: {
    width: '85%',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 5,
  },
  modalLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94a3b8',
    letterSpacing: 1.5,
    marginBottom: 12,
  },
  filterOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  optionText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1e293b',
  },
  optionTextActive: {
    color: '#3b82f6',
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#e2e8f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioActive: {
    borderColor: '#3b82f6',
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#3b82f6',
  },
  countBadge: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 6,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  countBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '900',
  },
  modalDivider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginVertical: 15,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  clearText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#6366f1',
  },
  tagLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  tagIcon: {
    width: 14,
    height: 14,
    borderRadius: 4,
    transform: [{ rotate: '45deg' }],
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#e2e8f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tagList: {
    maxHeight: 250,
  },

  // Action Sheet Styles
  bottomOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  actionSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingBottom: 40,
    paddingHorizontal: 20,
  },
  sheetHeader: {
    alignItems: 'center',
    paddingVertical: 15,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#e2e8f0',
    borderRadius: 2,
    marginTop: 8,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1e293b',
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingTop: 10,
  },
  actionGridItem: {
    width: '30%',
    alignItems: 'center',
    marginBottom: 20,
  },
  actionIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  actionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
    textAlign: 'center',
  },
});

export default HomeScreen;
