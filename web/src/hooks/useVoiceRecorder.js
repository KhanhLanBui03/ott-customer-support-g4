import { useState, useRef, useCallback, useEffect } from 'react';

export const useVoiceRecorder = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState(null);

  const audioContextRef = useRef(null);
  const processorRef = useRef(null);
  const inputRef = useRef(null);
  const streamRef = useRef(null);
  const pcmDataRef = useRef([]);
  const startTimeRef = useRef(null);
  const animationFrameRef = useRef(null);

  useEffect(() => {
    if (!isRecording) {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      return;
    }
    const updateDuration = () => {
      if (startTimeRef.current) {
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
        setDuration(elapsed);
      }
      animationFrameRef.current = requestAnimationFrame(updateDuration);
    };
    animationFrameRef.current = requestAnimationFrame(updateDuration);
    return () => animationFrameRef.current && cancelAnimationFrame(animationFrameRef.current);
  }, [isRecording]);

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
      audioContextRef.current = audioContext;

      const input = audioContext.createMediaStreamSource(stream);
      inputRef.current = input;

      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      pcmDataRef.current = [];
      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        pcmDataRef.current.push(new Float32Array(inputData));
      };

      input.connect(processor);
      processor.connect(audioContext.destination);

      startTimeRef.current = Date.now();
      setIsRecording(true);
      setDuration(0);
    } catch (err) {
      setError(`Không thể truy cập micro: ${err.message}`);
      setIsRecording(false);
    }
  }, []);

  const stopRecording = useCallback(async () => {
    return new Promise((resolve) => {
      if (!isRecording) return;

      setIsRecording(false);

      // Dừng các node
      if (processorRef.current) processorRef.current.disconnect();
      if (inputRef.current) inputRef.current.disconnect();
      if (audioContextRef.current) audioContextRef.current.close();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }

      // Tạo file WAV
      const pcmBuffer = flattenPcm(pcmDataRef.current);
      const wavBlob = encodeWAV(pcmBuffer, 16000);
      const audioFile = new File([wavBlob], `voice_${Date.now()}.wav`, { type: 'audio/wav' });

      resolve(audioFile);
    });
  }, [isRecording]);

  const cancelRecording = useCallback(() => {
    setIsRecording(false);
    if (processorRef.current) processorRef.current.disconnect();
    if (inputRef.current) inputRef.current.disconnect();
    if (audioContextRef.current) audioContextRef.current.close();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    pcmDataRef.current = [];
  }, []);

  // Helper: Gộp các mảng PCM
  const flattenPcm = (chunks) => {
    const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
    const result = new Float32Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }
    return result;
  };

  // Helper: Đóng gói WAV header
  const encodeWAV = (samples, sampleRate) => {
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);

    const writeString = (offset, string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + samples.length * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, samples.length * 2, true);

    let offset = 44;
    for (let i = 0; i < samples.length; i++, offset += 2) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }

    return new Blob([view], { type: 'audio/wav' });
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return {
    isRecording,
    duration,
    durationFormatted: formatDuration(duration),
    error,
    startRecording,
    stopRecording,
    cancelRecording,
  };
};
