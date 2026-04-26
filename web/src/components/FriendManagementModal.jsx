import React, { useState, useEffect, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  Search, X, UserPlus, MessageSquare, User, Trash2,
  Check, UserMinus, ShieldAlert, ChevronRight, Bell
} from 'lucide-react';
import { friendApi } from '../api/friendApi';
import { userApi } from '../api/userApi';
import { useChat } from '../hooks/useChat';
import { fetchFriends, fetchConversations } from '../store/chatSlice';
import { removePendingFriend, setPendingRequests } from '../store/notificationSlice';

const FriendManagementModal = ({ isOpen, onClose, initialView = 'list' }) => {
  const dispatch = useDispatch();
  const { friends, conversations } = useSelector(state => state.chat);
  const { pendingFriends } = useSelector(state => state.notification);
  const { create, selectConversation, activeConversationId } = useChat();

  const [searchTerm, setSearchTerm] = useState('');
  const [view, setView] = useState(initialView); // 'list' or 'requests' or 'search'

  const [searchPhone, setSearchPhone] = useState('');
  const [foundUser, setFoundUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setView(initialView);
      dispatch(fetchFriends());
      friendApi.getPendingRequests().then(res => {
        dispatch(setPendingRequests(res.data || []));
      }).catch(() => { });
    } else {
      // Reset search state when modal is closed
      setSearchPhone('');
      setFoundUser(null);
      setError('');
    }
  }, [isOpen, initialView, dispatch]);

  const filteredFriends = useMemo(() => {
    const uniqueFriends = Array.from(new Map(friends.map(f => [f.userId, f])).values());
    return uniqueFriends.filter(f =>
      f.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.phoneNumber.includes(searchTerm)
    );
  }, [friends, searchTerm]);

  if (!isOpen) return null;

  const handleStartChat = async (targetUser) => {
    const targetUserId = targetUser.userId || targetUser.id;
    // 1. Check if we already have a SINGLE conversation with this friend
    const existingConv = conversations.find(c =>
      c.type === 'SINGLE' &&
      c.members?.some(m => String(m.userId || m.id) === String(targetUserId))
    );

    if (existingConv) {
      selectConversation(existingConv.conversationId);
      onClose();
      return;
    }

    setLoading(true);
    try {
      const result = await create('SINGLE', [targetUserId]);
      if (result.payload) {
        const convId = result.payload.conversationId || result.payload?.data?.conversationId;
        if (convId) selectConversation(convId);
        onClose();
      }
    } catch (err) {
      console.error("Failed to start chat", err);
    } finally {
      setLoading(false);
    }
  };

  const handleUnfriend = async (friendId) => {
    if (window.confirm('Bạn có chắc chắn muốn hủy kết bạn với người này?')) {
      try {
        await friendApi.deleteFriend(friendId);
        dispatch(fetchFriends());
      } catch (err) {
        console.error("Failed to unfriend", err);
      }
    }
  };

  const handleAcceptRequest = async (userId) => {
    setLoading(true);
    try {
      await friendApi.acceptRequest(userId);
      dispatch(removePendingFriend(userId));
      dispatch(fetchFriends());
      // Refresh conversations to update friendship badges in sidebar
      await dispatch(fetchConversations());
    } catch (err) {
      console.error("Failed to accept", err);
    } finally {
      setLoading(false);
    }
  };

  const handleRejectRequest = async (userId) => {
    try {
      await friendApi.rejectRequest(userId);
      dispatch(removePendingFriend(userId));
    } catch (err) {
      console.error("Failed to reject", err);
    }
  };

  const handleSearchUser = async (e) => {
    if (e) e.preventDefault();
    if (!searchPhone.trim()) return;
    setLoading(true);
    setError('');
    setFoundUser(null);
    try {
      const res = await userApi.searchUser(searchPhone);
      setFoundUser(res.data || res);
    } catch (err) {
      setError(err.response?.data?.message || 'Không tìm thấy người dùng');
    } finally {
      setLoading(false);
    }
  };

  const handleAddFriendFromSearch = async () => {
    if (!foundUser) return;
    setLoading(true);
    try {
      await friendApi.sendRequest(foundUser.userId);
      setFoundUser(prev => ({ ...prev, friendshipStatus: 'PENDING' }));
    } catch (err) {
      setError('Gửi lời mời thất bại');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-[#1e2330] w-full max-w-xl rounded-[24px] sm:rounded-[32px] shadow-2xl border border-slate-100 dark:border-white/5 flex flex-col h-[90vh] sm:h-[600px] overflow-hidden transition-colors">

        {/* Header */}
        <div className="px-4 sm:px-8 py-4 sm:py-6 border-b border-slate-50 dark:border-white/5 flex items-center justify-between bg-white/80 dark:bg-[#1e2330]/80 backdrop-blur-xl shrink-0">
          <div className="flex items-center space-x-3 sm:space-x-4">
            <h2 className="text-lg sm:text-xl font-black text-slate-800 dark:text-white tracking-tight">
              {view === 'list' ? 'Bạn bè' : view === 'requests' ? 'Lời mời' : 'Tìm bạn'}
            </h2>

            {view === 'list' && (
              <button
                onClick={() => setView('requests')}
                className="relative flex items-center space-x-1.5 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-full hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-all group"
              >
                <Bell size={14} className="group-hover:rotate-12 transition-transform" />
                <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider hidden xs:inline">Lời mời</span>
                {pendingFriends.length > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white dark:border-[#1e2330]">
                    {pendingFriends.length}
                  </span>
                )}
              </button>
            )}

            {view !== 'list' && (
              <button
                onClick={() => setView('list')}
                className="text-[10px] sm:text-[11px] font-black text-slate-400 hover:text-indigo-500 uppercase tracking-widest transition-colors"
              >
                Quay lại
              </button>
            )}
          </div>

          <button onClick={onClose} className="p-2 hover:bg-slate-50 dark:hover:bg-white/5 rounded-xl text-slate-400 transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden flex flex-col">

          {view === 'list' && (
            <>
              {/* Search Friends Bar */}
              <div className="px-4 sm:px-8 py-3 sm:py-4 bg-slate-50/50 dark:bg-white/[0.02] border-b border-slate-50 dark:border-white/5">
                <div className="relative group">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={18} />
                  <input
                    type="text"
                    placeholder="Tìm kiếm bạn bè..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-11 pr-4 py-2.5 sm:py-3 bg-white dark:bg-[#0b0e14] border border-slate-200 dark:border-white/10 rounded-xl sm:rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all dark:text-white"
                  />
                </div>
              </div>

              {/* Friends List */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-2 sm:space-y-3 no-scrollbar">
                {filteredFriends.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-40">
                    <User size={48} className="text-slate-300" />
                    <p className="text-xs font-bold uppercase tracking-widest text-slate-400">{searchTerm ? 'Không thấy kết quả' : 'Danh sách trống'}</p>
                  </div>
                ) : (
                  filteredFriends.map((friend) => (
                    <div key={friend.userId} className="p-3 sm:p-4 bg-white dark:bg-white/[0.03] hover:bg-slate-50 dark:hover:bg-white/[0.05] border border-slate-100 dark:border-white/5 rounded-xl sm:rounded-2xl transition-all group flex items-center justify-between">
                      <div className="flex items-center space-x-3 sm:space-x-4">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-indigo-100 dark:bg-indigo-500/20 overflow-hidden border-2 border-white dark:border-white/10 shadow-sm shrink-0">
                          {friend.avatarUrl ? (
                            <img src={friend.avatarUrl} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-indigo-500">
                              <User size={20} />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-sm sm:text-[15px] font-black text-slate-800 dark:text-white tracking-tight truncate">{friend.fullName}</h4>
                          <p className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-tighter truncate">{friend.phoneNumber}</p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-1 sm:space-x-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleStartChat(friend)}
                          className="p-2 sm:p-2.5 bg-indigo-600 text-white rounded-lg sm:rounded-xl hover:bg-indigo-700 transition-all shadow-md"
                          title="Nhắn tin"
                        >
                          <MessageSquare size={16} sm:size={18} />
                        </button>
                        <button
                          onClick={() => handleUnfriend(friend.userId)}
                          className="p-2 sm:p-2.5 bg-white dark:bg-white/5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 border border-slate-100 dark:border-white/10 rounded-lg sm:rounded-xl transition-all"
                          title="Hủy kết bạn"
                        >
                          <UserMinus size={16} sm:size={18} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Footer action */}
              <div className="p-4 sm:p-6 bg-slate-50/50 dark:bg-white/[0.02] border-t border-slate-50 dark:border-white/5 flex justify-center shrink-0">
                <button
                  onClick={() => setView('search')}
                  className="w-full sm:w-auto px-8 py-3 bg-indigo-600 text-white text-[11px] font-black uppercase tracking-[0.2em] rounded-xl sm:rounded-2xl hover:bg-indigo-700 hover:scale-105 active:scale-95 transition-all shadow-xl shadow-indigo-100 dark:shadow-none flex items-center justify-center space-x-3"
                >
                  <UserPlus size={16} />
                  <span>Thêm bạn mới</span>
                </button>
              </div>
            </>
          )}

          {view === 'requests' && (
            <div className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-4 sm:space-y-6 no-scrollbar">
              {pendingFriends.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-40">
                  <Bell size={48} className="text-slate-300" />
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Không có lời mời nào</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Yêu cầu đang chờ</p>
                  {pendingFriends.map((req) => (
                    <div key={req.userId} className="p-4 sm:p-5 bg-white dark:bg-white/[0.03] border border-slate-100 dark:border-white/5 rounded-2xl sm:rounded-[24px] shadow-sm flex flex-col space-y-4 hover:border-indigo-100 dark:hover:border-indigo-500/30 transition-all">
                      <div className="flex items-center space-x-4">
                        <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-slate-100 dark:bg-white/5 overflow-hidden shrink-0">
                          {req.avatarUrl ? <img src={req.avatarUrl} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-slate-300"><User size={24} /></div>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start">
                            <p className="text-sm sm:text-[15px] text-slate-700 dark:text-white/70 leading-tight">
                              <span className="font-black text-slate-900 dark:text-white">{req.fullName}</span> muốn kết bạn
                            </p>
                            {req.createdAt && (
                              <span className="text-[9px] font-bold text-slate-400 whitespace-nowrap ml-2">
                                {new Date(req.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{req.phoneNumber}</p>
                        </div>
                      </div>
                      <div className="flex space-x-2 sm:space-x-3">
                        <button
                          onClick={() => handleAcceptRequest(req.userId)}
                          className="flex-1 py-3 bg-indigo-600 text-white text-[10px] sm:text-[11px] font-black uppercase tracking-[0.2em] rounded-xl sm:rounded-2xl hover:bg-indigo-700 transition-all active:scale-95"
                        >
                          Chấp nhận
                        </button>
                        <button
                          onClick={() => handleRejectRequest(req.userId)}
                          className="flex-1 py-3 bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-white/40 text-[10px] sm:text-[11px] font-black uppercase tracking-[0.2em] rounded-xl sm:rounded-2xl hover:bg-slate-200 dark:hover:bg-white/10 transition-all active:scale-95"
                        >
                          Hủy
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {view === 'search' && (
            <div className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-6 sm:space-y-8 no-scrollbar animate-fade-in">
              <div className="space-y-6">
                <p className="text-[11px] font-mono font-black text-slate-400 uppercase tracking-[0.1em] px-1 italic text-center">
                  Tìm kiếm bạn bè qua số điện thoại
                </p>

                <form onSubmit={handleSearchUser} className="flex space-x-2 sm:space-x-3">
                  <div className="relative flex-1 group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={18} />
                    <input
                      type="text"
                      placeholder="Số điện thoại..."
                      value={searchPhone}
                      onChange={(e) => setSearchPhone(e.target.value)}
                      className="w-full pl-11 pr-4 py-3.5 bg-slate-50 dark:bg-[#0b0e14] border border-slate-200 dark:border-white/10 rounded-xl sm:rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all dark:text-white"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading || !searchPhone.trim()}
                    className="px-6 sm:px-8 bg-indigo-600 text-white rounded-xl sm:rounded-2xl font-black uppercase tracking-[0.1em] text-[11px] hover:bg-indigo-700 hover:scale-105 active:scale-95 transition-all disabled:opacity-30 shadow-lg shadow-indigo-100 dark:shadow-none"
                  >
                    {loading ? '...' : 'TÌM'}
                  </button>
                </form>

                {error && (
                  <div className="p-4 bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 rounded-xl sm:rounded-2xl flex items-center space-x-3 text-red-500 animate-fade-in">
                    <ShieldAlert size={14} className="shrink-0" />
                    <p className="text-[10px] font-black uppercase tracking-widest">{error}</p>
                  </div>
                )}

                {foundUser && (
                  <div className="p-6 sm:p-8 bg-slate-50 dark:bg-white/[0.03] border border-slate-100 dark:border-white/5 rounded-2xl sm:rounded-[32px] space-y-6 sm:space-y-8 animate-slide-up shadow-sm">
                    <div className="flex flex-col items-center text-center space-y-4 sm:space-y-6">
                      <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl sm:rounded-3xl bg-white dark:bg-white/5 border border-slate-100 dark:border-white/10 flex items-center justify-center overflow-hidden shadow-sm">
                        {foundUser.avatarUrl ? (
                          <img src={foundUser.avatarUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <User size={40} sm:size={48} className="text-slate-200 dark:text-slate-700" />
                        )}
                      </div>
                      <div className="space-y-1">
                        <h3 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-white tracking-tighter">{foundUser.fullName}</h3>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">{foundUser.phoneNumber}</p>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 sm:gap-3">
                      <button
                        onClick={() => handleStartChat(foundUser)}
                        className="w-full py-3.5 bg-indigo-600 text-white rounded-xl sm:rounded-2xl font-black uppercase tracking-[0.2em] text-[11px] shadow-lg shadow-indigo-100 dark:shadow-none hover:bg-indigo-700 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center space-x-3"
                      >
                        <MessageSquare size={16} />
                        <span>Nhắn tin</span>
                      </button>

                      {foundUser.friendshipStatus === 'ACCEPTED' ? (
                        <div className="w-full py-3.5 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-xl sm:rounded-2xl font-black uppercase tracking-[0.2em] text-[11px] flex items-center justify-center space-x-3 cursor-default">
                          <Check size={16} />
                          <span>Bạn bè</span>
                        </div>
                      ) : foundUser.friendshipStatus === 'PENDING' ? (
                        <div className="w-full py-3.5 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 text-indigo-500 rounded-xl sm:rounded-2xl font-black uppercase tracking-[0.2em] text-[11px] flex items-center justify-center space-x-3 shadow-sm">
                          <Check size={16} />
                          <span>Đã gửi lời mời</span>
                        </div>
                      ) : (
                        <button
                          onClick={handleAddFriendFromSearch}
                          className="w-full py-3.5 bg-white dark:bg-white/5 text-slate-800 dark:text-white border border-slate-200 dark:border-white/10 rounded-xl sm:rounded-2xl font-black uppercase tracking-[0.2em] text-[11px] hover:bg-slate-50 dark:hover:bg-white/10 transition-all flex items-center justify-center space-x-3"
                        >
                          <UserPlus size={16} />
                          <span>Kết bạn</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default FriendManagementModal;
