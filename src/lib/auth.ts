import { supabase } from './supabase';
import type { Session, PostgrestSingleResponse } from '@supabase/supabase-js';
import { User, GmailAccount } from '../types';

const REQUEST_TIMEOUT_MS = 20000; // Increased to 20 seconds for very slow queries
let currentUserPromise: Promise<User | null> | null = null;
let cachedUser: { user: User | null; timestamp: number } | null = null;
const CACHE_DURATION_MS = 15 * 60 * 1000; // Cache for 15 minutes (increased from 10)
const USER_CACHE_KEY = 'emailsort-user-cache';

// Helper to get cached user from localStorage
function getCachedUserFromStorage(): { user: User; timestamp: number } | null {
  try {
    const cached = localStorage.getItem(USER_CACHE_KEY);
    if (!cached) return null;
    
    const parsed = JSON.parse(cached);
    if (Date.now() - parsed.timestamp < CACHE_DURATION_MS) {
      return parsed;
    }
    
    // Expired, remove it
    localStorage.removeItem(USER_CACHE_KEY);
    return null;
  } catch (error) {
    console.error('[getCachedUserFromStorage] Error:', error);
    return null;
  }
}

// Helper to save user to localStorage cache
function saveCachedUserToStorage(user: User) {
  try {
    const cacheData = { user, timestamp: Date.now() };
    localStorage.setItem(USER_CACHE_KEY, JSON.stringify(cacheData));
  } catch (error) {
    console.error('[saveCachedUserToStorage] Error:', error);
  }
}

async function withTimeout<T>(factory: () => Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(message));
    }, timeoutMs);

    factory()
      .then((value) => {
        clearTimeout(timeoutId);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });
}

export async function signInWithGoogle() {
  const redirectUrl = window.location.origin;

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: redirectUrl,
      scopes: 'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.modify',
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    },
  });

  if (error) throw error;
  return data;
}

/**
 * Add another Gmail account to the current user
 * This will trigger OAuth flow allowing user to select a different account
 */
export async function addGmailAccount() {
  const redirectUrl = window.location.origin;

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: redirectUrl,
      scopes: 'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.modify',
      queryParams: {
        access_type: 'offline',
        prompt: 'select_account', // Force account selection
      },
    },
  });

  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  // Clear cache on sign out
  cachedUser = null;
  currentUserPromise = null;
  localStorage.removeItem(USER_CACHE_KEY); // Clear localStorage cache
  if (error) throw error;
}

// Export function to clear cache if needed
export function clearUserCache() {
  console.log('[auth] Clearing user cache');
  cachedUser = null;
  currentUserPromise = null;
  localStorage.removeItem(USER_CACHE_KEY); // Clear localStorage cache
}

export async function getCurrentUser(existingSession?: Session): Promise<User | null> {
  // Check memory cache first
  if (cachedUser && cachedUser.user && Date.now() - cachedUser.timestamp < CACHE_DURATION_MS) {
    console.log('[getCurrentUser] Returning memory cached user');
    return cachedUser.user;
  }

  // Check localStorage cache second
  const storedCache = getCachedUserFromStorage();
  if (storedCache) {
    console.log('[getCurrentUser] Returning localStorage cached user');
    cachedUser = storedCache;
    return storedCache.user;
  }

  if (currentUserPromise) {
    console.log('[getCurrentUser] Returning in-flight user promise');
    return currentUserPromise;
  }

  currentUserPromise = (async () => {
    try {
      let session = existingSession;

      if (!session) {
        console.log('[getCurrentUser] Fetching session...');
        const sessionStart = Date.now();
        const { data, error } = await withTimeout(
          () => supabase.auth.getSession(),
          REQUEST_TIMEOUT_MS,
          'Session fetch timed out',
        );
        console.log(`[getCurrentUser] Session fetched in ${Date.now() - sessionStart}ms`);

        if (error) {
          console.error('[getCurrentUser] Session error:', error);
          return null;
        }

        session = data.session ?? undefined;
      }

      if (!session?.user) {
        console.warn('[getCurrentUser] No session user present');
        return null;
      }

      const authUser = session.user;
      console.log('[getCurrentUser] Session user id:', authUser.id);

      console.log('[getCurrentUser] Selecting existing user from DB...');
      const selectStart = Date.now();
      
      // Try to fetch user with retry logic (reduced to 1 attempt with longer timeout)
      let user: User | null = null;
      let selectError: Error | null = null;
      
      try {
        const { data, error } = await withTimeout<PostgrestSingleResponse<User>>(
          () => (supabase
            .from('users')
            .select('*')
            .eq('auth_id', authUser.id)
            .maybeSingle<User>()) as unknown as Promise<PostgrestSingleResponse<User>>,
          REQUEST_TIMEOUT_MS,
          `User lookup timed out after ${REQUEST_TIMEOUT_MS}ms`,
        );
        
        if (error) {
          selectError = error as Error;
          console.error('[getCurrentUser] Select error:', error);
        } else {
          user = data;
        }
      } catch (error) {
        selectError = error as Error;
        console.error('[getCurrentUser] Exception:', error);
      }
      
      console.log(`[getCurrentUser] DB select completed in ${Date.now() - selectStart}ms`);

      if (selectError && !user) {
        console.error('[getCurrentUser] Query failed:', selectError);
        return null;
      }

      if (user) {
        console.log('[getCurrentUser] Found existing user:', user.id);
        cachedUser = { user, timestamp: Date.now() };
        saveCachedUserToStorage(user); // Save to localStorage
        return user;
      }

      console.log('[getCurrentUser] User not found in DB, inserting...');
      const { data: newUser, error: insertError } = await withTimeout<PostgrestSingleResponse<User>>(
        () => (supabase
          .from('users')
          .insert({
            auth_id: authUser.id,
            email: authUser.email ?? '',
            display_name: authUser.user_metadata?.full_name || authUser.email,
          })
          .select()
          .single<User>()) as unknown as Promise<PostgrestSingleResponse<User>>,
        REQUEST_TIMEOUT_MS,
        'User insert timed out',
      );

      if (insertError) {
        console.error('[getCurrentUser] Insert error:', insertError);
        if (insertError.code === '23505') {
          console.log('[getCurrentUser] Duplicate detected, re-fetching...');
          const { data: existingUser } = await withTimeout<PostgrestSingleResponse<User>>(
            () => (supabase
              .from('users')
              .select('*')
              .eq('auth_id', authUser.id)
              .maybeSingle<User>()) as unknown as Promise<PostgrestSingleResponse<User>>,
            REQUEST_TIMEOUT_MS,
            'Duplicate user lookup timed out',
          );
          if (existingUser) {
            console.log('[getCurrentUser] Returning deduplicated user:', existingUser.id);
            cachedUser = { user: existingUser, timestamp: Date.now() };
            saveCachedUserToStorage(existingUser); // Save to localStorage
            return existingUser;
          }
        }
        return null;
      }

      console.log('[getCurrentUser] Inserted new user:', newUser?.id);
      if (newUser) {
        cachedUser = { user: newUser, timestamp: Date.now() };
        saveCachedUserToStorage(newUser); // Save to localStorage
      }
      return newUser ?? null;
    } catch (error) {
      console.error('[getCurrentUser] Unexpected error:', error);
      return null;
    } finally {
      currentUserPromise = null;
    }
  })();

  return currentUserPromise;
}

