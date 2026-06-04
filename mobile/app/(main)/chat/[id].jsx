import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, Image, ActivityIndicator, Alert, ImageBackground, DeviceEventEmitter } from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { MaterialIcons, Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useDispatch, useSelector } from 'react-redux';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import MessageList from '../../../src/components/MessageList';
import MessageInput from '../../../src/components/MessageInput';
import MessageModal from '../../../src/components/MessageModal';
import { fetchMessages, fetchConversationDetail, sendMessage, setCurrentConversation, clearCurrentConversation, getRealId, fetchConversations, setReplyingTo, clearReplyingTo, toggleMessageReaction, markConversationRead, recallMessage, deleteMessage, pinMessage, unpinMessage, updateMemberFriendshipStatus } from '../../../src/store/chatSlice';
import { useWebSocket } from '../../../src/hooks/useWebSocket';
import { conversationApi, chatApi } from '../../../src/api/chatApi';
import { friendApi } from '../../../src/api/friendApi';
import CreateVoteModal from '../../../src/components/CreateVoteModal';
import { formatLastSeen } from '../../../src/utils/dateUtils';
import ForwardModal from '../../../src/components/ForwardModal';
import { useAgoraCall } from '../../../src/hooks/useAgoraCall';
import CallCountdownModal from '../../../src/components/CallCountdownModal';
import { useTheme } from '../../../src/context/ThemeContext';



import { useTranslation } from 'react-i18next';

