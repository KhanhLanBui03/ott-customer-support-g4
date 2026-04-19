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
 * LoginScreen (Mobile)
 * User login with phone number and password - Redux integrated
 */

const LoginScreen = ({ navigation }) => {
  const { login, loading, error, accessToken } = useAuth();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Show error alert if Redux error exists
  useEffect(() => {
    if (error) {
      Alert.alert('Login Failed', error, [{ text: 'OK', onPress: () => {} }]);
    }
  }, [error]);

  // Auto-navigate on successful login (when accessToken is set)
  useEffect(() => {
    if (accessToken) {
      // Root layout will automatically switch to main app when accessToken exists
      console.log('✓ Login successful, token received');
    }
  }, [accessToken]);

  const handleLogin = async () => {
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

    setLocalError('');

    // Dispatch Redux login action
    login(localPhone, password.trim(), 'mobile-app', 'Mobile App');
  };

  const handleRegisterPress = () => {
    navigation.navigate('register');
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
            <Text style={styles.subtitle}>Connect with friends and family</Text>
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
                  placeholder="Enter your password"
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
            </View>

            {/* Error Message */}
            {(localError || error) && (
              <Text style={styles.errorText}>{localError || error}</Text>
            )}

            {/* Login Button */}
            <TouchableOpacity
              style={[styles.loginButton, loading && styles.loginButtonDisabled]}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.loginButtonText}>Sign In</Text>
              )}
            </TouchableOpacity>

            {/* Forgot Password Link */}
            <TouchableOpacity style={styles.forgotPasswordButton}>
              <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
            </TouchableOpacity>
          </View>

          {/* Footer - Register Link */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Don't have an account?</Text>
            <TouchableOpacity onPress={handleRegisterPress}>
              <Text style={styles.registerLink}>Sign Up</Text>
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
    marginBottom: 60,
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

  errorText: {
    color: '#ef4444',
    fontSize: 13,
    marginTop: 4,
  },

  loginButton: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: '#667eea',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },

  loginButtonDisabled: {
    opacity: 0.6,
  },

  loginButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },

  forgotPasswordButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },

  forgotPasswordText: {
    color: '#667eea',
    fontSize: 14,
    fontWeight: '500',
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

  registerLink: {
    fontSize: 14,
    fontWeight: '600',
    color: '#667eea',
  },
});

export default LoginScreen;
