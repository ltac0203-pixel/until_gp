import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { getThemeColors } from '../utils/themes';
import { AuthScreen } from '../screens/AuthScreen';
import { MigrationScreen } from '../screens/MigrationScreen';
import { dataMigration } from '../utils/dataMigration';

interface AppWrapperProps {
  children: React.ReactNode;
}

export const AppWrapper: React.FC<AppWrapperProps> = ({ children }) => {
  const [appState, setAppState] = useState<'loading' | 'auth' | 'migration' | 'app'>('loading');
  const [migrationStatus, setMigrationStatus] = useState({
    needsMigration: false,
    hasLegacyData: false,
    userExists: false,
  });

  const { isAuthenticated, loading: authLoading } = useAuth();
  const { theme } = useTheme();
  const colors = getThemeColors(theme);

  useEffect(() => {
    checkAppState();
  }, [isAuthenticated, authLoading]);

  const checkAppState = async () => {
    // Wait for auth to initialize
    if (authLoading) {
      setAppState('loading');
      return;
    }

    try {
      // Check migration status
      const status = await dataMigration.checkMigrationStatus();
      setMigrationStatus(status);

      // Check if migration was already completed
      const migrationCompleted = await dataMigration.isMigrationCompleted();

      if (!isAuthenticated) {
        setAppState('auth');
      } else if (status.hasLegacyData && !migrationCompleted) {
        setAppState('migration');
      } else {
        setAppState('app');
      }
    } catch (error) {
      console.error('Error checking app state:', error);
      // Default to auth if there's an error
      setAppState(isAuthenticated ? 'app' : 'auth');
    }
  };

  const handleAuthComplete = async () => {
    // Re-check migration status after authentication
    const status = await dataMigration.checkMigrationStatus();
    const migrationCompleted = await dataMigration.isMigrationCompleted();

    if (status.hasLegacyData && !migrationCompleted) {
      setAppState('migration');
    } else {
      setAppState('app');
    }
  };

  const handleMigrationComplete = () => {
    setAppState('app');
  };

  const handleSkipMigration = () => {
    setAppState('app');
  };

  // Show loading screen while determining app state
  if (appState === 'loading') {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // Show authentication screen
  if (appState === 'auth') {
    return <AuthScreen onAuthComplete={handleAuthComplete} />;
  }

  // Show migration screen
  if (appState === 'migration') {
    return (
      <MigrationScreen
        onMigrationComplete={handleMigrationComplete}
        onSkipMigration={handleSkipMigration}
      />
    );
  }

  // Show main app
  return <>{children}</>;
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});