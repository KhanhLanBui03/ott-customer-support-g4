import React, { useState, useEffect } from 'react';
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
  const [password, setPassword] = useState('');
  const [deleteType, setDeleteType] = useState('SOFT'); // 'SOFT' or 'HARD'
  const [isOtpRequired, setIsOtpRequired] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [timer, setTimer] = useState(0);
  const [canResend, setCanResend] = useState(false);
  const [isOtpFocused, setIsOtpFocused] = useState(false);
  const { logout } = useAuth();
  const { isDark } = useTheme();
  const dispatch = useDispatch();

  useEffect(() => {
    let interval;
    if (timer > 0) {
      interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
    } else {
      setCanResend(true);
    }
    return () => clearInterval(interval);
  }, [timer]);

  if (!isOpen) return null;

  const handleDelete = async () => {
    if (!password.trim()) {
      setError('Vui lòng nhập mật khẩu để xác minh chính chủ.');
      return;
    }
    if (isOtpRequired && !otpCode.trim()) {
      setError('Vui lòng nhập mã OTP xác thực.');
      return;
    }
    
    setLoading(true);
    setError('');
    try {
      const response = await userApi.deleteAccount({ 
        password, 
        deleteType, 
        otpCode: isOtpRequired ? otpCode : null 
      });

      if (response?.data === 'OTP_REQUIRED') {
        setIsOtpRequired(true);
        setTimer(120); // 2 minutes countdown
        setCanResend(false);
        setOtpCode('');
        setError('');
      } else {
        setIsSuccess(true);
        setTimeout(() => {
          logout();
          onClose();
        }, 4000);
      }
    } catch (err) {
      console.error('Delete account failed', err);
      setError(err?.response?.data?.message || t('delete_account.error_failed'));
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await userApi.deleteAccount({ password, deleteType });
      if (response?.data === 'OTP_REQUIRED') {
        setTimer(120);
        setCanResend(false);
        setOtpCode('');
        setError('');
      }
    } catch (err) {
      setError(err?.response?.data?.message || 'Không thể gửi lại mã OTP. Vui lòng thử lại sau.');
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

        <div className="p-10 space-y-6">
          {isSuccess ? (
            <div className="flex flex-col items-center justify-center text-center space-y-4 animate-fade-in py-8">
              <div className="w-20 h-20 bg-cursor-success/10 text-cursor-success rounded-full flex items-center justify-center mb-2">
                 <ShieldAlert size={40} />
              </div>
              <p className="font-serif text-[16px] text-cursor-success font-bold leading-relaxed">
                {deleteType === 'SOFT' 
                  ? 'Đã yêu cầu tạm khóa tài khoản thành công!' 
                  : 'Tài khoản đã được xóa vĩnh viễn!'}
              </p>
              <p className={`font-serif text-[14px] leading-relaxed px-4 ${isDark ? 'text-white/60' : 'text-slate-500'}`}>
                {deleteType === 'SOFT'
                  ? 'Tài khoản của bạn đã tạm thời bị ẩn. Bạn có 30 ngày để đăng nhập lại và khôi phục. Hệ thống đang đăng xuất...'
                  : 'Dữ liệu cá nhân của bạn đã được ẩn danh hóa. Hệ thống đang đăng xuất...'}
              </p>
            </div>
          ) : isOtpRequired ? (
            <div className="space-y-6 animate-slide-up">
              <div className="text-center space-y-2">
                <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto text-red-500 mb-2">
                  <AlertTriangle size={32} />
                </div>
                <h3 className="text-lg font-black text-white">XÁC THỰC OTP CUỐI CÙNG</h3>
                <p className="text-red-400 text-xs font-serif leading-relaxed px-2">
                  CẢNH BÁO: Đây là cảnh báo cuối cùng. Khi bạn nhập OTP và xác nhận, tài khoản của bạn sẽ bị xóa vĩnh viễn lập tức và không thể khôi phục!
                </p>
              </div>

              <div className="space-y-2 text-center">
                <label className={`block text-[11px] font-mono font-black uppercase tracking-wider ${isDark ? 'text-white/40' : 'text-slate-400'}`}>
                  Nhập mã OTP 6 số đã gửi tới Email
                </label>
                <div className="relative my-6 flex justify-between items-center max-w-[320px] mx-auto">
                  {/* Hidden input to capture keyboard events and autocomplete codes */}
                  <input
                    type="text"
                    pattern="\d*"
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    onFocus={() => setIsOtpFocused(true)}
                    onBlur={() => setIsOtpFocused(false)}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    autoComplete="one-time-code"
                  />
                  
                  {/* Styled Box Grid */}
                  <div className="flex gap-3 w-full justify-between">
                    {Array.from({ length: 6 }).map((_, index) => {
                      const char = otpCode[index] || '';
                      const isFocused = isOtpFocused && (otpCode.length === index || (otpCode.length === 6 && index === 5));
                      const hasValue = char !== '';
                      
                      return (
                        <div
                          key={index}
                          className={`w-12 h-14 rounded-2xl flex items-center justify-center text-xl font-black font-mono border transition-all duration-200 pointer-events-none select-none ${
                            hasValue 
                              ? isDark 
                                ? 'bg-white/10 border-white/20 text-white scale-[1.05]' 
                                : 'bg-slate-100 border-slate-300 text-slate-800 scale-[1.05]' 
                              : isDark 
                                ? 'bg-white/5 border-white/5 text-white/30' 
                                : 'bg-slate-50 border-slate-200 text-slate-400'
                          } ${
                            isFocused 
                              ? 'border-red-500 ring-2 ring-red-500/20 scale-[1.08] shadow-lg shadow-red-500/10' 
                              : ''
                          }`}
                        >
                          {char || (isFocused ? <span className="animate-pulse text-red-500 font-normal">|</span> : '•')}
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="text-center mt-2">
                  <button
                    type="button"
                    disabled={!canResend || loading}
                    onClick={handleResendOtp}
                    className={`text-[10px] uppercase font-mono font-black tracking-widest transition-all ${
                      canResend && !loading
                        ? isDark 
                          ? 'text-cursor-accent hover:underline cursor-pointer' 
                          : 'text-blue-600 hover:underline cursor-pointer'
                        : isDark 
                          ? 'text-white/20 cursor-not-allowed' 
                          : 'text-slate-400/50 cursor-not-allowed'
                    }`}
                  >
                    {timer > 0 ? `Gửi lại mã sau ${timer}s` : 'Gửi lại mã ngay'}
                  </button>
                </div>
              </div>

              {error && (
                <div className="p-4 bg-red-500/10 text-red-500 rounded-2xl text-[12px] font-serif font-bold text-center border border-red-500/20">
                  {error}
                </div>
              )}

              <div className="flex space-x-4 pt-2">
                <button
                  type="button"
                  onClick={() => { setIsOtpRequired(false); setOtpCode(''); setError(''); }}
                  className={`flex-1 py-4 border rounded-2xl font-black uppercase tracking-[0.2em] text-[11px] shadow-sm active:scale-95 transition-all ${
                    isDark ? 'bg-white/5 border-white/10 text-white hover:bg-white/10' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  Quay lại / Hủy
                </button>
                <button
                  onClick={handleDelete}
                  disabled={loading}
                  className="flex-1 py-4 bg-red-700 hover:bg-red-800 text-white rounded-2xl font-serif font-black uppercase tracking-[0.2em] text-[11px] shadow-xl active:scale-95 transition-all disabled:opacity-50"
                >
                  {loading ? t('password.btn_processing') : 'Xác nhận xóa'}
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Delete Type Selection */}
              <div className="w-full space-y-3">
                <label className={`block text-[11px] font-mono font-black uppercase tracking-wider ${isDark ? 'text-white/40' : 'text-slate-400'}`}>
                  Chọn hình thức xóa
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => { setDeleteType('SOFT'); setError(''); }}
                    className={`p-4 border rounded-2xl flex flex-col items-center justify-center text-center space-y-1 transition-all ${
                      deleteType === 'SOFT'
                        ? 'border-cursor-accent bg-cursor-accent/10 text-cursor-accent'
                        : isDark ? 'border-white/5 bg-white/5 hover:bg-white/10 text-white/50' : 'border-slate-100 bg-slate-50 hover:bg-slate-100 text-slate-500'
                    }`}
                  >
                    <span className="font-bold text-[13px]">Tạm khóa 30 ngày</span>
                    <span className="text-[9px] opacity-75">Có thể khôi phục</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setDeleteType('HARD'); setError(''); }}
                    className={`p-4 border rounded-2xl flex flex-col items-center justify-center text-center space-y-1 transition-all ${
                      deleteType === 'HARD'
                        ? 'border-red-500 bg-red-500/10 text-red-500'
                        : isDark ? 'border-white/5 bg-white/5 hover:bg-white/10 text-white/50' : 'border-slate-100 bg-slate-50 hover:bg-slate-100 text-slate-500'
                    }`}
                  >
                    <span className="font-bold text-[13px]">Xóa vĩnh viễn ngay</span>
                    <span className="text-[9px] opacity-75">Không thể khôi phục</span>
                  </button>
                </div>
              </div>

              {/* Warning descriptions */}
              <div className={`p-4 rounded-2xl border text-[12px] leading-relaxed ${
                deleteType === 'SOFT' 
                  ? isDark ? 'bg-white/5 border-white/10 text-white/60' : 'bg-slate-50 border-slate-200 text-slate-600'
                  : 'bg-red-500/5 border-red-500/10 text-red-400'
              }`}>
                {deleteType === 'SOFT' ? (
                  <span>
                    Tài khoản của bạn sẽ được ẩn ngay lập tức. Bạn có <strong>30 ngày</strong> để đăng nhập lại hoặc click vào link trong email để khôi phục tài khoản. Sau 30 ngày tài khoản sẽ bị ẩn danh hóa vĩnh viễn.
                  </span>
                ) : (
                  <span>
                    <strong>CẢNH BÁO:</strong> Tài khoản và toàn bộ thông tin cá nhân của bạn sẽ bị <strong>ẩn danh hóa vĩnh viễn ngay lập tức</strong>. Mọi liên kết sẽ bị hủy bỏ và không thể khôi phục dưới bất kỳ hình thức nào.
                  </span>
                )}
              </div>

              {/* Password Input */}
              <div className="w-full space-y-2">
                <label className={`block text-[11px] font-mono font-black uppercase tracking-wider ${isDark ? 'text-white/40' : 'text-slate-400'}`}>
                  Xác thực mật khẩu
                </label>
                <input
                  type="password"
                  required
                  placeholder="Nhập mật khẩu xác nhận..."
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`w-full px-5 py-4 border rounded-2xl text-sm focus:outline-none transition-all ${
                    isDark 
                      ? 'bg-white/5 border-white/5 text-white focus:border-cursor-accent' 
                      : 'bg-slate-50 border-slate-100 text-slate-800 focus:border-blue-500'
                  }`}
                />
              </div>

              {error && (
                <div className="p-4 bg-red-500/10 text-red-500 rounded-2xl text-[12px] font-serif font-bold text-center border border-red-500/20">
                  {error}
                </div>
              )}

              <div className="flex space-x-4 pt-2">
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
                  className={`flex-1 py-4 text-white rounded-2xl font-serif font-black uppercase tracking-[0.2em] text-[11px] shadow-xl active:scale-95 transition-all disabled:opacity-50 ${
                    deleteType === 'SOFT' ? 'bg-red-500 hover:bg-red-600' : 'bg-red-700 hover:bg-red-800'
                  }`}
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
