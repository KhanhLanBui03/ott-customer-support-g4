import React, { useState, useMemo } from 'react';
import { 
  Bell, Pin, Users, Clock, Hash, Image as ImageIcon, FileText, Link as LinkIcon, 
  Trash2, AlertTriangle, EyeOff, ChevronDown, ChevronRight, X, Download, PlayCircle,
  UserPlus, Shield, ShieldCheck, MoreVertical, LogOut
} from 'lucide-react';
import { useChat } from '../../hooks/useChat';
import { useAuth } from '../../hooks/useAuth';
import { friendApi } from '../../api/friendApi';
import { chatApi } from '../../api/chatApi';
import { userApi } from '../../api/userApi';
import { Search, Zap } from 'lucide-react';

const ConversationInfo = ({ conversation, onClose, onClearHistory }) => {
  const { messages, fetchConversations, inviteMember, removeMember } = useChat();
  const { user } = useAuth();
  const [sections, setSections] = useState({
    members: true,
    media: false,
    files: false,
    links: false,
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
  // Failsafe: If it's a group and there's only 1 member (the current user), treat them as Admin
  const isOnlyMember = conversation.type === 'GROUP' && conversation.members?.length === 1;
  const isAdmin = currentMember?.role === 'ADMIN' || isOwner || isOnlyMember;

  const handleFetchFriends = async () => {
    setIsInviting(true);
    setInviteSearch('');
    setGlobalError('');
    try {
      const response = await friendApi.getFriends();
      // Filter out people already in group
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
      
      // Check if already in group
      const inGroupIds = conversation.members?.map(m => m.userId) || [];
      if (inGroupIds.includes(found.userId)) {
        setGlobalError('Người này đã có trong nhóm');
        return;
      }

      setFriends([found]); // Show the found user in the list
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

  // Extract all media items from all messages
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
    return items.reverse(); // Newest first
  }, [currentMessages]);

  // Extract all files from all messages
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
      {/* Header */}
      <div className="h-[72px] px-6 border-b border-border flex items-center justify-between flex-shrink-0 glass-premium z-10">
        <h3 className="text-[17px] font-black text-foreground tracking-tight">Conversation Info</h3>
        <button onClick={onClose} className="p-2.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-400 transition-all active:scale-90">
          <X size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar pb-12">
        {/* Profile Info */}
        <div className="p-10 flex flex-col items-center text-center space-y-5">
          <div className="relative group">
            <div className="w-28 h-28 rounded-[36px] bg-indigo-50 dark:bg-slate-800 p-1 border-2 border-white dark:border-slate-700 shadow-2xl overflow-hidden group-hover:scale-105 transition-transform duration-500">
               {conversation.avatarUrl || conversation.avatar ? (
                 <img src={conversation.avatarUrl || conversation.avatar} alt="" className="w-full h-full object-cover rounded-[32px]" />
               ) : (
                 <div className="w-full h-full flex items-center justify-center text-3xl font-black text-slate-300 dark:text-slate-600 font-serif italic uppercase">
                    {conversation.name?.charAt(0) || 'C'}
                 </div>
               )}
            </div>
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
                className="w-full flex items-center justify-between px-5 py-3 hover:bg-slate-50 dark:hover:bg-white/5 rounded-2xl transition-all"
              >
                 <span className="text-[11px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-widest">Group Members</span>
                 {sections.members ? <ChevronDown size={18} className="text-slate-400" /> : <ChevronRight size={18} className="text-slate-400" />}
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

                    {isInviting && (
                       <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-fade-in">
                          <div className="bg-white dark:bg-[#1a1e26] w-full max-w-sm rounded-[36px] shadow-3xl overflow-hidden flex flex-col max-h-[75vh] animate-msg border border-white/10">
                             <div className="p-8 border-b border-slate-50 dark:border-slate-800 flex items-center justify-between bg-white/50 dark:bg-white/5 backdrop-blur-xl">
                                <h4 className="font-black text-slate-900 dark:text-white text-lg tracking-tight">Add to Group</h4>
                                <button onClick={() => setIsInviting(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-colors">
                                  <X size={20} className="text-slate-400" />
                                </button>
                             </div>
                             
                             <div className="p-6 bg-slate-50/50 dark:bg-black/20">
                                <div className="relative group">
                                   <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={18} />
                                   <input 
                                      type="text"
                                      placeholder="Search by name or ID..."
                                      value={inviteSearch}
                                      onChange={(e) => setInviteSearch(e.target.value)}
                                      onKeyDown={(e) => e.key === 'Enter' && handleGlobalSearch()}
                                      className="w-full pl-12 pr-24 py-3.5 bg-white dark:bg-slate-800 border-2 border-transparent focus:border-indigo-500/20 rounded-2xl text-[15px] font-bold text-slate-700 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-600 focus:outline-none transition-all shadow-sm"
                                   />
                                   <button 
                                      onClick={handleGlobalSearch}
                                      disabled={globalLoading}
                                      className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-2 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-indigo-700 transition-all disabled:opacity-50"
                                   >
                                      {globalLoading ? 'Scanning...' : 'SCAN'}
                                   </button>
                                </div>
                             </div>

                             <div className="flex-1 overflow-y-auto p-6 space-y-3 no-scrollbar dark:bg-black/10">
                                <p className="text-[10px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-[0.2em] px-2 mb-2">
                                   {inviteSearch ? 'Matching Nodes' : 'Frequent Contacts'}
                                </p>
                                {friends.map(f => (
                                   <div key={f.userId} className="flex items-center justify-between p-3.5 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-[24px] transition-all border border-transparent hover:border-indigo-500/10">
                                      <div className="flex items-center space-x-4">
                                         <div className="w-11 h-11 rounded-2xl bg-slate-200 dark:bg-slate-700 border-2 border-white dark:border-slate-800 overflow-hidden shadow-sm">
                                            {(f.avatarUrl || f.avatar) && <img src={f.avatarUrl || f.avatar} className="w-full h-full object-cover" />}
                                         </div>
                                         <div className="min-w-0">
                                            <p className="text-[15px] font-black text-slate-800 dark:text-slate-200 truncate leading-tight">{f.fullName}</p>
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter mt-0.5">{f.phoneNumber || 'Signal Link'}</p>
                                         </div>
                                      </div>
                                      <button 
                                        onClick={() => handleInvite(f.userId)}
                                        className="px-5 py-2 bg-indigo-500 text-white text-[10px] font-black rounded-xl uppercase tracking-widest hover:bg-indigo-600 transition-all shadow-lg shadow-indigo-500/20 active:scale-90"
                                      >
                                        Invite
                                      </button>
                                   </div>
                                ))}
                                {friends.length === 0 && !globalLoading && (
                                   <div className="text-center py-16 opacity-40">
                                      <AlertTriangle size={32} className="mx-auto mb-4 text-slate-400" />
                                      <p className="text-sm font-bold text-slate-500 italic">No available subjects detected</p>
                                   </div>
                                )}
                             </div>
                          </div>
                       </div>
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
                                 <p className="text-[15px] font-black text-slate-800 dark:text-slate-200 truncate leading-tight">{m.fullName} {m.userId === user?.userId && '(You)'}</p>
                                 <div className="flex items-center space-x-2 mt-0.5">
                                    {m.role === 'OWNER' && <ShieldCheck size={12} className="text-indigo-500" />}
                                    {m.role === 'ADMIN' && <Shield size={12} className="text-emerald-500" />}
                                    <span className={`text-[9px] font-black uppercase tracking-[0.15em] ${
                                      m.role === 'OWNER' ? 'text-indigo-500' : m.role === 'ADMIN' ? 'text-emerald-500' : 'text-slate-400 dark:text-slate-600'
                                    }`}>
                                      {m.role === 'OWNER' ? 'Prime Owner' : m.role === 'ADMIN' ? 'Technician' : 'Participant'}
                                    </span>
                                 </div>
                              </div>
                           </div>
                           
                           {isAdmin && m.userId !== user?.userId && m.role !== 'OWNER' && (
                             <div className="flex items-center space-x-1 opacity-0 group-hover/member:opacity-100 transition-all">
                                {isOwner && m.role === 'MEMBER' && (
                                  <button 
                                    onClick={() => handlePromote(m.userId)}
                                    className="p-2 text-slate-400 hover:text-emerald-500 hover:bg-emerald-500/10 rounded-xl transition-all"
                                    title="Promote to Admin"
                                  >
                                    <Shield size={16} />
                                  </button>
                                )}
                                <button 
                                  onClick={() => handleRemoveMember(m.userId)}
                                  className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
                                  title="Eject Member"
                                >
                                  <Trash2 size={16} />
                                </button>
                             </div>
                           )}
                        </div>
                      ))}
                    </div>
                 </div>
              )}
              <div className="h-px bg-slate-100 dark:bg-slate-800 my-4 mx-4" />
           </div>
        )}

        {/* Media/Files/Links */}
        <div className="px-4 space-y-2">
           {/* Photos / Videos */}
           <div className="py-2">
              <button 
                onClick={() => toggleSection('media')}
                className="w-full flex items-center justify-between px-5 py-3 hover:bg-slate-50 dark:hover:bg-white/5 rounded-2xl transition-all"
              >
                 <span className="text-[11px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-widest">Shared Nodes (Media)</span>
                 {sections.media ? <ChevronDown size={18} className="text-slate-400" /> : <ChevronRight size={18} className="text-slate-400" />}
              </button>
              {sections.media && (
                <div className="mt-4 px-2">
                   {mediaItems.length > 0 ? (
                     <>
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
                               <a 
                                 href={item.url} 
                                 download 
                                 onClick={e => e.stopPropagation()}
                                 className="absolute inset-0 bg-indigo-600/60 backdrop-blur-sm flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-all duration-300"
                               >
                                  <Download size={24} />
                               </a>
                            </div>
                          ))}
                       </div>
                       {mediaItems.length > 12 && (
                         <button className="w-full mt-4 py-3 bg-slate-50 dark:bg-indigo-500/10 hover:bg-slate-100 dark:hover:bg-indigo-500/20 text-[10px] font-black text-slate-500 dark:text-indigo-400 uppercase tracking-[0.2em] rounded-2xl transition-all shadow-sm">
                            Access Full Decryption ({mediaItems.length})
                         </button>
                       )}
                     </>
                   ) : (
                     <div className="text-center py-12 opacity-30">
                        <ImageIcon size={32} className="mx-auto mb-3" />
                        <p className="text-xs font-bold italic tracking-tight">Zero media payloads</p>
                     </div>
                   )}
                </div>
              )}
           </div>

           {/* Files */}
           <div className="py-2">
              <button 
                onClick={() => toggleSection('files')}
                className="w-full flex items-center justify-between px-5 py-3 hover:bg-slate-50 dark:hover:bg-white/5 rounded-2xl transition-all"
              >
                 <span className="text-[11px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-widest">Document Registry</span>
                 {sections.files ? <ChevronDown size={18} className="text-slate-400" /> : <ChevronRight size={18} className="text-slate-400" />}
              </button>
              {sections.files && (
                <div className="mt-3 space-y-2 px-2">
                   {fileItems.length > 0 ? (
                     <>
                        {fileItems.slice(0, 5).map((file, idx) => (
                           <div key={idx} className="flex items-center space-x-4 p-4 hover:bg-white dark:hover:bg-white/5 rounded-[24px] border border-transparent hover:border-slate-100 dark:hover:border-slate-800 transition-all group shadow-sm hover:shadow-lg hover:scale-[1.02]">
                              <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-500 rounded-2xl flex items-center justify-center group-hover:bg-indigo-500 group-hover:text-white transition-all shadow-sm">
                                 <FileText size={24} />
                              </div>
                              <div className="flex-1 min-w-0">
                                 <p className="text-[14px] font-black text-slate-800 dark:text-slate-200 truncate leading-tight">{file.name || 'Registry Entry'}</p>
                                 <p className="text-[9px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-[0.1em] mt-1">
                                    {formatFileSize(file.metadata?.fileSize || 0)} • {new Date(file.createdAt).toLocaleDateString()}
                                 </p>
                              </div>
                              <a href={file.url} download className="p-2 text-slate-300 hover:text-indigo-500 transition-all active:scale-90">
                                 <Download size={20} />
                              </a>
                           </div>
                        ))}
                        {fileItems.length > 5 && (
                          <button className="w-full py-3 bg-slate-50 dark:bg-indigo-500/10 hover:bg-slate-100 dark:hover:bg-indigo-500/20 text-[10px] font-black text-slate-500 dark:text-indigo-400 uppercase tracking-[0.2em] rounded-2xl transition-all">
                             Expand Registry ({fileItems.length})
                          </button>
                        )}
                     </>
                   ) : (
                     <div className="text-center py-12 opacity-30">
                        <FileText size={32} className="mx-auto mb-3" />
                        <p className="text-xs font-bold italic tracking-tight">Empty file index</p>
                     </div>
                   )}
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
                className="w-full flex items-center justify-between px-5 py-3 hover:bg-slate-50 dark:hover:bg-white/5 rounded-2xl transition-all"
              >
                 <span className="text-[11px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-widest">Security Protocols</span>
                 {sections.security ? <ChevronDown size={18} className="text-slate-400" /> : <ChevronRight size={18} className="text-slate-400" />}
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
                        <span className="text-[15px] font-black tracking-tight">Abort Channel (Leave)</span>
                     </button>
                   )}
                   <button 
                    onClick={onClearHistory}
                    className="w-full flex items-center space-x-5 px-5 py-4 hover:bg-red-50 dark:hover:bg-red-500/10 text-red-500 rounded-[24px] transition-all group scale-100 hover:scale-[1.02] border border-transparent hover:border-red-100 dark:hover:border-red-500/20"
                   >
                      <div className="w-11 h-11 rounded-2xl bg-red-100/50 dark:bg-red-500/5 flex items-center justify-center group-hover:scale-110 transition-transform">
                         <Trash2 size={22} />
                      </div>
                      <span className="text-[15px] font-black tracking-tight">Purge Data Storage</span>
                   </button>
                   
                   <div className="mt-8 p-6 bg-slate-50 dark:bg-slate-800/40 rounded-[32px] border border-slate-100 dark:border-slate-800 text-center">
                      <Shield size={32} className="mx-auto mb-4 text-emerald-500 opacity-60" />
                      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 dark:text-slate-600">End-to-End Encryption</p>
                      <p className="text-[9px] font-bold text-slate-300 dark:text-slate-700 mt-2 italic">Messages are secured with quantum-ready protocols. Only participants in this link have decoding rights.</p>
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
