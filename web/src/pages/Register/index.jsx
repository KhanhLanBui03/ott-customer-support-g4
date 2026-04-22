import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Zap, User, Phone, Lock, ArrowRight, Shield } from 'lucide-react';

const Register = () => {
  const [formData, setFormData] = useState({
    phoneNumber: '',
    email: '',
    firstName: '',
    lastName: '',
    password: '',
    confirmPassword: '',
  });
  const [otpCode, setOtpCode] = useState('');
  const [registeredEmail, setRegisteredEmail] = useState('');
  const [step, setStep] = useState('send-otp');
  const [emailVerified, setEmailVerified] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const { register, sendOtp, verifyOtp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const unverifiedEmail = location.state?.email;
    if (!unverifiedEmail) {
      return;
    }

    setFormData((prev) => ({ ...prev, email: unverifiedEmail }));
    setRegisteredEmail(unverifiedEmail);
    setStep('send-otp');
    setEmailVerified(false);
    setSuccess(
      location.state?.message ||
        'Email chưa xác thực. Vui lòng gửi OTP và xác thực để đăng nhập.',
    );
  }, [location.state]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!emailVerified || !registeredEmail) {
      setError('Vui lòng xác minh email trước khi đăng ký');
      setStep('send-otp');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Mật khẩu xác nhận không khớp');
      return;
    }

    if (!/^0\d{9}$/.test(formData.phoneNumber)) {
      setError('Số điện thoại phải đúng định dạng 0XXXXXXXXX');
      return;
    }

    if (formData.password.length < 8) {
      setError('Mật khẩu phải có ít nhất 8 ký tự');
      return;
    }

    try {
      setLoading(true);
      await register({
        phoneNumber: formData.phoneNumber,
        email: registeredEmail,
        firstName: formData.firstName,
        lastName: formData.lastName,
        password: formData.password,
        confirmPassword: formData.confirmPassword,
      });
      navigate('/login', {
        state: {
          email: registeredEmail,
          message: 'Đăng ký thành công. Bạn có thể đăng nhập ngay.',
        },
      });
    } catch (err) {
      setError(err?.response?.data?.message || 'Đăng ký thất bại');
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async () => {
    setError('');
    setSuccess('');

    const emailToVerify = (registeredEmail || formData.email).trim();
    if (!emailToVerify) {
      setError('Vui lòng nhập email trước khi gửi OTP');
      return;
    }

    try {
      setLoading(true);
      const response = await sendOtp(emailToVerify, 'REGISTRATION');
      const devOtp = response?.message;
      setRegisteredEmail(emailToVerify);
      setFormData((prev) => ({ ...prev, email: emailToVerify }));
      setStep('verify-otp');
      setSuccess(devOtp ? `OTP test: ${devOtp}` : 'Mã OTP đã được gửi tới email của bạn.');
    } catch (err) {
      setError(err?.response?.data?.message || 'Không thể gửi OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!otpCode.trim()) {
      setError('Vui lòng nhập mã OTP');
      return;
    }

    try {
      setLoading(true);
      await verifyOtp({
        email: registeredEmail,
        otpCode: otpCode.trim(),
      });
      setEmailVerified(true);
      setStep('register');
      setSuccess('Email đã xác thực. Vui lòng nhập thông tin để hoàn tất đăng ký.');
    } catch (err) {
      setError(err?.response?.data?.message || 'Xác thực OTP thất bại');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setError('');
    setSuccess('');

    try {
      setLoading(true);
      await sendOtp(registeredEmail, 'REGISTRATION');
      setSuccess('Đã gửi lại mã OTP.');
    } catch (err) {
      setError(err?.response?.data?.message || 'Không thể gửi lại OTP');
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
            <p className="text-[10px] font-mono font-black uppercase tracking-[0.4em] text-white/20">Initialize Signal Unit Registration</p>
          </div>
        </div>

        <form className="space-y-6" onSubmit={step === 'register' ? handleSubmit : handleVerifyOtp}>
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
            {step === 'register' ? (
              <>
                <div className="relative group">
                  <div className="absolute left-6 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-cursor-accent">
                    <User size={18} />
                  </div>
                  <input
                    name="firstName"
                    type="text"
                    required
                    className="w-full pl-16 pr-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-white text-sm focus:outline-none focus:border-cursor-accent focus:bg-white/[0.08] transition-all placeholder:text-white/10 font-medium"
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
                    className="w-full pl-16 pr-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-white text-sm focus:outline-none focus:border-cursor-accent focus:bg-white/[0.08] transition-all placeholder:text-white/10 font-medium"
                    placeholder="Last name"
                    value={formData.lastName}
                    onChange={handleChange}
                  />
                </div>

                <div className="relative group">
                  <input
                    name="email"
                    type="email"
                    disabled
                    className="w-full px-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-white/50 text-sm focus:outline-none"
                    placeholder="Email"
                    value={registeredEmail}
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
                    className="w-full pl-16 pr-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-white text-sm focus:outline-none focus:border-cursor-accent focus:bg-white/[0.08] transition-all placeholder:text-white/10 font-medium"
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
                      className="w-full px-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-white text-sm focus:outline-none focus:border-cursor-accent focus:bg-white/[0.08] transition-all placeholder:text-white/10 font-medium"
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
                      className="w-full px-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-white text-sm focus:outline-none focus:border-cursor-accent focus:bg-white/[0.08] transition-all placeholder:text-white/10 font-medium"
                      placeholder="Confirm"
                      value={formData.confirmPassword}
                      onChange={handleChange}
                    />
                  </div>
                </div>
              </>
            ) : step === 'verify-otp' ? (
              <>
                <div className="relative group">
                  <input
                    type="email"
                    disabled
                    className="w-full px-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-white/50 text-sm focus:outline-none"
                    value={registeredEmail}
                  />
                </div>
                <div className="relative group">
                  <div className="absolute left-6 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-cursor-accent">
                    <Lock size={18} />
                  </div>
                  <input
                    type="text"
                    required
                    className="w-full pl-16 pr-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-white text-sm focus:outline-none focus:border-cursor-accent focus:bg-white/[0.08] transition-all placeholder:text-white/10 font-medium"
                    placeholder="OTP code"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                  />
                </div>
              </>
            ) : (
              <div className="relative group">
                <input
                  name="email"
                  type="email"
                  required
                  className="w-full px-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-white text-sm focus:outline-none focus:border-cursor-accent focus:bg-white/[0.08] transition-all placeholder:text-white/10 font-medium"
                  placeholder="Email"
                  value={registeredEmail || formData.email}
                  onChange={(e) => {
                    const email = e.target.value;
                    setRegisteredEmail(email);
                    setFormData((prev) => ({ ...prev, email }));
                  }}
                />
              </div>
            )}
          </div>

          {step === 'send-otp' ? (
            <button
              type="button"
              disabled={loading}
              onClick={handleSendOtp}
              className="w-full py-5 bg-cursor-accent text-cursor-dark rounded-[32px] font-black tracking-tight text-lg shadow-2xl shadow-cursor-accent/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center space-x-3 disabled:opacity-60"
            >
              <span>{loading ? 'Đang xử lý...' : 'Send OTP'}</span>
              <ArrowRight size={20} />
            </button>
          ) : (
            <button
              type="submit"
              disabled={loading}
              className="w-full py-5 bg-cursor-accent text-cursor-dark rounded-[32px] font-black tracking-tight text-lg shadow-2xl shadow-cursor-accent/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center space-x-3 disabled:opacity-60"
            >
              <span>{loading ? 'Đang xử lý...' : step === 'register' ? 'Provision Node' : 'Verify OTP'}</span>
              <ArrowRight size={20} />
            </button>
          )}

          {step === 'verify-otp' && (
            <button
              type="button"
              disabled={loading}
              onClick={handleResendOtp}
              className="w-full py-4 bg-white/10 text-white rounded-2xl font-black tracking-tight text-sm border border-white/10 hover:bg-white/20 transition-all disabled:opacity-50"
            >
              Gửi lại OTP
            </button>
          )}

          {step === 'send-otp' && (
            <p className="text-center text-[10px] font-mono font-black uppercase tracking-widest text-white/30">
              Bước 1/3: Nhập email và gửi OTP xác minh
            </p>
          )}

          {step === 'verify-otp' && (
            <p className="text-center text-[10px] font-mono font-black uppercase tracking-widest text-white/30">
              Bước 2/3: Xác thực OTP email
            </p>
          )}

          {step === 'register' && (
            <p className="text-center text-[10px] font-mono font-black uppercase tracking-widest text-white/30">
              Bước 3/3: Hoàn tất đăng ký tài khoản
            </p>
          )}
        </form>

        <p className="text-center text-[11px] font-mono font-black text-white/20 uppercase tracking-[0.2em]">
          Existing Hub?{' '}
          <Link to="/login" className="text-cursor-accent hover:underline">
            Synchronize
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Register;
