import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { useAudioPlayer, useAudioPlayerStatus, setAudioModeAsync } from 'expo-audio';
import { MaterialIcons } from '@expo/vector-icons';

const VoicePlayer = ({ url, isOwn }) => {
  const player = useAudioPlayer(url ? { uri: url } : null, { updateInterval: 200 });
  const status = useAudioPlayerStatus(player);
  const [hasRequestedPlay, setHasRequestedPlay] = useState(false);
  const [error, setError] = useState(null);

  const isPlaying = Boolean(status?.playing);
  const duration = Number.isFinite(status?.duration) ? status.duration : 0;
  const position = Number.isFinite(status?.currentTime) ? status.currentTime : 0;
  const isLoading = hasRequestedPlay && !error && (!status?.isLoaded || Boolean(status?.isBuffering));

  useEffect(() => {
    setError(null);
    setHasRequestedPlay(false);
  }, [url]);

  useEffect(() => {
    if (status?.isLoaded || status?.error) {
      setHasRequestedPlay(false);
    }
    if (status?.error) {
      let errorMsg = 'Không thể phát âm thanh này';
      if (Platform.OS === 'ios' && url?.toLowerCase().endsWith('.webm')) {
        errorMsg = 'Định dạng WebM không hỗ trợ trên iOS';
      } else if (status.error.includes('code -11828')) {
        errorMsg = 'Định dạng tệp không được hỗ trợ';
      } else if (status.error.includes('code -1003')) {
        errorMsg = 'Lỗi kết nối máy chủ';
      }
      setError(errorMsg);
    }
  }, [status?.isLoaded, status?.error, url]);

  const playPauseSound = async () => {
    try {
      setError(null);
      await setAudioModeAsync({
        allowsRecording: false,
        shouldPlayInBackground: true,
        playsInSilentMode: true,
        interruptionMode: 'duckOthers',
        shouldRouteThroughEarpiece: false,
      });

      if (isPlaying) {
        player.pause();
        return;
      }

      if (!status?.isLoaded) {
        setHasRequestedPlay(true);
      }

      if (status?.didJustFinish || (duration > 0 && position >= duration)) {
        await player.seekTo(0);
      }
      player.play();
    } catch (err) {
      console.error('Error playing sound detailed:', err);
      setHasRequestedPlay(false);

      let errorMsg = 'Không thể phát âm thanh này';
      if (Platform.OS === 'ios' && url?.toLowerCase().endsWith('.webm')) {
        errorMsg = 'Định dạng WebM không hỗ trợ trên iOS';
      } else if (err?.message) {
        if (err.message.includes('code -11828')) {
          errorMsg = 'Định dạng tệp không được hỗ trợ';
        } else if (err.message.includes('code -1003')) {
          errorMsg = 'Lỗi kết nối máy chủ';
        }
      }
      setError(errorMsg);
    }
  };

  const formatTime = (seconds) => {
    const safeSeconds = Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
    const minutes = Math.floor(safeSeconds / 60);
    const secs = Math.floor(safeSeconds % 60);
    return `${minutes}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const displayPosition = status?.didJustFinish ? 0 : position;
  const progress = duration > 0 ? Math.min(100, (displayPosition / duration) * 100) : 0;

  return (
    <View style={[styles.container, isOwn ? styles.ownContainer : styles.otherContainer]}>
      <TouchableOpacity 
        onPress={playPauseSound} 
        style={[styles.playButton, isOwn ? styles.ownPlayButton : styles.otherPlayButton]}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color={isOwn ? "#fff" : "#667eea"} />
        ) : (
          <MaterialIcons 
            name={isPlaying ? "pause" : "play-arrow"} 
            size={24} 
            color={isOwn ? "#fff" : "#667eea"} 
          />
        )}
      </TouchableOpacity>

      <View style={styles.progressSection}>
        <View style={styles.track}>
          <View style={[styles.progress, { width: `${progress}%` }, isOwn ? styles.ownProgress : styles.otherProgress]} />
        </View>
        <View style={styles.timeRow}>
          {error ? (
            <Text style={styles.errorText}>{error}</Text>
          ) : (
            <Text style={[styles.timeText, isOwn ? styles.ownTimeText : styles.otherTimeText]}>
              {formatTime(displayPosition)} / {formatTime(duration || 0)}
            </Text>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 0,
    minWidth: 180,
  },
  ownContainer: {
    alignSelf: 'flex-end',
  },
  otherContainer: {
    alignSelf: 'flex-start',
  },
  playButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  otherPlayButton: {
    backgroundColor: 'rgba(102, 126, 234, 0.12)',
  },
  ownPlayButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  progressSection: {
    flex: 1,
    marginLeft: 12,
  },
  track: {
    height: 3,
    backgroundColor: 'rgba(0, 0, 0, 0.08)',
    borderRadius: 1.5,
    overflow: 'hidden',
    marginBottom: 4,
  },
  progress: {
    height: '100%',
    borderRadius: 1.5,
  },
  ownProgress: {
    backgroundColor: '#fff',
  },
  otherProgress: {
    backgroundColor: '#667eea',
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  timeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  ownTimeText: {
    color: 'rgba(255, 255, 255, 0.85)',
  },
  otherTimeText: {
    color: '#64748b',
  },
  errorText: {
    color: '#ff4d4f',
    fontSize: 10,
    fontWeight: 'bold',
  },
});

export default VoicePlayer;
