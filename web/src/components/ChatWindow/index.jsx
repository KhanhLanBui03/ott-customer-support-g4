import React, { useEffect, useState, useRef } from 'react';
import { useSelector } from 'react-redux';
import { useChat } from '../../hooks/useChat';
import MessageList from '../MessageList';
import MessageInput from '../MessageInput';
import ForwardModal from '../ForwardModal';
import { chatApi } from '../../api/chatApi';
import { Phone, Video, PanelRight, MoreVertical, ShieldCheck, Pin, X, ChevronDown, ChevronUp, Trash2, UserPlus, ArrowLeft, Stars as SparklesIcon, Ban, AlertCircle } from 'lucide-react';
import { friendApi } from '../../api/friendApi';
import GroupAvatar from '../GroupAvatar';

const ChatWindow = ({ conversation, onStartCall, onToggleInfo, isInfoOpen, onBack, onRefreshMessages }) => {
  const conversationId = conversation?.conversationId;
  const { user } = useSelector(state => state.auth);
  const { messages, fetchMessages, fetchConversations, messagesLoading, conversations, friends, fetchFriends } = useChat();
  const [showPinsDropdown, setShowPinsDropdown] = useState(false);
  const [isTagMenuOpen, setIsTagMenuOpen] = useState(false);
  const tagMenuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (tagMenuRef.current && !tagMenuRef.current.contains(event.target)) {
        setIsTagMenuOpen(false);
      }
    };

    if (isTagMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isTagMenuOpen]);

  const TAGS = [
    { key: 'customer', label: 'Khách hàng', color: 'bg-red-500', textColor: 'text-red-500', borderColor: 'border-red-500/20', bgColor: 'bg-red-500/5' },
    { key: 'family', label: 'Gia đình', color: 'bg-emerald-500', textColor: 'text-emerald-500', borderColor: 'border-emerald-500/20', bgColor: 'bg-emerald-500/5' },
    { key: 'work', label: 'Công việc', color: 'bg-orange-500', textColor: 'text-orange-500', borderColor: 'border-orange-500/20', bgColor: 'bg-orange-500/5' },
    { key: 'friends', label: 'Bạn bè', color: 'bg-purple-500', textColor: 'text-purple-500', borderColor: 'border-purple-500/20', bgColor: 'bg-purple-500/5' },
    { key: 'later', label: 'Trả lời sau', color: 'bg-yellow-500', textColor: 'text-amber-500', borderColor: 'border-amber-500/20', bgColor: 'bg-amber-500/5' },
    { key: 'colleague', label: 'Đồng nghiệp', color: 'bg-blue-500', textColor: 'text-blue-500', borderColor: 'border-blue-500/20', bgColor: 'bg-blue-500/5' }
  ];

  const [replyingTo, setReplyingTo] = useState(null);
  const [forwardingMessage, setForwardingMessage] = useState(null);
  const [isForwardModalOpen, setIsForwardModalOpen] = useState(false);

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
      fetchMessages(conversationId);
      setShowPinsDropdown(false); // Reset dropdown when switching convs

      setReplyingTo(null);
    }
  }, [conversationId, fetchMessages]);

  return (
    <div className="flex-1 flex flex-col h-full bg-background transition-colors">
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
              onClick={onStartCall}
              className="p-2.5 hover:bg-white hover:text-cursor-dark text-slate-500 dark:text-slate-400 rounded-xl transition-all shadow-sm"
            >
              <Phone size={18} />
            </button>
            <button
              onClick={onStartCall}
              className="p-2.5 hover:bg-white hover:text-cursor-dark text-slate-500 dark:text-slate-400 rounded-xl transition-all shadow-sm"
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
        <div className="relative z-20">
          <div
            onClick={() => setShowPinsDropdown(!showPinsDropdown)}
            className="bg-indigo-500/5 dark:bg-indigo-500/10 backdrop-blur-md border-b border-indigo-500/10 px-8 py-3.5 flex items-center justify-between cursor-pointer hover:bg-indigo-500/10 transition-colors group/pin-bar"
          >
            <div className="flex items-center space-x-4 overflow-hidden flex-1 relative">
              <div className="p-2.5 bg-indigo-500 text-white rounded-xl shadow-lg shadow-indigo-500/20 group-hover/pin-bar:scale-110 transition-transform">
                <Pin size={14} fill="currentColor" />
              </div>
              <div className="flex-1 truncate">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-500 dark:text-indigo-400 leading-tight mb-0.5">
                  {currentConv.pinnedMessages.length} Tin nhắn đã ghim
                </p>
                <p className="text-[14px] font-bold text-slate-700 dark:text-slate-200 truncate">
                  {currentConv?.pinnedMessages?.[currentConv.pinnedMessages.length - 1]?.content || "Tệp đính kèm"}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-3 ml-4">
              <button
                type="button"
                onClick={async (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const lastPinId = currentConv?.pinnedMessages?.[currentConv.pinnedMessages.length - 1]?.messageId;
                  if (lastPinId) {
                    await chatApi.unpinMessage(conversationId, lastPinId);
                    fetchConversations();
                  }
                }}
                className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Dropdown Content */}
          {showPinsDropdown && (
            <div className="absolute top-full left-0 right-0 glass-premium shadow-2xl max-h-64 overflow-y-auto animate-msg border-t-0">
              {currentConv?.pinnedMessages?.slice(0).reverse().map((pin, i) => (
                <div
                  key={pin.messageId}
                  onClick={() => scrollToMessage(pin.messageId)}
                  className="px-8 py-4 border-b border-indigo-500/5 flex items-center justify-between hover:bg-indigo-500/5 cursor-pointer transition-colors group"
                >
                  <div className="flex-1 min-w-0 pr-4">
                    <p className="text-[9px] font-black uppercase text-indigo-500/60 mb-1 tracking-widest">
                      {currentConv?.members?.find(m => String(m.userId || m.id) === String(pin.senderId))?.fullName || pin.senderName || "Thành viên"}
                    </p>
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-300 truncate">
                      {pin.content || "Tệp đính kèm"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={async (e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      await chatApi.unpinMessage(conversationId, pin.messageId);
                      fetchConversations();
                    }}
                    className="p-1.5 opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition-all"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Messages Area */}
      <div className="flex-1 flex flex-col min-h-0 relative">
        <MessageList
          conversations={conversations}
          conversationId={conversationId}
          messages={messages[conversationId] || []}
          loading={messagesLoading}
          onRefresh={localOnRefresh}
          onReply={setReplyingTo}
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
          onCancelReply={() => setReplyingTo(null)}
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
