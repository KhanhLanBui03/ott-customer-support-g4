import React from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  SafeAreaView, Switch,
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../../src/context/ThemeContext';

const SettingsScreen = () => {
  const { colors, isDark, toggleTheme } = useTheme();
  const router = useRouter();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.backBtn, { backgroundColor: isDark ? colors.surface300 : '#f1f5f9' }]}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Cài đặt</Text>
        <View style={{ width: 42 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        {/* ====== APPEARANCE ====== */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="color-palette-outline" size={20} color={colors.textSubtle} />
            <Text style={[styles.sectionTitle, { color: colors.textSubtle, marginLeft: 6 }]}>Giao diện</Text>
          </View>
          <View style={[styles.menuCard, { backgroundColor: colors.card }]}>
            <View style={styles.menuItem}>
              <View style={styles.menuItemLeft}>
                <Ionicons name={isDark ? 'moon' : 'sunny-outline'} size={20} color={isDark ? '#fbbf24' : '#f59e0b'} />
                <Text style={[styles.menuItemText, { color: colors.foreground }]}>Chế độ tối</Text>
              </View>
              <Switch
                value={isDark} onValueChange={toggleTheme}
                trackColor={{ false: '#d1d5db', true: '#818cf8' }}
                thumbColor={isDark ? '#6366f1' : '#f9fafb'}
                ios_backgroundColor="#d1d5db"
              />
            </View>
          </View>
        </View>

        {/* ====== NOTIFICATIONS ====== */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="notifications-outline" size={20} color={colors.textSubtle} />
            <Text style={[styles.sectionTitle, { color: colors.textSubtle, marginLeft: 6 }]}>Thông báo</Text>
          </View>
          <View style={[styles.menuCard, { backgroundColor: colors.card }]}>
            <View style={styles.menuItem}>
              <View style={styles.menuItemLeft}>
                <Ionicons name="chatbubble-outline" size={20} color={colors.textMuted} />
                <Text style={[styles.menuItemText, { color: colors.foreground }]}>Thông báo tin nhắn</Text>
              </View>
              <Switch value={true} trackColor={{ false: '#d1d5db', true: '#818cf8' }} thumbColor="#6366f1" ios_backgroundColor="#d1d5db" />
            </View>
            <View style={[styles.menuDivider, { backgroundColor: colors.border }]} />
            <View style={styles.menuItem}>
              <View style={styles.menuItemLeft}>
                <Ionicons name="volume-high-outline" size={20} color={colors.textMuted} />
                <Text style={[styles.menuItemText, { color: colors.foreground }]}>Âm thanh</Text>
              </View>
              <Switch value={true} trackColor={{ false: '#d1d5db', true: '#818cf8' }} thumbColor="#6366f1" ios_backgroundColor="#d1d5db" />
            </View>
          </View>
        </View>

        {/* ====== DATA ====== */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="server-outline" size={20} color={colors.textSubtle} />
            <Text style={[styles.sectionTitle, { color: colors.textSubtle, marginLeft: 6 }]}>Dữ liệu & Lưu trữ</Text>
          </View>
          <View style={[styles.menuCard, { backgroundColor: colors.card }]}>
            <TouchableOpacity style={styles.menuItem}>
              <View style={styles.menuItemLeft}>
                <Ionicons name="image-outline" size={20} color={colors.textMuted} />
                <Text style={[styles.menuItemText, { color: colors.foreground }]}>Tự động tải ảnh</Text>
              </View>
              <MaterialIcons name="chevron-right" size={20} color={colors.textSubtle} />
            </TouchableOpacity>
            <View style={[styles.menuDivider, { backgroundColor: colors.border }]} />
            <TouchableOpacity style={styles.menuItem}>
              <View style={styles.menuItemLeft}>
                <Ionicons name="videocam-outline" size={20} color={colors.textMuted} />
                <Text style={[styles.menuItemText, { color: colors.foreground }]}>Tự động tải video</Text>
              </View>
              <MaterialIcons name="chevron-right" size={20} color={colors.textSubtle} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ====== ABOUT ====== */}
        <View style={[styles.section, { marginBottom: 30 }]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="information-circle-outline" size={20} color={colors.textSubtle} />
            <Text style={[styles.sectionTitle, { color: colors.textSubtle, marginLeft: 6 }]}>Về ứng dụng</Text>
          </View>
          <View style={[styles.menuCard, { backgroundColor: colors.card }]}>
            <View style={styles.menuItem}>
              <View style={styles.menuItemLeft}>
                <Ionicons name="logo-react" size={20} color="#61dafb" />
                <Text style={[styles.menuItemText, { color: colors.foreground }]}>Phiên bản</Text>
              </View>
              <Text style={[styles.versionText, { color: colors.textSubtle }]}>1.0.0</Text>
            </View>
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
  section: { paddingHorizontal: 20, marginTop: 25 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, marginLeft: 4 },
  sectionTitle: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },

  menuCard: { borderRadius: 16, overflow: 'hidden' },
  menuItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  menuItemLeft: { flexDirection: 'row', alignItems: 'center' },
  menuItemText: { fontSize: 15, fontWeight: '500', marginLeft: 12 },
  menuDivider: { height: 1, marginHorizontal: 16 },
  versionText: { fontSize: 13, fontWeight: '500' },
});

export default SettingsScreen;
