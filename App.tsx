import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, Text, Platform, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import HomeScreen from './src/screens/HomeScreen';
import CreateGroupScreen from './src/screens/CreateGroupScreen';
import ArchiveScreen from './src/screens/ArchiveScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import GroupChatScreen from './src/screens/GroupChatScreen';
import { ThemeProvider, useTheme } from './src/contexts/ThemeContext';
import { getThemeColors } from './src/utils/themes';

export type RootStackParamList = {
  MainTabs: undefined;
  GroupChat: {
    groupId: string;
    isArchived?: boolean;
  };
};

export type TabParamList = {
  Home: undefined;
  Create: undefined;
  Archive: undefined;
  Settings: undefined;
};

const Stack = createStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

const TabIcon: React.FC<{ focused: boolean; emoji: string; label: string }> = ({ focused, emoji, label }) => {
  const { theme } = useTheme();
  const colors = getThemeColors(theme);

  return (
    <View style={styles.tabIconContainer}>
      <Text style={[
        styles.tabEmoji,
        { transform: [{ scale: focused ? 1.1 : 1 }] }
      ]}>
        {emoji}
      </Text>
      <Text style={[
        styles.tabLabel,
        {
          color: focused ? colors.primary : colors.textSecondary,
          fontWeight: focused ? '600' : '400'
        }
      ]}>
        {label}
      </Text>
    </View>
  );
};

const MainTabs: React.FC = () => {
  const { theme } = useTheme();
  const colors = getThemeColors(theme);

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: 'transparent',
          borderTopWidth: 0,
          elevation: 0,
          height: Platform.OS === 'ios' ? 90 : 70,
        },
        tabBarBackground: () => (
          <BlurView
            intensity={95}
            tint={theme}
            style={StyleSheet.absoluteFill}
          >
            <View style={[
              StyleSheet.absoluteFill,
              { backgroundColor: theme === 'dark' ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.3)' }
            ]} />
          </BlurView>
        ),
        tabBarShowLabel: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} emoji="🏠" label="ホーム" />
          ),
        }}
      />
      <Tab.Screen
        name="Create"
        component={CreateGroupScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} emoji="✨" label="作成" />
          ),
        }}
      />
      <Tab.Screen
        name="Archive"
        component={ArchiveScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} emoji="📚" label="アーカイブ" />
          ),
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} emoji="⚙️" label="設定" />
          ),
        }}
      />
    </Tab.Navigator>
  );
};

const AppContent: React.FC = () => {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="MainTabs"
        screenOptions={{
          headerShown: false,
        }}
      >
        <Stack.Screen
          name="MainTabs"
          component={MainTabs}
        />
        <Stack.Screen
          name="GroupChat"
          component={GroupChatScreen}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AppContent />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  tabIconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 8,
  },
  tabEmoji: {
    fontSize: 24,
    marginBottom: 4,
  },
  tabLabel: {
    fontSize: 10,
  },
});