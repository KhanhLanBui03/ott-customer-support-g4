import AgoraRTC from 'agora-rtc-sdk-ng';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { onCallSignal, offCallSignal, emitCallSignal } from '../utils/socket';
import { callApi } from '../api/callApi';
import { ringtoneService } from '../utils/RingtoneService';
import { chatApi } from '../api/chatApi';

// ─── Agora Client (singleton toàn app) ────────────────────────────────────────
const agoraClient = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });

const sanitizeChannelId = (id) => {
    if (!id) return '';
    const clean = id.replace(/#/g, '-');
    const parts = clean.split('-');
    if (parts.length >= 3 && (parts[0] === 'SINGLE' || parts[0] === 'GROUP')) {
        const type = parts[0];
        const sortedIds = parts.slice(1).sort();
        return (type + '-' + sortedIds.join('-')).slice(0, 64);
    }
    return clean.slice(0, 64);
};

const toNumericUid = (userId, isCaller = false) => {
    if (!userId) return 0;
    let baseUid = 0;
    if (typeof userId === 'number') baseUid = userId;
    else if (/^\d+$/.test(String(userId))) baseUid = parseInt(String(userId), 10);
    else {
        let hash = 0;
        const s = String(userId);
        for (let i = 0; i < s.length; i++) {
            hash = ((hash << 5) - hash + s.charCodeAt(i)) | 0;
        }
        baseUid = Math.abs(hash);
    }
    // Đồng bộ với Mobile: Caller dải 1xx, Receiver dải 2xx
    return (isCaller ? 1000000 : 2000000) + (baseUid % 1000000);
};

AgoraRTC.setLogLevel(1);

export const useAgoraCall = (conversationId, activeConversation = null) => {
    const { user } = useSelector((state) => state.auth);
    const dispatch = useDispatch();

    const [callStatus, setCallStatus] = useState('idle');
    const [incomingSignal, setIncomingSignal] = useState(null);
    const [callerName, setCallerName] = useState('');
    const [callerId, setCallerId] = useState('');
    const [error, setError] = useState(null);
    const [endCallReason, setEndCallReason] = useState(null);
    const [callType, setCallType] = useState('video');
    const [cameraError, setCameraError] = useState(null);
    const [remoteUsers, setRemoteUsers] = useState([]);
    const [audioBlocked, setAudioBlocked] = useState(false);
    const [duration, setDuration] = useState(0);
    const [micOn, setMicOn] = useState(true);
    const [camOn, setCamOn] = useState(true);

    const [localVideoTrack, setLocalVideoTrack] = useState(null);
    const [localAudioTrack, setLocalAudioTrack] = useState(null);

    const activeChannelRef = useRef(null);
    const timerRef = useRef(null);
    const localVideoTrackRef = useRef(null);
    const localAudioTrackRef = useRef(null);
    const endCallRef = useRef(null);
    const myUserIdRef = useRef(null);
    const startTimeRef = useRef(null);
    const ringTimerRef = useRef(null);
    const joiningRef = useRef(false);
    const logSentRef = useRef(false);
    const callStatusRef = useRef('idle');

    useEffect(() => {
        myUserIdRef.current = user?.userId || user?.id;
    }, [user]);

    useEffect(() => {
        callStatusRef.current = callStatus;
    }, [callStatus]);

    useEffect(() => {
        if (callStatus === 'connected') {
            if (!startTimeRef.current) startTimeRef.current = Date.now();
            const updateTimer = () => {
                if (startTimeRef.current) {
                    setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
                }
            };
            updateTimer();
            timerRef.current = setInterval(updateTimer, 1000);
        } else {
            if (timerRef.current) clearInterval(timerRef.current);
            if (callStatus === 'idle' || callStatus === 'ended') startTimeRef.current = null;
        }
        return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }, [callStatus]);

    useEffect(() => {
        if (callStatus === 'incoming') ringtoneService.playIncoming();
        else if (callStatus === 'outgoing') ringtoneService.playOutgoing();
        else ringtoneService.stop();
        return () => ringtoneService.stop();
    }, [callStatus]);

    useEffect(() => {
        if (callStatus === 'outgoing') {
            ringTimerRef.current = setTimeout(() => {
                ringtoneService.playUnreachable();
                endCallRef.current?.(true, 'MISSED');
            }, 60000);
        } else {
            if (ringTimerRef.current) clearTimeout(ringTimerRef.current);
        }
        return () => { if (ringTimerRef.current) clearTimeout(ringTimerRef.current); };
    }, [callStatus]);

    const formatDuration = useCallback(() => {
        const m = Math.floor(duration / 60);
        const s = duration % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    }, [duration]);

    const cleanupTracks = useCallback(async () => {
        if (localVideoTrackRef.current) {
            localVideoTrackRef.current.stop();
            localVideoTrackRef.current.close();
            localVideoTrackRef.current = null;
        }
        if (localAudioTrackRef.current) {
            localAudioTrackRef.current.stop();
            localAudioTrackRef.current.close();
            localAudioTrackRef.current = null;
        }
        setLocalVideoTrack(null);
        setLocalAudioTrack(null);
        setRemoteUsers([]);
        if (agoraClient.connectionState !== 'DISCONNECTED' && agoraClient.connectionState !== 'DISCONNECTING') {
            try { await agoraClient.leave(); } catch (e) { console.warn('[Agora] Leave error:', e); }
        }
        activeChannelRef.current = null;
    }, []);

    const endCall = useCallback(async (emit = true, reason = 'ENDED') => {
        const cid = activeChannelRef.current || conversationId;
        let callDuration = 0;
        if (startTimeRef.current) callDuration = Math.floor((Date.now() - startTimeRef.current) / 1000);

        if (emit && cid) {
            console.log('[Agora] Sending HANGUP to:', cid, 'Reason:', reason);
            emitCallSignal(cid, { type: 'HANGUP', reason });
        }

        const isCaller = !incomingSignal;
        const isManual = emit;
        const shouldLog = isManual || (isCaller && (reason === 'MISSED' || reason === 'REJECTED' || reason === 'UNREACHABLE' || reason === 'BUSY'));

        if (cid && shouldLog && !logSentRef.current && ['connected', 'outgoing', 'incoming'].includes(callStatus)) {
            logSentRef.current = true;
            try {
                let statusStr = (callDuration > 0 && callStatus === 'connected') ? 'SUCCESS' : (reason === 'REJECTED' ? 'REJECTED' : 'MISSED');
                const content = JSON.stringify({ callType: callType || 'audio', duration: callDuration, status: statusStr });
                chatApi.sendMessage({ conversationId: cid, content, type: 'CALL_LOG' });
            } catch (err) { console.error('[Agora] Log error:', err); }
        }

        const remoteContainer = document.getElementById('remote-player-container');
        if (remoteContainer) remoteContainer.innerHTML = '';
        await cleanupTracks();

        joiningRef.current = false;
        setIncomingSignal(null);
        setCallStatus('ended');
        
        if (reason === 'REJECTED') setEndCallReason('Người nghe đã từ chối cuộc gọi');
        else if (reason === 'BUSY') setEndCallReason('Người nghe đang bận');
        else if (reason === 'MISSED') setEndCallReason('Cuộc gọi nhỡ');
        else setEndCallReason('Cuộc gọi đã kết thúc');

        setTimeout(() => {
            setCallStatus('idle');
            setEndCallReason(null);
            setDuration(0);
            setMicOn(true);
            setCamOn(true);
            logSentRef.current = false;
        }, 2000);
    }, [conversationId, cleanupTracks, callStatus, callType, incomingSignal]);

    endCallRef.current = endCall;

    useEffect(() => {
        const updateRemoteUsers = () => setRemoteUsers(Array.from(agoraClient.remoteUsers));
        const handleUserPublished = async (remoteUser, mediaType) => {
            console.log('[Agora] Remote user published:', remoteUser.uid, mediaType);
            await agoraClient.subscribe(remoteUser, mediaType);
            
            if (mediaType === 'audio' && remoteUser.audioTrack) {
                remoteUser.audioTrack.setVolume(100);
                remoteUser.audioTrack.play().catch(err => {
                    console.error('[Agora] Play audio failed:', err);
                    if (err.name === 'NotAllowedError' || err.message?.includes('autoplay')) {
                        setAudioBlocked(true);
                    }
                });
            }
            
            updateRemoteUsers();
            
            if (callStatusRef.current !== 'connected' && callStatusRef.current !== 'ended') {
                setCallStatus('connected');
                if (!startTimeRef.current) startTimeRef.current = Date.now();
            }
        };

        const handleUserUnpublished = (remoteUser, mediaType) => {
            updateRemoteUsers();
        };
        const handleUserLeft = (remoteUser) => {
            updateRemoteUsers();
            if (callStatusRef.current === 'connected' && agoraClient.remoteUsers.length === 0) {
                console.log('[Agora] Last remote user left, auto-hanging up...');
                endCallRef.current?.(false, 'ENDED');
            }
        };
        agoraClient.on('user-published', handleUserPublished);
        agoraClient.on('user-unpublished', handleUserUnpublished);
        agoraClient.on('user-left', handleUserLeft);
        return () => {
            agoraClient.off('user-published', handleUserPublished);
            agoraClient.off('user-unpublished', handleUserUnpublished);
            agoraClient.off('user-left', handleUserLeft);
        };
    }, [callStatus]);

    const connect = useCallback(() => {
        const handler = async (data) => {
            const actualData = data?.payload || data;
            const { signal, senderId } = actualData || {};
            const cid = String(data?.conversationId || actualData?.conversationId || '');
            const myId = String(myUserIdRef.current || '');
            
            if (senderId === myId || !signal) return;

            console.log('[Agora] Signal:', signal.type, 'from:', senderId, 'on CID:', cid);

            if (signal.type === 'CALL_INVITE') {
                if (callStatusRef.current !== 'idle') {
                    emitCallSignal(cid, { type: 'HANGUP', reason: 'BUSY' });
                    return;
                }
                activeChannelRef.current = cid;
                setIncomingSignal({ ...actualData, conversationId: cid });
                setCallerName(actualData.senderName || senderId);
                setCallerId(senderId);
                setCallType(signal.callType || 'video');
                setCallStatus('incoming');
            } else if (signal.type === 'HANGUP') {
                const activeCid = String(activeChannelRef.current || '');
                const incomingCid = String(cid);
                const reason = signal.reason || actualData.reason || 'ENDED';
                console.log('[Agora] HANGUP received. Incoming CID:', incomingCid, 'Active CID:', activeCid, 'Reason:', reason);
                
                if ((incomingCid === activeCid || sanitizeChannelId(incomingCid) === sanitizeChannelId(activeCid)) && 
                    callStatusRef.current !== 'idle' && callStatusRef.current !== 'ended') {
                    endCallRef.current?.(false, reason);
                }
            } else if (signal.type === 'CALL_ACCEPTED') {
                setCallStatus('connected');
                if (!startTimeRef.current) startTimeRef.current = Date.now();
            }
        };
        onCallSignal(handler);
        return () => offCallSignal(handler);
    }, []);

    const startCall = useCallback(async (type = 'video') => {
        if (!conversationId || joiningRef.current) return;
        try {
            joiningRef.current = true;
            logSentRef.current = false;
            setError(null);
            setEndCallReason(null);
            setCallType(type);
            setMicOn(true);
            setCamOn(type === 'video');
            activeChannelRef.current = conversationId;
            setCallStatus('outgoing');

            const safeChannelId = sanitizeChannelId(conversationId);
            const res = await callApi.getAgoraToken(safeChannelId);
            const { token, appId, uid: originalUid } = res;
            const joinUid = toNumericUid(originalUid, true); // true = isCaller

            emitCallSignal(conversationId, { 
                type: 'CALL_INVITE', callType: type,
                senderAvatar: user?.avatar || user?.avatarUrl
            }, user?.fullName || 'Người dùng');

            const audioTrack = await AgoraRTC.createMicrophoneAudioTrack();
            let videoTrack = null;
            if (type === 'video') {
                videoTrack = await AgoraRTC.createCameraVideoTrack({
                    encoderConfig: { width: 640, height: 480, frameRate: 15, bitrateMin: 200, bitrateMax: 500 }
                }).catch(e => { setCameraError(e.message); return null; });
            }

            localAudioTrackRef.current = audioTrack;
            localVideoTrackRef.current = videoTrack;
            setLocalAudioTrack(audioTrack);
            setLocalVideoTrack(videoTrack);

            await agoraClient.join(appId, safeChannelId, token || null, joinUid);
            await agoraClient.publish([audioTrack, videoTrack].filter(Boolean));
            setCamOn(type === 'video' && !!videoTrack);
        } catch (e) {
            setError(e.message);
            await endCallRef.current?.(false);
        } finally { joiningRef.current = false; }
    }, [conversationId, user]);

    const acceptCall = useCallback(async (signalData) => {
        if (joiningRef.current) return;
        try {
            joiningRef.current = true;
            logSentRef.current = false;
            setError(null);
            setEndCallReason(null);
            const channelId = signalData?.conversationId;
            const actualCallType = signalData?.signal?.callType || callType;
            setMicOn(true);
            setCamOn(actualCallType === 'video');
            if (!channelId) throw new Error('Missing conversationId');
            activeChannelRef.current = channelId;
            const safeChannelId = sanitizeChannelId(channelId);

            emitCallSignal(channelId, { type: 'CALL_ACCEPTED', startTime: Date.now() }, user?.fullName || 'Người dùng');
            setCallStatus('connected');

            const res = await callApi.getAgoraToken(safeChannelId);
            const joinUid = toNumericUid(res.uid, false); // false = isReceiver

            await agoraClient.join(res.appId, safeChannelId, res.token || null, joinUid);
            const audioTrack = await AgoraRTC.createMicrophoneAudioTrack();
            let videoTrack = null;
            if (actualCallType === 'video') {
                videoTrack = await AgoraRTC.createCameraVideoTrack({
                    encoderConfig: { width: 640, height: 480, frameRate: 15, bitrateMin: 200, bitrateMax: 500 }
                }).catch(e => { setCameraError(e.message); return null; });
            }

            localAudioTrackRef.current = audioTrack;
            localVideoTrackRef.current = videoTrack;
            setLocalAudioTrack(audioTrack);
            setLocalVideoTrack(videoTrack);

            await agoraClient.publish([audioTrack, videoTrack].filter(Boolean));
            setCamOn(actualCallType === 'video' && !!videoTrack);
            setIncomingSignal(null);
        } catch (e) {
            setError(e.message);
            await endCallRef.current?.(false);
        } finally { joiningRef.current = false; }
    }, [user, callType]);

    const toggleMic = useCallback(async (enabled) => {
        setMicOn(enabled);
        if (localAudioTrackRef.current) await localAudioTrackRef.current.setEnabled(enabled);
    }, []);

    const toggleCamera = useCallback(async (enabled) => {
        setCamOn(enabled);
        if (localVideoTrackRef.current) {
            await localVideoTrackRef.current.setEnabled(enabled);
        } else if (enabled) {
            try {
                const videoTrack = await AgoraRTC.createCameraVideoTrack({
                    encoderConfig: { width: 640, height: 480, frameRate: 15, bitrateMin: 200, bitrateMax: 500 }
                });
                localVideoTrackRef.current = videoTrack;
                setLocalVideoTrack(videoTrack);
                await agoraClient.publish(videoTrack);
            } catch (e) {
                setCameraError(e.message);
                setCamOn(false);
            }
        }
    }, []);

    const resumeAudio = useCallback(async () => {
        try {
            await AgoraRTC.getAudioContext().resume();
            remoteUsers.forEach(u => u.audioTrack?.play());
            setAudioBlocked(false);
        } catch (e) { console.error(e); }
    }, [remoteUsers]);

    return {
        callStatus, callerName, callerId, incomingSignal, callType, cameraError, error, duration,
        formatDuration, audioBlocked, endCallReason, localVideoTrack, localAudioTrack, remoteUsers,
        startCall, acceptCall, endCall, connect, toggleMic, toggleCamera, resumeAudio, micOn, camOn
    };
};

export default useAgoraCall;
