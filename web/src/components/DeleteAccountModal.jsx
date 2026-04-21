import React, { useState } from 'react';
import { X, AlertTriangle, ShieldAlert } from 'lucide-react';
import { useDispatch } from 'react-redux';
import { useAuth } from '../hooks/useAuth';
import { userApi } from '../api/userApi';

const DeleteAccountModal = ({ isOpen, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const { logout } = useAuth();
  const dispatch = useDispatch();

  if (!isOpen) return null;

  const handleDelete = async () => {
    setLoading(true);
    setError('');
    try {
      await userApi.deleteAccount();
      setIsSuccess(true);
      setTimeout(() => {
        logout();
        onClose();
      }, 4000);
    } catch (err) {
      console.error('Delete account failed', err);
      setError(err?.response?.data?.message || 'Có lỗi xảy ra khi xóa tài khoản. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 backdrop-blur-xl bg-cursor-cream/40 animate-fade-in">
      <div className="bg-surface-200 w-full max-w-md rounded-[40px] shadow-2xl border border-cursor-dark/5 relative overflow-hidden">
        <div className="h-20 flex items-center justify-between px-10 border-b border-cursor-dark/5 bg-surface-100/50 backdrop-blur-md">
          <div className="flex items-center space-x-3 text-red-500">
             <AlertTriangle size={24} />
             <h2 className="font-serif italic font-black uppercase tracking-[0.2em] text-[12px]">Xóa Tài Khoản</h2>
          </div>
          <button onClick={onClose} disabled={loading} className="p-2 hover:bg-black/5 rounded-xl text-cursor-dark/40 transition-colors disabled:opacity-50">
            <X size={24} />
          </button>
        </div>

        <div className="p-10 space-y-8">
          {isSuccess ? (
            <div className="flex flex-col items-center justify-center text-center space-y-4 animate-fade-in py-8">
              <div className="w-20 h-20 bg-cursor-success/10 text-cursor-success rounded-full flex items-center justify-center mb-2">
                 <ShieldAlert size={40} />
              </div>
              <p className="font-serif text-[16px] text-cursor-success font-bold leading-relaxed">
                Đã khóa tài khoản thành công!
              </p>
              <p className="font-serif text-[14px] text-cursor-dark/60 leading-relaxed px-4">
                Cảm ơn bạn đã sử dụng dịch vụ của chúng tôi. Hệ thống sẽ tự động đăng xuất sau 4 giây...
              </p>
            </div>
          ) : (
            <>
              <div className="flex flex-col items-center justify-center text-center space-y-4">
                 <div className="w-20 h-20 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mb-2">
                    <ShieldAlert size={40} />
                 </div>
                 <p className="font-serif text-[14px] text-cursor-dark leading-relaxed">
                   Bạn muốn xóa tài khoản? 
                 </p>
                 <p className="font-serif text-[13px] text-cursor-dark/60 leading-relaxed px-4">
                   Cụ thể là khi bạn ấn xác nhận tài khoản của bạn sẽ bị lock trong vòng <span className="font-bold text-cursor-dark">30 ngày</span>, sau 30 ngày tài khoản của bạn sẽ bị xóa vĩnh viễn.
                 </p>
              </div>

              {error && (
                <div className="p-4 bg-red-500/10 text-red-500 rounded-2xl text-[12px] font-serif font-bold text-center border border-red-500/20">
                  {error}
                </div>
              )}

              <div className="flex space-x-4 pt-4">
                <button
                  onClick={onClose}
                  disabled={loading}
                  className="flex-1 py-4 bg-white border border-cursor-dark/10 text-cursor-dark rounded-2xl font-serif font-black uppercase tracking-[0.2em] text-[11px] shadow-sm hover:bg-surface-300 active:scale-95 transition-all disabled:opacity-50"
                >
                  Hủy
                </button>
                <button
                  onClick={handleDelete}
                  disabled={loading}
                  className="flex-1 py-4 bg-red-500 text-white rounded-2xl font-serif font-black uppercase tracking-[0.2em] text-[11px] shadow-xl hover:bg-red-600 active:scale-95 transition-all disabled:opacity-50"
                >
                  {loading ? 'Đang xử lý...' : 'Xác nhận xóa'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default DeleteAccountModal;
