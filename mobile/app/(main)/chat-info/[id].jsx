import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MaterialIcons, Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { useSelector } from 'react-redux';
import { getRealId } from '../../../src/store/chatSlice';

const ChatInfoScreen = () => {
  const router = useRouter();
  const { id: conversationId } = useLocalSearchParams();
  
  const chatState = useSelector((state) => state.chat);
  const currentUser = useSelector((state) => state.auth.user);
  
  const realId = useMemo(() => getRealId(chatState, conversationId, currentUser?.userId || currentUser?.id), [chatState, conversationId, currentUser]);
  const conversation = chatState.conversations.find(c => c.conversationId === realId);
  
  const otherParticipant = useMemo(() => {
    if (!conversation?.members) return null;
    return conversation.members.find(p => p.userId !== (currentUser?.userId || currentUser?.id));
  }, [conversation, currentUser]);

  const displayName = otherParticipant?.fullName || otherParticipant?.name || conversation?.name || 'Thông tin hội thoại';
  const avatarUrl = otherParticipant?.avatarUrl || otherParticipant?.avatar || otherParticipant?.profilePic || conversation?.avatarUrl || conversation?.avatar;
  const isOnline = otherParticipant?.status === 'ONLINE' || otherParticipant?.isOnline === true;
  
  const finalAvatarUrl = avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=667eea&color=fff&size=256&bold=true`;

  const InfoItem = ({ icon, label, onPress, color = '#111827', showArrow = true }) => (
    <TouchableOpacity style={styles.infoItem} onPress={onPress}>
      <View style={styles.infoItemLeft}>
        <View style={styles.iconContainer}>
          {icon}
        </View>
        <Text style={[styles.infoItemLabel, { color }]}>{label}</Text>
      </View>
      {showArrow && <MaterialIcons name="chevron-right" size={24} color="#9ca3af" />}
    </TouchableOpacity>
  );

  const SectionHeader = ({ title }) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionHeaderText}>{title}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="close" size={28} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Thông tin hội thoại</Text>
        <View style={{ width: 48 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarWrapper}>
            <Image source={{ uri: finalAvatarUrl }} style={styles.avatar} />
            {isOnline && <View style={styles.onlineBadge} />}
          </View>
          <Text style={styles.userName}>{displayName}</Text>
          <View style={[styles.statusBadge, isOnline ? styles.statusActive : styles.statusInactive]}>
            <Text style={styles.statusText}>{isOnline ? 'ĐANG HOẠT ĐỘNG' : 'NGOẠI TUYẾN'}</Text>
          </View>
        </View>

        {/* Media & Files */}
        <View style={styles.section}>
          <InfoItem 
            icon={<MaterialIcons name="image" size={20} color="#64748b" />} 
            label="ẢNH/VIDEO ĐÃ CHIA SẺ" 
            onPress={() => {}} 
          />
          <InfoItem 
            icon={<MaterialIcons name="insert-drive-file" size={20} color="#64748b" />} 
            label="FILE ĐÃ CHIA SẺ" 
            onPress={() => {}} 
          />
        </View>

        {/* Interface Customization */}
        <SectionHeader title="TÙY CHỈNH GIAO DIỆN" />
        <View style={styles.section}>
          <TouchableOpacity style={styles.customActionCard}>
            <View style={[styles.customActionIcon, { backgroundColor: '#4f46e5' }]}>
              <MaterialIcons name="wallpaper" size={22} color="#fff" />
            </View>
            <View style={styles.customActionContent}>
              <Text style={styles.customActionTitle}>Thay đổi ảnh nền</Text>
              <Text style={styles.customActionSub}>Tùy chỉnh hình nền cho cuộc trò chuyện</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.deleteAction}>
            <View style={styles.deleteActionIcon}>
              <MaterialIcons name="delete-outline" size={22} color="#ef4444" />
            </View>
            <View style={styles.deleteActionContent}>
              <Text style={styles.deleteActionTitle}>Xóa ảnh nền</Text>
              <Text style={styles.deleteActionSub}>Quay về giao diện mặc định</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Privacy */}
        <SectionHeader title="QUYỀN RIÊNG TƯ" />
        <View style={styles.section}>
          <TouchableOpacity style={styles.deleteAction}>
            <View style={styles.deleteActionIcon}>
              <MaterialIcons name="history" size={22} color="#ef4444" />
            </View>
            <View style={styles.deleteActionContent}>
              <Text style={styles.deleteActionTitle}>Xóa lịch sử trò chuyện</Text>
            </View>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a', // Màu tối theo thiết kế web
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  backButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
  },
  profileCard: {
    alignItems: 'center',
    paddingVertical: 40,
    backgroundColor: '#0f172a',
  },
  avatarWrapper: {
    position: 'relative',
    marginBottom: 20,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    borderColor: '#1e293b',
  },
  onlineBadge: {
    position: 'absolute',
    right: 5,
    bottom: 5,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#10b981',
    borderWidth: 3,
    borderColor: '#0f172a',
  },
  userName: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 12,
  },
  statusBadge: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  statusActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  statusInactive: {
    backgroundColor: 'rgba(148, 163, 184, 0.1)',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#10b981',
    letterSpacing: 1,
  },
  section: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 16,
  },
  sectionHeader: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    marginTop: 10,
  },
  sectionHeaderText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#94a3b8',
    letterSpacing: 0.5,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  infoItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 32,
    alignItems: 'center',
  },
  infoItemLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 12,
  },
  customActionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    padding: 16,
    borderRadius: 20,
    marginBottom: 16,
  },
  customActionIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customActionContent: {
    flex: 1,
    marginLeft: 16,
  },
  customActionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
  customActionSub: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  deleteAction: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  deleteActionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteActionContent: {
    flex: 1,
    marginLeft: 16,
  },
  deleteActionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ef4444',
  },
  deleteActionSub: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
});

export default ChatInfoScreen;
