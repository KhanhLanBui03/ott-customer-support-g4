import React, { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Video, VideoOff, PhoneOff, Phone } from 'lucide-react';

/**
 * VideoCall — Giao diện video call premium (FaceTime / WhatsApp style)
 *
 * Props:
 *  status          : 'idle' | 'outgoing' | 'incoming' | 'connected' | 'ended'
 *  localVideoTrack : Agora ILocalVideoTrack
 *  localAudioTrack : Agora ILocalAudioTrack
 *  remoteVideoTrack: Agora IRemoteVideoTrack
 *  remoteName      : tên người ở đầu dây bên kia
 *  remoteAvatar    : avatar người ở đầu dây bên kia
 *  duration        : chuỗi thời gian (hh:mm)
 *  onHangup        : () => void
 *  onAccept        : () => void
 *  onToggleMic     : (enabled: boolean) => void
 *  onToggleCamera  : (enabled: boolean) => void
 */
// ─── Avatar component ────────────────────────────────────────────────────
const Avatar = ({ size = 'w-28 h-28', ring = true, pulse = false, url, nameInitial }) => (
    <div className={`relative ${size}`}>
        {pulse && (
            <>
                <div className="absolute inset-0 rounded-full bg-white/10 animate-ping" />
                <div className="absolute -inset-3 rounded-full bg-white/5 animate-pulse" />
            </>
        )}
        <div className={`${size} rounded-full overflow-hidden ${ring ? 'ring-4 ring-white/30 shadow-2xl' : ''} relative z-10`}>
            {url ? (
                <img 
                    src={url} 
                    alt="" 
                    className="w-full h-full object-cover" 
                    style={{ 
                        imageRendering: 'high-quality', 
                        WebkitImageRendering: 'optimize-contrast',
                        objectFit: 'cover',
                        backfaceVisibility: 'hidden' 
                    }} 
                />
            ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-bold text-4xl">
                    {nameInitial}
                </div>
            )}
        </div>
    </div>
);

// ─── Unlock Audio Overlay ────────────────────────────────────────────────
const AudioUnlockOverlay = ({ onUnlock }) => (
    <div className="absolute inset-0 z-[100] flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm">
        <div className="bg-white/10 p-8 rounded-3xl border border-white/20 items-center flex flex-col">
            <div className="w-20 h-20 bg-indigo-500 rounded-full flex items-center justify-center mb-6 animate-bounce">
                <Mic className="text-white w-10 h-10" />
            </div>
            <h3 className="text-white text-xl font-bold mb-2">Âm thanh đã sẵn sàng</h3>
            <p className="text-white/60 mb-6 text-center max-w-[200px]">Nhấn vào nút bên dưới để bắt đầu nghe</p>
            <button 
                onClick={onUnlock}
                className="bg-indigo-500 hover:bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold transition-all transform active:scale-95"
            >
                Bật âm thanh
            </button>
        </div>
    </div>
);

// ─── Remote Video Player Component ───────────────────────────────────────
const RemoteVideoPlayer = ({ stream, isAudioCall, fullscreen = false, status }) => {
    const ref = useRef(null);
    
    // Chỉ chạy play một lần khi videoTrack thay đổi
    useEffect(() => {
        if (!stream.videoTrack || !ref.current) return;
        stream.videoTrack.play(ref.current);
    }, [stream.videoTrack]);

    const roundedClass = fullscreen ? '' : 'rounded-2xl border border-white/10 shadow-xl';
    const avatarUrl = stream.avatar;
    const initial = stream.name?.[0]?.toUpperCase();

    return (
        <div className={`relative w-full h-full bg-[#111] overflow-hidden ${roundedClass}`}>
            <div ref={ref} className="w-full h-full" />
            {(!stream.videoTrack || isAudioCall) && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-indigo-900 to-slate-900">
                    <Avatar size={fullscreen ? "w-28 h-28" : "w-16 h-16"} pulse={false} url={avatarUrl} nameInitial={initial} />
                    {fullscreen && (
                        <>
                            <h2 className="mt-5 text-2xl font-bold text-white">{stream.name || 'Người dùng'}</h2>
                            {status !== 'connected' && (
                                <p className="text-white/40 text-sm mt-2 animate-pulse">
                                    {isAudioCall ? 'Đang gọi thoại...' : 'Đang kết nối video...'}
                                </p>
                            )}
                        </>
                    )}
                </div>
            )}
            <div className="absolute bottom-3 left-3 px-3 py-1 bg-black/60 backdrop-blur-md rounded-lg flex items-center gap-2 z-10">
                <span className="text-white text-xs font-medium truncate max-w-[100px]">{stream.name || 'Người dùng'}</span>
            </div>
        </div>
    );
};

