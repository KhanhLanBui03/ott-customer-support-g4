import { Audio } from 'expo-av';
import { useEffect, useCallback, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { PermissionsAndroid, Platform, Alert } from 'react-native';
import { onCallSignal, offCallSignal, emitCallSignal } from '../utils/socket';
import { callApi } from '../api/callApi';
import { chatApi } from '../api/chatApi';
import { addMessage } from '../store/chatSlice';
import { 
    setCallStatus, setCallType, setCallerInfo, setIncomingSignal, 
    setAgoraConfig, setRemoteUsers, setDuration, setCamOn, setMicOn, setActiveConversationId, setEndCallReason, resetCall 
} from '../store/callSlice';

const sanitizeChannelId = (id) => {
    if (!id) return '';
    let parts = String(id).replace(/#/g, '-').split('-');
    if (parts.length > 1) {
        const prefix = parts[0];
        const sortedIds = parts.slice(1).sort();
        return (prefix + '-' + sortedIds.join('-')).slice(0, 64);
    }
    return String(id).replace(/#/g, '-').slice(0, 64);
};

export const useAgoraCall = (activeConversationId = null, activeConversation = null, isListener = true) => {
    const user = useSelector(state => state.auth.user);
    const callState = useSelector(state => state.call);
    const dispatch = useDispatch();

    const { 
        callStatus, callType, callerName, callerId, callerInfo, incomingSignal, 
        duration, camOn, micOn, remoteUsers, agoraConfig, endCallReason 
    } = callState;

    const timerRef = useRef(null);
    const endCallRef = useRef(null);
    const startTimeRef = useRef(null);
    const ringTimerRef = useRef(null);
    const joiningRef = useRef(false);
    const logSentRef = useRef(false);
    const processedSignals = useRef(new Set());
    const activeChannelRef = useRef(null);
    const callStatusRef = useRef(callStatus);
    const activeConvIdRef = useRef(callState.activeConversationId);

    const getPermissions = async () => {
        try {
            const { status: audioStatus } = await Audio.requestPermissionsAsync();
            if (audioStatus !== 'granted') return false;
            if (Platform.OS === 'android') await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA);
            return true;
        } catch (e) { return false; }
    };

    useEffect(() => {
        if (callStatus === 'connected') {
            if (!startTimeRef.current) startTimeRef.current = Date.now();
            timerRef.current = setInterval(() => {
                const diff = Math.floor((Date.now() - startTimeRef.current) / 1000);
                dispatch(setDuration(diff));
            }, 1000);
        } else {
            if (timerRef.current) clearInterval(timerRef.current);
            if (callStatus === 'idle' || callStatus === 'ended') {
                startTimeRef.current = null;
                dispatch(setDuration(0));
            }
        }
        return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }, [callStatus, dispatch]);

    useEffect(() => { callStatusRef.current = callStatus; }, [callStatus]);
    useEffect(() => { activeConvIdRef.current = callState.activeConversationId; }, [callState.activeConversationId]);

    const formatDuration = useCallback(() => {
        const m = Math.floor(duration / 60);
        const s = duration % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    }, [duration]);

    const endCall = useCallback(async (sendSignal = true, reason = 'ENDED') => {
        const cid = activeChannelRef.current || activeConvIdRef.current || incomingSignal?.conversationId || activeConversationId;
        let callDuration = 0;
        if (startTimeRef.current) callDuration = Math.floor((Date.now() - startTimeRef.current) / 1000);

        if (sendSignal && cid) {
            console.log('📤 [useAgoraCall] Emit HANGUP to:', cid, 'Reason:', reason);
            emitCallSignal(cid, { type: 'HANGUP', reason });
        }

        const isCaller = !incomingSignal;
        const isManual = sendSignal;
        const shouldLog = isManual || (isCaller && (reason === 'MISSED' || reason === 'REJECTED' || reason === 'UNREACHABLE' || reason === 'BUSY'));

        if (cid && shouldLog && !logSentRef.current && ['connected', 'outgoing', 'incoming', 'ringing'].includes(callStatus)) {
            logSentRef.current = true;
            try {
                let statusStr = (callDuration > 0 && callStatus === 'connected') ? 'SUCCESS' : (reason === 'REJECTED' ? 'REJECTED' : 'MISSED');
                const content = JSON.stringify({ callType: callType || 'audio', duration: callDuration, status: statusStr });
                chatApi.sendMessage({ conversationId: cid, content, type: 'CALL_LOG' });
            } catch (err) {}
        }

        dispatch(setCallStatus('ended'));
        let msg = 'Cuộc gọi đã kết thúc';
        if (reason === 'REJECTED') msg = 'Người nghe đã từ chối';
        else if (reason === 'BUSY') msg = 'Người nghe đang bận';
        else if (reason === 'MISSED') msg = 'Cuộc gọi nhỡ';
        dispatch(setEndCallReason(msg));

        setTimeout(() => { 
            dispatch(resetCall()); 
            startTimeRef.current = null;
            logSentRef.current = false; 
            activeChannelRef.current = null;
            processedSignals.current = new Set();
        }, 2000);
    }, [activeConversationId, callStatus, callType, dispatch, incomingSignal]);

    endCallRef.current = endCall;

    useEffect(() => {
        if (!isListener) return;
        const handler = (data) => {
            const actualData = data?.payload || data;
            const { signal, senderId, senderName } = actualData || {};
            const signalConvId = String(data?.conversationId || actualData?.conversationId || '').trim();

            if (!signal) return;
            if (String(senderId) === String(user?.userId || user?.id)) return;
            
            console.log('📞 [useAgoraCall] Socket Signal:', signal.type, 'CID:', signalConvId);

            if (signal.type === 'CALL_INVITE') {
                if (callStatusRef.current !== 'idle') {
                    emitCallSignal(signalConvId, { type: 'HANGUP', reason: 'BUSY' });
                    return;
                }
                const avatar = signal.senderAvatar || actualData.senderAvatar || signal.conversationAvatar || actualData.senderInfo?.avatarUrl;
                const name = senderName || signal.senderName || actualData.senderName || 'Người dùng';
                dispatch(setCallerInfo({ name, avatar }));
                dispatch(setIncomingSignal({ ...actualData, conversationId: signalConvId }));
                const type = signal.callType || 'video';
                dispatch(setCallType(type));
                dispatch(setCamOn(type === 'video'));
                dispatch(setMicOn(true));
                if (signal.agoraConfig) dispatch(setAgoraConfig(signal.agoraConfig));
                activeChannelRef.current = signalConvId;
                dispatch(setActiveConversationId(signalConvId));
                dispatch(setCallStatus('incoming'));
            } else if (signal.type === 'CALL_ACCEPTED') {
                const sigId = signal.timestamp || JSON.stringify(signal);
                if (processedSignals.current.has(sigId)) return;
                processedSignals.current.add(sigId);
                if (signal.agoraConfig) dispatch(setAgoraConfig(signal.agoraConfig));
                dispatch(setCallStatus('connected'));
            } else if (signal.type === 'HANGUP') {
                const activeCid = String(activeChannelRef.current || activeConvIdRef.current || '').trim();
                const reason = signal.reason || actualData.reason || 'ENDED';
                
                console.log('🛑 [useAgoraCall] HANGUP received. Incoming:', signalConvId, 'Active:', activeCid, 'Reason:', reason);
                
                const isMatch = (signalConvId === activeCid) || 
                                (sanitizeChannelId(signalConvId) === sanitizeChannelId(activeCid));
                
                if (isMatch && callStatusRef.current !== 'idle' && callStatusRef.current !== 'ended') {
                    console.log('✅ [useAgoraCall] HANGUP Match! Ending...');
                    endCallRef.current?.(false, reason);
                }
            }
        };
        onCallSignal(handler);
        return () => offCallSignal(handler);
    }, [user, dispatch, isListener]);

    const startCall = useCallback(async (type = 'video', receiverInfo = null, targetCid = null) => {
        const cid = String(targetCid || receiverInfo?.conversationId || activeConversationId || '').trim();
        if (!cid || joiningRef.current) return;
        try {
            joiningRef.current = true;
            logSentRef.current = false;
            await getPermissions();
            const finalName = receiverInfo?.name || activeConversation?.name || 'Người dùng';
            const finalAvatar = receiverInfo?.avatar || activeConversation?.avatar || activeConversation?.avatarUrl;
            dispatch(setCallerInfo({ name: finalName, avatar: finalAvatar }));
            dispatch(setEndCallReason(null));
            dispatch(setCallType(type));
            dispatch(setCamOn(type === 'video'));
            dispatch(setMicOn(true));
            
            console.log('🚀 [useAgoraCall] startCall CID:', cid);
            activeChannelRef.current = cid;
            dispatch(setActiveConversationId(cid));
            dispatch(setCallStatus('outgoing'));
            
            const safeChannelId = sanitizeChannelId(cid);
            const res = await callApi.getAgoraToken(safeChannelId);
            const config = { ...res, channel: safeChannelId, sessionId: Date.now() };
            dispatch(setAgoraConfig(config));
            emitCallSignal(cid, { type: 'CALL_INVITE', callType: type, agoraConfig: config, senderAvatar: user?.avatar || user?.avatarUrl }, user?.fullName || 'Người dùng');
        } catch (e) { endCallRef.current?.(false); } finally { joiningRef.current = false; }
    }, [activeConversationId, activeConversation, user, dispatch]);

    const acceptCall = useCallback(async (signalData) => {
        if (joiningRef.current) return;
        try {
            joiningRef.current = true;
            logSentRef.current = false;
            await getPermissions();
            dispatch(setEndCallReason(null));
            const cid = String(signalData?.conversationId || '').trim();
            activeChannelRef.current = cid;
            dispatch(setActiveConversationId(cid));
            const safeChannelId = sanitizeChannelId(cid);
            const res = await callApi.getAgoraToken(safeChannelId);
            const config = { ...res, channel: safeChannelId, sessionId: Date.now() };
            dispatch(setAgoraConfig(config));
            emitCallSignal(cid, { type: 'CALL_ACCEPTED', agoraConfig: config }, user?.fullName || 'Người dùng');
            dispatch(setCallStatus('connected'));
        } catch (e) { endCallRef.current?.(false); } finally { joiningRef.current = false; }
    }, [user, dispatch]);

    return {
        callStatus, callType, callerName, callerInfo, incomingSignal, duration, formatDuration,
        camOn, micOn, remoteUsers, startCall, acceptCall, endCall, 
        toggleMic: () => dispatch(setMicOn(!micOn)),
        toggleCamera: () => dispatch(setCamOn(!camOn)),
        agoraConfig, connect: () => { return () => {}; },
        setRemoteUsers: (u) => dispatch(setRemoteUsers(u)),
        endCallReason
    };
};
