import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ActivityIndicator,
  Image,
} from 'react-native';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useDispatch, useSelector } from 'react-redux';
import { clearReplyingTo } from '../store/chatSlice';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { mediaApi } from '../api/chatApi';
import CONFIG from '../config';

const MessageInput = ({ onSendMessage, isLoading = false, onTypingChange }) => {
  const [message, setMessage] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  const typingTimeoutRef = React.useRef(null);
  const dispatch = useDispatch();
  const { user } = useSelector(state => state.auth);
  const { replyingTo } = useSelector(state => state.chat);
  const currentUserId = user?.userId || user?.id;

  const BASE_URL = CONFIG.API_URL.split('/api')[0];

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
        const uploadedUrls = [];
        let messageType = 'IMAGE';

        console.log(`[MessageInput] Picking ${result.assets.length} media items...`);

        for (const asset of result.assets) {
          // Xử lý đuôi file: Chuyển .heic sang .jpg để Web nhận diện tốt hơn
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

          try {
            const response = await mediaApi.uploadFile(file);
            const url = response.data?.data?.url || response.data?.url || response.url;
            if (url) {
              uploadedUrls.push(url);
              console.log(`[MessageInput] Uploaded ${uploadedUrls.length}/${result.assets.length}: ${url}`);
            }
          } catch (uploadErr) {
            console.error('[MessageInput] Upload failed for asset:', asset.uri, uploadErr);
          }
        }

        if (uploadedUrls.length > 0) {
          console.log(`[MessageInput] Sending message with ${uploadedUrls.length} files.`);
          onSendMessage('', replyingTo?.messageId, messageType, uploadedUrls);
          dispatch(clearReplyingTo());
        }
      }
    } catch (error) {
      console.error('Pick media error:', error);
      alert('Không thể tải tệp lên. Vui lòng thử lại.');
    } finally {
      setIsUploading(false);
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
        const uploadedUrls = [];

        for (const asset of result.assets) {
          const file = {
            uri: asset.uri,
            type: asset.mimeType || 'application/octet-stream',
            name: asset.name,
          };

          const response = await mediaApi.uploadFile(file);
          const url = response.data?.data?.url || response.data?.url || response.url;
          if (url) uploadedUrls.push(url);
        }

        if (uploadedUrls.length > 0) {
          onSendMessage('', replyingTo?.messageId, 'FILE', uploadedUrls);
          dispatch(clearReplyingTo());
        }
      }
    } catch (error) {
      console.error('Pick document error:', error);
      alert('Không thể tải tài liệu lên. Vui lòng thử lại.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSendMessage = () => {
    if (message.trim() && !isLoading && !isUploading) {
      onSendMessage(message.trim(), replyingTo?.messageId);
      setMessage('');
      
      // Stop typing immediately
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
    if (!displayText) {
      if (isImage) displayText = '[Hình ảnh]';
      else if (isVideo) displayText = '[Video]';
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

        {/* Hiển thị Thumbnail hoặc Icon File trong Preview */}
        {isFile && replyingTo.mediaUrls?.[0] ? (
          <View style={[styles.replyThumbnail, { backgroundColor: getFileConfig(replyingTo.mediaUrls[0]).color, alignItems: 'center', justifyContent: 'center' }]}>
            <MaterialCommunityIcons name={getFileConfig(replyingTo.mediaUrls[0]).icon} size={20} color="#fff" />
          </View>
        ) : thumbUrl ? (
          <Image source={{ uri: thumbUrl }} style={styles.replyThumbnail} resizeMode="cover" />
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
        <TouchableOpacity 
          style={styles.actionButton} 
          onPress={pickMedia}
          disabled={isLoading || isUploading}
        >
          <MaterialIcons name="image" size={24} color="#667eea" />
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.actionButton} 
          onPress={pickDocument}
          disabled={isLoading || isUploading}
        >
          {isUploading ? (
            <ActivityIndicator size="small" color="#667eea" />
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
});

export default MessageInput;
