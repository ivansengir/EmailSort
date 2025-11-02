import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { User } from '../types';
import { supabase } from '../lib/supabase';
import { getCurrentUser, syncPrimaryGmailAccount } from '../lib/auth';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, isLoading: true });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    // Session debugging - check localStorage every 10 seconds
    const checkStorage = () => {
      try {
        const stored = localStorage.getItem('emailsort-auth');
        if (stored) {
          const parsed = JSON.parse(stored);
          const expiresAt = parsed.expires_at ? new Date(parsed.expires_at * 1000) : null;
          const now = new Date();
          const timeUntilExpiry = expiresAt ? Math.round((expiresAt.getTime() - now.getTime()) / 1000) : null;
          console.log('[Session Debug] localStorage exists, expires in:', timeUntilExpiry, 'seconds', 'at:', expiresAt?.toLocaleTimeString());
        } else {
          console.log('[Session Debug] localStorage is EMPTY');
        }
      } catch (error) {
        console.error('[Session Debug] Error checking localStorage:', error);
      }
    };
    
    checkStorage(); // Check immediately
    const storageCheckInterval = setInterval(checkStorage, 10000); // Check every 10 seconds

    const initAuth = async () => {
      try {
        console.log('[AuthContext] Starting auth initialization...');
        const { data: { session } } = await supabase.auth.getSession();
        console.log('[AuthContext] Session retrieved:', session ? 'exists' : 'null');
        
        if (session) {
          console.log('[AuthContext] Session expires at:', new Date((session.expires_at || 0) * 1000).toLocaleTimeString());
        }

        if (session && mounted) {
          console.log('[AuthContext] Getting current user...');
          try {
            const currentUser = await getCurrentUser(session);
            console.log('[AuthContext] Current user:', currentUser ? currentUser.id : 'null');
            
            if (mounted) {
              setUser(currentUser);
            }

            if (currentUser) {
              console.log('[AuthContext] Syncing Gmail account (background)...');
              syncPrimaryGmailAccount(currentUser, session)
                .then(() => console.log('[AuthContext] Gmail sync complete'))
                .catch((syncError) => console.warn('[AuthContext] Gmail sync failed:', syncError));
            }
          } catch (userError) {
            console.error('[AuthContext] Failed to get user, but keeping session:', userError);
            // Don't throw - keep the user logged in even if DB query fails
            // They can try refreshing or will auto-retry on next navigation
          }
        } else {
          console.log('[AuthContext] No session, user remains null');
        }
      } catch (error) {
        console.error('[AuthContext] Auth initialization error:', error);
      } finally {
        if (mounted) {
          console.log('[AuthContext] Setting isLoading to false');
          setIsLoading(false);
        }
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event: AuthChangeEvent, session: Session | null) => {
      console.log('[AuthContext] Auth state change:', event, 'Session exists:', !!session);

      if (!mounted) return;

      // Skip INITIAL_SESSION - initAuth already handles initial state
      if (event === 'INITIAL_SESSION') {
        console.log('[AuthContext] Skipping INITIAL_SESSION event');
        return;
      }

      // Handle TOKEN_REFRESHED - just update the session silently
      if (event === 'TOKEN_REFRESHED') {
        console.log('[AuthContext] Token refreshed, session still valid');
        // Don't need to do anything - session is automatically persisted
        return;
      }

      if (event === 'SIGNED_IN' && session) {
        console.log('[AuthContext] Handling SIGNED_IN event');
        try {
          const currentUser = await getCurrentUser(session);
          console.log('[AuthContext] User profile received:', currentUser);
          setUser(currentUser);
          
          if (currentUser) {
            syncPrimaryGmailAccount(currentUser, session)
              .then(() => console.log('[AuthContext] Gmail sync complete (event)'))
              .catch((error) => console.warn('[AuthContext] Gmail sync failed (event):', error));
          }
        } catch (error) {
          console.error('[AuthContext] Error during sign in:', error);
        } finally {
          setIsLoading(false);
        }
      } else if (event === 'SIGNED_OUT') {
        console.log('[AuthContext] Handling SIGNED_OUT event');
        setUser(null);
        setIsLoading(false);
      } else if (event === 'USER_UPDATED') {
        console.log('[AuthContext] User updated event');
        // Session is still valid, just metadata changed
      }
    });

    return () => {
      mounted = false;
      clearInterval(storageCheckInterval);
      subscription.unsubscribe();
    };
  }, []); // Sin dependencias - solo se ejecuta una vez al montar

  return (
    <AuthContext.Provider value={{ user, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
