import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Switch,
  Alert,
} from 'react-native';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';

const CreateVoteModal = ({ visible, onClose, onCreate }) => {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [allowMultiple, setAllowMultiple] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [deadline, setDeadline] = useState(null);

  const handleAddOption = () => {
    setOptions([...options, '']);
  };

  const handleRemoveOption = (index) => {
    if (options.length <= 2) return;
    const newOptions = options.filter((_, i) => i !== index);
    setOptions(newOptions);
  };

  const handleOptionChange = (text, index) => {
    const newOptions = [...options];
    newOptions[index] = text;
    setOptions(newOptions);
  };

  const handleDateChange = (event, selectedDate) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setDeadline(selectedDate);
    }
  };

  const handleSubmit = () => {
    if (!question.trim()) {
      Alert.alert('Lỗi', 'Vui lòng nhập câu hỏi bình chọn.');
      return;
    }

    const filteredOptions = options.filter(opt => opt.trim() !== '');
    if (filteredOptions.length < 2) {
      Alert.alert('Lỗi', 'Vui lòng nhập ít nhất 2 lựa chọn.');
      return;
    }

    onCreate({
      question: question.trim(),
      options: filteredOptions,
      allowMultiple,
      deadline: deadline ? deadline.toISOString() : null,
    });
    
    // Reset state
    setQuestion('');
    setOptions(['', '']);
    setAllowMultiple(false);
    setDeadline(null);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalOverlay}
      >
        <View style={styles.modalContainer}>
          <View style={styles.header}>
            <View style={styles.headerTitleContainer}>
              <View style={styles.pollIconBg}>
                <Ionicons name="stats-chart" size={18} color="#fff" />
              </View>
              <Text style={styles.headerTitle}>Tạo cuộc bình chọn</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <MaterialIcons name="close" size={24} color="#64748b" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            <Text style={styles.label}>CÂU HỎI</Text>
            <TextInput
              style={styles.questionInput}
              placeholder="Nhập nội dung bình chọn..."
              placeholderTextColor="#94a3b8"
              value={question}
              onChangeText={setQuestion}
              multiline
            />

            <Text style={styles.label}>CÁC LỰA CHỌN</Text>
            {options.map((option, index) => (
              <View key={index} style={styles.optionRow}>
                <TextInput
                  style={styles.optionInput}
                  placeholder={`Lựa chọn ${index + 1}`}
                  placeholderTextColor="#94a3b8"
                  value={option}
                  onChangeText={(text) => handleOptionChange(text, index)}
                />
                {options.length > 2 && (
                  <TouchableOpacity 
                    onPress={() => handleRemoveOption(index)}
                    style={styles.removeOptionBtn}
                  >
                    <MaterialIcons name="remove-circle-outline" size={20} color="#ef4444" />
                  </TouchableOpacity>
                )}
              </View>
            ))}

            <TouchableOpacity style={styles.addOptionBtn} onPress={handleAddOption}>
              <Ionicons name="add" size={20} color="#6366f1" />
              <Text style={styles.addOptionText}>Thêm lựa chọn</Text>
            </TouchableOpacity>

            <View style={styles.divider} />

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Ionicons name="checkbox-outline" size={20} color="#64748b" />
                <Text style={styles.settingLabel}>Cho phép chọn nhiều phương án</Text>
              </View>
              <Switch
                value={allowMultiple}
                onValueChange={setAllowMultiple}
                trackColor={{ false: '#e2e8f0', true: '#6366f1' }}
                thumbColor="#fff"
              />
            </View>

            <TouchableOpacity 
              style={styles.settingRow} 
              onPress={() => setShowDatePicker(true)}
            >
              <View style={styles.settingInfo}>
                <Ionicons name="time-outline" size={20} color="#64748b" />
                <View>
                  <Text style={styles.settingLabel}>Thời hạn (Không bắt buộc)</Text>
                  {deadline && (
                    <Text style={styles.deadlineValue}>
                      {deadline.toLocaleString('vi-VN')}
                    </Text>
                  )}
                </View>
              </View>
              {deadline && (
                <TouchableOpacity onPress={() => setDeadline(null)}>
                  <MaterialIcons name="close" size={20} color="#ef4444" />
                </TouchableOpacity>
              )}
            </TouchableOpacity>

            {showDatePicker && (
              <DateTimePicker
                value={deadline || new Date()}
                mode="datetime"
                display="default"
                onChange={handleDateChange}
                minimumDate={new Date()}
              />
            )}
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelBtnText}>Hủy</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit}>
              <Text style={styles.submitBtnText}>Tạo bình chọn</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: '90%',
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  pollIconBg: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e293b',
  },
  closeBtn: {
    padding: 4,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  label: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94a3b8',
    letterSpacing: 1,
    marginBottom: 12,
    marginTop: 8,
  },
  questionInput: {
    fontSize: 16,
    color: '#1e293b',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 16,
    minHeight: 80,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 20,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 10,
  },
  optionInput: {
    flex: 1,
    fontSize: 15,
    color: '#1e293b',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 50,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  removeOptionBtn: {
    padding: 4,
  },
  addOptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#6366f1',
    borderRadius: 12,
    marginTop: 8,
    gap: 8,
  },
  addOptionText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6366f1',
  },
  divider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginVertical: 24,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  settingLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
  deadlineValue: {
    fontSize: 13,
    color: '#6366f1',
    fontWeight: '700',
    marginTop: 2,
  },
  footer: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  cancelBtn: {
    flex: 1,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#64748b',
  },
  submitBtn: {
    flex: 2,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: '#6366f1',
  },
  submitBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
});

export default CreateVoteModal;
