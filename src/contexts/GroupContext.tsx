import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { Group, Message, GroupSettings } from '../types';
import { supabaseService, GroupCreationData, MessageCreationData } from '../services/supabaseService';
import { useAuth } from './AuthContext';

interface GroupContextType {
  activeGroups: Group[];
  archivedGroups: Group[];
  loading: boolean;
  error: string | null;
  refreshing: boolean;
  // Group operations
  loadGroups: () => Promise<void>;
  createGroup: (data: GroupCreationData) => Promise<Group | null>;
  joinGroupWithCode: (inviteCode: string) => Promise<Group | null>;
  leaveGroup: (groupId: string) => Promise<boolean>;
  // Message operations
  loadMessages: (groupId: string) => Promise<Message[]>;
  sendMessage: (data: MessageCreationData) => Promise<Message | null>;
  // Real-time subscriptions
  subscribeToGroup: (groupId: string, onUpdate: (group: Group) => void) => () => void;
  subscribeToMessages: (groupId: string, onMessage: (messages: Message[]) => void) => () => void;
  // Utility functions
  refreshGroups: () => Promise<void>;
  getGroupById: (groupId: string) => Group | null;
  processExpiredGroups: () => Promise<void>;
}

const GroupContext = createContext<GroupContextType | undefined>(undefined);

export const useGroups = () => {
  const context = useContext(GroupContext);
  if (!context) {
    throw new Error('useGroups must be used within GroupProvider');
  }
  return context;
};

interface GroupProviderProps {
  children: ReactNode;
}

