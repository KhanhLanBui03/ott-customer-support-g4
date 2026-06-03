import React from 'react';
import { X, LogOut, AlertCircle } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import { useTranslation } from 'react-i18next';

const LogoutModal = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const { logout } = useAuth();
  const { isDark } = useTheme();

  if (!isOpen) return null;

  return (
    <div className={`fixed inset-0 z-[100] flex items-center justify-center p-4 backdrop-blur-xl animate-fade-in ${isDark ? 'bg-slate-950/40' : 'bg-slate-200/40'}`}>
      <div className={`w-full max-w-md rounded-[40px] shadow-2xl relative overflow-hidden border ${isDark ? 'bg-surface-200 border-white/5' : 'bg-white border-slate-100'}`}>
        <div className={`h-20 flex items-center justify-between px-10 border-b backdrop-blur-md ${isDark ? 'bg-surface-100/50 border-white/5' : 'bg-white/50 border-slate-50'}`}>
          <div className="flex items-center space-x-3 text-indigo-500">
             <LogOut size={24} />
             <h2 className="font-black uppercase tracking-[0.2em] text-[12px]">{t('logout.title')}</h2>
          </div>
          <button onClick={onClose} className={`p-2 rounded-xl transition-colors ${isDark ? 'hover:bg-white/5 text-white/40' : 'hover:bg-slate-100 text-slate-400'}`}>
            <X size={24} />
          </button>
        </div>

        <div className="p-10 space-y-8">
          <div className="flex flex-col items-center justify-center text-center space-y-4">
             <div className="w-20 h-20 bg-indigo-500/10 text-indigo-500 rounded-full flex items-center justify-center mb-2">
                <AlertCircle size={40} />
             </div>
             <p className={`font-serif text-[16px] font-bold leading-relaxed ${isDark ? 'text-white' : 'text-slate-800'}`}>
               {t('logout.confirm_question')}
             </p>
             <p className={`font-serif text-[13px] leading-relaxed px-4 ${isDark ? 'text-white/60' : 'text-slate-500'}`}>
               {t('logout.confirm_desc')}
             </p>
          </div>

          <div className="flex space-x-4 pt-4">
            <button
              onClick={onClose}
              className={`flex-1 py-4 border rounded-2xl font-black uppercase tracking-[0.2em] text-[11px] shadow-sm active:scale-95 transition-all ${
                isDark ? 'bg-white/5 border-white/10 text-white hover:bg-white/10' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
              }`}
            >
              {t('logout.btn_cancel')}
            </button>
            <button
              onClick={() => {
                logout();
                onClose();
              }}
              className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-serif font-black uppercase tracking-[0.2em] text-[11px] shadow-xl shadow-indigo-600/20 hover:bg-indigo-700 active:scale-95 transition-all"
            >
              {t('logout.btn_confirm')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LogoutModal;
