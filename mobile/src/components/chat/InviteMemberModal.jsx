import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { friendApi } from '../../api/friendApi';
import { userApi } from '../../api/userApi';
import { conversationApi } from '../../api/chatApi';
import { Alert } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useTranslation } from 'react-i18next';


const InviteMemberModal = ({ visible, onClose, conversationId, existingMemberIds = [] }) => {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');

  const [friends, setFriends] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [invitingIds, setInvitingIds] = useState(new Set());

  // Load friends on mount
  useEffect(() => {
    if (visible) {
      setInvitingIds(new Set());
      loadFriends();
    }
  }, [visible]);

  const loadFriends = async () => {
    try {
      setLoading(true);
      const response = await friendApi.getFriends();
      const friendsData = response.data || response || [];
      // Filter out friends who are already members and ensure they are accepted friends
      const availableFriends = friendsData.filter(
        f => f.status === 'ACCEPTED' && !existingMemberIds.includes(String(f.userId || f.id))
      );
      setFriends(availableFriends);
    } catch (err) {
      console.error('Failed to load friends:', err);
    } finally {
      setLoading(false);
    }
  };

  // Real-time search
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (searchQuery.length >= 3) {
        performSearch();
      } else {
        setSearchResults([]);
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  const performSearch = async () => {
    try {
      setLoading(true);
      const response = await userApi.searchUser(searchQuery);
      const results = response.data || response || [];
      const normalizedResults = Array.isArray(results) ? results : (results.id ? [results] : []);

      // Filter out existing members
      setSearchResults(normalizedResults.filter(
        u => !existingMemberIds.includes(String(u.userId || u.id))
      ));
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async (user) => {
    const userId = String(user.userId || user.id);
    if (invitingIds.has(userId)) return;

    try {
      setInvitingIds(prev => new Set(prev).add(userId));
      await conversationApi.inviteMember(conversationId, userId);
      Alert.alert(t('common.success', 'Thành công'), t('chat.invite_success_msg', 'Đã gửi lời mời đến {{name}}.', { name: user.fullName || t('chat.user_fallback', 'Người dùng') }));
    } catch (err) {
      const msg = err.response?.data?.message || t('chat.invite_failed_msg', 'Không thể gửi lời mời lúc này.');
      Alert.alert(t('common.error', 'Lỗi'), msg);
    } finally {
      // Keep it in inviting state to prevent double clicks, but maybe clear after some time
      // or just leave it until modal closes
    }
  };

  const renderUserItem = ({ item }) => {
    const userId = String(item.userId || item.id);
    const isInviting = invitingIds.has(userId);

    return (
      <View style={[styles.userItem, { borderBottomColor: colors.border }]}>
        <Image
          source={{ uri: item.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(item.fullName || 'U')}&background=667eea&color=fff&size=128&bold=true` }}
          style={styles.avatar}
        />
        <View style={styles.userInfo}>
          <Text style={[styles.userName, { color: colors.foreground }]}>{item.fullName || item.phoneNumber}</Text>
          {item.phoneNumber && <Text style={[styles.userPhone, { color: colors.textMuted }]}>{item.phoneNumber}</Text>}
        </View>
        <TouchableOpacity
          style={[styles.inviteButton, { backgroundColor: colors.primary }, isInviting && [styles.invitedButton, { backgroundColor: isDark ? colors.surface300 : '#e2e8f0' }]]}
          onPress={() => handleInvite(item)}
          disabled={isInviting}
        >
          <Text style={[styles.inviteButtonText, isInviting && { color: colors.textMuted }]}>{isInviting ? t('chat.invited', 'Đã mời') : t('chat.invite', 'Mời')}</Text>
        </TouchableOpacity>
      </View>

    );
  };

  const displayedData = searchQuery.length >= 3 ? searchResults : friends;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <Text style={[styles.headerTitle, { color: colors.foreground }]}>{t('chat.invite_friends', 'MỜI BẠN BÈ')}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={colors.textMuted} />
            </TouchableOpacity>
          </View>


          {/* Search Input */}
          <View style={styles.searchContainer}>
            <View style={[styles.searchInputWrapper, { backgroundColor: colors.input, borderColor: colors.border }]}>
              <MaterialIcons name="search" size={20} color={colors.textSubtle} style={styles.searchIcon} />
              <TextInput
                style={[styles.searchInput, { color: colors.foreground }]}
                placeholder={t('chat.search_by_phone', 'Tìm theo SĐT...')}
                placeholderTextColor={colors.textSubtle}
                value={searchQuery}
                onChangeText={setSearchQuery}
                keyboardType="phone-pad"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Ionicons name="close-circle" size={18} color={colors.textSubtle} />
                </TouchableOpacity>
              )}
            </View>
          </View>


          {/* List */}
          {loading && displayedData.length === 0 ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator color={colors.primary} size="large" />
            </View>

          ) : (
            <FlatList
              data={displayedData}
              renderItem={renderUserItem}
              keyExtractor={(item) => String(item.userId || item.id)}
              contentContainerStyle={styles.listContent}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <MaterialIcons name="person-search" size={48} color={colors.textSubtle} />
                  <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                    {searchQuery.length > 0
                      ? t('chat.user_not_found', 'Không tìm thấy người dùng này')
                      : t('chat.no_friends_to_invite', 'Bạn chưa có bạn bè nào để mời')}
                  </Text>
                </View>

              }
            />
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#0f172a', // Dark theme matching web
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: '80%',
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#f8fafc',
    letterSpacing: 1,
  },
  closeButton: {
    padding: 4,
  },
  searchContainer: {
    padding: 16,
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 48,
    borderWidth: 1,
    borderColor: '#334155',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: '#f8fafc',
    fontSize: 15,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  userInfo: {
    flex: 1,
    marginLeft: 12,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f8fafc',
  },
  userPhone: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  inviteButton: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 70,
    alignItems: 'center',
  },
  invitedButton: {
    backgroundColor: '#334155',
  },
  inviteButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    marginTop: 60,
  },
  emptyText: {
    marginTop: 12,
    color: '#64748b',
    fontSize: 15,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
});

export default InviteMemberModal;
