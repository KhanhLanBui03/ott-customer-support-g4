import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Image,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useDispatch, useSelector } from 'react-redux';
import * as ImagePicker from 'expo-image-picker';
import { userApi } from '../../src/api/userApi';
import { mediaApi } from '../../src/api/mediaApi';
import { restoreState } from '../../src/store/authSlice';
import * as SecureStore from 'expo-secure-store';

const EditProfileScreen = () => {
  const router = useRouter();
  const dispatch = useDispatch();
  const user = useSelector((state) => state.auth.user);

  // State quản lý form (Dùng để nhập liệu)
  const [firstName, setFirstName] = useState(user?.firstName || '');
  const [lastName, setLastName] = useState(user?.lastName || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || user?.avatar || '');

  const [loading, setLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Hàm chọn ảnh từ thư viện
  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Quyền truy cập', 'Vui lòng cấp quyền truy cập album ảnh.');
      return;
    }

    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (!result.canceled) {
      const selectedUri = result.assets[0].uri;
      // Hiển thị tạm thời ảnh vừa chọn
      setAvatarUrl(selectedUri);
      // Thực hiện upload lên S3
      uploadImage(selectedUri);
    }
  };

  const uploadImage = async (uri) => {
    setIsUploading(true);
    try {
      const formData = new FormData();
      const filename = uri.split('/').pop();
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : `image`;

      formData.append('file', {
        uri: Platform.OS === 'ios' ? uri.replace('file://', '') : uri,
        name: filename,
        type,
      });

      const response = await mediaApi.uploadMedia(formData);
      const s3Url = response.data?.url || response.url || response.data;

      if (s3Url) {
        setAvatarUrl(s3Url);
      }
    } catch (error) {
      console.error('Upload image failed:', error);
      Alert.alert('Lỗi', 'Không thể tải ảnh lên máy chủ.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      Alert.alert('Lỗi', 'Họ và Tên không được để trống');
      return;
    }

    setLoading(true);
    try {
      // Đảm bảo lấy token mới nhất trước khi gọi PUT
      const currentToken = await SecureStore.getItemAsync('accessToken');

      const updateData = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        bio: bio.trim(),
        avatarUrl: avatarUrl,
      };

      const response = await userApi.updateProfile(updateData);

      // Nếu thành công, Backend trả về user profile mới
      const updatedUser = response.data || response;

      // Cập nhật Redux Store
      const refreshToken = await SecureStore.getItemAsync('refreshToken');
      dispatch(restoreState({
        user: updatedUser,
        accessToken: currentToken,
        refreshToken: refreshToken,
      }));

      // Lưu vào máy
      await SecureStore.setItemAsync('user', JSON.stringify(updatedUser));

      Alert.alert('Thành công', 'Thông tin hồ sơ đã được cập nhật!', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (error) {
      console.error('Update Profile Error:', error);
      // Nếu vẫn lỗi 401, thông báo người dùng đăng nhập lại
      if (error.response?.status === 401) {
        Alert.alert('Hết phiên làm việc', 'Vui lòng đăng xuất và đăng nhập lại để thực hiện tính năng này.');
      } else {
        Alert.alert('Lỗi', 'Không thể cập nhật hồ sơ. Vui lòng thử lại sau.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>HỒ SƠ CỦA BẠN</Text>
          <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
            <Ionicons name="close" size={26} color="#64748b" />
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatarWrapper}>
              <Image
                source={{ uri: avatarUrl || `https://ui-avatars.com/api/?name=${firstName}&background=random` }}
                style={styles.avatar}
              />
              {isUploading && (
                <View style={styles.uploadingOverlay}>
                  <ActivityIndicator color="#fff" />
                </View>
              )}
              <TouchableOpacity style={styles.cameraIconContainer} onPress={pickImage} disabled={isUploading}>
                <MaterialIcons name="photo-camera" size={20} color="#fff" />
              </TouchableOpacity>
            </View>

            {/* FIX: Chỉ hiển thị tên đã được lưu trong Redux, không hiển thị tên đang gõ */}
            <Text style={styles.displayFullName}>{user?.firstName} {user?.lastName}</Text>
          </View>

          <View style={styles.form}>
            <View style={styles.inputRow}>
              <View style={[styles.inputGroup, { flex: 1, marginRight: 12 }]}>
                <Text style={styles.label}>HỌ</Text>
                <TextInput style={styles.input} value={lastName} onChangeText={setLastName} placeholder="Họ" />
              </View>
              <View style={[styles.inputGroup, { flex: 1.5 }]}>
                <Text style={styles.label}>TÊN</Text>
                <TextInput style={styles.input} value={firstName} onChangeText={setFirstName} placeholder="Tên" />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>TIỂU SỬ</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={bio}
                onChangeText={setBio}
                placeholder="Nhập tiểu sử của bạn..."
                multiline
                numberOfLines={3}
              />
            </View>
          </View>

          <TouchableOpacity
            style={[styles.saveBtn, (loading || isUploading) && { opacity: 0.7 }]}
            onPress={handleSave}
            disabled={loading || isUploading}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>LƯU THAY ĐỔI</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  header: { height: 60, backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  headerTitle: { fontSize: 14, fontWeight: '700', color: '#334155', letterSpacing: 1 },
  closeButton: { position: 'absolute', right: 15 },
  scrollContent: { padding: 25 },
  avatarContainer: { alignItems: 'center', marginBottom: 30 },
  avatarWrapper: { position: 'relative' },
  avatar: { width: 110, height: 110, borderRadius: 55, borderWidth: 4, borderColor: '#fff', backgroundColor: '#e2e8f0' },
  uploadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 55, justifyContent: 'center', alignItems: 'center' },
  cameraIconContainer: { position: 'absolute', bottom: 0, right: 0, backgroundColor: '#0f172a', width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#fff' },
  displayFullName: { fontSize: 20, fontWeight: '700', color: '#0f172a', marginTop: 15 },
  form: { marginBottom: 30 },
  inputRow: { flexDirection: 'row' },
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 11, fontWeight: '700', color: '#94a3b8', marginBottom: 8 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 16, color: '#0f172a' },
  textArea: { minHeight: 90, paddingTop: 12 },
  saveBtn: { backgroundColor: '#0f172a', height: 56, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});

export default EditProfileScreen;
