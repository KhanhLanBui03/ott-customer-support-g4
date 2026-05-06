import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, Download, Share2, RotateCw, ZoomIn, ZoomOut, 
  ChevronLeft, ChevronRight, Maximize2, User, Clock,
  PlayCircle
} from 'lucide-react';

const getFullUrl = (url) => {
  if (!url || typeof url !== 'string') return url;
  const trimmedUrl = url.trim();
  if (trimmedUrl.startsWith('http') || trimmedUrl.startsWith('blob:') || trimmedUrl.startsWith('data:')) return trimmedUrl;

  const baseUrl = (window.CONFIG?.API_URL || import.meta.env.VITE_API_URL || '').split('/api')[0] || `http://${window.location.hostname}:8080`;
  return `${baseUrl}${trimmedUrl.startsWith('/') ? '' : '/'}${trimmedUrl}`;
};

const MediaLightbox = ({ isOpen, onClose, images = [], currentIndex = 0, onIndexChange }) => {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [showSidebar, setShowSidebar] = useState(true);

  const currentImage = images[currentIndex] || {};

  useEffect(() => {
    if (isOpen) {
      setZoom(1);
      setRotation(0);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen, currentIndex]);

  if (!isOpen) return null;

  const handlePrev = (e) => {
    e.stopPropagation();
    if (currentIndex > 0) onIndexChange(currentIndex - 1);
  };

  const handleNext = (e) => {
    e.stopPropagation();
    if (currentIndex < images.length - 1) onIndexChange(currentIndex + 1);
  };

  const handleRotate = (e) => {
    e.stopPropagation();
    setRotation(prev => (prev + 90) % 360);
  };

  const handleZoomIn = (e) => {
    e.stopPropagation();
    setZoom(prev => Math.min(prev + 0.5, 3));
  };

  const handleZoomOut = (e) => {
    e.stopPropagation();
    setZoom(prev => Math.max(prev - 0.5, 0.5));
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' Hôm nay';
    } catch (e) { return ''; }
  };

  return (
    <div className="fixed inset-0 z-[10000] bg-black/95 backdrop-blur-2xl flex flex-col text-white animate-in fade-in duration-300 overflow-hidden select-none">
      {/* Header */}
      <div className="h-16 flex items-center justify-between px-6 bg-gradient-to-b from-black/60 to-transparent z-50">
        <div className="flex items-center space-x-4">
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-all">
            <X size={24} />
          </button>
          <div className="h-6 w-px bg-white/10 hidden sm:block" />
          <h3 className="text-sm font-bold opacity-80 hidden sm:block">
             {currentIndex + 1} / {images.length}
          </h3>
        </div>

        <div className="flex items-center space-x-2 sm:space-x-4">
          <button onClick={handleZoomOut} className="p-2 hover:bg-white/10 rounded-xl transition-all">
            <ZoomOut size={20} />
          </button>
          <button onClick={handleZoomIn} className="p-2 hover:bg-white/10 rounded-xl transition-all">
            <ZoomIn size={20} />
          </button>
          <button onClick={handleRotate} className="p-2 hover:bg-white/10 rounded-xl transition-all">
            <RotateCw size={20} />
          </button>
          <div className="h-6 w-px bg-white/10 mx-2" />
          <button 
            onClick={() => window.open(getFullUrl(currentImage.url), '_blank')}
            className="flex items-center space-x-2 px-4 py-2 bg-white/10 hover:bg-indigo-600 rounded-xl transition-all font-bold text-xs"
          >
            <Download size={16} />
            <span className="hidden sm:inline">Tải về</span>
          </button>
          <button onClick={() => setShowSidebar(!showSidebar)} className="p-2 hover:bg-white/10 rounded-xl transition-all">
            <Maximize2 size={20} className={showSidebar ? 'rotate-180 opacity-50' : ''} />
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden relative">
        {/* Main Content */}
        <div className="flex-1 flex items-center justify-center relative p-4 sm:p-20 overflow-hidden">
          {/* Navigation */}
          {currentIndex > 0 && (
            <button 
              onClick={handlePrev}
              className="absolute left-6 z-50 w-14 h-14 flex items-center justify-center bg-black/20 hover:bg-black/40 border border-white/5 rounded-full transition-all group active:scale-95"
            >
              <ChevronLeft size={32} className="group-hover:-translate-x-1 transition-transform" />
            </button>
          )}
          {currentIndex < images.length - 1 && (
            <button 
              onClick={handleNext}
              className="absolute right-6 z-50 w-14 h-14 flex items-center justify-center bg-black/20 hover:bg-black/40 border border-white/5 rounded-full transition-all group active:scale-95"
            >
              <ChevronRight size={32} className="group-hover:translate-x-1 transition-transform" />
            </button>
          )}

          {/* Image/Video Canvas */}
          <div className="relative w-full h-full flex items-center justify-center transition-all duration-500">
             {currentImage.type === 'VIDEO' ? (
               <video 
                 src={getFullUrl(currentImage.url)} 
                 controls 
                 autoPlay
                 className="max-w-full max-h-full shadow-2xl"
                 style={{ 
                   transform: `scale(${zoom}) rotate(${rotation}deg)`,
                   filter: 'drop-shadow(0 20px 50px rgba(0,0,0,0.5))'
                 }}
               />
             ) : (
               <img 
                 src={getFullUrl(currentImage.url)} 
                 alt="" 
                 className="max-w-full max-h-full object-contain shadow-2xl transition-transform duration-300"
                 style={{ 
                   transform: `scale(${zoom}) rotate(${rotation}deg)`,
                   filter: 'drop-shadow(0 20px 50px rgba(0,0,0,0.5))'
                 }}
               />
             )}
          </div>

          {/* Footer Info Overlay */}
          <div className="absolute bottom-10 left-10 z-50 animate-in slide-in-from-bottom-10 duration-500">
            <div className="flex items-center space-x-4 bg-black/40 backdrop-blur-xl border border-white/10 p-4 rounded-3xl shadow-2xl">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                <User size={24} className="text-white" />
              </div>
              <div className="flex flex-col pr-4">
                <h4 className="text-base font-black text-white/90 leading-tight">
                   {currentImage.senderName || 'Người dùng'}
                </h4>
                <div className="flex items-center space-x-2 text-white/40 mt-1">
                   <Clock size={12} />
                   <span className="text-[10px] font-bold uppercase tracking-widest">
                     {formatTime(currentImage.createdAt)}
                   </span>
                </div>
              </div>
              <div className="h-8 w-px bg-white/10" />
              <button className="p-3 hover:bg-white/10 rounded-2xl transition-all group">
                <Share2 size={20} className="group-hover:text-indigo-400" />
              </button>
            </div>
          </div>
        </div>

        {/* Sidebar Thumbnails */}
        {showSidebar && (
          <div className="w-80 border-l border-white/10 bg-black/40 backdrop-blur-xl flex flex-col animate-in slide-in-from-right duration-500">
            <div className="p-6 border-b border-white/5">
              <h4 className="text-xs font-black uppercase tracking-[0.2em] text-white/30">Bộ sưu tập media</h4>
              <p className="text-[10px] font-bold text-indigo-500 mt-1 uppercase">Toàn bộ kho lưu trữ hội thoại</p>
            </div>
            <div className="flex-1 overflow-y-auto no-scrollbar">
              <div className="p-4 grid grid-cols-2 gap-3 content-start">
                {images.map((img, idx) => (
                  <div 
                    key={idx}
                    onClick={() => onIndexChange(idx)}
                    className={`
                      aspect-square rounded-2xl overflow-hidden cursor-pointer transition-all relative group
                      ${currentIndex === idx ? 'ring-4 ring-indigo-500 scale-95 shadow-lg opacity-100' : 'opacity-40 hover:opacity-100 hover:scale-[1.02]'}
                    `}
                    style={{ aspectRatio: '1/1' }}
                  >
                    {img.type === 'VIDEO' ? (
                      <div className="w-full h-full bg-slate-900 flex items-center justify-center">
                        <PlayCircle size={32} className="text-white/50 group-hover:text-white transition-colors" />
                      </div>
                    ) : (
                      <img src={getFullUrl(img.url)} alt="" className="w-full h-full object-cover block" />
                    )}
                    {currentIndex === idx && (
                      <div className="absolute inset-0 bg-indigo-500/10 flex items-center justify-center">
                         <Maximize2 size={20} className="text-white animate-pulse" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="p-6 border-t border-white/5 bg-black/20">
               <button 
                 onClick={() => window.open(getFullUrl(currentImage.url), '_blank')}
                 className="w-full py-4 bg-white text-black rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-500 hover:text-white transition-all shadow-xl active:scale-95"
               >
                 Tải ảnh chất lượng cao
               </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MediaLightbox;
