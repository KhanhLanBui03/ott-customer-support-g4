import React, { createContext, useContext, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const THEME_STORAGE_KEY = 'app_theme_mode';

export const COLORS = {
  light: {
    primary: '#6366f1',
    secondary: '#475569',
    background: '#ffffff',
    foreground: '#0f172a',
    sidebar: '#ffffff',
    border: '#f1f5f9',
    surface100: '#ffffff',
    surface200: '#f1f5f9',
    surface300: '#e2e8f0',
    textMuted: '#64748b',
    textSubtle: '#94a3b8',
    card: '#ffffff',
    input: '#f3f4f6',
    online: '#4ade80',
    error: '#ef4444',
  },
  dark: {
    primary: '#6366f1',
    secondary: '#94a3b8',
    background: '#0b0e14',
    foreground: '#f8fafc',
    sidebar: '#11141b',
    border: '#1e293b',
    surface100: '#11141b',
    surface200: '#1a1e26',
    surface300: '#2d3748',
    textMuted: '#94a3b8',
    textSubtle: '#64748b',
    card: '#11141b',
    input: '#1a1e26',
    online: '#10b981',
    error: '#ef4444',
  },
};

const ThemeContext = createContext({
  theme: 'light',
  isDark: false,
  colors: COLORS.light,
  toggleTheme: () => {},
  setTheme: () => {},
});

export const ThemeProvider = ({ children }) => {
  const systemColorScheme = useColorScheme();
  const [theme, setThemeState] = useState('light');

  useEffect(() => {
    const loadTheme = async () => {
      try {
        const savedTheme = await SecureStore.getItemAsync(THEME_STORAGE_KEY);
        if (savedTheme) {
          setThemeState(savedTheme);
        } else {
          setThemeState(systemColorScheme || 'light');
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
