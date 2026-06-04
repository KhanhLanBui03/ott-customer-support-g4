import React, { useEffect, useState, useMemo } from 'react';
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
  TextInput,
  Alert,
  DeviceEventEmitter,
} from 'react-native';
import { MaterialIcons, Ionicons, FontAwesome } from '@expo/vector-icons';
import { useDispatch, useSelector } from 'react-redux';
import { useRouter, useFocusEffect } from 'expo-router';
import { friendApi } from '../../src/api/friendApi';
import { useTheme } from '../../src/context/ThemeContext';
import { useTranslation } from 'react-i18next';


import CONFIG from '../../src/config';

const ContactsScreen = () => {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const router = useRouter();
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);

  const BASE_URL = CONFIG.BASE_URL;
  
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchFriends = async () => {
    try {
      const response = await friendApi.getFriends();
      if (!response) {
        setFriends([]);
        return;
      }
      // axiosClient returns response.data directly due to interceptor
      const data = response.data || response;
      const friendsList = Array.isArray(data) ? data : [];
      setFriends(friendsList.filter(f => f.status === 'ACCEPTED'));
    } catch (err) {
      console.error('Fetch friends error:', err);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      fetchFriends();
    }, [])
  );

  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener('friendship_changed', () => {
      fetchFriends();
    });
    return () => {
      subscription.remove();
    };
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchFriends();
    setRefreshing(false);
  };

  const getAvatarUrl = (url, name) => {
    if (!url) return `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'U')}&background=667eea&color=fff&size=128&bold=true`;
    if (url.startsWith('http')) return url;
    const baseUrl = BASE_URL.includes('/api') ? BASE_URL.split('/api')[0] : BASE_URL;
    return `${baseUrl}${url.startsWith('/') ? '' : '/'}${url}`;
  };

  const filteredFriends = useMemo(() => {
    if (!searchQuery.trim()) return friends;
    const query = searchQuery.toLowerCase();
    return friends.filter(f => 
      (f.fullName || '').toLowerCase().includes(query) || 
      (f.username || '').toLowerCase().includes(query) ||
      (f.phoneNumber || '').toLowerCase().includes(query)
    );
  }, [friends, searchQuery]);

  const handleChat = (friend) => {
    // Navigating to chat with the friend's ID. 
    // The chat screen logic (getRealId) will handle finding or creating the SINGLE conversation.
    router.push({
      pathname: `/chat/${friend.userId || friend.id}`,
      params: {
        name: friend.fullName || friend.name,
        avatar: friend.avatarUrl || friend.avatar,
        type: 'SINGLE'
      }
    });
  };

  const handleUnfriend = (friend) => {
    Alert.alert(
      t('friends.unfriend_confirm'),
      `${t('friends.unfriend_confirm')} ${friend.fullName || friend.name}?`,
      [
        { text: t('common.cancel'), style: 'cancel' },
        { 
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await friendApi.unfriend(friend.userId || friend.id);
              setFriends(prev => prev.filter(f => (f.userId || f.id) !== (friend.userId || friend.id)));
              Alert.alert(t('common.success'), t('common.success'));
              DeviceEventEmitter.emit('friendship_changed');
            } catch (err) {
              Alert.alert(t('common.error'), t('common.error'));
            }
          }
        }
      ]
    );
  };

  const renderFriendItem = ({ item }) => (
    <View style={[styles.friendItem, { backgroundColor: colors.card }]}>
      <Image 
        source={{ uri: getAvatarUrl(item.avatarUrl, item.fullName) }} 
        style={styles.avatar} 
      />
      <View style={styles.infoContainer}>
        <Text style={[styles.name, { color: colors.foreground }]}>{item.fullName || item.username || t('common.user')}</Text>
        <Text style={[styles.phone, { color: colors.textMuted }]}>{item.phoneNumber || t('user_info.no_phone')}</Text>
      </View>
      <View style={styles.actions}>
        <TouchableOpacity 
          style={[styles.actionButton, { backgroundColor: colors.surface200 }]} 
          onPress={() => handleChat(item)}
        >
          <MaterialIcons name="chat" size={24} color={colors.primary} />
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.actionButton, styles.unfriendButton, { backgroundColor: colors.card, borderColor: colors.border }]} 
          onPress={() => handleUnfriend(item)}
        >
          <MaterialIcons name="person-remove" size={24} color={colors.textSubtle} />
        </TouchableOpacity>
      </View>
    </View>

  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <View style={styles.headerTop}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>{t('friends.title_list')}</Text>
          <TouchableOpacity 
            style={[styles.requestButton, { backgroundColor: colors.primary }]}
            onPress={() => router.push('/notifications')}
          >
            <MaterialIcons name="notifications" size={18} color="#fff" />
            <Text style={styles.requestButtonText}>{t('friends.tabs.requests')}</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.searchContainer, { backgroundColor: colors.input }]}>
          <MaterialIcons name="search" size={20} color={colors.textSubtle} style={styles.searchIcon} />
          <TextInput
            style={[styles.searchInput, { color: colors.foreground }]}
            placeholder={t('friends.search_placeholder')}
            placeholderTextColor={colors.textSubtle}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <MaterialIcons name="close" size={20} color={colors.textSubtle} />
            </TouchableOpacity>
          )}
        </View>
      </View>


      {loading && !refreshing ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>

      ) : (
        <FlatList
          data={filteredFriends}
          renderItem={renderFriendItem}
          keyExtractor={(item) => (item.userId || item.id || Math.random().toString())}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#667eea" />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MaterialIcons name="people-outline" size={64} color="#cbd5e1" />
              <Text style={styles.emptyText}>
                {searchQuery ? t('friends.no_friends') : t('friends.search_user_hint')}
              </Text>
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
    paddingHorizontal: 20,
    paddingTop: 15,
    paddingBottom: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  requestButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#667eea',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
  },
  requestButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
  },
  searchIcon: { marginRight: 8 },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#1e293b',
  },
  listContent: { padding: 16, paddingBottom: 120 },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 15,
  },
  infoContainer: { flex: 1 },
  name: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 2,
  },
  phone: {
    fontSize: 13,
    color: '#64748b',
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  unfriendButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyContainer: { flex: 1, alignItems: 'center', marginTop: 100 },
  emptyText: { marginTop: 15, color: '#94a3b8', fontSize: 16, textAlign: 'center', paddingHorizontal: 40 },
});

export default ContactsScreen;
