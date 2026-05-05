import React, { useState } from 'react';
import { X, Lock, Save, CheckCircle2, ShieldCheck } from 'lucide-react';
import { authApi } from '../api/authApi';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';

const ChangePasswordModal = ({ isOpen, onClose }) => {
  const { logout } = useAuth();
  const { isDark } = useTheme();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [wrongCount, setWrongCount] = useState(0);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  if (!isOpen) return null;

  const reqs = {
    length: newPassword.length >= 8,
    lower: /[a-z]/.test(newPassword),
    upper: /[A-Z]/.test(newPassword),
    number: /[0-9]/.test(newPassword),
    special: /[@$!%*?&]/.test(newPassword)
  };

  const isNewPasswordValid = Object.values(reqs).every(Boolean);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!currentPassword) {
      setErrorMsg('Vui lòng nhập mật khẩu cũ');
      return;
    }
    if (!isNewPasswordValid) {
      setErrorMsg('Mật khẩu mới chưa đạt yêu cầu');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg('Mật khẩu xác nhận không khớp');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    try {
      await authApi.changePassword({ currentPassword, newPassword });
      setSuccessMsg('Đổi mật khẩu thành công');
      setWrongCount(0);
      
      setTimeout(() => {
        setShowLogoutConfirm(true);
      }, 500);
    } catch (err) {
      const errMessage = err?.response?.data?.message || '';
      if (errMessage.toLowerCase().includes('incorrect') || errMessage.toLowerCase().includes('sai') || err?.response?.status === 400 || err?.response?.status === 401 || err?.response?.status === 403) {
        const newCount = wrongCount + 1;
        setWrongCount(newCount);
        if (newCount >= 5) {
          alert('Bạn đã nhập sai quá 5 lần. Tự động đăng xuất.');
          logout();
        } else {
          setErrorMsg(`Bạn đã nhập sai mật khẩu cũ. Số lần nhập sai: ${newCount}/5`);
        }
      } else {
        setErrorMsg('Đổi mật khẩu thất bại. Vui lòng thử lại sau.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSuccessMsg('');
    setErrorMsg('');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    onClose();
  };

  return (
    <div className={`fixed inset-0 z-[100] flex items-center justify-center p-4 backdrop-blur-xl animate-fade-in ${isDark ? 'bg-slate-950/40' : 'bg-slate-200/40'}`}>
      <div className={`w-full max-w-lg rounded-[40px] shadow-2xl relative overflow-hidden border ${isDark ? 'bg-surface-200 border-white/5' : 'bg-white border-slate-100'}`}>
        <div className={`h-20 flex items-center justify-between px-10 border-b sticky top-0 backdrop-blur-md ${isDark ? 'bg-surface-100/50 border-white/5' : 'bg-white/50 border-slate-50'}`}>
          <h2 className={`font-black uppercase tracking-[0.2em] text-[12px] ${isDark ? 'text-white' : 'text-slate-800'}`}>Đổi mật khẩu</h2>
          <button onClick={handleClose} className={`p-2 rounded-xl transition-colors ${isDark ? 'hover:bg-white/5 text-white/40' : 'hover:bg-slate-100 text-slate-400'}`}>
            <X size={24} />
          </button>
        </div>
        
        <div className="p-10 max-h-[80vh] overflow-y-auto no-scrollbar">
          <form onSubmit={handleSubmit} className="space-y-6">
            
            <div className="space-y-2 relative">
              <label className="text-[10px] font-mono font-black text-cursor-dark/40 uppercase tracking-[0.3em] px-1 flex items-center space-x-2">
                <Lock size={12} /><span>Mật khẩu cũ</span>
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => {
                    setCurrentPassword(e.target.value);
                    if(errorMsg.includes('mật khẩu cũ')) setErrorMsg('');
                  }}
                  placeholder="Nhập mật khẩu cũ..."
                  className={`w-full px-5 py-3 border rounded-2xl text-sm font-mono transition-all focus:outline-none ${
                    errorMsg.includes('mật khẩu cũ') 
                      ? 'border-red-500/50 focus:border-red-500' 
                      : (isDark ? 'border-white/10 focus:border-indigo-500' : 'border-slate-200 focus:border-slate-400')
                  } ${isDark ? 'bg-surface-100 text-white placeholder:text-white/20' : 'bg-slate-50 text-slate-800 placeholder:text-slate-400'}`}
                />
                {successMsg && (
                  <div className="absolute inset-y-0 right-4 flex items-center">
                    <CheckCircle2 size={18} className="text-cursor-success" />
                  </div>
                )}
              </div>
              {errorMsg && errorMsg.includes('mật khẩu cũ') && (
                <p className="text-[11px] text-red-500 font-mono font-bold px-1 mt-1">{errorMsg}</p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-mono font-black text-cursor-dark/40 uppercase tracking-[0.3em] px-1 flex items-center space-x-2">
                <Lock size={12} /><span>Mật khẩu mới</span>
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Nhập mật khẩu mới..."
                className={`w-full px-5 py-3 border rounded-2xl text-sm font-mono transition-all focus:outline-none ${
                  isDark 
                    ? 'bg-surface-100 border-white/10 text-white placeholder:text-white/20 focus:border-indigo-500' 
                    : 'bg-slate-50 border-slate-200 text-slate-800 placeholder:text-slate-400 focus:border-slate-400'
                }`}
              />
              
              {/* Password Requirements */}
              <div className="mt-3 p-4 bg-white/50 rounded-2xl border border-cursor-dark/5 space-y-2">
                <div className="text-[10px] font-mono font-black text-cursor-dark/40 uppercase tracking-[0.2em] mb-2">Yêu cầu bảo mật:</div>
                <div className={`text-[11px] font-mono flex items-center space-x-2 ${reqs.length ? 'text-cursor-success' : 'text-cursor-dark/40'}`}>
                  {reqs.length ? <CheckCircle2 size={12}/> : <div className="w-3 h-3 rounded-full border border-current opacity-50" />}
                  <span>Ít nhất 8 ký tự</span>
                </div>
                <div className={`text-[11px] font-mono flex items-center space-x-2 ${reqs.lower ? 'text-cursor-success' : 'text-cursor-dark/40'}`}>
                  {reqs.lower ? <CheckCircle2 size={12}/> : <div className="w-3 h-3 rounded-full border border-current opacity-50" />}
                  <span>Chứa chữ cái in thường</span>
                </div>
                <div className={`text-[11px] font-mono flex items-center space-x-2 ${reqs.upper ? 'text-cursor-success' : 'text-cursor-dark/40'}`}>
                  {reqs.upper ? <CheckCircle2 size={12}/> : <div className="w-3 h-3 rounded-full border border-current opacity-50" />}
                  <span>Chứa chữ cái in hoa</span>
                </div>
                <div className={`text-[11px] font-mono flex items-center space-x-2 ${reqs.number ? 'text-cursor-success' : 'text-cursor-dark/40'}`}>
                  {reqs.number ? <CheckCircle2 size={12}/> : <div className="w-3 h-3 rounded-full border border-current opacity-50" />}
                  <span>Chứa số</span>
                </div>
                <div className={`text-[11px] font-mono flex items-center space-x-2 ${reqs.special ? 'text-cursor-success' : 'text-cursor-dark/40'}`}>
                  {reqs.special ? <CheckCircle2 size={12}/> : <div className="w-3 h-3 rounded-full border border-current opacity-50" />}
                  <span>Chứa ký tự đặc biệt (@$!%*?&)</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-mono font-black text-cursor-dark/40 uppercase tracking-[0.3em] px-1 flex items-center space-x-2">
                <Lock size={12} /><span>Xác nhận mật khẩu</span>
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Nhập lại mật khẩu mới..."
                className={`w-full px-5 py-3 border rounded-2xl text-sm font-mono transition-all focus:outline-none ${
                  isDark 
                    ? 'bg-surface-100 border-white/10 text-white placeholder:text-white/20 focus:border-indigo-500' 
                    : 'bg-slate-50 border-slate-200 text-slate-800 placeholder:text-slate-400 focus:border-slate-400'
                }`}
              />
               {confirmPassword && newPassword !== confirmPassword && (
                <p className="text-[11px] text-red-500 font-mono font-bold px-1 mt-1">Mật khẩu xác nhận không khớp</p>
              )}
            </div>

            {errorMsg && !errorMsg.includes('mật khẩu cũ') && (
              <p className="text-[11px] text-red-500 font-mono font-bold text-center px-1">{errorMsg}</p>
            )}

            <button
              type="submit"
              disabled={loading || !isNewPasswordValid || !currentPassword || newPassword !== confirmPassword}
              className={`w-full py-4 mt-4 rounded-2xl font-mono font-black uppercase tracking-[0.4em] text-[11px] shadow-xl hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center space-x-3 ${
                isDark ? 'bg-indigo-600 text-white' : 'bg-slate-900 text-white'
              }`}
            >
              <Save size={18} />
              <span>{loading ? 'Đang xử lý...' : 'Xác nhận thay đổi'}</span>
            </button>
          </form>
        </div>
      </div>
      
      {/* Floating Notifications */}
      {successMsg && (
        <div className="fixed top-10 right-10 z-[200] animate-slide-left bg-cursor-success text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center space-x-3">
          <ShieldCheck size={20} />
          <span className="font-mono font-black uppercase tracking-widest text-[12px]">{successMsg}</span>
        </div>
      )}

      {/* Custom Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 backdrop-blur-sm bg-black/40 animate-fade-in">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl text-center space-y-6">
            <div className="w-16 h-16 bg-cursor-success/10 rounded-full flex items-center justify-center mx-auto">
              <ShieldCheck size={32} className="text-cursor-success" />
            </div>
            <div>
              <h3 className="font-serif italic font-bold text-xl text-cursor-dark mb-2">Bảo mật</h3>
              <p className="text-sm font-mono text-cursor-dark/60">Vui lòng đăng nhập lại bằng mật khẩu mới để tiếp tục.</p>
            </div>
            <button
              onClick={() => logout()}
              className="w-full py-4 bg-cursor-dark text-white rounded-2xl font-mono font-black uppercase tracking-[0.2em] text-[12px] hover:scale-105 active:scale-95 transition-all shadow-xl"
            >
              Đăng nhập lại
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChangePasswordModal;
