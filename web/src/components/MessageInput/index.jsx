import React, { useState } from 'react';
import { useWebSocket } from '../../hooks/useWebSocket';
import { Send, Plus, Smile, Paperclip, Zap } from 'lucide-react';

const MessageInput = ({ conversationId }) => {
  const [text, setText] = useState('');
  const { sendMessage } = useWebSocket();

  const handleSend = (e) => {
    e.preventDefault();
    if (!text.trim()) return;

    sendMessage(conversationId, text.trim());
    setText('');
  };

  return (
    <div className="relative animate-slide-up">
       {/* Glow effect under the input */}
       <div className="absolute inset-x-8 -bottom-4 h-8 bg-cursor-dark/5 blur-2xl rounded-full" />
       
       <form 
        onSubmit={handleSend} 
        className="flex items-center space-x-4 bg-cursor-dark p-3 pr-4 rounded-[32px] shadow-2xl border border-white/5 relative z-10 group focus-within:ring-4 focus-within:ring-cursor-accent/10 transition-all"
      >
        <button type="button" className="p-3 text-white/30 hover:text-white hover:bg-white/10 rounded-2xl transition-all">
          <Plus size={20} />
        </button>
        
        <div className="w-[1px] h-6 bg-white/10" />
        
        <input
          type="text"
          className="flex-1 bg-transparent border-none outline-none text-white text-[15px] placeholder:text-white/20 px-2 font-medium"
          placeholder="Transmit signal..."
          value={text}
          onChange={(e) => setText(e.target.value)}
        />

        <div className="flex items-center space-x-2">
          <button type="button" className="p-2.5 text-white/20 hover:text-white transition-colors">
            <Smile size={20} />
          </button>
          <button type="button" className="p-2.5 text-white/20 hover:text-white transition-colors">
            <Paperclip size={20} />
          </button>
          
          <button
            type="submit"
            disabled={!text.trim()}
            className={`p-3.5 rounded-2xl transition-all flex items-center justify-center ${
              text.trim() 
                ? 'bg-cursor-accent text-cursor-dark shadow-lg shadow-cursor-accent/20 scale-100 hover:scale-110 active:scale-95' 
                : 'bg-white/5 text-white/20 scale-95 cursor-not-allowed'
            }`}
          >
            {text.trim() ? <Zap size={18} fill="currentColor" /> : <Send size={18} />}
          </button>
        </div>
      </form>
    </div>
  );
};

export default MessageInput;
