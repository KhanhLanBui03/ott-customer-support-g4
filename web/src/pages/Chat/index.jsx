import React, { useEffect, useState } from 'react';
import { useChat } from '../../hooks/useChat';
import { useAuth } from '../../hooks/useAuth';
import { useAgoraCall } from '../../hooks/useAgoraCall';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import Sidebar from '../../components/Sidebar';
import ChatWindow from '../../components/ChatWindow';
import ConversationInfo from '../../components/ConversationInfo';
import { useWebSocket } from '../../hooks/useWebSocket';
import ProfileModal from '../../components/ProfileModal';
import ChangePasswordModal from '../../components/ChangePasswordModal';
import FriendManagementModal from '../../components/FriendManagementModal';
import CreateGroupModal from '../../components/CreateGroupModal';
import NotificationModal from '../../components/NotificationModal';
import DeleteAccountModal from '../../components/DeleteAccountModal';
import LanguageSettingsModal from '../../components/LanguageSettingsModal';
import LogoutModal from '../../components/LogoutModal';
import WelcomeCarousel from '../../components/WelcomeCarousel';
import VideoCall from '../../components/VideoCall';
import MediaLightbox from '../../components/MediaLightbox';
import MyCloud from '../../components/MyCloud/MyCloud';
import { MessageSquare, Bell, Users, Settings, LogOut, Search, Plus, User, UserPlus, FolderDown, Mail, BellOff, EyeOff, Clock, Trash2, AlertTriangle, Pin, Sun, Moon, Contact, Stars as SparklesIcon, ChevronDown, MoreHorizontal, Cloud, X } from 'lucide-react';
import { fetchNotifications, setPendingRequests, setPendingGroups } from '../../store/notificationSlice';
import { setActiveConversation, setConversations } from '../../store/chatSlice';
import { useTheme } from '../../hooks/useTheme';
import { useDispatch, useSelector } from 'react-redux';
import { chatApi } from '../../api/chatApi';
import { friendApi } from '../../api/friendApi';

