import { useEffect, useCallback, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { PermissionsAndroid, Platform, Alert, Linking } from 'react-native';
import { useTranslation } from 'react-i18next';
import { createAudioPlayer, setAudioModeAsync, requestRecordingPermissionsAsync } from 'expo-audio';
import { Camera } from 'expo-camera';
import { onCallSignal, offCallSignal, emitCallSignal } from '../utils/socket';
import { isNativeAgoraAvailable } from '../utils/agoraNativeLoader';
import { getSelectedRingtoneSourceAsync } from '../utils/soundService';
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
    // Phân tách UID theo nền tảng (ios/android) để không bao giờ xung đột UID khi gọi chéo thiết bị
    const s = String(id) + '_' + Platform.OS;
    let hash = 0;
    for (let i = 0; i < s.length; i++) {
        hash = (hash << 5) - hash + s.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash) || 1;
};


let serverTimeOffset = 0; // localTime - serverTime
let isCalibratingTime = false;
let sharedResetTimer = null;
let sharedIsEndingCall = false;
let sharedActiveChannelId = null;
let sharedRemoteUserId = null;
let sharedCallerId = null;
let sharedIsGroup = false;
let sharedIsInitiator = false;
let sharedStartTime = null;
let sharedLogSent = false;

const clearSharedResetTimer = () => {
    if (sharedResetTimer) {
        clearTimeout(sharedResetTimer);
        sharedResetTimer = null;
    }
};

const resetSharedCallMeta = () => {
    sharedActiveChannelId = null;
    sharedRemoteUserId = null;
    sharedCallerId = null;
    sharedIsGroup = false;
    sharedIsInitiator = false;
    sharedStartTime = null;
    sharedLogSent = false;
};

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
        if (!e?.isSessionExpired && e?.response?.status !== 401) {
            console.warn('⏰ [TimeSync-Mobile] Calibration failed:', e);
        }
    } finally {
        isCalibratingTime = false;
    }
}

const getPermissions = async (type = 'video') => {
    try {
        if (Platform.OS === 'android') {
            const alreadyAudio = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
            let audioOk = alreadyAudio;
            if (!audioOk) {
                const audioGranted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
                audioOk = audioGranted === PermissionsAndroid.RESULTS.GRANTED;
            }
            if (!audioOk) {
                const expoAudioPerm = await requestRecordingPermissionsAsync().catch(() => ({ granted: false }));
                audioOk = Boolean(expoAudioPerm?.granted);
            }
            console.log('🎙️ [useAgoraCall] Android RECORD_AUDIO granted:', audioOk);
            if (!audioOk) return false;

            if (type === 'video') {
                const alreadyCam = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.CAMERA);
                let camOk = alreadyCam;
                if (!camOk) {
                    const cameraGranted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA);
                    camOk = cameraGranted === PermissionsAndroid.RESULTS.GRANTED;
                }
                if (!camOk) {
                    const expoCamPerm = await Camera.requestCameraPermissionsAsync().catch(() => ({ granted: false }));
                    camOk = Boolean(expoCamPerm?.granted || expoCamPerm?.status === 'granted');
                }
                console.log('📷 [useAgoraCall] Android CAMERA granted:', camOk);
                return camOk;
            }
            return true;
        } else if (Platform.OS === 'ios') {
            const { status: microphoneStatus } = await Camera.requestMicrophonePermissionsAsync();
            if (microphoneStatus !== 'granted') {
                return false;
            }
            if (type === 'video') {
                const { status: cameraStatus } = await Camera.requestCameraPermissionsAsync();
                return cameraStatus === 'granted';
            }
            return true;
        }
        return true;
    } catch (e) {
        console.error('❌ [useAgoraCall] getPermissions error:', e);
        return false;
    }
};

