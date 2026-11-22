import React, { createContext, useContext, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const THEME_STORAGE_KEY = 'app_theme_mode';

export const COLORS = {
  light: {
    primary: '#2563EB',
    primaryBright: '#3B82F6',
    primaryText: '#1D4ED8',
    onPrimary: '#FFFFFF',
    aiAccent: '#6366F1',
    aiSurface: '#EEF2FF',
    aiBorder: 'rgba(99, 102, 241, 0.28)',
    secondary: '#475569',
    background: '#F6F8FA',
    foreground: '#0F172A',
    sidebar: '#FFFFFF',
    border: '#DCE3EC',
    surface100: '#FFFFFF',
    surface200: '#EEF2F6',
    surface300: '#E2E8F0',
    textMuted: '#475569',
    textSubtle: '#64748B',
    card: '#FFFFFF',
    input: '#EEF2F6',
    online: '#10B981',
    warning: '#D97706',
    error: '#DC2626',
    ownBubbleBg: '#2563EB',
    ownBubbleBorder: '#1D4ED8',
    ownBubbleText: '#FFFFFF',
    otherBubbleBg: '#FFFFFF',
    otherBubbleBorder: '#DCE3EC',
  },
  dark: {
    primary: '#3B82F6',
    primaryBright: '#60A5FA',
    primaryText: '#60A5FA',
    onPrimary: '#FFFFFF',
    aiAccent: '#818CF8',
    aiSurface: 'rgba(129, 140, 248, 0.12)',
    aiBorder: 'rgba(129, 140, 248, 0.38)',
    secondary: '#B8B3B0',
    background: '#050507',
    foreground: '#F2F2F2',
    sidebar: '#0B0C10',
    border: '#2E2C2E',
    surface100: '#101013',
    surface200: '#18181D',
    surface300: '#23232A',
    textMuted: '#B8B3B0',
    textSubtle: '#8B949E',
    card: '#101013',
    input: '#16161B',
    online: '#10B981',
    warning: '#FFBA00',
    error: '#FB565B',
    ownBubbleBg: '#0D2240',
    ownBubbleBorder: '#3B82F6',
    ownBubbleText: '#F2F2F2',
    otherBubbleBg: '#141418',
    otherBubbleBorder: '#2E2C2E',
  },
};

const ThemeContext = createContext({
  theme: 'dark',
  isDark: true,
  colors: COLORS.dark,
  toggleTheme: () => {},
  setTheme: () => {},
});

export const ThemeProvider = ({ children }) => {
  const systemColorScheme = useColorScheme();
  const [theme, setThemeState] = useState('dark');

  useEffect(() => {
    const loadTheme = async () => {
      try {
        const savedTheme = await SecureStore.getItemAsync(THEME_STORAGE_KEY);
        if (savedTheme) {
          setThemeState(savedTheme);
        } else {
          setThemeState(systemColorScheme || 'dark');
        }
      } catch (e) {
        console.error('Failed to load theme', e);
      }
    };
    loadTheme();
  }, [systemColorScheme]);

  const setTheme = async (newTheme) => {
    setThemeState(newTheme);
    await SecureStore.setItemAsync(THEME_STORAGE_KEY, newTheme);
  };

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
  };

  const isDark = theme === 'dark';
  const colors = isDark ? COLORS.dark : COLORS.light;

  return (
    <ThemeContext.Provider value={{ theme, isDark, colors, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
