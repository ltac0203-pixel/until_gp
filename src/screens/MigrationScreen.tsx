import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ProgressBarAndroid,
  ProgressViewIOS,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';
import { getThemeColors } from '../utils/themes';
import { dataMigration, MigrationResult } from '../utils/dataMigration';

interface MigrationScreenProps {
  onMigrationComplete: () => void;
  onSkipMigration: () => void;
}

export const MigrationScreen: React.FC<MigrationScreenProps> = ({
  onMigrationComplete,
  onSkipMigration,
}) => {
  const [migrating, setMigrating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState('');
  const [preview, setPreview] = useState({
    groupCount: 0,
    messageCount: 0,
    hasSettings: false,
  });

  const { theme } = useTheme();
  const colors = getThemeColors(theme);

  useEffect(() => {
    loadMigrationPreview();
  }, []);

  const loadMigrationPreview = async () => {
    try {
      const previewData = await dataMigration.getMigrationPreview();
      setPreview(previewData);
    } catch (error) {
      console.error('Error loading migration preview:', error);
    }
  };

  const handleStartMigration = async () => {
    Alert.alert(
      'データ移行の確認',
      `以下のデータを移行します：\n\n• グループ: ${preview.groupCount}個\n• メッセージ: ${preview.messageCount}個\n• 設定: ${preview.hasSettings ? 'あり' : 'なし'}\n\n移行を開始しますか？`,
      [
        {
          text: 'キャンセル',
          style: 'cancel',
        },
        {
          text: '開始',
          onPress: performMigration,
        },
      ]
    );
  };

  const performMigration = async () => {
    setMigrating(true);
    setProgress(0);
    setCurrentStep('移行を準備中...');

    try {
      // Step 1: Initialize (10%)
      setProgress(0.1);
      setCurrentStep('設定を移行中...');
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate delay

      // Step 2: Settings migration (30%)
      setProgress(0.3);
      setCurrentStep('グループを移行中...');
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Step 3: Groups migration (60%)
      setProgress(0.6);
      setCurrentStep('メッセージを移行中...');
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Step 4: Messages migration (90%)
      setProgress(0.9);
      setCurrentStep('移行を完了中...');

      // Perform actual migration
      const result: MigrationResult = await dataMigration.migrateAllData();

      // Step 5: Complete (100%)
      setProgress(1);
      setCurrentStep('移行完了');

      if (result.success) {
        Alert.alert(
          '移行完了',
          `データの移行が完了しました！\n\n• グループ: ${result.migratedGroups}個\n• メッセージ: ${result.migratedMessages}個\n• 設定: ${result.migratedSettings ? '完了' : '未実行'}`,
          [
            {
              text: 'OK',
              onPress: onMigrationComplete,
            },
          ]
        );
      } else {
        Alert.alert(
          '移行エラー',
          `移行中にエラーが発生しました：\n\n${result.errors.join('\n')}\n\n部分的に移行されたデータがある可能性があります。`,
          [
            {
              text: '続行',
              onPress: onMigrationComplete,
            },
            {
              text: '再試行',
              onPress: () => {
                setMigrating(false);
                setProgress(0);
                setCurrentStep('');
              },
            },
          ]
        );
      }
    } catch (error) {
      console.error('Migration error:', error);
      Alert.alert(
        '移行エラー',
        '予期しないエラーが発生しました。もう一度お試しください。',
        [
          {
            text: 'OK',
            onPress: () => {
              setMigrating(false);
              setProgress(0);
              setCurrentStep('');
            },
          },
        ]
      );
    } finally {
      setMigrating(false);
    }
  };

  const handleSkipMigration = () => {
    Alert.alert(
      '移行をスキップ',
      '既存のデータは移行されませんが、新しいデータでアプリを開始できます。後で移行することはできません。',
      [
        {
          text: 'キャンセル',
          style: 'cancel',
        },
        {
          text: 'スキップ',
          style: 'destructive',
          onPress: onSkipMigration,
        },
      ]
    );
  };

  const ProgressBar = Platform.OS === 'ios' ? ProgressViewIOS : ProgressBarAndroid;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>データ移行</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            既存のデータをクラウドに移行します
          </Text>
        </View>

        <View style={[styles.previewCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.previewTitle, { color: colors.text }]}>移行対象のデータ</Text>
          <View style={styles.previewItems}>
            <View style={styles.previewItem}>
              <Text style={[styles.previewLabel, { color: colors.textSecondary }]}>グループ</Text>
              <Text style={[styles.previewValue, { color: colors.text }]}>{preview.groupCount}個</Text>
            </View>
            <View style={styles.previewItem}>
              <Text style={[styles.previewLabel, { color: colors.textSecondary }]}>メッセージ</Text>
              <Text style={[styles.previewValue, { color: colors.text }]}>{preview.messageCount}個</Text>
            </View>
            <View style={styles.previewItem}>
              <Text style={[styles.previewLabel, { color: colors.textSecondary }]}>設定</Text>
              <Text style={[styles.previewValue, { color: colors.text }]}>
                {preview.hasSettings ? 'あり' : 'なし'}
              </Text>
            </View>
          </View>
        </View>

        {migrating && (
          <View style={[styles.progressCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.progressTitle, { color: colors.text }]}>移行中...</Text>
            <Text style={[styles.progressStep, { color: colors.textSecondary }]}>{currentStep}</Text>
            <View style={styles.progressContainer}>
              <ProgressBar
                style={styles.progressBar}
                progress={progress}
                progressTintColor={colors.primary}
                trackTintColor={colors.border}
              />
              <Text style={[styles.progressText, { color: colors.textSecondary }]}>
                {Math.round(progress * 100)}%
              </Text>
            </View>
          </View>
        )}

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[
              styles.primaryButton,
              { backgroundColor: colors.primary, opacity: migrating ? 0.6 : 1 }
            ]}
            onPress={handleStartMigration}
            disabled={migrating}
          >
            {migrating ? (
              <ActivityIndicator color={colors.background} />
            ) : (
              <Text style={[styles.primaryButtonText, { color: colors.background }]}>
                移行を開始
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.secondaryButton, { borderColor: colors.textSecondary }]}
            onPress={handleSkipMigration}
            disabled={migrating}
          >
            <Text style={[styles.secondaryButtonText, { color: colors.textSecondary }]}>
              移行をスキップ
            </Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.infoCard, { backgroundColor: colors.primaryLight }]}>
          <Text style={[styles.infoText, { color: colors.primary }]}>
            💡 移行後は既存のローカルデータは削除され、すべてのデータがクラウドで同期されます。
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
  },
  previewCard: {
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 24,
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  previewItems: {
    gap: 12,
  },
  previewItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  previewLabel: {
    fontSize: 14,
  },
  previewValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  progressCard: {
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 24,
  },
  progressTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  progressStep: {
    fontSize: 14,
    marginBottom: 16,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  progressBar: {
    flex: 1,
    height: 8,
  },
  progressText: {
    fontSize: 12,
    fontWeight: '500',
    minWidth: 40,
    textAlign: 'right',
  },
  buttonContainer: {
    gap: 16,
    marginBottom: 24,
  },
  primaryButton: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 16,
  },
  infoCard: {
    padding: 16,
    borderRadius: 8,
  },
  infoText: {
    fontSize: 14,
    lineHeight: 20,
  },
});