import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { useSelector } from 'react-redux';
import { userApi } from '../api/userApi';
import { friendApi } from '../api/friendApi';
import { conversationApi } from '../api/chatApi';
import { useRouter } from 'expo-router';
import CONFIG from '../config';

const { width, height } = Dimensions.get('window');

const SearchModal = ({ visible, onClose }) => {
  const router = useRouter();
  const currentUser = useSelector(state => state.auth.user);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [searchResult, setSearchResult] = useState(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState(null);

  const BASE_URL = CONFIG.API_URL.split('/api')[0];

  // Real-time search effect with debounce
  useEffect(() => {
    // Chỉ cần xóa số điện thoại trong ô input thì biến mất người dùng luôn
    if (phoneNumber.length === 0) {
      setSearchResult(null);
      setError(null);
      setSearching(false);
      return;
    }

    const delayDebounceFn = setTimeout(() => {
      // Bắt đầu gợi ý từ 5 số trở lên
      if (phoneNumber.length >= 5) {
        performSearch(phoneNumber);
      } else {
        setSearchResult(null);
        setError(null);
      }
    }, 400); // Giảm debounce xuống 400ms để nhạy hơn

    return () => clearTimeout(delayDebounceFn);
  }, [phoneNumber]);

  const performSearch = async (phone) => {
    setSearching(true);
    setError(null);
    try {
      const response = await userApi.searchUser(phone);
      if (response.success && response.data) {
        setSearchResult(response.data);
      } else {
        setSearchResult(null);
        setError('Không tìm thấy người dùng');
      }
    } catch (err) {
      setSearchResult(null);
      setError('Người dùng không tồn tại');
    } finally {
      setSearching(false);
    }
  };

  const handleMessage = async () => {
    if (!searchResult) return;
    try {
      const response = await conversationApi.createConversation({
        type: 'SINGLE',
        memberIds: [searchResult.userId],
        isGroup: false
      });

      if (response.success || response.data) {
        const conversationId = response.data.conversationId || response.data.id;
        onClose();
        router.push(`/chat/${encodeURIComponent(conversationId)}`);
      }
    } catch (err) {
      console.error('Create conversation error:', err);
      Alert.alert('Thông báo', 'Không thể bắt đầu cuộc trò chuyện. Vui lòng thử lại.');
    }
  };

  const handleAddFriend = async () => {
    if (!searchResult) return;
    try {
      await friendApi.sendFriendRequest(searchResult.userId);
      // Cập nhật trạng thái tại chỗ để UI thay đổi ngay lập tức
      setSearchResult(prev => ({ ...prev, friendshipStatus: 'PENDING' }));
      Alert.alert('Thành công', `Đã gửi lời mời kết bạn đến ${searchResult.fullName}`);
    } catch (err) {
      const msg = err.response?.data?.message || 'Đã có lỗi xảy ra';
      Alert.alert('Thông báo', msg);
    }
  };

  const getAvatarUrl = (url, name) => {
    if (!url) return `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'U')}&background=667eea&color=fff&size=128&bold=true`;
    if (url.startsWith('http')) return url;
    return `${BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
  };

  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              style={styles.modalContainer}
            >
              {/* Header */}
              <View style={styles.header}>
                <Text style={styles.headerTitle}>TÌM KIẾM BẠN BÈ</Text>
                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                  <Ionicons name="close" size={24} color="#64748b" />
                </TouchableOpacity>
              </View>

              <View style={styles.content}>
                <Text style={styles.helpText}>
                  VUI LÒNG NHẬP SỐ ĐIỆN THOẠI HỢP LỆ ĐỂ TÌM KIẾM BẠN BÈ VÀ BẮT ĐẦU TRÒ CHUYỆN.
                </Text>

                {/* Search Input Area */}
                <View style={styles.searchSection}>
                  <View style={styles.inputWrapper}>
                    <MaterialIcons name="search" size={20} color="#94a3b8" style={styles.searchIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Nhập số điện thoại..."
                      placeholderTextColor="#cbd5e1"
                      keyboardType="phone-pad"
                      value={phoneNumber}
                      onChangeText={setPhoneNumber}
                      autoFocus
                    />
                    {searching && <ActivityIndicator size="small" color="#667eea" />}
                  </View>
                  <TouchableOpacity style={styles.searchBtn} onPress={() => performSearch(phoneNumber)}>
                    <Text style={styles.searchBtnText}>TÌM KIẾM</Text>
                  </TouchableOpacity>
                </View>

                {/* Error Message */}
                {error && <Text style={styles.errorText}>{error}</Text>}

                {/* Search Result Card */}
                {searchResult && (
                  <View style={styles.resultCard}>
                    <View style={styles.avatarWrapper}>
                      <Image 
                        source={{ uri: getAvatarUrl(searchResult.avatarUrl, searchResult.fullName) }} 
                        style={styles.avatar} 
                      />
                    </View>
                    
                    <Text style={styles.userName}>{searchResult.fullName}</Text>
                    <Text style={styles.userPhone}>{searchResult.phoneNumber}</Text>

                    {searchResult.userId !== currentUser?.userId && (
                      <View style={styles.buttonGroup}>
                        <TouchableOpacity style={styles.messageBtn} onPress={handleMessage}>
                          <Ionicons name="chatbubble-outline" size={20} color="#fff" />
                          <Text style={styles.messageBtnText}>NHẮN TIN</Text>
                        </TouchableOpacity>

                        <TouchableOpacity 
                          style={[
                            styles.addFriendBtn, 
                            (searchResult.friendshipStatus === 'PENDING' || searchResult.friendshipStatus === 'ACCEPTED') && styles.sentFriendBtn
                          ]} 
                          onPress={handleAddFriend}
                          disabled={searchResult.friendshipStatus === 'PENDING' || searchResult.friendshipStatus === 'ACCEPTED'}
                        >
                          {searchResult.friendshipStatus === 'PENDING' ? (
                            <>
                              <Ionicons name="checkmark-done" size={20} color="#10b981" />
                              <Text style={[styles.addFriendBtnText, { color: '#10b981' }]}>ĐÃ GỬI LỜI MỜI</Text>
                            </>
                          ) : searchResult.friendshipStatus === 'ACCEPTED' ? (
                            <>
                              <Ionicons name="person-circle" size={22} color="#10b981" />
                              <Text style={[styles.addFriendBtnText, { color: '#10b981' }]}>BẠN BÈ</Text>
                            </>
                          ) : (
                            <>
                              <Ionicons name="person-add-outline" size={20} color="#1e293b" />
                              <Text style={styles.addFriendBtnText}>KẾT BẠN</Text>
                            </>
                          )}
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                )}
              </View>
            </KeyboardAvoidingView>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: width * 0.9,
    backgroundColor: '#fff',
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1e293b',
    letterSpacing: 1,
  },
  closeButton: {
    padding: 4,
  },
  content: {
    padding: 20,
  },
  helpText: {
    fontSize: 11,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 16,
    marginBottom: 20,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  searchSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 12,
    marginRight: 10,
    height: 48,
  },
  searchIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#1e293b',
    fontWeight: '500',
  },
  searchBtn: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    height: 48,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 16,
    fontWeight: '600',
  },
  resultCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#64748b',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  avatarWrapper: {
    width: 100,
    height: 100,
    borderRadius: 50,
    padding: 4,
    backgroundColor: '#f1f5f9',
    marginBottom: 16,
  },
  avatar: {
    width: '100%',
    height: '100%',
    borderRadius: 46,
  },
  userName: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0f172a',
    marginBottom: 4,
    fontStyle: 'italic',
  },
  userPhone: {
    fontSize: 12,
    color: '#cbd5e1',
    marginBottom: 24,
    letterSpacing: 2,
  },
  buttonGroup: {
    width: '100%',
    gap: 12,
  },
  messageBtn: {
    flexDirection: 'row',
    backgroundColor: '#0f172a',
    borderRadius: 14,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  messageBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 8,
    letterSpacing: 1,
  },
  addFriendBtn: {
    flexDirection: 'row',
    backgroundColor: '#e2e8f0',
    borderRadius: 14,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  sentFriendBtn: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bcf2d4',
  },
  addFriendBtnText: {
    color: '#1e293b',
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 8,
    letterSpacing: 1,
  },
});

export default SearchModal;
