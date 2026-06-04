import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Alert,
  SafeAreaView,
  Dimensions,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSelector } from 'react-redux';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { useTheme } from '../../src/context/ThemeContext';
import CONFIG from '../../src/config';

const { width } = Dimensions.get('window');

export default function GroupPreviewScreen() {
  const { conversationId } = useLocalSearchParams();
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const token = useSelector((state) => state.auth.accessToken);

  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [groupInfo, setGroupInfo] = useState(null);
  const [error, setError] = useState(null);

  const fetchGroupInfo = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get(
        `${CONFIG.API_URL}/conversations/${conversationId}/join-info`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      if (response.data.success) {
        setGroupInfo(response.data.data);
      } else {
        setError('Không thể tải thông tin nhóm');
      }
    } catch (err) {
      console.log('Error fetching group join-info:', err);
      const msg = err.response?.data?.message || 'Không thể kết nối tới máy chủ';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (conversationId) {
      fetchGroupInfo();
    }
  }, [conversationId]);

  const handleJoinGroup = async () => {
    try {
      setJoining(true);
      const response = await axios.post(
        `${CONFIG.API_URL}/conversations/${conversationId}/join`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.data.success) {
        const { status, message } = response.data.data;
        if (status === 'JOINED') {
          Alert.alert('Thành công', `Bạn đã vào nhóm ${groupInfo?.name || ''}`, [
            {
              text: 'Vào trò chuyện',
              onPress: () => {
                router.replace(`/chat/${encodeURIComponent(conversationId)}`);
              },
            },
          ]);
        } else if (status === 'PENDING' || status === 'PENDING_APPROVAL') {
          Alert.alert(
            'Yêu cầu đã gửi',
            'Yêu cầu tham gia nhóm đã được gửi thành công. Vui lòng chờ quản trị viên duyệt.',
            [
              {
                text: 'OK',
                onPress: () => {
                if (router.canGoBack()) {
                  router.back();
                } else {
                  router.replace('/(main)');
                }
              },
              },
            ]
          );
        }
      }
    } catch (err) {
      console.log('Error joining group:', err);
      const msg = err.response?.data?.message || 'Không thể gửi yêu cầu gia nhập';
      Alert.alert('Lỗi', msg);
    } finally {
      setJoining(false);
    }
  };

  const getAvatarSource = (url, name) => {
    if (url) {
      if (url.startsWith('http')) return { uri: url };
      // Resolve base server URL
      const baseUrl = CONFIG.BASE_URL;
      return { uri: `${baseUrl}${url.startsWith('/') ? '' : '/'}${url}` };
    }
    return null;
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color="#6366f1" />
        <Text style={[styles.loadingText, { color: colors.textMuted }]}>Đang tải thông tin nhóm...</Text>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <View style={styles.errorBox}>
          <MaterialCommunityIcons name="alert-circle-outline" size={60} color="#ff4d4f" />
          <Text style={[styles.errorTitle, { color: colors.foreground }]}>Đã có lỗi xảy ra</Text>
          <Text style={[styles.errorText, { color: colors.textMuted }]}>{error}</Text>
          <TouchableOpacity style={[styles.retryButton, { backgroundColor: colors.primary }]} onPress={fetchGroupInfo}>
            <Text style={styles.retryText}>Thử lại</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.backLink} onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/(main)');
            }
          }}>
            <Text style={[styles.backLinkText, { color: colors.primary }]}>Quay lại</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const name = groupInfo.name;
  const avatar = groupInfo.avatarUrl || groupInfo.avatar;
  const totalMembers = groupInfo.memberCount !== undefined ? groupInfo.memberCount : (groupInfo.totalMembers || 0);
  const memberApprovalRequired = groupInfo.memberApprovalRequired;
  const mutualFriends = groupInfo.friendsInGroup || groupInfo.mutualFriends || [];
  const alreadyMember = groupInfo.alreadyMember;
  const representatives = groupInfo.representatives || [];
  const pendingRequest = groupInfo.pendingRequest || false;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isDark ? '#0f172a' : '#f8fafc' }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: isDark ? '#1e293b' : '#e2e8f0' }]}>
        <TouchableOpacity
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/(main)');
            }
          }}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Thông tin nhóm</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Profile Card */}
        <View style={[styles.card, { backgroundColor: isDark ? '#1e293b' : '#ffffff' }]}>
          <View style={styles.avatarWrapper}>
            {avatar ? (
              <Image source={getAvatarSource(avatar, name)} style={styles.avatar} />
            ) : (
              <View style={[styles.avatarPlaceholder, { backgroundColor: '#6366f1' }]}>
                <Text style={styles.avatarInitial}>{name ? name.charAt(0).toUpperCase() : 'G'}</Text>
              </View>
            )}
            <View style={styles.badgeContainer}>
              <MaterialCommunityIcons name="account-group" size={18} color="#fff" />
            </View>
          </View>

          <Text style={[styles.groupName, { color: colors.foreground }]}>{name}</Text>
          
          <View style={[styles.memberCountBadge, { backgroundColor: isDark ? '#334155' : '#f1f5f9' }]}>
            <Text style={[styles.memberCountText, { color: isDark ? '#94a3b8' : '#475569' }]}>
              {totalMembers} thành viên
            </Text>
          </View>

          {memberApprovalRequired && !alreadyMember && !pendingRequest && (
            <View style={[styles.approvalWarning, { backgroundColor: isDark ? '#2b1b17' : '#fff7e6', borderColor: isDark ? '#5c3e1d' : '#ffe7ba' }]}>
              <Ionicons name="lock-closed" size={16} color="#d46b08" style={{ marginRight: 6 }} />
              <Text style={styles.approvalWarningText}>
                Nhóm đang bật kiểm duyệt thành viên. Quản trị viên cần phê duyệt yêu cầu của bạn.
              </Text>
            </View>
          )}
        </View>

        {/* Mutual Friends or Owner/Admins Section */}
        {mutualFriends && mutualFriends.length > 0 ? (
          <View style={[styles.section, { backgroundColor: isDark ? '#1e293b' : '#ffffff' }]}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              Bạn bè trong nhóm ({mutualFriends.length})
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.friendsListHorizontal}>
              {mutualFriends.map((friend) => (
                <View key={friend.userId || friend.id} style={styles.friendCard}>
                  {friend.avatarUrl || friend.avatar ? (
                    <Image source={getAvatarSource(friend.avatarUrl || friend.avatar, friend.fullName)} style={styles.friendAvatar} />
                  ) : (
                    <View style={[styles.friendAvatarPlaceholder, { backgroundColor: '#818cf8' }]}>
                      <Text style={styles.friendInitial}>
                        {friend.fullName ? friend.fullName.charAt(0).toUpperCase() : 'U'}
                      </Text>
                    </View>
                  )}
                  <Text style={[styles.friendName, { color: colors.foreground }]} numberOfLines={1}>
                    {friend.fullName}
                  </Text>
                </View>
              ))}
            </ScrollView>
          </View>
        ) : (
          <View style={[styles.section, { backgroundColor: isDark ? '#1e293b' : '#ffffff' }]}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              Ban quản trị nhóm
            </Text>
            {representatives && representatives.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.friendsListHorizontal}>
                {representatives.map((rep) => (
                  <View key={rep.userId} style={styles.friendCard}>
                    {rep.avatarUrl ? (
                      <Image source={getAvatarSource(rep.avatarUrl, rep.fullName)} style={styles.friendAvatar} />
                    ) : (
                      <View style={[styles.friendAvatarPlaceholder, { backgroundColor: '#6366f1' }]}>
                        <Text style={styles.friendInitial}>
                          {rep.fullName ? rep.fullName.charAt(0).toUpperCase() : 'U'}
                        </Text>
                      </View>
                    )}
                    <Text style={[styles.friendName, { color: colors.foreground }]} numberOfLines={1}>
                      {rep.fullName}
                    </Text>
                    <Text style={{ fontSize: 9, color: colors.textMuted, marginTop: 2, fontWeight: '700' }}>
                      {rep.role === 'OWNER' ? 'Trưởng nhóm' : 'Phó nhóm'}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            ) : (
              <Text style={{ fontSize: 13, color: colors.textMuted, textAlign: 'center', paddingVertical: 10 }}>
                {totalMembers} thành viên
              </Text>
            )}
          </View>
        )}
      </ScrollView>

      {/* Footer Actions */}
      <View style={[styles.footer, { backgroundColor: isDark ? '#1e293b' : '#ffffff', borderTopColor: isDark ? '#334155' : '#e2e8f0' }]}>
        {alreadyMember ? (
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: '#6366f1' }]}
            onPress={() => router.replace(`/chat/${encodeURIComponent(conversationId)}`)}
          >
            <Ionicons name="chatbubble-ellipses" size={20} color="#fff" style={{ marginRight: 8 }} />
            <Text style={styles.buttonText}>Vào trò chuyện</Text>
          </TouchableOpacity>
        ) : pendingRequest ? (
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: '#64748b' }]}
            disabled={true}
          >
            <Ionicons name="time-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
            <Text style={styles.buttonText}>Yêu cầu đang chờ duyệt</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: '#10b981' }]}
            onPress={handleJoinGroup}
            disabled={joining}
          >
            {joining ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Ionicons name="enter-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.buttonText}>
                  {memberApprovalRequired ? 'Yêu cầu vào nhóm' : 'Tham gia'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  scrollContent: {
    padding: 16,
    gap: 16,
    paddingBottom: 100,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '500',
  },
  card: {
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  avatarWrapper: {
    position: 'relative',
    marginBottom: 16,
  },
  avatar: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 3,
    borderColor: '#6366f1',
  },
  avatarPlaceholder: {
    width: 110,
    height: 110,
    borderRadius: 55,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#6366f1',
  },
  avatarInitial: {
    color: '#fff',
    fontSize: 44,
    fontWeight: 'bold',
  },
  badgeContainer: {
    position: 'absolute',
    bottom: 0,
    right: 4,
    backgroundColor: '#6366f1',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  groupName: {
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
  },
  memberCountBadge: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 16,
  },
  memberCountText: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  approvalWarning: {
    flexDirection: 'row',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    marginTop: 8,
  },
  approvalWarningText: {
    fontSize: 12,
    color: '#d46b08',
    flex: 1,
    lineHeight: 16,
    fontWeight: '600',
  },
  section: {
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  emptyFriendsSection: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  friendsListHorizontal: {
    gap: 16,
    paddingRight: 16,
  },
  friendCard: {
    alignItems: 'center',
    width: 70,
  },
  friendAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginBottom: 8,
  },
  friendAvatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  friendInitial: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  friendName: {
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '600',
  },
  emptyFriendsText: {
    fontSize: 13,
    textAlign: 'center',
    fontWeight: '500',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    borderTopWidth: 1,
  },
  primaryButton: {
    height: 50,
    borderRadius: 25,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  errorBox: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: '85%',
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
    marginBottom: 12,
    width: 150,
    alignItems: 'center',
  },
  retryText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  backLink: {
    padding: 8,
  },
  backLinkText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
});
