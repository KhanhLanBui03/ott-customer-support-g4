import React, { useState, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useWebSocket } from '../../hooks/useWebSocket';
import { Send, Smile, Paperclip, X, Loader2, Sticker, Search, Image as ImageIconLucide, BarChart2, ShieldAlert, FileText, Stars as SparklesIcon, Mic, Square } from 'lucide-react';
import { chatApi } from '../../api/chatApi';
import { useChat } from '../../hooks/useChat';
import { useVoiceRecorder } from '../../hooks/useVoiceRecorder';
import { addOptimisticMessage } from '../../store/chatSlice';

const MessageInput = ({ conversationId, replyingTo, onCancelReply, onOpenVoteModal }) => {
  const [text, setText] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [localAttachments, setLocalAttachments] = useState([]); // Store { file, blobUrl }
  const [showEmojis, setShowEmojis] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [isVoiceUploading, setIsVoiceUploading] = useState(false);
  const { sendMessage, sendTyping } = useWebSocket();
  const dispatch = useDispatch();
  const { user } = useSelector(state => state.auth);
  const { conversations, friends } = useChat();
  const { isRecording, durationFormatted, startRecording, stopRecording, cancelRecording } = useVoiceRecorder();
  const fileInputRef = useRef();
  const textInputRef = useRef();
  const typingTimeoutRef = useRef(null);

  const emojiCategories = [
    { id: 'smileys', label: '😀', emojis: ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥', '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🤧', '🥵', '🥶', '🥴', '😵', '🤯', '🤠', '🥳', '😎', '🤓', '🧐', '😕', '😟', '🙁', '☹️', '😮', '😯', '😲', '😳', '🥺', '😦', '😧', '😨', '😰', '😥', '😢', '😭', '😱', '😖', '😣', '😞', '😓', '😩', '😫', '🥱', '😤', '😡', '😠', '🤬', '😈', '👿', '💀', '☠️', '💩', '🤡', '👹', '👺', '👻', '👽', '👾', '🤖'] },
    { id: 'gestures', label: '👋', emojis: ['👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✍️', '💅', '🤳', '💪', '🦾', '🦵', '🦿', '🦶', '👂', '🦻', '👃', '🧠', '🦷', '🦴', '👀', '👁️', '👅', '👄'] },
    { id: 'animals', label: '🐶', emojis: ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐽', '🐸', '🐵', '🙈', '🙉', '🙊', '🐒', '🐔', '🐧', '🐦', '🐤', '🐣', '🐥', '🦆', '🦢', '🦉', '🦩', '🦚', '🦜', '🐸', '🐊', '🐢', '🦎', '🐍', '🐲', '🐉', '🦕', '🦖', '🐳', '🐋', '🐬', '🐟', '🐠', '🐡', '🦈', '🐙', '🐚', '🦀', '🦞', '🦐', '🦑'] },
    { id: 'food', label: '🍏', emojis: ['🍏', '🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🍈', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🍆', '🥑', '🥦', '🥬', '🥒', '🌽', '🥕', '👝', '🍟', '🍔', '🍕', '🌭', '🥪', '🌮', '🌯', '🥗', '🥘', '🍲', '🍱', '🥣', '🍛', '🍜', '🍜', '🍝', '🍠', '🍤', '🍣', '🍦', '🍧', '🍨', '🍩', '🍪', '🎂', '🍰', '🧁', '🥧', '🍫', '🍬', '🍭', '🍮', '🍯', '🍼', '☕', '🍵', '🍶', '🍷', '🍸', '🍹', '🍺', '🍻', '🥂', '🥃'] },
    { id: 'activities', label: '⚽', emojis: ['⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱', '🪀', '🏓', '🏸', '🏒', '🏑', '🥍', '🏏', '🥅', '⛳', '🪁', '🏹', '🎣', '🤿', '🥊', '🥋', '⛸️', '🎿', '🛷', '🥌', '🎯', '🪀', '🎮', '🕹️', '🎰', '🎲', '🧩', '🧸', '♠️', '♥️', '♦️', '♣️', '♟️', '🃏', '🀄', '🎴', '🎭', '🎨', '🧵', '🧶'] },
    { id: 'objects', label: '💡', emojis: ['⌚', '📱', '📲', '💻', '⌨️', '🖱️', '🖲️', '🕹️', '🗜️', '💽', '💾', '💿', '📀', '📼', '📷', '📸', '📹', '🎥', '📽️', '🎞️', '📞', '☎️', '📟', '📠', '📺', '📻', '🎙️', '🎚️', '🎛️', '🧭', '⏱️', '⏲️', '⏰', '🕰️', '⌛', '⏳', '📡', '🔋', '🔌', '💡', '🔦', '🕯️', '🪔', '🧯', '🛢️', '💸', '💵', '💴', '💶', '💷', '💰', '💳', '💎', '⚖️', '🧰', '🔧', '🔨', '⚒️', '🛠️', '⛏️', '🔩', '⚙️', '🧱', '⛓️', '🧲', '🔫', '💣', '🧨', '🪓', '🔪', '🗡️', '⚔️', '🛡️', '🚬', '⚰️', '⚱️', '🏺', '🔮', '📿', '🧿', '💈', '⚗️', '🔭', '🔬', '🕳️', '🩺', '💊', '💉', '🩸', '🧬', '🦠', '🧼', '🧽', '🪒', '🧺', '🧹', '🌡️', '🏷️', '🔖'] },
    { id: 'symbols', label: '❤️', emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '☮️', '✝️', '☪️', '🕉️', '☸️', '🔯', '🕎', '☯️', '☦️', '🛐', '⛎', '♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓', '🆔', '⚛️', '🉑', '☢️', '☣️', '📴', '📳', '🈶', '🈚', '🈸', '🈺', '🈷️', '✴️', '🆚', '💮', '🉐', '㊙️', '㊗️', '🈴', '🈵', '🈹', '🈲', '🅰️', '🅱️', '🆎', '🆑', '🅾️', '🆘', '❌', '⭕', '🛑', '⛔', '📛', '🚫', '💯', '💢', '♨️', '🚷', '🚯', '🚳', '🚱', '🔞', '📵', '🚭', '❗', '❕', '❓', '❔', '‼️', '⁉️', '🔅', '🔆', '〽️', '⚠️', '🚸', '🔱', '⚜️', '🔰', '♻️', '✅', '🈯', '💹', '❇️', '✳️', '❎', '🌐', '💠', 'Ⓜ️', '🌀', '💤'] }
  ];

  const [activeCategory, setActiveCategory] = useState('smileys');
  const [activeTab, setActiveTab] = useState('emoji');
  const [searchTerm, setSearchTerm] = useState('');

  const stickerSets = [
    { id: 'bunny', label: '🐰', stickers: ['https://api.dicebear.com/7.x/bottts/svg?seed=1', 'https://api.dicebear.com/7.x/bottts/svg?seed=2', 'https://api.dicebear.com/7.x/bottts/svg?seed=3', 'https://api.dicebear.com/7.x/bottts/svg?seed=4', 'https://api.dicebear.com/7.x/bottts/svg?seed=5', 'https://api.dicebear.com/7.x/bottts/svg?seed=6', 'https://api.dicebear.com/7.x/bottts/svg?seed=7', 'https://api.dicebear.com/7.x/bottts/svg?seed=8'] },
    { id: 'cat', label: '🐱', stickers: ['https://api.dicebear.com/7.x/avataaars/svg?seed=Felix', 'https://api.dicebear.com/7.x/avataaars/svg?seed=Buddy', 'https://api.dicebear.com/7.x/avataaars/svg?seed=Luna', 'https://api.dicebear.com/7.x/avataaars/svg?seed=Milo', 'https://api.dicebear.com/7.x/avataaars/svg?seed=Leo', 'https://api.dicebear.com/7.x/avataaars/svg?seed=Cooper'] },
    { id: 'robot', label: '🤖', stickers: ['https://api.dicebear.com/7.x/bottts/svg?seed=R2', 'https://api.dicebear.com/7.x/bottts/svg?seed=C3', 'https://api.dicebear.com/7.x/bottts/svg?seed=BB8', 'https://api.dicebear.com/7.x/bottts/svg?seed=WallE'] }
  ];

  const sampleGifs = [
    { id: 1, url: 'https://media0.giphy.com/media/v1.Y2lkPTc5MGI3NjExNHJqZ3RqZ3JqZ3JqZ3JqZ3JqZ3JqZ3JqZ3JqZ3JqZ3JqJmZpbnM9MSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/3o7TKMGpx9YJb3r9p6/giphy.gif', title: 'Hello' },
    { id: 2, url: 'https://media2.giphy.com/media/v1.Y2lkPTc5MGI3NjExNHJqZ3RqZ3JqZ3JqZ3JqZ3JqZ3JqZ3JqZ3JqZ3JqZ3JqJmZpbnM9MSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/l41lTfuxNf64YQ13O/giphy.gif', title: 'Wow' },
    { id: 3, url: 'https://media1.giphy.com/media/v1.Y2lkPTc5MGI3NjExNHJqZ3RqZ3JqZ3JqZ3JqZ3JqZ3JqZ3JqZ3JqZ3JqZ3JqJmZpbnM9MSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/3o7TKVUn7iM8FMEU24/giphy.gif', title: 'Happy' }
  ];

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    if (tabId === 'emoji') setActiveCategory('smileys');
    else if (tabId === 'sticker') setActiveCategory('bunny');
  };

  const handleEmojiClick = (e, emoji) => {
    e.preventDefault();
    e.stopPropagation();
    setText(prev => prev + emoji);
    setTimeout(() => textInputRef.current?.focus(), 0);
  };

  const handleSend = async (e, customContent = null, customType = null) => {
    if (e) e.preventDefault();
    const finalContent = customContent !== null ? customContent : text.trim();
    const finalType = customType !== null ? customType : 'TEXT';

    if (!finalContent && attachments.length === 0) return;

    let type = finalType;
    let finalAttachments = [...attachments];

    if (customType === 'IMAGE' || customType === 'STICKER') {
      type = customType;
      if (customContent && !finalAttachments.includes(customContent)) {
        finalAttachments = [customContent];
      }
    } else if (customType === null && attachments.length > 0) {
      const firstUrl = attachments[0].toLowerCase();
      if (firstUrl.match(/\.(jpeg|jpg|gif|png|webp|svg)/i)) type = 'IMAGE';
      else if (firstUrl.match(/\.(mp4|webm|ogg)/i)) type = 'VIDEO';
      else type = 'FILE';
    }

    const messageContent = (type === 'IMAGE' && customContent !== null) ? '' : finalContent;

    const optimisticMsg = {
      content: messageContent,
      senderId: user?.userId || user?.id,
      mediaUrls: localAttachments.length > 0 ? localAttachments.map(a => a.blobUrl) : finalAttachments,
      type: type,
      status: 'SENDING',
      createdAt: Date.now(),
      replyTo: replyingTo ? { messageId: replyingTo.messageId, content: replyingTo.content, senderName: replyingTo.senderName } : null
    };

    dispatch(addOptimisticMessage({ conversationId, message: optimisticMsg }));
    sendMessage(conversationId, messageContent, type, finalAttachments, replyingTo?.messageId);

    if (replyingTo) onCancelReply();
    if (typingTimeoutRef.current) { clearTimeout(typingTimeoutRef.current); typingTimeoutRef.current = null; }
    sendTyping(conversationId, false);

    if (customContent === null) setText('');
    if (customType === null) {
      setAttachments([]);
      setLocalAttachments([]);
    }
    setShowEmojis(false);
    setSuggestions([]);
  };

  const handleVoiceStart = async () => {
    try {
      await startRecording();
      setShowEmojis(false);
    } catch (err) {
      console.error('Failed to start voice recording:', err);
      alert(err?.message || 'Không thể bắt đầu ghi âm');
    }
  };

  const handleVoiceStop = async () => {
    try {
      setIsVoiceUploading(true);
      const audioFile = await stopRecording();
      const response = await chatApi.uploadVoiceMessage(audioFile);
      const voiceUrl = response?.data?.url || response?.url;

      if (voiceUrl) {
        const optimisticMsg = {
          content: voiceUrl,
          senderId: user?.userId || user?.id,
          mediaUrls: [voiceUrl],
          type: 'VOICE',
          status: 'SENDING',
          createdAt: Date.now(),
          replyTo: replyingTo ? { messageId: replyingTo.messageId, content: replyingTo.content, senderName: replyingTo.senderName } : null
        };

        dispatch(addOptimisticMessage({ conversationId, message: optimisticMsg }));
        sendMessage(conversationId, voiceUrl, 'VOICE', [voiceUrl], replyingTo?.messageId);

        if (replyingTo) onCancelReply();
        setText('');
        setAttachments([]);
        setLocalAttachments([]);
        setSuggestions([]);
        setShowEmojis(false);
      }
    } catch (err) {
      console.error('Failed to send voice message:', err);
      cancelRecording();
      alert('Failed to send voice message: ' + (err?.message || 'Unknown error'));
    } finally {
      setIsVoiceUploading(false);
    }
  };

  const handleVoiceToggle = async () => {
    if (isVoiceUploading) return;
    if (isRecording) {
      await handleVoiceStop();
    } else {
      await handleVoiceStart();
    }
  };

  const handleVoiceCancel = () => {
    if (isRecording) {
      cancelRecording();
    }
  };

  const handleInputChange = (e) => {
    const newValue = e.target.value;
    setText(newValue);
    if (newValue.trim().length > 0) {
      if (!typingTimeoutRef.current) sendTyping(conversationId, true);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => { sendTyping(conversationId, false); typingTimeoutRef.current = null; }, 3000);
    } else {
      if (typingTimeoutRef.current) { clearTimeout(typingTimeoutRef.current); typingTimeoutRef.current = null; sendTyping(conversationId, false); }
    }
  };

  const fetchSuggestions = async () => {
    if (!conversationId) return;
    setSuggestionsLoading(true);
    try {
      const res = await chatApi.getSmartReplies(conversationId);
      const filtered = (res.data.suggestions || [])
        .map(s => s.replace(/^\d+\.\s*/, '').replace(/^-\s*/, '').trim())
        .filter(s => s.length > 0 && s.length < 50)
        .slice(0, 3);
      setSuggestions(filtered);
    } catch (err) {
      console.error("Failed to fetch suggestions:", err);
    } finally {
      setSuggestionsLoading(false);
    }
  };

  React.useEffect(() => {
    if (conversationId) {
      setSuggestions([]);
      // Small delay to let messages load
      const timer = setTimeout(fetchSuggestions, 2000);
      return () => clearTimeout(timer);
    }
  }, [conversationId]);

  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    const maxFiles = 10;
    const currentCount = localAttachments.length;
    let filesToProcess = files;

    if (currentCount + files.length > maxFiles) {
      alert(`Bạn chỉ có thể gửi tối đa ${maxFiles} tập tin một lần.`);
      filesToProcess = files.slice(0, maxFiles - currentCount);
    }

    if (filesToProcess.length === 0) return;

    // Create local previews immediately
    const newLocals = filesToProcess.map(file => ({
      file,
      blobUrl: URL.createObjectURL(file)
    }));
    setLocalAttachments(prev => [...prev, ...newLocals]);

    setIsUploading(true);
    try {
      for (const local of newLocals) {
        const response = await chatApi.uploadMedia(local.file);
        const url = response.data?.url || response.url;
        if (url) setAttachments(prev => [...prev, url]);
      }
    } catch (err) {
      console.error("Upload failed", err);
    } finally {
      setIsUploading(false);
    }
  };

  const removeAttachment = (index) => {
    setLocalAttachments(prev => {
      const item = prev[index];
      if (item) URL.revokeObjectURL(item.blobUrl);
      return prev.filter((_, i) => i !== index);
    });
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  // Check for blocks or restrictions
  const renderInputArea = () => {
    const currentConv = conversations.find(c => c.conversationId === conversationId);
    if (!currentConv) return null;

    // 1. Single chat block check
    if (currentConv.type === 'SINGLE' && !currentConv.isAI) {
      const otherMember = currentConv.members?.find(m => {
        const mId = String(m.userId || m.id || '').toLowerCase();
        const uId = String(user?.userId || user?.id || '').toLowerCase();
        return mId !== '' && mId !== uId;
      });

      const isBlocked = Array.isArray(friends) && friends.some(f => {
        const fId = String(f.userId || f.id || f.friendId || '').toLowerCase();
        const mId = String(otherMember?.userId || otherMember?.id || '').toLowerCase();
        return fId !== '' && fId === mId && f.status === 'BLOCKED';
      });

      if (isBlocked) {
        return (
          <div className="flex items-center justify-center space-x-3 p-4 bg-red-50/50 dark:bg-red-500/5 rounded-[32px] border border-red-500/10 animate-pulse">
            <ShieldAlert className="text-red-500" size={20} />
            <span className="text-sm font-bold text-red-600 dark:text-red-400 uppercase tracking-wider">
              Bạn không thể gửi tin nhắn cho người này
            </span>
          </div>
        );
      }
    }

    // 2. Group chat restriction check
    if (currentConv.type === 'GROUP' && currentConv.onlyAdminsCanChat) {
      const myId = String(user?.userId || user?.id || '').toLowerCase();
      const myMemberInfo = currentConv.members?.find(m => String(m.userId || m.id || '').toLowerCase() === myId);
      const isAdmin = myMemberInfo?.role === 'OWNER' || myMemberInfo?.role === 'ADMIN';

      if (!isAdmin) {
        return (
          <div className="flex items-center justify-center space-x-3 p-4 bg-indigo-50/50 dark:bg-indigo-500/5 rounded-[32px] border border-indigo-500/10">
            <ShieldAlert className="text-indigo-500" size={20} />
            <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">
              Chỉ Quản trị viên mới có quyền gửi tin nhắn
            </span>
          </div>
        );
      }
    }

    // 3. Normal input area
    return (
      <form onSubmit={handleSend} className="flex items-center space-x-1.5 sm:space-x-4 bg-background p-2 sm:p-2.5 pr-2 sm:pr-4 rounded-[40px] shadow-2xl shadow-indigo-500/5 dark:shadow-black/40 border border-border relative z-10 group focus-within:ring-4 focus-within:ring-indigo-500/10 transition-all">
        <button
          type="button"
          onClick={onOpenVoteModal}
          className="p-3 text-foreground/40 hover:text-indigo-500 hover:bg-indigo-500/10 rounded-2xl transition-all active:scale-95 group relative"
        >
          <BarChart2 size={24} />
          <span className="absolute -top-10 left-1/2 -translate-x-1/2 px-2 py-1 bg-surface-200 text-[10px] font-bold rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap border border-border shadow-xl pointer-events-none">
            Bình chọn
          </span>
        </button>

        <button type="button" onClick={() => fileInputRef.current?.click()} className="p-3 text-foreground/40 hover:text-indigo-500 hover:bg-indigo-500/10 rounded-2xl transition-all active:scale-95 group relative">
          <Paperclip size={20} className={isUploading ? 'animate-spin' : ''} />
        </button>
        <input type="file" ref={fileInputRef} className="hidden" multiple onChange={handleFileChange} />
        <div className="w-[1px] h-8 bg-border hidden sm:block" />
        <textarea
          ref={textInputRef}
          className="flex-1 bg-transparent border-none outline-none text-foreground text-sm sm:text-[16px] placeholder:text-foreground/30 px-1 sm:px-2 font-bold tracking-tight min-w-0 resize-none py-2 max-h-32 no-scrollbar overflow-y-auto"
          placeholder={isUploading ? "Đang đồng bộ tập tin..." : "Soạn tin nhắn..."}
          value={text}
          onChange={(e) => {
            handleInputChange(e);
            e.target.style.height = 'auto';
            e.target.style.height = `${e.target.scrollHeight}px`;
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend(e);
            }
          }}
          rows={1}
          disabled={isUploading}
        />
        <div className="flex items-center space-x-1 sm:space-x-2">
          <button
            type="button"
            onClick={handleVoiceToggle}
            disabled={isUploading || isVoiceUploading}
            className={`w-10 h-10 flex items-center justify-center transition-all rounded-full active:scale-90 focus:outline-none ${isRecording ? 'text-white bg-rose-500 shadow-lg shadow-rose-500/30' : 'text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10'} ${(isUploading || isVoiceUploading) ? 'opacity-50 cursor-not-allowed' : ''}`}
            title={isRecording ? `Dừng ghi âm ${durationFormatted}` : 'Ghi âm'}
          >
            {isVoiceUploading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : isRecording ? (
              <Square size={18} fill="currentColor" />
            ) : (
              <Mic size={20} />
            )}
          </button>
          {isRecording && (
            <div className="flex items-center gap-2 rounded-full border border-rose-500/20 bg-rose-500/10 px-3 py-1.5 text-rose-600 dark:text-rose-300">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-500 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-rose-500" />
              </span>
              <span className="text-[11px] font-black uppercase tracking-widest whitespace-nowrap">
                {durationFormatted}
              </span>
              <button
                type="button"
                onClick={handleVoiceCancel}
                className="ml-1 rounded-full bg-rose-500/15 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-rose-600 hover:bg-rose-500/25 transition-colors"
              >
                Hủy
              </button>
            </div>
          )}
          <button type="button" onClick={() => setShowEmojis(!showEmojis)} className={`w-10 h-10 flex items-center justify-center transition-all rounded-full active:scale-90 focus:outline-none ${showEmojis ? 'text-white bg-indigo-500 shadow-lg shadow-indigo-500/30' : 'text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-500/10'}`}><Smile size={20} /></button>
          <button type="submit" disabled={(!text.trim() && attachments.length === 0) || isUploading} className={`w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center rounded-full transition-all flex-shrink-0 focus:outline-none ${(text.trim() || attachments.length > 0) && !isUploading ? 'bg-indigo-600 dark:bg-indigo-500 text-white shadow-xl shadow-indigo-500/40 scale-100 hover:scale-110 active:scale-90' : 'bg-slate-100 dark:bg-slate-800 text-slate-300 dark:text-slate-700 scale-95 cursor-not-allowed opacity-50'}`}><Send size={20} fill="currentColor" /></button>
        </div>
      </form>
    );
  };

  return (
    <div className="relative animate-msg z-50">
      {/* Attachments Preview */}
      {localAttachments.length > 0 && (
        <div className="absolute bottom-full mb-4 left-0 right-0 flex space-x-3 p-4 glass-premium rounded-[26px] shadow-2xl z-[100] overflow-x-auto no-scrollbar border-indigo-500/10 dark:border-indigo-500/20">
          {localAttachments.map((item, i) => (
            <div key={i} className="relative group flex-shrink-0">
              {item.file.type.startsWith('image/') ? (
                <img src={item.blobUrl} className="h-20 w-20 rounded-2xl object-cover border-2 border-white dark:border-slate-800 shadow-lg" alt="" />
              ) : (
                <div className="h-20 w-20 rounded-2xl bg-indigo-500/10 border-2 border-white dark:border-slate-800 shadow-lg flex flex-col items-center justify-center text-indigo-500 relative px-2">
                  <FileText size={20} />
                  <span className="text-[9px] font-black uppercase mt-0.5">{item.file.name.split('.').pop()}</span>
                  <div className="absolute bottom-1 left-1 right-1">
                    <p className="text-[8px] font-bold text-center truncate text-indigo-400/80 px-1 leading-tight">
                      {item.file.name}
                    </p>
                  </div>
                </div>
              )}
              <button onClick={() => removeAttachment(i)} className="absolute -top-2 -right-2 p-1.5 bg-red-500 text-white rounded-xl shadow-lg opacity-0 group-hover:opacity-100 transition-all hover:scale-110 active:scale-95">
                <X size={12} />
              </button>
            </div>
          ))}
          {isUploading && (
            <div className="h-20 w-20 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center border-2 border-dashed border-indigo-200 dark:border-indigo-500/20">
              <Loader2 size={24} className="text-indigo-400 animate-spin" />
            </div>
          )}
        </div>
      )}

      {/* Universal Multi-Picker */}
      {showEmojis && (
        <div className="absolute bottom-full mb-6 left-0 glass-premium shadow-[0_20px_60px_rgba(0,0,0,0.4)] rounded-[32px] overflow-hidden z-50 animate-msg w-[350px] sm:w-[420px] border border-white/10 dark:border-indigo-500/10 flex flex-col max-h-[500px]">
          <div className="flex bg-white/10 dark:bg-black/20 border-b border-white/5 p-1.5">
            {[
              { id: 'sticker', label: 'STICKER', icon: <Sticker size={16} /> },
              { id: 'emoji', label: 'EMOJI', icon: <Smile size={16} /> },
              { id: 'gif', label: 'GIF', icon: <ImageIconLucide size={16} /> }
            ].map(tab => (
              <button key={tab.id} type="button" onClick={() => handleTabChange(tab.id)} className={`flex-1 py-3 flex items-center justify-center space-x-2 rounded-2xl transition-all font-black text-[11px] tracking-widest ${activeTab === tab.id ? 'bg-indigo-600 dark:bg-indigo-500 text-white shadow-lg' : 'text-slate-400 hover:bg-white/5'}`}>
                {tab.icon} <span>{tab.label}</span>
              </button>
            ))}
          </div>

          <div className="px-4 py-3 bg-white/5">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="text" placeholder={`Search ${activeTab}...`} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-black/10 dark:bg-white/5 border-none rounded-xl py-2 pl-9 pr-4 text-xs text-foreground placeholder:text-slate-500 focus:ring-2 focus:ring-indigo-500/20" />
            </div>
          </div>

          <div className="overflow-y-auto no-scrollbar bg-white/5 dark:bg-black/10 min-h-[300px]">
            {activeTab === 'emoji' && (
              <div className="p-4 grid grid-cols-7 sm:grid-cols-9 gap-1">
                {(emojiCategories.find(c => c.id === activeCategory) || emojiCategories[0]).emojis
                  .filter(e => searchTerm === '' || e.includes(searchTerm))
                  .map((emoji, i) => (
                    <button key={`${emoji}-${i}`} type="button" onClick={(e) => handleEmojiClick(e, emoji)} className="text-2xl hover:bg-white/20 p-2 rounded-2xl transition-all hover:scale-125 active:scale-90">{emoji}</button>
                  ))}
              </div>
            )}

            {activeTab === 'sticker' && (
              <div className="p-4 grid grid-cols-3 gap-3">
                {(stickerSets.find(s => s.id === activeCategory) || stickerSets[0]).stickers
                  .filter(s => searchTerm === '' || s.toLowerCase().includes(searchTerm.toLowerCase()))
                  .map((url, i) => (
                    <button key={i} type="button" onClick={() => handleSend(null, url, 'STICKER')} className="group relative h-24 w-24 bg-white/5 rounded-2xl overflow-hidden hover:bg-indigo-500/10 transition-all hover:scale-110 active:scale-95 flex items-center justify-center p-2">
                      <img src={url} alt="sticker" className="h-full w-full object-contain" />
                    </button>
                  ))}
              </div>
            )}

            {activeTab === 'gif' && (
              <div className="p-4 grid grid-cols-2 gap-2">
                {sampleGifs.filter(g => searchTerm === '' || g.title.toLowerCase().includes(searchTerm.toLowerCase())).map(gif => (
                  <button key={gif.id} type="button" onClick={() => handleSend(null, gif.url, 'IMAGE')} className="group relative h-32 rounded-2xl overflow-hidden border border-white/5 hover:border-indigo-500/30 transition-all">
                    <img src={gif.url} alt="gif" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="p-2 bg-white/10 dark:bg-black/30 border-t border-white/5 flex items-center justify-center space-x-1">
            {(activeTab === 'emoji' ? emojiCategories : stickerSets).map(cat => (
              <button key={cat.id} type="button" onClick={() => setActiveCategory(cat.id)} className={`w-9 h-9 flex items-center justify-center rounded-xl transition-all ${activeCategory === cat.id ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-white/5'}`}>
                <span className="text-lg">{cat.label}</span>
              </button>
            ))}
            <div className="flex-1" />
            <button onClick={() => setShowEmojis(false)} type="button" className="p-2 text-slate-400 hover:text-red-500 transition-colors"><X size={18} /></button>
          </div>
        </div>
      )}

      {/* Reply Preview Bar */}
      {replyingTo && (
        <div className="absolute bottom-full mb-3 left-0 right-0 glass-premium p-3 rounded-[24px] border border-indigo-500/20 shadow-xl flex items-center justify-between animate-msg z-20">
          <div className="flex items-center space-x-3 overflow-hidden">
            <div className="w-1 h-8 bg-indigo-500 rounded-full flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.1em] mb-0.5">
                Đang trả lời {(() => {
                  const repliedId = String(replyingTo.senderId || '');
                  const myId = String(user?.userId || user?.id || '');
                  if (repliedId === myId) return 'Bạn';

                  const currentConv = conversations.find(c => c.conversationId === conversationId);
                  const freshMember = currentConv?.members?.find(m => String(m.userId || m.id) === repliedId);
                  return freshMember?.fullName || freshMember?.name || replyingTo.senderName;
                })()}
              </p>
              <p className="text-[13px] text-foreground/60 truncate font-semibold">{replyingTo.content || '[Attachment]'}</p>
            </div>
          </div>
          <button onClick={onCancelReply} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-all"><X size={18} /></button>
        </div>
      )}

      {/* AI Smart Replies */}
      {suggestions.length > 0 && !text.trim() && attachments.length === 0 && (
        <div className="absolute bottom-full mb-3 left-0 right-0 flex items-center space-x-2 px-4 overflow-x-auto no-scrollbar animate-fade-in-up pb-1">
          <div className="flex-shrink-0 p-1.5 bg-indigo-500/10 text-indigo-400 rounded-lg mr-1">
             <SparklesIcon size={12} className="animate-pulse" />
          </div>
          {suggestions.map((suggestion, i) => (
            <button
              key={i}
              type="button"
              onClick={() => handleSend(null, suggestion, 'TEXT')}
              className="flex-shrink-0 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 text-[13px] font-bold text-slate-800 dark:text-slate-200 rounded-2xl transition-all shadow-md whitespace-nowrap active:scale-95"
            >
              {suggestion}
            </button>
          ))}
          <button 
            type="button"
            onClick={() => setSuggestions([])}
            className="p-1.5 text-foreground/20 hover:text-red-500 transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Blocked Notification or Message Input */}
      {renderInputArea()}
    </div>
  );
};

export default MessageInput;
