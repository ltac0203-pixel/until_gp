import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Animated,
  Modal,
  ScrollView,
  Alert,
  Share,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../contexts/ThemeContext";
import { getThemeColors } from "../utils/themes";
import { Message, Group } from "../types";
import { StorageService } from "../services/storage";
import MessageBubble from "../components/MessageBubble";
import MessageInput from "../components/MessageInput";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import Icon from "react-native-vector-icons/Ionicons";

interface GroupChatScreenProps {
  navigation: any;
  route: {
    params: {
      groupId: string;
    };
  };
}

const GroupChatScreen: React.FC<GroupChatScreenProps> = ({
  navigation,
  route,
}) => {
  const { theme } = useTheme();
  const colors = getThemeColors(theme);
  const { groupId } = route.params;
  const [group, setGroup] = useState<Group | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const flatListRef = useRef<FlatList>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showGroupDetails, setShowGroupDetails] = useState(false);

  useEffect(() => {
    loadGroup();
  }, [groupId]);


  const loadGroup = async () => {
    setRefreshing(true);
    const loadedGroup = await StorageService.loadGroup(groupId);
    if (loadedGroup) {
      setGroup(loadedGroup);
      setMessages(loadedGroup.messages);
    }
    setRefreshing(false);
  };

  const handleSendMessage = async (text: string) => {
    if (!group) return;

    // Prevent messaging in expired/archived groups
    if (group.status === "archived") return;

    const newMessage: Message = {
      id: Date.now().toString(),
      text,
      timestamp: new Date(),
      isOwnMessage: true,
      sender: "あなた",
      status: "sending",
      deliveryTime: new Date(Date.now() + 2000),
    };

    const updatedMessages = [...messages, newMessage];
    setMessages(updatedMessages);

    const updatedGroup = {
      ...group,
      messages: updatedMessages,
      lastMessage: newMessage,
      lastActivity: new Date(),
    };

    await StorageService.saveGroup(updatedGroup);
    setGroup(updatedGroup);

    setTimeout(() => {
      const deliveredMessage = { ...newMessage, status: "sent" as const };
      const deliveredMessages = updatedMessages.map((msg) =>
        msg.id === newMessage.id ? deliveredMessage : msg
      );
      setMessages(deliveredMessages);

      const deliveredGroup = {
        ...updatedGroup,
        messages: deliveredMessages,
        lastMessage: deliveredMessage,
      };
      StorageService.saveGroup(deliveredGroup);
      setGroup(deliveredGroup);
    }, 2000);

    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const handleReaction = async (messageId: string, emoji: string) => {
    if (!group) return;

    // Prevent reactions in expired/archived groups
    if (group.status === "archived") return;

    const updatedMessages = messages.map((msg) => {
      if (msg.id === messageId) {
        const existingReaction = msg.reactions?.find(
          (r) => r.userId === "you" && r.emoji === emoji
        );

        if (existingReaction) {
          return {
            ...msg,
            reactions: msg.reactions?.filter(
              (r) => !(r.userId === "you" && r.emoji === emoji)
            ),
          };
        } else {
          return {
            ...msg,
            reactions: [
              ...(msg.reactions || []),
              { emoji, userId: "you", timestamp: new Date() },
            ],
          };
        }
      }
      return msg;
    });

    setMessages(updatedMessages);

    const updatedGroup = {
      ...group,
      messages: updatedMessages,
    };

    await StorageService.saveGroup(updatedGroup);
    setGroup(updatedGroup);
  };

  const handleShareInviteCode = async () => {
    if (!group?.inviteCode) return;

    try {
      await Share.share({
        message: `FlowGroupsの招待コード: ${group.inviteCode}\n\nグループ「${group.name}」に参加しよう！`,
        title: "グループに招待",
      });
    } catch (error) {
      console.error("Share failed:", error);
    }
  };

  const handleRegenerateInviteCode = async () => {
    if (!group) return;

    Alert.alert(
      "招待コードを再生成",
      "現在の招待コードは無効になります。続行しますか？",
      [
        { text: "キャンセル", style: "cancel" },
        {
          text: "再生成",
          onPress: async () => {
            const newCode = await StorageService.regenerateInviteCode(group.id);
            if (newCode) {
              const updatedGroup = await StorageService.loadGroup(group.id);
              if (updatedGroup) {
                setGroup(updatedGroup);
                Alert.alert("完了", `新しい招待コード: ${newCode}`);
              }
            }
          },
        },
      ]
    );
  };

  const handleRemoveMember = async (memberId: string, memberName: string) => {
    if (!group || group.createdBy !== "you") return;

    Alert.alert("メンバーを削除", `${memberName}をグループから削除しますか？`, [
      { text: "キャンセル", style: "cancel" },
      {
        text: "削除",
        style: "destructive",
        onPress: async () => {
          const success = await StorageService.removeMember(
            group.id,
            memberId,
            "you"
          );
          if (success) {
            const updatedGroup = await StorageService.loadGroup(group.id);
            if (updatedGroup) {
              setGroup(updatedGroup);
              setMessages(updatedGroup.messages);
            }
          } else {
            Alert.alert("エラー", "メンバーの削除に失敗しました");
          }
        },
      },
    ]);
  };

  const renderMessage = ({ item }: { item: Message }) => (
    <MessageBubble message={item} onReaction={handleReaction} />
  );

  if (!group) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            読み込み中...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={["top"]}
    >
      <LinearGradient
        colors={[colors.primary, colors.primaryLight]}
        style={styles.headerGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              navigation.goBack();
            }}
          >
            <View style={styles.backButtonCircle}>
              <Text style={styles.backButtonText}>←</Text>
            </View>
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle}>{group.name}</Text>
            <Text style={styles.memberCount}>
              {group.status === "archived" ? "📋 終了済み" : `👥 ${group.members.length}人のメンバー`}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.infoButton}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowGroupDetails(true);
            }}
          >
            <View style={styles.infoButtonCircle}>
              <Text style={styles.infoButtonText}>ⓘ</Text>
            </View>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          style={styles.messageList}
          contentContainerStyle={styles.messageListContent}
          onRefresh={loadGroup}
          refreshing={refreshing}
          showsVerticalScrollIndicator={false}
        />

        {group.status !== "archived" ? (
          <MessageInput
            onSendMessage={handleSendMessage}
            showTypingIndicator={false}
            recipientName={group.name}
          />
        ) : (
          <View style={[styles.expiredGroupNotice, { backgroundColor: colors.surface }]}>
            <Text style={[styles.expiredGroupText, { color: colors.textSecondary }]}>
              このグループは終了しています
            </Text>
          </View>
        )}
      </KeyboardAvoidingView>

      <Modal
        visible={showGroupDetails}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowGroupDetails(false)}
      >
        <SafeAreaView
          style={[
            styles.detailsContainer,
            { backgroundColor: colors.background },
          ]}
        >
          <LinearGradient
            colors={[colors.primary, colors.primaryLight]}
            style={styles.detailsHeader}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.detailsHeaderContent}>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setShowGroupDetails(false);
                }}
              >
                <View style={styles.closeButtonCircle}>
                  <Text style={styles.closeButtonText}>×</Text>
                </View>
              </TouchableOpacity>
              <Text style={styles.detailsTitle}>グループ詳細</Text>
              <View style={styles.headerSpacer} />
            </View>
          </LinearGradient>

          <ScrollView
            style={styles.detailsContent}
            contentContainerStyle={styles.detailsContentContainer}
          >
            {/* Group Name */}
            <View
              style={[
                styles.detailsSection,
                { backgroundColor: colors.surface },
              ]}
            >
              <Text
                style={[
                  styles.detailsSectionTitle,
                  { color: colors.textSecondary },
                ]}
              >
                グループ名
              </Text>
              <Text
                style={[styles.detailsSectionContent, { color: colors.text }]}
              >
                {group?.name}
              </Text>
            </View>

            {/* Group Description */}
            {group?.description && (
              <View
                style={[
                  styles.detailsSection,
                  { backgroundColor: colors.surface },
                ]}
              >
                <Text
                  style={[
                    styles.detailsSectionTitle,
                    { color: colors.textSecondary },
                  ]}
                >
                  説明
                </Text>
                <Text
                  style={[styles.detailsSectionContent, { color: colors.text }]}
                >
                  {group.description}
                </Text>
              </View>
            )}

            {/* Invite Code Section */}
            {group?.status !== "archived" && (
              <View
                style={[
                  styles.detailsSection,
                  { backgroundColor: colors.surface },
                ]}
              >
                <Text
                  style={[
                    styles.detailsSectionTitle,
                    { color: colors.textSecondary },
                  ]}
                >
                  招待コード
                </Text>
                <View style={styles.inviteCodeContainer}>
                  <Text
                    style={[
                      styles.inviteCode,
                      {
                        color: colors.primary,
                        backgroundColor: colors.primary + "20",
                      },
                    ]}
                  >
                    {group?.inviteCode || "N/A"}
                  </Text>
                  <View style={styles.inviteActions}>
                    <TouchableOpacity
                      style={[
                        styles.inviteButton,
                        { backgroundColor: colors.primary },
                      ]}
                      onPress={handleShareInviteCode}
                    >
                      <Icon name="share-outline" size={18} color="#FFFFFF" />
                      <Text style={styles.inviteButtonText}>共有</Text>
                    </TouchableOpacity>
                    {group?.createdBy === "you" && (
                      <TouchableOpacity
                        style={[
                          styles.inviteButton,
                          { backgroundColor: colors.textSecondary },
                        ]}
                        onPress={handleRegenerateInviteCode}
                      >
                        <Icon
                          name="refresh-outline"
                          size={18}
                          color="#FFFFFF"
                        />
                        <Text style={styles.inviteButtonText}>再生成</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </View>
            )}

            {/* Creator */}
            <View
              style={[
                styles.detailsSection,
                { backgroundColor: colors.surface },
              ]}
            >
              <Text
                style={[
                  styles.detailsSectionTitle,
                  { color: colors.textSecondary },
                ]}
              >
                作成者
              </Text>
              <Text
                style={[styles.detailsSectionContent, { color: colors.text }]}
              >
                {group?.members.find((member) => member.id === group.createdBy)
                  ?.name || group?.createdBy}
              </Text>
            </View>

            {/* Members */}
            <View
              style={[
                styles.detailsSection,
                { backgroundColor: colors.surface },
              ]}
            >
              <Text
                style={[
                  styles.detailsSectionTitle,
                  { color: colors.textSecondary },
                ]}
              >
                参加者 ({group?.members.length}人)
              </Text>
              {group?.members.map((member, index) => (
                <View key={member.id} style={styles.memberItem}>
                  <LinearGradient
                    colors={[colors.primary, colors.primaryLight]}
                    style={styles.memberAvatar}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <Text style={styles.memberAvatarText}>
                      {member.name.charAt(0).toUpperCase()}
                    </Text>
                  </LinearGradient>
                  <View style={styles.memberInfo}>
                    <Text style={[styles.memberName, { color: colors.text }]}>
                      {member.name}
                    </Text>
                    {member.id === group?.createdBy && (
                      <Text
                        style={[styles.memberRole, { color: colors.primary }]}
                      >
                        作成者
                      </Text>
                    )}
                  </View>
                  {group?.createdBy === "you" &&
                    member.id !== "you" &&
                    group?.status !== "archived" && (
                      <TouchableOpacity
                        style={[
                          styles.removeMemberButton,
                          { backgroundColor: colors.error + "20" },
                        ]}
                        onPress={() =>
                          handleRemoveMember(member.id, member.name)
                        }
                      >
                        <Icon
                          name="close-circle"
                          size={20}
                          color={colors.error}
                        />
                      </TouchableOpacity>
                    )}
                </View>
              ))}
            </View>

            {/* Creation Date */}
            <View
              style={[
                styles.detailsSection,
                { backgroundColor: colors.surface },
              ]}
            >
              <Text
                style={[
                  styles.detailsSectionTitle,
                  { color: colors.textSecondary },
                ]}
              >
                作成日
              </Text>
              <Text
                style={[styles.detailsSectionContent, { color: colors.text }]}
              >
                {group?.createdAt.toLocaleDateString("ja-JP", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </Text>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    fontSize: 16,
  },
  headerGradient: {
    paddingBottom: 4,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: Platform.OS === "ios" ? 8 : 16,
  },
  backButton: {
    marginRight: 12,
  },
  backButtonCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  backButtonText: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  headerInfo: {
    flex: 1,
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginBottom: 2,
  },
  memberCount: {
    fontSize: 13,
    color: "rgba(255,255,255,0.9)",
  },
  headerSpacer: {
    width: 52,
  },
  infoButton: {
    marginLeft: 12,
  },
  infoButtonCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  infoButtonText: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  messageList: {
    flex: 1,
  },
  messageListContent: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  // Group details modal styles
  detailsContainer: {
    flex: 1,
  },
  detailsHeader: {
    paddingBottom: 4,
  },
  detailsHeaderContent: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: Platform.OS === "ios" ? 8 : 16,
  },
  closeButton: {
    marginRight: 12,
  },
  closeButtonCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  closeButtonText: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  detailsTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: "bold",
    color: "#FFFFFF",
    textAlign: "center",
  },
  detailsContent: {
    flex: 1,
  },
  detailsContentContainer: {
    padding: 16,
  },
  detailsSection: {
    marginBottom: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  detailsSectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  detailsSectionContent: {
    fontSize: 16,
    lineHeight: 22,
  },
  memberItem: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    paddingVertical: 8,
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  memberAvatarText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "bold",
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: "500",
    marginBottom: 2,
  },
  memberRole: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  inviteCodeContainer: {
    marginTop: 8,
  },
  inviteCode: {
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    letterSpacing: 2,
  },
  inviteActions: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
    marginTop: 12,
  },
  inviteButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  inviteButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  removeMemberButton: {
    padding: 8,
    borderRadius: 20,
    marginLeft: "auto",
  },
  expiredGroupNotice: {
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.1)",
    paddingVertical: 20,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  expiredGroupText: {
    fontSize: 16,
    fontWeight: "500",
    textAlign: "center",
  },
});

export default GroupChatScreen;