export const useAgoraCall = (activeConversationId = null, activeConversation = null, isListener = true) => {
    const { t } = useTranslation();
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
            : null) || t('common.user');

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
                try {
                    s.pause();
                } catch {}
                try {
                    s.remove();
                } catch {}
                console.log('🔊 [useAgoraCall] Sound stopped and unloaded');
            } catch (e) {
                console.warn('🔊 [useAgoraCall] stopSound error:', e);
            }
        }
    };

    // getPermissions is now defined outside the hook to remain static
    useEffect(() => {
        callStatusRef.current = callStatus;
        if (callStatus === 'idle' || callStatus === 'outgoing' || callStatus === 'incoming' || callStatus === 'connected') {
            sharedIsEndingCall = false;
        }
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
                    if (callStatus === 'incoming') {
                        file = await getSelectedRingtoneSourceAsync();
                    } else if (callStatus === 'outgoing') {
                        file = require('../../assets/sounds/outgoing_ring.wav');
                    }

                    if (!file) return;

                    await setAudioModeAsync({
                        playsInSilentMode: true,
                        shouldPlayInBackground: false,
                        interruptionMode: 'duckOthers',
                        allowsRecording: false,
                        shouldRouteThroughEarpiece: false,
                    });

                    const sound = createAudioPlayer(file);

                    if (!isActive) {
                        try { sound.pause(); } catch {}
                        try { sound.remove(); } catch {}
                        return;
                    }

                    sound.loop = true;
                    sound.volume = 1.0;
                    sound.play();

                    soundRef.current = sound;
                } catch (e) {
                    console.warn('🔊 [useAgoraCall] Sound error:', e);
                }
            } else if (callStatus === 'connected') {
                await stopSound();
                // Nếu đang dùng Agora Native SDK thì để Agora tự quản lý hoàn toàn AVAudioSession / AudioManager.
                // Chỉ gọi setAudioModeAsync trên iOS khi fallback sang WebView (Expo Go).
                if (Platform.OS === 'ios' && !isNativeAgoraAvailable()) {
                    try {
                        await setAudioModeAsync({
                            allowsRecording: true,
                            playsInSilentMode: true,
                            shouldPlayInBackground: true,
                            interruptionMode: 'mixWithOthers',
                            shouldRouteThroughEarpiece: false,
                        });
                    } catch (e) {
                        console.warn('🔊 [useAgoraCall] Failed to configure iOS connected call audio mode:', e);
                    }
                }
            } else {
                await stopSound();
                try {
                    await setAudioModeAsync({
                        allowsRecording: false,
                        playsInSilentMode: true,
                        shouldPlayInBackground: false,
                        interruptionMode: 'mixWithOthers',
                        shouldRouteThroughEarpiece: false,
                    });
                } catch (e) {
                    // Ignore audio mode reset errors on idle
                }
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
        if (callStatusRef.current === 'ended' && sendSignal) {
            clearSharedResetTimer();
            resetSharedCallMeta();
            sharedIsEndingCall = false;
            dispatch(resetCall());
            return;
        }
        if (sharedIsEndingCall || callStatusRef.current === 'idle' || callStatusRef.current === 'ended') {
            return;
        }
        sharedIsEndingCall = true;
        clearSharedResetTimer();

        const cid = sharedActiveChannelId || activeChannelRef.current || activeConversationId || callState.activeConversationId || activeConvIdRef.current;
        // Phân biệt chính xác Nhóm vs 1-1 để gửi đúng loại tín hiệu
        const isActuallyGroup = (cid && (String(cid).includes('SINGLE') || String(cid).includes('SINGLE#')))
            ? false
            : (sharedIsGroup ||
               isGroupRef.current ||
               isGroup ||
               (cid && String(cid).includes('GROUP')) ||
               (activeConversation && activeConversation.type === 'GROUP') ||
               (activeConversationId && String(activeConversationId).includes('GROUP')));

        const isLastPerson = remoteUsers.length === 0;

        // 1. Gửi tín hiệu Socket NGAY LẬP TỨC
        if (sendSignal && cid) {
            if (isActuallyGroup) {
                const isCancelingBeforeJoin = (sharedIsInitiator || isInitiatorRef.current) && !hasHadRemote;
                if (isCancelingBeforeJoin) {
                    console.log('📤 [useAgoraCall] Initiator canceling group call (Group mode):', cid);
                    emitCallSignal(cid, {
                        type: 'HANGUP',
                        reason: 'ENDED',
                        conversationType: 'GROUP'
                    });
                } else if (callStatus === 'connected') {
                    console.log('📤 [useAgoraCall] Participant leaving group call (Group mode):', cid);
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

        // 2. Dừng timer & tính thời lượng
        if (ringTimerRef.current) {
            clearTimeout(ringTimerRef.current);
            ringTimerRef.current = null;
        }

        const effectiveStartTime = sharedStartTime || startTimeRef.current;
        let callDuration = 0;
        if (effectiveStartTime) callDuration = Math.floor((getTrueTime() - effectiveStartTime) / 1000);

        const isCaller = !incomingSignal && (sharedIsInitiator || isInitiatorRef.current);
        const isManual = sendSignal;

        let shouldLog = false;
        const isCallConnected = callStatus === 'connected';

        if (!isActuallyGroup) {
            shouldLog = isManual || (isCaller && ['MISSED', 'REJECTED', 'UNREACHABLE', 'BUSY'].includes(reason));
        } else {
            const actuallyStarted = hasHadRemote || callDuration > 0;
            shouldLog = (isCallConnected && isLastPerson && actuallyStarted && (reason === 'ENDED' || reason === 'SUCCESS')) ||
                (isCaller && ['REJECTED', 'MISSED', 'BUSY'].includes(reason));
        }

        console.log(`🏁 [EndCall] CID: ${cid} | shouldLog: ${shouldLog} | isGroup: ${isActuallyGroup} | isLast: ${isLastPerson} | Reason: ${reason}`);

        if (cid && shouldLog && !sharedLogSent && !logSentRef.current && ['connected', 'outgoing', 'incoming', 'ringing'].includes(callStatus)) {
            sharedLogSent = true;
            logSentRef.current = true;

            try {
                const actuallyStarted = isActuallyGroup 
                    ? hasHadRemote 
                    : (callDuration > 0 || effectiveStartTime !== null || callStatus === 'connected');

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
                chatApi.sendMessage({ conversationId: cid, content, type: 'CALL_LOG' })
                    .catch(err => console.error('❌ [useAgoraCall] Failed to send final log (async):', err));
            } catch (err) {
                console.error('❌ [useAgoraCall] Failed to send final log:', err);
            }
        }

        // 3. Cập nhật Redux NGAY LẬP TỨC (không chờ async) để WebView unmount & UI phản hồi 0ms
        let msg = t('chat.ended');
        if (reason === 'REJECTED') msg = t('chat.rejected');
        else if (reason === 'BUSY') msg = t('chat.busy');
        else if (reason === 'MISSED') msg = t('chat.missed_call');
        else if (reason === 'ACCEPTED_ELSEWHERE') msg = t('chat.accepted_elsewhere');

        callStatusRef.current = 'ended';
        dispatch(setEndCallReason(msg));
        dispatch(setAgoraConfig(null));
        dispatch(setCallStatus('ended'));

        // Reset toàn bộ refs dùng chung & cục bộ
        resetSharedCallMeta();
        startTimeRef.current = null;
        isInitiatorRef.current = false;
        isGroupRef.current = false;
        activeChannelRef.current = null;
        activeConvIdRef.current = null;
        processedSignals.current.clear();
        logSentRef.current = false;

        stopSound().catch(() => {});

        // Tự động quay lại chat sau 1.6s (nút thoát có thể đóng ngay lập tức trước đó)
        sharedResetTimer = setTimeout(() => {
            sharedResetTimer = null;
            sharedIsEndingCall = false;
            console.log('⏰ [useAgoraCall] Final resetCall triggered.');
            dispatch(resetCall());
        }, 1600);

    }, [activeConversationId, callState.activeConversationId, callStatus, callType, dispatch, incomingSignal, remoteUsers, activeConversation, user, hasHadRemote, isInitiator, isGroup, myFullName, t]);



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
                if (callStatusRef.current !== 'idle' && callStatusRef.current !== 'ended') {
                    emitCallSignal(signalConvId, { type: 'HANGUP', reason: 'BUSY' });
                    return;
                }
                clearSharedResetTimer();
                sharedIsEndingCall = false;
                dispatch(resetCall());
                console.log('📩 [useAgoraCall] Incoming CALL_INVITE:', JSON.stringify(signal));

                const isGroupCall = signal.isGroup === true ||
                    signal.conversationType === 'GROUP' ||
                    actualData.conversationType === 'GROUP' ||
                    signalConvId.includes('GROUP') ||
                    signalConvId.startsWith('GROUP#');

                isGroupRef.current = isGroupCall;
                sharedIsGroup = isGroupCall;
                callerIdRef.current = cleanSenderId;
                sharedCallerId = cleanSenderId;
                dispatch(setIsGroup(isGroupCall));




                // Ưu tiên thông tin nhóm nếu là cuộc gọi nhóm
                let avatar = isGroupCall
                    ? (signal.conversationAvatar || actualData.conversationAvatar)
                    : (signal.senderAvatar || actualData.senderAvatar || actualData.senderInfo?.avatarUrl);
                let name = isGroupCall
                    ? (signal.conversationName || actualData.conversationName || t('chat.group_fallback'))
                    : (senderName || signal.senderName || actualData.senderName || t('common.user'));

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
                sharedActiveChannelId = signalConvId;
                callerIdRef.current = senderId;
                sharedCallerId = senderId;
                remoteUserIdRef.current = senderId;
                sharedRemoteUserId = senderId;
                dispatch(setActiveConversationId(signalConvId));
                dispatch(setCallStatus('incoming'));
            } else if (signal.type === 'CALL_ACCEPTED') {
                console.log('✅ [useAgoraCall] CALL_ACCEPTED from:', senderName || senderId, 'for CID:', signalConvId);

                const sigId = signal.timestamp || JSON.stringify(signal);
                if (processedSignals.current.has(sigId)) return;
                processedSignals.current.add(sigId);

                // Kiểm tra xem đây có phải cuộc gọi mình đang thực hiện không
                const activeCid = String(sharedActiveChannelId || activeChannelRef.current || activeConvIdRef.current || '').trim();
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
                const shouldConnect = sharedIsInitiator || isInitiatorRef.current || (callStatusRef.current === 'outgoing' && isMyCall);

                if (shouldConnect && callStatusRef.current === 'outgoing') {
                    console.log('🚀 [useAgoraCall] Connection confirmed, switching to connected state.');
                    dispatch(setCallStatus('connected'));
                    if (!sharedStartTime) sharedStartTime = getTrueTime();
                    if (!startTimeRef.current) startTimeRef.current = sharedStartTime;
                } else {
                    console.log('ℹ️ [useAgoraCall] CALL_ACCEPTED ignored (not my outgoing call or already connected)');
                }
            } else if (signal.type === 'HANGUP' || signal.type === 'LEAVE') {

                console.log(`📩 [useAgoraCall] Termination signal: ${signal.type} from ${senderName || senderId}`);
                const activeCid = String(sharedActiveChannelId || activeChannelRef.current || activeConvIdRef.current || '').trim();

                const reason = signal.reason || actualData.reason || 'ENDED';

                const isActuallyGroup = (activeCid && (String(activeCid).includes('SINGLE') || String(activeCid).includes('SINGLE#')))
                    ? false
                    : (sharedIsGroup ||
                       isGroupRef.current ||
                       callState.isGroup ||
                       activeCid.includes('GROUP') ||
                       signalConvId.includes('GROUP') ||
                       actualData.conversationType === 'GROUP');

                if (isActuallyGroup && callStatusRef.current === 'connected') {
                    console.log('ℹ️ [useAgoraCall] Group call active, ignoring HANGUP/LEAVE signal.');
                    return;
                }

                console.log(`🛑 [useAgoraCall] ${signal.type} received. SignalCID:`, signalConvId, 'ActiveCID:', activeCid);

                const cleanSenderId = senderId && senderId !== 'undefined' && senderId !== 'null' ? String(senderId).trim() : null;
                const myIdStr = user?.userId || user?.id ? String(user?.userId || user?.id).trim() : null;
                const partnerIdStr = (sharedRemoteUserId || remoteUserIdRef.current) ? String(sharedRemoteUserId || remoteUserIdRef.current).trim() : null;

                const isSelfSync = cleanSenderId && myIdStr && cleanSenderId === myIdStr;
                const isPartnerSignal = !isActuallyGroup && partnerIdStr && cleanSenderId && cleanSenderId === partnerIdStr;
                const cidMatch = Boolean(activeCid) && ((signalConvId === activeCid) || (sanitizeChannelId(signalConvId) === sanitizeChannelId(activeCid)));

                let shouldEnd = false;
                if (isActuallyGroup) {
                    const initiatorId = sharedCallerId || callerIdRef.current || callerInfo?.id || incomingSignal?.senderId || callerId;
                    const isFromInitiator = initiatorId && cleanSenderId && String(cleanSenderId) === String(initiatorId);
                    if (callStatusRef.current !== 'connected' && (isFromInitiator || (isSelfSync && cidMatch))) {
                        shouldEnd = true;
                    }
                } else {
                    // Trong cuộc gọi 1-1: chỉ cần khớp CID, khớp partner, hoặc đang có cuộc gọi 1-1 mà đối phương gửi HANGUP
                    shouldEnd = cidMatch || isPartnerSignal || (!isSelfSync && Boolean(signalConvId) && !activeCid);
                }

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
                let isBlocked = false;
                if (!isGroupCall && activeConversation) {
                    const partner = activeConversation.members?.find(m => {
                        const mid = m.userId || m.id || m._id;
                        const uid = user?.userId || user?.id || user?._id;
                        return mid && mid !== 'undefined' && mid !== 'null' && uid && String(mid).trim() !== String(uid).trim();
                    });
                    if (partner?.friendshipStatus === 'BLOCKED') {
                        isBlocked = true;
                    }
                }

                if (!isBlocked) {
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
                    console.log('[Agora] Signal CALL_INVITE suppressed on mobile due to block status.');
                }
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
                const partnerId = other?.userId || other?.id || other?._id;
                remoteUserIdRef.current = partnerId;
                sharedRemoteUserId = partnerId;

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
            clearSharedResetTimer();
            resetSharedCallMeta();
            sharedIsEndingCall = false;
            dispatch(resetCall());

            joiningRef.current = true;
            isInitiatorRef.current = true;
            sharedIsInitiator = true;
            logSentRef.current = false;

            const permissionsGranted = await getPermissions(type);
            if (!permissionsGranted) {
                Alert.alert(
                    t('common.error') || 'Cần cấp quyền truy cập',
                    t('chat.no_permission') || 'Ứng dụng cần cấp quyền micro và camera để thực hiện cuộc gọi. Hãy bật trong Cài đặt thiết bị.',
                    [
                        { text: t('common.cancel') || 'Để sau', style: 'cancel' },
                        { text: 'Mở Cài đặt', onPress: () => Linking.openSettings().catch(() => {}) }
                    ]
                );
                joiningRef.current = false;
                return;
            }

            const isGroupCall = receiverInfo?.isGroup !== undefined
                ? receiverInfo.isGroup
                : (activeConversation?.type === 'GROUP' ||
                   cid.startsWith('GROUP#') ||
                   cid.includes('GROUP') ||
                   (!cid.includes('SINGLE') && !cid.includes('SINGLE#')));
            isGroupRef.current = isGroupCall;
            sharedIsGroup = isGroupCall;
            dispatch(setIsGroup(isGroupCall));

            // Tự tìm thông tin đối phương nếu là 1-1 mà thiếu info
            const partner = !isGroupCall ? activeConversation?.members?.find(m => {
                const mid = m.userId || m.id || m._id;
                const uid = user?.userId || user?.id || user?._id;
                return mid && mid !== 'undefined' && mid !== 'null' && uid && String(mid).trim() !== String(uid).trim();
            }) : null;

            const finalName = receiverInfo?.name || activeConversation?.name || partner?.fullName || partner?.name || t('common.user');
            const finalAvatar = receiverInfo?.avatar || activeConversation?.avatar || activeConversation?.avatarUrl || partner?.avatar || partner?.avatarUrl;

            const partnerId = partner?.userId || partner?.id || partner?._id;
            sharedRemoteUserId = partnerId || null;
            dispatch(setCallerInfo({ name: finalName, avatar: finalAvatar, id: partnerId }));

            dispatch(setEndCallReason(null));
            dispatch(setCallType(type));
            dispatch(setCamOn(type === 'video'));
            dispatch(setMicOn(true));

            activeChannelRef.current = cid;
            sharedActiveChannelId = cid;
            dispatch(setActiveConversationId(cid));

            const numericUid = toNumericUid(user?.userId || user?.id);
            const safeChannelId = sanitizeChannelId(cid);
            const res = await callApi.getAgoraToken(safeChannelId, numericUid);
            const config = { ...res, channel: safeChannelId, uid: numericUid, sessionId: Date.now() };
            dispatch(setAgoraConfig(config));

            const isJoining = receiverInfo?.isJoin === true;
            isInitiatorRef.current = !isJoining;
            sharedIsInitiator = !isJoining;
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
            clearSharedResetTimer();
            sharedIsEndingCall = false;
            joiningRef.current = true;
            isInitiatorRef.current = false;
            dispatch(setIsInitiator(false));
            logSentRef.current = false;

            const type = signalData?.callType || signalData?.signal?.callType || callState.callType || 'video';
            const permissionsGranted = await getPermissions(type);
            if (!permissionsGranted) {
                Alert.alert(
                    t('common.error') || 'Cần cấp quyền truy cập',
                    t('chat.no_permission') || 'Ứng dụng cần cấp quyền micro và camera để nhận cuộc gọi. Hãy bật trong Cài đặt thiết bị.',
                    [
                        { text: t('common.cancel') || 'Để sau', style: 'cancel' },
                        { text: 'Mở Cài đặt', onPress: () => Linking.openSettings().catch(() => {}) }
                    ]
                );
                endCallRef.current?.(false, 'REJECTED');
                joiningRef.current = false;
                return;
            }

            dispatch(setEndCallReason(null));
            dispatch(setCallType(type));
            dispatch(setCamOn(type === 'video'));
            dispatch(setMicOn(true));

            const cid = signalData?.conversationId || activeConversationId || callState.activeConversationId;
            activeChannelRef.current = cid;
            sharedActiveChannelId = cid;
            dispatch(setActiveConversationId(cid));
            const isGroupCall = signalData?.conversationType === 'GROUP' || callState.isGroup || String(cid).includes('GROUP');
            isGroupRef.current = isGroupCall;
            sharedIsGroup = isGroupCall;
            sharedIsInitiator = false;
            dispatch(setIsGroup(isGroupCall));
            const numericUid = toNumericUid(user?.userId || user?.id);
            const safeChannelId = sanitizeChannelId(cid);
            const res = await callApi.getAgoraToken(safeChannelId, numericUid);
            const config = { ...res, channel: safeChannelId, uid: numericUid, sessionId: Date.now() };
            dispatch(setAgoraConfig(config));

            if (!isGroupCall) {
                emitCallSignal(cid, { type: 'CALL_ACCEPTED', agoraConfig: config }, myFullName);
            }

            dispatch(setCallStatus('connected'));
            if (!sharedStartTime) {
                const signalInviteTime = signalData?.inviteTime || signalData?.signal?.inviteTime;
                sharedStartTime = signalInviteTime || getTrueTime();
                startTimeRef.current = sharedStartTime;
            }
        } catch (e) {
            console.error('❌ [useAgoraCall] acceptCall ERROR:', e);
            endCallRef.current?.(false);
        } finally { joiningRef.current = false; }
    }, [activeConversationId, callState.activeConversationId, user, callState.isGroup, callState.callType, incomingSignal, dispatch, myFullName, t]);

    const handleResetCall = useCallback(() => {
        clearSharedResetTimer();
        resetSharedCallMeta();
        sharedIsEndingCall = false;
        dispatch(resetCall());
    }, [dispatch]);

    return {
        callStatus, callType, callerName, callerInfo, incomingSignal, duration, formatDuration,
        camOn, micOn, remoteUsers, startCall, acceptCall, endCall, cancelCountdown,
        resetCall: handleResetCall,
        countdown, showCountdown,
        toggleMic: () => dispatch(setMicOn(!micOn)),

        toggleCamera: () => dispatch(setCamOn(!camOn)),
        agoraConfig, connect: () => { return () => { }; },
        setRemoteUsers: (u) => dispatch(setRemoteUsers(u)),
        endCallReason, isGroup,
        hasHadRemote,
        onRequestClose: handleResetCall
    };
};
