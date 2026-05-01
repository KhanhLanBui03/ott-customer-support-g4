import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { userApi } from '../api/userApi';
import { useAuth } from '../hooks/useAuth';

const DeleteAccountModal = ({ visible, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const { logout } = useAuth();

  const handleDelete = async () => {
    setLoading(true);
    setError('');
    try {
      await userApi.deleteAccount();
      setIsSuccess(true);
      // Wait 4 seconds before logout
      setTimeout(async () => {
        await logout();
        onClose();
      }, 4000);
    } catch (err) {
      console.error('Delete account failed', err);
      setError(err?.response?.data?.message || 'Có lỗi xảy ra khi xóa tài khoản. Vui lòng thử lại.');
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

          <View style={styles.content}>
            {isSuccess ? (
              <View style={styles.successContainer}>
                <View style={styles.iconCircleGreen}>
                  <MaterialCommunityIcons name="shield-check" size={40} color="#52c41a" />
                </View>
                <Text style={styles.successTitle}>Đã khóa tài khoản thành công!</Text>
                <Text style={styles.successSubtitle}>
                  Cảm ơn bạn đã sử dụng dịch vụ của chúng tôi. Hệ thống sẽ tự động đăng xuất sau 4 giây...
                </Text>
              </View>
            ) : (
              <>
                <View style={styles.iconCircleRed}>
                  <MaterialCommunityIcons name="shield-alert" size={40} color="#ff4d4f" />
                </View>
                
                <Text style={styles.questionText}>Bạn muốn xóa tài khoản?</Text>
                
                <View style={styles.termsBox}>
                  <Text style={styles.termsText}>
                    Cụ thể là khi bạn ấn xác nhận tài khoản của bạn sẽ bị lock trong vòng{' '}
                    <Text style={styles.boldText}>30 ngày</Text>, sau 30 ngày tài khoản của bạn sẽ bị xóa vĩnh viễn.
                  </Text>
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
                    style={[styles.confirmButton, loading && styles.disabledButton]} 
                    onPress={handleDelete}
                    disabled={loading}
                  >
                    {loading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.confirmButtonText}>XÁC NHẬN XÓA</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
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
    padding: 24,
  },
  modalView: {
    width: '100%',
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
  content: {
    padding: 32,
    alignItems: 'center',
  },
  iconCircleRed: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#fff1f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  iconCircleGreen: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#f6ffed',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  questionText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 12,
  },
  termsBox: {
    backgroundColor: '#f9f9f9',
    padding: 16,
    borderRadius: 16,
    marginBottom: 24,
  },
  termsText: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  boldText: {
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  successContainer: {
    alignItems: 'center',
  },
  successTitle: {
    fontSize: 16,
    fontWeight: 'bold',
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
  },
  cancelButton: {
    flex: 1,
    height: 52,
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
    height: 52,
    backgroundColor: '#ff4d4f',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#ff4d4f',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  confirmButtonText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: 1,
  },
  disabledButton: {
    backgroundColor: '#ffccc7',
    elevation: 0,
  },
});

export default DeleteAccountModal;
