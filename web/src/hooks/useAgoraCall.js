import AgoraRTC from 'agora-rtc-sdk-ng';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { addOptimisticMessage } from '../store/chatSlice';
import { onCallSignal, offCallSignal, emitCallSignal, getStompClient } from '../utils/socket';
import { callApi } from '../api/callApi';
import { ringtoneService } from '../utils/RingtoneService';
import { chatApi } from '../api/chatApi';

// ─── Agora Client (singleton toàn app) ────────────────────────────────────────
// Tạo một lần duy nhất, không tạo lại mỗi lần render
const agoraClient = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });

/**
 * Agora channel name không được chứa ký tự '#'.
 * conversationId dạng "SINGLE#uuid1#uuid2" cần được sanitize.
 * Quy tắc: thay '#' → '-', cắt tối đa 64 ký tự.
 */
const sanitizeChannelId = (id) =>
    (id || '').replace(/#/g, '-').slice(0, 64);

/**
 * Agora join() chỉ chấp nhận UID là số nguyên dương hoặc null.
 * Hàm này convert string userId (UUID) thành số nguyên 32-bit dương ổn định.
 * Đảm bảo mỗi user có UID khác nhau → tránh UID_CONFLICT.
 */
const toNumericUid = (userId) => {
    if (!userId) return null;
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
        hash = ((hash << 5) - hash + userId.charCodeAt(i)) | 0;
    }
    // Đảm bảo dương và trong range 32-bit unsigned (1 → 2^32-1)
    return Math.abs(hash) || 1;
};

// Tắt log Agora trong production
AgoraRTC.setLogLevel(1); // 0=DEBUG, 1=INFO, 2=WARN, 3=ERROR, 4=NONE

// Xử lý browser autoplay policy: khi bị block, hiện thông báo cho user bấm vào màn hình
AgoraRTC.onAudioAutoplayFailed = () => {
    console.warn('[Agora] Audio autoplay blocked by browser! User must interact with the page.');
    // Tự động mở khóa bằng cách thêm event listener 1 lần
    const unlock = () => {
        agoraClient.remoteUsers.forEach(remoteUser => {
            if (remoteUser.audioTrack) {
                remoteUser.audioTrack.play();
                console.log('[Agora] Re-played audio for remote user:', remoteUser.uid);
            }
        });
        document.removeEventListener('click', unlock);
    };
    document.addEventListener('click', unlock, { once: true });
};

/**
 * useAgoraCall — Hook quản lý video call dùng Agora SDK
 *
 * Thay thế useVideoCall.js (WebRTC thuần + STOMP signaling).
 * Với Agora:
 *   - Không cần xử lý OFFER / ANSWER / ICE candidates thủ công
 *   - Agora Cloud xử lý toàn bộ WebRTC internals
 *   - STOMP WebSocket chỉ dùng để gửi CALL_INVITE và HANGUP
 *
 * @param {string} conversationId - ID cuộc trò chuyện hiện tại
 * @param {object} activeConversation - Object chứa thông tin cuộc trò chuyện
 */
