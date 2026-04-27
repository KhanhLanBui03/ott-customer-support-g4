import React, { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Video, VideoOff, PhoneOff } from 'lucide-react';

const VideoCall = ({
                     status,
                     localStream,
                     remoteStream,
                     onHangup,
                     onAccept,
                     callerName,
                     callerAvatar,
                     duration,
                   }) => {
  const localRef = useRef(null);
  const remoteRef = useRef(null);

  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);

  // =========================
  // 🎥 LOCAL VIDEO (fallback getUserMedia nếu chưa có stream)
  // =========================
  useEffect(() => {
    const video = localRef.current;
    if (!video) return;

    let stream = localStream;

    const setup = async () => {
      try {
        if (!stream) {
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true,
          });
        }

        video.srcObject = stream;
        video.muted = true;
        video.playsInline = true;

        await video.play().catch(() => {});
      } catch (err) {
        console.error("❌ Local video error:", err);
      }
    };

    setup();

    return () => {
      if (!localStream && stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
      if (video) video.srcObject = null;
    };
  }, [localStream]);

  // =========================
  // 🎥 REMOTE VIDEO
  // =========================
  useEffect(() => {
    const video = remoteRef.current;
    if (!video) return;

    if (remoteStream) {
      video.srcObject = remoteStream;
      video.playsInline = true;

      video.play().catch((err) => {
        console.warn("Remote play failed:", err);
      });
    } else {
      video.srcObject = null;
    }

    return () => {
      if (video) video.srcObject = null;
    };
  }, [remoteStream]);

  // =========================
  // 🎤 MIC
  // =========================
  const toggleMic = () => {
    if (!localStream) return;
    localStream.getAudioTracks().forEach(t => (t.enabled = !micOn));
    setMicOn(!micOn);
  };

  // =========================
  // 📷 CAM
  // =========================
  const toggleCam = () => {
    if (!localStream) return;
    localStream.getVideoTracks().forEach(t => (t.enabled = !camOn));
    setCamOn(!camOn);
  };

  if (status === 'idle') return null;

  return (
      <div className="fixed inset-0 z-[9999] bg-black flex flex-col">

        {/* ================= REMOTE VIDEO ================= */}
        <div className="relative flex-1 w-full h-full overflow-hidden">

          <video
              ref={remoteRef}
              autoPlay
              playsInline
              className="absolute inset-0 w-full h-full object-cover"
          />

          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent pointer-events-none" />

          {/* HEADER */}
          <div className="absolute top-6 left-1/2 -translate-x-1/2 text-center text-white z-20">
            <div className="flex items-center gap-2 justify-center">
              <div className="w-9 h-9 rounded-full overflow-hidden border border-white/20">
                {callerAvatar ? (
                    <img src={callerAvatar} className="w-full h-full object-cover" alt="" />
                ) : (
                    <div className="w-full h-full bg-gray-600 flex items-center justify-center text-sm">
                      {callerName?.charAt(0) || '?'}
                    </div>
                )}
              </div>
              <span className="font-semibold">
              {callerName && callerName.length < 30 ? callerName : 'Người dùng'}
            </span>
            </div>
            <div className="text-sm opacity-80 mt-1">
              {status === 'incoming' && 'Cuộc gọi đến'}
              {status === 'outgoing' && 'Đang gọi...'}
              {status === 'connected' && duration}
            </div>
          </div>

          {/* Overlay khi chưa có remote */}
          {!remoteStream && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-white z-10">
                <div className="relative">
                  <div className="absolute inset-0 rounded-full bg-green-400/20 blur-xl animate-pulse" />
                  <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-white/10 relative z-10">
                    {callerAvatar ? (
                        <img src={callerAvatar} className="w-full h-full object-cover" alt="" />
                    ) : (
                        <div className="w-full h-full bg-gray-700 flex items-center justify-center text-3xl">
                          {callerName?.charAt(0) || '?'}
                        </div>
                    )}
                  </div>
                </div>
                <div className="mt-4 text-lg font-semibold">
                  {callerName || 'Người dùng'}
                </div>
                <div className="text-sm opacity-70">
                  {status === 'incoming' ? 'Cuộc gọi đến...' : 'Đang kết nối...'}
                </div>
              </div>
          )}

          {/* ================= LOCAL VIDEO ================= */}
          <div className="absolute top-4 right-4 w-40 h-56 rounded-2xl overflow-hidden border border-white/20 shadow-2xl bg-black z-30">
            <video
                ref={localRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover transition-opacity ${
                    camOn ? 'opacity-100' : 'opacity-0'
                }`}
            />

            {!camOn && (
                <div className="absolute inset-0 flex items-center justify-center bg-[#0d0f1a]">
                  <VideoOff className="text-white/30" size={28} />
                </div>
            )}

            {!micOn && (
                <div className="absolute bottom-2 left-2 bg-red-500/90 rounded-full p-1 shadow-md">
                  <MicOff size={12} className="text-white" />
                </div>
            )}
          </div>
        </div>

        {/* ================= CONTROLS ================= */}
        <div className="h-28 flex items-center justify-center">
          <div className="flex gap-5 bg-black/60 backdrop-blur-xl px-6 py-3 rounded-full shadow-2xl border border-white/10">

            {status === 'incoming' ? (
                <>
                  <button
                      onClick={onHangup}
                      className="bg-red-500 hover:bg-red-600 p-4 rounded-full transition active:scale-95"
                  >
                    <PhoneOff />
                  </button>
                  <button
                      onClick={onAccept}
                      className="bg-green-500 hover:bg-green-600 p-4 rounded-full transition active:scale-95"
                  >
                    📞
                  </button>
                </>
            ) : (
                <>
                  <button
                      onClick={toggleMic}
                      className={`p-4 rounded-full transition active:scale-95 ${
                          micOn ? 'bg-white/20' : 'bg-red-500'
                      }`}
                  >
                    {micOn ? <Mic /> : <MicOff />}
                  </button>
                  <button
                      onClick={toggleCam}
                      className={`p-4 rounded-full transition active:scale-95 ${
                          camOn ? 'bg-white/20' : 'bg-red-500'
                      }`}
                  >
                    {camOn ? <Video /> : <VideoOff />}
                  </button>
                  <button
                      onClick={onHangup}
                      className="bg-red-500 hover:bg-red-600 p-4 rounded-full transition active:scale-95"
                  >
                    <PhoneOff />
                  </button>
                </>
            )}
          </div>
        </div>
      </div>
  );
};

export default VideoCall;