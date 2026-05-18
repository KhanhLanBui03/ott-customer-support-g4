import { Audio } from 'expo-av';
import { useEffect, useCallback, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { PermissionsAndroid, Platform, Alert } from 'react-native';
import { onCallSignal, offCallSignal, emitCallSignal } from '../utils/socket';
import { callApi } from '../api/callApi';
import { chatApi } from '../api/chatApi';
import { addMessage } from '../store/chatSlice';
import {
    setCallStatus, setCallType, setIsGroup, setCallerInfo, setIncomingSignal,
    setAgoraConfig, setRemoteUsers, setDuration, setCamOn, setMicOn, setActiveConversationId,
    setEndCallReason, setCountdown, setShowCountdown, resetCall, setStartTime, setIsInitiator,
    setHasHadRemote
} from '../store/callSlice';


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

const toNumericUid = (id) => {
    if (!id) return 0;
    // Thêm hậu tố _mobile để tránh trùng UID khi test cùng 1 tài khoản trên Web & Mobile
    const s = String(id) + '_mobile';
    let hash = 0;
    for (let i = 0; i < s.length; i++) {
        hash = (hash << 5) - hash + s.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash);
};


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
            console.log('⏰ [TimeSync-Mobile] Calibrated offset:', serverTimeOffset, 'ms (latency:', latency, 'ms)');
        }
    } catch (e) {
        console.warn('⏰ [TimeSync-Mobile] Calibration failed:', e);
    } finally {
        isCalibratingTime = false;
    }
}

