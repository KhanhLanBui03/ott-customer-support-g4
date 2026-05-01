import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { Audio } from 'expo-av';
import { MaterialIcons } from '@expo/vector-icons';

const VoicePlayer = ({ url, isOwn }) => {
  const [sound, setSound] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, [sound]);

  const onPlaybackStatusUpdate = (status) => {
    if (status.isLoaded) {
      setPosition(status.positionMillis);
      setDuration(status.durationMillis);
      setIsPlaying(status.isPlaying);
      if (status.didJustFinish) {
        setIsPlaying(false);
        setPosition(0);
        // Note: we don't call sound.setPositionAsync(0) here to avoid null ref errors.
        // It will be reset on the next play call.
      }
    }
  };

  const playPauseSound = async () => {
    try {
      // Đảm bảo Audio Mode được thiết lập đúng cho iOS
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        staysActiveInBackground: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });

      if (sound === null) {
        setIsLoading(true);
        console.log('Loading sound from:', url);
        
        const newSound = new Audio.Sound();
        setSound(newSound);

        newSound.setOnPlaybackStatusUpdate(onPlaybackStatusUpdate);

        await newSound.loadAsync(
          { uri: url },
          { shouldPlay: true },
          true // useNativeControls
        );
        
        setIsLoading(false);
      } else {
        const status = await sound.getStatusAsync();
        if (!status.isLoaded) {
          // If sound exists but is not loaded, reset and try reloading
          setSound(null);
          return playPauseSound();
        }

        if (isPlaying) {
          await sound.pauseAsync();
        } else {
          if (position >= duration) {
            await sound.setPositionAsync(0);
          }
          await sound.playAsync();
        }
      }
    } catch (error) {
      console.error('Error playing sound detailed:', error);
      setIsLoading(false);
      
      // Nếu lỗi là do định dạng webm trên iOS, không hiện Alert làm phiền mà cập nhật state error
      if (Platform.OS === 'ios' && url.includes('.webm')) {
        setError('Định dạng WebM không hỗ trợ trên iOS');
      } else {
        setError('Không thể phát âm thanh này');
      }
    }
  };

  const [error, setError] = useState(null);

  const formatTime = (millis) => {
    const totalSeconds = millis / 1000;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  const progress = duration > 0 ? (position / duration) * 100 : 0;

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
              {formatTime(position)} / {formatTime(duration || 0)}
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
    padding: 8,
    borderRadius: 16,
    minWidth: 220,
  },
  ownContainer: {
    alignSelf: 'flex-end',
  },
  otherContainer: {
    alignSelf: 'flex-start',
  },
  playButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  otherPlayButton: {
    backgroundColor: 'rgba(102, 126, 234, 0.1)',
  },
  ownPlayButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  progressSection: {
    flex: 1,
    marginLeft: 12,
  },
  track: {
    height: 4,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 4,
  },
  progress: {
    height: '100%',
    borderRadius: 2,
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
    fontWeight: '600',
  },
  ownTimeText: {
    color: 'rgba(255,255,255,0.8)',
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
