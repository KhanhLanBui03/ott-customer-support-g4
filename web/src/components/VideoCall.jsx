import React, { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Video, VideoOff, PhoneOff, Phone, Volume2 } from 'lucide-react';
import { useSelector } from 'react-redux';

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
// ─── Utils ───────────────────────────────────────────────────────────────
const toNumericUid = (userId) => {
    if (!userId) return 0;
    if (typeof userId === 'number') return userId;
    let hash = 0;
    const s = String(userId);
    for (let i = 0; i < s.length; i++) {
        hash = ((hash << 5) - hash + s.charCodeAt(i)) | 0;
    }
    return Math.abs(hash);
};

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

const CountdownCircle = ({ duration, max = 30, size = 144, className = "-top-2 -left-2" }) => {
    const radius = (size / 2) - 6;
    const circumference = 2 * Math.PI * radius;
    // Tỉ lệ lấp đầy (từ 0 đến 1)
    const progress = Math.min(1, duration / max);
    const offset = circumference * (1 - progress);

    return (
        <div className={`absolute ${className} pointer-events-none z-20`}>
            <svg 
                width={size} 
                height={size}
                style={{ 
                    transform: 'rotate(-90deg) scaleY(-1)', 
                    transformOrigin: 'center' 
                }}
            >
                <defs>
                    <linearGradient id="countdown-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#818cf8" />
                        <stop offset="100%" stopColor="#6366f1" />
                    </linearGradient>
                </defs>
                {/* Background Track - Mờ hơn để làm nổi bật thanh progress */}
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke="rgba(255, 255, 255, 0.03)"
                    strokeWidth="4"
                    fill="transparent"
                />
                {/* Glowing Progress Ring - Chạy lấp đầy ngược chiều kim đồng hồ từ 12h */}
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke="url(#countdown-gradient)"
                    strokeWidth="6"
                    fill="transparent"
                    strokeDasharray={circumference}
                    style={{ 
                        strokeDashoffset: offset, 
                        transition: 'stroke-dashoffset 1s linear',
                        filter: 'drop-shadow(0 0 8px rgba(99, 102, 241, 0.6))'
                    }}
                    strokeLinecap="round"
                />
            </svg>
        </div>
    );
};

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
const RemoteVideoPlayer = ({ stream, isAudioCall, fullscreen = false, status, activeConversation, remoteName, remoteAvatar, isSpeaking, isGroup }) => {

    const ref = useRef(null);
    
    // Đảm bảo video luôn được phát lại khi component mount hoặc track/trạng thái thay đổi
    useEffect(() => {
        if (!stream.videoTrack || !ref.current) return;
        
        const playTrack = () => {
            if (stream.videoTrack && ref.current && stream.hasVideo) {
                console.log('[Agora] Playing remote track for:', stream.uid);
                stream.videoTrack.play(ref.current, { fit: 'contain' });
            }
        };

        playTrack();
        // Thêm một lần dự phòng sau 100ms để chắc chắn DOM đã render xong
        const timer = setTimeout(playTrack, 100);
        
        return () => {
            clearTimeout(timer);
        };
    }, [stream.videoTrack, stream.uid, stream.hasVideo, status]);

    const roundedClass = fullscreen ? '' : 'rounded-2xl border border-white/10 shadow-xl';
    
    // Tìm thông tin thành viên từ activeConversation
    const member = activeConversation?.members?.find(m => {
        const mid = String(m.userId || m.id || m._id);
        const webUid = toNumericUid(mid);
        const mobileUid = toNumericUid(mid + '_mobile');
        const incomingUid = Number(stream.uid);
        return webUid === incomingUid || mobileUid === incomingUid;
    });

    // CHỈ dùng remoteName làm fallback nếu là 1-1. Trong Group tuyệt đối không dùng remoteName (vì đó là tên nhóm)
    const isActuallyGroup = activeConversation?.isGroup || isGroup;
    const fallbackName = (!isActuallyGroup || status === 'incoming' || status === 'outgoing') ? remoteName : null;
    
    // Ưu tiên: Thành viên trong list > Tên từ signal (remoteName) > Tên mặc định
    const displayName = member?.fullName || member?.name || fallbackName || stream.name || 'Thành viên';
    const avatarUrl = member?.avatar || member?.avatarUrl || (!isActuallyGroup ? remoteAvatar : null) || stream.avatar;
    const initial = (displayName || 'T')[0]?.toUpperCase();


    const speakingBorder = isSpeaking ? 'ring-[6px] ring-green-500 ring-inset shadow-[0_0_30px_rgba(34,197,94,0.6)]' : '';

    return (
        <div className={`relative w-full h-full bg-[#111] overflow-hidden ${roundedClass} ${speakingBorder} transition-all duration-300 group`}>
            {/* Vùng hiển thị Video - Chỉ hiện khi thực sự có Video */}
            <div 
                ref={ref} 
                className="w-full h-full" 
                style={{ display: stream.hasVideo ? 'block' : 'none' }}
            />
            
            {/* Vùng hiển thị Avatar - Hiện khi tắt Cam */}
            {!stream.hasVideo && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-[#1e1e2e] to-[#0f0f1a]">
                    {/* Avatar lớn */}
                    <div className="relative">
                        <Avatar 
                            size={fullscreen ? "w-40 h-40" : "w-24 h-24"} 
                            pulse={stream.hasAudio || isSpeaking} 
                            url={avatarUrl} 
                            nameInitial={initial} 
                            ring={isSpeaking ? "ring-4 ring-green-500" : true}
                        />
                        {!stream.hasAudio && (
                            <div className="absolute bottom-2 right-2 bg-red-500 p-2 rounded-full border-4 border-[#1a1b2e] shadow-xl">
                                <MicOff size={fullscreen ? 20 : 14} className="text-white" />
                            </div>
                        )}
                    </div>

                    <div className="mt-6 flex flex-col items-center">
                        <h2 className={`font-bold text-white tracking-tight ${fullscreen ? 'text-3xl' : 'text-lg'}`}>
                            {displayName}
                        </h2>
                        <div className="mt-3 px-4 py-1.5 bg-indigo-500/10 rounded-full border border-indigo-500/20 backdrop-blur-md">
                            <p className="text-indigo-400 text-[10px] font-black uppercase tracking-[0.2em]">
                                {isAudioCall ? 'Đang gọi thoại...' : 'Đã tắt Camera'}
                            </p>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Nhãn tên nhỏ ở góc dưới */}
            <div className="absolute bottom-4 left-4 px-3 py-1.5 bg-black/60 backdrop-blur-xl rounded-xl flex items-center gap-2 border border-white/10 z-20 shadow-2xl transition-opacity group-hover:opacity-100">
                <div className={`w-2 h-2 rounded-full ${stream.hasAudio ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                <span className="text-white text-xs font-bold truncate max-w-[150px]">
                    {displayName}
                </span>
            </div>
        </div>
    );
};

// ─── Local Video Player Component ────────────────────────────────────────
const LocalVideoPlayer = ({ videoTrack, audioTrack, camOn, micOn, user, isMeSpeaking }) => {
    const ref = useRef(null);
    useEffect(() => {
        if (!videoTrack || !ref.current || !camOn) return;
        videoTrack.play(ref.current, { fit: 'contain' });
    }, [videoTrack, camOn]);

    const speakingBorder = isMeSpeaking ? 'ring-[6px] ring-green-500 ring-inset shadow-[0_0_30px_rgba(34,197,94,0.6)]' : '';
    const avatarUrl = user?.avatar || user?.avatarUrl;
    const initial = (user?.fullName || 'B')[0]?.toUpperCase();

    return (
        <div className={`relative w-full h-full bg-[#111] overflow-hidden rounded-2xl border transition-all duration-300 ${speakingBorder} ${isMeSpeaking ? '' : 'border-white/10'}`}>
            <div ref={ref} className="w-full h-full" style={{ display: camOn ? 'block' : 'none' }} />
            
            {!camOn && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-[#1e1e2e] to-[#0f0f1a]">
                    <Avatar 
                        size="w-24 h-24" 
                        pulse={isMeSpeaking} 
                        url={avatarUrl} 
                        nameInitial={initial} 
                        ring={isMeSpeaking ? "ring-4 ring-green-500" : true}
                    />
                    {!micOn && (
                        <div className="absolute bottom-2 right-2 bg-red-500 p-2 rounded-full border-4 border-[#1a1b2e] shadow-xl">
                            <MicOff size={14} className="text-white" />
                        </div>
                    )}
                </div>
            )}

            <div className="absolute bottom-4 left-4 px-3 py-1.5 bg-black/60 backdrop-blur-xl rounded-xl flex items-center gap-2 border border-white/10 z-20">
                <div className={`w-2 h-2 rounded-full ${micOn ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                <span className="text-white text-xs font-bold">Bạn</span>
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
    camOn: initialCamOn = true,
    micOn: initialMicOn = true,
    onHangup,
    onAccept,
    onToggleMic,
    onToggleCamera,
    callType = 'video',
    cameraError = null,
    audioBlocked = false,
    onResumeAudio,
    endCallReason = null,
    userLeftMsg = null,
    activeConversation = null,
    isGroup = false,
    ringDuration = 0,
    speakingUsers = {},
    onClose
}) => {
    const { user } = useSelector(state => state.auth);
    const localRef  = useRef(null);
    const remoteRef = useRef(null);

    const [micOn, setMicOn]   = useState(initialMicOn);
    const [camOn, setCamOn]   = useState(initialCamOn);

    // isGroup và activeConversation đã được lấy từ arguments bên trên


    // Đồng bộ state khi prop thay đổi từ bên ngoài (hook)
    useEffect(() => {
        setMicOn(initialMicOn);
    }, [initialMicOn]);

    useEffect(() => {
        setCamOn(initialCamOn);
    }, [initialCamOn]);

    // ─── Play local video ────────────────────────────────────────────────────
    useEffect(() => {
        if (!localVideoTrack || !localRef.current) return;
        
        const playLocal = () => {
            if (localVideoTrack && localRef.current && camOn) {
                console.log('[Agora] Playing local track on ref:', localRef.current.className);
                localVideoTrack.play(localRef.current, { fit: 'contain' });
            }
        };

        playLocal();
        const timer = setTimeout(playLocal, 100);

        return () => clearTimeout(timer);
    }, [localVideoTrack, status, camOn, remoteStreams.length]); // Thêm remoteStreams.length để re-play khi đổi layout

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
    const isConnected = status === 'connected';
    const isEnded     = status === 'ended';

    // Ưu tiên hiện Tên Nhóm nếu là cuộc gọi nhóm
    const displayName   = isGroup ? (activeConversation?.name || remoteName) : remoteName;
    const displayAvatar = isGroup ? (activeConversation?.avatar || activeConversation?.avatarUrl || remoteAvatar) : remoteAvatar;
    const initial       = (displayName || 'N')[0]?.toUpperCase();

    const myNumericUid = toNumericUid(user?.userId || user?.id);
    const isMeSpeaking = !!speakingUsers?.[myNumericUid];

    // ─── Giao diện Chờ - Đã được tích hợp bên dưới ─────────────────────────

    // ─── Render Components ───────────────────────────────────────────────────

    return (
        <div className="fixed inset-0 z-[9999] flex flex-col" style={{ background: 'linear-gradient(135deg, #0f0c29, #302b63, #24243e)' }}>

            {/* ══════════════════════════════════════════════════════════════
                ENDED — Màn hình kết thúc / bị từ chối
            ══════════════════════════════════════════════════════════════ */}
            {isEnded && (
                <div className="flex flex-col items-center justify-center h-full py-20 px-6">
                    <div className="flex flex-col items-center space-y-8">
                        <Avatar size="w-32 h-32" ring={true} url={displayAvatar} nameInitial={initial} />
                        <div className="text-center">
                            <h2 className="text-3xl font-bold text-white mb-2">{displayName || 'Người dùng'}</h2>
                            <div className="px-6 py-2 bg-white/10 rounded-full border border-white/20">
                                <p className="text-white font-medium">{endCallReason || 'Cuộc gọi đã kết thúc'}</p>
                            </div>
                        </div>
                        <button 
                            onClick={onClose}
                            className="mt-8 px-12 py-4 bg-white text-slate-900 font-bold rounded-2xl hover:bg-indigo-50 transition-all shadow-xl active:scale-95"
                        >
                            Trở lại trò chuyện
                        </button>
                    </div>
                </div>
            )}

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
                        <div className="relative">
                            <Avatar size="w-32 h-32" pulse url={displayAvatar} nameInitial={initial} />
                        </div>
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
                    <div className="flex items-center justify-center gap-20 pb-4 animate-in slide-in-from-bottom-8 duration-700">
                        <div className="flex flex-col items-center gap-3">
                            <button
                                onClick={onHangup}
                                className="w-18 h-18 flex items-center justify-center rounded-full bg-red-500 hover:bg-red-400 hover:shadow-[0_0_20px_rgba(239,68,68,0.4)] active:scale-75 transition-all duration-200 shadow-2xl shadow-red-500/50 transform"
                                style={{ width: 72, height: 72 }}
                                title="Từ chối"
                            >
                                <PhoneOff size={28} className="text-white" />
                            </button>
                            <span className="text-white/60 text-xs font-medium">Từ chối</span>
                        </div>

                        <div className="flex flex-col items-center gap-3">
                            <button
                                onClick={onAccept}
                                className="w-18 h-18 flex items-center justify-center rounded-full bg-green-500 hover:bg-green-400 hover:shadow-[0_0_20px_rgba(34,197,94,0.4)] active:scale-75 transition-all duration-200 shadow-2xl shadow-green-500/50 transform animate-bounce"
                                style={{ width: 72, height: 72, animationDuration: '3s' }}
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
                            <CountdownCircle duration={ringDuration} size={144} />
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
                    {localVideoTrack && (
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

                    {/* Grid Layout hoặc Fullscreen Waiting */}
                    {isGroup ? (
                        remoteStreams.length > 0 ? (
                            /* GRID VIEW: Khi đã có người khác tham gia */
                            <div className="absolute inset-0 pt-24 pb-32 px-4 z-0">
                                <div className={`w-full h-full grid gap-4 ${
                                    (remoteStreams.length + 1) <= 2 ? 'grid-cols-1 sm:grid-cols-2' : 
                                    (remoteStreams.length + 1) <= 4 ? 'grid-cols-2' : 'grid-cols-3'
                                }`}>
                                    {/* Remote 1 */}
                                    <RemoteVideoPlayer 
                                        stream={remoteStreams[0]} 
                                        isAudioCall={callType === 'audio'} 
                                        activeConversation={activeConversation}
                                        remoteName={remoteName}
                                        remoteAvatar={remoteAvatar}
                                        isSpeaking={speakingUsers?.[remoteStreams[0].uid] || speakingUsers?.[String(remoteStreams[0].uid)]}
                                        isGroup={isGroup}
                                    />


                                    {/* Local User (Always in grid for Group) */}
                                    <LocalVideoPlayer 
                                        videoTrack={localVideoTrack}
                                        audioTrack={localAudioTrack}
                                        camOn={camOn}
                                        micOn={micOn}
                                        user={user}
                                        isMeSpeaking={isMeSpeaking}
                                    />

                                    {/* Remaining Remotes */}
                                    {remoteStreams.slice(1).map(stream => (
                                        <RemoteVideoPlayer 
                                            key={stream.uid} 
                                            stream={stream} 
                                            isAudioCall={callType === 'audio'} 
                                            activeConversation={activeConversation}
                                            remoteName={remoteName}
                                            remoteAvatar={remoteAvatar}
                                            isSpeaking={speakingUsers?.[stream.uid] || speakingUsers?.[String(stream.uid)]}
                                            isGroup={isGroup}
                                        />
                                    ))}

                                </div>
                            </div>
                        ) : (
                            /* SOLO WAITING VIEW: Khi chỉ có mình bạn trong nhóm */
                            <div className="absolute inset-0 z-0">
                                {/* Local Video Fullscreen Background */}
                                <div className="absolute inset-0">
                                    <div ref={localRef} className={`w-full h-full transition-opacity duration-700 ${camOn ? 'opacity-100' : 'opacity-0'}`} />
                                    {!camOn && (
                                        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#1e1e2e] to-[#0f0f1a]">
                                            <Avatar size="w-32 h-32" ring={isMeSpeaking ? "ring-8 ring-green-500" : true} url={user?.avatar || user?.avatarUrl} nameInitial={user?.fullName?.[0]?.toUpperCase()} />
                                        </div>
                                    )}
                                    {/* Highlight viền khi nói chuyện một mình */}
                                    {camOn && isMeSpeaking && (
                                        <div className="absolute inset-0 ring-[12px] ring-green-500/50 ring-inset pointer-events-none z-10 shadow-[inset_0_0_50px_rgba(34,197,94,0.3)]" />
                                    )}
                                </div>

                                {/* Centered Waiting Info Overlay */}
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                    <div className="bg-black/40 backdrop-blur-md p-10 rounded-[3rem] border border-white/10 animate-fade-in flex flex-col items-center">
                                        <div className="relative mb-6">
                                            <Avatar size="w-24 h-24" pulse ring url={displayAvatar} nameInitial={initial} />
                                            <CountdownCircle duration={ringDuration} size={104} className="-top-1 -left-1" />
                                        </div>
                                        <h2 className="text-2xl font-black text-white tracking-tight">{displayName}</h2>
                                        <p className="text-indigo-400 text-[10px] font-black uppercase tracking-[0.2em] mt-3 animate-pulse">
                                            Đang chờ mọi người tham gia...
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )
                    ) : (
                        /* 1-1 CALL LAYOUT (Fullscreen + PiP) */
                        <div className="absolute inset-0 bg-[#111] z-0">
                            <RemoteVideoPlayer 
                                stream={remoteStreams[0] || { uid: 'waiting', hasVideo: false, hasAudio: false }} 
                                isAudioCall={callType === 'audio'} 
                                fullscreen={true} 
                                status={status} 
                                activeConversation={activeConversation}
                                remoteName={remoteName}
                                remoteAvatar={remoteAvatar}
                                isSpeaking={speakingUsers?.[remoteStreams[0]?.uid] || speakingUsers?.[String(remoteStreams[0]?.uid)]}
                                isGroup={isGroup}
                            />


                            {/* PiP Local Video - Chỉ dành cho 1-1 */}
                            {camOn && (
                                <div className={`absolute top-24 right-6 w-40 h-52 rounded-[2rem] overflow-hidden border-2 shadow-[0_20px_50px_rgba(0,0,0,0.5)] bg-black z-20 animate-scale-in transition-all duration-300 hover:scale-105 ${isMeSpeaking ? 'border-green-500 ring-4 ring-green-500/50' : 'border-white/20 hover:border-white/40'}`}>
                                    <div ref={localRef} className="w-full h-full" />
                                    <div className="absolute bottom-2 right-2 px-2 py-0.5 bg-black/40 backdrop-blur-md rounded-md border border-white/10">
                                        <span className="text-[10px] font-bold text-white/90">Bạn</span>
                                    </div>
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
                    <div className="relative z-10 flex items-center gap-4 px-8 pt-10 pb-2 animate-fade-in">
                        <div className="relative">
                            <Avatar size="w-12 h-12" ring={isMeSpeaking ? "ring-4 ring-green-500" : true} url={displayAvatar} nameInitial={initial} />
                            {isMeSpeaking && (
                                <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-[#1a1b2e] flex items-center justify-center">
                                    <Volume2 size={8} className="text-white animate-pulse" />
                                </div>
                            )}
                        </div>
                        <div>
                            <p className="text-white font-bold text-lg leading-tight tracking-wide">{displayName}</p>
                            <p className="text-white/60 text-xs font-medium uppercase tracking-widest mt-1">{duration || '0:00'}</p>
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


                    {/* Audio Blocked Banner */}
                    {audioBlocked && (
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[30] flex flex-col items-center gap-4">
                            <div className="bg-white/10 backdrop-blur-xl border border-white/20 p-6 rounded-3xl flex flex-col items-center text-center max-w-xs shadow-2xl">
                                <div className="w-16 h-16 bg-indigo-500/20 rounded-full flex items-center justify-center mb-4 animate-pulse">
                                    <Volume2 size={32} className="text-indigo-400" />
                                </div>
                                <h3 className="text-white font-bold text-lg mb-2">Âm thanh bị chặn</h3>
                                <p className="text-white/60 text-sm mb-6">Trình duyệt đã chặn tự động phát âm thanh. Vui lòng nhấn nút bên dưới để nghe.</p>
                                <button 
                                    onClick={onResumeAudio}
                                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold transition-all shadow-xl shadow-indigo-600/30 active:scale-95"
                                >
                                    Bật âm thanh
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Controls */}
                    <div className="absolute bottom-0 inset-x-0 z-20 flex items-center justify-center pb-10 pt-6">
                        <div className="flex items-center gap-5 px-8 py-4 rounded-full"
                            style={{ background: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.12)' }}>

                            {/* Mic */}
                            <button
                                onClick={toggleMic}
                                className={`w-14 h-14 flex items-center justify-center rounded-full transition-all duration-200 active:scale-90 ${micOn ? 'bg-white/20 hover:bg-white/30' : 'bg-red-500 hover:bg-red-400'}`}
                                title={micOn ? 'Tắt mic' : 'Bật mic'}
                            >
                                {micOn ? <Mic size={22} className="text-white" /> : <MicOff size={22} className="text-white" />}
                            </button>

                            {/* Camera */}
                            <button
                                onClick={toggleCam}
                                className={`w-14 h-14 flex items-center justify-center rounded-full transition-all duration-200 active:scale-90 ${camOn ? 'bg-white/20 hover:bg-white/30' : 'bg-red-500 hover:bg-red-400'}`}
                                title={camOn ? 'Tắt camera' : 'Bật camera'}
                            >
                                {camOn ? <Video size={22} className="text-white" /> : <VideoOff size={22} className="text-white" />}
                            </button>

                            {/* End call */}
                            <button
                                onClick={onHangup}
                                className="w-16 h-16 flex items-center justify-center rounded-full bg-red-500 hover:bg-red-400 hover:shadow-[0_0_20px_rgba(239,68,68,0.4)] active:scale-90 transition-all duration-200 shadow-2xl shadow-red-500/50"
                                title="Kết thúc"
                            >
                                <PhoneOff size={26} className="text-white" />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* User Left Toast Notification */}
            {userLeftMsg && (
                <div className="fixed top-10 left-1/2 -translate-x-1/2 z-[1000] px-6 py-3 bg-black/80 backdrop-blur-md border border-white/10 rounded-full animate-in fade-in slide-in-from-top-4 duration-300">
                    <p className="text-white text-sm font-bold flex items-center space-x-2">
                        <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                        <span>{userLeftMsg}</span>
                    </p>
                </div>
            )}
        </div>
    );
};

export default VideoCall;