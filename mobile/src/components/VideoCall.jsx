import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Image,
  Platform,
  Animated,
  Easing,
  PermissionsAndroid,
  Alert,
  Linking,
  useWindowDimensions,
} from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { setAudioModeAsync, requestRecordingPermissionsAsync } from 'expo-audio';
import { Camera } from 'expo-camera';

import {
  setRemoteUsers,
  resetCall,
  addRemoteUser,
  updateRemoteUserVideo,
  removeRemoteUser,
} from '../store/callSlice';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { getAgoraHTML } from '../utils/agora-web-template';
import { isNativeAgoraAvailable } from '../utils/agoraNativeLoader';
import NativeAgoraView from './NativeAgoraView';
import CONFIG from '../config';

// ─── Countdown Ring Component ──────────────────────────────────────────
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const CountdownRing = ({ size = 164, duration = 30000, onComplete }) => {
  const animatedValue = useRef(new Animated.Value(0)).current;
  const radius = (size - 10) / 2;
  const circumference = radius * 2 * Math.PI;

  useEffect(() => {
    animatedValue.setValue(0);
    const animation = Animated.timing(animatedValue, {
      toValue: 1,
      duration,
      easing: Easing.linear,
      useNativeDriver: true,
    });

    animation.start(({ finished }) => {
      if (finished) onComplete?.();
    });

    return () => animation.stop();
  }, [duration]);

  const strokeDashoffset = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, circumference],
  });

  return (
    <View style={styles.ringWrapper} pointerEvents="none">
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(255, 255, 255, 0.14)"
          strokeWidth="4"
          fill="none"
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#818cf8"
          strokeWidth="4.5"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
        />
      </Svg>
    </View>
  );
};

