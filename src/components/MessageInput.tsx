import React, { useState } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  StyleSheet,
} from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { getThemeColors } from '../utils/themes';
import { MediaPicker } from './MediaPicker';
import { MediaPreview } from './MediaPreview';
import { Attachment } from '../types';

interface MessageInputProps {
  onSendMessage: (message: string, attachments?: Attachment[]) => void;
}

const MessageInput: React.FC<MessageInputProps> = ({ onSendMessage }) => {
  const [message, setMessage] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const { theme } = useTheme();
  const colors = getThemeColors(theme);

  const handleSend = () => {
    if (message.trim() || attachments.length > 0) {
      onSendMessage(message, attachments);
      setMessage('');
      setAttachments([]);
    }
  };

  const handleMediaSelected = (newAttachments: Attachment[]) => {
    setAttachments([...attachments, ...newAttachments]);
  };

  const handleRemoveAttachment = (attachmentId: string) => {
    setAttachments(attachments.filter(att => att.id !== attachmentId));
  };

  return (
    <View style={[styles.container, { 
      backgroundColor: colors.surface,
      borderTopColor: colors.border,
    }]}>
      <MediaPreview
        attachments={attachments}
        onRemoveAttachment={handleRemoveAttachment}
      />
      <View style={[styles.inputContainer, {
        backgroundColor: colors.inputBackground,
      }]}>
        <MediaPicker
          onMediaSelected={handleMediaSelected}
          color={colors.primary}
        />
        <TextInput
          style={[styles.textInput, { color: colors.text }]}
          value={message}
          onChangeText={setMessage}
          placeholder="メッセージを入力..."
          placeholderTextColor={colors.textSecondary}
          multiline
          maxLength={1000}
          returnKeyType="send"
          onSubmitEditing={handleSend}
          blurOnSubmit={false}
        />
        <TouchableOpacity
          style={[
            styles.sendButton,
            (message.trim() || attachments.length > 0)
              ? [styles.sendButtonActive, { backgroundColor: colors.primary }]
              : [styles.sendButtonInactive, { backgroundColor: colors.border }]
          ]}
          onPress={handleSend}
          disabled={!message.trim() && attachments.length === 0}
        >
          <Text style={[
            styles.sendButtonText,
            (message.trim() || attachments.length > 0)
              ? styles.sendButtonTextActive 
              : [styles.sendButtonTextInactive, { color: colors.textSecondary }]
          ]}>
            送信
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    minHeight: 40,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    lineHeight: 20,
    maxHeight: 100,
    paddingVertical: 8,
    paddingRight: 8,
  },
  sendButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    marginLeft: 8,
  },
  sendButtonActive: {},
  sendButtonInactive: {},
  sendButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  sendButtonTextActive: {
    color: '#FFFFFF',
  },
  sendButtonTextInactive: {},
});

export default MessageInput;