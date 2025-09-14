import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { getThemeColors } from '../utils/themes';

interface ReactionPickerProps {
  visible: boolean;
  onClose: () => void;
  onSelectReaction: (emoji: string) => void;
}

const REACTIONS = [
  '❤️', '👍', '😊', '😂', '😮', '😢', '😡', '🎉',
  '🔥', '💯', '👏', '🙏', '💪', '🤝', '✨', '🌟',
  '💖', '💕', '😍', '🥰', '😎', '🤔', '🙄', '😴',
];

const ReactionPicker: React.FC<ReactionPickerProps> = ({
  visible,
  onClose,
  onSelectReaction,
}) => {
  const { theme } = useTheme();
  const colors = getThemeColors(theme);

  const handleSelectReaction = (emoji: string) => {
    onSelectReaction(emoji);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
    >
      <TouchableOpacity 
        style={styles.overlay} 
        activeOpacity={1} 
        onPress={onClose}
      >
        <View style={[styles.container, { backgroundColor: colors.surface }]}>
          <Text style={[styles.title, { color: colors.text }]}>
            リアクションを選択
          </Text>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.reactionsContainer}
          >
            {REACTIONS.map((emoji, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.reactionButton,
                  { backgroundColor: colors.inputBackground }
                ]}
                onPress={() => handleSelectReaction(emoji)}
              >
                <Text style={styles.reactionEmoji}>{emoji}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  container: {
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
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  reactionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  reactionButton: {
    padding: 12,
    borderRadius: 12,
    marginRight: 8,
  },
  reactionEmoji: {
    fontSize: 24,
  },
});

export default ReactionPicker;