export const GroupProvider: React.FC<GroupProviderProps> = ({ children }) => {
  const [activeGroups, setActiveGroups] = useState<Group[]>([]);
  const [archivedGroups, setArchivedGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { isAuthenticated } = useAuth();

  // Load groups when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      loadGroups();
    } else {
      // Clear groups when not authenticated
      setActiveGroups([]);
      setArchivedGroups([]);
      setLoading(false);
    }
  }, [isAuthenticated]);

  // Process expired groups periodically
  useEffect(() => {
    if (!isAuthenticated) return;

    const interval = setInterval(() => {
      processExpiredGroups();
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [isAuthenticated]);

  const loadGroups = useCallback(async () => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }

    try {
      setError(null);
      const { activeGroups: active, archivedGroups: archived } = await supabaseService.loadGroups();
      setActiveGroups(active);
      setArchivedGroups(archived);
    } catch (err) {
      console.error('Error loading groups:', err);
      setError('Failed to load groups');
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  const refreshGroups = useCallback(async () => {
    if (!isAuthenticated) return;

    try {
      setRefreshing(true);
      setError(null);
      const { activeGroups: active, archivedGroups: archived } = await supabaseService.loadGroups();
      setActiveGroups(active);
      setArchivedGroups(archived);
    } catch (err) {
      console.error('Error refreshing groups:', err);
      setError('Failed to refresh groups');
    } finally {
      setRefreshing(false);
    }
  }, [isAuthenticated]);

  const createGroup = useCallback(async (data: GroupCreationData): Promise<Group | null> => {
    if (!isAuthenticated) {
      setError('You must be logged in to create groups');
      return null;
    }

    try {
      setError(null);
      const newGroup = await supabaseService.createGroup(data);

      if (newGroup) {
        setActiveGroups(prev => [newGroup, ...prev]);
        return newGroup;
      }

      setError('Failed to create group');
      return null;
    } catch (err) {
      console.error('Error creating group:', err);
      setError('Failed to create group');
      return null;
    }
  }, [isAuthenticated]);

  const joinGroupWithCode = useCallback(async (inviteCode: string): Promise<Group | null> => {
    if (!isAuthenticated) {
      setError('You must be logged in to join groups');
      return null;
    }

    try {
      setError(null);
      const group = await supabaseService.joinGroupWithCode(inviteCode);

      if (group) {
        setActiveGroups(prev => {
          // Check if group already exists
          const exists = prev.some(g => g.id === group.id);
          if (exists) {
            return prev.map(g => g.id === group.id ? group : g);
          }
          return [group, ...prev];
        });
        return group;
      }

      setError('Failed to join group');
      return null;
    } catch (err) {
      console.error('Error joining group:', err);
      setError('Failed to join group');
      return null;
    }
  }, [isAuthenticated]);

  const leaveGroup = useCallback(async (groupId: string): Promise<boolean> => {
    if (!isAuthenticated) {
      setError('You must be logged in to leave groups');
      return false;
    }

    try {
      setError(null);
      const success = await supabaseService.leaveGroup(groupId);

      if (success) {
        setActiveGroups(prev => prev.filter(g => g.id !== groupId));
        setArchivedGroups(prev => prev.filter(g => g.id !== groupId));
        return true;
      }

      setError('Failed to leave group');
      return false;
    } catch (err) {
      console.error('Error leaving group:', err);
      setError('Failed to leave group');
      return false;
    }
  }, [isAuthenticated]);

  const loadMessages = useCallback(async (groupId: string): Promise<Message[]> => {
    if (!isAuthenticated) {
      return [];
    }

    try {
      setError(null);
      return await supabaseService.loadMessages(groupId);
    } catch (err) {
      console.error('Error loading messages:', err);
      setError('Failed to load messages');
      return [];
    }
  }, [isAuthenticated]);

  const sendMessage = useCallback(async (data: MessageCreationData): Promise<Message | null> => {
    if (!isAuthenticated) {
      setError('You must be logged in to send messages');
      return null;
    }

    try {
      setError(null);
      const message = await supabaseService.sendMessage(data);

      if (message) {
        // Update the group's last message and activity
        setActiveGroups(prev => prev.map(group => {
          if (group.id === data.groupId) {
            return {
              ...group,
              lastMessage: message,
              lastActivity: message.timestamp,
              messageCount: group.messageCount + 1,
              unreadCount: 0, // Reset for sender
            };
          }
          return group;
        }));

        return message;
      }

      setError('Failed to send message');
      return null;
    } catch (err) {
      console.error('Error sending message:', err);
      setError('Failed to send message');
      return null;
    }
  }, [isAuthenticated]);

  const subscribeToGroup = useCallback((groupId: string, onUpdate: (group: Group) => void): () => void => {
    if (!isAuthenticated) {
      return () => {};
    }

    return supabaseService.subscribeToGroup(groupId, (updatedGroup) => {
      // Update local state
      setActiveGroups(prev => prev.map(g => g.id === updatedGroup.id ? updatedGroup : g));
      setArchivedGroups(prev => prev.map(g => g.id === updatedGroup.id ? updatedGroup : g));

      // Call callback
      onUpdate(updatedGroup);
    });
  }, [isAuthenticated]);

  const subscribeToMessages = useCallback((groupId: string, onMessage: (messages: Message[]) => void): () => void => {
    if (!isAuthenticated) {
      return () => {};
    }

    return supabaseService.subscribeToMessages(groupId, (messages) => {
      // Update group's last message in local state
      const lastMessage = messages[messages.length - 1];
      if (lastMessage) {
        setActiveGroups(prev => prev.map(group => {
          if (group.id === groupId) {
            return {
              ...group,
              lastMessage,
              lastActivity: lastMessage.timestamp,
              unreadCount: lastMessage.isOwnMessage ? 0 : group.unreadCount + 1,
            };
          }
          return group;
        }));
      }

      // Call callback
      onMessage(messages);
    });
  }, [isAuthenticated]);

  const getGroupById = useCallback((groupId: string): Group | null => {
    return [...activeGroups, ...archivedGroups].find(g => g.id === groupId) || null;
  }, [activeGroups, archivedGroups]);

  const processExpiredGroups = useCallback(async () => {
    if (!isAuthenticated) return;

    try {
      await supabaseService.processExpiredGroups();
      // Reload groups to reflect any changes
      const { activeGroups: active, archivedGroups: archived } = await supabaseService.loadGroups();
      setActiveGroups(active);
      setArchivedGroups(archived);
    } catch (err) {
      console.error('Error processing expired groups:', err);
    }
  }, [isAuthenticated]);

  return (
    <GroupContext.Provider
      value={{
        activeGroups,
        archivedGroups,
        loading,
        error,
        refreshing,
        loadGroups,
        createGroup,
        joinGroupWithCode,
        leaveGroup,
        loadMessages,
        sendMessage,
        subscribeToGroup,
        subscribeToMessages,
        refreshGroups,
        getGroupById,
        processExpiredGroups,
      }}
    >
      {children}
    </GroupContext.Provider>
  );
};