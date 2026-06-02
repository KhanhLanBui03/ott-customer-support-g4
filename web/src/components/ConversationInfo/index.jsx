import React, { useState, useMemo } from 'react';
import { 
  Bell, Pin, Users, Clock, Hash, Image as ImageIcon, FileText, Link as LinkIcon, 
  Trash2, AlertTriangle, EyeOff, ChevronDown, ChevronRight, X, Download, PlayCircle,
  UserPlus, Shield, ShieldCheck, MoreVertical, LogOut, Palette, Search, Zap, Trash2 as TrashIcon,
  Edit3, Check, MessageSquareLock, QrCode
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { useChat } from '../../hooks/useChat';
import { useAuth } from '../../hooks/useAuth';
import { friendApi } from '../../api/friendApi';
import { chatApi } from '../../api/chatApi';
import { userApi } from '../../api/userApi';
import { updateConversationWallpaper, updateConversation } from '../../store/chatSlice';
import GroupAvatar from '../GroupAvatar';
import AIAssistantPanel from '../AIAssistantPanel';

const ConversationInfo = ({ conversation, onClose, onClearHistory, openLightbox, allChatImages }) => {
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const { messages, fetchConversations, inviteMember, removeMember, fetchFriends, friends: allFriends, selectConversation } = useChat();
  const fileInputRef = React.useRef(null);
  const avatarInputRef = React.useRef(null);
  const { user } = useAuth();

  const conversationId = conversation?.conversationId;
  const currentMember = useMemo(() => {
    const myId = String(user?.userId || user?.id || '').toLowerCase();
    return conversation.members?.find(m => {
      const memberId = String(m.userId || m.id || '').toLowerCase();
      return memberId && memberId === myId;
    });
  }, [conversation.members, user?.userId, user?.id]);
  const isOwner = currentMember?.role === 'OWNER';
  const isOnlyMember = conversation.type === 'GROUP' && conversation.members?.length === 1;
  const isAdmin = currentMember?.role === 'ADMIN' || isOwner || isOnlyMember;
  const currentMessages = useMemo(() => messages[conversationId] || [], [messages, conversationId]);

  const [sections, setSections] = useState({
    members: true,
    media: false,
    files: false,
    links: false,
    customization: true,
    security: true
  });

  const [isRestrictedLocal, setIsRestrictedLocal] = useState(conversation?.onlyAdminsCanChat || false);
  const [isApprovalRequiredLocal, setIsApprovalRequiredLocal] = useState(conversation?.memberApprovalRequired || false);

  React.useEffect(() => {
    setIsRestrictedLocal(conversation?.onlyAdminsCanChat || false);
  }, [conversation?.onlyAdminsCanChat]);

  React.useEffect(() => {
    setIsApprovalRequiredLocal(conversation?.memberApprovalRequired || false);
  }, [conversation?.memberApprovalRequired]);

  const [isInviting, setIsInviting] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [inviteSearch, setInviteSearch] = useState('');
  const [globalLoading, setGlobalLoading] = useState(false);
  const [globalError, setGlobalError] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState('');
  const [memberMenuId, setMemberMenuId] = useState(null);
  const [isWallpaperLoading, setIsWallpaperLoading] = useState(false);

  React.useEffect(() => {
    fetchFriends();
  }, [fetchFriends]);

  const [showQRModal, setShowQRModal] = useState(false);
  const [joinRequests, setJoinRequests] = useState([]);

  const fetchJoinRequests = React.useCallback(async () => {
    if (conversation.type === 'GROUP' && isAdmin) {
      try {
        const res = await chatApi.getPendingJoinRequests(conversationId);
        if (res?.success) {
          setJoinRequests(res.data || []);
        } else if (res?.data) {
          setJoinRequests(res.data);
        } else if (Array.isArray(res)) {
          setJoinRequests(res);
        }
      } catch (err) {
        console.error('Fetch join requests failed:', err);
      }
    }
  }, [conversation.type, conversationId, isAdmin]);

  React.useEffect(() => {
    fetchJoinRequests();

    const handleJoinRequestSocket = (event) => {
      const { conversationId: eventConvId, eventType } = event.detail;
      if (String(eventConvId) === String(conversationId)) {
        console.log(`[ConversationInfo] Updating join requests due to ${eventType}`);
        fetchJoinRequests();
      }
    };

    window.addEventListener('join-request-update', handleJoinRequestSocket);
    return () => {
      window.removeEventListener('join-request-update', handleJoinRequestSocket);
    };
  }, [fetchJoinRequests, conversationId]);

  const handleToggleMemberApproval = async () => {
    if (!isAdmin) return;
    const originalValue = isApprovalRequiredLocal;
    const newValue = !originalValue;

    // Optimistic Update
    setIsApprovalRequiredLocal(newValue);
    dispatch(updateConversation({
      conversationId,
      memberApprovalRequired: newValue
    }));

    try {
      await chatApi.toggleMemberApproval(conversationId);
      // No need to fetchConversations here as Redux is already updated
      // but we can still call it to be safe or if there are other side effects
      // fetchConversations();
    } catch (err) {
      console.error('Toggle member approval failed:', err);
      // Rollback
      setIsApprovalRequiredLocal(originalValue);
      dispatch(updateConversation({
        conversationId,
        memberApprovalRequired: originalValue
      }));
      alert(t('info.restriction_error'));
    }
  };

  const handleApproveRequest = async (requestId) => {
    try {
      await chatApi.approveJoinRequest(requestId);
      fetchJoinRequests();
      fetchConversations();
    } catch (err) {
      console.error('Approve join request failed:', err);
    }
  };

  const handleRejectRequest = async (requestId) => {
    try {
      await chatApi.rejectJoinRequest(requestId);
      fetchJoinRequests();
    } catch (err) {
      console.error('Reject join request failed:', err);
    }
  };

  

  const getFileIcon = (url) => {
    const getExt = (u) => {
      if (u.startsWith('blob:')) return 'file';
      return u.split('.').pop().split('?')[0].toLowerCase();
    };
    const ext = getExt(url);
    const colorClass =
      ext === 'pdf' ? 'bg-red-500' :
        ['doc', 'docx'].includes(ext) ? 'bg-blue-500' :
          ['xls', 'xlsx'].includes(ext) ? 'bg-emerald-500' :
            ['zip', 'rar', '7z'].includes(ext) ? 'bg-amber-500' :
              'bg-indigo-500';

    return (
      <div className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center text-white relative overflow-hidden flex-shrink-0 shadow-sm ${colorClass}`}>
        <FileText size={18} className="mb-[-2px] opacity-40" />
        <span className="text-[9px] font-black uppercase tracking-tighter leading-none">{ext}</span>
        <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent pointer-events-none" />
      </div>
    );
  };

  const handleFetchFriends = async () => {
    setIsInviting(true);
    setInviteSearch('');
    setGlobalError('');
    try {
      const response = await friendApi.getFriends();
      const inGroupIds = conversation.members?.map(m => m.userId) || [];
      const data = response?.data || response || [];
      const validFriends = Array.isArray(data) ? data.filter(f => f.status === 'ACCEPTED') : [];
      setSearchResults(validFriends.filter(f => !inGroupIds.includes(f.userId)));
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
        setGlobalError(t('info.already_in_group'));
        return;
      }

      setSearchResults([found]);
    } catch (err) {
      setGlobalError(t('info.not_found_user'));
    } finally {
      setGlobalLoading(false);
    }
  };

  const handleInvite = async (friendId) => {
    try {
      await inviteMember(conversationId, friendId);
      alert(t('info.invite_sent'));
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
    if (window.confirm(t('info.remove_member_confirm'))) {
      await removeMember(conversationId, memberUserId);
      setMemberMenuId(null);
    }
  };

  const handleLeaveGroup = async () => {
     if (window.confirm(t('info.leave_group_confirm'))) {
        try {
           await chatApi.leaveConversation(conversationId);
           selectConversation(null); // Clear active chat immediately
           fetchConversations();
           onClose();
        } catch (err) {
           console.error(err);
        }
     }
  };

  const handleDisbandGroup = async () => {
    if (window.confirm(t('info.disband_group_confirm'))) {
      try {
        await chatApi.disbandGroup(conversationId);
        selectConversation(null); // Clear active chat immediately
        fetchConversations();
        onClose();
      } catch (err) {
        console.error("Failed to disband group", err);
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
      alert(t('info.rename_error'));
    }
  };
  
  const handleToggleChatRestriction = async () => {
    if (!isAdmin) return;
    const originalValue = isRestrictedLocal;
    const newValue = !originalValue;

    // Optimistic Update
    setIsRestrictedLocal(newValue);
    dispatch(updateConversation({
      conversationId,
      onlyAdminsCanChat: newValue
    }));

    try {
      await chatApi.toggleChatRestriction(conversationId);
    } catch (err) {
      console.error('Toggle restriction failed:', err);
      // Rollback
      setIsRestrictedLocal(originalValue);
      dispatch(updateConversation({
        conversationId,
        onlyAdminsCanChat: originalValue
      }));
      alert(t('info.restriction_error'));
    }
  };

  const mediaItems = useMemo(() => {
    return allChatImages;
  }, [allChatImages]);

  const fileItems = useMemo(() => {
    const items = [];
    currentMessages.forEach(msg => {
      if (msg.mediaUrls) {
        msg.mediaUrls.forEach(url => {
          const isMedia = url.match(/\.(jpeg|jpg|gif|png|webp|svg|mp4|webm|ogg)/i);
          if (!isMedia) {
            const decoded = decodeURIComponent(url);
            const cleanUrl = decoded.split('?')[0];
            let name = cleanUrl.split('/').pop();
            const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}_/i;
            name = name.replace(uuidPattern, '');
            const longPrefixPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}_[0-9]+_/i;
            name = name.replace(longPrefixPattern, '');
            
            items.push({ url, name, createdAt: msg.createdAt, metadata: msg.metadata });
          }
        });
      }
    });
    return items.reverse();
  }, [currentMessages]);

  const linkItems = useMemo(() => {
    const items = [];
    currentMessages.forEach(msg => {
      if (msg.type !== 'TEXT') return;
      const text = msg.content || msg.messageText || '';
      if (text) {
        const urls = text.match(/https?:\/\/[^\s]+/gi);
        if (urls) {
          urls.forEach(url => {
            const lowerUrl = url.toLowerCase();
            if (
              lowerUrl.includes('/chat-media/') ||
              lowerUrl.includes('/uploads/') ||
              lowerUrl.includes('/voice-messages/') ||
              lowerUrl.includes('/chat-wallpaper/') ||
              lowerUrl.includes('/avatars/') ||
              lowerUrl.includes('amazonaws.com') ||
              lowerUrl.includes('s3.') ||
              lowerUrl.includes('dicebear.com')
            ) {
              return;
            }
            items.push({ url, text, createdAt: msg.createdAt });
          });
        }
      }
    });
    return items.reverse();
  }, [currentMessages]);

  const handleWallpaperChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert(t('info.file_too_large'));
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
      alert(t('info.wallpaper_error'));
    } finally {
      setIsWallpaperLoading(false);
      e.target.value = '';
    }
  };

  const handleAvatarChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert(t('info.file_too_large'));
      return;
    }

    setGlobalLoading(true);
    try {
      const uploadRes = await chatApi.uploadMedia(file, 'avatars');
      const avatarUrl = uploadRes?.mediaUrl || uploadRes?.data?.mediaUrl || uploadRes?.url || uploadRes?.data?.url;

      if (!avatarUrl) {
        throw new Error('Không lấy được URL ảnh từ server');
      }

      await chatApi.updateConversationAvatar(conversationId, avatarUrl);
      fetchConversations();
    } catch (err) {
      console.error('Update avatar failed:', err);
      alert(t('info.rename_error'));
    } finally {
      setGlobalLoading(false);
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
      alert(t('info.wallpaper_error'));
    } finally {
      setIsWallpaperLoading(false);
    }
  };

  if (!conversation) return null;

  const toggleSection = (section) => {
    setSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const getRoleLabel = (role) => {
    if (role === 'OWNER') return t('info.role_owner');
    if (role === 'ADMIN') return t('info.role_admin');
    return t('info.role_member');
  };

  const getRoleColor = (role) => {
    if (role === 'OWNER') return 'text-indigo-500';
    if (role === 'ADMIN') return 'text-emerald-500';
    return 'text-slate-400 dark:text-slate-600';
  };

  return (
    <div className="w-full lg:w-[360px] h-full bg-sidebar border-l border-border flex flex-col overflow-hidden animate-slide-left shadow-2xl z-40 transition-colors">
      <div className="h-[72px] px-6 border-b border-border flex items-center justify-between flex-shrink-0 glass-premium z-10">
        <h3 className="text-[17px] font-black text-foreground tracking-tight">{t('info.title')}</h3>
        <button onClick={onClose} className="p-2.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-400 transition-all active:scale-90">
          <X size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar pb-12">
        <div className="p-10 flex flex-col items-center text-center space-y-5">
          <div className="relative group">
            <GroupAvatar conversation={conversation} size="w-28 h-28" isLarge />
            {conversation.type === 'GROUP' && (
              <>
                <div className="absolute -bottom-1 -right-1 w-9 h-9 bg-indigo-500 rounded-2xl shadow-xl flex items-center justify-center text-white border-4 border-white dark:border-[#0b0e14]">
                    <Users size={16} />
                </div>
                {isAdmin && (
                  <button 
                    onClick={() => avatarInputRef.current?.click()}
                    className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity cursor-pointer overflow-hidden"
                    title={t('info.change_avatar')}
                  >
                    <ImageIcon size={24} />
                    <input 
                      type="file" 
                      ref={avatarInputRef}
                      onChange={handleAvatarChange}
                      className="hidden" 
                      accept="image/*"
                    />
                  </button>
                )}
              </>
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
                <h4 className="text-xl font-black text-foreground tracking-tight">
                  {conversation.type === 'GROUP' 
                    ? (conversation.name || t('info.group_chat'))
                    : (conversation.name || (() => {
                        const otherMember = conversation.members?.find(m => String(m.userId || m.id) !== String(user?.userId || user?.id));
                        return otherMember?.fullName || otherMember?.name || t('info.friends');
                      })())}
                </h4>
                {conversation.type === 'GROUP' && isAdmin && (
                  <button 
                    onClick={() => { setEditName(conversation.name || ''); setIsEditingName(true); }}
                    className="p-1.5 opacity-0 group-hover/name:opacity-100 hover:bg-surface-200 rounded-lg text-foreground/40 hover:text-indigo-500 transition-all"
                    title={t('info.change_name')}
                  >
                    <Edit3 size={14} />
                  </button>
                )}
              </div>
            )}
            <div className="flex items-center justify-center space-x-2">
               <span className="text-[10px] font-black uppercase tracking-[0.25em] text-emerald-500 bg-emerald-500/10 px-3 py-1 rounded-full">
                 {conversation.type === 'GROUP' ? t('info.member_count', { count: conversation.members?.length || 0 }) : t('info.active')}
               </span>
            </div>
          </div>
        </div>

        <div className="h-2 bg-slate-50 dark:bg-slate-900/50" />

        {/* Mã QR Nhóm (Cho tất cả thành viên) */}
        {conversation.type === 'GROUP' && (
          <div className="px-4 py-3">
             <button 
               onClick={() => setShowQRModal(true)}
               className="w-full flex items-center space-x-4 p-4 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-[24px] hover:scale-[1.02] active:scale-[0.98] transition-all group cursor-pointer"
             >
                <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-500/20">
                   <QrCode size={20} />
                </div>
                <div className="text-left flex-1">
                   <p className="text-[14px] font-black">Mã QR nhóm</p>
                   <p className="text-[10px] font-bold opacity-60">Quét mã QR để gia nhập nhóm nhanh chóng</p>
                </div>
             </button>
          </div>
        )}

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
                 <span className="text-[11px] font-black text-foreground/70 uppercase tracking-widest">{t('info.members')}</span>
                 {sections.members ? <ChevronDown size={18} className="text-foreground/70" /> : <ChevronRight size={18} className="text-foreground/70" />}
              </button>
              
              {sections.members && (
                 <div className="mt-4 space-y-3 px-2">
                    {isAdmin && joinRequests && joinRequests.length > 0 && (
                      <div className="bg-amber-500/5 border border-amber-500/20 rounded-[24px] p-4 mb-3 space-y-3">
                        <p className="text-[12px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-wider">Yêu cầu gia nhập ({joinRequests.length})</p>
                        <div className="space-y-2.5">
                          {joinRequests.map(req => (
                            <div key={req.requestId} className="flex items-center justify-between bg-white dark:bg-slate-800 p-3 rounded-2xl border border-border">
                              <div className="flex items-center space-x-3">
                                <div className="w-9 h-9 rounded-xl bg-surface-200 overflow-hidden">
                                  {req.avatarUrl ? (
                                    <img src={req.avatarUrl} className="w-full h-full object-cover" />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center text-xs font-bold text-foreground/40">{req.fullName?.charAt(0)}</div>
                                  )}
                                </div>
                                <div className="text-left">
                                  <p className="text-sm font-bold text-foreground leading-tight">{req.fullName}</p>
                                  <p className="text-[10px] text-foreground/50 mt-0.5">Muốn tham gia nhóm</p>
                                </div>
                              </div>
                              <div className="flex space-x-1.5">
                                <button 
                                  onClick={() => handleApproveRequest(req.requestId)}
                                  className="px-3 py-1.5 bg-indigo-500 text-white rounded-xl text-xs font-bold hover:bg-indigo-600 transition-colors"
                                >
                                  Duyệt
                                </button>
                                <button 
                                  onClick={() => handleRejectRequest(req.requestId)}
                                  className="px-3 py-1.5 bg-slate-200 dark:bg-slate-700 text-foreground rounded-xl text-xs font-bold hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
                                >
                                  Từ chối
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {(isAdmin || !isApprovalRequiredLocal) && (
                      <button 
                        onClick={handleFetchFriends}
                        className="w-full flex items-center space-x-4 p-4 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-[24px] hover:scale-[1.02] active:scale-[0.98] transition-all group"
                      >
                         <div className="w-10 h-10 rounded-xl bg-indigo-500 text-white flex items-center justify-center shadow-lg shadow-indigo-500/20">
                            <UserPlus size={18} />
                          </div>
                         <span className="text-[14px] font-black">{t('info.add_member')}</span>
                      </button>
                    )}

                    {/* Invite Modal Inline */}
                    {isInviting && (
                      <div className="bg-surface-100 dark:bg-surface-200 rounded-[24px] p-4 space-y-3 border border-border animate-msg">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-black uppercase tracking-widest text-foreground/60">{t('info.invite_friends')}</span>
                          <button onClick={() => setIsInviting(false)} className="p-1 hover:bg-surface-200 rounded-lg"><X size={16} className="text-foreground/40" /></button>
                        </div>
                        <div className="flex space-x-2">
                          <input 
                            type="text" 
                            placeholder={t('info.search_phone_placeholder')}
                            value={inviteSearch} 
                            onChange={(e) => setInviteSearch(e.target.value)}
                            className="flex-1 bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-foreground placeholder:text-foreground/30"
                          />
                          <button onClick={handleGlobalSearch} className="px-4 py-2 bg-indigo-500 text-white rounded-xl text-sm font-bold hover:bg-indigo-600 transition-colors">
                            <Search size={16} />
                          </button>
                        </div>
                        {globalError && <p className="text-xs text-red-500 font-bold">{globalError}</p>}
                        {searchResults.map(f => (
                          <div key={f.userId} className="flex items-center justify-between p-3 hover:bg-surface-200 dark:hover:bg-white/5 rounded-2xl transition-all">
                            <div className="flex items-center space-x-3">
                              <div className="w-9 h-9 rounded-xl bg-surface-200 overflow-hidden">
                                {f.avatarUrl ? <img src={f.avatarUrl} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-xs font-bold text-foreground/40">{f.fullName?.charAt(0)}</div>}
                              </div>
                              <span className="text-sm font-bold text-foreground">{f.fullName}</span>
                            </div>
                            <button onClick={() => handleInvite(f.userId)} className="px-3 py-1.5 bg-indigo-500 text-white rounded-xl text-xs font-bold hover:bg-indigo-600 transition-colors">{t('info.invite')}</button>
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
                                   {m.userId === (user?.userId || user?.id) && <span className="text-xs font-bold text-foreground/40 ml-1">{t('info.you')}</span>}
                                 </p>
                                 <div className="flex items-center space-x-2 mt-0.5">
                                    <span className={`text-[9px] font-black uppercase tracking-[0.15em] ${getRoleColor(m.role)}`}>
                                      {getRoleLabel(m.role)}
                                    </span>
                                 </div>
                              </div>
                           </div>
                           
                           {/* Menu 3 chấm cho quản lý thành viên */}
                           {isAdmin && m.userId !== (user?.userId || user?.id) && !(currentMember?.role === 'ADMIN' && m.role === 'OWNER') && (
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
                                       <ShieldCheck size={16} className="text-emerald-500" /> <span>{t('info.promote_admin')}</span>
                                     </button>
                                   )}
                                   {isOwner && m.role === 'ADMIN' && (
                                     <button onClick={() => handleDemote(m.userId)} className="w-full flex items-center space-x-3 px-4 py-2.5 text-[13px] font-bold text-foreground hover:bg-surface-100 rounded-xl transition-all">
                                       <Shield size={16} className="text-slate-400" /> <span>{t('info.demote_admin')}</span>
                                     </button>
                                   )}
                                   <button onClick={() => handleRemoveMember(m.userId)} className="w-full flex items-center space-x-3 px-4 py-2.5 text-[13px] font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-all">
                                     <Trash2 size={16} /> <span>{t('info.remove_from_group')}</span>
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
                 <span className="text-[11px] font-black text-foreground/70 uppercase tracking-widest">{t('info.shared_media')}</span>
                 {sections.media ? <ChevronDown size={18} className="text-foreground/70" /> : <ChevronRight size={18} className="text-foreground/70" />}
              </button>
              {sections.media && (
                <div className="mt-4 px-2">
                   {mediaItems.length > 0 ? (
                     <div className="grid grid-cols-3 gap-3">
                        {mediaItems.slice(0, 12).map((item, idx) => (
                          <div
                            key={idx}
                            className="aspect-square rounded-xl overflow-hidden cursor-pointer relative group"
                            onClick={() => openLightbox(mediaItems, idx)}
                          >
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
                        <p className="text-xs font-bold italic tracking-tight">{t('info.no_media')}</p>
                     </div>
                   )}
                   {mediaItems.length > 12 && (
                     <button 
                       onClick={() => openLightbox(mediaItems, 0)}
                       className="w-full mt-4 py-3 bg-surface-100 hover:bg-indigo-500 hover:text-white text-foreground/70 text-[11px] font-black uppercase tracking-widest rounded-2xl transition-all shadow-sm active:scale-95"
                     >
                       {t('info.view_all_media', { count: mediaItems.length })}
                     </button>
                   )}
                </div>
              )}
           </div>

           <div className="py-2">
              <button 
                onClick={() => toggleSection('files')}
                className="w-full flex items-center justify-between px-5 py-3 hover:bg-surface-100 rounded-2xl transition-all"
              >
                 <span className="text-[11px] font-black text-foreground/70 uppercase tracking-widest">{t('info.shared_files')}</span>
                 {sections.files ? <ChevronDown size={18} className="text-foreground/70" /> : <ChevronRight size={18} className="text-foreground/70" />}
              </button>
              {sections.files && (
                <div className="mt-3 space-y-2 px-2">
                   {fileItems.length > 0 ? (
                      fileItems.slice(0, 5).map((file, idx) => (
                        <div key={idx} onClick={() => window.open(file.url, '_blank')} className="flex items-center space-x-4 p-4 hover:bg-white dark:hover:bg-white/5 rounded-[24px] border border-transparent hover:border-slate-100 dark:hover:border-slate-800 transition-all group shadow-sm hover:shadow-lg hover:scale-[1.02] cursor-pointer active:scale-[0.98]">
                           {getFileIcon(file.url)}
                           <div className="flex-1 min-w-0">
                              <p className="text-[14px] font-black text-slate-800 dark:text-slate-200 truncate leading-tight">{file.name || t('chat.attachment')}</p>
                           </div>
                        </div>
                      ))
                   ) : (
                     <div className="text-center py-12 opacity-30">
                        <FileText size={32} className="mx-auto mb-3" />
                        <p className="text-xs font-bold italic tracking-tight">{t('info.no_files')}</p>
                     </div>
                   )}
                </div>
              )}
           </div>

            <div className="py-2">
               <button 
                 onClick={() => toggleSection('links')}
                 className="w-full flex items-center justify-between px-5 py-3 hover:bg-surface-100 rounded-2xl transition-all"
               >
                  <span className="text-[11px] font-black text-foreground/70 uppercase tracking-widest">{t('info.shared_links')}</span>
                  {sections.links ? <ChevronDown size={18} className="text-foreground/70" /> : <ChevronRight size={18} className="text-foreground/70" />}
               </button>
               {sections.links && (
                 <div className="mt-3 space-y-2 px-2">
                    {linkItems.length > 0 ? (
                       linkItems.slice(0, 5).map((item, idx) => (
                         <div key={idx} onClick={() => window.open(item.url, '_blank')} className="flex items-center space-x-4 p-4 hover:bg-white dark:hover:bg-white/5 rounded-[24px] border border-transparent hover:border-slate-100 dark:hover:border-slate-800 transition-all group shadow-sm hover:shadow-lg hover:scale-[1.02] cursor-pointer active:scale-[0.98]">
                            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-500 shrink-0">
                               <LinkIcon size={18} />
                            </div>
                            <div className="flex-1 min-w-0">
                               <p className="text-[14px] font-black text-slate-800 dark:text-slate-200 truncate leading-tight">{item.url}</p>
                               {item.text !== item.url && (
                                 <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate mt-1">{item.text}</p>
                               )}
                            </div>
                         </div>
                       ))
                    ) : (
                      <div className="text-center py-12 opacity-30">
                         <LinkIcon size={32} className="mx-auto mb-3" />
                         <p className="text-xs font-bold italic tracking-tight">{t('info.no_links')}</p>
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
                   <span className="text-[11px] font-black text-foreground/70 uppercase tracking-widest">{t('info.customization')}</span>
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
                         <p className="text-[14px] font-black">{isWallpaperLoading ? t('info.updating') : t('info.change_wallpaper')}</p>
                         <p className="text-[10px] font-bold opacity-60">{t('info.change_wallpaper_desc')}</p>
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
                         <p className="text-[14px] font-black">{t('info.clear_wallpaper')}</p>
                         <p className="text-[10px] font-bold opacity-60">{t('info.clear_wallpaper_desc')}</p>
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
                 <span className="text-[11px] font-black text-foreground/70 uppercase tracking-widest">{t('info.privacy')}</span>
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
                        <span className="text-[15px] font-black tracking-tight text-foreground">{t('info.leave_group')}</span>
                     </button>
                   )}
                   {conversation.type === 'GROUP' && (
                     <button 
                       onClick={isOwner ? handleDisbandGroup : undefined}
                       disabled={!isOwner}
                       className={`w-full flex items-center space-x-5 px-5 py-4 rounded-[24px] transition-all border border-transparent ${
                         isOwner 
                           ? 'hover:bg-red-50 dark:hover:bg-red-500/10 text-red-600 group scale-100 hover:scale-[1.02] hover:border-red-100 dark:hover:border-red-500/20 cursor-pointer' 
                           : 'text-foreground/40 cursor-not-allowed bg-surface-100 dark:bg-surface-200 opacity-60'
                       }`}
                     >
                        <div className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-transform ${
                          isOwner 
                            ? 'bg-red-100/50 dark:bg-red-500/5 group-hover:scale-110 text-red-600' 
                            : 'bg-surface-200 dark:bg-surface-300 text-foreground/40'
                        }`}>
                           <AlertTriangle size={22} />
                        </div>
                        <div className="flex flex-col items-start text-left">
                          <span className="text-[15px] font-black tracking-tight text-inherit">{t('info.disband_group')}</span>
                          {!isOwner && <span className="text-[10px] font-bold opacity-70 mt-0.5">{t('info.only_owner_permit')}</span>}
                        </div>
                     </button>
                   )}
                   {conversation.type === 'GROUP' && (
                     <button 
                        onClick={isAdmin ? handleToggleChatRestriction : undefined}
                        disabled={!isAdmin}
                        className={`w-full flex items-center space-x-5 px-5 py-4 rounded-[24px] transition-all border border-transparent ${
                          isAdmin 
                            ? 'hover:bg-indigo-50 dark:hover:bg-indigo-500/10 text-indigo-600 group scale-100 hover:scale-[1.02] hover:border-indigo-100 dark:hover:border-indigo-500/20 cursor-pointer' 
                            : 'text-foreground/40 cursor-not-allowed bg-surface-100 dark:bg-surface-200 opacity-60'
                        }`}
                     >
                        <div className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-transform ${
                          isAdmin 
                            ? 'bg-indigo-100/50 dark:bg-indigo-500/5 group-hover:scale-110 text-indigo-600' 
                            : 'bg-surface-200 dark:bg-surface-300 text-foreground/40'
                        }`}>
                           <MessageSquareLock size={22} />
                        </div>
                        <div className="flex flex-col items-start text-left flex-1">
                          <span className="text-[15px] font-black tracking-tight text-inherit">{t('info.chat_restriction')}</span>
                          <span className="text-[10px] font-bold opacity-70 mt-0.5">
                            {isRestrictedLocal ? t('info.enabled') : t('info.disabled')} • {isAdmin ? t('info.admin_can_change') : t('info.admin_permit_only')}
                          </span>
                        </div>
                        <div className={`w-11 h-6 rounded-full relative transition-all duration-300 ${isRestrictedLocal ? 'bg-indigo-600 shadow-inner' : 'bg-slate-200 dark:bg-slate-700'}`}>
                           <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-300 ${isRestrictedLocal ? 'translate-x-5' : 'translate-x-0'}`} />
                        </div>
                     </button>
                   )}
                    {conversation.type === 'GROUP' && (
                      <button 
                         onClick={isAdmin ? handleToggleMemberApproval : undefined}
                         disabled={!isAdmin}
                         className={`w-full flex items-center space-x-5 px-5 py-4 rounded-[24px] transition-all border border-transparent ${
                           isAdmin 
                             ? 'hover:bg-indigo-50 dark:hover:bg-indigo-500/10 text-indigo-600 group scale-100 hover:scale-[1.02] hover:border-indigo-100 dark:hover:border-indigo-500/20 cursor-pointer' 
                             : 'text-foreground/40 cursor-not-allowed bg-surface-100 dark:bg-surface-200 opacity-60'
                         }`}
                      >
                         <div className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-transform ${
                           isAdmin 
                             ? 'bg-indigo-100/50 dark:bg-indigo-500/5 group-hover:scale-110 text-indigo-600' 
                             : 'bg-surface-200 dark:bg-surface-300 text-foreground/40'
                         }`}>
                            <ShieldCheck size={22} />
                         </div>
                         <div className="flex flex-col items-start text-left flex-1">
                           <span className="text-[15px] font-black tracking-tight text-inherit">{t('info.member_approval')}</span>
                           <span className="text-[10px] font-bold opacity-70 mt-0.5">
                             {isApprovalRequiredLocal ? t('info.enabled') : t('info.disabled')} • {isAdmin ? t('info.admin_can_change') : t('info.admin_permit_only')}
                           </span>
                         </div>
                         <div className={`w-11 h-6 rounded-full relative transition-all duration-300 ${isApprovalRequiredLocal ? 'bg-indigo-600 shadow-inner' : 'bg-slate-200 dark:bg-slate-700'}`}>
                            <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-300 ${isApprovalRequiredLocal ? 'translate-x-5' : 'translate-x-0'}`} />
                         </div>
                      </button>
                    )}
                    

                    {conversation.type === 'SINGLE' && !conversation.isAI && (() => {
                      const otherMember = conversation.members?.find(m => {
                        const mId = String(m.userId || m.id || '');
                        const uId = String(user?.id || user?.userId || '');
                        return mId !== uId && mId !== '';
                      });
                      const otherMemberId = otherMember?.userId || otherMember?.id;
                      const friendInfo = Array.isArray(allFriends) && allFriends.find(f => {
                        const fId = String(f.userId || f.id || f.friendId || '').toLowerCase();
                        return fId !== '' && fId === otherMemberId?.toLowerCase();
                      });
                      const isBlocked = friendInfo?.status === 'BLOCKED';
                      const iBlockedThem = isBlocked && friendInfo?.isRequester;
                      const theyBlockedMe = isBlocked && !friendInfo?.isRequester;

                      if (!otherMemberId) return null;
                      if (theyBlockedMe) return null; // Can't block/unblock if already blocked by them

                      return (
                        <button 
                          onClick={async () => {
                            if (iBlockedThem) {
                              try {
                                await friendApi.unblockUser(otherMemberId);
                                await fetchFriends();
                                await fetchConversations();
                                alert(t('info.unblocked_success', { name: otherMember.fullName || t('call.unknown_user') }));
                              } catch (err) {
                                console.error("Unblock failed:", err);
                                alert(t('info.unblock_failed'));
                              }
                            } else {
                              if (window.confirm(t('info.block_user_confirm', { name: otherMember.fullName || t('call.unknown_user') }))) {
                                try {
                                  await friendApi.blockUser(otherMemberId);
                                  await fetchFriends();
                                  await fetchConversations();
                                  onClose();
                                } catch (err) {
                                  console.error("Block failed:", err);
                                  alert(t('info.block_failed'));
                                }
                              }
                            }
                          }}
                          className={`w-full flex items-center space-x-5 px-5 py-4 rounded-[24px] transition-all group scale-100 hover:scale-[1.02] border border-transparent ${
                            isBlocked 
                              ? 'hover:bg-emerald-50 dark:hover:bg-emerald-500/10 text-emerald-600 hover:border-emerald-100 dark:hover:border-emerald-500/20' 
                              : 'hover:bg-red-50 dark:hover:bg-red-500/10 text-red-500 hover:border-red-100 dark:hover:border-red-500/20'
                          }`}
                        >
                          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform ${
                            isBlocked ? 'bg-emerald-100/50 dark:bg-emerald-500/5 text-emerald-600' : 'bg-red-100/50 dark:bg-red-500/5 text-red-500'
                          }`}>
                              {isBlocked ? <ShieldCheck size={22} /> : <Shield size={22} />}
                          </div>
                          <span className="text-[15px] font-black tracking-tight text-foreground">
                            {iBlockedThem ? t('info.unblock_user') : t('info.block_user')}
                          </span>
                        </button>
                      );
                    })()}
                   
                </div>
              )}
           </div>
        </div>

      {/* Group QR Code Modal */}
      {showQRModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[999] animate-fade-in">
          <div className="bg-sidebar border border-border w-[380px] rounded-[32px] p-6 shadow-2xl space-y-6 relative animate-scale-up">
            <button 
              onClick={() => setShowQRModal(false)}
              className="absolute top-4 right-4 p-2 hover:bg-surface-200 rounded-full text-foreground/50 hover:text-foreground transition-all cursor-pointer"
            >
              <X size={18} />
            </button>

            <div className="text-center space-y-1">
              <h3 className="text-lg font-black text-foreground">Mã QR nhóm</h3>
              <p className="text-xs text-foreground/65">Quét mã này bằng camera hoặc scanner để gia nhập nhóm</p>
            </div>

            <div className="bg-white p-6 rounded-[24px] flex items-center justify-center shadow-inner border border-slate-100 mx-auto w-fit">
              <QRCodeSVG 
                value={`GROUP_JOIN:${conversationId}`} 
                size={220}
                level="H"
                includeMargin={true}
              />
            </div>

            <div className="text-center space-y-2">
              <p className="text-sm font-bold text-foreground truncate max-w-full px-2">{conversation.name}</p>
              <p className="text-[11px] text-indigo-500 font-bold bg-indigo-500/10 px-3 py-1 rounded-full w-fit mx-auto">
                {conversation.members?.length || 0} thành viên
              </p>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
};
export default ConversationInfo;
