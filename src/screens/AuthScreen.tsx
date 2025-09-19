import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { getThemeColors } from '../utils/themes';
import { dataMigration } from '../utils/dataMigration';

interface AuthScreenProps {
  onAuthComplete: () => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onAuthComplete }) => {
  const [mode, setMode] = useState<'welcome' | 'signin' | 'signup' | 'anonymous'>('welcome');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [hasLegacyData, setHasLegacyData] = useState(false);

  const { signIn, signUp, signInAnonymously } = useAuth();
  const { theme } = useTheme();
  const colors = getThemeColors(theme);

  useEffect(() => {
    checkForLegacyData();
  }, []);

  const checkForLegacyData = async () => {
    const migrationStatus = await dataMigration.checkMigrationStatus();
    setHasLegacyData(migrationStatus.hasLegacyData);
  };

  const handleSignIn = async () => {
    if (!email || !password) {
      Alert.alert('エラー', 'メールアドレスとパスワードを入力してください');
      return;
    }

    setLoading(true);
    try {
      const { error } = await signIn({ email, password });
      if (error) {
        Alert.alert('ログインエラー', error.message);
      } else {
        onAuthComplete();
      }
    } catch (err) {
      Alert.alert('エラー', 'ログインに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async () => {
    if (!email || !password || !displayName) {
      Alert.alert('エラー', 'すべての項目を入力してください');
      return;
    }

    setLoading(true);
    try {
      const { error } = await signUp({ email, password, display_name: displayName });
      if (error) {
        Alert.alert('登録エラー', error.message);
      } else {
        Alert.alert(
          '登録完了',
          '確認メールを送信しました。メールを確認してからログインしてください。',
          [{ text: 'OK', onPress: () => setMode('signin') }]
        );
      }
    } catch (err) {
      Alert.alert('エラー', '登録に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleAnonymousSignIn = async () => {
    if (!displayName) {
      Alert.alert('エラー', '表示名を入力してください');
      return;
    }

    setLoading(true);
    try {
      const { error } = await signInAnonymously(displayName);
      if (error) {
        Alert.alert('エラー', error.message);
      } else {
        onAuthComplete();
      }
    } catch (err) {
      Alert.alert('エラー', 'ログインに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const renderWelcomeScreen = () => (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>GroupBy</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          エフェメラルグループチャット
        </Text>
        {hasLegacyData && (
          <View style={[styles.migrationNotice, { backgroundColor: colors.primaryLight }]}>
            <Text style={[styles.migrationText, { color: colors.primary }]}>
              既存のデータが見つかりました。ログイン後にデータ移行を行います。
            </Text>
          </View>
        )}
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.primaryButton, { backgroundColor: colors.primary }]}
          onPress={() => setMode('signin')}
        >
          <Text style={[styles.primaryButtonText, { color: colors.background }]}>
            ログイン
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.secondaryButton, { borderColor: colors.primary }]}
          onPress={() => setMode('signup')}
        >
          <Text style={[styles.secondaryButtonText, { color: colors.primary }]}>
            新規登録
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tertiaryButton]}
          onPress={() => setMode('anonymous')}
        >
          <Text style={[styles.tertiaryButtonText, { color: colors.textSecondary }]}>
            ゲストとして続行
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderSignInScreen = () => (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => setMode('welcome')}
      >
        <Text style={[styles.backButtonText, { color: colors.primary }]}>← 戻る</Text>
      </TouchableOpacity>

      <Text style={[styles.formTitle, { color: colors.text }]}>ログイン</Text>

      <View style={styles.form}>
        <TextInput
          style={[styles.input, { borderColor: colors.border, color: colors.text }]}
          placeholder="メールアドレス"
          placeholderTextColor={colors.textSecondary}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />

        <TextInput
          style={[styles.input, { borderColor: colors.border, color: colors.text }]}
          placeholder="パスワード"
          placeholderTextColor={colors.textSecondary}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
        />

        <TouchableOpacity
          style={[
            styles.primaryButton,
            { backgroundColor: colors.primary, opacity: loading ? 0.6 : 1 }
          ]}
          onPress={handleSignIn}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={colors.background} />
          ) : (
            <Text style={[styles.primaryButtonText, { color: colors.background }]}>
              ログイン
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderSignUpScreen = () => (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => setMode('welcome')}
      >
        <Text style={[styles.backButtonText, { color: colors.primary }]}>← 戻る</Text>
      </TouchableOpacity>

      <Text style={[styles.formTitle, { color: colors.text }]}>新規登録</Text>

      <View style={styles.form}>
        <TextInput
          style={[styles.input, { borderColor: colors.border, color: colors.text }]}
          placeholder="表示名"
          placeholderTextColor={colors.textSecondary}
          value={displayName}
          onChangeText={setDisplayName}
          autoCapitalize="words"
        />

        <TextInput
          style={[styles.input, { borderColor: colors.border, color: colors.text }]}
          placeholder="メールアドレス"
          placeholderTextColor={colors.textSecondary}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />

        <TextInput
          style={[styles.input, { borderColor: colors.border, color: colors.text }]}
          placeholder="パスワード"
          placeholderTextColor={colors.textSecondary}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
        />

        <TouchableOpacity
          style={[
            styles.primaryButton,
            { backgroundColor: colors.primary, opacity: loading ? 0.6 : 1 }
          ]}
          onPress={handleSignUp}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={colors.background} />
          ) : (
            <Text style={[styles.primaryButtonText, { color: colors.background }]}>
              登録
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderAnonymousScreen = () => (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => setMode('welcome')}
      >
        <Text style={[styles.backButtonText, { color: colors.primary }]}>← 戻る</Text>
      </TouchableOpacity>

      <Text style={[styles.formTitle, { color: colors.text }]}>ゲストログイン</Text>

      <Text style={[styles.description, { color: colors.textSecondary }]}>
        ゲストアカウントでGroupByを体験できます。データは端末に保存されます。
      </Text>

      <View style={styles.form}>
        <TextInput
          style={[styles.input, { borderColor: colors.border, color: colors.text }]}
          placeholder="表示名"
          placeholderTextColor={colors.textSecondary}
          value={displayName}
          onChangeText={setDisplayName}
          autoCapitalize="words"
        />

        <TouchableOpacity
          style={[
            styles.primaryButton,
            { backgroundColor: colors.primary, opacity: loading ? 0.6 : 1 }
          ]}
          onPress={handleAnonymousSignIn}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={colors.background} />
          ) : (
            <Text style={[styles.primaryButtonText, { color: colors.background }]}>
              開始
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {mode === 'welcome' && renderWelcomeScreen()}
          {mode === 'signin' && renderSignInScreen()}
          {mode === 'signup' && renderSignUpScreen()}
          {mode === 'anonymous' && renderAnonymousScreen()}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  container: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
  },
  migrationNotice: {
    marginTop: 16,
    padding: 12,
    borderRadius: 8,
  },
  migrationText: {
    fontSize: 14,
    textAlign: 'center',
  },
  buttonContainer: {
    gap: 16,
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
    fontWeight: '600',
  },
  tertiaryButton: {
    padding: 16,
    alignItems: 'center',
  },
  tertiaryButtonText: {
    fontSize: 14,
  },
  backButton: {
    alignSelf: 'flex-start',
    marginBottom: 24,
  },
  backButtonText: {
    fontSize: 16,
  },
  formTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 32,
  },
  description: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  form: {
    gap: 16,
  },
  input: {
    padding: 16,
    borderWidth: 1,
    borderRadius: 8,
    fontSize: 16,
  },
});