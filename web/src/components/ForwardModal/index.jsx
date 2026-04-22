import { useState, useMemo } from 'react';
import { Search, X, Send, Users, User, Clock } from 'lucide-react';
import { useChat } from '../../hooks/useChat';
import { useWebSocket } from '../../hooks/useWebSocket';
import { useSelector } from 'react-redux';

const cn = (...classes) => classes.filter(Boolean).join(" ");

const ForwardModal = ({ isOpen, onClose, messageToForward }) => {
  const { conversations } = useChat();
  const { sendMessage } = useWebSocket();
  const { user } = useSelector(state => state.auth);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('Gần đây'); // Gần đây, Nhóm trò chuyện, Bạn bè
  const [selectedConvs, setSelectedConvs] = useState([]);
  const [extraMessage, setExtraMessage] = useState('');
  const [sending, setSending] = useState(false);



  const filteredConversations = useMemo(() => {
    let list = Object.values(conversations);
    
    // Sort by last message date (recent first)
    list.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

    if (activeTab === 'Nhóm trò chuyện') {
      list = list.filter(c => c.type === 'GROUP');
    } else if (activeTab === 'Bạn bè') {
      list = list.filter(c => c.type === 'SINGLE');
    }

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      list = list.filter(c => 
        (c.name || '').toLowerCase().includes(term) || 
        (c.lastMessage?.content || '').toLowerCase().includes(term)
      );
    }

    return list;
  }, [conversations, activeTab, searchTerm]);

  const toggleSelect = (convId) => {
    setSelectedConvs(prev => 
      prev.includes(convId) 
        ? prev.filter(id => id !== convId) 
        : [...prev, convId]
    );
  };

  const handleForward = async () => {
    if (selectedConvs.length === 0) return;
    setSending(true);

    try {
      const forwardData = {
        messageId: messageToForward.messageId,
        conversationId: messageToForward.conversationId,
        senderName: messageToForward.senderName
      };

      for (const convId of selectedConvs) {
        // Forward the original message
        await sendMessage(
          convId, 
          messageToForward.content, 
          messageToForward.type, 
          messageToForward.mediaUrls || [], 
          null, // replyTo
          forwardData
        );

        // Send extra message if any
        if (extraMessage.trim()) {
          await sendMessage(convId, extraMessage.trim(), 'TEXT');
        }
      }
      onClose();
    } catch (err) {
      console.error('Forwarding failed:', err);
    } finally {
      setSending(false);
    }
  };

  const getConvName = (conv) => {
    if (conv.type === 'GROUP') return conv.name;
    const otherMember = conv.members?.find(m => (m.userId || m.id) !== user?.id);
    return otherMember?.fullName || conv.name || 'Người dùng Z';
  };

  if (!isOpen || !messageToForward) return null;

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-fade-in">
      <div className="bg-surface-100 w-full max-w-lg rounded-[32px] shadow-2xl border border-white/20 overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-6 flex items-center justify-between border-b border-border">
           <h3 className="text-lg font-black text-foreground uppercase tracking-tight">Chia sẻ</h3>
           <button onClick={onClose} className="p-2 hover:bg-surface-200 rounded-xl transition-all">
              <X size={20} />
           </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto no-scrollbar p-6 space-y-6">
           
           {/* Search */}
           <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-foreground/40" size={18} />
              <input 
                type="text" 
                placeholder="Tìm kiếm..."
                className="w-full pl-12 pr-4 py-3 bg-background border border-border rounded-2xl text-sm focus:outline-none focus:border-indigo-500 transition-all"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
           </div>

           {/* Tabs */}
           <div className="flex space-x-2 border-b border-border pb-1">
              {['Gần đây', 'Nhóm trò chuyện', 'Bạn bè'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    "px-4 py-2 text-[13px] font-bold transition-all border-b-2",
                    activeTab === tab ? "border-indigo-500 text-indigo-500" : "border-transparent text-foreground/40 hover:text-foreground/60"
                  )}
                >
                  {tab}
                </button>
              ))}
           </div>

           {/* List */}
           <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
              {filteredConversations.map(conv => (
                <div 
                  key={conv.conversationId}
                  onClick={() => toggleSelect(conv.conversationId)}
                  className="flex items-center justify-between p-3 rounded-2xl hover:bg-surface-200 cursor-pointer transition-all border border-transparent hover:border-border"
                >
                  <div className="flex items-center space-x-3">
                     <div className="w-10 h-10 bg-indigo-500/10 rounded-xl flex items-center justify-center text-indigo-500">
                        {conv.type === 'GROUP' ? <Users size={20} /> : <User size={20} />}
                     </div>
                     <span className="font-bold text-[14px] text-foreground">{getConvName(conv)}</span>
                  </div>
                  <div className={cn(
                    "w-6 h-6 rounded-[8px] border-2 flex items-center justify-center transition-all",
                    selectedConvs.includes(conv.conversationId) ? "bg-indigo-500 border-indigo-500" : "border-border"
                  )}>
                    {selectedConvs.includes(conv.conversationId) && <X size={14} className="text-white rotate-45" />}
                  </div>
                </div>
              ))}
           </div>

           {/* Preview Box */}
           <div className="bg-surface-200 rounded-2xl p-4 space-y-2">
              <p className="text-[10px] font-black text-foreground/40 uppercase tracking-widest">Chia sẻ tin nhắn</p>
              <div className="p-3 bg-background/50 rounded-xl border border-border">
                 <p className="text-[13px] text-foreground/80 truncate italic">
                    {messageToForward.content || '[Attachment]'}
                 </p>
              </div>
           </div>

           {/* Input for extra message */}
           <textarea 
             placeholder="Nhập tin nhắn..."
             className="w-full p-4 bg-background border border-border rounded-2xl text-[13px] focus:outline-none focus:border-indigo-500 transition-all resize-none"
             rows={2}
             value={extraMessage}
             onChange={(e) => setExtraMessage(e.target.value)}
           />
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-border flex items-center justify-end space-x-3">
           <button 
             onClick={onClose}
             className="px-6 py-3 text-[13px] font-bold text-foreground/60 hover:bg-surface-200 rounded-2xl transition-all"
           >
             Hủy
           </button>
           <button 
             onClick={handleForward}
             disabled={selectedConvs.length === 0 || sending}
             className="px-8 py-3 bg-indigo-500 text-white rounded-2xl font-black text-[13px] uppercase tracking-wider hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:scale-100 flex items-center space-x-2"
           >
             {sending ? <span>...</span> : <><Send size={16} /> <span>Chia sẻ</span></>}
           </button>
        </div>
      </div>
    </div>
  );
};

export default ForwardModal;
