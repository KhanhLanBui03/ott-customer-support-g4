import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Shield, Mail, Lock, ArrowRight } from 'lucide-react';

const AdminLogin = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const authData = await login({ email, password }, { remember: false });
      if (authData.user.role === 'ADMIN') {
        navigate('/admin/dashboard');
      } else {
        setError('Bạn không có quyền quản trị viên!');
        // Ideally we should logout here since we logged them in
      }
    } catch (err) {
      setError(err?.response?.data?.message || 'Đăng nhập thất bại');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 relative overflow-hidden font-sans">
      <div className="absolute top-0 left-0 w-full h-full">
        <div className="absolute top-[-10%] right-[-5%] w-[50%] h-[50%] bg-red-500/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] left-[-5%] w-[40%] h-[40%] bg-orange-500/10 blur-[120px] rounded-full" />
      </div>

      <div className="max-w-md w-full p-12 space-y-8 relative z-10 bg-gray-800/50 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-16 h-16 bg-red-500/20 border border-red-500/30 rounded-2xl flex items-center justify-center">
            <Shield size={32} className="text-red-500" />
          </div>
          <div className="text-center">
            <h2 className="text-2xl font-bold text-white">Admin Portal</h2>
            <p className="text-gray-400 text-sm mt-1">Đăng nhập bằng tài khoản quản trị</p>
          </div>
        </div>

        <form className="space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl text-sm font-medium text-center">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div className="relative group">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-red-500 transition-colors">
                <Mail size={18} />
              </div>
              <input
                type="email"
                required
                className="w-full pl-12 pr-4 py-3 bg-black/20 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-red-500 focus:bg-black/40 transition-all placeholder:text-gray-500"
                placeholder="Email quản trị"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="relative group">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-red-500 transition-colors">
                <Lock size={18} />
              </div>
              <input
                type="password"
                required
                className="w-full pl-12 pr-4 py-3 bg-black/20 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-red-500 focus:bg-black/40 transition-all placeholder:text-gray-500"
                placeholder="Mật khẩu"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-4 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold transition-all flex items-center justify-center space-x-2"
          >
            <span>Đăng nhập</span>
            <ArrowRight size={18} />
          </button>
        </form>
      </div>
    </div>
  );
};

export default AdminLogin;
