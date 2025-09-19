import AsyncStorage from '@react-native-async-storage/async-storage';
import { Group, Message, ChatUser, GroupbySettings } from '../types';
import { supabaseService } from '../services/supabaseService';
import { authService } from '../services/authService';

// Legacy storage keys from the old system
const LEGACY_KEYS = {
  ACTIVE_GROUPS: 'active_groups',
  ARCHIVED_GROUPS: 'archived_groups',
  MESSAGES: 'messages',
  SETTINGS: 'settings',
  CURRENT_USER: 'current_user',
};

export interface MigrationResult {
  success: boolean;
  migratedGroups: number;
  migratedMessages: number;
  migratedSettings: boolean;
  errors: string[];
}

export interface MigrationStatus {
  needsMigration: boolean;
  hasLegacyData: boolean;
  userExists: boolean;
}

class DataMigrationService {
  /**
   * Check if migration is needed
   */
  async checkMigrationStatus(): Promise<MigrationStatus> {
    try {
      // Check if user is authenticated
      const currentAuthState = await authService.getCurrentAuthState();
      const userExists = currentAuthState.isAuthenticated;

      // Check for legacy data
      const legacyGroups = await AsyncStorage.getItem(LEGACY_KEYS.ACTIVE_GROUPS);
      const legacyMessages = await AsyncStorage.getItem(LEGACY_KEYS.MESSAGES);
      const legacySettings = await AsyncStorage.getItem(LEGACY_KEYS.SETTINGS);

      const hasLegacyData = !!(legacyGroups || legacyMessages || legacySettings);

      // Migration is needed if there's legacy data and user is authenticated
      const needsMigration = hasLegacyData && userExists;

      return {
        needsMigration,
        hasLegacyData,
        userExists,
      };
    } catch (error) {
      console.error('Error checking migration status:', error);
      return {
        needsMigration: false,
        hasLegacyData: false,
        userExists: false,
      };
    }
  }

  /**
   * Perform full data migration from AsyncStorage to Supabase
   */
  async migrateAllData(): Promise<MigrationResult> {
    const result: MigrationResult = {
      success: false,
      migratedGroups: 0,
      migratedMessages: 0,
      migratedSettings: false,
      errors: [],
    };

    try {
      // Check authentication
      const currentUser = await authService.getCurrentChatUser();
      if (!currentUser) {
        result.errors.push('User must be authenticated to migrate data');
        return result;
      }

      // Migrate settings first
      try {
        await this.migrateSettings();
        result.migratedSettings = true;
      } catch (error) {
        result.errors.push(`Settings migration failed: ${error}`);
      }

      // Migrate groups and messages
      try {
        const { groupCount, messageCount } = await this.migrateGroupsAndMessages();
        result.migratedGroups = groupCount;
        result.migratedMessages = messageCount;
      } catch (error) {
        result.errors.push(`Groups/Messages migration failed: ${error}`);
      }

      // Migration is successful if no critical errors occurred
      result.success = result.errors.length === 0;

      // Clean up legacy data if migration was successful
      if (result.success) {
        await this.cleanupLegacyData();
      }

      return result;
    } catch (error) {
      console.error('Migration failed:', error);
      result.errors.push(`Migration failed: ${error}`);
      return result;
    }
  }

  /**
   * Migrate user settings
   */
  private async migrateSettings(): Promise<void> {
    try {
      const legacySettingsJson = await AsyncStorage.getItem(LEGACY_KEYS.SETTINGS);
      if (!legacySettingsJson) {
        return; // No settings to migrate
      }

      const legacySettings = JSON.parse(legacySettingsJson);

      // Convert legacy settings to new format
      const migratedSettings: GroupbySettings = {
        theme: legacySettings.theme || 'light',
        enableHaptics: legacySettings.enableHaptics ?? true,
        enableTypingIndicator: legacySettings.enableTypingIndicator ?? true,
        defaultGroupLifespan: this.convertLifespan(legacySettings.defaultGroupLifespan),
        showExpirationWarnings: legacySettings.showExpirationWarnings ?? true,
        archiveRetentionDays: legacySettings.archiveRetentionDays || 30,
        autoJoinSuggestions: legacySettings.autoJoinSuggestions ?? false,
      };

      // Save migrated settings
      await supabaseService.saveSettings(migratedSettings);
    } catch (error) {
      console.error('Error migrating settings:', error);
      throw error;
    }
  }

  /**
   * Migrate groups and their messages
   */
  private async migrateGroupsAndMessages(): Promise<{ groupCount: number; messageCount: number }> {
    let groupCount = 0;
    let messageCount = 0;

    try {
      // Load legacy groups
      const legacyActiveGroupsJson = await AsyncStorage.getItem(LEGACY_KEYS.ACTIVE_GROUPS);
      const legacyArchivedGroupsJson = await AsyncStorage.getItem(LEGACY_KEYS.ARCHIVED_GROUPS);

      const legacyActiveGroups: Group[] = legacyActiveGroupsJson ? JSON.parse(legacyActiveGroupsJson) : [];
      const legacyArchivedGroups: Group[] = legacyArchivedGroupsJson ? JSON.parse(legacyArchivedGroupsJson) : [];

      // Load legacy messages
      const legacyMessagesJson = await AsyncStorage.getItem(LEGACY_KEYS.MESSAGES);
      const legacyMessages: { [groupId: string]: Message[] } = legacyMessagesJson ? JSON.parse(legacyMessagesJson) : {};

      // Migrate active groups
      for (const legacyGroup of legacyActiveGroups) {
        try {
          await this.migrateGroup(legacyGroup, legacyMessages[legacyGroup.id] || []);
          groupCount++;
          messageCount += legacyMessages[legacyGroup.id]?.length || 0;
        } catch (error) {
          console.error(`Error migrating active group ${legacyGroup.id}:`, error);
        }
      }

      // Migrate archived groups
      for (const legacyGroup of legacyArchivedGroups) {
        try {
          await this.migrateGroup(legacyGroup, legacyMessages[legacyGroup.id] || []);
          groupCount++;
          messageCount += legacyMessages[legacyGroup.id]?.length || 0;
        } catch (error) {
          console.error(`Error migrating archived group ${legacyGroup.id}:`, error);
        }
      }

      return { groupCount, messageCount };
    } catch (error) {
      console.error('Error migrating groups and messages:', error);
      throw error;
    }
  }

