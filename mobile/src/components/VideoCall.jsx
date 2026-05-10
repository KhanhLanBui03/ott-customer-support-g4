import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Dimensions, Image, Platform } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { setRemoteUsers, resetCall as resetCallAction } from '../store/callSlice';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { getAgoraHTML } from '../utils/agora-web-template';

const { width, height } = Dimensions.get('window');

const VideoCall = ({
  callerName, duration, formatDuration,
  onAccept, onHangup, onToggleMic, onToggleCamera,
  callerInfo
}) => {
  const webViewRef = useRef(null);
  const dispatch = useDispatch();

  const { 
    callStatus, callType, agoraConfig, incomingSignal, 
    remoteUsers, camOn, micOn, endCallReason
  } = useSelector(state => state.call);

  // ✅ QUAN TRỌNG: Dùng useMemo để HTML không bị tạo lại, tránh WebView bị reload
  const agoraHTML = React.useMemo(() => {
    if (!agoraConfig) return null;
    const isCaller = !incomingSignal; // Nếu không có tín hiệu đến thì là người gọi
    return getAgoraHTML(agoraConfig, callType, isCaller);
  }, [agoraConfig?.channel, agoraConfig?.token, callType, !!incomingSignal]);

  useEffect(() => {
    if (callStatus !== 'idle') {
      console.log('📞 [VideoCall] Status:', callStatus, 'Name:', callerName);
    }
  }, [callStatus, callerName]);

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

  if (callStatus === 'idle') return null;

  const handleWebViewMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'user-published') {
        const existing = remoteUsers.find(u => u.uid === data.uid);
        let newUsers;
        if (existing) {
          newUsers = remoteUsers.map(u => 
            u.uid === data.uid ? { ...u, hasVideo: data.mediaType === 'video' || u.hasVideo } : u
          );
        } else {
          newUsers = [...remoteUsers, { uid: data.uid, hasVideo: data.mediaType === 'video' }];
        }
        dispatch(setRemoteUsers(newUsers));
      } else if (data.type === 'user-unpublished') {
        if (data.mediaType === 'video') {
          const newUsers = remoteUsers.map(u => 
            u.uid === data.uid ? { ...u, hasVideo: false } : u
          );
          dispatch(setRemoteUsers(newUsers));
        }
      } else if (data.type === 'user-left') {
        const newUsers = remoteUsers.filter(u => u.uid !== data.uid);
        dispatch(setRemoteUsers(newUsers));
        if (newUsers.length === 0 && callStatus === 'connected') {
           console.log('🚪 [VideoCall] Last remote user left, auto-hanging up...');
           onHangup(false); // Kết thúc cuộc gọi cục bộ, không gửi signal ngược lại
        }
      } else if (data.type === 'log') {
        console.log('🌐 [WebView-Agora]', data.message);
      }
    } catch (e) {}
  };

  return (
    <Modal 
      visible={callStatus !== 'idle'} 
      animationType="slide" 
      transparent={false}
      onRequestClose={() => dispatch(resetCallAction())}
    >
      <View style={styles.container}>
        {/* WebView - CHỈ HIỆN KHI ĐÃ KẾT NỐI ĐỂ TRÁNH RELOAD NHIỀU LẦN */}
        {callStatus === 'connected' && agoraConfig ? (
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
              onMessage={handleWebViewMessage}
              onPermissionRequest={(event) => {
                event.grant();
              }}
            />
          </View>
        ) : (
          <View style={styles.loadingContainer}>
             <Text style={{ color: 'white' }}>{callStatus === 'connected' ? 'Đang khởi tạo cuộc gọi...' : 'Đang kết nối...'}</Text>
          </View>
        )}

        {/* Background cho cuộc gọi Audio (hiện khi không có ai bật video) */}
        {(callStatus === 'connected' && !remoteUsers.some(u => u.hasVideo) && !camOn) && (
          <View style={styles.audioOnlyBg} pointerEvents="none" />
        )}

        {/* Overlay UI */}
        <View style={[
          styles.overlayContainer, 
          callStatus === 'connected' && { backgroundColor: 'transparent' }
        ]} pointerEvents="box-none">
          <View style={styles.overlay} pointerEvents="box-none">
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerBadge}>
                 <Ionicons name={callType === 'video' ? 'videocam' : 'call'} size={14} color="#6366f1" />
                 <Text style={styles.callTypeTitle}>{callType === 'video' ? 'VIDEO CALL' : 'AUDIO CALL'}</Text>
              </View>
              {callStatus === 'connected' && <Text style={styles.duration}>{formatDuration()}</Text>}
            </View>

            {/* Center Info (Always visible for Audio, or during connection for Video) */}
            {/* Ẩn avatar nếu đã có remote video để tránh vướng màn hình */}
            {(callStatus === 'outgoing' || callStatus === 'incoming' || callStatus === 'ended' || (callStatus === 'connected' && !remoteUsers.some(u => u.hasVideo))) && (
              <View style={styles.centerInfo}>
                <View style={styles.avatarContainer}>
                  {callerInfo?.avatar ? (
                    <Image 
                      source={{ uri: callerInfo.avatar }} 
                      style={styles.avatar} 
                      onError={(e) => console.log('🖼️ [VideoCall] Image Load Error:', e.nativeEvent.error)}
                    />
                  ) : (
                    <View style={[styles.avatar, styles.initialsAvatar]}>
                      <Text style={styles.initialsText}>
                        {(callerName || 'U').charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <View style={styles.pulseRing} />
                </View>
                <Text style={styles.callerName}>{callerName || callerInfo?.name || 'Người dùng'}</Text>
                
                {callStatus === 'ended' ? (
                  <View style={styles.endCallPill}>
                    <Text style={styles.endCallText}>{endCallReason || 'Cuộc gọi đã kết thúc'}</Text>
                  </View>
                ) : (
                  <Text style={styles.statusText}>
                    {callStatus === 'outgoing' ? 'Đang gọi...' : callStatus === 'incoming' ? 'Cuộc gọi đến...' : (remoteUsers.some(u => u.hasVideo) ? 'Đang trong cuộc gọi' : 'Đang kết nối...')}
                  </Text>
                )}
              </View>
            )}


            {/* Controls */}
            <View style={styles.controlsContainer}>
              <View style={styles.controlsGlass}>
                {callStatus === 'incoming' ? (
                  <View style={styles.incomingButtons}>
                    <TouchableOpacity onPress={onHangup} style={[styles.btn, styles.btnHangup]}>
                      <Ionicons name="close" size={32} color="white" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={onAccept} style={[styles.btn, styles.btnAccept]}>
                      <Ionicons name="call" size={32} color="white" />
                    </TouchableOpacity>
                  </View>
                ) : callStatus === 'ended' ? (
                  <View style={styles.endedButtons}>
                    <TouchableOpacity 
                      style={[styles.btn, styles.btnHangup, { width: '60%', height: 48, borderRadius: 24 }]}
                      onPress={() => dispatch(resetCallAction())}
                    >
                      <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 14 }}>CUỘC GỌI KẾT THÚC</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.activeButtons}>
                    <TouchableOpacity onPress={onToggleMic} style={[styles.btnAction, !micOn && styles.btnOff]}>
                      <Ionicons name={micOn ? "mic" : "mic-off"} size={24} color="white" />
                    </TouchableOpacity>

                    <TouchableOpacity onPress={onHangup} style={[styles.btnAction, styles.btnHangup, styles.btnLarge]}>
                      <Ionicons name="call-outline" size={32} color="white" style={{ transform: [{ rotate: '135deg' }] }} />
                    </TouchableOpacity>

                    <TouchableOpacity onPress={onToggleCamera} style={[styles.btnAction, !camOn && styles.btnOff]}>
                      <Ionicons name={camOn ? "videocam" : "videocam-off"} size={24} color="white" />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  webViewContainer: { flex: 1, backgroundColor: '#0f172a' },
  loadingContainer: { flex: 1, backgroundColor: '#0f172a', justifyContent: 'center', alignItems: 'center' },
  webView: { flex: 1, backgroundColor: 'transparent' },
  audioOnlyBg: { ...StyleSheet.absoluteFillObject, backgroundColor: '#0f172a', zIndex: 1 },
  overlayContainer: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15, 23, 42, 0.9)', zIndex: 2 },
  overlay: { flex: 1, justifyContent: 'space-between', paddingVertical: 50, paddingHorizontal: 25 },
  header: { alignItems: 'center' },
  headerBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(99, 102, 241, 0.1)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, gap: 6 },
  callTypeTitle: { color: '#6366f1', fontSize: 11, fontWeight: 'bold', letterSpacing: 1.5 },
  duration: { color: 'white', fontSize: 26, marginTop: 10, fontWeight: '800', fontVariant: ['tabular-nums'], letterSpacing: 1 },
  centerInfo: { alignItems: 'center', marginTop: 60 },
  avatarContainer: { width: 180, height: 180, marginBottom: 30, justifyContent: 'center', alignItems: 'center' },
  avatar: { width: 160, height: 160, borderRadius: 80, borderWidth: 3, borderColor: 'rgba(255,255,255,0.2)' },
  initialsAvatar: { backgroundColor: '#6366f1', alignItems: 'center', justifyContent: 'center', borderWidth: 0 },
  initialsText: { color: 'white', fontSize: 70, fontWeight: 'bold' },
  pulseRing: { position: 'absolute', width: 210, height: 210, borderRadius: 105, borderWidth: 1, borderColor: 'rgba(99, 102, 241, 0.4)', zIndex: -1 },
  callerName: { color: 'white', fontSize: 34, fontWeight: 'bold', textAlign: 'center', letterSpacing: 0.5 },
  statusText: { color: '#94a3b8', fontSize: 18, marginTop: 10, opacity: 0.9 },
  localContainerPlaceholder: { position: 'absolute', width: 110, height: 160, top: 80, right: 20, borderRadius: 20, borderStyle: 'dashed', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', pointerEvents: 'none' },
  controlsContainer: { alignItems: 'center', marginBottom: 20 },
  controlsGlass: { backgroundColor: 'rgba(15, 23, 42, 0.75)', padding: 25, borderRadius: 45, width: '100%', maxWidth: 320, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.5, shadowRadius: 20, elevation: 15 },
  incomingButtons: { flexDirection: 'row', justifyContent: 'space-around', width: '100%', gap: 30 },
  activeButtons: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%' },
  btn: { width: 70, height: 70, borderRadius: 35, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 5, elevation: 8 },
  btnAction: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },
  btnLarge: { width: 72, height: 72, borderRadius: 36 },
  btnAccept: { backgroundColor: '#22c55e' },
  btnHangup: { backgroundColor: '#ef4444' },
  btnOff: { backgroundColor: '#ef4444' },
  btnDisabled: { opacity: 0.5 },
  endedButtons: { width: '100%', alignItems: 'center', justifyContent: 'center', paddingVertical: 10 },
  endCallPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 35,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    marginTop: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8
  },
  endCallText: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
});

export default VideoCall;
