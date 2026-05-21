import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, AlertTriangle, ShieldAlert } from 'lucide-react';
import { useDispatch } from 'react-redux';
import { useAuth } from '../hooks/useAuth';
import { userApi } from '../api/userApi';
import { useTheme } from '../hooks/useTheme';

const DeleteAccountModal = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const { logout } = useAuth();
  const { isDark } = useTheme();
  const dispatch = useDispatch();

  if (!isOpen) return null;

  const handleDelete = async () => {
    setLoading(true);
    setError('');
    try {
      await userApi.deleteAccount();
      setIsSuccess(true);
      setTimeout(() => {
        logout();
        onClose();
      }, 4000);
    } catch (err) {
      console.error('Delete account failed', err);
      setError(err?.response?.data?.message || t('delete_account.error_failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`fixed inset-0 z-[100] flex items-center justify-center p-4 backdrop-blur-xl animate-fade-in ${isDark ? 'bg-slate-950/40' : 'bg-slate-200/40'}`}>
      <div className={`w-full max-w-md rounded-[40px] shadow-2xl relative overflow-hidden border ${isDark ? 'bg-surface-200 border-white/5' : 'bg-white border-slate-100'}`}>
        <div className={`h-20 flex items-center justify-between px-10 border-b backdrop-blur-md ${isDark ? 'bg-surface-100/50 border-white/5' : 'bg-white/50 border-slate-50'}`}>
          <div className="flex items-center space-x-3 text-red-500">
             <AlertTriangle size={24} />
             <h2 className="font-black uppercase tracking-[0.2em] text-[12px]">{t('delete_account.title')}</h2>
          </div>
          <button onClick={onClose} disabled={loading} className={`p-2 rounded-xl transition-colors disabled:opacity-50 ${isDark ? 'hover:bg-white/5 text-white/40' : 'hover:bg-slate-100 text-slate-400'}`}>
            <X size={24} />
          </button>
        </div>

        <div className="p-10 space-y-8">
          {isSuccess ? (
            <div className="flex flex-col items-center justify-center text-center space-y-4 animate-fade-in py-8">
              <div className="w-20 h-20 bg-cursor-success/10 text-cursor-success rounded-full flex items-center justify-center mb-2">
                 <ShieldAlert size={40} />
              </div>
              <p className="font-serif text-[16px] text-cursor-success font-bold leading-relaxed">
                {t('delete_account.success_title')}
              </p>
              <p className="font-serif text-[14px] text-cursor-dark/60 leading-relaxed px-4">
                {t('delete_account.success_desc')}
              </p>
            </div>
          ) : (
            <>
              <div className="flex flex-col items-center justify-center text-center space-y-4">
                 <div className="w-20 h-20 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mb-2">
                    <ShieldAlert size={40} />
                 </div>
                 <p className={`font-serif text-[14px] leading-relaxed ${isDark ? 'text-white' : 'text-slate-800'}`}>
                   {t('delete_account.confirm_question')} 
                 </p>
                 <p className={`font-serif text-[13px] leading-relaxed px-4 ${isDark ? 'text-white/60' : 'text-slate-500'}`}>
                   {t('delete_account.confirm_desc_1')}<span className={`font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('delete_account.confirm_desc_2')}</span>{t('delete_account.confirm_desc_3')}
                 </p>
              </div>

              {error && (
                <div className="p-4 bg-red-500/10 text-red-500 rounded-2xl text-[12px] font-serif font-bold text-center border border-red-500/20">
                  {error}
                </div>
              )}

              <div className="flex space-x-4 pt-4">
                <button
                  onClick={onClose}
                  disabled={loading}
                  className={`flex-1 py-4 border rounded-2xl font-black uppercase tracking-[0.2em] text-[11px] shadow-sm active:scale-95 transition-all disabled:opacity-50 ${
                    isDark ? 'bg-white/5 border-white/10 text-white hover:bg-white/10' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  {t('delete_account.btn_cancel')}
                </button>
                <button
                  onClick={handleDelete}
                  disabled={loading}
                  className="flex-1 py-4 bg-red-500 text-white rounded-2xl font-serif font-black uppercase tracking-[0.2em] text-[11px] shadow-xl hover:bg-red-600 active:scale-95 transition-all disabled:opacity-50"
                >
                  {loading ? t('password.btn_processing') : t('delete_account.btn_confirm')}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default DeleteAccountModal;