  /**
   * Migrate a single group and its messages
   */
  private async migrateGroup(legacyGroup: Group, legacyMessages: Message[]): Promise<void> {
    try {
      // Create the group in Supabase
      const groupData = {
        name: legacyGroup.name,
        description: legacyGroup.description,
        settings: legacyGroup.settings,
      };

      const migratedGroup = await supabaseService.createGroup(groupData);
      if (!migratedGroup) {
        throw new Error('Failed to create group in Supabase');
      }

      // Migrate messages for this group
      for (const legacyMessage of legacyMessages) {
        try {
          await supabaseService.sendMessage({
            groupId: migratedGroup.id,
            content: legacyMessage.text,
            messageType: 'text', // Legacy messages are mostly text
          });
        } catch (error) {
          console.error(`Error migrating message ${legacyMessage.id}:`, error);
          // Continue with other messages even if one fails
        }
      }
    } catch (error) {
      console.error(`Error migrating group ${legacyGroup.id}:`, error);
      throw error;
    }
  }

  /**
   * Clean up legacy data after successful migration
   */
  private async cleanupLegacyData(): Promise<void> {
    try {
      await AsyncStorage.multiRemove([
        LEGACY_KEYS.ACTIVE_GROUPS,
        LEGACY_KEYS.ARCHIVED_GROUPS,
        LEGACY_KEYS.MESSAGES,
        LEGACY_KEYS.SETTINGS,
        LEGACY_KEYS.CURRENT_USER,
      ]);

      // Mark migration as completed
      await AsyncStorage.setItem('migration_completed', 'true');
    } catch (error) {
      console.error('Error cleaning up legacy data:', error);
      // Don't throw here, as the migration itself was successful
    }
  }

  /**
   * Check if migration has been completed before
   */
  async isMigrationCompleted(): Promise<boolean> {
    try {
      const completed = await AsyncStorage.getItem('migration_completed');
      return completed === 'true';
    } catch (error) {
      console.error('Error checking migration completion:', error);
      return false;
    }
  }

  /**
   * Convert legacy lifespan format to new format
   */
  private convertLifespan(legacyLifespan: string): 'hour' | 'day' | 'week' | 'month' | 'custom' {
    switch (legacyLifespan) {
      case '1_hour':
        return 'hour';
      case '24_hours':
        return 'day';
      case '7_days':
        return 'week';
      case '30_days':
        return 'month';
      default:
        return 'custom';
    }
  }

  /**
   * Create anonymous user for migration if needed
   */
  async createAnonymousUserForMigration(): Promise<boolean> {
    try {
      // Check if user already exists
      const currentAuthState = await authService.getCurrentAuthState();
      if (currentAuthState.isAuthenticated) {
        return true;
      }

      // Get legacy user data if it exists
      const legacyUserJson = await AsyncStorage.getItem(LEGACY_KEYS.CURRENT_USER);
      let displayName = 'Migrated User';

      if (legacyUserJson) {
        try {
          const legacyUser = JSON.parse(legacyUserJson);
          displayName = legacyUser.name || displayName;
        } catch (error) {
          console.error('Error parsing legacy user data:', error);
        }
      }

      // Create anonymous user
      const { user, error } = await authService.signInAnonymously(displayName);

      if (error) {
        console.error('Error creating anonymous user for migration:', error);
        return false;
      }

      return !!user;
    } catch (error) {
      console.error('Error creating anonymous user for migration:', error);
      return false;
    }
  }

  /**
   * Get preview of data that will be migrated
   */
  async getMigrationPreview(): Promise<{
    groupCount: number;
    messageCount: number;
    hasSettings: boolean;
  }> {
    try {
      const legacyActiveGroupsJson = await AsyncStorage.getItem(LEGACY_KEYS.ACTIVE_GROUPS);
      const legacyArchivedGroupsJson = await AsyncStorage.getItem(LEGACY_KEYS.ARCHIVED_GROUPS);
      const legacyMessagesJson = await AsyncStorage.getItem(LEGACY_KEYS.MESSAGES);
      const legacySettingsJson = await AsyncStorage.getItem(LEGACY_KEYS.SETTINGS);

      const legacyActiveGroups: Group[] = legacyActiveGroupsJson ? JSON.parse(legacyActiveGroupsJson) : [];
      const legacyArchivedGroups: Group[] = legacyArchivedGroupsJson ? JSON.parse(legacyArchivedGroupsJson) : [];
      const legacyMessages: { [groupId: string]: Message[] } = legacyMessagesJson ? JSON.parse(legacyMessagesJson) : {};

      const groupCount = legacyActiveGroups.length + legacyArchivedGroups.length;
      const messageCount = Object.values(legacyMessages).reduce((total, messages) => total + messages.length, 0);
      const hasSettings = !!legacySettingsJson;

      return {
        groupCount,
        messageCount,
        hasSettings,
      };
    } catch (error) {
      console.error('Error getting migration preview:', error);
      return {
        groupCount: 0,
        messageCount: 0,
        hasSettings: false,
      };
    }
  }
}

// Export singleton instance
export const dataMigration = new DataMigrationService();