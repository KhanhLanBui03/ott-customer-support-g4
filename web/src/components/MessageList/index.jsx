import React, { useRef, useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { PhoneOff, Shield, CheckCheck, Clock, MoreHorizontal, Reply, Trash2, Pin, Image as ImageIcon, FileText, Download } from 'lucide-react';
import { chatApi } from '../../api/chatApi';
import { recallMessage, removeMessage } from '../../store/chatSlice';

const MessageList = ({ messages, loading, conversationId, onRefresh }) => {
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
  const dispatch = useDispatch();
  const { user } = useSelector(state => state.auth);
  const [activeMenu, setActiveMenu] = useState(null);

  useEffect(() => {
    const scrollToBottom = (instant = false) => {
      if (scrollRef.current) {
        scrollRef.current.scrollTo({
          top: scrollRef.current.scrollHeight,
          behavior: instant ? 'instant' : 'smooth'
        });
      }
    };

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

  const handleAction = async (action, messageId) => {
    try {
      if (action === 'RECALL') {
        const promise = chatApi.recallMessage(conversationId, messageId);
        dispatch(recallMessage({ conversationId, messageId }));
        await promise;
      } else if (action === 'DELETE_ME') {
        const promise = chatApi.deleteMessage(conversationId, messageId);
        dispatch(removeMessage({ conversationId, messageId }));
        await promise;
      } else if (action === 'PIN') {
        await chatApi.pinMessage(conversationId, messageId);
        if (onRefresh) onRefresh();
      }
      setActiveMenu(null);
    } catch (err) {
      console.error("Action failed", err);
    }
  };

  if (!Array.isArray(messages)) {
    return (
      <div className="flex-1 flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
      </div>
    );
  }

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
    <div 
      ref={scrollRef}
      className="flex-1 h-full overflow-y-auto p-6 space-y-4 pb-32"
    >
      {messages.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-12 border-2 border-dashed border-slate-100 rounded-[40px]">
          <Shield size={32} className="text-slate-100 mb-4" />
          <p className="text-[10px] font-mono font-black uppercase tracking-[0.4em] text-slate-300 text-center">
            Zero messages detected<br />Channel is secure
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
          const isSystem = msg.type === 'SYSTEM' || msg.status === 'RECALLED';
          const isRecalled = msg.isRecalled;

          if (showDateHeader) {
            const dateLabel = msgDate;

            dateHeader = (
              <div key={`header-${timestamp}`} className="flex justify-center my-8 first:mt-0">
                <div className="px-5 py-1.5 bg-slate-50/80 backdrop-blur-sm rounded-full border border-slate-100 shadow-sm">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">{dateLabel}</span>
                </div>
              </div>
            );
          }

          return (
            <React.Fragment key={msg.messageId || index}>
              {dateHeader}
              <div
                id={`msg-${msg.messageId}`}
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} group animate-fade-in relative mb-3 last:mb-0`}
              >
                <div className={`flex items-start max-w-[80%] space-x-3 ${isMe ? 'flex-row-reverse space-x-reverse' : ''}`}>
                  {!isMe && (
                    <div className="w-8 h-8 rounded-xl bg-slate-100 flex-shrink-0 mt-1 overflow-hidden border border-slate-200/50 shadow-sm">
                      {msg.senderAvatar && <img src={msg.senderAvatar} className="w-full h-full object-cover" />}
                    </div>
                  )}

                  <div className="space-y-1 relative group/bubble">
                    {isRecalled ? (
                      <div className="px-5 py-3 bg-slate-50 text-slate-400 rounded-[20px] border border-slate-200/50 flex items-center space-x-3 italic">
                        <Trash2 size={14} className="opacity-50" />
                        <small>Message recalled</small>
                      </div>
                    ) : isCall ? (
                      <div className="px-6 py-4 bg-white text-slate-700 rounded-[24px] shadow-sm flex items-center space-x-4 border border-slate-100 group-hover:scale-[1.01] transition-transform">
                        <div className="p-3 bg-red-50 text-red-500 rounded-full">
                          <PhoneOff size={18} />
                        </div>
                        <div>
                          <p className="text-[9px] font-mono font-bold uppercase tracking-[0.2em] text-red-500/60 mb-0.5">Call Activity</p>
                          <p className="text-sm font-bold tracking-tight">{msg.content}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="relative">
                        <div className={`absolute top-0 ${isMe ? '-left-10' : '-right-10'} opacity-0 group-hover/bubble:opacity-100 transition-opacity`}>
                          <button
                            onClick={() => setActiveMenu(activeMenu === msg.messageId ? null : msg.messageId)}
                            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400"
                          >
                            <MoreHorizontal size={16} />
                          </button>
                        </div>

                        {activeMenu === msg.messageId && (
                          <div className={`absolute bottom-full mb-2 ${isMe ? 'right-0' : 'left-0'} w-44 bg-white rounded-2xl shadow-2xl border border-slate-100 p-1.5 z-[100] animate-slide-up`}>
                            <button className="w-full flex items-center space-x-3 px-3 py-2 text-[13px] font-medium text-slate-600 hover:bg-slate-50 rounded-xl transition-colors">
                              <Reply size={16} /> <span>Trả lời</span>
                            </button>
                            <button
                              onClick={() => handleAction('PIN', msg.messageId)}
                              className="w-full flex items-center space-x-3 px-3 py-2 text-[13px] font-medium text-slate-600 hover:bg-slate-50 rounded-xl transition-colors"
                            >
                              <Pin size={16} /> <span>Ghim tin nhắn</span>
                            </button>
                            <button 
                              onClick={() => handleAction('DELETE_ME', msg.messageId)}
                              className="w-full flex items-center space-x-3 px-3 py-2 text-[13px] font-medium text-slate-600 hover:bg-slate-50 rounded-xl transition-colors"
                            >
                              <Trash2 size={16} className="text-slate-400" /> <span>Xóa phía tôi</span>
                            </button>
                            <div className="h-px bg-slate-50 my-1" />
                            {isMe && (
                              <button
                                onClick={() => handleAction('RECALL', msg.messageId)}
                                className="w-full flex items-center space-x-3 px-3 py-2 text-[13px] font-medium text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                              >
                                <Trash2 size={16} /> <span>Thu hồi</span>
                              </button>
                            )}
                          </div>
                        )}

                        <div className={`px-5 py-3.5 rounded-[26px] shadow-sm border ${isMe
                            ? 'bg-indigo-600 border-indigo-500 text-white rounded-tr-none'
                            : 'bg-white border-slate-100 text-slate-700 rounded-tl-none'
                          }`}>
                          {msg.content && <p className="text-[14.5px] leading-relaxed font-medium mb-2 last:mb-0">{msg.content}</p>}
                          
                          {/* Media Rendering */}
                          {msg.mediaUrls && msg.mediaUrls.length > 0 && (
                            <div className={`grid gap-2 mt-2 ${msg.mediaUrls.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                              {msg.mediaUrls.map((url, idx) => {
                                const isImage = url.match(/\.(jpeg|jpg|gif|png|webp|svg)/i);
                                const isVideo = url.match(/\.(mp4|webm|ogg)/i);
                                
                                if (isImage) {
                                  return (
                                    <div key={idx} className="rounded-xl overflow-hidden border border-white/10 shadow-lg">
                                      <img src={url} alt="" className="max-w-full h-auto cursor-pointer hover:scale-[1.02] transition-transform" onClick={() => window.open(url, '_blank')} />
                                    </div>
                                  );
                                } else if (isVideo) {
                                  return (
                                    <video key={idx} controls className="rounded-xl max-w-full">
                                      <source src={url} />
                                    </video>
                                  );
                                } else {
                                  return (
                                    <a key={idx} href={url} target="_blank" rel="noopener noreferrer" className={`flex items-center space-x-3 p-3 rounded-xl border ${isMe ? 'bg-white/10 border-white/20' : 'bg-slate-50 border-slate-100'}`}>
                                       <div className={`p-2 rounded-lg ${isMe ? 'bg-white text-indigo-600' : 'bg-indigo-50 text-indigo-500'}`}>
                                          <FileText size={18} />
                                       </div>
                                       <div className="flex-1 min-w-0">
                                          <p className="text-xs font-bold truncate">{url.split('/').pop()}</p>
                                          <p className="text-[9px] font-black uppercase tracking-tighter opacity-60">Tải tệp tin</p>
                                       </div>
                                       <Download size={16} className="opacity-40" />
                                    </a>
                                  );
                                }
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className={`flex items-center space-x-2 mt-1.5 ${isMe ? 'flex-row-reverse space-x-reverse mr-2' : 'ml-12'}`}>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                    {formatMessageTime(msg.createdAt)}
                  </span>
                  {isMe && (
                    <div className="flex items-center">
                      <CheckCheck size={12} className="text-indigo-400" />
                    </div>
                  )}
                </div>
              </div>
            </React.Fragment>
          );
        })
      )}
      <div ref={bottomRef} className="h-px w-full clear-both" />
    </div>
  );
};

export default MessageList;
