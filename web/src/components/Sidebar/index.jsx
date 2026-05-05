import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import { 
  Pin, Trash2, MoreHorizontal, Users
} from 'lucide-react';
import GroupAvatar from '../GroupAvatar';

const Sidebar = ({ conversations, onSelect, activeId, onContextMenu, onTogglePin, onDelete, onUpdateTag }) => {
  const { user } = useSelector(state => state.auth);
  const [tagMenuId, setTagMenuId] = useState(null);

  const isAudioUrl = (value) => typeof value === 'string' && /\.(mp3|m4a|webm|wav|ogg|opus)(\?|$)/i.test(value);

  const getPreviewText = (conv) => {
    const raw = String(conv?.lastMessage || '').trim();
    if (!raw) return '';

    // Handle recalled messages
    if (raw === '[Tin nhắn đã bị thu hồi]') return raw;

    // Handle call JSON
    if (raw.startsWith('{') && raw.includes('callType')) {
      try {
        const data = JSON.parse(raw);
        return data.callType === 'video' ? '[Cuộc gọi video]' : '[Cuộc gọi thoại]';
      } catch (e) {
        // Fallback to raw if parsing fails
      }
    }

    // Handle URLs
    if (raw.startsWith('http://') || raw.startsWith('https://')) {
      if (isAudioUrl(raw)) return '[Tin nhắn thoại]';
      return '[Đính kèm]';
    }

    // Handle explicit tags
    const tags = ['attachment', 'đính kèm', 'file', 'tin nhắn thoại', 'cuộc gọi video', 'cuộc gọi thoại'];
    if (tags.some(tag => raw.toLowerCase() === `[${tag}]`)) {
      return raw;
    }

    return raw;
  };

  const TAGS = [
    { key: 'customer', label: 'Khách hàng', color: 'bg-red-500' },
    { key: 'family', label: 'Gia đình', color: 'bg-emerald-500' },
    { key: 'work', label: 'Công việc', color: 'bg-orange-500' },
    { key: 'friends', label: 'Bạn bè', color: 'bg-purple-500' },
    { key: 'later', label: 'Trả lời sau', color: 'bg-yellow-500' },
    { key: 'colleague', label: 'Đồng nghiệp', color: 'bg-blue-500' }
  ];

  const formatLastSeen = (status, lastSeenAt) => {
    if (status === 'ONLINE') return 'Online';
    if (!lastSeenAt) return 'Offline';

    const now = Date.now();
    const diff = Math.floor((now - lastSeenAt) / 1000);

    if (diff < 60) return 'Vừa mới truy cập';
    if (diff < 3600) {
      const mins = Math.floor(diff / 60);
      return `Hoạt động ${mins} phút trước`;
    }
    if (diff < 86400) {
      const hours = Math.floor(diff / 3600);
      return `Hoạt động ${hours} giờ trước`;
    }
    const days = Math.floor(diff / 86400);
    return `Hoạt động ${days} ngày trước`;
  };

  const sortedConversations = [...conversations].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    const timeA = a.lastMessageTime || a.updatedAt || 0;
    const timeB = b.lastMessageTime || b.updatedAt || 0;
    return timeB - timeA;
  });

  return (
    <div className="flex flex-col h-full bg-sidebar transition-colors relative">
      {sortedConversations.length === 0 ? (
        <div className="p-12 text-center space-y-2">
          <p className="text-[10px] font-mono font-black uppercase tracking-[0.3em] text-foreground/40">Chưa có hội thoại</p>
        </div>
      ) : (
        sortedConversations.map((conv) => {
          const otherMember = conv.type === 'SINGLE' 
            ? conv.members?.find(m => m.userId !== (user?.userId || user?.id)) 
            : null;
          
          const statusText = otherMember 
            ? formatLastSeen(otherMember.status, otherMember.lastSeenAt)
            : '';

          const isActive = activeId === conv.conversationId;
          const currentTag = TAGS.find(t => t.key === conv.tag);

          return (
            <div
              key={conv.conversationId}
              onClick={() => onSelect(conv.conversationId)}
              onContextMenu={(e) => onContextMenu(e, conv.conversationId)}
              className={`px-5 py-4 cursor-pointer flex items-center space-x-4 transition-all duration-300 relative group border-b border-border/40 ${
                isActive 
                  ? 'bg-surface-200 shadow-sm z-10' 
                  : conv.isPinned ? 'bg-slate-50/50 dark:bg-white/5' : 'hover:bg-surface-100/50'
              }`}
            >
              {isActive && (
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500 rounded-r-full shadow-[0_0_10px_rgba(99,102,241,0.5)]" />
              )}
              
              <div className="relative flex-shrink-0">
                 <GroupAvatar 
                   conversation={conv} 
                   size="h-13 w-13" 
                   isActive={isActive} 
                 />
                 {otherMember?.status === 'ONLINE' && (
                   <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-background flex items-center justify-center">
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 status-glow shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                   </div>
                 )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline mb-0.5">
                  <h3 className={`text-[15px] tracking-tight truncate ${isActive ? 'text-indigo-700 dark:text-indigo-300' : 'text-foreground'} ${conv.unreadCount > 0 ? 'font-black' : 'font-bold'}`}>
                    {conv.type === 'SINGLE' 
                      ? (otherMember?.fullName || otherMember?.name || conv.name || 'Người dùng')
                      : (conv.name || 'Nhóm chat')}
                  </h3>
                  <div className="flex items-center space-x-1.5 ml-2">
                    {conv.lastMessageTime && (
                      <span className={`text-[10px] font-bold whitespace-nowrap uppercase tracking-tighter ${isActive ? 'text-indigo-500/70 dark:text-indigo-300/50' : 'text-foreground/40'}`}>
                        {new Date(conv.lastMessageTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                    {conv.isPinned && (
                      <Pin size={12} className="text-indigo-500 fill-indigo-500" />
                    )}
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className={`text-[13px] truncate leading-tight flex-1 pr-2 flex items-center ${conv.unreadCount > 0 ? 'text-indigo-500 dark:text-indigo-400 font-bold' : 'text-foreground/60 font-medium'}`}>

                    {/* Tag Indicator at start of message line */}
                    <div className="relative mr-2 flex-shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setTagMenuId(tagMenuId === conv.conversationId ? null : conv.conversationId);
                        }}
                        className={`w-3.5 h-3.5 rounded-md rotate-45 transition-all hover:scale-125 border-2 ${conv.tag ? `${currentTag?.color} border-transparent shadow-sm` : 'border-foreground/10 hover:border-indigo-500/40 bg-transparent'}`}
                        style={{ clipPath: 'polygon(0% 0%, 75% 0%, 100% 50%, 75% 100%, 0% 100%)' }}
                        title="Phân loại"
                      />

                      {tagMenuId === conv.conversationId && (
                        <>
                          <div className="fixed inset-0 z-[60]" onClick={() => setTagMenuId(null)} />
                          <div
                             className="absolute left-0 top-full mt-2 w-48 border border-border dark:border-white/10 shadow-2xl rounded-xl py-1.5 z-[70] animate-in fade-in slide-in-from-top-2 duration-200"
                             style={{ backgroundColor: !document.documentElement.classList.contains('dark') ? '#ffffff' : '#1e2330' }}
                           >
                             <div className="px-3 py-1 mb-1 border-b border-border/40">
                               <p className="text-[9px] font-bold uppercase text-foreground/40 tracking-widest">Gán nhãn phân loại</p>
                             </div>
                             {TAGS.map(tag => (
                               <button
                                 key={tag.key}
                                 onClick={(e) => {
                                   e.stopPropagation();
                                   onUpdateTag(conv.conversationId, tag.key);
                                   setTagMenuId(null);
                                 }}
                                 className="w-full flex items-center space-x-3 px-3 py-1.5 hover:bg-foreground/5 dark:hover:bg-white/5 transition-colors text-left"
                               >
                                 <div className={`w-3 h-3 ${tag.color} rounded-sm rotate-45`} style={{ clipPath: 'polygon(0% 0%, 75% 0%, 100% 50%, 75% 100%, 0% 100%)' }} />
                                 <span className={`text-[12px] font-semibold ${conv.tag === tag.key ? 'text-indigo-500' : 'text-slate-700 dark:text-white/80'}`}>{tag.label}</span>
                               </button>
                             ))}
                             {conv.tag && (
                               <button
                                 onClick={(e) => {
                                   e.stopPropagation();
                                   onUpdateTag(conv.conversationId, null);
                                   setTagMenuId(null);
                                 }}
                                 className="w-full flex items-center space-x-3 px-3 py-1.5 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors text-left border-t border-border/40 mt-1"
                               >
                                 <Trash2 size={12} className="text-red-500" />
                                 <span className="text-[12px] font-semibold text-red-500">Gỡ nhãn</span>
                               </button>
                             )}
                          </div>
                        </>
                      )}
                    </div>

                    <div className="truncate">
                      {conv.lastMessage ? (
                        <>
                          {conv.lastMessageSenderId === (user?.userId || user?.id) ? (
                            <span className="text-indigo-500 dark:text-indigo-400/70 mr-1 font-bold">Bạn:</span>
                          ) : conv.type === 'GROUP' && conv.lastMessageSenderName ? (
                            <span className="text-foreground/50 mr-1 font-bold">{conv.lastMessageSenderName.split(' ').pop()}:</span>
                          ) : null}
                          {getPreviewText(conv)}
                        </>
                      ) : (
                        <span className="italic text-foreground/30 text-[11px] font-bold">{statusText || 'Bắt đầu trò chuyện...'}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 flex-shrink-0">
                    {conv.unreadCount > 0 && (
                      <div className="min-w-[18px] h-[18px] px-1 bg-red-500 text-white rounded-full flex items-center justify-center shadow-lg shadow-red-500/30">
                        <span className="text-[9px] font-bold leading-none">
                          {conv.unreadCount > 9 ? '9+' : conv.unreadCount}
                        </span>
                      </div>
                    )}

                    <div className="hidden group-hover:flex items-center ml-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onContextMenu(e, conv.conversationId);
                        }}
                        className="p-1.5 hover:bg-surface-200 rounded-lg transition-all text-foreground/40 hover:text-indigo-500"
                      >
                        <MoreHorizontal size={18} />
                      </button>
                    </div>
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

export default Sidebar;
