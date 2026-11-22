import React, { useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View,
  FlatList,
  Text,
  ActivityIndicator,
  StyleSheet,
  Platform,
  Animated,
} from 'react-native';
import ChatBubble from './ChatBubble';
import { formatMessageDateSeparator } from '../utils/dateUtils';
import { useTheme } from '../context/ThemeContext';
import { useTranslation } from 'react-i18next';

const SKELETON_ROWS = [
  { id: 's1', own: false, width: '62%', height: 42 },
  { id: 's2', own: true, width: '48%', height: 38 },
  { id: 's3', own: false, width: '74%', height: 56 },
  { id: 's4', own: true, width: '58%', height: 44 },
  { id: 's5', own: false, width: '44%', height: 36 },
  { id: 's6', own: true, width: '68%', height: 50 },
];

const ChatSkeleton = ({ isDark, colors }) => {
  const pulse = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.9, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.45, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <View style={[styles.skeletonContainer, { backgroundColor: colors.background }]}>
      {SKELETON_ROWS.map((row) => (
        <View
          key={row.id}
          style={[
            styles.skeletonRow,
            row.own ? styles.skeletonRowOwn : styles.skeletonRowOther,
          ]}
        >
          {!row.own && (
            <Animated.View
              style={[
                styles.skeletonAvatar,
                {
                  opacity: pulse,
                  backgroundColor: isDark ? colors.surface300 : '#e2e8f0',
                },
              ]}
            />
          )}
          <Animated.View
            style={[
              styles.skeletonBubble,
              {
                width: row.width,
                height: row.height,
                opacity: pulse,
                backgroundColor: row.own
                  ? isDark
                    ? 'rgba(99, 102, 241, 0.35)'
                    : 'rgba(99, 102, 241, 0.2)'
                  : isDark
                    ? colors.surface200
                    : '#e2e8f0',
              },
            ]}
          />
        </View>
      ))}
    </View>
  );
};

