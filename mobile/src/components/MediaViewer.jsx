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

  useEffect(() => {
    if (visible && flatListRef.current) {
      // Nhảy tới đúng ảnh đã chọn khi mở modal
      setTimeout(() => {
        flatListRef.current.scrollToIndex({ index: initialIndex, animated: false });
      }, 50);
    }
  }, [visible, initialIndex]);

  const renderItem = ({ item }) => {
    const isVideo = item.type === 'VIDEO';
    return (
      <View style={styles.slide}>
        {isVideo ? (
          <Video
            source={{ uri: item.url }}
            rate={1.0}
            volume={1.0}
            isMuted={false}
            resizeMode="contain"
            shouldPlay={visible} // Chỉ phát khi modal mở
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
