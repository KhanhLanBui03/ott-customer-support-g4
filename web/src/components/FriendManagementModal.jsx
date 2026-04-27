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

const cn = (...classes) => classes.filter(Boolean).join(" ");

const FriendManagementModal = ({ isOpen, onClose, initialView = 'list' }) => {
  const dispatch = useDispatch();
  const { friends, conversations } = useSelector(state => state.chat);
  const { pendingFriends } = useSelector(state => state.notification);
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
      <div className="bg-[#1a1e26] w-full max-w-lg rounded-[40px] shadow-2xl border border-white/5 relative overflow-hidden flex flex-col h-[600px]">
        
        {/* Header */}
        <div className="h-24 flex items-center justify-between px-10 border-b border-white/5 bg-white/5 backdrop-blur-md shrink-0">
          <div className="flex items-center space-x-4">
            <h2 className="text-xl font-black text-white tracking-tighter">
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
                className="text-[11px] font-black text-white/40 hover:text-white uppercase tracking-widest transition-colors"
              >
                Quay lại
              </button>
            )}
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-xl text-white/40 transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto no-scrollbar p-8">
          {view === 'list' && (
            <div className="space-y-6">
              {/* Search Bar */}
              <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-indigo-500 transition-colors" size={18} />
                <input
                  type="text"
                  placeholder="Tìm kiếm bạn bè trong danh sách..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-white/5 border border-white/5 rounded-2xl text-sm font-medium text-white placeholder:text-white/20 focus:outline-none focus:border-indigo-500/50 transition-all"
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
                    <div key={friend.userId} className="p-4 bg-white/5 border border-white/5 rounded-2xl hover:bg-white/10 transition-all group flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/5 overflow-hidden">
                          {friend.avatarUrl ? (
                            <img src={friend.avatarUrl} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-white/10"><User size={24} /></div>
                          )}
                        </div>
                        <div>
                          <h4 className="text-[15px] font-black text-white tracking-tight">{friend.fullName}</h4>
                          <p className="text-[11px] font-bold text-white/30">{friend.phoneNumber}</p>
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
                          className="p-2.5 bg-white/5 text-white/40 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
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
              <p className="text-[11px] font-black text-white/30 uppercase tracking-widest px-1">Yêu cầu đang chờ</p>
              <div className="space-y-4">
                {pendingFriends.length === 0 ? (
                  <div className="py-20 text-center opacity-20">
                    <Bell size={48} className="mx-auto mb-4" />
                    <p className="text-xs font-black uppercase tracking-[0.2em]">Không có lời mời nào</p>
                  </div>
                ) : (
                  pendingFriends.map((req) => (
                    <div key={req.userId} className="p-6 bg-white/5 border border-white/5 rounded-3xl space-y-5">
                      <div className="flex items-center space-x-4">
                        <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/5 overflow-hidden">
                          {req.avatarUrl ? <img src={req.avatarUrl} className="w-full h-full object-cover" /> : <User size={24} className="m-auto text-white/10" />}
                        </div>
                        <div className="flex-1">
                          <p className="text-[15px] text-white/70 leading-tight">
                            <span className="font-black text-white">{req.fullName}</span> muốn kết bạn
                          </p>
                          <p className="text-[11px] font-bold text-white/30 mt-1">{req.phoneNumber}</p>
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
                          className="px-6 py-4 bg-white/5 text-white/40 text-[11px] font-black uppercase tracking-[0.2em] rounded-2xl hover:bg-white/10 transition-all active:scale-95"
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
                <p className="text-[11px] font-black text-white/30 uppercase tracking-[0.2em] italic text-center">
                  Tìm kiếm bạn bè qua số điện thoại
                </p>
                
                <form onSubmit={handleSearchUser} className="flex space-x-3">
                  <div className="relative flex-1 group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-indigo-500 transition-colors" size={18} />
                    <input
                      type="text"
                      placeholder="Nhập số điện thoại..."
                      value={searchPhone}
                      onChange={(e) => setSearchPhone(e.target.value)}
                      className="w-full pl-12 pr-4 py-4 bg-white/5 border border-white/5 rounded-2xl text-sm font-medium text-white placeholder:text-white/20 focus:outline-none focus:border-indigo-500/50 transition-all"
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
                  <div className="p-8 bg-white/5 border border-white/5 rounded-[40px] space-y-8 animate-slide-up shadow-xl">
                    <div className="flex flex-col items-center text-center space-y-6">
                      <div className="w-24 h-24 rounded-[32px] bg-white/5 border border-white/5 flex items-center justify-center overflow-hidden">
                        {foundUser.avatarUrl ? (
                          <img src={foundUser.avatarUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <User size={48} className="text-white/10" />
                        )}
                      </div>
                      <div className="space-y-1">
                        <h3 className="text-2xl font-black text-white tracking-tighter">{foundUser.fullName}</h3>
                        <p className="text-[11px] font-black text-white/30 uppercase tracking-[0.3em]">{foundUser.phoneNumber}</p>
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
                          className="w-full py-4 bg-white/5 text-white border border-white/10 rounded-2xl font-black uppercase tracking-[0.2em] text-[11px] hover:bg-white/10 transition-all flex items-center justify-center space-x-3"
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
          <div className="p-8 border-t border-white/5 flex justify-center shrink-0">
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
