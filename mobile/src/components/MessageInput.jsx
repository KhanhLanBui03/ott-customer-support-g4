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
} from 'react-native';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useDispatch, useSelector } from 'react-redux';
import { clearReplyingTo } from '../store/chatSlice';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { mediaApi } from '../api/chatApi';
import CONFIG from '../config';
import { Audio } from 'expo-av';

const MessageInput = ({ onSendMessage, isLoading = false, onTypingChange }) => {
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

  const BASE_URL = CONFIG.API_URL.split('/api')[0];

  useEffect(() => {
    return () => {
      if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
    };
  }, []);

  const startRecording = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        alert('Cần quyền truy cập Micro để ghi âm.');
        return;
      }

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

  const pickMedia = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        alert('Cần quyền truy cập thư viện ảnh để gửi hình ảnh/video.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images', 'videos'],
        allowsMultipleSelection: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
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
                // Wait a bit before retrying (exponential backoff could be added but simple delay for now)
                await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
              }
            }
          }
        }

        setIsUploading(false);
        setUploadProgress(null);

        if (uploadedUrls.length > 0) {
          onSendMessage('', replyingTo?.messageId, messageType, uploadedUrls);
          dispatch(clearReplyingTo());
          
          if (failCount > 0) {
            Alert.alert('Thông báo', `Đã gửi ${uploadedUrls.length} ảnh. Có ${failCount} ảnh bị lỗi không gửi được.`);
          }
        } else if (failCount > 0) {
          Alert.alert('Lỗi', 'Không thể tải ảnh lên. Vui lòng kiểm tra kết nối mạng.');
        }
      }
    } catch (error) {
      console.error('Pick media error:', error);
      alert('Không thể tải tệp lên. Vui lòng thử lại.');
    } finally {
      setIsUploading(false);
      setUploadType(null);
      setUploadProgress(null);
    }
  };

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        multiple: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
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
      }
    } catch (error) {
      console.error('Pick document error:', error);
      Alert.alert('Lỗi', 'Không thể chọn tài liệu. Vui lòng thử lại.');
    } finally {
      setIsUploading(false);
      setUploadType(null);
      setUploadProgress(null);
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
              onPress={pickMedia}
              disabled={isLoading || isUploading}
            >
              {isUploading && uploadType === 'MEDIA' ? (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <ActivityIndicator size="small" color="#667eea" />
                  {uploadProgress && (
                    <Text style={{ fontSize: 10, color: '#667eea', marginLeft: 2, fontWeight: 'bold' }}>{uploadProgress}</Text>
                  )}
                </View>
              ) : (
                <MaterialIcons name="image" size={24} color="#667eea" />
              )}
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.actionButton} 
              onPress={pickDocument}
              disabled={isLoading || isUploading}
            >
              {isUploading && uploadType === 'FILE' ? (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <ActivityIndicator size="small" color="#667eea" />
                  {uploadProgress && (
                    <Text style={{ fontSize: 10, color: '#667eea', marginLeft: 2, fontWeight: 'bold' }}>{uploadProgress}</Text>
                  )}
                </View>
              ) : (
                <MaterialIcons name="description" size={24} color="#667eea" />
              )}
            </TouchableOpacity>

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
});

export default MessageInput;
