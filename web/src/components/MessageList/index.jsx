import React, { useRef, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { PhoneOff, Shield, CheckCheck, Clock } from 'lucide-react';

const MessageList = ({ messages, loading }) => {
  const scrollRef = useRef();
  const { user } = useSelector(state => state.auth);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  if (loading && messages.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex items-center space-x-3 text-[10px] font-mono font-black uppercase tracking-[0.4em] text-cursor-dark/20">
           <div className="w-4 h-4 rounded-full border-2 border-t-transparent border-cursor-dark/10 animate-spin" />
           <span>Syncing Nodes...</span>
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={scrollRef}
      className="flex flex-col h-full overflow-y-auto p-12 space-y-8 no-scrollbar"
    >
      {messages.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-12 border-2 border-dashed border-cursor-dark/5 rounded-[40px]">
           <Shield size={32} className="text-cursor-dark/10 mb-4" />
           <p className="text-[10px] font-mono font-black uppercase tracking-[0.4em] text-cursor-dark/20 text-center">
             Zero messages detected<br/>Channel is secure
           </p>
        </div>
      ) : (
        messages.map((msg, index) => {
          const isMe = msg.senderId === user?.id;
          const isCall = msg.type === 'CALL_LOG' || msg.content?.includes('Call');
          const isSystem = msg.type === 'SYSTEM' || msg.status === 'RECALLED';

          return (
            <div
              key={msg.messageId || index}
              className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} group animate-fade-in`}
            >
              <div
                className={`flex items-start max-w-[80%] space-x-3 ${isMe ? 'flex-row-reverse space-x-reverse' : ''}`}
              >
                {!isMe && (
                  <div className="w-8 h-8 rounded-xl bg-surface-300 flex-shrink-0 mt-1 overflow-hidden border border-cursor-dark/5">
                     {msg.senderAvatar ? <img src={msg.senderAvatar} className="w-full h-full object-cover" /> : null}
                  </div>
                )}
                
                <div className="space-y-1">
                   {isCall ? (
                     <div className="px-6 py-4 bg-cursor-dark text-white rounded-[28px] shadow-2xl flex items-center space-x-4 border border-white/10 group-hover:scale-[1.02] transition-transform">
                        <div className="p-3 bg-red-500/20 text-red-500 rounded-full">
                           <PhoneOff size={20} />
                        </div>
                        <div>
                           <p className="text-[10px] font-mono font-black uppercase tracking-widest opacity-50 mb-0.5">Termination</p>
                           <p className="text-sm font-black tracking-tight">{msg.content}</p>
                        </div>
                     </div>
                   ) : isSystem ? (
                     <div className="px-6 py-4 bg-cursor-dark text-white/40 rounded-[28px] border border-white/5 flex items-center space-x-3 italic">
                        <p className="text-[11px] font-mono font-black uppercase tracking-[0.2em]">{msg.content || 'Message Recalled'}</p>
                     </div>
                   ) : (
                     <div
                        className={`px-6 py-4 rounded-[30px] text-[15px] font-medium leading-relaxed shadow-sm transition-all ${
                          isMe
                            ? 'bg-cursor-dark text-white rounded-br-none shadow-xl shadow-black/10'
                            : 'bg-white text-cursor-dark border border-cursor-dark/5 rounded-bl-none'
                        }`}
                      >
                        {msg.content}
                      </div>
                   )}
                   
                   <div className={`flex items-center space-x-2 px-3 mt-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
                      <span className="text-[9px] font-mono font-black uppercase tracking-wider text-cursor-dark/20">
                         {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '00:00'}
                      </span>
                      {isMe && (
                        <div className="text-cursor-accent">
                           {msg.status === 'READ' ? <CheckCheck size={12} /> : <Clock size={12} className="opacity-30" />}
                        </div>
                      )}
                   </div>
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
};

export default MessageList;
