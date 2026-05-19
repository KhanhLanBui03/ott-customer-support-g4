import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, Image, ActivityIndicator, Alert, ImageBackground } from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { MaterialIcons, Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useDispatch, useSelector } from 'react-redux';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import MessageList from '../../../src/components/MessageList';
import MessageInput from '../../../src/components/MessageInput';
import MessageModal from '../../../src/components/MessageModal';
import { fetchMessages, fetchConversationDetail, sendMessage, setCurrentConversation, clearCurrentConversation, getRealId, fetchConversations, setReplyingTo, clearReplyingTo, toggleMessageReaction, markConversationRead, recallMessage, deleteMessage, pinMessage, unpinMessage } from '../../../src/store/chatSlice';
import { useWebSocket } from '../../../src/hooks/useWebSocket';
import { conversationApi, chatApi } from '../../../src/api/chatApi';
import CreateVoteModal from '../../../src/components/CreateVoteModal';
import { formatLastSeen } from '../../../src/utils/dateUtils';
import ForwardModal from '../../../src/components/ForwardModal';
import { useAgoraCall } from '../../../src/hooks/useAgoraCall';
import CallCountdownModal from '../../../src/components/CallCountdownModal';
import { useTheme } from '../../../src/context/ThemeContext';



const ChatDetailScreen = () => {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  const dispatch = useDispatch();
  const router = useRouter();
  const { id: rawConversationId, name: paramName, avatar: paramAvatar, type: paramType } = useLocalSearchParams();
  const conversationId = useMemo(() => decodeURIComponent(rawConversationId || ''), [rawConversationId]);

  const [selectedMessage, setSelectedMessage] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [createVoteModalVisible, setCreateVoteModalVisible] = useState(false);
  const [forwardModalVisible, setForwardModalVisible] = useState(false);
  const [showAllPins, setShowAllPins] = useState(false);

  // KÍCH HOẠT WEBSOCKET TRỰC TIẾP TẠI ĐÂY
  const { sendMessageRealtime, sendReadReceipt, sendTypingStart, sendTypingStop } = useWebSocket();

  // Track screen focus state - khi screen mất focus (user back ra), chặn read receipts
  const isFocusedRef = React.useRef(true);

  const chatState = useSelector((state) => state.chat);
  const currentUser = useSelector((state) => state.auth.user);
  const conversations = chatState.conversations || [];

  // Xác định ID chuẩn
  const realId = useMemo(() => getRealId(chatState, conversationId, currentUser?.userId || currentUser?.id), [chatState, conversationId, currentUser]);
  const messages = chatState.messages[realId] || [];
  const conversation = conversations.find(c => c.conversationId === realId);

  const wallpaperUrl = conversation?.wallpaperUrl || null;
  const isLoading = chatState.loading;

  const myRole = useMemo(() =>
    conversation?.members?.find(m => String(m.userId || m.id) === String(currentUser?.userId || currentUser?.id))?.role || 'MEMBER',
    [conversation, currentUser]
  );
  const isAdmin = myRole === 'OWNER' || myRole === 'ADMIN';
  const isRestricted = conversation?.onlyAdminsCanChat && !isAdmin;

  // Ref để truy cập messages mới nhất bên trong useFocusEffect mà không cần thêm deps
  const messagesRef = React.useRef(messages);
  React.useEffect(() => { messagesRef.current = messages; }, [messages]);

  // Effect 1: Tải dữ liệu ban đầu - chỉ chạy khi conversationId thay đổi
  useEffect(() => {
    if (!conversationId || !currentUser) return;

    // Đồng bộ danh sách hội thoại nếu cần
    if (conversations.length === 0) {
      dispatch(fetchConversations());
    }

    // Tải chi tiết cuộc hội thoại và tin nhắn song song
    dispatch(fetchConversationDetail(conversationId));
    dispatch(fetchMessages(conversationId));
  }, [conversationId, currentUser?.userId, currentUser?.id, dispatch]);

  // Effect 2: Xử lý focus/blur - CORE LOGIC cho seen/delivered
  // Y như web: vào chat = set active + gửi read receipt (→ seen)
  //           rời chat = clear active (→ đã nhận)
  useFocusEffect(
    useCallback(() => {
      // === KHI SCREEN ĐƯỢC FOCUS (user vào/quay lại chat) ===
      isFocusedRef.current = true;
      console.log('[Chat] Screen gained focus, realId:', realId);

      if (realId) {
        // 1. Set conversation hiện tại để useWebSocket auto-read cho tin nhắn mới
        dispatch(setCurrentConversation(realId));

        // 2. Reset unread count local
        dispatch(markConversationRead(realId));

        // 3. Reset unread count trên server
        conversationApi.markAsRead(realId).catch(e =>
          console.warn('[Chat] markAsRead API error:', e.message)
        );

        // 4. Gửi read receipt cho tin nhắn mới nhất từ người khác
        //    → server broadcast MESSAGE_READ → web chuyển từ "Đã nhận" sang "seen"
        const myId = String(currentUser?.userId || currentUser?.id || '');
        const currentMessages = messagesRef.current;
        const latestFromOther = [...currentMessages].reverse().find(m =>
          String(m.senderId) !== myId &&
          m.messageId &&
          !String(m.messageId).startsWith('temp-')
        );
        if (latestFromOther) {
          console.log('[Chat] Sending read receipt for latest unread:', latestFromOther.messageId);
          sendReadReceipt(latestFromOther.messageId, realId);
        }
      }

      // === KHI SCREEN MẤT FOCUS (user rời chat) ===
      return () => {
        isFocusedRef.current = false;
        console.log('[Chat] Screen lost focus, clearing current conversation');
        dispatch(clearCurrentConversation());
        dispatch(clearReplyingTo());
      };
    }, [dispatch, realId, sendReadReceipt, currentUser?.userId, currentUser?.id])
  );

  // Call Actions
  const {
    startCall, acceptCall, endCall, cancelCountdown,
    callStatus, callType, countdown, showCountdown
  } = useAgoraCall(realId, conversation, false);

  const handleStartCall = (type, isJoin = false, startTime = null) => {

    startCall(type, {
      isJoin,
      startTime,
      name: conversation?.name || displayName || 'Nhóm chat',
      avatar: conversation?.avatar || conversation?.avatarUrl || headerAvatarUrl

    });
  };

  const lastCallMsgRaw = useMemo(() => {
    return [...messages].reverse().find(m => m.type === 'CALL_LOG');
  }, [messages]);

  const lastCallMsg = useMemo(() => {
    if (!lastCallMsgRaw?.content) return null;
    try {
      return JSON.parse(lastCallMsgRaw.content);
    } catch (e) {
      return null;
    }
  }, [lastCallMsgRaw]);

  const isOngoingInChat = lastCallMsg?.status === 'ONGOING' && (conversation?.type === 'GROUP' || (realId && !realId.includes('SINGLE#')));
  const showOngoingBanner = isOngoingInChat && callStatus === 'idle';

  console.log('💎 [ChatDetailScreen] Render values - callStatus:', callStatus, 'isOngoingInChat:', isOngoingInChat, 'showOngoingBanner:', showOngoingBanner);

  useEffect(() => {
    console.log('[DEBUG-BANNER] ------------------');
    console.log('[DEBUG-BANNER] conversationId:', conversationId);
    console.log('[DEBUG-BANNER] realId:', realId);
    console.log('[DEBUG-BANNER] messages count:', messages?.length);
    console.log('[DEBUG-BANNER] lastCallMsgRaw:', lastCallMsgRaw);
    console.log('[DEBUG-BANNER] lastCallMsg:', lastCallMsg);
    console.log('[DEBUG-BANNER] conversation type:', conversation?.type);
    console.log('[DEBUG-BANNER] callStatus:', callStatus);
    console.log('[DEBUG-BANNER] isOngoingInChat:', isOngoingInChat);
    console.log('[DEBUG-BANNER] showOngoingBanner:', showOngoingBanner);
    console.log('[DEBUG-BANNER] ------------------');
  }, [conversationId, realId, messages, lastCallMsgRaw, lastCallMsg, conversation, callStatus, isOngoingInChat, showOngoingBanner]);


  // Wrap sendReadReceipt - chỉ gửi khi screen đang focused
  const guardedSendReadReceipt = useCallback((messageId, convId) => {
    if (!isFocusedRef.current) {
      return;
    }
    sendReadReceipt(messageId, convId);
  }, [sendReadReceipt]);

  // Effect 2: Refresh thông tin hội thoại định kỳ (avatar, status) - KHÔNG re-fetch messages
  useEffect(() => {
    const interval = setInterval(() => {
      dispatch(fetchConversations());
    }, 30000);

    return () => clearInterval(interval);
  }, [dispatch]);

  const getPinnedPreviewText = (pin) => {
    if (!pin) return '';
    if (pin.type === 'IMAGE') return '[Hình ảnh]';
    if (pin.type === 'VIDEO') return '[Video]';
    if (pin.type === 'AUDIO' || pin.type === 'VOICE') return '[Ghi âm]';
    if (pin.type === 'FILE') {
      // Thường content của FILE message là tên file
      return pin.content || '[Tệp tin]';
    }
    return pin.content || 'Tin nhắn';
  };

  const flatListRef = useRef(null);
  const messageInputRef = useRef(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState(null);


  const handleScrollToMessage = (messageId) => {
    if (!messages || messages.length === 0 || !flatListRef.current) return;

    // Với danh sách inverted, index của reversedMessages chính là vị trí ta cần
    const index = [...messages].reverse().findIndex(m => m.messageId === messageId);
    if (index !== -1) {
      try {
        // Đảm bảo list đã render xong bằng cách dùng setTimeout hoặc requestAnimationFrame
        setTimeout(() => {
          if (flatListRef.current) {
            flatListRef.current.scrollToIndex({ index, animated: true, viewPosition: 0.5 });
            setHighlightedMessageId(messageId);
            setTimeout(() => setHighlightedMessageId(null), 2000);
          }
        }, 100);
      } catch (err) {
        console.warn('Scroll to message failed:', err);
      }
    }
  };

  const handleUnpinAll = () => {
    Alert.alert('Bỏ ghim tất cả', 'Bạn có chắc chắn muốn bỏ ghim tất cả tin nhắn trong cuộc hội thoại này?', [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Bỏ ghim hết',
        style: 'destructive',
        onPress: async () => {
          for (const pin of conversation.pinnedMessages) {
            await dispatch(unpinMessage({ messageId: pin.messageId, conversationId: realId }));
          }
        }
      }
    ]);
  };

  const handleUnpinSingle = (messageId) => {
    Alert.alert('Bỏ ghim', 'Bỏ ghim tin nhắn này?', [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Bỏ ghim',
        style: 'destructive',
        onPress: () => dispatch(unpinMessage({ messageId, conversationId: realId }))
      }
    ]);
  };

  const handleSendMessage = useCallback((content, replyToMessageId, type = 'TEXT', mediaUrls = []) => {
    const isMedia = mediaUrls.length > 0;
    if ((!content.trim() && !isMedia) || !realId) return;

    dispatch(sendMessage({
      conversationId: realId,
      content: content || '',
      type,
      replyToMessageId,
      mediaUrls
    }));
  }, [dispatch, realId]);

  const handlePressMessage = (message) => {
    if (!message || !realId) return;

    // Xử lý Vote
    if (message.action === 'VOTE') {
      let optionIds = [];
      if (message.allowMultiple) {
        const current = message.currentSelection || [];
        if (current.includes(message.optionId)) {
          // Nếu đã chọn rồi thì bỏ chọn
          optionIds = current.filter(id => id !== message.optionId);
        } else {
          // Nếu chưa chọn thì thêm vào danh sách
          optionIds = [...current, message.optionId];
        }
      } else {
        // Vote đơn thì chỉ gửi 1 optionId duy nhất
        optionIds = [message.optionId];
      }

      chatApi.submitVote(realId, message.messageId, { optionIds }).catch(e => {
        console.error('Submit vote error:', e);
        Alert.alert('Lỗi', 'Không thể gửi bình chọn. Vui lòng thử lại.');
      });
      return;
    }

    if (message.action === 'MENTION') {
      messageInputRef.current?.insertMention(message.user);
      return;
    }

    if (message.action === 'CLOSE_VOTE') {

      Alert.alert(
        'Xác nhận',
        'Bạn có chắc chắn muốn kết thúc cuộc bình chọn này?',
        [
          { text: 'Hủy', style: 'cancel' },
          {
            text: 'Kết thúc',
            style: 'destructive',
            onPress: () => chatApi.closeVote(realId, message.messageId).catch(e => {
              console.error('Close vote error:', e);
              Alert.alert('Lỗi', 'Không thể kết thúc bình chọn.');
            })
          }
        ]
      );
      return;
    }

    // Xử lý nút "Gọi lại" từ CALL_LOG
    if (message.action === 'CALL_BACK') {
      const isOngoing = message.isOngoing === true;
      handleStartCall(message.callType || 'audio', isOngoing, isOngoing ? message.startTime : null);
      return;
    }

    if (!message.messageId) return;
    if (String(message.senderId) === String(currentUser?.userId || currentUser?.id)) return;

    // Chỉ gửi read receipt khi người dùng thật sự click vào tin nhắn trong màn chat
    guardedSendReadReceipt(String(message.messageId), realId);
    dispatch(markConversationRead(realId));
  };

  const handleOpenPoll = () => {
    setCreateVoteModalVisible(true);
  };

  const handleCreateVote = async (voteData) => {
    try {
      setCreateVoteModalVisible(false);
      await chatApi.createVote(realId, voteData);
    } catch (err) {
      console.error('Failed to create vote:', err);
      Alert.alert('Lỗi', 'Không thể tạo cuộc bình chọn. Vui lòng thử lại.');
    }
  };

  const handleReaction = async (messageId, emoji) => {
    if (!realId || !messageId) return;

    const currentUserId = currentUser?.userId || currentUser?.id;
    const msg = messages.find(m => m.messageId === messageId);
    if (!msg) return;

    // Kiểm tra xem đã react với emoji này chưa
    const alreadyReacted = msg.reactions?.[emoji]?.some(uid => String(uid) === String(currentUserId));

    // 1. Optimistic Update: Cập nhật UI ngay lập tức
    dispatch(toggleMessageReaction({
      conversationId: realId,
      messageId,
      emoji,
      userId: currentUserId
    }));

    try {
      if (alreadyReacted) {
        await chatApi.removeReaction(messageId, realId, { emoji });
      } else {
        await chatApi.addReaction(messageId, realId, { emoji });
      }
    } catch (error) {
      // Nếu lỗi, thực hiện toggle lại để hoàn tác (revert)
      dispatch(toggleMessageReaction({
        conversationId: realId,
        messageId,
        emoji,
        userId: currentUserId
      }));
      console.error('Reaction error:', error);
    }
  };

  const displayName = useMemo(() => {
    if (conversation?.type === 'GROUP') return conversation.name || 'Nhóm chat';

    if (conversation?.type === 'SINGLE' || paramType === 'SINGLE' || (!conversation && paramName)) {
      const currentUserId = String(currentUser?.userId || currentUser?.id || '');
      const otherParticipant = (conversation?.members || []).find(p => {
        const pId = String(p.userId || p.id || '');
        return pId !== '' && pId !== currentUserId;
      });
      return otherParticipant?.fullName || otherParticipant?.name || otherParticipant?.username || paramName || 'Người dùng';
    }

    return conversation?.name || paramName || 'Chat';
  }, [conversation, currentUser, paramName, paramType]);

  const otherMember = useMemo(() => {
    if (conversation?.type !== 'SINGLE' && paramType !== 'SINGLE' && conversation) return null;
    const currentUserId = String(currentUser?.userId || currentUser?.id || '');
    return (conversation?.members || []).find(p => {
      const pId = String(p.userId || p.id || '');
      return pId !== '' && pId !== currentUserId;
    });
  }, [conversation, currentUser, paramType]);

  const friendshipStatus = otherMember?.friendshipStatus || 'NONE';

  const otherAvatar = useMemo(() => {
    if (conversation?.type === 'GROUP') return conversation.avatarUrl || conversation.avatar;
    return otherMember?.avatarUrl || otherMember?.avatar || otherMember?.profilePic || paramAvatar;
  }, [conversation, otherMember, paramAvatar]);

  const isOnline = useMemo(() => {
    if (conversation?.type === 'GROUP') return false;
    return String(otherMember?.status || '').toUpperCase() === 'ONLINE' || otherMember?.isOnline === true;
  }, [conversation, otherMember]);

  const onlineUsers = useMemo(() => {
    const currentUserIdStr = String(currentUser?.userId || currentUser?.id || '');
    return (conversation?.members || [])
      .filter(member => {
        const memberId = String(member.userId || member.id || '');
        return memberId && memberId !== currentUserIdStr &&
          (String(member.status || member.presence || '').toUpperCase() === 'ONLINE' || member.isOnline === true);
      })
      .map(member => String(member.userId || member.id || ''));
  }, [conversation, currentUser]);

  const headerAvatarUrl = otherAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=667eea&color=fff&size=128&bold=true`;

  const handleLoadMore = async () => {
    if (realId) {
      try {
        const result = await dispatch(fetchMessages({ conversationId: realId, loadMore: true })).unwrap();
        // Check if the backend returned any messages that we don't already have
        if (result?.messages && result.messages.length > 0) {
          const currentMsgs = messagesRef.current || [];
          const hasNew = result.messages.some(nm => !currentMsgs.some(em => em.messageId === nm.messageId));
          return hasNew;
        }
        return false;
      } catch (error) {
        console.error('Load more error:', error);
        return false;
      }
    }
    return false;
  };

  const handleLongPressMessage = (message) => {
    setSelectedMessage(message);
    setModalVisible(true);
  };

  const handleModalAction = (type, message) => {
    switch (type) {
      case 'reply':
        dispatch(setReplyingTo(message));
        break;
      case 'copy':
        // Sử dụng Clipboard an toàn
        try {
          const { Clipboard } = require('react-native');
          if (Clipboard && Clipboard.setString) {
            Clipboard.setString(message.content);
          } else {
            const { NativeModules } = require('react-native');
            if (NativeModules.Clipboard) {
              NativeModules.Clipboard.setString(message.content);
            }
          }
        } catch (e) {
          console.log('Clipboard not available');
        }
        break;
      case 'delete':
        Alert.alert('Xác nhận', 'Bạn có muốn xóa tin nhắn này ở phía bạn?', [
          { text: 'Hủy', style: 'cancel' },
          {
            text: 'Xóa',
            style: 'destructive',
            onPress: () => {
              dispatch(deleteMessage({
                messageId: message.messageId,
                conversationId: realId
              }));
            }
          }
        ]);
        break;
      case 'recall':
        Alert.alert('Thu hồi tin nhắn', 'Tin nhắn này sẽ bị thu hồi với tất cả mọi người. Bạn có chắc chắn?', [
          { text: 'Hủy', style: 'cancel' },
          {
            text: 'Thu hồi',
            style: 'destructive',
            onPress: () => {
              dispatch(recallMessage({
                messageId: message.messageId,
                conversationId: realId
              }));
            }
          }
        ]);
        break;
      case 'forward':
      case 'share':
        setForwardModalVisible(true);
        break;
      case 'pin':
        dispatch(pinMessage({ messageId: message.messageId, conversationId: realId }));
        break;
      case 'unpin':
        dispatch(unpinMessage({ messageId: message.messageId, conversationId: realId }));
        break;
      default:
        console.log('Action not implemented:', type);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={[styles.container, { backgroundColor: colors.background }]}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <View style={[styles.messagesHeader, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={28} color={colors.primary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.headerContent}
            onPress={() => router.push({
              pathname: `/chat-info/${encodeURIComponent(realId)}`,
              params: {
                name: displayName,
                avatar: otherAvatar || headerAvatarUrl,
                type: conversation?.type || paramType || 'SINGLE'
              }
            })}
          >
            <View style={styles.headerAvatarContainer}>
              <Image source={{ uri: headerAvatarUrl }} style={[styles.headerAvatar, { backgroundColor: colors.surface200 }]} />
              {isOnline && <View style={[styles.headerOnlineBadge, { borderColor: colors.background }]} />}
            </View>
            <View style={styles.headerInfo}>
              <View style={styles.nameRow}>
                <Text style={[styles.headerTitle, { color: colors.foreground }]} numberOfLines={1}>{displayName}</Text>
                {conversation?.type === 'SINGLE' && (
                  <View style={[
                    styles.miniTag,
                    friendshipStatus === 'ACCEPTED' ? styles.friendMiniTag : [styles.strangerMiniTag, isDark && { backgroundColor: colors.surface200, borderColor: colors.border }]
                  ]}>
                    <Text style={[
                      styles.miniTagText,
                      friendshipStatus === 'ACCEPTED' ? styles.friendMiniTagText : [styles.strangerMiniTagText, isDark && { color: colors.textSubtle }]
                    ]}>
                      {friendshipStatus === 'ACCEPTED' ? 'BẠN' : 'LẠ'}
                    </Text>
                  </View>
                )}
              </View>
              <Text style={[styles.headerStatus, isOnline ? styles.statusOnline : [styles.statusOffline, { color: colors.textSubtle }]]} numberOfLines={1}>
                {otherMember
                  ? formatLastSeen(otherMember.status || otherMember.presence, otherMember.lastSeenAt || otherMember.last_seen_at)
                  : (conversation?.type === 'GROUP'
                    ? `${conversation?.members?.length || 0} thành viên`
                    : (isOnline ? 'Đang hoạt động' : 'Ngoại tuyến')
                  )
                }
              </Text>
            </View>
          </TouchableOpacity>

          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.headerActionButton} onPress={() => handleStartCall('audio')}>
              <MaterialIcons name="call" size={24} color={colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerActionButton} onPress={() => handleStartCall('video')}>
              <MaterialIcons name="videocam" size={24} color={colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.headerActionButton}
              onPress={() => router.push({
                pathname: `/chat-info/${encodeURIComponent(realId)}`,
                params: {
                  name: displayName,
                  avatar: otherAvatar || headerAvatarUrl,
                  type: conversation?.type || paramType || 'SINGLE'
                }
              })}
            >
              <MaterialIcons name="info-outline" size={24} color={colors.primary} />
            </TouchableOpacity>
          </View>
        </View>


        {/* Ongoing Group Call Banner (Tham gia ngay) */}
        {showOngoingBanner && (
          <TouchableOpacity
            style={styles.ongoingCallContainer}
            onPress={() => handleStartCall(lastCallMsg?.callType || 'video', true, lastCallMsg?.startTime)}
          >
            <View style={styles.ongoingCallLeft}>
              <View style={styles.ongoingIconContainer}>
                <Feather name="video" size={20} color="#fff" />
                <View style={styles.ongoingOnlineDot} />
              </View>
              <View>
                <Text style={styles.ongoingCallTitle}>Cuộc gọi nhóm đang diễn ra</Text>
                <Text style={styles.ongoingCallSub}>Nhấn để tham gia cùng mọi người</Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.joinButton}
              onPress={() => handleStartCall(lastCallMsg?.callType || 'video', true, lastCallMsg?.startTime)}
            >
              <Text style={styles.joinButtonText}>Tham gia ngay</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        )}



        {conversation?.pinnedMessages?.length > 0 && (
          <View style={[styles.pinnedContainer, { backgroundColor: isDark ? colors.surface200 : '#1e293b' }]}>

            {!showAllPins ? (
              <View style={styles.pinnedMain}>
                <View style={styles.pinnedLeftIcon}>
                  <MaterialCommunityIcons name="comment-text-outline" size={20} color="#6366f1" />
                </View>

                <TouchableOpacity
                  style={styles.pinnedInfo}
                  onPress={() => handleScrollToMessage(conversation.pinnedMessages[conversation.pinnedMessages.length - 1].messageId)}
                >
                  <Text style={styles.pinnedTypeLabel}>TIN NHẮN</Text>
                  <Text style={styles.pinnedPreview} numberOfLines={1}>
                    <Text style={styles.pinnedSenderName}>
                      {conversation.pinnedMessages[conversation.pinnedMessages.length - 1].senderName}:
                    </Text>
                    {" "}{getPinnedPreviewText(conversation.pinnedMessages[conversation.pinnedMessages.length - 1])}
                  </Text>
                </TouchableOpacity>

                <View style={styles.pinnedRightActions}>
                  {conversation.pinnedMessages.length > 1 && (
                    <TouchableOpacity
                      style={styles.webMoreBadge}
                      onPress={() => setShowAllPins(true)}
                    >
                      <Text style={styles.webMoreBadgeText}>+{conversation.pinnedMessages.length} ghim</Text>
                      <Ionicons name="chevron-down" size={14} color="#fff" />
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={styles.pinnedMoreButton}
                    onPress={() => handleUnpinSingle(conversation.pinnedMessages[conversation.pinnedMessages.length - 1].messageId)}
                  >
                    <MaterialIcons name="more-horiz" size={20} color="#94a3b8" />
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={styles.expandedContainer}>
                <View style={styles.expandedHeader}>
                  <Text style={styles.expandedHeaderText}>DANH SÁCH GHIM ({conversation.pinnedMessages.length})</Text>
                  <TouchableOpacity
                    style={styles.collapseButton}
                    onPress={() => setShowAllPins(false)}
                  >
                    <Text style={styles.collapseButtonText}>THU GỌN</Text>
                    <Ionicons name="chevron-up" size={14} color="#94a3b8" />
                  </TouchableOpacity>
                </View>

                <View style={styles.pinnedList}>
                  {conversation.pinnedMessages.slice().reverse().map((pin) => (
                    <View key={pin.messageId} style={styles.webPinnedItem}>
                      <View style={styles.pinnedLeftIcon}>
                        <MaterialCommunityIcons name="comment-text-outline" size={18} color="#6366f1" />
                      </View>
                      <TouchableOpacity
                        style={styles.pinnedInfo}
                        onPress={() => handleScrollToMessage(pin.messageId)}
                      >
                        <Text style={styles.pinnedTypeLabel}>TIN NHẮN</Text>
                        <Text style={styles.pinnedPreview} numberOfLines={1}>
                          <Text style={styles.pinnedSenderName}>{pin.senderName}: </Text>
                          {getPinnedPreviewText(pin)}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.pinnedMoreButton}
                        onPress={() => handleUnpinSingle(pin.messageId)}
                      >
                        <MaterialIcons name="more-horiz" size={18} color="#94a3b8" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>

                <TouchableOpacity
                  style={styles.viewAllFooter}
                  onPress={() => {
                    Alert.alert('Thông báo', 'Tính năng đang được phát triển. Đây sẽ là nơi hiển thị toàn bộ lịch sử tin nhắn ghim của nhóm.');
                  }}
                >
                  <Text style={styles.viewAllFooterText}>XEM TẤT CẢ Ở BẢNG TIN NHÓM</Text>
                  <Ionicons name="chevron-forward" size={14} color="#94a3b8" />
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
        <View style={[styles.chatArea, { backgroundColor: colors.background }]}>
          {isLoading && messages.length === 0 ? (
            <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>

          ) : wallpaperUrl ? (
            <View style={{ flex: 1, backgroundColor: '#000' }}>
              <ImageBackground
                source={{ uri: wallpaperUrl }}
                style={styles.wallpaperBackground}
                imageStyle={styles.wallpaperImage}
                blurRadius={10}
              >
                <MessageList
                  ref={flatListRef}
                  messages={messages}
                  conversationId={realId}
                  currentUserId={currentUser?.userId || currentUser?.id}
                  onlineUsers={onlineUsers}
                  typingUsers={chatState.typingUsers?.[realId] || []}
                  sendReadReceipt={guardedSendReadReceipt}
                  onPressMessage={handlePressMessage}
                  onLoadMore={handleLoadMore}
                  onReact={handleReaction}
                  onLongPress={handleLongPressMessage}
                  onPressReply={handleScrollToMessage}
                  highlightedMessageId={highlightedMessageId}
                />
              </ImageBackground>
            </View>
          ) : (
            <MessageList
              ref={flatListRef}
              messages={messages}
              conversationId={realId}
              currentUserId={currentUser?.userId || currentUser?.id}
              onlineUsers={onlineUsers}
              members={conversation?.members || []}
              typingUsers={chatState.typingUsers?.[realId] || []}

              sendReadReceipt={guardedSendReadReceipt}
              onPressMessage={handlePressMessage}
              onLoadMore={handleLoadMore}
              onReact={handleReaction}
              onLongPress={handleLongPressMessage}
              onPressReply={handleScrollToMessage}
              highlightedMessageId={highlightedMessageId}
            />
          )}
        </View>

        <View style={{ paddingBottom: Math.max(insets.bottom, 12), backgroundColor: colors.background }}>
          {isRestricted ? (
            <View style={[styles.restrictedContainer, { backgroundColor: isDark ? colors.surface100 : '#f8fafc', borderTopColor: colors.border }]}>
              <MaterialIcons name="lock-outline" size={20} color={colors.textMuted} />
              <Text style={[styles.restrictedText, { color: colors.textMuted }]}>Chỉ quản trị viên mới có thể gửi tin nhắn</Text>
            </View>

          ) : (
            <MessageInput
              ref={messageInputRef}
              conversationType={conversation?.type}
              members={conversation?.members || []}
              onSendMessage={handleSendMessage}
              onOpenPoll={handleOpenPoll}


              onTypingChange={(isTyping) => {
                if (isTyping) {
                  sendTypingStart(realId);
                } else {
                  sendTypingStop(realId);
                }
              }}
            />
          )}
        </View>

        <MessageModal
          visible={modalVisible}
          message={selectedMessage}
          isPinned={conversation?.pinnedMessages?.some(p => String(p.messageId) === String(selectedMessage?.messageId))}
          isOwn={selectedMessage?.senderId === (currentUser?.userId || currentUser?.id)}
          onClose={() => setModalVisible(false)}
          onAction={handleModalAction}
          onReact={handleReaction}
        />

        <CreateVoteModal
          visible={createVoteModalVisible}
          onClose={() => setCreateVoteModalVisible(false)}
          onCreate={handleCreateVote}
        />

        <ForwardModal
          visible={forwardModalVisible}
          onClose={() => setForwardModalVisible(false)}
          messageToForward={selectedMessage}
        />

        <CallCountdownModal
          visible={showCountdown}
          countdown={countdown}
          callType={callType}
          onCancel={cancelCountdown}
        />
      </KeyboardAvoidingView>

    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  chatArea: { flex: 1 },
  wallpaperBackground: { flex: 1, overflow: 'hidden' },
  wallpaperImage: { resizeMode: 'cover', opacity: 0.7 }, // Giảm opacity để màu background trộn vào
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  messagesHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#e5e7eb', gap: 12 },
  backButton: { padding: 8 },
  headerContent: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerInfo: { flex: 1 },
  nameContainer: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  headerTitle: { fontSize: 16, fontWeight: 'bold', color: '#111827' },
  shieldIcon: { marginLeft: 2 },
  headerAvatarContainer: { position: 'relative', width: 40, height: 40 },
  headerAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f3f4f6' },
  headerOnlineBadge: { position: 'absolute', right: 0, bottom: 0, width: 12, height: 12, borderRadius: 6, backgroundColor: '#4ade80', borderWidth: 2, borderColor: '#fff' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  headerStatus: { fontSize: 12, color: '#64748b', fontWeight: '400' },
  statusOnline: { color: '#10b981' },
  statusOffline: { color: '#94a3b8' },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  miniTag: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
    borderWidth: 1,
  },
  friendMiniTag: {
    backgroundColor: '#f0fdf4',
    borderColor: '#bbf7d0',
  },
  strangerMiniTag: {
    backgroundColor: '#fff7ed',
    borderColor: '#ffedd5',
  },
  miniTagText: {
    fontSize: 9,
    fontWeight: '800',
  },
  friendMiniTagText: {
    color: '#16a34a',
  },
  strangerMiniTagText: {
    color: '#ea580c',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  headerActionButton: {
    padding: 8,
  },
  restrictedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    backgroundColor: '#f8fafc',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    gap: 8,
  },
  restrictedText: {
    color: '#64748b',
    fontSize: 14,
    fontWeight: '500',
  },
  pinnedContainer: {
    backgroundColor: '#1e293b', // Màu nền tối giống Web trong screenshot
    zIndex: 10,
  },
  pinnedMain: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 12,
  },
  pinnedLeftIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pinnedInfo: {
    flex: 1,
  },
  pinnedTypeLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94a3b8',
    marginBottom: 2,
  },
  pinnedSenderName: {
    fontWeight: '700',
    color: '#fff',
  },
  pinnedPreview: {
    fontSize: 13,
    color: '#e2e8f0',
  },
  pinnedRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  webMoreBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#334155',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  webMoreBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  pinnedMoreButton: {
    padding: 4,
  },
  expandedContainer: {
    backgroundColor: '#1e293b',
  },
  expandedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  expandedHeaderText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94a3b8',
  },
  collapseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  collapseButtonText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94a3b8',
  },
  pinnedList: {
    maxHeight: 250,
  },
  webPinnedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    gap: 12,
  },
  viewAllFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
  },
  viewAllFooterText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94a3b8',
  },
  // Ongoing Call Banner Styles
  ongoingCallContainer: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  ongoingCallLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    marginRight: 8,
  },

  ongoingIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  ongoingOnlineDot: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#10b981',
    borderWidth: 2,
    borderColor: '#6366f1',
  },
  ongoingCallTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  ongoingCallSub: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '500',
  },
  joinButton: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  joinButtonText: {
    color: '#6366f1',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },

});

export default ChatDetailScreen;
