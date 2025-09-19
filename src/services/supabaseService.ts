import { supabase, Database, Tables } from '../utils/supabase';
import { authService } from './authService';
import { Group, Message, ChatUser, GroupSettings, DisbandReason, GroupbySettings } from '../types';
import { RealtimeChannel } from '@supabase/supabase-js';

export interface GroupCreationData {
  name: string;
  description?: string;
  settings: GroupSettings;
}

export interface MessageCreationData {
  groupId: string;
  content: string;
  messageType?: 'text' | 'image' | 'video' | 'file';
  replyTo?: string;
}

class SupabaseStorageService {
  private groupSubscriptions: Map<string, RealtimeChannel> = new Map();
  private groupUpdateListeners: Map<string, ((group: Group) => void)[]> = new Map();
  private messageListeners: Map<string, ((messages: Message[]) => void)[]> = new Map();

  /**
   * Load all groups for the current user
   */
  async loadGroups(): Promise<{ activeGroups: Group[]; archivedGroups: Group[] }> {
    try {
      const currentUser = await authService.getCurrentChatUser();
      if (!currentUser) {
        return { activeGroups: [], archivedGroups: [] };
      }

      // Get all groups for the user with member data
      const { data: groupMemberships, error } = await supabase
        .from('group_members')
        .select(`
          unread_count,
          groups!inner (
            id,
            name,
            description,
            created_by,
            created_at,
            updated_at,
            expires_at,
            inactivity_threshold,
            message_limit,
            status,
            invite_code,
            disbanded_at,
            disband_reason,
            archived_until,
            last_activity
          )
        `)
        .eq('user_id', currentUser.id);

      if (error) {
        console.error('Error loading groups:', error);
        return { activeGroups: [], archivedGroups: [] };
      }

      const groups: Group[] = [];

      for (const membership of groupMemberships || []) {
        const groupData = membership.groups;

        // Get group members
        const members = await this.getGroupMembers(groupData.id);

        // Get last message
        const lastMessage = await this.getLastMessage(groupData.id);

        // Get message count
        const messageCount = await this.getMessageCount(groupData.id);

        const group: Group = {
          id: groupData.id,
          name: groupData.name,
          description: groupData.description || undefined,
          members,
          createdAt: new Date(groupData.created_at),
          createdBy: groupData.created_by || '',
          lastMessage,
          lastActivity: new Date(groupData.last_activity || groupData.updated_at),
          unreadCount: membership.unread_count,
          messages: [], // Messages will be loaded separately when needed
          status: groupData.status as any,
          settings: {
            lifespan: this.mapExpiresToLifespan(groupData.expires_at, groupData.created_at),
            messageLimit: groupData.message_limit || undefined,
            inactivityDays: groupData.inactivity_threshold || undefined,
          },
          messageCount,
          disbandedAt: groupData.disbanded_at ? new Date(groupData.disbanded_at) : undefined,
          disbandReason: groupData.disband_reason as DisbandReason,
          archivedUntil: groupData.archived_until ? new Date(groupData.archived_until) : undefined,
          inviteCode: groupData.invite_code || undefined,
        };

        groups.push(group);
      }

      const activeGroups = groups.filter(g => g.status === 'active' || g.status === 'expiring');
      const archivedGroups = groups.filter(g => g.status === 'archived');

      return { activeGroups, archivedGroups };
    } catch (error) {
      console.error('Error loading groups:', error);
      return { activeGroups: [], archivedGroups: [] };
    }
  }

