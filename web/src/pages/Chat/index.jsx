import React, { useEffect, useState } from 'react';
import { useChat } from '../../hooks/useChat';
import { useAuth } from '../../hooks/useAuth';
import { useVideoCall } from '../../hooks/useVideoCall';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import Sidebar from '../../components/Sidebar';
import ChatWindow from '../../components/ChatWindow';
import ConversationInfo from '../../components/ConversationInfo';
import { useWebSocket } from '../../hooks/useWebSocket';
import ProfileModal from '../../components/ProfileModal';
import ChangePasswordModal from '../../components/ChangePasswordModal';
import SearchUserModal from '../../components/SearchUserModal';
import CreateGroupModal from '../../components/CreateGroupModal';
import NotificationModal from '../../components/NotificationModal';
import DeleteAccountModal from '../../components/DeleteAccountModal';
import VideoCall from '../../components/VideoCall';
import { MessageSquare, Bell, Users, Settings, LogOut, Search, Plus, User, UserPlus, FolderDown, Mail, BellOff, EyeOff, Clock, Trash2, AlertTriangle, Pin, Sun, Moon, Stars as SparklesIcon } from 'lucide-react';
import { setPendingRequests, setPendingGroups } from '../../store/notificationSlice';
import { setConversations } from '../../store/chatSlice';
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
    fetchMessages,
    selectConversation,
    loading 
  } = useChat();

  useWebSocket(); // Initialize global real-time listener

  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isDeleteAccountOpen, setIsDeleteAccountOpen] = useState(false);

  // Call management
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const { 
    callStatus, 
    incomingSignal, 
    duration, 
    formatDuration, 
    startCall, 
    acceptCall, 
    endCall, 
    connect 
  } = useVideoCall(activeConversationId);

  useEffect(() => {
    fetchConversations();
    // Fetch initial notifications
    const fetchNotifications = () => {
      friendApi.getPendingRequests().then(res => {
        dispatch(setPendingRequests(res.data || []));
      }).catch(() => {});
      chatApi.getPendingInvitations().then(res => {
        dispatch(setPendingGroups(res.data || []));
      }).catch(() => {});
    };
    fetchNotifications();
    
    // Auto-refresh notifications every 30 seconds as fallback
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchConversations, dispatch]);

  useEffect(() => {
    const disconnect = connect((stream) => setRemoteStream(stream));
    return () => disconnect?.();
  }, [connect]);

  const handleStartCall = () => {
    startCall(
      (stream) => setLocalStream(stream),
      (stream) => setRemoteStream(stream)
    );
  };

  const handleAcceptCall = () => {
    acceptCall(
      incomingSignal,
      (stream) => setLocalStream(stream),
      (stream) => setRemoteStream(stream)
    );
  };

  const handleHangup = () => {
    endCall();
    setLocalStream(null);
    setRemoteStream(null);
  };

  const activeConversation = conversations.find(c => c.conversationId === activeConversationId) || (
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

  const [contextMenu, setContextMenu] = useState(null);

  const handleSidebarContextMenu = (e, conversationId) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, conversationId });
  };

  useEffect(() => {
    const handleGlobalClick = () => setContextMenu(null);
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
                  absolute bg-[#1e2330] rounded-2xl shadow-2xl border border-white/10 py-2 z-50 animate-fade-in flex flex-col
                  ${isMobile ? 'bottom-full left-0 mb-4 w-56' : 'top-0 left-20 ml-2 w-64'}
                `}>
                  <div className="px-5 py-3 border-b border-white/10 mb-2">
                    <h3 className="font-bold text-white truncate text-base">{user?.fullName || 'Người dùng'}</h3>
                  </div>
                  <button onClick={() => { setIsUserMenuOpen(false); setIsProfileOpen(true); }} className="w-full text-left px-5 py-3 text-[14px] text-white/80 hover:text-white hover:bg-white/5 transition-colors">Hồ sơ của bạn</button>
                  <button onClick={() => { setIsUserMenuOpen(false); setIsChangePasswordOpen(true); }} className="w-full text-left px-5 py-3 text-[14px] text-white/80 hover:text-white hover:bg-white/5 transition-colors">Đổi mật khẩu</button>
                  <button onClick={() => { setIsUserMenuOpen(false); setIsDeleteAccountOpen(true); }} className="w-full text-left px-5 py-3 text-[14px] text-red-400 hover:text-red-300 hover:bg-red-400/10 transition-colors border-t border-white/10">Xóa tài khoản</button>
                </div>
              </>
            )}
          </div>
        
        <nav className={`flex ${isMobile ? 'flex-row items-center flex-1 justify-around h-full' : 'flex-col space-y-6 items-center'} w-full`}>
          <div className="relative group">
            <button className={`
              ${isMobile ? 'w-11 h-11' : 'w-14 h-14'}
              flex items-center justify-center bg-indigo-600 text-white rounded-[22px] shadow-lg shadow-indigo-600/30 group relative transition-all active:scale-95
            `}>
              <MessageSquare size={isMobile ? 22 : 24} fill="currentColor" className="opacity-90" />
            </button>
            {!isMobile && (
              <div className="absolute -left-11 top-1/2 -translate-y-1/2 w-1.5 h-10 bg-indigo-500 rounded-r-full" />
            )}
          </div>
          
            <div className="relative group">
              <button 
                onClick={() => setIsNotificationOpen(true)}
                className={`
                  ${isMobile ? 'w-11 h-11' : 'w-14 h-14'}
                  flex items-center justify-center text-white/40 hover:text-white hover:bg-white/5 rounded-[22px] transition-all group active:scale-95
                `}
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

            <div className="relative group">
              <button 
                onClick={handleSelectAI}
                className={`
                  ${isMobile ? 'w-11 h-11' : 'w-14 h-14'}
                  flex items-center justify-center text-indigo-400 group relative transition-all bg-indigo-500/10 hover:bg-indigo-500/20 rounded-[22px] active:scale-95
                `}
              >
                <SparklesIcon size={isMobile ? 22 : 24} fill="currentColor" className="opacity-90" />
                <div className="absolute inset-0 bg-indigo-500/10 blur-xl rounded-full scale-110 opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
              {!isMobile && (
                <div className="absolute -left-11 top-1/2 -translate-y-1/2 w-1.5 h-8 bg-indigo-400 rounded-r-full opacity-0 group-hover:opacity-100 transition-opacity" />
              )}
            </div>
          
          <div className="relative group">
            <button 
              onClick={() => setIsSearchOpen(true)}
              className={`
                ${isMobile ? 'w-11 h-11' : 'w-14 h-14'}
                flex items-center justify-center text-white/40 hover:text-white hover:bg-white/5 rounded-[22px] transition-all active:scale-95
              `}
            >
              <Users size={isMobile ? 22 : 24} />
            </button>
            {!isMobile && (
              <div className="absolute -left-11 top-1/2 -translate-y-1/2 w-1.5 h-8 bg-indigo-400 rounded-r-full opacity-0 group-hover:opacity-100 transition-opacity" />
            )}
          </div>
        </nav>
        
        {!isMobile && (
          <div className="flex flex-col space-y-4 items-center">
             <button className="w-14 h-14 flex items-center justify-center text-white/20 hover:text-white hover:bg-white/5 rounded-2xl transition-all active:scale-95">
                <Settings size={24} />
             </button>
             <button 
              onClick={logout}
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
          ? "flex-1 flex-shrink-0 bg-sidebar border-r border-border flex flex-col transition-all duration-300" 
          : "w-[360px] flex-shrink-0 bg-sidebar border-r border-border flex flex-col transition-all duration-300"
        }>
          <div className={`${isMobile ? 'p-4 space-y-4' : 'p-6 space-y-6'}`}>
            <div className="flex items-center justify-between">
                <h1 className={`${isMobile ? 'text-xl' : 'text-2xl'} font-black text-foreground tracking-tighter`}>Messages</h1>
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
                    className="p-2 hover:bg-surface-100 rounded-xl text-foreground/40 transition-colors"
                  >
                      <UserPlus size={isMobile ? 18 : 20} />
                  </button>
                  <button 
                    onClick={() => setIsSearchOpen(true)}
                    className="p-2 hover:bg-surface-100 rounded-xl text-foreground/40 transition-colors"
                  >
                      <Plus size={isMobile ? 18 : 20} />
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
                  className="w-full pl-12 pr-4 py-2.5 bg-surface-200 text-foreground text-sm rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all placeholder:text-foreground/30 font-bold"
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
          </div>
          
          <div className={`flex-1 overflow-y-auto no-scrollbar ${isMobile ? 'pb-20' : ''}`}>
            {loading && conversations.length === 0 ? (
              <div className="p-8 text-center text-[10px] font-mono font-black uppercase tracking-[0.3em] text-foreground/40 animate-pulse">
                Syncing...
              </div>
            ) : (
              <Sidebar 
                conversations={filteredConversations} 
                onSelect={(id) => {
                  selectConversation(id);
                  setIsInfoOpen(false);
                }}
                onContextMenu={handleSidebarContextMenu}
                onTogglePin={handleTogglePin}
                onDelete={handleDeleteConversation}
                activeId={activeConversationId}
              />
            )}
          </div>
        </div>
      )}

      {/* 3. Main Chat Area & Info Sidebar */}
      {(!isMobile || activeConversationId) && (
        <div className={`flex-1 flex min-w-0 bg-background ${isMobile ? 'z-40' : ''}`}>
          <div className="flex-1 flex flex-col min-w-0">
            {activeConversation ? (
              <ChatWindow 
                conversation={activeConversation} 
                onStartCall={handleStartCall}
                onToggleInfo={() => setIsInfoOpen(!isInfoOpen)}
                isInfoOpen={isInfoOpen}
                onBack={isMobile ? () => selectConversation(null) : undefined}
                onRefreshMessages={() => fetchMessages(activeConversationId)}
              />
            ) : !isMobile ? (
              <div className="flex-1 flex flex-col items-center justify-center text-cursor-dark/10 p-12">
                <div className="relative mb-8">
                  <div className="absolute inset-0 bg-cursor-accent/5 blur-3xl rounded-full scale-150" />
                  <div className="relative w-32 h-32 bg-white border border-cursor-dark/[0.03] rounded-[40px] shadow-2xl flex items-center justify-center">
                    <MessageSquare className="text-cursor-dark/5" size={64} />
                  </div>
                </div>
                <h3 className="text-2xl font-black text-cursor-dark tracking-tighter mb-2">Establish Connection</h3>
                <p className="max-w-xs text-center text-sm text-cursor-dark/30 font-medium leading-relaxed">
                  Select a communication channel to begin broadcasting.
                </p>
              </div>
            ) : null}
          </div>

          {!isMobile && activeConversationId && isInfoOpen && (
            <ConversationInfo 
              conversation={activeConversation}
              onClose={() => setIsInfoOpen(false)}
              onClearHistory={() => handleDeleteConversation(activeConversationId)}
            />
          )}

          {/* Mobile Info Overlay */}
          {isMobile && activeConversationId && isInfoOpen && (
            <div className="fixed inset-0 bg-white z-[60] animate-slide-up">
               <ConversationInfo 
                conversation={activeConversation}
                onClose={() => setIsInfoOpen(false)}
                onClearHistory={() => handleDeleteConversation(activeConversationId)}
              />
            </div>
          )}
        </div>
      )}

      {/* Context Menu Hub */}
      {contextMenu && (
        <div 
          className="fixed bg-white/95 backdrop-blur-xl border border-slate-200 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.15)] rounded-2xl py-2 w-64 z-[9999] animate-slide-up"
          style={{ 
            top: contextMenu.y, 
            left: contextMenu.x,
            transform: (contextMenu.y + 450 > window.innerHeight) ? 'translateY(-100%)' : 'none'
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
          </button>
          
          <button className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 transition-colors group">
            <div className="flex items-center space-x-3 text-[13px] font-bold text-slate-700">
               <FolderDown size={16} className="text-slate-400 group-hover:text-indigo-500" />
               <span>Chuyển sang mục Khác</span>
            </div>
          </button>

          <button className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 transition-colors group border-b border-slate-50 mb-1 pb-3">
            <div className="flex items-center space-x-3 text-[13px] font-bold text-slate-700">
               <Mail size={16} className="text-slate-400 group-hover:text-indigo-500" />
               <span>Đánh dấu chưa đọc</span>
            </div>
          </button>

          <button className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 transition-colors group">
            <div className="flex items-center space-x-3 text-[13px] font-bold text-slate-700">
               <BellOff size={16} className="text-slate-400 group-hover:text-indigo-500" />
               <span>Tắt thông báo</span>
            </div>
          </button>

          <button className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 transition-colors group">
            <div className="flex items-center space-x-3 text-[13px] font-bold text-slate-700">
               <EyeOff size={16} className="text-slate-400 group-hover:text-indigo-500" />
               <span>Ẩn trò chuyện</span>
            </div>
          </button>

          <button className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 transition-colors group border-b border-slate-50 mb-1 pb-3">
            <div className="flex items-center space-x-3 text-[13px] font-bold text-slate-700">
               <Clock size={16} className="text-slate-400 group-hover:text-indigo-500" />
               <span>Tin nhắn tự xóa</span>
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

          <button className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 transition-colors group">
            <div className="flex items-center space-x-3 text-[13px] font-bold text-slate-700">
               <AlertTriangle size={16} className="text-slate-400 group-hover:text-red-500" />
               <span>Báo xấu</span>
            </div>
          </button>
        </div>
      )}

      {/* Modals & Overlays */}
      <ProfileModal isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} />
      <ChangePasswordModal isOpen={isChangePasswordOpen} onClose={() => setIsChangePasswordOpen(false)} />
      <SearchUserModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
      <CreateGroupModal isOpen={isGroupModalOpen} onClose={() => setIsGroupModalOpen(false)} />
      <NotificationModal isOpen={isNotificationOpen} onClose={() => setIsNotificationOpen(false)} />
      <DeleteAccountModal isOpen={isDeleteAccountOpen} onClose={() => setIsDeleteAccountOpen(false)} />
      
      <VideoCall 
        status={callStatus}
        duration={formatDuration()}
        localStream={localStream}
        remoteStream={remoteStream}
        onHangup={handleHangup}
        onAccept={handleAcceptCall}
      />
    </div>
  );
};

export default Chat;
