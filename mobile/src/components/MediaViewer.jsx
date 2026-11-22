import React, { useRef, useEffect } from 'react';
import { 
  Modal, 
  View, 
  TouchableOpacity, 
  Image, 
  StyleSheet, 
  useWindowDimensions,
  FlatList
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { VideoView, useVideoPlayer } from 'expo-video';

const MediaVideoSlide = ({ uri, isActive }) => {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
  });

  useEffect(() => {
    if (isActive) {
      player.play();
    } else {
      player.pause();
    }
  }, [isActive, player]);

  return (
    <VideoView
      style={styles.mediaVideo}
      player={player}
      contentFit="contain"
      nativeControls
    />
  );
};

const MediaViewer = ({ visible, onClose, allMedia = [], initialIndex = 0 }) => {
  const { width, height } = useWindowDimensions();
  const flatListRef = useRef(null);
  const [activeIndex, setActiveIndex] = React.useState(initialIndex);
  const activeIndexRef = useRef(initialIndex);

  useEffect(() => {
    activeIndexRef.current = activeIndex;
  }, [activeIndex]);

  useEffect(() => {
    if (visible) {
      setActiveIndex(initialIndex);
      activeIndexRef.current = initialIndex;
      if (flatListRef.current && allMedia.length > 0) {
        const safeIndex = Math.min(Math.max(0, initialIndex), allMedia.length - 1);
        setTimeout(() => {
          flatListRef.current?.scrollToIndex({ index: safeIndex, animated: false });
        }, 50);
      }
    }
  }, [visible, initialIndex, allMedia.length]);

  // Giữ nguyên slide đang xem (không nhảy ngược về initialIndex) khi xoay ngang/dọc
  useEffect(() => {
    if (visible && flatListRef.current && allMedia.length > 0) {
      const safeIndex = Math.min(Math.max(0, activeIndexRef.current), allMedia.length - 1);
      setTimeout(() => {
        flatListRef.current?.scrollToIndex({ index: safeIndex, animated: false });
      }, 60);
    }
  }, [width]);

  const handleScroll = (event) => {
    const slideSize = event.nativeEvent.layoutMeasurement.width;
    if (slideSize > 0) {
      const index = Math.round(event.nativeEvent.contentOffset.x / slideSize);
      if (index >= 0 && index < allMedia.length) {
        setActiveIndex(index);
      }
    }
  };

  const renderItem = ({ item, index }) => {
    const isVideo = item.type === 'VIDEO';
    const isCurrent = index === activeIndex;
    return (
      <View style={[styles.slide, { width, height }]}>
        {isVideo ? (
          <MediaVideoSlide uri={item.url} isActive={visible && isCurrent} />
        ) : (
          <Image 
            source={{ uri: item.url }} 
            style={styles.mediaImage} 
            resizeMode="contain" 
          />
        )}
      </View>
    );
  };

  return (
    <Modal 
      visible={visible} 
      transparent 
      animationType="fade" 
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Ionicons name="close" size={30} color="#fff" />
        </TouchableOpacity>
        
        <FlatList
          ref={flatListRef}
          data={allMedia}
          renderItem={renderItem}
          keyExtractor={(item, index) => `${item.url}-${index}`}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          getItemLayout={(data, index) => ({
            length: width,
            offset: width * index,
            index,
          })}
          onScrollToIndexFailed={() => {}}
          onMomentumScrollEnd={handleScroll}
        />
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: '#000',
  },
  closeButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  slide: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  mediaImage: {
    width: '100%',
    height: '100%',
  },
  mediaVideo: {
    width: '100%',
    height: '100%',
  },
});

export default MediaViewer;
