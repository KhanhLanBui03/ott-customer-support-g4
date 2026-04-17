import React, { useEffect, useState } from 'react';
import { useChat } from '../../hooks/useChat';
import { useAuth } from '../../hooks/useAuth';
import { useVideoCall } from '../../hooks/useVideoCall';
import Sidebar from '../../components/Sidebar';
import ChatWindow from '../../components/ChatWindow';
import ConversationInfo from '../../components/ConversationInfo';
import { useWebSocket } from '../../hooks/useWebSocket';
import ProfileModal from '../../components/ProfileModal';
import SearchUserModal from '../../components/SearchUserModal';
import CreateGroupModal from '../../components/CreateGroupModal';
import NotificationModal from '../../components/NotificationModal';
import VideoCall from '../../components/VideoCall';
import { MessageSquare, Bell, Users, Settings, LogOut, Search, Plus, User, UserPlus, FolderDown, Mail, BellOff, EyeOff, Clock, Trash2, AlertTriangle, Pin } from 'lucide-react';
import { setPendingRequests, setPendingGroups } from '../../store/notificationSlice';
import { useDispatch, useSelector } from 'react-redux';
import { chatApi } from '../../api/chatApi';
import { friendApi } from '../../api/friendApi';

const Chat = () => {
  const { user, logout } = useAuth();
  const dispatch = useDispatch();
  const { unreadCount } = useSelector(state => state.notification);
  const { 
    conversations, 
    activeConversationId, 
    fetchConversations, 
    selectConversation,
    loading 
  } = useChat();

  useWebSocket(); // Initialize global real-time listener

  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [isInfoOpen, setIsInfoOpen] = useState(false);

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
    friendApi.getPendingRequests().then(res => {
      dispatch(setPendingRequests(res.data || []));
    });
    chatApi.getPendingInvitations().then(res => {
      dispatch(setPendingGroups(res.data || []));
    });
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

  const activeConversation = conversations.find(c => c.conversationId === activeConversationId);

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
          window.location.reload();
       } catch (err) {
          console.error("Delete failed", err);
       }
    }
  };

  return (
    <div className="flex h-screen bg-white overflow-hidden font-sans">
      {/* 1. Global Icon Sidebar (Leftmost) */}
      <div className="w-[84px] flex-shrink-0 bg-cursor-dark flex flex-col items-center py-8 space-y-10 z-50">
        <div 
          onClick={() => setIsProfileOpen(true)}
          className="w-14 h-14 rounded-2xl bg-white/5 p-0.5 border border-white/10 hover:scale-105 transition-transform cursor-pointer overflow-hidden shadow-xl shadow-black/20"
        >
          {user?.avatar ? (
            <img src={user.avatar} alt="" className="w-full h-full object-cover rounded-2xl" />
          ) : (
            <div className="w-full h-full bg-slate-800 flex items-center justify-center rounded-2xl">
               <User className="text-white/20" size={24} />
            </div>
          )}
        </div>
        
        <nav className="flex flex-col space-y-6 flex-1">
          <button className="p-4 bg-cursor-accent text-white rounded-[22px] shadow-lg shadow-cursor-accent/30 group relative transition-all hover:scale-110">
            <MessageSquare size={24} fill="currentColor" className="opacity-80" />
            <div className="absolute left-full ml-6 px-3 py-1.5 bg-slate-900 text-[10px] text-white rounded-lg opacity-0 group-hover:opacity-100 transition-all scale-95 group-hover:scale-100 whitespace-nowrap pointer-events-none uppercase tracking-widest font-bold shadow-2xl border border-white/5">Messages</div>
          </button>
          
          <button 
            onClick={() => setIsNotificationOpen(true)}
            className="p-4 text-white/30 hover:text-white hover:bg-white/5 rounded-[22px] transition-all group relative"
          >
            <Bell size={24} />
            {unreadCount > 0 && (
              <div className="absolute top-2 right-2 min-w-[20px] h-[20px] px-1 bg-red-500 rounded-full flex items-center justify-center border-2 border-cursor-dark animate-bounce">
                <span className="text-[10px] font-black text-white">{unreadCount}</span>
              </div>
            )}
            <div className="absolute left-full ml-6 px-3 py-1.5 bg-slate-900 text-[10px] text-white rounded-lg opacity-0 group-hover:opacity-100 transition-all scale-95 group-hover:scale-100 whitespace-nowrap pointer-events-none uppercase tracking-widest font-bold shadow-2xl border border-white/5">Thông báo</div>
          </button>
          
          <button 
            onClick={() => setIsSearchOpen(true)}
            className="p-4 text-white/30 hover:text-white hover:bg-white/5 rounded-[22px] transition-all group relative"
          >
            <Users size={24} />
          </button>
          
          <button className="p-4 text-white/30 hover:text-white hover:bg-white/5 rounded-[22px] transition-all group relative">
            <Settings size={24} />
          </button>
        </nav>
        
        <button 
          onClick={logout}
          className="p-4 text-white/20 hover:text-red-400 hover:bg-red-400/10 rounded-2xl transition-all"
        >
          <LogOut size={24} />
        </button>
      </div>

      {/* 2. Conversation Sidebar (Middle) */}
      <div className="w-[360px] flex-shrink-0 bg-white border-r border-slate-100 flex flex-col">
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
              <h1 className="text-2xl font-black text-slate-800 tracking-tighter">Messages</h1>
              <div className="flex space-x-1">
                <button 
                  onClick={() => setIsGroupModalOpen(true)}
                  className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 transition-colors group relative"
                  title="Tạo nhóm"
                >
                    <UserPlus size={20} />
                </button>
                <button 
                  onClick={() => setIsSearchOpen(true)}
                  className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 transition-colors"
                  title="Tìm kiếm"
                >
                    <Plus size={20} />
                </button>
              </div>
          </div>
          
          <div className="relative group">
            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-slate-400 group-focus-within:text-cursor-accent transition-colors" />
            </div>
            <input
              type="text"
              placeholder="Search chats..."
              className="w-full pl-12 pr-4 py-3 bg-slate-100 text-slate-700 text-sm rounded-2xl focus:outline-none focus:ring-2 focus:ring-cursor-accent/20 transition-all placeholder:text-slate-400 font-medium"
            />
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto no-scrollbar">
          {loading ? (
            <div className="p-8 text-center text-[10px] font-mono font-black uppercase tracking-[0.3em] text-cursor-dark/20 animate-pulse">
              Syncing signal hubs...
            </div>
          ) : (
            <Sidebar 
              conversations={conversations} 
              onSelect={(id) => {
                selectConversation(id);
                setIsInfoOpen(false); // Close info when switching
              }}
              onContextMenu={handleSidebarContextMenu}
              activeId={activeConversationId}
            />
          )}
        </div>
      </div>

      {/* 3. Main Chat Area & Info Sidebar */}
      <div className="flex-1 flex min-w-0 bg-[#fdfdfd]">
        <div className="flex-1 flex flex-col min-w-0">
          {activeConversationId ? (
            <ChatWindow 
              conversationId={activeConversationId} 
              onStartCall={handleStartCall}
              onToggleInfo={() => setIsInfoOpen(!isInfoOpen)}
              isInfoOpen={isInfoOpen}
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-cursor-dark/10 p-12">
              <div className="relative mb-8">
                <div className="absolute inset-0 bg-cursor-accent/5 blur-3xl rounded-full scale-150" />
                <div className="relative w-32 h-32 bg-white border border-cursor-dark/[0.03] rounded-[40px] shadow-2xl flex items-center justify-center">
                  <MessageSquare className="text-cursor-dark/5" size={64} />
                </div>
              </div>
              <h3 className="text-2xl font-black text-cursor-dark tracking-tighter mb-2">Establish Connection</h3>
              <p className="max-w-xs text-center text-sm text-cursor-dark/30 font-medium leading-relaxed">
                Select a secure communication channel from the sidebar to begin broadcasting.
              </p>
            </div>
          )}
        </div>

        {activeConversationId && isInfoOpen && (
          <ConversationInfo 
            conversation={activeConversation}
            onClose={() => setIsInfoOpen(false)}
            onClearHistory={() => {
              if (window.confirm('Xóa toàn bộ lịch sử trò chuyện phía bạn?')) {
              }
            }}
          />
        )}
      </div>

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
          <button className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 transition-colors group">
            <div className="flex items-center space-x-3 text-[13px] font-bold text-slate-700">
               <Pin size={16} className="text-slate-400 group-hover:text-indigo-500" />
               <span>Ghim hội thoại</span>
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
      <SearchUserModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
      <CreateGroupModal isOpen={isGroupModalOpen} onClose={() => setIsGroupModalOpen(false)} />
      <NotificationModal isOpen={isNotificationOpen} onClose={() => setIsNotificationOpen(false)} />
      
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
