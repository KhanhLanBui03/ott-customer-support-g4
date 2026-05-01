import React, { useEffect, useState, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useChat } from '../../hooks/useChat';
import { setReplyingTo, setActiveConversation, resetUnreadCount } from '../../store/chatSlice';
import MessageList from '../MessageList';
import MessageInput from '../MessageInput';
import ForwardModal from '../ForwardModal';
import { chatApi } from '../../api/chatApi';
import { Phone, Video, PanelRight, MoreVertical, MoreHorizontal, ShieldCheck, Pin, X, ChevronDown, ChevronUp, ChevronRight, Trash2, UserPlus, ArrowLeft, Stars as SparklesIcon, Ban, AlertCircle, MessageCircle } from 'lucide-react';
import { friendApi } from '../../api/friendApi';
import GroupAvatar from '../GroupAvatar';
import { useTheme } from '../../hooks/useTheme';

const cn = (...classes) => classes.filter(Boolean).join(" ");

const ChatWindow = ({ conversation, onStartCall, isCallActive, onToggleInfo, isInfoOpen, onBack, onRefreshMessages }) => {
  const { isDark } = useTheme();
  const conversationId = conversation?.conversationId;
  const { user } = useSelector(state => state.auth);
  const { replyingTo } = useSelector(state => state.chat);
  const dispatch = useDispatch();
  const { messages, fetchMessages, fetchConversations, messagesLoading, conversations, friends, fetchFriends } = useChat();
  const [showPinsDropdown, setShowPinsDropdown] = useState(false);
  const [isTagMenuOpen, setIsTagMenuOpen] = useState(false);
  const [showStrangerMenu, setShowStrangerMenu] = useState(false);
  const tagMenuRef = useRef(null);
  const strangerMenuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (tagMenuRef.current && !tagMenuRef.current.contains(event.target)) {
        setIsTagMenuOpen(false);
      }
      if (strangerMenuRef.current && !strangerMenuRef.current.contains(event.target)) {
        setShowStrangerMenu(false);
      }
    };

    if (isTagMenuOpen || showStrangerMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isTagMenuOpen, showStrangerMenu]);

  const TAGS = [
    { key: 'customer', label: 'Khách hàng', color: 'bg-red-500', textColor: 'text-red-500', borderColor: 'border-red-500/20', bgColor: 'bg-red-500/5' },
    { key: 'family', label: 'Gia đình', color: 'bg-emerald-500', textColor: 'text-emerald-500', borderColor: 'border-emerald-500/20', bgColor: 'bg-emerald-500/5' },
    { key: 'work', label: 'Công việc', color: 'bg-orange-500', textColor: 'text-orange-500', borderColor: 'border-orange-500/20', bgColor: 'bg-orange-500/5' },
    { key: 'friends', label: 'Bạn bè', color: 'bg-purple-500', textColor: 'text-purple-500', borderColor: 'border-purple-500/20', bgColor: 'bg-purple-500/5' },
    { key: 'later', label: 'Trả lời sau', color: 'bg-yellow-500', textColor: 'text-amber-500', borderColor: 'border-amber-500/20', bgColor: 'bg-amber-500/5' },
    { key: 'colleague', label: 'Đồng nghiệp', color: 'bg-blue-500', textColor: 'text-blue-500', borderColor: 'border-blue-500/20', bgColor: 'bg-blue-500/5' }
  ];

  const [forwardingMessage, setForwardingMessage] = useState(null);
  const [isForwardModalOpen, setIsForwardModalOpen] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [pendingCallType, setPendingCallType] = useState(null);

  const handleCallClick = (type) => {
    if (currentConv?.type === 'GROUP') {
      setPendingCallType(type);
      setCountdown(3);
    } else {
      onStartCall(type);
    }
  };

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else if (countdown === 0 && pendingCallType) {
      onStartCall(pendingCallType);
      setPendingCallType(null);
    }
  }, [countdown, pendingCallType, onStartCall]);

  useEffect(() => {
    const handleStartCallAgain = (e) => {
      const type = e.detail?.type || 'video';
      handleCallClick(type);
    };
    window.addEventListener('START_CALL_AGAIN', handleStartCallAgain);
    return () => window.removeEventListener('START_CALL_AGAIN', handleStartCallAgain);
  }, []);

  useEffect(() => {
    if (replyingTo) {
      console.log('[DEBUG] Replying to set:', replyingTo);
    }
  }, [replyingTo]);
  
  const localOnRefresh = onRefreshMessages || fetchConversations;
 
  useEffect(() => {
    fetchFriends();
  }, [fetchFriends]);

  const currentConv = conversation || conversations.find(c => c.conversationId === conversationId);

  // Find the other member for status display in single chats
  const currentMember = currentConv?.members?.find(m => {
    const mId = String(m.userId || m.id || '');
    const uId = String(user?.id || user?.userId || '');
    return mId !== uId && mId !== '';
  });

  const formatLastSeen = (status, lastSeenAt) => {
    if (status === 'ONLINE') return 'Online';
    if (!lastSeenAt) return 'Offline';
    const now = Date.now();
    const diff = Math.floor((now - lastSeenAt) / 1000); // seconds
    if (diff < 60) return 'Vừa mới truy cập';
    if (diff < 3600) return `Hoạt động ${Math.floor(diff / 60)} phút trước`;
    if (diff < 86400) return `Hoạt động ${Math.floor(diff / 3600)} giờ trước`;
    return `Hoạt động ${Math.floor(diff / 86400)} ngày trước`;
  };





  const scrollToMessage = (messageId) => {
    const element = document.getElementById(`msg-${messageId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Temporary highlight effect
      element.classList.add('bg-indigo-50/50');
      setTimeout(() => element.classList.remove('bg-indigo-50/50'), 2000);
    }
  };

  useEffect(() => {
    if (conversationId) {
      dispatch(setActiveConversation(conversationId));
      dispatch(resetUnreadCount(conversationId));
      
      // Mark as read in backend
      friendApi.markAsRead?.(conversationId).catch(() => {});
      // Also try chatApi if it's the one responsible
      chatApi.markConversationAsRead?.(conversationId).catch(() => {});

      fetchMessages(conversationId);
      setShowPinsDropdown(false); 

      dispatch(setReplyingTo(null));
    }

    return () => {
      dispatch(setActiveConversation(null));
    };
  }, [conversationId, fetchMessages, dispatch]);

  return (
    <div className="flex-1 flex flex-col h-full bg-background transition-colors overflow-hidden">
      {/* ─── GROUP CALL COUNTDOWN OVERLAY ─── */}
      {countdown > 0 && (
        <div className="fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="relative flex items-center justify-center">
            {/* Vòng tròn loading */}
            <svg className="w-48 h-48 animate-spin-slow" viewBox="0 0 100 100">
              <circle
                className="text-white/20 stroke-current"
                strokeWidth="4"
                cx="50" cy="50" r="45" fill="transparent"
              />
              <circle
                className="text-indigo-500 stroke-current drop-shadow-[0_0_15px_rgba(99,102,241,0.8)]"
                strokeWidth="4"
                strokeLinecap="round"
                cx="50" cy="50" r="45" fill="transparent"
                strokeDasharray="282.7"
                strokeDashoffset={282.7 - (282.7 * countdown) / 3}
                style={{ transition: 'stroke-dashoffset 1s linear' }}
              />
            </svg>

            {/* Số đếm ngược */}
            <span className="absolute text-7xl font-black text-white drop-shadow-2xl">
              {countdown}
            </span>
          </div>
          <p className="mt-8 text-2xl font-bold text-white/90 animate-pulse">
            {pendingCallType === 'audio' ? 'Chuẩn bị gọi thoại nhóm...' : 'Chuẩn bị gọi video nhóm...'}
          </p>
          <button
            onClick={() => {
              setCountdown(0);
              setPendingCallType(null);
            }}
            className="mt-8 px-8 py-3 rounded-full bg-white/10 hover:bg-red-500/80 text-white font-medium transition-all hover:scale-105 active:scale-95"
          >
            Hủy
          </button>
        </div>
      )}

      {/* Header */}
      <div className={`
        ${onBack ? 'h-20 px-4' : 'h-[88px] px-8'} 
        glass-premium flex items-center justify-between z-30 sticky top-0 transition-all
      `}>
        <div className="flex items-center space-x-3">
          {onBack && (
            <button 
              onClick={onBack}
              className="p-2 -ml-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
            >
              <ArrowLeft size={20} />
            </button>
          )}
          
          <div className="relative flex-shrink-0">
            <GroupAvatar 
              conversation={currentConv} 
              size={onBack ? 'h-10 w-10' : 'h-14 w-14'} 
            />
            {currentMember?.status === 'ONLINE' && (
              <div className={`absolute -bottom-0.5 -right-0.5 ${onBack ? 'w-3.5 h-3.5' : 'w-4.5 h-4.5'} rounded-full bg-background flex items-center justify-center`}>
                <div className="w-full h-full rounded-full bg-emerald-500 status-glow shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
              </div>
            )}
          </div>
          <div className="min-w-0">
            <h2 className={`
              ${onBack ? 'text-base' : 'text-xl'} 
              font-bold text-foreground tracking-tighter leading-none mb-1.5 flex items-center space-x-1.5 truncate
            `}>
              <span className="truncate">
                {currentConv?.type === 'SINGLE' 
                  ? (currentMember?.fullName || currentMember?.name || currentConv?.name || 'Người dùng')
                  : (currentConv?.name || 'Nhóm chat')}
              </span>
              {currentConv?.isAI ? (
                <SparklesIcon size={onBack ? 14 : 16} className="text-indigo-500 animate-pulse" />
              ) : (
                <ShieldCheck size={onBack ? 14 : 16} className="text-cursor-accent flex-shrink-0" />
              )}
            </h2>
            <div className="flex items-center space-x-2">
              <span className={`text-[11px] font-medium ${currentMember?.status === 'ONLINE' ? 'text-emerald-500' : 'text-slate-400 dark:text-slate-500'}`}>
                {currentMember ? formatLastSeen(currentMember.status, currentMember.lastSeenAt) : 'Vừa mới truy cập'}
              </span>
              
              <div className="w-px h-3 bg-border mx-1" />

              {currentConv?.type === 'SINGLE' && !currentConv?.isAI && (
                <span className="text-[11px] font-medium text-slate-400">
                  {(() => {
                    const friend = Array.isArray(friends) && friends.find(f => {
                      const fId = String(f.userId || f.id || f.friendId || '').toLowerCase();
                      const mId = String(currentMember?.userId || currentMember?.id || '').toLowerCase();
                      return fId !== '' && fId === mId;
                    });
                    
                    if (friend?.status === 'BLOCKED') return 'Bị chặn';
                    if (friend?.status === 'ACCEPTED') return 'Bạn bè';
                    return 'Người lạ';
                  })()}
                </span>
              )}
              
              {currentConv?.type === 'GROUP' && (
                <span className="text-[11px] font-medium text-indigo-500/70">
                  Nhóm trò chuyện
                </span>
              )}

              <div className="w-px h-3 bg-border mx-1" />

              {/* Classification Tag Indicator */}
              <div className="relative">
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsTagMenuOpen(!isTagMenuOpen);
                  }}
                  className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg transition-all hover:bg-surface-200 group ${
                    currentConv?.tag ? 'bg-surface-100 shadow-sm border border-border/50' : 'text-slate-400'
                  }`}
                >
                  <div
                    className={`w-2.5 h-2.5 rounded-sm rotate-45 transition-transform group-hover:scale-110 ${
                      currentConv?.tag 
                        ? TAGS.find(t => t.key === currentConv.tag)?.color 
                        : 'border border-slate-400 bg-transparent'
                    }`}
                    style={{ clipPath: 'polygon(0% 0%, 75% 0%, 100% 50%, 75% 100%, 0% 100%)' }}
                  />
                  <span className={`text-[11px] font-semibold uppercase tracking-wider ${currentConv?.tag ? TAGS.find(t => t.key === currentConv.tag)?.textColor : 'text-slate-400'}`}>
                    {currentConv?.tag ? TAGS.find(t => t.key === currentConv.tag)?.label : 'Phân loại'}
                  </span>
                </button>

                {isTagMenuOpen && (
                  <div
                    ref={tagMenuRef}
                    className="absolute top-full left-0 mt-2 w-64 bg-white dark:bg-slate-900 border border-border dark:border-white/10 shadow-2xl rounded-2xl py-2 z-[100001] animate-in fade-in slide-in-from-top-4 duration-300"
                    onClick={(e) => e.stopPropagation()}
                  >
                       <div className="px-5 py-3 mb-1 border-b border-border/40 dark:border-white/10 bg-surface-100 dark:bg-white/5 rounded-t-2xl">
                         <p className="text-[11px] font-bold uppercase text-foreground/40 dark:text-white/50 tracking-widest text-center">Phân loại hội thoại</p>
                       </div>
                       {TAGS.map(tag => (
                         <button
                           key={tag.key}
                           onClick={async (e) => {
                             e.stopPropagation();
                             try {
                               await chatApi.updateConversationTag(conversationId, tag.key);
                               setIsTagMenuOpen(false);
                               fetchConversations();
                             } catch (err) {
                               console.error("Failed to update tag", err);
                             }
                           }}
                           className="w-full flex items-center space-x-4 px-5 py-3 hover:bg-foreground/5 dark:hover:bg-white/5 transition-all text-left group"
                         >
                           <div className={`w-4 h-4 ${tag.color} rounded-[4px] rotate-45 flex-shrink-0 shadow-sm transition-transform group-hover:scale-110`} style={{ clipPath: 'polygon(0% 0%, 75% 0%, 100% 50%, 75% 100%, 0% 100%)' }} />
                           <span className={`text-[14px] font-bold ${currentConv?.tag === tag.key ? 'text-indigo-600' : 'text-foreground/70 dark:text-white/80'}`}>{tag.label}</span>
                         </button>
                       ))}

                       <div className="h-px bg-border dark:bg-white/5 my-2 mx-2" />

                       {currentConv?.tag && (
                         <button
                           onClick={async (e) => {
                             e.stopPropagation();
                             try {
                               await chatApi.updateConversationTag(conversationId, null);
                               setIsTagMenuOpen(false);
                               fetchConversations();
                             } catch (err) {
                               console.error("Failed to update tag", err);
                             }
                           }}
                           className="w-full flex items-center space-x-4 px-5 py-3 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all text-left"
                         >
                           <Trash2 size={16} className="text-red-500" />
                           <span className="text-[14px] font-bold text-red-500">Gỡ nhãn phân loại</span>
                         </button>
                       )}

                       <button
                         className="w-full flex items-center justify-center py-3 text-foreground/40 hover:text-indigo-600 transition-colors border-t border-border dark:border-white/5 mt-1"
                         onClick={(e) => { e.stopPropagation(); alert("Tính năng đang phát triển!"); }}
                       >
                         <span className="text-[13px] font-medium">Quản lý thẻ phân loại</span>
                       </button>
                    </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2 sm:space-x-4">
          <div className="hidden sm:flex items-center bg-surface-200 p-1 rounded-2xl border border-cursor-dark/5">
            <button
              onClick={() => handleCallClick('audio')}
              disabled={isCallActive}
              className="p-2.5 hover:bg-white hover:text-cursor-dark text-slate-500 dark:text-slate-400 rounded-xl transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Phone size={18} />
            </button>
            <button
              onClick={() => handleCallClick('video')}
              disabled={isCallActive}
              className="p-2.5 hover:bg-white hover:text-cursor-dark text-slate-500 dark:text-slate-400 rounded-xl transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Video size={18} />
            </button>
          </div>
          
          <button 
            onClick={onToggleInfo}
            className={`p-2.5 rounded-xl transition-all ${isInfoOpen ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-500/10'}`}
          >
            <PanelRight size={20} />
          </button>
        </div>
      </div>

      {/* Pinned Messages Bar */}
      {currentConv?.pinnedMessages && currentConv.pinnedMessages.length > 0 && (
        <div className={`relative z-20 ${isDark ? 'bg-[#1e2330]' : 'bg-[#f0f7ff]'} border-b ${isDark ? 'border-white/5' : 'border-[#d7e9fb]'} transition-all duration-500 ease-in-out overflow-hidden shadow-sm`}>
          <div 
            className="transition-all duration-500 ease-in-out relative"
            style={{ 
              maxHeight: showPinsDropdown ? '500px' : '48px',
              minHeight: '48px'
            }}
          >
            {/* Collapsed State - Always in DOM but fades out */}
            <div 
              className={cn(
                "flex items-center justify-between px-4 sm:px-6 h-[48px] cursor-pointer transition-all duration-500 absolute inset-x-0 top-0 z-10",
                isDark ? "hover:bg-white/5" : "hover:bg-[#e1efff]",
                showPinsDropdown ? "opacity-0 -translate-y-4 pointer-events-none" : "opacity-100 translate-y-0"
              )}
              onClick={() => setShowPinsDropdown(true)}
            >
              <div className="flex items-center space-x-3 overflow-hidden">
                <div className={isDark ? "text-blue-400" : "text-[#0068ff]"}>
                  <MessageCircle size={18} />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className={`text-[10px] font-bold uppercase leading-none mb-0.5 ${isDark ? 'text-white/40' : 'text-slate-500'}`}>Tin nhắn</span>
                  <p className={`text-[13px] font-medium truncate leading-tight ${isDark ? 'text-white/90' : 'text-slate-900'}`}>
                    {(() => {
                      const lastPin = currentConv.pinnedMessages[currentConv.pinnedMessages.length - 1];
                      const sender = lastPin.senderName || "Thành viên";
                      return (
                        <>
                          <span className="font-bold">{sender}:</span> {lastPin.content || "[Tệp đính kèm]"}
                        </>
                      );
                    })()}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center space-x-2 ml-4">
                {currentConv.pinnedMessages.length > 1 && (
                  <div className={`flex items-center space-x-1 px-2 py-1 rounded-md border transition-colors ${isDark ? 'bg-white/10 border-white/10 hover:bg-white/20' : 'bg-slate-200/50 border-slate-300/30 hover:bg-slate-200'}`}>
                    <span className={`text-[11px] font-bold ${isDark ? 'text-white/80' : 'text-slate-600'}`}>+{currentConv.pinnedMessages.length - 1} ghim</span>
                    <ChevronDown size={12} className={isDark ? 'text-white/40' : 'text-slate-400'} />
                  </div>
                )}
                <button className={`p-1.5 transition-colors ${isDark ? 'text-white/40 hover:text-white' : 'text-slate-400 hover:text-[#0068ff]'}`}>
                  <MoreHorizontal size={18} />
                </button>
              </div>
            </div>

            {/* Expanded State - Slides and fades in */}
            <div className={cn(
              "flex flex-col transition-all duration-500 ease-in-out",
              showPinsDropdown ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
            )}>
              {/* Header */}
              <div className={`flex items-center justify-between px-4 sm:px-6 py-2 border-b shrink-0 ${isDark ? 'border-white/5 bg-white/5' : 'border-[#d7e9fb] bg-[#e1efff]'}`}>
                <span className={`text-[11px] font-bold uppercase tracking-wide ${isDark ? 'text-white/40' : 'text-slate-600'}`}>
                  Danh sách ghim ({currentConv.pinnedMessages.length})
                </span>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowPinsDropdown(false);
                  }}
                  className={`flex items-center space-x-1 text-[11px] font-bold transition-colors uppercase ${isDark ? 'text-white/40 hover:text-white' : 'text-[#0068ff] hover:text-blue-700'}`}
                >
                  <span>Thu gọn</span>
                  <ChevronUp size={14} />
                </button>
              </div>
              
              {/* List */}
              <div className={`max-h-64 overflow-y-auto no-scrollbar ${isDark ? 'bg-[#0b0e14]' : 'bg-white'}`}>
                {currentConv.pinnedMessages.slice().reverse().map((pin) => (
                  <div 
                    key={pin.messageId}
                    onClick={() => scrollToMessage(pin.messageId)}
                    className={`flex items-center justify-between px-4 sm:px-6 py-3 cursor-pointer border-b last:border-0 group transition-colors ${isDark ? 'hover:bg-white/5 border-white/5' : 'hover:bg-[#f0f7ff] border-slate-100'}`}
                  >
                    <div className="flex items-center space-x-3 overflow-hidden">
                      <div className={isDark ? 'text-blue-400' : 'text-[#0068ff]'}>
                        <MessageCircle size={18} />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className={`text-[10px] font-bold uppercase leading-none mb-0.5 ${isDark ? 'text-white/40' : 'text-slate-400'}`}>Tin nhắn</span>
                        <p className={`text-[13px] font-medium truncate leading-tight ${isDark ? 'text-white/90' : 'text-slate-800'}`}>
                          <span className="font-bold">{pin.senderName}:</span> {pin.content || "[Tệp đính kèm]"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button 
                        onClick={async (e) => {
                          e.stopPropagation();
                          await chatApi.unpinMessage(conversationId, pin.messageId);
                          fetchConversations();
                        }}
                        className={`p-1.5 opacity-0 group-hover:opacity-100 transition-all hover:text-red-500 ${isDark ? 'text-white/20' : 'text-slate-300'}`}
                        title="Gỡ ghim"
                      >
                        <X size={16} />
                      </button>
                      <button className={`p-1.5 transition-all ${isDark ? 'text-white/20 hover:text-white' : 'text-slate-300 hover:text-slate-600'}`}>
                        <MoreHorizontal size={18} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Footer */}
              <div className={`flex justify-center p-2 border-t shrink-0 ${isDark ? 'border-white/5 bg-white/5' : 'border-[#d7e9fb] bg-[#e1efff]'}`}>
                <button className={`text-[11px] font-bold transition-all flex items-center space-x-1 uppercase ${isDark ? 'text-white/40 hover:text-white' : 'text-[#0068ff] hover:text-blue-700'}`}>
                  <span>Xem tất cả ở bảng tin nhóm</span>
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Friend Bar for Strangers */}
      {currentConv?.type === 'SINGLE' && !currentConv?.isAI && (() => {
        const friendStatus = (() => {
          const friend = Array.isArray(friends) && friends.find(f => {
            const fId = String(f.userId || f.id || f.friendId || '').toLowerCase();
            const mId = String(currentMember?.userId || currentMember?.id || '').toLowerCase();
            return fId !== '' && fId === mId;
          });
          return friend?.status;
        })();

        if (friendStatus === 'ACCEPTED' || friendStatus === 'BLOCKED') return null;

        return (
          <div className={`relative z-10 ${isDark ? 'bg-[#1a1e26] border-white/5' : 'bg-slate-50 border-slate-200'} border-b px-4 sm:px-6 py-2.5 flex items-center justify-between transition-colors`}>
            <div className="flex items-center space-x-3 text-slate-500 dark:text-slate-400">
              <UserPlus size={18} className="flex-shrink-0" />
              <span className="text-[13px] font-medium">
                {friendStatus === 'PENDING' ? 'Đã gửi lời mời kết bạn' : 'Gửi yêu cầu kết bạn tới người này'}
              </span>
            </div>
            <div className="flex items-center space-x-2">
              {friendStatus !== 'PENDING' && (
                <button 
                  onClick={async () => {
                    try {
                      await friendApi.sendFriendRequest(currentMember.userId || currentMember.id);
                      fetchFriends();
                    } catch (err) {
                      console.error("Failed to send friend request", err);
                    }
                  }}
                  className="px-4 py-1.5 bg-[#0068ff] hover:bg-blue-700 text-white text-[12px] font-bold rounded-lg transition-all shadow-sm"
                >
                  Gửi kết bạn
                </button>
              )}
              <div className="relative" ref={strangerMenuRef}>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowStrangerMenu(!showStrangerMenu);
                  }}
                  className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"
                >
                  <MoreHorizontal size={18} />
                </button>

                {showStrangerMenu && (
                  <div className={`absolute top-full right-0 mt-2 w-48 border shadow-2xl rounded-xl py-2 z-[100] animate-in fade-in zoom-in-95 duration-200 ${isDark ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-200'}`}>
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        try {
                          await friendApi.blockUser(currentMember.userId || currentMember.id);
                          setShowStrangerMenu(false);
                          fetchFriends();
                          fetchConversations();
                        } catch (err) {
                          console.error("Failed to block user", err);
                        }
                      }}
                      className="w-full flex items-center px-4 py-2 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors text-left group"
                    >
                      <Ban size={16} className="text-red-500 mr-3" />
                      <span className="text-[13px] font-bold text-red-500">Chặn người này</span>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        alert("Tính năng báo xấu đang được phát triển!");
                        setShowStrangerMenu(false);
                      }}
                      className={`w-full flex items-center px-4 py-2 hover:bg-foreground/5 dark:hover:bg-white/5 transition-colors text-left group ${isDark ? 'text-white' : 'text-slate-700'}`}
                    >
                      <AlertCircle size={16} className="text-slate-400 mr-3" />
                      <span className="text-[13px] font-bold">Báo xấu</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Messages Area */}
      <div className="flex-1 flex flex-col min-h-0 relative">
        <MessageList
          conversations={conversations}
          conversationId={conversationId}
          messages={messages[conversationId] || []}
          loading={messagesLoading}
          onRefresh={localOnRefresh}
          onReply={(msg) => dispatch(setReplyingTo(msg))}
          onScrollToMessage={scrollToMessage}
          onForward={(msg) => {
            setForwardingMessage(msg);
            setIsForwardModalOpen(true);
          }}
        />
      </div>

      {/* Input Area */}
      <div className="p-4 sm:p-6 bg-sidebar border-t border-border transition-colors relative z-50">
        <MessageInput 
          conversationId={conversationId} 
          replyingTo={replyingTo}
          onCancelReply={() => dispatch(setReplyingTo(null))}
          onScrollToMessage={scrollToMessage}
        />
      </div>

      {/* Forward Modal */}
      <ForwardModal 
        isOpen={isForwardModalOpen}
        onClose={() => {
          setIsForwardModalOpen(false);
          setForwardingMessage(null);
        }}
        messageToForward={forwardingMessage}
      />
    </div>
  );
};

export default ChatWindow;
