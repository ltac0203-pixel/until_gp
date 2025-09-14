import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Platform,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';
import { getThemeColors } from '../utils/themes';
import { Group } from '../types';
import { StorageService } from '../services/storage';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';

interface ArchiveScreenProps {
  navigation: any;
}

const ArchiveScreen: React.FC<ArchiveScreenProps> = ({ navigation }) => {
  const { theme } = useTheme();
  const colors = getThemeColors(theme);
  const [archivedGroups, setArchivedGroups] = useState<Group[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadArchivedGroups();
  }, []);

  const loadArchivedGroups = async () => {
    const { archived } = await StorageService.loadGroups();
    setArchivedGroups(archived.slice(0, 50));
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadArchivedGroups();
    setRefreshing(false);
  };

  const formatDisbandReason = (reason?: string) => {
    switch (reason) {
      case 'time_expired':
        return '期限切れ';
      case 'inactivity':
        return '非アクティブ';
      case 'message_limit':
        return 'メッセージ上限';
      default:
        return '終了';
    }
  };

  const renderArchivedItem = ({ item }: { item: Group }) => {
    return (
      <TouchableOpacity
        style={styles.archivedItem}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          navigation.navigate('GroupChat', { groupId: item.id, isArchived: true });
        }}
        activeOpacity={0.8}
      >
        <BlurView intensity={80} tint={theme} style={styles.blurContainer}>
          <View style={styles.archivedItemContent}>
            <View style={styles.archivedItemHeader}>
              <View style={[styles.archivedAvatar, { backgroundColor: colors.primary + '30' }]}>
                <Text style={[styles.archivedAvatarText, { color: colors.primary }]}>
                  {item.name.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.archivedItemInfo}>
                <Text style={[styles.archivedItemName, { color: colors.text }]} numberOfLines={1}>
                  {item.name}
                </Text>
                <View style={styles.archivedItemMeta}>
                  <Text style={[styles.archivedItemDate, { color: colors.textSecondary }]}>
                    {item.disbandedAt && new Date(item.disbandedAt).toLocaleDateString('ja-JP')}
                  </Text>
                  <View style={[styles.reasonBadge, { backgroundColor: colors.primary + '20' }]}>
                    <Text style={[styles.reasonText, { color: colors.primary }]}>
                      {formatDisbandReason(item.disbandReason)}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
            {item.description && (
              <Text style={[styles.archivedItemDescription, { color: colors.textSecondary }]} numberOfLines={2}>
                {item.description}
              </Text>
            )}
            <View style={styles.archivedItemStats}>
              <Text style={[styles.statItem, { color: colors.textSecondary }]}>
                💬 {item.messageCount || 0}
              </Text>
              <Text style={[styles.statItem, { color: colors.textSecondary }]}>
                👥 {item.members.length}
              </Text>
            </View>
          </View>
        </BlurView>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <LinearGradient
        colors={[colors.primary + '15', 'transparent']}
        style={styles.headerGradient}
      >
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            アーカイブ
          </Text>
          <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
            {archivedGroups.length}個の終了グループ
          </Text>
        </View>
      </LinearGradient>

      {archivedGroups.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={[styles.emptyIconContainer, { backgroundColor: colors.primary + '20' }]}>
            <Text style={styles.emptyIcon}>📚</Text>
          </View>
          <Text style={[styles.emptyText, { color: colors.text }]}>
            アーカイブはまだありません
          </Text>
          <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
            終了したグループがここに表示されます
          </Text>
        </View>
      ) : (
        <FlatList
          data={archivedGroups}
          renderItem={renderArchivedItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
        />
      )}
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
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    opacity: 0.7,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  archivedItem: {
    marginVertical: 6,
    borderRadius: 20,
    overflow: 'hidden',
  },
  blurContainer: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  archivedItemContent: {
    padding: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  archivedItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  archivedAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  archivedAvatarText: {
    fontSize: 18,
    fontWeight: '600',
  },
  archivedItemInfo: {
    flex: 1,
  },
  archivedItemName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  archivedItemMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  archivedItemDate: {
    fontSize: 12,
  },
  reasonBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  reasonText: {
    fontSize: 11,
    fontWeight: '500',
  },
  archivedItemDescription: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 8,
  },
  archivedItemStats: {
    flexDirection: 'row',
    gap: 16,
  },
  statItem: {
    fontSize: 12,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyIcon: {
    fontSize: 48,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
    opacity: 0.7,
  },
});

export default ArchiveScreen;