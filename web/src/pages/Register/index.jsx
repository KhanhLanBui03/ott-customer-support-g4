import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { authApi } from '../../api/authApi';
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
  const [phoneError, setPhoneError] = useState('');
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
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    if (name === 'phoneNumber') {
      setPhoneError('');
    }
  };

  const validatePhone = async (phone) => {
    if (!phone) {
      setPhoneError('Số điện thoại không được để trống');
      return false;
    }
    if (!/^0(3|5|7|8|9)\d{8}$/.test(phone)) {
      setPhoneError('Số điện thoại không hợp lệ (ví dụ: 0912345678)');
      return false;
    }
    try {
      const statusRes = await authApi.checkUserStatus(phone);
      const statusData = statusRes.data?.data || statusRes.data || statusRes;
      if (statusData.exists) {
        setPhoneError('Số điện thoại này đã được sử dụng');
        return false;
      }
      setPhoneError('');
      return true;
    } catch (err) {
      console.error('Lỗi kiểm tra SĐT:', err);
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
      setError('Vui lòng nhập địa chỉ Gmail của bạn');
      return;
    }

    if (!/^[A-Za-z0-9._%+-]+@gmail\.com$/i.test(email)) {
      setError('Vui lòng nhập đúng định dạng Gmail (ví dụ: user@gmail.com)');
      return;
    }

    if (isOtpCooldownActive) {
      setError(`Vui lòng đợi ${formatOtpCooldown(otpRemainingSeconds)} trước khi yêu cầu mã mới`);
      return;
    }

    try {
      setLoading(true);
      await sendOtp(email, 'REGISTRATION');
      setFormData((prev) => ({ ...prev, email }));
      setVerificationCodeSent(true);
      startOtpCooldown(email);
      setSuccess(`Mã xác thực đã được gửi đến ${email}. Mã có hiệu lực trong 2 phút.`);
    } catch (err) {
      const message = err?.response?.data?.message;
      if (message && (message.includes('already exists') || message.includes('đã tồn tại'))) {
        setError('Gmail này đã được đăng ký. Vui lòng sử dụng Gmail khác hoặc đăng nhập.');
      } else {
        setError(message || 'Không thể gửi mã xác thực. Vui lòng thử lại sau.');
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
      setError('Vui lòng nhập địa chỉ Gmail của bạn');
      return;
    }

    if (!otpCode.trim()) {
      setError('Vui lòng nhập mã OTP');
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
      setSuccess('Xác thực Gmail thành công. Vui lòng hoàn tất thông tin tài khoản.');
    } catch (err) {
      setError(err?.response?.data?.message || 'Mã xác thực không chính xác hoặc đã hết hạn');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setError('');
    setSuccess('');

    if (isOtpCooldownActive) {
      setError(`Vui lòng đợi ${formatOtpCooldown(otpRemainingSeconds)} trước khi gửi lại mã`);
      return;
    }

    try {
      setLoading(true);
      const email = formData.email.trim().toLowerCase();
      await sendOtp(email, 'REGISTRATION');
      startOtpCooldown(email);
      setSuccess(`Mã xác thực đã được gửi lại đến ${email}.`);
    } catch (err) {
      setError(err?.response?.data?.message || 'Không thể gửi lại mã OTP');
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
      setError('Vui lòng xác thực Gmail của bạn trước');
      setStep('verify-email');
      return;
    }

    if (!formData.phoneNumber) {
      setPhoneError('Số điện thoại không được để trống');
      return;
    }

    if (!/^0(3|5|7|8|9)\d{8}$/.test(formData.phoneNumber)) {
      setPhoneError('Số điện thoại không hợp lệ. Vui lòng nhập định dạng 0XXXXXXXXX (10 chữ số)');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Mật khẩu xác nhận không khớp');
      return;
    }

    if (formData.password.length < 8) {
      setError('Mật khẩu phải có ít nhất 8 ký tự');
      return;
    }

    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/.test(formData.password)) {
      setError('Mật khẩu không đáp ứng đủ yêu cầu bảo mật');
      return;
    }

    if (!agreedToPolicies) {
      setError('Bạn cần đồng ý với các điều khoản và chính sách');
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

      setSuccess('Tài khoản đã tạo thành công! Đang chuyển hướng về trang đăng nhập...');

      // Đợi 3 giây trước khi chuyển hướng
      setTimeout(() => {
        navigate('/login', {
          state: {
            email: verifiedEmail,
            message: 'Đăng ký tài khoản thành công. Bạn có thể đăng nhập ngay bây giờ.',
          },
        });
      }, 3000);

    } catch (err) {
      setError(err?.response?.data?.message || 'Đăng ký thất bại. Vui lòng kiểm tra lại thông tin.');
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
              KHỞI TẠO ĐĂNG KÝ TÀI KHOẢN
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
                    placeholder="Nhập Gmail của bạn"
                    value={formData.email}
                    onChange={handleChange}
                  />
                </div>

                {verificationCodeSent && (
                  <>
                    <p className="text-[11px] font-mono text-white/60 px-1">
                      Nhập mã xác thực đã được gửi đến hộp thư Gmail của bạn.
                    </p>
                    <div className="relative group">
                      <div className="absolute left-6 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-cursor-accent">
                        <Lock size={18} />
                      </div>
                      <input
                        type="text"
                        required
                        className="w-full pl-16 pr-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-white text-sm focus:outline-none focus:border-cursor-accent focus:bg-white/8 transition-all placeholder:text-white/10 font-medium"
                        placeholder="Mã xác thực"
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
                    placeholder="Gmail đã xác thực"
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
                    placeholder="Tên"
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
                    placeholder="Họ"
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
                    onBlur={handlePhoneBlur}
                    className={`w-full pl-16 pr-6 py-4 bg-white/5 border ${phoneError ? 'border-red-500' : 'border-white/10'} rounded-2xl text-white text-sm focus:outline-none focus:border-cursor-accent focus:bg-white/8 transition-all placeholder:text-white/10 font-medium`}
                    placeholder="Số điện thoại (0XXXXXXXXX)"
                    value={formData.phoneNumber}
                    onChange={handleChange}
                  />
                  {phoneError && (
                    <p className="mt-2 ml-2 text-[10px] font-mono font-black uppercase text-red-500 animate-shake">
                      {phoneError}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="relative group">
                    <input
                      name="password"
                      type="password"
                      required
                      className="w-full px-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-white text-sm focus:outline-none focus:border-cursor-accent focus:bg-white/8 transition-all placeholder:text-white/10 font-medium"
                      placeholder="Mật khẩu"
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
                      placeholder="Xác nhận"
                      value={formData.confirmPassword}
                      onChange={handleChange}
                    />
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-2">
                  <p className="text-[10px] font-mono font-black uppercase tracking-[0.2em] text-white/45">
                    Yêu cầu mật khẩu
                  </p>
                  <div className={`text-[11px] font-mono flex items-center gap-2 ${passwordChecks.minLength ? 'text-green-400' : 'text-white/45'}`}>
                    {passwordChecks.minLength ? <CheckCircle2 size={12} /> : <span className="h-3 w-3 rounded-full border border-current opacity-60" />}
                    <span>Ít nhất 8 ký tự</span>
                  </div>
                  <div className={`text-[11px] font-mono flex items-center gap-2 ${passwordChecks.lower ? 'text-green-400' : 'text-white/45'}`}>
                    {passwordChecks.lower ? <CheckCircle2 size={12} /> : <span className="h-3 w-3 rounded-full border border-current opacity-60" />}
                    <span>Chứa chữ cái thường</span>
                  </div>
                  <div className={`text-[11px] font-mono flex items-center gap-2 ${passwordChecks.upper ? 'text-green-400' : 'text-white/45'}`}>
                    {passwordChecks.upper ? <CheckCircle2 size={12} /> : <span className="h-3 w-3 rounded-full border border-current opacity-60" />}
                    <span>Chứa chữ cái in hoa</span>
                  </div>
                  <div className={`text-[11px] font-mono flex items-center gap-2 ${passwordChecks.number ? 'text-green-400' : 'text-white/45'}`}>
                    {passwordChecks.number ? <CheckCircle2 size={12} /> : <span className="h-3 w-3 rounded-full border border-current opacity-60" />}
                    <span>Chứa ít nhất một chữ số</span>
                  </div>
                  <div className={`text-[11px] font-mono flex items-center gap-2 ${passwordChecks.special ? 'text-green-400' : 'text-white/45'}`}>
                    {passwordChecks.special ? <CheckCircle2 size={12} /> : <span className="h-3 w-3 rounded-full border border-current opacity-60" />}
                    <span>Chứa ký tự đặc biệt (@$!%*?&)</span>
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
                    Tôi đồng ý với các Điều khoản Dịch vụ và Chính sách Bảo mật thông tin cá nhân.
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
                  ? 'Đang xử lý...'
                  : isOtpCooldownActive
                  ? `Yêu cầu lại sau ${formatOtpCooldown(otpRemainingSeconds)}`
                  : 'Gửi mã xác thực'}
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
              <span>{loading ? 'Đang xử lý...' : step === 'register' ? 'Tạo tài khoản' : 'Xác thực mã Gmail'}</span>
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
              {isOtpCooldownActive ? `Gửi lại sau ${formatOtpCooldown(otpRemainingSeconds)}` : 'Gửi lại mã OTP'}
            </button>
          )}

          {step === 'verify-email' && (
            <p className="text-center text-[10px] font-mono font-black uppercase tracking-widest text-white/30">
              Bước 1/2: Xác thực Gmail bằng OTP
            </p>
          )}

          {step === 'register' && (
            <p className="text-center text-[10px] font-mono font-black uppercase tracking-widest text-white/30">
              Bước 2/2: Hoàn tất thông tin tài khoản
            </p>
          )}
        </form>

        <p className="text-center text-[11px] font-mono font-black text-white/20 uppercase tracking-[0.2em]">
          Đã có tài khoản?{' '}
          <Link to="/login" className="text-cursor-accent hover:underline">
            Đăng nhập ngay
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Register;
