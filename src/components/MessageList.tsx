import React, { useEffect, useRef } from 'react';
import {
  FlatList,
  StyleSheet,
  View,
} from 'react-native';
import MessageBubble from './MessageBubble';
import { Message } from '../types';
import { useTheme } from '../contexts/ThemeContext';
import { getThemeColors } from '../utils/themes';

interface MessageListProps {
  messages: Message[];
  onLongPress?: (message: Message) => void;
  onReactionPress?: (message: Message) => void;
}

const MessageList: React.FC<MessageListProps> = ({ 
  messages,
  onLongPress,
  onReactionPress,
}) => {
  const flatListRef = useRef<FlatList>(null);
  const { theme } = useTheme();
  const colors = getThemeColors(theme);

  useEffect(() => {
    // Auto-scroll to bottom when new messages arrive
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  const renderMessage = ({ item }: { item: Message }) => (
    <MessageBubble 
      message={item}
      onLongPress={onLongPress}
      onReactionPress={onReactionPress}
    />
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        style={[styles.messagesList, { backgroundColor: colors.background }]}
        contentContainerStyle={styles.messagesContainer}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  messagesList: {
    flex: 1,
  },
  messagesContainer: {
    padding: 16,
    paddingBottom: 8,
  },
});

export default MessageList;