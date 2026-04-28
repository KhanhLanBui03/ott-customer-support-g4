import React, { useState, useMemo } from 'react';
import { 
  Bell, Pin, Users, Clock, Hash, Image as ImageIcon, FileText, Link as LinkIcon, 
  Trash2, AlertTriangle, EyeOff, ChevronDown, ChevronRight, X, Download, PlayCircle,
  UserPlus, Shield, ShieldCheck, MoreVertical, LogOut, Palette, Search, Zap, Trash2 as TrashIcon,
  Edit3, Check
} from 'lucide-react';
import { useDispatch } from 'react-redux';
import { useChat } from '../../hooks/useChat';
import { useAuth } from '../../hooks/useAuth';
import { friendApi } from '../../api/friendApi';
import { chatApi } from '../../api/chatApi';
import { userApi } from '../../api/userApi';
import { updateConversationWallpaper } from '../../store/chatSlice';
import GroupAvatar from '../GroupAvatar';
import AIAssistantPanel from '../AIAssistantPanel';

const ConversationInfo = ({ conversation, onClose, onClearHistory }) => {
  const dispatch = useDispatch();
  const { messages, fetchConversations, inviteMember, removeMember } = useChat();
  const fileInputRef = React.useRef(null);
  const { user } = useAuth();
  const [sections, setSections] = useState({
    members: true,
    media: false,
    files: false,
    links: false,
    customization: true,
    security: true
  });
  
  const [isInviting, setIsInviting] = useState(false);
  const [friends, setFriends] = useState([]);
  const [inviteSearch, setInviteSearch] = useState('');
  const [globalLoading, setGlobalLoading] = useState(false);
  const [globalError, setGlobalError] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState('');
  const [memberMenuId, setMemberMenuId] = useState(null);
  const [isWallpaperLoading, setIsWallpaperLoading] = useState(false);

  const conversationId = conversation?.conversationId;
  const currentMessages = useMemo(() => messages[conversationId] || [], [messages, conversationId]);

  const currentMember = useMemo(() => 
    conversation.members?.find(m => m.userId === (user?.userId || user?.id)),
    [conversation.members, user?.userId, user?.id]
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
      setMemberMenuId(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDemote = async (memberUserId) => {
    if (!isOwner) return;
    try {
      await chatApi.assignRole(conversationId, memberUserId, 'MEMBER');
      fetchConversations();
      setMemberMenuId(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleRemoveMember = async (memberUserId) => {
    if (!isAdmin) return;
    if (window.confirm('Loại bỏ thành viên này khỏi nhóm?')) {
      await removeMember(conversationId, memberUserId);
      setMemberMenuId(null);
    }
  };

  const handleLeaveGroup = async () => {
     if (window.confirm('Rời khỏi nhóm chat này?')) {
        try {
           await chatApi.leaveConversation(conversationId);
           fetchConversations();
           onClose();
        } catch (err) {
           console.error(err);
        }
     }
  };

  const handleRenameGroup = async () => {
    if (!editName.trim() || editName.trim() === conversation.name) {
      setIsEditingName(false);
      return;
    }
    try {
      await chatApi.renameConversation(conversationId, editName.trim());
      fetchConversations();
      setIsEditingName(false);
    } catch (err) {
      console.error('Rename failed:', err);
      alert('Không thể đổi tên nhóm. Vui lòng thử lại.');
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
            items.push({ url, type: isImg ? 'IMAGE' : 'VIDEO', createdAt: msg.createdAt });
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
            items.push({ url, name: url.split('/').pop(), createdAt: msg.createdAt, metadata: msg.metadata });
          }
        });
      }
    });
    return items.reverse();
  }, [currentMessages]);

  const handleWallpaperChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert('Ảnh quá lớn. Vui lòng chọn ảnh dưới 2MB.');
      return;
    }

    setIsWallpaperLoading(true);
    try {
      const uploadRes = await chatApi.uploadMedia(file, 'chat-wallpaper');
      const wallpaperUrl = uploadRes?.mediaUrl || uploadRes?.data?.mediaUrl || uploadRes?.url || uploadRes?.data?.url;

      if (!wallpaperUrl) {
        throw new Error('Không lấy được URL ảnh nền từ server');
      }

      await chatApi.updateWallpaper(conversationId, wallpaperUrl);
      dispatch(updateConversationWallpaper({ conversationId, wallpaperUrl }));
    } catch (err) {
      console.error('Update wallpaper failed:', err);
      alert('Không thể cập nhật ảnh nền. Vui lòng thử lại.');
    } finally {
      setIsWallpaperLoading(false);
      e.target.value = '';
    }
  };

  const handleClearWallpaper = async () => {
    setIsWallpaperLoading(true);
    try {
      await chatApi.updateWallpaper(conversationId, null);
      dispatch(updateConversationWallpaper({ conversationId, wallpaperUrl: null }));
    } catch (err) {
      console.error('Clear wallpaper failed:', err);
      alert('Không thể xóa ảnh nền. Vui lòng thử lại.');
    } finally {
      setIsWallpaperLoading(false);
    }
  };

  if (!conversation) return null;

  const toggleSection = (section) => {
    setSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const getRoleLabel = (role) => {
    if (role === 'OWNER') return 'Trưởng nhóm';
    if (role === 'ADMIN') return 'Phó nhóm';
    return 'Thành viên';
  };

  const getRoleColor = (role) => {
    if (role === 'OWNER') return 'text-indigo-500';
    if (role === 'ADMIN') return 'text-emerald-500';
    return 'text-slate-400 dark:text-slate-600';
  };

  return (
    <div className="w-[360px] h-full bg-sidebar border-l border-border flex flex-col overflow-hidden animate-slide-left shadow-2xl z-40 transition-colors">
      <div className="h-[72px] px-6 border-b border-border flex items-center justify-between flex-shrink-0 glass-premium z-10">
        <h3 className="text-[17px] font-black text-foreground tracking-tight">Thông tin hội thoại</h3>
        <button onClick={onClose} className="p-2.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-400 transition-all active:scale-90">
          <X size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar pb-12">
        <div className="p-10 flex flex-col items-center text-center space-y-5">
          <div className="relative group">
            <GroupAvatar conversation={conversation} size="w-28 h-28" isLarge />
            {conversation.type === 'GROUP' && (
              <div className="absolute -bottom-1 -right-1 w-9 h-9 bg-indigo-500 rounded-2xl shadow-xl flex items-center justify-center text-white border-4 border-white dark:border-[#0b0e14]">
                  <Users size={16} />
              </div>
            )}
          </div>
          
          <div className="space-y-1 w-full">
            {isEditingName && conversation.type === 'GROUP' ? (
              <div className="flex items-center space-x-2 justify-center">
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleRenameGroup()}
                  className="text-xl font-black text-center bg-surface-200 border border-border rounded-2xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 text-foreground w-full"
                  autoFocus
                />
                <button onClick={handleRenameGroup} className="p-2 bg-indigo-500 text-white rounded-xl hover:bg-indigo-600 transition-colors">
                  <Check size={18} />
                </button>
                <button onClick={() => setIsEditingName(false)} className="p-2 bg-surface-200 text-foreground/60 rounded-xl hover:bg-surface-300 transition-colors">
                  <X size={18} />
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-center space-x-2 group/name">
                <h4 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">{conversation.name || 'Nhóm chat'}</h4>
                {conversation.type === 'GROUP' && isAdmin && (
                  <button 
                    onClick={() => { setEditName(conversation.name || ''); setIsEditingName(true); }}
                    className="p-1.5 opacity-0 group-hover/name:opacity-100 hover:bg-surface-200 rounded-lg text-foreground/40 hover:text-indigo-500 transition-all"
                    title="Đổi tên nhóm"
                  >
                    <Edit3 size={14} />
                  </button>
                )}
              </div>
            )}
            <div className="flex items-center justify-center space-x-2">
               <span className="text-[10px] font-black uppercase tracking-[0.25em] text-emerald-500 bg-emerald-500/10 px-3 py-1 rounded-full">
                 {conversation.type === 'GROUP' ? `${conversation.members?.length || 0} thành viên` : 'Đang hoạt động'}
               </span>
            </div>
          </div>
        </div>

        <div className="h-2 bg-slate-50 dark:bg-slate-900/50" />

        {/* Trợ lý AI (Chỉ cho Nhóm) */}
        {conversation.type === 'GROUP' && (
          <AIAssistantPanel conversationId={conversationId} />
        )}

        <div className="h-2 bg-slate-50 dark:bg-slate-900/50 mt-6" />

        {/* Thành viên nhóm */}
        {conversation.type === 'GROUP' && (
           <div className="px-4 py-3">
              <button 
                onClick={() => toggleSection('members')}
                className="w-full flex items-center justify-between px-5 py-3 hover:bg-surface-100 rounded-2xl transition-all"
              >
                 <span className="text-[11px] font-black text-foreground/70 uppercase tracking-widest">Thành viên nhóm</span>
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
                         <span className="text-[14px] font-black">Thêm thành viên</span>
                      </button>
                    )}

                    {/* Invite Modal Inline */}
                    {isInviting && (
                      <div className="bg-surface-100 dark:bg-surface-200 rounded-[24px] p-4 space-y-3 border border-border animate-msg">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-black uppercase tracking-widest text-foreground/60">Mời bạn bè</span>
                          <button onClick={() => setIsInviting(false)} className="p-1 hover:bg-surface-200 rounded-lg"><X size={16} className="text-foreground/40" /></button>
                        </div>
                        <div className="flex space-x-2">
                          <input 
                            type="text" 
                            placeholder="Tìm theo SĐT..." 
                            value={inviteSearch} 
                            onChange={(e) => setInviteSearch(e.target.value)}
                            className="flex-1 bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-foreground placeholder:text-foreground/30"
                          />
                          <button onClick={handleGlobalSearch} className="px-4 py-2 bg-indigo-500 text-white rounded-xl text-sm font-bold hover:bg-indigo-600 transition-colors">
                            <Search size={16} />
                          </button>
                        </div>
                        {globalError && <p className="text-xs text-red-500 font-bold">{globalError}</p>}
                        {friends.map(f => (
                          <div key={f.userId} className="flex items-center justify-between p-3 hover:bg-surface-200 dark:hover:bg-white/5 rounded-2xl transition-all">
                            <div className="flex items-center space-x-3">
                              <div className="w-9 h-9 rounded-xl bg-surface-200 overflow-hidden">
                                {f.avatarUrl ? <img src={f.avatarUrl} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-xs font-bold text-foreground/40">{f.fullName?.charAt(0)}</div>}
                              </div>
                              <span className="text-sm font-bold text-foreground">{f.fullName}</span>
                            </div>
                            <button onClick={() => handleInvite(f.userId)} className="px-3 py-1.5 bg-indigo-500 text-white rounded-xl text-xs font-bold hover:bg-indigo-600 transition-colors">Mời</button>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="space-y-1.5">
                      {conversation.members?.map(m => (
                        <div key={m.userId} className="flex items-center justify-between p-3.5 hover:bg-slate-50 dark:hover:bg-white/5 rounded-[24px] transition-all group/member relative">
                           <div className="flex items-center space-x-4">
                              <div className="w-11 h-11 rounded-2xl bg-surface-200 dark:bg-slate-800 overflow-hidden border-2 border-white dark:border-slate-700 shadow-sm transition-transform group-hover/member:scale-110">
                                 {m.avatarUrl ? (
                                   <img src={m.avatarUrl} className="w-full h-full object-cover" />
                                 ) : (
                                   <div className="w-full h-full flex items-center justify-center text-xs font-black text-slate-400 dark:text-slate-600 uppercase italic">{m.fullName?.charAt(0)}</div>
                                 )}
                              </div>
                              <div className="min-w-0">
                                 <p className="text-[15px] font-black text-foreground truncate leading-tight">
                                   {m.fullName}
                                   {m.userId === (user?.userId || user?.id) && <span className="text-xs font-bold text-foreground/40 ml-1">(Bạn)</span>}
                                 </p>
                                 <div className="flex items-center space-x-2 mt-0.5">
                                    <span className={`text-[9px] font-black uppercase tracking-[0.15em] ${getRoleColor(m.role)}`}>
                                      {getRoleLabel(m.role)}
                                    </span>
                                 </div>
                              </div>
                           </div>
                           
                           {/* Menu 3 chấm cho quản lý thành viên */}
                           {isAdmin && m.userId !== (user?.userId || user?.id) && (
                             <div className="relative">
                               <button 
                                 onClick={(e) => { e.stopPropagation(); setMemberMenuId(memberMenuId === m.userId ? null : m.userId); }}
                                 className="p-2 hover:bg-surface-200 rounded-xl text-foreground/40 hover:text-foreground transition-all"
                               >
                                 <MoreVertical size={16} />
                               </button>
                               
                               {memberMenuId === m.userId && (
                                 <div className="absolute right-0 top-full mt-1 w-48 bg-sidebar border border-border shadow-2xl rounded-2xl p-1.5 z-[100] animate-msg">
                                   {isOwner && m.role !== 'ADMIN' && (
                                     <button onClick={() => handlePromote(m.userId)} className="w-full flex items-center space-x-3 px-4 py-2.5 text-[13px] font-bold text-foreground hover:bg-surface-100 rounded-xl transition-all">
                                       <ShieldCheck size={16} className="text-emerald-500" /> <span>Bổ nhiệm phó nhóm</span>
                                     </button>
                                   )}
                                   {isOwner && m.role === 'ADMIN' && (
                                     <button onClick={() => handleDemote(m.userId)} className="w-full flex items-center space-x-3 px-4 py-2.5 text-[13px] font-bold text-foreground hover:bg-surface-100 rounded-xl transition-all">
                                       <Shield size={16} className="text-slate-400" /> <span>Gỡ phó nhóm</span>
                                     </button>
                                   )}
                                   <button onClick={() => handleRemoveMember(m.userId)} className="w-full flex items-center space-x-3 px-4 py-2.5 text-[13px] font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-all">
                                     <Trash2 size={16} /> <span>Xóa khỏi nhóm</span>
                                   </button>
                                 </div>
                               )}
                             </div>
                           )}
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
                 <span className="text-[11px] font-black text-foreground/70 uppercase tracking-widest">Ảnh/Video đã chia sẻ</span>
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
                        <p className="text-xs font-bold italic tracking-tight">Chưa có ảnh/video nào</p>
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
                 <span className="text-[11px] font-black text-foreground/70 uppercase tracking-widest">File đã chia sẻ</span>
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
                              <p className="text-[14px] font-black text-slate-800 dark:text-slate-200 truncate leading-tight">{file.name || 'Tệp đính kèm'}</p>
                           </div>
                        </div>
                      ))
                   ) : (
                     <div className="text-center py-12 opacity-30">
                        <FileText size={32} className="mx-auto mb-3" />
                        <p className="text-xs font-bold italic tracking-tight">Chưa có file nào</p>
                     </div>
                   )}
                </div>
              )}
           </div>

           {/* Tùy chỉnh giao diện */}
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
                   <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleWallpaperChange} />
                   
                   <button 
                     onClick={() => fileInputRef.current?.click()}
                     disabled={isWallpaperLoading}
                     className="w-full flex items-center space-x-4 p-4 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-[24px] hover:scale-[1.02] active:scale-[0.98] transition-all group"
                   >
                      <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-500/20">
                         <ImageIcon size={20} />
                      </div>
                      <div className="text-left flex-1">
                         <p className="text-[14px] font-black">{isWallpaperLoading ? 'Đang cập nhật...' : 'Thay đổi ảnh nền'}</p>
                         <p className="text-[10px] font-bold opacity-60">Tùy chỉnh hình nền cho cuộc trò chuyện</p>
                      </div>
                   </button>

                   <button 
                     onClick={handleClearWallpaper}
                      disabled={isWallpaperLoading}
                     className="w-full flex items-center space-x-4 p-4 hover:bg-red-50 dark:hover:bg-red-500/10 text-red-500 rounded-[24px] transition-all group"
                   >
                      <div className="w-10 h-10 rounded-xl bg-background border border-red-500/20 flex items-center justify-center group-hover:bg-red-500 group-hover:text-white transition-all shadow-sm">
                         <TrashIcon size={18} />
                      </div>
                      <div className="text-left">
                         <p className="text-[14px] font-black">Xóa ảnh nền</p>
                         <p className="text-[10px] font-bold opacity-60">Quay về giao diện mặc định</p>
                      </div>
                   </button>
                </div>
              )}
           </div>
        </div>

        <div className="h-2 bg-slate-50 dark:bg-slate-900/50 my-6" />

        {/* Quyền riêng tư */}
        <div className="px-4 pb-12 space-y-3">
           <div className="py-2">
              <button 
                onClick={() => toggleSection('security')}
                className="w-full flex items-center justify-between px-5 py-3 hover:bg-surface-100 rounded-2xl transition-all"
              >
                 <span className="text-[11px] font-black text-foreground/70 uppercase tracking-widest">Quyền riêng tư</span>
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
                        <span className="text-[15px] font-black tracking-tight text-foreground">Rời nhóm</span>
                     </button>
                   )}
                   <button 
                    onClick={onClearHistory}
                    className="w-full flex items-center space-x-5 px-5 py-4 hover:bg-red-50 dark:hover:bg-red-500/10 text-red-500 rounded-[24px] transition-all group scale-100 hover:scale-[1.02] border border-transparent hover:border-red-100 dark:hover:border-red-500/20"
                   >
                      <div className="w-11 h-11 rounded-2xl bg-red-100/50 dark:bg-red-500/5 flex items-center justify-center group-hover:scale-110 transition-transform">
                         <Trash2 size={22} />
                      </div>
                      <span className="text-[15px] font-black tracking-tight text-foreground">Xóa lịch sử trò chuyện</span>
                   </button>
                   
                </div>
              )}
           </div>
        </div>
      </div>
    </div>
  );
};
export default ConversationInfo;
