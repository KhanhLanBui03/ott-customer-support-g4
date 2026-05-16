import AgoraRTC from 'agora-rtc-sdk-ng';
import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
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

export const useAgoraCall = (conversationId, activeConversation = null, isListener = true) => {
    const { user } = useSelector((state) => state.auth);
    const myId = user?.userId || user?.id;
    const dispatch = useDispatch();

    const [callStatus, setCallStatus] = useState('idle');
    const [incomingSignal, setIncomingSignal] = useState(null);
    const [callerId, setCallerId] = useState(null);
    const callerIdRef = useRef(null);
    const [callerName, setCallerName] = useState(null);
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
            if (!startTimeRef.current) startTimeRef.current = Date.now();
            const updateTimer = () => {
                if (startTimeRef.current) {
                    setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
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
        if (startTimeRef.current) callDuration = Math.floor((Date.now() - startTimeRef.current) / 1000);

        const isActuallyGroup = callIsGroupRef.current || 
                        String(cid).startsWith('GROUP#') || 
                        String(cid).includes('GROUP');

        if (emit && cid) {
            if (isActuallyGroup) {
                if (isInitiatorRef.current) {
                    // Nếu là người gọi: Gửi HANGUP để hủy cuộc gọi cho tất cả
                    console.log('[Agora] Initiator sending HANGUP for group:', cid);
                    emitCallSignal(cid, { type: 'HANGUP', reason });
                } else {
                    // Nếu là người nhận: Chỉ gửi LEAVE để thoát mình ra
                    console.log('[Agora] Participant sending LEAVE for group:', cid);
                    emitCallSignal(cid, { 
                        type: 'LEAVE', 
                        senderName: user?.fullName || 'Thành viên' 
                    });
                }
            } else {
                // 1-1 HOẶC Nhóm chưa có ai vào: Gửi HANGUP để hủy cuộc mời cho tất cả
                console.log('[Agora] Sending HANGUP signal for session:', cid);
                emitCallSignal(cid, { type: 'HANGUP', reason });
            }
        }


        const isCaller = isInitiatorRef.current;
        // Logic Nhóm: Chỉ người CUỐI CÙNG rời phòng mới được quyền chốt log kết thúc (SUCCESS/MISSED)
        // Kết hợp kiểm tra cả agoraClient và state remoteUsers để tránh race condition
        const isLastPerson = isGroup ? (agoraClient.remoteUsers.length === 0 || remoteUsers.length === 0) : true;
        let shouldLog = isGroup ? isLastPerson : isCaller;


        if (cid && !terminalLogSentRef.current && 
            ['connected', 'outgoing', 'incoming'].includes(callStatus) && 
            callStatus !== 'ended' && callStatus !== 'idle') {
            if (shouldLog) {
                terminalLogSentRef.current = true;
                lastLogCidRef.current = cid;
                try {
                    const hasOthers = agoraClient.remoteUsers.length > 0;
                    const everHadOthers = hasHadRemoteRef.current;
                    
                    // Bất kể là nhóm hay 1-1, nếu đã có thời lượng (>0) thì coi như thành công (không phải nhỡ)
                    const actuallyStarted = callDuration > 0 || startTimeRef.current !== null || callStatus === 'connected';
                    
                    let statusStr = 'MISSED';
                    if (actuallyStarted) {
                        statusStr = 'SUCCESS';
                    } else if (reason === 'REJECTED' || reason === 'BUSY') {
                        statusStr = reason;
                    }

                    
                    const content = JSON.stringify({ callType: callType || 'audio', duration: callDuration, status: statusStr });
                    chatApi.sendMessage({ conversationId: cid, content, type: 'CALL_LOG' });
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
        
        if (reason === 'REJECTED') setEndCallReason('Người nghe đã từ chối cuộc gọi');
        else if (reason === 'BUSY') setEndCallReason('Người nghe đang bận');
        else if (reason === 'MISSED') setEndCallReason('Cuộc gọi nhỡ');
        else setEndCallReason('Cuộc gọi đã kết thúc');

        // Giảm thời gian chờ đóng UI xuống còn 800ms để mượt hơn
        setTimeout(() => {
            setCallStatus('idle');
            setIncomingSignal(null);
            setEndCallReason(null);
            setDuration(0);
            setMicOn(true);
            setCamOn(true);
            isEndingRef.current = false;
            
            // Reset Refs
            startTimeRef.current = null;
            isInitiatorRef.current = false;
            callIsGroupRef.current = false;
            activeChannelRef.current = null;
            ongoingLogSentRef.current = false;
            terminalLogSentRef.current = false;
            hasHadRemoteRef.current = false;
        }, 800);

    }, [conversationId, cleanupTracks, callStatus, callType, incomingSignal, remoteUsers]);


    endCallRef.current = endCall;

    const updateRemoteUsers = () => setRemoteUsers(Array.from(agoraClient.remoteUsers));

    useEffect(() => {
        if (remoteUsers.length > 0 && ringTimerRef.current) {
            console.log('[Agora] First participant joined group, clearing waiting timer.');
            clearInterval(ringTimerRef.current);
            ringTimerRef.current = null;
            setRingDuration(0);
        }
        updateRemoteUsers();
    }, [remoteUsers]);

    useEffect(() => {
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
            hasHadRemoteRef.current = true;
            
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
                    setWaitTimer(30);
                    ringTimerRef.current = setInterval(() => {
                        setWaitTimer(prev => {
                            if (prev <= 1) {
                                clearInterval(ringTimerRef.current);
                                endCallRef.current?.(true, 'ENDED');
                                return 0;
                            }
                            return prev - 1;
                        });
                    }, 1000);
                }
            }
        };
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
            agoraClient.off('user-published', handleUserPublished);
            agoraClient.off('user-unpublished', handleUserUnpublished);
            agoraClient.off('user-left', handleUserLeft);
            agoraClient.off('volume-indicator', handleVolumeIndicator);
        };
    }, [callStatus, myId]);
    
    const connect = useCallback(() => { return () => {}; }, []);

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
                    conversationAvatar: signal.conversationAvatar // Lưu avatar nhóm từ tín hiệu
                });

                isInitiatorRef.current = false;
                setCallerName(actualData.senderName || senderId);
                setCallerId(senderId);
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

                // Nếu là tín hiệu HANGUP/LEAVE/ACCEPTED từ chính mình (đồng bộ thiết bị) thì ta luôn chấp nhận không cần khớp CID khắt khe
                const shouldProcess = cidMatch || isPartnerSignal || (isSelfSync && (signal.type === 'HANGUP' || signal.type === 'LEAVE' || signal.type === 'CALL_ACCEPTED'));

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
                    
                    // Xóa user khỏi danh sách hiển thị ngay lập tức (không chờ Agora timeout 20s)
                    setRemoteUsers(prev => {
                        const filtered = prev.filter(u => {
                            const uNum = Number(u.uid);
                            return uNum !== numericUid && uNum !== mobileUid && String(u.uid) !== String(senderId);
                        });
                        if (filtered.length !== prev.length) {
                            console.log(`[Agora] ✅ Successfully instant-removed ${senderId} from UI.`);
                        }
                        return filtered;
                    });

                    if (signal.type === 'LEAVE') {
                        setUserLeftMsg(`${signal.senderName || 'Một thành viên'} đã rời phòng`);
                        setTimeout(() => setUserLeftMsg(null), 3000);
                        return; // Chỉ thoát sớm nếu là LEAVE của nhóm
                    }
                }

                if (callStatusRef.current !== 'idle' && callStatusRef.current !== 'ended') {
                    if (isGroupMode) {
                        // Nếu đang trong cuộc gọi nhóm (connected), ta lờ đi tín hiệu HANGUP/LEAVE từ initiator
                        // Chỉ kết thúc nếu mình chưa vào phòng (đang chờ/đổ chuông)
                        if (callStatusRef.current !== 'connected' && String(senderId) === String(callerIdRef.current)) {
                            endCallRef.current?.(false, 'ENDED');
                        }
                    } else {
                        endCallRef.current?.(false, reason);
                    }
                }



            } else if (signal.type === 'CALL_ACCEPTED') {
                if (ringTimerRef.current) {
                    clearTimeout(ringTimerRef.current);
                    ringTimerRef.current = null;
                }
                ongoingLogSentRef.current = false;
                terminalLogSentRef.current = false;
                hasHadRemoteRef.current = false;
                if (callStatusRef.current === 'outgoing') {
                    setCallStatus('connected');
                    if (!startTimeRef.current) startTimeRef.current = Date.now();
                }
            } else if (signal.type === 'LEAVE') {
                console.log('[Agora] User left group:', signal.senderName);
                setUserLeftMsg(`${signal.senderName || 'Một thành viên'} đã rời phòng`);
                setTimeout(() => setUserLeftMsg(null), 3000);
            }
        };
        onCallSignal(handler);
        return () => offCallSignal(handler);
    }, [myId, isListener, remoteUserId, isGroup]); // Thêm deps

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
            setCallType(type);
            setMicOn(true);
            setCamOn(type === 'video');
            activeChannelRef.current = conversationId;
            const isGroupMode = activeConversation?.type === 'GROUP' || String(conversationId).includes('GROUP');
            callIsGroupRef.current = isGroupMode;
            setIsGroup(isGroupMode);

            // Không set status ở đây, để set 1 lần sau khi có Token
            
            const safeChannelId = sanitizeChannelId(conversationId);
            const res = await callApi.getAgoraToken(safeChannelId);
            const { token, appId, uid: originalUid } = res;
            // setAgoraConfig(config); // Web không dùng hàm này, ta dùng trực tiếp appId/token bên dưới

            // Gửi tín hiệu mời - CHỈ gửi nếu KHÔNG phải là tham gia vào cuộc gọi đang diễn ra
            if (!options.isJoin) {
                emitCallSignal(conversationId, { 
                    type: 'CALL_INVITE', 
                    callType: type,
                    isGroup: isGroupMode, // Thêm flag tường minh
                    senderAvatar: user?.avatar || user?.avatarUrl,
                    conversationName: activeConversation?.name,
                    conversationAvatar: activeConversation?.avatar || activeConversation?.avatarUrl,
                    conversationType: activeConversation?.type || (isGroupMode ? 'GROUP' : 'SINGLE')
                }, user?.fullName || 'Người dùng');

            }


            // Đối với cuộc gọi NHÓM, người gọi vào phòng luôn để chờ mọi người
            if (activeConversation?.type === 'GROUP') {
                setCallStatus('connected');
                if (!startTimeRef.current) {
                    startTimeRef.current = options.startTime || Date.now();
                }

                
                // CHỈ gửi tin nhắn log "đang diễn ra" nếu KHÔNG phải là tham gia vào cuộc gọi đã có
                if (!options.isJoin) {
                    try {
                        const content = JSON.stringify({ 
                            callType: type || 'audio', 
                            status: 'ONGOING',
                            startTime: Date.now()
                        });
                        chatApi.sendMessage({ conversationId, content, type: 'CALL_LOG' });
                        ongoingLogSentRef.current = true;
                    } catch (err) {
                        console.error('[Agora] Failed to send ONGOING log:', err);
                    }
                }
            } else {
                // Đối với cuộc gọi ĐƠN, ta vẫn giữ ở trạng thái OUTGOING cho đến khi người kia nghe máy
                setCallStatus('outgoing');
                // 1-1: Xác định đối phương để theo dõi tín hiệu ngắt máy
                const other = activeConversation?.members?.find(m => String(m.userId) !== String(myId));
                remoteUserIdRef.current = other?.userId || other?.id;
            }
            
            if (!startTimeRef.current) startTimeRef.current = Date.now();
            const joinUid = toNumericUid(originalUid);
            currentJoinUidRef.current = joinUid;

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

            if (videoTrack) await videoTrack.setEnabled(true);
            if (audioTrack) await audioTrack.setEnabled(true);

            await agoraClient.join(appId, safeChannelId, token || null, joinUid);
            await agoraClient.publish([audioTrack, videoTrack].filter(Boolean));
            setCamOn(type === 'video' && !!videoTrack);
        } catch (e) {
            console.error('❌ [useAgoraCall] startCall ERROR:', e);
            setError(e.message);
            await endCallRef.current?.(false);
        } finally { joiningRef.current = false; }
    }, [conversationId, user]);

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
            const channelId = signalData?.conversationId || signalData?.activeConversationId;
            const convType = signalData?.conversationType || signalData?.type || activeConversation?.type;
            const actualCallType = signalData?.signal?.callType || signalData?.callType || 'video';

            if (!channelId) throw new Error('Missing conversationId');
            activeChannelRef.current = channelId;
            
            // Ưu tiên flag isGroup từ signalData nếu có
            const isGroupMode = signalData?.isGroup || 
                              convType === 'GROUP' || 
                              String(channelId).includes('GROUP');
                              
            callIsGroupRef.current = isGroupMode;
            setIsGroup(isGroupMode);
            
            setMicOn(true);
            setCamOn(actualCallType === 'video');
            setCallType(actualCallType);
            const safeChannelId = sanitizeChannelId(channelId);

            emitCallSignal(channelId, { type: 'CALL_ACCEPTED', startTime: Date.now() }, user?.fullName || 'Người dùng');
            setCallStatus('connected');

            const res = await callApi.getAgoraToken(safeChannelId);
            const joinUid = toNumericUid(res.uid);
            currentJoinUidRef.current = joinUid;

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

            if (videoTrack) await videoTrack.setEnabled(true);
            if (audioTrack) await audioTrack.setEnabled(true);

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
        try {
            if (enabled) {
                // Nếu chưa có track thì tạo mới và publish
                if (!localVideoTrackRef.current) {
                    const videoTrack = await AgoraRTC.createCameraVideoTrack({
                        encoderConfig: { width: 640, height: 480, frameRate: 15, bitrateMin: 200, bitrateMax: 500 }
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
        callStatus, callerName, callerId, incomingSignal, callType, cameraError, error, duration,
        formatDuration, audioBlocked, endCallReason, localVideoTrack, localAudioTrack, remoteUsers,
        startCall, acceptCall, endCall, connect, toggleMic, toggleCamera, resumeAudio, micOn, camOn,
        userLeftMsg, isGroupCall: isGroup, ringDuration,
        activeCallCid: activeChannelRef.current
    };
};

export default useAgoraCall;
