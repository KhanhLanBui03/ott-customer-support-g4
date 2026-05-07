import { Audio } from 'expo-av';
import { useEffect, useCallback, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { PermissionsAndroid, Platform } from 'react-native';
import { onCallSignal, offCallSignal, emitCallSignal } from '../utils/socket';
import { callApi } from '../api/callApi';
import { chatApi } from '../api/chatApi';
import { addMessage } from '../store/chatSlice';
import { 
    setCallStatus, setCallType, setCallerInfo, setIncomingSignal, 
    setAgoraConfig, setRemoteUsers, setDuration, setCamOn, setMicOn, resetCall 
} from '../store/callSlice';

const sanitizeChannelId = (id) => (id || '').replace(/#/g, '-').slice(0, 64);

export const useAgoraCall = (activeConversationId = null, activeConversation = null, isListener = true) => {
    const user = useSelector(state => state.auth.user);
    const callState = useSelector(state => state.call);
    const dispatch = useDispatch();

    const { 
        callStatus, callType, callerName, callerInfo, incomingSignal, 
        duration, camOn, micOn, remoteUsers, agoraConfig 
    } = callState;

    const timerRef = useRef(null);
    const endCallRef = useRef(null);
    const startTimeRef = useRef(null);
    const ringTimerRef = useRef(null);
    const joiningRef = useRef(false);
    const logSentRef = useRef(false);
    const activeChannelRef = useRef(null);

    const getPermissions = async () => {
        try {
            const { status: audioStatus } = await Audio.requestPermissionsAsync();
            console.log('🎙️ [useAgoraCall] Audio Permission:', audioStatus);
            
            if (audioStatus !== 'granted') {
                Alert.alert('Quyền truy cập', 'Bạn cần cấp quyền Micro để thực hiện cuộc gọi');
                return false;
            }
            
            if (Platform.OS === 'android') {
                await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA);
            }
            return true;
        } catch (e) {
            console.error('⚠️ [useAgoraCall] Permission Error:', e);
            return false;
        }
    };

    useEffect(() => {
        if (callStatus === 'connected') {
            if (!startTimeRef.current) {
                startTimeRef.current = Date.now();
                console.log('⏰ [useAgoraCall] Timer started at:', startTimeRef.current);
            }
            timerRef.current = setInterval(() => {
                const now = Date.now();
                const diff = Math.floor((now - startTimeRef.current) / 1000);
                dispatch(setDuration(diff));
            }, 1000);
        } else {
            if (timerRef.current) clearInterval(timerRef.current);
            if (callStatus === 'idle' || callStatus === 'ended') {
                startTimeRef.current = null;
                dispatch(setDuration(0));
            }
        }
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [callStatus, dispatch]);

    const formatDuration = useCallback(() => {
        const m = Math.floor(duration / 60);
        const s = duration % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    }, [duration]);

    const endCall = useCallback(async (sendSignal = true, reason = 'ENDED') => {
        const cid = activeChannelRef.current || incomingSignal?.conversationId || activeConversationId;
        let callDuration = 0;
        if (startTimeRef.current) callDuration = Math.floor((Date.now() - startTimeRef.current) / 1000);

        if (sendSignal && cid) {
            console.log('📤 [useAgoraCall] Sending HANGUP signal to:', cid);
            emitCallSignal(cid, { type: 'HANGUP', reason });
        } else {
            console.log('⚠️ [useAgoraCall] Cannot send HANGUP: cid is', cid);
        }

        // CHỈ NGƯỜI CHỦ ĐỘNG TẮT mới được quyền gửi CALL_LOG để tránh trùng lặp
        // Và để đảm bảo tin nhắn call xuất hiện bên phía người tắt (theo yêu cầu)
        const isCaller = !incomingSignal;
        const isManual = sendSignal; // Manual hangup will have sendSignal = true
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

                chatApi.sendMessage({ conversationId: cid, content, type: 'CALL_LOG' });
            } catch (err) {
                console.error('[useAgoraCall] Failed to send call log:', err);
            }
        }

        dispatch(setCallStatus('ended'));
        setTimeout(() => { 
            dispatch(resetCall()); 
            startTimeRef.current = null;
            logSentRef.current = false; 
            activeChannelRef.current = null;
        }, 1500);
    }, [activeConversationId, callStatus, callType, dispatch, incomingSignal]);

    endCallRef.current = endCall;

    useEffect(() => {
        if (!isListener) return;
        const handler = (data) => {
            // Chuẩn hóa dữ liệu: Backend bọc trong 'payload'
            const actualData = data?.payload || data;
            const { signal, senderId, senderName } = actualData || {};
            const signalConvId = data?.conversationId || actualData?.conversationId;

            console.log('📞 [useAgoraCall] Signal Received:', signal?.type, 'from:', senderName);
            
            if (!signal) return;
            // Chỉ bỏ qua nếu là tín hiệu INVITE từ chính mình (tránh lặp)
            if (signal.type === 'CALL_INVITE' && String(senderId) === String(user?.userId || user?.id)) return;
            
            if (signal.type === 'CALL_INVITE') {
                console.log('🚀 [useAgoraCall] Incoming INVITE. Raw Data:', JSON.stringify(actualData));
                
                // Quét mọi ngách để tìm Avatar
                const avatar = signal.senderAvatar || 
                               actualData.senderAvatar || 
                               signal.conversationAvatar || 
                               actualData.senderInfo?.avatarUrl;
                
                const name = senderName || signal.senderName || actualData.senderName || 'Người dùng';

                console.log('👤 [useAgoraCall] Resolved Caller:', name, 'Avatar:', avatar);

                dispatch(setCallerInfo({ 
                    name: name, 
                    avatar: avatar 
                }));
                
                dispatch(setIncomingSignal({ ...actualData, conversationId: signalConvId }));
                dispatch(setCallType(signal.callType || 'video'));
                if (signal.agoraConfig) {
                    dispatch(setAgoraConfig(signal.agoraConfig));
                }
                if (signalConvId) {
                    activeChannelRef.current = signalConvId;
                }
                dispatch(setCallStatus('incoming'));
            } else if (signal.type === 'CALL_ACCEPTED') {
                console.log('✅ [useAgoraCall] Call ACCEPTED. Switching to connected...');
                if (signal.agoraConfig) {
                    dispatch(setAgoraConfig(signal.agoraConfig));
                }
                dispatch(setCallStatus('connected'));
            } else if (signal.type === 'HANGUP') {
                const reason = signal.reason || actualData.reason || 'ENDED';
                console.log('🛑 [useAgoraCall] HANGUP received. Reason:', reason);
                endCallRef.current?.(false, reason);
            }
        };
        onCallSignal(handler);
        return () => offCallSignal(handler);
    }, [user, dispatch, isListener]);

    const startCall = useCallback(async (type = 'video', receiverInfo = null, targetCid = null) => {
        const cid = targetCid || receiverInfo?.conversationId || activeConversationId;
        if (!cid || joiningRef.current) return;
        try {
            joiningRef.current = true;
            logSentRef.current = false; // Reset log flag
            await getPermissions();
            
            // Ưu tiên receiverInfo truyền vào (từ UI), sau đó mới đến activeConversation
            const finalName = receiverInfo?.name || activeConversation?.name || 'Người dùng';
            const finalAvatar = receiverInfo?.avatar || activeConversation?.avatar || activeConversation?.avatarUrl;

            dispatch(setCallerInfo({
                name: finalName,
                avatar: finalAvatar
            }));

            dispatch(setCallType(type));
            activeChannelRef.current = cid;
            dispatch(setCallStatus('outgoing'));
            const safeChannelId = sanitizeChannelId(cid);
            const res = await callApi.getAgoraToken(safeChannelId);
            const config = { ...res, channel: safeChannelId };
            dispatch(setAgoraConfig(config));
            
            emitCallSignal(cid, { 
                type: 'CALL_INVITE', 
                callType: type, 
                agoraConfig: config,
                senderAvatar: user?.avatar || user?.avatarUrl // Gửi kèm avatar của mình cho đầu kia
            }, user?.fullName || 'Người dùng');
        } catch (e) { endCallRef.current?.(false); } finally { joiningRef.current = false; }
    }, [activeConversationId, activeConversation, user, dispatch]);

    const acceptCall = useCallback(async (signalData) => {
        if (joiningRef.current) return;
        try {
            joiningRef.current = true;
            logSentRef.current = false; // Reset log flag
            await getPermissions();
            const cid = signalData?.conversationId;
            activeChannelRef.current = cid;
            const safeChannelId = sanitizeChannelId(cid);
            const res = await callApi.getAgoraToken(safeChannelId);
            dispatch(setAgoraConfig({ ...res, channel: safeChannelId }));
            
            emitCallSignal(cid, { type: 'CALL_ACCEPTED' }, user?.fullName || 'Người dùng');
            dispatch(setCallStatus('connected'));
        } catch (e) { endCallRef.current?.(false); } finally { joiningRef.current = false; }
    }, [user, dispatch]);

    return {
        callStatus, callType, callerName, callerInfo, incomingSignal, duration, formatDuration,
        camOn, micOn, remoteUsers, startCall, acceptCall, endCall, 
        toggleMic: () => dispatch(setMicOn(!micOn)),
        toggleCamera: () => dispatch(setCamOn(!camOn)),
        agoraConfig, connect: () => { return () => {}; }, // Stub for layout
        setRemoteUsers: (u) => dispatch(setRemoteUsers(u))
    };
};
