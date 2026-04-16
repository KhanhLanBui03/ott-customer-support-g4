import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Zap, User, Phone, Lock, ArrowRight, Shield } from 'lucide-react';

const Register = () => {
  const [formData, setFormData] = useState({
    phoneNumber: '',
    fullName: '',
    password: '',
    confirmPassword: ''
  });
  const [error, setError] = useState('');
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('Key synchronization mismatch');
      return;
    }

    try {
      await register({
        phoneNumber: formData.phoneNumber,
        fullName: formData.fullName,
        password: formData.password
      });
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Provisioning failed');
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

        <form className="space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-500 rounded-2xl text-[10px] font-mono font-black uppercase tracking-widest flex items-center space-x-3">
              <Shield size={14} />
              <span>{error}</span>
            </div>
          )}
          
          <div className="space-y-4">
            <div className="relative group">
              <div className="absolute left-6 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-cursor-accent">
                <User size={18} />
              </div>
              <input
                name="fullName"
                type="text"
                required
                className="w-full pl-16 pr-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-white text-sm focus:outline-none focus:border-cursor-accent focus:bg-white/[0.08] transition-all placeholder:text-white/10 font-medium"
                placeholder="Identity Label"
                value={formData.fullName}
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
                className="w-full pl-16 pr-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-white text-sm focus:outline-none focus:border-cursor-accent focus:bg-white/[0.08] transition-all placeholder:text-white/10 font-medium"
                placeholder="Signal Address"
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
                  placeholder="Master Key"
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
                  placeholder="Verify Key"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-5 bg-cursor-accent text-cursor-dark rounded-[32px] font-black tracking-tight text-lg shadow-2xl shadow-cursor-accent/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center space-x-3"
          >
            <span>Provision Node</span>
            <ArrowRight size={20} />
          </button>
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
