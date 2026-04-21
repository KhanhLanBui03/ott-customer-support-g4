import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { useChat } from '../../hooks/useChat';
import MessageList from '../MessageList';
import MessageInput from '../MessageInput';
import { chatApi } from '../../api/chatApi';
import { Phone, Video, Info, MoreVertical, ShieldCheck, Pin, X, ChevronDown, ChevronUp, Trash2, UserPlus, ArrowLeft, Stars as SparklesIcon } from 'lucide-react';

const ChatWindow = ({ conversation, onStartCall, onToggleInfo, isInfoOpen, onBack }) => {
  const conversationId = conversation?.conversationId;
  const { messages, fetchMessages, fetchConversations, messagesLoading, conversations } = useChat();
  const { user } = useSelector(state => state.auth);
  const [showPinsDropdown, setShowPinsDropdown] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const currentConv = conversation || conversations.find(c => c.conversationId === conversationId);

  // Find the other member for status display in single chats
  const currentMember = currentConv?.members?.find(m => m.userId !== (user?.userId || user?.id));

  const formatLastSeen = (status, lastSeenAt) => {
    if (status === 'ONLINE') return 'Online';
    if (!lastSeenAt) return 'Offline';
    const now = Date.now();
    const diff = Math.floor((now - lastSeenAt) / 1000); // seconds
    if (diff < 60) return 'Active just now';
    if (diff < 3600) return `Active ${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `Active ${Math.floor(diff / 3600)}h ago`;
    return `Active ${Math.floor(diff / 86400)}d ago`;
  };

  const handleDeleteConversation = async () => {
    if (window.confirm('Xóa cuộc trò chuyện này? Bạn sẽ không thể xem lại tin nhắn cũ.')) {
      try {
        await chatApi.deleteConversation(conversationId);
        fetchConversations(); // Update list and clear active
        if (onBack) onBack(); // Go back or clear selection without reload
      } catch (err) {
        console.error("Failed to delete conversation", err);
      }
    }
  };

  const scrollToMessage = (messageId) => {
    const element = document.getElementById(`msg-${messageId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Temporary highlight effect
      element.classList.add('bg-indigo-50/50');
      setTimeout(() => element.classList.remove('bg-indigo-50/50'), 2000);
    }
  };

  useEffect(() => {
    if (conversationId) {
      fetchMessages(conversationId);
      setShowPinsDropdown(false); // Reset dropdown when switching convs
      setShowMoreMenu(false);
    }
  }, [conversationId, fetchMessages]);

  return (
    <div className="flex-1 flex flex-col h-full bg-background transition-colors overflow-hidden">
      {/* Header */}
      <div className={`
        ${onBack ? 'h-20 px-4' : 'h-[88px] px-8'} 
        glass-premium flex items-center justify-between z-30 sticky top-0 transition-all
      `}>
        <div className="flex items-center space-x-3 overflow-hidden">
          {onBack && (
            <button 
              onClick={onBack}
              className="p-2 -ml-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
            >
              <ArrowLeft size={20} />
            </button>
          )}
          
          <div className="relative flex-shrink-0">
            <div className={`
              ${onBack ? 'h-10 w-10 rounded-xl' : 'h-14 w-14 rounded-[22px]'} 
              bg-surface-200 border border-cursor-dark/5 flex items-center justify-center overflow-hidden shadow-lg shadow-black/5
            `}>
              {currentConv?.isAI ? (
                <div className="w-full h-full bg-indigo-600 flex items-center justify-center">
                  <SparklesIcon className="text-white" size={onBack ? 20 : 28} />
                </div>
              ) : currentConv?.avatar ? (
                <img src={currentConv.avatar} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className={`${onBack ? 'text-sm' : 'text-xl'} font-black text-cursor-dark/10 font-serif italic uppercase`}>
                  {currentConv?.name?.charAt(0) || 'C'}
                </span>
              )}
            </div>
            {currentMember?.status === 'ONLINE' && (
              <div className={`absolute -bottom-0.5 -right-0.5 ${onBack ? 'w-3.5 h-3.5' : 'w-4.5 h-4.5'} rounded-full bg-background flex items-center justify-center`}>
                <div className="w-full h-full rounded-full bg-emerald-500 status-glow shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
              </div>
            )}
          </div>
          <div className="min-w-0">
            <h2 className={`
              ${onBack ? 'text-base' : 'text-xl'} 
              font-black text-foreground tracking-tighter leading-none mb-1 flex items-center space-x-1.5 truncate
            `}>
              <span className="truncate">{currentConv?.name || 'Signal Hub'}</span>
              {currentConv?.isAI ? (
                <SparklesIcon size={onBack ? 14 : 16} className="text-indigo-500 animate-pulse" />
              ) : (
                <ShieldCheck size={onBack ? 14 : 16} className="text-cursor-accent flex-shrink-0" />
              )}
            </h2>
            <div className="flex items-center space-x-2">
              <span className={`text-[9px] font-mono font-black uppercase tracking-[0.1em] ${currentMember?.status === 'ONLINE' ? 'text-green-500' : 'text-slate-400'}`}>
                {currentMember ? formatLastSeen(currentMember.status, currentMember.lastSeenAt) : 'Node Active'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2 sm:space-x-4">
          <div className="hidden sm:flex items-center bg-surface-200 p-1 rounded-2xl border border-cursor-dark/5">
            <button
              onClick={onStartCall}
              className="p-2.5 hover:bg-white hover:text-cursor-dark text-cursor-dark/40 rounded-xl transition-all shadow-sm"
            >
              <Phone size={18} />
            </button>
            <button
              onClick={onStartCall}
              className="p-2.5 hover:bg-white hover:text-cursor-dark text-cursor-dark/40 rounded-xl transition-all shadow-sm"
            >
              <Video size={18} />
            </button>
          </div>
          
          <button 
            onClick={onToggleInfo}
            className={`p-2.5 rounded-xl transition-all ${isInfoOpen ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-500/10'}`}
          >
            <Info size={20} />
          </button>

          <div className="relative">
            <button
              onClick={() => setShowMoreMenu(!showMoreMenu)}
              className={`p-3 relative z-50 rounded-xl transition-all ${showMoreMenu ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-500/10'}`}
            >
              <MoreVertical size={20} />
            </button>

            {showMoreMenu && (
              <div className="absolute top-full right-0 mt-2 w-64 glass-premium shadow-2xl rounded-[24px] p-2 z-50 animate-msg">
                <button 
                  onClick={() => { onToggleInfo(); setShowMoreMenu(false); }}
                  className="w-full flex items-center space-x-3 px-4 py-3.5 text-[14px] font-bold text-foreground hover:bg-indigo-50 rounded-2xl transition-all"
                >
                  <Info size={18} className="text-indigo-500" />
                  <span>Conversation Info</span>
                </button>
                <div className="h-px bg-border my-1 mx-2" />
                <button
                  onClick={() => { handleDeleteConversation(); setShowMoreMenu(false); }}
                  className="w-full flex items-center space-x-3 px-4 py-3.5 text-[14px] font-bold text-red-500 hover:bg-red-50 rounded-2xl transition-all"
                >
                  <Trash2 size={18} />
                  <span>Delete History</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Pinned Messages Bar */}
      {currentConv?.pinnedMessages && currentConv.pinnedMessages.length > 0 && (
        <div className="relative z-20">
          <div
            onClick={() => setShowPinsDropdown(!showPinsDropdown)}
            className="bg-indigo-500/5 dark:bg-indigo-500/10 backdrop-blur-md border-b border-indigo-500/10 px-8 py-3.5 flex items-center justify-between cursor-pointer hover:bg-indigo-500/10 transition-colors group/pin-bar"
          >
            <div className="flex items-center space-x-4 overflow-hidden flex-1 relative">
              <div className="p-2.5 bg-indigo-500 text-white rounded-xl shadow-lg shadow-indigo-500/20 group-hover/pin-bar:scale-110 transition-transform">
                <Pin size={14} fill="currentColor" />
              </div>
              <div className="flex-1 truncate">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-500 dark:text-indigo-400 leading-tight mb-0.5">
                  {currentConv.pinnedMessages.length} Pinned Messages
                </p>
                <p className="text-[14px] font-bold text-slate-700 dark:text-slate-200 truncate">
                  {currentConv?.pinnedMessages?.[currentConv.pinnedMessages.length - 1]?.content || "Media Attachment"}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-3 ml-4">
              <button
                type="button"
                onClick={async (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const lastPinId = currentConv?.pinnedMessages?.[currentConv.pinnedMessages.length - 1]?.messageId;
                  if (lastPinId) {
                    await chatApi.unpinMessage(conversationId, lastPinId);
                    fetchConversations();
                  }
                }}
                className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Dropdown Content */}
          {showPinsDropdown && (
            <div className="absolute top-full left-0 right-0 glass-premium shadow-2xl max-h-64 overflow-y-auto animate-msg border-t-0">
              {currentConv?.pinnedMessages?.slice(0).reverse().map((pin, i) => (
                <div
                  key={pin.messageId}
                  onClick={() => scrollToMessage(pin.messageId)}
                  className="px-8 py-4 border-b border-indigo-500/5 flex items-center justify-between hover:bg-indigo-500/5 cursor-pointer transition-colors group"
                >
                  <div className="flex-1 min-w-0 pr-4">
                    <p className="text-[9px] font-black uppercase text-indigo-500/60 mb-1 tracking-widest">
                      {pin.senderName || "Member"}
                    </p>
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-300 truncate">
                      {pin.content || "Media Attachment"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={async (e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      await chatApi.unpinMessage(conversationId, pin.messageId);
                      fetchConversations();
                    }}
                    className="p-1.5 opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition-all"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Messages Area */}
      <div className="flex-1 flex flex-col min-h-0 relative">
        <MessageList
          conversations={conversations}
          conversationId={conversationId}
          messages={messages[conversationId] || []}
          loading={messagesLoading}
          onRefresh={fetchConversations}
        />
      </div>

      {/* Input Area */}
      <div className="p-4 sm:p-6 bg-sidebar border-t border-border transition-colors">
        <MessageInput conversationId={conversationId} />
      </div>
    </div>
  );
};

export default ChatWindow;
