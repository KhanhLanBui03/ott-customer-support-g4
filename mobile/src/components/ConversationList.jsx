import React, { useState, useEffect } from 'react';
import {
  View,
  FlatList,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  StatusBar,
} from 'react-redux';
import { View as RNView, FlatList as RNFlatList, Text as RNText, TouchableOpacity as RNTouchableOpacity, TextInput as RNTextInput, StyleSheet as RNStyleSheet, ActivityIndicator as RNActivityIndicator } from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../utils/theme';
import ConversationItem from './ConversationItem';
import { toggleTheme } from '../store/authSlice';

/**
 * Premium ConversationList Component
 * Features search, theme toggle, and creation button.
 */

const ConversationList = ({
  conversations = [],
  selectedConversationId,
  onSelectConversation,
  onCreateConversation,
  isLoading = false,
}) => {
  const dispatch = useDispatch();
  const themeMode = useSelector((state) => state.auth.theme || 'light');
  const theme = COLORS[themeMode];
  const [searchQuery, setSearchQuery] = useState('');

  const filteredConversations = conversations.filter(
    (conv) =>
      conv.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      conv.lastMessage?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <RNView style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={themeMode === 'dark' ? 'light-content' : 'dark-content'} />
      
      {/* Header */}
      <RNView style={styles.header}>
        <RNText style={[styles.headerTitle, { color: theme.text }]}>Đoạn chat</RNText>
        <RNView style={styles.headerActions}>
          <RNTouchableOpacity 
            style={[styles.headerButton, { backgroundColor: theme.surfaceSecondary }]}
            onPress={() => dispatch(toggleTheme())}
          >
            <MaterialCommunityIcons 
              name={themeMode === 'light' ? 'moon-waning-crescent' : 'white-balance-sunny'} 
              size={20} 
              color={theme.text} 
            />
          </RNTouchableOpacity>
          <RNTouchableOpacity 
            style={[styles.headerButton, { backgroundColor: COLORS.primary }]} 
            onPress={onCreateConversation}
          >
            <MaterialCommunityIcons name="plus" size={24} color="#fff" />
          </RNTouchableOpacity>
        </RNView>
      </RNView>

      {/* Search Bar */}
      <RNView style={[styles.searchContainer, { backgroundColor: theme.surfaceSecondary }]}>
        <MaterialCommunityIcons name="magnify" size={20} color={theme.textMuted} />
        <RNTextInput
          style={[styles.searchInput, { color: theme.text }]}
          placeholder="Tìm kiếm..."
          placeholderTextColor={theme.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </RNView>

      {/* List */}
      {isLoading ? (
        <RNView style={styles.centerContainer}>
          <RNActivityIndicator size="large" color={COLORS.primary} />
        </RNView>
      ) : filteredConversations.length === 0 ? (
        <RNView style={styles.centerContainer}>
          <RNText style={[styles.emptyText, { color: theme.textMuted }]}>
            {searchQuery ? 'Không tìm thấy cuộc hội thoại nào' : 'Chưa có tin nhắn'}
          </RNText>
        </RNView>
      ) : (
        <RNFlatList
          data={filteredConversations}
          renderItem={({ item }) => (
            <ConversationItem
              conversation={item}
              isActive={selectedConversationId === (item.conversationId || item.id)}
              onPress={() => onSelectConversation(item.conversationId || item.id)}
            />
          )}
          keyExtractor={(item) => item.conversationId || item.id}
          contentContainerStyle={{ paddingBottom: 100 }}
        />
      )}
    </RNView>
  );
};

const styles = RNStyleSheet.create({
  container: {
    flex: 1,
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
  },

  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
  },

  headerActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },

  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.sm,
  },

  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: SPACING.md,
    marginVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    height: 44,
    borderRadius: RADIUS.lg,
    gap: SPACING.sm,
  },

  searchInput: {
    flex: 1,
    fontSize: 16,
  },

  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  emptyText: {
    fontSize: 15,
  },
});

export default ConversationList;
