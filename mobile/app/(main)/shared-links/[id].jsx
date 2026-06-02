import React, { useMemo } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity, 
  Pressable,
  Linking
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSelector } from 'react-redux';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getRealId } from '../../../src/store/chatSlice';

const SharedLinksScreen = () => {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  const messagesFromStore = useSelector((state) => state.chat.messages);
  const realId = useMemo(() => {
    if (!id) return null;
    const decodedId = decodeURIComponent(id);
    if (messagesFromStore[decodedId]) return decodedId;
    const rId = getRealId(decodedId);
    if (messagesFromStore[rId]) return rId;
    return rId;
  }, [id, messagesFromStore]);
  
  const messages = messagesFromStore[realId] || [];

  const sharedLinks = useMemo(() => {
    const links = [];
    messages.forEach(msg => {
      if (msg.isRecalled) return;
      if (msg.type !== 'TEXT') return;
      const content = msg.content || msg.messageText || '';
      if (content) {
        const urls = content.match(/https?:\/\/[^\s]+/gi);
        if (urls) {
          urls.forEach(url => {
            const lowerUrl = url.toLowerCase();
            if (
              lowerUrl.includes('/chat-media/') ||
              lowerUrl.includes('/uploads/') ||
              lowerUrl.includes('/voice-messages/') ||
              lowerUrl.includes('/chat-wallpaper/') ||
              lowerUrl.includes('/avatars/') ||
              lowerUrl.includes('amazonaws.com') ||
              lowerUrl.includes('s3.') ||
              lowerUrl.includes('dicebear.com')
            ) {
              return;
            }
            links.push({
              id: `${msg.messageId}-${url}`,
              url,
              text: content,
              senderName: msg.senderName,
              createdAt: msg.createdAt,
              messageId: msg.messageId
            });
          });
        }
      }
    });
    return links.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [messages]);

  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
  };

  const renderLinkItem = ({ item }) => {
    return (
      <TouchableOpacity 
        style={styles.linkItem}
        onPress={() => {
          Linking.openURL(item.url).catch(err => console.error("Failed to open URL", err));
        }}
      >
        <View style={styles.iconContainer}>
          <Ionicons name="link-outline" size={24} color="#6366f1" />
        </View>
        <View style={styles.linkInfo}>
          <Text style={styles.linkUrl} numberOfLines={1}>
            {item.url}
          </Text>
          {item.text !== item.url && (
            <Text style={styles.linkText} numberOfLines={1}>
              {item.text}
            </Text>
          )}
          <Text style={styles.linkMeta}>
            {item.senderName} • {formatDate(item.createdAt)}
          </Text>
        </View>
        <MaterialIcons name="chevron-right" size={24} color="#94a3b8" />
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable 
          onPress={() => router.replace(`/chat-info/${encodeURIComponent(id)}`)} 
          style={styles.backButton}
        >
          <MaterialIcons name="arrow-back" size={24} color="#fff" />
        </Pressable>
        <Text style={styles.headerTitle}>Đường dẫn đã chia sẻ</Text>
        <View style={{ width: 48 }} />
      </View>

      {sharedLinks.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="link-outline" size={80} color="#334155" />
          <Text style={styles.emptyText}>Chưa có đường dẫn nào được chia sẻ</Text>
        </View>
      ) : (
        <FlatList
          data={sharedLinks}
          renderItem={renderLinkItem}
          keyExtractor={(item, index) => item?.id ? `${item.id}_${index}` : `link_${index}`}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  listContent: {
    padding: 16,
  },
  linkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkInfo: {
    flex: 1,
    marginLeft: 16,
    marginRight: 8,
  },
  linkUrl: {
    fontSize: 15,
    fontWeight: '700',
    color: '#6366f1',
    marginBottom: 2,
  },
  linkText: {
    fontSize: 13,
    color: '#fff',
    marginBottom: 4,
  },
  linkMeta: {
    fontSize: 11,
    color: '#94a3b8',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 100,
  },
  emptyText: {
    color: '#94a3b8',
    fontSize: 16,
    marginTop: 16,
    fontWeight: '500',
  },
});

export default SharedLinksScreen;
