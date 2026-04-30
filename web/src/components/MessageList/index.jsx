import React, { useRef, useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { PhoneOff, Shield, CheckCheck, Check, Clock, MoreHorizontal, Reply, Trash2, Pin, Image as ImageIcon, FileText, Download, Forward, Users, Lock, Unlock, Info, BarChart2, X, Loader2, Plus, Play, Pause, Volume2, Languages } from 'lucide-react';
import chatApi from '../../api/chatApi';
import { useWebSocket } from '../../hooks/useWebSocket';
import { recallMessage, removeMessage, pinMessageOptimistic, unpinMessageOptimistic, updateMessage, optimisticVote } from '../../store/chatSlice';
import VoteDetailsModal from '../VoteDetailsModal';
import { useTheme } from '../../hooks/useTheme';

const cn = (...classes) => classes.filter(Boolean).join(" ");

// Voice Player Component
const VoicePlayer = ({ url }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const audioRef = useRef(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
      setLoading(false);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
    };
  }, []);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleProgressClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    if (audioRef.current) {
      audioRef.current.currentTime = percent * duration;
    }
  };

  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleTranscribe = async () => {
    setIsTranscribing(true);
    setTranscript('Đang biên dịch...');

    try {
      const response = await chatApi.transcribeVoiceUrl(url);
      const payload = response;
      const transcriptText = payload?.data?.transcript || payload?.transcript;

      if (payload?.success && transcriptText) {
        setTranscript(transcriptText);
      } else {
        setTranscript(`Lỗi: ${payload?.message || 'Không thể biên dịch'}`);
      }
    } catch (error) {
      console.error('Transcription error:', error);
      const message = error?.response?.data?.message || error?.message || 'Biên dịch thất bại';
      setTranscript(`Lỗi: ${message}`);
    } finally {
      setIsTranscribing(false);
    }
  };

  return (
    <div className="py-2 px-4 bg-black/10 dark:bg-white/5 rounded-[20px] min-w-[260px] space-y-2">
      <audio ref={audioRef} src={url} />

      <div className="flex items-center space-x-3">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); togglePlay(); }}
          disabled={loading}
          className="relative z-20 p-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-full transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0 pointer-events-auto"
        >
          {loading ? (
            <Loader2 size={16} className="animate-spin" />
          ) : isPlaying ? (
            <Pause size={16} fill="currentColor" />
          ) : (
            <Play size={16} fill="currentColor" />
          )}
        </button>

        <div className="flex-1 min-w-0">
          <div
            onClick={handleProgressClick}
            className="relative h-1.5 bg-black/20 dark:bg-white/10 rounded-full cursor-pointer group"
          >
            <div
              className="absolute h-full bg-indigo-500 rounded-full transition-all"
              style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
            />
            <div
              className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-indigo-500 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ left: `${duration ? (currentTime / duration) * 100 : 0}%` }}
            />
          </div>
        </div>

        <div className="flex items-center space-x-2 flex-shrink-0">
          <span className="text-xs font-mono font-bold text-foreground/60 whitespace-nowrap">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between">
        <button
          type="button"
          onClick={handleTranscribe}
          disabled={isTranscribing}
          className="text-[11px] font-black uppercase tracking-wider px-3 py-1.5 rounded-full bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/25 transition-all disabled:opacity-60 disabled:cursor-not-allowed z-10"
        >
          {isTranscribing ? 'Đang biên dịch...' : 'Biên dịch'}
        </button>
      </div>

      {transcript && (
        <div className="text-xs font-semibold text-foreground/70 bg-white/30 dark:bg-black/20 rounded-xl px-3 py-2 border border-border/40">
          {transcript}
        </div>
      )}
    </div>
  );
};

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

