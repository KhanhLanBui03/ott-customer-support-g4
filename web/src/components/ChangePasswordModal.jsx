import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Lock, Save, CheckCircle2, ShieldCheck } from 'lucide-react';
import { authApi } from '../api/authApi';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';

const ChangePasswordModal = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
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
      setErrorMsg(t('password.error_old_required'));
      return;
    }
    if (!isNewPasswordValid) {
      setErrorMsg(t('password.error_new_invalid'));
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg(t('password.error_mismatch'));
      return;
    }

    setLoading(true);
    setErrorMsg('');
    try {
      await authApi.changePassword({ currentPassword, newPassword });
      setSuccessMsg(t('password.success'));
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
          alert(t('password.error_too_many_attempts'));
          logout();
        } else {
          setErrorMsg(t('password.error_wrong_old', { count: newCount }));
        }
      } else {
        setErrorMsg(t('password.error_failed'));
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
          <h2 className={`font-bold tracking-tight text-lg ${isDark ? 'text-white' : 'text-slate-800'}`}>{t('password.title')}</h2>
          <button onClick={handleClose} className={`p-2 rounded-xl transition-colors ${isDark ? 'hover:bg-white/5 text-white/40' : 'hover:bg-slate-100 text-slate-400'}`}>
            <X size={24} />
          </button>
        </div>
        
        <div className="p-10 max-h-[80vh] overflow-y-auto no-scrollbar">
          <form onSubmit={handleSubmit} className="space-y-6">
            
            <div className="space-y-2 relative">
              <label className={`text-sm font-medium px-1 flex items-center space-x-2 ${isDark ? 'text-white/60' : 'text-slate-600'}`}>
                <Lock size={14} /><span>{t('password.old_password')}</span>
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => {
                    setCurrentPassword(e.target.value);
                    if(errorMsg.includes(t('password.old_password').toLowerCase())) setErrorMsg('');
                  }}
                  placeholder={t('password.old_password_placeholder')}
                  className={`w-full px-5 py-3 border rounded-2xl text-sm transition-all focus:outline-none ${
                    errorMsg.includes(t('password.old_password').toLowerCase()) 
                      ? 'border-red-500/50 focus:border-red-500' 
                      : (isDark ? 'border-white/10 focus:border-indigo-500' : 'border-slate-200 focus:border-slate-400')
                  } ${isDark ? 'bg-surface-100 text-white placeholder:text-white/30' : 'bg-slate-50 text-slate-900 placeholder:text-slate-400'}`}
                />
                {successMsg && (
                  <div className="absolute inset-y-0 right-4 flex items-center">
                    <CheckCircle2 size={18} className="text-emerald-500" />
                  </div>
                )}
              </div>
              {errorMsg && errorMsg.includes(t('password.old_password').toLowerCase()) && (
                <p className="text-xs text-red-500 font-medium px-1 mt-1">{errorMsg}</p>
              )}
            </div>

            <div className="space-y-2">
              <label className={`text-sm font-medium px-1 flex items-center space-x-2 ${isDark ? 'text-white/60' : 'text-slate-600'}`}>
                <Lock size={14} /><span>{t('password.new_password')}</span>
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder={t('password.new_password_placeholder')}
                className={`w-full px-5 py-3 border rounded-2xl text-sm transition-all focus:outline-none ${
                  isDark 
                    ? 'bg-surface-100 border-white/10 text-white placeholder:text-white/30 focus:border-indigo-500' 
                    : 'bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-slate-400'
                }`}
              />
              
              {/* Password Requirements */}
              <div className={`mt-3 p-4 rounded-2xl border space-y-2 ${isDark ? 'bg-white/5 border-white/5' : 'bg-white/50 border-slate-100'}`}>
                <div className={`text-xs font-bold mb-2 ${isDark ? 'text-white/60' : 'text-slate-600'}`}>{t('password.requirements_title')}</div>
                <div className={`text-xs flex items-center space-x-2 ${reqs.length ? 'text-emerald-500' : (isDark ? 'text-white/40' : 'text-slate-400')}`}>
                  {reqs.length ? <CheckCircle2 size={14}/> : <div className="w-3.5 h-3.5 rounded-full border border-current opacity-50" />}
                  <span>{t('password.req_length')}</span>
                </div>
                <div className={`text-xs flex items-center space-x-2 ${reqs.lower ? 'text-emerald-500' : (isDark ? 'text-white/40' : 'text-slate-400')}`}>
                  {reqs.lower ? <CheckCircle2 size={14}/> : <div className="w-3.5 h-3.5 rounded-full border border-current opacity-50" />}
                  <span>{t('password.req_lower')}</span>
                </div>
                <div className={`text-xs flex items-center space-x-2 ${reqs.upper ? 'text-emerald-500' : (isDark ? 'text-white/40' : 'text-slate-400')}`}>
                  {reqs.upper ? <CheckCircle2 size={14}/> : <div className="w-3.5 h-3.5 rounded-full border border-current opacity-50" />}
                  <span>{t('password.req_upper')}</span>
                </div>
                <div className={`text-xs flex items-center space-x-2 ${reqs.number ? 'text-emerald-500' : (isDark ? 'text-white/40' : 'text-slate-400')}`}>
                  {reqs.number ? <CheckCircle2 size={14}/> : <div className="w-3.5 h-3.5 rounded-full border border-current opacity-50" />}
                  <span>{t('password.req_number')}</span>
                </div>
                <div className={`text-xs flex items-center space-x-2 ${reqs.special ? 'text-emerald-500' : (isDark ? 'text-white/40' : 'text-slate-400')}`}>
                  {reqs.special ? <CheckCircle2 size={14}/> : <div className="w-3.5 h-3.5 rounded-full border border-current opacity-50" />}
                  <span>{t('password.req_special')}</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className={`text-sm font-medium px-1 flex items-center space-x-2 ${isDark ? 'text-white/60' : 'text-slate-600'}`}>
                <Lock size={14} /><span>{t('password.confirm_password')}</span>
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder={t('password.confirm_password_placeholder')}
                className={`w-full px-5 py-3 border rounded-2xl text-sm transition-all focus:outline-none ${
                  isDark 
                    ? 'bg-surface-100 border-white/10 text-white placeholder:text-white/30 focus:border-indigo-500' 
                    : 'bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-slate-400'
                }`}
              />
               {confirmPassword && newPassword !== confirmPassword && (
                <p className="text-xs text-red-500 font-medium px-1 mt-1">{t('password.error_mismatch')}</p>
              )}
            </div>

            {errorMsg && !errorMsg.toLowerCase().includes(t('password.old_password').toLowerCase()) && (
              <p className="text-xs text-red-500 font-medium text-center px-1">{errorMsg}</p>
            )}

            <button
              type="submit"
              disabled={loading || !isNewPasswordValid || !currentPassword || newPassword !== confirmPassword}
              className={`w-full py-4 mt-4 rounded-2xl font-bold text-sm shadow-xl hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center space-x-3 ${
                isDark ? 'bg-indigo-600 text-white' : 'bg-slate-900 text-white'
              }`}
            >
              <Save size={18} />
              <span>{loading ? t('password.btn_processing') : t('password.btn_confirm')}</span>
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
              <h3 className="font-serif italic font-bold text-xl text-cursor-dark mb-2">{t('password.logout_confirm_title')}</h3>
              <p className="text-sm font-mono text-cursor-dark/60">{t('password.logout_confirm_desc')}</p>
            </div>
            <button
              onClick={() => logout()}
              className="w-full py-4 bg-cursor-dark text-white rounded-2xl font-mono font-black uppercase tracking-[0.2em] text-[12px] hover:scale-105 active:scale-95 transition-all shadow-xl"
            >
              {t('password.btn_relogin')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChangePasswordModal;
