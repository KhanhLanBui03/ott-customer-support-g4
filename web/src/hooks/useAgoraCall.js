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
    const [duration, setDuration] = useState(0);

    // Agora tracks (khác với MediaStream của WebRTC)
    const [localVideoTrack, setLocalVideoTrack] = useState(null);
    const [localAudioTrack, setLocalAudioTrack] = useState(null);
    const [remoteUsers, setRemoteUsers] = useState([]);

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

        // Gửi tin nhắn lịch sử cuộc gọi
        if (cid && (callStatus === 'connected' || callStatus === 'outgoing' || callStatus === 'incoming')) {
            try {
                let statusStr = 'SUCCESS';
                if (callDuration === 0) {
                    statusStr = reason === 'MISSED' ? 'MISSED' : (callStatus === 'outgoing' ? 'MISSED' : 'REJECTED');
                } else {
                    statusStr = 'SUCCESS';
                }
                
                const content = JSON.stringify({
                    callType: callType || 'video',
                    duration: callDuration,
                    status: statusStr
                });

                // 1. Optimistic Update để hiện ngay trên UI
                dispatch(addOptimisticMessage({
                    conversationId: cid,
                    message: {
                        content: content,
                        senderId: user?.userId || user?.id,
                        senderName: user?.fullName || 'Me',
                        type: 'CALL_LOG',
                        status: 'SENDING',
                        createdAt: Date.now(),
                    }
                }));

                // 2. Gửi qua REST API để đảm bảo lưu vào DB (đường dẫn đã sửa thành /messages/send)
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

        await cleanupTracks();

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
                    audioTrack.play();
                    console.log('[Agora] Remote audio track playing for', remoteUser.uid);
                }
            }
            updateRemoteUsers();
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
            
            // Check if there are no more remote users left to end the call?
            // In a group call, we might not want to end it when ONE leaves.
            // But if we are the only one left, maybe end it?
            // For now, let's keep the call active until the user hangs up manually,
            // except for 1-1 calls. Let's just update the list.
        };

        const handleException = (evt) => {
            console.warn('[Agora] Exception:', evt);
            setError(evt.msg || 'Agora error');
        };

        agoraClient.on('user-published', handleUserPublished);
        agoraClient.on('user-unpublished', handleUserUnpublished);
        agoraClient.on('user-joined', handleUserJoined);
        agoraClient.on('user-left', handleUserLeft);
        agoraClient.on('exception', handleException);

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
            const { signal, senderId, conversationId: cid } = data;
            const senderName = data.senderName || senderId;
            const myId = myUserIdRef.current;

            // Bỏ qua signal của chính mình
            if (senderId === myId) return;
            if (!signal) return;

            const type = signal.type;
            console.log('[Agora] Received signal:', type, 'from', senderId);

            // ─ Nhận CALL_INVITE → hiện màn hình "Cuộc gọi đến"
            if (type === 'CALL_INVITE') {
                activeChannelRef.current = cid;
                setIncomingSignal({ ...data, signal });
                setCallerName(senderName);
                setCallerId(senderId);
                setCallType(signal.callType || 'video');
                setCallStatus('incoming');
            }

            // ─ Nhận HANGUP → kết thúc cuộc gọi
            if (type === 'HANGUP') {
                endCallRef.current?.(false);
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
            const { token, appId, uid } = res;
            console.log('[Agora] JOIN params → appId:', appId, '| channel:', safeChannelId, '| uid:', uid);

            // 2. Thông báo cho callee qua STOMP (gửi sớm để bên kia rung chuông ngay)
            const currentUserName = user?.fullName || user?.name || user?.username || 'Người dùng';
            emitCallSignal(conversationId, { 
                type: 'CALL_INVITE', 
                callType: type,
                conversationType: activeConversation?.type,
                conversationName: activeConversation?.name,
                conversationAvatar: activeConversation?.avatar || activeConversation?.avatarUrl,
                senderAvatar: user?.avatar || user?.avatarUrl
            }, currentUserName);

            // 3. Tạo mic và camera track riêng để biết chính xác cái nào fail
            let audioTrack = null;
            let videoTrack = null;

            try {
                audioTrack = await AgoraRTC.createMicrophoneAudioTrack({ encoderConfig: 'music_standard' });
                console.log('[Agora] ✅ Mic track created, muted:', audioTrack.muted, 'enabled:', audioTrack.enabled);
            } catch (micErr) {
                console.error('[Agora] ❌ Mic track FAILED:', micErr.message);
                // Tiếp tục dù không có mic (chỉ video)
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
            const joinUid = uid || null;
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
            const joinUid = uid || null;
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
    };
};

export default useAgoraCall;
