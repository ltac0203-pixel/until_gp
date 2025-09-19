import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { authService, AuthState, SignUpData, SignInData, UserProfile } from '../services/authService';
import { ChatUser } from '../types';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAuthenticated: boolean;
  profile: UserProfile | null;
  chatUser: ChatUser | null;
  signUp: (data: SignUpData) => Promise<{ user: User | null; error: AuthError | null }>;
  signIn: (data: SignInData) => Promise<{ user: User | null; error: AuthError | null }>;
  signInAnonymously: (displayName: string) => Promise<{ user: User | null; error: AuthError | null }>;
  signOut: () => Promise<{ error: AuthError | null }>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<{ profile: UserProfile | null; error: any }>;
  resetPassword: (email: string) => Promise<{ error: AuthError | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: AuthError | null }>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    session: null,
    loading: true,
    isAuthenticated: false,
  });
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [chatUser, setChatUser] = useState<ChatUser | null>(null);

  useEffect(() => {
    initializeAuth();
  }, []);

  // Subscribe to auth state changes
  useEffect(() => {
    const unsubscribe = authService.onAuthStateChange((state) => {
      setAuthState(state);
      if (state.isAuthenticated) {
        loadUserProfile();
      } else {
        setProfile(null);
        setChatUser(null);
      }
    });

    return unsubscribe;
  }, []);

  const initializeAuth = async () => {
    try {
      const state = await authService.getCurrentAuthState();
      setAuthState(state);

      if (state.isAuthenticated) {
        await loadUserProfile();
      }
    } catch (error) {
      console.error('Error initializing auth:', error);
      setAuthState({
        user: null,
        session: null,
        loading: false,
        isAuthenticated: false,
      });
    }
  };

  const loadUserProfile = async () => {
    try {
      const { profile: userProfile, error } = await authService.getUserProfile();
      if (error) {
        console.error('Error loading user profile:', error);
        return;
      }

      setProfile(userProfile);

      // Convert to ChatUser format for compatibility
      if (userProfile) {
        setChatUser({
          id: userProfile.id,
          name: userProfile.display_name,
          avatar: userProfile.avatar_url,
        });
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
    }
  };

  const signUp = async (data: SignUpData) => {
    const result = await authService.signUp(data);
    if (result.user && !result.error) {
      // Profile will be loaded automatically via auth state change
    }
    return result;
  };

  const signIn = async (data: SignInData) => {
    const result = await authService.signIn(data);
    if (result.user && !result.error) {
      // Profile will be loaded automatically via auth state change
    }
    return result;
  };

  const signInAnonymously = async (displayName: string) => {
    const result = await authService.signInAnonymously(displayName);
    if (result.user && !result.error) {
      // Profile will be loaded automatically via auth state change
    }
    return result;
  };

  const signOut = async () => {
    const result = await authService.signOut();
    if (!result.error) {
      setProfile(null);
      setChatUser(null);
    }
    return result;
  };

  const updateProfile = async (updates: Partial<UserProfile>) => {
    const result = await authService.updateUserProfile(updates);
    if (result.profile && !result.error) {
      setProfile(result.profile);
      // Update ChatUser as well
      setChatUser({
        id: result.profile.id,
        name: result.profile.display_name,
        avatar: result.profile.avatar_url,
      });
    }
    return result;
  };

  const resetPassword = async (email: string) => {
    return await authService.resetPassword(email);
  };

  const updatePassword = async (newPassword: string) => {
    return await authService.updatePassword(newPassword);
  };

  const refreshProfile = async () => {
    await loadUserProfile();
  };

  return (
    <AuthContext.Provider
      value={{
        user: authState.user,
        session: authState.session,
        loading: authState.loading,
        isAuthenticated: authState.isAuthenticated,
        profile,
        chatUser,
        signUp,
        signIn,
        signInAnonymously,
        signOut,
        updateProfile,
        resetPassword,
        updatePassword,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};