const VideoCall = ({
    status,
    localVideoTrack,
    localAudioTrack,
    remoteStreams = [],
    remoteName,
    remoteAvatar,
    duration,
    onHangup,
    onAccept,
    onToggleMic,
    onToggleCamera,
    callType = 'video',
    cameraError = null,
    audioBlocked = false,
    onResumeAudio,
}) => {
    const localRef  = useRef(null);
    const remoteRef = useRef(null);

    const [micOn, setMicOn]   = useState(true);
    const [camOn, setCamOn]   = useState(true);

    // ─── Play local video ────────────────────────────────────────────────────
    useEffect(() => {
        if (!localVideoTrack || !localRef.current) return;
        localVideoTrack.play(localRef.current);
    }, [localVideoTrack, status]);

    const toggleMic = () => {
        const next = !micOn;
        setMicOn(next);
        if (onToggleMic) onToggleMic(next);
        else localAudioTrack?.setEnabled(next);
    };

    const toggleCam = () => {
        const next = !camOn;
        setCamOn(next);
        if (onToggleCamera) onToggleCamera(next);
        else localVideoTrack?.setEnabled(next);
    };

    if (status === 'idle') return null;

    // ─── Xác định tên + avatar hiển thị tùy trạng thái ─────────────────────
    const isOutgoing  = status === 'outgoing';
    const isIncoming  = status === 'incoming';
    const isConnected = status === 'connected' || status === 'ended';

    const displayName   = remoteName;
    const displayAvatar = remoteAvatar;
    const initial       = (displayName || 'N')[0]?.toUpperCase();

    // ─── Render Components ───────────────────────────────────────────────────

    return (
        <div className="fixed inset-0 z-[9999] flex flex-col" style={{ background: 'linear-gradient(135deg, #0f0c29, #302b63, #24243e)' }}>

            {/* ══════════════════════════════════════════════════════════════
                INCOMING — Màn hình cuộc gọi đến
            ══════════════════════════════════════════════════════════════ */}
            {isIncoming && (
                <div className="flex flex-col items-center justify-between h-full py-20 px-6">
                    {/* Top: Thông tin caller */}
                    <div className="flex flex-col items-center space-y-6 mt-8">
                        <p className="text-white/60 text-sm font-semibold uppercase tracking-widest animate-pulse">
                            {callType === 'audio' ? 'Cuộc gọi thoại đến...' : 'Cuộc gọi video đến...'}
                        </p>
                        <Avatar size="w-32 h-32" pulse url={displayAvatar} nameInitial={initial} />
                        <div className="text-center">
                            <h2 className="text-3xl font-bold text-white tracking-tight">{displayName || 'Người dùng'}</h2>
                            <p className="text-white/50 text-sm mt-1">Đang gọi cho bạn</p>
                        </div>
                    </div>

                    {/* Ripple animation */}
                    <div className="flex items-center justify-center relative pointer-events-none">
                        <div className="absolute w-48 h-48 rounded-full border border-white/10 animate-ping" style={{ animationDuration: '2s' }} />
                        <div className="absolute w-64 h-64 rounded-full border border-white/5 animate-ping" style={{ animationDuration: '2.5s' }} />
                        <div className="absolute w-80 h-80 rounded-full border border-white/5 animate-ping" style={{ animationDuration: '3s' }} />
                    </div>

                    {/* Bottom: Nút từ chối / Chấp nhận */}
                    <div className="flex items-center justify-center gap-20 pb-4">
                        {/* Từ chối */}
                        <div className="flex flex-col items-center gap-3">
                            <button
                                onClick={onHangup}
                                className="w-18 h-18 flex items-center justify-center rounded-full bg-red-500 hover:bg-red-400 active:scale-95 transition-all shadow-2xl shadow-red-500/50"
                                style={{ width: 72, height: 72 }}
                                title="Từ chối"
                            >
                                <PhoneOff size={28} className="text-white" />
                            </button>
                            <span className="text-white/60 text-xs font-medium">Từ chối</span>
                        </div>

                        {/* Chấp nhận */}
                        <div className="flex flex-col items-center gap-3">
                            <button
                                onClick={onAccept}
                                className="w-18 h-18 flex items-center justify-center rounded-full bg-green-500 hover:bg-green-400 active:scale-95 transition-all shadow-2xl shadow-green-500/50"
                                style={{ width: 72, height: 72 }}
                                title="Chấp nhận"
                            >
                                <Phone size={28} className="text-white" />
                            </button>
                            <span className="text-white/60 text-xs font-medium">Chấp nhận</span>
                        </div>
                    </div>
                </div>
            )}

            {/* ══════════════════════════════════════════════════════════════
                OUTGOING — Màn hình cuộc gọi đi
            ══════════════════════════════════════════════════════════════ */}
            {isOutgoing && (
                <div className="flex flex-col items-center justify-between h-full py-20 px-6">
                    {/* Top: Thông tin callee */}
                    <div className="flex flex-col items-center space-y-6 mt-8">
                        <p className="text-white/60 text-sm font-semibold uppercase tracking-widest">
                            Đang gọi...
                        </p>
                        <div className="relative">
                            <Avatar size="w-32 h-32" pulse url={displayAvatar} nameInitial={initial} />
                            
                            {/* 60s Countdown Circular Progress around the avatar */}
                            <svg className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150px] h-[150px] pointer-events-none" viewBox="0 0 100 100">
                                <circle className="text-white/10 stroke-current" strokeWidth="2.5" cx="50" cy="50" r="48" fill="transparent" />
                                <circle className="text-indigo-400 stroke-current drop-shadow-[0_0_8px_rgba(129,140,248,0.8)]" 
                                    strokeWidth="3" 
                                    strokeLinecap="round" 
                                    cx="50" cy="50" r="48" 
                                    fill="transparent" 
                                    strokeDasharray="301.59" 
                                    strokeDashoffset="0" 
                                    style={{ animation: 'countdown60 60s linear forwards', transform: 'rotate(-90deg)', transformOrigin: '50% 50%' }} 
                                />
                            </svg>
                            <style>{`
                                @keyframes countdown60 {
                                    from { stroke-dashoffset: 0; }
                                    to { stroke-dashoffset: 301.59; }
                                }
                            `}</style>
                        </div>
                        <div className="text-center">
                            <h2 className="text-3xl font-bold text-white tracking-tight">{displayName || 'Người dùng'}</h2>
                            <p className="text-white/50 text-sm mt-1 animate-pulse">Đang chờ phản hồi...</p>
                        </div>
                    </div>

                    {/* Ripple */}
                    <div className="flex items-center justify-center relative pointer-events-none mt-4">
                        <div className="absolute w-48 h-48 rounded-full border border-indigo-500/20 animate-ping" style={{ animationDuration: '2s' }} />
                        <div className="absolute w-64 h-64 rounded-full border border-indigo-500/10 animate-ping" style={{ animationDuration: '2.5s' }} />
                    </div>

                    {/* Local video preview nhỏ ở góc */}
                    {callType === 'video' && localVideoTrack && (
                        <div className="absolute top-6 right-6 w-28 h-36 rounded-2xl overflow-hidden border border-white/20 shadow-2xl bg-black">
                            <div ref={localRef} className={`w-full h-full ${camOn ? 'opacity-100' : 'opacity-0'}`} />
                            {!camOn && (
                                <div className="absolute inset-0 flex items-center justify-center bg-[#1a1a2e]">
                                    <VideoOff size={20} className="text-white/30" />
                                </div>
                            )}
                        </div>
                    )}

                    {/* Nút kết thúc */}
                    <div className="flex flex-col items-center gap-3 pb-4">
                        <button
                            onClick={onHangup}
                            className="w-18 h-18 flex items-center justify-center rounded-full bg-red-500 hover:bg-red-400 active:scale-95 transition-all shadow-2xl shadow-red-500/50"
                            style={{ width: 72, height: 72 }}
                            title="Kết thúc"
                        >
                            <PhoneOff size={28} className="text-white" />
                        </button>
                        <span className="text-white/60 text-xs font-medium">Kết thúc</span>
                    </div>
                </div>
            )}

            {/* ══════════════════════════════════════════════════════════════
                CONNECTED — Màn hình đang trong cuộc gọi
            ══════════════════════════════════════════════════════════════ */}
            {isConnected && (
                <div className="relative flex-1 w-full h-full flex flex-col">

                    {/* Grid Layout hoặc Fullscreen */}
                    {remoteStreams.length > 1 ? (
                        <div className="absolute inset-0 pt-24 pb-32 px-4 z-0">
                            <div className={`w-full h-full grid gap-4 ${
                                remoteStreams.length <= 2 ? 'grid-cols-1 sm:grid-cols-2' : 
                                remoteStreams.length <= 4 ? 'grid-cols-2' : 'grid-cols-3'
                            }`}>
                                {remoteStreams.map(stream => (
                                    <RemoteVideoPlayer key={stream.uid} stream={stream} isAudioCall={callType === 'audio'} />
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="absolute inset-0 bg-[#111] z-0">
                            {remoteStreams.length === 1 ? (
                                <RemoteVideoPlayer stream={remoteStreams[0]} isAudioCall={callType === 'audio'} fullscreen={true} status={status} />
                            ) : (
                                <div className="absolute inset-0 flex flex-col items-center justify-center"
                                    style={{ background: 'linear-gradient(135deg, #0f0c29, #302b63)' }}>
                                    <Avatar size="w-28 h-28" pulse={false} url={displayAvatar} nameInitial={initial} />
                                    <h2 className="mt-5 text-2xl font-bold text-white">{displayName || 'Đang đợi mọi người...'}</h2>
                                    {status !== 'connected' && (
                                        <p className="text-white/40 text-sm mt-2 animate-pulse">
                                            Đang kết nối...
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Gradient overlay bottom */}
                    <div className="absolute inset-x-0 bottom-0 h-48 pointer-events-none"
                        style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 100%)' }} />

                    {/* Gradient overlay top */}
                    <div className="absolute inset-x-0 top-0 h-32 pointer-events-none"
                        style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, transparent 100%)' }} />

                    {/* Header — tên + thời gian */}
                    <div className="relative z-10 flex items-center gap-3 px-5 pt-6 pb-2">
                        <div className="w-10 h-10 rounded-full overflow-hidden ring-2 ring-white/20 flex-shrink-0">
                            {displayAvatar ? (
                                <img 
                                    src={displayAvatar} 
                                    alt="" 
                                    className="w-full h-full object-cover" 
                                    style={{ imageRendering: '-webkit-optimize-contrast', backfaceVisibility: 'hidden' }}
                                />
                            ) : (
                                <div className="w-full h-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
                                    {initial}
                                </div>
                            )}
                        </div>
                        <div>
                            <p className="text-white font-semibold text-base leading-none">{displayName || 'Người dùng'}</p>
                            <p className="text-white/60 text-xs mt-0.5">{duration || '0:00'}</p>
                        </div>
                    </div>

                    {/* Camera Error Banner */}
                    {cameraError && (
                        <div className="relative z-10 mx-5 mt-2 p-3 bg-red-500/20 border border-red-500/50 rounded-xl backdrop-blur-md">
                            <p className="text-red-200 text-xs text-center font-medium">
                                Không thể mở Camera (có thể đang dùng bởi app khác). Cuộc gọi tiếp tục bằng âm thanh.
                            </p>
                        </div>
                    )}

                    {/* Local video — picture-in-picture */}
                    {callType === 'video' && (
                        <div className="absolute top-20 right-4 w-28 h-40 rounded-2xl overflow-hidden border border-white/20 shadow-2xl bg-black z-20">
                            <div ref={localRef} className={`w-full h-full transition-opacity ${camOn ? 'opacity-100' : 'opacity-0'}`} />
                        {!camOn && (
                            <div className="absolute inset-0 flex items-center justify-center bg-[#1a1a2e]">
                                <VideoOff size={22} className="text-white/30" />
                            </div>
                        )}
                        {!micOn && (
                            <div className="absolute bottom-2 left-2 bg-red-500/90 rounded-full p-1">
                                <MicOff size={10} className="text-white" />
                            </div>
                        )}
                        </div>
                    )}

                    {/* Controls */}
                    <div className="absolute bottom-0 inset-x-0 z-20 flex items-center justify-center pb-10 pt-6">
                        <div className="flex items-center gap-5 px-8 py-4 rounded-full"
                            style={{ background: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.12)' }}>

                            {/* Mic */}
                            <button
                                onClick={toggleMic}
                                className={`w-14 h-14 flex items-center justify-center rounded-full transition-all active:scale-95 ${micOn ? 'bg-white/20 hover:bg-white/30' : 'bg-red-500 hover:bg-red-400'}`}
                                title={micOn ? 'Tắt mic' : 'Bật mic'}
                            >
                                {micOn ? <Mic size={22} className="text-white" /> : <MicOff size={22} className="text-white" />}
                            </button>

                            {/* Camera */}
                            {callType === 'video' && (
                                <button
                                    onClick={toggleCam}
                                    className={`w-14 h-14 flex items-center justify-center rounded-full transition-all active:scale-95 ${camOn ? 'bg-white/20 hover:bg-white/30' : 'bg-red-500 hover:bg-red-400'}`}
                                    title={camOn ? 'Tắt camera' : 'Bật camera'}
                                >
                                    {camOn ? <Video size={22} className="text-white" /> : <VideoOff size={22} className="text-white" />}
                                </button>
                            )}

                            {/* End call */}
                            <button
                                onClick={onHangup}
                                className="w-16 h-16 flex items-center justify-center rounded-full bg-red-500 hover:bg-red-400 active:scale-95 transition-all shadow-2xl shadow-red-500/50"
                                title="Kết thúc"
                            >
                                <PhoneOff size={26} className="text-white" />
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default VideoCall;