import React, { useState, useEffect } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, Text as TText, XStack, YStack } from 'tamagui';
import { useAuth } from '../../src/hooks/useAuth';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useResponsive } from '../../src/hooks/useResponsive';
import Button from '../../src/components/common/Button';
import Input from '../../src/components/common/Input';

import AccountRestoreModal from '../../src/components/AccountRestore/AccountRestoreModal';

/**
 * LoginScreen (Mobile)
 * Redesigned for F5 Chat with premium dark theme and unified UI
 */

const LoginScreen = () => {
  const router = useRouter();
  const { isWideLayout, isTablet, formMaxWidth } = useResponsive();
  const { login, loading, error: authError, clearError, accessToken } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [lockedAt, setLockedAt] = useState(null);
  const [focusedInput, setFocusedInput] = useState(''); // '' or 'email' or 'password'
  const [deletionDate, setDeletionDate] = useState(null);

  // Clear errors when entering page
  useEffect(() => {
    clearError();
  }, []);

  // Handle system error messages
  useEffect(() => {
    if (authError) {
      const errorObj = typeof authError === 'object' ? (authError.error || authError) : null;
      const errorMessage = typeof authError === 'object'
        ? (authError.message || authError.error?.message || 'Đăng nhập thất bại')
        : authError;

      const isLocked = (errorObj?.code === 'ACCOUNT_LOCKED') ||
                      (errorMessage && typeof errorMessage === 'string' && errorMessage.includes('trạng thái chờ xóa'));

      if (isLocked) {
        const lockType = errorObj?.metadata?.lockType || authError.metadata?.lockType;

        // Tài khoản bị Admin khóa do vi phạm → Hiển thị thông báo lỗi inline
        if (lockType === 'ADMIN_LOCK') {
          const adminMsg = errorObj?.message || authError.message || 'Tài khoản của bạn đã bị khóa do vi phạm chính sách cộng đồng.';
          setLocalError(adminMsg);
          return;
        }

        // Người dùng tự xóa tài khoản → Hiển thị modal khôi phục
        const lockTime = errorObj?.metadata?.lockedAt || authError.metadata?.lockedAt || new Date().toISOString();
        const deleteTime = errorObj?.metadata?.deletionDate || authError.metadata?.deletionDate || null;
        setLockedAt(lockTime);
        setDeletionDate(deleteTime);
        setShowRestoreModal(true);
        setLocalError('');
        return;
      }

      // Nếu là lỗi hết hạn phiên, hiển thị trực tiếp
      if (errorMessage === 'Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.') {
        setLocalError(errorMessage);
      }
      // Việt hóa lỗi đăng nhập thất bại phổ biến
      else if (errorMessage && (errorMessage.includes('Invalid credentials') || errorMessage.includes('401'))) {
        setLocalError('Email hoặc mật khẩu không chính xác');
      } else {
        setLocalError(errorMessage);
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
          contentContainerStyle={[
            styles.scrollContent,
            isWideLayout && styles.scrollContentWide,
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <YStack
            width="100%"
            maxWidth={isWideLayout ? 920 : formMaxWidth}
            alignSelf="center"
            flexDirection={isWideLayout ? 'row' : 'column'}
            alignItems="center"
            justifyContent="center"
            gap={isWideLayout ? 36 : 24}
          >
            {/* Header / Brand Panel */}
            <YStack
              alignItems={isWideLayout ? 'flex-start' : 'center'}
              flex={isWideLayout ? 1 : undefined}
              maxWidth={isWideLayout ? 360 : undefined}
              paddingHorizontal={isWideLayout ? 8 : 0}
            >
              <YStack
                width={isTablet ? 92 : 80}
                height={isTablet ? 92 : 80}
                backgroundColor="rgba(59, 130, 246, 0.14)"
                borderRadius={26}
                justifyContent="center"
                alignItems="center"
                marginBottom={16}
                borderWidth={1.5}
                borderColor="rgba(59, 130, 246, 0.45)"
              >
                <MaterialCommunityIcons name="flash" size={isTablet ? 48 : 42} color="#60A5FA" />
              </YStack>
              <TText
                fontSize={isTablet ? 38 : 32}
                fontWeight="900"
                color="#F2F2F2"
                marginBottom={8}
                letterSpacing={-0.6}
              >
                <TText color="#3B82F6" fontSize={isTablet ? 38 : 32} fontWeight="900">
                  F5
                </TText>{' '}
                Chat
              </TText>
              <TText
                fontSize={14}
                color="#B8B3B0"
                textAlign={isWideLayout ? 'left' : 'center'}
                fontWeight="500"
                lineHeight={21}
              >
                Kết nối tức thì · Trợ lý AI thông minh · Bảo mật tuyệt đối
              </TText>
            </YStack>

            {/* Form Card (Tamagui Card + Input + Button) */}
            <YStack width="100%" maxWidth={440} flex={isWideLayout ? 1.15 : undefined} gap={18}>
              <Card
                bordered
                backgroundColor="#101013"
                borderColor="#2E2C2E"
                borderRadius={24}
                padding={24}
                gap={18}
              >
                <Input
                  darkSurface
                  label="Gmail"
                  placeholder="user@gmail.com"
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
                  leftIcon={
                    <MaterialCommunityIcons
                      name="email-outline"
                      size={20}
                      color={focusedInput === 'email' ? '#3B82F6' : '#8B949E'}
                    />
                  }
                />

                <Input
                  darkSurface
                  label="Mật khẩu"
                  placeholder="Nhập mật khẩu"
                  secureTextEntry={!showPassword}
                  editable={!loading}
                  value={password}
                  onFocus={() => setFocusedInput('password')}
                  onBlur={() => setFocusedInput('')}
                  onChangeText={(text) => {
                    setPassword(text);
                    setLocalError('');
                  }}
                  leftIcon={
                    <MaterialCommunityIcons
                      name="lock-outline"
                      size={20}
                      color={focusedInput === 'password' ? '#3B82F6' : '#8B949E'}
                    />
                  }
                  rightElement={
                    <TouchableOpacity
                      onPress={() => setShowPassword(!showPassword)}
                      style={styles.toggleButton}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <MaterialCommunityIcons
                        name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                        size={20}
                        color="#8B949E"
                      />
                    </TouchableOpacity>
                  }
                />

                {localError ? (
                  <XStack
                    alignItems="center"
                    backgroundColor="rgba(251, 86, 91, 0.12)"
                    borderColor="rgba(251, 86, 91, 0.35)"
                    borderWidth={1}
                    borderRadius={14}
                    paddingHorizontal={12}
                    paddingVertical={10}
                    gap={8}
                  >
                    <MaterialCommunityIcons name="alert-circle-outline" size={18} color="#FB565B" />
                    <TText color="#FCA5A5" fontSize={13} flex={1} fontWeight="500">
                      {localError}
                    </TText>
                  </XStack>
                ) : null}

                <Button
                  title="ĐĂNG NHẬP"
                  onPress={handleLogin}
                  loading={loading}
                  fullWidth
                  size="lg"
                />

                <TouchableOpacity
                  style={styles.forgotPasswordButton}
                  onPress={() => router.push('/forgot-password')}
                  activeOpacity={0.7}
                >
                  <TText color="#60A5FA" fontSize={14} fontWeight="600">
                    Quên mật khẩu?
                  </TText>
                </TouchableOpacity>
              </Card>

              {/* Footer */}
              <XStack justifyContent="center" alignItems="center" gap={6} paddingVertical={4}>
                <TText color="#8B949E" fontSize={14}>
                  Chưa có tài khoản?
                </TText>
                <TouchableOpacity onPress={() => router.push('/register')} activeOpacity={0.7}>
                  <TText color="#60A5FA" fontSize={14} fontWeight="700">
                    Đăng ký ngay
                  </TText>
                </TouchableOpacity>
              </XStack>
            </YStack>
          </YStack>
        </ScrollView>
      </KeyboardAvoidingView>

      <AccountRestoreModal
        visible={showRestoreModal}
        email={email}
        lockedAt={lockedAt}
        deletionDate={deletionDate}
        onClose={() => setShowRestoreModal(false)}
        onRestoreSuccess={() => {
          setShowRestoreModal(false);
          handleLogin();
        }}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050507',
    position: 'relative'
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingVertical: 32,
    justifyContent: 'center'
  },
  scrollContentWide: {
    paddingHorizontal: 36,
    paddingVertical: 24,
  },
  glow1: {
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: '#3B82F6',
    opacity: 0.12,
    position: 'absolute',
    top: -60,
    right: -60,
  },
  glow2: {
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: '#818CF8',
    opacity: 0.08,
    position: 'absolute',
    bottom: -60,
    left: -60,
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
