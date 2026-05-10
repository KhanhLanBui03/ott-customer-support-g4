import React, { useState, useRef, useMemo, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Image, 
  TouchableOpacity, 
  Animated, 
  Modal, 
  ScrollView,
  PanResponder, 
} from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { useRouter } from 'expo-router';
import { MaterialIcons, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import CONFIG from '../config';
import { setReplyingTo } from '../store/chatSlice';
import { openFile } from '../utils/fileUtils';
import * as FileSystem from 'expo-file-system/legacy';
import MediaViewer from './MediaViewer';
import VideoThumbnail from './VideoThumbnail';
import FileViewerModal from './FileViewerModal';
import VoicePlayer from './common/VoicePlayer';
import VoteMessage from './VoteMessage';
import VoteDetailsModal from './VoteDetailsModal';

const ChatBubble = ({ 
  message, 
  isOwn: initialIsOwn, 
  isOnline = false, 
  latestReadBy = [], 
  showReadStatus = true, 
  onReact, 
  onLongPress, 
  onPressMessage,
  isHighlighted = false,
  allMessages = []
}) => {
  const router = useRouter();
  const dispatch = useDispatch();
  const { user } = useSelector(state => state.auth);
  const conversations = useSelector(state => state.chat.conversations);
  const BASE_URL = CONFIG.API_URL.split('/api')[0];

  const highlightAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isHighlighted) {
      Animated.sequence([
        Animated.timing(highlightAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: false,
        }),
        Animated.timing(highlightAnim, {
          toValue: 0,
          duration: 1200,
          useNativeDriver: false,
        }),
      ]).start();
    }
  }, [isHighlighted]);

  const highlightBorder = highlightAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['transparent', '#FFD700'],
  });

  const currentUserIdStr = String(user?.userId || user?.id || '');
  
  const [mediaViewerVisible, setMediaViewerVisible] = useState(false);
  const [selectedMediaIndex, setSelectedMediaIndex] = useState(0);
  const [fileExists, setFileExists] = useState(false);
  const [fileViewerVisible, setFileViewerVisible] = useState(false);
  const [selectedFile, setSelectedFile] = useState({ url: '', name: '' });
  const isOwn = initialIsOwn || (currentUserIdStr !== '' && String(message.senderId || '') === currentUserIdStr);
  const [reactionModalVisible, setReactionModalVisible] = useState(false);
  const [selectedReactionEmoji, setSelectedReactionEmoji] = useState('');
  
  const [voteDetailsVisible, setVoteDetailsVisible] = useState(false);
  const [selectedVoteData, setSelectedVoteData] = useState(null);

  useEffect(() => {
    if (message.type === 'FILE') {
      const mediaUrls = message.mediaUrls || message.media_urls || [];
      const url = mediaUrls[0];
      if (url) {
        const fileName = url.split('/').pop();
        if (fileName) {
          const fileUri = FileSystem.cacheDirectory + fileName;
          FileSystem.getInfoAsync(fileUri).then(info => {
            setFileExists(info.exists);
          }).catch(() => setFileExists(false));
        }
      }
    }
  }, [message]);

  const openReactionDetail = (emoji) => {
    setSelectedReactionEmoji(emoji);
    setReactionModalVisible(true);
  };
  const closeReactionDetail = () => setReactionModalVisible(false);

  const getReactionUserName = (userId) => {
    const id = String(userId || '');
    if (!id) return 'Người dùng';
    if (id === currentUserIdStr) return 'Bạn';
    const found = conversations
      .flatMap(conv => conv.members || conv.participants || [])
      .find(member => String(member.userId || member.id || '') === id);
    return found?.fullName || found?.name || found?.username || 'Người dùng';
  };

  const translateX = useRef(new Animated.Value(0)).current;
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dx) > 10 && Math.abs(gestureState.dy) < 10,
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dx < 0) {
          const limitedDx = Math.max(gestureState.dx, -30);
          translateX.setValue(limitedDx);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx < -10) dispatch(setReplyingTo(message));
        Animated.spring(translateX, { toValue: 0, useNativeDriver: true, tension: 100, friction: 8 }).start();
      },
      onPanResponderTerminate: () => Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start()
    })
  ).current;

  const getAvatarUrl = (url, name) => {
    if (!url) return `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'U')}&background=random&color=fff&size=128&bold=true`;
    if (typeof url !== 'string') return url;
    if (url.startsWith('http')) return url;
    return `${BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
  };

  const getFullUrl = (url) => {
    if (!url || typeof url !== 'string') return '';
    if (url.startsWith('http') || url.startsWith('file://') || url.startsWith('blob:') || url.startsWith('data:')) return url;
    return `${BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
  };

  const senderInfo = useMemo(() => {
    if (isOwn) return null;
    const msgSenderId = String(message.senderId || '');
    for (const conv of conversations) {
      const members = conv.members || conv.participants || [];
      const found = members.find(m => String(m.userId || m.id || '') === msgSenderId);
      if (found) return found;
    }
    return null;
  }, [conversations, message.senderId, isOwn]);

  const avatarUrl = getAvatarUrl(
    senderInfo?.avatarUrl || senderInfo?.avatar || senderInfo?.profilePic || message.senderAvatar,
    senderInfo?.fullName || senderInfo?.name || message.senderName
  );

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    try {
      const date = new Date(timestamp);
      return isNaN(date.getTime()) ? '' : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) { return ''; }
  };

  const mediaFiles = message.mediaUrls || message.media_urls || [];
  const firstMedia = mediaFiles[0];
  const isVoice = message.type === 'VOICE' || 
                 (message.content && message.content.match(/\.(webm|m4a|mp3|wav|ogg|opus)(\?|$)/i)) ||
                 (firstMedia && String(firstMedia).match(/\.(webm|m4a|mp3|wav|ogg|opus)(\?|$)/i));

  const reactionUserNamesFor = (emoji) => {
    if (!message.reactions || !message.reactions[emoji]) return [];
    return message.reactions[emoji].map(getReactionUserName);
  };

  const renderReactions = () => {
    if (!message.reactions || Object.keys(message.reactions).length === 0) return null;
    return (
      <View style={[styles.reactionsContainer, isOwn ? styles.ownReactions : styles.otherReactions]}>
        {Object.entries(message.reactions).map(([emoji, users]) => {
          if (!Array.isArray(users) || users.length === 0) return null;
          return (
            <TouchableOpacity key={emoji} style={styles.reactionBadge} activeOpacity={0.75} onPress={() => openReactionDetail(emoji)}>
              <Text style={styles.reactionEmoji}>{emoji}</Text>
              <Text style={styles.reactionCount}>{users.length > 1 ? users.length : ''}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  const renderReadReceipts = () => {
    if (!isOwn) return null;
    const readSource = Array.isArray(latestReadBy) && latestReadBy.length > 0 ? latestReadBy : [];
    if (readSource.length === 0) return null;
    const mapReader = (reader) => {
      if (reader && typeof reader === 'object') {
        return {
          id: String(reader.userId || reader.id || ''),
          avatarUrl: reader.avatarUrl || reader.avatar || null,
          name: reader.fullName || reader.name || reader.username || null,
        };
      }
      return { id: String(reader || ''), avatarUrl: null, name: null };
    };
    const msgSenderId = String(message.senderId || '');
    const readers = readSource.map(mapReader).filter((reader) => reader.id && reader.id !== msgSenderId).reduce((unique, reader) => {
        if (!unique.some((r) => r.id === reader.id)) unique.push(reader);
        return unique;
    }, []);
    if (readers.length === 0) return null;
    return (
      <View style={styles.readReceiptsContainer}>
        {readers.slice(0, 3).map((reader, index) => {
          let readerAvatar = reader.avatarUrl;
          if (!readerAvatar) {
            for (const conv of conversations) {
              const found = (conv.members || []).find(m => String(m.userId || m.id || '') === reader.id);
              if (found) { readerAvatar = getAvatarUrl(found.avatarUrl || found.avatar, found.fullName || found.name); break; }
            }
          }
          return (
            <Image key={`read-${reader.id}-${index}`} source={{ uri: readerAvatar || `https://ui-avatars.com/api/?name=U&background=ccc` }} style={[styles.readAvatar, { marginLeft: index > 0 ? -6 : 0, zIndex: 10 - index }]} />
          );
        })}
        {readers.length > 3 && (
          <View style={styles.moreReadersBadge}><Text style={styles.moreReadersText}>+{readers.length - 3}</Text></View>
        )}
      </View>
    );
  };

  const renderDeliveryStatus = () => {
    if (!isOwn || !showReadStatus) return null;
    const users = Array.isArray(latestReadBy) ? latestReadBy : [];
    const hasReadByOther = users.some((reader) => {
      const id = reader && typeof reader === 'object' ? String(reader.userId || reader.id || '') : String(reader || '');
      return id && id !== currentUserIdStr;
    });
    if (hasReadByOther) return null;
    const statusText = !isOnline ? 'Đã gửi' : 'Đã nhận';
    const iconName = !isOnline ? 'check' : 'check-circle';
    const iconColor = !isOnline ? '#6b7280' : '#4338ca';
    return (
      <View style={styles.deliveryStatus}>
        <MaterialIcons name={iconName} size={12} color={iconColor} />
        <Text style={[styles.deliveryStatusText, !isOnline ? styles.deliveryStatusSent : styles.deliveryStatusOnline]}>{statusText}</Text>
      </View>
    );
  };

  const handleOpenVoteDetails = (vote) => {
    setSelectedVoteData(vote);
    setVoteDetailsVisible(true);
  };

  const renderVoteContent = () => {
    if (message.type !== 'VOTE' || !message.vote) return null;
    
    // Tìm conversation hiện tại để check quyền admin
    const currentConv = conversations.find(c => String(c.conversationId) === String(message.conversationId));
    const meId = currentUserIdStr;
    
    const myRole = currentConv?.members?.find(m => String(m.userId || m.id) === meId)?.role;
    const isAdmin = myRole === 'ADMIN' || myRole === 'OWNER';

    return (
      <VoteMessage
        message={message}
        currentUserId={meId}
        isMe={isOwn}
        isAdmin={isAdmin}
        onVote={(msgId, optId, mult, sel) => {
          onPressMessage?.({ action: 'VOTE', messageId: msgId, optionId: optId, allowMultiple: mult, currentSelection: sel });
        }}
        onCloseVote={(msgId) => {
          onPressMessage?.({ action: 'CLOSE_VOTE', messageId: msgId });
        }}
        onViewDetails={handleOpenVoteDetails}
      />
    );
  };

  if (message.type === 'SYSTEM' || String(message.senderId) === 'SYSTEM') {
    return (
      <View style={styles.systemMessageContainer}>
        <View style={styles.systemMessageWrapper}>
          <View style={styles.systemDot} />
          <Text style={styles.systemMessageText}>{message.content?.toUpperCase() || 'THÔNG BÁO HỆ THỐNG'}</Text>
          <View style={styles.systemDot} />
        </View>
      </View>
    );
  }

  return (
    <Animated.View {...panResponder.panHandlers} style={[styles.container, isOwn ? styles.ownContainer : styles.otherContainer, { transform: [{ translateX }] }]}>
      {!isOwn && (
        <TouchableOpacity style={styles.avatarContainer} onPress={() => router.push(`/chat-info/${encodeURIComponent(message.conversationId)}`)}>
          <Image source={{ uri: avatarUrl }} style={styles.avatar} />
        </TouchableOpacity>
      )}

      <TouchableOpacity activeOpacity={message.isRecalled ? 1 : 0.8} onPress={() => !message.isRecalled && onPressMessage?.(message)} onLongPress={() => !message.isRecalled && onLongPress?.()} style={[styles.messageWrapper, isOwn ? styles.ownWrapper : styles.otherWrapper]}>
        {!isOwn && <Text style={styles.senderName}>{senderInfo?.fullName || senderInfo?.name || message.senderName || 'User'}</Text>}
        
        <View style={[styles.bubbleContainer, isOwn ? { alignSelf: 'flex-end' } : { alignSelf: 'flex-start' }]}>
          <Animated.View style={[styles.bubble, isOwn ? styles.ownBubble : styles.otherBubble, isVoice && { paddingVertical: 6, paddingHorizontal: 10 }, { borderColor: highlightBorder, borderWidth: 2 }]}>
            {message.forwardedFrom && (
              <View style={[styles.forwardedIndicator, isOwn ? { justifyContent: 'flex-end' } : { justifyContent: 'flex-start' }]}>
                <MaterialIcons name="forward" size={14} color={isOwn ? 'rgba(255,255,255,0.7)' : '#6366f1'} />
                <Text style={[styles.forwardedText, isOwn ? { color: 'rgba(255,255,255,0.7)' } : { color: '#6366f1' }]}>Chuyển tiếp</Text>
              </View>
            )}
            {message.replyTo && (() => {
              const r = message.replyTo;
              let mediaUrls = r.mediaUrls || r.media_urls || [];
              let type = r.type || '';
              let content = r.content || r.text || '';
              if (mediaUrls.length === 0 || !type) {
                const originalMsg = allMessages?.find(m => m.messageId === r.messageId);
                if (originalMsg) {
                  if (mediaUrls.length === 0) mediaUrls = originalMsg.mediaUrls || originalMsg.media_urls || [];
                  if (!type) type = originalMsg.type || '';
                  if (!content) content = originalMsg.content || '';
                }
              }
              const senderId = r.senderId || r.sender_id || '';
              if (!type && mediaUrls.length > 0) {
                const firstUrl = mediaUrls[0].toLowerCase();
                if (firstUrl.match(/\.(mp4|webm|ogg|mov)/i)) type = 'VIDEO';
                else if (firstUrl.match(/\.(jpg|jpeg|png|gif|webp|svg)/i)) type = 'IMAGE';
                else type = 'FILE';
              }
              const isVoiceReply = type === 'VOICE' || (content && (content.includes('voice-messages/') || content.match(/\.(webm|m4a|mp3|wav|ogg|opus)(\?|$)/i))) || (mediaUrls.length > 0 && String(mediaUrls[0]).match(/\.(webm|m4a|mp3|wav|ogg|opus)(\?|$)/i));
              const isImageReply = type === 'IMAGE' || (type !== 'VIDEO' && type !== 'FILE' && type !== 'VOICE' && mediaUrls.length > 0 && !isVoiceReply);
              const isVideoReply = type === 'VIDEO';
              const isFileReply = type === 'FILE';
              const getFileConfig = (u) => {
                const ext = String(u).split('.').pop().split('?')[0].toLowerCase();
                if (ext === 'pdf') return { color: '#ef4444', icon: 'file-pdf-box' };
                if (['doc', 'docx'].includes(ext)) return { color: '#3b82f6', icon: 'file-word-box' };
                if (['xls', 'xlsx'].includes(ext)) return { color: '#10b981', icon: 'file-excel-box' };
                if (['zip', 'rar', '7z'].includes(ext)) return { color: '#f59e0b', icon: 'zip-box' };
                return { color: '#6366f1', icon: 'file-document-outline' };
              };
              const thumbUrl = (isImageReply || isVideoReply) && mediaUrls[0] ? (mediaUrls[0].startsWith('http') ? mediaUrls[0] : `${BASE_URL}${mediaUrls[0].startsWith('/') ? '' : '/'}${mediaUrls[0]}`) : null;
              let typeLabel = '[Tin nhắn]';
              if (isVoiceReply) typeLabel = 'Tin nhắn thoại';
              else if (isImageReply) typeLabel = '[Hình ảnh]';
              else if (isVideoReply) typeLabel = '[Video]';
              else if (isFileReply) {
                const fileName = mediaUrls[0]?.split('/').pop().split('?')[0].replace(/^[0-9a-f-]{36}_/, '');
                typeLabel = fileName ? decodeURIComponent(fileName) : '[Tệp tin]';
              }
              const displayReplyText = isVoiceReply ? 'Tin nhắn thoại' : (content.trim() || typeLabel);
              return (
                <TouchableOpacity activeOpacity={0.7} onPress={() => onPressMessage?.(r.messageId)} style={[styles.replyBubble, isOwn ? styles.ownReplyBubble : styles.otherReplyBubble]}>
                  <View style={styles.replyLine} />
                  {isFileReply && mediaUrls[0] ? (
                    <View style={[styles.replyThumbnail, { backgroundColor: getFileConfig(mediaUrls[0]).color, alignItems: 'center', justifyContent: 'center' }]}><MaterialCommunityIcons name={getFileConfig(mediaUrls[0]).icon} size={18} color="#fff" /></View>
                  ) : thumbUrl ? (
                    <Image source={{ uri: thumbUrl }} style={styles.replyThumbnail} resizeMode="cover" />
                  ) : isVoiceReply ? (
                    <View style={[styles.replyThumbnail, { backgroundColor: 'rgba(102, 126, 234, 0.1)', alignItems: 'center', justifyContent: 'center' }]}><MaterialIcons name="mic" size={16} color="#667eea" /></View>
                  ) : null}
                  <View style={styles.replyContent}>
                    <Text style={styles.replySender} numberOfLines={1}>
                      {(() => {
                        const currentMeId = String(user?.userId || user?.id || '');
                        if (String(senderId) === currentMeId) return 'Bạn';
                        let name = r.senderName || r.sender_name;
                        for (const conv of conversations) {
                          const found = (conv.members || []).find(m => String(m.userId || m.id || '') === String(senderId));
                          if (found) { name = found.fullName || found.name; break; }
                        }
                        return name || 'Người dùng';
                      })()}
                    </Text>
                    <Text style={styles.replyText} numberOfLines={1}>{displayReplyText}</Text>
                  </View>
                </TouchableOpacity>
              );
            })()}

            {!message.isRecalled && (() => {
              const mediaUrls = message.mediaUrls || message.media_urls || [];
              if (mediaUrls.length === 0 || message.type === 'VOICE') return null;
              if (message.type === 'FILE') {
                const url = mediaUrls[0];
                if (!url) return null;
                const fileName = url.split('/').pop();
                const ext = fileName.split('.').pop().toUpperCase();
                const getFileColor = (u) => {
                  const e = u.split('.').pop().toLowerCase();
                  if (e === 'pdf') return '#ef4444';
                  if (['doc', 'docx'].includes(e)) return '#3b82f6';
                  if (['xls', 'xlsx'].includes(e)) return '#10b981';
                  if (['zip', 'rar', '7z'].includes(e)) return '#f59e0b';
                  return '#6366f1';
                };
                return (
                  <TouchableOpacity style={[styles.fileBubble, isOwn ? styles.ownFileBubble : styles.otherFileBubble]} onPress={async () => {
                      const fullUrl = getFullUrl(url);
                      const cleanName = decodeURIComponent(fileName.replace(/^[0-9a-f-]{36}_/, ''));
                      setSelectedFile({ url: fullUrl, name: cleanName });
                      setFileViewerVisible(true);
                  }}>
                    <View style={[styles.fileIconBig, { backgroundColor: getFileColor(url) }]}><Text style={styles.fileIconText}>{ext}</Text></View>
                    <View style={styles.fileInfo}>
                      <Text style={[styles.fileName, { color: isOwn ? '#fff' : '#1e293b' }]} numberOfLines={1}>{decodeURIComponent(fileName.replace(/^[0-9a-f-]{36}_/, ''))}</Text>
                      <View style={styles.fileStatusRow}>
                        <Text style={[styles.fileSize, { color: isOwn ? 'rgba(255,255,255,0.7)' : '#64748b' }]}>{ext} • 22 KB</Text>
                        {fileExists && <View style={styles.downloadedBadge}><MaterialIcons name="check-circle" size={12} color="#10b981" /><Text style={styles.downloadedText}>Đã có trên máy</Text></View>}
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              }
              const total = mediaUrls.length;
              const renderGridItem = (url, index, gridStyle) => {
                const fullUrl = getFullUrl(url);
                const isLastItem = index === 3 && total > 4;
                return (
                  <TouchableOpacity key={index} activeOpacity={0.9} style={[styles.gridImageContainer, gridStyle]} onPress={() => { setSelectedMediaIndex(index); setMediaViewerVisible(true); }}>
                    {message.type === 'VIDEO' ? <VideoThumbnail videoUrl={fullUrl} style={styles.gridImage} /> : <Image source={{ uri: fullUrl }} style={styles.gridImage} resizeMode="cover" />}
                    {isLastItem && <View style={styles.moreImagesOverlay}><Text style={styles.moreImagesText}>+{total - 4}</Text></View>}
                  </TouchableOpacity>
                );
              };
              let gridContent = null;
              if (total === 1) gridContent = renderGridItem(mediaUrls[0], 0, styles.singleImage);
              else if (total === 2) gridContent = (<View style={styles.row}>{renderGridItem(mediaUrls[0], 0, styles.halfImage)}{renderGridItem(mediaUrls[1], 1, styles.halfImage)}</View>);
              else if (total === 3) gridContent = (<View style={styles.row}>{renderGridItem(mediaUrls[0], 0, styles.twoThirdImage)}<View style={styles.column}>{renderGridItem(mediaUrls[1], 1, styles.oneThirdImage)}{renderGridItem(mediaUrls[2], 2, styles.oneThirdImage)}</View></View>);
              else gridContent = (<View style={styles.grid2x2}><View style={styles.row}>{renderGridItem(mediaUrls[0], 0, styles.quarterImage)}{renderGridItem(mediaUrls[1], 1, styles.quarterImage)}</View><View style={styles.row}>{renderGridItem(mediaUrls[2], 2, styles.quarterImage)}{renderGridItem(mediaUrls[3], 3, styles.quarterImage)}</View></View>);
              return <View style={styles.mediaGridContainer}>{gridContent}</View>;
            })()}

            {message.isRecalled ? (
              <View style={styles.recalledContent}>
                <MaterialIcons name="history" size={16} color={isOwn ? 'rgba(255,255,255,0.7)' : '#9ca3af'} style={{ marginRight: 4 }} />
                <Text style={[styles.text, styles.recalledText, isOwn ? styles.ownRecalledText : styles.otherRecalledText]}>Tin nhắn đã bị thu hồi</Text>
              </View>
            ) : (
              (() => {
                if (isVoice) {
                  const voiceUrl = firstMedia || message.content;
                  const fullVoiceUrl = getFullUrl(voiceUrl);
                  if (!fullVoiceUrl) return null;
                  return <VoicePlayer url={fullVoiceUrl} isOwn={isOwn} />;
                }
                if (message.type === 'CALL_LOG') {
                  try {
                    const callData = typeof message.content === 'string' ? JSON.parse(message.content) : (message.content || {});
                    const isMe = isOwn;
                    const cType = callData.callType || 'audio';
                    const status = callData.status;
                    const duration = callData.duration || 0;
                    
                    let title = '';
                    let subtitle = '';
                    let iconColor = isOwn ? '#fff' : '#64748b';
                    let iconName = 'phone';

                    if (isMe) {
                      title = cType === 'video' ? 'Cuộc gọi video đi' : 'Cuộc gọi thoại đi';
                      iconName = 'phone-outgoing';
                      if (status === 'SUCCESS') {
                        const mins = Math.floor(duration / 60);
                        const secs = duration % 60;
                        subtitle = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
                        iconColor = isOwn ? '#fff' : '#60A5FA';
                      } else {
                        subtitle = status === 'REJECTED' ? 'Cuộc gọi bị từ chối' : 'Cuộc gọi không được trả lời';
                        iconColor = isOwn ? 'rgba(255,255,255,0.8)' : '#F87171';
                      }
                    } else {
                      if (status === 'SUCCESS') {
                        title = cType === 'video' ? 'Cuộc gọi video đến' : 'Cuộc gọi thoại đến';
                        iconName = 'phone-incoming';
                        const mins = Math.floor(duration / 60);
                        const secs = duration % 60;
                        subtitle = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
                        iconColor = isOwn ? '#fff' : '#10B981';
                      } else {
                        title = cType === 'video' ? 'Cuộc gọi video nhỡ' : 'Cuộc gọi thoại nhỡ';
                        iconName = 'phone-missed';
                        subtitle = status === 'REJECTED' ? 'Cuộc gọi bị từ chối' : 'Cuộc gọi nhỡ';
                        iconColor = '#EF4444';
                      }
                    }

                    const isMissedIncoming = !isMe && status !== 'SUCCESS';

                    return (
                      <View style={styles.callLogContainer}>
                        <Text style={[
                          styles.callLogTitle, 
                          isMissedIncoming && styles.missedCallTitle, 
                          isOwn ? styles.ownText : styles.otherText
                        ]}>
                          {title}
                        </Text>
                        <View style={styles.callLogBody}>
                          <MaterialCommunityIcons 
                            name={iconName} 
                            size={20} 
                            color={iconColor} 
                          />
                          <Text style={[styles.callLogStatus, isOwn ? styles.ownText : styles.otherText]}>
                            {subtitle}
                          </Text>
                        </View>
                        <View style={[styles.callLogDivider, { backgroundColor: isOwn ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)' }]} />
                        <TouchableOpacity 
                          style={styles.callBackBtn}
                          onPress={() => onPressMessage?.({ ...message, action: 'CALL_BACK', callType: callData.callType || 'audio' })}
                        >
                          <Text style={[styles.callBackText, { color: isOwn ? '#fff' : '#6366f1' }]}>Gọi lại</Text>
                        </TouchableOpacity>
                      </View>
                    );
                  } catch (e) { return <Text style={[styles.text, isOwn ? styles.ownText : styles.otherText]}>{message.content}</Text>; }
                }
                if (message.type === 'VOTE') {
                  return renderVoteContent();
                }
                return message.content ? (
                  <Text style={[styles.text, isOwn ? styles.ownText : styles.otherText, (message.mediaUrls?.length > 0) && { marginTop: 8 }]}>{message.content}</Text>
                ) : null;
              })()
            )}
            <Text style={[styles.timeInside, isOwn ? styles.ownTime : styles.otherTime]}>{formatTime(message.createdAt || Date.now())}</Text>
          </Animated.View>
          {renderReactions()}
        </View>

        <View style={[styles.statusContainer, isOwn ? styles.ownStatus : styles.otherStatus, (message.reactions && Object.keys(message.reactions).length > 0) && { marginTop: 22 }]}>
          {renderReadReceipts()}
          {renderDeliveryStatus()}
        </View>
      </TouchableOpacity>

      <Modal visible={reactionModalVisible} transparent animationType="fade" onRequestClose={closeReactionDetail}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Chi tiết cảm xúc</Text>
              <TouchableOpacity onPress={closeReactionDetail} style={styles.closeButton}><Ionicons name="close" size={22} color="#fff" /></TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <View style={styles.modalEmojiColumn}>
                {Object.entries(message.reactions || {}).map(([emoji, users]) => (
                  <TouchableOpacity key={emoji} style={[styles.modalEmojiButton, selectedReactionEmoji === emoji && styles.modalEmojiButtonActive]} onPress={() => setSelectedReactionEmoji(emoji)}>
                    <Text style={styles.modalEmoji}>{emoji}</Text>
                    <Text style={styles.modalEmojiCount}>{Array.isArray(users) ? users.length : 0}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.modalUserColumn}>
                <Text style={styles.modalSectionLabel}>Người đã chọn</Text>
                <ScrollView contentContainerStyle={styles.modalUserList}>
                  {(reactionUserNamesFor(selectedReactionEmoji) || []).length > 0 ? (
                    reactionUserNamesFor(selectedReactionEmoji).map((name, index) => (
                      <View key={`${selectedReactionEmoji}-${index}`} style={styles.modalUserItem}><Text style={styles.modalUserText}>{name}</Text></View>
                    ))
                  ) : (
                    <View style={styles.modalUserItem}><Text style={styles.modalUserText}>Chưa có ai phản ứng</Text></View>
                  )}
                </ScrollView>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      <MediaViewer visible={mediaViewerVisible} onClose={() => setMediaViewerVisible(false)} allMedia={(message.mediaUrls || message.media_urls || []).map(url => ({ url: getFullUrl(url), type: message.type }))} initialIndex={selectedMediaIndex} />
      <FileViewerModal visible={fileViewerVisible} onClose={() => setFileViewerVisible(false)} fileUrl={selectedFile.url} fileName={selectedFile.name} />
      
      <VoteDetailsModal 
        visible={voteDetailsVisible} 
        onClose={() => setVoteDetailsVisible(false)} 
        vote={selectedVoteData} 
      />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: { marginVertical: 4, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'flex-end' },
  ownContainer: { justifyContent: 'flex-end' },
  otherContainer: { justifyContent: 'flex-start' },
  avatarContainer: { marginRight: 8, marginBottom: 20 },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#eee' },
  messageWrapper: { maxWidth: '75%', marginBottom: 4 },
  ownWrapper: { alignItems: 'flex-end' },
  otherWrapper: { alignItems: 'flex-start' },
  senderName: { fontSize: 11, color: '#6b7280', marginBottom: 2, marginLeft: 4 },
  bubbleContainer: { position: 'relative', zIndex: 1, paddingBottom: 0 },
  bubble: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 20 },
  ownBubble: { backgroundColor: '#667eea', borderBottomRightRadius: 4 },
  otherBubble: { backgroundColor: '#f3f4f6', borderBottomLeftRadius: 4 },
  text: { fontSize: 15, lineHeight: 20 },
  ownText: { color: '#fff' },
  otherText: { color: '#1f2937' },
  forwardedIndicator: { flexDirection: 'row', alignItems: 'center', marginBottom: 4, gap: 4, opacity: 0.8 },
  forwardedText: { fontSize: 11, fontStyle: 'italic', fontWeight: '600' },
  timeInside: { fontSize: 10, marginTop: 2, alignSelf: 'flex-end', minWidth: 45, textAlign: 'right' },
  ownTime: { color: 'rgba(255, 255, 255, 0.7)' },
  otherTime: { color: '#9ca3af' },
  statusContainer: { marginTop: 6, minHeight: 22, zIndex: 1 },
  ownStatus: { alignItems: 'flex-end', paddingRight: 4 },
  otherStatus: { alignItems: 'flex-start', paddingLeft: 4 },
  deliveryStatus: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 4 },
  deliveryStatusText: { fontSize: 11, marginLeft: 4, letterSpacing: 0.2 },
  deliveryStatusOnline: { color: '#4338ca' },
  deliveryStatusSent: { color: '#6b7280' },
  replyBubble: { flexDirection: 'row', borderRadius: 8, padding: 8, marginBottom: 6, minWidth: 150, alignSelf: 'stretch' },
  ownReplyBubble: { backgroundColor: 'rgba(255, 255, 255, 1)' },
  otherReplyBubble: { backgroundColor: 'rgba(0, 0, 0, 0.05)' },
  replyLine: { width: 3, backgroundColor: '#667eea', borderRadius: 2, marginRight: 8 },
  replyContent: { flex: 1, justifyContent: 'center' },
  replySender: { fontSize: 12, fontWeight: '700', color: '#667eea', marginBottom: 2 },
  replyText: { fontSize: 12, color: '#6b7280' },
  replyThumbnail: { width: 30, height: 30, borderRadius: 4, marginRight: 8 },
  reactionsContainer: { position: 'absolute', bottom: -18, flexDirection: 'row', zIndex: 10, elevation: 4 },
  ownReactions: { right: 0 },
  otherReactions: { left: 0 },
  readReceiptsContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 4, marginBottom: 2 },
  readAvatar: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: '#fff' },
  moreReadersBadge: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#f3f4f6', justifyContent: 'center', alignItems: 'center', marginLeft: -6, borderWidth: 1.5, borderColor: '#fff' },
  moreReadersText: { fontSize: 10, fontWeight: 'bold', color: '#6b7280' },
  reactionBadge: { backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 6, paddingVertical: 2, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#e5e7eb', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 1 },
  reactionEmoji: { fontSize: 12 },
  reactionCount: { fontSize: 10, fontWeight: '700', marginLeft: 2, color: '#6b7280' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  modalContent: { width: '100%', maxWidth: 520, borderRadius: 24, overflow: 'hidden', backgroundColor: '#0f172a' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' },
  modalTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  closeButton: { padding: 8 },
  modalBody: { flexDirection: 'row', minHeight: 220 },
  modalEmojiColumn: { width: 90, paddingVertical: 14, paddingHorizontal: 10, backgroundColor: '#111827', borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.08)' },
  modalEmojiButton: { marginBottom: 10, backgroundColor: '#0f172a', borderRadius: 18, paddingVertical: 10, paddingHorizontal: 8, alignItems: 'center' },
  modalEmojiButtonActive: { backgroundColor: '#2563eb' },
  modalEmoji: { fontSize: 20 },
  modalEmojiCount: { fontSize: 11, color: '#9ca3af', marginTop: 4 },
  modalUserColumn: { flex: 1, padding: 16 },
  modalSectionLabel: { color: '#94a3b8', marginBottom: 12, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  modalUserList: { paddingBottom: 18 },
  modalUserItem: { marginBottom: 10, backgroundColor: '#1e293b', borderRadius: 18, paddingVertical: 12, paddingHorizontal: 14 },
  modalUserText: { color: '#fff', fontSize: 14 },
  recalledContent: { flexDirection: 'row', alignItems: 'center' },
  recalledText: { fontStyle: 'italic' },
  ownRecalledText: { color: 'rgba(255,255,255,0.7)' },
  otherRecalledText: { color: '#9ca3af' },
  mediaGridContainer: { width: 260, borderRadius: 16, overflow: 'hidden', marginVertical: 4, backgroundColor: 'rgba(0,0,0,0.05)' },
  row: { flexDirection: 'row' },
  column: { flexDirection: 'column', flex: 1 },
  gridImageContainer: { padding: 1, overflow: 'hidden' },
  gridImage: { width: '100%', height: '100%', backgroundColor: '#e5e7eb' },
  singleImage: { width: 260, height: 320 },
  halfImage: { width: 130, height: 180 },
  twoThirdImage: { width: 173, height: 240 },
  oneThirdImage: { width: 87, height: 120 },
  grid2x2: { width: 260, height: 260 },
  quarterImage: { width: 130, height: 130 },
  moreImagesOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },
  moreImagesText: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
  playIconOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.2)' },
  fileBubble: { flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: 12, minWidth: 240, maxWidth: '100%', marginVertical: 4, borderWidth: 1 },
  ownFileBubble: { backgroundColor: 'rgba(255,255,255,0.15)', borderColor: 'rgba(255,255,255,0.2)' },
  otherFileBubble: { backgroundColor: '#fff', borderColor: '#e2e8f0', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 2 },
  fileIconBig: { width: 44, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  fileIconText: { color: '#fff', fontSize: 10, fontWeight: '900' },
  fileInfo: { flex: 1, marginLeft: 12 },
  fileName: { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  fileStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  fileSize: { fontSize: 11, fontWeight: '500' },
  downloadedBadge: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  downloadedText: { fontSize: 10, fontWeight: '600', color: '#10b981' },
  systemMessageContainer: { width: '100%', alignItems: 'center', marginVertical: 12, paddingHorizontal: 20 },
  systemMessageWrapper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0, 0, 0, 0.05)', paddingVertical: 6, paddingHorizontal: 16, borderRadius: 20, gap: 8 },
  systemDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#6366f1', opacity: 0.6 },
  systemMessageText: { fontSize: 11, fontWeight: '800', color: '#64748b', letterSpacing: 0.5, textAlign: 'center' },
  callLogContainer: { minWidth: 200, padding: 4 },
  callLogTitle: { fontSize: 15, fontWeight: '700', marginBottom: 8 },
  callLogBody: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  callLogStatus: { fontSize: 14, opacity: 0.9 },
  callLogDivider: { height: 1, marginBottom: 8 },
  callBackBtn: { alignItems: 'center', paddingVertical: 4 },
  callBackText: { fontWeight: '600', fontSize: 14 },
  missedCallTitle: { color: '#ef4444' },
});

export default React.memo(ChatBubble);
