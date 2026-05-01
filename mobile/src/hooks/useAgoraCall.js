import { useState, useEffect, useCallback, useRef } from 'react';
import { useSelector } from 'react-redux';
import { PermissionsAndroid, Platform } from 'react-native';
import { createAgoraRtcEngine, ChannelProfileType, ClientRoleType } from 'react-native-agora';
import { onCallSignal, offCallSignal, emitCallSignal } from '../utils/socket';
import { callApi } from '../api/callApi'; // Make sure mobile has api/callApi.js

let agoraEngine = null;

const sanitizeChannelId = (id) => {
    if (!id) return '';
    return id.replace(/[^a-zA-Z0-9]/g, '');
};

export const useAgoraCall = (activeConversationId, activeConversation) => {
    const user = useSelector(state => state.auth.user);
    
    const [callStatus, setCallStatus] = useState('idle');
    const [callType, setCallType] = useState('video');
    
    // Remote Info
    const [remoteUsers, setRemoteUsers] = useState([]);
    const [incomingSignal, setIncomingSignal] = useState(null);
    const [callerName, setCallerName] = useState('');
    const [callerId, setCallerId] = useState(null);
    
    // Media State
    const [camOn, setCamOn] = useState(true);
    const [micOn, setMicOn] = useState(true);
    const [error, setError] = useState(null);
    
    // Timer
    const [duration, setDuration] = useState(0);
    const timerRef = useRef(null);
    const startTimeRef = useRef(null);
    
    const activeChannelRef = useRef(null);
    const endCallRef = useRef(null);

    // Xin quyền
    const getPermissions = async () => {
        if (Platform.OS === 'android') {
            await PermissionsAndroid.requestMultiple([
                PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
                PermissionsAndroid.PERMISSIONS.CAMERA,
            ]);
        }
    };

    // Khởi tạo Agora Engine
    const setupVideoSDKEngine = async () => {
        try {
            if (!agoraEngine) {
                agoraEngine = createAgoraRtcEngine();
                // Tạm thời lấy appId từ .env hoặc backend, ở đây backend trả về lúc lấy token
                // Nếu backend trả appId lúc get token thì khởi tạo lúc get token.
                // Để an toàn, chúng ta sẽ khởi tạo engine SAU KHI lấy được token và appId từ backend.
            }
        } catch (e) {
            console.log(e);
        }
    };

    useEffect(() => {
        setupVideoSDKEngine();
        return () => {
            if (agoraEngine) {
                agoraEngine.release();
                agoraEngine = null;
            }
        };
    }, []);

    const connect = useCallback(() => {
        const handler = (data) => {
            const { conversationId: cid, signal, senderId, senderName } = data;
            const myId = user?.userId || user?.id;
            
            if (senderId === myId) return;
            if (!signal) return;

            const type = signal.type;

            if (type === 'CALL_INVITE') {
                activeChannelRef.current = cid;
                setIncomingSignal({ ...data, signal });
                setCallerName(senderName || senderId);
                setCallerId(senderId);
                setCallType(signal.callType || 'video');
                setCallStatus('incoming');
            } else if (type === 'CALL_ACCEPTED') {
                if (signal.startTime) {
                    startTimeRef.current = signal.startTime;
                }
            } else if (type === 'HANGUP') {
                endCallRef.current?.(false);
            }
        };

        onCallSignal(handler);
        return () => offCallSignal(handler);
    }, [user]);

    useEffect(() => {
        if (callStatus === 'connected') {
            if (!startTimeRef.current) startTimeRef.current = Date.now();
            setDuration(0);
            timerRef.current = setInterval(() => {
                setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
            }, 1000);
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

    // ─── START CALL ──────────────────────────────────────────────────────────
    const startCall = useCallback(async (type = 'video') => {
        try {
            await getPermissions();
            setCallType(type);
            setCallStatus('outgoing');
            setRemoteUsers([]);
            const channelId = activeConversationId;
            if (!channelId) throw new Error('Không có conversationId');
            
            activeChannelRef.current = channelId;
            const safeChannelId = sanitizeChannelId(channelId);
            
            const res = await callApi.getAgoraToken(safeChannelId);
            const { token, appId, uid } = res;

            if (!agoraEngine) agoraEngine = createAgoraRtcEngine();
            agoraEngine.initialize({ appId });
            
            agoraEngine.registerEventHandler({
                onJoinChannelSuccess: (_connection, elapsed) => {
                    console.log('Join channel success', elapsed);
                },
                onUserJoined: (_connection, remoteUid, elapsed) => {
                    console.log('User joined', remoteUid);
                    setCallStatus('connected');
                    setRemoteUsers(prev => {
                        if (prev.find(u => u.uid === remoteUid)) return prev;
                        return [...prev, { uid: remoteUid, name: 'Người dùng', status: 'connected' }];
                    });
                },
                onUserOffline: (_connection, remoteUid, _reason) => {
                    console.log('User offline', remoteUid);
                    setRemoteUsers(prev => prev.filter(u => u.uid !== remoteUid));
                }
            });

            agoraEngine.enableVideo();
            agoraEngine.startPreview();

            agoraEngine.joinChannel(token, safeChannelId, uid, {
                channelProfile: ChannelProfileType.ChannelProfileCommunication,
                clientRoleType: ClientRoleType.ClientRoleBroadcaster,
                publishMicrophoneTrack: true,
                publishCameraTrack: type === 'video',
                autoSubscribeAudio: true,
                autoSubscribeVideo: true,
            });

            const currentUserName = user?.fullName || user?.name || user?.username || 'Người dùng';
            emitCallSignal(channelId, { 
                type: 'CALL_INVITE', 
                callType: type,
                conversationType: activeConversation?.type,
                conversationName: activeConversation?.name,
                conversationAvatar: activeConversation?.avatar || activeConversation?.avatarUrl,
                senderAvatar: user?.avatar || user?.avatarUrl
            }, currentUserName);

        } catch (e) {
            setError(e.message);
            endCallRef.current?.(false);
        }
    }, [activeConversationId, user, activeConversation]);

    // ─── ACCEPT CALL ─────────────────────────────────────────────────────────
    const acceptCall = useCallback(async (signalData) => {
        try {
            await getPermissions();
            const channelId = signalData?.conversationId;
            activeChannelRef.current = channelId;
            const safeChannelId = sanitizeChannelId(channelId);

            const currentUserName = user?.fullName || user?.name || user?.username || 'Người dùng';
            const acceptedTime = Date.now();
            emitCallSignal(channelId, { type: 'CALL_ACCEPTED', startTime: acceptedTime }, currentUserName);
            startTimeRef.current = acceptedTime;

            setCallStatus('connected');
            
            const res = await callApi.getAgoraToken(safeChannelId);
            const { token, appId, uid } = res;

            if (!agoraEngine) agoraEngine = createAgoraRtcEngine();
            agoraEngine.initialize({ appId });

            agoraEngine.registerEventHandler({
                onJoinChannelSuccess: () => console.log('Accept join success'),
                onUserJoined: (_connection, remoteUid) => {
                    setRemoteUsers(prev => {
                        if (prev.find(u => u.uid === remoteUid)) return prev;
                        return [...prev, { uid: remoteUid, name: 'Người dùng', status: 'connected' }];
                    });
                },
                onUserOffline: (_connection, remoteUid) => {
                    setRemoteUsers(prev => prev.filter(u => u.uid !== remoteUid));
                }
            });

            agoraEngine.enableVideo();
            agoraEngine.startPreview();

            const actualCallType = signalData?.signal?.callType || callType;
            setCallType(actualCallType);

            agoraEngine.joinChannel(token, safeChannelId, uid, {
                channelProfile: ChannelProfileType.ChannelProfileCommunication,
                clientRoleType: ClientRoleType.ClientRoleBroadcaster,
                publishMicrophoneTrack: true,
                publishCameraTrack: actualCallType === 'video',
                autoSubscribeAudio: true,
                autoSubscribeVideo: true,
            });

        } catch (e) {
            setError(e.message);
            endCallRef.current?.(false);
        }
    }, [user, callType]);

    // ─── END CALL ────────────────────────────────────────────────────────────
    const endCall = useCallback(async (sendSignal = true) => {
        const channelId = activeChannelRef.current || activeConversationId;
        if (sendSignal && channelId) {
            const currentUserName = user?.fullName || user?.name || user?.username || 'Người dùng';
            emitCallSignal(channelId, { type: 'HANGUP' }, currentUserName);
        }

        try {
            if (agoraEngine) {
                agoraEngine.leaveChannel();
                agoraEngine.stopPreview();
                agoraEngine.removeAllListeners();
            }
        } catch (e) {}

        setCallStatus('ended');
        setRemoteUsers([]);
        setIncomingSignal(null);
        setCallerName('');
        setCallerId(null);
        activeChannelRef.current = null;
        startTimeRef.current = null;
        
        setTimeout(() => {
            setCallStatus(prev => prev === 'ended' ? 'idle' : prev);
        }, 1500);
    }, [activeConversationId, user]);

    endCallRef.current = endCall;

    const toggleMic = () => {
        if (agoraEngine) {
            agoraEngine.enableLocalAudio(!micOn);
            setMicOn(!micOn);
        }
    };

    const toggleCamera = () => {
        if (agoraEngine) {
            agoraEngine.enableLocalVideo(!camOn);
            setCamOn(!camOn);
        }
    };

    const formatDuration = useCallback(() => {
        const m = Math.floor(duration / 60);
        const s = duration % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    }, [duration]);

    return {
        callStatus,
        callType,
        callerId,
        callerName,
        incomingSignal,
        duration,
        formatDuration,
        camOn,
        micOn,
        remoteUsers,
        error,
        startCall,
        acceptCall,
        endCall,
        connect,
        toggleMic,
        toggleCamera,
        myUid: 0 // Local uid in Agora SDK is often 0
    };
};
