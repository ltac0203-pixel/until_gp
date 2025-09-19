import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Supabase configuration
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Missing Supabase environment variables. Please check your .env file.');
}

// Create Supabase client with configuration optimized for React Native
export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    // Enable automatic token refresh
    autoRefreshToken: true,
    // Persist session in async storage
    persistSession: true,
    // Detect session from URL (useful for deep linking)
    detectSessionInUrl: false,
  },
  realtime: {
    // Enable real-time features
    params: {
      eventsPerSecond: 10,
    },
  },
});

// Database types - will be generated from Supabase schema
export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email?: string;
          display_name: string;
          avatar_url?: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          email?: string;
          display_name: string;
          avatar_url?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          display_name?: string;
          avatar_url?: string;
          updated_at?: string;
        };
      };
      groups: {
        Row: {
          id: string;
          name: string;
          description?: string;
          created_by: string;
          created_at: string;
          updated_at: string;
          expires_at?: string;
          inactivity_threshold?: number;
          message_limit?: number;
          status: 'active' | 'expiring' | 'archived';
          invite_code?: string;
          invite_code_expires_at?: string;
          disbanded_at?: string;
          disband_reason?: 'expired' | 'inactive' | 'message_limit' | 'manual';
          archived_until?: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string;
          created_by: string;
          created_at?: string;
          updated_at?: string;
          expires_at?: string;
          inactivity_threshold?: number;
          message_limit?: number;
          status?: 'active' | 'expiring' | 'archived';
          invite_code?: string;
          invite_code_expires_at?: string;
          disbanded_at?: string;
          disband_reason?: 'expired' | 'inactive' | 'message_limit' | 'manual';
          archived_until?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string;
          updated_at?: string;
          expires_at?: string;
          inactivity_threshold?: number;
          message_limit?: number;
          status?: 'active' | 'expiring' | 'archived';
          invite_code?: string;
          invite_code_expires_at?: string;
          disbanded_at?: string;
          disband_reason?: 'expired' | 'inactive' | 'message_limit' | 'manual';
          archived_until?: string;
        };
      };
      group_members: {
        Row: {
          group_id: string;
          user_id: string;
          joined_at: string;
          role: 'admin' | 'member';
          unread_count: number;
        };
        Insert: {
          group_id: string;
          user_id: string;
          joined_at?: string;
          role?: 'admin' | 'member';
          unread_count?: number;
        };
        Update: {
          role?: 'admin' | 'member';
          unread_count?: number;
        };
      };
      messages: {
        Row: {
          id: string;
          group_id: string;
          user_id: string;
          content: string;
          created_at: string;
          updated_at: string;
          message_type: 'text' | 'image' | 'video' | 'file';
          reply_to?: string;
          edited_at?: string;
          status: 'sent' | 'delivered' | 'read';
        };
        Insert: {
          id?: string;
          group_id: string;
          user_id: string;
          content: string;
          created_at?: string;
          updated_at?: string;
          message_type?: 'text' | 'image' | 'video' | 'file';
          reply_to?: string;
          edited_at?: string;
          status?: 'sent' | 'delivered' | 'read';
        };
        Update: {
          content?: string;
          updated_at?: string;
          edited_at?: string;
          status?: 'sent' | 'delivered' | 'read';
        };
      };
      attachments: {
        Row: {
          id: string;
          message_id: string;
          file_path: string;
          file_type: string;
          file_size: number;
          thumbnail_path?: string;
          metadata?: any;
          created_at: string;
        };
        Insert: {
          id?: string;
          message_id: string;
          file_path: string;
          file_type: string;
          file_size: number;
          thumbnail_path?: string;
          metadata?: any;
          created_at?: string;
        };
        Update: {
          file_path?: string;
          file_type?: string;
          file_size?: number;
          thumbnail_path?: string;
          metadata?: any;
        };
      };
    };
  };
}

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];
export type Inserts<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert'];
export type Updates<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update'];