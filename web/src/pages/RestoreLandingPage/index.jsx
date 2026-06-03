import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { ShieldCheck, ShieldAlert, Loader, ArrowRight } from 'lucide-react';
import authApi from '../../api/authApi';

const RestoreLandingPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('loading'); // 'loading' | 'success' | 'error'
  const [errorMsg, setErrorMsg] = useState('');
  const email = searchParams.get('email');

  useEffect(() => {
    if (!email) {
      setStatus('error');
      setErrorMsg('Không tìm thấy thông tin email hợp lệ trong liên kết.');
      return;
    }

    const performRestore = async () => {
      try {
        await authApi.quickCancel(email);
        setStatus('success');
        // Auto redirect after 5 seconds
        setTimeout(() => {
          navigate('/login');
        }, 5000);
      } catch (err) {
        console.error('Email restoration failed', err);
        setStatus('error');
        setErrorMsg(err?.response?.data?.message || 'Có lỗi xảy ra trong quá trình khôi phục tài khoản. Vui lòng thử lại sau.');
      }
    };

    performRestore();
  }, [email, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 relative overflow-hidden font-sans">
      {/* Background Decorative Elements */}
      <div className="absolute top-0 left-0 w-full h-full">
        <div className="absolute top-[-10%] right-[-5%] w-[50%] h-[50%] bg-emerald-500/5 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] left-[-5%] w-[40%] h-[40%] bg-blue-500/5 blur-[120px] rounded-full" />
      </div>

      <div className="max-w-md w-full p-12 space-y-8 relative z-10 animate-fade-in bg-slate-900/40 border border-white/5 rounded-[40px] shadow-2xl backdrop-blur-xl">
        <div className="flex flex-col items-center text-center space-y-6">
          {status === 'loading' && (
            <>
              <div className="w-20 h-20 bg-blue-500/10 text-blue-400 rounded-full flex items-center justify-center animate-pulse">
                <Loader className="animate-spin" size={40} />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-black text-white tracking-tight">Đang xử lý khôi phục...</h2>
                <p className="text-white/40 text-sm">Vui lòng chờ trong giây lát, chúng tôi đang khôi phục tài khoản của bạn.</p>
              </div>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="w-20 h-20 bg-emerald-500/10 text-emerald-400 rounded-full flex items-center justify-center shadow-lg shadow-emerald-500/10 animate-scale-up">
                <ShieldCheck size={40} />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-black text-white tracking-tight">Khôi phục thành công!</h2>
                <p className="text-white/60 text-sm leading-relaxed">
                  Tài khoản liên kết với Gmail <strong className="text-white">{email}</strong> của bạn đã được kích hoạt lại hoạt động bình thường.
                </p>
                <p className="text-white/30 text-[11px] uppercase font-mono tracking-widest pt-4">
                  Đang chuyển hướng về trang đăng nhập sau 5 giây...
                </p>
              </div>
              <button
                onClick={() => navigate('/login')}
                className="w-full py-4 bg-emerald-500 text-slate-950 rounded-3xl font-black tracking-wider text-xs uppercase shadow-2xl shadow-emerald-500/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center space-x-2"
              >
                <span>Đăng nhập ngay</span>
                <ArrowRight size={14} />
              </button>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="w-20 h-20 bg-red-500/10 text-red-400 rounded-full flex items-center justify-center animate-scale-up">
                <ShieldAlert size={40} />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-black text-white tracking-tight">Không thể khôi phục</h2>
                <p className="text-red-400/80 text-sm leading-relaxed">{errorMsg}</p>
              </div>
              <Link
                to="/login"
                className="w-full py-4 bg-white/5 border border-white/10 text-white rounded-3xl font-black tracking-wider text-xs uppercase hover:bg-white/10 active:scale-95 transition-all flex items-center justify-center space-x-2"
              >
                <span>Quay lại Đăng nhập</span>
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default RestoreLandingPage;
