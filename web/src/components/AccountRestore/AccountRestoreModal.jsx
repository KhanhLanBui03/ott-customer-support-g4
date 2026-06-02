import React, { useState, useEffect } from 'react';
import { Shield, Mail, ArrowRight, RefreshCw, X, AlertCircle, CheckCircle } from 'lucide-react';
import authApi from '../../api/authApi';

const AccountRestoreModal = ({ email, lockedAt, deletionDate, onClose }) => {
  const [step, setStep] = useState(1); // 1: Info, 2: OTP
  const [loading, setLoading] = useState(false);
  const [otp, setOtp] = useState('');
  const [timer, setTimer] = useState(0);
  const [canResend, setCanResend] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isOtpFocused, setIsOtpFocused] = useState(false);

  // Calculate formatted date
  const lockedDate = new Date(lockedAt);
  const formattedDeletionDate = deletionDate 
    ? new Date(deletionDate).toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    : null;

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

  const handleStartReactivationFlow = async () => {
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      await authApi.restoreSendOtp(email);
      setTimer(120);
      setCanResend(false);
      setSuccess('Mã OTP đã được gửi tới email của bạn.');
      setTimeout(() => setSuccess(''), 5000);
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.message || 'Không thể gửi mã OTP. Vui lòng thử lại sau.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async () => {
    setError('');
    setLoading(true);
    try {
      await authApi.restoreSendOtp(email);
      setTimer(120);
      setCanResend(false);
      setSuccess('Mã OTP đã được gửi lại tới email.');
      setTimeout(() => setSuccess(''), 5000);
    } catch (err) {
      setError('Không thể gửi mã OTP. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (otp.length < 6) return;
    setError('');
    setLoading(true);
    try {
      await authApi.restoreVerifyOtpReactivate({ email, otp });
      setSuccess('Kích hoạt lại tài khoản thành công!');
      setTimeout(() => {
        onClose();
        // Reload page to automatically log in the reactivated user
        window.location.reload();
      }, 2000);
    } catch (err) {
      setError(err.response?.data?.message || 'Mã OTP không hợp lệ hoặc đã hết hạn.');
    } finally {
      setLoading(false);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-6 text-center animate-fade-in">
            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto">
              <AlertCircle size={32} className="text-red-500" />
            </div>
            <div className="space-y-3">
              <h3 className="text-xl font-black text-white">Tài khoản chờ xóa</h3>
              <p className="text-white/60 text-sm leading-relaxed px-2">
                Tài khoản này đang trong quá trình chờ xóa. Dự kiến xóa vĩnh viễn vào ngày <span className="text-red-400 font-bold">{formattedDeletionDate || '30 ngày từ lúc khóa'}</span>.
              </p>
              <p className="text-white/40 text-[10px] uppercase font-mono tracking-widest">
                Bạn có muốn nhận mã OTP để xác nhận kích hoạt lại tài khoản này ngay không?
              </p>
            </div>
            <div className="flex flex-col gap-3 pt-4">
              <button
                onClick={handleStartReactivationFlow}
                disabled={loading}
                className="w-full py-4 bg-cursor-accent text-cursor-dark rounded-2xl font-black uppercase tracking-widest text-xs hover:scale-105 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? <RefreshCw className="animate-spin mx-auto" size={16} /> : (
                  <>
                    <span>Kích hoạt lại tài khoản</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="w-full py-3 text-white/40 font-black uppercase tracking-widest text-[9px] hover:text-white transition-all disabled:opacity-50"
              >
                Không, thoát ra ngoài
              </button>
            </div>
          </div>
        );

      case 2:
        return (
          <form onSubmit={handleVerifyOtp} className="space-y-6 animate-slide-up">
            <div className="text-center space-y-2">
              <Mail size={32} className="text-cursor-accent mx-auto" />
              <h3 className="text-xl font-black text-white">Nhập mã OTP</h3>
              <p className="text-white/40 text-xs">Mã đã được gửi tới email: {email}</p>
            </div>

            <div className="relative my-6 flex justify-between items-center max-w-[280px] mx-auto">
              {/* Hidden input to capture keyboard events */}
              <input
                type="text"
                pattern="\d*"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                onFocus={() => setIsOtpFocused(true)}
                onBlur={() => setIsOtpFocused(false)}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                autoComplete="one-time-code"
              />
              
              {/* Styled Box Grid */}
              <div className="flex gap-2.5 w-full justify-between">
                {Array.from({ length: 6 }).map((_, index) => {
                  const char = otp[index] || '';
                  const isFocused = isOtpFocused && (otp.length === index || (otp.length === 6 && index === 5));
                  const hasValue = char !== '';
                  
                  return (
                    <div
                      key={index}
                      className={`w-10 h-12 rounded-xl flex items-center justify-center text-lg font-black font-mono border transition-all duration-200 pointer-events-none select-none ${
                        hasValue 
                          ? 'bg-white/10 border-white/20 text-white scale-[1.05]' 
                          : 'bg-white/5 border-white/5 text-white/30'
                      } ${
                        isFocused 
                          ? 'border-cursor-accent ring-2 ring-cursor-accent/20 scale-[1.08] shadow-lg shadow-cursor-accent/10' 
                          : ''
                      }`}
                    >
                      {char || (isFocused ? <span className="animate-pulse text-cursor-accent font-normal">|</span> : '•')}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="text-center">
              <button
                type="button"
                disabled={!canResend || loading}
                onClick={handleSendOtp}
                className={`text-[10px] uppercase font-mono font-black tracking-widest transition-all ${
                  canResend && !loading ? 'text-cursor-accent hover:underline cursor-pointer' : 'text-white/20 cursor-not-allowed'
                }`}
              >
                {timer > 0 ? `Gửi lại mã sau ${timer}s` : 'Gửi lại mã ngay'}
              </button>
            </div>
            
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => { setStep(1); setOtp(''); setError(''); }}
                disabled={loading}
                className="flex-1 py-4 bg-white/5 border border-white/10 rounded-2xl text-white/80 font-black uppercase tracking-widest text-xs hover:bg-white/10 transition-all disabled:opacity-50"
              >
                Quay lại
              </button>
              <button
                disabled={loading || otp.length < 6}
                type="submit"
                className="flex-1 py-4 bg-cursor-accent text-cursor-dark rounded-2xl font-black uppercase tracking-widest text-xs hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
              >
                {loading ? <RefreshCw className="animate-spin mx-auto" size={16} /> : 'Xác thực'}
              </button>
            </div>
          </form>
        );
      
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-cursor-dark/80 backdrop-blur-md">
      <div className="relative max-w-sm w-full bg-[#0D0D0D] border border-white/10 rounded-[32px] p-8 shadow-2xl overflow-hidden">
        {/* Progress Bar */}
        <div className="absolute top-0 left-0 w-full h-1 bg-white/5">
          <div 
            className="h-full bg-cursor-accent transition-all duration-500" 
            style={{ width: `${(step / 2) * 100}%` }}
          />
        </div>

        <button 
          onClick={onClose}
          className="absolute top-6 right-6 text-white/20 hover:text-white transition-colors"
        >
          <X size={20} />
        </button>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl text-[10px] font-mono font-black uppercase tracking-widest flex items-center gap-2">
            <AlertCircle size={14} />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 bg-green-500/10 border border-green-500/20 text-green-400 rounded-xl text-[10px] font-mono font-black uppercase tracking-widest flex items-center gap-2">
            <CheckCircle size={14} />
            <span>{success}</span>
          </div>
        )}

        {renderStep()}
      </div>
    </div>
  );
};

export default AccountRestoreModal;
