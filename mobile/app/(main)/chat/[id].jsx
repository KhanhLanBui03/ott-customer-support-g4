import React, { useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  Image,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useDispatch, useSelector } from 'react-redux';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../../src/utils/theme';
import CONFIG from '../../../src/config';
import MessageList from '../../../src/components/MessageList';
import MessageInput from '../../../src/components/MessageInput';
import { fetchMessages, sendMessage } from '../../../src/store/chatSlice';

/**
 * Premium ChatDetailScreen
 * Fully themed chat screen with specialized AI Assistant headers.
 */

const ChatDetailScreen = () => {
  const dispatch = useDispatch();
  const router = useRouter();
  const { id: conversationId } = useLocalSearchParams();

  const themeMode = useSelector((state) => state.auth.theme || 'light');
  const theme = COLORS[themeMode];

  const messages = useSelector((state) => state.chat.messages[conversationId] || []);
  const isLoading = useSelector((state) => state.chat.loading);
  const conversations = useSelector((state) => state.chat.conversations);
  const currentUser = useSelector((state) => state.auth.user);

  const conversation = conversations?.find((c) => (c.conversationId || c.id) === conversationId);
  
  const isAI = conversationId.includes(CONFIG.AI_BOT_ID) || 
               conversation?.participants?.some(p => p.userId === CONFIG.AI_BOT_ID);

  useEffect(() => {
    if (conversationId) {
      dispatch(fetchMessages({ conversationId }));
    }
  }, [conversationId, dispatch]);

  const handleSendMessage = (content) => {
    if (!content.trim() || !conversationId) return;
    dispatch(
      sendMessage({
        conversationId,
        content,
        senderId: currentUser.userId,
        senderName: `${currentUser.firstName} ${currentUser.lastName}`,
        type: 'TEXT',
      })
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={themeMode === 'dark' ? 'light-content' : 'dark-content'} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: theme.border, backgroundColor: theme.background }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <MaterialCommunityIcons name="chevron-left" size={32} color={theme.text} />
          </TouchableOpacity>
          
          <View style={styles.headerContent}>
            <View style={styles.avatarContainer}>
              <Image
                source={{ uri: conversation?.avatarUrl || 'https://via.placeholder.com/100' }}
                style={[styles.headerAvatar, { backgroundColor: theme.surfaceSecondary }]}
              />
              {isAI && (
                <View style={styles.aiBadge}>
                  <Text style={{ fontSize: 8 }}>✨</Text>
                </View>
              )}
            </View>
            
            <View style={styles.headerInfo}>
              <Text style={[styles.headerTitle, { color: theme.text }]} numberOfLines={1}>
                {isAI ? CONFIG.AI_BOT_NAME : conversation?.name || 'Chat'}
              </Text>
              <Text style={[styles.headerStatus, { color: COLORS.success }]}>
                {isAI ? 'Trực tuyến • Phản hồi thức thì' : 'Đang hoạt động'}
              </Text>
            </View>
          </View>

          <TouchableOpacity style={styles.headerActionButton}>
            <MaterialCommunityIcons name="information-outline" size={24} color={theme.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Content */}
        <View style={styles.content}>
          <MessageList
            messages={messages}
            currentUserId={currentUser?.userId}
            isLoading={isLoading && messages.length === 0}
          />
        </View>

        {/* Input */}
        <MessageInput
          onSendMessage={handleSendMessage}
          isLoading={isLoading && messages.length > 0}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    gap: SPACING.xs,
  },
  backButton: {
    padding: 4,
  },
  headerContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  avatarContainer: {
    position: 'relative',
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  aiBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#fff',
    width: 14,
    height: 14,
    borderRadius: 7,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.accent,
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  headerStatus: {
    fontSize: 11,
    fontWeight: '500',
  },
  headerActionButton: {
    padding: 8,
  },
  content: {
    flex: 1,
  },
});

export default ChatDetailScreen;
