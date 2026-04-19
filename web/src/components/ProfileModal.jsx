import { useState, useEffect } from 'react';
import { User, Camera, X, Save, ShieldCheck, Mail, Phone, Hash, AlertCircle } from 'lucide-react';
import { useDispatch } from 'react-redux';
import { useAuth } from '../hooks/useAuth';
import { updateUser } from '../store/authSlice';
import { userApi } from '../api/userApi';
import { chatApi } from '../api/chatApi';

const cn = (...classes) => classes.filter(Boolean).join(" ");

const ProfileModal = ({ isOpen, onClose, isPanel = false }) => {
  const { user, fetchProfileData } = useAuth();
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
    <div className="flex flex-col space-y-8 p-10 bg-surface-200">
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
            <label className="absolute -bottom-2 -right-2 p-3 bg-cursor-dark text-cursor-cream rounded-2xl cursor-pointer hover:scale-110 active:scale-95 transition-all shadow-xl border-4 border-surface-200">
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
                className="w-full px-5 py-3 bg-white border border-cursor-dark/10 rounded-2xl text-sm font-mono text-cursor-dark placeholder:text-cursor-dark/20 focus:outline-none focus:border-cursor-dark transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-mono font-black text-cursor-dark/40 uppercase tracking-[0.3em] px-1">Tên</label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Nhập tên..."
                className="w-full px-5 py-3 bg-white border border-cursor-dark/10 rounded-2xl text-sm font-mono text-cursor-dark placeholder:text-cursor-dark/20 focus:outline-none focus:border-cursor-dark transition-all"
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
              className="w-full px-5 py-4 bg-white border border-cursor-dark/10 rounded-2xl text-sm font-serif italic text-cursor-dark placeholder:text-cursor-dark/20 focus:outline-none focus:border-cursor-dark transition-all resize-none"
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
          className="w-full py-4 bg-cursor-dark text-cursor-cream rounded-2xl font-mono font-black uppercase tracking-[0.4em] text-[11px] shadow-xl hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center space-x-3"
        >
          <Save size={18} />
          <span>{loading ? 'Đang cập nhật...' : 'Lưu thay đổi'}</span>
        </button>
      </form>
    </div>
  );

  if (isPanel) return content;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 backdrop-blur-xl bg-cursor-cream/40 animate-fade-in">
      <div className="bg-surface-200 w-full max-w-lg rounded-[40px] shadow-2xl border border-cursor-dark/5 relative overflow-hidden">
        <div className="h-20 flex items-center justify-between px-10 border-b border-cursor-dark/5 sticky top-0 bg-surface-100/50 backdrop-blur-md">
          <h2 className="font-serif italic font-black text-cursor-dark uppercase tracking-[0.2em] text-[12px]">Hồ sơ của bạn</h2>
          <button onClick={onClose} className="p-2 hover:bg-black/5 rounded-xl text-cursor-dark/40 transition-colors">
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
