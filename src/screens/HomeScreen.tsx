import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Dimensions,
  ScrollView,
  Alert,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../contexts/ThemeContext';
import { getThemeColors } from '../utils/themes';
import { Group, GroupLifespan, GroupStatus } from '../types';
import { StorageService } from '../services/storage';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

interface HomeScreenProps {
  navigation: any;
}

const LIFESPAN_OPTIONS: { value: GroupLifespan; label: string; duration: number }[] = [
  { value: '1_hour', label: '1時間後', duration: 60 * 60 * 1000 },
  { value: '24_hours', label: '24時間後', duration: 24 * 60 * 60 * 1000 },
  { value: '3_days', label: '3日後', duration: 3 * 24 * 60 * 60 * 1000 },
  { value: '7_days', label: '1週間後', duration: 7 * 24 * 60 * 60 * 1000 },
  { value: 'custom', label: 'カスタム', duration: 0 },
];

const HomeScreen: React.FC<HomeScreenProps> = ({ navigation }) => {
  const { theme } = useTheme();
  const colors = getThemeColors(theme);
  const [groups, setGroups] = useState<Group[]>([]);
  const [archivedGroups, setArchivedGroups] = useState<Group[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showArchivedModal, setShowArchivedModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDescription, setNewGroupDescription] = useState('');
  const [selectedLifespan, setSelectedLifespan] = useState<GroupLifespan>('24_hours');
  const [customDate, setCustomDate] = useState(new Date(Date.now() + 24 * 60 * 60 * 1000));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

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
    const { active, archived } = await StorageService.loadGroups();
    const sortedActive = active
      .filter(g => g.status === 'active' || g.status === 'expiring_soon')
      .sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime());
    setGroups(sortedActive);
    setArchivedGroups(archived.slice(0, 20)); // Show last 20 archived groups
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

  const handleCreateGroup = async () => {
    if (newGroupName.trim()) {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      
      let expirationTime: Date;
      if (selectedLifespan === 'custom') {
        // Validate custom date is within 30 days
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
        newGroupName.trim(),
        newGroupDescription.trim(),
        selectedLifespan,
        expirationTime
      );
      
      setNewGroupName('');
      setNewGroupDescription('');
      setSelectedLifespan('24_hours');
      setCustomDate(new Date(Date.now() + 24 * 60 * 60 * 1000));
      setShowCreateModal(false);
      await loadGroups();
      navigation.navigate('GroupChat', { groupId: newGroup.id });
    }
  };

  const formatCustomDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const hours = date.getHours();
    const minutes = date.getMinutes();
    return `${year}/${month}/${day} ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  };

  const onDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      const newDate = new Date(customDate);
      newDate.setFullYear(selectedDate.getFullYear());
      newDate.setMonth(selectedDate.getMonth());
      newDate.setDate(selectedDate.getDate());
      
      // Validate max 30 days
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
          style={[styles.groupItem, { 
            backgroundColor: colors.surface,
            shadowColor: isExpiringSoon ? colors.error : colors.primary,
            borderWidth: isExpiringSoon ? 1 : 0,
            borderColor: isExpiringSoon ? colors.error : undefined,
          }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            navigation.navigate('GroupChat', { groupId: item.id });
          }}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          activeOpacity={1}
        >
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
        colors={[colors.primary, colors.primaryLight]}
        style={styles.headerGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>
              FlowGroups
            </Text>
            <Text style={styles.headerSubtitle}>
              {groups.length}個のアクティブグループ
            </Text>
          </View>
          <TouchableOpacity
            style={styles.archiveButton}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowArchivedModal(true);
            }}
          >
            <Text style={styles.archiveButtonText}>📚</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
      
      {groups.length === 0 ? (
        <View style={styles.emptyContainer}>
          <LinearGradient
            colors={[colors.primary, colors.primaryLight]}
            style={styles.emptyIconGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Text style={styles.emptyIcon}>⏳</Text>
          </LinearGradient>
          <Text style={[styles.emptyText, { color: colors.text }]}>
            アクティブなグループがありません
          </Text>
          <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
            新しい期限付きグループを作成して
          </Text>
          <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
            気軽に会話を始めましょう
          </Text>
          <TouchableOpacity
            style={styles.emptyCreateButton}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowCreateModal(true);
            }}
          >
            <LinearGradient
              colors={[colors.primary, colors.primaryDark]}
              style={styles.emptyCreateButtonGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Text style={styles.emptyCreateButtonText}>新規グループを作成</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={groups}
          renderItem={renderGroupItem}
          keyExtractor={(item) => item.id}
          style={styles.groupList}
          contentContainerStyle={styles.groupListContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      <TouchableOpacity
        style={styles.floatingActionButton}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setShowCreateModal(true);
        }}
      >
        <LinearGradient
          colors={[colors.primary, colors.primaryDark]}
          style={styles.floatingButtonGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Text style={styles.floatingButtonText}>+</Text>
        </LinearGradient>
      </TouchableOpacity>

      <Modal
        visible={showCreateModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCreateModal(false)}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalContainer}
        >
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              新規グループを作成
            </Text>
            
            <TextInput
              style={[styles.input, { 
                backgroundColor: colors.background,
                color: colors.text,
                borderColor: colors.border,
              }]}
              placeholder="グループ名"
              placeholderTextColor={colors.textSecondary}
              value={newGroupName}
              onChangeText={setNewGroupName}
              maxLength={50}
            />
            
            <TextInput
              style={[styles.input, styles.descriptionInput, { 
                backgroundColor: colors.background,
                color: colors.text,
                borderColor: colors.border,
              }]}
              placeholder="説明（任意）"
              placeholderTextColor={colors.textSecondary}
              value={newGroupDescription}
              onChangeText={setNewGroupDescription}
              multiline
              maxLength={200}
            />
            
            <Text style={[styles.lifespanLabel, { color: colors.text }]}>
              グループの有効期限（最大30日）
            </Text>
            
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              style={styles.lifespanScroll}
            >
              {LIFESPAN_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.lifespanOption,
                    {
                      backgroundColor: selectedLifespan === option.value 
                        ? colors.primary 
                        : colors.background,
                      borderColor: selectedLifespan === option.value 
                        ? colors.primary 
                        : colors.border,
                    }
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setSelectedLifespan(option.value);
                  }}
                >
                  <Text style={[
                    styles.lifespanOptionText,
                    {
                      color: selectedLifespan === option.value 
                        ? '#FFFFFF' 
                        : colors.text
                    }
                  ]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            
            {selectedLifespan === 'custom' && (
              <View style={styles.customDateContainer}>
                <Text style={[styles.customDateLabel, { color: colors.text }]}>
                  解散日時を選択:
                </Text>
                <View style={styles.dateTimeRow}>
                  <TouchableOpacity
                    style={[styles.dateButton, { 
                      backgroundColor: colors.background,
                      borderColor: colors.border,
                    }]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setShowDatePicker(true);
                    }}
                  >
                    <Text style={[styles.dateButtonText, { color: colors.text }]}>
                      📅 {customDate.toLocaleDateString('ja-JP')}
                    </Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[styles.timeButton, { 
                      backgroundColor: colors.background,
                      borderColor: colors.border,
                    }]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setShowTimePicker(true);
                    }}
                  >
                    <Text style={[styles.timeButtonText, { color: colors.text }]}>
                      🕐 {customDate.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </TouchableOpacity>
                </View>
                <Text style={[styles.customDateDisplay, { color: colors.primary }]}>
                  {formatCustomDate(customDate)}
                </Text>
              </View>
            )}
            
            <Text style={[styles.lifespanHint, { color: colors.textSecondary }]}>
              グループは期限が来ると自動的に解散します
            </Text>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton, {
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                }]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setShowCreateModal(false);
                  setNewGroupName('');
                  setNewGroupDescription('');
                  setSelectedLifespan('24_hours');
                }}
              >
                <Text style={[styles.cancelButtonText, { color: colors.text }]}>
                  キャンセル
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton, { 
                  backgroundColor: newGroupName.trim() ? colors.primary : colors.disabled,
                }]}
                onPress={handleCreateGroup}
                disabled={!newGroupName.trim()}
              >
                <Text style={styles.confirmButtonText}>作成</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={showArchivedModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowArchivedModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={[styles.archivedModalContent, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              アーカイブ済みグループ
            </Text>
            
            {archivedGroups.length === 0 ? (
              <Text style={[styles.emptyArchiveText, { color: colors.textSecondary }]}>
                アーカイブされたグループはありません
              </Text>
            ) : (
              <FlatList
                data={archivedGroups}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[styles.archivedItem, { backgroundColor: colors.background }]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      // View archived group (read-only)
                      setShowArchivedModal(false);
                      navigation.navigate('GroupChat', { 
                        groupId: item.id,
                        isArchived: true 
                      });
                    }}
                  >
                    <Text style={[styles.archivedItemName, { color: colors.text }]}>
                      {item.name}
                    </Text>
                    <Text style={[styles.archivedItemInfo, { color: colors.textSecondary }]}>
                      {item.disbandReason === 'time_expired' && '期限切れ'}
                      {item.disbandReason === 'inactivity' && '非アクティブ'}
                      {item.disbandReason === 'message_limit' && 'メッセージ上限'}
                      {' • '}
                      {item.disbandedAt && new Date(item.disbandedAt).toLocaleDateString('ja-JP')}
                    </Text>
                  </TouchableOpacity>
                )}
                showsVerticalScrollIndicator={false}
                style={styles.archivedList}
              />
            )}
            
            <TouchableOpacity
              style={[styles.closeArchiveButton, { backgroundColor: colors.primary }]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setShowArchivedModal(false);
              }}
            >
              <Text style={styles.closeArchiveButtonText}>閉じる</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

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
  headerGradient: {
    paddingBottom: 4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingTop: Platform.OS === 'ios' ? 8 : 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
  },
  archiveButton: {
    padding: 8,
  },
  archiveButtonText: {
    fontSize: 24,
  },
  floatingActionButton: {
    position: 'absolute',
    bottom: 30,
    right: 20,
    width: 64,
    height: 64,
    borderRadius: 32,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  floatingButtonGradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 32,
  },
  floatingButtonText: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '300',
  },
  groupList: {
    flex: 1,
  },
  groupListContent: {
    paddingVertical: 12,
  },
  groupItemContainer: {
    marginHorizontal: 16,
    marginVertical: 6,
  },
  groupItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
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
  emptyIconGradient: {
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
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  emptyCreateButton: {
    marginTop: 24,
    overflow: 'hidden',
    borderRadius: 12,
  },
  emptyCreateButtonGradient: {
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
  },
  emptyCreateButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    width: '90%',
    maxWidth: 400,
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    marginBottom: 12,
  },
  descriptionInput: {
    minHeight: 60,
    textAlignVertical: 'top',
  },
  lifespanLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  customDateContainer: {
    marginVertical: 12,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  customDateLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  dateTimeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  dateButton: {
    flex: 1,
    marginRight: 4,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  timeButton: {
    flex: 1,
    marginLeft: 4,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  dateButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  timeButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  customDateDisplay: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 4,
  },
  lifespanScroll: {
    maxHeight: 50,
    marginBottom: 8,
  },
  lifespanOption: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
  },
  lifespanOptionText: {
    fontSize: 14,
    fontWeight: '500',
  },
  lifespanHint: {
    fontSize: 12,
    marginBottom: 16,
    textAlign: 'center',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    marginRight: 8,
    borderWidth: 1,
  },
  confirmButton: {
    marginLeft: 8,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  archivedModalContent: {
    width: '90%',
    maxWidth: 400,
    maxHeight: '70%',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  archivedList: {
    maxHeight: 400,
  },
  archivedItem: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  archivedItemName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  archivedItemInfo: {
    fontSize: 13,
  },
  emptyArchiveText: {
    textAlign: 'center',
    marginVertical: 40,
    fontSize: 15,
  },
  closeArchiveButton: {
    marginTop: 16,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  closeArchiveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default HomeScreen;