import React, { useState, useEffect, useRef } from 'react';
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

/**
 * OTPScreen (Mobile)
 * OTP verification for phone-based authentication - Redux integrated
 */

const OTPScreen = ({ navigation, route }) => {
  const { verify, resend, loading, error: authError, accessToken } = useAuth();
  const phoneNumber = route.params?.phoneNumber;

  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [timeLeft, setTimeLeft] = useState(300); // 5 minutes
  const inputRefs = useRef([]);

  // Show error alert if Redux error exists
  useEffect(() => {
    if (authError) {
      Alert.alert('Verification Failed', authError, [{ text: 'OK', onPress: () => {} }]);
    }
  }, [authError]);

  // Auto-navigate on successful OTP verification
  useEffect(() => {
    if (accessToken) {
      console.log('✓ OTP verified successfully');
      // Root layout will automatically switch to main app
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
    // Only allow digits
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
      setError('Please enter all 6 digits');
      return;
    }

    setError('');

    // Dispatch Redux OTP verification
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
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.appName}>Verify Your Phone</Text>
            <Text style={styles.subtitle}>
              We sent a code to {phoneNumber}
            </Text>
            <Text style={styles.description}>Enter the 6-digit code below</Text>
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
                      borderColor: digit ? '#667eea' : '#e5e7eb',
                      backgroundColor: digit ? '#f0f4ff' : '#fff',
                    },
                  ]}
                  placeholder="0"
                  placeholderTextColor="#999"
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
              <Text style={styles.errorText}>{error || authError}</Text>
            )}

            {/* Verify Button */}
            <TouchableOpacity
              style={[styles.verifyButton, loading && styles.verifyButtonDisabled]}
              onPress={handleVerifyOtp}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.verifyButtonText}>Verify OTP</Text>
              )}
            </TouchableOpacity>

            {/* Resend OTP */}
            <View style={styles.resendContainer}>
              <Text style={styles.resendText}>
                {timeLeft > 0 ? "Didn't receive the code?" : 'Code expired'}
              </Text>
              <TouchableOpacity
                onPress={handleResendOtp}
                disabled={timeLeft > 0 || loading}
                style={[timeLeft > 0 && styles.resendDisabled]}
              >
                <Text style={[styles.resendLink, timeLeft > 0 && styles.resendLinkDisabled]}>
                  {timeLeft > 0 ? `Resend in ${formatTime(timeLeft)}` : 'Resend Code'}
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
    backgroundColor: '#fff',
  },

  scrollContent: {
    flexGrow: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 24,
  },

  header: {
    alignItems: 'center',
    marginTop: 40,
    marginBottom: 40,
  },

  appName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },

  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 8,
  },

  description: {
    fontSize: 13,
    color: '#9ca3af',
    textAlign: 'center',
  },

  form: {
    flex: 1,
    gap: 20,
  },

  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },

  otpInput: {
    width: 50,
    height: 50,
    borderWidth: 2,
    borderRadius: 8,
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
    color: '#111827',
    paddingHorizontal: 0,
  },

  errorText: {
    color: '#ef4444',
    fontSize: 13,
    textAlign: 'center',
    marginHorizontal: 20,
  },

  verifyButton: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: '#667eea',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },

  verifyButtonDisabled: {
    opacity: 0.6,
  },

  verifyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },

  resendContainer: {
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
  },

  resendText: {
    fontSize: 13,
    color: '#6b7280',
  },

  resendLink: {
    fontSize: 13,
    fontWeight: '600',
    color: '#667eea',
  },

  resendLinkDisabled: {
    color: '#d1d5db',
  },

  resendDisabled: {
    opacity: 0.6,
  },
});

export default OTPScreen;
