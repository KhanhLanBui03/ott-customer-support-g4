/**
 * Premium Theme System
 * Defines colors, typography, and spacing for Light and Dark modes.
 */

export const COLORS = {
  primary: '#6366f1', // Indigo 500
  primaryDark: '#4f46e5', // Indigo 600
  secondary: '#ec4899', // Pink 500
  accent: '#8b5cf6', // Violet 500
  
  // Light Mode
  light: {
    background: '#ffffff',
    surface: '#f9fafb',
    surfaceSecondary: '#f3f4f6',
    border: '#e5e7eb',
    text: '#111827',
    textSecondary: '#6b7280',
    textMuted: '#9ca3af',
    bubbleOwn: '#6366f1',
    bubbleOther: '#f3f4f6',
    textOwn: '#ffffff',
    textOther: '#111827',
    shadow: '#000000',
  },
  
  // Dark Mode
  dark: {
    background: '#0f172a', // Slate 900
    surface: '#1e293b', // Slate 800
    surfaceSecondary: '#334155', // Slate 700
    border: '#334155',
    text: '#f8fafc',
    textSecondary: '#94a3b8',
    textMuted: '#64748b',
    bubbleOwn: '#6366f1',
    bubbleOther: '#1e293b',
    textOwn: '#ffffff',
    textOther: '#f8fafc',
    shadow: '#000000',
  },

  // Semantic
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
  info: '#3b82f6',
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const RADIUS = {
  sm: 4,
  md: 8,
  lg: 16,
  xl: 24,
  full: 9999,
};

export const SHADOWS = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.18,
    shadowRadius: 1.0,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
};

export default {
  COLORS,
  SPACING,
  RADIUS,
  SHADOWS,
};
