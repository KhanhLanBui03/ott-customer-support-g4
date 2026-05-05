import React, { useState, useEffect } from 'react';
import { Shield, Smartphone, Mail, Lock, CheckCircle, ArrowRight, RefreshCw, X, AlertCircle } from 'lucide-react';
import authApi from '../../api/authApi';

const AccountRestoreModal = ({ email, lockedAt, onClose }) => {
  const [step, setStep] = useState(1); // 1: Info, 2: Phone, 3: OTP, 4: New Password
  const [loading, setLoading] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [timer, setTimer] = useState(0);
  const [canResend, setCanResend] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Calculate days
  const lockedDate = new Date(lockedAt);
  const now = new Date();
  const diffTime = Math.abs(now - lockedDate);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  const formattedDate = lockedDate.toLocaleDateString('vi-VN');

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

  const handleStartRestore = () => setStep(2);

  const handleVerifyPhone = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await authApi.restoreVerifyPhone({ email, phoneNumber });
      await handleSendOtp();
      setStep(3);
    } catch (err) {
      setError(err.response?.data?.message || 'Số điện thoại không đúng');
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async () => {
    setError('');
    try {
      await authApi.restoreSendOtp(email);
      setTimer(120); // 2 minutes
      setCanResend(false);
      setSuccess('Mã OTP đã được gửi tới email');
      setTimeout(() => setSuccess(''), 5000);
    } catch (err) {
      setError('Không thể gửi mã OTP');
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await authApi.restoreVerifyOtp({ email, otp });
      setStep(4);
    } catch (err) {
      setError(err.response?.data?.message || 'Mã OTP không hợp lệ');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');
    if (newPassword !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp');
      return;
    }
    setLoading(true);
    try {
      await authApi.restoreResetPassword({
        email,
        otp,
        newPassword,
        confirmPassword
      });
      setSuccess('Khôi phục tài khoản thành công!');
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err) {
      setError(err.response?.data?.message || 'Lỗi đặt lại mật khẩu');
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
              <h3 className="text-xl font-black text-white">Tài khoản đang chờ xóa</h3>
              <p className="text-white/60 text-sm leading-relaxed">
                Tài khoản này đã yêu cầu xóa được <span className="text-red-400 font-bold">{diffDays}</span>/30 ngày, 
                bắt đầu từ ngày <span className="text-white font-bold">{formattedDate}</span>.
              </p>
              <p className="text-white/40 text-[11px] uppercase font-mono tracking-widest">
                Bạn có muốn khôi phục lại tài khoản này không?
              </p>
            </div>
            <div className="flex flex-col gap-3 pt-4">
              <button
                onClick={handleStartRestore}
                className="w-full py-4 bg-cursor-accent text-cursor-dark rounded-2xl font-black uppercase tracking-widest text-xs hover:scale-105 transition-all flex items-center justify-center gap-2"
              >
                <span>Xác nhận khôi phục</span>
                <ArrowRight size={16} />
              </button>
              <button
                onClick={onClose}
                className="w-full py-4 bg-white/5 text-white/40 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:text-white transition-all"
              >
                Hủy bỏ
              </button>
            </div>
          </div>
        );

      case 2:
        return (
          <form onSubmit={handleVerifyPhone} className="space-y-6 animate-slide-up">
            <div className="text-center space-y-2">
              <Smartphone size={32} className="text-cursor-accent mx-auto" />
              <h3 className="text-xl font-black text-white">Xác minh chính chủ</h3>
              <p className="text-white/40 text-xs uppercase font-mono tracking-widest">Nhập số điện thoại đăng ký</p>
            </div>
            <div className="relative group">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20">
                <Smartphone size={18} />
              </div>
              <input
                type="text"
                required
                className="w-full pl-12 pr-4 py-4 bg-white/5 border border-white/10 rounded-2xl text-white focus:outline-none focus:border-cursor-accent transition-all"
                placeholder="Số điện thoại..."
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
              />
            </div>
            <button
              disabled={loading}
              className="w-full py-4 bg-cursor-accent text-cursor-dark rounded-2xl font-black uppercase tracking-widest text-xs disabled:opacity-50"
            >
              {loading ? <RefreshCw className="animate-spin mx-auto" size={16} /> : 'Tiếp tục'}
            </button>
          </form>
        );

      case 3:
        return (
          <form onSubmit={handleVerifyOtp} className="space-y-6 animate-slide-up">
            <div className="text-center space-y-2">
              <Mail size={32} className="text-cursor-accent mx-auto" />
              <h3 className="text-xl font-black text-white">Nhập mã OTP</h3>
              <p className="text-white/40 text-xs">Mã đã được gửi tới email: {email}</p>
            </div>
            <input
              type="text"
              required
              maxLength={6}
              className="w-full py-4 bg-white/5 border border-white/10 rounded-2xl text-white text-center text-2xl font-black tracking-[0.5em] focus:outline-none focus:border-cursor-accent"
              placeholder="000000"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
            />
            <div className="text-center">
              <button
                type="button"
                disabled={!canResend}
                onClick={handleSendOtp}
                className={`text-[10px] uppercase font-mono font-black tracking-widest transition-all ${
                  canResend ? 'text-cursor-accent hover:underline' : 'text-white/20'
                }`}
              >
                {timer > 0 ? `Gửi lại mã sau ${timer}s` : 'Gửi lại mã ngay'}
              </button>
            </div>
            <button
              disabled={loading}
              className="w-full py-4 bg-cursor-accent text-cursor-dark rounded-2xl font-black uppercase tracking-widest text-xs disabled:opacity-50"
            >
              {loading ? <RefreshCw className="animate-spin mx-auto" size={16} /> : 'Xác thực OTP'}
            </button>
          </form>
        );

      case 4:
        return (
          <form onSubmit={handleResetPassword} className="space-y-6 animate-slide-up">
            <div className="text-center space-y-2">
              <Lock size={32} className="text-cursor-accent mx-auto" />
              <h3 className="text-xl font-black text-white">Đặt mật khẩu mới</h3>
              <p className="text-white/40 text-xs">Bước cuối cùng để khôi phục tài khoản</p>
            </div>
            <div className="space-y-4">
              <input
                type="password"
                required
                className="w-full px-4 py-4 bg-white/5 border border-white/10 rounded-2xl text-white focus:outline-none focus:border-cursor-accent"
                placeholder="Mật khẩu mới..."
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              <input
                type="password"
                required
                className="w-full px-4 py-4 bg-white/5 border border-white/10 rounded-2xl text-white focus:outline-none focus:border-cursor-accent"
                placeholder="Xác nhận mật khẩu mới..."
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
            <button
              disabled={loading}
              className="w-full py-4 bg-cursor-accent text-cursor-dark rounded-2xl font-black uppercase tracking-widest text-xs disabled:opacity-50"
            >
              {loading ? <RefreshCw className="animate-spin mx-auto" size={16} /> : 'Khôi phục hoàn tất'}
            </button>
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
            style={{ width: `${(step / 4) * 100}%` }}
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
