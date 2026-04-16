import React, { useEffect } from 'react';
import { useChat } from '../../hooks/useChat';
import MessageList from '../MessageList';
import MessageInput from '../MessageInput';
import { Phone, Video, Info, MoreVertical, ShieldCheck } from 'lucide-react';

const ChatWindow = ({ conversationId }) => {
  const { messages, fetchMessages, loading, conversations } = useChat();
  const currentConv = conversations.find(c => c.conversationId === conversationId);

  useEffect(() => {
    if (conversationId) {
      fetchMessages(conversationId);
    }
  }, [conversationId, fetchMessages]);

  return (
    <div className="flex flex-col h-full bg-white relative">
      {/* Header - High-end White variant */}
      <div className="h-24 px-8 border-b border-gray-100 bg-white/80 backdrop-blur-xl flex items-center justify-between z-30 sticky top-0">
        <div className="flex items-center space-x-5">
          <div className="relative">
             <div className="h-14 w-14 rounded-[22px] bg-surface-200 border border-cursor-dark/5 flex items-center justify-center overflow-hidden shadow-lg shadow-black/5">
              {currentConv?.avatar ? (
                <img src={currentConv.avatar} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-xl font-black text-cursor-dark/10 font-serif italic uppercase">
                  {currentConv?.name?.charAt(0) || currentConv?.displayName?.charAt(0) || 'C'}
                </span>
              )}
             </div>
             <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-white border-4 border-white flex items-center justify-center">
                <div className="w-full h-full rounded-full bg-green-500" />
             </div>
          </div>
          <div>
            <h2 className="text-xl font-black text-cursor-dark tracking-tighter leading-none mb-1.5 flex items-center space-x-2">
              <span>{currentConv?.name || currentConv?.displayName || 'Signal Hub'}</span>
              <ShieldCheck size={16} className="text-cursor-accent" />
            </h2>
            <div className="flex items-center space-x-2">
               <span className="text-[10px] font-mono font-black uppercase tracking-[0.2em] text-green-500">Node Active</span>
               <span className="w-1 h-1 rounded-full bg-cursor-dark/10" />
               <span className="text-[10px] font-mono font-black uppercase tracking-[0.2em] text-cursor-dark/20 text-xs">E2E Encrypted</span>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <div className="flex items-center bg-surface-200 p-1.5 rounded-2xl border border-cursor-dark/5">
            <button className="p-3 hover:bg-white hover:text-cursor-dark text-cursor-dark/40 rounded-xl transition-all shadow-sm hover:shadow-md">
              <Phone size={20} />
            </button>
            <button className="p-3 hover:bg-white hover:text-cursor-dark text-cursor-dark/40 rounded-xl transition-all shadow-sm hover:shadow-md">
              <Video size={20} />
            </button>
          </div>
          <div className="w-[1px] h-8 bg-cursor-dark/10 mx-2" />
          <button className="p-3 hover:bg-surface-200 text-cursor-dark/40 rounded-xl transition-all">
            <Info size={20} />
          </button>
          <button className="p-3 hover:bg-surface-200 text-cursor-dark/40 rounded-xl transition-all">
            <MoreVertical size={20} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 min-h-0 bg-[#fbfbfb]">
        <MessageList messages={messages[conversationId] || []} loading={loading} />
      </div>

      {/* Input - Floated dark bar variant */}
      <div className="p-8 pt-4 bg-[#fbfbfb]">
        <MessageInput conversationId={conversationId} />
      </div>
    </div>
  );
};

export default ChatWindow;