const Chat = () => {
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const dispatch = useDispatch();
  const { unreadCount } = useSelector(state => state.notification);
  const {
    conversations,
    activeConversationId,
    fetchConversations,
    fetchFriends,
    fetchMessages,
    selectConversation,
    loading,
    messages
  } = useChat();

  useWebSocket(); // Initialize global real-time listener

  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [isWallpaperLoading, setIsWallpaperLoading] = useState(false);

  React.useEffect(() => {
    if (activeConversationId) {
      fetchFriends();
    }
  }, [activeConversationId]);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [isLanguageSettingsOpen, setIsLanguageSettingsOpen] = useState(false);
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [isMyCloudView, setIsMyCloudView] = useState(false);
  const [activeTab, setActiveTab] = useState('priority'); // 'priority', 'hidden'
  const [hiddenConvIds, setHiddenConvIds] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('hidden_conversation_ids')) || [];
    } catch (e) {
      return [];
    }
  });
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isDeleteAccountOpen, setIsDeleteAccountOpen] = useState(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [filterType, setFilterType] = useState('all'); // 'all', 'unread'
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
  const [isFriendsOpen, setIsFriendsOpen] = useState(false);
  const [friendsInitialView, setFriendsInitialView] = useState('list');
  const [selectedTags, setSelectedTags] = useState([]); // List of tag keys
  const [lightboxData, setLightboxData] = useState({ isOpen: false, images: [], currentIndex: 0 });

  const openLightbox = (images, index = 0) => {
    setLightboxData({ isOpen: true, images, currentIndex: index });
  };

  const [toast, setToast] = useState(null);
  const toastTimeoutRef = React.useRef(null);
  const showToast = (message, type = 'success') => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToast({ message, type });
    toastTimeoutRef.current = setTimeout(() => {
      setToast(null);
    }, 3000);
  };

  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportReason, setReportReason] = useState('spam');
  const [reportNotes, setReportNotes] = useState('');
  const [reportingConvId, setReportingConvId] = useState(null);

  const TAGS = [
    { key: 'customer', label: 'Khách hàng', color: 'bg-red-500' },
    { key: 'family', label: 'Gia đình', color: 'bg-emerald-500' },
    { key: 'work', label: 'Công việc', color: 'bg-orange-500' },
    { key: 'friends', label: 'Bạn bè', color: 'bg-purple-500' },
    { key: 'later', label: 'Trả lời sau', color: 'bg-yellow-500' },
    { key: 'colleague', label: 'Đồng nghiệp', color: 'bg-blue-500' }
  ];

  const activeConversation = React.useMemo(() => {
    return conversations.find(c => c.conversationId === activeConversationId) || (
      activeConversationId?.includes('shop-expert-ai-bot') ? {
        conversationId: activeConversationId,
        name: 'Ecommerce AI Expert',
        type: 'SINGLE',
        isAI: true,
        avatar: null,
        members: [
          { userId: user?.userId || user?.id, status: 'ONLINE', name: user?.name },
          { userId: 'shop-expert-ai-bot', status: 'ONLINE', name: 'ShopExpert AI' }
        ]
      } : null
    );
  }, [conversations, activeConversationId, user]);


  // ─── Agora Video Call ────────────────────────────────────────────────────
  const {
    callStatus,
    callerId,
    callerName,
    callerAvatar,
    incomingSignal,
    callType,
    cameraError,
    duration,
    formatDuration,
    startCall,
    acceptCall,
    endCall,
    connect,
    localVideoTrack,
    localAudioTrack,
    remoteUsers,
    toggleMic,
    toggleCamera,
    audioBlocked,
    resumeAudio,
    endCallReason,
    micOn,
    camOn,
    userLeftMsg,
    isGroupCall,
    ringDuration,
    speakingUsers,
    activeCallCid
  } = useAgoraCall(activeConversationId, activeConversation);

  const myId = user?.userId || user?.id;
  const [outgoingTarget, setOutgoingTarget] = useState(null);

  // Dọn dẹp thông tin người nhận cuộc gọi cũ khi cuộc gọi kết thúc (idle)
  useEffect(() => {
    if (callStatus === 'idle') {
      setOutgoingTarget(null);
    }
  }, [callStatus]);


  useEffect(() => {
    fetchConversations();
    fetchFriends();
    // Fetch initial notifications
    const loadNotifications = () => {
      friendApi.getPendingRequests().then(res => {
        dispatch(setPendingRequests(Array.isArray(res) ? res : res?.data || []));
      }).catch(() => { });
      chatApi.getPendingInvitations().then(res => {
        dispatch(setPendingGroups(Array.isArray(res) ? res : res?.data || []));
      }).catch(() => { });
      if (myId) {
        dispatch(fetchNotifications(myId));
      }
    };
    loadNotifications();

    // Auto-refresh notifications every 30 seconds as fallback
    const interval = setInterval(loadNotifications, 30000);
    return () => {
      clearInterval(interval);
      // Xóa active conversation khi thoát khỏi màn hình chat chính để tránh auto-read "ma"
      dispatch(setActiveConversation(null));
    };
  }, [fetchConversations, fetchFriends, dispatch, myId]);

  useEffect(() => {
    const disconnect = connect();
    return () => disconnect?.();
  }, [connect]);

  const handleStartCall = (type = 'video', options = {}) => {
    if (options.targetName) {
      setOutgoingTarget({
        name: options.targetName,
        avatar: options.targetAvatar || null,
        isGroup: options.isGroup || activeConversation?.type === 'GROUP'
      });
    } else if (activeConversation) {
      const isGroup = activeConversation.type === 'GROUP';
      if (isGroup) {
        setOutgoingTarget({
          name: activeConversation.name || 'Nhóm trò chuyện',
          avatar: activeConversation.avatar || null,
          isGroup: true
        });
      } else {
        const other = activeConversation.members?.find(m => {
          const mid = m.userId || m.id || m._id;
          return mid && String(mid).trim() !== String(myId).trim();
        });
        setOutgoingTarget({
          name: other?.fullName || other?.name || activeConversation.name || 'Người dùng',
          avatar: other?.avatar || other?.avatarUrl || null,
          isGroup: false
        });
      }
    } else {
      setOutgoingTarget(null);
    }
    startCall(type, options);
  };

  const handleAcceptCall = () => acceptCall(incomingSignal);

  const handleHangup = () => {
    let reason = 'ENDED';
    if (callStatus === 'incoming') reason = 'REJECTED';
    else if (callStatus === 'outgoing') reason = 'MISSED';
    endCall(true, reason);
    setOutgoingTarget(null);
  };


  // ─── Thông tin người nghe/gọi (phải đặt SAU activeConversation) ──────────
  const remoteInfo = React.useMemo(() => {
    // Tìm conversation liên quan đến cuộc gọi đang diễn ra
    const currentCallCid = activeCallCid || incomingSignal?.conversationId;
    const callConv = currentCallCid ? conversations.find(c =>
      String(c.conversationId) === String(currentCallCid) ||
      String(c.id) === String(currentCallCid)
    ) : null;

    // Xác định xem cuộc gọi này có phải là cuộc gọi nhóm hay không (hoàn toàn đồng bộ)
    const isActuallyGroup = isGroupCall ||
      (callConv ? (callConv.type === 'GROUP' || callConv.isGroup) : false) ||
      String(currentCallCid).includes('GROUP') ||
      incomingSignal?.isGroup === true ||
      outgoingTarget?.isGroup === true;

    // 1. Ưu tiên xử lý cuộc gọi NHÓM
    if (isActuallyGroup) {
      return {
        name: callConv?.name || outgoingTarget?.name || incomingSignal?.conversationName || 'Nhóm trò chuyện',
        avatar: callConv?.avatar || callConv?.avatarUrl || outgoingTarget?.avatar || incomingSignal?.conversationAvatar || null
      };
    }

    // 2. Xử lý cuộc gọi CÁ NHÂN khi có người gọi đến (Incoming)
    const cleanCallerId = callerId && callerId !== 'undefined' && callerId !== 'null' ? String(callerId).trim() : null;
    if (callStatus === 'incoming' && cleanCallerId) {
      // Nếu là cuộc gọi Cá nhân (SINGLE), hiển thị người gọi
      let avatar = incomingSignal?.signal?.senderAvatar || incomingSignal?.senderAvatar || null;
      let name = incomingSignal?.senderName || callerName;

      // Tìm trong cuộc hội thoại liên quan đến cuộc gọi trước
      if (!avatar || !name || name === 'Người dùng' || name === cleanCallerId) {
        if (callConv) {
          const found = callConv.members?.find(m => {
            const mid = m.userId || m.id || m._id;
            return mid && mid !== 'undefined' && mid !== 'null' && String(mid).trim() === cleanCallerId;
          });
          if (found) {
            avatar = found.avatar || found.avatarUrl || avatar;
            if (found.fullName || found.name) {
              name = found.fullName || found.name;
            }
          }
        }
      }

      // FALLBACK: Tìm trong toàn bộ danh sách
      if (!avatar || !name || name === 'Người dùng' || name === cleanCallerId) {
        for (const conv of conversations) {
          const found = conv.members?.find(m => {
            const mid = m.userId || m.id || m._id;
            return mid && mid !== 'undefined' && mid !== 'null' && String(mid).trim() === cleanCallerId;
          });
          if (found) {
            avatar = found.avatar || found.avatarUrl || avatar;
            if (found.fullName || found.name) {
              name = found.fullName || found.name;
            }
            if (avatar) break;
          }
        }
      }

      return { name, avatar };
    }

    // 3. Nếu đang trong cuộc gọi ĐƠN (Outgoing hoặc Connected hoặc Ended)
    if (callStatus !== 'idle') {
      if (outgoingTarget?.name) {
        return {
          name: outgoingTarget.name,
          avatar: outgoingTarget.avatar || null
        };
      }

      if (callConv) {
        const other = callConv.members?.find(m => {
          const mid = m.userId || m.id || m._id;
          return mid && mid !== 'undefined' && mid !== 'null' && String(mid).trim() !== String(myId).trim();
        });
        if (other) {
          return {
            name: other.fullName || other.name || callConv.name || 'Người dùng',
            avatar: other.avatar || other.avatarUrl || null
          };
        }
      }

      // FALLBACK cực kỳ mạnh mẽ cho cuộc gọi đến khi không tìm thấy cuộc hội thoại trong danh sách
      if (callerName) {
        return {
          name: callerName,
          avatar: callerAvatar || null
        };
      }
    }

    // 4. FALLBACK khi ở trạng thái idle/chưa có cuộc gọi: Dựa trên activeConversation hiện tại
    if (!activeConversation) return { name: 'Người dùng', avatar: null };

    // Nếu là cuộc gọi Nhóm
    if (activeConversation.type === 'GROUP') {
      return {
        name: activeConversation.name || 'Nhóm trò chuyện',
        avatar: activeConversation.avatar || null
      };
    }

    // Nếu là cuộc gọi Cá nhân
    const other = activeConversation.members?.find(m => {
      const mid = m.userId || m.id || m._id;
      return mid && mid !== 'undefined' && mid !== 'null' && String(mid).trim() !== String(myId).trim();
    });
    return {
      name: other?.fullName || other?.name || activeConversation.name || 'Người dùng',
      avatar: other?.avatar || other?.avatarUrl || null,
    };
  }, [callerId, callerName, callerAvatar, conversations, activeConversation, myId, incomingSignal, outgoingTarget, isGroupCall, activeCallCid, callStatus]);

  // ─── Danh sách Remote Streams cho Group Call ─────────────────────────────
  const remoteStreams = React.useMemo(() => {
    if (!remoteUsers || remoteUsers.length === 0) return [];

    return remoteUsers.map(u => {
      let memberName = 'Người dùng';
      let memberAvatar = null;

      // Logic tìm kiếm thông tin người dùng dựa trên UID
      // 1. Kiểm tra nếu là cuộc gọi 1-1 và UID khớp với remoteInfo đã tìm thấy
      const currentRemoteUid = Math.floor(u.uid / 1000); // Lấy phần base UID

      // Tìm trong danh sách hội thoại hiện tại (SINGLE)
      if (activeConversation?.type === 'SINGLE') {
        const other = activeConversation.members?.find(m => {
          const mid = m.userId || m.id;
          return mid && mid !== 'undefined' && mid !== 'null' && String(mid).trim() !== String(myId).trim();
        });
        if (other) {
          memberName = other.fullName || other.name || memberName;
          memberAvatar = other.avatar || other.avatarUrl || memberAvatar;
        }
      } else {
        // Tìm trong TOÀN BỘ các cuộc hội thoại để map UID -> Name/Avatar
        for (const conv of conversations) {
          const found = conv.members?.find(m => {
            const mId = String(m.userId);
            const toNumericUid = (userId) => {
              if (!userId) return 0;
              if (typeof userId === 'number') return userId;
              let hash = 0;
              const s = String(userId);
              for (let i = 0; i < s.length; i++) {
                hash = ((hash << 5) - hash + s.charCodeAt(i)) | 0;
              }
              return Math.abs(hash);
            };
            const stdUid = toNumericUid(mId);
            const mobUid = toNumericUid(mId + '_mobile');
            return stdUid === Number(u.uid) || mobUid === Number(u.uid);
          });

          if (found) {
            memberName = found.fullName || found.name || memberName;
            memberAvatar = found.avatar || found.avatarUrl || memberAvatar;
            break;
          }
        }
      }

      // Nếu vẫn chưa tìm thấy, dùng thông tin từ remoteInfo (cho trường hợp cuộc gọi 1-1)
      if (memberName === 'Người dùng' && activeConversation?.type !== 'GROUP') {
        memberName = remoteInfo.name || memberName;
        memberAvatar = remoteInfo.avatar || memberAvatar;
      }

      return {
        uid: u.uid,
        videoTrack: u.videoTrack,
        audioTrack: u.audioTrack,
        hasVideo: u.hasVideo,
        hasAudio: u.hasAudio,
        name: memberName,
        avatar: memberAvatar,
      };
    });
  }, [remoteUsers, conversations, activeConversation, myId, remoteInfo]);

  const allChatImages = React.useMemo(() => {
    const images = [];
    const currentMessages = messages[activeConversationId] || [];
    currentMessages.forEach(msg => {
      if (msg.mediaUrls) {
        msg.mediaUrls.forEach(url => {
          const cleanUrl = url.split('?')[0].toLowerCase();
          const isImg = cleanUrl.match(/\.(jpeg|jpg|gif|png|webp|svg)/i);
          const isVid = cleanUrl.match(/\.(mp4|webm|ogg)/i);
          if (isImg || isVid) {
            images.push({
              url,
              type: isImg ? 'IMAGE' : 'VIDEO',
              createdAt: msg.createdAt,
              senderName: msg.senderName,
              messageId: msg.messageId
            });
          }
        });
      }
    });
    return images; // These are already in order of messages (usually oldest to newest)
  }, [messages, activeConversationId]);

  const [contextMenu, setContextMenu] = useState(null);

  const handleSidebarContextMenu = (e, conversationId) => {
    e.preventDefault();
    const menuWidth = 256; // Width of the menu (w-64 is 256px)
    const menuHeight = 420; // Approximate height of the menu with all options

    let x = e.clientX;
    let y = e.clientY;

    if (e.type === 'click') {
      const rect = e.currentTarget.getBoundingClientRect();
      // Position the menu to the right of the button (sits beautifully in the right-side chat area)
      x = rect.right + 12;
      y = rect.top;

      // If x overflows the screen width (e.g. smaller screens or mobile), align it to the left of the button instead
      if (x + menuWidth > window.innerWidth) {
        x = rect.left - menuWidth - 8;
      }

      // If y overflows the screen height, adjust it upwards so it aligns with the bottom of the button
      if (y + menuHeight > window.innerHeight) {
        y = Math.max(16, rect.bottom - menuHeight);
      }
    } else {
      // For right-click, ensure it fits inside the viewport boundaries
      if (x + menuWidth > window.innerWidth) {
        x = window.innerWidth - menuWidth - 16;
      }
      if (y + menuHeight > window.innerHeight) {
        y = window.innerHeight - menuHeight - 16;
      }
    }

    // Ensure coordinates are never negative or offscreen
    x = Math.max(16, x);
    y = Math.max(16, y);

    setContextMenu({ x, y, conversationId });
  };

  useEffect(() => {
    const handleGlobalClick = () => {
      setContextMenu(null);
      setIsFilterMenuOpen(false);
    };
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, []);

  const handleDeleteConversation = async (conversationId) => {
    if (window.confirm('Xóa cuộc trò chuyện này?')) {
      try {
        await chatApi.deleteConversation(conversationId);
        fetchConversations();
        selectConversation(null);
      } catch (err) {
        console.error("Delete failed", err);
      }
    }
  };

  const handleTogglePin = async (conversationId) => {
    // Optimistic Update: Instantly reorder and update UI
    const oldConversations = [...conversations];
    const newConversations = conversations.map(c =>
      c.conversationId === conversationId ? { ...c, isPinned: !c.isPinned } : c
    );

    dispatch(setConversations(newConversations));

    try {
      await chatApi.togglePinConversation(conversationId);
      // Backend now uses batchLoad from base table, so no delay needed for consistency
      fetchConversations();
    } catch (err) {
      console.error("Toggle pin failed", err);
      dispatch({ type: 'chat/setConversations', payload: oldConversations });
    }
  };

  const handleSelectAI = () => {
    // Consistent ID for AI chat: SINGLE#user1#user2 (sorted)
    const aiBotId = 'shop-expert-ai-bot';
    const currentUserId = user?.userId || user?.id;
    if (!currentUserId) return;

    const participants = [currentUserId, aiBotId].sort();
    const aiConvId = `SINGLE#${participants[0]}#${participants[1]}`;

    selectConversation(aiConvId);
    setSearchTerm(''); // Clear search if any
    if (isMobile) setIsInfoOpen(false);
  };

  const isMobile = useMediaQuery('(max-width: 1024px)');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredConversations = conversations.filter(conv => {
    const isHidden = hiddenConvIds.includes(conv.conversationId);
    if (activeTab === 'hidden') {
      if (!isHidden) return false;
    } else {
      if (isHidden) return false;
    }

    // 1. Filter by unread status if active
    if (filterType === 'unread' && (conv.unreadCount || 0) === 0) return false;

    // 2. Filter by selected tags
    if (selectedTags.length > 0) {
      if (!conv.tag || !selectedTags.includes(conv.tag)) return false;
    }

    // 2. If no search term, return all matching the type filter
    if (!searchTerm) return true;

    const searchLower = searchTerm.toLowerCase();

    // 1. Check conversation name
    if ((conv.name || '').toLowerCase().includes(searchLower)) return true;

    // 2. Check all members' names inside the conversation
    if (conv.members && Array.isArray(conv.members)) {
      return conv.members.some(m =>
        (m.fullName || '').toLowerCase().includes(searchLower)
      );
    }

    return false;
  });

  return (
    <div className={`flex h-screen bg-background overflow-hidden font-primary relative ${isDark ? 'dark' : ''}`}>
      {/* 1. Global Icon Sidebar (Desktop: Leftmost, Mobile: Bottom Nav) */}
      {(!isMobile || !activeConversationId) && (
        <div className={`
          ${isMobile
            ? 'fixed bottom-0 left-0 right-0 h-20 w-full flex-row px-6 items-center justify-around border-t border-white/5 bg-[#0b0e14]/95 backdrop-blur-xl'
            : 'w-[88px] flex-col py-9 space-y-8 items-center border-r border-white/5 bg-[#0b0e14]'}
          flex flex-shrink-0 z-50
        `}>
          <div className="relative group">
            <div
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className={`
                ${isMobile ? 'w-11 h-11' : 'w-14 h-14'}
                rounded-2xl bg-white/5 p-0.5 border border-white/10 hover:border-indigo-500/50 hover:scale-105 transition-all cursor-pointer overflow-hidden shadow-2xl
              `}
            >
              {user?.avatar ? (
                <img src={user.avatar} alt="" className="w-full h-full object-cover rounded-2xl" />
              ) : (
                <div className="w-full h-full bg-slate-800 flex items-center justify-center rounded-2xl">
                  <User className="text-white/20" size={isMobile ? 20 : 24} />
                </div>
              )}
            </div>

            {/* Active Indicator for User */}
            {!isMobile && (
              <div className="absolute -left-11 top-1/2 -translate-y-1/2 w-1.5 h-8 bg-indigo-500 rounded-r-full opacity-0 group-hover:opacity-100 transition-opacity" />
            )}

            {isUserMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setIsUserMenuOpen(false)}></div>
                <div className={`
                  absolute rounded-2xl shadow-2xl border py-2 z-50 animate-fade-in flex flex-col
                  ${isMobile ? 'bottom-full left-0 mb-4 w-56' : 'top-0 left-20 ml-2 w-64'}
                  ${isDark ? 'bg-[#1e2330] border-white/10 shadow-black/40' : 'bg-white border-slate-100 shadow-slate-200'}
                `}>
                  <div className={`px-5 py-3 border-b mb-2 ${isDark ? 'border-white/10' : 'border-slate-50'}`}>
                    <h3 className={`font-bold truncate text-base ${isDark ? 'text-white' : 'text-slate-800'}`}>{user?.fullName || 'Người dùng'}</h3>
                  </div>
                  <button
                    onClick={() => { setIsUserMenuOpen(false); setIsProfileOpen(true); }}
                    className={`w-full text-left px-5 py-3 text-[14px] transition-colors ${isDark ? 'text-white/80 hover:bg-white/5 hover:text-white' : 'text-slate-600 hover:bg-slate-50 hover:text-indigo-600'
                      }`}
                  >
                    Hồ sơ của bạn
                  </button>
                  <button
                    onClick={() => { setIsUserMenuOpen(false); setIsChangePasswordOpen(true); }}
                    className={`w-full text-left px-5 py-3 text-[14px] transition-colors ${isDark ? 'text-white/80 hover:bg-white/5 hover:text-white' : 'text-slate-600 hover:bg-slate-50 hover:text-indigo-600'
                      }`}
                  >
                    Đổi mật khẩu
                  </button>
                  <button
                    onClick={() => { setIsUserMenuOpen(false); setIsDeleteAccountOpen(true); }}
                    className={`w-full text-left px-5 py-3 text-[14px] transition-colors border-t font-medium ${isDark ? 'text-red-400 hover:bg-red-400/10 border-white/10' : 'text-red-500 hover:bg-red-50 border-slate-50'
                      }`}
                  >
                    Xóa tài khoản
                  </button>
                </div>
              </>
            )}
          </div>

          <nav className={`flex ${isMobile ? 'flex-row items-center flex-1 justify-around h-full' : 'flex-col space-y-6 items-center'} w-full`}>
            {/* Chat Icon */}
            <div className="relative group">
              <button
                onClick={() => setIsMyCloudView(false)}
                className={`
                  ${isMobile ? 'w-11 h-11' : 'w-14 h-14'}
                  flex items-center justify-center ${(!isMyCloudView && activeConversationId) ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30' : 'text-white/40 hover:text-white hover:bg-white/5'} rounded-[22px] group relative transition-all active:scale-95
                `}
              >
                <MessageSquare size={isMobile ? 22 : 24} fill={(!isMyCloudView && activeConversationId) ? "currentColor" : "none"} className="opacity-90" />
              </button>
              {!isMobile && !isMyCloudView && activeConversationId && (
                <div className="absolute -left-11 top-1/2 -translate-y-1/2 w-1.5 h-10 bg-indigo-500 rounded-r-full" />
              )}
            </div>

            {/* Notifications Icon */}
            <div className="relative group">
              <button
                onClick={() => setIsNotificationOpen(true)}
                className={`
                  ${isMobile ? 'w-11 h-11' : 'w-14 h-14'}
                  flex items-center justify-center text-white/40 hover:text-white hover:bg-white/5 rounded-[22px] transition-all group active:scale-95
                `}
                title="Thông báo"
              >
                <Bell size={isMobile ? 22 : 24} />
                {unreadCount > 0 && (
                  <div className="absolute top-2 right-2 min-w-[20px] h-[20px] px-1 bg-red-500 rounded-full flex items-center justify-center border-2 border-[#0b0e14]">
                    <span className="text-[10px] font-black text-white">{unreadCount}</span>
                  </div>
                )}
              </button>
              {!isMobile && (
                <div className="absolute -left-11 top-1/2 -translate-y-1/2 w-1.5 h-8 bg-indigo-400 rounded-r-full opacity-0 group-hover:opacity-100 transition-opacity" />
              )}
            </div>

            {/* AI Expert Icon */}
            <div className="relative group">
              <button
                onClick={handleSelectAI}
                className={`
                  ${isMobile ? 'w-11 h-11' : 'w-14 h-14'}
                  flex items-center justify-center text-white/40 hover:text-white hover:bg-white/5 rounded-[22px] transition-all group active:scale-95
                `}
                title="ShopExpert AI"
              >
                <SparklesIcon size={isMobile ? 22 : 24} />
              </button>
              {!isMobile && (
                <div className="absolute -left-11 top-1/2 -translate-y-1/2 w-1.5 h-8 bg-indigo-400 rounded-r-full opacity-0 group-hover:opacity-100 transition-opacity" />
              )}
            </div>

            {/* Friends Management Icon */}
            <div className="relative group">
              <button
                onClick={() => {
                  setFriendsInitialView('list');
                  setIsFriendsOpen(true);
                }}
                className={`
                  ${isMobile ? 'w-11 h-11' : 'w-14 h-14'}
                  flex items-center justify-center text-white/40 hover:text-white hover:bg-white/5 rounded-[22px] transition-all group active:scale-95
                `}
                title="Danh bạ bạn bè"
              >
                <Contact size={isMobile ? 22 : 24} />
              </button>
              {!isMobile && (
                <div className="absolute -left-11 top-1/2 -translate-y-1/2 w-1.5 h-8 bg-indigo-400 rounded-r-full opacity-0 group-hover:opacity-100 transition-opacity" />
              )}
            </div>

            {/* My Cloud Icon */}
            <div className="relative group">
              <button
                onClick={() => {
                  setIsMyCloudView(true);
                  if (activeConversationId) {
                    dispatch(setActiveConversation(null));
                  }
                }}
                className={`
                  ${isMobile ? 'w-11 h-11' : 'w-14 h-14'}
                  flex items-center justify-center ${isMyCloudView ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30' : 'text-white/40 hover:text-white hover:bg-white/5'} rounded-[22px] transition-all group active:scale-95
                `}
                title="Cloud của tôi"
              >
                <Cloud size={isMobile ? 22 : 24} fill={isMyCloudView ? "currentColor" : "none"} />
              </button>
              {!isMobile && (
                <div className={`absolute -left-11 top-1/2 -translate-y-1/2 w-1.5 h-10 bg-indigo-500 rounded-r-full transition-opacity ${isMyCloudView ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} />
              )}
            </div>

            {/* Mobile Logout Icon */}
            {isMobile && (
              <div className="relative group">
                <button
                  onClick={() => setIsLogoutModalOpen(true)}
                  className="w-11 h-11 flex items-center justify-center text-white/40 hover:text-red-400 hover:bg-red-400/10 rounded-[22px] transition-all group active:scale-95"
                  title="Đăng xuất"
                >
                  <LogOut size={22} />
                </button>
              </div>
            )}
          </nav>

          {!isMobile && (
            <div className="flex flex-col space-y-4 items-center">
              <button
                onClick={() => setIsLanguageSettingsOpen(true)}
                className="w-14 h-14 flex items-center justify-center text-white/20 hover:text-white hover:bg-white/5 rounded-2xl transition-all active:scale-95"
              >
                <Settings size={24} />
              </button>
              <button
                onClick={() => setIsLogoutModalOpen(true)}
                className="w-14 h-14 flex items-center justify-center text-white/20 hover:text-red-400 hover:bg-red-400/10 rounded-2xl transition-all active:scale-95"
              >
                <LogOut size={24} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* 2. Conversation Sidebar (Middle) */}
      {(!isMobile || !activeConversationId) && (

        <div className={isMobile
          ? "flex-1 flex flex-col bg-sidebar"
          : "w-[360px] flex-shrink-0 bg-sidebar border-r border-border flex flex-col transition-all duration-300"
        }>
          <div className={`${isMobile ? 'p-4 space-y-4' : 'p-6 space-y-6'}`}>
            <div className="flex items-center justify-between">
              <h1 className={`${isMobile ? 'text-xl' : 'text-2xl'} font-black text-foreground tracking-tighter`}>Tin nhắn</h1>
              <div className="flex items-center space-x-1">
                <button
                  onClick={toggleTheme}
                  className="p-2 hover:bg-surface-100 rounded-xl text-foreground/40 transition-all active:scale-90"
                  title={isDark ? "Sang chế độ sáng" : "Sang chế độ tối"}
                >
                  {isDark ? <Sun size={18} /> : <Moon size={18} />}
                </button>
                <button
                  onClick={() => setIsGroupModalOpen(true)}
                  className="p-2 hover:bg-surface-100 rounded-xl text-foreground/40 transition-colors relative group/addgroup"
                  title="Tạo nhóm mới"
                >
                  <div className="relative">
                    <Users size={isMobile ? 18 : 20} />
                    <Plus size={10} strokeWidth={3} className="absolute -top-1 -right-1.5 text-foreground/60" />
                  </div>
                </button>
                <button
                  onClick={() => {
                    setFriendsInitialView('search');
                    setIsFriendsOpen(true);
                  }}
                  className="p-2 hover:bg-surface-100 rounded-xl text-foreground/40 transition-colors"
                  title="Tìm kiếm người dùng"
                >
                  <UserPlus size={isMobile ? 18 : 20} />
                </button>
              </div>
            </div>

            <div className="relative group flex items-center space-x-2">
              <div className="relative flex-1 group">
                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                </div>
                <input
                  type="text"
                  placeholder="Tìm kiếm..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-4 py-2 bg-surface-200 text-foreground text-sm rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all placeholder:text-foreground/30 font-medium"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute inset-y-0 right-3 flex items-center text-foreground/20 hover:text-foreground/40 transition-colors"
                  >
                    <div className="bg-foreground/10 rounded-full p-0.5">
                      <Plus className="w-3 h-3 rotate-45" />
                    </div>
                  </button>
                )}
              </div>
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="text-xs font-black text-indigo-600 hover:text-indigo-700 transition-colors whitespace-nowrap pr-2"
                >
                  Đóng
                </button>
              )}
            </div>

            <div className="flex items-center justify-between border-b border-black/10 dark:border-white/5 pb-1">
              <div className="flex items-center space-x-5">
                {/* Ưu tiên Tab */}
                <button
                  onClick={() => setActiveTab('priority')}
                  className={`text-[14px] font-bold pb-2 relative transition-all active:scale-95 ${activeTab === 'priority' ? 'text-blue-500' : 'text-slate-400 hover:text-slate-600 dark:hover:text-white'}`}
                >
                  <span>Ưu tiên</span>
                  {activeTab === 'priority' && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                  )}
                </button>

                {/* Ẩn Tab */}
                <button
                  onClick={() => setActiveTab('hidden')}
                  className={`text-[14px] font-bold pb-2 relative transition-all active:scale-95 ${activeTab === 'hidden' ? 'text-blue-500' : 'text-slate-400 hover:text-slate-600 dark:hover:text-white'}`}
                >
                  <span>Ẩn</span>
                  {activeTab === 'hidden' && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                  )}
                </button>
              </div>

              <div className="relative pb-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsFilterMenuOpen(!isFilterMenuOpen);
                  }}
                  className={`flex items-center space-x-1 px-1 py-1 text-[13px] transition-all active:scale-95 ${isFilterMenuOpen || filterType !== 'all'
                    ? 'bg-blue-600 text-white px-3 py-1.5 rounded-lg shadow-lg shadow-blue-600/20 font-bold'
                    : 'hover:text-blue-600 dark:hover:text-white font-bold'
                    }`}
                  style={!(isFilterMenuOpen || filterType !== 'all') ? { color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'black' } : {}}
                >
                  <span>{(filterType === 'unread' || selectedTags.length > 0) ? (filterType === 'unread' ? 'Chưa đọc' : `Phân loại (${selectedTags.length})`) : 'Phân loại'}</span>
                  <ChevronDown size={14} strokeWidth={2.5} className={`transition-transform duration-300 ${isFilterMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                {isFilterMenuOpen && (
                  <div
                    className="absolute top-full right-0 mt-2 w-60 border border-border dark:border-white/10 shadow-2xl rounded-xl py-2 z-[60] animate-in fade-in zoom-in-95 duration-200"
                    style={{ backgroundColor: isDark ? '#0f172a' : '#ffffff' }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="px-4 py-1.5 mb-1">
                      <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: isDark ? 'rgba(255,255,255,0.4)' : '#64748b' }}>Theo trạng thái</p>
                    </div>

                    <button
                      onClick={() => { setFilterType('all'); setIsFilterMenuOpen(false); }}
                      className="w-full flex items-center justify-between px-4 py-2 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group"
                    >
                      <span className={`text-[13px] font-bold ${filterType === 'all' ? 'text-blue-500 dark:text-blue-400' : ''}`} style={filterType !== 'all' ? { color: isDark ? '#ffffff' : '#1e293b' } : {}}>Tất cả</span>
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${filterType === 'all' ? 'border-blue-500 bg-blue-500/20' : ''}`}
                        style={filterType !== 'all' ? { borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#cbd5e1' } : {}}>
                        {filterType === 'all' && <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
                      </div>
                    </button>

                    <button
                      onClick={() => { setFilterType('unread'); setIsFilterMenuOpen(false); }}
                      className="w-full flex items-center justify-between px-4 py-2 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group"
                    >
                      <div className="flex items-center space-x-2">
                        <span className={`text-[13px] font-bold ${filterType === 'unread' ? 'text-blue-500 dark:text-blue-400' : ''}`} style={filterType !== 'unread' ? { color: isDark ? '#ffffff' : '#1e293b' } : {}}>Chưa đọc</span>
                        {conversations.filter(c => (c.unreadCount || 0) > 0).length > 0 && (
                          <span className="flex items-center justify-center min-w-[16px] h-4 px-1 bg-red-500 text-white text-[9px] font-black rounded-full shadow-lg shadow-red-500/20">
                            {conversations.filter(c => (c.unreadCount || 0) > 0).length}
                          </span>
                        )}
                      </div>
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${filterType === 'unread' ? 'border-blue-500 bg-blue-500/20' : ''}`}
                        style={filterType !== 'unread' ? { borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#cbd5e1' } : {}}>
                        {filterType === 'unread' && <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
                      </div>
                    </button>

                    <div className="h-px bg-border dark:bg-white/5 my-2" />

                    <div className="px-4 py-1.5 mb-1 flex items-center justify-between">
                      <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: isDark ? 'rgba(255,255,255,0.4)' : '#64748b' }}>Theo thẻ phân loại</p>
                      {selectedTags.length > 0 && (
                        <button
                          onClick={() => setSelectedTags([])}
                          className="text-[10px] font-black text-indigo-500 hover:text-indigo-600 uppercase"
                        >
                          Xóa
                        </button>
                      )}
                    </div>

                    <div className="max-h-48 overflow-y-auto no-scrollbar">
                      {TAGS.map(tag => (
                        <button
                          key={tag.key}
                          onClick={() => {
                            setSelectedTags(prev =>
                              prev.includes(tag.key)
                                ? prev.filter(k => k !== tag.key)
                                : [...prev, tag.key]
                            );
                          }}
                          className="w-full flex items-center justify-between px-4 py-2 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group"
                        >
                          <div className="flex items-center space-x-3">
                            <div className={`w-3.5 h-3.5 ${tag.color} rounded-md rotate-45 flex-shrink-0`} style={{ clipPath: 'polygon(0% 0%, 75% 0%, 100% 50%, 75% 100%, 0% 100%)' }} />
                            <span className="text-[13px] font-bold" style={{ color: selectedTags.includes(tag.key) ? (isDark ? '#818cf8' : '#4f46e5') : (isDark ? '#ffffff' : '#1e293b') }}>
                              {tag.label}
                            </span>
                          </div>
                          <div className={`w-4 h-4 rounded-md border-2 flex items-center justify-center transition-all ${selectedTags.includes(tag.key) ? 'border-indigo-500 bg-indigo-500' : ''}`}
                            style={!selectedTags.includes(tag.key) ? { borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#cbd5e1' } : {}}>
                            {selectedTags.includes(tag.key) && (
                              <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" className="w-2.5 h-2.5">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div >

          <div className={`flex-1 overflow-y-auto no-scrollbar ${isMobile ? 'pb-20' : ''}`}>
            {loading && conversations.length === 0 ? (
              <div className="p-8 text-center text-[10px] font-mono font-black uppercase tracking-[0.3em] text-foreground/40 animate-pulse">
                Đang đồng bộ...
              </div>
            ) : (
              <Sidebar
                conversations={filteredConversations}
                onSelect={(id) => {
                  selectConversation(id);
                  setIsInfoOpen(false);
                  setIsMyCloudView(false);
                }}
                onContextMenu={handleSidebarContextMenu}
                onTogglePin={handleTogglePin}
                onDelete={handleDeleteConversation}
                activeId={activeConversationId}
                onUpdateTag={async (id, tag) => {
                  try {
                    await chatApi.updateConversationTag(id, tag);
                    fetchConversations();
                  } catch (err) {
                    console.error("Failed to update tag", err);
                  }
                }}
              />
            )}
          </div>
        </div >
      )}

      {/* 3. Main Chat Area & Info Sidebar */}
      {
        (!isMobile || activeConversationId || isMyCloudView) && (
          <div className={`flex-1 flex min-w-0 bg-background ${isMobile ? 'z-40' : ''}`}>
            {isMyCloudView ? (
              <MyCloud isDark={isDark} />
            ) : (
              <div className="flex-1 flex flex-col min-w-0">
                {activeConversation ? (
                  <ChatWindow
                    conversation={activeConversation}
                    onStartCall={handleStartCall}
                    isCallActive={callStatus !== 'idle'}
                    callStatus={callStatus}
                    onToggleInfo={() => setIsInfoOpen(!isInfoOpen)}
                    isInfoOpen={isInfoOpen}
                    onBack={() => selectConversation(null)}
                    onRefreshMessages={() => fetchMessages(activeConversationId)}
                    openLightbox={openLightbox}
                    allChatImages={allChatImages}
                  />
                ) : !isMobile ? (
                  <WelcomeCarousel
                    user={user}
                    onAction={(type) => {
                      if (type === 'createGroup') setIsGroupModalOpen(true);
                      if (type === 'addFriend') setIsSearchOpen(true);
                    }}
                  />
                ) : null}
              </div>
            )}

            {!isMobile && !isMyCloudView && activeConversationId && isInfoOpen && (
              <ConversationInfo
                conversation={activeConversation}
                onClose={() => setIsInfoOpen(false)}
                onClearHistory={() => handleDeleteConversation(activeConversationId)}
                openLightbox={openLightbox}
                allChatImages={allChatImages}
              />
            )}

            {/* Mobile Info Overlay */}
            {isMobile && activeConversationId && isInfoOpen && (
              <div className="fixed inset-0 bg-white z-[60] animate-slide-up">
                <ConversationInfo
                  conversation={activeConversation}
                  onClose={() => setIsInfoOpen(false)}
                  onClearHistory={() => handleDeleteConversation(activeConversationId)}
                  openLightbox={openLightbox}
                  allChatImages={allChatImages}
                />
              </div>
            )}
          </div>
        )
      }

      {/* Context Menu Hub */}
      {
        contextMenu && (
          <div
            className="fixed bg-white/95 backdrop-blur-xl border border-slate-200 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.15)] rounded-2xl py-2 w-64 z-[9999] animate-slide-up"
            style={{
              top: contextMenu.y,
              left: contextMenu.x
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-2 border-b border-slate-50 mb-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Tùy chọn hội thoại</p>
            </div>
            <button
              onClick={() => {
                handleTogglePin(contextMenu.conversationId);
                setContextMenu(null);
              }}
              className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 transition-colors group"
            >
              <div className="flex items-center space-x-3 text-[13px] font-bold text-slate-700">
                <Pin size={16} className={`text-slate-400 group-hover:text-indigo-500 ${conversations.find(c => c.conversationId === contextMenu.conversationId)?.isPinned ? 'fill-indigo-500 text-indigo-500' : ''}`} />
                <span>{conversations.find(c => c.conversationId === contextMenu.conversationId)?.isPinned ? 'Bỏ ghim hội thoại' : 'Ghim hội thoại'}</span>
              </div>
            </button>            <button
              onClick={() => {
                const convId = contextMenu.conversationId;
                let newHidden;
                if (hiddenConvIds.includes(convId)) {
                  newHidden = hiddenConvIds.filter(id => id !== convId);
                  showToast("Đã bỏ ẩn cuộc trò chuyện này!", "success");
                } else {
                  newHidden = [...hiddenConvIds, convId];
                  showToast("Đã ẩn cuộc trò chuyện này!", "success");
                  if (activeConversationId === convId) {
                    selectConversation(null);
                  }
                }
                setHiddenConvIds(newHidden);
                localStorage.setItem('hidden_conversation_ids', JSON.stringify(newHidden));
                setContextMenu(null);
              }}
              className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 transition-colors group border-b border-slate-50 mb-1 pb-3"
            >
              <div className="flex items-center space-x-3 text-[13px] font-bold text-slate-700">
                <EyeOff size={16} className="text-slate-400 group-hover:text-indigo-500" />
                <span>{hiddenConvIds.includes(contextMenu.conversationId) ? 'Bỏ ẩn trò chuyện' : 'Ẩn trò chuyện'}</span>
              </div>
            </button>

            <button
              onClick={() => handleDeleteConversation(contextMenu.conversationId)}
              className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-red-50 text-red-500 transition-colors group"
            >
              <div className="flex items-center space-x-3 text-[13px] font-bold">
                <Trash2 size={16} />
                <span>Xóa hội thoại</span>
              </div>
            </button>

            <button
              onClick={() => {
                setReportingConvId(contextMenu.conversationId);
                setReportReason('spam');
                setReportNotes('');
                setIsReportModalOpen(true);
                setContextMenu(null);
              }}
              className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 transition-colors group border-t border-slate-50 mt-1"
            >
              <div className="flex items-center space-x-3 text-[13px] font-bold text-slate-700">
                <AlertTriangle size={16} className="text-slate-400 group-hover:text-red-500" />
                <span>Báo xấu</span>
              </div>
            </button>
          </div >
        )
      }

      {/* Modals & Overlays */}
      <ProfileModal isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} />
      <ChangePasswordModal isOpen={isChangePasswordOpen} onClose={() => setIsChangePasswordOpen(false)} />
      <CreateGroupModal isOpen={isGroupModalOpen} onClose={() => setIsGroupModalOpen(false)} />
      <NotificationModal isOpen={isNotificationOpen} onClose={() => setIsNotificationOpen(false)} />
      <DeleteAccountModal isOpen={isDeleteAccountOpen} onClose={() => setIsDeleteAccountOpen(false)} />
      <LanguageSettingsModal isOpen={isLanguageSettingsOpen} onClose={() => setIsLanguageSettingsOpen(false)} />
      <LogoutModal isOpen={isLogoutModalOpen} onClose={() => setIsLogoutModalOpen(false)} />
      <FriendManagementModal
        isOpen={isFriendsOpen}
        onClose={() => setIsFriendsOpen(false)}
        initialView={friendsInitialView}
      />

      {isReportModalOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 backdrop-blur-md bg-black/40 animate-fade-in" onClick={() => setIsReportModalOpen(false)}>
          <div 
            className={`w-full max-w-md rounded-[32px] shadow-2xl border transition-all duration-300 scale-in-center p-6 ${
              isDark ? "bg-[#1a1e26] border-white/5 text-white" : "bg-white border-slate-100 text-slate-800"
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-4 border-b border-black/10 dark:border-white/5 mb-4">
              <div className="flex items-center space-x-2.5">
                <AlertTriangle className="text-rose-500 animate-pulse" size={22} />
                <h3 className="text-lg font-black tracking-tight">Báo cáo hội thoại</h3>
              </div>
              <button 
                onClick={() => setIsReportModalOpen(false)}
                className="p-1.5 hover:bg-black/5 dark:hover:bg-white/5 rounded-full transition-colors text-slate-400"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <p className="text-sm opacity-60 leading-relaxed font-medium">
                Vui lòng chọn lý do báo cáo cuộc trò chuyện này. Đội ngũ kiểm duyệt sẽ kiểm tra nội dung trong vòng 24h.
              </p>

              <div className="space-y-2">
                {[
                  { key: 'spam', label: 'Spam / Tin nhắn rác' },
                  { key: 'harassment', label: 'Quấy rối / Đe dọa' },
                  { key: 'scam', label: 'Lừa đảo / Giả mạo' },
                  { key: 'inappropriate', label: 'Nội dung phản cảm / Độc hại' },
                  { key: 'other', label: 'Lý do khác' }
                ].map(item => (
                  <label 
                    key={item.key} 
                    className={`flex items-center justify-between p-3.5 rounded-2xl border cursor-pointer transition-all active:scale-[0.99] ${
                      reportReason === item.key 
                        ? (isDark ? 'border-rose-500/50 bg-rose-500/10' : 'border-rose-500 bg-rose-50')
                        : (isDark ? 'border-white/5 bg-white/5 hover:bg-white/10' : 'border-slate-200 bg-white hover:bg-slate-50')
                    }`}
                  >
                    <span className="text-[14px] font-bold">{item.label}</span>
                    <input 
                      type="radio" 
                      name="reportReason" 
                      value={item.key}
                      checked={reportReason === item.key}
                      onChange={() => setReportReason(item.key)}
                      className="accent-rose-500 w-4 h-4 cursor-pointer"
                    />
                  </label>
                ))}
              </div>

              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2">Chi tiết lý do báo cáo (Không bắt buộc)</label>
                <textarea 
                  value={reportNotes}
                  onChange={(e) => setReportNotes(e.target.value)}
                  placeholder="Nhập thêm chi tiết phản ánh của bạn..."
                  className={`w-full p-4 rounded-2xl text-sm border focus:outline-none focus:ring-2 focus:ring-rose-500/20 transition-all min-h-[80px] max-h-[140px] resize-y placeholder:text-foreground/20 font-medium ${
                    isDark ? 'bg-black/20 border-white/5' : 'bg-slate-50 border-slate-200'
                  }`}
                />
              </div>
            </div>

            <div className="mt-6 flex space-x-3">
              <button 
                onClick={() => setIsReportModalOpen(false)}
                className={`flex-1 py-3.5 rounded-2xl font-bold transition-all active:scale-95 text-[14px] border ${
                  isDark ? 'bg-white/5 border-white/10 text-white hover:bg-white/10' : 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Hủy bỏ
              </button>
              <button 
                onClick={() => {
                  const reportPayload = {
                    reportId: 'REP#' + Math.random().toString(36).substr(2, 9).toUpperCase(),
                    reporterId: myId,
                    reporterName: user?.fullName || user?.name || 'Người dùng',
                    conversationId: reportingConvId,
                    conversationName: conversations?.find(c => c.conversationId === reportingConvId)?.name || 'Hội thoại',
                    reason: reportReason,
                    notes: reportNotes,
                    timestamp: new Date().toISOString()
                  };

                  try {
                    const existing = JSON.parse(localStorage.getItem('submitted_reports')) || [];
                    localStorage.setItem('submitted_reports', JSON.stringify([...existing, reportPayload]));
                    console.log("[Moderation] 🛡️ Report payload successfully sent to Moderation Queue:", reportPayload);
                  } catch (e) {
                    console.error("Failed to save report payload to localStorage", e);
                  }

                  showToast("Gửi báo cáo thành công! Cảm ơn đóng góp của bạn.", "success");
                  setIsReportModalOpen(false);
                  setReportNotes('');
                }}
                className="flex-1 py-3.5 bg-rose-500 hover:bg-rose-600 text-white rounded-2xl font-bold transition-all active:scale-95 text-[14px] shadow-lg shadow-rose-500/20"
              >
                Gửi báo cáo
              </button>
            </div>
          </div>
        </div>
      )}

      <MediaLightbox
        isOpen={lightboxData.isOpen}
        onClose={() => setLightboxData(prev => ({ ...prev, isOpen: false }))}
        images={lightboxData.images}
        currentIndex={lightboxData.currentIndex}
        onIndexChange={(index) => setLightboxData(prev => ({ ...prev, currentIndex: index }))}
      />

      {/* Video Call Component */}
      <VideoCall
        status={callStatus}
        duration={formatDuration()}
        localVideoTrack={localVideoTrack}
        localAudioTrack={localAudioTrack}
        remoteStreams={remoteStreams}
        remoteName={remoteInfo.name}
        remoteAvatar={remoteInfo.avatar}
        callType={callType}
        cameraError={cameraError}
        onHangup={handleHangup}
        onAccept={handleAcceptCall}
        onToggleMic={toggleMic}
        onToggleCamera={toggleCamera}
        micOn={micOn}
        camOn={camOn}
        audioBlocked={audioBlocked}
        onResumeAudio={resumeAudio}
        endCallReason={endCallReason}
        userLeftMsg={userLeftMsg}
        speakingUsers={speakingUsers}
        isGroup={isGroupCall}
        // Đảm bảo lấy đúng thông tin hội thoại của cuộc gọi đang diễn ra
        activeConversation={conversations.find(c => {
          const cid = String(c.id || c.conversationId || '');
          const callCid = String(activeCallCid || '');
          const incomingCid = String(incomingSignal?.conversationId || '');

          // So khớp chính xác hoặc so khớp sau khi loại bỏ tiền tố GROUP#
          const sanitize = (id) => id.replace('GROUP#', '').trim();

          return cid === callCid ||
            cid === incomingCid ||
            sanitize(cid) === sanitize(callCid) ||
            sanitize(cid) === sanitize(incomingCid);
        }) || activeConversation}
        ringDuration={ringDuration}
        onClose={() => {
          setCallStatus('idle');
          setOutgoingTarget(null);
        }}
      />

      {toast && (
        <div className="fixed top-6 right-6 z-[10000] animate-in fade-in slide-in-from-top-6 duration-300">
          <div className={`flex items-center space-x-3 px-6 py-4 rounded-2xl backdrop-blur-xl border shadow-2xl transition-all ${
            isDark 
              ? 'bg-slate-900/90 border-white/10 text-white shadow-black/40' 
              : 'bg-white/95 border-slate-200 text-slate-800 shadow-indigo-100'
          }`}>
            <div className={`w-3 h-3 rounded-full ${
              toast.type === 'error' ? 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.5)]' : 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]'
            }`} />
            <p className="text-[14px] font-bold tracking-tight">{toast.message}</p>
          </div>
        </div>
      )}
    </div >
  );
};

export default Chat;
