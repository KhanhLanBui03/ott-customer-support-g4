import React, { useState, useEffect, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  Search, X, UserPlus, MessageSquare, User, Trash2,
  Check, UserMinus, ShieldAlert, ChevronRight, Bell, Zap
} from 'lucide-react';
import { friendApi } from '../api/friendApi';
import { userApi } from '../api/userApi';
import { useChat } from '../hooks/useChat';
import { fetchFriends, fetchConversations } from '../store/chatSlice';
import { removePendingFriend, setPendingRequests } from '../store/notificationSlice';
import { useTheme } from '../hooks/useTheme';

const cn = (...classes) => classes.filter(Boolean).join(" ");

const cn = (...classes) => classes.filter(Boolean).join(" ");

const FriendManagementModal = ({ isOpen, onClose, initialView = 'list' }) => {
  const dispatch = useDispatch();
  const { friends, conversations } = useSelector(state => state.chat);
  const { pendingFriends } = useSelector(state => state.notification);
  const { isDark } = useTheme();
  const { create, selectConversation } = useChat();

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
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 backdrop-blur-xl bg-slate-950/40 animate-fade-in">
      <div className={`w-full max-w-lg rounded-[40px] shadow-2xl relative overflow-hidden flex flex-col h-[600px] border ${
        isDark ? 'bg-[#1a1e26] border-white/5' : 'bg-white border-slate-100'
      }`}>
        
        {/* Header */}
        <div className={`h-24 flex items-center justify-between px-10 border-b backdrop-blur-md shrink-0 ${
          isDark ? 'bg-white/5 border-white/5' : 'bg-slate-50/50 border-slate-50'
        }`}>
          <div className="flex items-center space-x-4">
            <h2 className={`text-xl font-black tracking-tighter ${isDark ? 'text-white' : 'text-slate-800'}`}>
              {view === 'list' ? 'Danh sách bạn bè' : view === 'requests' ? 'Lời mời kết bạn' : 'Tìm kiếm bạn bè'}
            </h2>
            {view === 'list' && (
              <button
                onClick={() => setView('requests')}
                className="flex items-center space-x-2 px-3 py-1.5 bg-indigo-500/10 text-indigo-400 rounded-full hover:bg-indigo-500/20 transition-all group"
              >
                <Bell size={14} className="group-hover:rotate-12 transition-transform" />
                <span className="text-[10px] font-black uppercase tracking-wider">Lời mời</span>
                {pendingFriends.length > 0 && (
                  <span className="bg-red-500 text-white text-[10px] min-w-[18px] h-[18px] rounded-full flex items-center justify-center font-bold">
                    {pendingFriends.length}
                  </span>
                )}
              </button>
            )}
            {view !== 'list' && (
              <button 
                onClick={() => setView('list')}
                className={`text-[11px] font-black uppercase tracking-widest transition-colors ${
                  isDark ? 'text-white/40 hover:text-white' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                Quay lại
              </button>
            )}
          </div>
          <button onClick={onClose} className={`p-2 rounded-xl transition-colors ${
            isDark ? 'hover:bg-white/5 text-white/40' : 'hover:bg-slate-100 text-slate-400'
          }`}>
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto no-scrollbar p-8">
          {view === 'list' && (
            <div className="space-y-6">
              {/* Search Bar */}
              <div className="relative group">
                <Search className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors ${
                  isDark ? 'text-white/20 group-focus-within:text-indigo-500' : 'text-slate-300 group-focus-within:text-indigo-500'
                }`} size={18} />
                <input
                  type="text"
                  placeholder="Tìm kiếm bạn bè trong danh sách..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={`w-full pl-12 pr-4 py-4 rounded-2xl text-sm font-medium transition-all focus:outline-none focus:border-indigo-500/50 border ${
                    isDark 
                      ? 'bg-white/5 border-white/5 text-white placeholder:text-white/20' 
                      : 'bg-slate-50 border-slate-100 text-slate-800 placeholder:text-slate-400'
                  }`}
                />
              </div>

              {/* Friends List */}
              <div className="space-y-3">
                {filteredFriends.length === 0 ? (
                  <div className="py-20 text-center opacity-20">
                    <User size={48} className="mx-auto mb-4" />
                    <p className="text-xs font-black uppercase tracking-[0.2em]">Danh sách trống</p>
                  </div>
                ) : (
                  filteredFriends.map((friend) => (
                    <div key={friend.userId} className={`p-4 rounded-2xl transition-all group flex items-center justify-between border ${
                      isDark 
                        ? 'bg-white/5 border-white/5 hover:bg-white/10' 
                        : 'bg-white border-slate-100 hover:border-indigo-100 hover:shadow-md hover:shadow-indigo-500/5'
                    }`}>
                      <div className="flex items-center space-x-4">
                        <div className={`w-12 h-12 rounded-2xl overflow-hidden border ${
                          isDark ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-100'
                        }`}>
                          {friend.avatarUrl ? (
                            <img src={friend.avatarUrl} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className={`w-full h-full flex items-center justify-center ${isDark ? 'text-white/10' : 'text-slate-300'}`}><User size={24} /></div>
                          )}
                        </div>
                        <div>
                          <h4 className={`text-[15px] font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-800'}`}>{friend.fullName}</h4>
                          <p className={`text-[11px] font-bold ${isDark ? 'text-white/30' : 'text-slate-400'}`}>{friend.phoneNumber}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => handleStartChat(friend)}
                          className="p-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/20"
                        >
                          <MessageSquare size={18} />
                        </button>
                        <button 
                          onClick={() => handleUnfriend(friend.userId)}
                          className={`p-2.5 rounded-xl transition-all ${
                            isDark ? 'bg-white/5 text-white/40 hover:text-red-500 hover:bg-red-500/10' : 'bg-slate-50 text-slate-400 hover:text-red-500 hover:bg-red-50'
                          }`}
                        >
                          <UserMinus size={18} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {view === 'requests' && (
            <div className="space-y-6">
              <p className={`text-[11px] font-black uppercase tracking-widest px-1 ${isDark ? 'text-white/30' : 'text-slate-400'}`}>Yêu cầu đang chờ</p>
              <div className="space-y-4">
                {pendingFriends.length === 0 ? (
                  <div className="py-20 text-center opacity-20">
                    <Bell size={48} className="mx-auto mb-4" />
                    <p className="text-xs font-black uppercase tracking-[0.2em]">Không có lời mời nào</p>
                  </div>
                ) : (
                  pendingFriends.map((req) => (
                    <div key={req.userId} className={`p-6 border rounded-3xl space-y-5 ${isDark ? 'bg-white/5 border-white/5' : 'bg-slate-50/50 border-slate-100'}`}>
                      <div className="flex items-center space-x-4">
                        <div className={`w-14 h-14 rounded-2xl overflow-hidden border ${isDark ? 'bg-white/5 border-white/5' : 'bg-white border-slate-100'}`}>
                          {req.avatarUrl ? <img src={req.avatarUrl} className="w-full h-full object-cover" /> : <User size={24} className={`m-auto ${isDark ? 'text-white/10' : 'text-slate-200'}`} />}
                        </div>
                        <div className="flex-1">
                          <p className={`text-[15px] leading-tight ${isDark ? 'text-white/70' : 'text-slate-600'}`}>
                            <span className={`font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>{req.fullName}</span> muốn kết bạn
                          </p>
                          <p className={`text-[11px] font-bold mt-1 ${isDark ? 'text-white/30' : 'text-slate-400'}`}>{req.phoneNumber}</p>
                        </div>
                      </div>
                      <div className="flex space-x-3">
                        <button
                          onClick={() => handleAcceptRequest(req.userId)}
                          className="flex-1 py-4 bg-indigo-600 text-white text-[11px] font-black uppercase tracking-[0.2em] rounded-2xl hover:bg-indigo-700 transition-all active:scale-95"
                        >
                          Chấp nhận
                        </button>
                        <button
                          onClick={() => handleRejectRequest(req.userId)}
                          className={`px-6 py-4 text-[11px] font-black uppercase tracking-[0.2em] rounded-2xl transition-all active:scale-95 border ${
                            isDark ? 'bg-white/5 text-white/40 hover:bg-white/10 border-white/5' : 'bg-white text-slate-400 hover:bg-slate-50 border-slate-100'
                          }`}
                        >
                          Từ chối
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {view === 'search' && (
            <div className="space-y-8 animate-fade-in">
              <div className="space-y-6">
                <p className={`text-[11px] font-black uppercase tracking-[0.2em] italic text-center ${isDark ? 'text-white/30' : 'text-slate-400'}`}>
                  Tìm kiếm bạn bè qua số điện thoại
                </p>
                
                <form onSubmit={handleSearchUser} className="flex space-x-3">
                  <div className="relative flex-1 group">
                    <Search className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors ${
                      isDark ? 'text-white/20 group-focus-within:text-indigo-500' : 'text-slate-300 group-focus-within:text-indigo-500'
                    }`} size={18} />
                    <input
                      type="text"
                      placeholder="Nhập số điện thoại..."
                      value={searchPhone}
                      onChange={(e) => setSearchPhone(e.target.value)}
                      className={`w-full pl-12 pr-4 py-4 rounded-2xl text-sm font-medium transition-all focus:outline-none focus:border-indigo-500/50 border ${
                        isDark 
                          ? 'bg-white/5 border-white/5 text-white placeholder:text-white/20' 
                          : 'bg-slate-50 border-slate-100 text-slate-800 placeholder:text-slate-400'
                      }`}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading || !searchPhone.trim()}
                    className="px-8 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-[0.1em] text-[11px] hover:scale-105 active:scale-95 transition-all disabled:opacity-30 shadow-xl shadow-indigo-600/20"
                  >
                    {loading ? '...' : 'TÌM'}
                  </button>
                </form>

                {error && (
                  <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center space-x-3 text-red-500 animate-fade-in">
                    <ShieldAlert size={14} className="shrink-0" />
                    <p className="text-[10px] font-black uppercase tracking-widest">{error}</p>
                  </div>
                )}

                {foundUser && (
                  <div className={`p-8 border rounded-[40px] space-y-8 animate-slide-up shadow-xl ${
                    isDark ? 'bg-white/5 border-white/5' : 'bg-white border-slate-100'
                  }`}>
                    <div className="flex flex-col items-center text-center space-y-6">
                      <div className={`w-24 h-24 rounded-[32px] border flex items-center justify-center overflow-hidden ${
                        isDark ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-100'
                      }`}>
                        {foundUser.avatarUrl ? (
                          <img src={foundUser.avatarUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <User size={48} className={isDark ? 'text-white/10' : 'text-slate-200'} />
                        )}
                      </div>
                      <div className="space-y-1">
                        <h3 className={`text-2xl font-black tracking-tighter ${isDark ? 'text-white' : 'text-slate-800'}`}>{foundUser.fullName}</h3>
                        <p className={`text-[11px] font-black uppercase tracking-[0.3em] ${isDark ? 'text-white/30' : 'text-slate-400'}`}>{foundUser.phoneNumber}</p>
                      </div>
                    </div>

                    <div className="flex flex-col gap-3">
                      <button
                        onClick={() => handleStartChat(foundUser)}
                        className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-[0.2em] text-[11px] shadow-xl shadow-indigo-600/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center space-x-3"
                      >
                        <MessageSquare size={18} />
                        <span>Nhắn tin</span>
                      </button>

                      {foundUser.friendshipStatus === 'ACCEPTED' ? (
                        <div className="w-full py-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-2xl font-black uppercase tracking-[0.2em] text-[11px] flex items-center justify-center space-x-3">
                          <Check size={18} />
                          <span>Bạn bè</span>
                        </div>
                      ) : foundUser.friendshipStatus === 'PENDING' ? (
                        <div className="w-full py-4 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-2xl font-black uppercase tracking-[0.2em] text-[11px] flex items-center justify-center space-x-3">
                          <Check size={18} />
                          <span>Đã gửi lời mời</span>
                        </div>
                      ) : (
                        <button
                          onClick={handleAddFriendFromSearch}
                          className={`w-full py-4 border rounded-2xl font-black uppercase tracking-[0.2em] text-[11px] transition-all flex items-center justify-center space-x-3 ${
                            isDark ? 'bg-white/5 text-white border-white/10 hover:bg-white/10' : 'bg-slate-50 text-slate-600 border-slate-100 hover:bg-slate-100'
                          }`}
                        >
                          <UserPlus size={18} />
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

        {/* Footer Action for List View */}
        {view === 'list' && (
          <div className={`p-8 border-t flex justify-center shrink-0 ${isDark ? 'border-white/5' : 'border-slate-50'}`}>
            <button
              onClick={() => setView('search')}
              className="w-full py-4 bg-indigo-600 text-white text-[11px] font-black uppercase tracking-[0.2em] rounded-2xl hover:bg-indigo-700 hover:scale-105 active:scale-95 transition-all shadow-xl shadow-indigo-600/20 flex items-center justify-center space-x-3"
            >
              <UserPlus size={18} />
              <span>Tìm bạn mới</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default FriendManagementModal;
