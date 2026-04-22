import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Zap, Shield, Mail, Lock, ArrowRight } from 'lucide-react';
import { getAuthPersist, getRememberedEmail, setRememberedEmail } from '../../utils/storage';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(getAuthPersist());
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

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
      const message = err?.response?.data?.message || 'Signal mismatch. Access denied.';
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
    <div className="min-h-screen flex items-center justify-center bg-cursor-dark relative overflow-hidden font-sans">
      {/* Background Decorative Elements */}
      <div className="absolute top-0 left-0 w-full h-full">
         <div className="absolute top-[-10%] right-[-5%] w-[50%] h-[50%] bg-cursor-accent/5 blur-[120px] rounded-full" />
         <div className="absolute bottom-[-10%] left-[-5%] w-[40%] h-[40%] bg-blue-500/5 blur-[120px] rounded-full" />
      </div>

      <div className="max-w-md w-full p-12 space-y-12 relative z-10 animate-fade-in">
        <div className="flex flex-col items-center space-y-6">
          <div className="w-20 h-20 bg-white/5 border border-white/10 rounded-[28px] flex items-center justify-center shadow-2xl relative group">
             <div className="absolute inset-0 bg-cursor-accent/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
             <Zap size={40} className="text-cursor-accent relative z-10" fill="currentColor" />
          </div>
          <div className="text-center space-y-2">
            <h2 className="text-4xl font-black text-white tracking-tighter">Initialize Link</h2>
            <p className="text-[10px] font-mono font-black uppercase tracking-[0.4em] text-white/20">Secure Node Authentication Package v1.0.4</p>
          </div>
        </div>

        <form className="space-y-8" onSubmit={handleSubmit}>
          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-500 rounded-2xl text-[10px] font-mono font-black uppercase tracking-widest flex items-center space-x-3">
              <Shield size={14} />
              <span>{error}</span>
            </div>
          )}
          
          <div className="space-y-6">
            <div className="relative group">
              <div className="absolute left-6 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-cursor-accent transition-colors">
                <Mail size={18} />
              </div>
              <input
                type="email"
                required
                className="w-full pl-16 pr-6 py-5 bg-white/5 border border-white/10 rounded-3xl text-white text-sm focus:outline-none focus:border-cursor-accent focus:bg-white/8 transition-all placeholder:text-white/10 font-medium"
                placeholder="Email Address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
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
                placeholder="Secure Key"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-[10px] font-mono font-black uppercase tracking-widest text-white/40 hover:text-white/70 transition-colors cursor-pointer">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-4 w-4 rounded border-white/30 bg-transparent"
              />
              Remember Me
            </label>
            <Link to="/forgot-password" size={18} className="text-[10px] font-mono font-black uppercase tracking-widest text-white/20 hover:text-white transition-colors">
              Recover Link Data
            </Link>
          </div>

          <button
            type="submit"
            className="w-full py-5 bg-cursor-accent text-cursor-dark rounded-4xl font-black tracking-tight text-lg shadow-2xl shadow-cursor-accent/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center space-x-3"
          >
            <span>Establish Connection</span>
            <ArrowRight size={20} />
          </button>
        </form>

        <p className="text-center text-[11px] font-mono font-black text-white/20 uppercase tracking-[0.2em]">
          New Node?{' '}
          <Link to="/register" className="text-cursor-accent hover:underline">
            Register Signal Unit
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Login;
