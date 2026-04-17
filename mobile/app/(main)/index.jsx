import React, { useEffect } from 'react';
import {
  SafeAreaView,
  StyleSheet,
  ActivityIndicator,
  View,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import ConversationList from '../../src/components/ConversationList';
import { fetchConversations } from '../../src/store/chatSlice';

/**
 * HomeScreen (Mobile)
 * Displays list of conversations
 */

const HomeScreen = ({ navigation }) => {
  const dispatch = useDispatch();
  
  // Get conversations from Redux
  const conversations = useSelector((state) => state.chat.conversations);
  const isLoading = useSelector((state) => state.chat.isLoading);
  const error = useSelector((state) => state.chat.error);

  // Mock data for development (if Redux not connected)
  const mockConversations = [
    {
      conversationId: '1',
      name: 'John Doe',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=John',
      lastMessage: 'Hey, how are you?',
      lastMessageTime: new Date(),
      participantIds: ['user2'],
    },
    {
      conversationId: '2',
      name: 'Jane Smith',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Jane',
      lastMessage: 'Sounds good!',
      lastMessageTime: new Date(Date.now() - 3600000),
      participantIds: ['user3'],
    },
    {
      conversationId: '3',
      name: 'Group Chat',
      avatar: null,
      lastMessage: 'John: See you tomorrow!',
      lastMessageTime: new Date(Date.now() - 7200000),
      participantIds: ['user2', 'user3', 'user4'],
    },
  ];

  // Fetch conversations on mount
  useEffect(() => {
    dispatch(fetchConversations());
  }, [dispatch]);

  const handleSelectConversation = (conversationId) => {
    // Navigate to chat detail screen
    navigation.navigate('chatDetail', { id: conversationId });
  };

  const handleCreateConversation = () => {
    // TODO: Navigate to create conversation screen
    console.log('Create conversation pressed');
  };

  // Use Redux data if available, fallback to mock data
  const displayConversations = conversations.length > 0 ? conversations : mockConversations;

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#667eea" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ConversationList
        conversations={displayConversations}
        selectedConversationId={null}
        onSelectConversation={handleSelectConversation}
        onCreateConversation={handleCreateConversation}
        isLoading={isLoading}
        unreadCounts={{ '1': 0, '2': 1 }}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },

  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default HomeScreen;
