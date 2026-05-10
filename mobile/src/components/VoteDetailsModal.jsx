import React from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Dimensions,
} from 'react-native';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { useSelector } from 'react-redux';
import CONFIG from '../config';

const { width, height } = Dimensions.get('window');

const VoteDetailsModal = ({ visible, onClose, vote }) => {
  const conversations = useSelector(state => state.chat.conversations);
  const BASE_URL = CONFIG.API_URL.split('/api')[0];
  
  if (!vote) return null;

  const totalParticipants = new Set(
    vote.options.flatMap(opt => opt.voterIds || [])
  ).size;

  const getMemberInfo = (userId) => {
    const id = String(userId);
    for (const conv of conversations) {
      const members = conv.members || conv.participants || [];
      const found = members.find(m => String(m.userId || m.id || '') === id);
      if (found) return found;
    }
    return { fullName: 'Người dùng', avatarUrl: null };
  };

  const getAvatarUrl = (url, name) => {
    if (!url) return `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'U')}&background=random&color=fff&size=128&bold=true`;
    if (typeof url !== 'string') return url;
    if (url.startsWith('http')) return url;
    return `${BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.iconBg}>
                <Ionicons name="stats-chart" size={20} color="#fff" />
              </View>
              <View>
                <Text style={styles.headerTitle}>Kết quả bình chọn</Text>
                <Text style={styles.headerSubtitle}>{totalParticipants} NGƯỜI ĐÃ THAM GIA</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <MaterialIcons name="close" size={24} color="#64748b" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            <View style={styles.questionSection}>
              <View style={styles.questionLine} />
              <Text style={styles.questionText}>"{vote.question}"</Text>
            </View>

            {vote.options.map((option) => {
              const voters = option.voterIds || [];
              return (
                <View key={option.optionId} style={styles.optionSection}>
                  <View style={styles.optionHeader}>
                    <View style={styles.optionTitleRow}>
                      <View style={styles.optionDot} />
                      <Text style={styles.optionName}>{option.text.toUpperCase()}</Text>
                    </View>
                    <View style={styles.voterBadge}>
                      <Text style={styles.voterBadgeText}>{voters.length} LƯỢT BẦU</Text>
                    </View>
                  </View>

                  <View style={styles.voterList}>
                    {voters.length > 0 ? (
                      voters.map((userId) => {
                        const member = getMemberInfo(userId);
                        return (
                          <View key={userId} style={styles.voterItem}>
                            <Image 
                              source={{ uri: getAvatarUrl(member.avatarUrl || member.avatar, member.fullName || member.name) }} 
                              style={styles.voterAvatar}
                            />
                            <Text style={styles.voterName}>{member.fullName || member.name}</Text>
                          </View>
                        );
                      })
                    ) : (
                      <Text style={styles.emptyText}>Chưa có ai bầu phương án này</Text>
                    )}
                  </View>
                </View>
              );
            })}
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.closeActionBtn} onPress={onClose}>
              <Text style={styles.closeActionText}>Đóng cửa sổ</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderRadius: 32,
    width: '100%',
    maxHeight: height * 0.8,
    overflow: 'hidden',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  iconBg: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1e293b',
  },
  headerSubtitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94a3b8',
    letterSpacing: 1,
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
  },
  content: {
    padding: 24,
  },
  questionSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 32,
  },
  questionLine: {
    width: 4,
    height: 24,
    backgroundColor: '#6366f1',
    borderRadius: 2,
  },
  questionText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e293b',
    fontStyle: 'italic',
  },
  optionSection: {
    marginBottom: 28,
  },
  optionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  optionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  optionDot: {
    width: 6,
    height: 18,
    backgroundColor: '#6366f1',
    borderRadius: 3,
  },
  optionName: {
    fontSize: 16,
    fontWeight: '900',
    color: '#1e293b',
    letterSpacing: 0.5,
  },
  voterBadge: {
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  voterBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#6366f1',
  },
  voterList: {
    backgroundColor: '#f8fafc',
    borderRadius: 20,
    padding: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#e2e8f0',
  },
  voterItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    gap: 12,
  },
  voterAvatar: {
    width: 32,
    height: 32,
    borderRadius: 12,
    backgroundColor: '#e2e8f0',
  },
  voterName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
  emptyText: {
    padding: 16,
    fontSize: 13,
    color: '#94a3b8',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  footer: {
    padding: 24,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  closeActionBtn: {
    width: '100%',
    height: 60,
    backgroundColor: '#6366f1',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
  },
  closeActionText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#fff',
  },
});

export default VoteDetailsModal;
