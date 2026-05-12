import { useState, useEffect } from 'react';
import { Search, X, UserPlus, Check, MessageSquare, User, Zap } from 'lucide-react';
import { userApi } from '../api/userApi';
import { friendApi } from '../api/friendApi';
import { notificationApi } from '../api/notificationApi';
import { useChat } from '../hooks/useChat';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';

const cn = (...classes) => classes.filter(Boolean).join(" ");

const SearchUserModal = ({ isOpen, onClose, isPanel = false }) => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [foundUser, setFoundUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { create, selectConversation } = useChat();
  const { user } = useAuth();
  const { isDark } = useTheme();

  useEffect(() => {
    if (foundUser) {
      console.log('[SearchDebug] Found User:', foundUser);
      console.log('[SearchDebug] Current User:', user);
      console.log('[SearchDebug] friendshipStatus:', foundUser.friendshipStatus);
      const isSelf = 
        foundUser.friendshipStatus === 'SELF' || 
        foundUser.userId === (user?.userId || user?.id) || 
        foundUser.phoneNumber === user?.phoneNumber;
      console.log('[SearchDebug] Is Self Detected:', isSelf);
    }
  }, [foundUser, user]);

  if (!isOpen) return null;

  const friendshipStatus = foundUser?.friendshipStatus || 'NONE';
  const friendshipIsRequester = Boolean(foundUser?.isRequester);

  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    if (!phoneNumber.trim()) return;

    setLoading(true);
    setError('');
    setFoundUser(null);

    try {
      const response = await userApi.searchUser(phoneNumber);
      const userData = response.data || response;
      setFoundUser(userData);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Không tìm thấy người dùng này');
    } finally {
      setLoading(false);
    }
  };

  const handleAddFriend = async () => {
    if (!foundUser) return;
    setLoading(true);
    try {
      await friendApi.sendRequest(foundUser.userId);
      const myId = user?.userId || user?.id;
      if (myId && foundUser?.userId) {
        try {
          await notificationApi.createNotification({
            senderId: myId,
            receiverId: foundUser.userId,
            type: 'FRIEND_REQUEST',
            message: `${user?.fullName || user?.phoneNumber || 'Ai đó'} đã gửi lời mời kết bạn cho bạn.`
          });
        } catch (e) {
          console.warn('Failed to create FRIEND_REQUEST notification', e);
        }
      }
      setFoundUser(prev => ({ ...prev, friendshipStatus: 'PENDING', isRequester: true }));
    } catch (err) {
      setError('Gửi lời mời kết bạn thất bại');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelFriendRequest = async () => {
    if (!foundUser) return;
    setLoading(true);
    try {
      await friendApi.cancelRequest(foundUser.userId);
      setFoundUser(prev => ({ ...prev, friendshipStatus: 'NONE', isRequester: null }));
    } catch (err) {
      setError('Hủy lời mời kết bạn thất bại');
    } finally {
      setLoading(false);
    }
  };

  const handleStartChat = async () => {
    if (!foundUser) return;
    setLoading(true);
    try {
      const result = await create('SINGLE', [foundUser.userId]);
      if (result.payload) {
        const convId = result.payload.conversationId || result.payload?.data?.conversationId;
        if (convId) selectConversation(convId);
        onClose();
      } else {
        setError(result.error?.message || 'Không thể tạo cuộc trò chuyện');
      }
    } catch (err) {
      setError('Không thể tạo cuộc trò chuyện');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setPhoneNumber('');
    setFoundUser(null);
    setError('');
    onClose();
  };

  // Aggressive check for self search
  const isSelfSearch = foundUser && (
    friendshipStatus === 'SELF' || 
    foundUser.userId === (user?.userId || user?.id) || 
    foundUser.phoneNumber === user?.phoneNumber
  );

  const content = (
    <div className={`flex flex-col space-y-6 p-8 ${isDark ? 'bg-surface-200' : 'bg-surface-100'}`}>
      <div className="space-y-6">
        <p className={`text-[11px] font-mono font-black uppercase tracking-[0.1em] px-1 italic ${isDark ? 'text-white/40' : 'text-cursor-dark/40'}`}>
          Vui lòng nhập số điện thoại hợp lệ để tìm kiếm bạn bè và bắt đầu trò chuyện.
        </p>
        
        <form onSubmit={handleSearch} className="flex space-x-3">
          <div className="relative flex-1">
            <Search className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors ${isDark ? 'text-white/40' : 'text-cursor-dark/40'}`} size={18} />
            <input
              type="text"
              placeholder="Nhập số điện thoại..."
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              disabled={loading}
              autoFocus
              className={`w-full pl-12 pr-4 py-4 border rounded-2xl text-sm font-mono transition-all focus:outline-none ${
                isDark 
                  ? 'bg-surface-100 border-white/10 text-white placeholder:text-white/20 focus:border-indigo-500' 
                  : 'bg-white border-slate-200 text-slate-800 placeholder:text-slate-400 focus:border-slate-400'
              }`}
            />
          </div>
          <button
            type="submit"
            disabled={loading || !phoneNumber.trim()}
            className={`px-6 rounded-2xl font-mono font-black uppercase tracking-[0.1em] text-[11px] hover:scale-105 active:scale-95 transition-all disabled:opacity-30 shadow-lg ${
              isDark ? 'bg-indigo-600 text-white' : 'bg-cursor-dark text-cursor-cream'
            }`}
          >
            {loading ? '...' : 'TÌM KIẾM'}
          </button>
        </form>

        {error && (
          <div className="p-4 bg-cursor-error/5 border border-cursor-error/10 rounded-2xl flex items-center space-x-3 text-cursor-error animate-fade-in shadow-sm">
             <Zap size={14} className="shrink-0" />
             <p className="text-[10px] font-mono font-black uppercase tracking-widest">{error}</p>
          </div>
        )}

        {foundUser && (
          <div className={`p-8 border rounded-[32px] space-y-8 animate-slide-up shadow-xl relative overflow-hidden ${
            isDark ? 'bg-surface-100 border-white/5' : 'bg-white border-slate-100'
          }`}>
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cursor-accent/20 to-transparent" />
            
            <div className="flex flex-col items-center text-center space-y-6">
              <div className="w-24 h-24 rounded-[32px] bg-surface-300 border border-cursor-dark/5 flex items-center justify-center overflow-hidden shadow-lg p-1">
                <div className="w-full h-full rounded-[28px] overflow-hidden bg-surface-400 flex items-center justify-center">
                {foundUser.avatar || foundUser.avatarUrl ? (
                  <img src={foundUser.avatar || foundUser.avatarUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <User size={48} className="text-cursor-dark/10" />
                )}
                </div>
              </div>
              <div className="space-y-1">
                <h3 className={`text-2xl font-serif italic font-black tracking-tighter ${isDark ? 'text-white' : 'text-cursor-dark'}`}>{foundUser.fullName}</h3>
                <p className={`text-[10px] font-mono font-black uppercase tracking-[0.4em] ${isDark ? 'text-white/30' : 'text-cursor-dark/30'}`}>{foundUser.phoneNumber}</p>
              </div>
            </div>

            {!isSelfSearch && (
              <div className="flex flex-col gap-3">
                <button
                  onClick={handleStartChat}
                  className={`w-full py-4 rounded-2xl font-mono font-black uppercase tracking-[0.2em] text-[11px] shadow-xl hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center space-x-3 ${
                    isDark ? 'bg-indigo-600 text-white' : 'bg-cursor-dark text-cursor-cream'
                  }`}
                >
                  <MessageSquare size={16} />
                  <span>Nhắn tin</span>
                </button>

                {friendshipStatus === 'ACCEPTED' ? (
                  <div className="w-full py-4 bg-emerald-50 border border-emerald-100 text-emerald-600 rounded-2xl font-mono font-black uppercase tracking-[0.2em] text-[11px] flex items-center justify-center space-x-3 cursor-default shadow-sm">
                    <Check size={16} />
                    <span>Bạn bè</span>
                  </div>
                ) : friendshipStatus === 'PENDING' ? (
                  friendshipIsRequester ? (
                    <button
                      onClick={handleCancelFriendRequest}
                      disabled={loading}
                      className="w-full py-4 bg-red-50 border border-red-100 text-red-500 rounded-2xl font-mono font-black uppercase tracking-[0.2em] text-[11px] flex items-center justify-center space-x-3 shadow-sm hover:bg-red-100 transition-all disabled:opacity-50"
                    >
                      <X size={16} />
                      <span>Hủy yêu cầu</span>
                    </button>
                  ) : (
                    <div className="w-full py-4 bg-emerald-50 border border-emerald-100 text-emerald-500 rounded-2xl font-mono font-black uppercase tracking-[0.2em] text-[11px] flex items-center justify-center space-x-3 shadow-sm">
                      <Check size={16} />
                      <span>Đã nhận lời mời</span>
                    </div>
                  )
                ) : (
                  <button
                    onClick={handleAddFriend}
                    className={`w-full py-4 rounded-2xl font-mono font-black uppercase tracking-[0.2em] text-[11px] transition-all flex items-center justify-center space-x-3 ${
                      isDark ? 'bg-white/5 text-white hover:bg-white/10' : 'bg-slate-100 text-slate-800 hover:bg-slate-200'
                    }`}
                  >
                    <UserPlus size={16} />
                    <span>Kết bạn</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  if (isPanel) return content;

  return (
    <div className={`fixed inset-0 z-[100] flex items-center justify-center p-4 backdrop-blur-xl animate-fade-in ${isDark ? 'bg-slate-950/40' : 'bg-slate-200/40'}`}>
      <div className={`w-full max-w-lg rounded-[40px] shadow-2xl relative overflow-hidden border ${isDark ? 'bg-surface-200 border-white/5' : 'bg-white border-slate-100'}`}>
        <div className={`h-20 flex items-center justify-between px-10 border-b backdrop-blur-md ${isDark ? 'bg-surface-100/30 border-white/5' : 'bg-surface-100/30 border-slate-100'}`}>
          <h2 className={`font-serif italic font-black uppercase tracking-[0.1em] text-[13px] ${isDark ? 'text-white' : 'text-cursor-dark'}`}>Tìm kiếm bạn bè</h2>
          <button onClick={handleClose} className={`p-2 rounded-xl transition-colors ${isDark ? 'hover:bg-white/5 text-white/40' : 'hover:bg-black/5 text-cursor-dark/40'}`}>
            <X size={24} />
          </button>
        </div>
        <div className="max-h-[85vh] overflow-y-auto no-scrollbar focus:outline-none">
          {content}
        </div>
      </div>
    </div>
  );
};

export default SearchUserModal;
