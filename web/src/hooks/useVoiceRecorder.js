import { useState, useRef, useCallback, useEffect } from 'react';

export const useVoiceRecorder = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState(null);

  const mediaRecorderRef = useRef(null);
  const streamsRef = useRef([]);
  const chunksRef = useRef([]);
  const durationRef = useRef(0);
  const startTimeRef = useRef(null);
  const animationFrameRef = useRef(null);

  // Update duration on animation frame
  useEffect(() => {
    if (!isRecording) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      return;
    }

    const updateDuration = () => {
      if (startTimeRef.current) {
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
        setDuration(elapsed);
        durationRef.current = elapsed;
      }
      animationFrameRef.current = requestAnimationFrame(updateDuration);
    };

    animationFrameRef.current = requestAnimationFrame(updateDuration);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isRecording]);

  // Initialize audio recording
  const startRecording = useCallback(async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamsRef.current.push(stream);

      // Determine supported MIME type
      let mimeType = 'audio/webm;codecs=opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/webm';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = 'audio/mp4';
          if (!MediaRecorder.isTypeSupported(mimeType)) {
            mimeType = ''; // Use default
          }
        }
      }

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: mimeType || undefined
      });

      chunksRef.current = [];

      mediaRecorder.onstart = () => {
        durationRef.current = 0;
        startTimeRef.current = Date.now();
        setDuration(0);
        setIsRecording(true);
      };

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onerror = (e) => {
        setError(`Recording error: ${e.error}`);
        setIsRecording(false);
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
    } catch (err) {
      setError(`Failed to access microphone: ${err.message}`);
      setIsRecording(false);
    }
  }, []);

  // Stop recording and return blob
  const stopRecording = useCallback(async () => {
    return new Promise((resolve, reject) => {
      if (!mediaRecorderRef.current) {
        reject(new Error('No recording in progress'));
        return;
      }

      const mediaRecorder = mediaRecorderRef.current;

      mediaRecorder.onstop = () => {
        setIsRecording(false);
        startTimeRef.current = null;
        durationRef.current = 0;

        // Stop all audio tracks
        streamsRef.current.forEach(stream => {
          stream.getTracks().forEach(track => track.stop());
        });
        streamsRef.current = [];

        // Create blob with proper mime type
        const mimeType = mediaRecorder.mimeType || 'audio/webm';
        const audioBlob = new Blob(chunksRef.current, { type: mimeType });
        
        // Determine file extension based on mime type
        let ext = 'webm';
        if (mimeType.includes('mp4')) ext = 'm4a';
        else if (mimeType.includes('ogg')) ext = 'ogg';
        else if (mimeType.includes('wav')) ext = 'wav';
        
        // Create a File object from the blob
        const audioFile = new File(
          [audioBlob],
          `voice_${Date.now()}.${ext}`,
          { type: mimeType }
        );

        resolve(audioFile);
      };

      mediaRecorder.stop();
    });
  }, []);

  // Cancel recording
  const cancelRecording = useCallback(() => {
    if (mediaRecorderRef.current) {
      try {
        mediaRecorderRef.current.stop();
      } catch (err) {
        console.warn('Cancel recording error:', err);
      }

      setIsRecording(false);
      startTimeRef.current = null;
      durationRef.current = 0;
      setDuration(0);

      streamsRef.current.forEach(stream => {
        stream.getTracks().forEach(track => track.stop());
      });
      streamsRef.current = [];
      chunksRef.current = [];
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && isRecording) {
        cancelRecording();
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // Format duration to MM:SS
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
