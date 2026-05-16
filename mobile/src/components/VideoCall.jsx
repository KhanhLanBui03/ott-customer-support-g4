import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Dimensions, Image, Platform, Animated, Easing, TouchableWithoutFeedback } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useDispatch, useSelector, shallowEqual } from 'react-redux';

import { 
  setRemoteUsers, setCallStatus, setCallType, 
  setAgoraConfig, resetCall, setEndCallReason,
  addRemoteUser, updateRemoteUserVideo, removeRemoteUser 
} from '../store/callSlice';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { getAgoraHTML } from '../utils/agora-web-template';

const { width, height } = Dimensions.get('window');

// ─── Countdown Ring Component ──────────────────────────────────────────
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const CountdownRing = ({ size = 180, duration = 30000, onComplete }) => {
  const animatedValue = useRef(new Animated.Value(0)).current;
  const radius = (size - 10) / 2;
  const circumference = radius * 2 * Math.PI;

  useEffect(() => {
    animatedValue.setValue(0);
    const animation = Animated.timing(animatedValue, {
      toValue: 1,
      duration: duration,
      easing: Easing.linear,
      useNativeDriver: true,
    });
    
    animation.start(({ finished }) => {
      if (finished) onComplete?.();
    });
    
    return () => animation.stop();
  }, [duration]); // Run if duration changes (though it shouldn't usually change once started)


  const strokeDashoffset = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, circumference],
  });

  return (
    <View style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(255, 255, 255, 0.1)"
          strokeWidth="4"
          fill="none"
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#6366f1"
          strokeWidth="5"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
        />
      </Svg>
    </View>
  );
};

// Helper to format avatar URL
const formatAvatarUrl = (url) => {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  const apiBase = process.env.EXPO_PUBLIC_API_URL || '';
  const serverBase = apiBase.replace('/api/v1', '');
  return `${serverBase}${url.startsWith('/') ? '' : '/'}${url}`;
};

