import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Message } from '../types';
import { useTheme } from '../contexts/ThemeContext';
import { getThemeColors } from '../utils/themes';

interface EditMessageModalProps {
  visible: boolean;
  message: Message | null;
  onClose: () => void;
  onEdit: (messageId: string, newText: string) => void;
  onCancel: (messageId: string) => void;
}

const EditMessageModal: React.FC<EditMessageModalProps> = ({
  visible,
  message,
  onClose,
  onEdit,
  onCancel,
}) => {
  const { theme } = useTheme();
  const colors = getThemeColors(theme);
  const [editedText, setEditedText] = useState('');
  const [timeRemaining, setTimeRemaining] = useState(0);

  useEffect(() => {
    if (message) {
      setEditedText(message.text);
    }
  }, [message]);

  useEffect(() => {
    if (message?.deliveryTime) {
      const interval = setInterval(() => {
        const remaining = Math.max(0, 
          new Date(message.deliveryTime!).getTime() - Date.now()
        );
        setTimeRemaining(remaining);
        
        if (remaining === 0) {
          onClose();
        }
      }, 100);

      return () => clearInterval(interval);
    }
  }, [message, onClose]);

  const formatTimeRemaining = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    if (minutes > 0) {
      return `${minutes}分${remainingSeconds}秒`;
    }
    return `${seconds}秒`;
  };

  const handleEdit = () => {
    if (message && editedText.trim()) {
      onEdit(message.id, editedText.trim());
      onClose();
    }
  };

  const handleCancel = () => {
    if (message) {
      onCancel(message.id);
      onClose();
    }
  };

  if (!message) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView 
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>
              メッセージを編集
            </Text>
            <Text style={[styles.timer, { color: colors.statusPending }]}>
              残り時間: {formatTimeRemaining(timeRemaining)}
            </Text>
          </View>

          <TextInput
            style={[
              styles.input,
              { 
                backgroundColor: colors.inputBackground,
                color: colors.text,
                borderColor: colors.border,
              }
            ]}
            value={editedText}
            onChangeText={setEditedText}
            multiline
            maxLength={1000}
            placeholder="メッセージを入力..."
            placeholderTextColor={colors.textSecondary}
            autoFocus
          />

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton, { backgroundColor: colors.statusFailed }]}
              onPress={handleCancel}
            >
              <Text style={styles.buttonText}>送信をキャンセル</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.button, styles.editButton, { backgroundColor: colors.primary }]}
              onPress={handleEdit}
            >
              <Text style={styles.buttonText}>変更を保存</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.closeButton, { backgroundColor: colors.border }]}
            onPress={onClose}
          >
            <Text style={[styles.closeButtonText, { color: colors.text }]}>
              閉じる
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    width: '90%',
    maxWidth: 400,
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  header: {
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  timer: {
    fontSize: 14,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    minHeight: 100,
    maxHeight: 200,
    marginBottom: 20,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButton: {},
  editButton: {},
  buttonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  closeButton: {
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 14,
  },
});

export default EditMessageModal;