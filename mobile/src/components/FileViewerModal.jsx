import React from 'react';
import { 
  Modal, 
  View, 
  TouchableOpacity, 
  Text, 
  StyleSheet, 
  SafeAreaView,
  ActivityIndicator
} from 'react-native';
import WebView from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';

const FileViewerModal = ({ visible, onClose, fileUrl, fileName }) => {
  if (!fileUrl) return null;

  // Sử dụng Google Docs Viewer để xem tài liệu trực tuyến
  const viewerUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(fileUrl)}&embedded=true`;

  return (
    <Modal 
      visible={visible} 
      animationType="slide" 
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={onClose}>
            <Ionicons name="arrow-back" size={24} color="#1e293b" />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle} numberOfLines={1}>{fileName}</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.content}>
          <WebView
            source={{ uri: viewerUrl }}
            style={styles.webview}
            startInLoadingState={true}
            renderLoading={() => (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#667eea" />
                <Text style={styles.loadingText}>Đang tải tài liệu...</Text>
              </View>
            )}
          />
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleContainer: {
    flex: 1,
    paddingHorizontal: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
  },
  content: {
    flex: 1,
  },
  webview: {
    flex: 1,
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748b',
  },
});

export default FileViewerModal;
