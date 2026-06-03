import AgoraRTC from 'agora-rtc-sdk-ng';
import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { onCallSignal, offCallSignal, emitCallSignal } from '../utils/socket';
import { callApi } from '../api/callApi';
import { ringtoneService } from '../utils/RingtoneService';
import { chatApi } from '../api/chatApi';

// ─── Agora Client (singleton toàn app) ────────────────────────────────────────
const agoraClient = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });

const sanitizeChannelId = (id) => {
    if (!id) return '';
    const clean = String(id).replace(/#/g, '-');
    const parts = clean.split('-');

    // CHỈ sắp xếp nếu là ID ghép của cuộc gọi 1-1 (SINGLE-...) hoặc Group composite (GROUP-...)
    if (parts.length > 1 && (parts[0] === 'SINGLE' || parts[0] === 'GROUP')) {
        const prefix = parts[0];
        const sortedIds = parts.slice(1).sort();
        return (prefix + '-' + sortedIds.join('-')).slice(0, 64);
    }

    // Nếu là ID thông thường (UUID), giữ nguyên dấu gạch ngang và thứ tự
    return clean.slice(0, 64);
};

const toNumericUid = (userId) => {
    if (!userId) return Math.floor(Math.random() * 1000000);
    if (typeof userId === 'number') return userId;
    let hash = 0;
    const s = String(userId);
    for (let i = 0; i < s.length; i++) {
        hash = ((hash << 5) - hash + s.charCodeAt(i)) | 0;
    }
    return Math.abs(hash);
};

AgoraRTC.setLogLevel(1);

let serverTimeOffset = 0; // localTime - serverTime
let isCalibratingTime = false;

const getTrueTime = () => Date.now() - serverTimeOffset;

async function calibrateServerTime() {
    if (isCalibratingTime) return;
    isCalibratingTime = true;
    try {
        const start = Date.now();
        const res = await callApi.getServerTime();
        const end = Date.now();
        const latency = (end - start) / 2; // RTT latency correction
        const serverTime = res.serverTime || res.data?.serverTime || res;
        if (serverTime) {
            serverTimeOffset = end - (serverTime + latency);
            console.log('⏰ [TimeSync-Web] Calibrated offset:', serverTimeOffset, 'ms (latency:', latency, 'ms)');
        }
    } catch (e) {
        console.warn('⏰ [TimeSync-Web] Calibration failed:', e);
    } finally {
        isCalibratingTime = false;
    }
}

export const useAgoraCall = (conversationId, activeConversation = null, isListener = true) => {
    const { t } = useTranslation();
    const { user } = useSelector((state) => state.auth);
    const { conversations, friends } = useSelector((state) => state.chat);
    const myId = user?.userId || user?.id;
    const dispatch = useDispatch();

    const activeConversationRef = useRef(activeConversation);
    useEffect(() => {
        activeConversationRef.current = activeConversation;
    }, [activeConversation]);

    const [callStatus, setCallStatus] = useState('idle');
    const [incomingSignal, setIncomingSignal] = useState(null);
    const [callerId, setCallerId] = useState(null);
    const callerIdRef = useRef(null);
    const [callerName, setCallerName] = useState(null);
    const [callerAvatar, setCallerAvatar] = useState(null);
    const [error, setError] = useState(null);
    const [endCallReason, setEndCallReason] = useState(null);
    const [callType, setCallType] = useState('video');
    const [cameraError, setCameraError] = useState(null);
    const [remoteUsers, setRemoteUsers] = useState([]);
    const [audioBlocked, setAudioBlocked] = useState(false);
    const [duration, setDuration] = useState(0);
    const [ringDuration, setRingDuration] = useState(0);
    const [micOn, setMicOn] = useState(true);
    const [camOn, setCamOn] = useState(true);
    const [speakingUsers, setSpeakingUsers] = useState({}); // { uid: boolean }

    const remoteUserId = useMemo(() => {
        if (!activeConversation || activeConversation.isGroup || activeConversation.type === 'GROUP') return null;
        const other = activeConversation.members?.find(m => String(m.userId) !== String(myId));
        return other?.userId || other?.id;
    }, [activeConversation, myId]);

    const [isGroup, setIsGroup] = useState(false);
    const [userLeftMsg, setUserLeftMsg] = useState(null);

    const [localVideoTrack, setLocalVideoTrack] = useState(null);
    const [localAudioTrack, setLocalAudioTrack] = useState(null);

    const [activeCallCid, setActiveCallCid] = useState(null);
    const activeChannelRef = useRef(null);
    const timerRef = useRef(null);
    const localVideoTrackRef = useRef(null);
    const localAudioTrackRef = useRef(null);
    const endCallRef = useRef(null);
    const myUserIdRef = useRef(null);
    const startTimeRef = useRef(null);
    const isInitiatorRef = useRef(false);
    const ringTimerRef = useRef(null);
    const lastLogCidRef = useRef(null);
    const joiningRef = useRef(false);
    const ongoingLogSentRef = useRef(false);
    const terminalLogSentRef = useRef(false);
    const isEndingRef = useRef(false);
    const hasHadRemoteRef = useRef(false);
    const currentJoinUidRef = useRef(null);
    const callStatusRef = useRef('idle');
    const callIsGroupRef = useRef(false);
    const remoteUserIdRef = useRef(null);
    const leftUsersRef = useRef(new Set());
    const joinTimeRef = useRef(0);

    useEffect(() => {
        calibrateServerTime();
    }, []);

    useEffect(() => {
        myUserIdRef.current = user?.userId || user?.id;
    }, [user]);

    useEffect(() => {
        callStatusRef.current = callStatus;
    }, [callStatus]);

    useEffect(() => {
        callIsGroupRef.current = isGroup;
    }, [isGroup]);

    useEffect(() => {
        callerIdRef.current = callerId;
    }, [callerId]);

    useEffect(() => {
        if (callStatus === 'connected') {
            if (!startTimeRef.current) startTimeRef.current = getTrueTime();
            const updateTimer = () => {
                if (startTimeRef.current) {
                    setDuration(Math.floor((getTrueTime() - startTimeRef.current) / 1000));
                }
            };
            updateTimer();
            timerRef.current = setInterval(updateTimer, 1000);

            // THÊM: Timeout cho cuộc gọi Nhóm khi chưa có ai vào
            if (isGroup && remoteUsers.length === 0) {
                setRingDuration(0);
                const startRing = Date.now();
                if (ringTimerRef.current) clearInterval(ringTimerRef.current);
                ringTimerRef.current = setInterval(() => {
                    const elapsed = Math.floor((Date.now() - startRing) / 1000);
                    setRingDuration(elapsed);
                    if (elapsed >= 30) {
                        console.log('[Agora] Group waiting timeout reached. Ending call...');
                        endCallRef.current?.(true, 'MISSED');
                    }
                }, 1000);
            }
        } else if (callStatus === 'outgoing' || callStatus === 'incoming') {
            setRingDuration(0);
            const startRing = Date.now();
            if (ringTimerRef.current) clearInterval(ringTimerRef.current);
            ringTimerRef.current = setInterval(() => {
                const elapsed = Math.floor((Date.now() - startRing) / 1000);
                setRingDuration(elapsed);
                if (elapsed >= 30) {
                    console.log('[Agora] Ringing timeout reached. Ending call...');
                    endCallRef.current?.(true, 'MISSED');
                }
            }, 1000);
        } else {
            if (timerRef.current) clearInterval(timerRef.current);
            if (ringTimerRef.current) clearInterval(ringTimerRef.current);
            if (callStatus === 'idle' || callStatus === 'ended') {
                startTimeRef.current = null;
                setRingDuration(0);
            }
        }
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
            if (ringTimerRef.current) clearInterval(ringTimerRef.current);
        };
    }, [callStatus]);

    useEffect(() => {
        if (callStatus === 'incoming') ringtoneService.playIncoming();
        else if (callStatus === 'outgoing') ringtoneService.playOutgoing();
        else if (callStatus === 'connected' || callStatus === 'idle') ringtoneService.stop();

        return () => {
            // Khi unmount hoặc đổi trạng thái mà KHÔNG PHẢI kết thúc, mới dừng hẳn âm thanh
            if (callStatus !== 'ended') ringtoneService.stop();
        };
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
        if (isEndingRef.current) return;
        isEndingRef.current = true;

        if (ringTimerRef.current) {
            clearInterval(ringTimerRef.current);
            ringTimerRef.current = null;
        }
        setRingDuration(0);

        const cid = activeChannelRef.current || conversationId;
        let callDuration = 0;
        if (startTimeRef.current) callDuration = Math.floor((getTrueTime() - startTimeRef.current) / 1000);

        const isActuallyGroup = callIsGroupRef.current ||
            String(cid).startsWith('GROUP#') ||
            String(cid).includes('GROUP');

        const isLastPerson = isActuallyGroup ? (remoteUsers.length === 0) : true;

        if (emit && cid) {
            if (isActuallyGroup) {
                const isCancelingBeforeJoin = isInitiatorRef.current && !hasHadRemoteRef.current;
                if (isCancelingBeforeJoin) {
                    console.log('[Agora] Initiator canceling group call:', cid);
                    emitCallSignal(cid, { type: 'HANGUP', reason: 'ENDED' });
                } else if (callStatus === 'connected') {
                    console.log('[Agora] Participant leaving group call:', cid);
                    emitCallSignal(cid, {
                        type: 'LEAVE',
                        senderName: user?.fullName || t('chat.member')
                    });
                }
                // Nếu callStatus là 'incoming' (người nghe từ chối cuộc gọi đến), ta không gửi bất kỳ tín hiệu nào để tránh tắt màn hình của người khác.
            } else {
                console.log('[Agora] Sending HANGUP signal for session:', cid);
                emitCallSignal(cid, { type: 'HANGUP', reason });
            }
        }


        const isCaller = isInitiatorRef.current;
        const isSuccessReason = (reason === 'ENDED' || reason === 'SUCCESS') && (isGroup ? hasHadRemoteRef.current : true);
        let shouldLog = isSuccessReason ? isLastPerson : isCaller;


        if (cid && !terminalLogSentRef.current &&
            ['connected', 'outgoing', 'incoming'].includes(callStatus) &&
            callStatus !== 'ended' && callStatus !== 'idle') {
            if (shouldLog) {
                terminalLogSentRef.current = true;
                lastLogCidRef.current = cid;
                try {
                    const hasOthers = agoraClient.remoteUsers.length > 0;
                    const everHadOthers = hasHadRemoteRef.current;

                    // Nhóm: Chỉ coi là SUCCESS nếu thực sự có người khác đã tham gia. Ngược lại là MISSED.
                    const actuallyStarted = isGroup
                        ? everHadOthers
                        : (callDuration > 0 || startTimeRef.current !== null || callStatus === 'connected');

                    let statusStr = 'MISSED';
                    if (actuallyStarted) {
                        statusStr = 'SUCCESS';
                    } else if (reason === 'REJECTED' || reason === 'BUSY') {
                        statusStr = reason;
                    }


                    const content = JSON.stringify({ callType: callType || 'audio', duration: callDuration, status: statusStr });
                    chatApi.sendMessage({ conversationId: cid, content, type: 'CALL_LOG' })
                        .catch(err => console.error('[Agora] Failed to send final log (async):', err));
                } catch (err) { console.error('[Agora] Log error:', err); }
            }
        }

        const remoteContainer = document.getElementById('remote-player-container');
        if (remoteContainer) remoteContainer.innerHTML = '';
        await cleanupTracks();

        joiningRef.current = false;

        // Phát âm thanh bận/kết thúc nếu cần
        if (reason === 'BUSY' || reason === 'MISSED') {
            ringtoneService.playBusy();
        }

        setCallStatus('ended');

        if (reason === 'REJECTED') setEndCallReason(t('chat.rejected'));
        else if (reason === 'BUSY') setEndCallReason(t('chat.busy'));
        else if (reason === 'MISSED') setEndCallReason(t('chat.missed_call'));
        else if (reason === 'ACCEPTED_ELSEWHERE') setEndCallReason(t('chat.accepted_elsewhere'));
        else setEndCallReason(t('chat.ended'));

        const delay = reason === 'ACCEPTED_ELSEWHERE' ? 0 : 800;
        // Giảm thời gian chờ đóng UI xuống còn 800ms để mượt hơn
        setTimeout(() => {
            setCallStatus('idle');
            setIncomingSignal(null);
            setEndCallReason(null);
            setDuration(0);
            setMicOn(true);
            setCamOn(true);
            setCallerId(null);
            setCallerName(null);
            setCallerAvatar(null);
            isEndingRef.current = false;

            // Reset Refs
            startTimeRef.current = null;
            isInitiatorRef.current = false;
            callIsGroupRef.current = false;
            activeChannelRef.current = null;
            setActiveCallCid(null);
            ongoingLogSentRef.current = false;
            terminalLogSentRef.current = false;
            hasHadRemoteRef.current = false;
        }, delay);

    }, [conversationId, cleanupTracks, callStatus, callType, incomingSignal, remoteUsers, user, isGroup]);


    endCallRef.current = endCall;

    const updateRemoteUsers = () => {
        const activeUsers = Array.from(agoraClient.remoteUsers).filter(u => {
            const uNum = Number(u.uid);
            return !leftUsersRef.current.has(uNum);
        });
        setRemoteUsers(activeUsers);
    };

    useEffect(() => {
        if (remoteUsers.length > 0 && ringTimerRef.current) {
            console.log('[Agora] First participant joined group, clearing waiting timer.');
            clearInterval(ringTimerRef.current);
            ringTimerRef.current = null;
            setRingDuration(0);
        }
    }, [remoteUsers.length]);

    useEffect(() => {
        const handleUserJoined = (remoteUser) => {
            console.log('[Agora] Remote user joined:', remoteUser.uid);
            
            const incomingUid = Number(remoteUser.uid);
            leftUsersRef.current.delete(incomingUid);

            // Bắn thông báo tham gia phòng với tên đầy đủ
            let member = null;
            const activeConv = activeConversationRef.current;
            if (activeConv) {
                member = activeConv.members?.find(m => {
                    const mid = String(m.userId || m.id || m._id);
                    const webUid = toNumericUid(mid);
                    const mobileUid = toNumericUid(mid + '_mobile');
                    return webUid === incomingUid || mobileUid === incomingUid;
                });
            }

            if (!member && conversations) {
                for (const conv of conversations) {
                    const found = conv.members?.find(m => {
                        const mid = String(m.userId || m.id || m._id);
                        const webUid = toNumericUid(mid);
                        const mobileUid = toNumericUid(mid + '_mobile');
                        return webUid === incomingUid || mobileUid === incomingUid;
                    });
                    if (found) {
                        member = found;
                        break;
                    }
                }
            }

            if (member) {
                const mid = String(member.userId || member.id || member._id);
                leftUsersRef.current.delete(toNumericUid(mid));
                leftUsersRef.current.delete(toNumericUid(mid + '_mobile'));
            }

            updateRemoteUsers();
            hasHadRemoteRef.current = true;

            const userName = member?.fullName || member?.name || t('chat.member');
            
            const timeSinceJoin = Date.now() - (joinTimeRef.current || 0);
            if (timeSinceJoin > 2000) {
                setUserLeftMsg(t('chat.user_joined', { name: userName }));
                setTimeout(() => {
                    setUserLeftMsg(prev => (prev && prev.includes(userName) && (prev.includes('tham gia') || prev.includes('joined')) ? null : prev));
                }, 3000);
            }
        };

        const handleUserPublished = async (remoteUser, mediaType) => {
            console.log('[Agora] Remote user published:', remoteUser.uid, mediaType);
            leftUsersRef.current.delete(Number(remoteUser.uid));

            // Cập nhật UI ngay lập tức để hiển thị avatar thành viên, tránh bị kẹt màn hình chờ
            updateRemoteUsers();
            hasHadRemoteRef.current = true;

            if (callStatusRef.current !== 'connected' && callStatusRef.current !== 'ended') {
                setCallStatus('connected');
                if (!startTimeRef.current) startTimeRef.current = getTrueTime();
            }

            // Thực hiện đăng ký subscribe bất đồng bộ dưới nền
            try {
                await agoraClient.subscribe(remoteUser, mediaType);
                console.log(`[Agora] Subscribed successfully to ${remoteUser.uid} (${mediaType})`);

                if (mediaType === 'audio' && remoteUser.audioTrack) {
                    remoteUser.audioTrack.setVolume(150);
                    remoteUser.audioTrack.play().catch(err => {
                        console.error('[Agora] Play audio failed:', err);
                        if (err.name === 'NotAllowedError' || err.message?.includes('autoplay')) {
                            setAudioBlocked(true);
                        }
                    });
                }
                
                // Cập nhật lại UI sau khi đã subscribe xong để nhận track mới
                updateRemoteUsers();
            } catch (err) {
                console.error('[Agora] Failed to subscribe to remote track:', err);
            }
        };

        const handleUserUnpublished = (remoteUser, mediaType) => {
            updateRemoteUsers();
        };
        const handleUserLeft = (remoteUser) => {
            updateRemoteUsers();

            // Cực kỳ cẩn thận: Kiểm tra loại cuộc gọi từ nhiều nguồn để không tắt máy nhầm cho Nhóm
            const isGroup = callIsGroupRef.current ||
                String(activeChannelRef.current).startsWith('GROUP#') ||
                String(activeChannelRef.current).includes('GROUP');

            console.log('[Agora] User left:', remoteUser.uid, 'isGroup:', isGroup, 'remaining:', agoraClient.remoteUsers.length);

            // Tự động tắt máy nếu không còn ai trong phòng (áp dụng cho cả 1-1 và Nhóm)
            // Đối với nhóm, nếu mình là người cuối cùng, bắt đầu đếm ngược 30s để tự đóng hoặc chờ người mới
            if (agoraClient.remoteUsers.length === 0 && callStatusRef.current === 'connected') {
                if (!isGroup) {
                    console.log('[Agora] 1-1 partner left, auto-hanging up...');
                    endCallRef.current?.(false, 'ENDED');
                } else {
                    console.log('[Agora] Last person left group, starting 30s idle timeout...');
                    if (ringTimerRef.current) clearInterval(ringTimerRef.current);
                    setRingDuration(0);
                    const startRing = Date.now();
                    ringTimerRef.current = setInterval(() => {
                        const elapsed = Math.floor((Date.now() - startRing) / 1000);
                        setRingDuration(elapsed);
                        if (elapsed >= 30) {
                            clearInterval(ringTimerRef.current);
                            endCallRef.current?.(true, 'ENDED');
                        }
                    }, 1000);
                }
            }
        };
        agoraClient.on('user-joined', handleUserJoined);
        agoraClient.on('user-published', handleUserPublished);
        agoraClient.on('user-unpublished', handleUserUnpublished);
        agoraClient.on('user-left', handleUserLeft);

        // Quan trọng: Kiểm tra ngay lập tức các user đã có sẵn trong phòng
        if (agoraClient.remoteUsers.length > 0) hasHadRemoteRef.current = true;
        updateRemoteUsers();

        // --- VOLUME INDICATOR: Phát hiện ai đang nói ---
        agoraClient.enableAudioVolumeIndicator();
        const handleVolumeIndicator = (volumes) => {
            const speakingMap = {};
            volumes.forEach((volume) => {
                if (volume.level > 0.5) { // Cực kỳ nhạy
                    const actualUid = volume.uid === 0 ? currentJoinUidRef.current : volume.uid;
                    speakingMap[actualUid] = true;
                }
            });
            setSpeakingUsers(speakingMap);
        };
        agoraClient.on('volume-indicator', handleVolumeIndicator);

        return () => {
            agoraClient.off('user-joined', handleUserJoined);
            agoraClient.off('user-published', handleUserPublished);
            agoraClient.off('user-unpublished', handleUserUnpublished);
            agoraClient.off('user-left', handleUserLeft);
            agoraClient.off('volume-indicator', handleVolumeIndicator);
        };
    }, [callStatus, myId]);

    const connect = useCallback(() => { return () => { }; }, []);

    useEffect(() => {
        console.log('[Agora] 🔄 Signal listener (re)initialized. MyId:', myId);
        if (!isListener) return;

        const handler = (actualData) => {
            const { signal, senderId, conversationId: cid } = actualData;

            if (!signal) return;

            // Log mọi tín hiệu nhận được để debug
            console.log(`[Agora] 📡 Signal Received: ${signal.type} | From: ${senderId} | MyId: ${myId} | CID: ${cid}`);

            // Logic đồng bộ đa thiết bị: Cho phép xử lý HANGUP/LEAVE/ACCEPTED từ chính mình (thiết bị khác)
            // nhưng vẫn lờ đi CALL_INVITE từ chính mình để tránh đổ chuông tất cả thiết bị khi mình gọi.
            if (String(senderId) === String(myId)) {
                if (signal.type !== 'HANGUP' && signal.type !== 'LEAVE' && signal.type !== 'CALL_ACCEPTED') {
                    return;
                }
                console.log(`[Agora] Processing self-sync signal: ${signal.type}`);
            }


            if (signal.type === 'CALL_INVITE') {
                if (callStatusRef.current !== 'idle') {
                    emitCallSignal(cid, { type: 'HANGUP', reason: 'BUSY' });
                    return;
                }
                activeChannelRef.current = cid;
                setActiveCallCid(cid);
                const isGroup = cid.startsWith('GROUP#') || cid.includes('GROUP') ||
                    actualData.conversationType === 'GROUP' ||
                    signal.conversationType === 'GROUP' ||
                    signal.isGroup === true;

                callIsGroupRef.current = isGroup;
                setIsGroup(isGroup);

                setIncomingSignal({
                    ...actualData,
                    conversationId: cid,
                    isGroup: isGroup,
                    conversationType: isGroup ? 'GROUP' : 'SINGLE',
                    conversationName: signal.conversationName, // Lưu tên nhóm từ tín hiệu
                    conversationAvatar: signal.conversationAvatar, // Lưu avatar nhóm từ tín hiệu
                    inviteTime: signal.inviteTime || actualData.inviteTime || getTrueTime()
                });

                isInitiatorRef.current = false;
                setCallerName(actualData.senderName || senderId);
                setCallerId(senderId);
                setCallerAvatar(signal.senderAvatar || actualData.senderAvatar || null);
                callerIdRef.current = senderId;
                remoteUserIdRef.current = senderId;
                setCallType(signal.callType || 'video');
                setCallStatus('incoming');
            } else if (signal.type === 'HANGUP' || signal.type === 'LEAVE') {
                const activeCid = String(activeChannelRef.current || '');
                const incomingCid = String(cid);
                const reason = signal.reason || actualData.reason || 'ENDED';
                const isGroup = activeCid.includes('GROUP') || incomingCid.includes('GROUP') || callIsGroupRef.current;

                console.log(`[Agora] 📩 Signal ${signal.type} received from ${senderId}. isGroup:`, isGroup);
                const isPartnerSignal = !isGroup && remoteUserIdRef.current && String(senderId) === String(remoteUserIdRef.current);
                const isSelfSync = String(senderId) === String(myId);

                // CID MATCH LOGIC:
                const sIncoming = sanitizeChannelId(incomingCid);
                const sActive = sanitizeChannelId(activeCid);
                const rawIncoming = incomingCid.replace('SINGLE#', '').replace('GROUP#', '').replace('SINGLE-', '').replace('GROUP-', '');
                const rawActive = activeCid.replace('SINGLE#', '').replace('GROUP#', '').replace('SINGLE-', '').replace('GROUP-', '');

                const cidMatch = (incomingCid === activeCid) || (sIncoming === sActive) || (rawIncoming === rawActive);

                // Nếu là tín hiệu HANGUP/LEAVE/ACCEPTED từ chính mình (đồng bộ thiết bị) thì ta chỉ chấp nhận khi khớp CID đang diễn ra
                const shouldProcess = cidMatch || isPartnerSignal || (isSelfSync && cidMatch && (signal.type === 'HANGUP' || signal.type === 'LEAVE' || signal.type === 'CALL_ACCEPTED'));

                if (!shouldProcess) {
                    console.log('[Agora] Signal CID mismatch, ignoring. Cleaned Incoming:', sIncoming, 'Cleaned Active:', sActive, 'isPartner:', isPartnerSignal);
                    return;
                }


                const isGroupMode = callIsGroupRef.current;

                // TRƯỜNG HỢP GỌI NHÓM: Phản hồi tức thì khi có người thoát
                if (isGroupMode && callStatusRef.current === 'connected') {
                    console.log(`[Agora] ⚡ Processing group LEAVE/HANGUP from ${senderId}`);
                    const numericUid = toNumericUid(senderId);
                    const mobileUid = toNumericUid(senderId + '_mobile');

                    // Lưu vào danh sách các UID đã chủ động rời phòng
                    leftUsersRef.current.add(numericUid);
                    leftUsersRef.current.add(mobileUid);

                    // Xóa user khỏi danh sách hiển thị ngay lập tức (không chờ Agora timeout 20s)
                    updateRemoteUsers();

                    if (signal.type === 'LEAVE' || signal.type === 'HANGUP') {
                        const userName = signal.senderName || t('chat.member');
                        setUserLeftMsg(t('chat.user_left', { name: userName }));
                        setTimeout(() => setUserLeftMsg(prev => (prev && prev.includes(userName) && (prev.includes('rời phòng') || prev.includes('left')) ? null : prev)), 3000);
                        return; // Chỉ thoát sớm nếu là LEAVE/HANGUP của nhóm
                    }
                }

                if (callStatusRef.current !== 'idle' && callStatusRef.current !== 'ended') {
                    if (isGroupMode) {
                        // Nếu đang trong cuộc gọi nhóm (connected), ta lờ đi tín hiệu HANGUP/LEAVE từ initiator
                        // Chỉ kết thúc nếu mình chưa vào phòng (đang chờ/đổ chuông)
                        const initiatorId = callerIdRef.current || incomingSignal?.senderId || callerId;
                        const isFromInitiator = initiatorId && String(senderId) === String(initiatorId);
                        if (callStatusRef.current !== 'connected' && (isFromInitiator || (isSelfSync && cidMatch))) {
                            endCallRef.current?.(false, 'ENDED');
                        }
                    } else {
                        endCallRef.current?.(false, reason);
                    }
                }



            } else if (signal.type === 'CALL_ACCEPTED') {
                const isSelfSync = String(senderId) === String(myId);

                // CHỈ xóa ringTimer nếu mình là người gọi (outgoing) hoặc tự đồng bộ thiết bị khác của mình (isSelfSync)
                if (callStatusRef.current === 'outgoing' || isSelfSync) {
                    if (ringTimerRef.current) {
                        clearTimeout(ringTimerRef.current);
                        ringTimerRef.current = null;
                    }
                }

                ongoingLogSentRef.current = false;
                terminalLogSentRef.current = false;
                hasHadRemoteRef.current = false;

                if (isSelfSync && callStatusRef.current === 'incoming') {
                    console.log('[Agora] Accepted elsewhere, closing incoming UI on Web.');
                    endCallRef.current?.(false, 'ACCEPTED_ELSEWHERE');
                    return;
                }

                if (callStatusRef.current === 'outgoing') {
                    setCallStatus('connected');
                    startTimeRef.current = getTrueTime(); // 1-1 connected, start timer from 0!
                }
            } else if (signal.type === 'LEAVE') {
                console.log('[Agora] User left group:', signal.senderName);
                const userName = signal.senderName || t('chat.member');
                setUserLeftMsg(t('chat.user_left', { name: userName }));
                setTimeout(() => setUserLeftMsg(null), 3000);
            }
        };
        onCallSignal(handler);
        return () => offCallSignal(handler);
    }, [myId, isListener]); // Cleaned up deps to avoid redundant listener re-registration

    const startCall = useCallback(async (type = 'video', options = {}) => {
        if (joiningRef.current) return;
        try {
            joiningRef.current = true;
            isInitiatorRef.current = !options.isJoin;
            ongoingLogSentRef.current = false;
            terminalLogSentRef.current = false;
            hasHadRemoteRef.current = false;
            setError(null);
            setEndCallReason(null);
            setCallerId(null);
            setCallerName(null);
            setCallerAvatar(null);
            leftUsersRef.current.clear();
            setCallType(type);
            setMicOn(true);
            setCamOn(type === 'video');
            activeChannelRef.current = conversationId;
            setActiveCallCid(conversationId);
            const isGroupMode = activeConversation?.type === 'GROUP' || String(conversationId).includes('GROUP');
            callIsGroupRef.current = isGroupMode;
            setIsGroup(isGroupMode);

            // Đảm bảo dọn dẹp kết nối cũ nếu có trước khi bắt đầu cuộc gọi mới
            if (agoraClient.connectionState !== 'DISCONNECTED') {
                console.log('[Agora] Previous connection state is', agoraClient.connectionState, ', forcing leave...');
                try {
                    await agoraClient.leave();
                } catch (e) {
                    console.warn('[Agora] Force leave error:', e);
                }
            }

            const joinUid = toNumericUid(user?.userId || user?.id);
            const safeChannelId = sanitizeChannelId(conversationId);
            const res = await callApi.getAgoraToken(safeChannelId, joinUid);
            const { token, appId } = res;

            // Race Condition Guard 1: Cuộc gọi bị hủy trong khi lấy token
            if (isEndingRef.current || callStatusRef.current === 'ended') {
                console.warn('[Agora] Call ended during token fetch, aborting.');
                await cleanupTracks();
                return;
            }

            // Gửi tín hiệu mời - CHỈ gửi nếu KHÔNG phải là tham gia vào cuộc gọi đang diễn ra
            if (!options.isJoin) {
                let isBlocked = false;
                if (!isGroupMode) {
                    const other = activeConversationRef.current?.members?.find(m => {
                        const mid = m.userId || m.id || m._id;
                        return mid && String(mid).trim() !== String(myId).trim();
                    });
                    if (other) {
                        const otherId = other.userId || other.id || other._id;
                        const friendInfo = Array.isArray(friends) && friends.find(f => {
                            const fId = String(f.userId || f.id || f.friendId || '').toLowerCase();
                            return fId !== '' && fId === String(otherId).toLowerCase();
                        });
                        if (friendInfo?.status === 'BLOCKED') {
                            isBlocked = true;
                        }
                    }
                }

                if (!isBlocked) {
                    emitCallSignal(conversationId, {
                        type: 'CALL_INVITE',
                        callType: type,
                        isGroup: isGroupMode,
                        senderAvatar: user?.avatar || user?.avatarUrl,
                        conversationName: activeConversation?.name,
                        conversationAvatar: activeConversation?.avatar || activeConversation?.avatarUrl,
                        conversationType: activeConversation?.type || (isGroupMode ? 'GROUP' : 'SINGLE'),
                        inviteTime: getTrueTime()
                    }, user?.fullName || (user?.lastName && user?.firstName ? `${user.lastName} ${user.firstName}` : '') || user?.name || t('common.user'));
                } else {
                    console.log('[Agora] Signal CALL_INVITE suppressed due to block status.');
                }
            }

            // Đối với cuộc gọi NHÓM, người gọi vào phòng luôn để chờ mọi người
            if (isGroupMode) {
                setCallStatus('connected');
                if (!startTimeRef.current) {
                    startTimeRef.current = options.startTime || getTrueTime();
                }

                // CHỈ gửi tin nhắn log "đang diễn ra" nếu KHÔNG phải là tham gia vào cuộc gọi đã có
                if (!options.isJoin) {
                    try {
                        const content = JSON.stringify({
                            callType: type || 'audio',
                            status: 'ONGOING',
                            startTime: getTrueTime()
                        });
                        await chatApi.sendMessage({ conversationId, content, type: 'CALL_LOG' });
                        ongoingLogSentRef.current = true;
                    } catch (err) {
                        console.error('[Agora] Failed to send ONGOING log:', err);
                    }
                }
            } else {
                // Đối với cuộc gọi ĐƠN, ta vẫn giữ ở trạng thái OUTGOING cho đến khi người kia nghe máy
                setCallStatus('outgoing');
                const other = activeConversation?.members?.find(m => String(m.userId) !== String(myId));
                remoteUserIdRef.current = other?.userId || other?.id;
            }

            if (isGroupMode) {
                if (!startTimeRef.current) startTimeRef.current = options.startTime || getTrueTime();
            }
            currentJoinUidRef.current = joinUid;

            const audioTrack = await AgoraRTC.createMicrophoneAudioTrack({
                AEC: true,
                AGC: true,
                ANS: true,
                encoderConfig: 'speech_standard'
            });
            let videoTrack = null;
            if (type === 'video') {
                videoTrack = await AgoraRTC.createCameraVideoTrack({
                    encoderConfig: { width: 1280, height: 720, frameRate: 30, bitrateMin: 500, bitrateMax: 2000 }
                }).catch(e => { setCameraError(e.message); return null; });
            }

            // Race Condition Guard 2: Cuộc gọi bị hủy trong lúc đang tạo track
            if (isEndingRef.current || callStatusRef.current === 'ended') {
                console.warn('[Agora] Call ended during track creation, aborting.');
                if (audioTrack) { audioTrack.stop(); audioTrack.close(); }
                if (videoTrack) { videoTrack.stop(); videoTrack.close(); }
                await cleanupTracks();
                return;
            }

            localAudioTrackRef.current = audioTrack;
            localVideoTrackRef.current = videoTrack;
            setLocalAudioTrack(audioTrack);
            setLocalVideoTrack(videoTrack);

            await agoraClient.join(appId, safeChannelId, token || null, joinUid);
            joinTimeRef.current = Date.now();

            // Race Condition Guard 3: Cuộc gọi bị hủy trong lúc đang join phòng
            if (isEndingRef.current || callStatusRef.current === 'ended') {
                console.warn('[Agora] Call ended during join, aborting publish.');
                await cleanupTracks();
                return;
            }

            if (agoraClient.remoteUsers.length > 0) hasHadRemoteRef.current = true;
            updateRemoteUsers();
            await agoraClient.publish([audioTrack, videoTrack].filter(Boolean));
            setCamOn(type === 'video' && !!videoTrack);
        } catch (e) {
            console.error('❌ [useAgoraCall] startCall ERROR:', e);
            setError(e.message);
            await endCallRef.current?.(false);
        } finally { joiningRef.current = false; }
    }, [conversationId, user, activeConversation, myId]);

    const acceptCall = useCallback(async (signalData) => {
        if (joiningRef.current) return;
        try {
            joiningRef.current = true;
            isInitiatorRef.current = false;
            ongoingLogSentRef.current = false;
            terminalLogSentRef.current = false;
            hasHadRemoteRef.current = false;

            setError(null);
            setEndCallReason(null);
            leftUsersRef.current.clear();
            const channelId = signalData?.conversationId || signalData?.activeConversationId;
            const convType = signalData?.conversationType || signalData?.type || activeConversation?.type;
            const actualCallType = signalData?.signal?.callType || signalData?.callType || 'video';

            if (!channelId) throw new Error('Missing conversationId');
            activeChannelRef.current = channelId;
            setActiveCallCid(channelId);

            const isGroupMode = signalData?.isGroup ||
                convType === 'GROUP' ||
                String(channelId).includes('GROUP');

            callIsGroupRef.current = isGroupMode;
            setIsGroup(isGroupMode);

            setMicOn(true);
            setCamOn(actualCallType === 'video');
            setCallType(actualCallType);
            const safeChannelId = sanitizeChannelId(channelId);

            if (isGroupMode) {
                startTimeRef.current = signalData?.inviteTime || signalData?.signal?.inviteTime || getTrueTime();
            } else {
                startTimeRef.current = getTrueTime();
            }

            // Đảm bảo dọn dẹp kết nối cũ nếu có trước khi chấp nhận cuộc gọi mới
            if (agoraClient.connectionState !== 'DISCONNECTED') {
                console.log('[Agora] Previous connection state is', agoraClient.connectionState, ', forcing leave...');
                try {
                    await agoraClient.leave();
                } catch (e) {
                    console.warn('[Agora] Force leave error in acceptCall:', e);
                }
            }

            emitCallSignal(channelId, { type: 'CALL_ACCEPTED', startTime: getTrueTime() }, user?.fullName || (user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}` : '') || user?.name || t('common.user'));
            setCallStatus('connected');

            const joinUid = toNumericUid(user?.userId || user?.id);
            const res = await callApi.getAgoraToken(safeChannelId, joinUid);
            currentJoinUidRef.current = joinUid;

            // Race Condition Guard 1: Cuộc gọi bị hủy trước khi join/tạo track
            if (isEndingRef.current || callStatusRef.current === 'ended') {
                console.warn('[Agora] Call ended before accept connection setup, aborting.');
                await cleanupTracks();
                return;
            }

            const audioTrack = await AgoraRTC.createMicrophoneAudioTrack({
                AEC: true,
                AGC: true,
                ANS: true,
                encoderConfig: 'speech_standard'
            });
            let videoTrack = null;
            if (actualCallType === 'video') {
                videoTrack = await AgoraRTC.createCameraVideoTrack({
                    encoderConfig: { width: 1280, height: 720, frameRate: 30, bitrateMin: 500, bitrateMax: 2000 }
                }).catch(e => { setCameraError(e.message); return null; });
            }

            // Race Condition Guard 2: Cuộc gọi bị hủy trong lúc đang tạo track ở đầu nhận
            if (isEndingRef.current || callStatusRef.current === 'ended') {
                console.warn('[Agora] Call ended during track creation in acceptCall, aborting.');
                if (audioTrack) { audioTrack.stop(); audioTrack.close(); }
                if (videoTrack) { videoTrack.stop(); videoTrack.close(); }
                await cleanupTracks();
                return;
            }

            localAudioTrackRef.current = audioTrack;
            localVideoTrackRef.current = videoTrack;
            setLocalAudioTrack(audioTrack);
            setLocalVideoTrack(videoTrack);

            await agoraClient.join(res.appId, safeChannelId, res.token || null, joinUid);
            joinTimeRef.current = Date.now();
            if (agoraClient.remoteUsers.length > 0) hasHadRemoteRef.current = true;
            updateRemoteUsers();

            // Race Condition Guard 3: Cuộc gọi bị hủy trong lúc đang join phòng ở đầu nhận
            if (isEndingRef.current || callStatusRef.current === 'ended') {
                console.warn('[Agora] Call ended during join in acceptCall, aborting publish.');
                await cleanupTracks();
                return;
            }

            if (videoTrack) await videoTrack.setEnabled(true);
            if (audioTrack) await audioTrack.setEnabled(true);

            await agoraClient.publish([audioTrack, videoTrack].filter(Boolean));
            setCamOn(actualCallType === 'video' && !!videoTrack);
            setIncomingSignal(null);
        } catch (e) {
            console.error('❌ [useAgoraCall] acceptCall ERROR:', e);
            setError(e.message);
            await endCallRef.current?.(false);
        } finally { joiningRef.current = false; }
    }, [user, activeConversation]);

    const toggleMic = useCallback(async (enabled) => {
        setMicOn(enabled);
        if (localAudioTrackRef.current) await localAudioTrackRef.current.setEnabled(enabled);
    }, []);

    const toggleCamera = useCallback(async (enabled) => {
        setCamOn(enabled);
        try {
            if (enabled) {
                // Nếu chưa có track thì tạo mới và publish
                if (!localVideoTrackRef.current) {
                    const videoTrack = await AgoraRTC.createCameraVideoTrack({
                        encoderConfig: { width: 1280, height: 720, frameRate: 30, bitrateMin: 500, bitrateMax: 2000 }
                    });
                    localVideoTrackRef.current = videoTrack;
                    setLocalVideoTrack(videoTrack);
                    await agoraClient.publish(videoTrack);
                } else {
                    await localVideoTrackRef.current.setEnabled(true);
                }
            } else {
                // Nếu tắt cam, ta unpublish và close track để bên kia nhận được event 'user-unpublished'
                if (localVideoTrackRef.current) {
                    await agoraClient.unpublish(localVideoTrackRef.current);
                    localVideoTrackRef.current.stop();
                    localVideoTrackRef.current.close();
                    localVideoTrackRef.current = null;
                    setLocalVideoTrack(null);
                }
            }
        } catch (e) {
            console.error('[Agora] Toggle camera error:', e);
            setCameraError(e.message);
            setCamOn(false);
        }
    }, [localVideoTrack]);

    const resumeAudio = useCallback(async () => {
        try {
            await AgoraRTC.getAudioContext().resume();
            remoteUsers.forEach(u => u.audioTrack?.play());
            setAudioBlocked(false);
        } catch (e) { console.error(e); }
    }, [remoteUsers]);

    return {
        callStatus, callerName, callerId, callerAvatar, incomingSignal, callType, cameraError, error, duration,
        formatDuration, audioBlocked, endCallReason, localVideoTrack, localAudioTrack, remoteUsers,
        startCall, acceptCall, endCall, connect, toggleMic, toggleCamera, resumeAudio, micOn, camOn,
        userLeftMsg, isGroupCall: isGroup, ringDuration,
        activeCallCid
    };
};

export default useAgoraCall;
