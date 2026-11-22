import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  Switch, Modal, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, Separator, Text as TText, XStack, YStack } from 'tamagui';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../src/context/ThemeContext';
import { useResponsive } from '../../src/hooks/useResponsive';
import Button from '../../src/components/common/Button';
import {
  loadNotificationPreferences,
  updateNotificationPreferences,
} from '../../src/utils/pushNotificationService';
import {
  RINGTONE_OPTIONS,
  NOTIFICATION_SOUND_OPTIONS,
  getRingtoneOption,
  getNotificationSoundOption,
  playSoundPreview,
  stopSoundPreview,
} from '../../src/utils/soundService';

const SettingsScreen = () => {
  const { colors, isDark, toggleTheme } = useTheme();
  const { isWideLayout, contentMaxWidth, modalMaxWidth } = useResponsive();
  const router = useRouter();
  const { t } = useTranslation();
  const [messageNotifications, setMessageNotifications] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [callRingtone, setCallRingtone] = useState('classic');
  const [notificationSound, setNotificationSound] = useState('default');
  const [pickerType, setPickerType] = useState(null); // 'ringtone' | 'notification' | null
  const [playingId, setPlayingId] = useState(null);

  useEffect(() => {
    loadNotificationPreferences().then((prefs) => {
      setMessageNotifications(prefs.messageNotifications);
      setSoundEnabled(prefs.soundEnabled);
      setCallRingtone(prefs.callRingtone || 'classic');
      setNotificationSound(prefs.notificationSound || 'default');
    });
    return () => stopSoundPreview();
  }, []);

  const handleToggleMessageNotifications = async (val) => {
    setMessageNotifications(val);
    await updateNotificationPreferences({ messageNotifications: val });
  };

  const handleToggleSound = async (val) => {
    setSoundEnabled(val);
    await updateNotificationPreferences({ soundEnabled: val });
  };

  const closePicker = () => {
    stopSoundPreview();
    setPlayingId(null);
    setPickerType(null);
  };

  const handleSelectOption = async (option) => {
    if (pickerType === 'ringtone') {
      setCallRingtone(option.id);
      await updateNotificationPreferences({ callRingtone: option.id });
      if (option.source) {
        setPlayingId(option.id);
        await playSoundPreview(option.source, { durationMs: 3200, loop: false });
      } else {
        stopSoundPreview();
        setPlayingId(null);
      }
    } else if (pickerType === 'notification') {
      setNotificationSound(option.id);
      await updateNotificationPreferences({ notificationSound: option.id });
      if (option.previewSource) {
        setPlayingId(option.id);
        await playSoundPreview(option.previewSource, { durationMs: 1800, loop: false });
      } else {
        stopSoundPreview();
        setPlayingId(null);
      }
    }
  };

  const selectedRingtoneOpt = getRingtoneOption(callRingtone);
  const selectedNotifOpt = getNotificationSoundOption(notificationSound);
  const activeOptions = pickerType === 'ringtone' ? RINGTONE_OPTIONS : NOTIFICATION_SOUND_OPTIONS;
  const activeValue = pickerType === 'ringtone' ? callRingtone : notificationSound;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.backBtn, { backgroundColor: isDark ? colors.surface300 : '#f1f5f9' }]}
          onPress={() => router.replace('/(main)/profile')}
        >
          <Ionicons name="arrow-back" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>{t('settings.title')}</Text>
        <View style={{ width: 42 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120, alignItems: 'center' }}>
        <YStack width="100%" maxWidth={isWideLayout ? Math.min(contentMaxWidth, 720) : '100%'} alignSelf="center">
        {/* ====== APPEARANCE ====== */}
        <YStack paddingHorizontal={20} marginTop={22}>
          <XStack alignItems="center" marginBottom={10} marginLeft={4} gap={6}>
            <Ionicons name="color-palette-outline" size={20} color={colors.textSubtle} />
            <TText fontSize={12} fontWeight="700" color={colors.textSubtle} textTransform="uppercase">{t('settings.appearance')}</TText>
          </XStack>
          <Card backgroundColor={colors.card} borderRadius={16} overflow="hidden" borderWidth={1} borderColor={colors.border}>
            <View style={styles.menuItem}>
              <View style={styles.menuItemLeft}>
                <Ionicons name={isDark ? 'moon' : 'sunny-outline'} size={20} color={isDark ? '#fbbf24' : '#f59e0b'} />
                <Text style={[styles.menuItemText, { color: colors.foreground }]}>{isDark ? t('chat.tooltip_light_mode') : t('chat.tooltip_dark_mode')}</Text>
              </View>
              <Switch
                value={isDark} onValueChange={toggleTheme}
                trackColor={{ false: '#64748B', true: '#60A5FA' }}
                thumbColor={isDark ? '#3B82F6' : '#f9fafb'}
                ios_backgroundColor="#64748B"
              />
            </View>

            <Separator borderColor={colors.border} />

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => router.push('/language-settings')}
            >
              <View style={styles.menuItemLeft}>
                <Ionicons name="language-outline" size={20} color="#3b82f6" />
                <Text style={[styles.menuItemText, { color: colors.foreground }]}>{t('settings.language_title')}</Text>
              </View>
              <MaterialIcons name="chevron-right" size={20} color={colors.textSubtle} />
            </TouchableOpacity>
          </Card>
        </YStack>

        {/* ====== NOTIFICATIONS ====== */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="notifications-outline" size={20} color={colors.textSubtle} />
            <Text style={[styles.sectionTitle, { color: colors.textSubtle, marginLeft: 6 }]}>{t('settings.notifications')}</Text>
          </View>
          <View style={[styles.menuCard, { backgroundColor: colors.card }]}>
            <View style={styles.menuItem}>
              <View style={styles.menuItemLeft}>
                <Ionicons name="chatbubble-outline" size={20} color={colors.textMuted} />
                <Text style={[styles.menuItemText, { color: colors.foreground }]}>{t('settings.message_notifications')}</Text>
              </View>
              <Switch
                value={messageNotifications}
                onValueChange={handleToggleMessageNotifications}
                trackColor={{ false: '#64748B', true: '#60A5FA' }}
                thumbColor={messageNotifications ? '#3B82F6' : '#f9fafb'}
                ios_backgroundColor="#64748B"
              />
            </View>
            <View style={[styles.menuDivider, { backgroundColor: colors.border }]} />
            <View style={styles.menuItem}>
              <View style={styles.menuItemLeft}>
                <Ionicons name="volume-high-outline" size={20} color={colors.textMuted} />
                <Text style={[styles.menuItemText, { color: colors.foreground }]}>{t('settings.sounds')}</Text>
              </View>
              <Switch
                value={soundEnabled}
                onValueChange={handleToggleSound}
                trackColor={{ false: '#64748B', true: '#60A5FA' }}
                thumbColor={soundEnabled ? '#3B82F6' : '#f9fafb'}
                ios_backgroundColor="#64748B"
              />
            </View>
            <View style={[styles.menuDivider, { backgroundColor: colors.border }]} />
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => setPickerType('notification')}
            >
              <View style={styles.menuItemLeft}>
                <Ionicons name="notifications-outline" size={20} color={colors.primary} />
                <Text style={[styles.menuItemText, { color: colors.foreground }]}>
                  {t('settings.notification_sound', 'Âm thanh thông báo')}
                </Text>
              </View>
              <View style={styles.menuItemRight}>
                <Text style={[styles.selectedValueText, { color: colors.textSubtle }]} numberOfLines={1}>
                  {t(selectedNotifOpt.labelKey, selectedNotifOpt.fallbackLabel)}
                </Text>
                <MaterialIcons name="chevron-right" size={20} color={colors.textSubtle} />
              </View>
            </TouchableOpacity>
            <View style={[styles.menuDivider, { backgroundColor: colors.border }]} />
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => setPickerType('ringtone')}
            >
              <View style={styles.menuItemLeft}>
                <Ionicons name="musical-notes-outline" size={20} color="#10b981" />
                <Text style={[styles.menuItemText, { color: colors.foreground }]}>
                  {t('settings.call_ringtone', 'Nhạc chuông cuộc gọi')}
                </Text>
              </View>
              <View style={styles.menuItemRight}>
                <Text style={[styles.selectedValueText, { color: colors.textSubtle }]} numberOfLines={1}>
                  {t(selectedRingtoneOpt.labelKey, selectedRingtoneOpt.fallbackLabel)}
                </Text>
                <MaterialIcons name="chevron-right" size={20} color={colors.textSubtle} />
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* ====== DATA ====== */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="server-outline" size={20} color={colors.textSubtle} />
            <Text style={[styles.sectionTitle, { color: colors.textSubtle, marginLeft: 6 }]}>{t('settings.data_storage')}</Text>
          </View>
          <View style={[styles.menuCard, { backgroundColor: colors.card }]}>
            <TouchableOpacity style={styles.menuItem}>
              <View style={styles.menuItemLeft}>
                <Ionicons name="image-outline" size={20} color={colors.textMuted} />
                <Text style={[styles.menuItemText, { color: colors.foreground }]}>{t('settings.auto_download_images')}</Text>
              </View>
              <MaterialIcons name="chevron-right" size={20} color={colors.textSubtle} />
            </TouchableOpacity>
            <View style={[styles.menuDivider, { backgroundColor: colors.border }]} />
            <TouchableOpacity style={styles.menuItem}>
              <View style={styles.menuItemLeft}>
                <Ionicons name="videocam-outline" size={20} color={colors.textMuted} />
                <Text style={[styles.menuItemText, { color: colors.foreground }]}>{t('settings.auto_download_videos')}</Text>
              </View>
              <MaterialIcons name="chevron-right" size={20} color={colors.textSubtle} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ====== ABOUT ====== */}
        <View style={[styles.section, { marginBottom: 30 }]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="information-circle-outline" size={20} color={colors.textSubtle} />
            <Text style={[styles.sectionTitle, { color: colors.textSubtle, marginLeft: 6 }]}>{t('settings.about')}</Text>
          </View>
          <View style={[styles.menuCard, { backgroundColor: colors.card }]}>
            <View style={styles.menuItem}>
              <View style={styles.menuItemLeft}>
                <Ionicons name="logo-react" size={20} color="#61dafb" />
                <Text style={[styles.menuItemText, { color: colors.foreground }]}>{t('settings.version')}</Text>
              </View>
              <Text style={[styles.versionText, { color: colors.textSubtle }]}>1.0.0</Text>
            </View>
          </View>
        </View>
        </YStack>
      </ScrollView>

      {/* ====== SOUND / RINGTONE PICKER MODAL ====== */}
      <Modal
        visible={Boolean(pickerType)}
        transparent
        animationType="slide"
        onRequestClose={closePicker}
      >
        <Pressable style={styles.modalOverlay} onPress={closePicker}>
          <Pressable
            style={[
              styles.modalSheet,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                width: '100%',
                maxWidth: isWideLayout ? modalMaxWidth : '100%',
                alignSelf: 'center',
              },
            ]}
            onPress={() => {}}
          >
            <View style={styles.modalHandle} />
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <View style={styles.modalTitleRow}>
                <Ionicons
                  name={pickerType === 'ringtone' ? 'musical-notes' : 'notifications'}
                  size={20}
                  color={pickerType === 'ringtone' ? '#10b981' : '#6366f1'}
                />
                <Text style={[styles.modalTitle, { color: colors.foreground }]}>
                  {pickerType === 'ringtone'
                    ? t('settings.call_ringtone', 'Nhạc chuông cuộc gọi')
                    : t('settings.notification_sound', 'Âm thanh thông báo')}
                </Text>
              </View>
              <TouchableOpacity onPress={closePicker} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.modalHint, { color: colors.textSubtle }]}>
              {t('settings.sound_tap_preview', 'Chạm vào từng mục để nghe thử và áp dụng ngay')}
            </Text>

            <ScrollView style={styles.modalList} showsVerticalScrollIndicator={false}>
              {activeOptions.map((opt, idx) => {
                const isSelected = activeValue === opt.id;
                const isPlaying = playingId === opt.id;
                const isSilent = opt.id === 'silent';
                return (
                  <View key={opt.id}>
                    <TouchableOpacity
                      style={[
                        styles.optionRow,
                        isSelected && { backgroundColor: isDark ? 'rgba(59,130,246,0.16)' : '#EFF6FF' },
                      ]}
                      onPress={() => handleSelectOption(opt)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.optionLeft}>
                        <View
                          style={[
                            styles.optionIconCircle,
                            {
                              backgroundColor: isSelected
                                ? colors.primary
                                : (isDark ? colors.surface300 : '#f1f5f9'),
                            },
                          ]}
                        >
                          <Ionicons
                            name={isSilent ? 'volume-mute-outline' : (isPlaying ? 'volume-high' : 'musical-note-outline')}
                            size={18}
                            color={isSelected ? '#ffffff' : colors.textMuted}
                          />
                        </View>
                        <Text
                          style={[
                            styles.optionLabel,
                            { color: colors.foreground },
                            isSelected && { fontWeight: '700', color: isDark ? '#60A5FA' : '#2563EB' },
                          ]}
                        >
                          {t(opt.labelKey, opt.fallbackLabel)}
                        </Text>
                      </View>

                      {isSelected ? (
                        <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
                      ) : (
                        <Ionicons name="radio-button-off" size={20} color={colors.textSubtle} />
                      )}
                    </TouchableOpacity>
                    {idx < activeOptions.length - 1 && (
                      <View style={[styles.menuDivider, { backgroundColor: colors.border }]} />
                    )}
                  </View>
                );
              })}
            </ScrollView>

            <Button
              title={t('common.close', 'Đóng')}
              onPress={closePicker}
              fullWidth
              size="md"
              style={{ marginTop: 14 }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1,
  },
  backBtn: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  section: { paddingHorizontal: 20, marginTop: 25 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, marginLeft: 4 },
  sectionTitle: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },

  menuCard: { borderRadius: 16, overflow: 'hidden' },
  menuItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  menuItemLeft: { flexDirection: 'row', alignItems: 'center', flexShrink: 1 },
  menuItemRight: { flexDirection: 'row', alignItems: 'center', maxWidth: '48%', marginLeft: 8 },
  menuItemText: { fontSize: 15, fontWeight: '500', marginLeft: 12 },
  selectedValueText: { fontSize: 13, marginRight: 4 },
  menuDivider: { height: 1, marginHorizontal: 16 },
  versionText: { fontSize: 13, fontWeight: '500' },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    paddingBottom: 28,
    maxHeight: '75%',
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#cbd5e1',
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 6,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  modalTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  modalTitle: { fontSize: 17, fontWeight: '700' },
  modalCloseBtn: { padding: 4 },
  modalHint: { fontSize: 12, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 6 },
  modalList: { paddingHorizontal: 12, marginTop: 4 },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  optionLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 10 },
  optionIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  optionLabel: { fontSize: 15, fontWeight: '500' },
  modalDoneBtn: {
    marginHorizontal: 20,
    marginTop: 14,
    backgroundColor: '#6366f1',
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: 'center',
  },
  modalDoneText: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
});

export default SettingsScreen;
