import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../hooks/useAuth';
import { authApi } from '../../api/authApi';
import { Zap, User, Phone, Lock, ArrowRight, Shield, CheckCircle2 } from 'lucide-react';

const Register = () => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    phoneNumber: '',
    email: '',
    firstName: '',
    lastName: '',
    password: '',
    confirmPassword: '',
  });

  const [step, setStep] = useState('verify-email');
  const [verificationCodeSent, setVerificationCodeSent] = useState(false);
  const [verifiedEmail, setVerifiedEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [agreedToPolicies, setAgreedToPolicies] = useState(false);

  const [otpAvailableAt, setOtpAvailableAt] = useState(0);
  const [now, setNow] = useState(Date.now());

  const [error, setError] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);

  const { register, sendOtp, verifyOtp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleMouseMove = (e) => {
    setMousePos({ x: e.clientX, y: e.clientY });
    if (!isHovered) setIsHovered(true);
  };

  const OTP_COOLDOWN_MS = 2 * 60 * 1000;

  const effectiveEmail = useMemo(
    () => (verifiedEmail || formData.email).trim().toLowerCase(),
    [verifiedEmail, formData.email],
  );

  const otpCooldownKey = effectiveEmail ? `register-otp-cooldown:${effectiveEmail}` : '';
  const otpRemainingSeconds = Math.max(0, Math.ceil((otpAvailableAt - now) / 1000));
  const isOtpCooldownActive = otpRemainingSeconds > 0;

  const passwordChecks = useMemo(
    () => ({
      minLength: formData.password.length >= 8,
      lower: /[a-z]/.test(formData.password),
      upper: /[A-Z]/.test(formData.password),
      number: /\d/.test(formData.password),
      special: /[@$!%*?&]/.test(formData.password),
    }),
    [formData.password],
  );

  useEffect(() => {
    const unverifiedEmail = location.state?.email;
    if (unverifiedEmail) {
      setFormData((prev) => ({ ...prev, email: unverifiedEmail }));
    }

    setStep('verify-email');
    setVerificationCodeSent(false);

    if (location.state?.message) {
      setSuccess(location.state.message);
    }
  }, [location.state]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!otpCooldownKey) {
      setOtpAvailableAt(0);
      return;
    }

    const stored = Number(localStorage.getItem(otpCooldownKey) || 0);
    if (stored > Date.now()) {
      setOtpAvailableAt(stored);
      return;
    }

    localStorage.removeItem(otpCooldownKey);
    setOtpAvailableAt(0);
  }, [otpCooldownKey]);

  const startOtpCooldown = (email) => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      return;
    }

    const nextAvailableAt = Date.now() + OTP_COOLDOWN_MS;
    setOtpAvailableAt(nextAvailableAt);
    localStorage.setItem(`register-otp-cooldown:${normalizedEmail}`, String(nextAvailableAt));
  };

  const formatOtpCooldown = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remain = seconds % 60;
    return `${minutes}:${String(remain).padStart(2, '0')}`;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    if (name === 'phoneNumber') {
      setPhoneError('');
    }
  };

  const validatePhone = async (phone) => {
    if (!phone) {
      setPhoneError(t('auth.errors.phone_empty'));
      return false;
    }
    if (!/^0(3|5|7|8|9)\d{8}$/.test(phone)) {
      setPhoneError(t('auth.errors.phone_invalid'));
      return false;
    }
    try {
      const statusRes = await authApi.checkUserStatus(phone);
      const statusData = statusRes.data?.data || statusRes.data || statusRes;
      if (statusData.exists) {
        setPhoneError(t('auth.errors.phone_taken'));
        return false;
      }
      setPhoneError('');
      return true;
    } catch (err) {
      console.error('Phone check error:', err);
      // Nếu API lỗi 401 hoặc lỗi khác, có thể tạm thời bỏ qua kiểm tra trùng lặp nhưng vẫn báo log
      return true;
    }
  };

  const handlePhoneBlur = () => {
    validatePhone(formData.phoneNumber);
  };

  const handleSendVerificationCode = async () => {
    setError('');
    setSuccess('');

    const email = formData.email.trim().toLowerCase();
    if (!email) {
      setError(t('auth.errors.email_empty'));
      return;
    }

    if (!/^[A-Za-z0-9._%+-]+@gmail\.com$/i.test(email)) {
      setError(t('auth.errors.email_invalid'));
      return;
    }

    if (isOtpCooldownActive) {
      setError(t('auth.errors.otp_cooldown', { seconds: formatOtpCooldown(otpRemainingSeconds) }));
      return;
    }

    try {
      setLoading(true);
      await sendOtp(email, 'REGISTRATION');
      setFormData((prev) => ({ ...prev, email }));
      setVerificationCodeSent(true);
      startOtpCooldown(email);
      setSuccess(t('auth.success.otp_sent', { email }));
    } catch (err) {
      const message = err?.response?.data?.message;
      if (message && (message.includes('already exists') || message.includes('đã tồn tại'))) {
        setError(t('auth.errors.email_taken'));
      } else {
        setError(message || t('auth.errors.generic_error'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyEmail = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const email = formData.email.trim().toLowerCase();
    if (!email) {
      setError(t('auth.errors.email_empty'));
      return;
    }

    if (!otpCode.trim()) {
      setError(t('auth.errors.otp_required'));
      return;
    }

    try {
      setLoading(true);
      await verifyOtp(
        {
          email,
          otpCode: otpCode.trim(),
          purpose: 'REGISTRATION',
        },
        { autoLogin: false },
      );

      setVerifiedEmail(email);
      setStep('register');
      setSuccess(t('auth.success.email_verified'));
    } catch (err) {
      setError(err?.response?.data?.message || t('auth.errors.otp_invalid'));
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setError('');
    setSuccess('');

    if (isOtpCooldownActive) {
      setError(t('auth.errors.otp_cooldown', { seconds: formatOtpCooldown(otpRemainingSeconds) }));
      return;
    }

    try {
      setLoading(true);
      const email = formData.email.trim().toLowerCase();
      await sendOtp(email, 'REGISTRATION');
      startOtpCooldown(email);
      setSuccess(t('auth.success.otp_sent', { email }));
    } catch (err) {
      setError(err?.response?.data?.message || t('auth.errors.otp_resend_error'));
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAccount = async (e) => {
    e.preventDefault();
    setError('');
    setPhoneError('');
    setSuccess('');

    if (!verifiedEmail) {
      setError(t('auth.errors.email_not_verified'));
      setStep('verify-email');
      return;
    }

    if (!formData.phoneNumber) {
      setPhoneError(t('auth.errors.phone_empty'));
      return;
    }

    if (!/^0(3|5|7|8|9)\d{8}$/.test(formData.phoneNumber)) {
      setPhoneError(t('auth.errors.phone_invalid'));
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError(t('auth.errors.password_mismatch'));
      return;
    }

    if (formData.password.length < 8) {
      setError(t('auth.errors.password_too_short'));
      return;
    }

    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/.test(formData.password)) {
      setError(t('auth.errors.password_weak'));
      return;
    }

    if (!agreedToPolicies) {
      setError(t('auth.errors.policy_agreement_required'));
      return;
    }

    try {
      setLoading(true);

      // Kiểm tra lại lần cuối trước khi submit
      const isPhoneValid = await validatePhone(formData.phoneNumber);
      if (!isPhoneValid) {
        setLoading(false);
        return;
      }

      const response = await register({
        phoneNumber: formData.phoneNumber,
        email: verifiedEmail,
        firstName: formData.firstName,
        lastName: formData.lastName,
        password: formData.password,
        confirmPassword: formData.confirmPassword,
      });

      setSuccess(t('auth.success.account_created'));

      // Đợi 3 giây trước khi chuyển hướng
      setTimeout(() => {
        navigate('/login', {
          state: {
            email: verifiedEmail,
            message: t('auth.success.register_success'),
          },
        });
      }, 3000);

    } catch (err) {
      setError(err?.response?.data?.message || t('auth.errors.register_failed'));
    } finally {
      setLoading(false);
    }
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

      <div className="max-w-md w-full p-6 md:p-8 space-y-6 relative z-10 animate-fade-in bg-white/[0.02] border border-white/[0.06] backdrop-blur-3xl rounded-[32px] shadow-2xl">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-14 h-14 bg-white/[0.03] border border-white/10 rounded-[20px] flex items-center justify-center shadow-2xl">
            <Zap size={28} className="text-cursor-accent" fill="currentColor" />
          </div>
          <div className="text-center space-y-1">
            <h2 className="text-3xl font-black text-white tracking-tighter">
              <span className="bg-gradient-to-r from-cursor-accent to-cursor-violet bg-clip-text text-transparent">F5</span> Chat
            </h2>
            <p className="text-[9px] font-mono font-black uppercase tracking-[0.4em] text-white/20">
              {t('auth.register_init')}
            </p>
          </div>
        </div>

        <form className="space-y-4" onSubmit={step === 'register' ? handleCreateAccount : handleVerifyEmail}>
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

          <div className="space-y-3">
            {step === 'verify-email' && (
              <>
                <div className="relative group">
                  <input
                    name="email"
                    type="email"
                    required
                    className="w-full px-5 py-3 bg-[#160f26]/30 border border-white/[0.08] rounded-xl text-white text-sm focus:outline-none focus:border-indigo-400/50 focus:bg-[#160f26]/60 transition-all placeholder:text-white/20 font-medium"
                    placeholder={t('auth.email_input_placeholder')}
                    value={formData.email}
                    onChange={handleChange}
                  />
                </div>

                {verificationCodeSent && (
                  <>
                    <p className="text-[10px] font-mono text-white/60 px-1">
                      {t('auth.otp_instruction')}
                    </p>
                    <div className="relative group">
                      <div className="absolute left-5 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-cursor-accent">
                        <Lock size={16} />
                      </div>
                      <input
                        type="text"
                        required
                        className="w-full pl-12 pr-4 py-3 bg-[#160f26]/30 border border-white/[0.08] rounded-xl text-white text-sm focus:outline-none focus:border-indigo-400/50 focus:bg-[#160f26]/60 transition-all placeholder:text-white/20 font-medium"
                        placeholder={t('auth.otp_placeholder')}
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value)}
                      />
                    </div>
                  </>
                )}
              </>
            )}

            {step === 'register' && (
              <>
                <div className="relative group">
                  <input
                    name="email"
                    type="email"
                    disabled
                    className="w-full px-5 py-3 bg-[#160f26]/10 border border-white/[0.03] rounded-xl text-white/50 text-sm focus:outline-none"
                    placeholder={t('auth.verified_email_placeholder')}
                    value={verifiedEmail}
                  />
                </div>

                <div className="relative group">
                  <div className="absolute left-5 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-cursor-accent">
                    <User size={16} />
                  </div>
                  <input
                    name="firstName"
                    type="text"
                    required
                    className="w-full pl-12 pr-4 py-3 bg-[#160f26]/30 border border-white/[0.08] rounded-xl text-white text-sm focus:outline-none focus:border-indigo-400/50 focus:bg-[#160f26]/60 transition-all placeholder:text-white/20 font-medium"
                    placeholder={t('auth.first_name_placeholder')}
                    value={formData.firstName}
                    onChange={handleChange}
                  />
                </div>

                <div className="relative group">
                  <div className="absolute left-5 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-cursor-accent">
                    <User size={16} />
                  </div>
                  <input
                    name="lastName"
                    type="text"
                    required
                    className="w-full pl-12 pr-4 py-3 bg-[#160f26]/30 border border-white/[0.08] rounded-xl text-white text-sm focus:outline-none focus:border-indigo-400/50 focus:bg-[#160f26]/60 transition-all placeholder:text-white/20 font-medium"
                    placeholder={t('auth.last_name_placeholder')}
                    value={formData.lastName}
                    onChange={handleChange}
                  />
                </div>

                <div className="relative group">
                  <div className="absolute left-5 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-cursor-accent">
                    <Phone size={16} />
                  </div>
                  <input
                    name="phoneNumber"
                    type="text"
                    required
                    onBlur={handlePhoneBlur}
                    className={`w-full pl-12 pr-4 py-3 bg-[#160f26]/30 border ${phoneError ? 'border-red-500' : 'border-white/[0.08]'} rounded-xl text-white text-sm focus:outline-none focus:border-indigo-400/50 focus:bg-[#160f26]/60 transition-all placeholder:text-white/20 font-medium`}
                    placeholder={t('auth.phone_placeholder')}
                    value={formData.phoneNumber}
                    onChange={handleChange}
                  />
                  {phoneError && (
                    <p className="mt-1 ml-2 text-[9px] font-mono font-black uppercase text-red-500 animate-shake">
                      {phoneError}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="relative group">
                    <input
                      name="password"
                      type="password"
                      required
                      className="w-full px-5 py-3 bg-[#160f26]/30 border border-white/[0.08] rounded-xl text-white text-sm focus:outline-none focus:border-indigo-400/50 focus:bg-[#160f26]/60 transition-all placeholder:text-white/20 font-medium"
                      placeholder={t('auth.password_placeholder')}
                      value={formData.password}
                      onChange={handleChange}
                    />
                  </div>
                  <div className="relative group">
                    <input
                      name="confirmPassword"
                      type="password"
                      required
                      className="w-full px-5 py-3 bg-[#160f26]/30 border border-white/[0.08] rounded-xl text-white text-sm focus:outline-none focus:border-indigo-400/50 focus:bg-[#160f26]/60 transition-all placeholder:text-white/20 font-medium"
                      placeholder={t('auth.confirm_password')}
                      value={formData.confirmPassword}
                      onChange={handleChange}
                    />
                  </div>
                </div>

                <div className="rounded-xl border border-white/[0.06] bg-[#160f26]/20 p-3 space-y-1.5">
                  <p className="text-[9px] font-mono font-black uppercase tracking-[0.2em] text-white/45">
                    {t('auth.password_reqs')}
                  </p>
                  <div className={`text-[10px] font-mono flex items-center gap-2 ${passwordChecks.minLength ? 'text-green-400' : 'text-white/45'}`}>
                    {passwordChecks.minLength ? <CheckCircle2 size={10} /> : <span className="h-2.5 w-2.5 rounded-full border border-current opacity-60" />}
                    <span>{t('auth.req_min_chars')}</span>
                  </div>
                  <div className={`text-[10px] font-mono flex items-center gap-2 ${passwordChecks.lower ? 'text-green-400' : 'text-white/45'}`}>
                    {passwordChecks.lower ? <CheckCircle2 size={10} /> : <span className="h-2.5 w-2.5 rounded-full border border-current opacity-60" />}
                    <span>{t('auth.req_lower')}</span>
                  </div>
                  <div className={`text-[10px] font-mono flex items-center gap-2 ${passwordChecks.upper ? 'text-green-400' : 'text-white/45'}`}>
                    {passwordChecks.upper ? <CheckCircle2 size={10} /> : <span className="h-2.5 w-2.5 rounded-full border border-current opacity-60" />}
                    <span>{t('auth.req_upper')}</span>
                  </div>
                  <div className={`text-[10px] font-mono flex items-center gap-2 ${passwordChecks.number ? 'text-green-400' : 'text-white/45'}`}>
                    {passwordChecks.number ? <CheckCircle2 size={10} /> : <span className="h-2.5 w-2.5 rounded-full border border-current opacity-60" />}
                    <span>{t('auth.req_number')}</span>
                  </div>
                  <div className={`text-[10px] font-mono flex items-center gap-2 ${passwordChecks.special ? 'text-green-400' : 'text-white/45'}`}>
                    {passwordChecks.special ? <CheckCircle2 size={10} /> : <span className="h-2.5 w-2.5 rounded-full border border-current opacity-60" />}
                    <span>{t('auth.req_special')}</span>
                  </div>
                </div>

                <label className="flex items-start gap-3 rounded-xl border border-white/[0.06] bg-[#160f26]/20 p-3 text-[11px] text-white/70">
                  <input
                    type="checkbox"
                    checked={agreedToPolicies}
                    onChange={(e) => setAgreedToPolicies(e.target.checked)}
                    className="mt-0.5 h-3.5 w-3.5 rounded border-white/30 bg-transparent text-cursor-accent"
                  />
                  <span>
                    {t('auth.policy_agreement')}
                  </span>
                </label>
              </>
            )}
          </div>

          {step === 'verify-email' && !verificationCodeSent && (
            <button
              type="button"
              disabled={loading || isOtpCooldownActive}
              onClick={handleSendVerificationCode}
              className="w-full py-3 bg-white text-slate-950 rounded-xl font-black tracking-tight text-base shadow-xl shadow-white/5 hover:bg-slate-100 hover:scale-[1.01] active:scale-98 transition-all flex items-center justify-center space-x-2 disabled:opacity-60"
            >
              <span>
                {loading
                  ? t('auth.processing')
                  : isOtpCooldownActive
                    ? t('auth.request_again_after', { time: formatOtpCooldown(otpRemainingSeconds) })
                    : t('auth.send_otp')}
              </span>
              <ArrowRight size={18} className="text-slate-950" />
            </button>
          )}

          {(step === 'register' || (step === 'verify-email' && verificationCodeSent)) && (
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-white text-slate-950 rounded-xl font-black tracking-tight text-base shadow-xl shadow-white/5 hover:bg-slate-100 hover:scale-[1.01] active:scale-98 transition-all flex items-center justify-center space-x-2 disabled:opacity-60"
            >
              <span>{loading ? t('auth.processing') : step === 'register' ? t('auth.create_account') : t('auth.verify_otp_button')}</span>
              <ArrowRight size={18} className="text-slate-950" />
            </button>
          )}

          {step === 'verify-email' && verificationCodeSent && (
            <button
              type="button"
              disabled={loading || isOtpCooldownActive}
              onClick={handleResendOtp}
              className="w-full py-2.5 bg-white/5 border border-white/10 text-white rounded-xl font-black tracking-tight text-sm hover:bg-white/10 transition-all disabled:opacity-50"
            >
              {isOtpCooldownActive ? t('auth.request_again_after', { time: formatOtpCooldown(otpRemainingSeconds) }) : t('auth.resend_otp_button')}
            </button>
          )}

          {step === 'verify-email' && (
            <p className="text-center text-[9px] font-mono font-black uppercase tracking-widest text-white/30">
              {t('auth.step_1')}
            </p>
          )}

          {step === 'register' && (
            <p className="text-center text-[9px] font-mono font-black uppercase tracking-widest text-white/30">
              {t('auth.step_2')}
            </p>
          )}
        </form>

        <p className="text-center text-[10px] font-mono font-black text-white/20 uppercase tracking-[0.2em]">
          {t('auth.already_have_account')}{' '}
          <Link to="/login" className="text-indigo-400 hover:underline">
            {t('auth.login_now')}
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Register;
