import React, { useEffect, useState } from 'react';
import { useChat } from '../../hooks/useChat';
import { useAuth } from '../../hooks/useAuth';
import Sidebar from '../../components/Sidebar';
import ChatWindow from '../../components/ChatWindow';
import { MessageSquare, Bell, Users, Settings, LogOut, Search, Plus, User } from 'lucide-react';

const Chat = () => {
  const { user, logout } = useAuth();
  const { 
    conversations, 
    activeConversationId, 
    fetchConversations, 
    selectConversation,
    loading 
  } = useChat();

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  return (
    <div className="flex h-screen bg-white overflow-hidden font-sans">
      {/* 1. Global Icon Sidebar (Leftmost) */}
      <div className="w-[72px] flex-shrink-0 bg-cursor-dark flex flex-col items-center py-6 space-y-8 z-50">
        <div className="w-12 h-12 rounded-2xl bg-white/10 p-0.5 border border-white/5 hover:scale-105 transition-transform cursor-pointer overflow-hidden">
          {user?.avatar ? (
            <img src={user.avatar} alt="" className="w-full h-full object-cover rounded-2xl" />
          ) : (
            <div className="w-full h-full bg-surface-400 flex items-center justify-center rounded-2x">
               <User className="text-cursor-dark/40" size={24} />
            </div>
          )}
        </div>

        <nav className="flex flex-col space-y-4 flex-1">
          <button className="p-3 bg-white/10 text-white rounded-2xl shadow-lg shadow-white/5 group relative">
            <MessageSquare size={24} />
            <div className="absolute left-full ml-4 px-2 py-1 bg-cursor-dark text-[10px] text-white rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none uppercase tracking-widest font-mono">Messages</div>
          </button>
          <button className="p-3 text-white/40 hover:text-white hover:bg-white/5 rounded-2xl transition-all group relative">
            <Bell size={24} />
          </button>
          <button className="p-3 text-white/40 hover:text-white hover:bg-white/5 rounded-2xl transition-all group relative">
            <Users size={24} />
          </button>
          <button className="p-3 text-white/40 hover:text-white hover:bg-white/5 rounded-2xl transition-all group relative">
            <Settings size={24} />
          </button>
        </nav>

        <button 
          onClick={logout}
          className="p-3 text-white/40 hover:text-red-400 hover:bg-red-400/10 rounded-2xl transition-all"
        >
          <LogOut size={24} />
        </button>
      </div>

      {/* 2. Conversation Sidebar (Middle) */}
      <div className="w-[360px] flex-shrink-0 bg-white border-r border-gray-100 flex flex-col">
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
             <h1 className="text-2xl font-black text-cursor-dark tracking-tighter">Messages</h1>
             <button className="p-2 hover:bg-gray-100 rounded-xl text-cursor-dark/40 transition-colors">
               <Plus size={20} />
             </button>
          </div>
          
          <div className="relative group">
            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-white/40 group-focus-within:text-cursor-accent transition-colors" />
            </div>
            <input
              type="text"
              placeholder="Search conversations..."
              className="w-full pl-12 pr-4 py-3.5 bg-cursor-dark text-white text-sm rounded-2xl focus:outline-none transition-all placeholder:text-white/20 font-mono"
            />
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto no-scrollbar">
          {loading ? (
            <div className="p-8 text-center text-[10px] font-mono font-black uppercase tracking-[0.3em] text-cursor-dark/20 animate-pulse">
              Syncing signal hubs...
            </div>
          ) : (
            <Sidebar 
              conversations={conversations} 
              onSelect={selectConversation}
              activeId={activeConversationId}
            />
          )}
        </div>
      </div>

      {/* 3. Main Chat Area (Right) */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#fdfdfd] relative">
        {activeConversationId ? (
          <ChatWindow conversationId={activeConversationId} />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-cursor-dark/10 p-12">
            <div className="relative mb-8">
              <div className="absolute inset-0 bg-cursor-accent/5 blur-3xl rounded-full scale-150" />
              <div className="relative w-32 h-32 bg-white border border-cursor-dark/[0.03] rounded-[40px] shadow-2xl flex items-center justify-center">
                <MessageSquare className="text-cursor-dark/5" size={64} />
              </div>
            </div>
            <h3 className="text-2xl font-black text-cursor-dark tracking-tighter mb-2">Establish Connection</h3>
            <p className="max-w-xs text-center text-sm text-cursor-dark/30 font-medium leading-relaxed">
              Select a secure communication channel from the sidebar to begin broadcasting.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Chat;
