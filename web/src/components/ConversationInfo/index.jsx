import React, { useState, useMemo } from 'react';
import { 
  Bell, Pin, Users, Clock, Hash, Image as ImageIcon, FileText, Link as LinkIcon, 
  Trash2, AlertTriangle, EyeOff, ChevronDown, ChevronRight, X, Download, PlayCircle,
  UserPlus, Shield, ShieldCheck, MoreVertical, LogOut, Palette, Search, Zap, Trash2 as TrashIcon 
} from 'lucide-react';
import { useChat } from '../../hooks/useChat';
import { useAuth } from '../../hooks/useAuth';
import { friendApi } from '../../api/friendApi';
import { chatApi } from '../../api/chatApi';
import { userApi } from '../../api/userApi';
import GroupAvatar from '../GroupAvatar';

const ConversationInfo = ({ conversation, onClose, onClearHistory }) => {
  const { messages, fetchConversations, inviteMember, removeMember } = useChat();
  const fileInputRef = React.useRef(null);
  const { user } = useAuth();
  const [sections, setSections] = useState({
    members: true,
    media: false,
    files: false,
    links: false,
    customization: true, // Mặc định mở để người dùng dễ thấy
    security: true
  });
  
  const [isInviting, setIsInviting] = useState(false);
  const [friends, setFriends] = useState([]);
  const [inviteSearch, setInviteSearch] = useState('');
  const [globalLoading, setGlobalLoading] = useState(false);
  const [globalError, setGlobalError] = useState('');

  const conversationId = conversation?.conversationId;
  const currentMessages = useMemo(() => messages[conversationId] || [], [messages, conversationId]);

  const currentMember = useMemo(() => 
    conversation.members?.find(m => m.userId === user?.userId),
    [conversation.members, user?.userId]
  );

  const isOwner = currentMember?.role === 'OWNER';
  const isOnlyMember = conversation.type === 'GROUP' && conversation.members?.length === 1;
  const isAdmin = currentMember?.role === 'ADMIN' || isOwner || isOnlyMember;

  const handleFetchFriends = async () => {
    setIsInviting(true);
    setInviteSearch('');
    setGlobalError('');
    try {
      const response = await friendApi.getFriends();
      const inGroupIds = conversation.members?.map(m => m.userId) || [];
      setFriends((response.data || []).filter(f => !inGroupIds.includes(f.userId)));
    } catch (err) {
      console.error(err);
    }
  };

  const handleGlobalSearch = async () => {
    if (!inviteSearch.trim()) return;
    setGlobalLoading(true);
    setGlobalError('');
    try {
      const response = await userApi.searchUser(inviteSearch);
      const found = response.data || response;
      
      const inGroupIds = conversation.members?.map(m => m.userId) || [];
      if (inGroupIds.includes(found.userId)) {
        setGlobalError('Người này đã có trong nhóm');
        return;
      }

      setFriends([found]);
    } catch (err) {
      setGlobalError('Không tìm thấy người dùng với số điện thoại này');
    } finally {
      setGlobalLoading(false);
    }
  };

  const handleInvite = async (friendId) => {
    try {
      await inviteMember(conversationId, friendId);
      alert('Đã gửi lời mời tham gia nhóm!');
      setIsInviting(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handlePromote = async (memberUserId) => {
    if (!isOwner) return;
    try {
      await chatApi.assignRole(conversationId, memberUserId, 'ADMIN');
      fetchConversations();
    } catch (err) {
      console.error(err);
    }
  };

  const handleRemoveMember = async (memberUserId) => {
    if (!isAdmin) return;
    if (window.confirm('Loại bỏ thành viên này khỏi nhóm?')) {
      await removeMember(conversationId, memberUserId);
    }
  };

  const handleLeaveGroup = async () => {
     if (window.confirm('Rời khỏi cuộc trò chuyện này?')) {
        try {
           await chatApi.leaveConversation(conversationId);
           fetchConversations();
           onClose();
        } catch (err) {
           console.error(err);
        }
     }
  };

  const mediaItems = useMemo(() => {
    const items = [];
    currentMessages.forEach(msg => {
      if (msg.mediaUrls && (msg.type === 'IMAGE' || msg.type === 'VIDEO' || msg.type === 'TEXT')) {
        msg.mediaUrls.forEach(url => {
          const isImg = url.match(/\.(jpeg|jpg|gif|png|webp|svg)/i);
          const isVid = url.match(/\.(mp4|webm|ogg)/i);
          if (isImg || isVid) {
            items.push({ 
              url, 
              type: isImg ? 'IMAGE' : 'VIDEO',
              createdAt: msg.createdAt 
            });
          }
        });
      }
    });
    return items.reverse();
  }, [currentMessages]);

  const fileItems = useMemo(() => {
    const items = [];
    currentMessages.forEach(msg => {
      if (msg.mediaUrls) {
        msg.mediaUrls.forEach(url => {
          const isMedia = url.match(/\.(jpeg|jpg|gif|png|webp|svg|mp4|webm|ogg)/i);
          if (!isMedia) {
            items.push({ 
              url, 
              name: url.split('/').pop(),
              createdAt: msg.createdAt,
              metadata: msg.metadata
            });
          }
        });
      }
    });
    return items.reverse();
  }, [currentMessages]);

  const handleWallpaperChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert('Ảnh quá lớn. Vui lòng chọn ảnh dưới 2MB để đảm bảo tốc độ.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target.result;
      localStorage.setItem(`chat_wallpaper_${conversationId}`, dataUrl);
      window.dispatchEvent(new CustomEvent('chat-wallpaper-updated', { 
        detail: { conversationId, wallpaper: dataUrl } 
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleClearWallpaper = () => {
    localStorage.removeItem(`chat_wallpaper_${conversationId}`);
    window.dispatchEvent(new CustomEvent('chat-wallpaper-updated', { 
      detail: { conversationId, wallpaper: null } 
    }));
  };

  if (!conversation) return null;

  const toggleSection = (section) => {
    setSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 KB';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="w-[360px] h-full bg-sidebar border-l border-border flex flex-col overflow-hidden animate-slide-left shadow-2xl z-40 transition-colors">
      <div className="h-[72px] px-6 border-b border-border flex items-center justify-between flex-shrink-0 glass-premium z-10">
        <h3 className="text-[17px] font-black text-foreground tracking-tight">Conversation Info</h3>
        <button onClick={onClose} className="p-2.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-400 transition-all active:scale-90">
          <X size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar pb-12">
        <div className="p-10 flex flex-col items-center text-center space-y-5">
          <div className="relative group">
            <GroupAvatar 
              conversation={conversation} 
              size="w-28 h-28" 
              isLarge 
            />
            {conversation.type === 'GROUP' && (
              <div className="absolute -bottom-1 -right-1 w-9 h-9 bg-indigo-500 rounded-2xl shadow-xl flex items-center justify-center text-white border-4 border-white dark:border-[#0b0e14]">
                  <Users size={16} />
              </div>
            )}
          </div>
          
          <div className="space-y-1">
            <h4 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">{conversation.name || 'Conversation'}</h4>
            <div className="flex items-center justify-center space-x-2">
               <span className="text-[10px] font-black uppercase tracking-[0.25em] text-emerald-500 bg-emerald-500/10 px-3 py-1 rounded-full">
                 {conversation.type === 'GROUP' ? `${conversation.members?.length || 0} Members` : 'Live Link'}
               </span>
            </div>
          </div>
        </div>

        <div className="h-2 bg-slate-50 dark:bg-slate-900/50" />

        {/* Group Members Section */}
        {conversation.type === 'GROUP' && (
           <div className="px-4 py-3">
              <button 
                onClick={() => toggleSection('members')}
                className="w-full flex items-center justify-between px-5 py-3 hover:bg-surface-100 rounded-2xl transition-all"
              >
                 <span className="text-[11px] font-black text-foreground/70 uppercase tracking-widest">Group Members</span>
                 {sections.members ? <ChevronDown size={18} className="text-foreground/70" /> : <ChevronRight size={18} className="text-foreground/70" />}
              </button>
              
              {sections.members && (
                 <div className="mt-4 space-y-3 px-2">
                    {isAdmin && (
                      <button 
                        onClick={handleFetchFriends}
                        className="w-full flex items-center space-x-4 p-4 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-[24px] hover:scale-[1.02] active:scale-[0.98] transition-all group"
                      >
                         <div className="w-10 h-10 rounded-xl bg-indigo-500 text-white flex items-center justify-center shadow-lg shadow-indigo-500/20">
                            <UserPlus size={18} />
                          </div>
                         <span className="text-[14px] font-black">Invite Participants</span>
                      </button>
                    )}

                    <div className="space-y-1.5">
                      {conversation.members?.map(m => (
                        <div key={m.userId} className="flex items-center justify-between p-3.5 hover:bg-slate-50 dark:hover:bg-white/5 rounded-[24px] transition-all group/member">
                           <div className="flex items-center space-x-4">
                              <div className="w-11 h-11 rounded-2xl bg-surface-200 dark:bg-slate-800 overflow-hidden border-2 border-white dark:border-slate-700 shadow-sm transition-transform group-hover/member:scale-110">
                                 {m.avatarUrl ? (
                                   <img src={m.avatarUrl} className="w-full h-full object-cover" />
                                 ) : (
                                   <div className="w-full h-full flex items-center justify-center text-xs font-black text-slate-400 dark:text-slate-600 uppercase italic">{m.fullName?.charAt(0)}</div>
                                 )}
                              </div>
                              <div className="min-w-0">
                                 <p className="text-[15px] font-black text-foreground truncate leading-tight">{m.fullName}</p>
                                 <div className="flex items-center space-x-2 mt-0.5">
                                    <span className={`text-[9px] font-black uppercase tracking-[0.15em] ${
                                      m.role === 'OWNER' ? 'text-indigo-500' : m.role === 'ADMIN' ? 'text-emerald-500' : 'text-slate-400 dark:text-slate-600'
                                    }`}>
                                      {m.role === 'OWNER' ? 'Prime Owner' : m.role === 'ADMIN' ? 'Technician' : 'Participant'}
                                    </span>
                                 </div>
                              </div>
                           </div>
                        </div>
                      ))}
                    </div>
                 </div>
              )}
           </div>
        )}

        <div className="px-4 space-y-2">
           <div className="py-2">
              <button 
                onClick={() => toggleSection('media')}
                className="w-full flex items-center justify-between px-5 py-3 hover:bg-surface-100 rounded-2xl transition-all"
              >
                 <span className="text-[11px] font-black text-foreground/70 uppercase tracking-widest">Shared Nodes (Media)</span>
                 {sections.media ? <ChevronDown size={18} className="text-foreground/70" /> : <ChevronRight size={18} className="text-foreground/70" />}
              </button>
              {sections.media && (
                <div className="mt-4 px-2">
                   {mediaItems.length > 0 ? (
                     <div className="grid grid-cols-3 gap-3">
                        {mediaItems.slice(0, 12).map((item, idx) => (
                          <div key={idx} className="aspect-square bg-slate-100 dark:bg-slate-800 rounded-2xl border-2 border-white dark:border-slate-700 overflow-hidden relative group cursor-pointer transition-all hover:scale-105 shadow-md">
                             {item.type === 'IMAGE' ? (
                               <img src={item.url} alt="" className="w-full h-full object-cover" />
                             ) : (
                               <div className="w-full h-full flex flex-col items-center justify-center bg-black/40">
                                  <PlayCircle size={32} className="text-white drop-shadow-lg" />
                               </div>
                             )}
                          </div>
                        ))}
                     </div>
                   ) : (
                     <div className="text-center py-12 opacity-30">
                        <ImageIcon size={32} className="mx-auto mb-3" />
                        <p className="text-xs font-bold italic tracking-tight">Zero media payloads</p>
                     </div>
                   )}
                </div>
              )}
           </div>

           <div className="py-2">
              <button 
                onClick={() => toggleSection('files')}
                className="w-full flex items-center justify-between px-5 py-3 hover:bg-surface-100 rounded-2xl transition-all"
              >
                 <span className="text-[11px] font-black text-foreground/70 uppercase tracking-widest">Document Registry</span>
                 {sections.files ? <ChevronDown size={18} className="text-foreground/70" /> : <ChevronRight size={18} className="text-foreground/70" />}
              </button>
              {sections.files && (
                <div className="mt-3 space-y-2 px-2">
                   {fileItems.length > 0 ? (
                      fileItems.slice(0, 5).map((file, idx) => (
                        <div key={idx} className="flex items-center space-x-4 p-4 hover:bg-white dark:hover:bg-white/5 rounded-[24px] border border-transparent hover:border-slate-100 dark:hover:border-slate-800 transition-all group shadow-sm hover:shadow-lg hover:scale-[1.02]">
                           <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-500 rounded-2xl flex items-center justify-center group-hover:bg-indigo-500 group-hover:text-white transition-all shadow-sm">
                              <FileText size={24} />
                           </div>
                           <div className="flex-1 min-w-0">
                              <p className="text-[14px] font-black text-slate-800 dark:text-slate-200 truncate leading-tight">{file.name || 'Registry Entry'}</p>
                           </div>
                        </div>
                      ))
                   ) : (
                     <div className="text-center py-12 opacity-30">
                        <FileText size={32} className="mx-auto mb-3" />
                        <p className="text-xs font-bold italic tracking-tight">Empty file index</p>
                     </div>
                   )}
                </div>
              )}
           </div>

           {/* Interface Customization */}
           <div className="py-2">
              <button 
                onClick={() => toggleSection('customization')}
                className="w-full flex items-center justify-between px-5 py-3 hover:bg-surface-100 rounded-2xl transition-all"
              >
                 <div className="flex items-center space-x-3">
                   <Palette size={16} className="text-indigo-500" />
                   <span className="text-[11px] font-black text-foreground/70 uppercase tracking-widest">Tùy chỉnh giao diện</span>
                 </div>
                 {sections.customization ? <ChevronDown size={18} className="text-foreground/70" /> : <ChevronRight size={18} className="text-foreground/70" />}
              </button>
              
              {sections.customization && (
                <div className="mt-4 space-y-3 px-2 animate-in fade-in slide-in-from-top-2 duration-300">
                   <input 
                     type="file" 
                     ref={fileInputRef}
                     className="hidden" 
                     accept="image/*"
                     onChange={handleWallpaperChange}
                   />
                   
                   <button 
                     onClick={() => fileInputRef.current?.click()}
                     className="w-full flex items-center space-x-4 p-4 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-[24px] hover:scale-[1.02] active:scale-[0.98] transition-all group"
                   >
                      <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-500/20">
                         <ImageIcon size={20} />
                      </div>
                      <div className="text-left flex-1">
                         <p className="text-[14px] font-black">Thay đổi ảnh nền</p>
                         <p className="text-[10px] font-bold opacity-60">Thỏa sức sáng tạo không gian chat</p>
                      </div>
                   </button>

                   <button 
                     onClick={handleClearWallpaper}
                     className="w-full flex items-center space-x-4 p-4 hover:bg-red-50 dark:hover:bg-red-500/10 text-red-500 rounded-[24px] transition-all group"
                   >
                      <div className="w-10 h-10 rounded-xl bg-background border border-red-500/20 flex items-center justify-center group-hover:bg-red-500 group-hover:text-white transition-all shadow-sm">
                         <TrashIcon size={18} />
                      </div>
                      <div className="text-left">
                         <p className="text-[14px] font-black">Xóa ảnh nền</p>
                         <p className="text-[10px] font-bold opacity-60">Quay về giao diện tối giản</p>
                      </div>
                   </button>
                </div>
              )}
           </div>
        </div>

        <div className="h-2 bg-slate-50 dark:bg-slate-900/50 my-6" />

        {/* Security / Privacy */}
        <div className="px-4 pb-12 space-y-3">
           <div className="py-2">
              <button 
                onClick={() => toggleSection('security')}
                className="w-full flex items-center justify-between px-5 py-3 hover:bg-surface-100 rounded-2xl transition-all"
              >
                 <span className="text-[11px] font-black text-foreground/70 uppercase tracking-widest">Security Protocols</span>
                 {sections.security ? <ChevronDown size={18} className="text-foreground/70" /> : <ChevronRight size={18} className="text-foreground/70" />}
              </button>
              {sections.security && (
                <div className="mt-4 px-2 space-y-2">
                   {conversation.type === 'GROUP' && (
                     <button 
                       onClick={handleLeaveGroup}
                       className="w-full flex items-center space-x-5 px-5 py-4 hover:bg-orange-50 dark:hover:bg-orange-500/10 text-orange-600 rounded-[24px] transition-all group scale-100 hover:scale-[1.02] border border-transparent hover:border-orange-100 dark:hover:border-orange-500/20"
                     >
                        <div className="w-11 h-11 rounded-2xl bg-orange-100/50 dark:bg-orange-500/5 flex items-center justify-center group-hover:scale-110 transition-transform">
                           <LogOut size={22} />
                        </div>
                        <span className="text-[15px] font-black tracking-tight text-foreground">Abort Channel (Leave)</span>
                     </button>
                   )}
                   <button 
                    onClick={onClearHistory}
                    className="w-full flex items-center space-x-5 px-5 py-4 hover:bg-red-50 dark:hover:bg-red-500/10 text-red-500 rounded-[24px] transition-all group scale-100 hover:scale-[1.02] border border-transparent hover:border-red-100 dark:hover:border-red-500/20"
                   >
                      <div className="w-11 h-11 rounded-2xl bg-red-100/50 dark:bg-red-500/5 flex items-center justify-center group-hover:scale-110 transition-transform">
                         <Trash2 size={22} />
                      </div>
                      <span className="text-[15px] font-black tracking-tight text-foreground">Purge Data Storage</span>
                   </button>
                   
                   <div className="mt-8 p-6 bg-surface-200 dark:bg-surface-200/40 rounded-[32px] border border-border text-center">
                      <Shield size={32} className="mx-auto mb-4 text-emerald-500 opacity-60" />
                      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-foreground/60">End-to-End Encryption</p>
                      <p className="text-[9px] font-bold text-foreground/40 mt-2 italic">Messages are secured with quantum-ready protocols.</p>
                   </div>
                </div>
              )}
           </div>
        </div>
      </div>
    </div>
  );
};
export default ConversationInfo;
