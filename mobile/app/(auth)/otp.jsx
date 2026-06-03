import React, { useState, useEffect, useRef } from 'react';
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

/**
 * OTPScreen (Mobile)
 * OTP verification for phone-based authentication - Redux integrated
 * Redesigned for F5 Chat with premium dark theme and unified UI
 */

const OTPScreen = ({ navigation, route }) => {
  const { verify, resend, loading, error: authError, accessToken, clearError } = useAuth();
  const phoneNumber = route.params?.phoneNumber;

  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [timeLeft, setTimeLeft] = useState(300); // 5 minutes
  const inputRefs = useRef([]);

  // Clear errors on load
  useEffect(() => {
    clearError();
  }, []);

  // Show error alert if Redux error exists
  useEffect(() => {
    if (authError) {
      Alert.alert('Xác thực thất bại', authError, [{ text: 'OK', onPress: () => {} }]);
    }
  }, [authError]);

  // Auto-navigate on successful OTP verification
  useEffect(() => {
    if (accessToken) {
      console.log('✓ OTP verified successfully');
    }
  }, [accessToken]);

  // Countdown timer for OTP
  useEffect(() => {
    if (timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft]);

  const handleOtpChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-focus next input when digit is entered
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (index, key) => {
    // Handle backspace
    if (key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerifyOtp = () => {
    const otpCode = otp.join('');

    if (otpCode.length !== 6) {
      setError('Vui lòng nhập đủ 6 chữ số');
      return;
    }

    setError('');
    verify(phoneNumber || '', otpCode);
  };

  const handleResendOtp = () => {
    setTimeLeft(300);
    setError('');
    setOtp(['', '', '', '', '', '']);
    inputRefs.current[0]?.focus();
    resend(phoneNumber || '');
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
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
            <Text style={styles.appName}>Xác Thực Số Điện Thoại</Text>
            <Text style={styles.subtitle}>
              Chúng tôi đã gửi mã xác thực đến {phoneNumber}
            </Text>
            <Text style={styles.description}>Vui lòng nhập mã OTP 6 số bên dưới</Text>
          </View>

          {/* OTP Input */}
          <View style={styles.form}>
            <View style={styles.otpContainer}>
              {otp.map((digit, index) => (
                <TextInput
                  key={index}
                  ref={(ref) => (inputRefs.current[index] = ref)}
                  style={[
                    styles.otpInput,
                    {
                      borderColor: digit ? 'rgba(99, 102, 241, 0.5)' : 'rgba(255, 255, 255, 0.08)',
                      backgroundColor: digit ? 'rgba(22, 15, 38, 0.5)' : 'rgba(22, 15, 38, 0.3)',
                    },
                  ]}
                  placeholder="0"
                  placeholderTextColor="#475569"
                  keyboardType="number-pad"
                  maxLength={1}
                  editable={!loading}
                  value={digit}
                  onChangeText={(value) => handleOtpChange(index, value)}
                  onKeyPress={({ nativeEvent }) => handleKeyPress(index, nativeEvent.key)}
                />
              ))}
            </View>

            {/* Error Message */}
            {(error || authError) && (
              <View style={styles.errorContainer}>
                <MaterialCommunityIcons name="alert-circle-outline" size={18} color="#ef4444" />
                <Text style={styles.errorText}>{error || authError}</Text>
              </View>
            )}

            {/* Verify Button */}
            <TouchableOpacity
              style={[styles.verifyButton, loading && styles.verifyButtonDisabled]}
              onPress={handleVerifyOtp}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#0c0714" />
              ) : (
                <Text style={styles.verifyButtonText}>XÁC THỰC</Text>
              )}
            </TouchableOpacity>

            {/* Resend OTP */}
            <View style={styles.resendContainer}>
              <Text style={styles.resendText}>
                {timeLeft > 0 ? "Chưa nhận được mã xác thực?" : 'Mã xác thực đã hết hạn'}
              </Text>
              <TouchableOpacity
                onPress={handleResendOtp}
                disabled={timeLeft > 0 || loading}
                activeOpacity={0.7}
                style={[timeLeft > 0 && styles.resendDisabled]}
              >
                <Text style={[styles.resendLink, timeLeft > 0 && styles.resendLinkDisabled]}>
                  {timeLeft > 0 ? `Gửi lại sau ${formatTime(timeLeft)}` : 'Gửi lại mã ngay'}
                </Text>
              </TouchableOpacity>
            </View>
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
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 32,
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
    marginBottom: 32,
  },
  appName: {
    fontSize: 24,
    fontWeight: '900',
    color: '#ffffff',
    marginBottom: 8,
    letterSpacing: -0.5
  },
  subtitle: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 8,
  },
  description: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
  },
  form: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderWidth: 1, 
    borderColor: 'rgba(255, 255, 255, 0.06)', 
    borderRadius: 32, 
    padding: 24, 
    paddingBottom: 28,
    gap: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 15,
    elevation: 5,
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
  },
  otpInput: {
    width: 44,
    height: 52,
    borderWidth: 1,
    borderRadius: 12,
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    color: '#ffffff',
    paddingHorizontal: 0,
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
    flex: 1,
    textAlign: 'center'
  },
  verifyButton: {
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
  verifyButtonDisabled: {
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    elevation: 0
  },
  verifyButtonText: {
    color: '#0c0714',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 1
  },
  resendContainer: {
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
  },
  resendText: {
    fontSize: 13,
    color: '#64748b',
  },
  resendLink: {
    fontSize: 14,
    fontWeight: '700',
    color: '#818cf8',
  },
  resendLinkDisabled: {
    color: '#475569',
  },
  resendDisabled: {
    opacity: 0.6,
  },
});

export default OTPScreen;
