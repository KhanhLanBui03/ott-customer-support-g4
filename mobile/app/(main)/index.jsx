import React, { useEffect, useState, useMemo, useRef } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Image, ActivityIndicator, RefreshControl, Modal, TouchableWithoutFeedback, ScrollView, Alert, TextInput, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useDispatch, useSelector } from 'react-redux';
import { fetchConversations, setCurrentUserId, updateConversation, removeConversationLocal, pinConversation, unpinConversation, updateMemberFriendshipStatus } from '../../src/store/chatSlice';
import { MaterialIcons, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { friendApi } from '../../src/api/friendApi';
import ReportModal from '../../src/components/ReportModal';
import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import CONFIG from '../../src/config';
import SearchModal from '../../src/components/SearchModal';
import CreateGroupModal from '../../src/components/CreateGroupModal';
import { TAGS, getTagByKey } from '../../src/constants/tags';
import { conversationApi } from '../../src/api/chatApi';
import { useTheme } from '../../src/context/ThemeContext';
import { useResponsive } from '../../src/hooks/useResponsive';
import { getPreviewText } from '../../src/utils/messageUtils';
import { useTranslation } from 'react-i18next';
import * as SecureStore from 'expo-secure-store';

const MONO_FONT = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' });

const HomeScreen = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const dispatch = useDispatch();
  const { conversations, loading } = useSelector((state) => state.chat);
  const currentUser = useSelector((state) => state.auth.user);
  const accessToken = useSelector((state) => state.auth.accessToken);
  const { colors, isDark, toggleTheme } = useTheme();
  const { isWideLayout, contentMaxWidth } = useResponsive();
  const [searchFocused, setSearchFocused] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // --- Ẩn hội thoại ---
  const [activeTab, setActiveTab] = useState('priority'); // 'priority' | 'hidden'
  const [hiddenConvIds, setHiddenConvIds] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const stored = await SecureStore.getItemAsync('hidden_conversation_ids');
        if (stored) setHiddenConvIds(JSON.parse(stored));
      } catch (e) {}
    })();
  }, []);

  const saveHiddenConvIds = async (ids) => {
    setHiddenConvIds(ids);
    try {
      await SecureStore.setItemAsync('hidden_conversation_ids', JSON.stringify(ids));
    } catch (e) {}
  };

  const handleToggleHide = (conv) => {
    const convId = conv.conversationId;
    const newHidden = hiddenConvIds.includes(convId)
      ? hiddenConvIds.filter(id => id !== convId)
      : [...hiddenConvIds, convId];
    saveHiddenConvIds(newHidden);
    setActionModalVisible(false);
  };
  // --- Kết thúc ẩn hội thoại ---

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

  const BASE_URL = CONFIG.BASE_URL;

  useEffect(() => {
    if (!accessToken) return;
    dispatch(fetchConversations());
    if (currentUser?.userId || currentUser?.id) {
      dispatch(setCurrentUserId(String(currentUser.userId || currentUser.id)));
    }
  }, [accessToken, currentUser, dispatch]);

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
      // Lọc theo tab ẩn/hiển thị
      const isHidden = hiddenConvIds.includes(conv.conversationId);
      if (activeTab === 'hidden') {
        if (!isHidden) return false;
      } else {
        if (isHidden) return false;
      }

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

    // Tab hidden: không phân chia ghim/thường
    if (activeTab === 'hidden') return filtered;

    const pinned = filtered.filter(c => c.isPinned);
    const regular = filtered.filter(c => !c.isPinned);

    const result = [];
    if (pinned.length > 0) {
      result.push({ isHeader: true, title: t('chat.pinned_messages') });
      result.push(...pinned);
      if (regular.length > 0) {
        result.push({ isHeader: true, title: t('chat.all') });
        result.push(...regular);
      }
    } else {
      result.push(...regular);
    }
    
    return result;
  }, [conversations, filterType, selectedTags, searchQuery, hiddenConvIds, activeTab]);

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
    
    const displayName = conv.name || t('common.user');

    if (isBlocked) {
      Alert.alert(
        t('info.unblock_user'),
        `${t('info.unblock_user')} ${displayName}?`,
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('info.unblock_user'),
            onPress: async () => {
              dispatch(updateMemberFriendshipStatus({
                userId: otherUserId,
                friendshipStatus: 'NONE',
                isRequester: null,
              }));
              try {
                await friendApi.unblockUser(otherUserId);
                Alert.alert(t('common.success'), t('info.unblocked_success', { name: displayName }));
              } catch (err) {
                dispatch(updateMemberFriendshipStatus({
                  userId: otherUserId,
                  friendshipStatus: 'BLOCKED',
                  isRequester: true,
                }));
                Alert.alert(t('common.error'), t('info.unblock_failed'));
              }
            }
          }
        ]
      );
    } else {
      Alert.alert(
        t('info.block_user'),
        t('info.block_user_confirm', { name: displayName }),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('chat.block_user'),
            style: 'destructive',
            onPress: async () => {
              dispatch(updateMemberFriendshipStatus({
                userId: otherUserId,
                friendshipStatus: 'BLOCKED',
                isRequester: true,
              }));
              try {
                await friendApi.blockUser(otherUserId);
                Alert.alert(t('common.success'), t('chat.success.blocked_user', { defaultValue: `Đã chặn ${displayName}` }));
              } catch (err) {
                dispatch(updateMemberFriendshipStatus({
                  userId: otherUserId,
                  friendshipStatus: 'NONE',
                  isRequester: null,
                }));
                Alert.alert(t('common.error'), t('info.block_failed'));
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
      t('chat.delete_conv'),
      `${t('chat.delete_for_me_confirm')} "${name}"?`,
      [
        { text: t('common.cancel'), style: 'cancel' },
        { 
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await conversationApi.deleteConversationForMe(conversationId);
              dispatch(removeConversationLocal({ conversationId }));
            } catch (err) {
              console.error('Delete conversation error:', err);
              Alert.alert(t('common.error'), t('chat.error'));
            }
          }
        }
      ]
    );
  };

  const renderRightActions = (_progress, _translation, item, displayName) => {
    return (
      <TouchableOpacity 
        style={styles.deleteActionContainer} 
        onPress={() => handleDeleteConversation(item.conversationId, displayName)}
      >
        <View style={styles.deleteActionItem}>
          <MaterialCommunityIcons name="trash-can-outline" size={28} color="#fff" />
          <Text style={styles.deleteActionText}>{t('common.delete')}</Text>
        </View>
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
      ? (otherMember?.fullName || otherMember?.name || otherMember?.firstName || item.name || t('common.user'))
      : (item.name || t('chat.default_group_name'));

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
    const lastSenderId = String(item.lastMessageSenderId || item.lastSenderId || '');
    const isOwnLastMessage = lastSenderId === currentUserId;
    const lastMessagePreview = getPreviewText(item.lastMessage, lastSenderId);
    
    // Kiểm tra mention
    const myName = currentUser?.fullName || currentUser?.name || '';
    const isMentioned = !isOwnLastMessage && (
      lastMessagePreview.includes(`@${myName}`) || 
      lastMessagePreview.toLowerCase().includes('@all')
    );

    // Lấy tên người gửi thực tế từ danh sách thành viên
    const lastSender = members.find(m => String(m.userId || m.id) === lastSenderId);
    
    let senderName = t('chat.member');
    if (lastSender) {
      senderName = lastSender.fullName || lastSender.name || lastSender.firstName || t('chat.member');
    } else if (item.lastMessageSenderName || item.lastSenderName) {
      senderName = item.lastMessageSenderName || item.lastSenderName;
    }

    const isSystemMessage = lastSenderId === 'SYSTEM';

    const previewText = isSystemMessage 
      ? lastMessagePreview
      : (isMentioned 
          ? `${senderName}: ${lastMessagePreview}`
          : (isOwnLastMessage ? `${t('chat.you')} ${lastMessagePreview}` : (item.type === 'GROUP' ? `${senderName}: ${lastMessagePreview}` : lastMessagePreview)));





    
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
            {
              backgroundColor: isAIConv
                ? (isDark ? 'rgba(129, 140, 248, 0.08)' : '#F5F3FF')
                : colors.card,
              borderColor: isAIConv
                ? colors.aiBorder
                : isUnread
                  ? colors.primary
                  : colors.border,
              borderLeftWidth: isUnread || isAIConv ? 3 : 1,
              borderLeftColor: isAIConv ? colors.aiAccent : (isUnread ? colors.primary : colors.border),
            },
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
          activeOpacity={0.75}
        >
          <View style={styles.avatarContainer}>
            {isAIConv ? (
              <View style={[styles.avatar, { borderRadius: 16, backgroundColor: colors.aiSurface, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: colors.aiAccent }]}>
                <Ionicons name="sparkles" size={22} color={colors.aiAccent} />
              </View>
            ) : (
              <Image source={{ uri: avatarUrl }} style={[styles.avatar, { borderWidth: 1, borderColor: colors.border }]} />
            )}
            {(isOnline || isAIConv) && (
              <View style={[styles.onlineBadge, { backgroundColor: isAIConv ? colors.aiAccent : colors.online, borderColor: colors.card }]} />
            )}
            {item.isPinned && (
              <View style={[styles.pinBadge, { backgroundColor: colors.primary }]}>
                <MaterialCommunityIcons name="pin" size={10} color="#fff" style={styles.pinIconTiny} />
              </View>
            )}
          </View>
          <View style={styles.conversationInfo}>
            <View style={styles.conversationHeader}>
              <View style={styles.nameRow}>
                <Text style={[styles.conversationName, { color: colors.foreground }]} numberOfLines={1}>{displayName}</Text>
                {isAIConv && (
                  <View style={[styles.aiMiniChip, { backgroundColor: colors.aiSurface, borderColor: colors.aiBorder }]}>
                    <Text style={[styles.aiMiniChipText, { color: colors.aiAccent }]}>AI</Text>
                  </View>
                )}
                {tagInfo && (
                  <View style={[styles.tagDot, { backgroundColor: tagInfo.color }]} />
                )}
              </View>
              <View style={styles.rightLabel}>
                <Text style={[styles.conversationTime, { color: isUnread ? colors.primaryText : colors.textSubtle, fontFamily: MONO_FONT }]}>
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
                    <MaterialCommunityIcons name="at" size={16} color={colors.primary} />
                  </View>
                )}
                {unreadCount > 0 && (
                  <View style={[styles.unreadBadge, { backgroundColor: colors.primary }]}>
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
    <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[{ flex: 1, width: '100%' }, isWideLayout && { maxWidth: Math.min(contentMaxWidth, 860), alignSelf: 'center' }]}>
        {/* Command Header */}
        <View style={styles.header}>
          <View style={styles.brandRow}>
            <View style={[styles.brandBadge, { backgroundColor: isDark ? 'rgba(59, 130, 246, 0.16)' : '#DBEAFE', borderColor: colors.primary }]}>
              <MaterialCommunityIcons name="flash" size={20} color={colors.primaryBright || colors.primary} />
            </View>
            <View>
              <Text style={[styles.headerTitle, { color: colors.foreground }]}>{t('chat.title')}</Text>
              <View style={styles.liveRow}>
                <View style={[styles.liveDot, { backgroundColor: colors.online }]} />
                <Text style={[styles.liveText, { color: colors.textSubtle, fontFamily: MONO_FONT }]}>F5 LIVE</Text>
              </View>
            </View>
          </View>
          <View style={styles.headerButtons}>
            <TouchableOpacity 
              style={[styles.headerButton, { backgroundColor: colors.surface100, borderColor: colors.border }]} 
              onPress={() => router.push('/qr-scanner')}
              accessibilityLabel="Quét mã QR đăng nhập web"
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <MaterialCommunityIcons name="qrcode-scan" size={20} color={colors.foreground} />
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.headerButton, { backgroundColor: colors.surface100, borderColor: colors.border }]} 
              onPress={toggleTheme}
              accessibilityLabel="Chuyển chế độ sáng tối"
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Ionicons 
                name={isDark ? "sunny" : "moon"} 
                size={20} 
                color={isDark ? '#FFBA00' : colors.primary}
              />
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.headerButton, { backgroundColor: colors.surface100, borderColor: colors.border }]} 
              onPress={() => setCreateGroupVisible(true)}
              accessibilityLabel="Tạo nhóm mới"
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <MaterialIcons name="group-add" size={22} color={colors.foreground} />
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.headerButton, { backgroundColor: colors.surface100, borderColor: colors.border }]} 
              onPress={() => setSearchVisible(true)}
              accessibilityLabel="Tìm bạn mới"
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <MaterialIcons name="person-add" size={22} color={colors.primary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Search Bar (Command Input) */}
        <View style={styles.searchContainer}>
          <View
            style={[
              styles.searchBar,
              {
                backgroundColor: colors.surface100,
                borderColor: searchFocused ? colors.primary : colors.border,
              },
            ]}
          >
            <MaterialIcons name="search" size={20} color={searchFocused ? colors.primary : colors.textSubtle} />
            <TextInput
              placeholder={t('chat.search_placeholder', { type: t('chat.group').toLowerCase() })}
              placeholderTextColor={colors.textSubtle}
              style={[styles.searchInput, { color: colors.foreground }]}
              value={searchQuery}
              onChangeText={setSearchQuery}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close-circle" size={18} color={colors.textSubtle} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Active Signal Rail (Quick AI + Online Contacts) */}
        {(() => {
          const currentUserId = String(currentUser?.userId || currentUser?.id || '');
          const onlinePeers = conversations
            .filter(c => c.type !== 'GROUP' && !c.conversationId?.includes('shop-expert-ai-bot'))
            .map(c => {
              const other = c.members?.find(m => String(m.userId || m.id) !== currentUserId);
              const isOnline = other?.status === 'ONLINE' || other?.isOnline === true;
              if (!other || !isOnline) return null;
              const name = other.fullName || other.name || c.name || 'User';
              const rawAv = other.avatarUrl || other.avatar || c.avatarUrl || c.avatar;
              const avatar = rawAv
                ? (rawAv.startsWith('http') ? rawAv : `${BASE_URL}${rawAv.startsWith('/') ? '' : '/'}${rawAv}`)
                : `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=3B82F6&color=fff&size=128&bold=true`;
              return { id: c.conversationId, name, avatar };
            })
            .filter(Boolean)
            .slice(0, 12);

          return (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.signalRailContent}
              style={styles.signalRail}
            >
              <TouchableOpacity
                style={styles.signalNode}
                activeOpacity={0.75}
                onPress={() => {
                  if (currentUserId) {
                    const participants = [currentUserId, 'shop-expert-ai-bot'].sort();
                    const aiConvId = `SINGLE#${participants[0]}#${participants[1]}`;
                    router.push({
                      pathname: `/chat/${encodeURIComponent(aiConvId)}`,
                      params: { name: 'ShopExpert AI', type: 'SINGLE' },
                    });
                  }
                }}
              >
                <View style={[styles.signalAvatarRing, { borderColor: colors.aiAccent, backgroundColor: colors.aiSurface }]}>
                  <Ionicons name="sparkles" size={22} color={colors.aiAccent} />
                  <View style={[styles.signalOnlineDot, { backgroundColor: colors.aiAccent, borderColor: colors.background }]} />
                </View>
                <Text style={[styles.signalNodeLabel, { color: colors.aiAccent, fontWeight: '700' }]} numberOfLines={1}>
                  AI Copilot
                </Text>
              </TouchableOpacity>

              {onlinePeers.map((peer) => (
                <TouchableOpacity
                  key={peer.id}
                  style={styles.signalNode}
                  activeOpacity={0.75}
                  onPress={() => router.push({
                    pathname: `/chat/${encodeURIComponent(peer.id)}`,
                    params: { name: peer.name, avatar: peer.avatar, type: 'SINGLE' },
                  })}
                >
                  <View style={[styles.signalAvatarRing, { borderColor: colors.primary }]}>
                    <Image source={{ uri: peer.avatar }} style={styles.signalAvatarImg} />
                    <View style={[styles.signalOnlineDot, { backgroundColor: colors.online, borderColor: colors.background }]} />
                  </View>
                  <Text style={[styles.signalNodeLabel, { color: colors.textMuted }]} numberOfLines={1}>
                    {peer.name.split(' ').slice(-1)[0]}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          );
        })()}


        {/* Tabs Phân loại (Đồng bộ Web) */}
        <View style={[styles.filterTabs, { borderBottomColor: colors.border }]}>
          <View style={styles.tabsRow}>
            <TouchableOpacity style={styles.tabItem} onPress={() => setActiveTab('priority')}>
              <Text style={[styles.tabText, activeTab === 'priority' && styles.tabTextActive]}>{t('chat.priority')}</Text>
              {activeTab === 'priority' && <View style={styles.tabIndicator} />}
            </TouchableOpacity>
            <TouchableOpacity style={styles.tabItem} onPress={() => setActiveTab('hidden')}>
              <Text style={[styles.tabText, activeTab === 'hidden' && styles.tabTextActive]}>{t('chat.hidden_tab')}</Text>
              {activeTab === 'hidden' && <View style={styles.tabIndicator} />}
            </TouchableOpacity>
          </View>

          {activeTab === 'priority' && (
            <TouchableOpacity 
              style={[styles.filterButton, (filterType !== 'all' || selectedTags.length > 0) ? styles.filterButtonActive : { backgroundColor: colors.surface200 }]} 
              onPress={() => setFilterVisible(true)}
            >
              <Text style={[styles.filterButtonText, (filterType !== 'all' || selectedTags.length > 0) ? styles.filterButtonTextActive : { color: colors.textMuted }]}>
                {filterType === 'unread' ? t('chat.unread') : selectedTags.length > 0 ? `${t('chat.classify')} (${selectedTags.length})` : t('chat.classify')}
              </Text>
              <Ionicons 
                name="chevron-down" 
                size={14} 
                color={(filterType !== 'all' || selectedTags.length > 0) ? "#fff" : colors.textMuted} 
              />
            </TouchableOpacity>
          )}
        </View>


        {/*
           Chỉ hiển thị màn hình loading trung tâm khi:
           1. Đang tải (loading) HOẶC đang trong thời gian chờ 2s (showInitialLoading)
           2. VÀ Quan trọng: Danh sách hội thoại hiện tại phải đang trống (conversations.length === 0)
           3. VÀ Không phải đang thực hiện thao tác kéo để làm mới (refreshing)
        */}
        {((loading || showInitialLoading) && conversations.length === 0 && !refreshing) ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.textMuted, marginTop: 15 }]}>
              {t('chat.loading_content')}
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
                <Text style={styles.emptyText}>{t('chat.no_conversations_desc')}</Text>
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
                  <Text style={[styles.modalLabel, { color: colors.textSubtle }]}>{t('chat.filter_by_status').toUpperCase()}</Text>
                  <TouchableOpacity 
                    style={styles.filterOption} 
                    onPress={() => { setFilterType('all'); setFilterVisible(false); }}
                  >
                    <Text style={[styles.optionText, { color: colors.foreground }, filterType === 'all' && styles.optionTextActive]}>{t('chat.all')}</Text>
                    <View style={[styles.radioCircle, { borderColor: colors.border }, filterType === 'all' && styles.radioActive]}>
                      {filterType === 'all' && <View style={styles.radioDot} />}
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.filterOption} 
                    onPress={() => { setFilterType('unread'); setFilterVisible(false); }}
                  >
                    <View style={styles.nameRow}>
                      <Text style={[styles.optionText, { color: colors.foreground }, filterType === 'unread' && styles.optionTextActive]}>{t('chat.unread')}</Text>
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
                    <Text style={[styles.modalLabel, { color: colors.textSubtle }]}>{t('chat.filter_by_tag').toUpperCase()}</Text>
                    {selectedTags.length > 0 && (
                      <TouchableOpacity onPress={() => setSelectedTags([])}>
                        <Text style={styles.clearText}>{t('chat.clear').toUpperCase()}</Text>
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
                            <Text style={[styles.optionText, { color: colors.foreground }, isSelected && styles.optionTextActive]}>{t(`sidebar.tags.${tag.key}`)}</Text>
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
                      {actionModalType === 'menu' ? t('chat.context_menu_title') : t('chat.classify_title')}
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
                          {selectedConv?.isPinned ? t('chat.unpin_conv') : t('chat.pin_conv')}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity 
                        style={styles.actionListItem} 
                        onPress={() => setActionModalType('tags')}
                      >
                        <View style={[styles.actionListIcon, { backgroundColor: isDark ? colors.surface300 : '#fef3c7' }]}>
                          <MaterialCommunityIcons name="tag-plus-outline" size={24} color="#d97706" />
                        </View>
                        <Text style={[styles.actionListLabel, { color: colors.foreground }]}>{t('chat.classify')}</Text>
                      </TouchableOpacity>

                      {/* Ẩn / Bỏ ẩn hội thoại */}
                      <TouchableOpacity 
                        style={styles.actionListItem} 
                        onPress={() => handleToggleHide(selectedConv)}
                      >
                        <View style={[styles.actionListIcon, { backgroundColor: isDark ? colors.surface300 : '#f1f5f9' }]}>
                          <MaterialCommunityIcons 
                            name={hiddenConvIds.includes(selectedConv?.conversationId) ? "eye" : "eye-off"} 
                            size={24} 
                            color={colors.textMuted} 
                          />
                        </View>
                        <Text style={[styles.actionListLabel, { color: colors.foreground }]}>
                          {hiddenConvIds.includes(selectedConv?.conversationId) ? t('chat.unhide_conv') : t('chat.hide_conv')}
                        </Text>
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
                              {isBlocked ? t('info.unblock_user') : t('chat.block_user')}
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
                        <Text style={[styles.actionListLabel, { color: '#f43f5e' }]}>{t('chat.report')}</Text>
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
                        <Text style={[styles.actionLabel, { color: colors.textMuted }]}>{t('sidebar.remove_tag')}</Text>
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
                          <Text style={[styles.actionLabel, { color: colors.textMuted }]}>{t(`sidebar.tags.${tag.key}`)}</Text>
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
      </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050507' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingTop: 56,
    paddingBottom: 10,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandBadge: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 1 },
  liveDot: { width: 6, height: 6, borderRadius: 3 },
  liveText: { fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  headerButtons: { flexDirection: 'row', gap: 8 },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  // Search Bar Styles
  searchContainer: {
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    paddingVertical: 8,
  },

  // Active Signal Rail
  signalRail: {
    maxHeight: 84,
    marginBottom: 4,
  },
  signalRailContent: {
    paddingHorizontal: 18,
    gap: 14,
    alignItems: 'center',
  },
  signalNode: {
    alignItems: 'center',
    width: 58,
  },
  signalAvatarRing: {
    width: 50,
    height: 50,
    borderRadius: 18,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  signalAvatarImg: {
    width: 44,
    height: 44,
    borderRadius: 15,
  },
  signalOnlineDot: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
  },
  signalNodeLabel: {
    fontSize: 11,
    marginTop: 5,
    fontWeight: '600',
  },
  
  // Filter Tabs Styles
  filterTabs: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  tabsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  tabItem: {
    paddingBottom: 8,
    position: 'relative',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#8B949E',
  },
  tabTextActive: {
    fontSize: 14,
    fontWeight: '800',
    color: '#3B82F6',
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: '#3B82F6',
    borderRadius: 2,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  filterButtonActive: {
    backgroundColor: '#3B82F6',
  },
  filterButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#8B949E',
  },
  filterButtonTextActive: {
    color: '#fff',
  },

  listContent: { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 120, gap: 8 },
  conversationItem: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 16,
  },
  conversationItemUnread: {
    backgroundColor: '#0D2240',
  },
  aiMiniChip: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  aiMiniChipText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.6,
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
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  unreadBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  },
  avatarContainer: { position: 'relative' },
  avatar: { width: 54, height: 54, borderRadius: 27, backgroundColor: '#18181D' },
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
