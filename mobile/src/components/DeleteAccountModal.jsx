import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { userApi } from '../api/userApi';
import { useAuth } from '../hooks/useAuth';

const DeleteAccountModal = ({ visible, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [password, setPassword] = useState('');
  const [deleteType, setDeleteType] = useState('SOFT'); // 'SOFT' or 'HARD'
  const [isOtpRequired, setIsOtpRequired] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [timer, setTimer] = useState(0);
  const [canResend, setCanResend] = useState(false);
  const { logout } = useAuth();

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

  const handleDelete = async () => {
    if (!password.trim()) {
      setError('Vui lòng nhập mật khẩu để xác minh chính chủ.');
      return;
    }
    if (isOtpRequired && !otpCode.trim()) {
      setError('Vui lòng nhập mã OTP xác thực.');
      return;
    }
    
    setLoading(true);
    setError('');
    try {
      const response = await userApi.deleteAccount({ 
        password, 
        deleteType, 
        otpCode: isOtpRequired ? otpCode : null 
      });

      if (response?.data === 'OTP_REQUIRED') {
        setIsOtpRequired(true);
        setTimer(120); // 2 minutes countdown
        setCanResend(false);
        setOtpCode('');
        setError('');
      } else {
        setIsSuccess(true);
        setTimeout(async () => {
          await logout();
          onClose();
        }, 4000);
      }
    } catch (err) {
      console.error('Delete account failed', err);
      setError(err?.response?.data?.message || 'Lỗi xử lý xóa tài khoản.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await userApi.deleteAccount({ password, deleteType });
      if (response?.data === 'OTP_REQUIRED') {
        setTimer(120);
        setCanResend(false);
        setOtpCode('');
        setError('');
      }
    } catch (err) {
      setError(err?.response?.data?.message || 'Không thể gửi lại mã OTP. Vui lòng thử lại sau.');
    } finally {
      setLoading(false);
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
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <MaterialCommunityIcons name="alert-triangle" size={20} color="#ff4d4f" />
                <Text style={styles.headerTitle}>XÓA TÀI KHOẢN</Text>
              </View>
              <TouchableOpacity onPress={onClose} disabled={loading}>
                <MaterialCommunityIcons name="close" size={24} color="#999" />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
              {isSuccess ? (
                <View style={styles.successContainer}>
                  <View style={styles.iconCircleGreen}>
                    <MaterialCommunityIcons name="shield-check" size={40} color="#52c41a" />
                  </View>
                  <Text style={styles.successTitle}>
                    {deleteType === 'SOFT' 
                      ? 'Đã tạm khóa tài khoản thành công!' 
                      : 'Tài khoản đã được xóa vĩnh viễn!'}
                  </Text>
                  <Text style={styles.successSubtitle}>
                    {deleteType === 'SOFT'
                      ? 'Tài khoản của bạn đã tạm thời bị ẩn. Bạn có 30 ngày để đăng nhập lại và khôi phục. Hệ thống đang đăng xuất...'
                      : 'Dữ liệu cá nhân của bạn đã được ẩn danh hóa. Hệ thống đang đăng xuất...'}
                  </Text>
                </View>
              ) : isOtpRequired ? (
                <View style={styles.otpContainer}>
                  <View style={styles.iconCircleRed}>
                    <MaterialCommunityIcons name="shield-alert" size={40} color="#ff4d4f" />
                  </View>
                  
                  <Text style={styles.otpTitle}>XÁC THỰC OTP CUỐI CÙNG</Text>
                  <View style={styles.otpWarningBox}>
                    <Text style={styles.otpWarningText}>
                      CẢNH BÁO: Đây là bước xác thực cuối cùng. Khi bạn nhập OTP và xác nhận, tài khoản của bạn sẽ bị xóa vĩnh viễn lập tức và không thể khôi phục!
                    </Text>
                  </View>

                  <Text style={styles.sectionLabel}>Nhập mã OTP 6 số gửi tới email</Text>
                  <TextInput
                    style={styles.otpInput}
                    placeholder="000000"
                    keyboardType="number-pad"
                    maxLength={6}
                    value={otpCode}
                    onChangeText={setOtpCode}
                  />

                  <TouchableOpacity 
                    onPress={handleResendOtp} 
                    disabled={!canResend || loading}
                    style={styles.resendContainer}
                  >
                    <Text style={[styles.resendText, !canResend && styles.resendDisabled]}>
                      {timer > 0 ? `Gửi lại mã sau ${timer}s` : 'GỬI LẠI MÃ NGAY'}
                    </Text>
                  </TouchableOpacity>

                  {error ? (
                    <View style={styles.errorBox}>
                      <Text style={styles.errorText}>{error}</Text>
                    </View>
                  ) : null}

                  <View style={styles.buttonGroup}>
                    <TouchableOpacity 
                      style={styles.cancelButton} 
                      onPress={() => { setIsOtpRequired(false); setOtpCode(''); setError(''); }}
                      disabled={loading}
                    >
                      <Text style={styles.cancelButtonText}>QUAY LẠI</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                      style={[styles.confirmButton, loading && styles.disabledButton]} 
                      onPress={handleDelete}
                      disabled={loading}
                    >
                      {loading ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <Text style={styles.confirmButtonText}>XÁC THỰC</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View style={styles.formContainer}>
                  {/* Select type */}
                  <Text style={styles.sectionLabel}>CHỌN HÌNH THỨC XÓA</Text>
                  <View style={styles.optionsGrid}>
                    <TouchableOpacity
                      style={[
                        styles.optionBox,
                        deleteType === 'SOFT' && styles.optionBoxActiveSoft
                      ]}
                      onPress={() => { setDeleteType('SOFT'); setError(''); }}
                    >
                      <Text style={[styles.optionTitle, deleteType === 'SOFT' && styles.optionTitleActiveSoft]}>Tạm khóa 30 ngày</Text>
                      <Text style={[styles.optionDesc, deleteType === 'SOFT' && styles.optionDescActiveSoft]}>Có thể khôi phục</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.optionBox,
                        deleteType === 'HARD' && styles.optionBoxActiveHard
                      ]}
                      onPress={() => { setDeleteType('HARD'); setError(''); }}
                    >
                      <Text style={[styles.optionTitle, deleteType === 'HARD' && styles.optionTitleActiveHard]}>Xóa vĩnh viễn ngay</Text>
                      <Text style={[styles.optionDesc, deleteType === 'HARD' && styles.optionDescActiveHard]}>Không thể khôi phục</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Warning description */}
                  <View style={[
                    styles.warningDescBox,
                    deleteType === 'HARD' && styles.warningDescBoxHard
                  ]}>
                    <Text style={[
                      styles.warningDescText,
                      deleteType === 'HARD' && styles.warningDescTextHard
                    ]}>
                      {deleteType === 'SOFT' 
                        ? 'Tài khoản của bạn sẽ được ẩn ngay lập tức. Bạn có 30 ngày để đăng nhập lại hoặc click vào link trong email để khôi phục tài khoản. Sau 30 ngày tài khoản sẽ bị ẩn danh hóa vĩnh viễn.'
                        : 'CẢNH BÁO: Tài khoản và toàn bộ thông tin cá nhân của bạn sẽ bị ẩn danh hóa vĩnh viễn ngay lập tức. Mọi liên kết sẽ bị hủy bỏ và không thể khôi phục dưới bất kỳ hình thức nào.'
                      }
                    </Text>
                  </View>

                  {/* Password confirm */}
                  <Text style={styles.sectionLabel}>XÁC THỰC MẬT KHẨU</Text>
                  <View style={styles.inputContainer}>
                    <MaterialCommunityIcons name="lock-outline" size={20} color="#666" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Nhập mật khẩu xác nhận..."
                      secureTextEntry
                      value={password}
                      onChangeText={setPassword}
                    />
                  </View>

                  {error ? (
                    <View style={styles.errorBox}>
                      <Text style={styles.errorText}>{error}</Text>
                    </View>
                  ) : null}

                  <View style={styles.buttonGroup}>
                    <TouchableOpacity 
                      style={styles.cancelButton} 
                      onPress={onClose}
                      disabled={loading}
                    >
                      <Text style={styles.cancelButtonText}>HỦY</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                      style={[
                        styles.confirmButton, 
                        deleteType === 'HARD' && styles.confirmButtonHard,
                        loading && styles.disabledButton
                      ]} 
                      onPress={handleDelete}
                      disabled={loading}
                    >
                      {loading ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <Text style={styles.confirmButtonText}>XÁC NHẬN</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              )}
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
    maxHeight: '90%',
    backgroundColor: '#fff',
    borderRadius: 32,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  header: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: '#ff4d4f',
    letterSpacing: 2,
  },
  scrollContent: {
    padding: 24,
    paddingTop: 16,
  },
  successContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  iconCircleGreen: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#f6ffed',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  successTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#52c41a',
    marginBottom: 12,
    textAlign: 'center',
  },
  successSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
  },
  otpContainer: {
    alignItems: 'center',
    width: '100%',
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
  otpTitle: {
    fontSize: 16,
    fontWeight: '950',
    color: '#ff4d4f',
    marginBottom: 12,
    textAlign: 'center',
  },
  otpWarningBox: {
    backgroundColor: '#fff1f0',
    borderColor: '#ffccc7',
    borderWidth: 1,
    padding: 16,
    borderRadius: 16,
    marginBottom: 20,
    width: '100%',
  },
  otpWarningText: {
    fontSize: 12,
    color: '#ff4d4f',
    lineHeight: 18,
    textAlign: 'center',
    fontWeight: 'bold',
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#999',
    letterSpacing: 1.5,
    marginBottom: 12,
    alignSelf: 'flex-start',
    width: '100%',
  },
  otpInput: {
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: 10,
    color: '#ff4d4f',
    textAlign: 'center',
    width: '100%',
    height: 72,
    backgroundColor: '#fff1f0',
    borderRadius: 20,
    marginBottom: 8,
  },
  resendContainer: {
    paddingVertical: 8,
    marginBottom: 16,
  },
  resendText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#007AFF',
    letterSpacing: 1,
  },
  resendDisabled: {
    color: '#ccc',
  },
  formContainer: {
    width: '100%',
  },
  optionsGrid: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    marginBottom: 16,
  },
  optionBox: {
    flex: 1,
    padding: 16,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#f0f0f0',
    backgroundColor: '#f9f9f9',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 88,
  },
  optionBoxActiveSoft: {
    borderColor: '#007AFF',
    backgroundColor: '#f0f7ff',
  },
  optionBoxActiveHard: {
    borderColor: '#ff4d4f',
    backgroundColor: '#fff1f0',
  },
  optionTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#666',
    textAlign: 'center',
    marginBottom: 4,
  },
  optionTitleActiveSoft: {
    color: '#007AFF',
  },
  optionTitleActiveHard: {
    color: '#ff4d4f',
  },
  optionDesc: {
    fontSize: 9,
    color: '#999',
    textAlign: 'center',
  },
  optionDescActiveSoft: {
    color: '#007AFF',
    opacity: 0.8,
  },
  optionDescActiveHard: {
    color: '#ff4d4f',
    opacity: 0.8,
  },
  warningDescBox: {
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
    width: '100%',
    marginBottom: 16,
  },
  warningDescBoxHard: {
    borderColor: 'rgba(239, 68, 68, 0.2)',
    backgroundColor: 'rgba(239, 68, 68, 0.05)',
  },
  warningDescText: {
    fontSize: 12,
    color: '#666',
    lineHeight: 18,
  },
  warningDescTextHard: {
    color: '#ef4444',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 56,
    width: '100%',
    marginBottom: 16,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#1a1a1a',
  },
  errorBox: {
    padding: 12,
    backgroundColor: '#fff1f0',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ffccc7',
    marginBottom: 16,
    width: '100%',
  },
  errorText: {
    color: '#ff4d4f',
    fontSize: 12,
    textAlign: 'center',
    fontWeight: 'bold',
  },
  buttonGroup: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    marginTop: 8,
  },
  cancelButton: {
    flex: 1,
    height: 56,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#666',
    letterSpacing: 1,
  },
  confirmButton: {
    flex: 1,
    height: 56,
    backgroundColor: '#007AFF',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  confirmButtonHard: {
    backgroundColor: '#ff4d4f',
    shadowColor: '#ff4d4f',
  },
  confirmButtonText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: 1,
  },
  disabledButton: {
    backgroundColor: '#ccc',
    shadowOpacity: 0,
    elevation: 0,
  },
});

export default DeleteAccountModal;
