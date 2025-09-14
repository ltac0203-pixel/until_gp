import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import HomeScreen from './src/screens/HomeScreen';
import GroupChatScreen from './src/screens/GroupChatScreen';
import ChatScreen from './src/screens/ChatScreen';
import ChatListScreen from './src/screens/ChatListScreen';
import { ThemeProvider } from './src/contexts/ThemeContext';

export type RootStackParamList = {
  Home: undefined;
  GroupChat: {
    groupId: string;
  };
  ChatList: undefined;
  Chat: {
    conversationId: string;
  };
};

const Stack = createStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <NavigationContainer>
          <Stack.Navigator
            initialRouteName="Home"
            screenOptions={{
              headerShown: false,
            }}
          >
            <Stack.Screen
              name="Home"
              component={HomeScreen}
            />
            <Stack.Screen
              name="GroupChat"
              component={GroupChatScreen}
            />
            <Stack.Screen
              name="ChatList"
              component={ChatListScreen}
            />
            <Stack.Screen
              name="Chat"
              component={ChatScreen}
            />
          </Stack.Navigator>
        </NavigationContainer>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}