const MessageList = ({ messages, loading, conversationId, onRefresh, conversations, onReply, onForward, onScrollToMessage }) => {
  const { isDark } = useTheme();
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
  const [activeMenu, setActiveMenu] = useState(null);
  const [hoveredMessageId, setHoveredMessageId] = useState(null);
  const [optimisticReactions, setOptimisticReactions] = useState({}); // { messageId: [reactions] }

  const [isVoteDetailsOpen, setIsVoteDetailsOpen] = useState(false);
  const [selectedVote, setSelectedVote] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isFileModalLoading, setIsFileModalLoading] = useState(true);
  const [reactionDetail, setReactionDetail] = useState(null);
  const [translatedMessages, setTranslatedMessages] = useState({}); // { messageId: text }
  const [translationLoading, setTranslationLoading] = useState({}); // { messageId: boolean }



  const { sendRead } = useWebSocket();
  const meId = user?.userId || user?.id;
  const currentConv = conversations?.find(c => c.conversationId === conversationId);

  // Synchronize optimistic reactions with server state
  useEffect(() => {
    if (!messages) return;
    setOptimisticReactions(prev => {
      const newState = { ...prev };
      let changed = false;
      messages.forEach(msg => {
        if (newState[msg.messageId]) {
          // If server has reactions, filter out the ones we have optimistically added that are now in server state
          if (msg.reactions) {
            const originalLength = newState[msg.messageId].length;
            newState[msg.messageId] = newState[msg.messageId].filter(local => {
              const serverUsers = msg.reactions[local.emoji] || [];
              return !serverUsers.some(uid => String(uid) === String(local.userId));
            });
            if (newState[msg.messageId].length === 0) delete newState[msg.messageId];
            if (originalLength !== (newState[msg.messageId]?.length || 0)) changed = true;
          }
        }
      });
      return changed ? newState : prev;
    });
  }, [messages]);



  useEffect(() => {
    if (!conversationId || !messages || messages.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            // Chỉ gửi read receipt nếu tab đang hiển thị
            // NOTE: Removed document.hasFocus() - khi web-web trên cùng máy, cửa sổ khác mất focus
            if (document.visibilityState !== 'visible') {
              return;
            }

            const messageId = entry.target.getAttribute('data-message-id');
            if (messageId && !messageId.startsWith('temp-')) {
              console.log(`[ReadReceipt] 👁️ Message visible: ${messageId}`);
              sendRead(conversationId, messageId);
              // Stop observing once sent
              observer.unobserve(entry.target);
            }
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px 0px 0px' }
    );

    const messageElements = document.querySelectorAll(`[data-message-sender]`);
    messageElements.forEach((el) => {
      const msgSenderId = el.getAttribute('data-message-sender');
      if (String(msgSenderId) === String(meId)) return; // Don't observe my own messages

      const msgId = el.getAttribute('data-message-id');
      const msg = messages.find(m => String(m.messageId) === String(msgId));

      // ONLY observe if I HAVEN'T read it yet
      if (msg && (!msg.readBy || !msg.readBy.some(id => String(id) === String(meId)))) {
        observer.observe(el);
      }
    });

    return () => observer.disconnect();
  }, [messages, conversationId, meId, sendRead]);

  // FIX: Khi tab trở lại visible (từ hidden), gửi read receipt cho tin nhắn cuối cùng chưa đọc
  useEffect(() => {
    if (!conversationId || !messages || messages.length === 0) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Tìm tin nhắn cuối cùng của người khác mà mình chưa đọc
        for (let i = messages.length - 1; i >= 0; i--) {
          const msg = messages[i];
          if (String(msg.senderId) !== String(meId) &&
              msg.messageId && !String(msg.messageId).startsWith('temp-') &&
              (!msg.readBy || !msg.readBy.some(id => String(id) === String(meId)))) {
            console.log(`[ReadReceipt] 👁️ Tab became visible, marking last unread: ${msg.messageId}`);
            sendRead(conversationId, msg.messageId);
            break;
          }
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [messages, conversationId, meId, sendRead]);



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
                sender: 'Người gửi',
                time: ''
              });
            }}
          >
            <iframe
              src={getDocViewerUrl(url, ext)}
              className="w-full h-[400px] border-0 scale-[0.5] origin-top translate-y-[-20px]"
              title="In-chat Preview"
              scrolling="no"
            />
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
      } else if (action === 'TRANSLATE') {
        const msg = messages.find(m => m.messageId === messageId);
        if (!msg || !msg.content) return;
        
        setTranslationLoading(prev => ({ ...prev, [messageId]: true }));
        setActiveMenu(null);
        try {
          const res = await chatApi.translateText(msg.content);
          setTranslatedMessages(prev => ({ ...prev, [messageId]: res.data.translation }));
        } catch (err) {
          console.error("Translation failed:", err);
          alert("Không thể dịch tin nhắn này.");
        } finally {
          setTranslationLoading(prev => ({ ...prev, [messageId]: false }));
        }
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
    const currentUserId = user?.userId || user?.id;
    const localReactions = optimisticReactions[messageId] || [];
    const uniqueReactionsMap = new Map();

    if (serverReactions && typeof serverReactions === 'object') {
      Object.entries(serverReactions).forEach(([emoji, userIds]) => {
        if (Array.isArray(userIds)) {
          userIds.forEach(userId => {
            uniqueReactionsMap.set(userId, emoji);
          });
        }
      });
    }

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
      <div className={cn(
        "absolute -bottom-5 flex items-center z-30",
        isMe ? 'right-0' : 'left-0'
      )}>
        <div className="flex items-center space-x-1">
          {Object.entries(groups).map(([emoji, count]) => (
            <button
              key={emoji}
              type="button"
              onClick={(e) => { e.stopPropagation(); openReactionDetail(messageId, emoji); }}
              className="flex items-center space-x-1 px-1.5 py-0.5 bg-white dark:bg-slate-800 border border-border shadow-md rounded-full hover:scale-110 transition-transform"
            >
              <span className="text-[12px]">{emoji}</span>
              {count > 1 && <span className="text-[10px] font-bold text-foreground/60">{count}</span>}
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

  const { typingUsers } = useSelector(state => state.chat);
  const wallpaper = currentConv?.wallpaperUrl || null;
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

                const nextMsg = index < messages.length - 1 ? messages[index + 1] : null;
                const isFirstInGroup = index === 0 || (prevMsg && prevMsg.senderId !== msg.senderId) || showDateHeader || (prevMsg && (msg.createdAt - prevMsg.createdAt > 120000)) || (prevMsg && prevMsg.type === 'SYSTEM');
                const isLastInGroup = index === messages.length - 1 || (nextMsg && nextMsg.senderId !== msg.senderId) || (nextMsg && (nextMsg.createdAt - msg.createdAt > 120000)) || (nextMsg && nextMsg.type === 'SYSTEM');

                const isMe = msg.senderId === meId;
                const isCall = msg.type === 'CALL_LOG';
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
                        <div className="flex items-center space-x-2">
                          <span className={`w-1 h-1 rounded-full ${isDark ? 'bg-indigo-500/30' : 'bg-slate-400'}`}></span>
                          <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${
                            isDark ? 'text-white/30' : 'text-slate-500'
                          }`}>
                            {msg.content}
                          </span>
                          <span className={`w-1 h-1 rounded-full ${isDark ? 'bg-indigo-500/30' : 'bg-slate-400'}`}></span>
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
                      data-message-id={msg.messageId}
                      data-message-sender={msg.senderId}
                      className={cn(
                        "flex flex-col relative group animate-msg w-full",
                        msg.type === 'VOTE' ? 'items-center mb-8' : (isMe ? 'items-end' : 'items-start'),
                        isFirstInGroup ? "mt-6" : "mt-0.5",
                        isLastInGroup ? "mb-6" : "mb-0"
                      )}
                    >
                      <div className={cn(
                        "flex items-end",
                        msg.type === 'VOTE' ? 'w-full justify-center max-w-full' : 'max-w-[85%] sm:max-w-[75%] space-x-2.5',
                        isMe ? 'flex-row-reverse space-x-reverse' : 'flex-row'
                      )}>
                        {!isMe && msg.type !== 'VOTE' && (
                          <div className="w-9 h-9 flex-shrink-0 mb-1">
                            {isLastInGroup ? (
                              <div className="w-full h-full rounded-[14px] bg-surface-200 overflow-hidden border-2 border-background shadow-md group-hover:scale-110 transition-transform animate-in zoom-in duration-300">
                                {(msg.senderAvatarUrl || msg.senderAvatar || currentConv?.members?.find(m => m.userId === msg.senderId)?.avatarUrl) ? (
                                  <img src={msg.senderAvatarUrl || msg.senderAvatar || currentConv?.members?.find(m => m.userId === msg.senderId)?.avatarUrl} className="w-full h-full object-cover" alt="" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-foreground/40 font-black italic uppercase text-sm">{msg.senderName?.charAt(0) || '?'}</div>
                                )}
                              </div>
                            ) : <div className="w-9" />}
                          </div>
                        )}

                        <div className={cn(
                          "flex flex-col relative group/bubble",
                          isMe ? "items-end" : "items-start"
                        )}>
                          {isFirstInGroup && !isMe && msg.type !== 'VOTE' && currentConv?.type === 'GROUP' && (
                            <p className={`text-[10px] font-black uppercase tracking-widest ml-3 mb-1.5 opacity-60 ${getMemberColor(msg.senderId, currentConv?.members)}`}>{msg.senderName || 'Thành viên'}</p>
                          )}
                          {isFirstInGroup && msg.type === 'VOTE' && (
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-400/80 mb-2 text-center w-full">{msg.senderName || 'Thành viên'} đã tạo một bình chọn</p>
                          )}

                          <div className="relative group/bubble-content">
                            {msg.forwardedFrom && isFirstInGroup && (
                              <div className={`flex items-center space-x-1 mb-1 opacity-60 ${isMe ? 'justify-end pr-1' : 'justify-start pl-1'}`}>
                                <Forward size={12} className="text-indigo-500" />
                                <span className="text-[10px] font-bold italic text-foreground/60">Được chuyển tiếp</span>
                              </div>
                            )}
                            {msg.replyTo && (
                              <div 
                                onClick={() => onScrollToMessage(msg.replyTo.messageId)} 
                                className={cn(
                                  "mb-1 flex items-stretch p-2.5 rounded-xl border-l-[3px] border-indigo-500 cursor-pointer transition-all max-w-sm overflow-hidden shadow-sm",
                                  isDark ? 'bg-slate-800 hover:bg-slate-700' : 'bg-white hover:bg-gray-50',
                                  isMe ? 'mr-1' : 'ml-1'
                                )}
                              >
                                {(() => {
                                  const originalMsg = messages.find(m => m.messageId === msg.replyTo.messageId);
                                  const hasMedia = originalMsg && ((originalMsg.mediaUrls && originalMsg.mediaUrls.length > 0) || originalMsg.type === 'STICKER');
                                  
                                  return (
                                    <>
                                      {hasMedia && (
                                        <div className="flex-shrink-0 mr-2.5 flex items-center">
                                          {originalMsg.type === 'IMAGE' ? (
                                            <img src={originalMsg.mediaUrls?.[0]} className="h-9 w-9 rounded-md object-cover border border-slate-200 dark:border-white/5 shadow-sm" alt="image" />
                                          ) : originalMsg.type === 'STICKER' ? (
                                            <img src={originalMsg.content} className="h-9 w-9 rounded-md object-contain drop-shadow-md" alt="sticker" />
                                          ) : (
                                            <div className="h-9 w-9 rounded-md bg-indigo-50 flex items-center justify-center text-indigo-500 border border-indigo-100 dark:bg-indigo-500/10 dark:border-indigo-500/20"><FileText size={16} /></div>
                                          )}
                                        </div>
                                      )}
                                      <div className="flex flex-col justify-center min-w-0 flex-1">
                                        <p className={cn("text-[13px] font-bold truncate leading-tight mb-0.5", isDark ? 'text-gray-100' : 'text-slate-800')}>{msg.replyTo.senderName}</p>
                                        <p className={cn("text-[12px] truncate leading-tight", isDark ? 'text-gray-400' : 'text-slate-500')}>
                                          {(() => {
                                            if (msg.replyTo.content && msg.replyTo.content !== '[Attachment]') return msg.replyTo.content;
                                            if (originalMsg) {
                                              if (originalMsg.type === 'IMAGE') return '[Hình ảnh]';
                                              if (originalMsg.type === 'VIDEO') return '[Video]';
                                              if (originalMsg.type === 'STICKER') return '[Nhãn dán]';
                                              if (originalMsg.type === 'FILE' && originalMsg.mediaUrls?.length > 0) {
                                                try {
                                                  const url = originalMsg.mediaUrls[0];
                                                  const decoded = decodeURIComponent(url);
                                                  let name = decoded.split('/').pop().split('?')[0];
                                                  name = name.replace(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}_/i, '');
                                                  name = name.replace(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}_[0-9]+_/i, '');
                                                  return `[Tệp] ${name}`;
                                                } catch(e) {
                                                   return '[Tệp đính kèm]';
                                                }
                                              }
                                            }
                                            return msg.replyTo.content || '[Tệp đính kèm]';
                                          })()}
                                        </p>
                                      </div>
                                    </>
                                  );
                                })()}
                              </div>
                            )}

                            {isRecalled ? (
                              <div className="px-6 py-3.5 bg-surface-200/80 text-foreground/40 rounded-[22px] border border-border flex items-center space-x-3 italic">
                                <Trash2 size={14} className="opacity-50" />
                                <span className="text-[13px] font-medium">Tin nhắn đã bị thu hồi</span>
                              </div>
                            ) : isCall ? (
                              <div className="px-6 py-4 bg-background rounded-[24px] shadow-xl shadow-indigo-500/5 dark:shadow-black/20 flex items-center space-x-4 border border-border group-hover:scale-[1.02] transition-transform">
                                <div className="p-3 bg-red-50 dark:bg-red-500/10 text-red-500 rounded-full"><PhoneOff size={20} /></div>
                                <div>
                                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-red-500/60 mb-0.5">VoIP Event</p>
                                  <p className="text-sm font-black tracking-tight text-foreground">{msg.content}</p>
                                </div>
                              </div>
                            ) : (msg.type === 'VOTE' && msg.vote) ? (
                              <div className={`w-full max-w-[340px] bg-white dark:bg-slate-900 rounded-[28px] border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500`}>
                                <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-br from-indigo-500/5 to-transparent">
                                  <div className="flex items-start justify-between mb-4">
                                    <div className="space-y-1">
                                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-500">Cuộc bình chọn</p>
                                      <h4 className="text-[16px] font-black text-slate-900 dark:text-white leading-tight">{msg.vote.question}</h4>
                                    </div>
                                    <div className={cn("p-2.5 rounded-xl transition-all shadow-sm", msg.vote.isClosed ? "bg-red-500/10 text-red-500" : "bg-indigo-500/10 text-indigo-500")}><BarChart2 size={18} /></div>
                                  </div>
                                </div>
                                <div className="p-5 space-y-3 bg-slate-50/30 dark:bg-slate-900/30">
                                  {msg.vote.options.map((opt) => {
                                    const voterIds = opt.voterIds || [];
                                    const percent = (msg.vote.options.reduce((s, o) => s + (o.voterIds?.length || 0), 0) > 0) ? (voterIds.length / msg.vote.options.reduce((s, o) => s + (o.voterIds?.length || 0), 0)) * 100 : 0;
                                    const isSelected = voterIds.includes(meId);
                                    return (
                                      <button key={opt.optionId} disabled={msg.vote.isClosed} onClick={() => handleVote(msg.messageId, opt.optionId, msg.vote.allowMultiple, msg.vote.options.filter(o => o.voterIds?.includes(meId)).map(o => o.optionId))} className={cn("w-full text-left p-4 rounded-[20px] transition-all relative overflow-hidden border-2", isSelected ? 'bg-indigo-500/10 border-indigo-500' : 'bg-white dark:bg-slate-800 border-transparent')}>
                                        <div className="absolute left-0 top-0 bottom-0 bg-indigo-500/5 transition-all duration-1000" style={{ width: `${percent}%` }} />
                                        <div className="relative flex items-center justify-between z-10">
                                          <div className="flex items-center space-x-3">
                                            <div className={cn("w-5 h-5 rounded-full border-2 flex items-center justify-center", isSelected ? "bg-indigo-50 border-indigo-500" : "border-slate-200")}>{isSelected && <CheckCheck size={10} className="text-white" />}</div>
                                            <span className="text-[14px] font-bold">{opt.text}</span>
                                          </div>
                                          <span className="text-[12px] font-black text-slate-400">{voterIds.length}</span>
                                        </div>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            ) : (
                              <div className={cn("flex flex-col", isMe ? "items-end" : "items-start")}>
                                <div className="relative group/bubble-main w-fit max-w-[85vw] lg:max-w-[560px]">
                                  {/* Emoji Quick Picker */}
                                  <div className={cn(`absolute -top-12 ${isMe ? 'right-0' : 'left-0'} hidden group-hover/bubble-main:flex items-center space-x-1 p-1 bg-[#1e2330]/95 backdrop-blur-xl border border-white/10 shadow-2xl rounded-full z-[100] animate-in fade-in zoom-in slide-in-from-bottom-2 duration-200`)}>
                                    {EMOJIS.map(emoji => (
                                      <button key={emoji} onClick={(e) => { e.stopPropagation(); handleAction('REACTION', { id: msg.messageId, emoji }); }} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/10 hover:scale-125 transition-all text-[20px]">{emoji}</button>
                                    ))}
                                  </div>

                                  {/* Action Buttons (Reply, Forward, More) */}
                                  <div className={cn("absolute top-0 flex items-center space-x-1 opacity-0 group-hover/bubble-main:opacity-100 transition-all z-10", isMe ? "-left-28" : "-right-28")}>
                                    <button onClick={() => onReply(msg)} className="p-1 px-1.5 hover:bg-surface-200 rounded-full text-foreground/40 hover:text-indigo-500 transition-all" title="Trả lời"><Reply size={18} /></button>
                                    <button onClick={() => onForward(msg)} className="p-1 px-1.5 hover:bg-surface-200 rounded-full text-foreground/40 hover:text-blue-500 transition-all" title="Chuyển tiếp"><Forward size={18} className="text-blue-500" /></button>
                                    <button onClick={(e) => { e.stopPropagation(); setActiveMenu(activeMenu === msg.messageId ? null : msg.messageId); }} className="p-1 px-1.5 hover:bg-surface-200 rounded-full text-foreground/40 hover:text-foreground transition-all" title="Thêm"><MoreHorizontal size={18} /></button>
                                  </div>

                                  {/* Context Menu */}
                                  {activeMenu === msg.messageId && (
                                    <>
                                      <div className="fixed inset-0 z-[90]" onMouseDown={(e) => { e.stopPropagation(); setActiveMenu(null); }} />
                                      <div className={`absolute bottom-full mb-3 ${isMe ? 'right-0' : 'left-0'} w-52 bg-sidebar border border-border shadow-2xl rounded-[24px] p-2 z-[9999]`}>
                                        <button onMouseDown={(e) => { e.stopPropagation(); handleAction('REPLY', msg); }} className="w-full flex items-center space-x-3 px-4 py-3 text-[13px] font-bold text-foreground hover:bg-surface-100 rounded-2xl transition-all"><Reply size={18} className="text-indigo-400" /> <span>Trả lời</span></button>
                                        <button onMouseDown={(e) => { e.stopPropagation(); handleAction('TRANSLATE', msg.messageId); }} className="w-full flex items-center space-x-3 px-4 py-3 text-[13px] font-bold text-foreground hover:bg-surface-100 rounded-2xl transition-all"><Languages size={18} className="text-indigo-400" /> <span>Dịch tin nhắn</span></button>
                                        <button onMouseDown={(e) => { e.stopPropagation(); handleAction(isPinned ? 'UNPIN' : 'PIN', msg.messageId); }} className="w-full flex items-center space-x-3 px-4 py-3 text-[13px] font-bold text-foreground hover:bg-surface-100 rounded-2xl transition-all"><Pin size={18} className={isPinned ? 'text-indigo-500' : 'text-foreground/40'} fill={isPinned ? 'currentColor' : 'none'} /><span>{isPinned ? 'Gỡ ghim' : 'Ghim tin nhắn'}</span></button>
                                        <div className="h-px bg-border my-1.5 mx-2" />
                                        <button onMouseDown={(e) => { e.stopPropagation(); if (window.confirm('Xóa tin nhắn ở phía tôi?')) handleAction('DELETE_ME', msg.messageId); }} className="w-full flex items-center space-x-3 px-4 py-3 text-[13px] font-bold text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-500/10 rounded-2xl transition-all"><Trash2 size={18} /> <span>Xóa phía tôi</span></button>
                                        {isMe && <button onMouseDown={(e) => { e.stopPropagation(); if (window.confirm('Thu hồi tin nhắn này với tất cả mọi người?')) handleAction('RECALL', msg.messageId); }} className="w-full flex items-center space-x-3 px-4 py-3 text-[13px] font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-2xl transition-all"><Trash2 size={18} /> <span>Thu hồi</span></button>}
                                      </div>
                                    </>
                                  )}

                                  {/* Main Bubble Content */}
                                  <div className={cn(
                                    "relative transition-all duration-300 shadow-sm w-fit",
                                    msg.type === 'STICKER' ? 'bg-transparent shadow-none ring-0' : (msg.content && (!msg.mediaUrls || msg.mediaUrls.length === 0) ? 'px-5 py-3' : 'p-0'),
                                    isMe 
                                      ? (msg.type !== 'STICKER' ? 'bg-indigo-600 text-white shadow-sm' : '') 
                                      : (msg.type !== 'STICKER' ? 'bg-surface-200 text-foreground border border-border' : ''),
                                    isMe
                                      ? "rounded-[22px] rounded-br-[4px]"
                                      : "rounded-[22px] rounded-bl-[4px]",
                                    isPinned && msg.type !== 'STICKER' ? 'ring-2 ring-indigo-500/30' : '',
                                    "overflow-hidden transition-all duration-300"
                                  )}>
                                    {msg.type === 'VOICE' ? (
                                      <div className="p-2">
                                        {msg.mediaUrls && msg.mediaUrls[0] && (
                                          <VoicePlayer url={msg.mediaUrls[0]} />
                                        )}
                                      </div>
                                    ) : msg.type === 'STICKER' ? (
                                      <div className="relative group/sticker">
                                        <img
                                          src={msg.content}
                                          alt="sticker"
                                          className="max-w-[160px] sm:max-w-[220px] h-auto transition-transform duration-500 group-hover/sticker:scale-110 pointer-events-auto"
                                        />
                                      </div>
                                    ) : (
                                      <div className={cn("flex flex-col max-w-full", msg.mediaUrls?.length > 0 ? "min-w-[140px]" : "min-w-0")}>
                                        {msg.mediaUrls && msg.mediaUrls.length > 0 && (
                                          <div className="bg-black/5 dark:bg-black/40 backdrop-blur-sm">
                                            {(() => {
                                              const urls = msg.mediaUrls;
                                              const count = urls.length;
                                              
                                              const renderMediaItem = (url, idx, isSmall = true) => {
                                                const isImage = url.match(/\.(jpeg|jpg|gif|png|webp|svg)/i) || (url.startsWith('blob:') && msg.type === 'IMAGE');
                                                const isVideo = url.match(/\.(mp4|webm|ogg)/i) || (url.startsWith('blob:') && msg.type === 'VIDEO');
                                                
                                                if (isImage) {
                                                  return (
                                                    <div key={idx} className={cn("overflow-hidden cursor-pointer group/img relative bg-surface-100 dark:bg-surface-200", isSmall ? "aspect-square" : "aspect-video")} onClick={() => setSelectedImage(url)}>
                                                      <img src={url} className="w-full h-full object-cover group-hover:scale-105 transition-all duration-700" alt="" />
                                                      <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/5 transition-colors" />
                                                    </div>
                                                  );
                                                }
                                                if (isVideo) {
                                                  return (
                                                    <div key={idx} className={cn("overflow-hidden bg-black", isSmall ? "aspect-square" : "aspect-video")}>
                                                      <video controls className="w-full h-full object-cover">
                                                        <source src={url} />
                                                      </video>
                                                    </div>
                                                  );
                                                }
                                                return (
                                                  <div key={idx} className="flex flex-col max-w-full p-2">
                                                    <FilePreview url={url} />
                                                    <div className="relative group/file">
                                                      <div
                                                        onClick={() => setSelectedFile({ url, ext: url.split('.').pop().split('?')[0].toLowerCase(), name: getFileName(url), sender: msg.senderName, time: formatMessageTime(msg.createdAt) })}
                                                        className={`flex items-start space-x-4 p-4 pr-16 rounded-2xl border transition-all min-w-[260px] max-w-full cursor-pointer ${isMe ? 'bg-white/10 border-white/20 hover:bg-white/15' : 'bg-surface-100 dark:bg-surface-200 border-border hover:bg-surface-200'}`}
                                                      >
                                                        {getFileIcon(url)}
                                                        <div className="flex-1 min-w-0 pt-0.5">
                                                          <p className={`text-[14px] font-bold truncate mb-1 ${isMe ? 'text-white' : 'text-foreground'}`}>
                                                            {getFileName(url)}
                                                          </p>
                                                        </div>
                                                      </div>
                                                    </div>
                                                  </div>
                                                );
                                              };

                                              if (count === 1) {
                                                const url = urls[0];
                                                const isImage = url.match(/\.(jpeg|jpg|gif|png|webp|svg)/i) || (url.startsWith('blob:') && msg.type === 'IMAGE');
                                                if (isImage) {
                                                  return (
                                                    <div className="overflow-hidden cursor-pointer bg-surface-100 dark:bg-surface-200" onClick={() => setSelectedImage(url)}>
                                                      <img src={url} className="max-w-full h-auto block hover:scale-[1.02] transition-transform duration-700" alt="" />
                                                    </div>
                                                  );
                                                }
                                                return renderMediaItem(url, 0, false);
                                              }

                                              const getRows = (c) => {
                                                if (c <= 5) return [c];
                                                if (c === 6) return [3, 3];
                                                if (c === 7) return [4, 3];
                                                if (c === 8) return [4, 4];
                                                const rows = [];
                                                let rem = c;
                                                while (rem > 0) {
                                                  if (rem >= 5) { rows.push(5); rem -= 5; }
                                                  else { rows.push(rem); rem = 0; }
                                                }
                                                return rows;
                                              };

                                              const rows = getRows(count);
                                              let currentIndex = 0;

                                              return (
                                                <div className="flex flex-col gap-[2px]">
                                                  {rows.map((rowSize, rowIndex) => {
                                                    const gridColsClass = {
                                                      1: 'grid-cols-1',
                                                      2: 'grid-cols-2',
                                                      3: 'grid-cols-3',
                                                      4: 'grid-cols-4',
                                                      5: 'grid-cols-5'
                                                    }[rowSize] || 'grid-cols-5';
                                                    const rowUrls = urls.slice(currentIndex, currentIndex + rowSize);
                                                    currentIndex += rowSize;
                                                    return (
                                                      <div key={rowIndex} className={cn("grid gap-[2px]", gridColsClass)}>
                                                        {rowUrls.map((url, i) => renderMediaItem(url, currentIndex - rowSize + i, true))}
                                                      </div>
                                                    );
                                                  })}
                                                </div>
                                              );
                                            })()}
                                          </div>
                                        )}
                                        {msg.content && <p className="text-[14px] px-4 pt-3 pb-1 whitespace-pre-wrap break-words font-semibold leading-relaxed tracking-tight text-inherit/90">{msg.content}</p>}
                                        
                                        {/* Translation Display */}
                                        {translationLoading[msg.messageId] && (
                                          <div className="px-4 py-2 flex items-center space-x-2 text-[11px] font-black text-indigo-400 uppercase tracking-widest animate-pulse">
                                            <Loader2 size={12} className="animate-spin" />
                                            <span>AI đang dịch...</span>
                                          </div>
                                        )}
                                        {translatedMessages[msg.messageId] && (
                                          <div className={cn(
                                            "mt-1 mx-2 mb-2 p-3 rounded-xl border flex flex-col",
                                            isMe ? "bg-white/10 border-white/10" : "bg-indigo-500/5 border-indigo-500/10"
                                          )}>
                                            <div className="flex items-center space-x-1.5 mb-1 opacity-60">
                                              <SparklesIcon size={10} className="text-indigo-400" />
                                              <span className="text-[9px] font-black uppercase tracking-widest text-indigo-400">Bản dịch AI</span>
                                            </div>
                                            <p className="text-[13px] leading-relaxed italic">{translatedMessages[msg.messageId]}</p>
                                          </div>
                                        )}
                                        <div className={cn("flex justify-end px-3 pb-2", (msg.content || msg.mediaUrls?.length > 0) ? "mt-1" : "mt-1")}>
                                          <span className={`text-[9px] font-black opacity-70 tabular-nums uppercase tracking-widest ${isMe ? 'text-white' : 'text-foreground'}`}>
                                            {formatMessageTime(msg.createdAt)}
                                          </span>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                  {/* Reactions Badge - Positioned absolute relative to the w-fit bubble wrapper */}
                                  {msg.type !== 'VOTE' && renderReactions(msg.messageId, msg.reactions, isMe)}
                                </div>

                                  {/* Seen Avatars - Moved outside the w-fit bubble-main to avoid vertical displacement */}
                                <div className={cn(
                                  "flex items-center px-1 min-h-[20px]",
                                  ((msg.reactions && Object.keys(msg.reactions).length > 0) || (optimisticReactions[msg.messageId] && optimisticReactions[msg.messageId].length > 0)) ? "mt-4" : "mt-2",
                                  isMe ? 'justify-end' : 'justify-start ml-1'
                                )}>
                                  {msg.readBy && msg.readBy.length > 0 && isMe && (
                                    <div className="flex items-center space-x-[-6px] transition-all duration-500 animate-in fade-in slide-in-from-right-2">
                                      {msg.readBy.filter(vId => {
                                        const readerId = String(vId);
                                        // 1. Chỉ hiển thị avatar người khác đã xem dưới tin nhắn của chính mình gửi
                                        if (readerId === String(msg.senderId)) return false;

                                        // 2. CHỈ hiển thị nếu đây là tin nhắn MỚI NHẤT mà người này đã đọc
                                        const isLatestRead = !messages.slice(index + 1).some(m =>
                                          m.readBy && m.readBy.some(id => String(id) === readerId)
                                        );
                                        return isLatestRead;
                                      }).slice(0, 5).map((vId) => {
                                        const reader = currentConv?.members?.find(m => String(m.userId || m.id) === String(vId));
                                        if (!reader) return null;
                                        return (
                                          <div key={vId} className="w-5 h-5 rounded-full ring-2 ring-background bg-surface-200 overflow-hidden shadow-lg transform hover:scale-125 transition-transform cursor-help" title={reader?.fullName || reader?.name}>
                                            {reader?.avatarUrl ? (
                                              <img src={reader.avatarUrl} className="w-full h-full object-cover" alt="" />
                                            ) : (
                                              <div className="w-full h-full flex items-center justify-center bg-indigo-500 text-[7px] font-bold text-white uppercase">
                                                {(reader?.fullName || reader?.name || '?').charAt(0)}
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                  {(() => {
                                    if (!isMe) return null;

                                    const hasBeenReadByOther = msg.readBy?.some(id => String(id) !== String(meId));
                                    const isOlderThanAnyReadMessage = messages.slice(index + 1).some(m =>
                                      m.readBy?.some(id => String(id) !== String(meId))
                                    );

                                    if (hasBeenReadByOther || isOlderThanAnyReadMessage) return null;

                                    return (
                                      <div className="flex items-center mt-1">
                                        {(() => {
                                          if (msg.status === 'SENDING' && String(msg.messageId).startsWith('temp-')) {
                                            return (
                                              <div className="flex items-center space-x-1 ml-1 opacity-50">
                                                <Clock size={11} className="text-indigo-400 animate-pulse" />
                                                <span className="text-[10px] font-bold text-foreground/40 uppercase tracking-tighter">Đang gửi</span>
                                              </div>
                                            );
                                          }

                                          const isOtherOnline = currentConv?.members?.some(m =>
                                            String(m.userId || m.id) !== String(meId) &&
                                            (String(m.status || m.presence || '').toUpperCase() === 'ONLINE' || m.isOnline === true)
                                          );

                                          if (isOtherOnline) {
                                            return (
                                              <div className="flex items-center space-x-1 px-2 py-0.5 bg-indigo-500/10 dark:bg-indigo-500/20 rounded-full border border-indigo-500/20 shadow-sm animate-in fade-in zoom-in duration-300">
                                                <CheckCheck size={12} className="text-indigo-500" />
                                                <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-tight">Đã nhận</span>
                                              </div>
                                            );
                                          } else {
                                            return (
                                              <div className="flex items-center space-x-1 px-2 py-0.5 bg-slate-100 dark:bg-white/5 rounded-full border border-border/50 opacity-60">
                                                <Check size={12} className="text-slate-400 dark:text-slate-500" />
                                                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-tight">Đã gửi</span>
                                              </div>
                                            );
                                          }
                                        })()}
                                      </div>
                                    );
                                  })()}
                                  {isPinned && <Pin size={10} className="text-indigo-400 animate-pulse ml-2" fill="currentColor" />}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
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

        {selectedFile && (
          <div className="fixed inset-0 z-[9999] bg-[#1a1a1a] flex flex-col animate-fade-in text-white">
            {/* Header Actions */}
            <div className="absolute top-6 right-6 z-[100] flex items-center space-x-4">
              <button
                onClick={() => window.open(selectedFile.url, '_blank')}
                className="p-3 bg-white/10 hover:bg-white/20 rounded-xl transition-all"
                title="Tải về"
              >
                <Download size={20} />
              </button>
              <button
                onClick={() => setSelectedFile(null)}
                className="p-3 bg-white/10 hover:bg-white/20 rounded-xl transition-all"
              >
                <X size={20} />
              </button>
            </div>

            {/* Main Content Canvas (Image 3) */}
            <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-10 overflow-hidden bg-slate-900/50">
              <div className="w-full max-w-5xl h-full bg-white rounded-sm shadow-2xl overflow-hidden relative">
                {isFileModalLoading && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#222] z-50">
                    <Loader2 size={48} className="text-indigo-500 animate-spin mb-4" />
                    <p className="text-white/40 font-bold text-sm animate-pulse tracking-widest uppercase">Đang chuẩn bị tài liệu...</p>
                  </div>
                )}
                <iframe
                  src={getDocViewerUrl(selectedFile.url, selectedFile.ext)}
                  className="w-full h-full border-0"
                  title="File Viewer"
                  onLoad={() => setIsFileModalLoading(false)}
                />
              </div>

              {/* Floating Zoom Controls */}
              <div className="absolute bottom-24 left-1/2 -translate-x-1/2 bg-[#333333]/90 backdrop-blur-xl rounded-full px-6 py-2.5 flex items-center space-x-6 shadow-2xl border border-white/5 z-50">
                <button className="text-white/40 hover:text-white transition-colors"><MoreHorizontal size={20} className="rotate-90" /></button>
                <div className="w-px h-4 bg-white/10" />
                <button className="text-white/60 hover:text-white transition-all text-2xl font-light leading-none hover:scale-125">−</button>
                <span className="text-[14px] font-black tracking-tighter min-w-[45px] text-center">100%</span>
                <button className="text-white/60 hover:text-white transition-all leading-none hover:scale-125">
                  <Plus size={20} />
                </button>
              </div>
            </div>

            {/* Bottom Info Bar (Image 3) */}
            <div className="h-20 bg-[#121212] border-t border-white/5 px-8 flex items-center justify-between z-50">
              <div className="flex items-center space-x-4">
                <div className="w-10 h-10 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-500">
                  <FileText size={20} />
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-sm truncate max-w-[200px] sm:max-w-md">{selectedFile.name}</h3>
                  <p className="text-[11px] text-white/40 font-medium">
                    {selectedFile.sender} • {selectedFile.time} • File {selectedFile.ext.toUpperCase()}
                  </p>
                </div>
              </div>
              <div className="hidden sm:flex items-center space-x-2">
                <button className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-xs transition-all">
                  Chia sẻ
                </button>
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
