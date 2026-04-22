import React, { useRef, useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { PhoneOff, Shield, CheckCheck, Clock, MoreHorizontal, Reply, Trash2, Pin, Image as ImageIcon, FileText, Download, Forward, Users, Lock, Unlock, Info, BarChart2 } from 'lucide-react';
import chatApi from '../../api/chatApi';
import { recallMessage, removeMessage, pinMessageOptimistic, unpinMessageOptimistic, updateMessage, optimisticVote } from '../../store/chatSlice';
import VoteDetailsModal from '../VoteDetailsModal';

const cn = (...classes) => classes.filter(Boolean).join(" ");

// Zalo-style colors for group chat member names
const MEMBER_COLORS = [
  'text-indigo-500', 'text-emerald-500', 'text-orange-500', 'text-pink-500',
  'text-cyan-500', 'text-violet-500', 'text-amber-600', 'text-rose-500',
  'text-teal-500', 'text-blue-500', 'text-red-500', 'text-lime-600'
];

const getMemberColor = (senderId, members) => {
  if (!members || !senderId) return 'text-foreground/40';
  const idx = members.findIndex(m => m.userId === senderId);
  if (idx === -1) return 'text-foreground/40';
  return MEMBER_COLORS[idx % MEMBER_COLORS.length];
};

const MessageList = ({ messages, loading, conversationId, onRefresh, conversations, onReply, onForward }) => {
  const formatMessageTime = (timestamp) => {
    if (!timestamp) return '';
    return new Date(timestamp).toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatMessageDate = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);

    if (date.toDateString() === now.toDateString()) return 'Hôm nay';
    if (date.toDateString() === yesterday.toDateString()) return 'Hôm qua';

    return date.toLocaleDateString('vi-VN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  const scrollRef = useRef();
  const bottomRef = useRef();
  const menuRef = useRef();
  const dispatch = useDispatch();
  const { user } = useSelector(state => state.auth);
  const [activeMenu, setActiveMenu] = useState(null);
  const [hoveredMessageId, setHoveredMessageId] = useState(null);
  const [optimisticReactions, setOptimisticReactions] = useState({}); // { messageId: [reactions] }
  const [wallpaper, setWallpaper] = useState(localStorage.getItem(`chat_wallpaper_${conversationId}`));
  const [isVoteDetailsOpen, setIsVoteDetailsOpen] = useState(false);
  const [selectedVote, setSelectedVote] = useState(null);

  useEffect(() => {
    // Sync wallpaper when switching conversations
    setWallpaper(localStorage.getItem(`chat_wallpaper_${conversationId}`));
  }, [conversationId]);

  useEffect(() => {
    const handleUpdate = (e) => {
      // Only update if the event matches current conversation
      if (e.detail?.conversationId === conversationId) {
        setWallpaper(e.detail.wallpaper);
      }
    };
    window.addEventListener('chat-wallpaper-updated', handleUpdate);
    return () => window.removeEventListener('chat-wallpaper-updated', handleUpdate);
  }, [conversationId]);

  const EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '😡'];

  const scrollToBottom = (instant = false) => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: instant ? 'instant' : 'smooth'
      });
    }
  };

  useEffect(() => {
    // Instant scroll on new messages
    scrollToBottom(true);

    // Delayed smooth scroll to account for image/layout adjustments
    const timer = setTimeout(() => scrollToBottom(), 100);
    const longTimer = setTimeout(() => scrollToBottom(), 500);

    return () => {
      clearTimeout(timer);
      clearTimeout(longTimer);
    };
  }, [messages]);

  // Close menu on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (activeMenu && menuRef.current && !menuRef.current.contains(event.target)) {
        setActiveMenu(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [activeMenu]);

  const handleAction = async (action, messageId) => {
    try {
      if (action === 'RECALL') {
        console.log('[ACTION] Recalling message:', messageId);
        try {
          await chatApi.recallMessage(conversationId, messageId);
          dispatch(recallMessage({ conversationId, messageId }));
          console.log('[ACTION] Recall successful');
        } catch (err) {
          console.error('[ACTION] Recall failed:', err);
          alert('Không thể thu hồi tin nhắn: ' + (err.response?.data?.message || err.message));
        }
      } else if (action === 'DELETE_ME') {
        console.log('[ACTION] Deleting message for me:', messageId);
        try {
          await chatApi.deleteMessage(conversationId, messageId);
          dispatch(removeMessage({ conversationId, messageId }));
        } catch (err) {
          console.error('[ACTION] Delete failed:', err);
        }
      } else if (action === 'PIN') {
        dispatch(pinMessageOptimistic({ conversationId, messageId }));
        setActiveMenu(null);
        try {
          await chatApi.pinMessage(conversationId, messageId);
        } catch (err) {
          dispatch(unpinMessageOptimistic({ conversationId, messageId }));
          console.error('[ACTION] Pin failed:', err);
        }
      } else if (action === 'UNPIN') {
        dispatch(unpinMessageOptimistic({ conversationId, messageId }));
        setActiveMenu(null);
        try {
          await chatApi.unpinMessage(conversationId, messageId);
        } catch (err) {
          dispatch(pinMessageOptimistic({ conversationId, messageId }));
          console.error('[ACTION] Unpin failed:', err);
        }
      } else if (action === 'REACTION') {
        const { id, emoji } = messageId;
        const userId = user?.userId || user?.id;
        
        // Optimistic Update: Toggle or replace
        setOptimisticReactions(prev => {
          const currentReactions = prev[id] || [];
          const existing = currentReactions.find(r => r.userId === userId && r.emoji === emoji);
          const filtered = currentReactions.filter(r => r.userId !== userId);
          
          if (existing) {
            // Un-react case: if clicking same emoji, remove it
            return {
              ...prev,
              [id]: filtered
            };
          }
          
          // Replace/Add case
          return {
            ...prev,
            [id]: [...filtered, { emoji, userId }]
          };
        });

        try {
          await chatApi.addReaction(conversationId, id, emoji);
          if (onRefresh) onRefresh();
        } catch (err) {
          // Rollback on error
          setOptimisticReactions(prev => {
            const newReactions = { ...prev };
            delete newReactions[id];
            return newReactions;
          });
          throw err;
        }
      } else if (action === 'REPLY') {
        onReply(messageId);
      }
      setActiveMenu(null);
    } catch (err) {
      console.error("Action failed", err);
    }
  };

  const handleVote = async (messageId, optionId, allowMultiple, currentSelection) => {
    try {
      let newOptionIds = [];
      if (allowMultiple) {
        if (currentSelection.includes(optionId)) {
          newOptionIds = currentSelection.filter(id => id !== optionId);
        } else {
          newOptionIds = [...currentSelection, optionId];
        }
      } else {
        newOptionIds = [optionId];
      }

      // Optimistic Update
      dispatch(optimisticVote({ 
        conversationId, 
        messageId, 
        optionIds: newOptionIds, 
        userId: user?.userId || user?.id 
      }));

      await chatApi.submitVote(conversationId, messageId, { optionIds: newOptionIds });
    } catch (err) {
      console.error('Failed to submit vote:', err);
    }
  };

  const handleCloseVote = async (messageId) => {
    try {
      await chatApi.closeVote(conversationId, messageId);
      // Cập nhật sẽ được xử lý qua WebSocket event
    } catch (err) {
      console.error('Failed to close vote:', err);
      alert('Không thể khóa cuộc bình chọn. Vui lòng thử lại sau.');
    }
  };

  const renderReactions = (messageId, serverReactions, isMe) => {
    const currentUserId = user?.userId || user?.id;
    const localReactions = optimisticReactions[messageId] || [];
    
    // Create a Map to store unique reaction per userId
    const uniqueReactionsMap = new Map();
    
    // Add server reactions first
    if (Array.isArray(serverReactions)) {
      serverReactions.forEach(r => {
        if (r.userId) uniqueReactionsMap.set(r.userId, r.emoji);
      });
    }
    
    // Overwrite with local reactions (this user's latest action)
    localReactions.forEach(r => {
      if (r.userId) uniqueReactionsMap.set(r.userId, r.emoji);
    });

    const finalReactions = Array.from(uniqueReactionsMap.values());
    
    if (finalReactions.length === 0) return null;
    
    const groups = finalReactions.reduce((acc, emoji) => {
      acc[emoji] = (acc[emoji] || 0) + 1;
      return acc;
    }, {});

    return (
      <div className={`absolute bottom-[-14px] ${isMe ? 'right-4' : 'left-4'} flex items-center space-y-1 z-20`}>
        <div className="flex items-center space-x-1">
          {Object.entries(groups).map(([emoji, count]) => (
            <div key={emoji} className="flex items-center space-x-1 px-2 py-0.5 bg-sidebar/90 backdrop-blur-md border border-border shadow-sm rounded-full animate-fade-in hover:scale-110 transition-transform cursor-default">
              <span className="text-[12px]">{emoji}</span>
              {count > 1 && <span className="text-[10px] font-black text-foreground/60">{count}</span>}
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (!Array.isArray(messages)) {
    return (
      <div className="flex-1 flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
      </div>
    );
  }

  const { typingUsers } = useSelector(state => state.chat);
  const currentConv = conversations?.find(c => c.conversationId === conversationId);
  const pinnedMessages = currentConv?.pinnedMessages || [];
  const pinnedIds = pinnedMessages.map(p => p.messageId);
  const meId = user?.userId || user?.id;

  // Auto-scroll when typing users change
  useEffect(() => {
    const activeTyping = typingUsers[conversationId]?.filter(u => u.userId !== meId);
    if (activeTyping?.length > 0) {
      scrollToBottom();
    }
  }, [typingUsers, conversationId, meId]);

  if (loading && messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col p-8 space-y-6">
        {[1, 2, 3].map(i => (
          <div key={i} className={`flex flex-col ${i % 2 === 0 ? 'items-end' : 'items-start'} space-y-2 animate-pulse`}>
            <div className={`h-12 w-48 rounded-2xl bg-slate-100 ${i % 2 === 0 ? 'rounded-br-none' : 'rounded-bl-none'}`} />
            <div className="h-2 w-12 bg-slate-50 rounded-full" />
          </div>
        ))}
      </div>
    );
  }


  return (
    <div className="flex-1 h-full relative overflow-hidden">
      {/* Fixed Blurred Wallpaper Layer */}
      {wallpaper && (
        <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden select-none">
          <img 
            src={wallpaper} 
            alt="" 
            className="w-full h-full object-cover filter blur-[8px] opacity-70 dark:opacity-50" 
          />
          <div className="absolute inset-0 bg-background/10 dark:bg-black/5" />
        </div>
      )}

      <div 
        ref={scrollRef}
        className={cn(
          "absolute inset-0 overflow-y-auto p-4 sm:p-8 space-y-6 pb-32 transition-colors no-scrollbar z-10",
          !wallpaper ? "bg-background" : "bg-transparent"
        )}
      >
        <div className="relative">
      {messages.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-12 border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-[40px] opacity-60">
          <Shield size={32} className="text-slate-200 dark:text-slate-700 mb-4" />
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 dark:text-slate-500 text-center leading-loose">
            Chưa có tin nhắn nào<br />Hãy bắt đầu trò chuyện!
          </p>
        </div>
      ) : (
        messages.map((msg, index) => {
          const timestamp = msg.createdAt;
          if (!timestamp) return null;

          let dateHeader = null;
          const msgDate = formatMessageDate(timestamp);
          const prevMsg = index > 0 ? messages[index - 1] : null;
          const prevDate = prevMsg ? formatMessageDate(prevMsg.createdAt) : null;
          const showDateHeader = index === 0 || (prevDate && prevDate !== msgDate);

          const isMe = msg.senderId === (user?.userId || user?.id);
          const isCall = msg.type === 'CALL_LOG' || msg.content?.includes('Call');
          const isSystem = msg.type === 'SYSTEM';
          const isRecalled = msg.isRecalled;
          const isPinned = pinnedIds.includes(msg.messageId);

          if (showDateHeader) {
            dateHeader = (
              <div key={`header-${timestamp}`} className="flex justify-center my-10 first:mt-0">
                <div className="px-5 py-1.5 bg-slate-100 dark:bg-surface-300/40 backdrop-blur-md rounded-full border border-slate-200 dark:border-border/80 shadow-sm transition-all group hover:scale-105 active:scale-95">
                  <span className="text-[10px] font-black text-slate-500 dark:text-foreground/70 uppercase tracking-[0.2em]">{msgDate}</span>
                </div>
              </div>
            );
          }

          if (isSystem) {
            return (
              <React.Fragment key={msg.messageId || index}>
                {dateHeader}
                <div className="flex justify-center my-6 group relative">
                   <div className="px-5 py-2 bg-indigo-50 dark:bg-indigo-500/10 rounded-full border border-indigo-100 dark:border-indigo-500/10 flex items-center space-x-2 shadow-sm">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500/50"></span>
                      <span className="text-[11px] font-black text-indigo-700/80 dark:text-indigo-200/60 uppercase tracking-widest">{msg.content}</span>
                   </div>
                </div>
              </React.Fragment>
            );
          }

          return (
            <React.Fragment key={msg.messageId || index}>
              {dateHeader}
              <div
                id={`msg-${msg.messageId}`}
                className={`flex flex-col ${msg.type === 'VOTE' ? 'items-center w-full' : (isMe ? 'items-end' : 'items-start')} group animate-msg relative mb-6 last:mb-0`}
              >
                <div className={`flex items-end ${msg.type === 'VOTE' ? 'w-full justify-center max-w-full' : 'max-w-[85%] sm:max-w-[75%] space-x-3 ' + (isMe ? 'flex-row-reverse space-x-reverse' : '')}`}>
                  {!isMe && msg.type !== 'VOTE' && (
                    <div className="w-9 h-9 rounded-2xl bg-surface-200 flex-shrink-0 mb-1 overflow-hidden border-2 border-background shadow-md group-hover:scale-110 transition-transform">
                      {(msg.senderAvatarUrl || msg.senderAvatar || currentConv?.members?.find(m => m.userId === msg.senderId)?.avatarUrl) ? (
                        <img 
                          src={msg.senderAvatarUrl || msg.senderAvatar || currentConv?.members?.find(m => m.userId === msg.senderId)?.avatarUrl} 
                          className="w-full h-full object-cover" 
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-foreground/40 font-black italic uppercase text-sm">
                          {msg.senderName?.charAt(0) || '?'}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="space-y-1.5 relative group/bubble">
                    {/* Forwarded Label */}
                    {msg.forwardedFrom && (
                      <div className={`flex items-center space-x-1 mb-1 opacity-60 ${isMe ? 'justify-end pr-1' : 'justify-start pl-1'}`}>
                        <Forward size={12} className="text-indigo-500" />
                        <span className="text-[10px] font-bold italic text-foreground/60">Được chuyển tiếp</span>
                      </div>
                    )}

                    {/* Reply To Preview */}
                    {msg.replyTo && (
                      <div 
                        onClick={() => scrollToMessage(msg.replyTo.messageId)}
                        className={`mb-1 p-2.5 rounded-2xl bg-surface-100/50 backdrop-blur-sm border-l-4 border-indigo-500 cursor-pointer hover:bg-surface-100 transition-all max-w-sm ${isMe ? 'mr-1' : 'ml-1'}`}
                      >
                         <p className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.1em] mb-0.5">{msg.replyTo.senderName}</p>
                         <p className="text-[12px] text-foreground/60 truncate italic">{msg.replyTo.content || '[Attachment]'}</p>
                      </div>
                    )}

                    {!isMe && msg.type !== 'VOTE' && (
                       <p className={`text-[10px] font-black uppercase tracking-widest ml-1 mb-1 ${currentConv?.type === 'GROUP' ? getMemberColor(msg.senderId, currentConv?.members) : 'text-foreground/40'}`}>
                          {msg.senderName || 'Thành viên'}
                       </p>
                    )}

                    {msg.type === 'VOTE' && (
                       <p className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-400/80 mb-2 text-center w-full">
                          {msg.senderName || 'Thành viên'} đã tạo một bình chọn
                       </p>
                    )}
                    {isRecalled ? (
                      <div className="px-6 py-3.5 bg-surface-200/80 text-foreground/40 rounded-[22px] border border-border flex items-center space-x-3 italic">
                        <Trash2 size={14} className="opacity-50" />
                        <span className="text-[13px] font-medium">Tin nhắn đã bị thu hồi</span>
                      </div>
                    ) : isCall ? (
                      <div className="px-6 py-4 bg-background rounded-[24px] shadow-xl shadow-indigo-500/5 dark:shadow-black/20 flex items-center space-x-4 border border-border group-hover:scale-[1.02] transition-transform">
                        <div className="p-3 bg-red-50 dark:bg-red-500/10 text-red-500 rounded-full">
                          <PhoneOff size={20} />
                        </div>
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-red-500/60 mb-0.5">VoIP Event</p>
                          <p className="text-sm font-black tracking-tight text-foreground">{msg.content}</p>
                        </div>
                      </div>
                    ) : (msg.type === 'VOTE' && msg.vote) ? (
                      (() => {
                      const totalVoters = msg.vote.options.reduce((sum, o) => sum + (o.voterIds?.length || 0), 0);
                      const isClosed = msg.vote.isClosed || (msg.vote.deadline && msg.vote.deadline < Date.now());
                      const isCreator = msg.senderId === meId;
                      
                      return (
                        <div className={`w-full max-w-[340px] bg-white dark:bg-slate-900 rounded-[28px] border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500`}>
                          <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-br from-indigo-500/5 to-transparent">
                            <div className="flex items-start justify-between mb-4">
                               <div className="space-y-1">
                                 <p className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-500">Cuộc bình chọn</p>
                                 <h4 className="text-[16px] font-black text-slate-900 dark:text-white leading-tight">{msg.vote.question}</h4>
                               </div>
                               <div className={cn(
                                 "p-2.5 rounded-xl transition-all shadow-sm",
                                 isClosed ? "bg-red-500/10 text-red-500 shadow-red-500/10" : "bg-indigo-500/10 text-indigo-500 shadow-indigo-500/10"
                               )}>
                                 {isClosed ? <Lock size={18} /> : <BarChart2 size={18} />}
                               </div>
                            </div>
                            
                            {msg.vote.allowMultiple && !isClosed && (
                              <p className="text-[9px] font-black text-indigo-500/80 uppercase tracking-widest bg-indigo-500/5 border border-indigo-500/10 w-fit px-2.5 py-1 rounded-lg">Chọn nhiều phương án</p>
                            )}
                            
                            {isClosed && (
                              <p className="text-[9px] font-black text-red-500 uppercase tracking-widest bg-red-500/5 border border-red-500/10 w-fit px-2.5 py-1 rounded-lg flex items-center space-x-1">
                                <Lock size={10} />
                                <span>Bình chọn đã kết thúc</span>
                              </p>
                            )}
                          </div>
                          
                          <div className="p-5 space-y-3 bg-slate-50/30 dark:bg-slate-900/30">
                            {msg.vote.options.map((opt) => {
                              const voterIds = opt.voterIds || [];
                              const percent = totalVoters > 0 ? (voterIds.length / totalVoters) * 100 : 0;
                              const isSelected = voterIds.includes(meId);
                              const mySelections = msg.vote.options.filter(o => o.voterIds?.includes(meId)).map(o => o.optionId);

                              return (
                                <div key={opt.optionId} className="space-y-2 group/opt">
                                  <button
                                    disabled={isClosed}
                                    onClick={() => handleVote(msg.messageId, opt.optionId, msg.vote.allowMultiple, mySelections)}
                                    className={cn(
                                      "w-full text-left p-4 rounded-[20px] transition-all relative overflow-hidden border-2",
                                      isSelected 
                                        ? 'bg-indigo-500/10 border-indigo-500 shadow-lg shadow-indigo-500/5 ring-1 ring-indigo-500/20' 
                                        : 'bg-white dark:bg-slate-800 border-transparent hover:border-slate-200 dark:hover:border-slate-700 shadow-sm',
                                      isClosed && "opacity-80 scale-[0.99] grayscale-[0.3]"
                                    )}
                                  >
                                    <div 
                                      className="absolute left-0 top-0 bottom-0 bg-indigo-500/5 transition-all duration-1000 ease-out" 
                                      style={{ width: `${percent}%` }}
                                    />
                                    
                                    <div className="relative flex items-center justify-between z-10">
                                      <div className="flex items-center space-x-3">
                                        <div className={cn(
                                          "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-300",
                                          isSelected ? "bg-indigo-500 border-indigo-500" : "border-slate-200 dark:border-slate-700"
                                        )}>
                                          {isSelected && <CheckCheck size={10} className="text-white" />}
                                        </div>
                                        <span className={cn(
                                          "text-[14px] font-bold",
                                          isSelected ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-700 dark:text-slate-300'
                                        )}>
                                          {opt.text}
                                        </span>
                                      </div>
                                      <div className="flex flex-col items-end">
                                        <span className="text-[12px] font-black text-slate-400">{voterIds.length}</span>
                                      </div>
                                    </div>
                                  </button>
                                  
                                  {voterIds.length > 0 && (
                                    <div className="flex items-center space-x-2 px-2">
                                      <div className="flex -space-x-2 overflow-hidden items-center translate-y-[-2px]">
                                        {voterIds.slice(0, 5).map((vId, idx) => {
                                          const voter = currentConv?.members?.find(m => m.userId === vId);
                                          return (
                                            <div key={vId} className="w-6 h-6 rounded-lg border-2 border-white dark:border-slate-900 bg-slate-100 dark:bg-slate-800 overflow-hidden shadow-sm">
                                              {voter?.avatarUrl ? (
                                                <img src={voter.avatarUrl} className="w-full h-full object-cover" />
                                              ) : (
                                                <div className="w-full h-full flex items-center justify-center text-[8px] font-black uppercase tracking-tighter text-slate-400">
                                                  {(voter?.fullName || '?').charAt(0)}
                                                </div>
                                              )}
                                            </div>
                                          );
                                        })}
                                        {voterIds.length > 5 && (
                                          <div className="w-6 h-6 rounded-lg border-2 border-white dark:border-slate-900 bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                                            <span className="text-[8px] font-black text-slate-400">+{voterIds.length - 5}</span>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                          
                          <div className="p-4 px-6 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800">
                             <div className="flex items-center justify-between mb-4">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                  {totalVoters} người đã bầu
                                </span>
                                <button 
                                  onClick={() => {
                                    setSelectedVote(msg.vote);
                                    setIsVoteDetailsOpen(true);
                                  }}
                                  className="text-[10px] font-black text-indigo-500 hover:text-indigo-600 transition-colors uppercase tracking-widest flex items-center space-x-1.5 p-1.5 rounded-lg hover:bg-indigo-500/5 group"
                                >
                                  <span>Xem chi tiết</span>
                                  <Info size={12} className="group-hover:rotate-12 transition-transform" />
                                </button>
                             </div>

                             {/* Creator Actions */}
                             {(isCreator || (msg.vote.deadline && !isClosed)) && (
                               <div className="flex items-center justify-between pt-4 border-t border-dashed border-slate-100 dark:border-slate-800">
                                  {msg.vote.deadline && !isClosed ? (
                                    <div className="flex items-center space-x-2 text-[10px] font-bold text-slate-400 italic">
                                      <Clock size={12} />
                                      <span>Hết hạn: {new Date(msg.vote.deadline).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} {new Date(msg.vote.deadline).toLocaleDateString('vi-VN')}</span>
                                    </div>
                                  ) : <div />}

                                  {!isClosed && isCreator && (
                                    <button 
                                      onClick={() => handleCloseVote(msg.messageId)}
                                      className="text-[10px] font-black text-slate-400 hover:text-red-500 transition-colors uppercase tracking-widest bg-slate-50 dark:bg-slate-800 px-3 py-2 rounded-xl hover:bg-red-500/10 flex items-center space-x-2"
                                    >
                                      <Lock size={12} />
                                      <span>Chốt kết quả</span>
                                    </button>
                                  )}

                                  {isClosed && (
                                    <div className="w-full flex justify-center">
                                       <span className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] opacity-40 italic">ĐÃ KẾT THÚC</span>
                                    </div>
                                  )}
                               </div>
                             )}
                          </div>
                        </div>
                      );
                    })()
                    ) : (
                      <div className="relative">
                        {/* Reaction Picker on Hover */}
                        <div className={`
                          absolute -top-12 ${isMe ? 'right-0' : 'left-0'} 
                          hidden group-hover/bubble:flex items-center space-x-1 p-1 bg-[#1e2330]/95 backdrop-blur-xl border border-white/10 shadow-2xl rounded-full z-[100] animate-in fade-in zoom-in slide-in-from-bottom-2 duration-200
                        `}>
                          {EMOJIS.map(emoji => (
                            <button
                              key={emoji}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleAction('REACTION', { id: msg.messageId, emoji });
                              }}
                              className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/10 hover:scale-125 transition-all text-[20px]"
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>

                        {/* Quick Action Bar (Zalo Style) */}
                        <div className={cn(
                          "absolute top-0 flex items-center space-x-1 opacity-0 group-hover/bubble:opacity-100 transition-all z-10",
                          isMe ? "-left-28" : "-right-28"
                        )}>
                           <button 
                             onClick={() => onReply(msg)}
                             className="p-1 px-1.5 hover:bg-surface-200 rounded-full text-foreground/40 hover:text-indigo-500 transition-all flex flex-col items-center"
                             title="Trả lời"
                           >
                             <Reply size={18} />
                           </button>
                           <button 
                             onClick={() => onForward(msg)}
                             className="p-1 px-1.5 hover:bg-surface-200 rounded-full text-foreground/40 hover:text-blue-500 transition-all flex flex-col items-center"
                             title="Chuyển tiếp"
                           >
                             <Forward size={18} className="text-blue-500" />
                           </button>
                           <button 
                             onClick={(e) => {
                               e.stopPropagation();
                               setActiveMenu(activeMenu === msg.messageId ? null : msg.messageId);
                             }}
                             className="p-1 px-1.5 hover:bg-surface-200 rounded-full text-foreground/40 hover:text-foreground transition-all flex flex-col items-center"
                             title="Thêm"
                           >
                             <MoreHorizontal size={18} />
                           </button>
                        </div>

                        {activeMenu === msg.messageId && (
                          <div 
                            ref={menuRef}
                            className={`absolute bottom-full mb-3 ${isMe ? 'right-0' : 'left-0'} w-52 bg-sidebar border border-border shadow-2xl rounded-[24px] p-2 z-[100] animate-msg`}
                          >
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleAction('REPLY', msg); }}
                              className="w-full flex items-center space-x-3 px-4 py-3 text-[13px] font-bold text-foreground hover:bg-surface-100 rounded-2xl transition-all"
                            >
                              <Reply size={18} className="text-indigo-400" /> <span>Trả lời</span>
                            </button>
                            <button
                              type="button"
                              onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleAction(isPinned ? 'UNPIN' : 'PIN', msg.messageId); }}
                              className="w-full flex items-center space-x-3 px-4 py-3 text-[13px] font-bold text-foreground hover:bg-surface-100 rounded-2xl transition-all"
                            >
                              <Pin size={18} className={isPinned ? 'text-indigo-500' : 'text-foreground/40'} fill={isPinned ? 'currentColor' : 'none'} /> 
                              <span>{isPinned ? 'Gỡ ghim' : 'Ghim tin nhắn'}</span>
                            </button>
                            <div className="h-px bg-border my-1.5 mx-2" />
                            
                            {/* Xóa phía tôi - Luôn hiển thị cho mọi người */}
                            <button
                              onClick={() => handleAction('DELETE_ME', msg.messageId)}
                              className="w-full flex items-center space-x-3 px-4 py-3 text-[13px] font-bold text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-500/10 rounded-2xl transition-all"
                            >
                              <Trash2 size={18} /> <span>Xóa phía tôi</span>
                            </button>

                            {/* Thu hồi - Chỉ hiển thị cho người gửi */}
                            {isMe && (
                              <button
                                onClick={() => handleAction('RECALL', msg.messageId)}
                                className="w-full flex items-center space-x-3 px-4 py-3 text-[13px] font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-2xl transition-all"
                              >
                                <Trash2 size={18} className="rotate-0" /> <span>Thu hồi</span>
                              </button>
                            )}
                          </div>
                        )}

                        <div className={`
                          relative overflow-hidden transition-all duration-300
                          ${msg.type === 'STICKER' ? 'bg-transparent shadow-none ring-0' : (msg.content ? 'px-6 py-4 shadow-sm' : 'p-0')} 
                          ${isMe
                            ? (msg.content && msg.type !== 'STICKER' ? 'bg-indigo-600 text-white rounded-[26px] rounded-br-[4px]' : '')
                            : (msg.content && msg.type !== 'STICKER' ? 'bg-surface-200 text-foreground border border-border rounded-[26px] rounded-bl-[4px]' : '')
                          }
                          ${isPinned && msg.type !== 'STICKER' ? 'ring-2 ring-indigo-500/30' : ''}
                        `}>
                          {msg.type === 'STICKER' ? (
                            <div className="relative group/sticker">
                              <img 
                                src={msg.content} 
                                alt="sticker" 
                                className="max-w-[160px] sm:max-w-[220px] h-auto transition-transform duration-500 group-hover/sticker:scale-110 pointer-events-auto"
                              />
                            </div>
                          ) : (
                            <>
                              {msg.content && <p className="text-[15px] leading-relaxed font-semibold">{msg.content}</p>}
                              
                              {msg.mediaUrls && msg.mediaUrls.length > 0 && (
                                <div className={`grid gap-2.5 ${msg.content ? 'mt-3' : ''} ${msg.mediaUrls.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                                  {msg.mediaUrls.map((url, idx) => {
                                    const isImage = url.match(/\.(jpeg|jpg|gif|png|webp|svg)/i);
                                    const isVideo = url.match(/\.(mp4|webm|ogg)/i);
                                    
                                    if (isImage) {
                                      return (
                                        <div key={idx} className="rounded-2xl overflow-hidden border-2 border-white/10 dark:border-white/5 shadow-2xl">
                                          <img src={url} alt="" className="max-w-full h-auto cursor-pointer hover:scale-[1.03] transition-transform duration-500" onClick={() => window.open(url, '_blank')} />
                                        </div>
                                      );
                                    } else if (isVideo) {
                                      return (
                                        <div key={idx} className="rounded-2xl overflow-hidden border-2 border-white/10 dark:border-white/5 bg-black">
                                          <video controls className="w-full h-auto max-h-[400px]">
                                            <source src={url} />
                                          </video>
                                        </div>
                                      );
                                    } else {
                                      return (
                                        <a key={idx} href={url} target="_blank" rel="noopener noreferrer" className={`flex items-center space-x-4 p-4 rounded-2xl border transition-all ${isMe ? 'bg-white/10 border-white/20 hover:bg-white/20' : 'bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                                           <div className={`p-2.5 rounded-xl ${isMe ? 'bg-white text-indigo-600' : 'bg-indigo-50 dark:bg-indigo-500/20 text-indigo-500'}`}>
                                              <FileText size={20} />
                                           </div>
                                           <div className="flex-1 min-w-0">
                                              <p className="text-[13px] font-black truncate">{url.split('/').pop()}</p>
                                              <p className="text-[9px] font-black uppercase tracking-widest opacity-60">Attachment Download</p>
                                           </div>
                                           <Download size={18} className="opacity-40" />
                                        </a>
                                      );
                                    }
                                  })}
                                </div>
                              )}
                            </>
                          )}
                        </div>
                        {/* Render Reactions Badge */}
                        {msg.type !== 'VOTE' && renderReactions(msg.messageId, msg.reactions, isMe)}
                      </div>
                    )}
                  </div>
                </div>

                <div className={`flex items-center space-x-3 mt-2 ${msg.type === 'VOTE' ? 'justify-center' : (isMe ? 'flex-row-reverse space-x-reverse mr-4' : 'ml-14')}`}>
                  <span className="text-[9px] font-black text-slate-400 dark:text-slate-400 uppercase tracking-widest">
                    {formatMessageTime(msg.createdAt)}
                  </span>
                  {isMe && (
                    <div className="flex items-center">
                      <CheckCheck size={14} className="text-indigo-400 dark:text-indigo-500 opacity-60" />
                    </div>
                  )}
                  {isPinned && <Pin size={10} className="text-indigo-400 animate-pulse" fill="currentColor" />}
                </div>
              </div>
            </React.Fragment>
          );
        })
      )}
      {typingUsers[conversationId]?.filter(u => u.userId !== meId).length > 0 && (
        <div className="flex items-end space-x-3 mb-6 ml-14 animate-msg">
          <div className="bg-surface-200 text-foreground border border-border px-5 py-3.5 rounded-[22px] rounded-bl-[4px] shadow-sm flex items-center space-x-3">
            <div className="flex space-x-1">
              <div className="typing-dot"></div>
              <div className="typing-dot"></div>
              <div className="typing-dot"></div>
            </div>
            <span className="text-[12px] font-bold text-foreground/50">
              {(() => {
                const others = typingUsers[conversationId].filter(u => u.userId !== meId);
                if (others.length === 0) return null;
                if (others.length === 1) {
                  const memberName = conversations?.find(c => c.conversationId === conversationId)?.members?.find(m => m.userId === others[0].userId)?.fullName;
                  return (memberName || 'Ai đó') + ' đang soạn tin...';
                }
                return `${others.length} người đang soạn tin...`;
              })()}
            </span>
          </div>
        </div>
      )}
      <div ref={bottomRef} className="h-px w-full clear-both" />
      </div>
      </div>

      {activeMenu && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setActiveMenu(null)}
        />
      )}

      {/* Vote Details Modal */}
      <VoteDetailsModal 
        isOpen={isVoteDetailsOpen}
        onClose={() => setIsVoteDetailsOpen(false)}
        vote={selectedVote}
        members={currentConv?.members}
      />
    </div>
  );
};

export default MessageList;
