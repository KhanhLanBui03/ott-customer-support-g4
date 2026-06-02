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
 * Redesigned for F5 Chat with premium dark theme and unified UI
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
  const [focusedInput, setFocusedInput] = useState(''); // '' or 'email' or 'password'

  // Clear errors when entering page
  useEffect(() => {
    clearError();
  }, []);

  // Handle system error messages
  useEffect(() => {
    if (authError) {
      const isLocked = (typeof authError === 'object' && authError.code === 'ACCOUNT_LOCKED') || 
                      (typeof authError === 'string' && authError.includes('trạng thái chờ xóa'));

      if (isLocked) {
        const lockTime = authError.metadata?.lockedAt || new Date().toISOString();
        setLockedAt(lockTime);
        setShowRestoreModal(true);
        setLocalError('');
        return;
      }

      if (authError === 'Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.') {
        setLocalError(authError);
      } else if (authError.includes('Invalid credentials') || authError.includes('401')) {
        setLocalError('Email hoặc mật khẩu không chính xác');
      } else {
        setLocalError(authError);
      }
    }
  }, [authError]);

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
      await login(value, password.trim(), Platform.OS + '-device', 'Mobile App');
    } catch (err) {
      console.log('Login error caught in component:', err);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      {/* Decorative Glow Elements */}
      <View style={styles.glow1} pointerEvents="none" />
      <View style={styles.glow2} pointerEvents="none" />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent} 
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <MaterialCommunityIcons name="flash" size={42} color="#6366f1" />
            </View>
            <Text style={styles.appName}>
              <Text style={styles.appNameHighlight}>F5</Text> Chat
            </Text>
            <Text style={styles.subtitle}>Kết nối tức thì, Bảo mật tuyệt đối</Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            {/* Email Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Gmail</Text>
              <View style={[
                styles.inputWrapper, 
                localError ? styles.inputErrorBorder : null,
                focusedInput === 'email' ? styles.inputActiveBorder : null
              ]}>
                <MaterialCommunityIcons 
                  name="email-outline" 
                  size={20} 
                  color={focusedInput === 'email' ? '#6366f1' : '#64748b'} 
                  style={styles.inputIcon} 
                />
                <TextInput
                  style={styles.input}
                  placeholder="user@gmail.com"
                  placeholderTextColor="#475569"
                  autoCapitalize="none"
                  keyboardType="email-address"
                  editable={!loading}
                  value={email}
                  onFocus={() => setFocusedInput('email')}
                  onBlur={() => setFocusedInput('')}
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
              <View style={[
                styles.inputWrapper, 
                localError ? styles.inputErrorBorder : null,
                focusedInput === 'password' ? styles.inputActiveBorder : null
              ]}>
                <MaterialCommunityIcons 
                  name="lock-outline" 
                  size={20} 
                  color={focusedInput === 'password' ? '#6366f1' : '#64748b'} 
                  style={styles.inputIcon} 
                />
                <TextInput
                  style={styles.input}
                  placeholder="Nhập mật khẩu"
                  placeholderTextColor="#475569"
                  secureTextEntry={!showPassword}
                  editable={!loading}
                  value={password}
                  onFocus={() => setFocusedInput('password')}
                  onBlur={() => setFocusedInput('')}
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
                    color="#64748b"
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Error Message */}
            {localError ? (
              <View style={styles.errorContainer}>
                <MaterialCommunityIcons name="alert-circle-outline" size={18} color="#ef4444" />
                <Text style={styles.errorText}>{localError}</Text>
              </View>
            ) : null}

            {/* Login Button */}
            <TouchableOpacity
              style={[styles.loginButton, loading && styles.loginButtonDisabled]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#0c0714" />
              ) : (
                <Text style={styles.loginButtonText}>ĐĂNG NHẬP</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.forgotPasswordButton}
              onPress={() => router.push('/forgot-password')}
              activeOpacity={0.7}
            >
              <Text style={styles.forgotPasswordText}>Quên mật khẩu?</Text>
            </TouchableOpacity>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Chưa có tài khoản?</Text>
            <TouchableOpacity onPress={() => router.push('/register')} activeOpacity={0.7}>
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
  container: { 
    flex: 1, 
    backgroundColor: '#0c0714', 
    position: 'relative' 
  },
  scrollContent: { 
    flexGrow: 1, 
    paddingHorizontal: 20, 
    paddingVertical: 32, 
    justifyContent: 'center' 
  },
  glow1: {
    width: 300, 
    height: 300, 
    borderRadius: 150, 
    backgroundColor: '#7c3aed', 
    opacity: 0.12,
    position: 'absolute', 
    top: -50, 
    right: -50,
  },
  glow2: {
    width: 300, 
    height: 300, 
    borderRadius: 150, 
    backgroundColor: '#4f46e5', 
    opacity: 0.1,
    position: 'absolute', 
    bottom: -50, 
    left: -50,
  },
  header: { 
    alignItems: 'center', 
    marginBottom: 32 
  },
  logoContainer: {
    width: 80, 
    height: 80, 
    backgroundColor: 'rgba(255, 255, 255, 0.03)', 
    borderRadius: 24,
    justifyContent: 'center', 
    alignItems: 'center', 
    marginBottom: 16,
    borderWidth: 1, 
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  appName: { 
    fontSize: 32, 
    fontWeight: '900', 
    color: '#ffffff', 
    marginBottom: 8, 
    letterSpacing: -0.5 
  },
  appNameHighlight: { 
    color: '#6366f1' 
  },
  subtitle: { 
    fontSize: 14, 
    color: '#94a3b8', 
    textAlign: 'center', 
    fontWeight: '500' 
  },
  form: { 
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderWidth: 1, 
    borderColor: 'rgba(255, 255, 255, 0.06)', 
    borderRadius: 32, 
    padding: 24, 
    paddingBottom: 28,
    gap: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 15,
    elevation: 5,
  },
  inputGroup: { 
    gap: 8 
  },
  label: { 
    fontSize: 12, 
    fontWeight: '700', 
    color: '#94a3b8', 
    marginLeft: 4, 
    textTransform: 'uppercase', 
    letterSpacing: 1 
  },
  inputWrapper: {
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: 'rgba(22, 15, 38, 0.3)',
    borderWidth: 1, 
    borderColor: 'rgba(255, 255, 255, 0.08)', 
    borderRadius: 18, 
    paddingHorizontal: 16, 
    height: 56,
  },
  inputActiveBorder: { 
    borderColor: 'rgba(99, 102, 241, 0.5)', 
    backgroundColor: 'rgba(22, 15, 38, 0.5)' 
  },
  inputErrorBorder: { 
    borderColor: '#ef4444', 
    backgroundColor: 'rgba(239, 68, 68, 0.02)' 
  },
  inputIcon: { 
    marginRight: 12 
  },
  input: { 
    flex: 1, 
    fontSize: 15, 
    color: '#f8fafc',
    paddingVertical: 0
  },
  toggleButton: { 
    padding: 4 
  },
  errorContainer: {
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 8, 
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    padding: 14, 
    borderRadius: 16, 
    borderWidth: 1, 
    borderColor: 'rgba(239, 68, 68, 0.15)',
  },
  errorText: { 
    color: '#ef4444', 
    fontSize: 13, 
    fontWeight: '600',
    flex: 1
  },
  loginButton: {
    height: 56, 
    backgroundColor: '#ffffff', 
    borderRadius: 28,
    alignItems: 'center', 
    justifyContent: 'center', 
    marginTop: 8,
    shadowColor: '#ffffff', 
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15, 
    shadowRadius: 8, 
    elevation: 4,
  },
  loginButtonDisabled: { 
    backgroundColor: 'rgba(255, 255, 255, 0.4)', 
    elevation: 0 
  },
  loginButtonText: { 
    color: '#0c0714', 
    fontSize: 15, 
    fontWeight: '800', 
    letterSpacing: 1 
  },
  forgotPasswordButton: { 
    alignItems: 'center', 
    paddingVertical: 8 
  },
  forgotPasswordText: { 
    color: '#818cf8', 
    fontSize: 13, 
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  footer: { 
    flexDirection: 'row', 
    justifyContent: 'center', 
    alignItems: 'center', 
    gap: 6, 
    marginTop: 20 
  },
  footerText: { 
    fontSize: 14, 
    color: '#64748b' 
  },
  registerLink: { 
    fontSize: 14, 
    fontWeight: '700', 
    color: '#818cf8' 
  },
});

export default LoginScreen;