  /**
   * Load messages for a specific group
   */
  async loadMessages(groupId: string): Promise<Message[]> {
    try {
      const { data: messages, error } = await supabase
        .from('messages')
        .select(`
          id,
          content,
          created_at,
          updated_at,
          message_type,
          reply_to,
          edited_at,
          status,
          user_id,
          users!inner (
            display_name,
            avatar_url
          ),
          attachments (
            id,
            file_path,
            file_type,
            file_size,
            thumbnail_path,
            metadata
          )
        `)
        .eq('group_id', groupId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error loading messages:', error);
        return [];
      }

      const currentUser = await authService.getCurrentChatUser();

      return (messages || []).map(msg => ({
        id: msg.id,
        text: msg.content,
        timestamp: new Date(msg.created_at),
        isOwnMessage: msg.user_id === currentUser?.id,
        sender: msg.users?.display_name || 'Unknown User',
        status: msg.status as any,
        deliveryTime: msg.updated_at ? new Date(msg.updated_at) : undefined,
        attachments: msg.attachments?.map(att => ({
          id: att.id,
          type: att.file_type.startsWith('image/') ? 'image' : 'video',
          uri: att.file_path,
          size: att.file_size,
          thumbnailUri: att.thumbnail_path,
          metadata: att.metadata,
        })),
      }));
    } catch (error) {
      console.error('Error loading messages:', error);
      return [];
    }
  }

