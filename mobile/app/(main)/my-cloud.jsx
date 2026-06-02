import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  TextInput,
  FlatList,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Image,
  Modal,
  Linking,
  ActionSheetIOS,
  ScrollView,
  BackHandler,
} from 'react-native';
import { Ionicons, MaterialIcons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSelector, useDispatch } from 'react-redux';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { StatusBar } from 'expo-status-bar';

import { useTheme } from '../../src/context/ThemeContext';
import { myCloudApi } from '../../src/api/myCloudApi';
import ForwardModal from '../../src/components/ForwardModal';
import MessageModal from '../../src/components/MessageModal';
import MediaViewer from '../../src/components/MediaViewer';
import VideoThumbnail from '../../src/components/VideoThumbnail';
import { onGlobalEvent, offGlobalEvent } from '../../src/utils/socket';

const MyCloudScreen = () => {
  const { colors, isDark } = useTheme();
  const router = useRouter();
  const user = useSelector((state) => state.auth.user);

  useFocusEffect(
    React.useCallback(() => {
      const onBackPress = () => {
        router.replace('/(main)/profile');
        return true;
      };

      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);

      return () => {
        subscription.remove();
      };
    }, [router])
  );

  // States
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [nextKey, setNextKey] = useState(null);
  const [messageText, setMessageText] = useState('');
  const [replyingTo, setReplyingTo] = useState(null);
  const [activeTab, setActiveTab] = useState('all'); // all, image, video, audio, document
  const [mediaViewerVisible, setMediaViewerVisible] = useState(false);
  const [selectedMediaIndex, setSelectedMediaIndex] = useState(0);
  const [mediaViewerList, setMediaViewerList] = useState([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Forward Modal states
  const [forwardModalVisible, setForwardModalVisible] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [messageModalVisible, setMessageModalVisible] = useState(false);
  const [selectedCloudItem, setSelectedCloudItem] = useState(null);

  // Selection mode states
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);

  // Fetching My Cloud files
  const fetchFiles = async (key = null, filterType = activeTab) => {
    if (key) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }

    try {
      const params = {
        limit: 30,
        fileType: (filterType === 'all' || filterType === 'link') ? '' : filterType,
        nextKey: key,
      };

      const response = await myCloudApi.listFiles(params);
      const data = response.data || response;

      if (key) {
        setFiles((prev) => [...prev, ...(data.myCloudResponses || [])]);
      } else {
        setFiles(data.myCloudResponses || []);
      }

      setNextKey(data.nextKey || null);
    } catch (err) {
      console.error('Failed to fetch My Cloud files:', err);
      Alert.alert('Lỗi', 'Không thể tải danh sách tệp.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    fetchFiles(null, activeTab);
  }, [activeTab]);

  useEffect(() => {
    const handleCloudUpdate = (event) => {
      if (event.eventType === 'MY_CLOUD_UPDATE') {
        const { action, item, fileId } = event.payload;
        if (action === 'UPLOAD') {
          setFiles((prev) => {
            if (prev.some((f) => f.id === item.id)) return prev;
            return [item, ...prev];
          });
        } else if (action === 'DELETE') {
          setFiles((prev) => prev.filter((f) => f.id !== fileId));
        }
      }
    };
    onGlobalEvent(handleCloudUpdate);
    return () => offGlobalEvent(handleCloudUpdate);
  }, []);

  const handleLoadMore = () => {
    if (nextKey && !loadingMore && !loading) {
      fetchFiles(nextKey, activeTab);
    }
  };

  const handleRefresh = () => {
    fetchFiles(null, activeTab);
  };

  // Parsing helper methods
  const getDisplayMessageText = (item) => {
    if (!item?.messageText) return '';
    if (item.messageText.startsWith('{"text":')) {
      try {
        const parsed = JSON.parse(item.messageText);
        return parsed.text || '';
      } catch (e) {
        return item.messageText;
      }
    }
    return item.messageText;
  };

  const getReplyPreview = (item) => {
    if (!item) return null;

    if (
      item.replyToMessageId ||
      item.replyToContent ||
      item.replyToSenderName ||
      item.replyToFileName ||
      item.replyToFileUrl
    ) {
      return {
        messageId: item.replyToMessageId,
        content: item.replyToContent || item.replyToFileName || '',
        typeFile: item.replyToTypeFile || 'document',
        senderName: item.replyToSenderName || 'Bạn',
        fileUrl: item.replyToFileUrl || '',
      };
    }

    if (item.messageText && item.messageText.startsWith('{"text":')) {
      try {
        const parsed = JSON.parse(item.messageText);
        return parsed.replyTo || null;
      } catch (e) {
        return null;
      }
    }

    return null;
  };

  const getFileIcon = (typeFile) => {
    switch (typeFile) {
      case 'image':
        return <Ionicons name="image-outline" size={24} color="#ec4899" />;
      case 'video':
        return <Ionicons name="videocam-outline" size={24} color="#a855f7" />;
      case 'audio':
        return <Ionicons name="musical-notes-outline" size={24} color="#f59e0b" />;
      case 'document':
        return <Ionicons name="document-text-outline" size={24} color="#3b82f6" />;
      default:
        return <Ionicons name="document-outline" size={24} color="#64748b" />;
    }
  };

  const formatSize = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  const formatTime = (dateValue) => {
    if (!dateValue) return '';
    return new Date(dateValue).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Upload Actions
  const handleUploadMultipleFiles = async (assets) => {
    if (!assets || assets.length === 0) return;
    setUploading(true);
    try {
      const getMimeType = (fileName) => {
        if (!fileName) return 'application/octet-stream';
        const lower = fileName.toLowerCase();
        if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
        if (lower.endsWith('.png')) return 'image/png';
        if (lower.endsWith('.gif')) return 'image/gif';
        if (lower.endsWith('.webp')) return 'image/webp';
        if (lower.endsWith('.heic')) return 'image/heic';
        if (lower.endsWith('.mp4')) return 'video/mp4';
        if (lower.endsWith('.mov') || lower.endsWith('.qt')) return 'video/quicktime';
        if (lower.endsWith('.mkv')) return 'video/x-matroska';
        if (lower.endsWith('.mp3')) return 'audio/mpeg';
        if (lower.endsWith('.wav')) return 'audio/wav';
        if (lower.endsWith('.m4a')) return 'audio/m4a';
        if (lower.endsWith('.aac')) return 'audio/aac';
        if (lower.endsWith('.pdf')) return 'application/pdf';
        if (lower.endsWith('.txt')) return 'text/plain';
        if (lower.endsWith('.doc') || lower.endsWith('.docx')) return 'application/msword';
        if (lower.endsWith('.xls') || lower.endsWith('.xlsx')) return 'application/vnd.ms-excel';
        return 'application/octet-stream';
      };

      let successCount = 0;
      let failCount = 0;

      for (const asset of assets) {
        const uri = asset.uri;
        let name = asset.name || asset.fileName || uri.split('/').pop() || 'file.bin';
        let resolvedMime = asset.mimeType;

        if (asset.type === 'video') {
          // Normalize video name and type
          if (!resolvedMime || !resolvedMime.startsWith('video/')) {
            resolvedMime = 'video/mp4';
          }
          const lowerName = name.toLowerCase();
          const hasVideoExt = lowerName.endsWith('.mp4') || 
                              lowerName.endsWith('.mov') || 
                              lowerName.endsWith('.mkv') || 
                              lowerName.endsWith('.qt') || 
                              lowerName.endsWith('.3gp') || 
                              lowerName.endsWith('.avi');
          if (!hasVideoExt) {
            name = name + '.mp4';
          }
        } else if (asset.type === 'image') {
          // Normalize image name and type
          if (!resolvedMime || !resolvedMime.startsWith('image/')) {
            resolvedMime = 'image/jpeg';
          }
          if (name.toLowerCase().endsWith('.heic')) {
            name = name.replace(/\.heic$/i, '.jpg');
            resolvedMime = 'image/jpeg';
          }
          const lowerName = name.toLowerCase();
          const hasImageExt = lowerName.endsWith('.jpg') || 
                              lowerName.endsWith('.jpeg') || 
                              lowerName.endsWith('.png') || 
                              lowerName.endsWith('.gif') || 
                              lowerName.endsWith('.webp');
          if (!hasImageExt) {
            name = name + '.jpg';
          }
        } else {
          // Document picker or other
          if (!resolvedMime || resolvedMime === 'application/octet-stream') {
            resolvedMime = getMimeType(name);
          }
        }

        const formData = new FormData();
        formData.append('file', {
          uri: Platform.OS === 'ios' ? uri.replace('file://', '') : uri,
          name: name,
          type: resolvedMime,
        });

        if (replyingTo) {
          formData.append('replyToMessageId', replyingTo.id);
          formData.append('replyToContent', getDisplayMessageText(replyingTo) || replyingTo.fileName || '');
          formData.append('replyToTypeFile', replyingTo.typeFile || 'document');
          formData.append('replyToFileName', replyingTo.fileName || '');
          formData.append('replyToSenderName', replyingTo.replyToSenderName || 'Bạn');
        }

        try {
          const response = await myCloudApi.uploadFile(formData);
          if (response && response.success && response.data) {
            const created = response.data;
            setFiles((prev) => {
              if (prev.some((f) => f.id === created.id)) return prev;
              return [created, ...prev];
            });
            successCount++;
          } else {
            console.warn(`Failed to upload file ${name}:`, response?.message || 'Server error');
            failCount++;
          }
        } catch (uploadErr) {
          console.error(`Failed to upload file ${name}:`, uploadErr);
          failCount++;
        }
      }
      setReplyingTo(null);

      if (failCount > 0) {
        Alert.alert(
          'Tải lên hoàn tất',
          `Đã tải lên thành công ${successCount} tệp. Thất bại ${failCount} tệp.`
        );
      }
    } catch (err) {
      console.error('Multiple file upload failed:', err);
      Alert.alert('Lỗi', 'Không thể tải tệp lên Cloud.');
    } finally {
      setUploading(false);
    }
  };

  const pickImageOrVideo = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Quyền truy cập', 'Vui lòng cấp quyền truy cập thư viện ảnh để gửi hình/video.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images', 'videos'],
        allowsMultipleSelection: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        handleUploadMultipleFiles(result.assets);
      }
    } catch (err) {
      console.error('Error picking image/video:', err);
    }
  };

  const pickDocumentFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        multiple: true,
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        handleUploadMultipleFiles(result.assets);
      }
    } catch (err) {
      console.error('Error picking document:', err);
    }
  };

  const showAttachmentOptions = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Hủy', 'Chọn hình ảnh / video', 'Chọn tài liệu / tệp'],
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) pickImageOrVideo();
          else if (buttonIndex === 2) pickDocumentFile();
        }
      );
    } else {
      Alert.alert(
        'Đính kèm phương tiện',
        'Chọn phương thức tải lên',
        [
          { text: 'Chọn hình ảnh / video', onPress: pickImageOrVideo },
          { text: 'Chọn tài liệu / tệp', onPress: pickDocumentFile },
          { text: 'Hủy', style: 'cancel' },
        ],
        { cancelable: true }
      );
    }
  };

  const sendTextMessageToCloud = async () => {
    if (uploading) return;
    const text = (messageText || '').trim();
    if (!text) return;
    setUploading(true);
    let tempUri = null;
    try {
      const fileName = `message_${Date.now()}.txt`;
      tempUri = `${FileSystem.cacheDirectory}${fileName}`;
      await FileSystem.writeAsStringAsync(tempUri, text, { encoding: FileSystem.EncodingType.UTF8 });

      const formData = new FormData();
      formData.append('file', {
        uri: Platform.OS === 'ios' ? tempUri.replace('file://', '') : tempUri,
        name: fileName,
        type: 'text/plain',
      });

      if (replyingTo) {
        formData.append('replyToMessageId', replyingTo.id);
        formData.append('replyToContent', getDisplayMessageText(replyingTo) || replyingTo.fileName || '');
        formData.append('replyToTypeFile', replyingTo.typeFile || 'document');
        formData.append('replyToFileName', replyingTo.fileName || '');
        formData.append('replyToSenderName', replyingTo.replyToSenderName || 'Bạn');
      }

      const response = await myCloudApi.uploadFile(formData);
      const created = response.data || response;
      if (created) {
        setFiles((prev) => {
          if (prev.some((f) => f.id === created.id)) return prev;
          return [created, ...prev];
        });
        setMessageText('');
        setReplyingTo(null);
      } else {
        handleRefresh();
      }
    } catch (err) {
      console.error('Send text message failed:', err);
      Alert.alert('Lỗi', 'Không thể lưu tin nhắn.');
    } finally {
      setUploading(false);
      if (tempUri) {
        await FileSystem.deleteAsync(tempUri, { idempotent: true });
      }
    }
  };

  // Actions on individual items
  const handleDeleteFile = (fileIdOrIds) => {
    const isArray = Array.isArray(fileIdOrIds);
    Alert.alert(
      isArray ? 'Xóa nhóm tệp' : 'Xóa tệp',
      isArray ? 'Bạn có chắc chắn muốn xóa nhóm tệp này khỏi Cloud của tôi?' : 'Bạn có chắc chắn muốn xóa tệp này khỏi Cloud của tôi?',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa',
          style: 'destructive',
          onPress: async () => {
            try {
              const ids = isArray ? fileIdOrIds : [fileIdOrIds];
              for (const id of ids) {
                await myCloudApi.deleteFile(id);
              }
              setFiles((prev) => prev.filter((f) => !ids.includes(f.id)));
            } catch (err) {
              console.error('Failed to delete file(s):', err);
              Alert.alert('Lỗi', 'Không thể xóa tệp.');
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  const handleOpenForward = (file) => {
    const isMsg = Boolean(getDisplayMessageText(file));
    setSelectedMessage({
      messageId: file.id,
      conversationId: 'my-cloud',
      senderName: 'Bạn',
      content: isMsg ? getDisplayMessageText(file) : (file.fileName || ''),
      type: isMsg ? 'TEXT' : (file.typeFile === 'image' ? 'IMAGE' : file.typeFile === 'video' ? 'VIDEO' : 'FILE'),
      mediaUrls: isMsg ? [] : [file.fileUrl],
    });
    setForwardModalVisible(true);
  };

  const handleItemPress = (file) => {
    const isMsg = Boolean(getDisplayMessageText(file));
    if (isMsg) return;

    // Actions for files
    const options = ['Hủy', 'Tải về / Mở tệp', 'Xem trước', 'Trả lời', 'Chuyển tiếp', 'Xóa'];
    const isImage = file.typeFile === 'image';
    const isVideo = file.typeFile === 'video';
    
    // Clean up options if not image/video
    const availableOptions = (isImage || isVideo) ? options : options.filter(o => o !== 'Xem trước');

    const handleAction = (choice) => {
      if (choice === 'Tải về / Mở tệp') {
        if (file.fileUrl) Linking.openURL(file.fileUrl);
      } else if (choice === 'Xem trước') {
        setMediaViewerList([{ url: file.fileUrl, type: isVideo ? 'VIDEO' : 'IMAGE' }]);
        setSelectedMediaIndex(0);
        setMediaViewerVisible(true);
      } else if (choice === 'Trả lời') {
        setReplyingTo(file);
      } else if (choice === 'Chuyển tiếp') {
        handleOpenForward(file);
      } else if (choice === 'Xóa') {
        handleDeleteFile(file.id);
      }
    };

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: availableOptions,
          cancelButtonIndex: 0,
          destructiveButtonIndex: availableOptions.indexOf('Xóa'),
        },
        (index) => {
          if (index === 0) return;
          handleAction(availableOptions[index]);
        }
      );
    } else {
      Alert.alert(
        file.fileName,
        'Chọn hành động',
        availableOptions.map((opt) => {
          if (opt === 'Hủy') return { text: opt, style: 'cancel' };
          if (opt === 'Xóa') return { text: opt, style: 'destructive', onPress: () => handleAction(opt) };
          return { text: opt, onPress: () => handleAction(opt) };
        }),
        { cancelable: true }
      );
    }
  };

  const mapCloudItemToMessage = (item) => {
    if (!item) return null;

    const displayContent = getDisplayMessageText(item);
    const isMsg = Boolean(displayContent) && String(item.fileName || '').startsWith('message_');

    if (item.isGroup) {
      const firstFile = item.files[0];
      return {
        messageId: item.id,
        content: isMsg ? displayContent : '',
        type: 'FILE',
        mediaUrls: item.files.map(f => f.fileUrl).filter(Boolean),
        senderId: user?.userId || user?.id,
        isGroup: true,
        files: item.files,
        uploadedAt: item.uploadedAt,
        typeFile: firstFile?.typeFile
      };
    }

    let type = 'FILE';
    if (isMsg) {
      type = 'TEXT';
    } else if (item.typeFile === 'image') {
      type = 'IMAGE';
    } else if (item.typeFile === 'video') {
      type = 'VIDEO';
    }
    return {
      messageId: item.id,
      content: isMsg ? displayContent : '',
      type: type,
      mediaUrls: item.fileUrl ? [item.fileUrl] : [],
      senderId: user?.userId || user?.id,
      uploadedAt: item.uploadedAt,
      fileName: item.fileName,
      fileSize: item.fileSize,
      typeFile: item.typeFile
    };
  };

  const handleModalAction = (type, file) => {
    if (!file) return;
    switch (type) {
      case 'reply':
        setReplyingTo(file);
        break;
      case 'forward':
        handleOpenForward(file);
        break;
      case 'copy':
        try {
          const { Clipboard } = require('react-native');
          const txt = getDisplayMessageText(file) || file.fileName || '';
          if (Clipboard && Clipboard.setString) {
            Clipboard.setString(txt);
          } else {
            const { NativeModules } = require('react-native');
            if (NativeModules.Clipboard) {
              NativeModules.Clipboard.setString(txt);
            }
          }
        } catch (e) {
          console.log('Clipboard not available');
        }
        break;
      case 'delete':
      case 'recall': // Map recall to delete for My Cloud
        if (file.isGroup) {
          handleDeleteFile(file.files.map(f => f.id));
        } else {
          handleDeleteFile(file.id);
        }
        break;
      case 'select':
        setSelectionMode(true);
        if (file.isGroup) {
          setSelectedIds(file.files.map(f => f.id));
        } else {
          setSelectedIds([file.id]);
        }
        break;
      case 'pin':
        // Pin logic - UI level highlighting if needed, or just Alert for now
        Alert.alert('Ghim tệp', 'Tính năng ghim đang được phát triển.');
        break;
      default:
        if (file.fileUrl) {
          Linking.openURL(file.fileUrl);
        }
        break;
    }
  };

  const handleMessageLongPress = (file) => {
    if (selectionMode) {
      toggleSelection(file.id);
      return;
    }
    setSelectedCloudItem(file);
    setMessageModalVisible(true);
  };

  const toggleSelection = (id) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) {
        const next = prev.filter((i) => i !== id);
        if (next.length === 0) setSelectionMode(false);
        return next;
      } else {
        return [...prev, id];
      }
    });
  };

  const handleBulkDelete = () => {
    if (selectedIds.length === 0) return;
    Alert.alert(
      'Xóa nhiều tệp',
      `Bạn có chắc chắn muốn xóa ${selectedIds.length} mục đã chọn khỏi Cloud?`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa',
          style: 'destructive',
          onPress: async () => {
            try {
              for (const id of selectedIds) {
                // If id is a group id, we need to handle it.
                // But selectedIds will contain actual file IDs from the checkboxes.
                await myCloudApi.deleteFile(id);
              }
              setFiles((prev) => prev.filter((f) => !selectedIds.includes(f.id)));
              setSelectedIds([]);
              setSelectionMode(false);
            } catch (err) {
              console.error('Failed to delete files:', err);
              Alert.alert('Lỗi', 'Không thể xóa một số tệp.');
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  // Group adjacent files (images, videos, documents, audios) within 5 seconds of upload time
  const groupedFiles = useMemo(() => {
    const grouped = [];
    let currentGroup = null;

    // files are sorted descending (newest first)
    files.forEach((item) => {
      if (item.deleted) return;

      const isMsg = Boolean(getDisplayMessageText(item)) && String(item.fileName || '').startsWith('message_');
      const isGroupable = !isMsg;
      const itemTime = item.uploadedAt ? new Date(item.uploadedAt).getTime() : 0;

      if (isGroupable && currentGroup) {
        const timeDiff = Math.abs(itemTime - currentGroup.time);
        if (timeDiff <= 5000) {
          currentGroup.files.push(item);
          return;
        }
      }

      if (isGroupable) {
        currentGroup = {
          id: `group_${item.id}`,
          isGroup: true,
          type: 'file_group',
          time: itemTime,
          uploadedAt: item.uploadedAt,
          files: [item],
        };
        grouped.push(currentGroup);
      } else {
        currentGroup = null;
        grouped.push(item);
      }
    });

    const term = searchTerm.toLowerCase().trim();
    return grouped.map((item) => {
      if (item.isGroup && item.type === 'file_group') {
        let filteredFiles = item.files;
        if (activeTab !== 'all') {
          filteredFiles = item.files.filter(f => {
            if (activeTab === 'image') return f.typeFile === 'image';
            if (activeTab === 'video') return f.typeFile === 'video';
            if (activeTab === 'audio') return f.typeFile === 'audio';
            if (activeTab === 'link') {
              const isMsg = Boolean(f.messageText) && String(f.fileName || '').startsWith('message_');
              if (isMsg) {
                let text = f.messageText;
                if (text.startsWith('{"text":')) {
                  try {
                    const parsed = JSON.parse(text);
                    text = parsed.text || '';
                  } catch (e) {}
                }
                if (!text) return false;
                const urls = text.match(/https?:\/\/[^\s]+/gi);
                if (!urls) return false;
                const validUrls = urls.filter(url => {
                  const lowerUrl = url.toLowerCase();
                  return !(
                    lowerUrl.includes('/chat-media/') ||
                    lowerUrl.includes('/uploads/') ||
                    lowerUrl.includes('/voice-messages/') ||
                    lowerUrl.includes('/chat-wallpaper/') ||
                    lowerUrl.includes('/avatars/') ||
                    lowerUrl.includes('amazonaws.com') ||
                    lowerUrl.includes('s3.') ||
                    lowerUrl.includes('dicebear.com')
                  );
                });
                return validUrls.length > 0;
              }
              return false;
            }
            // Document tab should exclude image, video, audio, and messages
            const isMsg = Boolean(f.messageText) && String(f.fileName || '').startsWith('message_');
            return !isMsg && f.typeFile !== 'image' && f.typeFile !== 'video' && f.typeFile !== 'audio';
          });
        }
        if (term) {
          filteredFiles = filteredFiles.filter(f => (f.fileName || '').toLowerCase().includes(term));
        }
        if (filteredFiles.length === 0) return null;
        return {
          ...item,
          files: filteredFiles,
        };
      } else {
        const fileType = item.typeFile;
        if (activeTab !== 'all') {
          if (activeTab === 'image' && fileType !== 'image') return null;
          if (activeTab === 'video' && fileType !== 'video') return null;
          if (activeTab === 'audio' && fileType !== 'audio') return null;
          if (activeTab === 'document') {
            const isMsg = Boolean(item.messageText) && String(item.fileName || '').startsWith('message_');
            if (isMsg || fileType === 'image' || fileType === 'video' || fileType === 'audio') return null;
          }
          if (activeTab === 'link') {
            const isMsg = Boolean(item.messageText) && String(item.fileName || '').startsWith('message_');
            if (!isMsg) return null;
            let text = item.messageText;
            if (text.startsWith('{"text":')) {
              try {
                const parsed = JSON.parse(text);
                text = parsed.text || '';
              } catch (e) {}
            }
            if (!text) return null;
            const urls = text.match(/https?:\/\/[^\s]+/gi);
            if (!urls) return null;
            const validUrls = urls.filter(url => {
              const lowerUrl = url.toLowerCase();
              return !(
                lowerUrl.includes('/chat-media/') ||
                lowerUrl.includes('/uploads/') ||
                lowerUrl.includes('/voice-messages/') ||
                lowerUrl.includes('/chat-wallpaper/') ||
                lowerUrl.includes('/avatars/') ||
                lowerUrl.includes('amazonaws.com') ||
                lowerUrl.includes('s3.') ||
                lowerUrl.includes('dicebear.com')
              );
            });
            if (validUrls.length === 0) return null;
          }
        }
        if (term) {
          const matchName = (item.fileName || '').toLowerCase().includes(term);
          const matchContent = (getDisplayMessageText(item) || '').toLowerCase().includes(term);
          if (!matchName && !matchContent) return null;
        }
        return item;
      }
    }).filter(Boolean);
  }, [files, searchTerm, activeTab]);

  // Render list item
  const renderItem = ({ item }) => {
    if (item.isGroup && item.type === 'file_group') {
      const replyData = getReplyPreview(item.files[0]);
      const imagesAndVideos = item.files.filter(f => f.typeFile === 'image' || f.typeFile === 'video');
      const otherFiles = item.files.filter(f => f.typeFile !== 'image' && f.typeFile !== 'video');

      // If it is just a single image or video, render as single media item
      if (item.files.length === 1 && imagesAndVideos.length === 1) {
        const mediaFile = imagesAndVideos[0];
        const isSelected = selectedIds.includes(mediaFile.id);
        return (
          <View style={styles.messageRow}>
            {selectionMode && (
              <TouchableOpacity
                style={styles.selectionCircle}
                onPress={() => toggleSelection(mediaFile.id)}
              >
                <Ionicons
                  name={isSelected ? "checkmark-circle" : "ellipse-outline"}
                  size={24}
                  color={isSelected ? colors.primary : colors.textSubtle}
                />
              </TouchableOpacity>
            )}
            <View style={styles.messageContainer}>
              {replyData && (
                <View style={[styles.replyBubbleHeader, { backgroundColor: isDark ? colors.surface200 : '#e0e7ff', borderLeftColor: colors.primary }]}>
                  <View style={styles.replyIconLabelRow}>
                    <Ionicons name="arrow-undo" size={10} color={colors.primary} />
                    <Text style={[styles.replySenderName, { color: colors.primary }]}>
                      {replyData.senderName === 'Bạn' ? 'Trả lời chính mình' : replyData.senderName}
                    </Text>
                  </View>
                  <Text style={[styles.replyTextSummary, { color: colors.textMuted }]} numberOfLines={1}>
                    {replyData.content || replyData.fileName}
                  </Text>
                </View>
              )}
              <TouchableOpacity
                onPress={() => {
                  if (selectionMode) {
                    toggleSelection(mediaFile.id);
                  } else {
                    setMediaViewerList([{ url: mediaFile.fileUrl, type: mediaFile.typeFile === 'video' ? 'VIDEO' : 'IMAGE' }]);
                    setSelectedMediaIndex(0);
                    setMediaViewerVisible(true);
                  }
                }}
                onLongPress={() => handleMessageLongPress(mediaFile)}
                activeOpacity={0.9}
                style={[styles.imageMessageContainer, isSelected && styles.selectedOverlay]}
              >
                {mediaFile.typeFile === 'video' ? (
                  <VideoThumbnail videoUrl={mediaFile.fileUrl} style={styles.imageMessageStyle} />
                ) : (
                  <Image source={{ uri: mediaFile.fileUrl }} style={styles.imageMessageStyle} resizeMode="cover" />
                )}
                <View style={styles.mediaTimeOverlay}>
                  <Text style={styles.mediaTimeText}>{formatTime(mediaFile.uploadedAt)}</Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        );
      }

      // If it is just a single document/file, render as single document bubble
      if (item.files.length === 1 && otherFiles.length === 1) {
        const file = otherFiles[0];
        const isSelected = selectedIds.includes(file.id);
        return (
          <View style={styles.messageRow}>
            {selectionMode && (
              <TouchableOpacity
                style={styles.selectionCircle}
                onPress={() => toggleSelection(file.id)}
              >
                <Ionicons
                  name={isSelected ? "checkmark-circle" : "ellipse-outline"}
                  size={24}
                  color={isSelected ? colors.primary : colors.textSubtle}
                />
              </TouchableOpacity>
            )}
            <View style={styles.messageContainer}>
              {replyData && (
                <View style={[styles.replyBubbleHeader, { backgroundColor: isDark ? colors.surface200 : '#e0e7ff', borderLeftColor: colors.primary }]}>
                  <View style={styles.replyIconLabelRow}>
                    <Ionicons name="arrow-undo" size={10} color={colors.primary} />
                    <Text style={[styles.replySenderName, { color: colors.primary }]}>
                      {replyData.senderName === 'Bạn' ? 'Trả lời chính mình' : replyData.senderName}
                    </Text>
                  </View>
                  <Text style={[styles.replyTextSummary, { color: colors.textMuted }]} numberOfLines={1}>
                    {replyData.content || replyData.fileName}
                  </Text>
                </View>
              )}
              <TouchableOpacity
                onPress={() => {
                  if (selectionMode) {
                    toggleSelection(file.id);
                  } else {
                    handleItemPress(file);
                  }
                }}
                onLongPress={() => handleMessageLongPress(file)}
                activeOpacity={0.9}
                style={[
                  styles.bubble,
                  {
                    backgroundColor: isSelected ? colors.primary + 'CC' : colors.primary,
                    borderTopLeftRadius: 18,
                    borderTopRightRadius: 18,
                    borderBottomLeftRadius: 18,
                    borderBottomRightRadius: 4,
                    padding: 10,
                    width: 240,
                  },
                ]}
              >
                {(() => {
                  const fileName = file.fileName || '';
                  const ext = fileName.split('.').pop().toUpperCase();
                  const getFileColor = (name) => {
                    const e = name.split('.').pop().toLowerCase();
                    if (e === 'pdf') return '#ef4444';
                    if (['doc', 'docx'].includes(e)) return '#3b82f6';
                    if (['xls', 'xlsx'].includes(e)) return '#10b981';
                    if (['zip', 'rar', '7z'].includes(e)) return '#f59e0b';
                    return '#6366f1';
                  };
                  return (
                    <View style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      padding: 10,
                      borderRadius: 12,
                      borderWidth: 1,
                      backgroundColor: 'rgba(255, 255, 255, 0.15)',
                      borderColor: 'rgba(255, 255, 255, 0.25)',
                      width: '100%',
                    }}>
                      <View style={{
                        width: 44,
                        height: 44,
                        borderRadius: 10,
                        justifyContent: 'center',
                        alignItems: 'center',
                        backgroundColor: getFileColor(fileName),
                        marginRight: 10,
                      }}>
                        <Text style={{
                          color: '#ffffff',
                          fontSize: 10,
                          fontWeight: 'bold',
                        }}>{ext}</Text>
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={{
                          color: '#ffffff',
                          fontSize: 14,
                          fontWeight: '600',
                        }} numberOfLines={1}>{fileName}</Text>
                        <Text style={{
                          color: 'rgba(255, 255, 255, 0.7)',
                          fontSize: 10,
                          marginTop: 2,
                        }}>{ext} • {formatSize(file.fileSize)}</Text>
                      </View>
                    </View>
                  );
                })()}
                <Text style={[styles.timestampText, { marginTop: 6 }]}>{formatTime(file.uploadedAt)}</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      }

      // If it is a group of multiple files (mixed or multiple of same type)
      const allGroupIds = item.files.map(f => f.id);
      const isGroupSelected = allGroupIds.every(id => selectedIds.includes(id));

      return (
        <View style={styles.messageRow}>
          {selectionMode && (
            <TouchableOpacity
              style={styles.selectionCircle}
              onPress={() => {
                if (isGroupSelected) {
                  setSelectedIds(prev => prev.filter(id => !allGroupIds.includes(id)));
                } else {
                  setSelectedIds(prev => [...new Set([...prev, ...allGroupIds])]);
                }
              }}
            >
              <Ionicons
                name={isGroupSelected ? "checkmark-circle" : "ellipse-outline"}
                size={24}
                color={isGroupSelected ? colors.primary : colors.textSubtle}
              />
            </TouchableOpacity>
          )}
          <View style={styles.messageContainer}>
            {replyData && (
              <View style={[styles.replyBubbleHeader, { backgroundColor: isDark ? colors.surface200 : '#e0e7ff', borderLeftColor: colors.primary }]}>
                <View style={styles.replyIconLabelRow}>
                  <Ionicons name="arrow-undo" size={10} color={colors.primary} />
                  <Text style={[styles.replySenderName, { color: colors.primary }]}>
                    {replyData.senderName === 'Bạn' ? 'Trả lời chính mình' : replyData.senderName}
                  </Text>
                </View>
                <Text style={[styles.replyTextSummary, { color: colors.textMuted }]} numberOfLines={1}>
                  {replyData.content || replyData.fileName}
                </Text>
              </View>
            )}

            <TouchableOpacity
              onPress={() => {
                if (selectionMode) {
                   if (isGroupSelected) {
                    setSelectedIds(prev => prev.filter(id => !allGroupIds.includes(id)));
                  } else {
                    setSelectedIds(prev => [...new Set([...prev, ...allGroupIds])]);
                  }
                }
              }}
              onLongPress={() => handleMessageLongPress(item)}
              activeOpacity={0.9}
              style={[
                styles.bubble,
                {
                  backgroundColor: isGroupSelected ? colors.primary + 'CC' : colors.primary,
                  borderTopLeftRadius: 18,
                  borderTopRightRadius: 18,
                  borderBottomLeftRadius: 18,
                  borderBottomRightRadius: 4,
                  padding: 10,
                  width: 240,
                }
              ]}
            >
              {/* Media Grid / ScrollView */}
              {imagesAndVideos.length > 0 && (
                imagesAndVideos.length > 1 ? (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: 8, paddingRight: 10 }}
                    style={{
                      marginBottom: otherFiles.length > 0 ? 8 : 0,
                      width: '100%',
                    }}
                  >
                    {imagesAndVideos.map((mediaFile, index) => {
                      const isVideo = mediaFile.typeFile === 'video';
                      const isFileSelected = selectedIds.includes(mediaFile.id);
                      return (
                        <TouchableOpacity
                          key={mediaFile.id}
                          onPress={() => {
                            if (selectionMode) {
                              toggleSelection(mediaFile.id);
                            } else {
                              setMediaViewerList(imagesAndVideos.map(f => ({
                                url: f.fileUrl,
                                type: f.typeFile === 'video' ? 'VIDEO' : 'IMAGE'
                              })));
                              setSelectedMediaIndex(index);
                              setMediaViewerVisible(true);
                            }
                          }}
                          onLongPress={() => handleMessageLongPress(mediaFile)}
                          activeOpacity={0.8}
                          style={{
                            width: 140,
                            height: 108,
                            borderRadius: 8,
                            overflow: 'hidden',
                            position: 'relative',
                            backgroundColor: 'rgba(0,0,0,0.1)',
                            borderWidth: isFileSelected ? 2 : 0,
                            borderColor: colors.primary,
                          }}
                        >
                          {isVideo ? (
                            <VideoThumbnail videoUrl={mediaFile.fileUrl} style={{ width: '100%', height: '100%' }} />
                          ) : (
                            <Image source={{ uri: mediaFile.fileUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                          )}
                          {isFileSelected && (
                            <View style={{ position: 'absolute', top: 4, right: 4 }}>
                              <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                            </View>
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                ) : (
                  // Single media item when there are other files in the group
                  (() => {
                    const mediaFile = imagesAndVideos[0];
                    const isVideo = mediaFile.typeFile === 'video';
                    const isFileSelected = selectedIds.includes(mediaFile.id);
                    return (
                      <TouchableOpacity
                        key={mediaFile.id}
                        onPress={() => {
                          if (selectionMode) {
                            toggleSelection(mediaFile.id);
                          } else {
                            setMediaViewerList([{ url: mediaFile.fileUrl, type: isVideo ? 'VIDEO' : 'IMAGE' }]);
                            setSelectedMediaIndex(0);
                            setMediaViewerVisible(true);
                          }
                        }}
                        onLongPress={() => handleMessageLongPress(mediaFile)}
                        activeOpacity={0.8}
                        style={{
                          width: '100%',
                          height: 180,
                          borderRadius: 8,
                          overflow: 'hidden',
                          position: 'relative',
                          backgroundColor: 'rgba(0,0,0,0.1)',
                          marginBottom: otherFiles.length > 0 ? 8 : 0,
                          borderWidth: isFileSelected ? 2 : 0,
                          borderColor: colors.primary,
                        }}
                      >
                        {isVideo ? (
                          <VideoThumbnail videoUrl={mediaFile.fileUrl} style={{ width: '100%', height: '100%' }} />
                        ) : (
                          <Image source={{ uri: mediaFile.fileUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                        )}
                        {isFileSelected && (
                          <View style={{ position: 'absolute', top: 4, right: 4 }}>
                            <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })()
                )
              )}

              {/* Other Files List */}
              {otherFiles.length > 0 && (
                <View style={{ width: '100%' }}>
                  {otherFiles.map((file, idx) => {
                    const fileName = file.fileName || '';
                    const ext = fileName.split('.').pop().toUpperCase();
                    const isFileSelected = selectedIds.includes(file.id);
                    const getFileColor = (name) => {
                      const e = name.split('.').pop().toLowerCase();
                      if (e === 'pdf') return '#ef4444';
                      if (['doc', 'docx'].includes(e)) return '#3b82f6';
                      if (['xls', 'xlsx'].includes(e)) return '#10b981';
                      if (['zip', 'rar', '7z'].includes(e)) return '#f59e0b';
                      return '#6366f1';
                    };
                    return (
                      <TouchableOpacity
                        key={file.id}
                        onPress={() => {
                          if (selectionMode) {
                            toggleSelection(file.id);
                          } else {
                            handleItemPress(file);
                          }
                        }}
                        onLongPress={() => handleMessageLongPress(file)}
                        activeOpacity={0.8}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          padding: 10,
                          borderRadius: 12,
                          borderWidth: isFileSelected ? 2 : 1,
                          backgroundColor: isFileSelected ? 'rgba(255, 255, 255, 0.3)' : 'rgba(255, 255, 255, 0.15)',
                          borderColor: isFileSelected ? '#fff' : 'rgba(255, 255, 255, 0.25)',
                          width: '100%',
                          marginTop: idx > 0 ? 6 : 0,
                        }}
                      >
                        <View style={{
                          width: 44,
                          height: 44,
                          borderRadius: 10,
                          justifyContent: 'center',
                          alignItems: 'center',
                          backgroundColor: getFileColor(fileName),
                          marginRight: 10,
                        }}>
                          <Text style={{
                            color: '#ffffff',
                            fontSize: 10,
                            fontWeight: 'bold',
                          }}>{ext}</Text>
                        </View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={{
                            color: '#ffffff',
                            fontSize: 14,
                            fontWeight: '600',
                          }} numberOfLines={1}>{fileName}</Text>
                          <Text style={{
                            color: 'rgba(255, 255, 255, 0.7)',
                            fontSize: 10,
                            marginTop: 2,
                          }}>{ext} • {formatSize(file.fileSize)}</Text>
                        </View>
                        {isFileSelected && (
                          <Ionicons name="checkmark-circle" size={20} color="#fff" />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              <Text style={[styles.gridTimestamp || styles.timestampText, { marginTop: 6, color: 'rgba(255, 255, 255, 0.7)' }]}>{formatTime(item.uploadedAt)}</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    const displayContent = getDisplayMessageText(item);
    const replyData = getReplyPreview(item);
    const isMsg = Boolean(displayContent) && String(item.fileName || '').startsWith('message_');
    const isSelected = selectedIds.includes(item.id);

    return (
      <View style={styles.messageRow}>
        {selectionMode && (
          <TouchableOpacity
            style={styles.selectionCircle}
            onPress={() => toggleSelection(item.id)}
          >
            <Ionicons
              name={isSelected ? "checkmark-circle" : "ellipse-outline"}
              size={24}
              color={isSelected ? colors.primary : colors.textSubtle}
            />
          </TouchableOpacity>
        )}
        {/* Right side alignment as My Cloud represents personal space */}
        <View style={styles.messageContainer}>
          {/* Reply Banner */}
          {replyData && (
            <View style={[styles.replyBubbleHeader, { backgroundColor: isDark ? colors.surface200 : '#e0e7ff', borderLeftColor: colors.primary }]}>
              <View style={styles.replyIconLabelRow}>
                <Ionicons name="arrow-undo" size={10} color={colors.primary} />
                <Text style={[styles.replySenderName, { color: colors.primary }]}>
                  {replyData.senderName === 'Bạn' ? 'Trả lời chính mình' : replyData.senderName}
                </Text>
              </View>
              <Text style={[styles.replyTextSummary, { color: colors.textMuted }]} numberOfLines={1}>
                {replyData.content || replyData.fileName}
              </Text>
            </View>
          )}

          {isMsg ? (
            <TouchableOpacity
              onPress={() => {
                if (selectionMode) {
                  toggleSelection(item.id);
                }
              }}
              onLongPress={() => handleMessageLongPress(item)}
              activeOpacity={0.8}
              style={[
                styles.bubble,
                {
                  backgroundColor: isSelected ? colors.primary + 'CC' : colors.primary,
                  borderTopLeftRadius: 18,
                  borderTopRightRadius: 18,
                  borderBottomLeftRadius: 18,
                  borderBottomRightRadius: 4,
                },
                replyData && { borderTopLeftRadius: 0, borderTopRightRadius: 0 }
              ]}
            >
              <Text style={styles.messageText}>
                {(() => {
                  const urlRegex = /(https?:\/\/[^\s]+)/gi;
                  const parts = displayContent.split(urlRegex);
                  return parts.map((part, index) => {
                    if (part.match(urlRegex)) {
                      return (
                        <Text
                          key={`link-${index}`}
                          style={{ textDecorationLine: 'underline', color: '#ffffff' }}
                          onPress={() => Linking.openURL(part)}
                        >
                          {part}
                        </Text>
                      );
                    }
                    return part;
                  });
                })()}
              </Text>
              <Text style={styles.timestampText}>{formatTime(item.uploadedAt)}</Text>
            </TouchableOpacity>
          ) : item.typeFile === 'image' && item.fileUrl ? (
            <TouchableOpacity
              onPress={() => {
                if (selectionMode) {
                  toggleSelection(item.id);
                } else {
                  setMediaViewerList([{ url: item.fileUrl, type: 'IMAGE' }]);
                  setSelectedMediaIndex(0);
                  setMediaViewerVisible(true);
                }
              }}
              onLongPress={() => handleMessageLongPress(item)}
              activeOpacity={0.9}
              style={[styles.imageMessageContainer, isSelected && styles.selectedOverlay]}
            >
              <Image source={{ uri: item.fileUrl }} style={styles.imageMessageStyle} resizeMode="cover" />
              <View style={styles.mediaTimeOverlay}>
                <Text style={styles.mediaTimeText}>{formatTime(item.uploadedAt)}</Text>
              </View>
            </TouchableOpacity>
          ) : item.typeFile === 'video' && item.fileUrl ? (
            <TouchableOpacity
              onPress={() => {
                if (selectionMode) {
                  toggleSelection(item.id);
                } else {
                  setMediaViewerList([{ url: item.fileUrl, type: 'VIDEO' }]);
                  setSelectedMediaIndex(0);
                  setMediaViewerVisible(true);
                }
              }}
              onLongPress={() => handleMessageLongPress(item)}
              activeOpacity={0.9}
              style={[styles.imageMessageContainer, isSelected && styles.selectedOverlay]}
            >
              <VideoThumbnail videoUrl={item.fileUrl} style={styles.imageMessageStyle} />
              <View style={styles.mediaTimeOverlay}>
                <Text style={styles.mediaTimeText}>{formatTime(item.uploadedAt)}</Text>
              </View>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={() => {
                if (selectionMode) {
                  toggleSelection(item.id);
                } else {
                  handleItemPress(item);
                }
              }}
              onLongPress={() => handleMessageLongPress(item)}
              activeOpacity={0.9}
              style={[
                styles.bubble,
                {
                  backgroundColor: isSelected ? colors.primary + 'CC' : colors.primary,
                  borderTopLeftRadius: 18,
                  borderTopRightRadius: 18,
                  borderBottomLeftRadius: 18,
                  borderBottomRightRadius: 4,
                  padding: 10,
                  width: 240,
                },
                replyData && { borderTopLeftRadius: 0, borderTopRightRadius: 0 }
              ]}
            >
              {(() => {
                const fileName = item.fileName || '';
                const ext = fileName.split('.').pop().toUpperCase();
                const getFileColor = (name) => {
                  const e = name.split('.').pop().toLowerCase();
                  if (e === 'pdf') return '#ef4444';
                  if (['doc', 'docx'].includes(e)) return '#3b82f6';
                  if (['xls', 'xlsx'].includes(e)) return '#10b981';
                  if (['zip', 'rar', '7z'].includes(e)) return '#f59e0b';
                  return '#6366f1';
                };
                return (
                  <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: 10,
                    borderRadius: 12,
                    borderWidth: 1,
                    backgroundColor: 'rgba(255, 255, 255, 0.15)',
                    borderColor: 'rgba(255, 255, 255, 0.25)',
                    width: '100%',
                  }}>
                    <View style={{
                      width: 44,
                      height: 44,
                      borderRadius: 10,
                      justifyContent: 'center',
                      alignItems: 'center',
                      backgroundColor: getFileColor(fileName),
                      marginRight: 10,
                    }}>
                      <Text style={{
                        color: '#ffffff',
                        fontSize: 10,
                        fontWeight: 'bold',
                      }}>{ext}</Text>
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={{
                        color: '#ffffff',
                        fontSize: 14,
                        fontWeight: '600',
                      }} numberOfLines={1}>{fileName}</Text>
                      <Text style={{
                        color: 'rgba(255, 255, 255, 0.7)',
                        fontSize: 10,
                        marginTop: 2,
                      }}>{ext} • {formatSize(item.fileSize)}</Text>
                    </View>
                  </View>
                );
              })()}
              <Text style={[styles.timestampText, { marginTop: 6 }]}>{formatTime(item.uploadedAt)}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        {selectionMode ? (
          <>
            <TouchableOpacity style={styles.backBtn} onPress={() => { setSelectionMode(false); setSelectedIds([]); }}>
              <Ionicons name="close" size={24} color={colors.foreground} />
            </TouchableOpacity>
            <View style={styles.titleContainer}>
              <Text style={[styles.title, { color: colors.foreground }]}>Đã chọn {selectedIds.length}</Text>
            </View>
            <View style={styles.headerActions}>
              <TouchableOpacity style={styles.actionIcon} onPress={handleBulkDelete}>
                <Ionicons name="trash-outline" size={22} color="#ef4444" />
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <>
            <TouchableOpacity style={styles.backBtn} onPress={() => router.replace('/(main)/profile')}>
              <Ionicons name="arrow-back" size={24} color={colors.foreground} />
            </TouchableOpacity>

            {searchOpen ? (
              <TextInput
                style={[styles.searchInput, { color: colors.foreground, backgroundColor: colors.input }]}
                placeholder="Tìm kiếm tệp..."
                placeholderTextColor={colors.textSubtle}
                value={searchTerm}
                onChangeText={setSearchTerm}
                autoFocus
              />
            ) : (
              <View style={styles.titleContainer}>
                <Text style={[styles.title, { color: colors.foreground }]}>Cloud của tôi</Text>
                <Text style={[styles.subtitle, { color: colors.textMuted }]}>Thư mục cá nhân</Text>
              </View>
            )}

            <View style={styles.headerActions}>
              <TouchableOpacity style={styles.actionIcon} onPress={() => setSearchOpen(!searchOpen)}>
                <Ionicons name={searchOpen ? 'close' : 'search'} size={22} color={colors.foreground} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionIcon} onPress={handleRefresh}>
                <Ionicons name="refresh" size={22} color={colors.foreground} />
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>

      {/* Filter Tabs */}
      <View style={[styles.tabsWrapper, { borderBottomColor: colors.border }]}>
        <FlatList
          data={[
            { id: 'all', label: 'Tất cả' },
            { id: 'image', label: 'Ảnh' },
            { id: 'video', label: 'Video' },
            { id: 'audio', label: 'Nhạc' },
            { id: 'document', label: 'Tài liệu' },
            { id: 'link', label: 'Link' },
          ]}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item, index) => item?.id ? String(item.id) : `tab_${index}`}
          contentContainerStyle={{ paddingHorizontal: 12 }}
          renderItem={({ item }) => {
            const active = activeTab === item.id;
            return (
              <TouchableOpacity
                onPress={() => setActiveTab(item.id)}
                style={[
                  styles.tabItem,
                  active && { backgroundColor: colors.primary },
                  !active && { backgroundColor: isDark ? colors.surface200 : '#f1f5f9' },
                ]}
              >
                <Text style={[styles.tabLabel, { color: active ? '#ffffff' : colors.foreground }]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      {/* Message List */}
      <View style={{ flex: 1 }}>
        {loading && files.length === 0 ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.textMuted }]}>Đang tải tệp tin...</Text>
          </View>
        ) : groupedFiles.length === 0 ? (
          <View style={styles.center}>
            <Ionicons name="cloud-offline-outline" size={48} color={colors.textSubtle} />
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>Chưa có tài liệu hay tin nhắn nào</Text>
            <TouchableOpacity style={[styles.uploadBtn, { backgroundColor: colors.primary }]} onPress={showAttachmentOptions}>
              <Text style={styles.uploadBtnText}>Tải tệp đầu tiên</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={groupedFiles}
            renderItem={renderItem}
            keyExtractor={(item, index) => item?.id ? `${item.id}_${index}` : `file_${index}`}
            inverted
            contentContainerStyle={styles.listContent}
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.2}
            ListFooterComponent={
              loadingMore ? (
                <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: 12 }} />
              ) : null
            }
          />
        )}
      </View>

      {/* Reply Banner Above Input */}
      {replyingTo && (
        <View style={[styles.replyBanner, { backgroundColor: isDark ? colors.surface200 : '#f8fafc', borderTopColor: colors.border }]}>
          <View style={[styles.replyLine, { backgroundColor: colors.primary }]} />
          <View style={styles.replyDetails}>
            <Text style={[styles.replyTitle, { color: colors.primary }]} numberOfLines={1}>
              Đang trả lời tệp:
            </Text>
            <Text style={[styles.replyBody, { color: colors.foreground }]} numberOfLines={1}>
              {getDisplayMessageText(replyingTo) || replyingTo.fileName}
            </Text>
          </View>
          <TouchableOpacity onPress={() => setReplyingTo(null)} style={styles.closeReplyBtn}>
            <Ionicons name="close" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      )}

      {/* Keyboard Input Wrapper */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={[styles.inputBar, { backgroundColor: isDark ? colors.surface100 : '#ffffff', borderTopColor: colors.border }]}>
          <TouchableOpacity style={styles.attachBtn} onPress={showAttachmentOptions}>
            <Ionicons name="add" size={26} color={colors.primary} />
          </TouchableOpacity>

          <TextInput
            style={[styles.input, { color: colors.foreground, backgroundColor: colors.input }]}
            placeholder="Gửi tin nhắn hoặc ghi chú..."
            placeholderTextColor={colors.textSubtle}
            value={messageText}
            onChangeText={setMessageText}
            multiline
          />

          {messageText.trim() ? (
            <TouchableOpacity
              style={[styles.sendBtn, { backgroundColor: colors.primary }]}
              onPress={sendTextMessageToCloud}
              disabled={uploading}
            >
              {uploading ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Ionicons name="send" size={18} color="#ffffff" />
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.sendBtn, { backgroundColor: colors.primary }]}
              onPress={showAttachmentOptions}
              disabled={uploading}
            >
              <Ionicons name="attach" size={18} color="#ffffff" />
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>

      {/* Media Viewer Modal */}
      <MediaViewer
        visible={mediaViewerVisible}
        onClose={() => setMediaViewerVisible(false)}
        allMedia={mediaViewerList}
        initialIndex={selectedMediaIndex}
      />

      {/* Forward Modal */}
      <ForwardModal
        visible={forwardModalVisible}
        onClose={() => {
          setForwardModalVisible(false);
          setSelectedMessage(null);
        }}
        messageToForward={selectedMessage}
      />

      <MessageModal
        visible={messageModalVisible}
        message={mapCloudItemToMessage(selectedCloudItem)}
        onClose={() => setMessageModalVisible(false)}
        onAction={(actionType) => handleModalAction(actionType, selectedCloudItem)}
        onReact={() => {}}
        isOwn={true}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  backBtn: {
    paddingRight: 12,
  },
  searchInput: {
    flex: 1,
    height: 38,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 11,
    marginTop: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionIcon: {
    paddingLeft: 16,
  },
  tabsWrapper: {
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  tabItem: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 16,
  },
  uploadBtn: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  uploadBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  messageRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 12,
  },
  messageContainer: {
    maxWidth: '85%',
    alignItems: 'flex-end',
  },
  bubble: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
  },
  messageText: {
    color: '#ffffff',
    fontSize: 15,
    lineHeight: 20,
  },
  timestampText: {
    fontSize: 9,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'right',
    marginTop: 4,
  },
  fileBubble: {
    borderWidth: 1,
    padding: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  imageThumbnailContainer: {
    width: 220,
    height: 140,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 8,
    position: 'relative',
  },
  imageThumbnail: {
    width: '100%',
    height: '100%',
  },
  imageOverlayIcon: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 12,
    padding: 4,
  },
  fileDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    maxWidth: 220,
  },
  fileIconWrapper: {
    width: 42,
    height: 42,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  fileNameWrapper: {
    flex: 1,
  },
  fileNameText: {
    fontSize: 13,
    fontWeight: '600',
  },
  fileSizeText: {
    fontSize: 10,
    marginTop: 2,
  },
  fileActionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    borderTopWidth: 1,
    paddingTop: 8,
    gap: 16,
  },
  actionBtnLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionBtnLabel: {
    fontSize: 10,
    fontWeight: '700',
  },
  fileTimestampText: {
    fontSize: 8,
    textAlign: 'right',
    marginTop: 6,
  },
  replyBubbleHeader: {
    borderLeftWidth: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    width: '100%',
    marginBottom: -1,
  },
  replyIconLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  replySenderName: {
    fontSize: 10,
    fontWeight: '700',
  },
  replyTextSummary: {
    fontSize: 11,
    marginTop: 1,
  },
  replyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderTopWidth: 1,
  },
  replyLine: {
    width: 4,
    height: '100%',
    borderRadius: 2,
  },
  replyDetails: {
    flex: 1,
    paddingLeft: 10,
  },
  replyTitle: {
    fontSize: 11,
    fontWeight: '700',
  },
  replyBody: {
    fontSize: 13,
    marginTop: 2,
  },
  closeReplyBtn: {
    padding: 4,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
  },
  attachBtn: {
    padding: 4,
    marginRight: 8,
  },
  input: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    maxHeight: 100,
    fontSize: 14,
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeModalBtn: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
  },
  fullScreenImage: {
    width: '90%',
    height: '80%',
  },
  imageMessageContainer: {
    width: 240,
    height: 180,
    borderRadius: 18,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
    marginVertical: 4,
  },
  imageMessageStyle: {
    width: '100%',
    height: '100%',
  },
  mediaTimeOverlay: {
    position: 'absolute',
    bottom: 6,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  mediaTimeText: {
    fontSize: 9,
    color: '#ffffff',
  },
  selectionCircle: {
    justifyContent: 'center',
    marginRight: 12,
    paddingLeft: 4,
  },
  selectedOverlay: {
    borderWidth: 3,
    borderColor: '#3b82f6',
  },
  videoOverlayPlay: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -20 }, { translateY: -20 }],
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mediaGridWrapper: {
    width: 242,
    padding: 4,
    borderRadius: 18,
    borderWidth: 1,
    marginVertical: 4,
  },
  mobileGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  mobileGridItem: {
    width: 114,
    height: 114,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  mobileGridImage: {
    width: '100%',
    height: '100%',
  },
  mobileGridPlay: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -12 }, { translateY: -12 }],
  },
  gridTimestamp: {
    fontSize: 8,
    textAlign: 'right',
    marginTop: 4,
    marginRight: 4,
  },
});

export default MyCloudScreen;
