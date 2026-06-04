import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  SafeAreaView, ActivityIndicator,
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../src/context/ThemeContext';
import axiosClient from '../../src/api/axiosClient';
import { updateUser } from '../../src/store/authSlice';

const LANGUAGES = [
  { code: "vie_Latn", label: "Tiếng Việt", flag: "🇻🇳", i18nCode: 'vi' },
  { code: "eng_Latn", label: "English", flag: "🇬🇧", i18nCode: 'en' },
  { code: "zho_Hans", label: "中文", flag: "🇨🇳", i18nCode: 'zh' },
  { code: "jpn_Jpan", label: "日本語", flag: "🇯🇵", i18nCode: 'ja' },
  { code: "kor_Hang", label: "한국어", flag: "🇰🇷", i18nCode: 'ko' },
  { code: "fra_Latn", label: "Français", flag: "🇫🇷", i18nCode: 'fr' },
];

const LANGUAGE_MAP = {
  'vie_Latn': 'vi',
  'eng_Latn': 'en',
  'zho_Hans': 'zh',
  'jpn_Jpan': 'ja',
  'kor_Hang': 'ko',
  'fra_Latn': 'fr',
};

const LanguageSettingsScreen = () => {
  const { colors, isDark } = useTheme();
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const dispatch = useDispatch();
  const user = useSelector(state => state.auth.user);

  const [selectedLanguage, setSelectedLanguage] = useState(user?.preferredLanguage || null);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    fetchLanguageSettings();
  }, []);

  const fetchLanguageSettings = async () => {
    try {
      const res = await axiosClient.get("/settings/language");
      const langData = res.data?.preferredLanguage || res.preferredLanguage;
      const normalized = (langData === "" || langData === undefined || langData === "null") ? null : langData;

      setSelectedLanguage(normalized);
      if (normalized) {
          dispatch(updateUser({ preferredLanguage: normalized }));
      }
    } catch (err) {
      console.error("Failed to fetch language settings", err);
    } finally {
      setFetching(false);
    }
  };

  const handleUpdateLanguage = async (code) => {
    setLoading(true);
    try {
      await axiosClient.put("/settings/language", { preferredLanguage: code });
      setSelectedLanguage(code);
      dispatch(updateUser({ preferredLanguage: code }));

      // Update i18n
      const i18nCode = LANGUAGE_MAP[code] || 'en';
      i18n.changeLanguage(i18nCode);
    } catch (error) {
      console.error("Failed to update language", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDisableTranslation = async () => {
    setLoading(true);
    try {
      await axiosClient.put("/settings/language", { preferredLanguage: null });
      setSelectedLanguage(null);
      dispatch(updateUser({ preferredLanguage: null }));
    } catch (error) {
      console.error("Failed to disable translation", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.backBtn, { backgroundColor: isDark ? colors.surface300 : '#f1f5f9' }]}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>
          {t('settings.language_title')}
        </Text>
        <View style={{ width: 42 }}>
          {loading && <ActivityIndicator size="small" color={colors.primary} />}
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={[styles.hintText, { color: colors.textSubtle }]}>
            {t('settings.auto_translate_msg')}
          </Text>

          <View style={[styles.menuCard, { backgroundColor: colors.card }]}>
            {/* Disable translation option */}
            <TouchableOpacity
              style={styles.menuItem}
              onPress={handleDisableTranslation}
              disabled={loading}
            >
              <View style={styles.menuItemLeft}>
                <View style={[styles.iconContainer, { backgroundColor: isDark ? colors.surface300 : '#f1f5f9' }]}>
                  <Text style={{ fontSize: 18 }}>🚫</Text>
                </View>
                <Text style={[styles.menuItemText, { color: colors.foreground }]}>
                  {t('settings.disable_auto_translate')}
                </Text>
              </View>
              {!selectedLanguage && (
                <Ionicons name="checkmark-circle" size={24} color="#10b981" />
              )}
            </TouchableOpacity>

            <View style={[styles.menuDivider, { backgroundColor: colors.border }]} />

            {/* Language list */}
            {LANGUAGES.map((lang, index) => (
              <React.Fragment key={lang.code}>
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => handleUpdateLanguage(lang.code)}
                  disabled={loading}
                >
                  <View style={styles.menuItemLeft}>
                    <View style={[styles.iconContainer, { backgroundColor: isDark ? colors.surface300 : '#f1f5f9' }]}>
                      <Text style={{ fontSize: 18 }}>{lang.flag}</Text>
                    </View>
                    <Text style={[styles.menuItemText, { color: colors.foreground }]}>
                      {lang.label}
                    </Text>
                  </View>
                  {selectedLanguage === lang.code && (
                    <Ionicons name="checkmark-circle" size={24} color="#10b981" />
                  )}
                </TouchableOpacity>
                {index < LANGUAGES.length - 1 && (
                  <View style={[styles.menuDivider, { backgroundColor: colors.border }]} />
                )}
              </React.Fragment>
            ))}
          </View>
        </View>
      </ScrollView>
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
  section: { paddingHorizontal: 20, marginTop: 20 },
  hintText: { fontSize: 14, marginBottom: 20, lineHeight: 20 },
  menuCard: { borderRadius: 16, overflow: 'hidden', marginBottom: 30 },
  menuItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14
  },
  menuItemLeft: { flexDirection: 'row', alignItems: 'center' },
  iconContainer: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', marginRight: 12
  },
  menuItemText: { fontSize: 16, fontWeight: '500' },
  menuDivider: { height: 1, marginHorizontal: 16 },
});

export default LanguageSettingsScreen;