const MessageList = React.forwardRef(({
  messages = [],
  conversationId,
  currentUserId,
  typingUsers = [],
  onlineUsers = [],
  members = [],
  isLoading = false,
  hasMoreProp = true,
  onLoadMore,
  onReact,
  onLongPress,
  onPressMessage,
  onPressReply,
  sendReadReceipt,
  highlightedMessageId = null,
  isBlockedByOther = false,
  translatedMessages = {},
  translationLoading = {},
  onTranslate,
}, ref) => {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const [isLoadingMoreMessages, setIsLoadingMoreMessages] = React.useState(false);
  const [hasMore, setHasMore] = React.useState(hasMoreProp);
  const readMessageIds = useRef(new Set());
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const lastConversationRef = useRef(null);
  const prevLatestMessageIdRef = useRef(null);
  const isAtBottom = useRef(true);
  const isLoadingMoreRef = useRef(false);

  useEffect(() => {
    setHasMore(hasMoreProp);
  }, [hasMoreProp, conversationId]);

  useEffect(() => {
    if (lastConversationRef.current !== conversationId) {
      lastConversationRef.current = conversationId;
      prevLatestMessageIdRef.current = null;
      isAtBottom.current = true;
      isLoadingMoreRef.current = false;
      setIsLoadingMoreMessages(false);
      readMessageIds.current.clear();
      fadeAnim.setValue(0);
    }
  }, [conversationId, fadeAnim]);

  useEffect(() => {
    if (!isLoading || messages.length > 0) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }).start();
    }
  }, [isLoading, messages.length, fadeAnim]);

  // Đảo ngược danh sách tin nhắn để dùng với inverted FlatList
  // Tin nhắn mới nhất sẽ ở index 0 (đáy màn hình)
  const reversedMessages = useMemo(() => [...messages].reverse(), [messages]);

  // Ánh xạ nhanh messageId -> originalIndex để tránh findIndex O(n^2) khi render danh sách dài
  const originalIndexById = useMemo(() => {
    const map = new Map();
    messages.forEach((m, idx) => {
      if (m?.messageId) map.set(m.messageId, idx);
    });
    return map;
  }, [messages]);

  const normalizeReaderId = (reader) => {
    if (!reader) return '';
    if (typeof reader === 'object') return String(reader.userId || reader.id || '');
    return String(reader);
  };

  const isLatestReadBy = (message, readerId) => {
    const originalIndex = originalIndexById.get(message.messageId) ?? -1;
    if (originalIndex === -1) return false;

    for (let i = originalIndex + 1; i < messages.length; i++) {
      const nextMessage = messages[i];
      if (Array.isArray(nextMessage.readBy) && nextMessage.readBy.some((reader) => normalizeReaderId(reader) === readerId)) {
        return false;
      }
    }
    return true;
  };

  const getLatestReadBy = (message) => {
    if (!Array.isArray(message.readBy) || message.readBy.length === 0) return [];
    const uniqueIds = new Set();
    return message.readBy.reduce((latest, reader) => {
      const readerId = normalizeReaderId(reader);
      if (!readerId || uniqueIds.has(readerId)) return latest;
      if (isLatestReadBy(message, readerId)) {
        uniqueIds.add(readerId);
        latest.push(reader);
      }
      return latest;
    }, []);
  };

  const handleScroll = useCallback((event) => {
    const { contentOffset } = event.nativeEvent;
    isAtBottom.current = contentOffset.y <= 60;
  }, []);

  const propsRef = useRef({ conversationId, sendReadReceipt, currentUserId });
  useEffect(() => {
    propsRef.current = { conversationId, sendReadReceipt, currentUserId };
  }, [conversationId, sendReadReceipt, currentUserId]);

  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    viewableItems.forEach(({ item }) => {
      const { conversationId: cId, sendReadReceipt: sRR, currentUserId: uId } = propsRef.current;

      if (!item || !cId || !sRR) return;

      const messageId = item.messageId || item.id;
      if (!messageId || String(messageId).startsWith('temp-')) return;

      const senderId = String(item.senderId || '');
      const selfId = String(uId || '');

      if (senderId === selfId) return;

      const hasRead = Array.isArray(item.readBy) &&
        item.readBy.some((reader) => normalizeReaderId(reader) === selfId);

      if (!hasRead) {
        sRR(messageId, cId);
      }
    });
  }).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

  // CHỈ cuộn mượt về đáy khi có tin nhắn MỚI THẬT SỰ được thêm ở cuối (không nhảy khi load trang đầu hay load tin cũ)
  useEffect(() => {
    if (messages.length === 0 || highlightedMessageId) return;
    const latestMessage = messages[messages.length - 1];
    const latestId = latestMessage?.messageId || latestMessage?.id;

    if (!prevLatestMessageIdRef.current) {
      prevLatestMessageIdRef.current = latestId;
      return;
    }

    if (latestId && latestId !== prevLatestMessageIdRef.current) {
      prevLatestMessageIdRef.current = latestId;
      const isMyMessage = String(latestMessage?.senderId) === String(currentUserId);
      if (isAtBottom.current || isMyMessage) {
        requestAnimationFrame(() => {
          ref?.current?.scrollToOffset({ offset: 0, animated: true });
        });
      }
    }
  }, [messages, currentUserId, highlightedMessageId, ref]);

  const handleLoadOlder = useCallback(() => {
    if (isLoadingMoreRef.current || !onLoadMore || messages.length === 0 || !hasMore) return;
    isLoadingMoreRef.current = true;
    setIsLoadingMoreMessages(true);
    Promise.resolve(onLoadMore())
      .then((moreExist) => {
        if (moreExist === false) {
          setHasMore(false);
        }
      })
      .finally(() => {
        isLoadingMoreRef.current = false;
        setIsLoadingMoreMessages(false);
      });
  }, [onLoadMore, messages.length, hasMore]);

  const renderMessage = ({ item, index }) => {
    const otherOnline = !isBlockedByOther && onlineUsers.some(id => String(id) !== String(currentUserId || ''));
    const latestReadBy = getLatestReadBy(item);
    const originalIndex = originalIndexById.get(item.messageId) ?? -1;

    if (item.type === 'CALL_LOG' && originalIndex !== -1) {
      try {
        const callData = typeof item.content === 'string' ? JSON.parse(item.content) : (item.content || {});
        if (callData.status === 'ONGOING') {
          const hasNewerCallLog = messages.slice(originalIndex + 1).some(m => m.type === 'CALL_LOG');
          if (hasNewerCallLog) return null;
        }
      } catch (e) {}
    }

    let hasNewerOtherRead = false;
    if (originalIndex !== -1 && !latestReadBy.length) {
      for (let i = originalIndex + 1; i < messages.length; i++) {
        const nextMessage = messages[i];
        if (Array.isArray(nextMessage.readBy) && nextMessage.readBy.some((reader) => normalizeReaderId(reader) !== String(currentUserId || ''))) {
          hasNewerOtherRead = true;
          break;
        }
      }
    }
    const shouldShowStatus = !latestReadBy.length && !hasNewerOtherRead;

    const currentMsgDate = item.createdAt ? new Date(item.createdAt).toDateString() : null;
    const olderMsgDate = index < reversedMessages.length - 1 && reversedMessages[index + 1].createdAt
      ? new Date(reversedMessages[index + 1].createdAt).toDateString()
      : null;

    const showSeparator = currentMsgDate !== olderMsgDate;

    return (
      <View>
        {showSeparator && item.createdAt && (
          <View style={styles.dateSeparatorContainer}>
            <View style={styles.dateBadge}>
              <Text style={styles.dateText}>
                {formatMessageDateSeparator(item.createdAt)}
              </Text>
            </View>
          </View>
        )}
        <ChatBubble
          message={item}
          isOwn={String(item.senderId || '') === String(currentUserId || '')}
          isOnline={otherOnline}
          latestReadBy={latestReadBy}
          showReadStatus={shouldShowStatus}
          onReact={onReact}
          onLongPress={() => onLongPress(item)}
          onPressMessage={(data) => {
            if (data && typeof data === 'object') {
              onPressMessage?.(data);
            } else {
              onPressReply?.(data);
            }
          }}
          isHighlighted={highlightedMessageId === (item.messageId || item.id)}
          allMessages={messages}
          members={members}
          translatedMessages={translatedMessages}
          translationLoading={translationLoading}
          onTranslate={onTranslate}
        />
      </View>
    );
  };

  const renderTypingIndicator = () => {
    if (!typingUsers || typingUsers.length === 0) return null;

    const activeTyping = typingUsers.filter(u => String(u.userId) !== String(currentUserId));
    if (activeTyping.length === 0) return null;

    const firstTypingUser = activeTyping[0];
    const typingText = activeTyping.length > 1
      ? `${activeTyping.length} ${t('chat.are_typing')}`
      : `${firstTypingUser.name} ${t('chat.is_typing')}`;

    return (
      <View style={styles.typingContainer}>
        <View style={[styles.typingBubble, { backgroundColor: colors.surface200 }]}>
          <View style={styles.dotsContainer}>
            <View style={[styles.typingDot, { backgroundColor: colors.textSubtle }]} />
            <View style={[styles.typingDot, { backgroundColor: colors.textSubtle }]} />
            <View style={[styles.typingDot, { backgroundColor: colors.textSubtle }]} />
          </View>
          <Text style={[styles.typingText, { color: colors.textMuted }]}>{typingText}</Text>
        </View>
      </View>
    );
  };

  const renderLoadingMoreIndicator = () => {
    if (!isLoadingMoreMessages || messages.length === 0) return null;
    return (
      <View style={styles.loadingMoreContainer}>
        <ActivityIndicator size="small" color={colors.primary} />
        <Text style={[styles.loadingMoreText, { color: colors.textSubtle }]}>{t('chat.loading_more')}</Text>
      </View>
    );
  };

  if (isLoading && messages.length === 0) {
    return <ChatSkeleton isDark={isDark} colors={colors} />;
  }

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <FlatList
        ref={ref}
        inverted
        data={reversedMessages}
        renderItem={renderMessage}
        keyExtractor={(item, index) => item.messageId || item.id || String(item.createdAt) || index.toString()}
        ListHeaderComponent={renderTypingIndicator}
        ListFooterComponent={renderLoadingMoreIndicator}
        contentContainerStyle={styles.listContent}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        onEndReached={handleLoadOlder}
        onEndReachedThreshold={0.35}
        onScrollToIndexFailed={(info) => {
          setTimeout(() => {
            if (ref?.current && reversedMessages.length > info.index) {
              try {
                ref.current.scrollToIndex({ index: info.index, animated: true, viewPosition: 0.5 });
              } catch (e) {
                console.warn('Scroll to index failed after retry:', e);
              }
            }
          }, 350);
        }}
        removeClippedSubviews={Platform.OS === 'android'}
        initialNumToRender={12}
        maxToRenderPerBatch={6}
        updateCellsBatchingPeriod={40}
        windowSize={7}
        maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
      />
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  listContent: {
    paddingVertical: 16,
    paddingHorizontal: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  typingContainer: {
    paddingLeft: 48,
    paddingVertical: 8,
  },
  typingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginRight: 8,
  },
  typingDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  typingText: {
    fontSize: 12,
    fontWeight: '600',
  },
  dateSeparatorContainer: {
    alignItems: 'center',
    marginVertical: 20,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  dateBadge: {
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
  },
  dateText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },

  loadingMoreContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    flexDirection: 'row',
    gap: 8,
  },
  loadingMoreText: {
    fontSize: 12,
    fontWeight: '500',
  },
  skeletonContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: 14,
    paddingBottom: 18,
    gap: 14,
  },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  skeletonRowOwn: {
    justifyContent: 'flex-end',
  },
  skeletonRowOther: {
    justifyContent: 'flex-start',
  },
  skeletonAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
  },
  skeletonBubble: {
    borderRadius: 18,
  },
});

export default MessageList;
