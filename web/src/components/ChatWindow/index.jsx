import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { useChat } from '../../hooks/useChat';
import MessageList from '../MessageList';
import MessageInput from '../MessageInput';
import { chatApi } from '../../api/chatApi';
import { Phone, Video, Info, MoreVertical, ShieldCheck, Pin, X, ChevronDown, ChevronUp, Trash2, UserPlus } from 'lucide-react';

const ChatWindow = ({ conversationId, onStartCall, onToggleInfo, isInfoOpen }) => {
  const { messages, fetchMessages, fetchConversations, messagesLoading, conversations } = useChat();
  const { user } = useSelector(state => state.auth);
  const [showPinsDropdown, setShowPinsDropdown] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const currentConv = conversations.find(c => c.conversationId === conversationId);

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
        window.location.reload(); // Refresh to clear active state
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
    <div className="flex flex-col h-full bg-white relative">
      {/* Header */}
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
            {currentMember?.status === 'ONLINE' && (
              <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-white border-4 border-white flex items-center justify-center">
                <div className="w-full h-full rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]" />
              </div>
            )}
          </div>
          <div>
            <h2 className="text-xl font-black text-cursor-dark tracking-tighter leading-none mb-1.5 flex items-center space-x-2">
              <span>{currentConv?.name || currentConv?.displayName || 'Signal Hub'}</span>
              <ShieldCheck size={16} className="text-cursor-accent" />
            </h2>
            <div className="flex items-center space-x-2">
              <span className={`text-[10px] font-mono font-black uppercase tracking-[0.2em] ${currentMember?.status === 'ONLINE' ? 'text-green-500' : 'text-slate-400'}`}>
                {currentMember ? formatLastSeen(currentMember.status, currentMember.lastSeenAt) : 'Node Active'}
              </span>
              <span className="w-1 h-1 rounded-full bg-cursor-dark/10" />
              <span className="text-[10px] font-mono font-black uppercase tracking-[0.2em] text-cursor-dark/20 text-xs">E2E Encrypted</span>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <div className="flex items-center bg-surface-200 p-1.5 rounded-2xl border border-cursor-dark/5">
            <button
              onClick={onStartCall}
              className="p-3 hover:bg-white hover:text-cursor-dark text-cursor-dark/40 rounded-xl transition-all shadow-sm hover:shadow-md"
            >
              <Phone size={20} />
            </button>
            <button
              onClick={onStartCall}
              className="p-3 hover:bg-white hover:text-cursor-dark text-cursor-dark/40 rounded-xl transition-all shadow-sm hover:shadow-md"
            >
              <Video size={20} />
            </button>
          </div>
          <div className="w-[1px] h-8 bg-cursor-dark/10 mx-2" />
          {currentConv?.type === 'GROUP' && (
            <button 
              onClick={onToggleInfo}
              className="p-3 hover:bg-surface-200 text-cursor-dark/40 hover:text-indigo-600 rounded-xl transition-all"
              title="Thêm thành viên"
            >
              <UserPlus size={20} />
            </button>
          )}

          <button 
            onClick={onToggleInfo}
            className={`p-3 rounded-xl transition-all ${isInfoOpen ? 'bg-surface-200 text-cursor-accent' : 'hover:bg-surface-200 text-cursor-dark/40'}`}
          >
            <Info size={20} />
          </button>

          <div className="relative">
            <button
              onClick={() => setShowMoreMenu(!showMoreMenu)}
              className={`p-3 hover:bg-surface-200 rounded-xl transition-all ${showMoreMenu ? 'bg-surface-200 text-cursor-accent' : 'text-cursor-dark/40'}`}
            >
              <MoreVertical size={20} />
            </button>

            {showMoreMenu && (
              <div className="absolute top-full right-0 mt-2 w-56 bg-white/95 backdrop-blur-xl border border-slate-100 shadow-2xl rounded-[24px] p-2 z-50 animate-slide-up">
                <button className="w-full flex items-center space-x-3 px-4 py-3 text-[13px] font-semibold text-slate-700 hover:bg-slate-50 rounded-2xl transition-colors">
                  <Info size={16} className="text-slate-400" />
                  <span>Thông tin hội thoại</span>
                </button>
                <div className="h-px bg-slate-50 my-1 mx-2" />
                <button
                  onClick={handleDeleteConversation}
                  className="w-full flex items-center space-x-3 px-4 py-3 text-[13px] font-semibold text-red-500 hover:bg-red-50 rounded-2xl transition-colors"
                >
                  <Trash2 size={16} />
                  <span>Xóa cuộc trò chuyện</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Pinned Messages Bar with Dropdown Support */}
      {currentConv?.pinnedMessages && currentConv.pinnedMessages.length > 0 && (
        <div className="relative z-20">
          <div
            onClick={() => setShowPinsDropdown(!showPinsDropdown)}
            className="bg-indigo-50/70 backdrop-blur-md border-b border-indigo-100/50 px-8 py-3 flex items-center justify-between cursor-pointer hover:bg-indigo-50 transition-colors"
          >
            <div className="flex items-center space-x-4 overflow-hidden flex-1 relative group/pin">
              <div className="p-2.5 bg-indigo-500 text-white rounded-xl shadow-lg shadow-indigo-200">
                <Pin size={14} fill="currentColor" />
              </div>
              <div className="flex-1 truncate">
                <div className="flex items-center space-x-2">
                  <p className="text-[10px] font-mono font-black uppercase tracking-[0.2em] text-indigo-500/60 leading-tight">
                    {currentConv.pinnedMessages.length} Pinned Messages
                  </p>
                </div>
                <p className="text-[14px] font-bold text-indigo-900 truncate mt-0.5">
                  {currentConv.pinnedMessages[currentConv.pinnedMessages.length - 1].content || "Media Attachment"}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-3 ml-4">
              {currentConv.pinnedMessages.length > 1 && (
                <div className="text-indigo-400 group-hover:text-indigo-600 transition-colors">
                  {showPinsDropdown ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </div>
              )}
              <button
                onClick={async (e) => {
                  e.stopPropagation();
                  const lastPinId = currentConv.pinnedMessages[currentConv.pinnedMessages.length - 1].messageId;
                  await chatApi.unpinMessage(conversationId, lastPinId);
                  fetchConversations();
                }}
                className="p-2 text-indigo-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Dropdown Content */}
          {showPinsDropdown && (
            <div className="absolute top-full left-0 right-0 bg-white/95 backdrop-blur-xl border-b border-indigo-100 shadow-xl max-h-64 overflow-y-auto animate-slide-down">
              {currentConv.pinnedMessages.slice(0).reverse().map((pin, i) => (
                <div
                  key={pin.messageId}
                  onClick={() => scrollToMessage(pin.messageId)}
                  className="px-8 py-4 border-b border-indigo-50 flex items-center justify-between hover:bg-indigo-50/50 cursor-pointer transition-colors group"
                >
                  <div className="flex-1 min-w-0 pr-4">
                    <p className="text-[9px] font-black uppercase text-indigo-400 mb-1 tracking-tight">
                      {pin.senderName || "Member"}
                    </p>
                    <p className="text-sm font-medium text-slate-700 truncate line-clamp-1">
                      {pin.content || "Media Attachment"}
                    </p>
                  </div>
                  <button
                    onClick={async (e) => {
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
      <div className="p-6 bg-white border-t border-gray-100">
        <MessageInput conversationId={conversationId} />
      </div>
    </div>
  );
};

export default ChatWindow;
