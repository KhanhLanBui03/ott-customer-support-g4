import React, { useEffect, useState, useMemo, useRef } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Image, ActivityIndicator, RefreshControl, Modal, TouchableWithoutFeedback, ScrollView, Alert, Animated, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { useDispatch, useSelector } from 'react-redux';
import { fetchConversations, setCurrentUserId, updateConversation, removeConversationLocal, pinConversation, unpinConversation, updateMemberFriendshipStatus } from '../../src/store/chatSlice';
import { MaterialIcons, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { friendApi } from '../../src/api/friendApi';
import ReportModal from '../../src/components/ReportModal';
import { GestureHandlerRootView, Swipeable } from 'react-native-gesture-handler';
import CONFIG from '../../src/config';
import SearchModal from '../../src/components/SearchModal';
import CreateGroupModal from '../../src/components/CreateGroupModal';
import { TAGS, getTagByKey } from '../../src/constants/tags';
import { conversationApi } from '../../src/api/chatApi';
import { useTheme } from '../../src/context/ThemeContext';
import { getPreviewText } from '../../src/utils/messageUtils';


const HomeScreen = () => {
  const router = useRouter();
  const dispatch = useDispatch();
  const { conversations, loading } = useSelector((state) => state.chat);
  const currentUser = useSelector((state) => state.auth.user);
  const { colors, isDark, toggleTheme } = useTheme();
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [searchVisible, setSearchVisible] = useState(false);
  const [createGroupVisible, setCreateGroupVisible] = useState(false);
  // Chỉ hiện loading ban đầu nếu chưa có dữ liệu hội thoại
  const [showInitialLoading, setShowInitialLoading] = useState(conversations.length === 0);

  useEffect(() => {
    // Nếu chưa có hội thoại, đợi 2s để tạo hiệu ứng mượt mà (chỉ lần đầu đăng nhập)
    if (conversations.length === 0) {
      const timer = setTimeout(() => {
        setShowInitialLoading(false);
      }, 2000);
      return () => clearTimeout(timer);
    } else {
      setShowInitialLoading(false);
    }
  }, []);

  // States cho phân loại
  const [filterType, setFilterType] = useState('all'); // 'all', 'unread'
  const [selectedTags, setSelectedTags] = useState([]);
  const [filterVisible, setFilterVisible] = useState(false);
  const [actionModalVisible, setActionModalVisible] = useState(false);
  const [actionModalType, setActionModalType] = useState('menu'); // 'menu' or 'tags'
  const [selectedConv, setSelectedConv] = useState(null);
  const [isReportModalVisible, setIsReportModalVisible] = useState(false);

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

  // Logic lọc danh sách và phân đoạn Ghim
  const displayConversations = useMemo(() => {
    let filtered = conversations.filter(conv => {
      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        
        // 1. Check Group Name / Conversation Name
        const convName = (conv.name || '').toLowerCase();
        if (convName.includes(query)) return true;

        // 2. Check all members in this conversation (names and phones)
        const members = conv.members || conv.participants || [];
        const hasMatchingMember = members.some(m => {
          const fullName = (m.fullName || m.name || m.firstName || '').toLowerCase();
          const phone = (m.phoneNumber || m.phone || '').toLowerCase();
          return fullName.includes(query) || phone.includes(query);
        });

        if (hasMatchingMember) return true;

        return false;
      }

      if (filterType === 'unread' && (conv.unreadCount || 0) === 0) return false;
      if (selectedTags.length > 0) {
        if (!conv.tag || !selectedTags.includes(conv.tag)) return false;
      }
      return true;
    });

    const pinned = filtered.filter(c => c.isPinned);
    const regular = filtered.filter(c => !c.isPinned);

    const result = [];
    if (pinned.length > 0) {
      result.push({ isHeader: true, title: 'Hội thoại được ghim' });
      result.push(...pinned);
      if (regular.length > 0) {
        result.push({ isHeader: true, title: 'Tất cả tin nhắn' });
        result.push(...regular);
      }
    } else {
      result.push(...regular);
    }
    
    return result;
  }, [conversations, filterType, selectedTags, searchQuery]);

  const handleUpdateTag = async (conversationId, tagKey) => {
    try {
      await conversationApi.updateTag(conversationId, tagKey);
      dispatch(updateConversation({ conversationId, tag: tagKey }));
      setActionModalVisible(false);
      setActionModalType('menu');
    } catch (err) {
      console.error('Update tag error:', err);
    }
  };

  const handleTogglePin = async (conv) => {
    try {
      if (conv.isPinned) {
        await dispatch(unpinConversation(conv.conversationId));
      } else {
        await dispatch(pinConversation(conv.conversationId));
      }
      setActionModalVisible(false);
    } catch (err) {
      console.error('Toggle pin error:', err);
    }
  };

  const handleBlockToggleFromHome = (conv, otherUserId, isBlocked) => {
    setActionModalVisible(false);
    if (!otherUserId) return;
    
    const displayName = conv.name || 'Người dùng';

    if (isBlocked) {
      Alert.alert(
        'Bỏ chặn người dùng',
        `Bỏ chặn ${displayName}? Người này có thể gửi tin nhắn cho bạn trở lại.`,
        [
          { text: 'Hủy', style: 'cancel' },
          {
            text: 'Bỏ chặn',
            onPress: async () => {
              dispatch(updateMemberFriendshipStatus({
                userId: otherUserId,
                friendshipStatus: 'NONE',
                isRequester: null,
              }));
              try {
                await friendApi.unblockUser(otherUserId);
                Alert.alert('Đã bỏ chặn', `Bạn đã bỏ chặn ${displayName}.`);
              } catch (err) {
                dispatch(updateMemberFriendshipStatus({
                  userId: otherUserId,
                  friendshipStatus: 'BLOCKED',
                  isRequester: true,
                }));
                Alert.alert('Lỗi', 'Không thể bỏ chặn người dùng này.');
              }
            }
          }
        ]
      );
    } else {
      Alert.alert(
        'Chặn người dùng',
        `Bạn có chắc chắn muốn chặn ${displayName}? Người này sẽ không thể gửi tin nhắn cho bạn.`,
        [
          { text: 'Hủy', style: 'cancel' },
          {
            text: 'Chặn',
            style: 'destructive',
            onPress: async () => {
              dispatch(updateMemberFriendshipStatus({
                userId: otherUserId,
                friendshipStatus: 'BLOCKED',
                isRequester: true,
              }));
              try {
                await friendApi.blockUser(otherUserId);
                Alert.alert('Đã chặn', `Bạn đã chặn ${displayName}.`);
              } catch (err) {
                dispatch(updateMemberFriendshipStatus({
                  userId: otherUserId,
                  friendshipStatus: 'NONE',
                  isRequester: null,
                }));
                Alert.alert('Lỗi', 'Không thể chặn người dùng này.');
              }
            }
          }
        ]
      );
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
    if (item.isHeader) {
      return (
        <View style={[styles.sectionHeader, { backgroundColor: isDark ? colors.surface200 : '#f9fafb', borderBottomColor: colors.border }]}>
          <Text style={[styles.sectionHeaderText, { color: colors.textMuted }]}>{item.title}</Text>
        </View>
      );
    }


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
    const lastMessagePreview = getPreviewText(item.lastMessage);
    
    // Kiểm tra mention
    const myName = currentUser?.fullName || currentUser?.name || '';
    const isMentioned = !isOwnLastMessage && (
      lastMessagePreview.includes(`@${myName}`) || 
      lastMessagePreview.toLowerCase().includes('@all')
    );

    // Lấy tên người gửi thực tế từ danh sách thành viên
    const lastSenderId = String(item.lastMessageSenderId || item.lastSenderId || '');
    const lastSender = members.find(m => String(m.userId || m.id) === lastSenderId);
    
    let senderName = 'Thành viên';
    if (lastSender) {
      senderName = lastSender.fullName || lastSender.name || lastSender.firstName || 'Thành viên';
    } else if (item.lastMessageSenderName || item.lastSenderName) {
      senderName = item.lastMessageSenderName || item.lastSenderName;
    }

    const previewText = isMentioned 
      ? `${senderName}: ${lastMessagePreview}`
      : (isOwnLastMessage ? `Bạn: ${lastMessagePreview}` : (item.type === 'GROUP' ? `${senderName}: ${lastMessagePreview}` : lastMessagePreview));




    
    // Lấy thông tin tag
    const tagInfo = item.tag ? getTagByKey(item.tag) : null;
    const isAIConv = item.conversationId?.includes('shop-expert-ai-bot') || displayName?.toLowerCase()?.includes('shopexpert');

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
          style={[
            styles.conversationItem, 
            { backgroundColor: colors.background, borderBottomColor: colors.border },
            isUnread && { backgroundColor: isDark ? colors.surface200 : '#eef2ff' },
            item.isPinned && { backgroundColor: isDark ? colors.surface100 : colors.background }
          ]}
          onPress={() => router.push({
            pathname: `/chat/${encodeURIComponent(item.conversationId)}`,
            params: {
              name: displayName,
              avatar: avatarUrl,
              type: item.type
            }
          })}
          onLongPress={() => {
            setSelectedConv(item);
            setActionModalType('menu');
            setActionModalVisible(true);
          }}
          activeOpacity={0.7}
        >
          <View style={styles.avatarContainer}>
            {isAIConv ? (
              <View style={[styles.avatar, { backgroundColor: isDark ? 'rgba(99, 102, 241, 0.2)' : 'rgba(99, 102, 241, 0.1)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border }]}>
                <Ionicons name="sparkles" size={20} color="#6366f1" />
              </View>
            ) : (
              <Image source={{ uri: avatarUrl }} style={styles.avatar} />
            )}
            {(isOnline || isAIConv) && <View style={[styles.onlineBadge, { borderColor: colors.background }]} />}
            {item.isPinned && (
              <View style={styles.pinBadge}>
                <MaterialCommunityIcons name="pin" size={10} color="#fff" style={styles.pinIconTiny} />
              </View>
            )}
          </View>
          <View style={styles.conversationInfo}>
            <View style={styles.conversationHeader}>
              <View style={styles.nameRow}>
                <Text style={[styles.conversationName, { color: colors.foreground }]} numberOfLines={1}>{displayName}</Text>
                {tagInfo && (
                  <View style={[styles.tagDot, { backgroundColor: tagInfo.color }]} />
                )}
              </View>
              <View style={styles.rightLabel}>
                <Text style={[styles.conversationTime, { color: colors.textSubtle }]}>
                  {item.updatedAt ? new Date(item.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                </Text>
              </View>
            </View>
            <View style={styles.lastMessageRow}>
              <Text style={[styles.lastMessage, { color: colors.textMuted }, isUnread && [styles.lastMessageUnread, { color: colors.foreground }]]} numberOfLines={1}>
                {previewText}
              </Text>
              <View style={styles.rightActionsRow}>
                {isMentioned && (
                  <View style={styles.mentionBadge}>
                    <MaterialCommunityIcons name="at" size={16} color="#6366f1" />
                  </View>
                )}
                {unreadCount > 0 && (
                  <View style={styles.unreadBadge}>
                    <Text style={styles.unreadBadgeText}>{unreadText}</Text>
                  </View>
                )}
              </View>

            </View>
          </View>
        </TouchableOpacity>

      </Swipeable>
    );
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Header chính */}
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Tin nhắn</Text>
          <View style={styles.headerButtons}>
            <TouchableOpacity 
              style={[styles.headerButton, { backgroundColor: colors.surface200 }]} 
              onPress={() => router.push('/qr-scanner')}
              title="Quét mã QR đăng nhập web"
            >
              <MaterialCommunityIcons name="qrcode-scan" size={22} color={colors.foreground} />
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.headerButton, { backgroundColor: colors.surface200 }]} 
              onPress={toggleTheme}
            >
              <Ionicons 
                name={isDark ? "sunny" : "moon"} 
                size={22} 
                color={colors.foreground} 
              />
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.headerButton, { backgroundColor: colors.surface200 }]} 
              onPress={() => setCreateGroupVisible(true)}
            >
              <MaterialIcons name="group-add" size={24} color={colors.foreground} />
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.headerButton, { backgroundColor: colors.surface200 }]} 
              onPress={() => setSearchVisible(true)}
              title="Tìm bạn mới"
            >
              <MaterialIcons name="person-add" size={24} color={colors.foreground} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Search Bar (Conversation Filter) */}
        <View style={styles.searchContainer}>
          <View style={[styles.searchBar, { backgroundColor: isDark ? colors.surface200 : '#f3f4f6' }]}>
            <MaterialIcons name="search" size={20} color={colors.textMuted} />
            <TextInput
              placeholder="Tìm kiếm hội thoại..."
              placeholderTextColor={colors.textMuted}
              style={[styles.searchInput, { color: colors.foreground }]}
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>
        </View>


        {/* Tabs Phân loại (Đồng bộ Web) */}
        <View style={[styles.filterTabs, { borderBottomColor: colors.border }]}>
          <TouchableOpacity style={styles.tabItem}>
            <Text style={styles.tabTextActive}>Ưu tiên</Text>
            <View style={styles.tabIndicator} />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.filterButton, (filterType !== 'all' || selectedTags.length > 0) ? styles.filterButtonActive : { backgroundColor: colors.surface200 }]} 
            onPress={() => setFilterVisible(true)}
          >
            <Text style={[styles.filterButtonText, (filterType !== 'all' || selectedTags.length > 0) ? styles.filterButtonTextActive : { color: colors.textMuted }]}>
              {filterType === 'unread' ? 'Chưa đọc' : selectedTags.length > 0 ? `Phân loại (${selectedTags.length})` : 'Phân loại'}
            </Text>
            <Ionicons 
              name="chevron-down" 
              size={14} 
              color={(filterType !== 'all' || selectedTags.length > 0) ? "#fff" : colors.textMuted} 
            />
          </TouchableOpacity>
        </View>


        {/*
           Chỉ hiển thị màn hình loading trung tâm khi:
           1. Đang tải (loading) HOẶC đang trong thời gian chờ 2s (showInitialLoading)
           2. VÀ Quan trọng: Danh sách hội thoại hiện tại phải đang trống (conversations.length === 0)
           3. VÀ Không phải đang thực hiện thao tác kéo để làm mới (refreshing)
        */}
        {((loading || showInitialLoading) && conversations.length === 0 && !refreshing) ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#6366f1" />
            <Text style={[styles.loadingText, { color: colors.textMuted, marginTop: 15 }]}>
              Đang tải dữ liệu...
            </Text>
          </View>
        ) : (
          <FlatList
            data={displayConversations}
            renderItem={renderConversationItem}
            keyExtractor={(item, index) => item.conversationId || `header-${index}`}
            contentContainerStyle={styles.listContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>Chưa có hội thoại nào</Text>
              </View>
            }
          />
        )}

        {/* Modal Bộ lọc (Filter) */}
        <Modal visible={filterVisible} transparent animationType="fade">
          <TouchableWithoutFeedback onPress={() => setFilterVisible(false)}>
            <View style={styles.modalOverlay}>
              <TouchableWithoutFeedback>
                <View style={[styles.filterModalContainer, { backgroundColor: colors.card }]}>
                  <Text style={[styles.modalLabel, { color: colors.textSubtle }]}>THEO TRẠNG THÁI</Text>
                  <TouchableOpacity 
                    style={styles.filterOption} 
                    onPress={() => { setFilterType('all'); setFilterVisible(false); }}
                  >
                    <Text style={[styles.optionText, { color: colors.foreground }, filterType === 'all' && styles.optionTextActive]}>Tất cả</Text>
                    <View style={[styles.radioCircle, { borderColor: colors.border }, filterType === 'all' && styles.radioActive]}>
                      {filterType === 'all' && <View style={styles.radioDot} />}
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.filterOption} 
                    onPress={() => { setFilterType('unread'); setFilterVisible(false); }}
                  >
                    <View style={styles.nameRow}>
                      <Text style={[styles.optionText, { color: colors.foreground }, filterType === 'unread' && styles.optionTextActive]}>Chưa đọc</Text>
                      {conversations.filter(c => c.unreadCount > 0).length > 0 && (
                        <View style={styles.countBadge}>
                          <Text style={styles.countBadgeText}>{conversations.filter(c => c.unreadCount > 0).length}</Text>
                        </View>
                      )}
                    </View>
                    <View style={[styles.radioCircle, { borderColor: colors.border }, filterType === 'unread' && styles.radioActive]}>
                      {filterType === 'unread' && <View style={styles.radioDot} />}
                    </View>
                  </TouchableOpacity>

                  <View style={[styles.modalDivider, { backgroundColor: colors.border }]} />
                  
                  <View style={styles.modalHeaderRow}>
                    <Text style={[styles.modalLabel, { color: colors.textSubtle }]}>THEO THẺ PHÂN LOẠI</Text>
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
                            <Text style={[styles.optionText, { color: colors.foreground }, isSelected && styles.optionTextActive]}>{tag.label}</Text>
                          </View>
                          <View style={[styles.checkbox, { borderColor: colors.border }, isSelected && { backgroundColor: '#4f46e5', borderColor: '#4f46e5' }]}>
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
                <View style={[styles.actionSheet, { backgroundColor: colors.card }]}>
                  <View style={styles.sheetHeader}>
                    <Text style={[styles.sheetTitle, { color: colors.foreground }]}>
                      {actionModalType === 'menu' ? 'Tác vụ hội thoại' : 'Phân loại hội thoại'}
                    </Text>
                    <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
                  </View>
                  
                  {actionModalType === 'menu' ? (
                    <View style={styles.actionList}>
                      <TouchableOpacity 
                        style={styles.actionListItem} 
                        onPress={() => handleTogglePin(selectedConv)}
                      >
                        <View style={[styles.actionListIcon, { backgroundColor: isDark ? colors.surface300 : '#e0e7ff' }]}>
                          <MaterialCommunityIcons 
                            name={selectedConv?.isPinned ? "pin-off" : "pin"} 
                            size={24} 
                            color={isDark ? colors.primary : "#6366f1"} 
                          />
                        </View>
                        <Text style={[styles.actionListLabel, { color: colors.foreground }]}>
                          {selectedConv?.isPinned ? 'Bỏ ghim hội thoại' : 'Ghim hội thoại'}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity 
                        style={styles.actionListItem} 
                        onPress={() => setActionModalType('tags')}
                      >
                        <View style={[styles.actionListIcon, { backgroundColor: isDark ? colors.surface300 : '#fef3c7' }]}>
                          <MaterialCommunityIcons name="tag-plus-outline" size={24} color="#d97706" />
                        </View>
                        <Text style={[styles.actionListLabel, { color: colors.foreground }]}>Phân loại</Text>
                      </TouchableOpacity>

                      {selectedConv?.type === 'SINGLE' && (() => {
                        const currentUserId = String(currentUser?.userId || currentUser?.id || '');
                        const otherMember = selectedConv.members?.find(m => {
                          const mId = String(m.userId || m.id || '');
                          return mId !== '' && mId !== currentUserId;
                        });
                        const otherUserId = otherMember?.userId || otherMember?.id || '';
                        
                        const status = otherMember?.friendshipStatus;
                        const requester = otherMember?.isRequester;
                        const isBlocked = status === 'BLOCKED' && requester === true;

                        return (
                          <TouchableOpacity 
                            style={styles.actionListItem} 
                            onPress={() => handleBlockToggleFromHome(selectedConv, otherUserId, isBlocked)}
                          >
                            <View style={[styles.actionListIcon, { backgroundColor: isDark ? colors.surface300 : '#fee2e2' }]}>
                              <MaterialIcons name={isBlocked ? "lock-open" : "block"} size={24} color={isBlocked ? "#10b981" : "#ef4444"} />
                            </View>
                            <Text style={[styles.actionListLabel, { color: isBlocked ? "#10b981" : "#ef4444" }]}>
                              {isBlocked ? `Bỏ chặn người dùng` : `Chặn người dùng`}
                            </Text>
                          </TouchableOpacity>
                        );
                      })()}

                      <TouchableOpacity 
                        style={styles.actionListItem} 
                        onPress={() => {
                          setActionModalVisible(false);
                          setIsReportModalVisible(true);
                        }}
                      >
                        <View style={[styles.actionListIcon, { backgroundColor: isDark ? colors.surface300 : '#ffe4e6' }]}>
                          <MaterialIcons name="report" size={24} color="#f43f5e" />
                        </View>
                        <Text style={[styles.actionListLabel, { color: '#f43f5e' }]}>Báo xấu</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <ScrollView contentContainerStyle={styles.actionGrid}>
                      <TouchableOpacity 
                        style={styles.actionGridItem} 
                        onPress={() => handleUpdateTag(selectedConv.conversationId, null)}
                      >
                        <View style={[styles.actionIcon, { backgroundColor: colors.surface200 }]}>
                          <MaterialCommunityIcons name="tag-off" size={24} color={colors.textMuted} />
                        </View>
                        <Text style={[styles.actionLabel, { color: colors.textMuted }]}>Bỏ nhãn</Text>
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
                          <Text style={[styles.actionLabel, { color: colors.textMuted }]}>{tag.label}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  )}
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
        {(() => {
          const isGroup = selectedConv?.type === 'GROUP';
          let targetId = selectedConv?.conversationId;
          if (!isGroup && selectedConv) {
            const currentUserId = String(currentUser?.userId || currentUser?.id || '');
            const otherMember = selectedConv.members?.find(m => {
              const mId = String(m.userId || m.id || '');
              return mId !== '' && mId !== currentUserId;
            });
            targetId = otherMember?.userId || otherMember?.id || selectedConv.conversationId;
          }
          return (
            <ReportModal
              visible={isReportModalVisible}
              onClose={() => setIsReportModalVisible(false)}
              targetId={targetId}
              targetType={isGroup ? 'GROUP' : 'USER'}
            />
          );
        })()}
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
  
  // Search Bar Styles
  searchContainer: {
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 48,
    borderRadius: 16,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    paddingVertical: 8,
  },
  
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

  listContent: { paddingHorizontal: 16, paddingBottom: 120 },
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
  rightActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  mentionBadge: {
    marginRight: 2,
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
  lastMessageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lastMessage: { fontSize: 14, color: '#6b7280', flex: 1, marginRight: 8 },

  lastMessageUnread: { fontWeight: '700', color: '#111827' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { fontSize: 16, fontWeight: '600' },
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
  
  // Pinned & Divider Styles
  conversationItemPinned: {
    backgroundColor: '#fff', // Giữ trắng hoặc xám rất nhẹ
  },
  sectionHeader: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#f9fafb',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  sectionHeaderText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  pinBadge: {
    position: 'absolute',
    right: -2,
    top: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#6366f1',
    borderWidth: 2,
    borderColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pinIconTiny: {
    transform: [{ rotate: '45deg' }],
  },
  lastMessageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    marginTop: 2,
  },
  rightActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  itemTagButton: {
    padding: 4,
  },
  
  // Action List Styles (Two-step menu)
  actionList: {
    paddingTop: 10,
  },
  actionListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 16,
  },
  actionListIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionListLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
  },
});

export default HomeScreen;
