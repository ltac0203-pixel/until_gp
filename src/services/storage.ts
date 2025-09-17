import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  Message,
  FlowGroupsSettings,
  MessageStatus,
  Group,
  GroupLifespan,
  GroupStatus,
  DisbandReason,
  UserProfile,
} from "../types";

const MESSAGES_KEY = "@flowgroups_messages";
const SETTINGS_KEY = "@flowgroups_settings";
const ACTIVE_GROUPS_KEY = "@flowgroups_active_groups";
const ARCHIVED_GROUPS_KEY = "@flowgroups_archived_groups";

export const StorageService = {
  async saveMessages(messages: Message[]): Promise<void> {
    try {
      const jsonValue = JSON.stringify(messages);
      await AsyncStorage.setItem(MESSAGES_KEY, jsonValue);
    } catch (e) {
      console.error("Failed to save messages:", e);
    }
  },

  async loadMessages(): Promise<Message[]> {
    try {
      const jsonValue = await AsyncStorage.getItem(MESSAGES_KEY);
      if (jsonValue != null) {
        const messages = JSON.parse(jsonValue);
        return messages.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp),
          deliveryTime: msg.deliveryTime
            ? new Date(msg.deliveryTime)
            : undefined,
          editedAt: msg.editedAt ? new Date(msg.editedAt) : undefined,
          reactions: msg.reactions?.map((r: any) => ({
            ...r,
            timestamp: new Date(r.timestamp),
          })),
          attachments: msg.attachments || undefined,
        }));
      }
      return [];
    } catch (e) {
      console.error("Failed to load messages:", e);
      return [];
    }
  },

  async saveSettings(settings: FlowGroupsSettings): Promise<void> {
    try {
      const jsonValue = JSON.stringify(settings);
      await AsyncStorage.setItem(SETTINGS_KEY, jsonValue);
    } catch (e) {
      console.error("Failed to save settings:", e);
    }
  },

  async loadSettings(): Promise<FlowGroupsSettings> {
    try {
      const jsonValue = await AsyncStorage.getItem(SETTINGS_KEY);
      if (jsonValue != null) {
        const settings = JSON.parse(jsonValue);
        if (settings.currentUser?.createdAt) {
          settings.currentUser.createdAt = new Date(
            settings.currentUser.createdAt
          );
        }
        return settings;
      }
    } catch (e) {
      console.error("Failed to load settings:", e);
    }

    // Create default user profile
    const defaultUser: UserProfile = {
      id: "you",
      name: "あなた",
      createdAt: new Date(),
    };

    return {
      theme: "light",
      enableHaptics: true,
      enableTypingIndicator: true,
      defaultGroupLifespan: "24_hours",
      showExpirationWarnings: true,
      archiveRetentionDays: 30,
      autoJoinSuggestions: false,
      currentUser: defaultUser,
    };
  },

  async getCurrentUser(): Promise<UserProfile> {
    const settings = await this.loadSettings();
    if (!settings.currentUser) {
      // Create and save default user if not exists
      const defaultUser: UserProfile = {
        id: "you",
        name: "あなた",
        createdAt: new Date(),
      };
      settings.currentUser = defaultUser;
      await this.saveSettings(settings);
      return defaultUser;
    }
    return settings.currentUser;
  },

  async updateCurrentUser(profile: UserProfile): Promise<void> {
    const settings = await this.loadSettings();
    settings.currentUser = profile;
    await this.saveSettings(settings);
  },

  async clearAll(): Promise<void> {
    try {
      await AsyncStorage.multiRemove([
        MESSAGES_KEY,
        SETTINGS_KEY,
        ACTIVE_GROUPS_KEY,
        ARCHIVED_GROUPS_KEY,
      ]);
    } catch (e) {
      console.error("Failed to clear storage:", e);
    }
  },

  // Group management methods
  async saveActiveGroups(groups: Group[]): Promise<void> {
    try {
      const jsonValue = JSON.stringify(groups);
      await AsyncStorage.setItem(ACTIVE_GROUPS_KEY, jsonValue);
    } catch (e) {
      console.error("Failed to save active groups:", e);
    }
  },

  async saveArchivedGroups(groups: Group[]): Promise<void> {
    try {
      const jsonValue = JSON.stringify(groups);
      await AsyncStorage.setItem(ARCHIVED_GROUPS_KEY, jsonValue);
    } catch (e) {
      console.error("Failed to save archived groups:", e);
    }
  },

  async loadGroups(): Promise<{ active: Group[]; archived: Group[] }> {
    try {
      const activeJson = await AsyncStorage.getItem(ACTIVE_GROUPS_KEY);
      const archivedJson = await AsyncStorage.getItem(ARCHIVED_GROUPS_KEY);

      const parseGroups = (jsonValue: string | null): Group[] => {
        if (!jsonValue) return [];
        const groups = JSON.parse(jsonValue);
        return groups.map((group: any) => ({
          ...group,
          createdAt: new Date(group.createdAt),
          lastActivity: new Date(group.lastActivity),
          settings: {
            ...group.settings,
            expirationTime: new Date(group.settings.expirationTime),
          },
          disbandedAt: group.disbandedAt
            ? new Date(group.disbandedAt)
            : undefined,
          archivedUntil: group.archivedUntil
            ? new Date(group.archivedUntil)
            : undefined,
          lastMessage: group.lastMessage
            ? {
                ...group.lastMessage,
                timestamp: new Date(group.lastMessage.timestamp),
                deliveryTime: group.lastMessage.deliveryTime
                  ? new Date(group.lastMessage.deliveryTime)
                  : undefined,
                editedAt: group.lastMessage.editedAt
                  ? new Date(group.lastMessage.editedAt)
                  : undefined,
                reactions: group.lastMessage.reactions?.map((r: any) => ({
                  ...r,
                  timestamp: new Date(r.timestamp),
                })),
                attachments: group.lastMessage.attachments || undefined,
              }
            : undefined,
          messages: group.messages.map((msg: any) => ({
            ...msg,
            timestamp: new Date(msg.timestamp),
            deliveryTime: msg.deliveryTime
              ? new Date(msg.deliveryTime)
              : undefined,
            editedAt: msg.editedAt ? new Date(msg.editedAt) : undefined,
            reactions: msg.reactions?.map((r: any) => ({
              ...r,
              timestamp: new Date(r.timestamp),
            })),
            attachments: msg.attachments || undefined,
          })),
        }));
      };

      const active = parseGroups(activeJson);
      const archived = parseGroups(archivedJson);

      // Clean up old archived groups
      const now = new Date();
      const filteredArchived = archived.filter(
        (g) => !g.archivedUntil || g.archivedUntil.getTime() > now.getTime()
      );

      if (filteredArchived.length !== archived.length) {
        await this.saveArchivedGroups(filteredArchived);
      }

      return {
        active: active.length > 0 ? active : this.getDefaultGroups(),
        archived: filteredArchived,
      };
    } catch (e) {
      console.error("Failed to load groups:", e);
      return { active: this.getDefaultGroups(), archived: [] };
    }
  },

  async processExpiredGroups(): Promise<void> {
    try {
      const { active, archived } = await this.loadGroups();
      const now = new Date();

      const stillActive: Group[] = [];
      const newlyArchived: Group[] = [];

      for (const group of active) {
        const isExpired =
          group.settings.expirationTime.getTime() <= now.getTime();
        const isInactive =
          group.settings.inactivityThreshold &&
          now.getTime() - group.lastActivity.getTime() >
            group.settings.inactivityThreshold * 24 * 60 * 60 * 1000;
        const hasReachedMessageLimit =
          group.settings.messageLimit &&
          group.messageCount >= group.settings.messageLimit;

        if (isExpired || isInactive || hasReachedMessageLimit) {
          const archivedGroup: Group = {
            ...group,
            status: "archived",
            disbandedAt: now,
            disbandReason: isExpired
              ? "time_expired"
              : isInactive
              ? "inactivity"
              : "message_limit",
            archivedUntil: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000), // Keep for 30 days
          };
          newlyArchived.push(archivedGroup);
        } else {
          // Update status if expiring soon (< 10% time remaining)
          const totalTime =
            group.settings.expirationTime.getTime() - group.createdAt.getTime();
          const remainingTime =
            group.settings.expirationTime.getTime() - now.getTime();
          const percentRemaining = remainingTime / totalTime;

          if (percentRemaining < 0.1 && group.status !== "expiring_soon") {
            group.status = "expiring_soon";
          }
          stillActive.push(group);
        }
      }

      if (newlyArchived.length > 0) {
        await this.saveActiveGroups(stillActive);
        await this.saveArchivedGroups([...archived, ...newlyArchived]);
      }
    } catch (e) {
      console.error("Failed to process expired groups:", e);
    }
  },

  async loadGroup(groupId: string): Promise<Group | null> {
    const { active, archived } = await this.loadGroups();
    return (
      [...active, ...archived].find((group) => group.id === groupId) || null
    );
  },

  async saveGroup(group: Group): Promise<void> {
    try {
      const { active, archived } = await this.loadGroups();

      if (group.status === "archived") {
        const index = archived.findIndex((g) => g.id === group.id);
        if (index >= 0) {
          archived[index] = group;
        } else {
          archived.push(group);
        }
        await this.saveArchivedGroups(archived);
      } else {
        const index = active.findIndex((g) => g.id === group.id);
        if (index >= 0) {
          active[index] = group;
        } else {
          active.push(group);
        }
        await this.saveActiveGroups(active);
      }
    } catch (e) {
      console.error("Failed to save group:", e);
    }
  },

  async createGroup(
    name: string,
    description: string,
    lifespan: GroupLifespan,
    expirationTime: Date
  ): Promise<Group> {
    const inviteCode = this.generateInviteCode();
    const inviteCodeExpiresAt = new Date(expirationTime.getTime()); // Invite code expires with group
    const currentUser = await this.getCurrentUser();

    const newGroup: Group = {
      id: Date.now().toString(),
      name,
      description,
      members: [{ id: currentUser.id, name: currentUser.name }],
      createdAt: new Date(),
      createdBy: currentUser.id,
      lastActivity: new Date(),
      unreadCount: 0,
      messages: [],
      status: "active",
      settings: {
        lifespan,
        expirationTime,
        warnBeforeExpiry: true,
        allowExtension: false,
      },
      messageCount: 0,
      inviteCode,
      inviteCodeExpiresAt,
    };

    await this.saveGroup(newGroup);
    return newGroup;
  },

  generateInviteCode(): string {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let code = "";
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  },

  async regenerateInviteCode(groupId: string): Promise<string | null> {
    const group = await this.loadGroup(groupId);
    if (!group || group.status === "archived") return null;

    group.inviteCode = this.generateInviteCode();
    group.inviteCodeExpiresAt = new Date(
      group.settings.expirationTime.getTime()
    );

    await this.saveGroup(group);
    return group.inviteCode;
  },

  async joinGroupWithCode(
    inviteCode: string,
    userId: string,
    userName: string
  ): Promise<Group | null> {
    const { active } = await this.loadGroups();
    const group = active.find(
      (g) =>
        g.inviteCode === inviteCode &&
        g.inviteCodeExpiresAt &&
        g.inviteCodeExpiresAt.getTime() > Date.now()
    );

    if (!group) return null;

    // Check if user is already a member
    if (group.members.some((m) => m.id === userId)) {
      return group;
    }

    // Add new member
    group.members.push({ id: userId, name: userName });

    // Add system message about new member
    const systemMessage: Message = {
      id: `system-${Date.now()}`,
      text: `${userName}がグループに参加しました`,
      timestamp: new Date(),
      isOwnMessage: false,
      sender: "システム",
      status: "delivered" as MessageStatus,
    };

    group.messages.push(systemMessage);
    group.lastMessage = systemMessage;
    group.lastActivity = new Date();

    await this.saveGroup(group);
    return group;
  },

  async removeMember(
    groupId: string,
    memberId: string,
    removedBy: string
  ): Promise<boolean> {
    const group = await this.loadGroup(groupId);
    if (!group || group.status === "archived") return false;

    // Only creator can remove members
    if (group.createdBy !== removedBy) return false;

    // Cannot remove creator
    if (memberId === group.createdBy) return false;

    const removedMember = group.members.find((m) => m.id === memberId);
    if (!removedMember) return false;

    // Remove member
    group.members = group.members.filter((m) => m.id !== memberId);

    // Add system message about member removal
    const systemMessage: Message = {
      id: `system-${Date.now()}`,
      text: `${removedMember.name}がグループから削除されました`,
      timestamp: new Date(),
      isOwnMessage: false,
      sender: "システム",
      status: "delivered" as MessageStatus,
    };

    group.messages.push(systemMessage);
    group.lastMessage = systemMessage;
    group.lastActivity = new Date();

    await this.saveGroup(group);
    return true;
  },

  getDefaultGroups(): Group[] {
    const now = new Date();
    return [
      {
        id: "group-1",
        name: "サンプル：週次ミーティング",
        description: "1週間で自動解散するグループの例",
        members: [
          { id: "you", name: "あなた" },
          { id: "tanaka", name: "田中さん" },
          { id: "sato", name: "佐藤さん" },
          { id: "yamada", name: "山田さん" },
        ],
        createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 2), // 2 days ago
        createdBy: "tanaka",
        lastActivity: new Date(now.getTime() - 1000 * 60 * 30),
        unreadCount: 3,
        status: "active",
        settings: {
          lifespan: "7_days",
          expirationTime: new Date(now.getTime() + 1000 * 60 * 60 * 24 * 5), // 5 days remaining
          warnBeforeExpiry: true,
          allowExtension: false,
        },
        messageCount: 2,
        messages: [
          {
            id: "g1-1",
            text: "今週のミーティングの議題を共有します。",
            timestamp: new Date(now.getTime() - 1000 * 60 * 45),
            isOwnMessage: false,
            sender: "田中さん",
            status: "read" as MessageStatus,
          },
          {
            id: "g1-2",
            text: "ありがとうございます。確認します。",
            timestamp: new Date(now.getTime() - 1000 * 60 * 30),
            isOwnMessage: true,
            sender: "あなた",
            status: "read" as MessageStatus,
          },
        ],
        lastMessage: {
          id: "g1-2",
          text: "ありがとうございます。確認します。",
          timestamp: new Date(now.getTime() - 1000 * 60 * 30),
          isOwnMessage: true,
          sender: "あなた",
          status: "read" as MessageStatus,
        },
      },
      {
        id: "group-2",
        name: "サンプル：今日のランチ",
        description: "24時間で解散する短期グループの例",
        members: [
          { id: "you", name: "あなた" },
          { id: "suzuki", name: "鈴木さん" },
          { id: "ito", name: "伊藤さん" },
        ],
        createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 3), // 3 hours ago
        createdBy: "suzuki",
        lastActivity: new Date(now.getTime() - 1000 * 60 * 60 * 2),
        unreadCount: 0,
        status: "active",
        settings: {
          lifespan: "24_hours",
          expirationTime: new Date(now.getTime() + 1000 * 60 * 60 * 21), // 21 hours remaining
          warnBeforeExpiry: true,
          allowExtension: false,
        },
        messageCount: 2,
        messages: [
          {
            id: "g2-1",
            text: "12時にロビーで集合しましょう！",
            timestamp: new Date(now.getTime() - 1000 * 60 * 60 * 3),
            isOwnMessage: false,
            sender: "鈴木さん",
            status: "read" as MessageStatus,
          },
          {
            id: "g2-2",
            text: "了解です！",
            timestamp: new Date(now.getTime() - 1000 * 60 * 60 * 2),
            isOwnMessage: false,
            sender: "伊藤さん",
            status: "read" as MessageStatus,
          },
        ],
        lastMessage: {
          id: "g2-2",
          text: "了解です！",
          timestamp: new Date(now.getTime() - 1000 * 60 * 60 * 2),
          isOwnMessage: false,
          sender: "伊藤さん",
          status: "read" as MessageStatus,
        },
      },
    ];
  },
};
