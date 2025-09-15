import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Alert,
  KeyboardAvoidingView,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';
import { getThemeColors } from '../utils/themes';
import { StorageService } from '../services/storage';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Icon from 'react-native-vector-icons/Ionicons';

interface JoinGroupScreenProps {
  navigation: any;
}

const JoinGroupScreen: React.FC<JoinGroupScreenProps> = ({ navigation }) => {
  const { theme } = useTheme();
  const colors = getThemeColors(theme);
  const [inviteCode, setInviteCode] = useState('');
  const [userName, setUserName] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const codeInputRefs = useRef<Array<TextInput | null>>([]);

  const handleCodeChange = (text: string, index: number) => {
    const newCode = inviteCode.split('');
    newCode[index] = text.toUpperCase();
    const updatedCode = newCode.join('');
    setInviteCode(updatedCode);

    // Auto-focus next input
    if (text && index < 5) {
      codeInputRefs.current[index + 1]?.focus();
    }
  };

  const handleCodeKeyPress = (key: string, index: number) => {
    if (key === 'Backspace' && !inviteCode[index] && index > 0) {
      codeInputRefs.current[index - 1]?.focus();
    }
  };

  const handleJoinGroup = async () => {
    const code = inviteCode.trim();

    if (code.length !== 6) {
      Alert.alert('エラー', '6文字の招待コードを入力してください');
      return;
    }

    if (!userName.trim()) {
      Alert.alert('エラー', '名前を入力してください');
      return;
    }

    setIsJoining(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Generate a unique user ID (in production, this would be from authentication)
    const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const group = await StorageService.joinGroupWithCode(code, userId, userName.trim());

    setIsJoining(false);

    if (group) {
      Alert.alert(
        '成功',
        `グループ「${group.name}」に参加しました！`,
        [
          {
            text: 'OK',
            onPress: () => {
              navigation.navigate('Home');
              navigation.navigate('GroupChat', { groupId: group.id });
            },
          },
        ]
      );
    } else {
      Alert.alert(
        'エラー',
        '無効な招待コード、または期限切れです。',
        [{ text: 'OK' }]
      );
    }
  };

  const handlePasteCode = async () => {
    // In React Native, clipboard would be handled differently
    // This is a placeholder for the paste functionality
    Alert.alert('情報', 'クリップボードから貼り付け機能は後で実装されます');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <LinearGradient
            colors={[colors.primary + '15', 'transparent']}
            style={styles.headerGradient}
          >
            <View style={styles.header}>
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  navigation.goBack();
                }}
              >
                <Icon name="arrow-back" size={24} color={colors.text} />
              </TouchableOpacity>
              <Text style={[styles.headerTitle, { color: colors.text }]}>
                グループに参加
              </Text>
              <View style={styles.headerSpacer} />
            </View>
          </LinearGradient>

          <View style={styles.formContainer}>
            <View style={styles.iconContainer}>
              <LinearGradient
                colors={[colors.primary, colors.primaryLight]}
                style={styles.iconGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Icon name="people-outline" size={48} color="#FFFFFF" />
              </LinearGradient>
            </View>

            <Text style={[styles.instructionText, { color: colors.text }]}>
              6文字の招待コードを入力してください
            </Text>

            <View style={styles.codeInputContainer}>
              {[0, 1, 2, 3, 4, 5].map((index) => (
                <BlurView
                  key={index}
                  intensity={60}
                  tint={theme}
                  style={styles.codeInputBlur}
                >
                  <TextInput
                    ref={(ref) => {
                      codeInputRefs.current[index] = ref;
                    }}
                    style={[
                      styles.codeInput,
                      {
                        color: colors.text,
                        borderColor: inviteCode[index] ? colors.primary : colors.border,
                      }
                    ]}
                    value={inviteCode[index] || ''}
                    onChangeText={(text) => handleCodeChange(text, index)}
                    onKeyPress={({ nativeEvent }) => handleCodeKeyPress(nativeEvent.key, index)}
                    maxLength={1}
                    autoCapitalize="characters"
                    placeholder="–"
                    placeholderTextColor={colors.textSecondary + '50'}
                  />
                </BlurView>
              ))}
            </View>

            <TouchableOpacity
              style={styles.pasteButton}
              onPress={handlePasteCode}
            >
              <Icon name="clipboard-outline" size={16} color={colors.primary} />
              <Text style={[styles.pasteButtonText, { color: colors.primary }]}>
                コードを貼り付け
              </Text>
            </TouchableOpacity>

            <View style={styles.inputSection}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>
                あなたの名前
              </Text>
              <BlurView intensity={60} tint={theme} style={styles.inputBlur}>
                <TextInput
                  style={[styles.nameInput, { color: colors.text }]}
                  placeholder="表示名を入力"
                  placeholderTextColor={colors.textSecondary + '80'}
                  value={userName}
                  onChangeText={setUserName}
                  maxLength={20}
                />
              </BlurView>
            </View>

            <TouchableOpacity
              style={[
                styles.joinButton,
                (!inviteCode.trim() || inviteCode.length !== 6 || !userName.trim() || isJoining) && styles.joinButtonDisabled,
              ]}
              onPress={handleJoinGroup}
              disabled={!inviteCode.trim() || inviteCode.length !== 6 || !userName.trim() || isJoining}
            >
              <LinearGradient
                colors={
                  inviteCode.trim() && inviteCode.length === 6 && userName.trim() && !isJoining
                    ? [colors.primary, colors.primaryDark]
                    : [colors.disabled, colors.disabled]
                }
                style={styles.joinButtonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Text style={styles.joinButtonText}>
                  {isJoining ? '参加中...' : 'グループに参加'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>

            <View style={styles.infoBox}>
              <BlurView intensity={40} tint={theme} style={styles.infoBlur}>
                <View style={styles.infoContent}>
                  <Icon name="information-circle-outline" size={20} color={colors.textSecondary} style={styles.infoIcon} />
                  <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                    招待コードはグループメンバーから共有されます。期限付きグループの有効期限内のみ参加できます。
                  </Text>
                </View>
              </BlurView>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  headerGradient: {
    paddingBottom: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingTop: Platform.OS === 'ios' ? 8 : 16,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  formContainer: {
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  iconContainer: {
    marginTop: 32,
    marginBottom: 24,
  },
  iconGradient: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  instructionText: {
    fontSize: 16,
    marginBottom: 24,
    textAlign: 'center',
  },
  codeInputContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  codeInputBlur: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  codeInput: {
    width: 48,
    height: 56,
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    borderWidth: 2,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  pasteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 32,
  },
  pasteButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  inputSection: {
    width: '100%',
    marginBottom: 32,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    marginLeft: 4,
  },
  inputBlur: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  nameInput: {
    padding: 16,
    fontSize: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  joinButton: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
  },
  joinButtonDisabled: {
    opacity: 0.5,
  },
  joinButtonGradient: {
    paddingVertical: 18,
    alignItems: 'center',
  },
  joinButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  infoBox: {
    width: '100%',
    marginTop: 24,
    borderRadius: 12,
    overflow: 'hidden',
  },
  infoBlur: {
    borderRadius: 12,
  },
  infoContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  infoIcon: {
    marginRight: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
});

export default JoinGroupScreen;