import React, { useRef, useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { PhoneOff, Shield, CheckCheck, Clock, MoreHorizontal, Reply, Trash2, Pin, Image as ImageIcon, FileText, Download, Forward, Users, Lock, Unlock, Info, BarChart2, X, Loader2, Plus } from 'lucide-react';
import chatApi from '../../api/chatApi';
import { useWebSocket } from '../../hooks/useWebSocket';
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

const getDocViewerUrl = (u, e) => {
  if (e === 'pdf') return u; // Direct PDF
  if (['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(e)) {
    return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(u)}`;
  }
  return `https://docs.google.com/viewer?url=${encodeURIComponent(u)}&embedded=true`;
};

const MessageList = ({ messages, loading, conversationId, onRefresh, conversations, onReply, onForward }) => {
  const formatMessageTime = (timestamp) => {
    if (!timestamp) return '';
    return new Date(timestamp).toLocaleTimeString('en-US', {
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

    return date.toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  const scrollRef = useRef();
  const bottomRef = useRef();
  const menuRef = useRef();
  const menuNodeRef = useRef(null);
  const dispatch = useDispatch();
  const { user } = useSelector(state => state.auth);
  const { typingUsers } = useSelector(state => state.chat) || {};
  const currentConv = conversations?.find(c => c.conversationId === conversationId);
  const meId = user?.userId || user?.id;

  const [activeMenu, setActiveMenu] = useState(null);
  const [hoveredMessageId, setHoveredMessageId] = useState(null);
  const [optimisticReactions, setOptimisticReactions] = useState({}); // { messageId: [reactions] }
  const [wallpaper, setWallpaper] = useState(localStorage.getItem(`chat_wallpaper_${conversationId}`));
  const [isVoteDetailsOpen, setIsVoteDetailsOpen] = useState(false);
  const [selectedVote, setSelectedVote] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isFileModalLoading, setIsFileModalLoading] = useState(true);
  const [reactionDetail, setReactionDetail] = useState(null);

  const EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '😡'];

  const getReactionUserName = (userId) => {
    if (!userId) return 'Người dùng';
    const currentUserId = user?.userId || user?.id;
    if (String(userId) === String(currentUserId)) return 'Bạn';

    const members = currentConv?.members || currentConv?.participants || [];
    const found = members.find(member => String(member.userId || member.id || '') === String(userId));
    return found?.fullName || found?.name || found?.username || 'Người dùng';
  };

  const openReactionDetail = (messageId, emoji) => {
    setReactionDetail({ messageId, emoji });
  };

  const closeReactionDetail = () => setReactionDetail(null);

  const getReactionUsers = (message, emoji) => {
    const serverUserIds = Array.isArray(message?.reactions?.[emoji]) ? message.reactions[emoji].map(id => String(id)) : [];
    const localUserIds = (optimisticReactions[message.messageId] || [])
      .filter(r => r.emoji === emoji)
      .map(r => String(r.userId));

    return Array.from(new Set([...serverUserIds, ...localUserIds]));
  };

  const getReactionGroups = (message) => {
    const emojiUsers = {};

    const addReaction = (emoji, userId) => {
      if (!emoji || userId === undefined || userId === null) return;
      const normalizedId = String(userId);
      if (!emojiUsers[emoji]) emojiUsers[emoji] = new Set();
      emojiUsers[emoji].add(normalizedId);
    };

    if (message?.reactions && typeof message.reactions === 'object') {
      Object.entries(message.reactions).forEach(([emoji, users]) => {
        if (Array.isArray(users)) {
          users.forEach((userId) => addReaction(emoji, userId));
        }
      });
    }

    const localReactions = optimisticReactions[message?.messageId] || [];
    localReactions.forEach((reaction) => addReaction(reaction.emoji, reaction.userId));

    return Object.fromEntries(
      Object.entries(emojiUsers).map(([emoji, set]) => [emoji, set.size])
    );
  };

  const selectedDetailMessage = reactionDetail ? messages.find(msg => String(msg.messageId) === String(reactionDetail.messageId)) : null;
  const selectedDetailGroups = selectedDetailMessage ? getReactionGroups(selectedDetailMessage) : {};
  const detailEmoji = reactionDetail?.emoji || Object.keys(selectedDetailGroups)[0] || '';
  const selectedDetailUserIds = selectedDetailMessage && detailEmoji ? getReactionUsers(selectedDetailMessage, detailEmoji) : [];
  const selectedDetailNames = selectedDetailUserIds.map(getReactionUserName);

  const scrollToBottom = (instant = false) => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: instant ? 'instant' : 'smooth'
      });
    }
  };

  const getFileName = (url) => {
    try {
      const decoded = decodeURIComponent(url);
      let name = decoded.split('/').pop().split('?')[0];

      // Strip common UUID prefixes (e.g., c8930007-cb2d-4f93-a888-64d41dba9bfe_...)
      const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}_/i;
      name = name.replace(uuidPattern, '');

      const longPrefixPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}_[0-9]+_/i;
      name = name.replace(longPrefixPattern, '');

      return name || 'Attachment';
    } catch (e) {
      return 'Attachment';
    }
  };

  const FilePreview = ({ url }) => {
    const [content, setContent] = useState('');
    const [loading, setLoading] = useState(false);
    
    // Improved extension detection for blob URLs
    const getExt = (u) => {
      if (u.startsWith('blob:')) return 'file';
      return u.split('.').pop().split('?')[0].toLowerCase();
    };
    
    const ext = getExt(url);
    const isText = ['txt', 'js', 'json', 'py', 'java', 'html', 'css', 'md'].includes(ext);
    const isDoc = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(ext);

    useEffect(() => {
      if (isText) {
        setLoading(true);
        fetch(url)
          .then(res => res.text())
          .then(text => {
            setContent(text.split('\n').slice(0, 8).join('\n'));
            setLoading(false);
          })
          .catch(() => setLoading(false));
      }
    }, [url, isText]);

    if (!isText && !isDoc) return null;

    return (
      <div className="mb-2 rounded-2xl overflow-hidden border border-border bg-[#1e2330] text-slate-300 font-mono text-[12px] relative group/preview">
        {isText ? (
          <div className="flex">
            <div className="bg-white/5 px-2 py-3 text-slate-500 text-right select-none border-r border-white/5 min-w-[32px]">
              {content.split('\n').map((_, i) => <div key={i}>{i + 1}</div>)}
            </div>
            <div className="p-3 overflow-x-auto whitespace-pre">
              {loading ? 'Đang tải nội dung...' : (content || 'Không có nội dung')}
            </div>
          </div>
        ) : (
          <div 
            className="w-full h-[150px] bg-slate-900/50 relative cursor-pointer hover:bg-slate-900/80 transition-all border-b border-border/50 overflow-hidden"
            onClick={() => {
              setIsFileModalLoading(true);
              setSelectedFile({
                url,
                ext,
                name: getFileName(url),
                sender: msg.senderName || 'Người gửi',
                time: new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              });
            }}
          >
            <iframe
              src={getDocViewerUrl(url, ext)}
              className="w-full h-[400px] border-0 scale-[0.5] origin-top translate-y-[-20px]"
              title="In-chat Preview"
              scrolling="no"
            />
            {/* Overlay to prevent scrolling/interaction in the bubble */}
            <div className="absolute inset-0 z-10" />

            <div className="absolute inset-0 bg-gradient-to-t from-slate-900/40 to-transparent z-20 flex items-end justify-center pb-2">
              <p className="text-[9px] font-black text-white/40 uppercase tracking-[0.2em] bg-black/20 px-3 py-1 rounded-full backdrop-blur-sm">
                {ext} Preview
              </p>
            </div>
          </div>
        )}
      </div>
    );
  };

  const getFileIcon = (url) => {
    const getExt = (u) => {
      if (u.startsWith('blob:')) return 'file';
      return u.split('.').pop().split('?')[0].toLowerCase();
    };
    const ext = getExt(url);
    const colorClass = 
      ext === 'pdf' ? 'bg-red-500' :
      ['doc', 'docx'].includes(ext) ? 'bg-blue-500' :
      ['xls', 'xlsx'].includes(ext) ? 'bg-emerald-500' :
      ['zip', 'rar', '7z'].includes(ext) ? 'bg-amber-500' :
      'bg-indigo-500';

    return (
      <div className={cn("w-12 h-12 rounded-xl flex flex-col items-center justify-center text-white relative overflow-hidden flex-shrink-0 shadow-sm", colorClass)}>
        <FileText size={18} className="mb-[-2px] opacity-40" />
        <span className="text-[9px] font-black uppercase tracking-tighter leading-none">{ext}</span>
        <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent pointer-events-none" />
      </div>
    );
  };

  useEffect(() => {
    scrollToBottom(true);
    const timer = setTimeout(() => scrollToBottom(), 100);
    const longTimer = setTimeout(() => scrollToBottom(), 500);

    return () => {
      clearTimeout(timer);
      clearTimeout(longTimer);
    };
  }, [messages]);

  const handleAction = async (action, messageId) => {
    try {
      if (action === 'RECALL') {
        setActiveMenu(null);
        await chatApi.recallMessage(conversationId, messageId);
        dispatch(recallMessage({ conversationId, messageId }));
      } else if (action === 'DELETE_ME') {
        setActiveMenu(null);
        await chatApi.deleteMessage(conversationId, messageId);
        dispatch(removeMessage({ conversationId, messageId }));
      } else if (action === 'PIN') {
        dispatch(pinMessageOptimistic({ conversationId, messageId }));
        setActiveMenu(null);
        await chatApi.pinMessage(conversationId, messageId);
      } else if (action === 'UNPIN') {
        dispatch(unpinMessageOptimistic({ conversationId, messageId }));
        setActiveMenu(null);
        await chatApi.unpinMessage(conversationId, messageId);
      } else if (action === 'REACTION') {
        const { id, emoji } = messageId;
        const currentUserId = user?.userId || user?.id;

        // Find if user already reacted with this exact emoji
        const msg = messages.find(m => m.messageId === id);
        const serverReactions = msg?.reactions?.[emoji] || [];
        const isAlreadyReacted = serverReactions.includes(currentUserId);

        setOptimisticReactions(prev => {
          const currentReactions = prev[id] || (msg?.reactions ? Object.entries(msg.reactions).flatMap(([e, users]) => users.map(u => ({ emoji: e, userId: u }))) : []);
          const existing = currentReactions.find(r => r.userId === currentUserId && r.emoji === emoji);
          const filtered = currentReactions.filter(r => r.userId !== currentUserId);
          
          if (existing) {
            return { ...prev, [id]: filtered };
          }
          return { ...prev, [id]: [...filtered, { emoji, userId: currentUserId }] };
        });

        try {
          if (isAlreadyReacted) {
            await chatApi.removeReaction(conversationId, id, emoji);
          } else {
            await chatApi.addReaction(conversationId, id, emoji);
          }
        } catch (err) {
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
      console.error(`[ERROR] handleAction ${action} failed:`, err);
    }
  };

  const handleVote = async (messageId, optionId, allowMultiple, currentSelection) => {
    try {
      let newOptionIds = [];
      if (allowMultiple) {
        newOptionIds = currentSelection.includes(optionId) ? currentSelection.filter(id => id !== optionId) : [...currentSelection, optionId];
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

  const renderReactions = (messageId, serverReactions, isMe) => {
    const localReactions = optimisticReactions[messageId] || [];

    // Create a Map to store unique reaction per userId
    const uniqueReactionsMap = new Map();

    // Add server reactions first (it's a map of emoji -> [userIds])
    if (serverReactions && typeof serverReactions === 'object') {
      Object.entries(serverReactions).forEach(([emoji, userIds]) => {
        if (Array.isArray(userIds)) {
          userIds.forEach(userId => uniqueReactionsMap.set(userId, emoji));
        }
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
            <button
              key={emoji}
              type="button"
              onClick={() => openReactionDetail(messageId, emoji)}
              className="flex items-center space-x-1 px-2 py-0.5 bg-sidebar/90 backdrop-blur-md border border-border shadow-sm rounded-full animate-fade-in hover:scale-110 transition-transform"
            >
              <span className="text-[12px]">{emoji}</span>
              {count > 1 && <span className="text-[10px] font-black text-foreground/60">{count}</span>}
            </button>
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

  const pinnedMessages = currentConv?.pinnedMessages || [];
  const pinnedIds = pinnedMessages.map(p => p.messageId);

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
    <>
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
        <div className="flex flex-col p-4 space-y-6 min-h-full">
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
                                <>
                                  {/* Transparent Backdrop to close menu */}
                                  <div
                                    className="fixed inset-0 z-[90] cursor-default"
                                    onMouseDown={(e) => {
                                      e.stopPropagation();
                                      setActiveMenu(null);
                                    }}
                                  />
                                  <div
                                    ref={(el) => { menuRef.current = el; menuNodeRef.current = el; }}
                                    className={`absolute bottom-full mb-3 ${isMe ? 'right-0' : 'left-0'} w-52 bg-sidebar border border-border shadow-2xl rounded-[24px] p-2 z-[9999] pointer-events-auto`}
                                    onMouseDown={(e) => e.stopPropagation()}
                                  >
                                    <button
                                      onMouseDown={(e) => { e.stopPropagation(); handleAction('REPLY', msg); }}
                                      className="w-full flex items-center space-x-3 px-4 py-3 text-[13px] font-bold text-foreground hover:bg-surface-100 rounded-2xl transition-all"
                                    >
                                      <Reply size={18} className="text-indigo-400" /> <span>Trả lời</span>
                                    </button>
                                    <button
                                      type="button"
                                      onMouseDown={(e) => { e.stopPropagation(); handleAction(isPinned ? 'UNPIN' : 'PIN', msg.messageId); }}
                                      className="w-full flex items-center space-x-3 px-4 py-3 text-[13px] font-bold text-foreground hover:bg-surface-100 rounded-2xl transition-all"
                                    >
                                      <Pin size={18} className={isPinned ? 'text-indigo-500' : 'text-foreground/40'} fill={isPinned ? 'currentColor' : 'none'} />
                                      <span>{isPinned ? 'Gỡ ghim' : 'Ghim tin nhắn'}</span>
                                    </button>
                                    <div className="h-px bg-border my-1.5 mx-2" />

                                    {/* Xóa phía tôi - Luôn hiển thị cho mọi người */}
                                    <button
                                      onMouseDown={(e) => { e.stopPropagation(); if (window.confirm('Xóa tin nhắn ở phía tôi?')) handleAction('DELETE_ME', msg.messageId); }}
                                      className="w-full flex items-center space-x-3 px-4 py-3 text-[13px] font-bold text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-500/10 rounded-2xl transition-all"
                                    >
                                      <Trash2 size={18} /> <span>Xóa phía tôi</span>
                                    </button>

                                    {/* Thu hồi - Chỉ hiển thị cho người gửi */}
                                    {isMe && (
                                      <button
                                        onMouseDown={(e) => { e.stopPropagation(); if (window.confirm('Thu hồi tin nhắn này với tất cả mọi người?')) handleAction('RECALL', msg.messageId); }}
                                        className="w-full flex items-center space-x-3 px-4 py-3 text-[13px] font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-2xl transition-all"
                                      >
                                        <Trash2 size={18} className="rotate-0" /> <span>Thu hồi</span>
                                      </button>
                                    )}
                                  </div>
                                </>
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
                                      <div className={cn(
                                        "grid gap-1.5",
                                        msg.content ? 'mt-3' : '',
                                        msg.mediaUrls.length === 1 ? "grid-cols-1" : 
                                        (msg.mediaUrls.length === 2 || msg.mediaUrls.length === 4) ? "grid-cols-2" : 
                                        "grid-cols-3"
                                      )}>
                                        {msg.mediaUrls.slice(0, 9).map((url, idx) => {
                                          const isImage = url.match(/\.(jpeg|jpg|gif|png|webp|svg)/i) || (url.startsWith('blob:') && msg.type === 'IMAGE');
                                          const isVideo = url.match(/\.(mp4|webm|ogg)/i) || (url.startsWith('blob:') && msg.type === 'VIDEO');
                                          const isSending = msg.status === 'SENDING' && (Date.now() - (msg.createdAt || 0) < 20000);
                                          const isLastVisible = idx === 8 && msg.mediaUrls.length > 9;

                                          if (isImage) {
                                            return (
                                              <div 
                                                key={idx} 
                                                className={cn(
                                                  "rounded-2xl overflow-hidden border-2 border-white/10 dark:border-white/5 shadow-2xl relative group/img cursor-pointer",
                                                  msg.mediaUrls.length > 1 ? "aspect-square" : ""
                                                )}
                                                onClick={() => setSelectedImage(url)} 
                                              >
                                                <img
                                                  src={url}
                                                  alt=""
                                                  className={cn(
                                                    "max-w-full h-auto hover:scale-[1.03] transition-all duration-500",
                                                    msg.mediaUrls.length > 1 ? "w-full h-full object-cover" : "",
                                                    isSending ? 'opacity-50 blur-[2px]' : ''
                                                  )}
                                                />
                                                
                                                {isLastVisible && (
                                                  <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] flex items-center justify-center z-20">
                                                    <span className="text-white text-2xl font-black italic tracking-tighter">
                                                      +{msg.mediaUrls.length - 8}
                                                    </span>
                                                  </div>
                                                )}

                                                {isSending && (
                                                  <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-[1px]">
                                                    <div className="bg-white/20 p-3 rounded-full backdrop-blur-md">
                                                      <Loader2 size={24} className="text-white animate-spin" />
                                                    </div>
                                                  </div>
                                                )}
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
                                              <div key={idx} className="flex flex-col max-w-full">
                                                <FilePreview url={url} />
                                                <div className="relative group/file">
                                                  <div
                                                    onClick={() => setSelectedFile({ url, ext: url.split('.').pop().split('?')[0].toLowerCase(), name: getFileName(url), sender: msg.senderName, time: formatMessageTime(msg.createdAt) })}
                                                    className={`flex items-start space-x-4 p-4 pr-16 rounded-2xl border transition-all min-w-[320px] max-w-full cursor-pointer ${isMe ? 'bg-white/10 border-white/20 hover:bg-white/15' : 'bg-surface-100 dark:bg-surface-200 border-border hover:bg-surface-200'}`}
                                                  >
                                                    {getFileIcon(url)}

                                                    <div className="flex-1 min-w-0 pt-0.5">
                                                      <p className={`text-[14px] font-bold truncate mb-1 ${isMe ? 'text-white' : 'text-foreground'}`}>
                                                        {getFileName(url)}
                                                      </p>
                                                      <div className={`flex items-center space-x-2 text-[11px] font-medium ${isMe ? 'text-white/60' : 'text-foreground/40'}`}>
                                                        <span>688 B</span>
                                                        <span className="opacity-30">•</span>
                                                        <div className="flex items-center space-x-1 text-indigo-400">
                                                          <Clock size={10} />
                                                          <span className="font-bold">Tải về để xem lâu dài</span>
                                                        </div>
                                                      </div>
                                                    </div>

                                                    {/* Action icons like in the reference image */}
                                                    <div className="absolute bottom-3 right-4 flex items-center space-x-2 opacity-60 group-hover/file:opacity-100 transition-opacity">
                                                      <div className={`p-1.5 rounded-lg border transition-colors ${isMe ? 'border-white/10 hover:bg-white/10' : 'border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                                                        <Info size={14} className={isMe ? 'text-white' : 'text-slate-600'} />
                                                      </div>
                                                      <a
                                                        href={url}
                                                        download
                                                        onClick={(e) => e.stopPropagation()}
                                                        className={`p-1.5 rounded-lg border transition-colors ${isMe ? 'border-white/10 hover:bg-white/10' : 'border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                                                      >
                                                        <Download size={14} className={isMe ? 'text-white' : 'text-slate-600'} />
                                                      </a>
                                                    </div>
                                                  </div>
                                                </div>
                                              </div>
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

      <VoteDetailsModal 
        isOpen={isVoteDetailsOpen}
        onClose={() => setIsVoteDetailsOpen(false)}
        vote={selectedVote}
        members={currentConv?.members}
      />

        {/* Image Lightbox Modal */}
        {selectedImage && (
          <div
            className="fixed inset-0 z-[9999] bg-black/95 backdrop-blur-xl flex items-center justify-center p-4 sm:p-10 animate-fade-in"
            onClick={() => setSelectedImage(null)}
          >
            <button
              className="absolute top-6 right-6 w-12 h-12 flex items-center justify-center bg-white/10 hover:bg-white/20 text-white rounded-full transition-all"
              onClick={() => setSelectedImage(null)}
            >
              <X size={24} />
            </button>

            <img
              src={selectedImage}
              alt="Full view"
              className="max-w-full max-h-full object-contain rounded-lg shadow-2xl animate-msg"
              onClick={(e) => e.stopPropagation()}
            />

          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center space-x-4">
             <button 
              onClick={(e) => {
                e.stopPropagation();
                window.open(selectedImage, '_blank');
              }}
              className="px-6 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold backdrop-blur-md transition-all flex items-center space-x-2"
             >
                <Download size={18} />
                <span>Tải ảnh gốc</span>
             </button>
          </div>
        </div>
      )}

      {/* File Viewer Modal (Zalo style - Image 3) */}
      {selectedFile && (
        <div className="fixed inset-0 z-[9999] bg-[#1a1a1a] flex flex-col animate-fade-in text-white">
          {/* Header Actions */}
          <div className="absolute top-6 right-6 z-50 flex items-center space-x-4">
             <button 
              onClick={() => window.open(selectedFile.url, '_blank')}
              className="p-3 bg-white/10 hover:bg-white/20 rounded-xl transition-all"
              title="Mở trong tab mới"
             >
                <MoreHorizontal size={20} />
             </button>
             <button 
              onClick={() => setSelectedFile(null)}
              className="p-3 bg-white/10 hover:bg-white/20 rounded-xl transition-all"
             >
                <X size={20} />
             </button>
          </div>

          {/* Main Content Canvas (Image 3) */}
          <div className="flex-1 flex flex-col items-center justify-center p-10 overflow-hidden">
            <div className="w-full max-w-5xl h-full bg-white rounded-sm shadow-2xl overflow-auto relative">
               {['txt', 'js', 'json', 'py', 'java', 'html', 'css', 'md'].includes(selectedFile.ext) ? (
                 <iframe 
                    src={selectedFile.url}
                    className="w-full h-full border-0 font-mono text-black"
                 />
               ) : (
                 <iframe 
                    src={`https://docs.google.com/viewer?url=${encodeURIComponent(selectedFile.url)}&embedded=true`}
                    className="w-full h-full border-0"
                 />
               )}
            </div>

            {/* Floating Zoom Controls */}
            <div className="absolute bottom-24 left-1/2 -translate-x-1/2 bg-[#333333] rounded-full px-6 py-3 flex items-center space-x-6 shadow-2xl border border-white/5">
                <button className="text-white/40 hover:text-white transition-colors"><MoreHorizontal size={20} className="rotate-90" /></button>
                <div className="w-px h-4 bg-white/10" />
                <button className="text-white/60 hover:text-white transition-all font-black text-xl leading-none">−</button>
                <span className="text-[14px] font-bold">100%</span>
                <button className="text-white/60 hover:text-white transition-all font-black text-xl leading-none">+</button>
            </div>
          </div>

          {/* Bottom Info Bar (Image 3) */}
          <div className="h-20 bg-[#121212] border-t border-white/5 px-8 flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-500">
                <FileText size={20} />
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-sm truncate max-w-md">{selectedFile.name}</h3>
                <p className="text-[11px] text-white/40 font-medium">
                  {selectedFile.sender} • Hôm qua lúc {selectedFile.time} • 688 B
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-6">
               <button className="p-2 text-white/40 hover:text-white transition-colors">
                  <MoreHorizontal size={20} />
               </button>
               <a 
                href={selectedFile.url} 
                download 
                className="w-10 h-10 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-lg transition-all"
               >
                  <Download size={20} />
               </a>
            </div>
          </div>
        </div>
      )}

      {reactionDetail && selectedDetailMessage && (
        <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-3xl rounded-3xl overflow-hidden border border-white/10 bg-slate-950 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4 bg-slate-900/95">
              <div>
                <div className="text-xs uppercase text-slate-400 tracking-[0.18em]">Biểu cảm</div>
                <div className="text-lg font-semibold text-white mt-1">{detailEmoji} · {selectedDetailGroups[detailEmoji] || 0} lượt</div>
              </div>
              <button
                type="button"
                onClick={closeReactionDetail}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 hover:bg-white/10 transition"
              >Đóng</button>
            </div>
            <div className="grid grid-cols-4 gap-4 p-4">
              <div className="col-span-4 md:col-span-1 bg-slate-900/90 rounded-3xl p-4 space-y-3">
                {Object.entries(selectedDetailGroups).map(([emoji, count]) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setReactionDetail({ messageId: reactionDetail.messageId, emoji })}
                    className={`w-full rounded-3xl px-3 py-3 text-left transition ${detailEmoji === emoji ? 'bg-indigo-500/20 text-white' : 'bg-white/5 text-slate-200 hover:bg-white/10'}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xl">{emoji}</span>
                      <span className="text-sm text-slate-400">{count}</span>
                    </div>
                  </button>
                ))}
              </div>
              <div className="col-span-4 md:col-span-3 bg-slate-900/90 rounded-3xl p-4">
                <div className="mb-4 text-sm text-slate-400">Danh sách người đã chọn biểu cảm này</div>
                <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-2">
                  {selectedDetailNames.length > 0 ? selectedDetailNames.map((name, index) => (
                    <div key={`${name}-${index}`} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
                      {name}
                    </div>
                  )) : (
                    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-400">Chưa có ai phản ứng.</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
};

export default MessageList;