export const useAgoraCall = (conversationId, activeConversation = null) => {
    const { user } = useSelector((state) => state.auth);
    const dispatch = useDispatch();

    // ─── State ────────────────────────────────────────────────────────────────
    const [callStatus, setCallStatus] = useState('idle');
    // idle | outgoing | incoming | connected | ended

    const [incomingSignal, setIncomingSignal] = useState(null);
    const [callerName, setCallerName] = useState('');
    const [callerId, setCallerId] = useState('');
    const [error, setError] = useState(null);
    const [callType, setCallType] = useState('video'); // 'video' | 'audio'
    const [cameraError, setCameraError] = useState(null);
    const [remoteUsers, setRemoteUsers] = useState([]);
    const [audioBlocked, setAudioBlocked] = useState(false); // Mới thêm
    const [duration, setDuration] = useState(0);

    // Agora tracks (khác với MediaStream của WebRTC)
    const [localVideoTrack, setLocalVideoTrack] = useState(null);
    const [localAudioTrack, setLocalAudioTrack] = useState(null);

    // ─── Refs ────────────────────────────────────────────────────────────────
    const activeChannelRef = useRef(null);
    const timerRef = useRef(null);
    const localVideoTrackRef = useRef(null);
    const localAudioTrackRef = useRef(null);
    const endCallRef = useRef(null);
    const myUserIdRef = useRef(null);
    const startTimeRef = useRef(null);
    const ringTimerRef = useRef(null);
    const joiningRef = useRef(false); // Guard chống double join
    const logSentRef = useRef(false); // Chặn gửi lặp CALL_LOG

    useEffect(() => {
        myUserIdRef.current = user?.userId || user?.id;
    }, [user]);

    // ─── Timer đếm giờ ───────────────────────────────────────────────────────
    useEffect(() => {
        if (callStatus === 'connected') {
            if (!startTimeRef.current) startTimeRef.current = Date.now();
            
            const updateTimer = () => {
                if (startTimeRef.current) {
                    setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
                }
            };
            
            updateTimer(); // Chạy ngay lập tức lần đầu để tránh lag 1s ban đầu
            timerRef.current = setInterval(updateTimer, 1000);
        } else {
            if (timerRef.current) clearInterval(timerRef.current);
            if (callStatus === 'idle' || callStatus === 'ended') {
                startTimeRef.current = null;
            }
        }
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [callStatus]);

    // ─── Điều khiển Nhạc chuông ──────────────────────────────────────────────
    useEffect(() => {
        if (callStatus === 'incoming') {
            ringtoneService.playIncoming();
        } else if (callStatus === 'outgoing') {
            ringtoneService.playOutgoing();
        } else {
            ringtoneService.stop();
        }

        return () => {
            ringtoneService.stop();
        };
    }, [callStatus]);

    // ─── Timer đếm 60s cho Outgoing ──────────────────────────────────────────
    useEffect(() => {
        if (callStatus === 'outgoing') {
            ringTimerRef.current = setTimeout(() => {
                // Hết 60s mà không ai trả lời
                ringtoneService.playUnreachable();
                endCallRef.current?.(true, 'MISSED');
            }, 60000); // 60 seconds
        } else {
            if (ringTimerRef.current) clearTimeout(ringTimerRef.current);
        }
        return () => {
            if (ringTimerRef.current) clearTimeout(ringTimerRef.current);
        };
    }, [callStatus]);

    const formatDuration = useCallback(() => {
        const m = Math.floor(duration / 60);
        const s = duration % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    }, [duration]);

    // ─── Cleanup tất cả tracks và rời channel ────────────────────────────────
    const cleanupTracks = useCallback(async () => {
        // Dừng và đóng local video track
        if (localVideoTrackRef.current) {
            localVideoTrackRef.current.stop();
            localVideoTrackRef.current.close();
            localVideoTrackRef.current = null;
        }
        // Dừng và đóng local audio track
        if (localAudioTrackRef.current) {
            localAudioTrackRef.current.stop();
            localAudioTrackRef.current.close();
            localAudioTrackRef.current = null;
        }
        setLocalVideoTrack(null);
        setLocalAudioTrack(null);
        setRemoteUsers([]);

        // Rời Agora channel nếu đang kết nối
        if (agoraClient.connectionState !== 'DISCONNECTED' &&
            agoraClient.connectionState !== 'DISCONNECTING') {
            try {
                await agoraClient.leave();
                console.log('[Agora] Left channel successfully');
            } catch (e) {
                console.warn('[Agora] Error leaving channel:', e);
            }
        }
        activeChannelRef.current = null;
    }, []);

    // ─── Kết thúc cuộc gọi ───────────────────────────────────────────────────
    const endCall = useCallback(async (emit = true, reason = 'ENDED') => {
        const cid = activeChannelRef.current || conversationId;

        // Tính thời lượng
        let callDuration = 0;
        if (startTimeRef.current) {
            callDuration = Math.floor((Date.now() - startTimeRef.current) / 1000);
        }

        // Gửi HANGUP signal cho bên kia qua STOMP
        if (emit && cid) {
            emitCallSignal(cid, { type: 'HANGUP', reason });
        }

        // CHỈ NGƯỜI CHỦ ĐỘNG TẮT mới được quyền gửi CALL_LOG để tránh trùng lặp
        // Và để đảm bảo tin nhắn call xuất hiện bên phía người tắt (theo yêu cầu)
        const isCaller = !incomingSignal;
        const isManual = emit; // Manual hangup will have emit = true
        const shouldLog = isManual || (isCaller && (reason === 'MISSED' || reason === 'REJECTED' || reason === 'UNREACHABLE'));

        if (cid && shouldLog && !logSentRef.current && (callStatus === 'connected' || callStatus === 'outgoing' || callStatus === 'incoming' || callStatus === 'ringing')) {
            logSentRef.current = true;
            try {
                let statusStr = 'SUCCESS';
                if (callDuration === 0 || callStatus !== 'connected') {
                    statusStr = reason === 'MISSED' ? 'MISSED' : (reason === 'REJECTED' ? 'REJECTED' : 'MISSED');
                }
                
                const content = JSON.stringify({
                    callType: callType || 'audio',
                    duration: callDuration,
                    status: statusStr
                });

                // Gửi qua REST API
                chatApi.sendMessage({
                    conversationId: cid,
                    content: content,
                    type: 'CALL_LOG'
                }).then(() => {
                    console.log('[Agora Web] Gửi CALL_LOG thành công!');
                }).catch(err => {
                    console.error('[Agora Web] Lỗi gửi CALL_LOG:', err);
                });
            } catch (err) {
                console.error('[Agora] Failed to send call log:', err);
            }
        }

        // Clear timer immediately
        if (timerRef.current) {
            console.log('[Agora] Stopping timer...');
            clearInterval(timerRef.current);
            timerRef.current = null;
        }

        // Cleanup remote player elements from DOM immediately
        const remoteContainer = document.getElementById('remote-player-container');
        if (remoteContainer) {
            remoteContainer.innerHTML = '';
        }

        try {
            await cleanupTracks();
        } catch (err) {
            console.error('[Agora Web] Cleanup tracks error:', err);
        }

        joiningRef.current = false;
        setIncomingSignal(null);
        setCallerName('');
        setCallerId('');
        setError(null);
        setCameraError(null);
        setCallType('video');
        setCallStatus('ended');

        // Reset về idle sau 1 giây
        setTimeout(() => {
            setCallStatus('idle');
            setDuration(0);
            logSentRef.current = false;
        }, 1000);
    }, [conversationId, cleanupTracks, callStatus, callType, user, dispatch]);

    endCallRef.current = endCall;

    // ─── Lắng nghe remote user (Agora events) ────────────────────────────────
    useEffect(() => {
        const updateRemoteUsers = () => {
            // agoraClient.remoteUsers contains all remote users we are subscribed to
            setRemoteUsers(Array.from(agoraClient.remoteUsers));
        };

        const handleUserPublished = async (remoteUser, mediaType) => {
            console.log('[Agora] Remote user published:', remoteUser.uid, mediaType);
            await agoraClient.subscribe(remoteUser, mediaType);

            if (mediaType === 'audio') {
                const audioTrack = remoteUser.audioTrack;
                // Play ngay lập tức sau khi subscribe
                if (audioTrack) {
                    audioTrack.play().catch(err => {
                        console.error('[Agora] Play audio failed:', err);
                        if (err.name === 'NotAllowedError' || err.message?.includes('autoplay')) {
                            setAudioBlocked(true);
                        }
                    });
                    console.log('[Agora] Remote audio track playing for', remoteUser.uid);
                }
            }
            updateRemoteUsers();
            
            // Check volume of remote users
            const volInterval = setInterval(() => {
                if (remoteUser.audioTrack) {
                    const level = remoteUser.audioTrack.getVolumeLevel();
                    if (level > 0.01) {
                        console.log(`[Agora] Remote volume from ${remoteUser.uid}:`, level.toFixed(2));
                    }
                }
            }, 1000);

            // Chuyển connected khi nhận bất kỳ stream nào từ remote
            if (callStatus !== 'connected') {
                setCallStatus('connected');
                if (!startTimeRef.current) {
                    startTimeRef.current = Date.now();
                }
            }
        };

        const handleUserUnpublished = (remoteUser, mediaType) => {
            console.log('[Agora] Remote user unpublished:', remoteUser.uid, mediaType);
            updateRemoteUsers();
        };

        const handleUserJoined = (remoteUser) => {
            console.log('[Agora] Remote user joined:', remoteUser.uid);
            updateRemoteUsers();
        };

        const handleUserLeft = (remoteUser) => {
            console.log('[Agora] Remote user left:', remoteUser.uid);
            updateRemoteUsers();
            
            // FAIL-SAFE: Nếu là cuộc gọi 1-1 và đối phương rời đi, kết thúc cuộc gọi ngay
            if (agoraClient.remoteUsers.length === 0) {
                console.log('[Agora] No remote users left, force ending call...');
                // Xóa nốt các DOM elements còn sót lại
                const remoteContainer = document.getElementById('remote-player-container');
                if (remoteContainer) remoteContainer.innerHTML = '';
                
                if (timerRef.current) {
                    clearInterval(timerRef.current);
                    timerRef.current = null;
                }
                endCallRef.current?.(false, 'ENDED');
            }
        };

        const handleException = (evt) => {
            console.warn('[Agora] Exception:', evt);
            setError(evt.msg || 'Agora error');
        };

        const handleAutoplayFailed = () => {
            console.warn('[Agora] Audio autoplay failed!');
            setAudioBlocked(true);
        };

        agoraClient.on('user-published', handleUserPublished);
        agoraClient.on('user-unpublished', handleUserUnpublished);
        agoraClient.on('user-joined', handleUserJoined);
        agoraClient.on('user-left', handleUserLeft);
        agoraClient.on('exception', handleException);
        AgoraRTC.onAudioAutoplayFailed = handleAutoplayFailed;

        return () => {
            agoraClient.off('user-published', handleUserPublished);
            agoraClient.off('user-unpublished', handleUserUnpublished);
            agoraClient.off('user-joined', handleUserJoined);
            agoraClient.off('user-left', handleUserLeft);
            agoraClient.off('exception', handleException);
        };
    }, []);

    // ─── Đảm bảo remote audio luôn được play ─────────────────────────────────
    // Browser có thể suspend AudioContext trước khi có user interaction
    // Trong group call, ta lặp qua danh sách
    useEffect(() => {
        remoteUsers.forEach(user => {
            if (user.audioTrack) {
                try {
                    user.audioTrack.play();
                } catch (e) {
                    // ignore
                }
            }
        });
    }, [remoteUsers]);

    // ─── Lắng nghe cuộc gọi đến qua STOMP ───────────────────────────────────
    const connect = useCallback(() => {
        const handler = async (data) => {
            // Chuẩn hóa dữ liệu: Backend bọc trong 'payload'
            const actualData = data?.payload || data;
            const { signal, senderId } = actualData || {};
            const cid = data?.conversationId || actualData?.conversationId;
            const senderName = actualData?.senderName || senderId;
            const myId = myUserIdRef.current;

            // Bỏ qua signal của chính mình
            if (senderId === myId) return;
            if (!signal) return;

            const type = signal.type;
            console.log('[Agora Web] Received signal:', type, 'from', senderId);

            // ─ Nhận CALL_INVITE → hiện màn hình "Cuộc gọi đến"
            if (type === 'CALL_INVITE') {
                activeChannelRef.current = cid;
                setIncomingSignal({ ...actualData, conversationId: cid });
                setCallerName(senderName);
                setCallerId(senderId);
                setCallType(signal.callType || 'video');
                setCallStatus('incoming');
            }

            // ─ Nhận HANGUP → kết thúc cuộc gọi
            if (type === 'HANGUP') {
                const reason = signal.reason || actualData.reason || 'ENDED';
                console.log('[Agora Web] 🛑 HANGUP signal received. Reason:', reason);
                endCallRef.current?.(false, reason);
            }

            // ─ Nhận CALL_ACCEPTED → chuyển trạng thái connected và đồng bộ timer
            if (type === 'CALL_ACCEPTED') {
                setCallStatus('connected');
                // Sử dụng thời điểm nhận signal làm mốc local để tránh lệch clock giữa các thiết bị
                if (!startTimeRef.current) {
                    startTimeRef.current = Date.now();
                }
            }
        };

        onCallSignal(handler);
        return () => offCallSignal(handler);
    }, []);

    // ─── Caller bắt đầu cuộc gọi ─────────────────────────────────────────────
    const startCall = useCallback(async (type = 'video') => {
        if (!conversationId) return;
        if (joiningRef.current) {
            console.warn('[Agora] A join is already in progress, ignoring startCall');
            return;
        }

        try {
            joiningRef.current = true;
            logSentRef.current = false;
            setError(null);
            setCallType(type);
            setCameraError(null);
            activeChannelRef.current = conversationId;

            // Hiện UI ngay lập tức
            setCallStatus('outgoing');

            // Sanitize: Agora không cho phép '#' trong channel name
            const safeChannelId = sanitizeChannelId(conversationId);

            // 1. Lấy Agora token từ backend
            const res = await callApi.getAgoraToken(safeChannelId);
            const { token, appId, uid: originalUid } = res;
            
            // Ép dùng Numeric UID để tương thích chéo nền tảng
            const numericUid = 0 | (originalUid?.split('-').reduce((h, c) => (h << 5) - h + c.charCodeAt(0), 0));
            const finalUid = Math.abs(numericUid);

            console.log('[Agora] JOIN params → appId:', appId, '| channel:', safeChannelId, '| uid:', finalUid);

            // 2. Thông báo cho callee qua STOMP (gửi sớm để bên kia rung chuông ngay)
            const currentUserName = user?.fullName || user?.name || user?.username || 'Người dùng';
            const signalData = { 
                type: 'CALL_INVITE', 
                callType: type,
                conversationType: activeConversation?.type,
                conversationName: activeConversation?.name,
                conversationAvatar: activeConversation?.avatar || activeConversation?.avatarUrl,
                senderAvatar: user?.avatar || user?.avatarUrl
            };
            console.log('[Agora Web] Sending CALL_INVITE:', signalData);
            emitCallSignal(conversationId, signalData, currentUserName);

            // 3. Tạo mic và camera track riêng để biết chính xác cái nào fail
            let audioTrack = null;
            let videoTrack = null;

            try {
                audioTrack = await AgoraRTC.createMicrophoneAudioTrack();
                console.log('[Agora] ✅ Mic track created');
            } catch (micErr) {
                console.error('[Agora] ❌ Mic track FAILED:', micErr.message);
                if (micErr.message.includes('permission') || micErr.message.includes('not found') || micErr.message.includes('origin')) {
                    alert('LỖI MICROPHONE: Web đang chặn truy cập Mic (do bảo mật hoặc thiếu quyền). Mobile sẽ không nghe thấy gì!');
                }
            }
            if (type === 'video') {
                try {
                    videoTrack = await AgoraRTC.createCameraVideoTrack({
                        encoderConfig: { width: 640, height: 480, frameRate: 15, bitrateMin: 200, bitrateMax: 500 }
                    });
                    console.log('[Agora] ✅ Camera track created');
                } catch (camErr) {
                    console.error('[Agora] ❌ Camera track FAILED:', camErr.message);
                    setCameraError(camErr.message);
                }
            }

            // 3. Lưu track để cleanup sau
            localAudioTrackRef.current = audioTrack;
            localVideoTrackRef.current = videoTrack;
            if (audioTrack) setLocalAudioTrack(audioTrack);
            // VideoCall đã render (status='outgoing') → localRef.current tồn tại → play thành công
            if (videoTrack) setLocalVideoTrack(videoTrack);

            // 4. Join Agora channel
            const joinUid = finalUid;
            if (agoraClient.connectionState === 'CONNECTED' && 
                agoraClient.uid === joinUid && 
                agoraClient.channelName === safeChannelId) {
                console.log('[Agora] Already joined to correct channel with correct UID');
            } else {
                let retryCount = 0;
                while (agoraClient.connectionState !== 'DISCONNECTED' && retryCount < 5) {
                    console.warn(`[Agora] Client state is ${agoraClient.connectionState}, force leave before join...`);
                    try { await agoraClient.leave(); } catch (_) {}
                    await new Promise(r => setTimeout(r, 200));
                    retryCount++;
                }
                
                const agoraToken = token || null;
                console.log('[Agora] startCall JOIN → channel:', safeChannelId, '| uid:', joinUid);
                await agoraClient.join(appId, safeChannelId, agoraToken, joinUid);
            }

            // 5. Publish tracks lên channel
            const tracksToPublish = [audioTrack, videoTrack].filter(Boolean);
            if (tracksToPublish.length > 0) {
                await agoraClient.publish(tracksToPublish);
                console.log('[Agora] Published tracks to channel:', safeChannelId,
                    '| audio:', !!audioTrack, '| video:', !!videoTrack);
                
                if (audioTrack) {
                    setInterval(() => {
                        const level = audioTrack.getVolumeLevel();
                        if (level > 0.01) {
                            console.log('[Agora] Local mic volume:', level.toFixed(2));
                        }
                    }, 1000);
                }
            } else {
                console.error('[Agora] No tracks to publish!');
            }

            console.log('[Agora] startCall completed successfully');
        } catch (e) {
            console.error('[Agora] startCall error:', e);
            setError(e.message || 'Không thể bắt đầu cuộc gọi');
            await endCallRef.current?.(false);
        } finally {
            joiningRef.current = false;
        }
    }, [conversationId, user, activeConversation]);

    // ─── Callee chấp nhận cuộc gọi ───────────────────────────────────────────
    const acceptCall = useCallback(async (signalData) => {
        if (joiningRef.current) {
            console.warn('[Agora] A join is already in progress, ignoring acceptCall');
            return;
        }
        try {
            joiningRef.current = true;
            logSentRef.current = false;
            setError(null);
            setCameraError(null);
            const channelId = signalData?.conversationId;
            if (!channelId) throw new Error('Missing conversationId in signalData');

            activeChannelRef.current = channelId;

            // Sanitize: Agora không cho phép '#' trong channel name
            const safeChannelId = sanitizeChannelId(channelId);

            // 1. Gửi tín hiệu báo đã chấp nhận để đồng bộ timer
            const currentUserName = user?.fullName || user?.name || user?.username || 'Người dùng';
            const acceptedTime = Date.now();
            emitCallSignal(channelId, { type: 'CALL_ACCEPTED', startTime: acceptedTime }, currentUserName);
            startTimeRef.current = acceptedTime;

            // Hiện UI ngay
            setCallStatus('connected');

            // 2. Lấy Agora token từ backend
            const res = await callApi.getAgoraToken(safeChannelId);
            const { token, appId, uid } = res;

            // 3. Join channel TRƯỚC khi tạo tracks
            const numericUid = 0 | (uid?.split('-').reduce((h, c) => (h << 5) - h + c.charCodeAt(0), 0));
            const joinUid = Math.abs(numericUid);
            if (agoraClient.connectionState === 'CONNECTED' && 
                agoraClient.uid === joinUid && 
                agoraClient.channelName === safeChannelId) {
                console.log('[Agora] Already joined to correct channel with correct UID (accept)');
            } else {
                let retryCount = 0;
                while (agoraClient.connectionState !== 'DISCONNECTED' && retryCount < 5) {
                    console.warn(`[Agora] Force leave before acceptCall join... (state: ${agoraClient.connectionState})`);
                    try { await agoraClient.leave(); } catch (_) {}
                    await new Promise(r => setTimeout(r, 200));
                    retryCount++;
                }

                const agoraToken = token || null;
                console.log('[Agora] acceptCall JOIN → channel:', safeChannelId, '| uid:', joinUid);
                await agoraClient.join(appId, safeChannelId, agoraToken, joinUid);
            }
            console.log('[Agora] ✅ Callee joined channel - waiting for caller audio/video...');

            // 4. Tạo tracks SAU KHI đã join (caller's user-published đã được xử lý)
            let audioTrack = null;
            let videoTrack = null;

            try {
                audioTrack = await AgoraRTC.createMicrophoneAudioTrack({ encoderConfig: 'music_standard' });
                console.log('[Agora] ✅ Callee mic created, enabled:', audioTrack.enabled);
            } catch (micErr) {
                console.error('[Agora] ❌ Callee mic FAILED:', micErr.message);
            }

            const actualCallType = signalData?.signal?.callType || callType;
            if (actualCallType === 'video') {
                try {
                    videoTrack = await AgoraRTC.createCameraVideoTrack({
                        encoderConfig: { width: 640, height: 480, frameRate: 15, bitrateMin: 200, bitrateMax: 500 }
                    });
                    console.log('[Agora] ✅ Callee camera created');
                } catch (camErr) {
                    console.error('[Agora] ❌ Callee camera FAILED:', camErr.message);
                    setCameraError(camErr.message);
                }
            }

            // 5. Lưu track
            localAudioTrackRef.current = audioTrack;
            localVideoTrackRef.current = videoTrack;
            if (audioTrack) setLocalAudioTrack(audioTrack);
            if (videoTrack) setLocalVideoTrack(videoTrack);

            // 6. Publish callee's tracks lên channel
            const tracksToPublish = [audioTrack, videoTrack].filter(Boolean);
            if (tracksToPublish.length > 0) {
                await agoraClient.publish(tracksToPublish);
                console.log('[Agora] Callee published tracks | audio:', !!audioTrack, '| video:', !!videoTrack);
            }

            setIncomingSignal(null);
        } catch (e) {
            console.error('[Agora] acceptCall error:', e);
            setError(e.message || 'Không thể chấp nhận cuộc gọi');
            await endCallRef.current?.(false);
        } finally {
            joiningRef.current = false;
        }
    }, [user, callType]);

    // ─── Toggle mic ──────────────────────────────────────────────────────────
    const toggleMic = useCallback(async (enabled) => {
        if (localAudioTrackRef.current) {
            await localAudioTrackRef.current.setEnabled(enabled);
        }
    }, []);

    // ─── Toggle camera ───────────────────────────────────────────────────────
    const toggleCamera = useCallback(async (enabled) => {
        if (localVideoTrackRef.current) {
            await localVideoTrackRef.current.setEnabled(enabled);
        }
    }, []);

    // ─── Resume audio ────────────────────────────────────────────────────────
    const resumeAudio = useCallback(async () => {
        console.log('[Agora] Resuming audio context...');
        try {
            await AgoraRTC.getAudioContext().resume();
            // Re-play all remote audio tracks
            remoteUsers.forEach(user => {
                if (user.audioTrack) {
                    user.audioTrack.play();
                }
            });
            setAudioBlocked(false);
        } catch (e) {
            console.error('[Agora] Resume audio error:', e);
        }
    }, [remoteUsers]);

    return {
        // State
        callStatus,
        callerName,
        callerId,
        incomingSignal,
        callType,
        cameraError,
        error,
        duration,
        formatDuration,
        audioBlocked, // Export ra ngoài

        // Agora tracks (dùng track.play(domElement) thay vì video.srcObject)
        localVideoTrack,
        localAudioTrack,
        remoteUsers,

        // Actions
        startCall,
        acceptCall,
        endCall,
        connect,
        toggleMic,
        toggleCamera,
        resumeAudio, // Export ra ngoài
    };
};

export default useAgoraCall;
