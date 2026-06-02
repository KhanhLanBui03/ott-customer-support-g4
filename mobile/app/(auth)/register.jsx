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
 * RegisterScreen (Mobile)
 * Redesigned for F5 Chat with premium dark theme and unified UI
 */

const RegisterScreen = () => {
  const router = useRouter();
  const { register, sendOtp, verify, checkPhone, loading, error: authError, clearError } = useAuth();
  const COOLDOWN_MS = 2 * 60 * 1000;

  const [step, setStep] = useState('verify-email'); // 'verify-email' or 'register'
  const [formData, setFormData] = useState({
    email: '',
    phoneNumber: '',
    firstName: '',
    lastName: '',
    password: '',
    confirmPassword: '',
  });

  const [otpCode, setOtpCode] = useState('');
  const [verificationSent, setVerificationSent] = useState(false);
  const [verifiedEmail, setVerifiedEmail] = useState('');

  const [localError, setLocalError] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [focusedInput, setFocusedInput] = useState(''); // Tracking focused inputs
  
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [now, setNow] = useState(Date.now());

  const normalizedEmail = useMemo(() => formData.email.trim().toLowerCase(), [formData.email]);
  const sanitizedEmail = normalizedEmail.replace(/[^a-zA-Z0-9._-]/g, '_');
  const cooldownKey = normalizedEmail ? `register_otp_cooldown_${sanitizedEmail}` : '';
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

  // Password requirements
  const passwordChecks = useMemo(() => ({
    minLength: formData.password.length >= 8,
    lower: /[a-z]/.test(formData.password),
    upper: /[A-Z]/.test(formData.password),
    number: /\d/.test(formData.password),
    special: /[@$!%*?&]/.test(formData.password),
  }), [formData.password]);

  const isPasswordValid = Object.values(passwordChecks).every(Boolean);

  const handleSendOtp = async () => {
    setLocalError('');
    const email = formData.email.trim().toLowerCase();

    if (!email || !/^[A-Za-z0-9._%+-]+@gmail\.com$/i.test(email)) {
      setLocalError('Vui lòng nhập đúng định dạng Gmail (@gmail.com)');
      return;
    }

    if (isCooldownActive) {
      setLocalError(`Vui lòng chờ ${formatCooldown(cooldownRemainingSeconds)} trước khi gửi lại mã`);
      return;
    }

    try {
      await sendOtp(email, 'REGISTRATION');
      await applyCooldown(email);
      setVerificationSent(true);
      Alert.alert('Thông báo', `Mã OTP đã được gửi đến ${email}`);
    } catch (err) {
      setLocalError(err?.response?.data?.message || 'Không thể gửi mã OTP');
    }
  };

  const handleVerifyOtp = async () => {
    setLocalError('');
    if (!otpCode.trim()) {
      setLocalError('Vui lòng nhập mã OTP');
      return;
    }

    try {
      await verify(formData.email.trim().toLowerCase(), otpCode.trim(), 'REGISTRATION');
      setVerifiedEmail(formData.email.trim().toLowerCase());
      setStep('register');
    } catch (err) {
      setLocalError(err?.response?.data?.message || 'Mã OTP không chính xác');
    }
  };

  const validatePhone = async (phone) => {
    if (!phone) {
      setPhoneError('Số điện thoại không được để trống');
      return false;
    }
    if (!/^0(3|5|7|8|9)\d{8}$/.test(phone)) {
      setPhoneError('SĐT không hợp lệ (10 số, đầu 03,05,07,08,09)');
      return false;
    }
    try {
      const res = await checkPhone(phone);
      if (res.data?.exists || res.exists) {
        setPhoneError('Số điện thoại này đã được sử dụng');
        return false;
      }
      setPhoneError('');
      return true;
    } catch (err) {
      return true;
    }
  };

  const handleRegister = async () => {
    setLocalError('');
    setPhoneError('');

    const isPhoneOk = await validatePhone(formData.phoneNumber);
    if (!isPhoneOk) return;

    if (!formData.firstName || !formData.lastName) {
      setLocalError('Vui lòng nhập đầy đủ Họ và Tên');
      return;
    }

    if (!isPasswordValid) {
      setLocalError('Mật khẩu không đáp ứng đủ yêu cầu bảo mật');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setLocalError('Mật khẩu xác nhận không khớp');
      return;
    }

    try {
      await register({
        ...formData,
        email: verifiedEmail,
      });

      Alert.alert('Thành công', 'Tài khoản của bạn đã được tạo thành công!', [
        { text: 'Đăng nhập ngay', onPress: () => router.replace('/login') }
      ]);
    } catch (err) {
      setLocalError(err?.response?.data?.message || 'Đăng ký thất bại');
    }
  };

  const formatCooldown = (remainingSeconds) => {
    const minutes = Math.floor(remainingSeconds / 60);
    const seconds = remainingSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      {/* Decorative Glow Elements */}
      <View style={styles.glow1} pointerEvents="none" />
      <View style={styles.glow2} pointerEvents="none" />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Text style={styles.title}>Đăng Ký</Text>
            <Text style={styles.subtitle}>
              {step === 'verify-email' ? 'Xác thực Gmail để bắt đầu' : 'Hoàn thiện thông tin cá nhân'}
            </Text>
          </View>

          {step === 'verify-email' ? (
            <View style={styles.form}>
              <View style={[
                styles.inputWrapper,
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
                  placeholder="Nhập Gmail của bạn"
                  placeholderTextColor="#475569"
                  value={formData.email}
                  onChangeText={(text) => setFormData({...formData, email: text})}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  editable={!verificationSent}
                  onFocus={() => setFocusedInput('email')}
                  onBlur={() => setFocusedInput('')}
                />
              </View>

              {verificationSent && (
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
                    value={otpCode}
                    onChangeText={setOtpCode}
                    keyboardType="number-pad"
                    maxLength={6}
                    onFocus={() => setFocusedInput('otp')}
                    onBlur={() => setFocusedInput('')}
                  />
                </View>
              )}

              {localError ? (
                <View style={styles.errorContainer}>
                  <MaterialCommunityIcons name="alert-circle-outline" size={18} color="#ef4444" />
                  <Text style={styles.errorText}>{localError}</Text>
                </View>
              ) : null}

              <TouchableOpacity
                style={[styles.primaryButton, (loading || (step === 'verify-email' && isCooldownActive && !verificationSent)) && { opacity: 0.7 }]}
                onPress={verificationSent ? handleVerifyOtp : handleSendOtp}
                disabled={loading || (step === 'verify-email' && isCooldownActive && !verificationSent)}
                activeOpacity={0.8}
              >
                {loading ? <ActivityIndicator color="#fff" /> : (
                  <Text style={styles.buttonText}>
                    {verificationSent 
                      ? 'XÁC THỰC OTP' 
                      : (isCooldownActive ? `THỬ LẠI SAU ${formatCooldown(cooldownRemainingSeconds)}` : 'GỬI MÃ XÁC THỰC')}
                  </Text>
                )}
              </TouchableOpacity>

              {verificationSent && (
                <TouchableOpacity 
                  onPress={handleSendOtp} 
                  style={[styles.resendButton, isCooldownActive && { opacity: 0.5 }]}
                  disabled={loading || isCooldownActive}
                  activeOpacity={0.7}
                >
                  <Text style={styles.resendText}>
                    {isCooldownActive ? `Gửi lại mã sau ${formatCooldown(cooldownRemainingSeconds)}` : 'Gửi lại mã'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <View style={styles.form}>
               <View style={styles.row}>
                <View style={[
                  styles.inputWrapper, 
                  { flex: 1, marginRight: 8 },
                  focusedInput === 'lastName' ? styles.inputActiveBorder : null
                ]}>
                  <TextInput
                    style={styles.input}
                    placeholder="Họ"
                    placeholderTextColor="#475569"
                    value={formData.lastName}
                    onChangeText={(text) => setFormData({...formData, lastName: text})}
                    onFocus={() => setFocusedInput('lastName')}
                    onBlur={() => setFocusedInput('')}
                  />
                </View>
                <View style={[
                  styles.inputWrapper, 
                  { flex: 1 },
                  focusedInput === 'firstName' ? styles.inputActiveBorder : null
                ]}>
                  <TextInput
                    style={styles.input}
                    placeholder="Tên"
                    placeholderTextColor="#475569"
                    value={formData.firstName}
                    onChangeText={(text) => setFormData({...formData, firstName: text})}
                    onFocus={() => setFocusedInput('firstName')}
                    onBlur={() => setFocusedInput('')}
                  />
                </View>
              </View>

              <View style={[
                styles.inputWrapper, 
                phoneError ? styles.inputError : null,
                focusedInput === 'phoneNumber' ? styles.inputActiveBorder : null
              ]}>
                <MaterialCommunityIcons 
                  name="phone-outline" 
                  size={20} 
                  color={focusedInput === 'phoneNumber' ? '#6366f1' : '#64748b'} 
                  style={styles.inputIcon} 
                />
                <TextInput
                  style={styles.input}
                  placeholder="Số điện thoại (0XXXXXXXXX)"
                  placeholderTextColor="#475569"
                  value={formData.phoneNumber}
                  onChangeText={(text) => {
                    setFormData({...formData, phoneNumber: text});
                    setPhoneError('');
                  }}
                  onBlur={() => {
                    setFocusedInput('');
                    validatePhone(formData.phoneNumber);
                  }}
                  onFocus={() => setFocusedInput('phoneNumber')}
                  keyboardType="phone-pad"
                />
              </View>
              {phoneError ? <Text style={styles.errorTextSmall}>{phoneError}</Text> : null}

              <View style={[
                styles.inputWrapper,
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
                  placeholder="Mật khẩu"
                  placeholderTextColor="#475569"
                  secureTextEntry={!showPassword}
                  value={formData.password}
                  onChangeText={(text) => setFormData({...formData, password: text})}
                  onFocus={() => setFocusedInput('password')}
                  onBlur={() => setFocusedInput('')}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} activeOpacity={0.7}>
                  <MaterialCommunityIcons name={showPassword ? "eye-off" : "eye"} size={20} color="#64748b" />
                </TouchableOpacity>
              </View>

              <View style={styles.reqContainer}>
                <Requirement met={passwordChecks.minLength} text="Ít nhất 8 ký tự" />
                <Requirement met={passwordChecks.upper && passwordChecks.lower} text="Chứa chữ hoa & chữ thường" />
                <Requirement met={passwordChecks.number} text="Chứa chữ số" />
                <Requirement met={passwordChecks.special} text="Chứa ký tự đặc biệt (@$!%*?&)" />
              </View>

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
                  placeholder="Xác nhận mật khẩu"
                  placeholderTextColor="#475569"
                  secureTextEntry={!showConfirmPassword}
                  value={formData.confirmPassword}
                  onChangeText={(text) => setFormData({...formData, confirmPassword: text})}
                  onFocus={() => setFocusedInput('confirmPassword')}
                  onBlur={() => setFocusedInput('')}
                />
                <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)} activeOpacity={0.7}>
                  <MaterialCommunityIcons name={showConfirmPassword ? "eye-off" : "eye"} size={20} color="#64748b" />
                </TouchableOpacity>
              </View>

              {localError ? (
                <View style={styles.errorContainer}>
                  <MaterialCommunityIcons name="alert-circle-outline" size={18} color="#ef4444" />
                  <Text style={styles.errorText}>{localError}</Text>
                </View>
              ) : null}

              <TouchableOpacity 
                style={styles.primaryButton} 
                onPress={handleRegister} 
                disabled={loading}
                activeOpacity={0.8}
              >
                {loading ? <ActivityIndicator color="#0c0714" /> : <Text style={styles.buttonText}>TẠO TÀI KHOẢN</Text>}
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity onPress={() => router.push('/login')} style={styles.footer} activeOpacity={0.7}>
            <Text style={styles.footerText}>Đã có tài khoản? <Text style={styles.linkText}>Đăng nhập</Text></Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const Requirement = ({ met, text }) => (
  <View style={styles.reqItem}>
    <MaterialCommunityIcons 
      name={met ? "check-circle" : "circle-outline"} 
      size={14} 
      color={met ? "#10b981" : "#475569"} 
    />
    <Text style={[styles.reqText, met && styles.reqTextMet]}>{text}</Text>
  </View>
);

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
    marginTop: 10,
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
  row: { 
    flexDirection: 'row', 
    gap: 12 
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
  inputActiveBorder: { 
    borderColor: 'rgba(99, 102, 241, 0.5)',
    backgroundColor: 'rgba(22, 15, 38, 0.5)'
  },
  inputError: { 
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
  errorTextSmall: { 
    color: '#ef4444', 
    fontSize: 12, 
    marginLeft: 4 
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
  buttonText: { 
    color: '#0c0714', 
    fontSize: 15, 
    fontWeight: '800',
    letterSpacing: 1
  },
  resendButton: { 
    alignItems: 'center', 
    marginTop: 12 
  },
  resendText: { 
    color: '#818cf8', 
    fontWeight: '700' 
  },
  reqContainer: { 
    backgroundColor: 'rgba(22, 15, 38, 0.2)',
    borderColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    gap: 6 
  },
  reqItem: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 6 
  },
  reqText: { 
    fontSize: 12, 
    color: '#64748b' 
  },
  reqTextMet: { 
    color: '#10b981' 
  },
  footer: { 
    marginTop: 20, 
    paddingVertical: 12, 
    alignItems: 'center' 
  },
  footerText: { 
    color: '#64748b', 
    fontSize: 14 
  },
  linkText: { 
    color: '#818cf8', 
    fontWeight: '700' 
  }
});

export default RegisterScreen;
