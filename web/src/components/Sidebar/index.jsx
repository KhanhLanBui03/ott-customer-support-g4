import React, { useState, useEffect, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { 
  Pin, FolderDown, Tag, Mail, UserPlus, BellOff, EyeOff, Clock, Trash2, AlertTriangle, ChevronRight
} from 'lucide-react';
import { chatApi } from '../../api/chatApi';

const Sidebar = ({ conversations, onSelect, activeId, onContextMenu }) => {
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

  return (
    <div className="flex flex-col h-full bg-slate-50/30 relative">
      {conversations.length === 0 ? (
        <div className="p-12 text-center space-y-2">
          <p className="text-[10px] font-mono font-black uppercase tracking-[0.3em] text-slate-300">Quiet Channel</p>
        </div>
      ) : (
        conversations.map((conv) => {
          const otherMember = conv.type === 'SINGLE' 
            ? conv.members?.find(m => m.userId !== (user?.userId || user?.id)) 
            : null;
          
          const statusText = otherMember 
            ? formatLastSeen(otherMember.status, otherMember.lastSeenAt)
            : '';

          return (
            <div
              key={conv.conversationId}
              onClick={() => onSelect(conv.conversationId)}
              onContextMenu={(e) => onContextMenu(e, conv.conversationId)}
              className={`px-5 py-4 cursor-pointer flex items-center space-x-4 transition-all duration-300 relative group border-b border-slate-100/50 ${
                activeId === conv.conversationId ? 'bg-white shadow-sm z-10' : 'hover:bg-white/50'
              }`}
            >
              <div className="relative">
                 <div className="h-12 w-12 rounded-2xl bg-slate-200 border border-slate-200/50 flex-shrink-0 flex items-center justify-center overflow-hidden shadow-sm group-hover:scale-105 transition-transform duration-500">
                  {conv.avatarUrl ? (
                    <img src={conv.avatarUrl} alt={conv.name} className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-lg font-bold text-slate-400 uppercase">
                      {conv.name?.charAt(0) || 'C'}
                    </span>
                  )}
                 </div>
                 {otherMember?.status === 'ONLINE' && (
                   <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-white flex items-center justify-center">
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)] animate-pulse" />
                   </div>
                 )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline mb-0.5">
                  <h3 className={`text-[14px] font-bold tracking-tight truncate ${activeId === conv.conversationId ? 'text-slate-900' : 'text-slate-700'}`}>
                    {conv.name || 'Untitled'}
                  </h3>
                  {conv.lastMessageTime && (
                    <span className="text-[9px] font-bold text-slate-400 whitespace-nowrap ml-2">
                      {new Date(conv.lastMessageTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>
                
                <div className="flex items-center justify-between">
                  <p className={`text-[12px] truncate leading-tight flex-1 pr-2 ${conv.unreadCount > 0 ? 'text-slate-900 font-bold' : 'text-slate-400 font-medium'}`}>
                    {conv.lastMessage ? (
                      <>
                        {conv.lastMessageSenderId === (user?.userId || user?.id) && (
                          <span className="text-indigo-400/80 mr-1 font-bold">You:</span>
                        )}
                        {conv.lastMessage}
                      </>
                    ) : (
                      statusText || 'Direct Channel Established'
                    )}
                  </p>
                  
                  {conv.unreadCount > 0 && (
                    <div className="min-w-[18px] h-[18px] px-1 bg-red-500 rounded-full flex items-center justify-center shadow-lg shadow-red-200 animate-bounce">
                      <span className="text-[9px] font-bold text-white">
                        {conv.unreadCount > 5 ? '5+' : conv.unreadCount}
                      </span>
                    </div>
                  )}
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
