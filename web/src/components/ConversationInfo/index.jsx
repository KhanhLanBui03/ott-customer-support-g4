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
           window.location.reload();
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
    <div className="w-[360px] h-full bg-white border-l border-slate-100 flex flex-col overflow-hidden animate-slide-left shadow-2xl z-40">
      {/* Header */}
      <div className="h-16 px-6 border-b border-slate-50 flex items-center justify-between flex-shrink-0 bg-white/80 backdrop-blur-md">
        <h3 className="text-lg font-black text-slate-800 tracking-tighter">Thông tin hội thoại</h3>
        <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 transition-colors">
          <X size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar pb-12">
        {/* Profile Info */}
        <div className="p-8 flex flex-col items-center text-center space-y-4">
          <div className="relative group">
            <div className="w-24 h-24 rounded-[32px] bg-indigo-50 p-1 border-2 border-indigo-100 shadow-xl overflow-hidden shadow-indigo-100/50">
               {conversation.avatarUrl ? (
                 <img src={conversation.avatarUrl} alt="" className="w-full h-full object-cover rounded-[28px]" />
               ) : (
                 <div className="w-full h-full flex items-center justify-center text-3xl font-black text-indigo-300">
                    {conversation.name?.charAt(0) || 'C'}
                 </div>
               )}
            </div>
            {conversation.type === 'GROUP' && (
              <div className="absolute bottom-0 right-0 w-8 h-8 bg-indigo-500 rounded-xl shadow-lg flex items-center justify-center text-white border-4 border-white">
                  <ShieldCheck size={14} />
              </div>
            )}
          </div>
          
          <div>
            <h4 className="text-xl font-black text-slate-800 tracking-tight leading-tight">{conversation.name || 'Hội thoại'}</h4>
            <div className="flex items-center justify-center space-x-2 mt-1.5 focus-within:">
               <span className="text-[10px] font-mono font-black uppercase tracking-[0.2em] text-slate-400">
                 {conversation.type === 'GROUP' ? `${conversation.members?.length || 0} thành viên` : 'Tín hiệu trực tiếp'}
               </span>
            </div>
          </div>
        </div>

        <div className="h-2 bg-slate-50 my-4" />

        {/* Group Members Section */}
        {conversation.type === 'GROUP' && (
           <div className="px-4 py-2">
              <button 
                onClick={() => toggleSection('members')}
                className="w-full flex items-center justify-between px-4 py-2 hover:bg-slate-50 rounded-xl transition-colors"
              >
                 <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Thành viên nhóm</span>
                 {sections.members ? <ChevronDown size={16} className="text-slate-400" /> : <ChevronRight size={16} className="text-slate-400" />}
              </button>
              
              {sections.members && (
                 <div className="mt-4 space-y-2 px-2">
                    {isAdmin && (
                      <button 
                        onClick={handleFetchFriends}
                        className="w-full flex items-center space-x-4 p-3 bg-indigo-50 text-indigo-600 rounded-2xl hover:bg-indigo-100 transition-all group"
                      >
                         <div className="w-10 h-10 rounded-xl bg-indigo-500 text-white flex items-center justify-center shadow-md">
                            <UserPlus size={18} />
                         </div>
                         <span className="text-sm font-black">Mời người khác</span>
                      </button>
                    )}

                    {isInviting && (
                       <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                          <div className="bg-white w-full max-w-sm rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[70vh]">
                             <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                                <h4 className="font-black text-slate-800">Thêm vào nhóm</h4>
                                <button onClick={() => setIsInviting(false)}><X size={20}/></button>
                             </div>
                             
                             <div className="p-4 bg-slate-50 border-b border-slate-100">
                                <div className="relative group">
                                   <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={16} />
                                   <input 
                                      type="text"
                                      placeholder="Tìm tên hoặc số điện thoại..."
                                      value={inviteSearch}
                                      onChange={(e) => setInviteSearch(e.target.value)}
                                      onKeyDown={(e) => e.key === 'Enter' && handleGlobalSearch()}
                                      className="w-full pl-11 pr-20 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                                   />
                                   <button 
                                      onClick={handleGlobalSearch}
                                      disabled={globalLoading}
                                      className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-indigo-600 text-white text-[9px] font-black uppercase tracking-widest rounded-xl hover:bg-indigo-700 transition-all disabled:opacity-50"
                                   >
                                      {globalLoading ? '...' : 'QUÉT'}
                                   </button>
                                </div>
                                {globalError && (
                                   <p className="mt-2 text-[10px] font-bold text-red-500 px-1 flex items-center">
                                      <Zap size={10} className="mr-1" /> {globalError}
                                   </p>
                                )}
                             </div>

                             <div className="flex-1 overflow-y-auto p-4 space-y-2 no-scrollbar">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 mb-2">
                                   {inviteSearch ? 'Kết quả tìm kiếm' : 'Gợi ý bạn bè'}
                                </p>
                                {friends.map(f => (
                                   <div key={f.userId} className="flex items-center justify-between p-3 hover:bg-slate-50 rounded-2xl transition-all border border-transparent hover:border-slate-100">
                                      <div className="flex items-center space-x-3">
                                         <div className="w-10 h-10 rounded-xl bg-slate-200 overflow-hidden shadow-sm">
                                            {(f.avatarUrl || f.avatar) && <img src={f.avatarUrl || f.avatar} className="w-full h-full object-cover" />}
                                         </div>
                                         <div className="min-w-0">
                                            <p className="text-sm font-bold text-slate-700 truncate">{f.fullName}</p>
                                            <p className="text-[10px] font-mono font-black text-slate-400 uppercase tracking-tighter">{f.phoneNumber || 'Signal Node'}</p>
                                         </div>
                                      </div>
                                      <button 
                                        onClick={() => handleInvite(f.userId)}
                                        className="px-4 py-1.5 bg-indigo-500 text-white text-[10px] font-black rounded-lg uppercase tracking-widest hover:bg-indigo-600 transition-all shadow-md shadow-indigo-100"
                                      >
                                        Mời
                                      </button>
                                   </div>
                                ))}
                                {friends.length === 0 && !globalLoading && (
                                   <div className="text-center py-12">
                                      <p className="text-xs font-bold text-slate-300 italic">Không tìm thấy người dùng khả dụng</p>
                                      <p className="text-[9px] text-slate-400 mt-1 mb-4 italic">Hãy thử nhập số điện thoại để quét toàn cầu</p>
                                   </div>
                                )}
                             </div>
                          </div>
                       </div>
                    )}

                    <div className="space-y-1">
                      {conversation.members?.map(m => (
                        <div key={m.userId} className="flex items-center justify-between p-3 hover:bg-slate-50 rounded-2xl transition-all group/member">
                           <div className="flex items-center space-x-3">
                              <div className="w-10 h-10 rounded-xl bg-slate-100 overflow-hidden border border-white shadow-sm">
                                 {m.avatarUrl ? (
                                   <img src={m.avatarUrl} className="w-full h-full object-cover" />
                                 ) : (
                                   <div className="w-full h-full flex items-center justify-center text-xs font-black text-slate-400">{m.fullName?.charAt(0)}</div>
                                 )}
                              </div>
                              <div className="min-w-0">
                                 <p className="text-sm font-bold text-slate-700 truncate">{m.fullName} {m.userId === user?.userId && '(Bạn)'}</p>
                                 <div className="flex items-center space-x-2">
                                    {m.role === 'OWNER' && <ShieldCheck size={10} className="text-indigo-500" />}
                                    {m.role === 'ADMIN' && <Shield size={10} className="text-emerald-500" />}
                                    <span className={`text-[8px] font-black uppercase tracking-widest ${
                                      m.role === 'OWNER' ? 'text-indigo-500' : m.role === 'ADMIN' ? 'text-emerald-500' : 'text-slate-400'
                                    }`}>
                                      {m.role === 'OWNER' ? 'Chủ nhóm' : m.role === 'ADMIN' ? 'Quản trị viên' : 'Thành viên'}
                                    </span>
                                 </div>
                              </div>
                           </div>
                           
                           {isAdmin && m.userId !== user?.userId && m.role !== 'OWNER' && (
                             <div className="flex items-center space-x-1 opacity-0 group-hover/member:opacity-100 transition-opacity">
                                {isOwner && m.role === 'MEMBER' && (
                                  <button 
                                    onClick={() => handlePromote(m.userId)}
                                    className="p-1.5 text-slate-400 hover:text-emerald-500 transition-colors"
                                    title="Thăng cấp Admin"
                                  >
                                    <Shield size={14} />
                                  </button>
                                )}
                                <button 
                                  onClick={() => handleRemoveMember(m.userId)}
                                  className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"
                                  title="Xóa khỏi nhóm"
                                >
                                  <Trash2 size={14} />
                                </button>
                             </div>
                           )}
                        </div>
                      ))}
                    </div>
                 </div>
              )}
              <div className="h-2 bg-slate-50 my-4" />
           </div>
        )}

        {/* Media/Files/Links */}
        <div className="px-4 space-y-2">
           {/* Photos / Videos */}
           <div className="py-2">
              <button 
                onClick={() => toggleSection('media')}
                className="w-full flex items-center justify-between px-4 py-2 hover:bg-slate-50 rounded-xl transition-colors"
              >
                 <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Ảnh/Video</span>
                 {sections.media ? <ChevronDown size={16} className="text-slate-400" /> : <ChevronRight size={16} className="text-slate-400" />}
              </button>
              {sections.media && (
                <div className="mt-4 px-2">
                   {mediaItems.length > 0 ? (
                     <>
                       <div className="grid grid-cols-4 gap-2">
                          {mediaItems.slice(0, 12).map((item, idx) => (
                            <div key={idx} className="aspect-square bg-slate-100 rounded-xl border border-slate-100 overflow-hidden relative group cursor-pointer transition-all hover:scale-105 shadow-sm">
                               {item.type === 'IMAGE' ? (
                                 <img src={item.url} alt="" className="w-full h-full object-cover" />
                               ) : (
                                 <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900">
                                    <PlayCircle size={28} className="text-white opacity-80" />
                                    <span className="text-[8px] font-black text-white/40 uppercase tracking-tighter mt-1">Video</span>
                                 </div>
                               )}
                               <a 
                                 href={item.url} 
                                 download 
                                 onClick={e => e.stopPropagation()}
                                 className="absolute inset-0 bg-black/40 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
                               >
                                  <Download size={20} />
                               </a>
                            </div>
                          ))}
                       </div>
                       {mediaItems.length > 12 && (
                         <button className="w-full mt-4 py-2.5 bg-slate-50 hover:bg-slate-100 text-[11px] font-black text-slate-500 uppercase tracking-widest rounded-xl transition-colors">
                            Xem tất cả ({mediaItems.length})
                         </button>
                       )}
                     </>
                   ) : (
                     <div className="text-center py-6">
                        <p className="text-xs font-medium text-slate-300 italic">Chưa có phương tiện chia sẻ</p>
                     </div>
                   )}
                </div>
              )}
           </div>

           {/* Files */}
           <div className="py-2">
              <button 
                onClick={() => toggleSection('files')}
                className="w-full flex items-center justify-between px-4 py-2 hover:bg-slate-50 rounded-xl transition-colors"
              >
                 <span className="text-xs font-black text-slate-400 uppercase tracking-widest">File</span>
                 {sections.files ? <ChevronDown size={16} className="text-slate-400" /> : <ChevronRight size={16} className="text-slate-400" />}
              </button>
              {sections.files && (
                <div className="mt-2 space-y-2 px-2">
                   {fileItems.length > 0 ? (
                     <>
                        {fileItems.slice(0, 4).map((file, idx) => (
                           <div key={idx} className="flex items-center space-x-4 p-3 hover:bg-slate-50 rounded-2xl border border-transparent hover:border-slate-100 transition-all group">
                              <div className="w-12 h-12 bg-red-50 text-red-500 rounded-xl flex items-center justify-center group-hover:bg-red-500 group-hover:text-white transition-colors shadow-sm">
                                 <FileText size={24} />
                              </div>
                              <div className="flex-1 min-w-0">
                                 <p className="text-sm font-bold text-slate-700 truncate">{file.name || 'Untitled Document'}</p>
                                 <p className="text-[10px] font-mono font-black text-slate-400 uppercase tracking-tighter">
                                    {formatFileSize(file.metadata?.fileSize || 0)} • {new Date(file.createdAt).toLocaleDateString('vi-VN')}
                                 </p>
                              </div>
                              <a href={file.url} download className="p-2 text-slate-300 hover:text-indigo-500 transition-colors">
                                 <Download size={18} />
                              </a>
                           </div>
                        ))}
                        {fileItems.length > 4 && (
                          <button className="w-full py-2.5 bg-slate-50 hover:bg-slate-100 text-[11px] font-black text-slate-500 uppercase tracking-widest rounded-xl transition-colors">
                             Xem tất cả ({fileItems.length})
                          </button>
                        )}
                     </>
                   ) : (
                     <div className="text-center py-6">
                        <p className="text-xs font-medium text-slate-300 italic">Chưa có tệp tin chia sẻ</p>
                     </div>
                   )}
                </div>
              )}
           </div>
        </div>

        <div className="h-2 bg-slate-50 my-4" />

        {/* Security / Privacy */}
        <div className="px-4 pb-8 space-y-2">
           <div className="py-2">
              <button 
                onClick={() => toggleSection('security')}
                className="w-full flex items-center justify-between px-4 py-2 hover:bg-slate-50 rounded-xl transition-colors"
              >
                 <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Thiết lập bảo mật</span>
                 {sections.security ? <ChevronDown size={16} className="text-slate-400" /> : <ChevronRight size={16} className="text-slate-400" />}
              </button>
              {sections.security && (
                <div className="mt-2 space-y-1">
                   {conversation.type === 'GROUP' && (
                     <button 
                       onClick={handleLeaveGroup}
                       className="w-full flex items-center space-x-4 px-4 py-3 hover:bg-orange-50 text-orange-600 rounded-2xl transition-colors"
                     >
                        <div className="w-10 h-10 rounded-xl bg-orange-100/50 flex items-center justify-center">
                           <LogOut size={20} />
                        </div>
                        <span className="text-sm font-bold">Rời khỏi nhóm</span>
                     </button>
                   )}
                   <button 
                    onClick={onClearHistory}
                    className="w-full flex items-center space-x-4 px-4 py-3 hover:bg-red-50 text-red-500 rounded-2xl transition-colors"
                   >
                      <div className="w-10 h-10 rounded-xl bg-red-100/50 flex items-center justify-center">
                         <Trash2 size={20} />
                      </div>
                      <span className="text-sm font-bold">Xóa lịch sử trò chuyện</span>
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