export async function syncPrimaryGmailAccount(user: User, session: Session): Promise<GmailAccount | null> {
  try {
    console.log('[syncPrimaryGmailAccount] Starting...');

    if (!session) {
      console.warn('[syncPrimaryGmailAccount] No session provided');
      return null;
    }

    // Extract provider tokens from session metadata
    interface SessionWithProvider {
      provider_token?: string;
      provider_refresh_token?: string;
    }
    const providerToken = (session as unknown as SessionWithProvider).provider_token;
    const providerRefreshToken = (session as unknown as SessionWithProvider).provider_refresh_token;

    if (!providerToken || !providerRefreshToken) {
      console.warn('[syncPrimaryGmailAccount] Missing provider tokens');
      return null;
    }

    console.log('[syncPrimaryGmailAccount] User ID:', user.id);

    const tokenExpiry = session.expires_at
      ? new Date(session.expires_at * 1000).toISOString()
      : null;

    const userEmail = session.user.email ?? user.email;

    // Check if account already exists
    console.log('[syncPrimaryGmailAccount] Checking for existing account...');
    const { data: existing } = await supabase
      .from('gmail_accounts')
      .select('*')
      .eq('user_id', user.id)
      .eq('email', userEmail)
      .maybeSingle();

    if (existing) {
      console.log('[syncPrimaryGmailAccount] Updating existing account:', existing.id);
      // Update existing account
      const { data: updated, error: updateError } = await supabase
        .from('gmail_accounts')
        .update({
          oauth_token: providerToken,
          oauth_refresh_token: providerRefreshToken,
          token_expires_at: tokenExpiry,
          is_primary: true,
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (updateError) {
        console.error('[syncPrimaryGmailAccount] Update error:', updateError);
        return null;
      }

      console.log('[syncPrimaryGmailAccount] Updated successfully');
      return updated as GmailAccount;
    }

    // Insert new account
    console.log('[syncPrimaryGmailAccount] Inserting new account...');
    const { data: inserted, error: insertError } = await supabase
      .from('gmail_accounts')
      .insert({
        user_id: user.id,
        email: userEmail,
        oauth_token: providerToken,
        oauth_refresh_token: providerRefreshToken,
        token_expires_at: tokenExpiry,
        is_primary: true,
      })
      .select()
      .single();

    if (insertError) {
      // Si es un error de duplicado, intentar obtener la cuenta existente
      if (insertError.code === '23505') {
        console.log('[syncPrimaryGmailAccount] Duplicate detected, fetching existing...');
        const { data: existingAccount } = await supabase
          .from('gmail_accounts')
          .select('*')
          .eq('user_id', user.id)
          .eq('email', userEmail)
          .single();
        
        if (existingAccount) {
          console.log('[syncPrimaryGmailAccount] Updating duplicate account');
          // Actualizar tokens de la cuenta existente
          const { data: updated } = await supabase
            .from('gmail_accounts')
            .update({
              oauth_token: providerToken,
              oauth_refresh_token: providerRefreshToken,
              token_expires_at: tokenExpiry,
            })
            .eq('id', existingAccount.id)
            .select()
            .single();
          
          return (updated as GmailAccount) || (existingAccount as GmailAccount);
        }
      }
      console.error('[syncPrimaryGmailAccount] Insert error:', insertError);
      return null;
    }

    console.log('[syncPrimaryGmailAccount] Inserted successfully');
    return inserted as GmailAccount;
  } catch (error) {
    console.error('[syncPrimaryGmailAccount] Unexpected error:', error);
    return null;
  }
}
