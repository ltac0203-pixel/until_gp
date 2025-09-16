import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useTheme } from '../contexts/ThemeContext';
import { getThemeColors } from '../utils/themes';
import * as Haptics from 'expo-haptics';
import Icon from 'react-native-vector-icons/Ionicons';

interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  type?: 'default' | 'danger' | 'warning';
  icon?: string;
  showIcon?: boolean;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  visible,
  title,
  message,
  confirmText = '確認',
  cancelText = 'キャンセル',
  onConfirm,
  onCancel,
  type = 'default',
  icon,
  showIcon = true,
}) => {
  const { theme } = useTheme();
  const colors = getThemeColors(theme);
  const scaleAnimation = useRef(new Animated.Value(0)).current;
  const opacityAnimation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      Animated.parallel([
        Animated.spring(scaleAnimation, {
          toValue: 1,
          tension: 200,
          friction: 15,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnimation, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.spring(scaleAnimation, {
          toValue: 0,
          tension: 200,
          friction: 15,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnimation, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const getIconName = () => {
    if (icon) return icon;
    switch (type) {
      case 'danger':
        return 'trash-outline';
      case 'warning':
        return 'warning-outline';
      default:
        return 'checkmark-circle-outline';
    }
  };

  const getIconColor = () => {
    switch (type) {
      case 'danger':
        return colors.error;
      case 'warning':
        return '#FFA500';
      default:
        return colors.primary;
    }
  };

  const getConfirmButtonColor = () => {
    switch (type) {
      case 'danger':
        return colors.error;
      case 'warning':
        return '#FFA500';
      default:
        return colors.primary;
    }
  };

  const handleConfirm = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onConfirm();
  };

  const handleCancel = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onCancel();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <BlurView
          intensity={100}
          tint={theme}
          style={StyleSheet.absoluteFillObject}
        />
        <Animated.View
          style={[
            styles.dialogContainer,
            {
              transform: [{ scale: scaleAnimation }],
              opacity: opacityAnimation,
            },
          ]}
        >
          <BlurView
            intensity={80}
            tint={theme}
            style={styles.dialogBlur}
          >
            <View style={[styles.dialogContent, { backgroundColor: colors.surface + 'F0' }]}>
              {showIcon && (
                <View style={[styles.iconContainer, { backgroundColor: getIconColor() + '15' }]}>
                  <Icon name={getIconName()} size={48} color={getIconColor()} />
                </View>
              )}

              <Text style={[styles.title, { color: colors.text }]}>
                {title}
              </Text>

              <Text style={[styles.message, { color: colors.textSecondary }]}>
                {message}
              </Text>

              <View style={styles.buttonContainer}>
                <TouchableOpacity
                  style={[
                    styles.button,
                    styles.cancelButton,
                    { backgroundColor: colors.surface, borderColor: colors.border }
                  ]}
                  onPress={handleCancel}
                >
                  <Text style={[styles.buttonText, { color: colors.text }]}>
                    {cancelText}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.button,
                    styles.confirmButton,
                    { backgroundColor: getConfirmButtonColor() }
                  ]}
                  onPress={handleConfirm}
                >
                  <Text style={[styles.buttonText, styles.confirmButtonText]}>
                    {confirmText}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </BlurView>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  dialogContainer: {
    width: Dimensions.get('window').width * 0.85,
    maxWidth: 400,
    borderRadius: 20,
    overflow: 'hidden',
  },
  dialogBlur: {
    borderRadius: 20,
  },
  dialogContent: {
    padding: 24,
    alignItems: 'center',
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 24,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButton: {
    borderWidth: 1,
  },
  confirmButton: {},
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  confirmButtonText: {
    color: '#FFFFFF',
  },
});

export default ConfirmDialog;