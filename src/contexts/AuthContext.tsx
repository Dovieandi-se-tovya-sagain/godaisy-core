/**
 * Centralized Authentication Context
 * Provides consistent auth state across Go Daisy and Findr
 * Eliminates race conditions and duplicate session checks
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User, Session, AuthChangeEvent } from '@supabase/supabase-js';
import { authClient } from '../lib/supabase/authClient';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  // Initialize session on mount
  useEffect(() => {
    // Check active session
    authClient.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = authClient.auth.onAuthStateChange(
      async (_event: AuthChangeEvent, session: Session | null) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

        // Sync session across tabs
        if (typeof window !== 'undefined') {
          if (session) {
            localStorage.setItem('supabase.auth.session', JSON.stringify(session));

            // Sync push token to server on sign in (native apps only)
            try {
              const { Capacitor } = await import('@capacitor/core');
              if (Capacitor.isNativePlatform()) {
                console.log('[Auth] Native platform detected, syncing push token...');
                const { syncPushTokenToServer, getPushToken } = await import('../lib/capacitor/pushNotifications');
                const storedToken = getPushToken();
                if (storedToken) {
                  console.log('[Auth] Found stored token, syncing...');
                  const success = await syncPushTokenToServer(session.access_token);
                  console.log('[Auth] Push token sync:', success ? 'SUCCESS' : 'FAILED');
                } else {
                  console.log('[Auth] No stored push token to sync');
                }
              }
            } catch (e) {
              console.error('[Auth] Push sync failed:', e);
            }
          } else {
            localStorage.removeItem('supabase.auth.session');
          }
        }
      }
    );

    // Listen for storage events (cross-tab sync)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'supabase.auth.session') {
        if (e.newValue) {
          try {
            const newSession = JSON.parse(e.newValue) as Session;
            setSession(newSession);
            setUser(newSession.user);
          } catch {
            // Invalid session data, ignore
          }
        } else {
          // Session removed in another tab
          setSession(null);
          setUser(null);
        }
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('storage', handleStorageChange);
    }

    return () => {
      subscription.unsubscribe();
      if (typeof window !== 'undefined') {
        window.removeEventListener('storage', handleStorageChange);
      }
    };
  }, []);

  // Sign out function
  const signOut = useCallback(async () => {
    try {
      // Clear session state immediately for responsive UI
      setUser(null);
      setSession(null);

      // Call Supabase signout
      await authClient.auth.signOut();

      // Clear local storage
      if (typeof window !== 'undefined') {
        localStorage.removeItem('supabase.auth.session');
      }
    } catch (error) {
      console.error('Error signing out:', error);
      // Re-throw to allow calling code to handle
      throw error;
    }
  }, []);

  // Refresh session function
  const refreshSession = useCallback(async () => {
    try {
      const { data: { session }, error } = await authClient.auth.refreshSession();
      if (error) throw error;

      setSession(session);
      setUser(session?.user ?? null);
    } catch (error) {
      console.error('Error refreshing session:', error);
      // If refresh fails, clear session
      setSession(null);
      setUser(null);
      throw error;
    }
  }, []);

  const value: AuthContextType = {
    user,
    session,
    loading,
    signOut,
    refreshSession,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// Hook to use auth context
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Hook for protected routes
export function useRequireAuth(redirectTo = '/login') {
  const { user, loading } = useAuth();
  const [shouldRedirect, setShouldRedirect] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      setShouldRedirect(true);
    }
  }, [loading, user]);

  return { user, loading, shouldRedirect, redirectTo };
}
