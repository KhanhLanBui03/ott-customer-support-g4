import { useCallback, useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { onCallSignal, offCallSignal, emitCallSignal } from '../utils/socket';

const STUN_CONFIG = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

export const useVideoCall = (conversationId) => {
  const { user } = useSelector((state) => state.auth);
  const [callStatus, setCallStatus] = useState('idle');
  const [incomingSignal, setIncomingSignal] = useState(null);
  const [error, setError] = useState(null);
  const [duration, setDuration] = useState(0);

  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const pendingIceRef = useRef([]);
  const activeCallConvIdRef = useRef(conversationId);
  const timerRef = useRef(null);
  const remoteTrackCallbackRef = useRef(null);

  // Timer logic
  useEffect(() => {
    if (callStatus === 'connected') {
      setDuration(0);
      timerRef.current = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [callStatus]);

  const formatDuration = useCallback(() => {
    const mins = Math.floor(duration / 60);
    const secs = duration % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, [duration]);

  useEffect(() => {
    if (callStatus === 'idle') {
      activeCallConvIdRef.current = conversationId;
    }
  }, [conversationId, callStatus]);

  const ensurePeer = useCallback((onRemoteTrack) => {
    remoteTrackCallbackRef.current = onRemoteTrack;
    if (pcRef.current) return pcRef.current;

    console.log('[WEBRTC] Creating new RTCPeerConnection');
    const pc = new RTCPeerConnection(STUN_CONFIG);
    
    pc.onicecandidate = (event) => {
      if (!event.candidate || !activeCallConvIdRef.current) return;
      emitCallSignal(activeCallConvIdRef.current, {
        type: 'ICE_CANDIDATE',
        payload: JSON.stringify(event.candidate)
      });
    };

    pc.ontrack = (event) => {
      console.log('[WEBRTC] Remote track received');
      if (!remoteStreamRef.current) {
        remoteStreamRef.current = new MediaStream();
      }
      event.streams[0].getTracks().forEach((track) => remoteStreamRef.current.addTrack(track));
      remoteTrackCallbackRef.current?.(remoteStreamRef.current);
    };

    pc.onconnectionstatechange = () => {
        console.log('[WEBRTC] Connection state:', pc.connectionState);
    };

    pcRef.current = pc;
    return pc;
  }, [conversationId]);

  const getLocalStream = useCallback(async () => {
    try {
      if (localStreamRef.current) return localStreamRef.current;
      localStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      return localStreamRef.current;
    } catch (e) {
      console.error('[WEBRTC] Failed to get local stream:', e);
      throw e;
    }
  }, []);

  const handleSignal = useCallback(async (msg, onRemoteTrack) => {
    if (msg.senderId === user?.userId) return;
    
    // Check if the signal belongs to the active call (if we have one)
    if (callStatus !== 'idle' && msg.conversationId && msg.conversationId !== activeCallConvIdRef.current) {
        return; // Ignore signals from other conversations while in a call
    }
    
    const signal = msg.signal;
    if (!signal) return;
    console.log(`[WEBRTC] Incoming signal: ${signal.type} from ${msg.senderId}`);

    try {
      if (signal.type === 'OFFER') {
        if (callStatus !== 'idle' && callStatus !== 'ended') {
            console.warn('[WEBRTC] Busy, ignoring OFFER');
            return;
        }
        activeCallConvIdRef.current = msg.conversationId;
        setIncomingSignal(msg);
        setCallStatus('incoming');
        return;
      }

      const pc = pcRef.current;

      if (signal.type === 'ANSWER' && pc) {
        console.log('[WEBRTC] Setting remote description (ANSWER)');
        await pc.setRemoteDescription(new RTCSessionDescription(JSON.parse(signal.payload)));
        for (const c of pendingIceRef.current) {
          await pc.addIceCandidate(new RTCIceCandidate(c));
        }
        pendingIceRef.current = [];
        setCallStatus('connected');
      } else if (signal.type === 'ICE_CANDIDATE' && pc) {
        const candidate = JSON.parse(signal.payload);
        if (pc.remoteDescription) {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } else {
          pendingIceRef.current.push(candidate);
        }
      } else if (signal.type === 'HANGUP') {
        console.log('[WEBRTC] Peer hung up');
        endCall(false);
      }
    } catch (e) {
      console.error('[WEBRTC] Signaling error:', e);
      setError(e.message);
    }
  }, [user?.userId, callStatus]);

  const handleSignalRef = useRef();
  handleSignalRef.current = handleSignal;

  const connect = useCallback((onRemoteTrack) => {
    remoteTrackCallbackRef.current = onRemoteTrack;
    const signalHandler = (data) => {
       if (handleSignalRef.current) {
          handleSignalRef.current(data, onRemoteTrack);
       }
    };
    onCallSignal(signalHandler);
    return () => {
       offCallSignal(signalHandler);
    };
  }, []);

  const endCall = useCallback((emit = true) => {
    const cid = activeCallConvIdRef.current || conversationId;
    console.log('[WEBRTC] Ending call for', cid);
    if (emit) emitCallSignal(cid, { type: 'HANGUP' });
    
    if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
    }
    if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
        localStreamRef.current = null;
    }
    remoteStreamRef.current = null;
    pendingIceRef.current = [];
    setIncomingSignal(null);
    setCallStatus('ended');
    setTimeout(() => {
        setCallStatus('idle');
        setDuration(0);
    }, 1500);
  }, [conversationId]);

  const startCall = useCallback(async (onLocalStream, onRemoteTrack) => {
    try {
      setError(null);
      activeCallConvIdRef.current = conversationId;
      const stream = await getLocalStream();
      onLocalStream?.(stream);

      const pc = ensurePeer(onRemoteTrack);
      const senders = pc.getSenders();
      stream.getTracks().forEach((track) => {
        if (!senders.some(s => s.track === track)) {
            pc.addTrack(track, stream);
        }
      });

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      emitCallSignal(conversationId, { type: 'OFFER', payload: JSON.stringify(offer) });
      setCallStatus('outgoing');
    } catch (e) {
      console.error('[WEBRTC] Start call failed:', e);
      setError(e.message || 'Cannot start video call');
      endCall(false);
    }
  }, [conversationId, ensurePeer, getLocalStream, endCall]);

  const acceptCall = useCallback(async (signalData, onLocalStream, onRemoteTrack) => {
    console.log('[WEBRTC] Accepting call...', signalData?.conversationId);
    try {
      if (!signalData?.signal) return;
      setError(null);
      const targetConvId = signalData.conversationId || conversationId;
      activeCallConvIdRef.current = targetConvId;
      
      const stream = await getLocalStream();
      onLocalStream?.(stream);

      const pc = ensurePeer(onRemoteTrack);
      const senders = pc.getSenders();
      stream.getTracks().forEach((track) => {
        if (!senders.some(s => s.track === track)) {
            pc.addTrack(track, stream);
        }
      });
      
      const offer = JSON.parse(signalData.signal.payload);
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      emitCallSignal(targetConvId, { type: 'ANSWER', payload: JSON.stringify(answer) });
      
      setIncomingSignal(null);
      setCallStatus('connected');
    } catch (e) {
      console.error('[WEBRTC] Accept call failed:', e);
      setError(e.message || 'Cannot accept call');
      endCall(false);
    }
  }, [conversationId, ensurePeer, getLocalStream, endCall]);

  useEffect(() => {
    return () => {
      if (pcRef.current) pcRef.current.close();
      if (localStreamRef.current) localStreamRef.current.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return { 
    callStatus, 
    incomingSignal, 
    error, 
    duration, 
    formatDuration, 
    startCall, 
    acceptCall, 
    endCall, 
    connect,
    activeCallConvId: activeCallConvIdRef.current 
  };
};

export default useVideoCall;
