import React, { useRef, useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { PhoneOff, Shield, CheckCheck, Clock, MoreHorizontal, Reply, Trash2, Pin, Image as ImageIcon, FileText, Download } from 'lucide-react';
import { chatApi } from '../../api/chatApi';
import { recallMessage, removeMessage } from '../../store/chatSlice';

const MessageList = ({ messages, loading, conversationId, onRefresh, conversations }) => {
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
      } else if (action === 'UNPIN') {
        await chatApi.unpinMessage(conversationId, messageId);
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

  const currentConv = conversations?.find(c => c.conversationId === conversationId);
  const pinnedMessages = currentConv?.pinnedMessages || [];
  const pinnedIds = pinnedMessages.map(p => p.messageId);

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
      className="flex-1 h-full overflow-y-auto p-4 sm:p-8 space-y-6 pb-32 bg-background transition-colors no-scrollbar"
    >
      {messages.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-12 border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-[40px] opacity-60">
          <Shield size={32} className="text-slate-200 dark:text-slate-700 mb-4" />
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-300 dark:text-slate-600 text-center">
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
          const isRecalled = msg.isRecalled;
          const isPinned = pinnedIds.includes(msg.messageId);

          if (showDateHeader) {
            dateHeader = (
              <div key={`header-${timestamp}`} className="flex justify-center my-10 first:mt-0">
                <div className="px-6 py-2 bg-white/50 dark:bg-slate-800/50 backdrop-blur-md rounded-full border border-slate-100 dark:border-slate-800 shadow-sm transition-all group hover:scale-105">
                  <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.25em]">{msgDate}</span>
                </div>
              </div>
            );
          }

          return (
            <React.Fragment key={msg.messageId || index}>
              {dateHeader}
              <div
                id={`msg-${msg.messageId}`}
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} group animate-msg relative mb-6 last:mb-0`}
              >
                <div className={`flex items-end max-w-[85%] sm:max-w-[75%] space-x-3 ${isMe ? 'flex-row-reverse space-x-reverse' : ''}`}>
                  {!isMe && (
                    <div className="w-9 h-9 rounded-2xl bg-surface-200 flex-shrink-0 mb-1 overflow-hidden border-2 border-background shadow-md group-hover:scale-110 transition-transform">
                      {msg.senderAvatar ? <img src={msg.senderAvatar} className="w-full h-full object-cover" /> : (
                        <div className="w-full h-full flex items-center justify-center text-foreground/40 font-black italic uppercase text-sm">
                          {msg.senderName?.charAt(0) || '?'}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="space-y-1.5 relative group/bubble">
                    {!isMe && (
                       <p className="text-[10px] font-black text-foreground/40 uppercase tracking-widest ml-1 mb-1">
                          {msg.senderName || 'Member'}
                       </p>
                    )}
                    
                    {isRecalled ? (
                      <div className="px-6 py-3.5 bg-surface-100 text-foreground/40 rounded-[22px] border border-border flex items-center space-x-3 italic">
                        <Trash2 size={14} className="opacity-50" />
                        <span className="text-[13px] font-medium">Message recalled</span>
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
                    ) : (
                      <div className="relative">
                        <div className={`absolute top-0 ${isMe ? '-left-12' : '-right-12'} opacity-0 group-hover/bubble:opacity-100 transition-all transform group-hover/bubble:translate-x-0 ${isMe ? 'translate-x-2' : '-translate-x-2'}`}>
                          <button
                            type="button"
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setActiveMenu(activeMenu === msg.messageId ? null : msg.messageId); }}
                            className="p-2 hover:bg-white dark:hover:bg-slate-800 rounded-xl text-slate-400 dark:text-slate-600 shadow-sm border border-slate-100 dark:border-slate-800 transition-all"
                          >
                            <MoreHorizontal size={18} />
                          </button>
                        </div>

                        {activeMenu === msg.messageId && (
                          <div className={`absolute bottom-full mb-3 ${isMe ? 'right-0' : 'left-0'} w-52 bg-sidebar border border-border shadow-2xl rounded-[24px] p-2 z-[100] animate-msg`}>
                            <button className="w-full flex items-center space-x-3 px-4 py-3 text-[13px] font-bold text-foreground hover:bg-surface-100 rounded-2xl transition-all">
                              <Reply size={18} className="text-indigo-400" /> <span>Trả lời</span>
                            </button>
                            <button
                              type="button"
                              onClick={(e) => { e.preventDefault(); handleAction(isPinned ? 'UNPIN' : 'PIN', msg.messageId); }}
                              className="w-full flex items-center space-x-3 px-4 py-3 text-[13px] font-bold text-foreground hover:bg-surface-100 rounded-2xl transition-all"
                            >
                              <Pin size={18} className={isPinned ? 'text-indigo-500' : 'text-foreground/40'} fill={isPinned ? 'currentColor' : 'none'} /> 
                              <span>{isPinned ? 'Gỡ ghim' : 'Ghim tin nhắn'}</span>
                            </button>
                            <div className="h-px bg-border my-1.5 mx-2" />
                            {isMe && (
                              <button
                                onClick={() => handleAction('RECALL', msg.messageId)}
                                className="w-full flex items-center space-x-3 px-4 py-3 text-[13px] font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-2xl transition-all"
                              >
                                <Trash2 size={18} /> <span>Thu hồi</span>
                              </button>
                            )}
                          </div>
                        )}

                        <div className={`
                          relative overflow-hidden transition-all duration-300
                          ${msg.content ? 'px-6 py-4 shadow-sm' : 'p-0'} 
                          ${isMe
                            ? (msg.content ? 'bg-indigo-600 text-white rounded-[26px] rounded-br-[4px]' : '')
                            : (msg.content ? 'bg-surface-200 text-foreground border border-border rounded-[26px] rounded-bl-[4px]' : '')
                          }
                          ${isPinned ? 'ring-2 ring-indigo-500/30' : ''}
                        `}>
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
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className={`flex items-center space-x-3 mt-2 ${isMe ? 'flex-row-reverse space-x-reverse mr-4' : 'ml-14'}`}>
                  <span className="text-[9px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-widest">
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
      <div ref={bottomRef} className="h-px w-full clear-both" />
    </div>
  );
};

export default MessageList;
