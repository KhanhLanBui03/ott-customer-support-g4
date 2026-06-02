import React, { useRef, useEffect } from 'react';
import { 
  Modal, 
  View, 
  TouchableOpacity, 
  Image, 
  StyleSheet, 
  Dimensions,
  FlatList
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Video } from 'expo-av';

const { width, height } = Dimensions.get('window');

const MediaViewer = ({ visible, onClose, allMedia = [], initialIndex = 0 }) => {
  const flatListRef = useRef(null);
  const [activeIndex, setActiveIndex] = React.useState(initialIndex);

  useEffect(() => {
    if (visible) {
      setActiveIndex(initialIndex);
      if (flatListRef.current) {
        // Nhảy tới đúng ảnh đã chọn khi mở modal
        setTimeout(() => {
          flatListRef.current.scrollToIndex({ index: initialIndex, animated: false });
        }, 50);
      }
    }
  }, [visible, initialIndex]);

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
      <View style={styles.slide}>
        {isVideo ? (
          <Video
            source={{ uri: item.url }}
            rate={1.0}
            volume={1.0}
            isMuted={false}
            resizeMode="contain"
            shouldPlay={visible && isCurrent} // Chỉ phát khi modal mở và là slide hiện tại
            useNativeControls
            style={styles.mediaVideo}
          />
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
    width: width,
    height: height,
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