export const useAgoraCall = (activeConversationId = null, activeConversation = null, isListener = true) => {
    const user = useSelector(state => state.auth.user);
    const callState = useSelector(state => state.call);
    const dispatch = useDispatch();
    const conversations = useSelector(state => state.chat.conversations || []);

    const {
        callStatus, callType, callerName, callerId, callerInfo, incomingSignal,
        duration, camOn, micOn, remoteUsers, agoraConfig, endCallReason,
        countdown, showCountdown, isGroup, isInitiator, startTime, hasHadRemote
    } = callState;

    const myId = user?.userId || user?.id;
    const myFullName = user?.fullName || user?.name ||
        (user?.firstName || user?.lastName
            ? [user.lastName, user.firstName].filter(Boolean).join(' ')
            : null) || 'Người dùng';

    const conversationsRef = useRef(conversations);
    useEffect(() => {
        conversationsRef.current = conversations;
    }, [conversations]);


    const timerRef = useRef(null);
    const countdownIntervalRef = useRef(null);
    const endCallRef = useRef(null);
    const startTimeRef = useRef(null);
    const ringTimerRef = useRef(null);
    const joiningRef = useRef(false);
    const logSentRef = useRef(false);
    const processedSignals = useRef(new Set());
    const activeChannelRef = useRef(null);
    const callStatusRef = useRef(callStatus);
    const callerIdRef = useRef(null);
    const activeConvIdRef = useRef(callState.activeConversationId);
    const soundRef = useRef(null);
    const isGroupRef = useRef(false);
    const remoteUserIdRef = useRef(null);
    const isInitiatorRef = useRef(false);

    // ✅ Đồng bộ startTimeRef.current với Redux startTime khi thay đổi giữa các instance của hook
    useEffect(() => {
        startTimeRef.current = startTime;
    }, [startTime]);

    useEffect(() => {
        isInitiatorRef.current = isInitiator;
    }, [isInitiator]);


    // ✅ Clean up countdown on unmount & calibrate server time
    useEffect(() => {
        calibrateServerTime();
        return () => {
            if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
        };
    }, []);

    const cancelCountdown = useCallback(() => {
        if (countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current);
            countdownIntervalRef.current = null;
        }
        dispatch(setShowCountdown(false));
        dispatch(setCountdown(3));
        dispatch(resetCall());
        joiningRef.current = false;
    }, [dispatch]);


    // ✅ Hàm điều khiển âm thanh
    const stopSound = async () => {
        if (soundRef.current) {
            try {
                const s = soundRef.current;
                soundRef.current = null;
                await s.stopAsync().catch(() => { });
                await s.unloadAsync().catch(() => { });
                console.log('🔊 [useAgoraCall] Sound stopped and unloaded');
            } catch (e) {
                console.warn('🔊 [useAgoraCall] stopSound error:', e);
            }
        }
    };


    const getPermissions = async () => {

        try {
            const { status: audioStatus } = await Audio.requestPermissionsAsync();
            if (audioStatus !== 'granted') return false;
            if (Platform.OS === 'android') await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA);
            return true;
        } catch (e) { return false; }
    };

    useEffect(() => {
        callStatusRef.current = callStatus;
    }, [callStatus]);

    useEffect(() => {
        // Đã kết nối thì bắt đầu tính giờ ngay (để log chính xác thời gian mình ở trong phòng)
        const shouldStartTimer = callStatus === 'connected' && isListener;

        if (shouldStartTimer) {
            if (!startTimeRef.current) startTimeRef.current = getTrueTime();
            timerRef.current = setInterval(() => {
                const diff = Math.floor((getTrueTime() - startTimeRef.current) / 1000);
                dispatch(setDuration(diff));
            }, 1000);
        } else {
            if (timerRef.current) clearInterval(timerRef.current);
            // Chỉ reset khi cuộc gọi thực sự kết thúc về trạng thái idle/ended
            if (callStatus === 'idle' || callStatus === 'ended') {
                startTimeRef.current = null;
                dispatch(setHasHadRemote(false));
                if (isListener) {
                    dispatch(setDuration(0));
                }
            }
        }
        return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }, [callStatus, dispatch, isListener]);


    // ✅ Thêm đếm ngược 30s cho cuộc gọi (giống Web)
    useEffect(() => {
        if (!isListener) return;
        let isActive = true;

        const startSound = async () => {
            if (callStatus === 'outgoing' || callStatus === 'incoming') {
                await stopSound();
                try {
                    let file;
                    if (callStatus === 'incoming') file = require('../../assets/sounds/ringtone.wav');
                    else if (callStatus === 'outgoing') file = require('../../assets/sounds/outgoing_ring.wav');

                    if (!file) return;

                    const { sound } = await Audio.Sound.createAsync(
                        file,
                        { isLooping: true, shouldPlay: true, volume: 1.0 }
                    );

                    if (!isActive) {
                        await sound.stopAsync().catch(() => { });
                        await sound.unloadAsync().catch(() => { });
                        return;
                    }

                    soundRef.current = sound;
                } catch (e) {
                    console.warn('🔊 [useAgoraCall] Sound error:', e);
                }
            } else {
                await stopSound();
            }
        };

        startSound();

        if (callStatus === 'outgoing' || callStatus === 'incoming') {
            ringTimerRef.current = setTimeout(() => {
                if (callStatusRef.current === 'outgoing') {
                    console.log('⏰ [useAgoraCall] Outgoing call timeout (30s)');
                    endCallRef.current?.(true, 'MISSED');
                } else if (callStatusRef.current === 'incoming') {
                    console.log('⏰ [useAgoraCall] Incoming call timeout (30s)');
                    endCallRef.current?.(false, 'MISSED');
                }
            }, 30000);
        } else {
            if (ringTimerRef.current) {
                clearTimeout(ringTimerRef.current);
                ringTimerRef.current = null;
            }
        }

        return () => {
            isActive = false;
            if (ringTimerRef.current) clearTimeout(ringTimerRef.current);
            stopSound();
        };
    }, [callStatus, isListener]);





    useEffect(() => { activeConvIdRef.current = callState.activeConversationId; }, [callState.activeConversationId]);

    const formatDuration = useCallback(() => {
        const m = Math.floor(duration / 60);
        const s = duration % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    }, [duration]);

    const endCall = useCallback(async (sendSignal = true, reason = 'ENDED') => {
        const cid = activeChannelRef.current || activeConversationId || callState.activeConversationId;
        // Phân biệt chính xác Nhóm vs 1-1 để gửi đúng loại tín hiệu
        const isActuallyGroup = isGroupRef.current ||
            isGroup ||
            (cid && String(cid).includes('GROUP')) ||
            (activeConversation && activeConversation.type === 'GROUP') ||
            (activeConversationId && String(activeConversationId).includes('GROUP'));

        const isLastPerson = remoteUsers.length === 0;

        // 1. Gửi tín hiệu Socket NGAY LẬP TỨC
        if (sendSignal && cid) {
            if (isActuallyGroup) {
                // Nếu mình là người cuối cùng trong phòng, gửi HANGUP để thông báo cuộc gọi kết thúc hoàn toàn
                if (isLastPerson) {
                    console.log('📤 [useAgoraCall] Last person sending HANGUP (Group mode):', cid);
                    emitCallSignal(cid, {
                        type: 'HANGUP',
                        reason: 'ENDED',
                        conversationType: 'GROUP'
                    });
                } else {
                    console.log('📤 [useAgoraCall] Participant sending LEAVE (Group mode):', cid);
                    emitCallSignal(cid, {
                        type: 'LEAVE',
                        senderName: myFullName,
                        conversationType: 'GROUP'
                    });
                }
            } else {
                console.log('📤 [useAgoraCall] Instant-sending HANGUP (1-1 mode):', cid);
                emitCallSignal(cid, {
                    type: 'HANGUP',
                    reason,
                    conversationType: 'SINGLE'
                });
            }
        }

        // 2. Tiếp tục logic dọn dẹp local...
        if (ringTimerRef.current) {
            clearTimeout(ringTimerRef.current);
            ringTimerRef.current = null;
        }

        // Cập nhật trạng thái ngay lập tức để UI phản hồi nhanh
        let callDuration = 0;
        if (startTimeRef.current) callDuration = Math.floor((getTrueTime() - startTimeRef.current) / 1000);

        const isCaller = !incomingSignal && isInitiatorRef.current;
        const isManual = sendSignal;

        // LOGIC CHỐT CUỘC GỌI:
        let shouldLog = false;
        const isCallConnected = callStatus === 'connected';

        if (!isActuallyGroup) {
            shouldLog = isManual || (isCaller && ['MISSED', 'REJECTED', 'UNREACHABLE', 'BUSY'].includes(reason));
        } else {
            // Nhóm: Chỉ ghi log SUCCESS nếu là người cuối cùng rời phòng và cuộc gọi ĐÃ THỰC SỰ BẮT ĐẦU (có người tham gia)
            const actuallyStarted = hasHadRemote || callDuration > 0;
            shouldLog = (isCallConnected && isLastPerson && actuallyStarted && (reason === 'ENDED' || reason === 'SUCCESS')) ||
                (isCaller && ['REJECTED', 'MISSED', 'BUSY'].includes(reason));
        }

        console.log(`🏁 [EndCall] CID: ${cid} | shouldLog: ${shouldLog} | isGroup: ${isActuallyGroup} | isLast: ${isLastPerson} | Reason: ${reason}`);

        if (cid && shouldLog && !logSentRef.current && ['connected', 'outgoing', 'incoming', 'ringing', 'ended'].includes(callStatus)) {
            logSentRef.current = true;

            try {
                // Nhóm: Chỉ coi là SUCCESS nếu thực sự có người khác đã tham gia (hasHadRemote)
                const actuallyStarted = isActuallyGroup 
                    ? hasHadRemote 
                    : (callDuration > 0 || startTimeRef.current !== null || callStatus === 'connected');

                let statusStr = 'MISSED';
                if (actuallyStarted) {
                    statusStr = 'SUCCESS';
                } else if (reason === 'REJECTED' || reason === 'BUSY') {
                    statusStr = reason;
                }

                const content = JSON.stringify({
                    callType: callType || 'audio',
                    duration: callDuration,
                    status: statusStr,
                    isGroup: isActuallyGroup
                });

                console.log('📝 [useAgoraCall] Sending final CALL_LOG:', statusStr);
                chatApi.sendMessage({ conversationId: cid, content, type: 'CALL_LOG' });
            } catch (err) {
                console.error('❌ [useAgoraCall] Failed to send final log:', err);
            }
        }

        // Cập nhật trạng thái sau cùng
        dispatch(setCallStatus('ended'));

        // QUAN TRỌNG: Reset toàn bộ refs để không bị dính logic của cuộc gọi trước
        startTimeRef.current = null;
        isInitiatorRef.current = false;
        isGroupRef.current = false;
        activeChannelRef.current = null;
        activeConvIdRef.current = null;
        processedSignals.current.clear();
        logSentRef.current = false;

        await stopSound();
        if (ringTimerRef.current) {
            clearTimeout(ringTimerRef.current);
            ringTimerRef.current = null;
        }



        let msg = 'Cuộc gọi đã kết thúc';
        if (reason === 'REJECTED') msg = 'Người nghe đã từ chối';
        else if (reason === 'BUSY') msg = 'Người nghe đang bận';
        else if (reason === 'MISSED') msg = 'Cuộc gọi nhỡ';
        dispatch(setEndCallReason(msg));

        // Tự động quay lại chat sau 2s (theo yêu cầu)
        setTimeout(() => {
            console.log('⏰ [useAgoraCall] Final resetCall triggered.');
            dispatch(resetCall());
        }, 2000);

    }, [activeConversationId, callStatus, callType, dispatch, incomingSignal, remoteUsers, activeConversation, user, hasHadRemote]);



    endCallRef.current = endCall;

    useEffect(() => {
        if (!isListener) return;
        const handler = (data) => {
            const actualData = data?.payload || data;
            const { signal, senderId, senderName } = actualData || {};
            const signalConvId = String(data?.conversationId || actualData?.conversationId || '').trim();

            if (!signal) return;

            const cleanSenderId = senderId && senderId !== 'undefined' && senderId !== 'null' ? String(senderId).trim() : null;
            const myIdStr = user?.userId || user?.id ? String(user?.userId || user?.id).trim() : null;

            // Logic đồng bộ đa thiết bị: Xử lý HANGUP/ACCEPTED từ chính mình (thiết bị khác)
            if (cleanSenderId && myIdStr && cleanSenderId === myIdStr) {
                if (signal.type !== 'HANGUP' && signal.type !== 'LEAVE' && signal.type !== 'CALL_ACCEPTED') {
                    return;
                }
                console.log(`[useAgoraCall] Self-sync signal: ${signal.type}`);
            }


            if (signal.type === 'CALL_INVITE') {
                if (callStatusRef.current !== 'idle') {
                    emitCallSignal(signalConvId, { type: 'HANGUP', reason: 'BUSY' });
                    return;
                }
                console.log('📩 [useAgoraCall] Incoming CALL_INVITE:', JSON.stringify(signal));

                const isGroupCall = signal.isGroup === true ||
                    signal.conversationType === 'GROUP' ||
                    actualData.conversationType === 'GROUP' ||
                    signalConvId.includes('GROUP') ||
                    signalConvId.startsWith('GROUP#');

                isGroupRef.current = isGroupCall;
                callerIdRef.current = cleanSenderId;
                dispatch(setIsGroup(isGroupCall));




                // Ưu tiên thông tin nhóm nếu là cuộc gọi nhóm
                let avatar = isGroupCall
                    ? (signal.conversationAvatar || actualData.conversationAvatar)
                    : (signal.senderAvatar || actualData.senderAvatar || actualData.senderInfo?.avatarUrl);
                let name = isGroupCall
                    ? (signal.conversationName || actualData.conversationName || 'Cuộc gọi nhóm')
                    : (senderName || signal.senderName || actualData.senderName || 'Người dùng');

                // Fallback tìm tên chuẩn của người gọi cá nhân trong danh sách hội thoại
                if (!isGroupCall && cleanSenderId) {
                    const currentConvs = conversationsRef.current || [];
                    const callConv = currentConvs.find(c => 
                        c.conversationId && (
                            String(c.conversationId) === String(signalConvId) || 
                            String(c.id) === String(signalConvId)
                        )
                    );
                    if (callConv) {
                        const found = callConv.members?.find(m => {
                            const mid = m.userId || m.id || m._id;
                            return mid && mid !== 'undefined' && mid !== 'null' && String(mid).trim() === cleanSenderId;
                        });
                        if (found) {
                            avatar = found.avatar || found.avatarUrl || avatar;
                            if (found.fullName || found.name) {
                                name = found.fullName || found.name;
                            }
                        }
                    } else {
                        for (const conv of currentConvs) {
                            const found = conv.members?.find(m => {
                                const mid = m.userId || m.id || m._id;
                                return mid && mid !== 'undefined' && mid !== 'null' && String(mid).trim() === cleanSenderId;
                            });
                            if (found) {
                                avatar = found.avatar || found.avatarUrl || avatar;
                                if (found.fullName || found.name) {
                                    name = found.fullName || found.name;
                                }
                                if (avatar) break;
                            }
                        }
                    }
                }

                dispatch(setCallerInfo({ name, avatar, id: senderId }));
                dispatch(setIncomingSignal({ ...actualData, conversationId: signalConvId }));
                const type = signal.callType || 'video';
                dispatch(setCallType(type));
                dispatch(setCamOn(type === 'video'));
                dispatch(setMicOn(true));
                // QUAN TRỌNG: Không ghi đè config của mình bằng config của đối phương khi nhận lời mời để tránh trùng UID/collision
                // if (signal.agoraConfig) dispatch(setAgoraConfig(signal.agoraConfig));
                activeChannelRef.current = signalConvId;
                callerIdRef.current = senderId;
                remoteUserIdRef.current = senderId;
                dispatch(setActiveConversationId(signalConvId));
                dispatch(setCallStatus('incoming'));
            } else if (signal.type === 'CALL_ACCEPTED') {
                console.log('✅ [useAgoraCall] CALL_ACCEPTED from:', senderName || senderId, 'for CID:', signalConvId);

                const sigId = signal.timestamp || JSON.stringify(signal);
                if (processedSignals.current.has(sigId)) return;
                processedSignals.current.add(sigId);

                // Kiểm tra xem đây có phải cuộc gọi mình đang thực hiện không
                const activeCid = String(activeChannelRef.current || activeConvIdRef.current || '').trim();
                const sSignal = sanitizeChannelId(signalConvId);
                const sActive = sanitizeChannelId(activeCid);
                const isMyCall = sSignal === sActive;

                const isSelfSync = String(senderId) === String(user?.userId || user?.id);

                if (isSelfSync && callStatusRef.current === 'incoming') {
                    console.log('ℹ️ [useAgoraCall] Accepted elsewhere, closing incoming UI.');
                    endCallRef.current?.(false, 'ACCEPTED_ELSEWHERE');
                    return;
                }

                // Nếu mình là người gọi (đang ở trạng thái outgoing) thì vào việc ngay khi đối phương nghe máy
                const shouldConnect = isInitiatorRef.current || (callStatusRef.current === 'outgoing' && isMyCall);

                if (shouldConnect && callStatusRef.current === 'outgoing') {
                    console.log('🚀 [useAgoraCall] Connection confirmed, switching to connected state.');
                    dispatch(setCallStatus('connected'));
                    if (!startTimeRef.current) startTimeRef.current = getTrueTime();
                } else {
                    console.log('ℹ️ [useAgoraCall] CALL_ACCEPTED ignored (not my outgoing call or already connected)');
                }
            } else if (signal.type === 'HANGUP' || signal.type === 'LEAVE') {

                console.log(`📩 [useAgoraCall] Termination signal: ${signal.type} from ${senderName || senderId}`);
                const activeCid = String(activeChannelRef.current || activeConvIdRef.current || '').trim();

                const reason = signal.reason || actualData.reason || 'ENDED';

                const isActuallyGroup = isGroupRef.current ||
                    callState.isGroup ||
                    activeCid.includes('GROUP') ||
                    signalConvId.includes('GROUP') ||
                    actualData.conversationType === 'GROUP';

                if (isActuallyGroup && callStatusRef.current === 'connected') {
                    console.log('ℹ️ [useAgoraCall] Group call active, ignoring HANGUP/LEAVE signal.');
                    return;
                }


                console.log(`🛑 [useAgoraCall] ${signal.type} received. SignalCID:`, signalConvId, 'ActiveCID:', activeCid);

                const cleanSenderId = senderId && senderId !== 'undefined' && senderId !== 'null' ? String(senderId).trim() : null;
                const myIdStr = user?.userId || user?.id ? String(user?.userId || user?.id).trim() : null;
                const partnerIdStr = remoteUserIdRef.current ? String(remoteUserIdRef.current).trim() : null;

                const isSelfSync = cleanSenderId && myIdStr && cleanSenderId === myIdStr;
                const isPartnerSignal = !isActuallyGroup && partnerIdStr && cleanSenderId && cleanSenderId === partnerIdStr;
                const cidMatch = (signalConvId === activeCid) || (sanitizeChannelId(signalConvId) === sanitizeChannelId(activeCid));

                // Quy trình xử lý tia chớp: Chấp nhận nếu khớp CID HOẶC khớp ID người dùng (Partner/Self)
                // isSelfSync (đồng bộ đa thiết bị) chỉ kích hoạt kết thúc nếu thực sự khớp CID cuộc gọi đang diễn ra
                const shouldEnd = cidMatch || isPartnerSignal || (isSelfSync && cidMatch);

                if (shouldEnd && callStatusRef.current !== 'idle' && callStatusRef.current !== 'ended') {
                    console.log('🛑 [useAgoraCall] Valid termination signal, ending call.');
                    endCallRef.current?.(false, reason);
                }


            }
        };
        onCallSignal(handler);
        return () => offCallSignal(handler);
    }, [user, dispatch, isListener, callState.isGroup]);

    const finalizeStartCall = useCallback(async (type, cid, isGroupCall, isJoining, config, receiverInfo) => {
        try {
            if (!isJoining) {
                emitCallSignal(cid, {
                    type: 'CALL_INVITE',
                    callType: type,
                    isGroup: isGroupCall,
                    conversationType: isGroupCall ? 'GROUP' : 'SINGLE',
                    senderAvatar: user?.avatar || user?.avatarUrl,
                    conversationName: activeConversation?.name,
                    conversationAvatar: activeConversation?.avatar || activeConversation?.avatarUrl,
                    senderName: myFullName,
                    inviteTime: getTrueTime(),
                    agoraConfig: config
                }, myFullName);
            } else {
                isInitiatorRef.current = false;
            }

            if (isGroupCall) {
                dispatch(setCallStatus('connected'));
                const st = receiverInfo?.startTime || getTrueTime();
                startTimeRef.current = st;
                dispatch(setStartTime(st));
                if (!isJoining) {
                    try {
                        const content = JSON.stringify({
                            callType: type,
                            status: 'ONGOING',
                            startTime: getTrueTime()
                        });
                        await chatApi.sendMessage({ conversationId: cid, content, type: 'CALL_LOG' });
                    } catch (err) {
                        console.error('[Agora] Failed to send group ONGOING log:', err);
                    }
                }
            } else {
                // 1-1: Xác định đối phương để theo dõi tín hiệu ngắt máy
                const other = activeConversation?.members?.find(m => {
                    const mid = m.userId || m.id || m._id;
                    return mid && mid !== 'undefined' && mid !== 'null' && String(mid).trim() !== String(myId).trim();
                });
                remoteUserIdRef.current = other?.userId || other?.id || other?._id;

                dispatch(setCallStatus('outgoing'));
            }

        } catch (e) {
            console.error('❌ [useAgoraCall] finalizeStartCall ERROR:', e);
            dispatch(setEndCallReason('ERROR'));
            endCallRef.current?.(false);
        }
    }, [user, activeConversation, dispatch]);


    const startCall = useCallback(async (type = 'video', receiverInfo = null, targetCid = null) => {
        const cid = String(targetCid || receiverInfo?.conversationId || activeConversationId || '').trim();
        if (!cid || joiningRef.current) return;
        try {
            joiningRef.current = true;
            isInitiatorRef.current = true;
            logSentRef.current = false;

            await getPermissions();

            const isGroupCall = activeConversation?.type === 'GROUP' || cid.startsWith('GROUP#') || cid.includes('GROUP');
            isGroupRef.current = isGroupCall;
            dispatch(setIsGroup(isGroupCall));

            // Tự tìm thông tin đối phương nếu là 1-1 mà thiếu info
            const partner = !isGroupCall ? activeConversation?.members?.find(m => {
                const mid = m.userId || m.id || m._id;
                const uid = user?.userId || user?.id || user?._id;
                return mid && mid !== 'undefined' && mid !== 'null' && uid && String(mid).trim() !== String(uid).trim();
            }) : null;

            const finalName = receiverInfo?.name || activeConversation?.name || partner?.fullName || partner?.name || 'Người dùng';
            const finalAvatar = receiverInfo?.avatar || activeConversation?.avatar || activeConversation?.avatarUrl || partner?.avatar || partner?.avatarUrl;

            dispatch(setCallerInfo({ name: finalName, avatar: finalAvatar, id: partner?.userId || partner?.id || partner?._id }));

            dispatch(setEndCallReason(null));
            dispatch(setCallType(type));
            dispatch(setCamOn(type === 'video'));
            dispatch(setMicOn(true));

            activeChannelRef.current = cid;
            dispatch(setActiveConversationId(cid));

            const safeChannelId = sanitizeChannelId(cid);
            const res = await callApi.getAgoraToken(safeChannelId);
            const numericUid = toNumericUid(user?.userId || user?.id);
            const config = { ...res, channel: safeChannelId, uid: numericUid, sessionId: Date.now() };
            dispatch(setAgoraConfig(config));

            const isJoining = receiverInfo?.isJoin === true;
            isInitiatorRef.current = !isJoining;
            dispatch(setIsInitiator(!isJoining));
            logSentRef.current = false;


            // ✅ THÊM LOGIC ĐẾM NGƯỢC CHO CUỘC GỌI NHÓM MỚI (giống Web)
            if (isGroupCall && !isJoining) {
                dispatch(setShowCountdown(true));
                dispatch(setCountdown(3));

                let count = 3;
                countdownIntervalRef.current = setInterval(() => {
                    count -= 1;
                    dispatch(setCountdown(count));
                    if (count <= 0) {
                        clearInterval(countdownIntervalRef.current);
                        countdownIntervalRef.current = null;
                        dispatch(setShowCountdown(false));
                        finalizeStartCall(type, cid, isGroupCall, isJoining, config, receiverInfo);
                        joiningRef.current = false;
                    }
                }, 1000);
            } else {
                finalizeStartCall(type, cid, isGroupCall, isJoining, config, receiverInfo);
                joiningRef.current = false;
            }

        } catch (e) {
            console.error('❌ [useAgoraCall] startCall ERROR:', e);
            dispatch(setEndCallReason('ERROR'));
            endCallRef.current?.(false);
            joiningRef.current = false;
        }
    }, [activeConversationId, user, activeConversation, finalizeStartCall]);


    const acceptCall = useCallback(async (signalData) => {
        if (joiningRef.current) return;
        try {
            joiningRef.current = true;
            isInitiatorRef.current = false;
            dispatch(setIsInitiator(false));
            logSentRef.current = false;

            // Yêu cầu quyền truy cập micro/camera trước khi tham gia cuộc gọi
            await getPermissions();

            dispatch(setEndCallReason(null));

            const cid = signalData?.conversationId || activeConversationId;
            const isGroupCall = signalData?.conversationType === 'GROUP' || callState.isGroup || String(cid).includes('GROUP');
            isGroupRef.current = isGroupCall;
            dispatch(setIsGroup(isGroupCall));
            const safeChannelId = sanitizeChannelId(cid);
            const res = await callApi.getAgoraToken(safeChannelId);
            const numericUid = toNumericUid(user?.userId || user?.id);
            const config = { ...res, channel: safeChannelId, uid: numericUid, sessionId: Date.now() };
            dispatch(setAgoraConfig(config));

            if (!isGroupCall) {
                emitCallSignal(cid, { type: 'CALL_ACCEPTED', agoraConfig: config }, myFullName);
            }

            dispatch(setCallStatus('connected'));
            if (!startTimeRef.current) {
                const signalInviteTime = signalData?.inviteTime || signalData?.signal?.inviteTime;
                startTimeRef.current = signalInviteTime || getTrueTime();
            }
        } catch (e) {
            console.error('❌ [useAgoraCall] acceptCall ERROR:', e);
            endCallRef.current?.(false);
        } finally { joiningRef.current = false; }
    }, [activeConversationId, user, callState.isGroup]);

    return {
        callStatus, callType, callerName, callerInfo, incomingSignal, duration, formatDuration,
        camOn, micOn, remoteUsers, startCall, acceptCall, endCall, cancelCountdown,
        countdown, showCountdown,
        toggleMic: () => dispatch(setMicOn(!micOn)),

        toggleCamera: () => dispatch(setCamOn(!camOn)),
        agoraConfig, connect: () => { return () => { }; },
        setRemoteUsers: (u) => dispatch(setRemoteUsers(u)),
        endCallReason, isGroup,
        hasHadRemote,
        onRequestClose: () => dispatch(resetCall())
    };
};
