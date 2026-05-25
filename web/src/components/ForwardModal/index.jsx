import { useState, useMemo } from 'react';
import { Search, X, Send, Users, User, Clock, HardDrive } from 'lucide-react';
import { useChat } from '../../hooks/useChat';
import { useWebSocket } from '../../hooks/useWebSocket';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import axiosClient from '../../api/axiosClient';
import { myCloudApi } from '../../api/myCloudApi';

const cn = (...classes) => classes.filter(Boolean).join(" ");

const ForwardModal = ({ isOpen, onClose, messageToForward }) => {
  const { t } = useTranslation();
  const { conversations } = useChat();
  const { sendMessage } = useWebSocket();
  const { user } = useSelector(state => state.auth);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState(t('forward.tabs.recent')); // Gần đây, Nhóm trò chuyện, Bạn bè
  const [selectedConvs, setSelectedConvs] = useState([]);
  const [extraMessage, setExtraMessage] = useState('');
  const [sending, setSending] = useState(false);

  const TABS = [
    { key: t('forward.tabs.recent'), label: t('forward.tabs.recent') },
    { key: t('forward.tabs.groups'), label: t('forward.tabs.groups') },
    { key: t('forward.tabs.friends'), label: t('forward.tabs.friends') },
    { key: 'MY_CLOUD', label: 'My Cloud' }
  ];

  const filteredConversations = useMemo(() => {
    if (activeTab === 'MY_CLOUD') return [];
    let list = Object.values(conversations);
    
    // Sort by last message date (recent first)
    list.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

    if (activeTab === t('forward.tabs.groups')) {
      list = list.filter(c => c.type === 'GROUP');
    } else if (activeTab === t('forward.tabs.friends')) {
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
    if (activeTab === 'MY_CLOUD') {
      setSelectedConvs(prev => prev.includes('MY_CLOUD') ? [] : ['MY_CLOUD']);
    } else {
      setSelectedConvs(prev => 
        prev.includes(convId) 
          ? prev.filter(id => id !== convId) 
          : [...prev, convId]
      );
    }
  };

  const handleForwardToCloud = async () => {
    try {
      const isText = messageToForward.type === 'TEXT';

      const extractObjectKey = (inputUrl) => {
        if (!inputUrl) return '';
        try {
          const parsed = new URL(inputUrl);
          const pathname = decodeURIComponent(parsed.pathname || '').replace(/^\/+/, '');
          const segments = pathname.split('/').filter(Boolean);
          const host = (parsed.hostname || '').toLowerCase();

          // Path-style S3 URLs: https://s3...amazonaws.com/<bucket>/<key>
          if (host === 's3.amazonaws.com' || host.startsWith('s3.')) {
            return segments.length > 1 ? segments.slice(1).join('/') : pathname;
          }

          // Virtual-hosted style: https://<bucket>.s3...amazonaws.com/<key>
          return segments.join('/');
        } catch (error) {
          return '';
        }
      };

      const fetchMediaBlob = async (inputUrl) => {
        const objectKey = extractObjectKey(inputUrl);
        if (objectKey) {
          const response = await axiosClient.get('/media/presigned-download', {
            params: {
              objectKey,
              expiresInMinutes: 15
            }
          });

          const freshUrl = response?.data?.url || response?.url;
          if (!freshUrl) {
            throw new Error('Unable to create fresh download URL');
          }

          const freshResponse = await fetch(freshUrl);
          if (!freshResponse.ok) {
            throw new Error(`Unable to fetch file from refreshed URL: ${freshResponse.status}`);
          }

          return await freshResponse.blob();
        }

        const directResponse = await fetch(inputUrl);
        if (!directResponse.ok) {
          throw new Error(`Unable to fetch file: ${directResponse.status}`);
        }
        return await directResponse.blob();
      };
      
      const cleanFileName = (url) => {
        if (!url) return `file_${Date.now()}`;
        try {
          const decoded = decodeURIComponent(url);
          let name = decoded.split('/').pop().split('?')[0];
          // remove uuid prefix (common in S3 keys)
          name = name.replace(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}_/i, '');
          // remove another common pattern: uuid_timestamp_
          name = name.replace(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}_[0-9]+_/i, '');
          return name;
        } catch (e) {
          return `file_${Date.now()}`;
        }
      };

      if (isText) {
        const text = messageToForward.content || '';
        const name = `forwarded_${Date.now()}.txt`;
        const blob = new Blob([text], { type: 'text/plain' });
        await myCloudApi.uploadFile(blob, name);
      } else {
        const mediaUrls = messageToForward.mediaUrls || messageToForward.media_urls || [];
        if (mediaUrls.length > 0) {
          for (const url of mediaUrls) {
            const blob = await fetchMediaBlob(url);
            
            // Priority: messageToForward.fileName > messageToForward.content (if it's a name) > cleaned URL
            let name = messageToForward.fileName;
            if (!name && messageToForward.content && !messageToForward.content.startsWith('http')) {
               name = messageToForward.content;
            }
            if (!name) {
               name = cleanFileName(url);
            }

            await myCloudApi.uploadFile(blob, name);
          }
        } else if (messageToForward.content && messageToForward.content.startsWith('http')) {
           const blob = await fetchMediaBlob(messageToForward.content);
           let name = messageToForward.fileName || cleanFileName(messageToForward.content);
           await myCloudApi.uploadFile(blob, name);
        }
      }
    } catch (err) {
      console.error('Forward to cloud failed:', err);
      throw err;
    }
  };

  const handleForward = async () => {
    if (selectedConvs.length === 0) return;
    setSending(true);

    try {
      if (selectedConvs.includes('MY_CLOUD')) {
        await handleForwardToCloud();
      }

      const otherConvs = selectedConvs.filter(id => id !== 'MY_CLOUD');
      if (otherConvs.length > 0) {
        const forwardData = {
          messageId: messageToForward.messageId,
          conversationId: messageToForward.conversationId,
          senderName: messageToForward.senderName,
          fileName: messageToForward.fileName
        };

        for (const convId of otherConvs) {
          // Forward the original message
          const forwardType = messageToForward.type === 'FILE' ? 'FILE' : messageToForward.type;
          const forwardContent = messageToForward.type === 'FILE'
            ? (messageToForward.fileName || '[Attachment]')
            : messageToForward.content;

          await sendMessage(
            convId, 
            forwardContent, 
            forwardType, 
            messageToForward.mediaUrls || [], 
            null, // replyTo
            forwardData
          );

          // Send extra message if any
          if (extraMessage.trim()) {
            await sendMessage(convId, extraMessage.trim(), 'TEXT');
          }
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
    return otherMember?.fullName || conv.name || t('forward.user_fallback');
  };

  if (!isOpen || !messageToForward) return null;

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-fade-in">
      <div className="bg-surface-100 w-full max-w-lg rounded-[32px] shadow-2xl border border-white/20 overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-6 flex items-center justify-between border-b border-border">
           <h3 className="text-lg font-black text-foreground uppercase tracking-tight">{t('forward.title')}</h3>
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
                placeholder={t('forward.search_placeholder')}
                className="w-full pl-12 pr-4 py-3 bg-background border border-border rounded-2xl text-sm focus:outline-none focus:border-indigo-500 transition-all"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
           </div>

           {/* Tabs */}
           <div className="flex space-x-2 border-b border-border pb-1">
              {TABS.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={cn(
                    "px-4 py-2 text-[13px] font-bold transition-all border-b-2",
                    activeTab === tab.key ? "border-indigo-500 text-indigo-500" : "border-transparent text-foreground/40 hover:text-foreground/60"
                  )}
                >
                  {tab.label}
                </button>
              ))}
           </div>

           {/* List */}
           <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
              {activeTab === 'MY_CLOUD' ? (
                <div 
                  onClick={() => toggleSelect('MY_CLOUD')}
                  className="flex items-center justify-between p-4 rounded-2xl hover:bg-surface-200 cursor-pointer transition-all border border-transparent hover:border-border group"
                >
                  <div className="flex items-center space-x-4">
                     <div className="w-12 h-12 bg-indigo-500/15 rounded-2xl flex items-center justify-center text-indigo-500 shadow-sm group-hover:scale-105 transition-transform">
                        <HardDrive size={24} />
                     </div>
                     <div className="flex flex-col">
                        <span className="font-bold text-[15px] text-foreground">My Cloud</span>
                        <span className="text-[11px] text-foreground/40 font-medium">Lưu trữ cá nhân</span>
                     </div>
                  </div>
                  <div className={cn(
                    "w-6 h-6 rounded-[8px] border-2 flex items-center justify-center transition-all",
                    selectedConvs.includes('MY_CLOUD') ? "bg-indigo-500 border-indigo-500 shadow-lg shadow-indigo-500/30" : "border-border"
                  )}>
                    {selectedConvs.includes('MY_CLOUD') && <X size={14} className="text-white rotate-45" />}
                  </div>
                </div>
              ) : filteredConversations.map(conv => (
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
              <p className="text-[10px] font-black text-foreground/40 uppercase tracking-widest">{t('forward.forward_message')}</p>
              <div className="p-3 bg-background/50 rounded-xl border border-border">
                 <p className="text-[13px] text-foreground/80 truncate italic">
                      {messageToForward.type === 'FILE'
                       ? (messageToForward.fileName || '[Attachment]')
                       : (messageToForward.content || '[Attachment]')}
                 </p>
              </div>
           </div>

           {/* Input for extra message */}
           <textarea 
             placeholder={t('forward.message_placeholder')}
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
             {t('forward.cancel')}
           </button>
           <button 
             onClick={handleForward}
             disabled={selectedConvs.length === 0 || sending}
             className="px-8 py-3 bg-indigo-500 text-white rounded-2xl font-black text-[13px] uppercase tracking-wider hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:scale-100 flex items-center space-x-2"
           >
             {sending ? <span>...</span> : <><Send size={16} /> <span>{t('forward.send')}</span></>}
           </button>
        </div>
      </div>
    </div>
  );
};

export default ForwardModal;
