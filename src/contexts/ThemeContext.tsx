import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Theme, SlowMailSettings } from '../types';
import { StorageService } from '../services/storage';

interface ThemeContextType {
  theme: Theme;
  settings: SlowMailSettings;
  toggleTheme: () => void;
  updateSettings: (settings: Partial<SlowMailSettings>) => void;
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
  const [settings, setSettings] = useState<SlowMailSettings>({
    deliveryDelay: 5000,
    theme: 'light',
    enableHaptics: true,
    enableTypingIndicator: true,
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

  const updateSettings = async (newSettings: Partial<SlowMailSettings>) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    await StorageService.saveSettings(updated);
  };

  return (
    <ThemeContext.Provider 
      value={{ 
        theme: settings.theme, 
        settings,
        toggleTheme,
        updateSettings,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};