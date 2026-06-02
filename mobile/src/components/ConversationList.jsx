import React, { useState, useEffect } from 'react';
import {
  View,
  FlatList,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Image,
  ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { getPreviewText } from '../utils/messageUtils';

import { useTheme } from '../context/ThemeContext';

/**
 * ConversationList Component (Mobile)
 * List of conversations with search and create functionality
 */

const ConversationList = ({
  conversations = [],
  selectedConversationId,
  onSelectConversation,
  onCreateConversation,
  isLoading = false,
  unreadCounts = {},
}) => {
  const { colors, isDark } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredConversations, setFilteredConversations] = useState(conversations);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredConversations(conversations);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = conversations.filter(
      (conv) =>
        conv.name?.toLowerCase().includes(query) ||
        conv.lastMessage?.toLowerCase().includes(query)
    );
    setFilteredConversations(filtered);
  }, [searchQuery, conversations]);

  const renderConversationItem = ({ item }) => {
    const unreadCount = unreadCounts[item.conversationId || item.id] || 0;
    const isSelected = selectedConversationId === (item.conversationId || item.id);

    return (
      <TouchableOpacity
        style={[
          styles.conversationItem,
          { borderBottomColor: colors.border },
          isSelected && {
            backgroundColor: isDark ? colors.surface200 : 'rgba(99, 102, 241, 0.1)',
            borderLeftColor: colors.primary,
            borderLeftWidth: 3,
            paddingLeft: 13,
          }
        ]}
        onPress={() => onSelectConversation(item.conversationId || item.id)}
      >
        {/* Avatar */}
        <View style={[styles.avatarContainer, { backgroundColor: colors.surface200 }]}>
          {item.avatar ? (
            <Image source={{ uri: item.avatar }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatarPlaceholder, { backgroundColor: colors.primary }]}>
              <Text style={styles.avatarText}>{(item.name || 'U')[0].toUpperCase()}</Text>
            </View>
          )}
        </View>

        {/* Content */}
        <View style={styles.contentContainer}>
          <View style={styles.headerContainer}>
            <Text style={[styles.conversationName, { color: colors.foreground }]} numberOfLines={1}>
              {item.name || 'Unknown'}
            </Text>
            <Text style={[styles.timeText, { color: colors.textSubtle }]}>
              {item.lastMessageTime
                ? new Date(item.lastMessageTime).toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                  })
                : ''}
            </Text>
          </View>
          <Text style={[styles.previewText, { color: colors.textMuted }]} numberOfLines={1}>
            {getPreviewText(item.lastMessage)}
          </Text>
        </View>

        {/* Unread Badge */}
        {unreadCount > 0 && (
          <View style={[styles.unreadBadge, { backgroundColor: colors.error }]}>
            <Text style={styles.unreadText}>{unreadCount}</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Messages</Text>
        <TouchableOpacity style={[styles.createButton, { backgroundColor: colors.primary }]} onPress={onCreateConversation}>
          <MaterialIcons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={[styles.searchContainer, { backgroundColor: colors.input }]}>
        <MaterialIcons name="search" size={20} color={colors.textSubtle} />
        <TextInput
          style={[styles.searchInput, { color: colors.foreground }]}
          placeholder="Search conversations..."
          placeholderTextColor={colors.textSubtle}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Conversation List */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.primary }]}>Loading conversations...</Text>
        </View>
      ) : filteredConversations.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, { color: colors.textSubtle }]}>
            {searchQuery ? 'No conversations found' : 'No conversations yet'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredConversations}
          renderItem={renderConversationItem}
          keyExtractor={(item) => item.conversationId || item.id}
          scrollEventThrottle={16}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },

  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
  },

  createButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },

  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    marginHorizontal: 12,
    marginVertical: 8,
    borderRadius: 20,
  },

  searchInput: {
    flex: 1,
    fontSize: 14,
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

  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  emptyText: {
    fontSize: 14,
  },

  conversationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },

  conversationItemActive: {
  },

  avatarContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
  },

  avatar: {
    width: '100%',
    height: '100%',
  },

  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },

  avatarText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },

  contentContainer: {
    flex: 1,
  },

  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 4,
    gap: 8,
  },

  conversationName: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },

  timeText: {
    fontSize: 12,
  },

  previewText: {
    fontSize: 13,
  },

  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },

  unreadText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#fff',
  },
});

export default ConversationList;
