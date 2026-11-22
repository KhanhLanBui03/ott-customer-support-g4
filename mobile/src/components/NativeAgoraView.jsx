import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getAgoraNativeSdk } from '../utils/agoraNativeLoader';
import CONFIG from '../config';

const formatAvatarUrl = (url) => {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  return `${CONFIG.BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
};

const NativeAgoraView = forwardRef(({
  agoraConfig,
  callType,
  isGroup,
  micOn,
  camOn,
  speakerOn,
  memberMap = {},
  myInfo = {},
  onJoined,
  onUserJoined,
  onUserLeft,
  onRemoteVideoChange,
  onError,
}, ref) => {
  const insets = useSafeAreaInsets();
  const sdk = getAgoraNativeSdk();
  const engineRef = useRef(null);
  const handlerRef = useRef(null);
  const hasJoinedRef = useRef(false);
  const hasLeftRef = useRef(false);

  const [isJoined, setIsJoined] = useState(false);
  const [remoteVideoMap, setRemoteVideoMap] = useState({});
  const [remoteUids, setRemoteUids] = useState([]);

  const callbacksRef = useRef({
    onJoined,
    onUserJoined,
    onUserLeft,
    onRemoteVideoChange,
    onError,
  });

  useEffect(() => {
    callbacksRef.current = {
      onJoined,
      onUserJoined,
      onUserLeft,
      onRemoteVideoChange,
      onError,
    };
  }, [onJoined, onUserJoined, onUserLeft, onRemoteVideoChange, onError]);

  const leaveNativeChannel = () => {
    if (hasLeftRef.current) return;
    hasLeftRef.current = true;
    const engine = engineRef.current;
    if (!engine) return;
    try {
      engine.stopPreview();
    } catch {}
    try {
      if (handlerRef.current) {
        engine.unregisterEventHandler(handlerRef.current);
        handlerRef.current = null;
      }
    } catch {}
    try {
      engine.leaveChannel();
    } catch {}
    try {
      engine.release();
    } catch {}
    engineRef.current = null;
    hasJoinedRef.current = false;
  };

  useImperativeHandle(ref, () => ({
    switchCamera: () => {
      try {
        engineRef.current?.switchCamera();
      } catch (e) {
        console.warn('[AgoraNative] switchCamera error:', e);
      }
    },
    setSpeaker: (enabled) => {
      try {
        engineRef.current?.setEnableSpeakerphone(Boolean(enabled));
      } catch (e) {
        console.warn('[AgoraNative] setEnableSpeakerphone error:', e);
      }
    },
    leave: () => {
      leaveNativeChannel();
    },
  }));

  useEffect(() => {
    if (!sdk || !agoraConfig?.appId || !agoraConfig?.channel) return;

    hasLeftRef.current = false;
    hasJoinedRef.current = false;
    setIsJoined(false);
    setRemoteUids([]);
    setRemoteVideoMap({});

    const {
      createAgoraRtcEngine,
      ChannelProfileType,
      ClientRoleType,
      RemoteVideoState,
    } = sdk;

    let engine = null;
    try {
      engine = createAgoraRtcEngine();
      engineRef.current = engine;

      const initCode = engine.initialize({
        appId: String(agoraConfig.appId),
        channelProfile: ChannelProfileType.ChannelProfileCommunication,
      });
      console.log('⚡ [AgoraNative] initialize code:', initCode);

      const eventHandler = {
        onJoinChannelSuccess: (_connection, elapsed) => {
          console.log('✅ [AgoraNative] Joined channel successfully in', elapsed, 'ms');
          hasJoinedRef.current = true;
          setIsJoined(true);
          try {
            engine.setEnableSpeakerphone(Boolean(speakerOn));
          } catch {}
          callbacksRef.current.onJoined?.();
        },
        onUserJoined: (_connection, remoteUid) => {
          console.log('👤 [AgoraNative] Remote user joined:', remoteUid);
          setRemoteUids((prev) => (prev.includes(remoteUid) ? prev : [...prev, remoteUid]));
          callbacksRef.current.onUserJoined?.(remoteUid);
        },
        onUserOffline: (_connection, remoteUid) => {
          console.log('👋 [AgoraNative] Remote user left:', remoteUid);
          setRemoteUids((prev) => prev.filter((id) => id !== remoteUid));
          setRemoteVideoMap((prev) => {
            const next = { ...prev };
            delete next[remoteUid];
            return next;
          });
          callbacksRef.current.onUserLeft?.(remoteUid);
        },
        onRemoteVideoStateChanged: (_connection, remoteUid, state) => {
          const active =
            state === RemoteVideoState.RemoteVideoStateStarting ||
            state === RemoteVideoState.RemoteVideoStateDecoding;
          setRemoteVideoMap((prev) => {
            if (Boolean(prev[remoteUid]) === active) return prev;
            return { ...prev, [remoteUid]: active };
          });
          callbacksRef.current.onRemoteVideoChange?.(remoteUid, active);
        },
        onUserMuteVideo: (_connection, remoteUid, muted) => {
          const active = !muted;
          setRemoteVideoMap((prev) => ({ ...prev, [remoteUid]: active }));
          callbacksRef.current.onRemoteVideoChange?.(remoteUid, active);
        },
        onError: (err, msg) => {
          console.warn('⚠️ [AgoraNative] SDK error:', err, msg);
          callbacksRef.current.onError?.(err, msg);
        },
      };

      handlerRef.current = eventHandler;
      engine.registerEventHandler(eventHandler);

      engine.enableAudio();
      engine.setDefaultAudioRouteToSpeakerphone(Boolean(speakerOn));
      engine.enableVideo();
      engine.setVideoEncoderConfiguration({
        dimensions: { width: 640, height: 480 },
        frameRate: 24,
        bitrate: 0,
      });

      const initialVideoOn = Boolean(camOn);
      engine.enableLocalVideo(initialVideoOn);
      engine.muteLocalVideoStream(!initialVideoOn);
      engine.muteLocalAudioStream(!micOn);
      if (initialVideoOn) {
        engine.startPreview();
      }

      const token =
        agoraConfig.token &&
        agoraConfig.token !== 'null' &&
        agoraConfig.token !== 'undefined'
          ? String(agoraConfig.token)
          : '';
      const numericUid = Number(agoraConfig.uid) || 0;

      const joinCode = engine.joinChannel(token, String(agoraConfig.channel), numericUid, {
        clientRoleType: ClientRoleType.ClientRoleBroadcaster,
        autoSubscribeAudio: true,
        autoSubscribeVideo: true,
        publishMicrophoneTrack: Boolean(micOn),
        publishCameraTrack: initialVideoOn,
      });
      console.log('⚡ [AgoraNative] joinChannel:', agoraConfig.channel, 'uid:', numericUid, 'code:', joinCode);
    } catch (e) {
      console.error('❌ [AgoraNative] Init/Join failed:', e);
      callbacksRef.current.onError?.(-1, e?.message || String(e));
    }

    return () => {
      leaveNativeChannel();
    };
  }, [agoraConfig?.appId, agoraConfig?.channel, agoraConfig?.token, agoraConfig?.uid, agoraConfig?.sessionId]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    try {
      engine.muteLocalAudioStream(!micOn);
      if (hasJoinedRef.current) {
        engine.updateChannelMediaOptions({ publishMicrophoneTrack: Boolean(micOn) });
      }
    } catch (e) {
      console.warn('[AgoraNative] toggle mic error:', e);
    }
  }, [micOn]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    try {
      engine.enableLocalVideo(Boolean(camOn));
      engine.muteLocalVideoStream(!camOn);
      if (camOn) {
        engine.startPreview();
      } else {
        engine.stopPreview();
      }
      if (hasJoinedRef.current) {
        engine.updateChannelMediaOptions({ publishCameraTrack: Boolean(camOn) });
      }
    } catch (e) {
      console.warn('[AgoraNative] toggle cam error:', e);
    }
  }, [camOn]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    try {
      engine.setEnableSpeakerphone(Boolean(speakerOn));
    } catch (e) {
      console.warn('[AgoraNative] speaker error:', e);
    }
  }, [speakerOn]);

  if (!sdk) return null;

  const { RtcSurfaceView, RenderModeType, VideoSourceType } = sdk;
  const activeRemoteVideoUids = remoteUids.filter((uid) => remoteVideoMap[uid]);
  const primaryRemoteUid = activeRemoteVideoUids[0] ?? null;

  if (isGroup) {
    const tiles = [{ isLocal: true }, ...remoteUids.map((uid) => ({ isLocal: false, uid }))];
    return (
      <View style={styles.groupGrid}>
        {tiles.map((tile) => {
          const uidKey = tile.isLocal ? 'local' : String(tile.uid);
          const hasVideo = tile.isLocal ? camOn : Boolean(remoteVideoMap[tile.uid]);
          const info = tile.isLocal
            ? myInfo
            : memberMap[String(tile.uid)] || { name: `User ${tile.uid}` };
          const avatarUri = formatAvatarUrl(info?.avatar);

          return (
            <View
              key={uidKey}
              style={[
                styles.groupTile,
                tiles.length <= 2 ? styles.groupTileFullWidth : styles.groupTileHalfWidth,
              ]}
            >
              {hasVideo ? (
                <RtcSurfaceView
                  style={StyleSheet.absoluteFill}
                  canvas={
                    tile.isLocal
                      ? {
                          uid: 0,
                          sourceType: VideoSourceType.VideoSourceCamera,
                          renderMode: RenderModeType.RenderModeHidden,
                        }
                      : {
                          uid: Number(tile.uid),
                          sourceType: VideoSourceType.VideoSourceRemote,
                          renderMode: RenderModeType.RenderModeHidden,
                        }
                  }
                />
              ) : (
                <View style={styles.tilePlaceholder}>
                  {avatarUri ? (
                    <Image source={{ uri: avatarUri }} style={styles.tileAvatar} />
                  ) : (
                    <View style={styles.tileInitialCircle}>
                      <Text style={styles.tileInitialText}>
                        {(info?.name || 'U').charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                </View>
              )}
              <View style={styles.memberLabel}>
                <Text style={styles.memberLabelText} numberOfLines={1}>
                  {info?.name || 'User'}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    );
  }

  return (
    <View style={styles.singleRoot}>
      {/* Video đối phương toàn màn hình */}
      {primaryRemoteUid !== null && (
        <RtcSurfaceView
          key={`remote-${primaryRemoteUid}`}
          style={StyleSheet.absoluteFill}
          canvas={{
            uid: Number(primaryRemoteUid),
            sourceType: VideoSourceType.VideoSourceRemote,
            renderMode: RenderModeType.RenderModeHidden,
          }}
        />
      )}

      {/* Video bản thân: toàn màn hình nếu đối phương chưa bật cam, thu nhỏ PIP nổi lên trên nếu đối phương đang bật cam */}
      {camOn && (
        <View
          style={
            primaryRemoteUid !== null
              ? [styles.localPip, { top: Math.max(insets.top, 24) + 76 }]
              : StyleSheet.absoluteFill
          }
        >
          <RtcSurfaceView
            key={`local-${primaryRemoteUid !== null ? 'pip' : 'full'}`}
            style={StyleSheet.absoluteFill}
            zOrderMediaOverlay={primaryRemoteUid !== null}
            canvas={{
              uid: 0,
              sourceType: VideoSourceType.VideoSourceCamera,
              renderMode: RenderModeType.RenderModeHidden,
            }}
          />
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  singleRoot: {
    flex: 1,
    backgroundColor: '#090d16',
  },
  localPip: {
    position: 'absolute',
    right: 16,
    width: 112,
    height: 158,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    backgroundColor: '#111827',
    zIndex: 10,
    elevation: 10,
  },
  groupGrid: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 6,
    gap: 6,
    backgroundColor: '#090d16',
  },
  groupTile: {
    flexGrow: 1,
    minHeight: '46%',
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  groupTileFullWidth: {
    width: '100%',
  },
  groupTileHalfWidth: {
    width: '48%',
  },
  tilePlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#111827',
  },
  tileAvatar: {
    width: 74,
    height: 74,
    borderRadius: 37,
  },
  tileInitialCircle: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tileInitialText: {
    color: '#ffffff',
    fontSize: 30,
    fontWeight: '700',
  },
  memberLabel: {
    position: 'absolute',
    left: 10,
    bottom: 10,
    maxWidth: '80%',
    backgroundColor: 'rgba(9, 13, 22, 0.68)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  memberLabelText: {
    color: '#f8fafc',
    fontSize: 12,
    fontWeight: '600',
  },
});

export default NativeAgoraView;
