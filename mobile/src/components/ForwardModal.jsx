import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  FlatList,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { MaterialIcons, Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSelector, useDispatch } from 'react-redux';
import { sendMessage } from '../store/chatSlice';
import * as FileSystem from 'expo-file-system/legacy';
import myCloudApi from '../api/myCloudApi';
import axiosClient from '../api/axiosClient';
import { useTranslation } from 'react-i18next';


const ForwardModal = ({ visible, onClose, messageToForward }) => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const { conversations } = useSelector((state) => state.chat);
  const { user } = useSelector((state) => state.auth);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('recent'); // recent, group, friend, cloud
  const [selectedConvs, setSelectedConvs] = useState([]);
  const [extraMessage, setExtraMessage] = useState('');
  const [sending, setSending] = useState(false);

  const filteredConversations = useMemo(() => {
    if (activeTab === 'cloud') return [];
    let list = [...conversations];
    
    // Sort by last message date (recent first) - assuming conversations are already sorted in store
    // but just in case:
    list.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));

    if (activeTab === 'group') {
      list = list.filter(c => c.type === 'GROUP');
    } else if (activeTab === 'friend') {
      list = list.filter(c => c.type === 'SINGLE');
    }

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      list = list.filter(c => 
        (c.name || '').toLowerCase().includes(term) || 
        (c.lastMessage || '').toLowerCase().includes(term)
      );
    }

    return list;
  }, [conversations, activeTab, searchTerm]);

  const toggleSelect = (convId) => {
    if (activeTab === 'cloud') {
      setSelectedConvs(prev => prev.includes('MY_CLOUD') ? [] : ['MY_CLOUD']);
    } else {
      setSelectedConvs(prev => 
        prev.includes(convId) 
          ? prev.filter(id => id !== convId) 
          : [...prev, convId]
      );
    }
  };


  const handleForwardToCloud = async () => {
    try {
      const isText = messageToForward.type === 'TEXT';

      const getMimeType = (fileName) => {
        if (!fileName) return 'application/octet-stream';
        const lower = fileName.toLowerCase();
        const extensionMap = {
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.png': 'image/png',
          '.gif': 'image/gif',
          '.webp': 'image/webp',
          '.heic': 'image/heic',
          '.mp4': 'video/mp4',
          '.mov': 'video/quicktime',
          '.qt': 'video/quicktime',
          '.mkv': 'video/x-matroska',
          '.mp3': 'audio/mpeg',
          '.wav': 'audio/wav',
          '.m4a': 'audio/m4a',
          '.aac': 'audio/aac',
          '.pdf': 'application/pdf',
          '.txt': 'text/plain',
          '.doc': 'application/msword',
          '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          '.xls': 'application/vnd.ms-excel',
          '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          '.ppt': 'application/vnd.ms-powerpoint',
          '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          '.zip': 'application/zip',
          '.rar': 'application/x-rar-compressed',
          '.7z': 'application/x-7z-compressed',
        };
        for (const [ext, mime] of Object.entries(extensionMap)) {
          if (lower.endsWith(ext)) return mime;
        }
        return 'application/octet-stream';
      };

      const extractObjectKey = (inputUrl) => {
        if (!inputUrl) return '';
        try {
          if (!inputUrl.startsWith('http')) return inputUrl;
          const parsed = new URL(inputUrl);
          const host = (parsed.hostname || '').toLowerCase();
          const pathname = decodeURIComponent(parsed.pathname || '').replace(/^\/+/, '');
          const segments = pathname.split('/').filter(Boolean);

          if (host === 's3.amazonaws.com' || /^s3[.-]/.test(host)) {
            if (segments.length > 1) return segments.slice(1).join('/');
          }
          if (host.includes('.s3.')) return pathname;
          return pathname;
        } catch (error) {
          return '';
        }
      };

      const getFreshUrl = async (inputUrl) => {
        const objectKey = extractObjectKey(inputUrl);
        if (objectKey) {
          try {
            const response = await axiosClient.get('/media/presigned-download', {
              params: { objectKey, expiresInMinutes: 15 }
            });
            // axiosClient is configured to return response.data which is the ApiResponse
            return response?.data?.url || response?.url || inputUrl;
          } catch (e) {
            console.log('Presigned download error, using direct URL', e);
          }
        }
        return inputUrl;
      };

      const cleanFileName = (url) => {
        if (!url) return `file_${Date.now()}`;
        try {
          const decoded = decodeURIComponent(url);
          let name = decoded.split('/').pop().split('?')[0];
          name = name.replace(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}_/i, '');
          name = name.replace(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}_[0-9]+_/i, '');
          return name;
        } catch (e) {
          return `file_${Date.now()}`;
        }
      };

      if (isText) {
        const text = messageToForward.content || '';
        const fileName = `forwarded_${Date.now()}.txt`;
        const tempUri = `${FileSystem.cacheDirectory}${fileName}`;
        try {
          await FileSystem.writeAsStringAsync(tempUri, text, { encoding: FileSystem.EncodingType.UTF8 });

          const formData = new FormData();
          formData.append('file', {
            uri: Platform.OS === 'ios' ? tempUri.replace('file://', '') : tempUri,
            name: fileName,
            type: 'text/plain',
          });
          await myCloudApi.uploadFile(formData);
        } finally {
          await FileSystem.deleteAsync(tempUri, { idempotent: true }).catch(() => {});
        }
      } else {
        const mediaUrls = messageToForward.mediaUrls || messageToForward.media_urls || [];
        if (mediaUrls.length > 0) {
          for (const url of mediaUrls) {
            const freshUrl = await getFreshUrl(url);
            let name = messageToForward.fileName;
            if (!name && messageToForward.content && !messageToForward.content.startsWith('http')) {
               name = messageToForward.content;
            }
            if (!name) {
               name = cleanFileName(url);
            }
            
            const tempUri = `${FileSystem.cacheDirectory}${name}`;
            try {
              const downloadResult = await FileSystem.downloadAsync(freshUrl, tempUri);

              const formData = new FormData();
              formData.append('file', {
                uri: Platform.OS === 'ios' ? downloadResult.uri.replace('file://', '') : downloadResult.uri,
                name: name,
                type: getMimeType(name)
              });
              await myCloudApi.uploadFile(formData);
            } finally {
              await FileSystem.deleteAsync(tempUri, { idempotent: true }).catch(() => {});
            }
          }
        } else if (messageToForward.content && messageToForward.content.startsWith('http')) {
           const freshUrl = await getFreshUrl(messageToForward.content);
           let name = messageToForward.fileName || cleanFileName(messageToForward.content);
           const tempUri = `${FileSystem.cacheDirectory}${name}`;
           try {
             const downloadResult = await FileSystem.downloadAsync(freshUrl, tempUri);

             const formData = new FormData();
             formData.append('file', {
               uri: Platform.OS === 'ios' ? downloadResult.uri.replace('file://', '') : downloadResult.uri,
               name: name,
               type: getMimeType(name)
             });
             await myCloudApi.uploadFile(formData);
           } finally {
             await FileSystem.deleteAsync(tempUri, { idempotent: true }).catch(() => {});
           }
        }
      }
    } catch (err) {
      console.error('Forward to cloud failed:', err);
      throw err;
    }
  };

  const handleForward = async () => {
    if (selectedConvs.length === 0 || !messageToForward) return;
    setSending(true);

    try {
      if (selectedConvs.includes('MY_CLOUD')) {
        await handleForwardToCloud();
      }

      const otherConvs = selectedConvs.filter(id => id !== 'MY_CLOUD');
      if (otherConvs.length > 0) {
        const forwardedFrom = {
          messageId: messageToForward.messageId || messageToForward.id,
          conversationId: messageToForward.conversationId,
          senderName: messageToForward.senderName || t('chat.user_fallback', 'Người dùng')
        };

        for (const convId of otherConvs) {
          // Forward the original message
          await dispatch(sendMessage({
            conversationId: convId, 
            content: messageToForward.content || '', 
            type: messageToForward.type || 'TEXT', 
            mediaUrls: messageToForward.mediaUrls || messageToForward.media_urls || [], 
            forwardedFrom
          }));

          // Send extra message if any
          if (extraMessage.trim()) {
            await dispatch(sendMessage({
              conversationId: convId, 
              content: extraMessage.trim(), 
              type: 'TEXT'
            }));
          }
        }
      }
      onClose();
      // Reset state
      setSelectedConvs([]);
      setExtraMessage('');
      setSearchTerm('');
    } catch (err) {
      console.error('Forwarding failed:', err);
    } finally {
      setSending(false);
    }
  };

  const getConvName = (conv) => {
    if (conv.type === 'GROUP') return conv.name || t('chat.unnamed_group', 'Nhóm không tên');
    const currentUserId = String(user?.userId || user?.id || '');
    const otherMember = conv.members?.find(m => String(m.userId || m.id) !== currentUserId);
    return otherMember?.fullName || otherMember?.name || conv.name || t('chat.user_fallback', 'Người dùng');
  };

  const renderConvItem = ({ item }) => {
    const isSelected = selectedConvs.includes(item.conversationId);
    return (
      <TouchableOpacity 
        style={[styles.convItem, isSelected && styles.convItemSelected]} 
        onPress={() => toggleSelect(item.conversationId)}
        activeOpacity={0.7}
      >
        <View style={styles.convAvatar}>
          {item.type === 'GROUP' ? (
            <MaterialIcons name="groups" size={24} color="#6366f1" />
          ) : (
            <MaterialIcons name="person" size={24} color="#6366f1" />
          )}
        </View>
        <Text style={styles.convName} numberOfLines={1}>{getConvName(item)}</Text>
        <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
          {isSelected && <MaterialIcons name="check" size={16} color="#fff" />}
        </View>
      </TouchableOpacity>
    );
  };

  const renderMyCloudItem = () => {
    const isSelected = selectedConvs.includes('MY_CLOUD');
    return (
      <TouchableOpacity 
        style={[styles.convItem, isSelected && styles.convItemSelected]} 
        onPress={() => toggleSelect('MY_CLOUD')}
        activeOpacity={0.7}
      >
        <View style={styles.convAvatar}>
          <MaterialCommunityIcons name="cloud-outline" size={24} color="#6366f1" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.convName} numberOfLines={1}>My Cloud</Text>
          <Text style={{ fontSize: 12, color: '#9ca3af' }}>{t('forward.cloud_storage', 'Lưu trữ cá nhân')}</Text>
        </View>
        <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
          {isSelected && <MaterialIcons name="check" size={16} color="#fff" />}
        </View>
      </TouchableOpacity>
    );
  };

  const tabs = [
    { id: 'recent', label: t('forward.tabs.recent', 'Gần đây') },
    { id: 'group', label: t('forward.tabs.groups', 'Nhóm') },
    { id: 'friend', label: t('forward.tabs.friends', 'Bạn bè') },
    { id: 'cloud', label: 'My Cloud' }
  ];

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.container}
        >
          <View style={styles.header}>
            <Text style={styles.headerTitle}>{t('forward.title', 'Chia sẻ')}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#1f2937" />
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            {/* Search Bar */}
            <View style={styles.searchContainer}>
              <Feather name="search" size={18} color="#9ca3af" style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder={t('forward.search_placeholder', 'Tìm kiếm cuộc trò chuyện...')}
                value={searchTerm}
                onChangeText={setSearchTerm}
              />
              {searchTerm.length > 0 && (
                <TouchableOpacity onPress={() => setSearchTerm('')}>
                  <Ionicons name="close-circle" size={18} color="#9ca3af" />
                </TouchableOpacity>
              )}
            </View>

            {/* Tabs */}
            <View style={styles.tabs}>
              {tabs.map(tab => (
                <TouchableOpacity 
                  key={tab.id} 
                  style={[styles.tab, activeTab === tab.id && styles.tabActive]}
                  onPress={() => setActiveTab(tab.id)}
                >
                  <Text style={[styles.tabText, activeTab === tab.id && styles.tabTextActive]}>{tab.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Conversation List */}
            <FlatList
              data={activeTab === 'cloud' ? [{ conversationId: 'MY_CLOUD', isMyCloud: true }] : filteredConversations}
              renderItem={activeTab === 'cloud' ? renderMyCloudItem : renderConvItem}
              keyExtractor={item => item.conversationId}
              contentContainerStyle={styles.listContent}
              ListEmptyComponent={
                activeTab === 'cloud' ? null : (
                  <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>{t('forward.no_conversations', 'Không tìm thấy cuộc trò chuyện nào')}</Text>
                  </View>
                )
              }
            />


            {/* Preview & Extra Message */}
            <View style={styles.footer}>
              <View style={styles.previewContainer}>
                <Text style={styles.previewLabel}>{t('forward.selected_message', 'Tin nhắn được chọn:')}</Text>
                <View style={styles.previewBox}>
                  <Text style={styles.previewText} numberOfLines={1}>
                    {messageToForward?.content || (
                      messageToForward?.type === 'IMAGE' ? t('chat.image_bracket', '[Hình ảnh]') :
                      messageToForward?.type === 'VIDEO' ? t('chat.video_bracket', '[Video]') :
                      messageToForward?.type === 'FILE' ? t('chat.file_bracket', '[Tệp tin]') :
                      messageToForward?.type === 'VOICE' ? t('chat.voice_bracket', '[Tin nhắn thoại]') :
                      t('chat.message_bracket', '[Tin nhắn]')
                    )}
                  </Text>
                </View>
              </View>

              <TextInput
                style={styles.extraInput}
                placeholder={t('forward.extra_message_placeholder', 'Nhập thêm lời nhắn (không bắt buộc)...')}
                value={extraMessage}
                onChangeText={setExtraMessage}
                multiline
              />

              <TouchableOpacity 
                style={[styles.sendButton, (selectedConvs.length === 0 || sending) && styles.sendButtonDisabled]}
                onPress={handleForward}
                disabled={selectedConvs.length === 0 || sending}
              >
                {sending ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <MaterialIcons name="send" size={20} color="#fff" style={{ marginRight: 8 }} />
                    <Text style={styles.sendButtonText}>
                      {t('forward.send_count', 'Gửi ({{count}})', { count: selectedConvs.length })}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );

};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    height: '90%',
    width: '100%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
  },
  closeButton: {
    padding: 4,
  },
  content: {
    flex: 1,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    margin: 16,
    paddingHorizontal: 16,
    borderRadius: 16,
    height: 48,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#111827',
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  tab: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginRight: 8,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
  },
  tabActive: {
    backgroundColor: '#6366f1',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  tabTextActive: {
    color: '#fff',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  convItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f9fafb',
  },
  convItemSelected: {
    backgroundColor: 'rgba(99, 102, 241, 0.05)',
    borderRadius: 12,
    marginHorizontal: -8,
    paddingHorizontal: 8,
  },
  convAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#eef2ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  convName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#d1d5db',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: '#6366f1',
    borderColor: '#6366f1',
  },
  footer: {
    padding: 24,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    backgroundColor: '#fff',
  },
  previewContainer: {
    marginBottom: 16,
  },
  previewLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
    fontWeight: '600',
  },
  previewBox: {
    backgroundColor: '#f9fafb',
    padding: 12,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#6366f1',
  },
  previewText: {
    fontSize: 14,
    color: '#4b5563',
    fontStyle: 'italic',
  },
  extraInput: {
    backgroundColor: '#f3f4f6',
    borderRadius: 16,
    padding: 12,
    fontSize: 14,
    color: '#111827',
    maxHeight: 100,
    marginBottom: 16,
  },
  sendButton: {
    backgroundColor: '#6366f1',
    flexDirection: 'row',
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  sendButtonDisabled: {
    backgroundColor: '#cbd5e1',
    shadowOpacity: 0,
    elevation: 0,
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: '#9ca3af',
    fontSize: 14,
  },
});

export default ForwardModal;
