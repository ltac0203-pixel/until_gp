import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Text,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MessageList from '../components/MessageList';
import MessageInput from '../components/MessageInput';
import EditMessageModal from '../components/EditMessageModal';
import ReactionPicker from '../components/ReactionPicker';
import { Message, MessageStatus, Conversation, Attachment } from '../types';
import { useTheme } from '../contexts/ThemeContext';
import { getThemeColors } from '../utils/themes';
import { StorageService } from '../services/storage';
import { MediaStorageService } from '../services/mediaStorage';
import * as Haptics from 'expo-haptics';

interface ChatScreenProps {
  navigation: any;
  route: {
    params: {
      conversationId: string;
    };
  };
}

const ChatScreen: React.FC<ChatScreenProps> = ({ navigation, route }) => {
  const { conversationId } = route.params;
  const { theme, settings, toggleTheme, updateSettings } = useTheme();
  const colors = getThemeColors(theme);
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [reactionTarget, setReactionTarget] = useState<Message | null>(null);

  useEffect(() => {
    loadConversation();
  }, [conversationId]);

  useEffect(() => {
    if (conversation) {
      saveConversation();
    }
  }, [messages]);

  const loadConversation = async () => {
    const loadedConversation = await StorageService.loadConversation(conversationId);
    if (loadedConversation) {
      setConversation(loadedConversation);
      setMessages(loadedConversation.messages);
      // Mark all messages as read when entering the conversation
      await StorageService.markConversationAsRead(conversationId);
    }
  };

  const saveConversation = async () => {
    if (conversation) {
      const updatedConversation: Conversation = {
        ...conversation,
        messages,
        lastMessage: messages[messages.length - 1],
        lastActivity: new Date(),
      };
      await StorageService.saveConversation(updatedConversation);
      setConversation(updatedConversation);
    }
  };

  const handleSendMessage = async (text: string, attachments?: Attachment[]) => {
    if (text.trim() || (attachments && attachments.length > 0)) {
      const messageId = Date.now().toString();
      
      // Save attachments to local storage
      let savedAttachments: Attachment[] | undefined;
      if (attachments && attachments.length > 0) {
        savedAttachments = await MediaStorageService.saveAttachments(attachments);
      }
      
      const newMessage: Message = {
        id: messageId,
        text: text.trim(),
        timestamp: new Date(),
        isOwnMessage: true,
        sender: 'あなた',
        status: 'pending',
        isEditable: true,
        attachments: savedAttachments,
      };
      
      setMessages(prev => [...prev, newMessage]);
      
      if (settings.enableHaptics) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      
      // Immediate transition to sent, then read
      setTimeout(() => {
        setMessages(prev => prev.map(msg => 
          msg.id === messageId 
            ? { ...msg, status: 'sent' as MessageStatus, isEditable: false }
            : msg
        ));
        
        setTimeout(() => {
          setMessages(prev => prev.map(msg => 
            msg.id === messageId 
              ? { ...msg, status: 'read' as MessageStatus }
              : msg
          ));
        }, 1000);
      }, 500);
    }
  };

  const handleLongPressMessage = (message: Message) => {
    if (message.isOwnMessage && message.isEditable && message.status === 'pending') {
      setEditingMessage(message);
      if (settings.enableHaptics) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
    } else if (!message.isOwnMessage || message.status !== 'pending') {
      setReactionTarget(message);
      if (settings.enableHaptics) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    }
  };

  const handleEditMessage = (messageId: string, newText: string) => {
    setMessages(prev => prev.map(msg => 
      msg.id === messageId 
        ? { 
            ...msg, 
            text: newText, 
            editedAt: new Date(),
            originalText: msg.originalText || msg.text 
          }
        : msg
    ));
  };

  const handleCancelMessage = (messageId: string) => {
    setMessages(prev => prev.filter(msg => msg.id !== messageId));
    if (settings.enableHaptics) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const handleAddReaction = (emoji: string) => {
    if (reactionTarget) {
      setMessages(prev => prev.map(msg => {
        if (msg.id === reactionTarget.id) {
          const existingReactions = msg.reactions || [];
          const userReaction = existingReactions.find(r => r.userId === 'current-user');
          
          if (userReaction && userReaction.emoji === emoji) {
            return {
              ...msg,
              reactions: existingReactions.filter(r => r.userId !== 'current-user')
            };
          } else {
            const filteredReactions = existingReactions.filter(r => r.userId !== 'current-user');
            return {
              ...msg,
              reactions: [...filteredReactions, {
                emoji,
                userId: 'current-user',
                timestamp: new Date()
              }]
            };
          }
        }
        return msg;
      }));
      
      if (settings.enableHaptics) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    }
  };

  const showSettings = () => {
    Alert.alert(
      '設定',
      '',
      [
        {
          text: `テーマ: ${theme === 'light' ? 'ライト' : 'ダーク'}`,
          onPress: toggleTheme,
        },
        {
          text: `触覚フィードバック: ${settings.enableHaptics ? 'ON' : 'OFF'}`,
          onPress: () => updateSettings({ enableHaptics: !settings.enableHaptics }),
        },
        { text: '閉じる', style: 'cancel' },
      ]
    );
  };

  return (
    <SafeAreaView 
      style={[styles.container, { backgroundColor: colors.background }]} 
      edges={['bottom']}
    >
      <View style={[styles.header, { backgroundColor: colors.headerBackground }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={[styles.backIcon, { color: colors.headerText }]}>←</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.headerText }]}>
          {conversation?.title || 'チャット'}
        </Text>
        <TouchableOpacity onPress={showSettings} style={styles.settingsButton}>
          <Text style={[styles.settingsIcon, { color: colors.headerText }]}>⚙️</Text>
        </TouchableOpacity>
      </View>
      
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <MessageList 
          messages={messages}
          onLongPress={handleLongPressMessage}
          onReactionPress={setReactionTarget}
        />
        <MessageInput onSendMessage={handleSendMessage} />
      </KeyboardAvoidingView>
      
      <EditMessageModal
        visible={editingMessage !== null}
        message={editingMessage}
        onClose={() => setEditingMessage(null)}
        onEdit={handleEditMessage}
        onCancel={handleCancelMessage}
      />
      
      <ReactionPicker
        visible={reactionTarget !== null}
        onClose={() => setReactionTarget(null)}
        onSelectReaction={handleAddReaction}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 3,
  },
  backButton: {
    padding: 8,
  },
  backIcon: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
  },
  settingsButton: {
    padding: 8,
  },
  settingsIcon: {
    fontSize: 20,
  },
});

export default ChatScreen;