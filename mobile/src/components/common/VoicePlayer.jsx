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
      
      let errorMsg = 'Không thể phát âm thanh này';
      if (Platform.OS === 'ios' && url.toLowerCase().endsWith('.webm')) {
        errorMsg = 'Định dạng WebM không hỗ trợ trên iOS';
      } else if (error.message) {
        if (error.message.includes('code -11828')) {
          errorMsg = 'Định dạng tệp không được hỗ trợ';
        } else if (error.message.includes('code -1003')) {
          errorMsg = 'Lỗi kết nối máy chủ';
        }
      }
      setError(errorMsg);
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
