import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Lock, Mail, Shield, Zap } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

const ForgotPassword = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { forgotPassword, resetPassword } = useAuth();
  const COOLDOWN_MS = 3 * 60 * 1000;

  const [step, setStep] = useState('request');
  const [email, setEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = (e) => {
    setMousePos({ x: e.clientX, y: e.clientY });
    if (!isHovered) setIsHovered(true);
  };

  const extractMessage = (err, fallback) => err?.response?.data?.message || fallback;

  const normalizedEmail = useMemo(() => email.trim().toLowerCase(), [email]);
  const cooldownKey = normalizedEmail ? `forgot-password-cooldown:${normalizedEmail}` : '';
  const cooldownRemainingMs = Math.max(0, cooldownUntil - now);
  const cooldownRemainingSeconds = Math.ceil(cooldownRemainingMs / 1000);
  const isCooldownActive = cooldownRemainingMs > 0;

  const applyCooldown = (targetEmail) => {
    const nextAllowedAt = Date.now() + COOLDOWN_MS;
    setCooldownUntil(nextAllowedAt);
    if (targetEmail) {
      localStorage.setItem(`forgot-password-cooldown:${targetEmail}`, String(nextAllowedAt));
    }
  };

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (!cooldownKey) {
      setCooldownUntil(0);
      return;
    }

    const storedCooldown = Number(localStorage.getItem(cooldownKey) || 0);
    if (storedCooldown > Date.now()) {
      setCooldownUntil(storedCooldown);
    } else {
      localStorage.removeItem(cooldownKey);
      setCooldownUntil(0);
    }
  }, [cooldownKey]);

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
      setError(t('auth.errors.please_enter_email'));
      return;
    }

    try {
      setLoading(true);
      await forgotPassword(normalizedEmail);
      setStep('reset');
      applyCooldown(normalizedEmail);
      setSuccess(t('auth.success.otp_sent_to_email'));
    } catch (err) {
      setError(extractMessage(err, t('auth.errors.unable_to_send_otp')));
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setError('');
    setSuccess('');

    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      setError(t('auth.errors.please_enter_email'));
      return;
    }

    try {
      setLoading(true);
      await forgotPassword(normalizedEmail);
      applyCooldown(normalizedEmail);
      setSuccess(t('auth.success.otp_resent_to_email'));
    } catch (err) {
      setError(extractMessage(err, t('auth.errors.unable_to_resend_otp')));
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword.length < 8) {
      setError(t('auth.errors.password_too_short'));
      return;
    }

    if (newPassword !== confirmPassword) {
      setError(t('auth.errors.password_mismatch'));
      return;
    }

    if (!otpCode.trim()) {
      setError(t('auth.errors.otp_required'));
      return;
    }

    try {
      setLoading(true);
      const payload = {
        email: email.trim(),
        otpCode: otpCode.trim(),
        newPassword,
      };

      await resetPassword(payload);
      navigate('/login');
    } catch (err) {
      setError(extractMessage(err, t('auth.errors.reset_failed')));
    } finally {
      setLoading(false);
    }
  };

  const formatCooldown = (remainingSeconds) => {
    const minutes = Math.floor(remainingSeconds / 60);
    const seconds = remainingSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  };

  return (
    <div 
      className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0c0714] via-[#160c2b] to-[#050308] relative overflow-hidden font-sans px-4 py-4"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Dynamic Cursor-Follow Glow */}
      {isHovered && (
        <div
          className="pointer-events-none absolute inset-0 z-0 transition-opacity duration-300 ease-out"
          style={{
            background: `radial-gradient(500px circle at ${mousePos.x}px ${mousePos.y}px, rgba(139, 92, 246, 0.12), rgba(79, 70, 229, 0.06) 40%, transparent 80%)`,
          }}
        />
      )}

      {/* Background Decorative Elements */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none z-0">
        <div className="absolute top-[-10%] right-[-5%] w-[60%] h-[60%] bg-purple-700/10 blur-[130px] rounded-full" />
        <div className="absolute bottom-[-15%] left-[-5%] w-[50%] h-[50%] bg-indigo-700/10 blur-[130px] rounded-full" />
        <div className="absolute top-[30%] left-[-10%] w-[35%] h-[35%] bg-fuchsia-700/5 blur-[120px] rounded-full" />
      </div>

      <div className="max-w-md w-full p-6 md:p-8 space-y-5 relative z-10 animate-fade-in bg-white/[0.02] border border-white/[0.06] backdrop-blur-3xl rounded-[32px] shadow-2xl">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-14 h-14 bg-white/[0.03] border border-white/10 rounded-[20px] flex items-center justify-center shadow-2xl relative group">
            <div className="absolute inset-0 bg-cursor-accent/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
            <Zap size={28} className="text-cursor-accent relative z-10" fill="currentColor" />
          </div>
          <div className="text-center space-y-1">
            <h2 className="text-3xl font-black text-white tracking-tighter">
              <span className="bg-gradient-to-r from-cursor-accent to-cursor-violet bg-clip-text text-transparent">F5</span> Chat
            </h2>
            <p className="text-[9px] font-mono font-black uppercase tracking-[0.4em] text-white/20">
              {step === 'request' ? t('auth.send_otp_label') : t('auth.reset_password_label')}
            </p>
          </div>
        </div>

        <form className="space-y-4" onSubmit={step === 'request' ? handleRequestOtp : handleResetPassword}>
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl text-[9px] font-mono font-black uppercase tracking-widest flex items-center space-x-2">
              <Shield size={12} />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3 bg-green-500/10 border border-green-500/20 text-green-400 rounded-xl text-[9px] font-mono font-black uppercase tracking-widest flex items-center space-x-2">
              <Shield size={12} />
              <span>{success}</span>
            </div>
          )}

          <div className="space-y-3.5">
            <div className="relative group">
              <div className="absolute left-5 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-cursor-accent transition-colors">
                <Mail size={16} />
              </div>
              <input
                type="email"
                required
                disabled={step !== 'request'}
                className="w-full pl-12 pr-4 py-3.5 bg-[#160f26]/30 border border-white/[0.08] rounded-2xl text-white text-sm focus:outline-none focus:border-cursor-accent/50 focus:bg-[#160f26]/60 transition-all placeholder:text-white/20 font-medium disabled:opacity-50"
                placeholder={t('auth.email_placeholder')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            {step === 'reset' && (
              <div className="rounded-xl border border-white/[0.06] bg-[#160f26]/20 p-3 space-y-2">
                <p className="text-[11px] leading-relaxed text-white/50">
                  {t('auth.otp_instruction_forgot')}
                </p>
              </div>
            )}

            {step === 'reset' && (
              <div className="relative group">
                <div className="absolute left-5 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-cursor-accent transition-colors">
                  <Lock size={16} />
                </div>
                <input
                  type="text"
                  required
                  className="w-full pl-12 pr-4 py-3.5 bg-[#160f26]/30 border border-white/[0.08] rounded-2xl text-white text-sm focus:outline-none focus:border-cursor-accent/50 focus:bg-[#160f26]/60 transition-all placeholder:text-white/20 font-medium"
                  placeholder={t('auth.otp_placeholder_forgot')}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                />
              </div>
            )}

            {step === 'reset' && (
              <>
                <div className="relative group">
                  <div className="absolute left-5 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-cursor-accent transition-colors">
                    <Lock size={16} />
                  </div>
                  <input
                    type="password"
                    required
                    className="w-full pl-12 pr-4 py-3.5 bg-[#160f26]/30 border border-white/[0.08] rounded-2xl text-white text-sm focus:outline-none focus:border-cursor-accent/50 focus:bg-[#160f26]/60 transition-all placeholder:text-white/20 font-medium"
                    placeholder={t('auth.new_password_placeholder')}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                </div>

                <div className="relative group">
                  <div className="absolute left-5 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-cursor-accent transition-colors">
                    <Lock size={16} />
                  </div>
                  <input
                    type="password"
                    required
                    className="w-full pl-12 pr-4 py-3.5 bg-[#160f26]/30 border border-white/[0.08] rounded-2xl text-white text-sm focus:outline-none focus:border-cursor-accent/50 focus:bg-[#160f26]/60 transition-all placeholder:text-white/20 font-medium"
                    placeholder={t('auth.confirm_new_password_placeholder')}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>
              </>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || (step === 'request' && isCooldownActive)}
            className="w-full py-3.5 bg-white text-slate-950 rounded-2xl font-black tracking-tight text-base shadow-xl shadow-white/5 hover:bg-slate-100 hover:scale-[1.01] active:scale-98 transition-all flex items-center justify-center space-x-2 disabled:opacity-60"
          >
            <span>
              {loading
                ? t('auth.processing')
                : step === 'request'
                  ? isCooldownActive
                    ? t('auth.wait_time', { time: formatCooldown(cooldownRemainingSeconds) })
                    : t('auth.send_otp_label')
                  : t('auth.reset_password_button')}
            </span>
            <ArrowRight size={18} className="text-slate-950" />
          </button>

          {step === 'reset' && (
            <button
              type="button"
              disabled={loading || isCooldownActive}
              onClick={handleResendOtp}
              className="w-full py-2 text-indigo-300 hover:text-indigo-200 transition-colors text-[10px] font-mono uppercase tracking-[0.2em] disabled:opacity-60"
            >
              {isCooldownActive ? t('auth.can_resend_after', { time: formatCooldown(cooldownRemainingSeconds) }) : t('auth.resend_otp')}
            </button>
          )}

          {step === 'request' && isCooldownActive && (
            <p className="text-center text-[9px] font-mono font-black uppercase tracking-[0.2em] text-white/35">
              {t('auth.can_resend_after', { time: formatCooldown(cooldownRemainingSeconds) })}
            </p>
          )}
        </form>

        <p className="text-center text-[10px] font-mono font-black text-white/20 uppercase tracking-[0.2em]">
          {t('auth.back_to')}{' '}
          <Link to="/login" className="text-indigo-400 hover:underline">
            {t('auth.login')}
          </Link>
        </p>
      </div>
    </div>
  );
};

export default ForgotPassword;
