import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme, Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { darkTheme, lightTheme, setActiveThemeName } from '../theme';

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const nativeScheme = useColorScheme();
  const [systemScheme, setSystemScheme] = useState(nativeScheme || Appearance.getColorScheme() || 'light');

  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      if (colorScheme) {
        setSystemScheme(colorScheme);
      }
    });

    const current = Appearance.getColorScheme();
    if (current) {
      setSystemScheme(current);
    }

    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (nativeScheme) {
      setSystemScheme(nativeScheme);
    }
  }, [nativeScheme]);

  const [themeMode, setThemeMode] = useState('system'); // 'light' | 'dark' | 'system'

  useEffect(() => {
    async function loadTheme() {
      try {
        const saved = await AsyncStorage.getItem('@ksk_theme_mode');
        if (saved) {
          setThemeMode(saved);
        }
      } catch (e) {
        console.error('Failed to load theme:', e);
      }
    }
    loadTheme();
  }, []);

  const selectTheme = async (mode) => {
    try {
      setThemeMode(mode);
      await AsyncStorage.setItem('@ksk_theme_mode', mode);
    } catch (e) {
      console.error('Failed to save theme:', e);
    }
  };

  const activeTheme = themeMode === 'system' ? systemScheme : themeMode;
  const colors = activeTheme === 'dark' ? darkTheme : lightTheme;

  // Sync the global active theme name synchronously during render to prevent lifecycle race conditions
  setActiveThemeName(activeTheme);

  return (
    <ThemeContext.Provider value={{ themeMode, selectTheme, colors, activeTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
