import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Platform,
  ActivityIndicator,
  Modal,
  TouchableWithoutFeedback,
  ScrollView,
} from 'react-native';
import { MaterialIcons, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTheme } from '../../context/ThemeContext';
import { chatApi } from '../../api/chatApi';

const AIAssistantPanel = ({ conversationId }) => {
  const { colors, isDark } = useTheme();
  
  // Logic states
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [type, setType] = useState(null);
  const [question, setQuestion] = useState('');
  
  // Time range states
  const [timeRange, setTimeRange] = useState(0);
  const [isCustomRange, setIsCustomRange] = useState(false);
  const [customStart, setCustomStart] = useState(new Date());
  const [customEnd, setCustomEnd] = useState(new Date());
  
  // UI states
  const [showTimeRangeModal, setShowTimeRangeModal] = useState(false);
  
  // DateTimePicker states
  const [showPicker, setShowPicker] = useState(false);
  const [pickerMode, setPickerMode] = useState('date');
  const [activePickerTarget, setActivePickerTarget] = useState(null); // 'start' or 'end'

  const timeRanges = [
    { label: 'Chưa đọc', value: 0 },
    { label: '1 giờ qua', value: 1 },
    { label: '4 giờ qua', value: 4 },
    { label: '12 giờ qua', value: 12 },
    { label: '24 giờ qua', value: 24 },
  ];

  const handleAction = async (actionType, payload = {}) => {
    setLoading(true);
    setType(actionType);
    setResult(null);
    try {
      let response;
      const startTs = isCustomRange ? customStart.getTime() : null;
      const endTs = isCustomRange ? customEnd.getTime() : null;
      const currentRange = isCustomRange ? 0 : timeRange;

      switch (actionType) {
        case 'summary':
          if (isCustomRange && (!customStart || !customEnd)) {
            setResult("Vui lòng chọn đầy đủ thời gian bắt đầu và kết thúc!");
            setLoading(false);
            return;
          }
          response = await chatApi.getGroupSummary(conversationId, currentRange, startTs, endTs);
          break;
        case 'stats':
          response = await chatApi.getGroupStats(conversationId, currentRange, startTs, endTs);
          break;
        case 'tasks':
          response = await chatApi.extractTasks(conversationId, currentRange, startTs, endTs);
          break;
        case 'announcement':
          response = await chatApi.draftAnnouncement(conversationId, currentRange, startTs, endTs);
          break;
        case 'ask':
          response = await chatApi.askAI(conversationId, payload.question);
          break;
        default:
          return;
      }

      const resData = response.data || response;
      const finalResult = resData.summary || resData.stats || resData.answer || resData.tasks || resData.translation || resData.announcement || resData.data?.summary || resData.data?.stats || resData.data?.answer || resData.data?.tasks || resData.data?.announcement;
      
      setResult(finalResult || "Không có kết quả trả về từ AI.");
    } catch (err) {
      console.error("AI Error:", err);
      const errorMsg = err.response?.data?.message || err.response?.data?.error || err.message;
      setResult(`Rất tiếc, trợ lý AI đang gặp sự cố: ${errorMsg}`);
    } finally {
      setLoading(false);
    }
  };

  const handleAsk = () => {
    if (!question.trim()) return;
    handleAction('ask', { question });
    setQuestion('');
  };

  const showDateTimePicker = (target, mode) => {
    setActivePickerTarget(target);
    setPickerMode(mode);
    setShowPicker(true);
  };

  const onPickerChange = (event, selectedDate) => {
    if (Platform.OS === 'android') {
      setShowPicker(false);
    }
    
    if (event.type === 'dismissed' || !selectedDate) {
      setShowPicker(false);
      return;
    }

    const targetDate = activePickerTarget === 'start' ? customStart : customEnd;
    const newDate = new Date(targetDate);

    if (pickerMode === 'date') {
      newDate.setFullYear(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
      
      // On Android, show time picker after date is selected
      if (Platform.OS === 'android') {
        if (activePickerTarget === 'start') {
          setCustomStart(newDate);
        } else {
          setCustomEnd(newDate);
        }
        setTimeout(() => {
          setPickerMode('time');
          setShowPicker(true);
        }, 100);
        return;
      }
    } else {
      newDate.setHours(selectedDate.getHours(), selectedDate.getMinutes());
    }

    if (activePickerTarget === 'start') {
      setCustomStart(newDate);
    } else {
      setCustomEnd(newDate);
    }

    if (Platform.OS === 'ios') {
      // iOS keeps picker open until user dismisses it or confirms (usually handled differently, but we'll auto close for simplicity if it's just date or time)
      // Actually, for iOS datetime mode is best
    }
  };

  const formatDate = (date) => {
    return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  };

  const renderFormattedResult = (text) => {
    if (!text) return null;
    return text.split('\n').map((line, idx) => {
      const trimmed = line.trim();
      if (!trimmed) return <View key={idx} style={{ height: 8 }} />;
      
      const isBullet = trimmed.startsWith('* ') || trimmed.startsWith('- ');
      const content = isBullet ? trimmed.substring(2) : line;
      
      // Bold text parser (basic)
      const parts = content.split(/(\*\*.*?\*\*)/g);
      
      return (
        <View key={idx} style={[styles.resultLine, isBullet && styles.resultLineBullet]}>
          {isBullet && <Text style={[styles.bulletPoint, { color: '#818cf8' }]}>•</Text>}
          <Text style={[styles.resultText, { color: isDark ? 'rgba(255,255,255,0.8)' : colors.foreground }]}>
            {parts.map((part, i) => {
              if (part.startsWith('**') && part.endsWith('**')) {
                return <Text key={i} style={[styles.boldText, { color: isDark ? 'rgba(255,255,255,0.95)' : colors.foreground }]}>{part.slice(2, -2)}</Text>;
              }
              return part;
            })}
          </Text>
        </View>
      );
    });
  };

  const ActionCard = ({ icon, label, bgColor }) => (
    <TouchableOpacity 
      activeOpacity={0.7}
      style={[
        styles.actionCard, 
        { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : colors.surface100 }
      ]}
      onPress={() => {
        let actionMap = {
          'TÓM TẮT': 'summary',
          'THỐNG KÊ': 'stats',
          'LỊCH HẸN': 'tasks',
          'BIÊN BẢN': 'announcement'
        };
        handleAction(actionMap[label]);
      }}
    >
      <View style={[styles.actionIconContainer, { backgroundColor: bgColor }]}>
        {icon}
      </View>
      <Text style={[styles.actionLabel, { color: colors.textSubtle }]}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={[styles.brainIcon, { backgroundColor: 'rgba(99, 102, 241, 0.2)' }]}>
            <MaterialCommunityIcons name="brain" size={20} color="#818cf8" />
          </View>
          <Text style={[styles.headerTitle, { color: colors.textSubtle }]}>TRỢ LÝ AI</Text>
        </View>
        <TouchableOpacity activeOpacity={0.6} onPress={() => setIsCustomRange(!isCustomRange)}>
          <Text style={styles.customTimeText}>{isCustomRange ? "Dùng chọn nhanh" : "Tùy chỉnh thời gian"}</Text>
        </TouchableOpacity>
      </View>

      {/* Time Range Selector */}
      {isCustomRange ? (
        <View style={styles.customRangeContainer}>
          <View style={styles.dateInputWrapper}>
            <Text style={styles.dateInputLabel}>TỪ LÚC</Text>
            <TouchableOpacity 
              style={[styles.dateInput, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : colors.surface100 }]}
              onPress={() => showDateTimePicker('start', Platform.OS === 'ios' ? 'datetime' : 'date')}
            >
              <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: '600' }}>{formatDate(customStart)}</Text>
              <MaterialIcons name="calendar-today" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
          <View style={styles.dateInputWrapper}>
            <Text style={styles.dateInputLabel}>ĐẾN LÚC</Text>
            <TouchableOpacity 
              style={[styles.dateInput, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : colors.surface100 }]}
              onPress={() => showDateTimePicker('end', Platform.OS === 'ios' ? 'datetime' : 'date')}
            >
              <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: '600' }}>{formatDate(customEnd)}</Text>
              <MaterialIcons name="calendar-today" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity 
          activeOpacity={0.6}
          onPress={() => setShowTimeRangeModal(true)}
          style={[
            styles.pickerContainer, 
            { 
              backgroundColor: isDark ? 'rgba(99, 102, 241, 0.1)' : 'rgba(99, 102, 241, 0.05)', 
              borderColor: 'rgba(99, 102, 241, 0.2)' 
            }
          ]}
        >
          <Text style={[styles.pickerText, { color: isDark ? '#818cf8' : '#6366f1' }]}>
            {timeRanges.find(r => r.value === timeRange)?.label}
          </Text>
          <MaterialIcons name="keyboard-arrow-down" size={20} color={isDark ? '#818cf8' : '#6366f1'} />
        </TouchableOpacity>
      )}

      {/* Action Grid */}
      <View style={styles.grid}>
        <ActionCard 
          icon={<MaterialIcons name="chat-bubble-outline" size={22} color="#818cf8" />} 
          label="TÓM TẮT" 
          bgColor="rgba(99, 102, 241, 0.2)"
        />
        <ActionCard 
          icon={<MaterialIcons name="bar-chart" size={22} color="#34d399" />} 
          label="THỐNG KÊ" 
          bgColor="rgba(52, 211, 153, 0.2)"
        />
        <ActionCard 
          icon={<MaterialIcons name="event" size={22} color="#fb923c" />} 
          label="LỊCH HẸN" 
          bgColor="rgba(251, 146, 60, 0.2)"
        />
        <ActionCard 
          icon={<MaterialIcons name="description" size={22} color="#f43f5e" />} 
          label="BIÊN BẢN" 
          bgColor="rgba(244, 63, 94, 0.2)"
        />
      </View>

      {/* Question Input */}
      <View style={[styles.inputWrapper, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : colors.surface100 }]}>
        <TextInput
          placeholder="Hỏi AI về cuộc trò chuyện..."
          placeholderTextColor={colors.textMuted}
          style={[styles.input, { color: colors.foreground }]}
          value={question}
          onChangeText={setQuestion}
          onSubmitEditing={handleAsk}
        />
        <TouchableOpacity 
          activeOpacity={0.8}
          onPress={handleAsk}
          style={[styles.sendButton, { backgroundColor: colors.primary }]}
        >
          <Ionicons name="send" size={18} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Results Display */}
      {(loading || result) && (
        <View style={[styles.resultContainer, { backgroundColor: isDark ? 'rgba(99, 102, 241, 0.05)' : '#f5f3ff', borderColor: 'rgba(99, 102, 241, 0.1)' }]}>
          <View style={styles.resultHeader}>
            {loading ? (
              <>
                <ActivityIndicator size="small" color="#818cf8" style={{ marginRight: 8 }} />
                <Text style={styles.resultTitle}>AI ĐANG XỬ LÝ...</Text>
              </>
            ) : (
              <>
                <MaterialIcons name="check-circle-outline" size={16} color="#818cf8" style={{ marginRight: 8 }} />
                <Text style={styles.resultTitle}>KẾT QUẢ TỪ AI</Text>
              </>
            )}
          </View>

          {result && (
            <ScrollView style={styles.resultContent} nestedScrollEnabled>
              {renderFormattedResult(result)}
            </ScrollView>
          )}

          {!loading && result && (
            <TouchableOpacity 
              style={styles.closeResultBtn}
              onPress={() => setResult(null)}
            >
              <Text style={styles.closeResultText}>ĐÓNG KẾT QUẢ</Text>
              <MaterialIcons name="chevron-right" size={14} color="#818cf8" />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Modals & Pickers */}
      
      {/* Time Range Select Modal */}
      <Modal visible={showTimeRangeModal} transparent animationType="fade">
        <TouchableWithoutFeedback onPress={() => setShowTimeRangeModal(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
                <Text style={[styles.modalTitle, { color: colors.foreground }]}>Chọn mốc thời gian</Text>
                {timeRanges.map((range) => (
                  <TouchableOpacity
                    key={range.value}
                    style={[styles.modalOption, timeRange === range.value && { backgroundColor: isDark ? 'rgba(99, 102, 241, 0.1)' : '#e0e7ff' }]}
                    onPress={() => {
                      setTimeRange(range.value);
                      setShowTimeRangeModal(false);
                    }}
                  >
                    <Text style={[styles.modalOptionText, { color: timeRange === range.value ? '#6366f1' : colors.foreground }]}>{range.label}</Text>
                    {timeRange === range.value && <MaterialIcons name="check" size={20} color="#6366f1" />}
                  </TouchableOpacity>
                ))}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* DateTime Picker */}
      {showPicker && (
        <DateTimePicker
          value={activePickerTarget === 'start' ? customStart : customEnd}
          mode={pickerMode}
          is24Hour={true}
          display="default"
          onChange={onPickerChange}
          themeVariant={isDark ? "dark" : "light"}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 24,
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brainIcon: {
    padding: 8,
    borderRadius: 12,
    marginRight: 10,
  },
  headerTitle: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 2,
  },
  customTimeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#818cf8',
  },
  pickerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 20,
  },
  pickerText: {
    fontSize: 13,
    fontWeight: '700',
  },
  customRangeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 12,
  },
  dateInputWrapper: {
    flex: 1,
  },
  dateInputLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94a3b8',
    marginBottom: 6,
    marginLeft: 4,
  },
  dateInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)'
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  actionCard: {
    width: '48%',
    aspectRatio: 1.1,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    marginBottom: 12,
  },
  actionIconContainer: {
    padding: 10,
    borderRadius: 14,
    marginBottom: 10,
  },
  actionLabel: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    paddingLeft: 20,
    borderRadius: 20,
    height: 56,
  },
  input: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    ...Platform.select({
      ios: { height: '100%' },
      android: { paddingVertical: 0 }
    })
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultContainer: {
    marginTop: 24,
    padding: 20,
    borderRadius: 24,
    borderWidth: 1,
    maxHeight: 400,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  resultTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: '#818cf8',
    letterSpacing: 1.5,
  },
  resultContent: {
    marginBottom: 16,
  },
  resultLine: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  resultLineBullet: {
    paddingLeft: 8,
  },
  bulletPoint: {
    marginRight: 8,
    fontWeight: '900',
    fontSize: 14,
  },
  resultText: {
    fontSize: 14,
    lineHeight: 22,
    flex: 1,
  },
  boldText: {
    fontWeight: 'bold',
  },
  closeResultBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  closeResultText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#818cf8',
    letterSpacing: 1,
    marginRight: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '80%',
    borderRadius: 20,
    padding: 16,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  modalOptionText: {
    fontSize: 15,
    fontWeight: '600',
  },
});

export default AIAssistantPanel;
