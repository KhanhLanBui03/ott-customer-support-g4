import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ActivityIndicator,
  Image,
  Alert,
  Modal,
} from 'react-native';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useDispatch, useSelector } from 'react-redux';
import { clearReplyingTo } from '../store/chatSlice';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { mediaApi } from '../api/chatApi';
import CONFIG from '../config';
import { Audio } from 'expo-av';
import PermissionModal from './common/PermissionModal';

const MessageInput = ({ onSendMessage, isLoading = false, onTypingChange, conversationType, onOpenPoll }) => {
  const [message, setMessage] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [uploadType, setUploadType] = useState(null); // 'MEDIA' or 'FILE'
  const [isTyping, setIsTyping] = useState(false);
  const typingTimeoutRef = useRef(null);
  const dispatch = useDispatch();
  const { user } = useSelector(state => state.auth);
  const { replyingTo } = useSelector(state => state.chat);
  const currentUserId = user?.userId || user?.id;

  // Voice recording state
  const [recording, setRecording] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const recordingIntervalRef = useRef(null);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [permissionModal, setPermissionModal] = useState({ 
    visible: false, 
    type: 'camera', 
    onConfirm: () => {},
    onCancel: () => setPermissionModal(prev => ({ ...prev, visible: false }))
  });
  const isPickingRef = useRef(false);

  const BASE_URL = CONFIG.API_URL.split('/api')[0];

  useEffect(() => {
    return () => {
      if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
    };
  }, []);

  const startRecording = async () => {
    try {
      const granted = await requestPermission('mic', () => Audio.requestPermissionsAsync());
      if (!granted) return;

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });

      // Explicit options for m4a (AAC)
      const recordingOptions = {
        android: {
          extension: '.m4a',
          outputFormat: Audio.AndroidOutputFormat.MPEG_4,
          audioEncoder: Audio.AndroidAudioEncoder.AAC,
          sampleRate: 44100,
          numberOfChannels: 2,
          bitRate: 128000,
        },
        ios: {
          extension: '.m4a',
          outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
          audioQuality: Audio.IOSAudioQuality.HIGH,
          sampleRate: 44100,
          numberOfChannels: 1,
          bitRate: 128000,
        },
        web: {
          mimeType: 'audio/webm',
          bitsPerSecond: 128000,
        },
      };

      const { recording } = await Audio.Recording.createAsync(recordingOptions);
      
      setRecording(recording);
      setIsRecording(true);
      setRecordingDuration(0);
      
      recordingIntervalRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Failed to start recording', err);
    }
  };

  const stopRecording = async () => {
    if (!recording) return;

    try {
      if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
      setIsRecording(false);
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);

      // Upload and send
      if (uri) {
        setIsUploading(true);
        const extension = uri.split('.').pop();
        const fileName = `voice_${Date.now()}.${extension}`;
        const file = {
          uri,
          type: extension === 'm4a' ? 'audio/mp4' : `audio/${extension}`,
          name: fileName,
        };

        try {
          const response = await mediaApi.uploadFile(file);
          const url = response.data?.data?.url || response.data?.url || response.url;
          if (url) {
            onSendMessage('', replyingTo?.messageId, 'VOICE', [url]);
            dispatch(clearReplyingTo());
          }
        } catch (uploadErr) {
          console.error('Voice upload failed', uploadErr);
        } finally {
          setIsUploading(false);
        }
      }
    } catch (err) {
      console.error('Failed to stop recording', err);
    }
  };

  const cancelRecording = async () => {
    if (!recording) return;
    if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
    try {
      setIsRecording(false);
      await recording.stopAndUnloadAsync();
      setRecording(null);
    } catch (err) {
      console.error('Failed to cancel recording', err);
    }
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handleChange = (text) => {
    setMessage(text);
    
    if (text.length > 0) {
      if (!isTyping) {
        setIsTyping(true);
        onTypingChange && onTypingChange(true);
      }
      
      // Reset timeout
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        setIsTyping(false);
        onTypingChange && onTypingChange(false);
        typingTimeoutRef.current = null;
      }, 3000);
    } else {
      if (isTyping) {
        setIsTyping(false);
        onTypingChange && onTypingChange(false);
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
          typingTimeoutRef.current = null;
        }
      }
    }
  };

  const requestPermission = async (type, nativeRequest) => {
    let checkFunc;
    if (type === 'camera') checkFunc = () => ImagePicker.getCameraPermissionsAsync();
    else if (type === 'gallery') checkFunc = () => ImagePicker.getMediaLibraryPermissionsAsync();
    else if (type === 'mic') checkFunc = () => Audio.getPermissionsAsync();
    
    console.log(`[Permission] Requesting ${type}...`);
    if (checkFunc) {
      const { status, canAskAgain } = await checkFunc();
      console.log(`[Permission] Current status for ${type}: ${status}`);
      if (status === 'granted') return true;
      
      if (status === 'denied' && !canAskAgain) {
        Alert.alert('Quyền bị từ chối', 'Bạn đã từ chối quyền này trước đó. Vui lòng vào Cài đặt để cấp quyền thủ công.');
        return false;
      }
    }

    console.log(`[Permission] Showing custom modal for ${type}`);
    return new Promise((resolve) => {
      setPermissionModal({
        visible: true,
        type,
        onConfirm: async () => {
          console.log(`[Permission] User confirmed modal for ${type}`);
          setPermissionModal(prev => ({ ...prev, visible: false }));
          const { status } = await nativeRequest();
          console.log(`[Permission] Native request result for ${type}: ${status}`);
          resolve(status === 'granted');
        },
        onCancel: () => {
          console.log(`[Permission] User cancelled modal for ${type}`);
          setPermissionModal(prev => ({ ...prev, visible: false }));
          resolve(false);
        }
      });
    });
  };

  const takePhoto = async () => {
    if (isPickingRef.current) return;
    isPickingRef.current = true;
    console.log('[Camera] Starting takePhoto process');
    try {
      const granted = await requestPermission('camera', () => ImagePicker.requestCameraPermissionsAsync());
      if (!granted) {
        console.log('[Camera] Permission denied');
        isPickingRef.current = false;
        return;
      }

      // Wait for modal to close fully
      await new Promise(resolve => setTimeout(resolve, 500));

      console.log('[Camera] Launching camera...');
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images', 'videos'],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        console.log('[Camera] Photo/Video taken successfully');
        setIsUploading(true);
        setUploadType('MEDIA');
        const asset = result.assets[0];
        
        let fileName = asset.fileName || (asset.type === 'video' ? 'video.mp4' : 'camera_image.jpg');
        const file = {
          uri: asset.uri,
          type: asset.type === 'video' ? 'video/mp4' : 'image/jpeg',
          name: fileName,
        };

        try {
          const response = await mediaApi.uploadFile(file);
          const url = response.data?.data?.url || response.data?.url || response.url;
          if (url) {
            onSendMessage('', replyingTo?.messageId, asset.type === 'video' ? 'VIDEO' : 'IMAGE', [url]);
            dispatch(clearReplyingTo());
          }
        } catch (uploadErr) {
          console.error('[Camera] Upload failed', uploadErr);
          Alert.alert('Lỗi', 'Không thể tải ảnh từ camera lên. Vui lòng thử lại.');
        }
      } else {
        console.log('[Camera] Operation cancelled by user');
      }
    } catch (error) {
      console.error('[Camera] takePhoto error:', error);
    } finally {
      console.log('[Camera] Resetting states in finally');
      setIsUploading(false);
      setUploadType(null);
      isPickingRef.current = false;
    }
  };

  const pickMedia = async () => {
    if (isPickingRef.current) return;
    isPickingRef.current = true;
    console.log('[Gallery] Starting pickMedia process');
    try {
      const granted = await requestPermission('gallery', () => ImagePicker.requestMediaLibraryPermissionsAsync());
      if (!granted) {
        console.log('[Gallery] Permission denied');
        isPickingRef.current = false;
        return;
      }

      // Wait for modal to close
      await new Promise(resolve => setTimeout(resolve, 500));

      console.log('[Gallery] Launching media library...');
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images', 'videos'],
        allowsMultipleSelection: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        console.log(`[Gallery] Selected ${result.assets.length} items`);
        setIsUploading(true);
        setUploadType('MEDIA');
        const uploadedUrls = [];
        let messageType = 'IMAGE';
        let failCount = 0;

        for (let i = 0; i < result.assets.length; i++) {
          const asset = result.assets[i];
          setUploadProgress(`${i + 1}/${result.assets.length}`);

          let fileName = asset.fileName || (asset.type === 'video' ? 'video.mp4' : 'image.jpg');
          if (fileName.toLowerCase().endsWith('.heic')) {
            fileName = fileName.replace(/\.heic$/i, '.jpg');
          }

          const file = {
            uri: asset.uri,
            type: asset.type === 'video' ? 'video/mp4' : 'image/jpeg',
            name: fileName,
          };
          
          if (asset.type === 'video') messageType = 'VIDEO';

          // Retry logic: up to 3 attempts
          let success = false;
          let attempts = 0;
          const maxAttempts = 3;

          while (!success && attempts < maxAttempts) {
            attempts++;
            try {
              const response = await mediaApi.uploadFile(file);
              const url = response.data?.data?.url || response.data?.url || response.url;
              if (url) {
                uploadedUrls.push(url);
                success = true;
              } else {
                console.warn(`[MessageInput] Upload attempt ${attempts} returned no URL`);
              }
            } catch (uploadErr) {
              console.error(`[MessageInput] Upload attempt ${attempts} failed`, uploadErr);
              if (attempts === maxAttempts) {
                failCount++;
              } else {
                await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
              }
            }
          }
        }

        if (uploadedUrls.length > 0) {
          onSendMessage('', replyingTo?.messageId, messageType, uploadedUrls);
          dispatch(clearReplyingTo());
          
          if (failCount > 0) {
            Alert.alert('Thông báo', `Đã gửi ${uploadedUrls.length} ảnh. Có ${failCount} ảnh bị lỗi không gửi được.`);
          }
        } else if (failCount > 0) {
          Alert.alert('Lỗi', 'Không thể tải ảnh lên. Vui lòng kiểm tra kết nối mạng.');
        }
      } else {
        console.log('[Gallery] Operation cancelled by user');
      }
    } catch (error) {
      console.error('[Gallery] pickMedia error:', error);
      Alert.alert('Lỗi', 'Không thể chọn hình ảnh. Vui lòng thử lại.');
    } finally {
      console.log('[Gallery] Resetting states in finally');
      setIsUploading(false);
      setUploadType(null);
      setUploadProgress(null);
      isPickingRef.current = false;
    }
  };

  const pickDocument = async () => {
    if (isPickingRef.current) return;
    isPickingRef.current = true;
    console.log('[File] Starting pickDocument process (Directly launching picker)');
    try {
      // DocumentPicker không cần quyền Storage trên iOS/Android hiện đại để mở trình chọn hệ thống
      console.log('[File] Launching document picker...');
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        multiple: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        console.log(`[File] Selected ${result.assets.length} items`);
        setIsUploading(true);
        setUploadType('FILE');
        const uploadedUrls = [];
        let failCount = 0;

        for (let i = 0; i < result.assets.length; i++) {
          const asset = result.assets[i];
          setUploadProgress(`${i + 1}/${result.assets.length}`);

          const file = {
            uri: asset.uri,
            type: asset.mimeType || 'application/octet-stream',
            name: asset.name,
          };

          // Retry logic
          let success = false;
          let attempts = 0;
          const maxAttempts = 3;

          while (!success && attempts < maxAttempts) {
            attempts++;
            try {
              const response = await mediaApi.uploadFile(file);
              const url = response.data?.data?.url || response.data?.url || response.url;
              if (url) {
                uploadedUrls.push(url);
                success = true;
              }
            } catch (uploadErr) {
              console.error(`[MessageInput] File upload attempt ${attempts} failed`, uploadErr);
              if (attempts === maxAttempts) {
                failCount++;
              } else {
                await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
              }
            }
          }
        }

        if (uploadedUrls.length > 0) {
          onSendMessage('', replyingTo?.messageId, 'FILE', uploadedUrls);
          dispatch(clearReplyingTo());
          if (failCount > 0) {
            Alert.alert('Thông báo', `Đã gửi ${uploadedUrls.length} tệp. Có ${failCount} tệp bị lỗi.`);
          }
        } else if (failCount > 0) {
          Alert.alert('Lỗi', 'Không thể tải tệp lên. Vui lòng thử lại.');
        }
      } else {
        console.log('[File] Operation cancelled by user');
      }
    } catch (error) {
      console.error('[File] pickDocument error:', error);
      Alert.alert('Lỗi', 'Không thể chọn tài liệu. Vui lòng thử lại.');
    } finally {
      console.log('[File] Resetting states in finally');
      setIsUploading(false);
      setUploadType(null);
      setUploadProgress(null);
      isPickingRef.current = false;
    }
  };

  const handleSendMessage = () => {
    if (message.trim() && !isLoading && !isUploading) {
      onSendMessage(message.trim(), replyingTo?.messageId);
      setMessage('');
      
      if (isTyping) {
        setIsTyping(false);
        onTypingChange && onTypingChange(false);
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
      
      dispatch(clearReplyingTo());
    }
  };

  const renderReplyContent = () => {
    if (!replyingTo) return null;
    
    const isImage = replyingTo.type === 'IMAGE' || (replyingTo.type !== 'VIDEO' && replyingTo.type !== 'FILE' && replyingTo.mediaUrls && replyingTo.mediaUrls.length > 0);
    const isVideo = replyingTo.type === 'VIDEO';
    const isFile = replyingTo.type === 'FILE';
    const isVoice = replyingTo.type === 'VOICE';
    
    const thumbUrl = (isImage || isVideo) && replyingTo.mediaUrls?.[0] 
      ? (replyingTo.mediaUrls[0].startsWith('http') ? replyingTo.mediaUrls[0] : `${BASE_URL}${replyingTo.mediaUrls[0].startsWith('/') ? '' : '/'}${replyingTo.mediaUrls[0]}`)
      : null;

    const getFileConfig = (u) => {
      if (!u) return { color: '#6366f1', icon: 'file-document-outline' };
      const ext = u.split('.').pop().split('?')[0].toLowerCase();
      if (ext === 'pdf') return { color: '#ef4444', icon: 'file-pdf-box' };
      if (['doc', 'docx'].includes(ext)) return { color: '#3b82f6', icon: 'file-word-box' };
      if (['xls', 'xlsx'].includes(ext)) return { color: '#10b981', icon: 'file-excel-box' };
      if (['zip', 'rar', '7z'].includes(ext)) return { color: '#f59e0b', icon: 'zip-box' };
      return { color: '#6366f1', icon: 'file-document-outline' };
    };

    let displayText = replyingTo.content;
    const isVoiceMsg = isVoice || (displayText && (displayText.includes('chat-media/') || displayText.match(/\.(webm|m4a|mp3|wav|ogg|opus)(\?|$)/i)));
    
    if (isVoiceMsg) {
      displayText = 'Tin nhắn thoại';
    } else if (!displayText) {
      if (isImage) displayText = '[Hình ảnh]';
      else if (isVideo) displayText = '[Video]';
      else if (isVoice) displayText = '[Tin nhắn thoại]';
      else if (isFile) {
        const fileName = replyingTo.mediaUrls?.[0]?.split('/').pop().split('?')[0].replace(/^[0-9a-f-]{36}_/, '');
        displayText = fileName ? decodeURIComponent(fileName) : '[Tệp tin]';
      } else displayText = '[Tin nhắn]';
    }

    return (
      <View style={styles.replyPreview}>
        <View style={styles.replyPreviewLine} />
        <View style={styles.replyPreviewContent}>
          <Text style={styles.replyPreviewSender}>
            Trả lời {String(replyingTo.senderId) === String(user?.userId) || String(replyingTo.senderId) === String(user?.id) 
              ? 'chính mình' 
              : replyingTo.senderName}
          </Text>
          <Text style={styles.replyPreviewText} numberOfLines={1}>
            {displayText}
          </Text>
        </View>

        {isFile && replyingTo.mediaUrls?.[0] ? (
          <View style={[styles.replyThumbnail, { backgroundColor: getFileConfig(replyingTo.mediaUrls[0]).color, alignItems: 'center', justifyContent: 'center' }]}>
            <MaterialCommunityIcons name={getFileConfig(replyingTo.mediaUrls[0]).icon} size={20} color="#fff" />
          </View>
        ) : thumbUrl ? (
          <Image source={{ uri: thumbUrl }} style={styles.replyThumbnail} resizeMode="cover" />
        ) : isVoice ? (
          <View style={[styles.replyThumbnail, { backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center' }]}>
            <MaterialIcons name="mic" size={20} color="#667eea" />
          </View>
        ) : null}

        <TouchableOpacity onPress={() => dispatch(clearReplyingTo())} style={styles.closeButton}>
          <MaterialIcons name="close" size={20} color="#9ca3af" />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.root}>
      {replyingTo && renderReplyContent()}
      <View style={styles.container}>
        {!isRecording ? (
          <>
            <TouchableOpacity 
              style={styles.actionButton} 
              onPress={() => setShowAttachMenu(true)}
              disabled={isLoading || isUploading}
            >
              <MaterialIcons name="add-circle-outline" size={28} color="#6366f1" />
            </TouchableOpacity>

            {showAttachMenu && (
              <TouchableOpacity 
                style={styles.menuOverlay} 
                activeOpacity={1} 
                onPress={() => setShowAttachMenu(false)}
              >
                <View style={styles.menuContainer}>
                  <Text style={styles.menuTitle}>Đính kèm</Text>
                  <View style={styles.menuOptions}>
                    <TouchableOpacity 
                      style={styles.menuOption} 
                      onPress={() => {
                        setShowAttachMenu(false);
                        setTimeout(pickMedia, 100);
                      }}
                    >
                      <View style={[styles.menuIconBg, { backgroundColor: '#e0e7ff' }]}>
                        <MaterialIcons name="image" size={24} color="#6366f1" />
                      </View>
                      <Text style={styles.menuOptionText}>Ảnh & Video</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                      style={styles.menuOption} 
                      onPress={() => {
                        setShowAttachMenu(false);
                        setTimeout(pickDocument, 100);
                      }}
                    >
                      <View style={[styles.menuIconBg, { backgroundColor: '#fef3c7' }]}>
                        <MaterialIcons name="description" size={24} color="#d97706" />
                      </View>
                      <Text style={styles.menuOptionText}>Tài liệu</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableOpacity>
            )}

            <TouchableOpacity 
              style={styles.actionButton} 
              onPress={takePhoto}
              disabled={isLoading || isUploading}
            >
              <MaterialIcons name="photo-camera" size={24} color="#667eea" />
            </TouchableOpacity>

            {conversationType === 'GROUP' && (
              <TouchableOpacity 
                style={styles.actionButton} 
                onPress={onOpenPoll}
                disabled={isLoading || isUploading}
              >
                <MaterialCommunityIcons name="poll" size={24} color="#667eea" />
              </TouchableOpacity>
            )}

            <TextInput
              style={styles.input}
              placeholder="Type a message..."
              placeholderTextColor="#999"
              value={message}
              onChangeText={handleChange}
              editable={!isLoading && !isUploading}
              multiline
              maxHeight={100}
            />

            {message.trim() ? (
              <TouchableOpacity
                style={[styles.sendButton, (!message.trim() || isUploading) && styles.sendButtonDisabled]}
                onPress={handleSendMessage}
                disabled={!message.trim() || isLoading || isUploading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#667eea" size="small" />
                ) : (
                  <MaterialIcons name="send" size={20} color="#667eea" />
                )}
              </TouchableOpacity>
            ) : (
              <TouchableOpacity 
                style={styles.actionButton} 
                onPress={startRecording}
                disabled={isLoading || isUploading}
              >
                <MaterialIcons name="mic" size={24} color="#667eea" />
              </TouchableOpacity>
            )}
          </>
        ) : (
          <View style={styles.recordingContainer}>
            <View style={styles.recordingInfo}>
              <View style={styles.recordingDot} />
              <Text style={styles.recordingTime}>{formatDuration(recordingDuration)}</Text>
            </View>
            <View style={styles.recordingActions}>
              <TouchableOpacity style={styles.cancelVoiceBtn} onPress={cancelRecording}>
                <Text style={styles.cancelVoiceText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.sendVoiceBtn} onPress={stopRecording}>
                <MaterialIcons name="send" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        )}

        <PermissionModal 
          visible={permissionModal.visible}
          type={permissionModal.type}
          onClose={permissionModal.onCancel || (() => setPermissionModal(prev => ({ ...prev, visible: false })))}
          onConfirm={permissionModal.onConfirm}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  replyPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  replyPreviewLine: {
    width: 3,
    height: '100%',
    backgroundColor: '#3b82f6',
    borderRadius: 2,
    marginRight: 12,
  },
  replyPreviewContent: {
    flex: 1,
  },
  replyPreviewSender: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  replyPreviewText: {
    fontSize: 13,
    color: '#6b7280',
  },
  replyThumbnail: {
    width: 40,
    height: 40,
    borderRadius: 4,
    marginHorizontal: 8,
  },
  closeButton: {
    padding: 4,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    minHeight: 60,
  },
  actionButton: {
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#f3f4f6',
    borderRadius: 20,
    fontSize: 14,
    maxHeight: 100,
    minHeight: 40,
  },
  sendButton: {
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  recordingContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f3f4f6',
    borderRadius: 24,
    paddingHorizontal: 16,
    height: 48,
  },
  recordingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ef4444',
  },
  recordingTime: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  recordingActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  cancelVoiceBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  cancelVoiceText: {
    color: '#ef4444',
    fontSize: 14,
    fontWeight: '700',
  },
  sendVoiceBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#667eea',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuOverlay: {
    position: 'absolute',
    bottom: 60,
    left: 0,
    right: 0,
    height: 1000, // Cover the screen
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
    zIndex: 1000,
  },
  menuContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 30,
  },
  menuTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1e293b',
    marginBottom: 20,
    textAlign: 'center',
  },
  menuOptions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  menuOption: {
    alignItems: 'center',
    gap: 8,
  },
  menuIconBg: {
    width: 56,
    height: 56,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  menuOptionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
});

export default MessageInput;
