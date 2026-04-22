import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, ChevronLeft, Lock, Mail, Shield } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

const ForgotPassword = () => {
  const navigate = useNavigate();
  const { forgotPassword, resetPassword, sendOtp } = useAuth();

  const [step, setStep] = useState('request');
  const [method, setMethod] = useState('forgot-password');
  const [email, setEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const methodOptions = useMemo(
    () => [
      {
        id: 'forgot-password',
        title: 'Cach 1',
        subtitle: 'POST /api/v1/auth/forgot-password',
        description: 'Gui OTP qua endpoint forgot-password, sau do reset password binh thuong.',
      },
      {
        id: 'explicit-purpose',
        title: 'Cach 2',
        subtitle: 'POST /api/v1/auth/send-otp?purpose=FORGOT_PASSWORD',
        description: 'Gui OTP voi purpose truyen ro rang, sau do reset password voi purpose cung gia tri.',
      },
    ],
    [],
  );

  const activeMethod = methodOptions.find((option) => option.id === method) || methodOptions[0];

  const extractMessage = (err, fallback) => err?.response?.data?.message || fallback;

  const resetForm = () => {
    setStep('request');
    setOtpCode('');
    setNewPassword('');
    setConfirmPassword('');
    setError('');
    setSuccess('');
  };

  const handleRequestOtp = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      setError('Vui long nhap email');
      return;
    }

    try {
      setLoading(true);
      const response =
        method === 'forgot-password'
          ? await forgotPassword(normalizedEmail)
          : await sendOtp(normalizedEmail, 'FORGOT_PASSWORD');
      const devOtp = response?.devOtp || response?.message || response?.data?.devOtp;
      setStep('reset');
      setSuccess(
        devOtp
          ? `OTP test: ${devOtp}`
          : method === 'forgot-password'
          ? 'OTP da duoc gui qua forgot-password endpoint.'
          : 'OTP da duoc gui voi purpose FORGOT_PASSWORD.',
      );
    } catch (err) {
      setError(extractMessage(err, 'Khong the gui OTP'));
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setError('');
    setSuccess('');

    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      setError('Vui long nhap email');
      return;
    }

    try {
      setLoading(true);
      const response =
        method === 'forgot-password'
          ? await forgotPassword(normalizedEmail)
          : await sendOtp(normalizedEmail, 'FORGOT_PASSWORD');
      const devOtp = response?.devOtp || response?.message || response?.data?.devOtp;
      setSuccess(devOtp ? `OTP test: ${devOtp}` : 'Da gui lai ma OTP.');
    } catch (err) {
      setError(extractMessage(err, 'Khong the gui lai OTP'));
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword.length < 8) {
      setError('Mat khau moi phai co it nhat 8 ky tu');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Mat khau xac nhan khong khop');
      return;
    }

    if (!otpCode.trim()) {
      setError('Vui long nhap ma OTP');
      return;
    }

    try {
      setLoading(true);
      const payload = {
        email: email.trim(),
        otpCode: otpCode.trim(),
        newPassword,
      };

      if (method === 'explicit-purpose') {
        payload.purpose = 'FORGOT_PASSWORD';
      }

      await resetPassword(payload);
      navigate('/login');
    } catch (err) {
      setError(extractMessage(err, 'Dat lai mat khau that bai'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-cursor-dark relative overflow-hidden font-sans">
      <div className="absolute top-0 left-0 w-full h-full">
        <div className="absolute top-[-10%] right-[-5%] w-[50%] h-[50%] bg-cursor-accent/5 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] left-[-5%] w-[40%] h-[40%] bg-blue-500/5 blur-[120px] rounded-full" />
      </div>

      <div className="max-w-md w-full p-12 space-y-10 relative z-10 animate-fade-in">
        <div className="text-center space-y-2">
          <h2 className="text-4xl font-black text-white tracking-tighter">Password Recovery</h2>
          <p className="text-[10px] font-mono font-black uppercase tracking-[0.4em] text-white/20">
            {step === 'request' ? 'Choose request method' : 'Reset Password'}
          </p>
        </div>

        <form className="space-y-6" onSubmit={step === 'request' ? handleRequestOtp : handleResetPassword}>
          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-500 rounded-2xl text-[10px] font-mono font-black uppercase tracking-widest flex items-center space-x-3">
              <Shield size={14} />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-4 bg-green-500/10 border border-green-500/20 text-green-400 rounded-2xl text-[10px] font-mono font-black uppercase tracking-widest flex items-center space-x-3">
              <Shield size={14} />
              <span>{success}</span>
            </div>
          )}

          <div className="space-y-4">
            <div className="relative group">
              <div className="absolute left-6 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-cursor-accent transition-colors">
                <Mail size={18} />
              </div>
              <input
                type="email"
                required
                disabled={step !== 'request'}
                className="w-full pl-16 pr-6 py-5 bg-white/5 border border-white/10 rounded-3xl text-white text-sm focus:outline-none focus:border-cursor-accent focus:bg-white/8 transition-all placeholder:text-white/10 font-medium disabled:opacity-50"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            {step === 'request' && (
              <div className="space-y-3">
                <p className="text-[10px] font-mono font-black uppercase tracking-[0.25em] text-white/30">
                  Chon cach gui OTP
                </p>

                <div className="grid gap-3">
                  {methodOptions.map((option) => {
                    const selected = option.id === method;

                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => {
                          setMethod(option.id);
                          setSuccess('');
                          setError('');
                        }}
                        className={`text-left rounded-3xl border p-4 transition-all ${
                          selected
                            ? 'border-cursor-accent bg-cursor-accent/10 shadow-2xl shadow-cursor-accent/10'
                            : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/8'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className={`text-xs font-mono font-black uppercase tracking-[0.2em] ${selected ? 'text-cursor-accent' : 'text-white/40'}`}>
                              {option.title}
                            </p>
                            <p className="mt-1 text-sm font-semibold text-white">{option.subtitle}</p>
                            <p className="mt-2 text-xs leading-6 text-white/60">{option.description}</p>
                          </div>
                          <div
                            className={`mt-1 h-3 w-3 rounded-full border ${
                              selected ? 'border-cursor-accent bg-cursor-accent' : 'border-white/25 bg-transparent'
                            }`}
                          />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {step === 'reset' && (
              <div className="rounded-3xl border border-cursor-accent/20 bg-cursor-accent/5 p-4 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-mono font-black uppercase tracking-[0.25em] text-cursor-accent">
                      Dang dung {activeMethod.title}
                    </p>
                    <p className="mt-1 text-sm text-white/70">{activeMethod.subtitle}</p>
                  </div>
                  <button
                    type="button"
                    onClick={resetForm}
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-2 text-[10px] font-mono font-black uppercase tracking-[0.2em] text-white/60 transition-colors hover:text-white"
                  >
                    <ChevronLeft size={12} />
                    Doi cach
                  </button>
                </div>
                <p className="text-xs leading-6 text-white/50">
                  Hay nhap OTP da gui toi email va dat mat khau moi. Phuong thuc nay khong co buoc xac minh rieng.
                </p>
              </div>
            )}

            {step === 'reset' && (
              <div className="relative group">
                <div className="absolute left-6 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-cursor-accent transition-colors">
                  <Lock size={18} />
                </div>
                <input
                  type="text"
                  required
                  className="w-full pl-16 pr-6 py-5 bg-white/5 border border-white/10 rounded-3xl text-white text-sm focus:outline-none focus:border-cursor-accent focus:bg-white/8 transition-all placeholder:text-white/10 font-medium"
                  placeholder="OTP code"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                />
              </div>
            )}

            {step === 'reset' && (
              <>
                <div className="relative group">
                  <div className="absolute left-6 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-cursor-accent transition-colors">
                    <Lock size={18} />
                  </div>
                  <input
                    type="password"
                    required
                    className="w-full pl-16 pr-6 py-5 bg-white/5 border border-white/10 rounded-3xl text-white text-sm focus:outline-none focus:border-cursor-accent focus:bg-white/8 transition-all placeholder:text-white/10 font-medium"
                    placeholder="New password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                </div>

                <div className="relative group">
                  <div className="absolute left-6 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-cursor-accent transition-colors">
                    <Lock size={18} />
                  </div>
                  <input
                    type="password"
                    required
                    className="w-full pl-16 pr-6 py-5 bg-white/5 border border-white/10 rounded-3xl text-white text-sm focus:outline-none focus:border-cursor-accent focus:bg-white/8 transition-all placeholder:text-white/10 font-medium"
                    placeholder="Confirm new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>
              </>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-5 bg-cursor-accent text-cursor-dark rounded-4xl font-black tracking-tight text-lg shadow-2xl shadow-cursor-accent/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center space-x-3 disabled:opacity-60"
          >
            <span>
              {loading
                ? 'Dang xu ly...'
                : step === 'request'
                ? activeMethod.id === 'forgot-password'
                  ? 'Send OTP'
                  : 'Gui OTP'
                : 'Reset Password'}
            </span>
            <ArrowRight size={20} />
          </button>

          {step === 'reset' && (
            <button
              type="button"
              disabled={loading}
              onClick={handleResendOtp}
              className="w-full py-3 text-white/70 hover:text-cursor-accent transition-colors text-xs font-mono uppercase tracking-[0.2em] disabled:opacity-60"
            >
              Gui lai OTP
            </button>
          )}
        </form>

        <p className="text-center text-[11px] font-mono font-black text-white/20 uppercase tracking-[0.2em]">
          Back to{' '}
          <Link to="/login" className="text-cursor-accent hover:underline">
            Login
          </Link>
        </p>
      </div>
    </div>
  );
};

export default ForgotPassword;
