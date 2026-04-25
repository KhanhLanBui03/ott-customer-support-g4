import React, { useEffect } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  Alert,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { useDispatch, useSelector } from 'react-redux';
import { useRouter } from 'expo-router';
import { logoutUser, restoreState } from '../../src/store/authSlice';
import { clearChatState } from '../../src/store/chatSlice';
import { userApi } from '../../src/api/userApi';
import * as SecureStore from 'expo-secure-store';

const ProfileScreen = () => {
  const dispatch = useDispatch();
  const router = useRouter();

  const user = useSelector((state) => state.auth.user);
  const [refreshing, setRefreshing] = React.useState(false);

  const fetchLatestProfile = async () => {
    try {
      const response = await userApi.getProfile();
      // Backend thường trả về { data: { ...user } }
      const updatedUser = response.data || response;

      const token = await SecureStore.getItemAsync('accessToken');
      const refreshToken = await SecureStore.getItemAsync('refreshToken');

      if (updatedUser) {
        dispatch(restoreState({
          user: updatedUser,
          accessToken: token,
          refreshToken: refreshToken,
        }));
        await SecureStore.setItemAsync('user', JSON.stringify(updatedUser));
      }
    } catch (error) {
      // Bỏ qua log error nếu là 401 vì đã được xử lý toàn cục ở axiosClient
      if (error.response?.status !== 401) {
        console.error('Fetch profile error:', error);
      }
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchLatestProfile();
    setRefreshing(false);
  };

  useEffect(() => {
    fetchLatestProfile();
  }, []);

  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#0f172a" />
          <Text style={{marginTop: 10}}>Đang tải hồ sơ...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const displayUser = {
    userId: user.userId || 'N/A',
    phoneNumber: user.phoneNumber || 'N/A',
    email: user.email || 'Chưa cập nhật email',
    fullName: user.fullName || (user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : 'Người dùng'),
    avatar: user.avatarUrl || user.avatar || `https://ui-avatars.com/api/?name=${user.firstName || 'U'}&background=random`,
    bio: user.bio || user.statusMessage || 'Chưa có tiểu sử',
    status: user.status || 'online',
  };

  const handleLogout = () => {
    Alert.alert('Đăng xuất', 'Bạn có chắc chắn muốn đăng xuất?', [
      { text: 'Hủy', style: 'cancel' },
      { text: 'Đăng xuất', onPress: () => dispatch(logoutUser()), style: 'destructive' },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0f172a" />
        }
      >
        {/* Profile Card */}
        <View style={styles.headerCard}>
          <TouchableOpacity
            style={styles.editIconBtn}
            onPress={() => router.push('/(main)/edit-profile')}
          >
            <MaterialIcons name="edit" size={22} color="#64748b" />
          </TouchableOpacity>

          <View style={styles.avatarContainer}>
            <Image source={{ uri: displayUser.avatar }} style={styles.avatar} />
          </View>

          <Text style={styles.userName}>{displayUser.fullName}</Text>
          <Text style={styles.userPhone}>{displayUser.phoneNumber}</Text>

          <View style={styles.statusBadge}>
            <View style={[styles.statusDot, { backgroundColor: displayUser.status === 'online' ? '#10b981' : '#9ca3af' }]} />
            <Text style={styles.statusText}>{displayUser.status === 'online' ? 'Online' : 'Offline'}</Text>
          </View>
        </View>

        {/* Details Section - Khôi phục đầy đủ */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Thông tin tài khoản</Text>
          <View style={styles.infoCard}>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Tiểu sử</Text>
              <Text style={styles.infoValue}>{displayUser.bio}</Text>
            </View>
            <View style={styles.infoDivider} />
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Email</Text>
              <Text style={styles.infoValue}>{displayUser.email}</Text>
            </View>
            <View style={styles.infoDivider} />
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>ID Người dùng</Text>
              <Text style={styles.infoValue} numberOfLines={1}>{displayUser.userId}</Text>
            </View>
          </View>
        </View>

        {/* Settings & Support */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Bảo mật & Hỗ trợ</Text>
          <View style={styles.menuCard}>
            <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/(main)/change-password')}>
              <View style={styles.menuItemLeft}>
                <Ionicons name="lock-closed-outline" size={20} color="#475569" />
                <Text style={styles.menuItemText}>Đổi mật khẩu</Text>
              </View>
              <MaterialIcons name="chevron-right" size={20} color="#cbd5e1" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} onPress={handleLogout}>
              <View style={styles.menuItemLeft}>
                <Ionicons name="log-out-outline" size={20} color="#ef4444" />
                <Text style={[styles.menuItemText, { color: '#ef4444' }]}>Đăng xuất</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Danger Zone */}
        <View style={[styles.section, { marginBottom: 30 }]}>
          <Text style={[styles.sectionTitle, { color: '#ef4444' }]}>Vùng nguy hiểm</Text>
          <View style={styles.menuCard}>
            <TouchableOpacity style={styles.menuItem} onPress={() => Alert.alert('Xác nhận', 'Bạn có chắc muốn xóa tài khoản?')}>
              <View style={styles.menuItemLeft}>
                <Ionicons name="trash-outline" size={20} color="#ef4444" />
                <Text style={[styles.menuItemText, { color: '#ef4444' }]}>Xóa tài khoản</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerCard: {
    backgroundColor: '#fff',
    alignItems: 'center',
    paddingVertical: 30,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
    position: 'relative',
  },
  editIconBtn: {
    position: 'absolute',
    top: 20,
    right: 20,
    padding: 10,
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
  },
  avatarContainer: { marginBottom: 15 },
  avatar: { width: 100, height: 100, borderRadius: 50, borderWidth: 3, borderColor: '#f1f5f9', backgroundColor: '#e2e8f0' },
  userName: { fontSize: 20, fontWeight: '700', color: '#1e293b' },
  userPhone: { fontSize: 13, color: '#64748b', marginTop: 4, marginBottom: 12 },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
  statusText: { fontSize: 11, fontWeight: '600', color: '#64748b' },
  section: { paddingHorizontal: 20, marginTop: 25 },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', marginBottom: 10, marginLeft: 4 },
  infoCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16 },
  infoItem: { paddingVertical: 6 },
  infoLabel: { fontSize: 11, color: '#94a3b8', marginBottom: 4 },
  infoValue: { fontSize: 14, color: '#1e293b', fontWeight: '500' },
  infoDivider: { height: 1, backgroundColor: '#f1f5f9', marginVertical: 6 },
  menuCard: { backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden' },
  menuItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#f8fafc' },
  menuItemLeft: { flexDirection: 'row', alignItems: 'center' },
  menuItemText: { fontSize: 15, fontWeight: '500', color: '#334155', marginLeft: 12 },
});

export default ProfileScreen;
