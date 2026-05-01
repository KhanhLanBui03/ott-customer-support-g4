import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { authApi } from '../../api/authApi';

const AccountRestoreModal = ({ visible, email, lockedAt, onClose }) => {
  const [step, setStep] = useState(1); // 1: Info, 2: Phone, 3: OTP, 4: New Password
  const [loading, setLoading] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [timer, setTimer] = useState(0);
  const [canResend, setCanResend] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Calculate days
  const lockedDate = new Date(lockedAt);
  const now = new Date();
  const diffTime = Math.abs(now - lockedDate);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  const formattedDate = lockedDate.toLocaleDateString('vi-VN');

  useEffect(() => {
    let interval;
    if (timer > 0) {
      interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
    } else {
      setCanResend(true);
    }
    return () => clearInterval(interval);
  }, [timer]);

  const handleStartRestore = () => setStep(2);

  const handleVerifyPhone = async () => {
    setError('');
    if (!phoneNumber.trim()) {
      setError('Vui lòng nhập số điện thoại');
      return;
    }
    setLoading(true);
    try {
      await authApi.restoreVerifyPhone({ email, phoneNumber });
      await handleSendOtp();
      setStep(3);
    } catch (err) {
      setError(err.response?.data?.message || 'Số điện thoại không đúng');
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async () => {
    setError('');
    try {
      await authApi.restoreSendOtp(email);
      setTimer(120); // 2 minutes
      setCanResend(false);
      setSuccess('Mã OTP đã được gửi tới email');
      setTimeout(() => setSuccess(''), 5000);
    } catch (err) {
      setError('Không thể gửi mã OTP');
    }
  };

  const handleVerifyOtp = async () => {
    setError('');
    if (!otp.trim()) {
      setError('Vui lòng nhập mã OTP');
      return;
    }
    setLoading(true);
    try {
      await authApi.restoreVerifyOtp({ email, otp });
      setStep(4);
    } catch (err) {
      setError(err.response?.data?.message || 'Mã OTP không hợp lệ');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    setError('');
    if (!newPassword.trim()) {
      setError('Vui lòng nhập mật khẩu mới');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp');
      return;
    }
    // Simple password check (mirroring web/backend requirements)
    if (newPassword.length < 8) {
      setError('Mật khẩu phải từ 8 ký tự');
      return;
    }

    setLoading(true);
    try {
      await authApi.restoreResetPassword({
        email,
        otp,
        newPassword,
        confirmPassword
      });
      setSuccess('Khôi phục tài khoản thành công!');
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err) {
      setError(err.response?.data?.message || 'Lỗi đặt lại mật khẩu');
    } finally {
      setLoading(false);
    }
  };

  const renderContent = () => {
    switch (step) {
      case 1:
        return (
          <View style={styles.stepContainer}>
            <View style={styles.iconCircleRed}>
              <MaterialCommunityIcons name="alert-circle-outline" size={40} color="#ff4d4f" />
            </View>
            <Text style={styles.title}>Tài khoản đang chờ xóa</Text>
            <Text style={styles.description}>
              Tài khoản này đã yêu cầu xóa được <Text style={styles.boldRed}>{diffDays}</Text>/30 ngày, 
              bắt đầu từ ngày <Text style={styles.bold}>{formattedDate}</Text>.
            </Text>
            <Text style={styles.smallInfo}>BẠN CÓ MUỐN KHÔI PHỤC LẠI KHÔNG?</Text>
            
            <TouchableOpacity style={styles.primaryButton} onPress={handleStartRestore}>
              <Text style={styles.primaryButtonText}>XÁC NHẬN KHÔI PHỤC</Text>
              <MaterialCommunityIcons name="arrow-right" size={20} color="#fff" />
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.secondaryButton} onPress={onClose}>
              <Text style={styles.secondaryButtonText}>HỦY BỎ</Text>
            </TouchableOpacity>
          </View>
        );

      case 2:
        return (
          <View style={styles.stepContainer}>
            <MaterialCommunityIcons name="cellphone-check" size={48} color="#007AFF" />
            <Text style={styles.title}>Xác minh chính chủ</Text>
            <Text style={styles.smallInfo}>NHẬP SỐ ĐIỆN THOẠI ĐĂNG KÝ</Text>
            
            <View style={styles.inputContainer}>
              <MaterialCommunityIcons name="phone-outline" size={20} color="#666" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Số điện thoại..."
                keyboardType="phone-pad"
                value={phoneNumber}
                onChangeText={setPhoneNumber}
              />
            </View>
            
            <TouchableOpacity 
              style={[styles.primaryButton, loading && styles.disabledButton]} 
              onPress={handleVerifyPhone}
              disabled={loading}
            >
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>TIẾP TỤC</Text>}
            </TouchableOpacity>
          </View>
        );

      case 3:
        return (
          <View style={styles.stepContainer}>
            <MaterialCommunityIcons name="email-fast-outline" size={48} color="#007AFF" />
            <Text style={styles.title}>Nhập mã OTP</Text>
            <Text style={styles.description}>Mã đã được gửi tới email: {email}</Text>
            
            <TextInput
              style={styles.otpInput}
              placeholder="000000"
              keyboardType="number-pad"
              maxLength={6}
              value={otp}
              onChangeText={setOtp}
            />
            
            <TouchableOpacity 
              onPress={handleSendOtp} 
              disabled={!canResend}
              style={styles.resendContainer}
            >
              <Text style={[styles.resendText, !canResend && styles.resendDisabled]}>
                {timer > 0 ? `Gửi lại mã sau ${timer}s` : 'GỬI LẠI MÃ NGAY'}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.primaryButton, loading && styles.disabledButton]} 
              onPress={handleVerifyOtp}
              disabled={loading}
            >
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>XÁC THỰC OTP</Text>}
            </TouchableOpacity>
          </View>
        );

      case 4:
        return (
          <View style={styles.stepContainer}>
            <MaterialCommunityIcons name="lock-reset" size={48} color="#007AFF" />
            <Text style={styles.title}>Đặt mật khẩu mới</Text>
            <Text style={styles.description}>Bước cuối cùng để khôi phục tài khoản</Text>
            
            <View style={styles.inputContainer}>
              <MaterialCommunityIcons name="lock-outline" size={20} color="#666" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Mật khẩu mới..."
                secureTextEntry
                value={newPassword}
                onChangeText={setNewPassword}
              />
            </View>
            
            <View style={styles.inputContainer}>
              <MaterialCommunityIcons name="lock-check-outline" size={20} color="#666" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Xác nhận mật khẩu..."
                secureTextEntry
                value={confirmPassword}
                onChangeText={setConfirmPassword}
              />
            </View>
            
            <TouchableOpacity 
              style={[styles.primaryButton, loading && styles.disabledButton]} 
              onPress={handleResetPassword}
              disabled={loading}
            >
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>KHÔI PHỤC HOÀN TẤT</Text>}
            </TouchableOpacity>
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.centeredView}
        >
          <View style={styles.modalView}>
            {/* Progress Bar */}
            <View style={styles.progressBackground}>
              <View style={[styles.progressBar, { width: `${(step / 4) * 100}%` }]} />
            </View>

            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <MaterialCommunityIcons name="close" size={24} color="#666" />
            </TouchableOpacity>

            <ScrollView showsVerticalScrollIndicator={false}>
              {error ? (
                <View style={styles.errorBox}>
                  <MaterialCommunityIcons name="alert-circle" size={14} color="#ff4d4f" />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              {success ? (
                <View style={styles.successBox}>
                  <MaterialCommunityIcons name="check-circle" size={14} color="#52c41a" />
                  <Text style={styles.successText}>{success}</Text>
                </View>
              ) : null}

              {renderContent()}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  centeredView: {
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalView: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 32,
    padding: 32,
    paddingTop: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
    position: 'relative',
    overflow: 'hidden',
  },
  progressBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: '#f0f0f0',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#007AFF',
  },
  closeButton: {
    position: 'absolute',
    top: 20,
    right: 20,
    zIndex: 10,
  },
  stepContainer: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  iconCircleRed: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#fff1f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: '#1a1a1a',
    marginBottom: 12,
    textAlign: 'center',
  },
  description: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 16,
  },
  boldRed: { color: '#ff4d4f', fontWeight: 'bold' },
  bold: { color: '#1a1a1a', fontWeight: 'bold' },
  smallInfo: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#999',
    letterSpacing: 2,
    marginBottom: 24,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 56,
    marginBottom: 16,
    width: '100%',
  },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, fontSize: 16, color: '#1a1a1a' },
  otpInput: {
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: 10,
    color: '#007AFF',
    textAlign: 'center',
    width: '100%',
    height: 80,
    backgroundColor: '#f0f7ff',
    borderRadius: 20,
    marginBottom: 16,
  },
  resendContainer: {
    paddingVertical: 12,
    marginBottom: 16,
  },
  resendText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#007AFF',
    letterSpacing: 1,
  },
  resendDisabled: { color: '#ccc' },
  primaryButton: {
    width: '100%',
    height: 56,
    backgroundColor: '#007AFF',
    borderRadius: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
  },
  secondaryButton: {
    width: '100%',
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  secondaryButtonText: {
    color: '#999',
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  disabledButton: { backgroundColor: '#ccc' },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff1f0',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ffccc7',
    marginBottom: 16,
  },
  errorText: { color: '#ff4d4f', fontSize: 12, fontWeight: 'bold' },
  successBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f6ffed',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#b7eb8f',
    marginBottom: 16,
  },
  successText: { color: '#52c41a', fontSize: 12, fontWeight: 'bold' },
});

export default AccountRestoreModal;
