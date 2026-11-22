import React, { useEffect } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, Separator, Text as TText, XStack, YStack } from 'tamagui';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { useDispatch, useSelector } from 'react-redux';
import { useRouter } from 'expo-router';
import { logoutUser, restoreState } from '../../src/store/authSlice';
import { clearChatState } from '../../src/store/chatSlice';
import { userApi } from '../../src/api/userApi';
import * as SecureStore from 'expo-secure-store';
import DeleteAccountModal from '../../src/components/DeleteAccountModal';
import { useTheme } from '../../src/context/ThemeContext';
import { useResponsive } from '../../src/hooks/useResponsive';
import Avatar from '../../src/components/common/Avatar';
import { useTranslation } from 'react-i18next';


const ProfileScreen = () => {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const { isWideLayout, isTablet, contentMaxWidth, horizontalPadding } = useResponsive();
  const dispatch = useDispatch();

  const router = useRouter();

  const user = useSelector((state) => state.auth.user);
  const [refreshing, setRefreshing] = React.useState(false);
  const [showDeleteModal, setShowDeleteModal] = React.useState(false);

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
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={{ marginTop: 10, color: colors.foreground }}>{t('chat.loading')}</Text>
        </View>
      </SafeAreaView>
    );

  }

  const displayUser = {
    userId: user.userId || 'N/A',
    phoneNumber: user.phoneNumber || 'N/A',
    email: user.email || t('profile.no_email'),
    fullName: user.fullName || (user.lastName && user.firstName ? `${user.lastName} ${user.firstName}` : t('common.user')),
    avatar: user.avatarUrl || user.avatar || `https://ui-avatars.com/api/?name=${user.firstName || 'U'}&background=random`,
    bio: user.bio || user.statusMessage || t('profile.bio_placeholder'),
    status: user.status || 'online',
  };

  const handleLogout = () => {
    Alert.alert(t('logout.title'), t('logout.confirm_question'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('logout.btn_confirm'), onPress: () => dispatch(logoutUser()), style: 'destructive' },
    ]);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: 120,
          alignItems: 'center',
        }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        <YStack
          width="100%"
          maxWidth={isWideLayout ? Math.min(contentMaxWidth, 820) : '100%'}
          alignSelf="center"
        >
        {/* Profile Card (Tamagui Card + Avatar) */}
        <Card
          backgroundColor={colors.card}
          borderBottomColor={colors.border}
          borderBottomWidth={1}
          borderBottomLeftRadius={30}
          borderBottomRightRadius={30}
          borderTopLeftRadius={isWideLayout ? 24 : 0}
          borderTopRightRadius={isWideLayout ? 24 : 0}
          marginTop={isWideLayout ? 16 : 0}
          marginHorizontal={isWideLayout ? horizontalPadding : 0}
          paddingVertical={28}
          paddingHorizontal={20}
          alignItems="center"
          position="relative"
        >
          <TouchableOpacity
            style={[styles.editIconBtn, { backgroundColor: isDark ? colors.surface300 : '#f1f5f9' }]}
            onPress={() => router.push('/(main)/edit-profile')}
          >
            <MaterialIcons name="edit" size={22} color={colors.textMuted} />
          </TouchableOpacity>

          <YStack marginBottom={14}>
            <Avatar
              uri={displayUser.avatar}
              name={displayUser.fullName}
              size={isTablet ? 112 : 100}
              online={displayUser.status === 'online'}
              borderColor={colors.border}
              borderWidth={3}
            />
          </YStack>

          <TText fontSize={isTablet ? 23 : 20} fontWeight="700" color={colors.foreground}>
            {displayUser.fullName}
          </TText>
          <TText fontSize={13} color={colors.textMuted} marginTop={4} marginBottom={12}>
            {displayUser.phoneNumber}
          </TText>

          <XStack
            alignItems="center"
            backgroundColor={isDark ? colors.surface300 : '#f1f5f9'}
            paddingHorizontal={12}
            paddingVertical={5}
            borderRadius={20}
            gap={6}
          >
            <View style={[styles.statusDot, { marginRight: 0, backgroundColor: displayUser.status === 'online' ? '#10b981' : colors.textSubtle }]} />
            <TText fontSize={11} fontWeight="600" color={colors.textMuted}>
              {displayUser.status === 'online' ? t('sidebar.online') : t('sidebar.offline')}
            </TText>
          </XStack>
        </Card>

        {/* Details & Menu Sections (2 columns on Tablet/Landscape) */}
        <XStack
          flexDirection={isWideLayout ? 'row' : 'column'}
          alignItems="flex-start"
          paddingHorizontal={horizontalPadding}
          gap={isWideLayout ? 20 : 0}
        >
          <YStack flex={isWideLayout ? 1 : undefined} width={isWideLayout ? undefined : '100%'}>
            {/* Details Section */}
            <YStack marginTop={22}>
              <TText fontSize={12} fontWeight="700" color={colors.textSubtle} textTransform="uppercase" marginBottom={10} marginLeft={4}>
                {t('info.privacy')}
              </TText>
              <Card backgroundColor={colors.card} borderRadius={16} padding={16} borderWidth={1} borderColor={colors.border}>
                <YStack paddingVertical={6}>
                  <TText fontSize={11} color={colors.textSubtle} marginBottom={4}>{t('profile.bio')}</TText>
                  <TText fontSize={14} color={colors.foreground} fontWeight="500">{displayUser.bio}</TText>
                </YStack>
                <Separator borderColor={colors.border} marginVertical={6} />
                <YStack paddingVertical={6}>
                  <TText fontSize={11} color={colors.textSubtle} marginBottom={4}>{t('profile.email')}</TText>
                  <TText fontSize={14} color={colors.foreground} fontWeight="500">{displayUser.email}</TText>
                </YStack>
                <Separator borderColor={colors.border} marginVertical={6} />
                <YStack paddingVertical={6}>
                  <TText fontSize={11} color={colors.textSubtle} marginBottom={4}>{t('profile.user_id')}</TText>
                  <TText fontSize={14} color={colors.foreground} fontWeight="500" numberOfLines={1}>{displayUser.userId}</TText>
                </YStack>
              </Card>
            </YStack>

            {/* Personal Storage */}
            <YStack marginTop={22}>
              <TText fontSize={12} fontWeight="700" color={colors.textSubtle} textTransform="uppercase" marginBottom={10} marginLeft={4}>
                {t('info.shared_media')}
              </TText>
              <Card backgroundColor={colors.card} borderRadius={16} overflow="hidden" borderWidth={1} borderColor={colors.border}>
                <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/(main)/my-cloud')}>
                  <XStack alignItems="center" gap={12}>
                    <Ionicons name="cloud-done-outline" size={20} color={colors.primary} />
                    <TText fontSize={15} fontWeight="500" color={colors.foreground}>{t('cloud.title')}</TText>
                  </XStack>
                  <MaterialIcons name="chevron-right" size={20} color={colors.textSubtle} />
                </TouchableOpacity>
              </Card>
            </YStack>
          </YStack>

          <YStack flex={isWideLayout ? 1 : undefined} width={isWideLayout ? undefined : '100%'}>
            {/* Settings */}
            <YStack marginTop={22}>
              <TText fontSize={12} fontWeight="700" color={colors.textSubtle} textTransform="uppercase" marginBottom={10} marginLeft={4}>
                {t('settings.title')}
              </TText>
              <Card backgroundColor={colors.card} borderRadius={16} overflow="hidden" borderWidth={1} borderColor={colors.border}>
                <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/(main)/settings')}>
                  <XStack alignItems="center" gap={12}>
                    <Ionicons name="settings-outline" size={20} color={colors.primary} />
                    <TText fontSize={15} fontWeight="500" color={colors.foreground}>{t('info.customization')}</TText>
                  </XStack>
                  <MaterialIcons name="chevron-right" size={20} color={colors.textSubtle} />
                </TouchableOpacity>
              </Card>
            </YStack>

            {/* Security & Logout */}
            <YStack marginTop={22}>
              <TText fontSize={12} fontWeight="700" color={colors.textSubtle} textTransform="uppercase" marginBottom={10} marginLeft={4}>
                {t('info.privacy')}
              </TText>
              <Card backgroundColor={colors.card} borderRadius={16} overflow="hidden" borderWidth={1} borderColor={colors.border}>
                <TouchableOpacity style={[styles.menuItem, { borderBottomColor: colors.border }]} onPress={() => router.push('/(main)/change-password')}>
                  <XStack alignItems="center" gap={12}>
                    <Ionicons name="lock-closed-outline" size={20} color={colors.textMuted} />
                    <TText fontSize={15} fontWeight="500" color={colors.foreground}>{t('password.title')}</TText>
                  </XStack>
                  <MaterialIcons name="chevron-right" size={20} color={colors.textSubtle} />
                </TouchableOpacity>

                <TouchableOpacity style={[styles.menuItem, { borderBottomWidth: 0 }]} onPress={handleLogout}>
                  <XStack alignItems="center" gap={12}>
                    <Ionicons name="log-out-outline" size={20} color="#ef4444" />
                    <TText fontSize={15} fontWeight="500" color="#ef4444">{t('logout.title')}</TText>
                  </XStack>
                </TouchableOpacity>
              </Card>
            </YStack>

            {/* Danger Zone */}
            <YStack marginTop={22} marginBottom={30}>
              <TText fontSize={12} fontWeight="700" color="#ef4444" textTransform="uppercase" marginBottom={10} marginLeft={4}>
                {t('delete_account.title')}
              </TText>
              <Card backgroundColor={colors.card} borderRadius={16} overflow="hidden" borderWidth={1} borderColor="rgba(239, 68, 68, 0.25)">
                <TouchableOpacity style={[styles.menuItem, { borderBottomWidth: 0 }]} onPress={() => setShowDeleteModal(true)}>
                  <XStack alignItems="center" gap={12}>
                    <Ionicons name="trash-outline" size={20} color="#ef4444" />
                    <TText fontSize={15} fontWeight="500" color="#ef4444">{t('delete_account.title')}</TText>
                  </XStack>
                </TouchableOpacity>
              </Card>
            </YStack>
          </YStack>
        </XStack>
        </YStack>
      </ScrollView>

      <DeleteAccountModal
        visible={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
      />
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