// Helper to convert Mongo ID to Agora numeric UID
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
  callerName, duration, formatDuration,
  onAccept, onHangup, onReset, onToggleMic, onToggleCamera,
  callerInfo, incomingSignal, callStatus, callType,
  micOn, camOn, remoteUsers, agoraConfig, endCallReason, isGroup
}) => {
  const dispatch = useDispatch();
  const webViewRef = useRef(null);
  const [showControls, setShowControls] = useState(true);

  const lastTap = useRef(0);

  const handleDoubleTap = () => {
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300;
    if (now - lastTap.current < DOUBLE_TAP_DELAY) {
      setShowControls(prev => !prev);
    }
    lastTap.current = now;
  };

  const handleTimeout = useCallback(() => {
    // console.log('⏰ [VideoCall] UI Countdown finished.');
  }, []);

  const { 
    activeConversationId
  } = useSelector(state => state.call);


  const { user } = useSelector(state => state.auth); 
  const { conversations } = useSelector(state => state.chat);

  const [remoteHasVideo, setRemoteHasVideo] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;


  useEffect(() => {
    if (callStatus === 'incoming') {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.15,
            duration: 800,
            useNativeDriver: true,
            easing: Easing.bezier(0.4, 0, 0.6, 1)
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
            easing: Easing.bezier(0.4, 0, 0.6, 1)
          })
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [callStatus]);

  console.log('💎 [VideoCall] Render - Status:', callStatus, 'RemoteUsers:', remoteUsers.length, 'isGroup:', isGroup);



  const activeConversation = useMemo(() => {
    return conversations.find(c => c.conversationId === activeConversationId);
  }, [conversations, activeConversationId]);

  // Xây dựng bản đồ thành viên (UID -> {name, avatar}) để hiển thị thông tin khi tắt cam

  const memberMap = useMemo(() => {
    const currentConv = conversations.find(c => c.conversationId === activeConversationId);
    if (!currentConv || !currentConv.members) return {};
    
    return currentConv.members.reduce((acc, m) => {
      const mid = m.userId || m.id || m._id;
      if (mid) {
        acc[toNumericUid(mid.toString())] = { 
          name: m.fullName || m.name || 'Thành viên',
          avatar: m.avatar || m.avatarUrl || m.profilePic
        };
      }
      return acc;
    }, {});
  }, [conversations, activeConversationId]);

  const agoraHTML = React.useMemo(() => {
    if (!agoraConfig) return null;
    const isCaller = !incomingSignal;
    const myInfo = {
      name: user?.fullName || user?.name || 'Bạn',
      avatar: user?.avatar || user?.avatarUrl
    };
    // Gỡ memberMap khỏi deps để tránh reload WebView khi dữ liệu hội thoại thay đổi
    return getAgoraHTML(agoraConfig, callType, isCaller, isGroup, memberMap, myInfo);
  }, [agoraConfig?.channel, agoraConfig?.token, callType, !!incomingSignal, isGroup]);

  // Cập nhật memberMap vào WebView mà không cần reload
  useEffect(() => {
    if (callStatus === 'connected' && webViewRef.current && Object.keys(memberMap).length > 0) {
      const script = `window.handleAction && window.handleAction({ type: 'update-members', members: ${JSON.stringify(memberMap)} });`;
      webViewRef.current.injectJavaScript(script);
    }
  }, [memberMap, callStatus]);



  // Đồng bộ trạng thái Mic/Cam vào WebView
  useEffect(() => {
    if (callStatus === 'connected' && webViewRef.current) {
      const script = `window.handleAction && window.handleAction({ type: 'toggle-mic', enabled: ${micOn} });`;
      webViewRef.current.injectJavaScript(script);
    }
  }, [micOn, callStatus]);

  useEffect(() => {
    if (callStatus === 'connected' && webViewRef.current) {
      const script = `window.handleAction && window.handleAction({ type: 'toggle-cam', enabled: ${camOn} });`;
      webViewRef.current.injectJavaScript(script);
    }
  }, [camOn, callStatus]);

  useEffect(() => {
    if (callStatus === 'ended' && webViewRef.current) {
      const script = `window.handleAction && window.handleAction({ type: 'leave' });`;
      webViewRef.current.injectJavaScript(script);
    }
  }, [callStatus]);


  const handleWebViewMessage = useCallback((event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'log') {
        console.log('🌐 [WebView]:', data.message);
        return;
      }

      console.log('📬 [VideoCall] Message:', data.type, data);

      if (data.type === 'user-joined' || data.type === 'user-published') {
        dispatch(addRemoteUser({ uid: data.uid, mediaType: data.mediaType || 'audio' }));
        if (data.mediaType === 'video') setRemoteHasVideo(true);
      } else if (data.type === 'user-unpublished') {
        if (data.mediaType === 'video') {
          dispatch(updateRemoteUserVideo({ uid: data.uid, hasVideo: false }));
          setRemoteHasVideo(false);
        }
      } else if (data.type === 'sync') {
        if (data.count > 0 && remoteUsers.length === 0) {
          dispatch(addRemoteUser({ uid: 'sync-' + Date.now(), mediaType: 'audio' }));
        }
        if (data.videoUids) {
          const hasVideo = data.videoUids.length > 0;
          setRemoteHasVideo(hasVideo);
          data.videoUids.forEach(uid => {
            dispatch(updateRemoteUserVideo({ uid, hasVideo: true }));
          });
        }
      } else if (data.type === 'user-left') {
        dispatch(removeRemoteUser(data.uid));
        if (!isGroup && remoteUsers.length <= 1 && callStatus === 'connected') {
          onHangup(false); 
        }
      } else if (data.type === 'joined') {
        console.log('✅ [VideoCall] Joined Agora Room');
      }
    } catch (e) {
      console.warn('❌ [VideoCall] Msg Error:', e);
    }
  }, [dispatch, remoteUsers.length, isGroup, callStatus, onHangup]);


  const handlerRef = useRef(handleWebViewMessage);
  useEffect(() => { handlerRef.current = handleWebViewMessage; }, [handleWebViewMessage]);

  const onMessage = useCallback((e) => {
    if (handlerRef.current) handlerRef.current(e);
  }, []);

  // Polling dự phòng: Cứ 2s hỏi WebView xem có mấy người rồi
  useEffect(() => {
    if (callStatus === 'connected' && webViewRef.current) {
      const timer = setInterval(() => {
        const script = `
          if (window.agoraClient) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'sync-count',
              count: window.agoraClient.remoteUsers.length
            }));
          }
        `;
        webViewRef.current.injectJavaScript(script);
      }, 2000);
      return () => clearInterval(timer);
    }
  }, [callStatus]);

  if (callStatus === 'idle') return null;





  return (
    <Modal 
      visible={callStatus !== 'idle'} 
      animationType="slide" 
      transparent={false}
      onRequestClose={() => dispatch(resetCall())}
    >
      <TouchableWithoutFeedback onPress={handleDoubleTap}>
        <View style={styles.container}>
          {/* WebView */}
          {/* WebView or Loading State */}
          {callStatus === 'connected' && agoraConfig && (
            <View style={styles.webViewContainer}>
              <WebView
                key={agoraConfig.sessionId || agoraConfig.channel}
                ref={webViewRef}
                source={{ html: agoraHTML, baseUrl: 'https://localhost' }}
                style={styles.webView}
                originWhitelist={['*']}
                javaScriptEnabled={true}
                scrollEnabled={false}
                domStorageEnabled={true}
                mediaPlaybackRequiresUserAction={false}
                allowsInlineMediaPlayback={true}
                onMessage={onMessage}

                onPermissionRequest={(event) => event.grant()}
                onError={(e) => console.error('❌ [WebView] Error:', e.nativeEvent)}
                onHttpError={(e) => console.error('❌ [WebView] HTTP Error:', e.nativeEvent)}
              />

            </View>
          )}


          {/* Background cho Audio mode - Chỉ hiện khi chưa có ai, là Audio Call và mình KHÔNG bật cam */}
          {(callStatus === 'connected' && remoteUsers.length === 0 && callType === 'audio' && !camOn) && (
            <View style={styles.audioOnlyBg} pointerEvents="none" />
          )}



          {/* Overlay UI */}
          <View style={[
            styles.overlayContainer, 
            callStatus === 'connected' && { backgroundColor: 'transparent' }
          ]} pointerEvents="box-none">
            <View style={styles.overlay} pointerEvents="box-none">
              
              {/* Header */}
              {(showControls || callStatus === 'incoming' || callStatus === 'outgoing') && (

                <View style={styles.header}>
                  <View style={styles.headerInfo}>
                    <View style={styles.headerBadge}>
                      <Ionicons name={callType === 'video' ? 'videocam' : 'call'} size={10} color="#6366f1" />
                      <Text style={styles.callTypeTitle}>
                        {callStatus === 'outgoing' ? 'Đang gọi...' : 
                         callStatus === 'incoming' ? 'Cuộc gọi đến' : 
                         isGroup ? 'CUỘC GỌI NHÓM' : 'CUỘC GỌI VIDEO'}
                      </Text>

                    </View>
                    <View style={styles.headerTitleRow}>
                      {isGroup && formatAvatarUrl(callerInfo?.avatar) && (
                        <Image source={{ uri: formatAvatarUrl(callerInfo.avatar) }} style={styles.headerAvatar} />
                      )}
                      <Text style={styles.groupNameText} numberOfLines={1}>
                        {isGroup ? (activeConversation?.name || callerInfo?.name || 'Cuộc gọi nhóm') : (callerName || callerInfo?.name)}
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
              )}

              {/* MÀN HÌNH KẾT THÚC (SUMMARY SCREEN) */}
              {callStatus === 'ended' && (
                <View style={styles.endScreenContainer}>
                  <View style={styles.endScreenContent}>
                    <View style={styles.endAvatarWrapper}>
                      {formatAvatarUrl(isGroup ? (activeConversation?.avatar || callerInfo?.avatar) : callerInfo?.avatar) ? (
                        <Image 
                          source={{ uri: formatAvatarUrl(isGroup ? (activeConversation?.avatar || callerInfo?.avatar) : callerInfo?.avatar) }} 
                          style={styles.endAvatar} 
                        />
                      ) : (
                        <View style={[styles.endAvatar, styles.initialsAvatar]}>
                          <Text style={styles.endInitialsText}>
                            {(isGroup ? (activeConversation?.name || callerInfo?.name) : (callerName || callerInfo?.name))?.charAt(0).toUpperCase() || 'U'}
                          </Text>
                        </View>
                      )}
                    </View>

                    <Text style={styles.endCallerName}>
                      {isGroup ? (activeConversation?.name || callerInfo?.name || 'Cuộc gọi nhóm') : (callerName || callerInfo?.name)}
                    </Text>

                    <View style={styles.endReasonPill}>
                      <Text style={styles.endReasonText}>{endCallReason || 'Cuộc gọi đã kết thúc'}</Text>
                    </View>

                    <TouchableOpacity 
                      style={styles.backToChatButton}
                      onPress={() => onReset?.()}
                    >
                      <Text style={styles.backToChatText}>Trở lại trò chuyện</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Overlay UI Layer: Hiện khi đang chờ, kết thúc, Nhóm chưa có ai, HOẶC 1-1 mà đối phương tắt cam */}
              {(callStatus === 'outgoing' || callStatus === 'incoming' || callStatus === 'ended' || (isGroup && callStatus === 'connected' && remoteUsers.length === 0) || (!isGroup && callStatus === 'connected' && !remoteHasVideo)) && (








                <View style={styles.centerInfo}>
                  {isGroup && callStatus === 'connected' && remoteUsers.length > 0 ? (
                    /* GRID VIEW (Audio mode) */
                    <View style={styles.groupGrid}>
                      {(() => {
                        const list = [...remoteUsers];
                        const tiles = [list[0], { isLocal: true }, ...list.slice(1)];
                        return tiles.map((item, i) => (
                          <View key={i} style={styles.gridTile}>
                             <View style={styles.tileAvatarContainer}>
                                {item.isLocal ? (
                                    user?.avatar ? <Image source={{ uri: formatAvatarUrl(user.avatar) }} style={styles.tileAvatar} /> : 
                                    <View style={[styles.tileAvatar, styles.initialsAvatar]}><Text style={styles.tileInitials}>B</Text></View>
                                ) : (
                                    <View style={[styles.tileAvatar, styles.initialsAvatar]}><Text style={styles.tileInitials}>U</Text></View>
                                )}
                             </View>
                             <Text style={styles.tileName} numberOfLines={1}>{item.isLocal ? 'Bạn' : (memberMap[item.uid]?.name || `User ${item.uid}`)}</Text>
                          </View>
                        ));
                      })()}
                    </View>
                  ) : (
                    /* SOLO VIEW / 1-1 / WAITING */
                    <View style={styles.singleParticipantInfo}>
                          <View style={[
                          styles.waitingCard,
                          (callStatus === 'connected' && !isGroup) && { backgroundColor: 'transparent', borderWidth: 0, shadowOpacity: 0 }
                        ]}>
                          <View style={styles.avatarContainer}>
                            {formatAvatarUrl(isGroup ? (activeConversation?.avatar || callerInfo?.avatar) : callerInfo?.avatar) ? (
                              <Image 
                                source={{ uri: formatAvatarUrl(isGroup ? (activeConversation?.avatar || callerInfo?.avatar) : callerInfo?.avatar) }} 
                                style={styles.avatar} 
                              />
                            ) : (
                              <View style={[styles.avatar, styles.initialsAvatar]}>
                                <Text style={styles.initialsText}>{(isGroup ? (activeConversation?.name || callerInfo?.name) : (callerName || callerInfo?.name))?.charAt(0).toUpperCase() || 'U'}</Text>
                              </View>
                            )}

                            {/* Vòng tròn đếm ngược (Hiện cho cả 1-1 và Group khi đang chờ) */}
                            {(callStatus === 'outgoing' || callStatus === 'incoming' || (isGroup && callStatus === 'connected' && remoteUsers.length === 0)) && (
                               <CountdownRing size={160} duration={30000} onComplete={handleTimeout} />
                            )}

                          </View>
                          
                          <View style={styles.statusInfo}>
                            <Text style={styles.callerName}>{isGroup ? (activeConversation?.name || callerInfo?.name || 'Cuộc gọi nhóm') : (callerName || callerInfo?.name)}</Text>
                            
                            <Text style={styles.statusText}>
                              {callStatus === 'outgoing' ? 'Đang gọi...' : 
                               callStatus === 'incoming' ? 'Cuộc gọi đến...' : 
                               (isGroup && remoteUsers.length === 0) ? 'ĐANG CHỜ MỌI NGƯỜI THAM GIA...' :
                               callStatus === 'connected' ? (isGroup ? 'Đang họp nhóm...' : 'Đang trò chuyện...') :
                               'Cuộc gọi đã kết thúc'}
                            </Text>
                          </View>
                        </View>

                    </View>
                  )}
                </View>
              )}

              {/* Controls */}
              {(showControls || callStatus === 'incoming' || callStatus === 'outgoing') && (

                <View style={styles.controlsContainer}>
                  <View style={styles.controlsGlass}>
                    {callStatus === 'incoming' ? (
                      <View style={styles.incomingButtons}>
                        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                          <TouchableOpacity 
                            onPress={() => {
                              const script = `window.handleAction && window.handleAction({ type: 'leave' });`;
                              webViewRef.current?.injectJavaScript(script);
                              onHangup();
                            }} 
                            style={[styles.btn, styles.btnHangup]}
                            hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                            activeOpacity={0.6}
                          >
                            <Ionicons name="call" size={32} color="white" style={{ transform: [{ rotate: '135deg' }] }} />
                          </TouchableOpacity>
                        </Animated.View>
                        
                        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                          <TouchableOpacity 
                            onPress={onAccept} 
                            style={[styles.btn, styles.btnAccept]}
                            hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                            activeOpacity={0.6}
                          >
                            <Ionicons name="call" size={32} color="white" />
                          </TouchableOpacity>
                        </Animated.View>
                      </View>



                    ) : (
                      <View style={styles.activeButtons}>
                        <TouchableOpacity 
                          onPress={onToggleMic} 
                          style={[styles.btnAction, !micOn && styles.btnOff]}
                          hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                          activeOpacity={0.7}
                        >
                          <Ionicons name={micOn ? "mic" : "mic-off"} size={22} color="white" />
                        </TouchableOpacity>
                        
                        <TouchableOpacity 
                          onPress={() => {
                            const script = `window.handleAction && window.handleAction({ type: 'leave' });`;
                            webViewRef.current?.injectJavaScript(script);
                            onHangup();
                          }} 
                          style={[styles.btnAction, styles.btnHangup, styles.btnLarge]}
                          hitSlop={{ top: 30, bottom: 30, left: 30, right: 30 }}
                          activeOpacity={0.5}
                        >
                          <Ionicons name="call" size={28} color="white" style={{ transform: [{ rotate: '135deg' }] }} />
                        </TouchableOpacity>

                        
                        <TouchableOpacity 
                          onPress={onToggleCamera} 
                          style={[styles.btnAction, !camOn && styles.btnOff]}
                          hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                        >
                          <Ionicons name={camOn ? "videocam" : "videocam-off"} size={22} color="white" />
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                </View>
              )}
            </View>
          </View>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  webViewContainer: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  webView: { flex: 1, backgroundColor: 'transparent' },
  audioOnlyBg: { ...StyleSheet.absoluteFillObject, backgroundColor: '#0f172a', zIndex: 1 },
  overlayContainer: { ...StyleSheet.absoluteFillObject, zIndex: 2 },
  overlay: { flex: 1, justifyContent: 'space-between', paddingVertical: 40, paddingHorizontal: 20 },
  header: { 
    width: '100%', 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'flex-start', 
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
    paddingHorizontal: 10
  },
  headerInfo: { flex: 1 },
  headerBadge: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: 'rgba(99, 102, 241, 0.15)', 
    paddingHorizontal: 10, 
    paddingVertical: 4, 
    borderRadius: 12, 
    gap: 4,
    marginBottom: 6,
    alignSelf: 'flex-start'
  },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerAvatar: { width: 24, height: 24, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  callTypeTitle: { color: '#6366f1', fontSize: 9, fontWeight: 'bold', letterSpacing: 1 },
  groupNameText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  durationBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(99, 102, 241, 0.25)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 15 },
  recordDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#ef4444', marginRight: 6 },
  duration: { color: 'white', fontSize: 12, fontWeight: '600' },
  centerInfo: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  waitingCard: { 
    backgroundColor: 'rgba(15, 23, 42, 0.7)', 
    padding: 40, 
    borderRadius: 50, 
    borderWidth: 1.5, 
    borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    width: width * 0.88,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.5,
    shadowRadius: 30,
    elevation: 20,
  },
  singleParticipantInfo: { alignItems: 'center' },
  groupGrid: { width: '100%', flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
  gridTile: { width: (width - 60) / 2, aspectRatio: 1, margin: 8, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  tileAvatarContainer: { position: 'relative', marginBottom: 8 },
  tileAvatar: { width: 80, height: 80, borderRadius: 40, borderWidth: 2, borderColor: 'rgba(255,255,255,0.2)' },
  tileInitials: { color: 'white', fontSize: 32, fontWeight: 'bold' },
  tileName: { color: 'white', fontSize: 14, opacity: 0.8 },
  tileMicOff: { position: 'absolute', bottom: 0, right: 0, backgroundColor: '#ef4444', width: 22, height: 22, borderRadius: 11, justifyContent: 'center', alignItems: 'center' },
  avatarContainer: { width: 160, height: 160, marginBottom: 20, justifyContent: 'center', alignItems: 'center' },
  avatar: { width: 140, height: 140, borderRadius: 70, borderWidth: 3, borderColor: 'rgba(255,255,255,0.2)' },
  initialsAvatar: { backgroundColor: '#6366f1', alignItems: 'center', justifyContent: 'center' },
  initialsText: { color: 'white', fontSize: 60, fontWeight: 'bold' },
  pulseRing: { position: 'absolute', width: 180, height: 180, borderRadius: 90, borderWidth: 1, borderColor: 'rgba(99, 102, 241, 0.4)' },
  callerName: { color: 'white', fontSize: 26, fontWeight: 'bold', textAlign: 'center' },
  statusText: { 
    color: '#6366f1', 
    fontSize: 11, 
    fontWeight: '900', 
    marginTop: 15, 
    textAlign: 'center',
    letterSpacing: 1.5,
    textTransform: 'uppercase'
  },


  controlsContainer: { alignItems: 'center', marginBottom: 20, zIndex: 1000, elevation: 10 },

  controlsGlass: { backgroundColor: 'rgba(15, 23, 42, 0.8)', padding: 20, borderRadius: 40, width: '100%', maxWidth: 300 },
  incomingButtons: { flexDirection: 'row', justifyContent: 'space-around', width: '100%' },
  activeButtons: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%' },
  btn: { width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center' },
  btnAction: { width: 50, height: 50, borderRadius: 25, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },
  btnLarge: { width: 64, height: 64, borderRadius: 32 },
  btnAccept: { backgroundColor: '#22c55e' },
  btnHangup: { backgroundColor: '#ef4444' },
  btnOff: { backgroundColor: '#ef4444' },
  // End Screen Styles
  endScreenContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#1e1b4b', // Deep indigo
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  endScreenContent: {
    alignItems: 'center',
    width: '80%',
  },
  endAvatarWrapper: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.2)',
    padding: 4,
    marginBottom: 24,
    overflow: 'hidden'
  },
  endAvatar: {
    width: '100%',
    height: '100%',
    borderRadius: 65,
  },
  endInitialsText: {
    color: '#fff',
    fontSize: 48,
    fontWeight: 'bold',
  },
  endCallerName: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 16,
    textAlign: 'center',
  },
  endReasonPill: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    marginBottom: 60,
  },
  endReasonText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 16,
    fontWeight: '600',
  },
  backToChatButton: {
    backgroundColor: '#fff',
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 16,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  backToChatText: {
    color: '#1e1b4b',
    fontSize: 18,
    fontWeight: '800',
  },
});


export default VideoCall;
