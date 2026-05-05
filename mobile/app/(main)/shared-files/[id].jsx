import React, { useMemo, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity, 
  Pressable 
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSelector } from 'react-redux';
import { Ionicons, MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getRealId } from '../../../src/store/chatSlice';
import FileViewerModal from '../../../src/components/FileViewerModal';
import CONFIG from '../../../src/config';

const SharedFilesScreen = () => {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const BASE_URL = CONFIG.API_URL.split('/api')[0];
  
  const [selectedFile, setSelectedFile] = useState(null);
  const [viewerVisible, setViewerVisible] = useState(false);
  
  const messagesFromStore = useSelector((state) => state.chat.messages);
  const realId = useMemo(() => {
    if (!id) return null;
    const decodedId = decodeURIComponent(id);
    if (messagesFromStore[decodedId]) return decodedId;
    const rId = getRealId(decodedId);
    if (messagesFromStore[rId]) return rId;
    return rId;
  }, [id, messagesFromStore]);
  
  const messages = messagesFromStore[realId] || [];

  // Lọc ra các tin nhắn là FILE và không bị thu hồi
  const sharedFiles = useMemo(() => {
    const files = [];
    messages.forEach(msg => {
      const urls = msg.mediaUrls || msg.media_urls || [];
      const msgType = (msg.type || '').toUpperCase();
      if (msgType === 'FILE' && !msg.isRecalled && urls.length > 0) {
        urls.forEach(url => {
          files.push({
            id: `${msg.messageId}-${url}`,
            url,
            senderName: msg.senderName,
            createdAt: msg.createdAt,
            messageId: msg.messageId
          });
        });
      }
    });
    console.log(`[SharedFilesDebug] Total messages: ${messages.length}, Found files: ${files.length}`);
    return files.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [messages]);

  const getFileConfig = (u) => {
    const ext = u.split('.').pop().split('?')[0].toLowerCase();
    if (ext === 'pdf') return { color: '#ef4444', icon: 'file-pdf-box' };
    if (['doc', 'docx'].includes(ext)) return { color: '#3b82f6', icon: 'file-word-box' };
    if (['xls', 'xlsx'].includes(ext)) return { color: '#10b981', icon: 'file-excel-box' };
    if (['zip', 'rar', '7z'].includes(ext)) return { color: '#f59e0b', icon: 'zip-box' };
    return { color: '#6366f1', icon: 'file-document-outline' };
  };

  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
  };

  const renderFileItem = ({ item }) => {
    const config = getFileConfig(item.url);
    const fileName = item.url.split('/').pop().split('?')[0].replace(/^[0-9a-f-]{36}_/, '');
    const ext = item.url.split('.').pop().split('?')[0].toUpperCase();

    return (
      <TouchableOpacity 
        style={styles.fileItem}
        onPress={() => {
          const fullUrl = item.url.startsWith('http') ? item.url : `${BASE_URL}${item.url.startsWith('/') ? '' : '/'}${item.url}`;
          setSelectedFile({ url: fullUrl, name: decodeURIComponent(fileName) });
          setViewerVisible(true);
        }}
      >
        <View style={[styles.iconContainer, { backgroundColor: config.color }]}>
          <MaterialCommunityIcons name={config.icon} size={28} color="#fff" />
          <Text style={styles.extBadge}>{ext}</Text>
        </View>
        <View style={styles.fileInfo}>
          <Text style={styles.fileName} numberOfLines={1}>
            {decodeURIComponent(fileName)}
          </Text>
          <Text style={styles.fileMeta}>
            {item.senderName} • {formatDate(item.createdAt)}
          </Text>
        </View>
        <MaterialIcons name="chevron-right" size={24} color="#94a3b8" />
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable 
          onPress={() => router.replace(`/chat-info/${encodeURIComponent(id)}`)} 
          style={styles.backButton}
        >
          <MaterialIcons name="arrow-back" size={24} color="#fff" />
        </Pressable>
        <Text style={styles.headerTitle}>File đã chia sẻ</Text>
        <View style={{ width: 48 }} />
      </View>

      {sharedFiles.length === 0 ? (
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons name="file-search-outline" size={80} color="#334155" />
          <Text style={styles.emptyText}>Chưa có tệp tin nào được chia sẻ</Text>
        </View>
      ) : (
        <FlatList
          data={sharedFiles}
          renderItem={renderFileItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      <FileViewerModal
        visible={viewerVisible}
        onClose={() => setViewerVisible(false)}
        fileUrl={selectedFile?.url}
        fileName={selectedFile?.name}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  listContent: {
    padding: 16,
  },
  fileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  iconContainer: {
    width: 52,
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  extBadge: {
    position: 'absolute',
    bottom: 2,
    fontSize: 8,
    fontWeight: '900',
    color: '#fff',
    backgroundColor: 'rgba(0,0,0,0.2)',
    paddingHorizontal: 4,
    borderRadius: 4,
  },
  fileInfo: {
    flex: 1,
    marginLeft: 16,
  },
  fileName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  fileMeta: {
    fontSize: 12,
    color: '#94a3b8',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 100,
  },
  emptyText: {
    color: '#94a3b8',
    fontSize: 16,
    marginTop: 16,
    fontWeight: '500',
  },
});

export default SharedFilesScreen;
