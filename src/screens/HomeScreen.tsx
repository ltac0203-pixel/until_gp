import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Animated,
  Dimensions,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../contexts/ThemeContext';
import { getThemeColors } from '../utils/themes';
import { Group } from '../types';
import { StorageService } from '../services/storage';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';

const { width } = Dimensions.get('window');

interface HomeScreenProps {
  navigation: any;
}


const HomeScreen: React.FC<HomeScreenProps> = ({ navigation }) => {
  const { theme } = useTheme();
  const colors = getThemeColors(theme);
  const [groups, setGroups] = useState<Group[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadGroups();
    const timer = setInterval(() => {
      setCurrentTime(new Date());
      checkExpiredGroups();
    }, 1000);
    
    return () => clearInterval(timer);
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      loadGroups();
    }, [])
  );

  const loadGroups = async () => {
    const { active } = await StorageService.loadGroups();
    const sortedActive = active
      .filter(g => g.status === 'active' || g.status === 'expiring_soon')
      .sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime());
    setGroups(sortedActive);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadGroups();
    setRefreshing(false);
  };

  const checkExpiredGroups = async () => {
    const now = new Date();
    let hasExpired = false;
    
    groups.forEach(group => {
      if (group.settings.expirationTime.getTime() <= now.getTime()) {
        hasExpired = true;
      }
    });
    
    if (hasExpired) {
      await StorageService.processExpiredGroups();
      loadGroups();
    }
  };

  const formatTimeRemaining = (expirationTime: Date): string => {
    const now = currentTime;
    const diff = expirationTime.getTime() - now.getTime();
    
    if (diff <= 0) return '期限切れ';
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    
    if (days > 0) return `${days}日 ${hours}時間`;
    if (hours > 0) return `${hours}時間 ${minutes}分`;
    if (minutes > 0) return `${minutes}分 ${seconds}秒`;
    return `${seconds}秒`;
  };

  const getExpirationProgress = (createdAt: Date, expirationTime: Date): number => {
    const now = currentTime;
    const total = expirationTime.getTime() - createdAt.getTime();
    const elapsed = now.getTime() - createdAt.getTime();
    const progress = Math.min(1, Math.max(0, elapsed / total));
    return 1 - progress; // Invert to show remaining time
  };

  const getExpirationColor = (progress: number): string => {
    if (progress > 0.5) return colors.success || '#4CAF50';
    if (progress > 0.2) return colors.warning || '#FFC107';
    return colors.error || '#F44336';
  };


  const renderGroupItem = ({ item, index }: { item: Group; index: number }) => {
    const scaleAnim = new Animated.Value(0.95);
    const progress = getExpirationProgress(item.createdAt, item.settings.expirationTime);
    const progressColor = getExpirationColor(progress);
    const isExpiringSoon = progress < 0.1;
    
    const handlePressIn = () => {
      Animated.spring(scaleAnim, {
        toValue: 0.97,
        useNativeDriver: true,
      }).start();
    };
    
    const handlePressOut = () => {
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
      }).start();
    };

    const getInitial = (name: string) => {
      return name.charAt(0).toUpperCase();
    };

    return (
      <Animated.View
        style={[
          styles.groupItemContainer,
          { transform: [{ scale: scaleAnim }] },
        ]}
      >
        <TouchableOpacity
          style={styles.groupItem}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            navigation.navigate('GroupChat', { groupId: item.id });
          }}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          activeOpacity={0.8}
        >
          <BlurView
            intensity={80}
            tint={theme}
            style={[styles.groupBlur, isExpiringSoon && styles.groupBlurExpiring]}
          >
            <View style={[styles.groupContent, { backgroundColor: 'rgba(255, 255, 255, 0.05)' }]}>
          <LinearGradient
            colors={isExpiringSoon 
              ? [colors.error || '#F44336', colors.errorLight || '#EF5350']
              : [colors.primary, colors.primaryLight]}
            style={styles.avatarGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Text style={styles.avatarText}>{getInitial(item.name)}</Text>
          </LinearGradient>
          
          <View style={styles.groupInfo}>
            <View style={styles.groupHeader}>
              <Text style={[styles.groupTitle, { color: colors.text }]}>
                {item.name}
              </Text>
              {item.unreadCount > 0 && (
                <View style={[styles.unreadBadge, { backgroundColor: colors.accent || colors.primary }]}>
                  <Text style={styles.unreadCount}>
                    {item.unreadCount > 99 ? '99+' : item.unreadCount.toString()}
                  </Text>
                </View>
              )}
            </View>
            
            {item.description && (
              <Text 
                style={[styles.groupDescription, { color: colors.textSecondary }]}
                numberOfLines={1}
              >
                {item.description}
              </Text>
            )}
            
            <View style={styles.expirationContainer}>
              <View style={styles.expirationInfo}>
                <Text style={[styles.expirationLabel, { color: progressColor }]}>
                  ⏰ {formatTimeRemaining(item.settings.expirationTime)}
                </Text>
                <Text style={[styles.memberCount, { color: colors.primary }]}>
                  👥 {item.members.length}人
                </Text>
              </View>
              <View style={[styles.progressBarContainer, { backgroundColor: colors.border }]}>
                <Animated.View 
                  style={[
                    styles.progressBar, 
                    { 
                      backgroundColor: progressColor,
                      width: `${progress * 100}%`
                    }
                  ]} 
                />
              </View>
            </View>
            
            {item.lastMessage && (
              <Text 
                style={[styles.lastMessage, { color: colors.textSecondary }]}
                numberOfLines={1}
              >
                {item.lastMessage.sender}: {item.lastMessage.text}
              </Text>
            )}
          </View>
            </View>
          </BlurView>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  return (
    <SafeAreaView 
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['top']}
    >
      <LinearGradient
        colors={[colors.primary + '15', 'transparent']}
        style={styles.headerGradient}
      >
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            FlowGroups
          </Text>
          <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
            {groups.length}個のアクティブグループ
          </Text>
        </View>
      </LinearGradient>
      
      {groups.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={[styles.emptyIconContainer, { backgroundColor: colors.primary + '20' }]}>
            <Text style={styles.emptyIcon}>⏳</Text>
          </View>
          <Text style={[styles.emptyText, { color: colors.text }]}>
            アクティブなグループがありません
          </Text>
          <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
            「作成」タブから新しい期限付きグループを
          </Text>
          <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
            作成して会話を始めましょう
          </Text>
        </View>
      ) : (
        <FlatList
          data={groups}
          renderItem={renderGroupItem}
          keyExtractor={(item) => item.id}
          style={styles.groupList}
          contentContainerStyle={styles.groupListContent}
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
  groupList: {
    flex: 1,
  },
  groupListContent: {
    paddingVertical: 12,
    paddingBottom: 100,
  },
  groupItemContainer: {
    marginHorizontal: 16,
    marginVertical: 6,
  },
  groupItem: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  groupBlur: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  groupBlurExpiring: {
    borderWidth: 1,
    borderColor: 'rgba(244, 67, 54, 0.5)',
  },
  groupContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  avatarGradient: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
  },
  groupInfo: {
    flex: 1,
  },
  groupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  groupTitle: {
    fontSize: 17,
    fontWeight: '600',
    flex: 1,
  },
  groupDescription: {
    fontSize: 14,
    marginBottom: 8,
    lineHeight: 18,
  },
  expirationContainer: {
    marginBottom: 8,
  },
  expirationInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  expirationLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  memberCount: {
    fontSize: 13,
    fontWeight: '500',
  },
  progressBarContainer: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 2,
  },
  lastMessage: {
    fontSize: 13,
    marginTop: 2,
  },
  unreadBadge: {
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  unreadCount: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyIcon: {
    fontSize: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    opacity: 0.7,
  },
});

export default HomeScreen;