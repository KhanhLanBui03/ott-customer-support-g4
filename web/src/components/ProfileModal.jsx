import { useState, useEffect } from 'react';
import { User, Camera, X, Save, ShieldCheck } from 'lucide-react';
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
    try {
      const response = await chatApi.uploadMedia(file, 'avatars');
      const data = response.data || response;
      setAvatarUrl(data.url);
    } catch (err) {
      alert('Node fragment upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setSuccess('');
    try {
      const response = await userApi.updateProfile({
        firstName,
        lastName,
        bio,
        avatarUrl
      });

      const updatedData = response.data?.data || response.data || response;
      dispatch(updateUser(updatedData));
      await fetchProfileData();
      setSuccess('Identity synchronized');
      if (!isPanel) {
        setTimeout(() => {
          onClose();
        }, 1000);
      }
    } catch (err) {
      alert('Failed to rewrite identity');
    } finally {
      setLoading(false);
    }
  };

  const content = (
    <div className="flex flex-col space-y-8 p-10 bg-surface-200">
      <form onSubmit={handleSubmit} className="space-y-10">
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
            <h3 className="font-serif italic font-bold text-cursor-dark text-lg">{user?.fullName || "Identity Label"}</h3>
            <p className="text-[10px] font-mono font-black text-cursor-dark/30 uppercase tracking-[0.2em]">{user?.phoneNumber || "Node Address"}</p>
          </div>
          {uploading && <p className="text-[10px] text-cursor-accent font-mono font-black animate-pulse tracking-widest uppercase">Uploading Fragment...</p>}
          {success && <p className="text-[10px] text-cursor-success font-mono font-black uppercase tracking-widest">✓ {success}</p>}
        </div>

        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-mono font-black text-cursor-dark/40 uppercase tracking-[0.3em] px-1">First Access Key</label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Name segment..."
                className="w-full px-5 py-3 bg-white border border-cursor-dark/10 rounded-2xl text-sm font-mono text-cursor-dark placeholder:text-cursor-dark/20 focus:outline-none focus:border-cursor-dark transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-mono font-black text-cursor-dark/40 uppercase tracking-[0.3em] px-1">Final Index</label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Final fragment..."
                className="w-full px-5 py-3 bg-white border border-cursor-dark/10 rounded-2xl text-sm font-mono text-cursor-dark placeholder:text-cursor-dark/20 focus:outline-none focus:border-cursor-dark transition-all"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-mono font-black text-cursor-dark/40 uppercase tracking-[0.3em] px-1">Identity Log (Bio)</label>
            <textarea
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell the nodes about yourself..."
              className="w-full px-5 py-4 bg-white border border-cursor-dark/10 rounded-2xl text-sm font-serif italic text-cursor-dark placeholder:text-cursor-dark/20 focus:outline-none focus:border-cursor-dark transition-all resize-none"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-4 bg-cursor-dark text-cursor-cream rounded-2xl font-mono font-black uppercase tracking-[0.4em] text-[11px] shadow-xl hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center space-x-3"
        >
          <Save size={18} />
          <span>{loading ? 'Rewriting...' : 'Synchronize Identity'}</span>
        </button>
      </form>
    </div>
  );

  if (isPanel) return content;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 backdrop-blur-xl bg-cursor-cream/40 animate-fade-in">
      <div className="bg-surface-200 w-full max-w-lg rounded-[40px] shadow-2xl border border-cursor-dark/5 relative overflow-hidden">
        <div className="h-20 flex items-center justify-between px-10 border-b border-cursor-dark/5 sticky top-0 bg-surface-100/50 backdrop-blur-md">
          <h2 className="font-serif italic font-black text-cursor-dark uppercase tracking-[0.2em] text-[12px]">Identity Config</h2>
          <button onClick={onClose} className="p-2 hover:bg-black/5 rounded-xl text-cursor-dark/40 transition-colors">
            <X size={24} />
          </button>
        </div>
        <div className="max-h-[80vh] overflow-y-auto no-scrollbar">
          {content}
        </div>
      </div>
    </div>
  );
};

export default ProfileModal;
