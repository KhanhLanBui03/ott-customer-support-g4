import React from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { MaterialIcons, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

const PermissionModal = ({ visible, onClose, onConfirm, type }) => {
  const config = {
    camera: {
      title: 'Quyền truy cập Máy ảnh',
      description: 'Cho phép ứng dụng sử dụng máy ảnh để bạn có thể chụp ảnh và quay video gửi trực tiếp cho bạn bè.',
      icon: <MaterialIcons name="photo-camera" size={40} color="#6366f1" />,
      color: '#6366f1'
    },
    gallery: {
      title: 'Quyền truy cập Thư viện',
      description: 'Cho phép ứng dụng truy cập thư viện ảnh để bạn có thể chọn và gửi những hình ảnh, video đã lưu.',
      icon: <MaterialIcons name="photo-library" size={40} color="#10b981" />,
      color: '#10b981'
    },
    mic: {
      title: 'Quyền truy cập Micro',
      description: 'Chúng tôi cần quyền sử dụng micro để bạn có thể ghi âm và gửi tin nhắn thoại cho mọi người.',
      icon: <MaterialCommunityIcons name="microphone" size={40} color="#ef4444" />,
      color: '#ef4444'
    },
    file: {
      title: 'Quyền truy cập Tệp',
      description: 'Cho phép ứng dụng truy cập bộ nhớ để bạn có thể gửi các tệp tài liệu, tài liệu đính kèm.',
      icon: <MaterialIcons name="insert-drive-file" size={40} color="#f59e0b" />,
      color: '#f59e0b'
    }
  };

  const current = config[type] || config.camera;

  if (!visible) return null;

  return (
    <View style={styles.overlay}>
      <View style={styles.container}>
        <View style={[styles.iconContainer, { backgroundColor: `${current.color}15` }]}>
          {current.icon}
        </View>
        
        <Text style={styles.title}>{current.title}</Text>
        <Text style={styles.description}>{current.description}</Text>
        
        <View style={styles.footer}>
          <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelText}>Để sau</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.confirmBtn, { backgroundColor: current.color }]} 
            onPress={onConfirm}
          >
            <Text style={styles.confirmText}>Cấp quyền</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: -1000, // Cover the whole screen upwards from bottom
    bottom: -100, // Cover downwards
    left: -20,
    right: -20,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    zIndex: 9999,
  },
  container: {
    backgroundColor: '#fff',
    borderRadius: 32,
    padding: 24,
    width: '100%',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1e293b',
    marginBottom: 12,
    textAlign: 'center',
  },
  description: {
    fontSize: 15,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
    paddingHorizontal: 10,
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  cancelBtn: {
    flex: 1,
    height: 54,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#64748b',
  },
  confirmBtn: {
    flex: 2,
    height: 54,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  confirmText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#fff',
  },
});

export default PermissionModal;
