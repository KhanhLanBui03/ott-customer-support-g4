import React, { useState, useEffect, useMemo } from 'react';
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
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../src/hooks/useAuth';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';

/**
 * ForgotPasswordScreen (Mobile)
 * Redesigned for F5 Chat with premium dark theme and unified UI
 */

const ForgotPasswordScreen = () => {
  const router = useRouter();
  const { forgotPassword, resetPassword, sendOtp, loading, clearError } = useAuth();
  const COOLDOWN_MS = 2 * 60 * 1000;

  const [step, setStep] = useState('request'); // 'request' or 'reset'
  const [email, setEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [localError, setLocalError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);
  const [focusedInput, setFocusedInput] = useState(''); // '' or 'email' or 'otp' or 'newPassword' or 'confirmPassword'
  
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [now, setNow] = useState(Date.now());

  const normalizedEmail = useMemo(() => email.trim().toLowerCase(), [email]);
  const sanitizedEmail = normalizedEmail.replace(/[^a-zA-Z0-9._-]/g, '_');
  const cooldownKey = normalizedEmail ? `forgot_password_cooldown_${sanitizedEmail}` : '';
  const cooldownRemainingMs = Math.max(0, cooldownUntil - now);
  const cooldownRemainingSeconds = Math.ceil(cooldownRemainingMs / 1000);
  const isCooldownActive = cooldownRemainingMs > 0;

  // Clear errors on load
  useEffect(() => {
    clearError();
  }, []);

  // Timer for cooldown
  useEffect(() => {
    const intervalId = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(intervalId);
  }, []);

  // Clear errors on step change
  useEffect(() => {
    setLocalError('');
    setSuccessMessage('');
  }, [step]);

  // Simulate/Perform email check with feedback
  useEffect(() => {
    if (step !== 'request') return;
    
    const emailToTest = email.trim().toLowerCase();
    const isValid = /^[A-Za-z0-9._%+-]+@gmail\.com$/i.test(emailToTest);

    if (isValid) {
      setIsCheckingEmail(true);
      const timer = setTimeout(() => {
        setIsCheckingEmail(false);
      }, 1000);
      return () => clearTimeout(timer);
    } else {
      setIsCheckingEmail(false);
    }
  }, [email, step]);

  // Load cooldown from SecureStore
  useEffect(() => {
    const loadCooldown = async () => {
      if (!cooldownKey) {
        setCooldownUntil(0);
        return;
      }
      try {
        const stored = await SecureStore.getItemAsync(cooldownKey);
        const storedCooldown = Number(stored || 0);
        if (storedCooldown > Date.now()) {
          setCooldownUntil(storedCooldown);
        } else {
          await SecureStore.deleteItemAsync(cooldownKey);
          setCooldownUntil(0);
        }
      } catch (e) {
        setCooldownUntil(0);
      }
    };
    loadCooldown();
  }, [cooldownKey]);

  const applyCooldown = async (targetEmail) => {
    const nextAllowedAt = Date.now() + COOLDOWN_MS;
    setCooldownUntil(nextAllowedAt);
    if (targetEmail && cooldownKey) {
      await SecureStore.setItemAsync(cooldownKey, String(nextAllowedAt));
    }
  };

  const validateEmail = (val) => {
    if (!val) return 'Vui lòng nhập email';
    if (!/^[A-Za-z0-9._%+-]+@gmail\.com$/i.test(val)) {
      return 'Vui lòng nhập đúng định dạng @gmail.com';
    }
    return null;
  };

  const handleRequestOtp = async () => {
    setLocalError('');
    setSuccessMessage('');

    const emailError = validateEmail(email.trim());
    if (emailError) {
      setLocalError(emailError);
      return;
    }

    try {
      await forgotPassword(email.trim().toLowerCase());
      setStep('reset');
      await applyCooldown(email.trim().toLowerCase());
      setSuccessMessage('Mã OTP đã được gửi đến email của bạn.');
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Không thể gửi mã OTP. Vui lòng thử lại.';
      setLocalError(msg);
    }
  };

  const handleResendOtp = async () => {
    if (isCooldownActive || loading) return;
    
    setLocalError('');
    setSuccessMessage('');

    try {
      await sendOtp(email.trim().toLowerCase(), 'FORGOT_PASSWORD');
      await applyCooldown(email.trim().toLowerCase());
      setSuccessMessage('Mã OTP đã được gửi lại thành công.');
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Không thể gửi lại mã OTP. Vui lòng thử lại.';
      setLocalError(msg);
    }
  };

  const handleResetPassword = async () => {
    setLocalError('');
    setSuccessMessage('');

    if (!otpCode.trim()) {
      setLocalError('Vui lòng nhập mã OTP');
      return;
    }

    if (newPassword.length < 8) {
      setLocalError('Mật khẩu mới phải có ít nhất 8 ký tự');
      return;
    }

    if (newPassword !== confirmPassword) {
      setLocalError('Mật khẩu xác nhận không khớp');
      return;
    }

    try {
      await resetPassword({
        email: email.trim().toLowerCase(),
        otpCode: otpCode.trim(),
        newPassword,
      });
      
      Alert.alert(
        'Thành công',
        'Mật khẩu của bạn đã được đặt lại. Vui lòng đăng nhập bằng mật khẩu mới.',
        [{ text: 'OK', onPress: () => router.replace('/login') }]
      );
    } catch (err) {
      setLocalError(err?.response?.data?.message || 'Đặt lại mật khẩu thất bại.');
    }
  };

  const formatCooldown = (remainingSeconds) => {
    const minutes = Math.floor(remainingSeconds / 60);
    const seconds = remainingSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  };

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/login');
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
          <TouchableOpacity onPress={handleBack} style={styles.backButton} activeOpacity={0.7}>
            <MaterialCommunityIcons name="arrow-left" size={24} color="#ffffff" />
          </TouchableOpacity>

          <View style={styles.header}>
            <Text style={styles.title}>Quên mật khẩu</Text>
            <Text style={styles.subtitle}>
              {step === 'request' 
                ? 'Nhập email của bạn để nhận mã OTP khôi phục mật khẩu.' 
                : 'Nhập mã OTP và mật khẩu mới của bạn.'}
            </Text>
          </View>

          <View style={styles.form}>
            {/* Email Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Gmail</Text>
              <View style={[
                styles.inputWrapper, 
                step === 'reset' ? styles.disabledInput : null,
                focusedInput === 'email' ? styles.inputActiveBorder : null
              ]}>
                <MaterialCommunityIcons 
                  name="email-outline" 
                  size={20} 
                  color={focusedInput === 'email' ? '#6366f1' : '#64748b'} 
                  style={styles.inputIcon} 
                />
                <TextInput
                  style={[styles.input, step === 'reset' && { color: '#475569' }]}
                  placeholder="user@gmail.com"
                  placeholderTextColor="#475569"
                  autoCapitalize="none"
                  keyboardType="email-address"
                  editable={step === 'request' && !loading}
                  value={email}
                  onChangeText={setEmail}
                  onFocus={() => setFocusedInput('email')}
                  onBlur={() => setFocusedInput('')}
                />
                {isCheckingEmail && (
                  <ActivityIndicator size="small" color="#6366f1" style={{ marginRight: 8 }} />
                )}
              </View>
            </View>

            {step === 'reset' && (
              <>
                {/* OTP Input */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Mã OTP</Text>
                  <View style={[
                    styles.inputWrapper,
                    focusedInput === 'otp' ? styles.inputActiveBorder : null
                  ]}>
                    <MaterialCommunityIcons 
                      name="shield-check-outline" 
                      size={20} 
                      color={focusedInput === 'otp' ? '#6366f1' : '#64748b'} 
                      style={styles.inputIcon} 
                    />
                    <TextInput
                      style={styles.input}
                      placeholder="Nhập mã OTP"
                      placeholderTextColor="#475569"
                      keyboardType="number-pad"
                      editable={!loading}
                      value={otpCode}
                      onChangeText={setOtpCode}
                      onFocus={() => setFocusedInput('otp')}
                      onBlur={() => setFocusedInput('')}
                    />
                  </View>
                </View>

                {/* New Password */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Mật khẩu mới</Text>
                  <View style={[
                    styles.inputWrapper,
                    focusedInput === 'newPassword' ? styles.inputActiveBorder : null
                  ]}>
                    <MaterialCommunityIcons 
                      name="lock-outline" 
                      size={20} 
                      color={focusedInput === 'newPassword' ? '#6366f1' : '#64748b'} 
                      style={styles.inputIcon} 
                    />
                    <TextInput
                      style={styles.input}
                      placeholder="Ít nhất 8 ký tự"
                      placeholderTextColor="#475569"
                      secureTextEntry={!showPassword}
                      editable={!loading}
                      value={newPassword}
                      onChangeText={setNewPassword}
                      onFocus={() => setFocusedInput('newPassword')}
                      onBlur={() => setFocusedInput('')}
                    />
                    <TouchableOpacity onPress={() => setShowPassword(!showPassword)} activeOpacity={0.7}>
                      <MaterialCommunityIcons name={showPassword ? "eye-off" : "eye"} size={20} color="#64748b" />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Confirm Password */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Xác nhận mật khẩu</Text>
                  <View style={[
                    styles.inputWrapper,
                    focusedInput === 'confirmPassword' ? styles.inputActiveBorder : null
                  ]}>
                    <MaterialCommunityIcons 
                      name="lock-check-outline" 
                      size={20} 
                      color={focusedInput === 'confirmPassword' ? '#6366f1' : '#64748b'} 
                      style={styles.inputIcon} 
                    />
                    <TextInput
                      style={styles.input}
                      placeholder="Nhập lại mật khẩu"
                      placeholderTextColor="#475569"
                      secureTextEntry={!showConfirmPassword}
                      editable={!loading}
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      onFocus={() => setFocusedInput('confirmPassword')}
                      onBlur={() => setFocusedInput('')}
                    />
                    <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)} activeOpacity={0.7}>
                      <MaterialCommunityIcons name={showConfirmPassword ? "eye-off" : "eye"} size={20} color="#64748b" />
                    </TouchableOpacity>
                  </View>
                </View>
              </>
            )}

            {localError ? (
              <View style={styles.errorContainer}>
                <MaterialCommunityIcons name="alert-circle-outline" size={18} color="#ef4444" />
                <Text style={styles.errorText}>{localError}</Text>
              </View>
            ) : null}

            {successMessage ? (
              <View style={styles.successContainer}>
                <MaterialCommunityIcons name="check-circle-outline" size={18} color="#10b981" />
                <Text style={styles.successText}>{successMessage}</Text>
              </View>
            ) : null}

            <TouchableOpacity
              style={[styles.primaryButton, (loading || (step === 'request' && isCooldownActive)) && styles.disabledButton]}
              onPress={step === 'request' ? handleRequestOtp : handleResetPassword}
              disabled={loading || (step === 'request' && isCooldownActive)}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#0c0714" />
              ) : (
                <Text style={styles.buttonText}>
                  {step === 'request' 
                    ? (isCooldownActive ? `THỬ LẠI SAU ${formatCooldown(cooldownRemainingSeconds)}` : 'GỬI MÃ OTP')
                    : 'ĐẶT LẠI MẬT KHẨU'}
                </Text>
              )}
            </TouchableOpacity>

            {step === 'reset' && (
              <TouchableOpacity 
                onPress={handleResendOtp} 
                disabled={loading || isCooldownActive}
                style={styles.resendButton}
                activeOpacity={0.7}
              >
                <Text style={[styles.resendText, (loading || isCooldownActive) && styles.disabledText]}>
                  {isCooldownActive ? `Gửi lại mã sau ${formatCooldown(cooldownRemainingSeconds)}` : 'Gửi lại mã OTP'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
    padding: 20, 
    flexGrow: 1, 
    justifyContent: 'center' 
  },
  backButton: { 
    width: 44, 
    height: 44, 
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center', 
    alignItems: 'center',
    marginBottom: 20 
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
    marginBottom: 24,
    alignItems: 'center'
  },
  title: { 
    fontSize: 28, 
    fontWeight: '900', 
    color: '#ffffff',
    letterSpacing: -0.5
  },
  subtitle: { 
    fontSize: 14, 
    color: '#94a3b8', 
    marginTop: 8, 
    lineHeight: 22,
    textAlign: 'center'
  },
  form: { 
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderWidth: 1, 
    borderColor: 'rgba(255, 255, 255, 0.06)', 
    borderRadius: 32, 
    padding: 24, 
    paddingBottom: 28,
    gap: 16,
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
    borderRadius: 18,
    paddingHorizontal: 16,
    height: 56,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)'
  },
  disabledInput: { 
    backgroundColor: 'rgba(255, 255, 255, 0.01)', 
    borderColor: 'rgba(255, 255, 255, 0.03)' 
  },
  inputActiveBorder: { 
    borderColor: 'rgba(99, 102, 241, 0.5)',
    backgroundColor: 'rgba(22, 15, 38, 0.5)'
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
  primaryButton: {
    backgroundColor: '#ffffff',
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#ffffff', 
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15, 
    shadowRadius: 8, 
    elevation: 4,
  },
  disabledButton: { 
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    elevation: 0
  },
  buttonText: { 
    color: '#0c0714', 
    fontSize: 15, 
    fontWeight: '800',
    letterSpacing: 1
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
  successContainer: {
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 8, 
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    padding: 14, 
    borderRadius: 16, 
    borderWidth: 1, 
    borderColor: 'rgba(16, 185, 129, 0.15)',
  },
  successText: { 
    color: '#10b981', 
    fontSize: 13, 
    fontWeight: '600',
    flex: 1
  },
  resendButton: { 
    alignItems: 'center', 
    marginTop: 12, 
    paddingVertical: 8 
  },
  resendText: { 
    color: '#818cf8', 
    fontWeight: '700', 
    fontSize: 14 
  },
  disabledText: { 
    color: '#475569' 
  },
});

export default ForgotPasswordScreen;
