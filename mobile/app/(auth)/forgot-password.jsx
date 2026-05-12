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
 * Implementation consistent with Web version
 */

const ForgotPasswordScreen = () => {
  const router = useRouter();
  const { forgotPassword, resetPassword, sendOtp, loading } = useAuth();
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
  
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [now, setNow] = useState(Date.now());

  const normalizedEmail = useMemo(() => email.trim().toLowerCase(), [email]);
  // SecureStore keys only allow alphanumeric, '.', '-', and '_'
  const sanitizedEmail = normalizedEmail.replace(/[^a-zA-Z0-9._-]/g, '_');
  const cooldownKey = normalizedEmail ? `forgot_password_cooldown_${sanitizedEmail}` : '';
  const cooldownRemainingMs = Math.max(0, cooldownUntil - now);
  const cooldownRemainingSeconds = Math.ceil(cooldownRemainingMs / 1000);
  const isCooldownActive = cooldownRemainingMs > 0;

  // Timer for cooldown
  useEffect(() => {
    const intervalId = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(intervalId);
  }, []);

  // Clear local error on mount and step change
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
      // Use the dedicated forgot-password endpoint for the first request
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
      // For resending, we can also use sendOtp with FORGOT_PASSWORD purpose which is often more stable
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

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <MaterialCommunityIcons name="arrow-left" size={24} color="#1a1a1a" />
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
              <View style={[styles.inputWrapper, step === 'reset' && styles.disabledInput]}>
                <MaterialCommunityIcons name="email-outline" size={20} color="#666" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="user@gmail.com"
                  autoCapitalize="none"
                  keyboardType="email-address"
                  editable={step === 'request' && !loading}
                  value={email}
                  onChangeText={setEmail}
                />
                {isCheckingEmail && (
                  <ActivityIndicator size="small" color="#007AFF" style={{ marginRight: 8 }} />
                )}
              </View>
            </View>

            {step === 'reset' && (
              <>
                {/* OTP Input */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Mã OTP</Text>
                  <View style={styles.inputWrapper}>
                    <MaterialCommunityIcons name="shield-check-outline" size={20} color="#666" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Nhập mã OTP"
                      keyboardType="number-pad"
                      editable={!loading}
                      value={otpCode}
                      onChangeText={setOtpCode}
                    />
                  </View>
                </View>

                {/* New Password */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Mật khẩu mới</Text>
                  <View style={styles.inputWrapper}>
                    <MaterialCommunityIcons name="lock-outline" size={20} color="#666" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Ít nhất 8 ký tự"
                      secureTextEntry={!showPassword}
                      editable={!loading}
                      value={newPassword}
                      onChangeText={setNewPassword}
                    />
                    <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                      <MaterialCommunityIcons name={showPassword ? "eye-off" : "eye"} size={20} color="#666" />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Confirm Password */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Xác nhận mật khẩu</Text>
                  <View style={styles.inputWrapper}>
                    <MaterialCommunityIcons name="lock-check-outline" size={20} color="#666" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Nhập lại mật khẩu"
                      secureTextEntry={!showConfirmPassword}
                      editable={!loading}
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                    />
                    <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                      <MaterialCommunityIcons name={showConfirmPassword ? "eye-off" : "eye"} size={20} color="#666" />
                    </TouchableOpacity>
                  </View>
                </View>
              </>
            )}

            {localError ? <Text style={styles.errorText}>{localError}</Text> : null}
            {successMessage ? <Text style={styles.successText}>{successMessage}</Text> : null}

            <TouchableOpacity
              style={[styles.primaryButton, (loading || (step === 'request' && isCooldownActive)) && styles.disabledButton]}
              onPress={step === 'request' ? handleRequestOtp : handleResetPassword}
              disabled={loading || (step === 'request' && isCooldownActive)}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>
                  {step === 'request' 
                    ? (isCooldownActive ? `Thử lại sau ${formatCooldown(cooldownRemainingSeconds)}` : 'Gửi mã OTP')
                    : 'Đặt lại mật khẩu'}
                </Text>
              )}
            </TouchableOpacity>

            {step === 'reset' && (
              <TouchableOpacity 
                onPress={handleResendOtp} 
                disabled={loading || isCooldownActive}
                style={styles.resendButton}
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
  container: { flex: 1, backgroundColor: '#fff' },
  scrollContent: { padding: 24, flexGrow: 1 },
  backButton: { width: 40, height: 40, justifyContent: 'center', marginBottom: 20 },
  header: { marginBottom: 32 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#1a1a1a' },
  subtitle: { fontSize: 16, color: '#666', marginTop: 8, lineHeight: 22 },
  form: { gap: 16 },
  inputGroup: { gap: 8 },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginLeft: 4 },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 56,
    borderWidth: 1,
    borderColor: '#eee'
  },
  disabledInput: { backgroundColor: '#f0f0f0', borderColor: '#ddd' },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, fontSize: 16, color: '#1a1a1a' },
  primaryButton: {
    backgroundColor: '#007AFF',
    height: 56,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8
  },
  disabledButton: { backgroundColor: '#94c5ff' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  errorText: { color: '#ff4d4f', fontSize: 14, textAlign: 'center', marginTop: 8 },
  successText: { color: '#4CAF50', fontSize: 14, textAlign: 'center', marginTop: 8 },
  resendButton: { alignItems: 'center', marginTop: 12, paddingVertical: 8 },
  resendText: { color: '#007AFF', fontWeight: '600', fontSize: 14 },
  disabledText: { color: '#999' },
});

export default ForgotPasswordScreen;
