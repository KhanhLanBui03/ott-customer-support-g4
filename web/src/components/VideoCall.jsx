import React, { useEffect, useRef } from 'react';
import { Phone, PhoneOff, Mic, MicOff, Video as VideoIcon, VideoOff, Maximize2 } from 'lucide-react';

const VideoCall = ({ status, duration, localStream, remoteStream, onHangup, isIncoming, onAccept }) => {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  if (status === 'idle') return null;

  if (status === 'incoming') {
    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center bg-cursor-dark/95 backdrop-blur-2xl animate-fade-in">
        <div className="flex flex-col items-center space-y-12">
          <div className="relative">
            <div className="absolute inset-0 bg-cursor-accent/20 blur-3xl rounded-full scale-150 animate-pulse" />
            <div className="relative w-32 h-32 rounded-[40px] bg-white/10 border border-white/10 flex items-center justify-center p-1 shadow-2xl">
               <div className="w-full h-full rounded-[36px] bg-cursor-dark flex items-center justify-center text-cursor-accent">
                 <VideoIcon size={48} />
               </div>
            </div>
          </div>
          
          <div className="text-center space-y-4">
            <h2 className="text-3xl font-serif italic font-black text-white tracking-tighter">Incoming Signal</h2>
            <p className="text-[10px] font-mono font-black text-white/30 uppercase tracking-[0.5em] animate-pulse">Establishing Peer Connection...</p>
          </div>

          <div className="flex items-center space-x-8">
            <button 
              onClick={onHangup}
              className="p-6 bg-red-500 text-white rounded-[32px] hover:scale-110 active:scale-95 transition-all shadow-xl shadow-red-500/20"
            >
              <PhoneOff size={32} />
            </button>
            <button 
              onClick={onAccept}
              className="p-6 bg-green-500 text-white rounded-[32px] hover:scale-110 active:scale-95 transition-all shadow-xl shadow-green-500/20 animate-bounce"
            >
              <Phone size={32} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[200] bg-cursor-dark animate-fade-in flex flex-col">
      {/* Remote Video (Full Screen) */}
      <div className="relative flex-1 bg-black overflow-hidden flex items-center justify-center">
        {remoteStream ? (
          <video 
            ref={remoteVideoRef} 
            autoPlay 
            playsInline 
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="flex flex-col items-center space-y-4">
            <div className="w-24 h-24 rounded-full bg-white/5 flex items-center justify-center animate-pulse">
              <VideoIcon className="text-white/20" size={48} />
            </div>
            <p className="font-mono text-[10px] text-white/20 uppercase tracking-[0.3em]">Waiting for stream...</p>
          </div>
        )}

        {/* Local Video (Picture-in-Picture) */}
        <div className="absolute top-8 right-8 w-48 h-72 rounded-[32px] overflow-hidden border-2 border-white/10 shadow-2xl bg-cursor-dark/80 backdrop-blur-md">
           <video 
            ref={localVideoRef} 
            autoPlay 
            playsInline 
            muted 
            className="w-full h-full object-cover mirror"
          />
        </div>

        {/* Status Overlay */}
        <div className="absolute top-8 left-8 flex flex-col space-y-2">
           <div className="px-4 py-2 bg-black/40 backdrop-blur-md rounded-2xl border border-white/5 flex items-center space-x-3">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-[10px] font-mono font-black text-white uppercase tracking-widest leading-none">Live</span>
              <span className="w-[1px] h-3 bg-white/20" />
              <span className="text-[12px] font-mono font-black text-white leading-none">{duration}</span>
           </div>
        </div>
      </div>

      {/* Controls Bar */}
      <div className="h-32 bg-gradient-to-t from-black/80 to-transparent flex items-center justify-center px-12 relative">
        <div className="flex items-center space-x-6">
          <button className="p-4 bg-white/10 text-white hover:bg-white/20 rounded-2xl transition-all">
            <Mic size={24} />
          </button>
          <button className="p-4 bg-white/10 text-white hover:bg-white/20 rounded-2xl transition-all">
            <VideoIcon size={24} />
          </button>
          
          <button 
            onClick={onHangup}
            className="p-6 bg-red-500 text-white rounded-[32px] hover:scale-110 active:scale-95 transition-all shadow-xl shadow-red-500/20 mx-4"
          >
            <PhoneOff size={32} />
          </button>

          <button className="p-4 bg-white/10 text-white hover:bg-white/20 rounded-2xl transition-all">
            <Maximize2 size={24} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default VideoCall;
