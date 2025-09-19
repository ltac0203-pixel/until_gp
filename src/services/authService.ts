import { Session, User, AuthError, AuthResponse } from '@supabase/supabase-js';
import { supabase } from '../utils/supabase';
import { ChatUser } from '../types';

export interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAuthenticated: boolean;
}

export interface UserProfile {
  id: string;
  email?: string;
  display_name: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

export interface SignUpData {
  email?: string;
  password?: string;
  display_name: string;
  avatar_url?: string;
}

export interface SignInData {
  email: string;
  password: string;
}

class AuthenticationService {
  private authStateListeners: ((state: AuthState) => void)[] = [];

  constructor() {
    // Listen for auth state changes
    supabase.auth.onAuthStateChange((event, session) => {
      this.notifyAuthStateChange({
        user: session?.user || null,
        session,
        loading: false,
        isAuthenticated: !!session?.user,
      });
    });
  }

  /**
   * Get current authentication state
   */
  async getCurrentAuthState(): Promise<AuthState> {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error) {
        console.error('Error getting session:', error);
        return {
          user: null,
          session: null,
          loading: false,
          isAuthenticated: false,
        };
      }

      return {
        user: session?.user || null,
        session,
        loading: false,
        isAuthenticated: !!session?.user,
      };
    } catch (error) {
      console.error('Error getting auth state:', error);
      return {
        user: null,
        session: null,
        loading: false,
        isAuthenticated: false,
      };
    }
  }

  /**
   * Sign up with email and password
   */
  async signUp(data: SignUpData): Promise<{ user: User | null; error: AuthError | null }> {
    try {
      const { data: authData, error } = await supabase.auth.signUp({
        email: data.email!,
        password: data.password!,
        options: {
          data: {
            display_name: data.display_name,
            avatar_url: data.avatar_url,
          },
        },
      });

      if (error) {
        return { user: null, error };
      }

      // Create user profile in public.users table
      if (authData.user) {
        const profileCreated = await this.createUserProfile({
          id: authData.user.id,
          email: data.email,
          display_name: data.display_name,
          avatar_url: data.avatar_url,
        });

        if (!profileCreated) {
          console.error('Failed to create user profile, but auth user was created');
        }
      }

      return { user: authData.user, error: null };
    } catch (error) {
      console.error('Sign up error:', error);
      return { user: null, error: error as AuthError };
    }
  }

  /**
   * Sign in with email and password
   */
  async signIn(data: SignInData): Promise<{ user: User | null; error: AuthError | null }> {
    try {
      const { data: authData, error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });

      if (error) {
        return { user: null, error };
      }

      // Check if user profile exists, create if it doesn't
      if (authData.user) {
        const { data: profile } = await supabase
          .from('users')
          .select('*')
          .eq('id', authData.user.id)
          .single();

        if (!profile) {
          // Create profile if it doesn't exist (for users created before profile creation was added)
          await this.createUserProfile({
            id: authData.user.id,
            email: authData.user.email,
            display_name: authData.user.user_metadata?.display_name || authData.user.email?.split('@')[0] || 'User',
            avatar_url: authData.user.user_metadata?.avatar_url,
          });
        }
      }

      return { user: authData.user, error: null };
    } catch (error) {
      console.error('Sign in error:', error);
      return { user: null, error: error as AuthError };
    }
  }

  /**
   * Sign in anonymously for quick onboarding
   */
  async signInAnonymously(displayName: string): Promise<{ user: User | null; error: AuthError | null }> {
    try {
      const { data: authData, error } = await supabase.auth.signInAnonymously({
        options: {
          data: {
            display_name: displayName,
          },
        },
      });

      if (error) {
        return { user: null, error };
      }

      // Create user profile for anonymous user
      if (authData.user) {
        await this.createUserProfile({
          id: authData.user.id,
          display_name: displayName,
        });
      }

      return { user: authData.user, error: null };
    } catch (error) {
      console.error('Anonymous sign in error:', error);
      return { user: null, error: error as AuthError };
    }
  }

  /**
   * Sign out current user
   */
  async signOut(): Promise<{ error: AuthError | null }> {
    try {
      const { error } = await supabase.auth.signOut();
      return { error };
    } catch (error) {
      console.error('Sign out error:', error);
      return { error: error as AuthError };
    }
  }

  /**
   * Get current user's profile
   */
  async getUserProfile(): Promise<{ profile: UserProfile | null; error: any }> {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        return { profile: null, error: 'No authenticated user' };
      }

      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Error getting user profile:', error);
        return { profile: null, error };
      }

      // If no profile exists, create one
      if (!data) {
        const profileCreated = await this.createUserProfile({
          id: user.id,
          email: user.email,
          display_name: user.user_metadata?.display_name || user.email?.split('@')[0] || 'User',
          avatar_url: user.user_metadata?.avatar_url,
        });

        if (profileCreated) {
          // Fetch the newly created profile
          const { data: newProfile } = await supabase
            .from('users')
            .select('*')
            .eq('id', user.id)
            .single();

          return { profile: newProfile, error: null };
        }
      }

      return { profile: data, error: null };
    } catch (error) {
      console.error('Error getting user profile:', error);
      return { profile: null, error };
    }
  }

  /**
   * Update user profile
   */
  async updateUserProfile(updates: Partial<UserProfile>): Promise<{ profile: UserProfile | null; error: any }> {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        return { profile: null, error: 'No authenticated user' };
      }

      const { data, error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', user.id)
        .select()
        .single();

      return { profile: data, error };
    } catch (error) {
      console.error('Error updating user profile:', error);
      return { profile: null, error };
    }
  }

  /**
   * Convert Supabase user to ChatUser format for compatibility
   */
  async getCurrentChatUser(): Promise<ChatUser | null> {
    try {
      const { profile } = await this.getUserProfile();

      if (!profile) {
        return null;
      }

      return {
        id: profile.id,
        name: profile.display_name,
        avatar: profile.avatar_url,
      };
    } catch (error) {
      console.error('Error getting current chat user:', error);
      return null;
    }
  }

  /**
   * Reset password
   */
  async resetPassword(email: string): Promise<{ error: AuthError | null }> {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'groupby://reset-password',
      });
      return { error };
    } catch (error) {
      console.error('Reset password error:', error);
      return { error: error as AuthError };
    }
  }

  /**
   * Update password
   */
  async updatePassword(newPassword: string): Promise<{ error: AuthError | null }> {
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      return { error };
    } catch (error) {
      console.error('Update password error:', error);
      return { error: error as AuthError };
    }
  }

  /**
   * Refresh session
   */
  async refreshSession(): Promise<{ session: Session | null; error: AuthError | null }> {
    try {
      const { data, error } = await supabase.auth.refreshSession();
      return { session: data.session, error };
    } catch (error) {
      console.error('Refresh session error:', error);
      return { session: null, error: error as AuthError };
    }
  }

  /**
   * Subscribe to auth state changes
   */
  onAuthStateChange(callback: (state: AuthState) => void): () => void {
    this.authStateListeners.push(callback);

    // Return unsubscribe function
    return () => {
      this.authStateListeners = this.authStateListeners.filter(
        listener => listener !== callback
      );
    };
  }

  /**
   * Create user profile in public.users table
   */
  private async createUserProfile(profileData: {
    id: string;
    email?: string;
    display_name: string;
    avatar_url?: string;
  }): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('users')
        .insert({
          id: profileData.id,
          email: profileData.email,
          display_name: profileData.display_name,
          avatar_url: profileData.avatar_url,
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating user profile:', error);
        return false;
      }

      console.log('User profile created successfully');
      return true;
    } catch (error) {
      console.error('Error creating user profile:', error);
      return false;
    }
  }

  /**
   * Notify auth state change listeners
   */
  private notifyAuthStateChange(state: AuthState): void {
    this.authStateListeners.forEach(listener => {
      try {
        listener(state);
      } catch (error) {
        console.error('Error in auth state listener:', error);
      }
    });
  }
}

// Export singleton instance
export const authService = new AuthenticationService();