const ChatDetailScreen = () => {
  const { t } = useTranslation();
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
  const [localFriendship, setLocalFriendship] = useState(null);
  const [translatedMessages, setTranslatedMessages] = useState({});
  const [translationLoading, setTranslationLoading] = useState({});

  useEffect(() => {
    setTranslatedMessages({});
    setTranslationLoading({});
  }, [conversationId]);

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

  const isAI = useMemo(() => {
    return realId?.includes('shop-expert-ai-bot') || conversationId?.includes('shop-expert-ai-bot');
  }, [realId, conversationId]);

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

  // Lắng nghe sự kiện thay đổi trạng thái bạn bè để đồng bộ UI lập tức
  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener('friendship_changed', () => {
      console.log('[Chat] friendship_changed event received, resetting local friendship and re-fetching details');
      setLocalFriendship(null);
      if (conversationId) {
        dispatch(fetchConversationDetail(conversationId));
      }
    });
    return () => {
      subscription.remove();
    };
  }, [conversationId, dispatch]);

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

  const handleStartCall = (type, isJoin = false, startTime = null, targetUser = null) => {
    if (targetUser) {
      const myId = currentUser?.userId || currentUser?.id;
      const peerId = targetUser?.userId || targetUser?.id;
      const sorted = [String(myId), String(peerId)].sort();
      const singleCid = `SINGLE#${sorted[0]}#${sorted[1]}`;
      
      startCall(type, {
        isJoin: false,
        isGroup: false,
        name: targetUser.fullName || targetUser.name || 'Người dùng',
        avatar: targetUser.avatarUrl || targetUser.avatar || targetUser.profilePic,
        conversationId: singleCid
      }, singleCid);
    } else {
      const isGroupCall = conversation?.type === 'GROUP' || (realId && !realId.includes('SINGLE#'));
      startCall(type, {
        isJoin,
        startTime,
        isGroup: isGroupCall,
        name: conversation?.name || displayName || 'Nhóm chat',
        avatar: conversation?.avatar || conversation?.avatarUrl || headerAvatarUrl
      });
    }
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
        Alert.alert(t('common.error'), t('chat.create_vote_error'));
      });
      return;
    }

    if (message.action === 'MENTION') {
      messageInputRef.current?.insertMention(message.user);
      return;
    }

    if (message.action === 'CLOSE_VOTE') {

      Alert.alert(
        t('common.confirm'),
        t('chat.close_vote_confirm'),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('chat.end'),
            style: 'destructive',
            onPress: () => chatApi.closeVote(realId, message.messageId).catch(e => {
              console.error('Close vote error:', e);
              Alert.alert(t('common.error'), t('chat.close_vote_error'));
            })
          }
        ]
      );
      return;
    }

    // Xử lý nút "Gọi lại" từ CALL_LOG
    if (message.action === 'CALL_BACK') {
      const isOngoing = message.isOngoing === true;
      handleStartCall(message.callType || 'audio', isOngoing, isOngoing ? message.startTime : null, message.targetUser);
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
      Alert.alert(t('common.error'), t('chat.create_vote_error'));
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

  const friendshipStatus = useMemo(() => {
    return localFriendship?.status || otherMember?.friendshipStatus || 'NONE';
  }, [localFriendship, otherMember]);

  const isRequester = useMemo(() => {
    return localFriendship?.isRequester !== undefined ? localFriendship.isRequester : otherMember?.isRequester;
  }, [localFriendship, otherMember]);

  // When Redux friendshipStatus changes from another screen (e.g. chat-info block/unblock),
  // reset localFriendship so it doesn't override the new Redux value
  const prevReduxFriendshipRef = React.useRef(otherMember?.friendshipStatus);
  useEffect(() => {
    const newReduxStatus = otherMember?.friendshipStatus;
    if (newReduxStatus !== prevReduxFriendshipRef.current) {
      prevReduxFriendshipRef.current = newReduxStatus;
      // Clear localFriendship so Redux takes over
      setLocalFriendship(null);
    }
  }, [otherMember?.friendshipStatus]);

  const isBlockedByOther = useMemo(() => {
    return friendshipStatus === 'BLOCKED' && isRequester === false;
  }, [friendshipStatus, isRequester]);

  const otherAvatar = useMemo(() => {
    if (conversation?.type === 'GROUP') return conversation.avatarUrl || conversation.avatar;
    return otherMember?.avatarUrl || otherMember?.avatar || otherMember?.profilePic || paramAvatar;
  }, [conversation, otherMember, paramAvatar]);

  const isOnline = useMemo(() => {
    if (conversation?.type === 'GROUP' || isBlockedByOther) return false;
    return String(otherMember?.status || '').toUpperCase() === 'ONLINE' || otherMember?.isOnline === true;
  }, [conversation, otherMember, isBlockedByOther]);

  const onlineUsers = useMemo(() => {
    if (isBlockedByOther) return [];
    const currentUserIdStr = String(currentUser?.userId || currentUser?.id || '');
    return (conversation?.members || [])
      .filter(member => {
        const memberId = String(member.userId || member.id || '');
        return memberId && memberId !== currentUserIdStr &&
          (String(member.status || member.presence || '').toUpperCase() === 'ONLINE' || member.isOnline === true);
      })
      .map(member => String(member.userId || member.id || ''));
  }, [conversation, currentUser, isBlockedByOther]);

  const showStrangerBar = useMemo(() => {
    if (isAI) return false;
    if (!conversation || conversation.type !== 'SINGLE') return false;
    if (conversation.isAI || displayName?.toLowerCase()?.includes('assistant') || displayName?.toLowerCase()?.includes('copilot') || displayName?.toLowerCase()?.includes('shopexpert')) return false;
    // Only show the bar if we have CONFIRMED the friendship status from the backend
    // otherMember must exist and have a friendshipStatus field set by the server
    if (!otherMember) return false;
    // If friendshipStatus is undefined/null, it means we haven't loaded the detail yet - don't show
    const serverStatus = otherMember?.friendshipStatus;
    if (!serverStatus) return false;
    // Use localFriendship override if available (after user action), otherwise use server data
    const effectiveStatus = localFriendship?.status || serverStatus;
    return effectiveStatus !== 'ACCEPTED' && effectiveStatus !== 'BLOCKED' && effectiveStatus !== 'SELF';
  }, [conversation, otherMember, localFriendship, displayName, isAI]);

  const handleSendFriendRequest = async () => {
    const targetUserId = otherMember?.userId || otherMember?.id;
    if (!targetUserId) return;
    try {
      await friendApi.sendFriendRequest(targetUserId);
      setLocalFriendship({ status: 'PENDING', isRequester: true });
      dispatch(fetchConversations());
    } catch (err) {
      console.error("Failed to send friend request:", err);
      Alert.alert(t('common.error'), t('friends.add_friend_failed'));
    }
  };

  const handleCancelFriendRequest = async () => {
    const targetUserId = otherMember?.userId || otherMember?.id;
    if (!targetUserId) return;
    try {
      await friendApi.cancelRequest(targetUserId);
      setLocalFriendship({ status: 'NONE', isRequester: null });
      dispatch(fetchConversations());
    } catch (err) {
      console.error("Failed to cancel friend request:", err);
      Alert.alert(t('common.error'), t('search.cancel_request_failed'));
    }
  };

  const handleAcceptFriendRequest = async () => {
    const targetUserId = otherMember?.userId || otherMember?.id;
    if (!targetUserId) return;
    try {
      await friendApi.acceptFriendRequest(targetUserId);
      setLocalFriendship({ status: 'ACCEPTED', isRequester: null });
      dispatch(fetchConversations());
    } catch (err) {
      console.error("Failed to accept friend request:", err);
      Alert.alert(t('common.error'), t('common.error'));
    }
  };

  const handleRejectFriendRequest = async () => {
    const targetUserId = otherMember?.userId || otherMember?.id;
    if (!targetUserId) return;
    try {
      await friendApi.rejectFriendRequest(targetUserId);
      setLocalFriendship({ status: 'NONE', isRequester: null });
      dispatch(fetchConversations());
    } catch (err) {
      console.error("Failed to reject friend request:", err);
      Alert.alert(t('common.error'), t('common.error'));
    }
  };

  const handleUnblock = async () => {
    const targetUserId = otherMember?.userId || otherMember?.id;
    if (!targetUserId) return;
    try {
      await friendApi.unblockUser(targetUserId);
      // 1. Update Redux store immediately so chat-info screen also reflects the change
      dispatch(updateMemberFriendshipStatus({
        userId: String(targetUserId),
        friendshipStatus: 'NONE',
        isRequester: null,
      }));
      // 2. Update local state as well (for immediate UI in this screen)
      setLocalFriendship({ status: 'NONE', isRequester: null });
      // 3. Refresh conversation list in background
      dispatch(fetchConversations());
    } catch (err) {
      console.error("Failed to unblock user:", err);
      Alert.alert(t('common.error'), t('info.unblock_failed'));
    }
  };

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

  const handleTranslate = async (messageId) => {
    const msg = messages.find(m => m.messageId === messageId);
    if (!msg || !msg.content) return;

    const tgtLang = currentUser?.preferredLanguage || 'vie_Latn';
    const srcLang = msg.language || 'vie_Latn';

    setTranslationLoading(prev => ({ ...prev, [messageId]: true }));
    try {
      const res = await chatApi.translateMessage(messageId, realId, srcLang, tgtLang);
      const translatedText = res.data?.data?.translated || res.data?.translated;
      setTranslatedMessages(prev => ({ ...prev, [messageId]: translatedText }));
    } catch (err) {
      console.error("Translation failed:", err);
      Alert.alert(
        t('chat.translation_failed') || "Dịch thất bại",
        err.response?.data?.message || err.message
      );
    } finally {
      setTranslationLoading(prev => ({ ...prev, [messageId]: false }));
    }
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
        Alert.alert(t('common.confirm'), t('chat.delete_for_me_confirm'), [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('common.delete'),
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
        Alert.alert(t('chat.recall'), t('chat.recall_confirm'), [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('chat.recall'),
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
      case 'translate':
        handleTranslate(message.messageId);
        break;
      default:
        console.log('Action not implemented:', type);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[styles.container, { backgroundColor: colors.background }]}
        keyboardVerticalOffset={0}
      >
        <View style={[styles.messagesHeader, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
          <TouchableOpacity
            onPress={() => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace('/(main)');
              }
            }}
            style={styles.backButton}
          >
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
              {isAI ? (
                <View style={[styles.headerAvatar, { backgroundColor: isDark ? 'rgba(99, 102, 241, 0.2)' : 'rgba(99, 102, 241, 0.1)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border }]}>
                  <Ionicons name="sparkles" size={20} color="#6366f1" />
                </View>
              ) : (
                <Image source={{ uri: headerAvatarUrl }} style={[styles.headerAvatar, { backgroundColor: colors.surface200 }]} />
              )}
              {(isOnline || isAI) && <View style={[styles.headerOnlineBadge, { borderColor: colors.background }]} />}
            </View>
            <View style={styles.headerInfo}>
              <View style={styles.nameRow}>
                <Text style={[styles.headerTitle, { color: colors.foreground }]} numberOfLines={1}>{displayName}</Text>
                {conversation?.type === 'SINGLE' && !isAI && otherMember?.friendshipStatus && (
                  <View style={[
                    styles.miniTag,
                    friendshipStatus === 'ACCEPTED'
                      ? [styles.friendMiniTag, isDark && { backgroundColor: 'rgba(16, 185, 129, 0.15)', borderColor: 'rgba(16, 185, 129, 0.3)' }]
                      : [styles.strangerMiniTag, isDark && { backgroundColor: colors.surface200, borderColor: colors.border }]
                  ]}>
                    <Text style={[
                      styles.miniTagText,
                      friendshipStatus === 'ACCEPTED'
                        ? [styles.friendMiniTagText, isDark && { color: '#10b981' }]
                        : [styles.strangerMiniTagText, isDark && { color: colors.textSubtle }]
                    ]}>
                      {friendshipStatus === 'ACCEPTED' ? t('chat.friend').toUpperCase() : t('chat.stranger_bar.title').toUpperCase()}
                    </Text>
                  </View>
                )}
              </View>
              <Text style={[styles.headerStatus, (isOnline || isAI) ? styles.statusOnline : [styles.statusOffline, { color: colors.textSubtle }]]} numberOfLines={1}>
                {isAI ? t('chat.online') : (otherMember
                  ? formatLastSeen(otherMember.status || otherMember.presence, otherMember.lastSeenAt || otherMember.last_seen_at)
                  : (conversation?.type === 'GROUP'
                    ? t('chat.member_count', { count: conversation?.members?.length || 0 })
                    : (isOnline ? t('chat.online') : t('chat.offline'))
                  )
                )}
              </Text>
            </View>
          </TouchableOpacity>

          <View style={styles.headerActions}>
            {!isAI && (
              <>
                <TouchableOpacity style={styles.headerActionButton} onPress={() => handleStartCall('audio')}>
                  <MaterialIcons name="call" size={24} color={colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.headerActionButton} onPress={() => handleStartCall('video')}>
                  <MaterialIcons name="videocam" size={24} color={colors.primary} />
                </TouchableOpacity>
              </>
            )}
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
                <Text style={styles.ongoingCallTitle}>{t('chat.ongoing_group_call')}</Text>
                <Text style={styles.ongoingCallSub}>{t('chat.join_call_hint')}</Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.joinButton}
              onPress={() => handleStartCall(lastCallMsg?.callType || 'video', true, lastCallMsg?.startTime)}
            >
              <Text style={styles.joinButtonText}>{t('chat.join_now')}</Text>
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
                  <Text style={styles.pinnedTypeLabel}>{t('chat.message').toUpperCase()}</Text>
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
                      <Text style={styles.webMoreBadgeText}>+{conversation.pinnedMessages.length} {t('chat.ghim')}</Text>
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
                  <Text style={styles.expandedHeaderText}>{t('chat.pinned_list', { count: conversation.pinnedMessages.length }).toUpperCase()}</Text>
                  <TouchableOpacity
                    style={styles.collapseButton}
                    onPress={() => setShowAllPins(false)}
                  >
                    <Text style={styles.collapseButtonText}>{t('chat.collapse').toUpperCase()}</Text>
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
                        <Text style={styles.pinnedTypeLabel}>{t('chat.message').toUpperCase()}</Text>
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
                    Alert.alert(t('common.success'), t('chat.view_all_pins_tooltip'));
                  }}
                >
                  <Text style={styles.viewAllFooterText}>{t('chat.view_all_pins_tooltip').toUpperCase()}</Text>
                  <Ionicons name="chevron-forward" size={14} color="#94a3b8" />
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
        {showStrangerBar && (
          <View style={[styles.strangerContainer, { backgroundColor: isDark ? colors.surface200 : '#f8fafc', borderBottomColor: colors.border }]}>
            <View style={styles.strangerLeft}>
              <Feather name="user-plus" size={18} color={isDark ? colors.textMuted : '#64748b'} />
              <Text style={[styles.strangerText, { color: isDark ? colors.foreground : '#334155' }]}>
                {(() => {
                  const status = localFriendship?.status || otherMember?.friendshipStatus || 'NONE';
                  const req = localFriendship?.isRequester !== undefined ? localFriendship.isRequester : otherMember?.isRequester;
                  if (status === 'PENDING') {
                    return req ? t('chat.friend_request_sent') : t('chat.friend_request_received');
                  }
                  return t('chat.send_friend_request_prompt');
                })()}
              </Text>
            </View>

            <View style={styles.strangerActions}>
              {(() => {
                const status = localFriendship?.status || otherMember?.friendshipStatus || 'NONE';
                const req = localFriendship?.isRequester !== undefined ? localFriendship.isRequester : otherMember?.isRequester;
                if (status === 'PENDING') {
                  if (req) {
                    return (
                      <TouchableOpacity style={[styles.actionButton, styles.cancelButton]} onPress={handleCancelFriendRequest}>
                        <Text style={styles.actionButtonText}>{t('chat.cancel_request')}</Text>
                      </TouchableOpacity>
                    );
                  } else {
                    return (
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <TouchableOpacity style={[styles.actionButton, styles.acceptButton]} onPress={handleAcceptFriendRequest}>
                          <Text style={styles.actionButtonText}>{t('chat.stranger_bar.accept')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.actionButton, styles.rejectButton, { backgroundColor: isDark ? colors.surface300 : '#e2e8f0' }]} onPress={handleRejectFriendRequest}>
                          <Text style={[styles.actionButtonText, { color: isDark ? colors.foreground : '#475569' }]}>{t('chat.stranger_bar.decline')}</Text>
                        </TouchableOpacity>
                      </View>
                    );
                  }
                }
                return (
                  <TouchableOpacity style={[styles.actionButton, styles.sendButton]} onPress={handleSendFriendRequest}>
                    <Text style={styles.actionButtonText}>{t('chat.add_friend_btn')}</Text>
                  </TouchableOpacity>
                );
              })()}
            </View>
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
                  isBlockedByOther={isBlockedByOther}
                  translatedMessages={translatedMessages}
                  translationLoading={translationLoading}
                  onTranslate={handleTranslate}
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
              isBlockedByOther={isBlockedByOther}
              translatedMessages={translatedMessages}
              translationLoading={translationLoading}
              onTranslate={handleTranslate}
            />
          )}
        </View>

        <View style={{ paddingBottom: Math.max(insets.bottom, 12), backgroundColor: colors.background }}>
          {isRestricted ? (
            <View style={[styles.restrictedContainer, { backgroundColor: isDark ? colors.surface100 : '#f8fafc', borderTopColor: colors.border }]}>
              <MaterialIcons name="lock-outline" size={20} color={colors.textMuted} />
              <Text style={[styles.restrictedText, { color: colors.textMuted }]}>{t('chat.only_admin_can_send')}</Text>
            </View>
          ) : (friendshipStatus === 'BLOCKED' && isRequester === true) ? (
            <View style={[
              styles.blockedContainer,
              { 
                backgroundColor: isDark ? 'rgba(239, 68, 68, 0.1)' : 'rgba(239, 68, 68, 0.05)',
                borderColor: isDark ? 'rgba(239, 68, 68, 0.2)' : 'rgba(239, 68, 68, 0.15)'
              }
            ]}>
              <View style={styles.blockedHeader}>
                <View style={[styles.shieldIconCircle, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.2)' : 'rgba(239, 68, 68, 0.1)' }]}>
                  <MaterialCommunityIcons name="shield-alert-outline" size={24} color="#ef4444" />
                </View>
                <View style={styles.blockedTextGroup}>
                  <Text style={[styles.blockedTitle, { color: colors.foreground }]}>{t('chat.cannot_send_message')}</Text>
                  <Text style={[styles.blockedSubtitle, { color: colors.textMuted }]}>
                    {t('chat.block_user_confirm', { name: displayName }).replace('Bạn có chắc chắn muốn chặn ', 'Bạn đã chặn ').replace('?', '.') + ' ' + t('info.unblock_user').replace('Bỏ chặn người này', 'Hãy bỏ chặn để tiếp tục trò chuyện.')}
                  </Text>
                </View>
              </View>
              <TouchableOpacity 
                style={styles.unblockButton}
                onPress={handleUnblock}
              >
                <Text style={styles.unblockButtonText}>{t('info.unblock_user').replace('Bỏ chặn người này', 'BỎ CHẶN')}</Text>
              </TouchableOpacity>
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
  headerTitle: { fontSize: 16, fontWeight: 'bold', color: '#111827', flexShrink: 1 },
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
    paddingHorizontal: 16,
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
  strangerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  strangerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  strangerText: {
    fontSize: 13,
    fontWeight: '600',
  },
  strangerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },
  sendButton: {
    backgroundColor: '#0068ff',
  },
  cancelButton: {
    backgroundColor: '#ef4444',
  },
  acceptButton: {
    backgroundColor: '#10b981',
  },
  rejectButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  blockedContainer: {
    padding: 16,
    borderRadius: 24,
    borderWidth: 1,
    gap: 12,
    marginVertical: 8,
    marginHorizontal: 16,
  },
  blockedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  shieldIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  blockedTextGroup: {
    flex: 1,
  },
  blockedTitle: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 4,
  },
  blockedSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
  },
  unblockButton: {
    backgroundColor: '#ef4444',
    height: 48,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  unblockButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
});

export default ChatDetailScreen;
