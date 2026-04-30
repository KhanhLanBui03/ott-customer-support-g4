import React, { useState, useEffect } from 'react';
import { View, Image, StyleSheet, ActivityIndicator } from 'react-native';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { Ionicons } from '@expo/vector-icons';

const VideoThumbnail = ({ videoUrl, style }) => {
  const [thumbnail, setThumbnail] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const generateThumbnail = async () => {
      try {
        const { uri } = await VideoThumbnails.getThumbnailAsync(videoUrl, {
          time: 1000, // Lấy frame ở giây thứ 1
        });
        setThumbnail(uri);
      } catch (e) {
        console.warn('[VideoThumbnail] Error generating thumbnail:', e);
      } finally {
        setLoading(false);
      }
    };

    generateThumbnail();
  }, [videoUrl]);

  return (
    <View style={[styles.container, style]}>
      {loading ? (
        <View style={styles.placeholder}>
          <ActivityIndicator size="small" color="#667eea" />
        </View>
      ) : thumbnail ? (
        <Image source={{ uri: thumbnail }} style={styles.image} resizeMode="cover" />
      ) : (
        <View style={styles.placeholder}>
          <Ionicons name="videocam" size={24} color="#94a3b8" />
        </View>
      )}
      <View style={styles.overlay}>
        <View style={styles.playButton}>
          <Ionicons name="play" size={20} color="#fff" />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1e293b',
    overflow: 'hidden',
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1e293b',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
});

export default VideoThumbnail;
