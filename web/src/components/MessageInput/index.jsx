import React, { useState, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useWebSocket } from '../../hooks/useWebSocket';
import { Send, Plus, Smile, Paperclip, ImageIcon, X, Loader2 } from 'lucide-react';
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

  const commonEmojis = ['😊', '😂', '😍', '👍', '🙏', '🔥', '❤', '🎉', '👋', '🤔'];

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

    // Dispatch locally immediately for zero latency
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
    <div className="relative animate-slide-up">
       {/* Attachments Preview */}
       {attachments.length > 0 && (
         <div className="absolute bottom-full mb-4 left-0 right-0 flex space-x-3 p-4 bg-white/80 backdrop-blur-xl rounded-[26px] border border-slate-100 shadow-2xl z-50 overflow-x-auto no-scrollbar">
            {attachments.map((url, i) => (
              <div key={i} className="relative group flex-shrink-0">
                <img src={url} className="h-16 w-16 rounded-xl object-cover border border-slate-200" alt="" />
                <button 
                  onClick={() => removeAttachment(url)}
                  className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X size={10} />
                </button>
              </div>
            ))}
            {isUploading && (
              <div className="h-16 w-16 rounded-xl bg-slate-100 flex items-center justify-center animate-pulse">
                <Loader2 size={20} className="text-indigo-400 animate-spin" />
              </div>
            )}
         </div>
       )}

       {/* Emoji Picker */}
       {showEmojis && (
         <div className="absolute bottom-full mb-4 left-0 bg-white rounded-2xl shadow-2xl border border-slate-100 p-3 grid grid-cols-5 gap-2 z-50 animate-slide-up">
            {commonEmojis.map(emoji => (
              <button 
                key={emoji}
                onClick={() => { setText(prev => prev + emoji); setShowEmojis(false); }}
                className="text-xl hover:bg-slate-50 p-2 rounded-xl transition-colors"
              >
                {emoji}
              </button>
            ))}
         </div>
       )}
       
       <form 
        onSubmit={handleSend} 
        className="flex items-center space-x-4 bg-white p-3 pr-4 rounded-[32px] shadow-xl shadow-slate-200/50 border border-slate-100 relative z-10 group focus-within:ring-4 focus-within:ring-indigo-500/10 transition-all"
      >
        <button 
          type="button" 
          onClick={() => fileInputRef.current?.click()}
          className="p-3 text-slate-400 hover:text-indigo-500 hover:bg-slate-50 rounded-2xl transition-all"
        >
          <Plus size={20} />
        </button>
        <input 
          type="file" 
          ref={fileInputRef} 
          className="hidden" 
          multiple 
          onChange={handleFileChange} 
        />
        
        <div className="w-[1px] h-6 bg-slate-100" />
        
        <input
          type="text"
          className="flex-1 bg-transparent border-none outline-none text-slate-700 text-[15px] placeholder:text-slate-400 px-2 font-medium"
          placeholder={isUploading ? "Uploading files..." : "Write a message..."}
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={isUploading}
        />

        <div className="flex items-center space-x-1">
          <button 
            type="button" 
            onClick={() => setShowEmojis(!showEmojis)}
            className={`p-2.5 transition-colors rounded-xl ${showEmojis ? 'text-indigo-500 bg-indigo-50' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <Smile size={20} />
          </button>
          <button 
            type="button" 
            onClick={() => fileInputRef.current?.click()}
            className="p-2.5 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <Paperclip size={20} />
          </button>
          
          <button
            type="submit"
            disabled={(!text.trim() && attachments.length === 0) || isUploading}
            className={`p-3.5 rounded-2xl transition-all flex items-center justify-center ${
              (text.trim() || attachments.length > 0) && !isUploading
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200/50 scale-100 hover:scale-105 active:scale-95' 
                : 'bg-slate-100 text-slate-300 scale-95 cursor-not-allowed'
            }`}
          >
            {isUploading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
          </button>
        </div>
      </form>
    </div>
  );
};

export default MessageInput;
