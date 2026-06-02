import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../hooks/useAuth';
import { Zap, Shield, Mail, Lock, ArrowRight, QrCode, KeyRound } from 'lucide-react';
import { getAuthPersist, getRememberedEmail, setRememberedEmail } from '../../utils/storage';
import AccountRestoreModal from '../../components/AccountRestore/AccountRestoreModal';
import QrLogin from './QrLogin';

const Login = () => {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(getAuthPersist());
  const [error, setError] = useState('');
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [lockedAt, setLockedAt] = useState(null);
  const [loginMode, setLoginMode] = useState('password'); // 'password' or 'qr'
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleMouseMove = (e) => {
    setMousePos({ x: e.clientX, y: e.clientY });
    if (!isHovered) setIsHovered(true);
  };

  useEffect(() => {
    const rememberedEmail = getRememberedEmail();
    if (rememberedEmail) {
      setEmail(rememberedEmail);
      setRememberMe(true);
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await login({ email, password }, { remember: rememberMe });
      if (rememberMe) {
        setRememberedEmail(email.trim());
      } else {
        setRememberedEmail('');
      }
      navigate('/');
    } catch (err) {
      const errorData = err?.response?.data?.error;
      const message = err?.response?.data?.message || t('auth.errors.access_denied');

      // Handle locked account
      if (errorData?.code === 'ACCOUNT_LOCKED') {
        setLockedAt(errorData.metadata?.lockedAt);
        setShowRestoreModal(true);
        return;
      }

      if (/not verified/i.test(message)) {
        navigate('/register', {
          state: {
            email,
            unverified: true,
            message,
          },
        });
        return;
      }
      setError(message);
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
              Kết nối tức thì, Bảo mật tuyệt đối
            </p>
          </div>
        </div>

        {loginMode === 'password' ? (
          <>
            <form className="space-y-4" onSubmit={handleSubmit}>
              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl text-[9px] font-mono font-black uppercase tracking-widest flex items-center space-x-2">
                  <Shield size={12} />
                  <span>{error}</span>
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
                    className="w-full pl-12 pr-4 py-3.5 bg-[#160f26]/30 border border-white/[0.08] rounded-2xl text-white text-sm focus:outline-none focus:border-cursor-accent/50 focus:bg-[#160f26]/60 transition-all placeholder:text-white/20 font-medium"
                    placeholder={t('auth.email_placeholder')}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
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
                    placeholder={t('auth.password_placeholder')}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between px-1">
                <label className="flex items-center gap-2 text-[9px] font-mono font-black uppercase tracking-widest text-white/40 hover:text-white/70 transition-colors cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-white/30 bg-transparent text-cursor-accent focus:ring-0 focus:ring-offset-0"
                  />
                  {t('auth.remember_me')}
                </label>
                <Link to="/forgot-password" className="text-[9px] font-mono font-black uppercase tracking-widest text-indigo-300 hover:text-indigo-200 transition-colors">
                  {t('auth.forgot_password')}
                </Link>
              </div>

              <button
                type="submit"
                className="w-full py-3.5 bg-white text-slate-950 rounded-2xl font-black tracking-tight text-base shadow-xl shadow-white/5 hover:bg-slate-100 hover:scale-[1.01] active:scale-98 transition-all flex items-center justify-center space-x-2"
              >
                <span>{t('auth.login_button')}</span>
                <ArrowRight size={18} className="text-slate-950" />
              </button>
            </form>

            <div className="relative flex items-center py-1">
              <div className="flex-grow border-t border-white/10"></div>
              <span className="flex-shrink-0 mx-3 text-white/20 text-[10px] font-bold uppercase">{t('common.or')}</span>
              <div className="flex-grow border-t border-white/10"></div>
            </div>

            <button
              onClick={() => setLoginMode('qr')}
              className="w-full py-3 bg-white/5 border border-white/10 text-white rounded-2xl font-bold text-sm hover:bg-white/10 transition-all flex items-center justify-center space-x-2 group"
            >
              <QrCode size={18} className="text-white/50 group-hover:text-cursor-accent transition-colors" />
              <span>{t('auth.login_qr')}</span>
            </button>

            <p className="text-center pt-1 text-[10px] font-mono font-black text-white/20 uppercase tracking-[0.2em]">
              {t('auth.no_account')}{' '}
              <Link to="/register" className="text-indigo-400 hover:underline">
                {t('auth.register_link')}
              </Link>
            </p>
          </>
        ) : (
          <QrLogin onBack={() => setLoginMode('password')} />
        )}
      </div>

      {showRestoreModal && (
        <AccountRestoreModal
          email={email}
          lockedAt={lockedAt}
          onClose={() => setShowRestoreModal(false)}
        />
      )}
    </div>
  );
};

export default Login;
