import React, { useState, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useWebSocket } from '../../hooks/useWebSocket';
import { Send, Plus, Smile, Paperclip, ImageIcon, X, Loader2, FileText, Download } from 'lucide-react';
import { chatApi } from '../../api/chatApi';
import { addOptimisticMessage } from '../../store/chatSlice';

const MessageInput = ({ conversationId }) => {
  const [text, setText] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [showEmojis, setShowEmojis] = useState(false);
  const { sendMessage } = useWebSocket();
  const dispatch = useDispatch();
  const { user } = useSelector(state => state.auth);
  const fileInputRef = useRef();

  const commonEmojis = [
    '😊', '😂', '🤣', '😍', '😘', '🥰', '😋', '😎',
    '🤔', '🤨', '🙄', '😏', '😴', '🤤', '🥳', '🤩',
    '😭', '😱', '😡', '🤡', '💀', '👻', '💩', '👽',
    '👍', '👎', '👌', '✌', '🤞', '👋', '🙌', '👏',
    '🙏', '🤝', '🔥', '💯', '❤', '🧡', '✨', '⭐',
    '🎉', '🎂', '🎁', '🚀', '☕', '🍔', '🍕', '💡'
  ];

  const handleSend = async (e) => {
    if (e) e.preventDefault();
    if (!text.trim() && attachments.length === 0) return;

    let type = 'TEXT';
    if (attachments.length > 0) {
      const firstUrl = attachments[0].toLowerCase();
      if (firstUrl.match(/\.(jpeg|jpg|gif|png|webp|svg)/i)) {
        type = 'IMAGE';
      } else if (firstUrl.match(/\.(mp4|webm|ogg)/i)) {
        type = 'VIDEO';
      } else {
        type = 'FILE';
      }
    }

    const optimisticMsg = {
      content: text.trim(),
      senderId: user?.userId || user?.id,
      mediaUrls: attachments,
      type: type,
      createdAt: Date.now()
    };

    dispatch(addOptimisticMessage({ conversationId, message: optimisticMsg }));
    sendMessage(conversationId, text.trim(), type, attachments);
    
    setText('');
    setAttachments([]);
  };

  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setIsUploading(true);
    try {
      for (const file of files) {
        const response = await chatApi.uploadMedia(file);
        const url = response.data?.url || response.url;
        if (url) {
          setAttachments(prev => [...prev, url]);
        }
      }
    } catch (err) {
      console.error("Upload failed", err);
    } finally {
      setIsUploading(false);
    }
  };

  const removeAttachment = (url) => {
    setAttachments(prev => prev.filter(a => a !== url));
  };

  return (
    <div className="relative animate-msg">
       {/* Attachments Preview */}
       {attachments.length > 0 && (
         <div className="absolute bottom-full mb-4 left-0 right-0 flex space-x-3 p-4 glass-premium rounded-[26px] shadow-2xl z-50 overflow-x-auto no-scrollbar border-indigo-500/10 dark:border-indigo-500/20">
            {attachments.map((url, i) => (
              <div key={i} className="relative group flex-shrink-0">
                <img src={url} className="h-20 w-20 rounded-2xl object-cover border-2 border-white dark:border-slate-800 shadow-lg" alt="" />
                <button 
                  onClick={() => removeAttachment(url)}
                  className="absolute -top-2 -right-2 p-1.5 bg-red-500 text-white rounded-xl shadow-lg opacity-0 group-hover:opacity-100 transition-all hover:scale-110 active:scale-95"
                >
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

       {/* Emoji Picker */}
       {showEmojis && (
         <div className="absolute bottom-full mb-4 left-0 glass-premium shadow-2xl p-3 grid grid-cols-8 gap-0.5 z-50 animate-msg max-w-xs border-indigo-500/10">
            {commonEmojis.map(emoji => (
              <button 
                key={emoji}
                type="button"
                onClick={() => { setText(prev => prev + emoji); setShowEmojis(false); }}
                className="text-xl hover:bg-indigo-50 dark:hover:bg-indigo-500/20 p-2.5 rounded-xl transition-all hover:scale-125 hover:rotate-6 active:scale-90"
              >
                {emoji}
              </button>
            ))}
         </div>
       )}
       
       <form 
        onSubmit={handleSend} 
        className="flex items-center space-x-1.5 sm:space-x-4 bg-background p-2 sm:p-2.5 pr-2 sm:pr-4 rounded-[40px] shadow-2xl shadow-indigo-500/5 dark:shadow-black/40 border border-border relative z-10 group focus-within:ring-4 focus-within:ring-indigo-500/10 transition-all"
      >
        <button 
          type="button" 
          onClick={() => fileInputRef.current?.click()}
          className="p-3 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-[22px] transition-all active:scale-90"
        >
          <Paperclip size={20} className={isUploading ? 'animate-spin' : ''} />
        </button>
        <input 
          type="file" 
          ref={fileInputRef} 
          className="hidden" 
          multiple 
          onChange={handleFileChange} 
        />
        
        <div className="w-[1px] h-8 bg-border hidden sm:block" />
        
        <input
          type="text"
          className="flex-1 bg-transparent border-none outline-none text-foreground text-sm sm:text-[16px] placeholder:text-foreground/30 px-1 sm:px-2 font-bold tracking-tight min-w-0"
          placeholder={isUploading ? "Syncing files..." : "Say something..."}
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={isUploading}
        />

        <div className="flex items-center space-x-1 sm:space-x-2">
          <button 
            type="button" 
            onClick={() => setShowEmojis(!showEmojis)}
            className={`p-3 transition-all rounded-[22px] active:scale-90 ${showEmojis ? 'text-white bg-indigo-500 shadow-lg shadow-indigo-500/30' : 'text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-500/10'}`}
          >
            <Smile size={20} />
          </button>
          
          <button
            type="submit"
            disabled={(!text.trim() && attachments.length === 0) || isUploading}
            className={`p-3.5 sm:p-4 rounded-[22px] transition-all flex items-center justify-center ${
              (text.trim() || attachments.length > 0) && !isUploading
                ? 'bg-indigo-600 dark:bg-indigo-500 text-white shadow-xl shadow-indigo-500/40 scale-100 hover:scale-110 active:scale-90' 
                : 'bg-slate-100 dark:bg-slate-800 text-slate-300 dark:text-slate-700 scale-95 cursor-not-allowed opacity-50'
            }`}
          >
            {isUploading ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} fill="currentColor" className="transform rotate-0" />}
          </button>
        </div>
      </form>
    </div>
  );
};

export default MessageInput;
