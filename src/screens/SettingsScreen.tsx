import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';
import { getThemeColors } from '../utils/themes';
import { FlowGroupsSettings, GroupLifespan, Theme } from '../types';
import { StorageService } from '../services/storage';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Icon from 'react-native-vector-icons/Ionicons';

const SettingsScreen: React.FC = () => {
  const { theme, setTheme } = useTheme();
  const colors = getThemeColors(theme);
  const [settings, setSettings] = useState<FlowGroupsSettings>({
    theme: theme,
    enableHaptics: true,
    enableTypingIndicator: true,
    defaultGroupLifespan: '24_hours',
    showExpirationWarnings: true,
    archiveRetentionDays: 30,
    autoJoinSuggestions: false,
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const loadedSettings = await StorageService.loadSettings();
    setSettings(loadedSettings);
  };

  const saveSettings = async (newSettings: FlowGroupsSettings) => {
    await StorageService.saveSettings(newSettings);
    setSettings(newSettings);
  };

  const handleThemeChange = async (newTheme: Theme) => {
    if (settings.enableHaptics) {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setTheme(newTheme);
    const newSettings = { ...settings, theme: newTheme };
    await saveSettings(newSettings);
  };

  const handleToggleSetting = async (key: keyof FlowGroupsSettings, value: boolean) => {
    if (settings.enableHaptics) {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    const newSettings = { ...settings, [key]: value };
    await saveSettings(newSettings);
  };

  const handleClearData = () => {
    Alert.alert(
      'データをクリア',
      'すべてのデータを削除しますか？この操作は取り消せません。',
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '削除',
          style: 'destructive',
          onPress: async () => {
            await StorageService.clearAll();
            Alert.alert('完了', 'すべてのデータがクリアされました。');
          },
        },
      ]
    );
  };

  const SettingSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.primary }]}>{title}</Text>
      <BlurView intensity={60} tint={theme} style={styles.sectionBlur}>
        <View style={styles.sectionContent}>{children}</View>
      </BlurView>
    </View>
  );

  const SettingRow: React.FC<{
    icon: string;
    label: string;
    value?: React.ReactNode;
    onPress?: () => void;
  }> = ({ icon, label, value, onPress }) => (
    <TouchableOpacity
      style={styles.settingRow}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      disabled={!onPress}
    >
      <View style={styles.settingRowLeft}>
        <Icon name={icon} size={20} color={colors.text} style={styles.settingIcon} />
        <Text style={[styles.settingLabel, { color: colors.text }]}>{label}</Text>
      </View>
      {value}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <LinearGradient
        colors={[colors.primary + '15', 'transparent']}
        style={styles.headerGradient}
      >
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            設定
          </Text>
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <SettingSection title="外観">
          <SettingRow
            icon="contrast-outline"
            label="テーマ"
            value={
              <View style={styles.themeButtons}>
                <TouchableOpacity
                  style={[
                    styles.themeButton,
                    theme === 'light' && styles.themeButtonActive,
                    { borderColor: theme === 'light' ? colors.primary : colors.border }
                  ]}
                  onPress={() => handleThemeChange('light')}
                >
                  <Text style={[
                    styles.themeButtonText,
                    { color: theme === 'light' ? colors.primary : colors.textSecondary }
                  ]}>
                    <View style={styles.themeButtonContent}>
                      <Icon name="sunny-outline" size={14} color={theme === 'light' ? colors.primary : colors.textSecondary} />
                      <Text>ライト</Text>
                    </View>
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.themeButton,
                    theme === 'dark' && styles.themeButtonActive,
                    { borderColor: theme === 'dark' ? colors.primary : colors.border }
                  ]}
                  onPress={() => handleThemeChange('dark')}
                >
                  <Text style={[
                    styles.themeButtonText,
                    { color: theme === 'dark' ? colors.primary : colors.textSecondary }
                  ]}>
                    <View style={styles.themeButtonContent}>
                      <Icon name="moon-outline" size={14} color={theme === 'dark' ? colors.primary : colors.textSecondary} />
                      <Text>ダーク</Text>
                    </View>
                  </Text>
                </TouchableOpacity>
              </View>
            }
          />
        </SettingSection>

        <SettingSection title="グループ設定">
          <SettingRow
            icon="timer-outline"
            label="デフォルトの有効期限"
            value={
              <Text style={[styles.settingValue, { color: colors.textSecondary }]}>
                {settings.defaultGroupLifespan === '1_hour' && '1時間'}
                {settings.defaultGroupLifespan === '24_hours' && '24時間'}
                {settings.defaultGroupLifespan === '3_days' && '3日間'}
                {settings.defaultGroupLifespan === '7_days' && '1週間'}
                {settings.defaultGroupLifespan === 'custom' && 'カスタム'}
              </Text>
            }
          />
          <SettingRow
            icon="notifications-outline"
            label="期限前の通知"
            value={
              <Switch
                value={settings.showExpirationWarnings}
                onValueChange={(value) => handleToggleSetting('showExpirationWarnings', value)}
                trackColor={{ false: colors.border, true: colors.primary + '80' }}
                thumbColor={settings.showExpirationWarnings ? colors.primary : '#f4f3f4'}
              />
            }
          />
        </SettingSection>

        <SettingSection title="インタラクション">
          <SettingRow
            icon="phone-portrait-outline"
            label="触覚フィードバック"
            value={
              <View style={styles.hapticRow}>
                <Switch
                  value={settings.enableHaptics}
                  onValueChange={(value) => handleToggleSetting('enableHaptics', value)}
                  trackColor={{ false: colors.border, true: colors.primary + '80' }}
                  thumbColor={settings.enableHaptics ? colors.primary : '#f4f3f4'}
                />
              </View>
            }
          />
          {settings.enableHaptics && (
            <TouchableOpacity
              style={[styles.testButton, { backgroundColor: colors.primary + '20' }]}
              onPress={async () => {
                await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              }}
            >
              <Text style={[styles.testButtonText, { color: colors.primary }]}>
                振動をテスト
              </Text>
            </TouchableOpacity>
          )}
        </SettingSection>

        <SettingSection title="データ管理">
          <TouchableOpacity
            style={[styles.dangerButton, { backgroundColor: colors.error + '15' }]}
            onPress={handleClearData}
          >
            <View style={styles.dangerButtonContent}>
              <Icon name="trash-outline" size={20} color={colors.error} />
              <Text style={[styles.dangerButtonText, { color: colors.error }]}>
                すべてのデータをクリア
              </Text>
            </View>
          </TouchableOpacity>
        </SettingSection>

        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: colors.textSecondary }]}>
            FlowGroups v1.0.0
          </Text>
          <Text style={[styles.footerSubtext, { color: colors.textSecondary }]}>
            期限付きグループチャットアプリ
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginLeft: 4,
  },
  sectionBlur: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  sectionContent: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  settingRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingIcon: {
    marginRight: 12,
  },
  settingLabel: {
    fontSize: 16,
  },
  settingValue: {
    fontSize: 14,
  },
  themeButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  themeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  themeButtonActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  themeButtonText: {
    fontSize: 12,
    fontWeight: '500',
  },
  themeButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  hapticRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  testButton: {
    marginHorizontal: 16,
    marginVertical: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  testButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  dangerButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  dangerButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dangerButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    alignItems: 'center',
    marginTop: 40,
    marginBottom: 20,
  },
  footerText: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  footerSubtext: {
    fontSize: 12,
    opacity: 0.7,
  },
});

export default SettingsScreen;