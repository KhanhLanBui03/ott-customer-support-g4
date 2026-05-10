import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  FlatList,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { MaterialIcons, Ionicons, Feather } from '@expo/vector-icons';
import { useSelector, useDispatch } from 'react-redux';
import { sendMessage } from '../store/chatSlice';

const ForwardModal = ({ visible, onClose, messageToForward }) => {
  const dispatch = useDispatch();
  const { conversations } = useSelector((state) => state.chat);
  const { user } = useSelector((state) => state.auth);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('Gần đây'); // Gần đây, Nhóm, Bạn bè
  const [selectedConvs, setSelectedConvs] = useState([]);
  const [extraMessage, setExtraMessage] = useState('');
  const [sending, setSending] = useState(false);

  const filteredConversations = useMemo(() => {
    let list = [...conversations];
    
    // Sort by last message date (recent first) - assuming conversations are already sorted in store
    // but just in case:
    list.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));

    if (activeTab === 'Nhóm') {
      list = list.filter(c => c.type === 'GROUP');
    } else if (activeTab === 'Bạn bè') {
      list = list.filter(c => c.type === 'SINGLE');
    }

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      list = list.filter(c => 
        (c.name || '').toLowerCase().includes(term) || 
        (c.lastMessage || '').toLowerCase().includes(term)
      );
    }

    return list;
  }, [conversations, activeTab, searchTerm]);

  const toggleSelect = (convId) => {
    setSelectedConvs(prev => 
      prev.includes(convId) 
        ? prev.filter(id => id !== convId) 
        : [...prev, convId]
    );
  };

  const handleForward = async () => {
    if (selectedConvs.length === 0 || !messageToForward) return;
    setSending(true);

    try {
      const forwardedFrom = {
        messageId: messageToForward.messageId,
        conversationId: messageToForward.conversationId,
        senderName: messageToForward.senderName || 'Người dùng'
      };

      for (const convId of selectedConvs) {
        // Forward the original message
        await dispatch(sendMessage({
          conversationId: convId, 
          content: messageToForward.content || '', 
          type: messageToForward.type || 'TEXT', 
          mediaUrls: messageToForward.mediaUrls || messageToForward.media_urls || [], 
          forwardedFrom
        }));

        // Send extra message if any
        if (extraMessage.trim()) {
          await dispatch(sendMessage({
            conversationId: convId, 
            content: extraMessage.trim(), 
            type: 'TEXT'
          }));
        }
      }
      onClose();
      // Reset state
      setSelectedConvs([]);
      setExtraMessage('');
      setSearchTerm('');
    } catch (err) {
      console.error('Forwarding failed:', err);
    } finally {
      setSending(false);
    }
  };

  const getConvName = (conv) => {
    if (conv.type === 'GROUP') return conv.name || 'Nhóm không tên';
    const currentUserId = String(user?.userId || user?.id || '');
    const otherMember = conv.members?.find(m => String(m.userId || m.id) !== currentUserId);
    return otherMember?.fullName || otherMember?.name || conv.name || 'Người dùng';
  };

  const renderConvItem = ({ item }) => {
    const isSelected = selectedConvs.includes(item.conversationId);
    return (
      <TouchableOpacity 
        style={[styles.convItem, isSelected && styles.convItemSelected]} 
        onPress={() => toggleSelect(item.conversationId)}
        activeOpacity={0.7}
      >
        <View style={styles.convAvatar}>
          {item.type === 'GROUP' ? (
            <MaterialIcons name="groups" size={24} color="#6366f1" />
          ) : (
            <MaterialIcons name="person" size={24} color="#6366f1" />
          )}
        </View>
        <Text style={styles.convName} numberOfLines={1}>{getConvName(item)}</Text>
        <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
          {isSelected && <MaterialIcons name="check" size={16} color="#fff" />}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.container}
        >
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Chia sẻ</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#1f2937" />
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            {/* Search Bar */}
            <View style={styles.searchContainer}>
              <Feather name="search" size={18} color="#9ca3af" style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Tìm kiếm cuộc trò chuyện..."
                value={searchTerm}
                onChangeText={setSearchTerm}
              />
              {searchTerm.length > 0 && (
                <TouchableOpacity onPress={() => setSearchTerm('')}>
                  <Ionicons name="close-circle" size={18} color="#9ca3af" />
                </TouchableOpacity>
              )}
            </View>

            {/* Tabs */}
            <View style={styles.tabs}>
              {['Gần đây', 'Nhóm', 'Bạn bè'].map(tab => (
                <TouchableOpacity 
                  key={tab} 
                  style={[styles.tab, activeTab === tab && styles.tabActive]}
                  onPress={() => setActiveTab(tab)}
                >
                  <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Conversation List */}
            <FlatList
              data={filteredConversations}
              renderItem={renderConvItem}
              keyExtractor={item => item.conversationId}
              contentContainerStyle={styles.listContent}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>Không tìm thấy cuộc trò chuyện nào</Text>
                </View>
              }
            />

            {/* Preview & Extra Message */}
            <View style={styles.footer}>
              <View style={styles.previewContainer}>
                <Text style={styles.previewLabel}>Tin nhắn được chọn:</Text>
                <View style={styles.previewBox}>
                  <Text style={styles.previewText} numberOfLines={1}>
                    {messageToForward?.content || (messageToForward?.type === 'IMAGE' ? '[Hình ảnh]' : messageToForward?.type === 'VIDEO' ? '[Video]' : messageToForward?.type === 'FILE' ? '[Tệp tin]' : messageToForward?.type === 'VOICE' ? '[Tin nhắn thoại]' : '[Tin nhắn]')}
                  </Text>
                </View>
              </View>

              <TextInput
                style={styles.extraInput}
                placeholder="Nhập thêm lời nhắn (không bắt buộc)..."
                value={extraMessage}
                onChangeText={setExtraMessage}
                multiline
              />

              <TouchableOpacity 
                style={[styles.sendButton, (selectedConvs.length === 0 || sending) && styles.sendButtonDisabled]}
                onPress={handleForward}
                disabled={selectedConvs.length === 0 || sending}
              >
                {sending ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <MaterialIcons name="send" size={20} color="#fff" style={{ marginRight: 8 }} />
                    <Text style={styles.sendButtonText}>Gửi ({selectedConvs.length})</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    height: '90%',
    width: '100%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
  },
  closeButton: {
    padding: 4,
  },
  content: {
    flex: 1,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    margin: 16,
    paddingHorizontal: 16,
    borderRadius: 16,
    height: 48,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#111827',
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  tab: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginRight: 8,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
  },
  tabActive: {
    backgroundColor: '#6366f1',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  tabTextActive: {
    color: '#fff',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  convItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f9fafb',
  },
  convItemSelected: {
    backgroundColor: 'rgba(99, 102, 241, 0.05)',
    borderRadius: 12,
    marginHorizontal: -8,
    paddingHorizontal: 8,
  },
  convAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#eef2ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  convName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#d1d5db',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: '#6366f1',
    borderColor: '#6366f1',
  },
  footer: {
    padding: 24,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    backgroundColor: '#fff',
  },
  previewContainer: {
    marginBottom: 16,
  },
  previewLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
    fontWeight: '600',
  },
  previewBox: {
    backgroundColor: '#f9fafb',
    padding: 12,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#6366f1',
  },
  previewText: {
    fontSize: 14,
    color: '#4b5563',
    fontStyle: 'italic',
  },
  extraInput: {
    backgroundColor: '#f3f4f6',
    borderRadius: 16,
    padding: 12,
    fontSize: 14,
    color: '#111827',
    maxHeight: 100,
    marginBottom: 16,
  },
  sendButton: {
    backgroundColor: '#6366f1',
    flexDirection: 'row',
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  sendButtonDisabled: {
    backgroundColor: '#cbd5e1',
    shadowOpacity: 0,
    elevation: 0,
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: '#9ca3af',
    fontSize: 14,
  },
});

export default ForwardModal;