  /**
   * Create a new group
   */
  async createGroup(data: GroupCreationData): Promise<Group | null> {
    try {
      // Get the authenticated user from Supabase auth
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new Error('User must be authenticated to create groups');
      }

      // Get or create user profile
      const currentUser = await authService.getCurrentChatUser();
      if (!currentUser) {
        throw new Error('Failed to get user profile');
      }

      // Calculate expiration time based on lifespan
      let expiresAt: string | null = null;
      if (data.settings.lifespan !== 'custom') {
        const lifespanHours = this.getLifespanHours(data.settings.lifespan);
        if (lifespanHours > 0) {
          expiresAt = new Date(Date.now() + lifespanHours * 60 * 60 * 1000).toISOString();
        }
      }

      // Create the group using auth.uid() to satisfy RLS policy
      const { data: groupData, error: groupError } = await supabase
        .from('groups')
        .insert({
          name: data.name,
          description: data.description,
          created_by: user.id, // Use authenticated user ID directly
          expires_at: expiresAt,
          inactivity_threshold: data.settings.inactivityDays,
          message_limit: data.settings.messageLimit,
        })
        .select()
        .single();

      if (groupError) {
        console.error('Error creating group:', groupError);
        return null;
      }

      // Add the creator as an admin member
      const { error: memberError } = await supabase
        .from('group_members')
        .insert({
          group_id: groupData.id,
          user_id: user.id, // Use authenticated user ID directly
          role: 'admin',
        });

      if (memberError) {
        console.error('Error adding group creator as member:', memberError);
        return null;
      }

      // Convert to Group format
      const group: Group = {
        id: groupData.id,
        name: groupData.name,
        description: groupData.description || undefined,
        members: [currentUser],
        createdAt: new Date(groupData.created_at),
        createdBy: user.id, // Use authenticated user ID
        lastActivity: new Date(groupData.created_at),
        unreadCount: 0,
        messages: [],
        status: 'active',
        settings: data.settings,
        messageCount: 0,
        inviteCode: groupData.invite_code || undefined,
      };

      return group;
    } catch (error) {
      console.error('Error creating group:', error);
      return null;
    }
  }

  /**
   * Send a message to a group
   */
  async sendMessage(data: MessageCreationData): Promise<Message | null> {
    try {
      const currentUser = await authService.getCurrentChatUser();
      if (!currentUser) {
        throw new Error('User must be authenticated to send messages');
      }

      // Check if user is a member of the group
      const { data: membership } = await supabase
        .from('group_members')
        .select('*')
        .eq('group_id', data.groupId)
        .eq('user_id', currentUser.id)
        .single();

      if (!membership) {
        throw new Error('User is not a member of this group');
      }

      // Send the message
      const { data: messageData, error } = await supabase
        .from('messages')
        .insert({
          group_id: data.groupId,
          user_id: currentUser.id,
          content: data.content,
          message_type: data.messageType || 'text',
          reply_to: data.replyTo,
        })
        .select()
        .single();

      if (error) {
        console.error('Error sending message:', error);
        return null;
      }

      // Reset unread count for sender
      await supabase
        .from('group_members')
        .update({ unread_count: 0 })
        .eq('group_id', data.groupId)
        .eq('user_id', currentUser.id);

      // Convert to Message format
      const message: Message = {
        id: messageData.id,
        text: messageData.content,
        timestamp: new Date(messageData.created_at),
        isOwnMessage: true,
        sender: currentUser.name,
        status: 'sent',
      };

      return message;
    } catch (error) {
      console.error('Error sending message:', error);
      return null;
    }
  }

  /**
   * Join a group using invite code
   */
  async joinGroupWithCode(inviteCode: string): Promise<Group | null> {
    try {
      const currentUser = await authService.getCurrentChatUser();
      if (!currentUser) {
        throw new Error('User must be authenticated to join groups');
      }

      // Find group by invite code
      const { data: groupData, error: groupError } = await supabase
        .from('groups')
        .select('*')
        .eq('invite_code', inviteCode)
        .eq('status', 'active')
        .single();

      if (groupError || !groupData) {
        throw new Error('Invalid or expired invite code');
      }

      // Check if invite code is expired
      if (groupData.invite_code_expires_at && new Date(groupData.invite_code_expires_at) < new Date()) {
        throw new Error('Invite code has expired');
      }

      // Check if user is already a member
      const { data: existingMembership } = await supabase
        .from('group_members')
        .select('*')
        .eq('group_id', groupData.id)
        .eq('user_id', currentUser.id)
        .single();

      if (existingMembership) {
        throw new Error('You are already a member of this group');
      }

      // Join the group
      const { error: joinError } = await supabase
        .from('group_members')
        .insert({
          group_id: groupData.id,
          user_id: currentUser.id,
          role: 'member',
        });

      if (joinError) {
        throw new Error('Failed to join group');
      }

      // Load and return the group
      const { activeGroups } = await this.loadGroups();
      return activeGroups.find(g => g.id === groupData.id) || null;
    } catch (error) {
      console.error('Error joining group:', error);
      return null;
    }
  }

  /**
   * Leave a group
   */
  async leaveGroup(groupId: string): Promise<boolean> {
    try {
      const currentUser = await authService.getCurrentChatUser();
      if (!currentUser) {
        return false;
      }

      const { error } = await supabase
        .from('group_members')
        .delete()
        .eq('group_id', groupId)
        .eq('user_id', currentUser.id);

      return !error;
    } catch (error) {
      console.error('Error leaving group:', error);
      return false;
    }
  }

  /**
   * Process expired groups (called periodically)
   */
  async processExpiredGroups(): Promise<void> {
    try {
      // Call the database function to process expired groups
      const { error } = await supabase.rpc('process_expired_groups');

      if (error) {
        console.error('Error processing expired groups:', error);
      }
    } catch (error) {
      console.error('Error processing expired groups:', error);
    }
  }

  /**
   * Subscribe to real-time updates for a group
   */
  subscribeToGroup(groupId: string, onUpdate: (group: Group) => void): () => void {
    if (!this.groupUpdateListeners.has(groupId)) {
      this.groupUpdateListeners.set(groupId, []);
    }
    this.groupUpdateListeners.get(groupId)!.push(onUpdate);

    // Create real-time subscription if not exists
    if (!this.groupSubscriptions.has(groupId)) {
      const channel = supabase
        .channel(`group_${groupId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'groups',
            filter: `id=eq.${groupId}`,
          },
          (payload) => {
            this.handleGroupUpdate(groupId, payload);
          }
        )
        .subscribe();

      this.groupSubscriptions.set(groupId, channel);
    }

    // Return unsubscribe function
    return () => {
      const listeners = this.groupUpdateListeners.get(groupId) || [];
      const index = listeners.indexOf(onUpdate);
      if (index > -1) {
        listeners.splice(index, 1);
      }

      // Remove subscription if no more listeners
      if (listeners.length === 0) {
        const channel = this.groupSubscriptions.get(groupId);
        if (channel) {
          supabase.removeChannel(channel);
          this.groupSubscriptions.delete(groupId);
        }
        this.groupUpdateListeners.delete(groupId);
      }
    };
  }

  /**
   * Subscribe to real-time messages for a group
   */
  subscribeToMessages(groupId: string, onMessage: (messages: Message[]) => void): () => void {
    if (!this.messageListeners.has(groupId)) {
      this.messageListeners.set(groupId, []);
    }
    this.messageListeners.get(groupId)!.push(onMessage);

    const channel = supabase
      .channel(`messages_${groupId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `group_id=eq.${groupId}`,
        },
        async () => {
          // Reload messages when new message is inserted
          const messages = await this.loadMessages(groupId);
          this.messageListeners.get(groupId)?.forEach(listener => listener(messages));
        }
      )
      .subscribe();

    // Return unsubscribe function
    return () => {
      const listeners = this.messageListeners.get(groupId) || [];
      const index = listeners.indexOf(onMessage);
      if (index > -1) {
        listeners.splice(index, 1);
      }

      if (listeners.length === 0) {
        supabase.removeChannel(channel);
        this.messageListeners.delete(groupId);
      }
    };
  }

  /**
   * Load app settings
   */
  async loadSettings(): Promise<GroupbySettings> {
    // For now, return default settings
    // In the future, this could load from user preferences table
    return {
      theme: 'light',
      notifications: {
        enabled: true,
        groupExpiring: true,
        newMessages: true,
        memberJoined: true,
      },
      hapticFeedback: true,
    };
  }

  /**
   * Save app settings
   */
  async saveSettings(settings: GroupbySettings): Promise<void> {
    // For now, this is a no-op
    // In the future, this could save to user preferences table
    console.log('Settings saved (not implemented yet):', settings);
  }

  // Helper methods

  private async getGroupMembers(groupId: string): Promise<ChatUser[]> {
    const { data: members, error } = await supabase
      .from('group_members')
      .select(`
        users!inner (
          id,
          display_name,
          avatar_url
        )
      `)
      .eq('group_id', groupId);

    if (error) {
      console.error('Error loading group members:', error);
      return [];
    }

    return (members || []).map(member => ({
      id: member.users.id,
      name: member.users.display_name,
      avatar: member.users.avatar_url,
    }));
  }

  private async getLastMessage(groupId: string): Promise<Message | undefined> {
    const { data: message, error } = await supabase
      .from('messages')
      .select(`
        id,
        content,
        created_at,
        user_id,
        users!inner (
          display_name
        )
      `)
      .eq('group_id', groupId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !message) {
      return undefined;
    }

    const currentUser = await authService.getCurrentChatUser();

    return {
      id: message.id,
      text: message.content,
      timestamp: new Date(message.created_at),
      isOwnMessage: message.user_id === currentUser?.id,
      sender: message.users.display_name,
      status: 'delivered',
    };
  }

  private async getMessageCount(groupId: string): Promise<number> {
    const { count, error } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('group_id', groupId);

    return error ? 0 : (count || 0);
  }

  private mapExpiresToLifespan(expiresAt: string | null, createdAt: string): 'hour' | 'day' | 'week' | 'month' | 'custom' {
    if (!expiresAt) return 'custom';

    const created = new Date(createdAt);
    const expires = new Date(expiresAt);
    const diffHours = (expires.getTime() - created.getTime()) / (1000 * 60 * 60);

    if (diffHours <= 1.5) return 'hour';
    if (diffHours <= 25) return 'day';
    if (diffHours <= 168) return 'week';
    if (diffHours <= 720) return 'month';
    return 'custom';
  }

  private getLifespanHours(lifespan: 'hour' | 'day' | 'week' | 'month' | 'custom'): number {
    switch (lifespan) {
      case 'hour': return 1;
      case 'day': return 24;
      case 'week': return 168;
      case 'month': return 720;
      default: return 0;
    }
  }

  private async handleGroupUpdate(groupId: string, payload: any): Promise<void> {
    // Reload group data and notify listeners
    const { activeGroups, archivedGroups } = await this.loadGroups();
    const group = [...activeGroups, ...archivedGroups].find(g => g.id === groupId);

    if (group) {
      this.groupUpdateListeners.get(groupId)?.forEach(listener => listener(group));
    }
  }
}

// Export singleton instance
export const supabaseService = new SupabaseStorageService();