import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  Pressable,
  Dimensions,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { useSelector } from 'react-redux';
import { getRealId } from '../../../src/store/chatSlice';
import CONFIG from '../../../src/config';
import MediaViewer from '../../../src/components/MediaViewer';
import VideoThumbnail from '../../../src/components/VideoThumbnail';
import { useState } from 'react';

const { width } = Dimensions.get('window');
const COLUMN_COUNT = 3;
const SPACING = 1; // Giảm spacing để khít hơn
const ITEM_SIZE = width / COLUMN_COUNT; // Tận dụng toàn bộ chiều ngang

const SharedMediaScreen = () => {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id: encodedId } = useLocalSearchParams();
  const conversationId = decodeURIComponent(encodedId || '');
  
  const chatState = useSelector((state) => state.chat);
  const currentUser = useSelector((state) => state.auth.user);
  const BASE_URL = CONFIG.API_URL.split('/api')[0];
  
  const [viewerVisible, setViewerVisible] = useState(false);
  const [selectedMediaIndex, setSelectedMediaIndex] = useState(0);
  const [currentMediaList, setCurrentMediaList] = useState([]);

  const realId = useMemo(() => {
    return getRealId(chatState, conversationId, currentUser?.userId || currentUser?.id);
  }, [chatState, conversationId, currentUser]);

  const messages = chatState.messages[realId] || [];

  const mediaData = useMemo(() => {
    const images = [];
    const videos = [];

    messages.forEach((msg) => {
      if (msg.isRecalled) return;
      
      if (msg.type === 'IMAGE' && msg.mediaUrls) {
        msg.mediaUrls.forEach((url) => {
          images.push({ url, messageId: msg.messageId });
        });
      } else if (msg.type === 'VIDEO' && msg.mediaUrls) {
        msg.mediaUrls.forEach((url) => {
          videos.push({ url, messageId: msg.messageId });
        });
      }
    });

    return { images, videos };
  }, [messages]);

  const renderMediaGrid = (data, type) => {
    if (data.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Chưa có {type === 'IMAGE' ? 'ảnh' : 'video'} nào</Text>
        </View>
      );
    }

    return (
      <View style={styles.grid}>
        {data.map((item, index) => {
          const fullUrl = item.url.startsWith('http') ? item.url : `${BASE_URL}${item.url.startsWith('/') ? '' : '/'}${item.url}`;
          return (
            <Pressable 
              key={`${item.messageId}-${index}`} 
              style={styles.mediaItem}
              onPress={() => {
                const formattedList = data.map(m => ({
                  url: m.url.startsWith('http') ? m.url : `${BASE_URL}${m.url.startsWith('/') ? '' : '/'}${m.url}`,
                  type
                }));
                setCurrentMediaList(formattedList);
                setSelectedMediaIndex(index);
                setViewerVisible(true);
              }}
            >
              {type === 'VIDEO' ? (
                <VideoThumbnail videoUrl={fullUrl} style={styles.mediaImage} />
              ) : (
                <Image source={{ uri: fullUrl }} style={styles.mediaImage} />
              )}
            </Pressable>
          );
        })}
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable 
          onPress={() => router.replace(`/chat-info/${encodeURIComponent(conversationId)}`)} 
          style={styles.backButton}
        >
          <MaterialIcons name="arrow-back" size={24} color="#fff" />
        </Pressable>
        <Text style={styles.headerTitle}>Ảnh/Video đã chia sẻ</Text>
        <View style={{ width: 48 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Section: Photos */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="photo-library" size={20} color="#667eea" />
            <Text style={styles.sectionTitle}>ẢNH ({mediaData.images.length})</Text>
          </View>
          {renderMediaGrid(mediaData.images, 'IMAGE')}
        </View>

        {/* Section: Videos */}
        <View style={[styles.section, { marginTop: 24 }]}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="video-library" size={20} color="#10b981" />
            <Text style={styles.sectionTitle}>VIDEO ({mediaData.videos.length})</Text>
          </View>
          {renderMediaGrid(mediaData.videos, 'VIDEO')}
        </View>

        <View style={{ height: insets.bottom + 20 }} />
      </ScrollView>

      <MediaViewer 
        visible={viewerVisible}
        onClose={() => setViewerVisible(false)}
        allMedia={currentMediaList}
        initialIndex={selectedMediaIndex}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
  backButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  content: { flex: 1 },
  section: { paddingHorizontal: 0, paddingTop: 16 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, paddingHorizontal: 16 },
  sectionTitle: { fontSize: 13, fontWeight: '800', color: '#94a3b8', marginLeft: 8, letterSpacing: 1 },
  grid: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
  },
  mediaItem: {
    width: ITEM_SIZE,
    height: ITEM_SIZE,
    borderWidth: 0.5,
    borderColor: '#0f172a', // Màu trùng với background để tạo khoảng cách ảo
    overflow: 'hidden',
    backgroundColor: '#1e293b',
  },
  mediaImage: { width: '100%', height: '100%' },
  videoOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: { padding: 20, alignItems: 'center' },
  emptyText: { color: '#4b5563', fontSize: 14, fontStyle: 'italic' },
});

export default SharedMediaScreen;
