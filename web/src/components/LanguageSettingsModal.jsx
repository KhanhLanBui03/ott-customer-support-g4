import React from 'react';
import { useLanguageSettings } from '../hooks/useLanguageSettings';
import { X, Globe2, Check, Save, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const LanguageSettingsModal = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const { 
    preferredLanguage, 
    selectedLanguage, 
    handleSelectLanguage, 
    updateLanguage, 
    loading, 
    LANGUAGES 
  } = useLanguageSettings(isOpen);

  if (!isOpen) return null;

  const handleSave = async () => {
    const success = await updateLanguage();
    if (success) {
      // Có thể thêm thông báo thành công hoặc tự động đóng modal
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Content */}
      <div className="relative w-full max-w-md bg-white dark:bg-[#1e2330] rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-300">
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 dark:border-white/5">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-indigo-500/10 rounded-xl flex items-center justify-center">
              <Globe2 className="text-indigo-500" size={20} />
            </div>
            <h2 className="text-xl font-black text-slate-800 dark:text-white tracking-tight">{t('settings.language_title')}</h2>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl text-slate-400 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="px-6 py-6 space-y-4">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 leading-relaxed">
            {t('settings.auto_translate_msg')}
          </p>

          <div className="space-y-2 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
            {/* Tắt dịch */}
            <button
              onClick={() => handleSelectLanguage(null)}
              disabled={loading}
              className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all border-2 ${
                selectedLanguage === null 
                ? 'bg-indigo-50 border-indigo-500/50 dark:bg-indigo-500/10' 
                : 'bg-slate-50 border-transparent hover:bg-slate-100 dark:bg-white/5 dark:hover:bg-white/10'
              }`}
            >
              <div className="flex items-center space-x-3">
                <span className="text-xl">🚫</span>
                <span className={`font-bold ${selectedLanguage === null ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-600 dark:text-white/70'}`}>
                  {t('settings.disable_auto_translate')}
                </span>
              </div>
              {selectedLanguage === null && <Check size={18} className="text-indigo-500" strokeWidth={3} />}
            </button>

            <div className="py-2">
              <div className="h-px bg-slate-100 dark:bg-white/5 w-full" />
            </div>

            {/* Danh sách ngôn ngữ */}
            {LANGUAGES.map(lang => (
              <button
                key={lang.code}
                onClick={() => handleSelectLanguage(lang.code)}
                disabled={loading}
                className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all border-2 ${
                  selectedLanguage === lang.code 
                  ? 'bg-indigo-50 border-indigo-500/50 dark:bg-indigo-500/10' 
                  : 'bg-slate-50 border-transparent hover:bg-slate-100 dark:bg-white/5 dark:hover:bg-white/10'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <span className="text-xl">{lang.flag}</span>
                  <span className={`font-bold ${selectedLanguage === lang.code ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-600 dark:text-white/70'}`}>
                    {lang.label}
                  </span>
                </div>
                {selectedLanguage === lang.code && <Check size={18} className="text-indigo-500" strokeWidth={3} />}
              </button>
            ))}
          </div>
        </div>

        {/* Footer with Save button */}
        <div className="px-6 py-5 border-t border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/5">
          <button
            onClick={handleSave}
            disabled={loading || selectedLanguage === preferredLanguage}
            className="w-full flex items-center justify-center space-x-2 py-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 dark:disabled:bg-slate-800 text-white rounded-2xl font-bold transition-all transform active:scale-[0.98] shadow-lg shadow-indigo-600/20"
          >
            {loading ? (
              <Loader2 className="animate-spin" size={20} />
            ) : (
              <Save size={20} />
            )}
            <span>{loading ? t('settings.saving') : t('settings.save_settings')}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default LanguageSettingsModal;
