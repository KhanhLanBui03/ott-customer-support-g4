import React, { useState, useEffect, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { 
  Pin, FolderDown, Tag, Mail, UserPlus, BellOff, EyeOff, Clock, Trash2, AlertTriangle, ChevronRight, MoreHorizontal
} from 'lucide-react';
import { chatApi } from '../../api/chatApi';
import GroupAvatar from '../GroupAvatar';

const Sidebar = ({ conversations, onSelect, activeId, onContextMenu, onTogglePin, onDelete }) => {
  const { user } = useSelector(state => state.auth);

  const formatLastSeen = (status, lastSeenAt) => {
    if (status === 'ONLINE') return 'Online';
    if (!lastSeenAt) return 'Offline';

    const now = Date.now();
    const diff = Math.floor((now - lastSeenAt) / 1000); // seconds

    if (diff < 60) return 'Last seen just now';
    if (diff < 3600) {
      const mins = Math.floor(diff / 60);
      return `Last seen ${mins}m ago`;
    }
    if (diff < 86400) {
      const hours = Math.floor(diff / 3600);
      return `Last seen ${hours}h ago`;
    }
    const days = Math.floor(diff / 86400);
    return `Last seen ${days}d ago`;
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
          <p className="text-[10px] font-mono font-black uppercase tracking-[0.3em] text-foreground/40">Quiet Channel</p>
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
              
              <div className="relative">
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
                  <h3 className={`text-[15px] font-bold tracking-tight truncate ${isActive ? 'text-indigo-700 dark:text-indigo-300' : 'text-foreground'}`}>
                    {conv.name || 'Untitled'}
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
                  <p className={`text-[13px] truncate leading-tight flex-1 pr-2 ${conv.unreadCount > 0 ? 'text-indigo-500 dark:text-indigo-400 font-bold' : 'text-foreground/60 font-medium'}`}>
                    {conv.lastMessage ? (
                      <>
                        {conv.lastMessageSenderId === (user?.userId || user?.id) && (
                          <span className="text-indigo-500 dark:text-indigo-400/70 mr-1 font-bold">You:</span>
                        )}
                        {conv.lastMessage}
                      </>
                    ) : (
                      <span className="italic text-foreground/30 text-[11px] font-bold">{statusText || 'Establishing Link...'}</span>
                    )}
                  </p>
                  
                  <div className="flex items-center">
                    {conv.unreadCount > 0 && (
                      <div className="min-w-[18px] h-[18px] px-1 bg-red-500 text-white rounded-full flex items-center justify-center shadow-lg shadow-red-500/30 animate-in zoom-in duration-300">
                        <span className="text-[9px] font-black leading-none">
                          {conv.unreadCount > 9 ? '9+' : conv.unreadCount}
                        </span>
                      </div>
                    )}

                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        onTogglePin(conv.conversationId);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-surface-200 rounded-lg transition-all text-foreground/40 hover:text-indigo-500 shadow-sm border border-transparent hover:border-border/50 bg-background/50 backdrop-blur-sm"
                      title={conv.isPinned ? "Bỏ ghim" : "Ghim"}
                    >
                      <Pin size={16} className={conv.isPinned ? "fill-indigo-500 text-indigo-500" : ""} />
                    </button>

                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        onContextMenu(e, conv.conversationId);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-surface-200 rounded-lg transition-all text-foreground/40 hover:text-indigo-500 ml-1 shadow-sm border border-transparent hover:border-border/50 bg-background/50 backdrop-blur-sm"
                    >
                      <MoreHorizontal size={18} />
                    </button>

                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(conv.conversationId);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-all text-foreground/40 hover:text-red-500 ml-1 shadow-sm border border-transparent hover:border-red-100 bg-background/50 backdrop-blur-sm"
                      title="Xóa hội thoại"
                    >
                      <Trash2 size={16} />
                    </button>
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
