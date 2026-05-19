import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Lock, Mail, Shield } from 'lucide-react';
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
    <div className="min-h-screen flex items-center justify-center bg-cursor-dark relative overflow-hidden font-sans">
      <div className="absolute top-0 left-0 w-full h-full">
        <div className="absolute top-[-10%] right-[-5%] w-[50%] h-[50%] bg-cursor-accent/5 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] left-[-5%] w-[40%] h-[40%] bg-blue-500/5 blur-[120px] rounded-full" />
      </div>

      <div className="max-w-md w-full p-12 space-y-10 relative z-10 animate-fade-in">
        <div className="text-center space-y-2">
          <h2 className="text-4xl font-black text-white tracking-tighter">{t('auth.recover_password_title')}</h2>
          <p className="text-[10px] font-mono font-black uppercase tracking-[0.4em] text-white/20">
            {step === 'request' ? t('auth.send_otp_label') : t('auth.reset_password_label')}
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
                placeholder={t('auth.email_placeholder')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            {step === 'reset' && (
              <div className="rounded-3xl border border-cursor-accent/20 bg-cursor-accent/5 p-4 space-y-3">
                <p className="text-xs leading-6 text-white/50">
                  {t('auth.otp_instruction_forgot')}
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
                  placeholder={t('auth.otp_placeholder_forgot')}
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
                    placeholder={t('auth.new_password_placeholder')}
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
            className="w-full py-5 bg-cursor-accent text-cursor-dark rounded-4xl font-black tracking-tight text-lg shadow-2xl shadow-cursor-accent/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center space-x-3 disabled:opacity-60"
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
            <ArrowRight size={20} />
          </button>

          {step === 'reset' && (
            <button
              type="button"
              disabled={loading || isCooldownActive}
              onClick={handleResendOtp}
              className="w-full py-3 text-white/70 hover:text-cursor-accent transition-colors text-xs font-mono uppercase tracking-[0.2em] disabled:opacity-60"
            >
              {isCooldownActive ? t('auth.can_resend_after', { time: formatCooldown(cooldownRemainingSeconds) }) : t('auth.resend_otp')}
            </button>
          )}

          {step === 'request' && isCooldownActive && (
            <p className="text-center text-[10px] font-mono font-black uppercase tracking-[0.2em] text-white/35">
              {t('auth.can_resend_after', { time: formatCooldown(cooldownRemainingSeconds) })}
            </p>
          )}
        </form>

        <p className="text-center text-[11px] font-mono font-black text-white/20 uppercase tracking-[0.2em]">
          {t('auth.back_to')}{' '}
          <Link to="/login" className="text-cursor-accent hover:underline">
            {t('auth.login')}
          </Link>
        </p>
      </div>
    </div>
  );
};

export default ForgotPassword;
