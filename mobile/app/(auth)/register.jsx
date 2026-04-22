import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { useAuth } from '../../src/hooks/useAuth';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

const RegisterScreen = () => {
  const router = useRouter();
  const { register, sendOtp, verify, checkPhone, loading, error: authError } = useAuth();

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

  // Mật khẩu requirements
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

    try {
      await sendOtp(email, 'REGISTRATION');
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
      return true; // Tạm thời cho qua nếu API lỗi
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

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <Text style={styles.title}>Đăng Ký</Text>
            <Text style={styles.subtitle}>
              {step === 'verify-email' ? 'Xác thực Gmail để bắt đầu' : 'Hoàn thiện thông tin cá nhân'}
            </Text>
          </View>

          {step === 'verify-email' ? (
            <View style={styles.form}>
              <View style={styles.inputWrapper}>
                <MaterialCommunityIcons name="email-outline" size={20} color="#666" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Nhập Gmail của bạn"
                  value={formData.email}
                  onChangeText={(text) => setFormData({...formData, email: text})}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  editable={!verificationSent}
                />
              </View>

              {verificationSent && (
                <View style={styles.inputWrapper}>
                  <MaterialCommunityIcons name="shield-check-outline" size={20} color="#666" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Nhập mã OTP"
                    value={otpCode}
                    onChangeText={setOtpCode}
                    keyboardType="number-pad"
                    maxLength={6}
                  />
                </View>
              )}

              {localError ? <Text style={styles.errorText}>{localError}</Text> : null}

              <TouchableOpacity
                style={[styles.primaryButton, loading && { opacity: 0.7 }]}
                onPress={verificationSent ? handleVerifyOtp : handleSendOtp}
                disabled={loading}
              >
                {loading ? <ActivityIndicator color="#fff" /> : (
                  <Text style={styles.buttonText}>{verificationSent ? 'Xác thực OTP' : 'Gửi mã xác thực'}</Text>
                )}
              </TouchableOpacity>

              {verificationSent && (
                <TouchableOpacity onPress={handleSendOtp} style={styles.resendButton}>
                  <Text style={styles.resendText}>Gửi lại mã</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <View style={styles.form}>
               <View style={styles.row}>
                <View style={[styles.inputWrapper, { flex: 1, marginRight: 8 }]}>
                  <TextInput
                    style={styles.input}
                    placeholder="Họ"
                    value={formData.lastName}
                    onChangeText={(text) => setFormData({...formData, lastName: text})}
                  />
                </View>
                <View style={[styles.inputWrapper, { flex: 1 }]}>
                  <TextInput
                    style={styles.input}
                    placeholder="Tên"
                    value={formData.firstName}
                    onChangeText={(text) => setFormData({...formData, firstName: text})}
                  />
                </View>
              </View>

              <View style={[styles.inputWrapper, phoneError ? styles.inputError : null]}>
                <MaterialCommunityIcons name="phone-outline" size={20} color="#666" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Số điện thoại (0XXXXXXXXX)"
                  value={formData.phoneNumber}
                  onChangeText={(text) => {
                    setFormData({...formData, phoneNumber: text});
                    setPhoneError('');
                  }}
                  onBlur={() => validatePhone(formData.phoneNumber)}
                  keyboardType="phone-pad"
                />
              </View>
              {phoneError ? <Text style={styles.errorTextSmall}>{phoneError}</Text> : null}

              <View style={styles.inputWrapper}>
                <MaterialCommunityIcons name="lock-outline" size={20} color="#666" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Mật khẩu"
                  secureTextEntry={!showPassword}
                  value={formData.password}
                  onChangeText={(text) => setFormData({...formData, password: text})}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                  <MaterialCommunityIcons name={showPassword ? "eye-off" : "eye"} size={20} color="#666" />
                </TouchableOpacity>
              </View>

              <View style={styles.reqContainer}>
                <Requirement met={passwordChecks.minLength} text="Ít nhất 8 ký tự" />
                <Requirement met={passwordChecks.upper && passwordChecks.lower} text="Chứa chữ hoa & chữ thường" />
                <Requirement met={passwordChecks.number} text="Chứa chữ số" />
                <Requirement met={passwordChecks.special} text="Chứa ký tự đặc biệt (@$!%*?&)" />
              </View>

              <View style={styles.inputWrapper}>
                <MaterialCommunityIcons name="lock-check-outline" size={20} color="#666" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Xác nhận mật khẩu"
                  secureTextEntry={!showConfirmPassword}
                  value={formData.confirmPassword}
                  onChangeText={(text) => setFormData({...formData, confirmPassword: text})}
                />
                <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                  <MaterialCommunityIcons name={showConfirmPassword ? "eye-off" : "eye"} size={20} color="#666" />
                </TouchableOpacity>
              </View>

              {localError ? <Text style={styles.errorText}>{localError}</Text> : null}

              <TouchableOpacity style={styles.primaryButton} onPress={handleRegister} disabled={loading}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Tạo tài khoản</Text>}
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity onPress={() => router.push('/login')} style={styles.footer}>
            <Text style={styles.footerText}>Đã có tài khoản? <Text style={styles.linkText}>Đăng nhập</Text></Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const Requirement = ({ met, text }) => (
  <View style={styles.reqItem}>
    <MaterialCommunityIcons name={met ? "check-circle" : "circle-outline"} size={14} color={met ? "#4CAF50" : "#999"} />
    <Text style={[styles.reqText, met && styles.reqTextMet]}>{text}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  scrollContent: { padding: 24, flexGrow: 1 },
  header: { marginBottom: 32, marginTop: 20 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#1a1a1a' },
  subtitle: { fontSize: 16, color: '#666', marginTop: 8 },
  form: { gap: 16 },
  row: { flexDirection: 'row', gap: 12 },
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
  inputError: { borderColor: '#ff4d4f', backgroundColor: '#fff2f0' },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, fontSize: 16, color: '#1a1a1a' },
  errorText: { color: '#ff4d4f', fontSize: 14, textAlign: 'center' },
  errorTextSmall: { color: '#ff4d4f', fontSize: 12, marginLeft: 4 },
  primaryButton: {
    backgroundColor: '#007AFF',
    height: 56,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  resendButton: { alignItems: 'center', marginTop: 12 },
  resendText: { color: '#007AFF', fontWeight: '600' },
  reqContainer: { paddingHorizontal: 4, gap: 4 },
  reqItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  reqText: { fontSize: 12, color: '#999' },
  reqTextMet: { color: '#4CAF50' },
  footer: { marginTop: 'auto', paddingVertical: 20, alignItems: 'center' },
  footerText: { color: '#666', fontSize: 14 },
  linkText: { color: '#007AFF', fontWeight: 'bold' }
});

export default RegisterScreen;
