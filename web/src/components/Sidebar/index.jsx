import React from 'react';

const Sidebar = ({ conversations, onSelect, activeId }) => {
  return (
    <div className="flex flex-col h-full">
      {conversations.length === 0 ? (
        <div className="p-12 text-center space-y-2">
          <p className="text-[10px] font-mono font-black uppercase tracking-[0.3em] text-cursor-dark/20">Empty Channel</p>
        </div>
      ) : (
        conversations.map((conv) => (
          <div
            key={conv.conversationId}
            onClick={() => onSelect(conv.conversationId)}
            className={`px-6 py-5 cursor-pointer flex items-center space-x-4 transition-all duration-300 relative group border-b border-gray-50/50 ${
              activeId === conv.conversationId ? 'bg-surface-200' : 'hover:bg-surface-100'
            }`}
          >
            {activeId === conv.conversationId && (
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-12 bg-cursor-dark rounded-r-full shadow-[0_0_15px_rgba(5,5,7,0.1)]" />
            )}
            
            <div className="relative">
               <div className="h-14 w-14 rounded-[22px] bg-surface-300 border border-black/[0.03] flex-shrink-0 flex items-center justify-center overflow-hidden shadow-sm group-hover:scale-105 transition-transform">
                {conv.avatar ? (
                  <img src={conv.avatar} alt={conv.name} className="h-full w-full object-cover" />
                ) : (
                  <span className="text-xl font-black text-cursor-dark/10 font-serif italic truncate p-1">
                    {conv.name?.charAt(0) || conv.displayName?.charAt(0) || 'C'}
                  </span>
                )}
               </div>
               <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-white border-4 border-white flex items-center justify-center">
                  <div className="w-full h-full rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]" />
               </div>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-baseline mb-1">
                <h3 className={`text-sm font-black tracking-tight truncate ${activeId === conv.conversationId ? 'text-cursor-dark' : 'text-cursor-dark/70'}`}>
                  {conv.name || conv.displayName || 'Untitled Stream'}
                </h3>
                {conv.lastMessageTime && (
                  <span className="text-[9px] font-mono font-black uppercase tracking-wider text-cursor-dark/30">
                    {new Date(conv.lastMessageTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>
              <p className="text-[12px] text-cursor-dark/40 font-medium truncate leading-tight">
                {conv.lastMessage || 'Channel established... standby.'}
              </p>
            </div>
          </div>
        ))
      )}
    </div>
  );
};

export default Sidebar;
