import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Theme, GroupbySettings } from '../types';
import { StorageService } from '../services/storage';

interface ThemeContextType {
  theme: Theme;
  settings: GroupbySettings;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  updateSettings: (settings: Partial<GroupbySettings>) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [settings, setSettings] = useState<GroupbySettings>({
    theme: 'light',
    enableHaptics: true,
    enableTypingIndicator: true,
    defaultGroupLifespan: '24_hours',
    showExpirationWarnings: true,
    archiveRetentionDays: 30,
    autoJoinSuggestions: false,
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const savedSettings = await StorageService.loadSettings();
    setSettings(savedSettings);
  };

  const toggleTheme = () => {
    const newTheme = settings.theme === 'light' ? 'dark' : 'light';
    updateSettings({ theme: newTheme });
  };

  const setTheme = (theme: Theme) => {
    updateSettings({ theme });
  };

  const updateSettings = async (newSettings: Partial<GroupbySettings>) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    await StorageService.saveSettings(updated);
  };

  return (
    <ThemeContext.Provider
      value={{
        theme: settings.theme,
        settings,
        setTheme,
        toggleTheme,
        updateSettings,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};