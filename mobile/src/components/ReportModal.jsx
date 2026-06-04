import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
  TouchableWithoutFeedback,
  Alert,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import adminApi from '../api/adminApi';
import { useTranslation } from 'react-i18next';

const ReportModal = ({ visible, onClose, targetId, targetType, onSubmitSuccess }) => {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const [loading, setLoading] = useState(false);
  const [reason, setReason] = useState('spam');
  const [details, setDetails] = useState('');

  const REPORT_REASONS = [
    { key: 'spam', label: t('report.reasons.spam', 'Spam / Tin nhắn rác') },
    { key: 'harassment', label: t('report.reasons.harassment', 'Quấy rối / Đe dọa') },
    { key: 'scam', label: t('report.reasons.scam', 'Lừa đảo / Giả mạo') },
    { key: 'inappropriate', label: t('report.reasons.inappropriate', 'Nội dung phản cảm / Độc hại') },
    { key: 'other', label: t('report.reasons.other', 'Lý do khác') },
  ];

  const handleSubmit = async () => {
    if (!targetId) {
      Alert.alert(t('common.error', 'Lỗi'), t('report.unknown_target', 'Không xác định được đối tượng báo cáo.'));
      return;
    }

    setLoading(true);
    try {
      await adminApi.submitReport(targetId, targetType, reason, details);
      Alert.alert(
        t('common.success', 'Thành công'),
        t('report.submit_success_msg', 'Gửi báo cáo thành công! Đội ngũ kiểm duyệt sẽ xem xét trong vòng 24h.')
      );
      if (onSubmitSuccess) onSubmitSuccess();
      setDetails('');
      onClose();
    } catch (err) {
      console.error('Submit report error:', err);
      Alert.alert(
        t('common.failed', 'Thất bại'),
        t('report.submit_failed_msg', 'Không thể gửi báo cáo vào lúc này. Vui lòng thử lại sau.')
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.centeredView}
          >
            <TouchableWithoutFeedback>
              <View style={[styles.modalView, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={[styles.header, { borderBottomColor: colors.border }]}>
                  <View style={styles.headerLeft}>
                    <MaterialCommunityIcons name="alert-decagram" size={24} color="#f43f5e" />
                    <Text style={[styles.headerTitle, { color: colors.foreground }]}>{t('report.title', 'BÁO CÁO VI PHẠM')}</Text>
                  </View>
                  <TouchableOpacity onPress={onClose} disabled={loading}>
                    <MaterialCommunityIcons name="close" size={24} color={colors.textMuted} />
                  </TouchableOpacity>
                </View>

                <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                  <Text style={[styles.descText, { color: colors.textSubtle }]}>
                    {t('report.description', 'Vui lòng chọn lý do phản ánh cuộc trò chuyện này. Ý kiến của bạn giúp cộng đồng an toàn hơn.')}
                  </Text>

                  <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>{t('report.reason_label', 'LÝ DO BÁO CÁO')}</Text>
                  <View style={styles.optionsList}>
                    {REPORT_REASONS.map((item) => {
                      const isSelected = reason === item.key;
                      return (
                        <TouchableOpacity
                          key={item.key}
                          style={[
                            styles.optionBox,
                            {
                              backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#f9fafb',
                              borderColor: isSelected ? '#f43f5e' : (isDark ? colors.border : '#e5e7eb'),
                            },
                            isSelected && {
                              backgroundColor: isDark ? 'rgba(244, 63, 94, 0.08)' : 'rgba(244, 63, 94, 0.04)',
                            },
                          ]}
                          onPress={() => setReason(item.key)}
                        >
                          <Text
                            style={[
                              styles.optionLabel,
                              { color: colors.foreground },
                              isSelected && { color: '#f43f5e', fontWeight: 'bold' },
                            ]}
                          >
                            {item.label}
                          </Text>
                          <View
                            style={[
                              styles.radioCircle,
                              { borderColor: colors.border },
                              isSelected && { borderColor: '#f43f5e' },
                            ]}
                          >
                            {isSelected && <View style={styles.radioDot} />}
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <Text style={[styles.sectionLabel, { color: colors.textMuted, marginTop: 16 }]}>
                    {t('report.details_label', 'CHI TIẾT PHẢN ÁNH (TÙY CHỌN)')}
                  </Text>
                  <TextInput
                    style={[
                      styles.textArea,
                      {
                        backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : '#f5f5f5',
                        color: colors.foreground,
                        borderColor: colors.border,
                      },
                    ]}
                    placeholder={t('report.details_placeholder', 'Nhập thêm chi tiết phản ánh...')}
                    placeholderTextColor={colors.textMuted}
                    multiline
                    numberOfLines={4}
                    value={details}
                    onChangeText={setDetails}
                  />

                  <View style={styles.buttonGroup}>
                    <TouchableOpacity style={[styles.cancelButton, { borderColor: colors.border }]} onPress={onClose} disabled={loading}>
                      <Text style={[styles.cancelButtonText, { color: colors.textSubtle }]}>{t('common.cancel', 'Hủy')}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.confirmButton} onPress={handleSubmit} disabled={loading}>
                      {loading ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : (
                        <Text style={styles.confirmButtonText}>{t('report.submit_button', 'GỬI BÁO CÁO')}</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              </View>
            </TouchableWithoutFeedback>
          </KeyboardAvoidingView>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  centeredView: {
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalView: {
    width: '100%',
    maxHeight: '90%',
    borderRadius: 28,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  header: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  scrollContent: {
    padding: 24,
    paddingTop: 16,
  },
  descText: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 1.2,
    marginBottom: 10,
  },
  optionsList: {
    gap: 8,
  },
  optionBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  optionLabel: {
    fontSize: 14,
  },
  radioCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#f43f5e',
  },
  textArea: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    fontSize: 14,
    height: 90,
    textAlignVertical: 'top',
    marginBottom: 20,
  },
  buttonGroup: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  cancelButton: {
    flex: 1,
    height: 52,
    borderWidth: 1,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  confirmButton: {
    flex: 1,
    height: 52,
    backgroundColor: '#f43f5e',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmButtonText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#fff',
  },
});

export default ReportModal;
