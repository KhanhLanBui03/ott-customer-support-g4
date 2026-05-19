import React, { useState, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Shield, RefreshCw, Smartphone, CheckCircle, ArrowLeft } from 'lucide-react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { setCredentials } from '../../store/authSlice';
import { setAuthPersist } from '../../utils/storage';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1';

const QrLogin = ({ onBack }) => {
  const [token, setToken] = useState(null);
  const [status, setStatus] = useState('LOADING'); // LOADING, PENDING, SCANNED, EXPIRED, CONFIRMED
  const [timeLeft, setTimeLeft] = useState(60);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const dispatch = useDispatch();
  
  const pollingRef = useRef(null);
  const timerRef = useRef(null);

  const generateToken = async () => {
    try {
      setStatus('LOADING');
      setError(null);
      const response = await axios.post(`${API_URL}/auth/qr/generate`);
      const { data } = response.data;
      
      setToken(data.token);
      setTimeLeft(60); // 60 seconds
      setStatus('PENDING');
      
      startPolling(data.token);
      startTimer();
    } catch (err) {
      console.error('Error generating QR token:', err);
      setError('Không thể tạo mã QR. Vui lòng thử lại.');
      setStatus('EXPIRED');
    }
  };

  const startTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          setStatus((currentStatus) => {
            if (currentStatus === 'PENDING' || currentStatus === 'SCANNED') {
              stopPolling();
              return 'EXPIRED';
            }
            return currentStatus;
          });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const startPolling = (currentToken) => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    
    pollingRef.current = setInterval(async () => {
      try {
        const response = await axios.get(`${API_URL}/auth/qr/status/${currentToken}`);
        const { data } = response.data;
        
        if (data.status === 'SCANNED' && status !== 'SCANNED') {
          setStatus('SCANNED');
        } else if (data.status === 'CONFIRMED') {
          stopPolling();
          if (timerRef.current) clearInterval(timerRef.current);
          setStatus('CONFIRMED');
          
          // Log user in
          handleLoginSuccess(data.loginData);
        } else if (data.status === 'CANCELED') {
          stopPolling();
          if (timerRef.current) clearInterval(timerRef.current);
          setError('Đăng nhập bị từ chối từ điện thoại.');
          setStatus('EXPIRED');
        }
      } catch (err) {
        // If 400/404, it might be expired
        if (err.response?.status === 400 || err.response?.status === 404) {
          stopPolling();
          if (timerRef.current) clearInterval(timerRef.current);
          setStatus('EXPIRED');
        }
      }
    }, 2000); // Poll every 2 seconds
  };

  const stopPolling = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  };

  const handleLoginSuccess = (loginData) => {
    // Store tokens
    localStorage.setItem('accessToken', loginData.accessToken);
    localStorage.setItem('refreshToken', loginData.refreshToken);
    setAuthPersist(true); // Default to remember me for QR login
    
    // Dispatch to Redux
    dispatch(setCredentials({
      user: {
        id: loginData.userId,
        phoneNumber: loginData.phoneNumber,
        firstName: loginData.firstName,
        lastName: loginData.lastName,
        fullName: [loginData.lastName, loginData.firstName].filter(Boolean).join(' ').trim() || loginData.phoneNumber,
        avatar: loginData.avatarUrl,
        bio: loginData.bio,
        email: loginData.email
      },
      token: loginData.accessToken,
      refreshToken: loginData.refreshToken,
      sessionId: loginData.sessionId,
      rememberMe: true
    }));
    
    setTimeout(() => {
      navigate('/');
    }, 1500);
  };

  useEffect(() => {
    generateToken();
    
    return () => {
      stopPolling();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  return (
    <div className="flex flex-col items-center space-y-6 w-full animate-fade-in">
      <div className="flex items-center w-full mb-2">
        <button 
          onClick={onBack}
          className="p-2 text-white/50 hover:text-white bg-white/5 rounded-full transition-all"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1 text-center pr-9">
          <h3 className="text-xl font-bold text-white">Đăng nhập bằng mã QR</h3>
        </div>
      </div>
      
      <div className="bg-white p-4 rounded-3xl shadow-xl relative overflow-hidden">
        {/* Blur overlay for expired state */}
        {status === 'EXPIRED' && (
          <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-10 flex flex-col items-center justify-center p-4">
            <RefreshCw size={32} className="text-cursor-dark mb-4 opacity-50" />
            <p className="text-cursor-dark font-bold text-center mb-4 text-sm">
              Mã QR đã hết hạn
            </p>
            <button 
              onClick={generateToken}
              className="px-6 py-2 bg-cursor-accent text-cursor-dark font-bold rounded-full hover:scale-105 transition-transform flex items-center gap-2"
            >
              <RefreshCw size={16} />
              Tạo mã mới
            </button>
          </div>
        )}
        
        {/* Success overlay */}
        {status === 'CONFIRMED' && (
          <div className="absolute inset-0 bg-white/90 backdrop-blur-sm z-10 flex flex-col items-center justify-center">
            <CheckCircle size={64} className="text-green-500 mb-4 animate-bounce" />
            <p className="text-cursor-dark font-bold text-lg">Đăng nhập thành công!</p>
          </div>
        )}

        {/* QR Code */}
        <div className={`transition-all duration-300 ${status === 'SCANNED' ? 'opacity-30' : 'opacity-100'}`}>
          {token ? (
            <QRCodeSVG 
              value={token} 
              size={220} 
              level="H"
              includeMargin={true}
              bgColor="#ffffff"
              fgColor="#1a1a1a"
            />
          ) : (
            <div className="w-[220px] h-[220px] flex items-center justify-center bg-gray-100 rounded-xl">
              <RefreshCw size={32} className="animate-spin text-gray-400" />
            </div>
          )}
        </div>
        
        {/* Scanned state overlay */}
        {status === 'SCANNED' && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center pt-8">
            <div className="bg-cursor-dark p-4 rounded-full mb-3 shadow-lg animate-pulse">
              <Smartphone size={32} className="text-cursor-accent" />
            </div>
            <p className="text-cursor-dark font-black text-center text-sm px-4 leading-tight">
              Đã quét thành công.<br/>Vui lòng xác nhận trên điện thoại.
            </p>
          </div>
        )}
      </div>

      <div className="text-center space-y-4 w-full">
        <div className="flex items-center justify-center gap-2 text-white/70 text-sm font-medium">
          <Shield size={16} className="text-cursor-accent" />
          {status === 'EXPIRED' ? (
            <span className="text-red-400">Mã đã hết hạn</span>
          ) : (
            <span>Mã sẽ hết hạn trong <span className="text-cursor-accent font-bold font-mono text-lg">{timeLeft}</span>s</span>
          )}
        </div>
        
        {error && (
          <div className="text-red-400 text-sm font-medium bg-red-500/10 py-2 px-4 rounded-xl">
            {error}
          </div>
        )}

        <div className="bg-white/5 rounded-2xl p-4 text-left">
          <h4 className="text-white font-bold mb-2 text-sm flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-cursor-accent text-cursor-dark flex items-center justify-center text-xs">1</div>
            Mở ứng dụng trên điện thoại
          </h4>
          <h4 className="text-white font-bold mb-2 text-sm flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-cursor-accent text-cursor-dark flex items-center justify-center text-xs">2</div>
            Chọn biểu tượng quét mã QR
          </h4>
          <h4 className="text-white font-bold text-sm flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-cursor-accent text-cursor-dark flex items-center justify-center text-xs">3</div>
            Hướng camera vào mã này
          </h4>
        </div>
      </div>
    </div>
  );
};

export default QrLogin;
