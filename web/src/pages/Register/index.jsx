import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Zap, User, Phone, Lock, ArrowRight, Shield, CheckCircle2 } from 'lucide-react';

const Register = () => {
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
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const { register, sendOtp, verifyOtp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

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
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSendVerificationCode = async () => {
    setError('');
    setSuccess('');

    const email = formData.email.trim().toLowerCase();
    if (!email) {
      setError('Please enter your Gmail address');
      return;
    }

    if (!/^[A-Za-z0-9._%+-]+@gmail\.com$/i.test(email)) {
      setError('Please enter a valid Gmail address');
      return;
    }

    if (isOtpCooldownActive) {
      setError(`Please wait ${formatOtpCooldown(otpRemainingSeconds)} before requesting another code`);
      return;
    }

    try {
      setLoading(true);
      await sendOtp(email, 'REGISTRATION');
      setFormData((prev) => ({ ...prev, email }));
      setVerificationCodeSent(true);
      startOtpCooldown(email);
      setSuccess(`Verification code sent to ${email}. The code is valid for 2 minutes.`);
    } catch (err) {
      setError(err?.response?.data?.message || 'Unable to send verification code');
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
      setError('Please enter your Gmail address');
      return;
    }

    if (!otpCode.trim()) {
      setError('Please enter the OTP code');
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
      setSuccess('Gmail verified. Now complete your account details.');
    } catch (err) {
      setError(err?.response?.data?.message || 'OTP verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setError('');
    setSuccess('');

    if (isOtpCooldownActive) {
      setError(`Please wait ${formatOtpCooldown(otpRemainingSeconds)} before resending OTP`);
      return;
    }

    try {
      setLoading(true);
      const email = formData.email.trim().toLowerCase();
      await sendOtp(email, 'REGISTRATION');
      startOtpCooldown(email);
      setSuccess(`Verification code has been resent to ${email}.`);
    } catch (err) {
      setError(err?.response?.data?.message || 'Unable to resend OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAccount = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!verifiedEmail) {
      setError('Please verify your Gmail first');
      setStep('verify-email');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Password confirmation does not match');
      return;
    }

    if (!/^0\d{9}$/.test(formData.phoneNumber)) {
      setError('Phone number must match format 0XXXXXXXXX');
      return;
    }

    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/.test(formData.password)) {
      setError('Password must include lowercase, uppercase, number, and special character');
      return;
    }

    if (!agreedToPolicies) {
      setError('Please accept the terms and privacy policy');
      return;
    }

    try {
      setLoading(true);
      await register({
        phoneNumber: formData.phoneNumber,
        email: verifiedEmail,
        firstName: formData.firstName,
        lastName: formData.lastName,
        password: formData.password,
        confirmPassword: formData.confirmPassword,
      });

      navigate('/login', {
        state: {
          email: verifiedEmail,
          message: 'Account created successfully. You can sign in now.',
        },
      });
    } catch (err) {
      setError(err?.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-cursor-dark relative overflow-hidden font-sans">
      <div className="absolute top-0 left-0 w-full h-full">
        <div className="absolute bottom-[-10%] right-[-5%] w-[50%] h-[50%] bg-cursor-accent/5 blur-[120px] rounded-full" />
        <div className="absolute top-[-10%] left-[-5%] w-[40%] h-[40%] bg-blue-500/5 blur-[120px] rounded-full" />
      </div>

      <div className="max-w-md w-full p-12 space-y-12 relative z-10 animate-fade-in">
        <div className="flex flex-col items-center space-y-6">
          <div className="w-20 h-20 bg-white/5 border border-white/10 rounded-[28px] flex items-center justify-center shadow-2xl">
            <Zap size={40} className="text-cursor-accent" fill="currentColor" />
          </div>
          <div className="text-center space-y-2">
            <h2 className="text-4xl font-black text-white tracking-tighter">New Node</h2>
            <p className="text-[10px] font-mono font-black uppercase tracking-[0.4em] text-white/20">
              Initialize Signal Unit Registration
            </p>
          </div>
        </div>

        <form className="space-y-6" onSubmit={step === 'register' ? handleCreateAccount : handleVerifyEmail}>
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
            {step === 'verify-email' && (
              <>
                <div className="relative group">
                  <input
                    name="email"
                    type="email"
                    required
                    className="w-full px-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-white text-sm focus:outline-none focus:border-cursor-accent focus:bg-white/8 transition-all placeholder:text-white/10 font-medium"
                    placeholder="Your Gmail"
                    value={formData.email}
                    onChange={handleChange}
                  />
                </div>

                {verificationCodeSent && (
                  <>
                    <p className="text-[11px] font-mono text-white/60 px-1">
                      Enter the verification code sent to your Gmail inbox.
                    </p>
                    <div className="relative group">
                      <div className="absolute left-6 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-cursor-accent">
                        <Lock size={18} />
                      </div>
                      <input
                        type="text"
                        required
                        className="w-full pl-16 pr-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-white text-sm focus:outline-none focus:border-cursor-accent focus:bg-white/8 transition-all placeholder:text-white/10 font-medium"
                        placeholder="Verification code"
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
                    className="w-full px-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-white/50 text-sm focus:outline-none"
                    placeholder="Verified Gmail"
                    value={verifiedEmail}
                  />
                </div>

                <div className="relative group">
                  <div className="absolute left-6 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-cursor-accent">
                    <User size={18} />
                  </div>
                  <input
                    name="firstName"
                    type="text"
                    required
                    className="w-full pl-16 pr-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-white text-sm focus:outline-none focus:border-cursor-accent focus:bg-white/8 transition-all placeholder:text-white/10 font-medium"
                    placeholder="First name"
                    value={formData.firstName}
                    onChange={handleChange}
                  />
                </div>

                <div className="relative group">
                  <div className="absolute left-6 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-cursor-accent">
                    <User size={18} />
                  </div>
                  <input
                    name="lastName"
                    type="text"
                    required
                    className="w-full pl-16 pr-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-white text-sm focus:outline-none focus:border-cursor-accent focus:bg-white/8 transition-all placeholder:text-white/10 font-medium"
                    placeholder="Last name"
                    value={formData.lastName}
                    onChange={handleChange}
                  />
                </div>

                <div className="relative group">
                  <div className="absolute left-6 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-cursor-accent">
                    <Phone size={18} />
                  </div>
                  <input
                    name="phoneNumber"
                    type="text"
                    required
                    className="w-full pl-16 pr-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-white text-sm focus:outline-none focus:border-cursor-accent focus:bg-white/8 transition-all placeholder:text-white/10 font-medium"
                    placeholder="Phone number (0XXXXXXXXX)"
                    value={formData.phoneNumber}
                    onChange={handleChange}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="relative group">
                    <input
                      name="password"
                      type="password"
                      required
                      className="w-full px-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-white text-sm focus:outline-none focus:border-cursor-accent focus:bg-white/8 transition-all placeholder:text-white/10 font-medium"
                      placeholder="Password"
                      value={formData.password}
                      onChange={handleChange}
                    />
                  </div>
                  <div className="relative group">
                    <input
                      name="confirmPassword"
                      type="password"
                      required
                      className="w-full px-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-white text-sm focus:outline-none focus:border-cursor-accent focus:bg-white/8 transition-all placeholder:text-white/10 font-medium"
                      placeholder="Confirm"
                      value={formData.confirmPassword}
                      onChange={handleChange}
                    />
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-2">
                  <p className="text-[10px] font-mono font-black uppercase tracking-[0.2em] text-white/45">
                    Password Requirements
                  </p>
                  <div className={`text-[11px] font-mono flex items-center gap-2 ${passwordChecks.minLength ? 'text-green-400' : 'text-white/45'}`}>
                    {passwordChecks.minLength ? <CheckCircle2 size={12} /> : <span className="h-3 w-3 rounded-full border border-current opacity-60" />}
                    <span>At least 8 characters</span>
                  </div>
                  <div className={`text-[11px] font-mono flex items-center gap-2 ${passwordChecks.lower ? 'text-green-400' : 'text-white/45'}`}>
                    {passwordChecks.lower ? <CheckCircle2 size={12} /> : <span className="h-3 w-3 rounded-full border border-current opacity-60" />}
                    <span>Contains lowercase letter</span>
                  </div>
                  <div className={`text-[11px] font-mono flex items-center gap-2 ${passwordChecks.upper ? 'text-green-400' : 'text-white/45'}`}>
                    {passwordChecks.upper ? <CheckCircle2 size={12} /> : <span className="h-3 w-3 rounded-full border border-current opacity-60" />}
                    <span>Contains uppercase letter</span>
                  </div>
                  <div className={`text-[11px] font-mono flex items-center gap-2 ${passwordChecks.number ? 'text-green-400' : 'text-white/45'}`}>
                    {passwordChecks.number ? <CheckCircle2 size={12} /> : <span className="h-3 w-3 rounded-full border border-current opacity-60" />}
                    <span>Contains a number</span>
                  </div>
                  <div className={`text-[11px] font-mono flex items-center gap-2 ${passwordChecks.special ? 'text-green-400' : 'text-white/45'}`}>
                    {passwordChecks.special ? <CheckCircle2 size={12} /> : <span className="h-3 w-3 rounded-full border border-current opacity-60" />}
                    <span>Contains special character (@$!%*?&)</span>
                  </div>
                </div>

                <label className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-xs text-white/70">
                  <input
                    type="checkbox"
                    checked={agreedToPolicies}
                    onChange={(e) => setAgreedToPolicies(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-white/30 bg-transparent"
                  />
                  <span>
                    I agree to the Terms of Service and Privacy Policy for personal data processing.
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
              className="w-full py-5 bg-cursor-accent text-cursor-dark rounded-4xl font-black tracking-tight text-lg shadow-2xl shadow-cursor-accent/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center space-x-3 disabled:opacity-60"
            >
              <span>
                {loading
                  ? 'Processing...'
                  : isOtpCooldownActive
                  ? `Request code in ${formatOtpCooldown(otpRemainingSeconds)}`
                  : 'Send Verification Code'}
              </span>
              <ArrowRight size={20} />
            </button>
          )}

          {(step === 'register' || (step === 'verify-email' && verificationCodeSent)) && (
            <button
              type="submit"
              disabled={loading}
              className="w-full py-5 bg-cursor-accent text-cursor-dark rounded-4xl font-black tracking-tight text-lg shadow-2xl shadow-cursor-accent/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center space-x-3 disabled:opacity-60"
            >
              <span>{loading ? 'Processing...' : step === 'register' ? 'Create Account' : 'Verify Gmail Code'}</span>
              <ArrowRight size={20} />
            </button>
          )}

          {step === 'verify-email' && verificationCodeSent && (
            <button
              type="button"
              disabled={loading || isOtpCooldownActive}
              onClick={handleResendOtp}
              className="w-full py-4 bg-white/10 text-white rounded-2xl font-black tracking-tight text-sm border border-white/10 hover:bg-white/20 transition-all disabled:opacity-50"
            >
              {isOtpCooldownActive ? `Resend in ${formatOtpCooldown(otpRemainingSeconds)}` : 'Resend OTP'}
            </button>
          )}

          {step === 'verify-email' && (
            <p className="text-center text-[10px] font-mono font-black uppercase tracking-widest text-white/30">
              Step 1/2: Verify your Gmail with OTP
            </p>
          )}

          {step === 'register' && (
            <p className="text-center text-[10px] font-mono font-black uppercase tracking-widest text-white/30">
              Step 2/2: Complete account details
            </p>
          )}
        </form>

        <p className="text-center text-[11px] font-mono font-black text-white/20 uppercase tracking-[0.2em]">
          Existing Hub{' '}
          <Link to="/login" className="text-cursor-accent hover:underline">
            Synchronize
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Register;
