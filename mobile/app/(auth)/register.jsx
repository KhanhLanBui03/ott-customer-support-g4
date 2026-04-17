import React, { useState, useEffect } from 'react';
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
 * RegisterScreen (Mobile)
 * User registration with phone number and password - Redux integrated
 */

const RegisterScreen = ({ navigation }) => {
  const { register, loading, error, otpPhone, otpSent } = useAuth();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [localError, setLocalError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Show error alert if Redux error exists
  useEffect(() => {
    if (error) {
      Alert.alert('Registration Failed', error, [{ text: 'OK', onPress: () => {} }]);
    }
  }, [error]);

  // Navigate to OTP when registration succeeds (phoneNumber is stored)
  useEffect(() => {
    if (otpSent && otpPhone) {
      console.log('✓ Registration successful, navigating to OTP');
      navigation.navigate('otp', { phoneNumber: otpPhone });
    }
  }, [otpSent, otpPhone, navigation]);

  const validatePassword = (pwd) => {
    const minLength = pwd.length >= 8;
    const hasUppercase = /[A-Z]/.test(pwd);
    const hasLowercase = /[a-z]/.test(pwd);
    const hasNumber = /[0-9]/.test(pwd);
    const hasSpecial = /[!@#$%^&*]/.test(pwd);

    return {
      minLength,
      hasUppercase,
      hasLowercase,
      hasNumber,
      hasSpecial,
      isValid: minLength && hasUppercase && hasLowercase && hasNumber && hasSpecial,
    };
  };

  const passwordStrength = validatePassword(password);

  const handleRegister = async () => {
    const localPhone = phoneNumber.trim();
    const phoneRegex = /^0\d{9}$/;

    // Validation
    if (!localPhone) {
      setLocalError('Phone number is required');
      return;
    }
    if (!phoneRegex.test(localPhone)) {
      setLocalError('Số điện thoại không hợp lệ (0xxxxxxxxx)');
      return;
    }

    if (!password.trim()) {
      setLocalError('Password is required');
      return;
    }

    if (!passwordStrength.isValid) {
      setLocalError('Password does not meet requirements');
      return;
    }

    if (password !== confirmPassword) {
      setLocalError('Passwords do not match');
      return;
    }

    setLocalError('');

    // Dispatch Redux register action
    register(localPhone, password.trim(), confirmPassword.trim(), 'Mobile User');
  };

  const handleLoginPress = () => {
    navigation.navigate('login');
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
            <Text style={styles.appName}>Chat App</Text>
            <Text style={styles.subtitle}>Create your account</Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            {/* Phone Number Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Số điện thoại</Text>
              <TextInput
                style={styles.input}
                placeholder="0357xxxxxx"
                placeholderTextColor="#999"
                keyboardType="phone-pad"
                editable={!loading}
                value={phoneNumber}
                onChangeText={setPhoneNumber}
              />
            </View>

            {/* Password Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.passwordInputContainer}>
                <TextInput
                  style={styles.passwordInput}
                  placeholder="Create a password"
                  placeholderTextColor="#999"
                  secureTextEntry={!showPassword}
                  editable={!loading}
                  value={password}
                  onChangeText={setPassword}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.toggleButton}
                >
                  <Text>{showPassword ? '👁️' : '👁️‍🗨️'}</Text>
                </TouchableOpacity>
              </View>

              {/* Password Strength Indicator */}
              {password && (
                <View style={styles.strengthContainer}>
                  <View
                    style={[
                      styles.strengthIndicator,
                      passwordStrength.isValid ? styles.strengthValid : styles.strengthInvalid,
                    ]}
                  />
                  <Text style={styles.strengthText}>
                    {!passwordStrength.minLength
                      ? 'At least 8 characters'
                      : !passwordStrength.hasUppercase
                        ? 'Add uppercase letter'
                        : !passwordStrength.hasLowercase
                          ? 'Add lowercase letter'
                          : !passwordStrength.hasNumber
                            ? 'Add number'
                            : !passwordStrength.hasSpecial
                              ? 'Add special character'
                              : 'Strong password'}
                  </Text>
                </View>
              )}
            </View>

            {/* Confirm Password Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Confirm Password</Text>
              <View style={styles.passwordInputContainer}>
                <TextInput
                  style={styles.passwordInput}
                  placeholder="Confirm password"
                  placeholderTextColor="#999"
                  secureTextEntry={!showConfirmPassword}
                  editable={!loading}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                />
                <TouchableOpacity
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  style={styles.toggleButton}
                >
                  <Text>{showConfirmPassword ? '👁️' : '👁️‍🗨️'}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Error Message */}
            {(localError || error) && (
              <Text style={styles.errorText}>{localError || error}</Text>
            )}

            {/* Register Button */}
            <TouchableOpacity
              style={[styles.registerButton, loading && styles.registerButtonDisabled]}
              onPress={handleRegister}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.registerButtonText}>Create Account</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Footer - Login Link */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account?</Text>
            <TouchableOpacity onPress={handleLoginPress}>
              <Text style={styles.loginLink}>Sign In</Text>
            </TouchableOpacity>
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
    fontSize: 32,
    fontWeight: '700',
    color: '#667eea',
    marginBottom: 8,
  },

  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },

  form: {
    flex: 1,
    gap: 16,
  },

  inputGroup: {
    gap: 8,
  },

  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },

  input: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    fontSize: 14,
    color: '#111827',
  },

  passwordInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
  },

  passwordInput: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#111827',
  },

  toggleButton: {
    paddingHorizontal: 12,
    justifyContent: 'center',
  },

  strengthContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },

  strengthIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  strengthValid: {
    backgroundColor: '#10b981',
  },

  strengthInvalid: {
    backgroundColor: '#ef4444',
  },

  strengthText: {
    fontSize: 12,
    color: '#6b7280',
    flex: 1,
  },

  errorText: {
    color: '#ef4444',
    fontSize: 13,
    marginTop: 4,
  },

  registerButton: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: '#667eea',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },

  registerButtonDisabled: {
    opacity: 0.6,
  },

  registerButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },

  footer: {
    alignItems: 'center',
    gap: 8,
    marginTop: 40,
  },

  footerText: {
    fontSize: 14,
    color: '#6b7280',
  },

  loginLink: {
    fontSize: 14,
    fontWeight: '600',
    color: '#667eea',
  },
});

export default RegisterScreen;
