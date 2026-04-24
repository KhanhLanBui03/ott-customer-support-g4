import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useDispatch } from 'react-redux';
import { authApi } from '../../src/api/authApi';
import { logoutUser } from '../../src/store/authSlice';

const ChangePasswordScreen = () => {
  const router = useRouter();
  const dispatch = useDispatch();

  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [wrongCount, setWrongCount] = useState(0);

  // Kiểm tra yêu cầu bảo mật
  const validations = {
    length: newPassword.length >= 8,
    lowercase: /[a-z]/.test(newPassword),
    uppercase: /[A-Z]/.test(newPassword),
    number: /[0-9]/.test(newPassword),
    special: /[@$!%*?&]/.test(newPassword),
  };

  const isFormValid = oldPassword && validations.length && validations.lowercase &&
                      validations.uppercase && validations.number && validations.special &&
                      newPassword === confirmPassword;

  const handleChangePassword = async () => {
    if (!isFormValid) {
      if (newPassword !== confirmPassword) {
        Alert.alert('Lỗi', 'Xác nhận mật khẩu mới không khớp');
      } else {
        Alert.alert('Lỗi', 'Vui lòng điền đầy đủ thông tin và thỏa mãn các yêu cầu bảo mật');
      }
      return;
    }

    setLoading(true);
    try {
      await authApi.changePassword({
        currentPassword: oldPassword,
        newPassword: newPassword,
      });

      Alert.alert('Thành công', 'Đổi mật khẩu thành công. Vui lòng đăng nhập lại.', [
        { text: 'OK', onPress: () => dispatch(logoutUser()) }
      ]);
    } catch (error) {
      console.log('Change password error:', error.message);

      if (error.response?.status === 400 || error.response?.status === 401) {
        const newCount = wrongCount + 1;
        setWrongCount(newCount);

        if (newCount >= 5) {
          Alert.alert('Cảnh báo', 'Bạn đã nhập sai mật khẩu cũ quá 5 lần. Ứng dụng sẽ tự động đăng xuất để bảo vệ tài khoản.', [
            { text: 'Đồng ý', onPress: () => dispatch(logoutUser()) }
          ]);
        } else {
          Alert.alert('Thông báo', `Bạn đã nhập sai mật khẩu cũ. Số lần nhập sai: ${newCount}/5`);
        }
      } else {
        Alert.alert('Lỗi', 'Đã có lỗi xảy ra. Vui lòng thử lại sau.');
      }
    } finally {
      setLoading(false);
    }
  };

  const ValidationItem = ({ label, isValid }) => (
    <View style={styles.validationItem}>
      <Ionicons
        name={isValid ? "checkmark-circle" : "ellipse-outline"}
        size={18}
        color={isValid ? "#10b981" : "#cbd5e1"}
      />
      <Text style={[styles.validationText, isValid && { color: '#10b981' }]}>{label}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>ĐỔI MẬT KHẨU</Text>
          <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
            <Ionicons name="close" size={26} color="#64748b" />
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {/* Mật khẩu cũ */}
          <View style={styles.inputGroup}>
            <View style={styles.labelWithIcon}>
              <MaterialIcons name="lock-outline" size={16} color="#94a3b8" />
              <Text style={styles.label}>MẬT KHẨU CŨ</Text>
            </View>
            <TextInput
              style={styles.input}
              value={oldPassword}
              onChangeText={setOldPassword}
              placeholder="Nhập mật khẩu cũ..."
              secureTextEntry
            />
          </View>

          {/* Mật khẩu mới */}
          <View style={styles.inputGroup}>
            <View style={styles.labelWithIcon}>
              <MaterialIcons name="lock-open" size={16} color="#94a3b8" />
              <Text style={styles.label}>MẬT KHẨU MỚI</Text>
            </View>
            <TextInput
              style={styles.input}
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="Nhập mật khẩu mới..."
              secureTextEntry
            />
          </View>

          {/* Bảng yêu cầu bảo mật */}
          <View style={styles.validationCard}>
            <Text style={styles.validationTitle}>YÊU CẦU BẢO MẬT:</Text>
            <ValidationItem label="Ít nhất 8 ký tự" isValid={validations.length} />
            <ValidationItem label="Chứa chữ cái in thường" isValid={validations.lowercase} />
            <ValidationItem label="Chứa chữ cái in hoa" isValid={validations.uppercase} />
            <ValidationItem label="Chứa số" isValid={validations.number} />
            <ValidationItem label="Chứa ký tự đặc biệt (@$!%*?&)" isValid={validations.special} />
          </View>

          {/* Xác nhận mật khẩu mới */}
          <View style={styles.inputGroup}>
            <View style={styles.labelWithIcon}>
              <MaterialIcons name="verified-user" size={16} color="#94a3b8" />
              <Text style={styles.label}>XÁC NHẬN MẬT KHẨU</Text>
            </View>
            <TextInput
              style={styles.input}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Nhập lại mật khẩu mới..."
              secureTextEntry
            />
          </View>

          {/* Nút xác nhận */}
          <TouchableOpacity
            style={[styles.saveBtn, (!isFormValid || loading) && { backgroundColor: '#94a3b8' }]}
            onPress={handleChangePassword}
            disabled={!isFormValid || loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <MaterialIcons name="save" size={20} color="#fff" />
                <Text style={styles.saveBtnText}>XÁC NHẬN THAY ĐỔI</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    height: 60,
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  headerTitle: { fontSize: 14, fontWeight: '700', color: '#334155', letterSpacing: 1 },
  closeButton: { position: 'absolute', right: 15 },
  scrollContent: { padding: 25 },
  inputGroup: { marginBottom: 20 },
  labelWithIcon: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  label: { fontSize: 11, fontWeight: '700', color: '#94a3b8', marginLeft: 6 },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: '#0f172a',
  },
  validationCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
    marginBottom: 25,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  validationTitle: { fontSize: 11, fontWeight: '700', color: '#94a3b8', marginBottom: 12 },
  validationItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  validationText: { fontSize: 13, color: '#94a3b8', marginLeft: 10 },
  saveBtn: {
    backgroundColor: '#64748b',
    height: 56,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '700', marginLeft: 10, letterSpacing: 0.5 },
});

export default ChangePasswordScreen;
