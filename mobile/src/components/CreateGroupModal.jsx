import React, { useState, useEffect } from 'react';
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
  FlatList,
  ActivityIndicator,
  Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { useSelector, useDispatch } from 'react-redux';
import { friendApi } from '../api/friendApi';
import { conversationApi } from '../api/chatApi';
import { mediaApi } from '../api/mediaApi';
import { fetchConversations } from '../store/chatSlice';
import { useRouter } from 'expo-router';
import CONFIG from '../config';

const { width, height } = Dimensions.get('window');

const CreateGroupModal = ({ visible, onClose }) => {
  const router = useRouter();
  const dispatch = useDispatch();
  const currentUser = useSelector(state => state.auth.user);
  const [groupName, setGroupName] = useState('');
  const [friends, setFriends] = useState([]);
  const [selectedFriends, setSelectedFriends] = useState([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [groupAvatar, setGroupAvatar] = useState(null);

  const BASE_URL = CONFIG.API_URL.split('/api')[0];

  useEffect(() => {
    if (visible) {
      loadFriends();
    } else {
      // Reset state when closing
      setGroupName('');
      setSelectedFriends([]);
      setSearchTerm('');
      setGroupAvatar(null);
    }
  }, [visible]);

  const loadFriends = async () => {
    setLoading(true);
    try {
      const response = await friendApi.getFriends();
      const data = response.data || response;
      setFriends(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Load friends error:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleFriendSelection = (friendId) => {
    setSelectedFriends(prev => {
      if (prev.includes(friendId)) {
        return prev.filter(id => id !== friendId);
      } else {
        return [...prev, friendId];
      }
    });
  };

  const pickAvatar = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('Quyền truy cập bị từ chối', 'Vui lòng cấp quyền truy cập ảnh.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (!result.canceled && result.assets?.[0]) {
      setGroupAvatar(result.assets[0].uri);
    }
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      Alert.alert('Thông báo', 'Vui lòng nhập tên nhóm');
      return;
    }
    if (selectedFriends.length < 2) {
      Alert.alert('Thông báo', 'Vui lòng chọn ít nhất 2 thành viên khác');
      return;
    }

    setCreating(true);
    try {
      // 1. Create the conversation first
      const response = await conversationApi.createConversation({
        name: groupName.trim(),
        type: 'GROUP',
        memberIds: selectedFriends,
        isGroup: true
      });

      const convData = response.data || response;
      const conversationId = convData?.conversationId || convData?.id;

      if (!conversationId) throw new Error('Create failed - No ID');

      // 2. If avatar selected, update it
      if (groupAvatar) {
        try {
          const fileName = groupAvatar.split('/').pop();
          const match = /\.([a-zA-Z0-9]+)$/.exec(fileName || '');
          const fileType = match ? `image/${match[1].toLowerCase()}` : 'image/jpeg';

          const formData = new FormData();
          formData.append('file', {
            uri: Platform.OS === 'ios' ? groupAvatar.replace('file://', '') : groupAvatar,
            name: fileName || 'group-avatar.jpg',
            type: fileType,
          });

          const uploadRes = await mediaApi.uploadMedia(formData, 'conversation-avatars');
          const uploadedUrl = uploadRes?.data?.data?.mediaUrl || uploadRes?.data?.mediaUrl || uploadRes?.mediaUrl || uploadRes?.url || uploadRes?.data?.url;

          if (uploadedUrl) {
            await conversationApi.updateAvatar(conversationId, uploadedUrl);
          }
        } catch (uploadErr) {
          console.warn('[AvatarUploadError] Group created but avatar failed:', uploadErr);
        }
      }

      dispatch(fetchConversations());
      onClose();
      router.push(`/chat/${encodeURIComponent(conversationId)}`);
    } catch (err) {
      console.error('Create group error:', err);
      Alert.alert('Lỗi', 'Không thể tạo nhóm. Vui lòng thử lại.');
    } finally {
      setCreating(false);
    }
  };

  const getAvatarUrl = (url, name) => {
    if (!url) return `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'U')}&background=667eea&color=fff&size=128&bold=true`;
    if (url.startsWith('http')) return url;
    return `${BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
  };

  const filteredFriends = friends.filter(f => 
    f.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    f.phoneNumber?.includes(searchTerm)
  );

  const renderFriendItem = ({ item }) => {
    const isSelected = selectedFriends.includes(item.userId);
    return (
      <TouchableOpacity 
        style={styles.friendItem} 
        onPress={() => toggleFriendSelection(item.userId)}
      >
        <Image 
          source={{ uri: getAvatarUrl(item.avatarUrl, item.fullName) }} 
          style={styles.friendAvatar} 
        />
        <View style={styles.friendInfo}>
          <Text style={styles.friendName}>{item.fullName}</Text>
          <Text style={styles.friendPhone}>{item.phoneNumber}</Text>
        </View>
        <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
          {isSelected && <MaterialIcons name="check" size={16} color="#fff" />}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalContainer}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color="#1e293b" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Tạo nhóm mới</Text>
            <TouchableOpacity 
              onPress={handleCreateGroup} 
              disabled={creating || !groupName.trim() || selectedFriends.length < 2}
            >
              <Text style={[
                styles.createButtonText,
                (creating || !groupName.trim() || selectedFriends.length < 2) && styles.createButtonDisabled
              ]}>
                Tạo
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            {/* Group Name Input */}
            <View style={styles.groupNameContainer}>
              <TouchableOpacity style={styles.avatarPlaceholder} onPress={pickAvatar}>
                {groupAvatar ? (
                  <Image source={{ uri: groupAvatar }} style={styles.pickedAvatar} />
                ) : (
                  <MaterialIcons name="camera-alt" size={24} color="#94a3b8" />
                )}
              </TouchableOpacity>
              <TextInput
                style={styles.groupNameInput}
                placeholder="Nhập tên nhóm..."
                value={groupName}
                onChangeText={setGroupName}
              />
            </View>

            {/* Search Friends */}
            <View style={styles.searchSection}>
              <View style={styles.searchBar}>
                <MaterialIcons name="search" size={20} color="#94a3b8" />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Tìm bạn bè..."
                  value={searchTerm}
                  onChangeText={setSearchTerm}
                />
              </View>
            </View>

            <View style={styles.selectionCount}>
              <Text style={styles.selectionText}>
                Đã chọn: <Text style={styles.countText}>{selectedFriends.length}</Text> thành viên
              </Text>
            </View>

            {/* Friends List */}
            {loading ? (
              <ActivityIndicator size="large" color="#667eea" style={styles.loader} />
            ) : (
              <FlatList
                data={filteredFriends}
                renderItem={renderFriendItem}
                keyExtractor={(item) => item.userId}
                contentContainerStyle={styles.friendsList}
                ListEmptyComponent={
                  <Text style={styles.emptyText}>
                    {searchTerm ? 'Không tìm thấy bạn bè nào' : 'Bạn chưa có bạn bè nào'}
                  </Text>
                }
              />
            )}
          </View>

          {creating && (
            <View style={styles.creatingOverlay}>
              <ActivityIndicator size="large" color="#fff" />
              <Text style={styles.creatingText}>Đang tạo nhóm...</Text>
            </View>
          )}
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalContainer: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e293b',
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#667eea',
  },
  createButtonDisabled: {
    color: '#cbd5e1',
  },
  content: {
    flex: 1,
  },
  groupNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
  },
  avatarPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  groupNameInput: {
    flex: 1,
    fontSize: 18,
    color: '#1e293b',
    fontWeight: '600',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingVertical: 8,
  },
  pickedAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  searchSection: {
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 15,
    color: '#1e293b',
  },
  selectionCount: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#f8fafc',
  },
  selectionText: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
  },
  countText: {
    color: '#667eea',
    fontWeight: '800',
  },
  friendsList: {
    paddingHorizontal: 20,
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  friendAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 16,
  },
  friendInfo: {
    flex: 1,
  },
  friendName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
  },
  friendPhone: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 2,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e2e8f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: '#667eea',
    borderColor: '#667eea',
  },
  loader: {
    marginTop: 40,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 40,
    color: '#94a3b8',
    fontSize: 15,
  },
  creatingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  creatingText: {
    color: '#fff',
    marginTop: 16,
    fontSize: 16,
    fontWeight: '600',
  },
});

export default CreateGroupModal;
