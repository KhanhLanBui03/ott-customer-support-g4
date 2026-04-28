import { useState, useEffect } from 'react';
import { User, Camera, X, Save, ShieldCheck, Mail, Phone, Hash, AlertCircle } from 'lucide-react';
import { useDispatch } from 'react-redux';
import { useAuth } from '../hooks/useAuth';
import { updateUser } from '../store/authSlice';
import { userApi } from '../api/userApi';
import { chatApi } from '../api/chatApi';

import { useTheme } from '../hooks/useTheme';

const cn = (...classes) => classes.filter(Boolean).join(" ");

const ProfileModal = ({ isOpen, onClose, isPanel = false }) => {
  const { user, fetchProfileData } = useAuth();
  const { isDark } = useTheme();
  const dispatch = useDispatch();
  const [firstName, setFirstName] = useState(user?.firstName || '');
  const [lastName, setLastName] = useState(user?.lastName || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar || '');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) {
      setFirstName(user.firstName || '');
      setLastName(user.lastName || '');
      setBio(user.bio || '');
      setAvatarUrl(user.avatar || '');
    }
  }, [user]);

  if (!isOpen) return null;

  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    setError('');
    setSuccess('');
    try {
      const response = await chatApi.uploadMedia(file, 'avatars');
      const data = response.data || response;
      setAvatarUrl(data.url);
      setSuccess('Tải ảnh lên thành công');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError('Tải ảnh đại diện thất bại');
      setTimeout(() => setError(''), 4000);
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setSuccess('');
    setError('');
    try {
      const response = await userApi.updateProfile({
        firstName,
        lastName,
        bio,
        avatarUrl
      });

      const data = response.data?.data || response.data || response;
      const updatedUser = {
        ...data,
        avatar: data.avatarUrl || data.avatar,
        id: data.userId || data.id,
      };
      dispatch(updateUser(updatedUser));
      if(fetchProfileData) await fetchProfileData();
      setSuccess('Cập nhật thành công');
      setTimeout(() => setSuccess(''), 3000);
      if (!isPanel) {
        setTimeout(() => {
          onClose();
        }, 3000);
      }
    } catch (err) {
      setError(err?.response?.data?.message || 'Cập nhật hồ sơ thất bại');
      setTimeout(() => setError(''), 4000);
    } finally {
      setLoading(false);
    }
  };

  const content = (
    <div className={`flex flex-col space-y-8 p-10 ${isDark ? 'bg-surface-200' : 'bg-white'}`}>
      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Avatar Section */}
        <div className="flex flex-col items-center space-y-6">
          <div className="relative group">
            <div className="w-32 h-32 rounded-[40px] bg-surface-400 flex items-center justify-center overflow-hidden border border-cursor-dark/5 shadow-xl transition-all p-1">
              <div className="w-full h-full rounded-[36px] bg-surface-300 flex items-center justify-center overflow-hidden">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <User size={64} className="text-cursor-dark/10" />
                )}
              </div>
            </div>
            <label className={`absolute -bottom-2 -right-2 p-3 rounded-2xl cursor-pointer hover:scale-110 active:scale-95 transition-all shadow-xl border-4 ${
              isDark ? 'bg-indigo-600 text-white border-surface-200' : 'bg-slate-900 text-white border-white'
            }`}>
              <Camera size={20} />
              <input type="file" onChange={handleAvatarUpload} accept="image/*" className="hidden" />
            </label>
          </div>
          <div className="text-center">
            <h3 className="font-serif italic font-bold text-cursor-dark text-lg">{user?.fullName || "Người dùng"}</h3>
            <p className="text-[10px] font-mono font-black text-cursor-dark/30 uppercase tracking-[0.2em]">{user?.phoneNumber || "Chưa có số điện thoại"}</p>
          </div>
          {uploading && <p className="text-[10px] text-cursor-accent font-mono font-black animate-pulse tracking-widest uppercase">Đang tải ảnh lên...</p>}
        </div>

        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-mono font-black text-cursor-dark/40 uppercase tracking-[0.3em] px-1">Họ</label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Nhập họ..."
                className={`w-full px-5 py-3 border rounded-2xl text-sm font-mono transition-all focus:outline-none ${
                  isDark 
                    ? 'bg-surface-100 border-white/10 text-white placeholder:text-white/20 focus:border-indigo-500' 
                    : 'bg-slate-50 border-slate-200 text-slate-800 placeholder:text-slate-400 focus:border-slate-400'
                }`}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-mono font-black text-cursor-dark/40 uppercase tracking-[0.3em] px-1">Tên</label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Nhập tên..."
                className={`w-full px-5 py-3 border rounded-2xl text-sm font-mono transition-all focus:outline-none ${
                  isDark 
                    ? 'bg-surface-100 border-white/10 text-white placeholder:text-white/20 focus:border-indigo-500' 
                    : 'bg-slate-50 border-slate-200 text-slate-800 placeholder:text-slate-400 focus:border-slate-400'
                }`}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-mono font-black text-cursor-dark/40 uppercase tracking-[0.3em] px-1 flex items-center space-x-2"><Mail size={12} /><span>Email</span></label>
            <input
              type="text"
              value={user?.email || 'Chưa cập nhật email'}
              disabled
              className="w-full px-5 py-3 bg-surface-300/50 border border-cursor-dark/5 rounded-2xl text-sm font-mono text-cursor-dark/50 cursor-not-allowed transition-all"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-mono font-black text-cursor-dark/40 uppercase tracking-[0.3em] px-1">Tiểu sử</label>
            <textarea
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Giới thiệu về bản thân..."
              className={`w-full px-5 py-4 border rounded-2xl text-sm font-serif italic transition-all resize-none focus:outline-none ${
                isDark 
                  ? 'bg-surface-100 border-white/10 text-white placeholder:text-white/20 focus:border-indigo-500' 
                  : 'bg-slate-50 border-slate-200 text-slate-800 placeholder:text-slate-400 focus:border-slate-400'
              }`}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
             <div className="space-y-2">
              <label className="text-[10px] font-mono font-black text-cursor-dark/40 uppercase tracking-[0.3em] px-1 flex items-center space-x-2"><Phone size={12} /><span>Số điện thoại</span></label>
              <input
                type="text"
                value={user?.phoneNumber || 'Chưa cập nhật'}
                disabled
                className="w-full px-5 py-3 bg-surface-300/50 border border-cursor-dark/5 rounded-2xl text-sm font-mono text-cursor-dark/50 cursor-not-allowed transition-all"
              />
            </div>
             <div className="space-y-2">
              <label className="text-[10px] font-mono font-black text-cursor-dark/40 uppercase tracking-[0.3em] px-1 flex items-center space-x-2"><Hash size={12} /><span>ID Người dùng</span></label>
              <input
                type="text"
                value={user?.userId || user?.id || ''}
                disabled
                className="w-full px-5 py-3 bg-surface-300/50 border border-cursor-dark/5 rounded-2xl text-[10px] font-mono text-cursor-dark/50 cursor-not-allowed transition-all truncate"
              />
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className={`w-full py-4 rounded-2xl font-mono font-black uppercase tracking-[0.4em] text-[11px] shadow-xl hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center space-x-3 ${
            isDark ? 'bg-indigo-600 text-white' : 'bg-slate-900 text-white'
          }`}
        >
          <Save size={18} />
          <span>{loading ? 'Đang cập nhật...' : 'Lưu thay đổi'}</span>
        </button>
      </form>
    </div>
  );

  if (isPanel) return content;

  return (
    <div className={`fixed inset-0 z-[100] flex items-center justify-center p-4 backdrop-blur-xl animate-fade-in ${isDark ? 'bg-slate-950/40' : 'bg-slate-200/40'}`}>
      <div className={`w-full max-w-lg rounded-[40px] shadow-2xl relative overflow-hidden border ${isDark ? 'bg-surface-200 border-white/5' : 'bg-white border-slate-100'}`}>
        <div className={`h-20 flex items-center justify-between px-10 border-b sticky top-0 backdrop-blur-md ${isDark ? 'bg-surface-100/50 border-white/5' : 'bg-white/50 border-slate-50'}`}>
          <h2 className={`font-black uppercase tracking-[0.2em] text-[12px] ${isDark ? 'text-white' : 'text-slate-800'}`}>Hồ sơ của bạn</h2>
          <button onClick={onClose} className={`p-2 rounded-xl transition-colors ${isDark ? 'hover:bg-white/5 text-white/40' : 'hover:bg-slate-100 text-slate-400'}`}>
            <X size={24} />
          </button>
        </div>
        <div className="max-h-[80vh] overflow-y-auto no-scrollbar">
          {content}
        </div>
      </div>
      
      {/* Floating Notifications */}
      {success && (
        <div className="fixed top-10 right-10 z-[200] animate-slide-left bg-cursor-success text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center space-x-3">
          <ShieldCheck size={20} />
          <span className="font-mono font-black uppercase tracking-widest text-[12px]">{success}</span>
        </div>
      )}
      {error && (
        <div className="fixed top-10 right-10 z-[200] animate-slide-left bg-cursor-error text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center space-x-3">
          <AlertCircle size={20} />
          <span className="font-mono font-black uppercase tracking-widest text-[12px]">{error}</span>
        </div>
      )}
    </div>
  );
};

export default ProfileModal;
