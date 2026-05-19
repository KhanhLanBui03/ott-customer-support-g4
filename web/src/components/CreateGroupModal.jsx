import { useState, useEffect } from 'react';
import { X, Users, Check, Search, User, ShieldCheck, Camera } from 'lucide-react';
import { friendApi } from '../api/friendApi';
import { chatApi } from '../api/chatApi';
import { useChat } from '../hooks/useChat';
import { useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';
import { updateConversation } from '../store/chatSlice';

const CreateGroupModal = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const [groupName, setGroupName] = useState('');
  const [friends, setFriends] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [groupAvatar, setGroupAvatar] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const { create, selectConversation } = useChat();
  const dispatch = useDispatch();

  useEffect(() => {
    if (isOpen) {
      fetchFriends();
      setGroupName('');
      setSelectedIds([]);
      setGroupAvatar(null);
      setAvatarPreview(null);
    }
  }, [isOpen]);

  const fetchFriends = async () => {
    try {
      const response = await friendApi.getFriends();
      const data = response?.data || response || [];
      const validFriends = Array.isArray(data) ? data.filter(f => f.status === 'ACCEPTED') : [];
      setFriends(validFriends);
    } catch (err) {
      console.error("Failed to fetch friends", err);
    }
  };

  const handleToggleSelect = (id) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setGroupAvatar(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim() || selectedIds.length < 2) return;
    
    setLoading(true);
    try {
      const result = await create('GROUP', selectedIds, groupName);
      const convData = result.payload?.data || result.payload;
      
      if (convData) {
        const convId = convData.conversationId || convData.id;
        
        if (convId) {
          // If avatar selected, upload it
          if (groupAvatar) {
            try {
              const uploadRes = await chatApi.uploadMedia(groupAvatar, 'conversation-avatars');
              const uploadedUrl = uploadRes.data?.data?.mediaUrl || uploadRes.data?.mediaUrl || uploadRes.data?.url || uploadRes.url;
              
              if (uploadedUrl) {
                await chatApi.updateConversationAvatar(convId, uploadedUrl);
                dispatch(updateConversation({ conversationId: convId, avatarUrl: uploadedUrl }));
              }
            } catch (uploadErr) {
              console.warn("Group created but avatar upload failed", uploadErr);
            }
          }
          
          selectConversation(convId);
        }
        onClose();
      }
    } catch (err) {
      console.error("Failed to create group", err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const filteredFriends = friends.filter(f => 
    f.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    f.phoneNumber?.includes(searchTerm)
  );

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 backdrop-blur-xl bg-slate-900/20 animate-fade-in">
      <div className="bg-background w-full max-w-lg rounded-[40px] shadow-2xl border border-border overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="h-20 flex items-center justify-between px-10 border-b border-border bg-surface-100">
          <div className="flex items-center space-x-3">
             <div className="w-10 h-10 rounded-2xl bg-indigo-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                <Users size={20} className="text-white" />
             </div>
             <h2 className="text-xl font-black text-foreground tracking-tight">{t('group.create_title')}</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-surface-200 rounded-xl text-foreground/40 transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="p-8 space-y-8 flex-1 overflow-y-auto no-scrollbar">
          {/* Group Avatar & Name */}
          <div className="flex flex-col items-center space-y-6">
            <div className="relative group">
              <div className="w-24 h-24 rounded-[32px] bg-surface-200 border-2 border-dashed border-border overflow-hidden flex items-center justify-center transition-all group-hover:border-indigo-500/50 shadow-inner">
                {avatarPreview ? (
                  <img src={avatarPreview} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <Camera size={32} className="text-foreground/20 group-hover:text-indigo-500/50 transition-colors" />
                )}
              </div>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="absolute inset-0 opacity-0 cursor-pointer z-10"
                title={t('group.avatar_title')}
              />
              {avatarPreview && (
                 <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setGroupAvatar(null); 
                    setAvatarPreview(null);
                  }}
                  className="absolute -top-2 -right-2 p-1.5 bg-red-500 text-white rounded-full shadow-lg hover:scale-110 transition-all z-20"
                 >
                   <X size={12} />
                 </button>
              )}
            </div>
            
            <div className="w-full space-y-4">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground/40 px-1">{t('group.name_label')}</label>
              <input
                type="text"
                placeholder={t('group.name_placeholder')}
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                className="w-full px-6 py-4 bg-surface-200 border-none rounded-2xl text-sm font-bold text-foreground placeholder:text-foreground/30 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                autoFocus
              />
            </div>
          </div>

          {/* Search Member */}
          <div className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground/40">
                {t('group.add_members', { count: selectedIds.length })}
              </label>
              <span className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest italic">{t('group.min_members_hint')}</span>
            </div>
            <div className="relative">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-foreground/30" size={18} />
              <input
                type="text"
                placeholder={t('group.search_placeholder')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-14 pr-6 py-4 bg-surface-200 border-none rounded-2xl text-sm font-bold text-foreground placeholder:text-foreground/30 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
              />
            </div>

            {/* Selected Members Preview */}
            {selectedIds.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {selectedIds.map(id => {
                  const f = friends.find(fr => fr.userId === id);
                  if (!f) return null;
                  return (
                    <div key={id} className="flex items-center space-x-2 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 px-3 py-1.5 rounded-full text-xs font-bold">
                      <span>{f.fullName}</span>
                      <button onClick={() => handleToggleSelect(id)} className="hover:text-red-500 transition-colors"><X size={14} /></button>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="space-y-2 mt-4">
              {filteredFriends.map(friend => (
                <div 
                  key={friend.userId}
                  onClick={() => handleToggleSelect(friend.userId)}
                  className={`p-4 rounded-3xl flex items-center justify-between cursor-pointer transition-all duration-300 ${
                    selectedIds.includes(friend.userId) 
                      ? 'bg-indigo-50 dark:bg-indigo-500/10 border-indigo-100 dark:border-indigo-500/20' 
                      : 'hover:bg-surface-100 border-transparent'
                  } border`}
                >
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 rounded-2xl bg-surface-200 overflow-hidden flex-shrink-0 border border-border shadow-sm">
                      {friend.avatarUrl ? (
                         <img src={friend.avatarUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                         <div className="w-full h-full flex items-center justify-center font-bold text-foreground/40">{friend.fullName?.charAt(0)}</div>
                      )}
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-foreground">{friend.fullName}</h4>
                      <p className="text-[10px] font-bold text-foreground/40">{friend.phoneNumber}</p>
                    </div>
                  </div>
                  <div className={`w-8 h-8 rounded-xl border-2 flex items-center justify-center transition-all ${
                    selectedIds.includes(friend.userId)
                      ? 'bg-indigo-500 border-indigo-500'
                      : 'border-border'
                  }`}>
                    {selectedIds.includes(friend.userId) && <Check size={16} className="text-white" />}
                  </div>
                </div>
              ))}
              {friends.length === 0 && (
                <div className="py-12 text-center">
                   <p className="text-xs font-bold text-foreground/30">{t('group.no_friends')}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Action */}
        <div className="p-8 border-t border-border bg-surface-100">
          <button
            onClick={handleCreateGroup}
            disabled={loading || !groupName.trim() || selectedIds.length < 2}
            className="w-full py-5 bg-indigo-600 text-white rounded-3xl font-black uppercase tracking-[0.3em] text-[12px] shadow-xl shadow-indigo-500/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:grayscale disabled:scale-100 flex items-center justify-center space-x-3"
          >
            {loading ? (
              <div className="w-5 h-5 border-3 border-white/20 border-t-white rounded-full animate-spin" />
            ) : selectedIds.length < 2 ? (
              <>
                <Users size={18} />
                <span>{t('group.add_more', { count: 2 - selectedIds.length })}</span>
              </>
            ) : (
              <>
                <Users size={18} />
                <span>{t('group.create_btn')}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateGroupModal;
