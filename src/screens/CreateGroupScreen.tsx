import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  Alert,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTheme } from '../contexts/ThemeContext';
import { getThemeColors } from '../utils/themes';
import { GroupLifespan } from '../types';
import { StorageService } from '../services/storage';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';

interface CreateGroupScreenProps {
  navigation: any;
}

const LIFESPAN_OPTIONS: { value: GroupLifespan; label: string; duration: number; emoji: string }[] = [
  { value: '1_hour', label: '1時間', duration: 60 * 60 * 1000, emoji: '⚡' },
  { value: '24_hours', label: '24時間', duration: 24 * 60 * 60 * 1000, emoji: '☀️' },
  { value: '3_days', label: '3日間', duration: 3 * 24 * 60 * 60 * 1000, emoji: '📅' },
  { value: '7_days', label: '1週間', duration: 7 * 24 * 60 * 60 * 1000, emoji: '📆' },
  { value: 'custom', label: 'カスタム', duration: 0, emoji: '⚙️' },
];

const CreateGroupScreen: React.FC<CreateGroupScreenProps> = ({ navigation }) => {
  const { theme } = useTheme();
  const colors = getThemeColors(theme);
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [selectedLifespan, setSelectedLifespan] = useState<GroupLifespan>('24_hours');
  const [customDate, setCustomDate] = useState(new Date(Date.now() + 24 * 60 * 60 * 1000));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      Alert.alert('エラー', 'グループ名を入力してください');
      return;
    }

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    let expirationTime: Date;
    if (selectedLifespan === 'custom') {
      const maxDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      if (customDate.getTime() > maxDate.getTime()) {
        Alert.alert('エラー', '有効期限は最大30日までです');
        return;
      }
      if (customDate.getTime() <= Date.now()) {
        Alert.alert('エラー', '有効期限は未来の日時を設定してください');
        return;
      }
      expirationTime = customDate;
    } else {
      const lifespanOption = LIFESPAN_OPTIONS.find(opt => opt.value === selectedLifespan);
      expirationTime = new Date(Date.now() + (lifespanOption?.duration || 86400000));
    }

    const newGroup = await StorageService.createGroup(
      groupName.trim(),
      groupDescription.trim(),
      selectedLifespan,
      expirationTime
    );

    // Navigate to the newly created group
    navigation.navigate('Home');
    navigation.navigate('GroupChat', { groupId: newGroup.id });
  };

  const onDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      const newDate = new Date(customDate);
      newDate.setFullYear(selectedDate.getFullYear());
      newDate.setMonth(selectedDate.getMonth());
      newDate.setDate(selectedDate.getDate());

      const maxDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      if (newDate.getTime() > maxDate.getTime()) {
        Alert.alert('エラー', '有効期限は最大30日までです');
        setCustomDate(maxDate);
      } else {
        setCustomDate(newDate);
      }
    }
  };

  const onTimeChange = (event: any, selectedDate?: Date) => {
    setShowTimePicker(false);
    if (selectedDate) {
      const newDate = new Date(customDate);
      newDate.setHours(selectedDate.getHours());
      newDate.setMinutes(selectedDate.getMinutes());
      setCustomDate(newDate);
    }
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
              <Text style={[styles.headerTitle, { color: colors.text }]}>
                新規グループ
              </Text>
              <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
                期限付きグループを作成
              </Text>
            </View>
          </LinearGradient>

          <View style={styles.formContainer}>
            <View style={styles.inputSection}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>グループ名</Text>
              <BlurView intensity={60} tint={theme} style={styles.inputBlur}>
                <TextInput
                  style={[styles.input, { color: colors.text }]}
                  placeholder="グループ名を入力"
                  placeholderTextColor={colors.textSecondary + '80'}
                  value={groupName}
                  onChangeText={setGroupName}
                  maxLength={50}
                />
              </BlurView>
            </View>

            <View style={styles.inputSection}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>説明（任意）</Text>
              <BlurView intensity={60} tint={theme} style={styles.inputBlur}>
                <TextInput
                  style={[styles.input, styles.textArea, { color: colors.text }]}
                  placeholder="グループの説明を入力"
                  placeholderTextColor={colors.textSecondary + '80'}
                  value={groupDescription}
                  onChangeText={setGroupDescription}
                  multiline
                  numberOfLines={3}
                  maxLength={200}
                />
              </BlurView>
            </View>

            <View style={styles.inputSection}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>有効期限</Text>
              <View style={styles.lifespanGrid}>
                {LIFESPAN_OPTIONS.map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.lifespanCard,
                      selectedLifespan === option.value && styles.lifespanCardActive
                    ]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setSelectedLifespan(option.value);
                    }}
                  >
                    <BlurView
                      intensity={selectedLifespan === option.value ? 80 : 60}
                      tint={theme}
                      style={styles.lifespanBlur}
                    >
                      <View style={[
                        styles.lifespanContent,
                        selectedLifespan === option.value && { backgroundColor: colors.primary + '20' }
                      ]}>
                        <Text style={styles.lifespanEmoji}>{option.emoji}</Text>
                        <Text style={[
                          styles.lifespanLabel,
                          { color: selectedLifespan === option.value ? colors.primary : colors.text }
                        ]}>
                          {option.label}
                        </Text>
                      </View>
                    </BlurView>
                  </TouchableOpacity>
                ))}
              </View>

              {selectedLifespan === 'custom' && (
                <BlurView intensity={60} tint={theme} style={styles.customDateContainer}>
                  <View style={styles.customDateContent}>
                    <Text style={[styles.customDateLabel, { color: colors.text }]}>
                      解散日時を選択
                    </Text>
                    <View style={styles.dateTimeButtons}>
                      <TouchableOpacity
                        style={[styles.dateTimeButton, { backgroundColor: colors.primary + '15' }]}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          setShowDatePicker(true);
                        }}
                      >
                        <Text style={[styles.dateTimeButtonText, { color: colors.primary }]}>
                          📅 {customDate.toLocaleDateString('ja-JP')}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.dateTimeButton, { backgroundColor: colors.primary + '15' }]}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          setShowTimePicker(true);
                        }}
                      >
                        <Text style={[styles.dateTimeButtonText, { color: colors.primary }]}>
                          🕐 {customDate.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </BlurView>
              )}
            </View>

            <View style={styles.infoBox}>
              <BlurView intensity={40} tint={theme} style={styles.infoBlur}>
                <View style={styles.infoContent}>
                  <Text style={styles.infoIcon}>💡</Text>
                  <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                    グループは期限が来ると自動的に解散し、アーカイブに保存されます
                  </Text>
                </View>
              </BlurView>
            </View>
          </View>

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[
                styles.createButton,
                !groupName.trim() && styles.createButtonDisabled
              ]}
              onPress={handleCreateGroup}
              disabled={!groupName.trim()}
            >
              <LinearGradient
                colors={groupName.trim()
                  ? [colors.primary, colors.primaryDark]
                  : [colors.disabled, colors.disabled]
                }
                style={styles.createButtonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Text style={styles.createButtonText}>
                  グループを作成
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {showDatePicker && Platform.OS !== 'web' && (
        <DateTimePicker
          value={customDate}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={onDateChange}
          maximumDate={new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)}
          minimumDate={new Date()}
        />
      )}

      {showTimePicker && Platform.OS !== 'web' && (
        <DateTimePicker
          value={customDate}
          mode="time"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={onTimeChange}
        />
      )}
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
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingTop: Platform.OS === 'ios' ? 8 : 16,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    opacity: 0.7,
  },
  formContainer: {
    paddingHorizontal: 16,
  },
  inputSection: {
    marginTop: 20,
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
  input: {
    padding: 16,
    fontSize: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  lifespanGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  lifespanCard: {
    width: '30%',
    aspectRatio: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },
  lifespanCardActive: {
    transform: [{ scale: 0.95 }],
  },
  lifespanBlur: {
    flex: 1,
    borderRadius: 16,
  },
  lifespanContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  lifespanEmoji: {
    fontSize: 28,
    marginBottom: 4,
  },
  lifespanLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  customDateContainer: {
    marginTop: 12,
    borderRadius: 12,
    overflow: 'hidden',
  },
  customDateContent: {
    padding: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  customDateLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 12,
  },
  dateTimeButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  dateTimeButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  dateTimeButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  infoBox: {
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
    fontSize: 20,
    marginRight: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  buttonContainer: {
    paddingHorizontal: 16,
    marginTop: 32,
  },
  createButton: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  createButtonDisabled: {
    opacity: 0.5,
  },
  createButtonGradient: {
    paddingVertical: 18,
    alignItems: 'center',
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});

export default CreateGroupScreen;