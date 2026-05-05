import React, { useState, useEffect } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../src/hooks/useAuth';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import AccountRestoreModal from '../../src/components/AccountRestore/AccountRestoreModal';

/**
 * LoginScreen (Mobile)
 * Strict login with Gmail only (consistent with Web version)
 */

const LoginScreen = () => {
  const router = useRouter();
  const { login, loading, error: authError, clearError, accessToken } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [lockedAt, setLockedAt] = useState(null);

  // Hiển thị thông báo lỗi từ hệ thống
  useEffect(() => {
    if (authError) {
      // Handle locked account (Object or String detection)
      const isLocked = (typeof authError === 'object' && authError.code === 'ACCOUNT_LOCKED') || 
                      (typeof authError === 'string' && authError.includes('trạng thái chờ xóa'));

      if (isLocked) {
        // Nếu là string, chúng ta lấy thời gian hiện tại hoặc từ metadata nếu có
        const lockTime = authError.metadata?.lockedAt || new Date().toISOString();
        setLockedAt(lockTime);
        setShowRestoreModal(true);
        setLocalError(''); // Clear local error to show modal instead
        return;
      }

      // Nếu là lỗi hết hạn phiên, hiển thị trực tiếp
      if (authError === 'Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.') {
        setLocalError(authError);
      } 
      // Việt hóa lỗi đăng nhập thất bại phổ biến
      else if (authError.includes('Invalid credentials') || authError.includes('401')) {
        setLocalError('Email hoặc mật khẩu không chính xác');
      } else {
        setLocalError(authError);
      }
    }
  }, [authError]);

  // Khi có token thì tự động chuyển vào trong (nếu layout chưa xử lý)
  useEffect(() => {
    if (accessToken) {
      console.log('Login successful');
    }
  }, [accessToken]);

  const handleLogin = async () => {
    const value = email.trim().toLowerCase();

    if (!value) {
      setLocalError('Vui lòng nhập địa chỉ Gmail');
      return;
    }

    if (!/^[A-Za-z0-9._%+-]+@gmail\.com$/i.test(value)) {
      setLocalError('Vui lòng nhập đúng định dạng @gmail.com');
      return;
    }

    if (!password.trim()) {
      setLocalError('Vui lòng nhập mật khẩu');
      return;
    }

    setLocalError('');

    try {
      // Quan trọng: Gửi đúng trường email cho Backend
      await login(value, password.trim(), Platform.OS + '-device', 'Mobile App');
    } catch (err) {
      console.log('Login error caught in component:', err);
      // Backend error is already handled in useEffect via authError from useAuth
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <MaterialCommunityIcons name="flash" size={48} color="#007AFF" />
            </View>
            <Text style={styles.appName}>New Node</Text>
            <Text style={styles.subtitle}>Chào mừng bạn quay trở lại</Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            {/* Email Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Gmail</Text>
              <View style={[styles.inputWrapper, localError && styles.inputErrorBorder]}>
                <MaterialCommunityIcons name="email-outline" size={20} color="#666" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="user@gmail.com"
                  placeholderTextColor="#999"
                  autoCapitalize="none"
                  keyboardType="email-address"
                  editable={!loading}
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text);
                    setLocalError('');
                  }}
                />
              </View>
            </View>

            {/* Password Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Mật khẩu</Text>
              <View style={[styles.inputWrapper, localError && styles.inputErrorBorder]}>
                <MaterialCommunityIcons name="lock-outline" size={20} color="#666" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Nhập mật khẩu"
                  placeholderTextColor="#999"
                  secureTextEntry={!showPassword}
                  editable={!loading}
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    setLocalError('');
                  }}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.toggleButton}
                >
                  <MaterialCommunityIcons
                    name={showPassword ? "eye-off-outline" : "eye-outline"}
                    size={20}
                    color="#666"
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Error Message */}
            {localError ? (
              <View style={styles.errorContainer}>
                <MaterialCommunityIcons name="alert-circle-outline" size={16} color="#ff4d4f" />
                <Text style={styles.errorText}>{localError}</Text>
              </View>
            ) : null}

            {/* Login Button */}
            <TouchableOpacity
              style={[styles.loginButton, loading && styles.loginButtonDisabled]}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.loginButtonText}>Đăng Nhập</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.forgotPasswordButton}>
              <Text style={styles.forgotPasswordText}>Quên mật khẩu?</Text>
            </TouchableOpacity>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Chưa có tài khoản?</Text>
            <TouchableOpacity onPress={() => router.push('/register')}>
              <Text style={styles.registerLink}>Đăng ký ngay</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <AccountRestoreModal
        visible={showRestoreModal}
        email={email}
        lockedAt={lockedAt}
        onClose={() => setShowRestoreModal(false)}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  scrollContent: { flexGrow: 1, paddingHorizontal: 24, paddingVertical: 40 },
  header: { alignItems: 'center', marginBottom: 48 },
  logoContainer: {
    width: 80, height: 80, backgroundColor: '#f0f7ff', borderRadius: 24,
    justifyContent: 'center', alignItems: 'center', marginBottom: 16,
    borderWidth: 1, borderColor: '#e1effe',
  },
  appName: { fontSize: 32, fontWeight: 'bold', color: '#1a1a1a', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#666', textAlign: 'center' },
  form: { gap: 20 },
  inputGroup: { gap: 8 },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginLeft: 4 },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#f9fafb',
    borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 16, paddingHorizontal: 16, height: 56,
  },
  inputErrorBorder: { borderColor: '#ff4d4f', backgroundColor: '#fff2f0' },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, fontSize: 16, color: '#111827' },
  toggleButton: { padding: 4 },
  errorContainer: {
    flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#fff2f0',
    padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#ffccc7',
  },
  errorText: { color: '#ff4d4f', fontSize: 13, fontWeight: '500' },
  loginButton: {
    height: 56, backgroundColor: '#007AFF', borderRadius: 16,
    alignItems: 'center', justifyContent: 'center', marginTop: 8,
    shadowColor: '#007AFF', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2, shadowRadius: 8, elevation: 4,
  },
  loginButtonDisabled: { backgroundColor: '#94c5ff', elevation: 0 },
  loginButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  forgotPasswordButton: { alignItems: 'center', paddingVertical: 8 },
  forgotPasswordText: { color: '#007AFF', fontSize: 14, fontWeight: '600' },
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: 'auto', paddingTop: 40 },
  footerText: { fontSize: 15, color: '#6b7280' },
  registerLink: { fontSize: 15, fontWeight: 'bold', color: '#007AFF' },
});

export default LoginScreen;