const formatAvatarUrl = (url) => {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  return `${CONFIG.BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
};

const toNumericUid = (id) => {
  if (!id) return 0;
  if (typeof id === 'number') return id;
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
};

const VideoCall = ({
  callerName,
  duration,
  formatDuration,
  onAccept,
  onHangup,
  onReset,
  onToggleMic,
  onToggleCamera,
  callerInfo,
  incomingSignal,
  callStatus,
  callType,
  micOn,
  camOn,
  remoteUsers,
  agoraConfig,
  endCallReason,
  isGroup,
}) => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const webViewRef = useRef(null);
  const nativeAgoraRef = useRef(null);
  const useNativeAgora = useMemo(() => isNativeAgoraAvailable(), []);

  const [speakerOn, setSpeakerOn] = useState(true);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [micFailed, setMicFailed] = useState(false);
  const [camFailed, setCamFailed] = useState(false);
  const [webViewJoined, setWebViewJoined] = useState(false);
  const [nativePerms, setNativePerms] = useState({ checked: false, mic: true, cam: true });
  const [remoteHasVideo, setRemoteHasVideo] = useState(false);
  const [notificationMsg, setNotificationMsg] = useState(null);
  const [notificationType, setNotificationType] = useState('join');
  const isHangingUpRef = useRef(false);
  const hadRemoteInSessionRef = useRef(false);
  const prevMicOnRef = useRef(micOn);
  const prevCamOnRef = useRef(camOn);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const ringPulseAnim = useRef(new Animated.Value(1)).current;

  const { activeConversationId } = useSelector((state) => state.call);
  const { user } = useSelector((state) => state.auth);
  const { conversations } = useSelector((state) => state.chat);

  useEffect(() => {
    if (callStatus === 'idle' || callStatus === 'outgoing' || callStatus === 'incoming' || callStatus === 'connected') {
      isHangingUpRef.current = false;
    }
    if (callStatus === 'idle' || callStatus === 'outgoing' || callStatus === 'incoming') {
      hadRemoteInSessionRef.current = false;
      setMicFailed(false);
      setCamFailed(false);
      setWebViewJoined(false);
      setNativePerms({ checked: false, mic: true, cam: true });
    }
    if (callStatus === 'idle') {
      setRemoteHasVideo(false);
      setAudioBlocked(false);
      setSpeakerOn(true);
      setNotificationMsg(null);
    }
  }, [callStatus]);

  // Kiểm tra quyền OS thực tế TRƯỚC khi mount WebView để Android WebView không bao giờ bị treo RNCWebChromeClient
  useEffect(() => {
    if (callStatus !== 'connected') return;
    let cancelled = false;
    const verifyPermissions = async () => {
      try {
        if (Platform.OS === 'android') {
          let mic = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
          let cam = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.CAMERA);
          if (!mic || (callType === 'video' && !cam)) {
            const toAsk = [];
            if (!mic) toAsk.push(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
            if (callType === 'video' && !cam) toAsk.push(PermissionsAndroid.PERMISSIONS.CAMERA);
            if (toAsk.length > 0) {
              const res = await PermissionsAndroid.requestMultiple(toAsk);
              if (res[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO]) {
                mic = res[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] === PermissionsAndroid.RESULTS.GRANTED;
              }
              if (res[PermissionsAndroid.PERMISSIONS.CAMERA]) {
                cam = res[PermissionsAndroid.PERMISSIONS.CAMERA] === PermissionsAndroid.RESULTS.GRANTED;
              }
            }
          }
          console.log('🔐 [VideoCall] Android OS permissions before WebView mount -> mic:', mic, 'cam:', cam);
          if (!cancelled) {
            setNativePerms({ checked: true, mic, cam });
          }
        } else {
          if (!cancelled) {
            setNativePerms({ checked: true, mic: true, cam: true });
          }
        }
      } catch (e) {
        if (!cancelled) {
          setNativePerms({ checked: true, mic: true, cam: true });
        }
      }
    };
    verifyPermissions();
    return () => {
      cancelled = true;
    };
  }, [callStatus, callType]);

  useEffect(() => {
    if (callStatus === 'incoming' || callStatus === 'outgoing') {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.08,
            duration: 900,
            useNativeDriver: true,
            easing: Easing.inOut(Easing.ease),
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 900,
            useNativeDriver: true,
            easing: Easing.inOut(Easing.ease),
          }),
        ])
      );
      const ringPulse = Animated.loop(
        Animated.sequence([
          Animated.timing(ringPulseAnim, {
            toValue: 1.18,
            duration: 1400,
            useNativeDriver: true,
            easing: Easing.out(Easing.ease),
          }),
          Animated.timing(ringPulseAnim, {
            toValue: 1,
            duration: 1400,
            useNativeDriver: true,
            easing: Easing.in(Easing.ease),
          }),
        ])
      );
      pulse.start();
      ringPulse.start();
      return () => {
        pulse.stop();
        ringPulse.stop();
      };
    } else {
      pulseAnim.setValue(1);
      ringPulseAnim.setValue(1);
    }
  }, [callStatus, pulseAnim, ringPulseAnim]);

  const activeConversation = useMemo(() => {
    return conversations.find((c) => c.conversationId === activeConversationId);
  }, [conversations, activeConversationId]);

  const memberMap = useMemo(() => {
    const currentConv = conversations.find((c) => c.conversationId === activeConversationId);
    if (!currentConv || !currentConv.members) return {};

    return currentConv.members.reduce((acc, m) => {
      const mid = m.userId || m.id || m._id;
      if (mid) {
        const sMid = mid.toString();
        const info = {
          name: m.fullName || m.name || t('info.role_member'),
          avatar: m.avatar || m.avatarUrl || m.profilePic,
        };
        acc[toNumericUid(sMid)] = info;
        acc[toNumericUid(sMid + '_mobile')] = info;
        acc[toNumericUid(sMid + '_ios')] = info;
        acc[toNumericUid(sMid + '_android')] = info;
        acc[toNumericUid(sMid + '_caller')] = info;
        acc[toNumericUid(sMid + '_receiver')] = info;
      }
      return acc;
    }, {});
  }, [conversations, activeConversationId, t]);

  const agoraHTML = useMemo(() => {
    if (!agoraConfig || !nativePerms.checked) return null;
    const isCaller = !incomingSignal;
    const myInfo = {
      name: user?.fullName || user?.name || t('common.you'),
      avatar: user?.avatar || user?.avatarUrl,
    };

    const i18nData = {
      you: t('call.you'),
      tapToAudio: t('call.audio_unlock_hint'),
      memberPrefix: t('call.unknown_user'),
    };

    return getAgoraHTML(
      agoraConfig,
      callType,
      isCaller,
      isGroup,
      memberMap,
      myInfo,
      i18nData,
      { mic: nativePerms.mic, cam: nativePerms.cam }
    );
  }, [
    agoraConfig?.channel,
    agoraConfig?.token,
    agoraConfig?.uid,
    agoraConfig?.sessionId,
    callType,
    !!incomingSignal,
    isGroup,
    nativePerms.checked,
    nativePerms.mic,
    nativePerms.cam,
    t,
  ]);

  const handleTimeout = useCallback(() => {
    if (useNativeAgora) {
      nativeAgoraRef.current?.leave();
    } else if (webViewRef.current) {
      webViewRef.current.injectJavaScript(`window.handleAction && window.handleAction({ type: 'leave' }); true;`);
    }
    onHangup();
  }, [onHangup, useNativeAgora]);

  const handleToggleSpeaker = useCallback(async () => {
    const nextSpeaker = !speakerOn;
    setSpeakerOn(nextSpeaker);
    if (useNativeAgora) {
      nativeAgoraRef.current?.setSpeaker(nextSpeaker);
      return;
    }
    try {
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
        shouldPlayInBackground: true,
        interruptionMode: 'mixWithOthers',
        shouldRouteThroughEarpiece: !nextSpeaker,
      });
    } catch (e) {
      console.warn('🔊 [VideoCall] Toggle speaker error:', e);
    }
    webViewRef.current?.injectJavaScript(`window.handleAction && window.handleAction({ type: 'unlock-audio' }); true;`);
  }, [speakerOn, useNativeAgora]);

  const handleSwitchCamera = useCallback(() => {
    if (useNativeAgora) {
      nativeAgoraRef.current?.switchCamera();
      return;
    }
    webViewRef.current?.injectJavaScript(`window.handleAction && window.handleAction({ type: 'switch-camera' }); true;`);
  }, [useNativeAgora]);

  const handleUnlockAudio = useCallback(() => {
    setAudioBlocked(false);
    webViewRef.current?.injectJavaScript(`window.handleAction && window.handleAction({ type: 'unlock-audio' }); true;`);
  }, []);

  const ensureNativePermission = useCallback(async (kind) => {
    try {
      if (Platform.OS === 'android') {
        const perm = kind === 'camera'
          ? PermissionsAndroid.PERMISSIONS.CAMERA
          : PermissionsAndroid.PERMISSIONS.RECORD_AUDIO;
        const has = await PermissionsAndroid.check(perm);
        if (has) return true;
        const res = await PermissionsAndroid.request(perm);
        if (res === PermissionsAndroid.RESULTS.GRANTED) return true;
        if (kind === 'camera') {
          const fallback = await Camera.requestCameraPermissionsAsync().catch(() => ({ granted: false }));
          if (fallback?.granted || fallback?.status === 'granted') return true;
        } else {
          const fallback = await requestRecordingPermissionsAsync().catch(() => ({ granted: false }));
          if (fallback?.granted || fallback?.status === 'granted') return true;
        }
        return false;
      } else {
        const res = kind === 'camera'
          ? await Camera.requestCameraPermissionsAsync()
          : await Camera.requestMicrophonePermissionsAsync();
        return Boolean(res?.granted || res?.status === 'granted');
      }
    } catch {
      return false;
    }
  }, []);

  const handleRetryMic = useCallback(async () => {
    const granted = await ensureNativePermission('mic');
    if (!granted) {
      Alert.alert(
        'Chưa có quyền Micro',
        'Vui lòng bật quyền Micro cho ứng dụng trong Cài đặt thiết bị.',
        [
          { text: 'Để sau', style: 'cancel' },
          { text: 'Mở Cài đặt', onPress: () => Linking.openSettings().catch(() => {}) },
        ]
      );
      return;
    }
    setMicFailed(false);
    webViewRef.current?.injectJavaScript(`window.handleAction && window.handleAction({ type: 'retry-mic' }); true;`);
  }, [ensureNativePermission]);

  const handleRetryCam = useCallback(async () => {
    const granted = await ensureNativePermission('camera');
    if (!granted) {
      Alert.alert(
        'Chưa có quyền Camera',
        'Vui lòng bật quyền Máy ảnh (Camera) cho ứng dụng trong Cài đặt thiết bị để gọi video.',
        [
          { text: 'Để sau', style: 'cancel' },
          { text: 'Mở Cài đặt', onPress: () => Linking.openSettings().catch(() => {}) },
        ]
      );
      return;
    }
    setCamFailed(false);
    webViewRef.current?.injectJavaScript(`window.handleAction && window.handleAction({ type: 'retry-cam' }); true;`);
  }, [ensureNativePermission]);

  const handleToggleCameraWithPermission = useCallback(async () => {
    if (!camOn) {
      const granted = await ensureNativePermission('camera');
      if (!granted) {
        Alert.alert(
          'Chưa có quyền Camera',
          'Vui lòng bật quyền Máy ảnh (Camera) cho ứng dụng trong Cài đặt thiết bị để bật video.',
          [
            { text: 'Để sau', style: 'cancel' },
            { text: 'Mở Cài đặt', onPress: () => Linking.openSettings().catch(() => {}) },
          ]
        );
        return;
      }
      setCamFailed(false);
    }
    onToggleCamera?.();
  }, [camOn, ensureNativePermission, onToggleCamera]);

  const handleExitCall = useCallback(() => {
    console.log('🔴 [VideoCall] Exit / Back to chat pressed');
    if (onReset) onReset();
    else dispatch(resetCall());
  }, [onReset, dispatch]);

  const handleSafeHangup = useCallback(() => {
    if (callStatus === 'ended') {
      handleExitCall();
      return;
    }
    if (isHangingUpRef.current) return;
    isHangingUpRef.current = true;
    console.log('🔴 [VideoCall] Hangup pressed');
    try {
      if (useNativeAgora) {
        nativeAgoraRef.current?.leave();
      } else {
        webViewRef.current?.injectJavaScript(`window.handleAction && window.handleAction({ type: 'leave' }); true;`);
      }
    } catch (err) {
      console.warn('[Agora] Failed to leave session:', err);
    }
    if (onHangup) {
      onHangup(true);
    } else {
      dispatch(resetCall());
    }
  }, [callStatus, handleExitCall, onHangup, dispatch, useNativeAgora]);

  useEffect(() => {
    if (callStatus === 'connected' && webViewJoined && webViewRef.current && Object.keys(memberMap).length > 0) {
      webViewRef.current.injectJavaScript(
        `window.handleAction && window.handleAction({ type: 'update-members', members: ${JSON.stringify(memberMap)} }); true;`
      );
    }
  }, [memberMap, callStatus, webViewJoined]);

  useEffect(() => {
    if (!webViewJoined) {
      prevMicOnRef.current = micOn;
      return;
    }
    if (prevMicOnRef.current === micOn) return;
    prevMicOnRef.current = micOn;
    if (callStatus === 'connected' && webViewRef.current) {
      webViewRef.current.injectJavaScript(
        `window.handleAction && window.handleAction({ type: 'toggle-mic', enabled: ${micOn} }); true;`
      );
    }
  }, [micOn, callStatus, webViewJoined]);

  useEffect(() => {
    if (!webViewJoined) {
      prevCamOnRef.current = camOn;
      return;
    }
    if (prevCamOnRef.current === camOn) return;
    prevCamOnRef.current = camOn;
    if (callStatus === 'connected' && webViewRef.current) {
      webViewRef.current.injectJavaScript(
        `window.handleAction && window.handleAction({ type: 'toggle-cam', enabled: ${camOn} }); true;`
      );
    }
  }, [camOn, callStatus, webViewJoined]);

  useEffect(() => {
    if (callStatus === 'ended' && webViewRef.current) {
      webViewRef.current.injectJavaScript(`window.handleAction && window.handleAction({ type: 'leave' }); true;`);
    }
  }, [callStatus]);

  const handleWebViewMessage = useCallback(
    (event) => {
      try {
        const data = JSON.parse(event.nativeEvent.data);
        if (data.type === 'log') {
          console.log('🌐 [WebView]:', data.message);
          return;
        }

        if (data.type === 'autoplay-failed') {
          setAudioBlocked(true);
          return;
        }
        if (data.type === 'audio-unlocked') {
          setAudioBlocked(false);
          return;
        }
        if (data.type === 'mic-error') {
          setMicFailed(true);
          return;
        }
        if (data.type === 'mic-ready') {
          setMicFailed(false);
          return;
        }
        if (data.type === 'cam-error') {
          setCamFailed(true);
          return;
        }
        if (data.type === 'cam-ready') {
          setCamFailed(false);
          return;
        }

        if (data.type === 'user-joined' || data.type === 'user-published') {
          hadRemoteInSessionRef.current = true;
          const uidStr = String(data.uid);
          const alreadyExists = remoteUsers.some((u) => String(u.uid) === uidStr);
          if (!alreadyExists) {
            const userName = memberMap[uidStr]?.name || t('call.someone');
            const msg = t('chat.user_joined', { name: userName });
            setNotificationMsg(msg);
            setNotificationType('join');
            setTimeout(() => {
              setNotificationMsg((current) => (current === msg ? null : current));
            }, 1800);
          }

          dispatch(addRemoteUser({ uid: data.uid, mediaType: data.mediaType || 'audio' }));
          if (data.mediaType === 'video') setRemoteHasVideo(true);
        } else if (data.type === 'user-unpublished') {
          if (data.mediaType === 'video') {
            dispatch(updateRemoteUserVideo({ uid: data.uid, hasVideo: false }));
            const othersHaveVideo = remoteUsers.some(
              (u) => String(u.uid) !== String(data.uid) && u.hasVideo
            );
            setRemoteHasVideo(othersHaveVideo);
          }
        } else if (data.type === 'user-left') {
          const uidStr = String(data.uid);
          const userName = memberMap[uidStr]?.name || t('call.someone');
          const msg = t('chat.user_left', { name: userName });
          setNotificationMsg(msg);
          setNotificationType('leave');
          setTimeout(() => {
            setNotificationMsg((current) => (current === msg ? null : current));
          }, 1800);

          dispatch(removeRemoteUser(data.uid));
          const othersHaveVideo = remoteUsers.some(
            (u) => String(u.uid) !== uidStr && u.hasVideo
          );
          if (!othersHaveVideo) setRemoteHasVideo(false);

          if (!isGroup && remoteUsers.length <= 1 && callStatus === 'connected') {
            onHangup(false);
          }
        } else if (data.type === 'sync' || data.type === 'sync-count') {
          if (data.count === 0) {
            if (remoteUsers.length > 0) {
              dispatch(setRemoteUsers([]));
              setRemoteHasVideo(false);
            }
            // Fallback cho 1-1: nếu đối phương đã từng vào kênh rồi rời đi (dù STOMP HANGUP bị trễ/mất), tự ngắt máy ngay
            if (!isGroup && hadRemoteInSessionRef.current && callStatus === 'connected') {
              onHangup(false);
            }
          } else if (data.uids) {
            hadRemoteInSessionRef.current = true;
            const currentUids = new Set(data.uids.map((id) => String(id)));
            const validUsers = remoteUsers.filter(
              (u) => !String(u.uid).startsWith('sync-') && currentUids.has(String(u.uid))
            );
            const existingUids = new Set(validUsers.map((u) => String(u.uid)));
            data.uids.forEach((uid) => {
              if (!existingUids.has(String(uid))) {
                validUsers.push({ uid, mediaType: 'audio', hasVideo: false });
              }
            });
            dispatch(setRemoteUsers(validUsers));
          } else if (data.count > 0 && remoteUsers.length === 0) {
            dispatch(addRemoteUser({ uid: 'sync-' + Date.now(), mediaType: 'audio' }));
          }

          if (Array.isArray(data.videoUids)) {
            const videoUidSet = new Set(data.videoUids.map((id) => String(id)));
            setRemoteHasVideo(videoUidSet.size > 0);
            remoteUsers.forEach((u) => {
              const hasV = videoUidSet.has(String(u.uid));
              if (Boolean(u.hasVideo) !== hasV) {
                dispatch(updateRemoteUserVideo({ uid: u.uid, hasVideo: hasV }));
              }
            });
          }
        } else if (data.type === 'joined') {
          setWebViewJoined(true);
          console.log('✅ [VideoCall] Joined Agora Room');
        }
      } catch (e) {
        console.warn('❌ [VideoCall] Msg Error:', e);
      }
    },
    [dispatch, remoteUsers, isGroup, callStatus, onHangup, memberMap, t]
  );

  const handlerRef = useRef(handleWebViewMessage);
  useEffect(() => {
    handlerRef.current = handleWebViewMessage;
  }, [handleWebViewMessage]);

  const onMessage = useCallback((e) => {
    handlerRef.current?.(e);
  }, []);

  const handleNativeJoined = useCallback(() => {
    setWebViewJoined(true);
  }, []);

  const handleNativeUserJoined = useCallback(
    (uid) => {
      hadRemoteInSessionRef.current = true;
      const uidStr = String(uid);
      const alreadyExists = remoteUsers.some((u) => String(u.uid) === uidStr);
      if (!alreadyExists) {
        const userName = memberMap[uidStr]?.name || t('call.someone');
        const msg = t('chat.user_joined', { name: userName });
        setNotificationMsg(msg);
        setNotificationType('join');
        setTimeout(() => {
          setNotificationMsg((current) => (current === msg ? null : current));
        }, 1800);
      }
      dispatch(addRemoteUser({ uid, mediaType: 'audio' }));
    },
    [dispatch, memberMap, remoteUsers, t]
  );

  const handleNativeUserLeft = useCallback(
    (uid) => {
      const uidStr = String(uid);
      const userName = memberMap[uidStr]?.name || t('call.someone');
      const msg = t('chat.user_left', { name: userName });
      setNotificationMsg(msg);
      setNotificationType('leave');
      setTimeout(() => {
        setNotificationMsg((current) => (current === msg ? null : current));
      }, 1800);

      dispatch(removeRemoteUser(uid));
      const othersHaveVideo = remoteUsers.some(
        (u) => String(u.uid) !== uidStr && u.hasVideo
      );
      if (!othersHaveVideo) setRemoteHasVideo(false);

      if (!isGroup && remoteUsers.length <= 1 && callStatus === 'connected') {
        onHangup(false);
      }
    },
    [callStatus, dispatch, isGroup, memberMap, onHangup, remoteUsers, t]
  );

  const handleNativeRemoteVideoChange = useCallback(
    (uid, hasVideo) => {
      dispatch(updateRemoteUserVideo({ uid, hasVideo }));
      if (hasVideo) {
        setRemoteHasVideo(true);
      } else {
        const othersHaveVideo = remoteUsers.some(
          (u) => String(u.uid) !== String(uid) && u.hasVideo
        );
        setRemoteHasVideo(othersHaveVideo);
      }
    },
    [dispatch, remoteUsers]
  );

  const isVisible = callStatus !== 'idle';

  const targetAvatar = formatAvatarUrl(
    isGroup ? activeConversation?.avatar || callerInfo?.avatar : callerInfo?.avatar
  );
  const targetName = isGroup
    ? activeConversation?.name || callerInfo?.name || t('sidebar.group_fallback')
    : callerName || callerInfo?.name || t('common.user');
  const initialLetter = targetName?.charAt(0)?.toUpperCase() || 'U';

  const isWaitingOverlayVisible =
    callStatus === 'outgoing' ||
    callStatus === 'incoming' ||
    (isGroup && callStatus === 'connected' && remoteUsers.length === 0) ||
    (!isGroup && callStatus === 'connected' && !remoteHasVideo && !camOn);

  const tileSize = Math.min(164, (screenWidth - 56) / 2);

  return (
    <Modal
      visible={isVisible}
      animationType="fade"
      transparent={false}
      statusBarTranslucent
      hardwareAccelerated
      onRequestClose={() => {
        if (callStatus === 'ended') {
          handleExitCall();
        } else {
          handleSafeHangup();
        }
      }}
    >
      {isVisible ? (
      <View style={styles.container}>
        {/* Nền tối hiện đại cho cuộc gọi thoại / chờ kết nối */}
        <View style={styles.ambientGlowTop} pointerEvents="none" />
        <View style={styles.ambientGlowBottom} pointerEvents="none" />

        {/* Agora Media Engine: dùng Native SDK (react-native-agora) trên APK/Dev Build, tự fallback WebView trên Expo Go */}
        {callStatus === 'connected' && nativePerms.checked && agoraConfig && (
          useNativeAgora ? (
            <View style={styles.webViewContainer} pointerEvents="none">
              <NativeAgoraView
                key={`native-${agoraConfig.sessionId || agoraConfig.channel}_${callType}`}
                ref={nativeAgoraRef}
                agoraConfig={agoraConfig}
                callType={callType}
                isGroup={isGroup}
                micOn={micOn}
                camOn={camOn}
                speakerOn={speakerOn}
                memberMap={memberMap}
                myInfo={{
                  name: user?.fullName || user?.name || t('common.you'),
                  avatar: user?.avatar || user?.avatarUrl,
                }}
                onJoined={handleNativeJoined}
                onUserJoined={handleNativeUserJoined}
                onUserLeft={handleNativeUserLeft}
                onRemoteVideoChange={handleNativeRemoteVideoChange}
              />
            </View>
          ) : agoraHTML ? (
            <View
              style={styles.webViewContainer}
              pointerEvents={!remoteHasVideo && !camOn && !audioBlocked && !isGroup ? 'none' : 'auto'}
            >
              <WebView
                key={`${agoraConfig.sessionId || agoraConfig.channel}_${callType}`}
                ref={webViewRef}
                source={{ html: agoraHTML, baseUrl: 'https://localhost' }}
                style={styles.webView}
                originWhitelist={['*']}
                javaScriptEnabled={true}
                scrollEnabled={false}
                bounces={false}
                domStorageEnabled={true}
                androidLayerType="hardware"
                setSupportMultipleWindows={false}
                mediaPlaybackRequiresUserAction={false}
                allowsInlineMediaPlayback={true}
                allowsAirPlayForMediaPlayback={true}
                allowsFullscreenVideo={false}
                mixedContentMode="always"
                mediaCapturePermissionGrantType="grant"
                onMessage={onMessage}
                onError={(e) => console.error('❌ [WebView] Error:', e.nativeEvent)}
                onHttpError={(e) => console.error('❌ [WebView] HTTP Error:', e.nativeEvent)}
              />
            </View>
          ) : null
        )}

        {/* Che nền đen cho chế độ chỉ thoại khi không bật cam */}
        {callStatus === 'connected' && !remoteHasVideo && !camOn && !isGroup && (
          <View style={styles.audioOnlyBg} pointerEvents="none">
            <View style={styles.ambientGlowTop} pointerEvents="none" />
            <View style={styles.ambientGlowBottom} pointerEvents="none" />
          </View>
        )}

        {/* Toast thông báo thành viên vào/ra */}
        {notificationMsg && (
          <View style={[styles.notificationCapsule, { top: Math.max(insets.top, 20) + 64 }]}>
            <View
              style={[
                styles.pulseDot,
                notificationType === 'leave' ? styles.pulseDotLeave : styles.pulseDotJoin,
              ]}
            />
            <Text style={styles.notificationText} numberOfLines={1}>
              {notificationMsg}
            </Text>
          </View>
        )}

        {/* Nút mở khóa âm thanh iOS nếu Safari/WKWebView chặn autoplay */}
        {audioBlocked && callStatus === 'connected' && (
          <TouchableOpacity
            style={[styles.audioUnlockBanner, { top: Math.max(insets.top, 20) + 70 }]}
            onPress={handleUnlockAudio}
            activeOpacity={0.85}
          >
            <Ionicons name="volume-high" size={18} color="#fff" />
            <Text style={styles.audioUnlockText}>
              {t('call.audio_unlock_hint') || 'Chạm để bật âm thanh'}
            </Text>
          </TouchableOpacity>
        )}

        {/* Nút thử lại micro hoặc camera nếu WebView chưa lấy được thiết bị */}
        {(micFailed || (camFailed && camOn)) && !audioBlocked && callStatus === 'connected' && (
          <TouchableOpacity
            style={[styles.micRetryBanner, { top: Math.max(insets.top, 20) + 70 }]}
            onPress={micFailed ? handleRetryMic : handleRetryCam}
            activeOpacity={0.85}
          >
            <Ionicons name={micFailed ? 'mic-off' : 'videocam-off'} size={17} color="#fff" />
            <Text style={styles.audioUnlockText}>
              {micFailed
                ? 'Chưa mở được micro — Chạm để thử lại'
                : 'Chưa mở được camera — Chạm để thử lại'}
            </Text>
          </TouchableOpacity>
        )}

        {/* Lớp UI chính dùng đúng SafeAreaInsets để không bao giờ bị méo/lệch tai thỏ */}
        {callStatus !== 'ended' && (
          <View
            style={[
              styles.overlay,
              {
                paddingTop: Math.max(insets.top, Platform.OS === 'android' ? 28 : 18) + 10,
                paddingBottom: Math.max(insets.bottom, Platform.OS === 'android' ? 36 : 20) + 12,
              },
            ]}
            pointerEvents="box-none"
            collapsable={false}
          >
            {/* Header cố định trên cùng */}
            <View style={styles.header} pointerEvents="box-none">
              <View style={styles.headerPill}>
                <View style={styles.headerLeft}>
                  <View style={styles.headerBadge}>
                    <Ionicons
                      name={callType === 'video' ? 'videocam' : 'call'}
                      size={11}
                      color="#a5b4fc"
                    />
                    <Text style={styles.callTypeTitle} numberOfLines={1}>
                      {callStatus === 'outgoing'
                        ? callType === 'video'
                          ? t('call.outgoing_video')
                          : t('call.outgoing_audio')
                        : callStatus === 'incoming'
                          ? callType === 'video'
                            ? t('call.incoming_video_title')
                            : t('call.incoming_audio_title')
                          : isGroup
                            ? callType === 'video'
                              ? t('call.group_video')
                              : t('call.group_audio')
                            : callType === 'video'
                              ? t('call.video_call')
                              : t('call.audio_call')}
                    </Text>
                  </View>
                  <View style={styles.headerTitleRow}>
                    {isGroup && targetAvatar && (
                      <Image source={{ uri: targetAvatar }} style={styles.headerAvatar} />
                    )}
                    <Text style={styles.groupNameText} numberOfLines={1}>
                      {targetName}
                    </Text>
                  </View>
                </View>

                {callStatus === 'connected' && (
                  <View style={styles.durationBadge}>
                    <View style={styles.recordDot} />
                    <Text style={styles.duration}>{formatDuration()}</Text>
                  </View>
                )}
              </View>
            </View>

            {/* Khu vực giữa (Avatar + trạng thái cuộc gọi) */}
            <View style={styles.centerInfo} pointerEvents="box-none">
              {isWaitingOverlayVisible && (
                isGroup && callStatus === 'connected' && remoteUsers.length > 0 ? (
                  <View style={styles.groupGrid}>
                    {[{ isLocal: true }, ...remoteUsers].map((item, i) => (
                      <View
                        key={item.isLocal ? 'local' : String(item.uid || i)}
                        style={[styles.gridTile, { width: tileSize, height: tileSize }]}
                      >
                        <View style={styles.tileAvatarContainer}>
                          {item.isLocal && user?.avatar ? (
                            <Image source={{ uri: formatAvatarUrl(user.avatar) }} style={styles.tileAvatar} />
                          ) : (
                            <View style={[styles.tileAvatar, styles.initialsAvatar]}>
                              <Text style={styles.tileInitials}>
                                {item.isLocal
                                  ? (user?.fullName || user?.name || 'B').charAt(0).toUpperCase()
                                  : (memberMap[String(item.uid)]?.name || 'U').charAt(0).toUpperCase()}
                              </Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.tileName} numberOfLines={1}>
                          {item.isLocal
                            ? t('common.you')
                            : memberMap[String(item.uid)]?.name || `User ${item.uid}`}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <View style={styles.waitingCard}>
                    <View style={styles.avatarStage}>
                      {(callStatus === 'outgoing' || callStatus === 'incoming') && (
                        <Animated.View
                          style={[
                            styles.pulseHalo,
                            { transform: [{ scale: ringPulseAnim }] },
                          ]}
                        />
                      )}

                      {targetAvatar ? (
                        <Image source={{ uri: targetAvatar }} style={styles.avatar} />
                      ) : (
                        <View style={[styles.avatar, styles.initialsAvatar]}>
                          <Text style={styles.initialsText}>{initialLetter}</Text>
                        </View>
                      )}

                      {(callStatus === 'outgoing' ||
                        callStatus === 'incoming' ||
                        (isGroup && callStatus === 'connected' && remoteUsers.length === 0)) && (
                        <CountdownRing size={164} duration={30000} onComplete={handleTimeout} />
                      )}
                    </View>

                    <Text style={styles.callerName} numberOfLines={2}>
                      {targetName}
                    </Text>

                    <View style={styles.statusPill}>
                      <View
                        style={[
                          styles.statusDot,
                          callStatus === 'connected' ? styles.statusDotConnected : styles.statusDotWaiting,
                        ]}
                      />
                      <Text style={styles.statusText}>
                        {callStatus === 'outgoing'
                          ? t('call.calling')
                          : callStatus === 'incoming'
                            ? t('call.is_calling_you')
                            : isGroup && remoteUsers.length === 0
                              ? t('call.waiting_others')
                              : callStatus === 'connected'
                                ? isGroup
                                  ? t('call.group_meeting')
                                  : t('call.chatting')
                                : t('call.ended')}
                      </Text>
                    </View>
                  </View>
                )
              )}
            </View>

            {/* Thanh điều khiển đáy cân đối */}
            <View style={styles.controlsContainer} collapsable={false} pointerEvents="box-none">
              {callStatus === 'incoming' ? (
                <View style={styles.incomingBar}>
                  <View style={styles.incomingActionCol}>
                    <TouchableOpacity
                      onPress={handleSafeHangup}
                      style={[styles.incomingBtn, styles.btnHangup]}
                      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                      activeOpacity={0.75}
                    >
                      <Ionicons
                        name="call"
                        size={30}
                        color="#fff"
                        style={{ transform: [{ rotate: '135deg' }] }}
                      />
                    </TouchableOpacity>
                    <Text style={styles.controlLabel}>{t('chat.stranger_bar.decline') || 'Từ chối'}</Text>
                  </View>

                  <View style={styles.incomingActionCol}>
                    <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                      <TouchableOpacity
                        onPress={onAccept}
                        style={[styles.incomingBtn, styles.btnAccept]}
                        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                        activeOpacity={0.75}
                      >
                        <Ionicons name={callType === 'video' ? 'videocam' : 'call'} size={30} color="#fff" />
                      </TouchableOpacity>
                    </Animated.View>
                    <Text style={styles.controlLabel}>{t('chat.stranger_bar.accept') || 'Trả lời'}</Text>
                  </View>
                </View>
              ) : (
                <View style={styles.controlsDock}>
                  <TouchableOpacity
                    onPress={onToggleMic}
                    style={[styles.dockBtn, !micOn && styles.dockBtnMuted]}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    activeOpacity={0.75}
                  >
                    <Ionicons name={micOn ? 'mic' : 'mic-off'} size={22} color="#fff" />
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={handleToggleSpeaker}
                    style={[styles.dockBtn, speakerOn && styles.dockBtnActive]}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    activeOpacity={0.75}
                  >
                    <Ionicons
                      name={speakerOn ? 'volume-high' : 'volume-medium-outline'}
                      size={22}
                      color="#fff"
                    />
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={handleToggleCameraWithPermission}
                    style={[styles.dockBtn, !camOn && styles.dockBtnMuted]}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    activeOpacity={0.75}
                  >
                    <Ionicons name={camOn ? 'videocam' : 'videocam-off'} size={22} color="#fff" />
                  </TouchableOpacity>

                  {camOn && callStatus === 'connected' && (
                    <TouchableOpacity
                      onPress={handleSwitchCamera}
                      style={styles.dockBtn}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      activeOpacity={0.75}
                    >
                      <Ionicons name="camera-reverse-outline" size={22} color="#fff" />
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    onPress={handleSafeHangup}
                    style={[styles.dockBtn, styles.dockBtnHangup]}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    activeOpacity={0.75}
                  >
                    <Ionicons
                      name="call"
                      size={24}
                      color="#fff"
                      style={{ transform: [{ rotate: '135deg' }] }}
                    />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Màn hình kết thúc cuộc gọi phủ toàn màn hình (không bị cắt bởi padding của overlay) */}
        {callStatus === 'ended' && (
          <View
            style={[
              styles.endScreenContainer,
              {
                paddingTop: Math.max(insets.top, 24),
                paddingBottom: Math.max(insets.bottom, 24),
              },
            ]}
          >
            <View style={styles.endScreenContent}>
              <View style={styles.endAvatarWrapper}>
                {targetAvatar ? (
                  <Image source={{ uri: targetAvatar }} style={styles.endAvatar} />
                ) : (
                  <View style={[styles.endAvatar, styles.initialsAvatar]}>
                    <Text style={styles.endInitialsText}>{initialLetter}</Text>
                  </View>
                )}
              </View>

              <Text style={styles.endCallerName} numberOfLines={2}>
                {targetName}
              </Text>

              <View style={styles.endReasonPill}>
                <Text style={styles.endReasonText}>{endCallReason || t('call.ended')}</Text>
              </View>

              <TouchableOpacity
                style={styles.backToChatButton}
                onPress={handleExitCall}
                activeOpacity={0.85}
              >
                <Text style={styles.backToChatText}>{t('call.back_to_chat')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
      ) : null}
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalRoot: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 99999,
    elevation: 99999,
    backgroundColor: '#090d16',
  },
  container: {
    flex: 1,
    backgroundColor: '#090d16',
  },
  ambientGlowTop: {
    position: 'absolute',
    top: -110,
    right: -80,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
  },
  ambientGlowBottom: {
    position: 'absolute',
    bottom: -120,
    left: -90,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(56, 189, 248, 0.14)',
  },
  webViewContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
    elevation: 0,
  },
  webView: {
    flex: 1,
    backgroundColor: '#090d16',
    opacity: 0.99,
  },
  audioOnlyBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#090d16',
    zIndex: 2,
    elevation: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
    elevation: 20,
    justifyContent: 'space-between',
    paddingHorizontal: 18,
  },
  header: {
    width: '100%',
  },
  headerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    gap: 12,
  },
  headerLeft: {
    flex: 1,
    minWidth: 0,
  },
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 3,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
  },
  callTypeTitle: {
    color: '#a5b4fc',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  groupNameText: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '700',
    flexShrink: 1,
  },
  durationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(99, 102, 241, 0.25)',
    borderWidth: 1,
    borderColor: 'rgba(129, 140, 248, 0.35)',
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
  },
  recordDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#22c55e',
    marginRight: 6,
  },
  duration: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  centerInfo: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
  },
  waitingCard: {
    alignItems: 'center',
    width: '100%',
    maxWidth: 320,
    paddingHorizontal: 16,
  },
  avatarStage: {
    width: 172,
    height: 172,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  ringWrapper: {
    position: 'absolute',
    transform: [{ rotate: '-90deg' }],
  },
  pulseHalo: {
    position: 'absolute',
    width: 174,
    height: 174,
    borderRadius: 87,
    backgroundColor: 'rgba(99, 102, 241, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(129, 140, 248, 0.35)',
  },
  avatar: {
    width: 136,
    height: 136,
    borderRadius: 68,
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.22)',
  },
  initialsAvatar: {
    backgroundColor: '#6366f1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  initialsText: {
    color: '#ffffff',
    fontSize: 52,
    fontWeight: '800',
  },
  callerName: {
    color: '#f8fafc',
    fontSize: 26,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  statusDotWaiting: {
    backgroundColor: '#818cf8',
  },
  statusDotConnected: {
    backgroundColor: '#22c55e',
  },
  statusText: {
    color: '#e2e8f0',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  groupGrid: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
  },
  gridTile: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
  },
  tileAvatarContainer: {
    marginBottom: 10,
  },
  tileAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.22)',
  },
  tileInitials: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '700',
  },
  tileName: {
    color: '#f1f5f9',
    fontSize: 13,
    fontWeight: '600',
  },
  controlsContainer: {
    width: '100%',
    alignItems: 'center',
    zIndex: 30,
    elevation: 30,
  },
  incomingBar: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    width: '100%',
    maxWidth: 320,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 36,
    backgroundColor: 'rgba(15, 23, 42, 0.82)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  incomingActionCol: {
    alignItems: 'center',
    gap: 8,
  },
  incomingBtn: {
    width: 66,
    height: 66,
    borderRadius: 33,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  controlLabel: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '600',
  },
  controlsDock: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(15, 23, 42, 0.86)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 18,
    elevation: 10,
  },
  dockBtn: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dockBtnActive: {
    backgroundColor: 'rgba(99, 102, 241, 0.45)',
    borderWidth: 1,
    borderColor: 'rgba(165, 180, 252, 0.5)',
  },
  dockBtnMuted: {
    backgroundColor: 'rgba(239, 68, 68, 0.25)',
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.5)',
  },
  dockBtnHangup: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#ef4444',
  },
  btnAccept: {
    backgroundColor: '#22c55e',
  },
  btnHangup: {
    backgroundColor: '#ef4444',
  },
  endScreenContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
    zIndex: 1000,
  },
  endScreenContent: {
    alignItems: 'center',
    width: '100%',
    maxWidth: 320,
  },
  endAvatarWrapper: {
    width: 128,
    height: 128,
    borderRadius: 64,
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    padding: 4,
    marginBottom: 20,
    overflow: 'hidden',
  },
  endAvatar: {
    width: '100%',
    height: '100%',
    borderRadius: 60,
  },
  endInitialsText: {
    color: '#ffffff',
    fontSize: 44,
    fontWeight: '800',
  },
  endCallerName: {
    color: '#f8fafc',
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 14,
    textAlign: 'center',
  },
  endReasonPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingVertical: 9,
    paddingHorizontal: 20,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    marginBottom: 36,
  },
  endReasonText: {
    color: '#cbd5e1',
    fontSize: 14,
    fontWeight: '600',
  },
  backToChatButton: {
    backgroundColor: '#ffffff',
    paddingVertical: 15,
    paddingHorizontal: 32,
    borderRadius: 16,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  backToChatText: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '800',
  },
  notificationCapsule: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    zIndex: 50,
    elevation: 12,
    gap: 8,
    maxWidth: '86%',
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  pulseDotJoin: {
    backgroundColor: '#22c55e',
  },
  pulseDotLeave: {
    backgroundColor: '#ef4444',
  },
  notificationText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
  audioUnlockBanner: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#4f46e5',
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 999,
    zIndex: 60,
    elevation: 40,
    shadowColor: '#4f46e5',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
  },
  micRetryBanner: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.92)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    zIndex: 60,
    elevation: 40,
  },
  audioUnlockText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
});

export default VideoCall;
