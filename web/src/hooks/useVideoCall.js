import { useCallback, useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { onCallSignal, offCallSignal, emitCallSignal } from '../utils/socket';

const STUN_CONFIG = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

export const useVideoCall = (conversationId) => {
  const { user } = useSelector((state) => state.auth);
  const [callStatus, setCallStatus] = useState('idle');
  const [incomingSignal, setIncomingSignal] = useState(null);
  const [callerName, setCallerName] = useState('');
  const [error, setError] = useState(null);
  const [duration, setDuration] = useState(0);

  // ✅ FIX: thêm state remoteStream
  const [remoteStream, setRemoteStream] = useState(null);

  const callStatusRef = useRef('idle');
  const setStatus = useCallback((s) => {
    callStatusRef.current = s;
    setCallStatus(s);
  }, []);

  const myUserIdRef = useRef(null);
  useEffect(() => {
    myUserIdRef.current = user?.userId || user?.id;
  }, [user]);

  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const pendingIceRef = useRef([]);
  const activeCallConvIdRef = useRef(conversationId);
  const timerRef = useRef(null);
  const remoteTrackCallbackRef = useRef(null);

  // Timer
  useEffect(() => {
    if (callStatus === 'connected') {
      setDuration(0);
      timerRef.current = setInterval(() => setDuration((p) => p + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [callStatus]);

  const formatDuration = useCallback(() => {
    const mins = Math.floor(duration / 60);
    const secs = duration % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, [duration]);

  const endCallRef = useRef(null);

  const ensurePeer = useCallback((onRemoteTrack) => {
    remoteTrackCallbackRef.current = onRemoteTrack;
    if (pcRef.current) return pcRef.current;

    const pc = new RTCPeerConnection(STUN_CONFIG);

    pc.onicecandidate = (event) => {
      if (!event.candidate || !activeCallConvIdRef.current) return;
      emitCallSignal(activeCallConvIdRef.current, {
        type: 'ICE_CANDIDATE',
        payload: JSON.stringify(event.candidate),
      });
    };

    pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        remoteStreamRef.current = event.streams[0];
      } else {
        if (!remoteStreamRef.current) {
          remoteStreamRef.current = new MediaStream();
        }
        const exists = remoteStreamRef.current.getTracks().find(t => t.id === event.track.id);
        if (!exists) remoteStreamRef.current.addTrack(event.track);
      }

      // ✅ FIX: sync ra React state
      setRemoteStream(remoteStreamRef.current);

      remoteTrackCallbackRef.current?.(remoteStreamRef.current);
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        endCallRef.current?.(false);
      }
    };

    pcRef.current = pc;
    return pc;
  }, []);

  const getLocalStream = useCallback(async () => {
    if (localStreamRef.current) return localStreamRef.current;

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: true,
    });

    // 🔥 WAIT TRACK READY
    await Promise.all(
        stream.getTracks().map(
            (track) =>
                new Promise((resolve) => {
                  if (track.readyState === "live") return resolve();
                  track.onunmute = () => resolve();
                })
        )
    );

    localStreamRef.current = stream;
    return stream;
  }, []);

  const endCall = useCallback((emit = true) => {
    const cid = activeCallConvIdRef.current || conversationId;

    if (emit) emitCallSignal(cid, { type: 'HANGUP' });

    // ❗ đóng peer
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }

    // ❗ stop toàn bộ cam + mic
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => {
        t.stop();
      });
      localStreamRef.current = null;
    }

    // ❗ clear remote
    remoteStreamRef.current = null;
    setRemoteStream(null);

    pendingIceRef.current = [];
    setIncomingSignal(null);
    setCallerName('');

    setStatus('ended');

    setTimeout(() => {
      setStatus('idle');
      setDuration(0);
    }, 1000);
  }, [conversationId]);

  endCallRef.current = endCall;

  const connect = useCallback((onRemoteTrack) => {
    remoteTrackCallbackRef.current = onRemoteTrack;

    const handler = async (data) => {
      const { signal, senderId, conversationId: cid } = data;

      // ❗ FIX: ignore signal của chính mình
      if (senderId === myUserIdRef.current) return;

      if (!signal) return;

      const type = signal.type;

      // ❗ nhận OFFER → hiển thị incoming call
      if (type === 'OFFER') {
        activeCallConvIdRef.current = cid;

        setIncomingSignal({
          ...data,
          signal,
        });

        setCallerName(data.senderName || senderId);
        setStatus('incoming');
      }

      // ❗ nhận ANSWER → hoàn tất connect
      if (type === 'ANSWER') {
        const pc = pcRef.current;
        if (!pc) return;

        const answer = JSON.parse(signal.payload);
        await pc.setRemoteDescription(new RTCSessionDescription(answer));

        setStatus('connected');
      }

      // ❗ nhận ICE
      if (type === 'ICE_CANDIDATE') {
        const pc = pcRef.current;
        const candidate = new RTCIceCandidate(JSON.parse(signal.payload));

        if (pc && pc.remoteDescription) {
          await pc.addIceCandidate(candidate);
        } else {
          pendingIceRef.current.push(candidate);
        }
      }

      // ❗ HANGUP
      if (type === 'HANGUP') {
        endCallRef.current?.(false);
      }
    };

    onCallSignal(handler);
    return () => offCallSignal(handler);
  }, []);

  const startCall = useCallback(async (onLocalStream, onRemoteTrack) => {
    try {
      activeCallConvIdRef.current = conversationId;

      const stream = await getLocalStream();

      // ✅ stream đã READY thật
      onLocalStream(stream);

      const pc = ensurePeer(onRemoteTrack);

      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      emitCallSignal(conversationId, {
        type: 'OFFER',
        payload: JSON.stringify(offer),
      });

      setStatus('outgoing');

    } catch (e) {
      setError(e.message);
      endCall(false);
    }
  }, [conversationId, ensurePeer, getLocalStream, endCall, setStatus]);

  const acceptCall = useCallback(async (signalData, onLocalStream, onRemoteTrack) => {
    try {
      const stream = await getLocalStream();
      onLocalStream(stream);

      const pc = ensurePeer(onRemoteTrack);

      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      const offer = JSON.parse(signalData.signal.payload);
      await pc.setRemoteDescription(new RTCSessionDescription(offer));

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      emitCallSignal(signalData.conversationId, {
        type: 'ANSWER',
        payload: JSON.stringify(answer),
      });

      setStatus('connected');
    } catch (e) {
      setError(e.message);
      endCall(false);
    }
  }, [ensurePeer, getLocalStream, endCall]);

  return {
    callStatus,
    incomingSignal,
    callerName,
    error,
    duration,
    formatDuration,
    startCall,
    acceptCall,
    endCall,
    connect,
    activeCallConvId: activeCallConvIdRef.current,

    // ✅ FIX quan trọng
    remoteStream,
  };
};

export default useVideoCall;