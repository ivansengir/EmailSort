import { supabase } from './supabase';
import type { Category, Email, GmailAccount } from '../types';

export async function fetchGmailAccounts(): Promise<GmailAccount[]> {
  const { data, error } = await supabase
    .from('gmail_accounts')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Failed to load Gmail accounts:', error);
    return [];
  }

  console.log('[fetchGmailAccounts] Loaded accounts:', data?.length ?? 0);
  return data ?? [];
}

export async function deleteGmailAccount(accountId: string): Promise<void> {
  const { error } = await supabase
    .from('gmail_accounts')
    .delete()
    .eq('id', accountId);

  if (error) {
    console.error('Failed to delete Gmail account:', error);
    throw error;
  }
}

export async function fetchCategories(): Promise<Category[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Failed to load categories', error);
    return [];
  }

  return data ?? [];
}

interface CategoryInput {
  userId: string;
  name: string;
  description: string;
  color?: string;
}

export async function addCategory(input: CategoryInput) {
  const { error } = await supabase.from('categories').insert({
    user_id: input.userId,
    name: input.name,
    description: input.description,
    color: input.color ?? '#3b82f6',
  });

  if (error) {
    throw error;
  }
}

export async function fetchEmailsByCategory(categoryId: string): Promise<Email[]> {
  const { data, error } = await supabase
    .from('emails')
    .select('*')
    .eq('category_id', categoryId)
    .eq('is_deleted', false)
    .order('date', { ascending: false });

  if (error) {
    console.error('Failed to fetch emails', error);
    return [];
  }

  return data ?? [];
}

export async function updateEmailSelection(emailIds: string[], selected: boolean) {
  const { error } = await supabase.rpc('toggle_email_selection', {
    email_ids: emailIds,
    should_select: selected,
  });

  if (error) {
    throw error;
  }
}

export async function clearSelectionsForCategory(categoryId: string) {
  const { error } = await supabase.rpc('clear_email_selections_for_category', {
    category_uuid: categoryId,
  });

  if (error) {
    console.error('Failed to clear selections', error);
  }
}

export type BulkAction = 'delete' | 'unsubscribe';

export async function executeBulkAction(action: BulkAction, payload: { emailIds: string[] }) {
  const { error, data } = await supabase.functions.invoke('bulk-actions', {
    body: { action, ...payload },
  });

  if (error) {
    throw error;
  }

  return data;
}

export async function invokeEmailSync(gmailAccountId?: string, fullSync = true) {
  try {
    // Get the current session to ensure we have a valid token
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      throw new Error('No active session. Please log in again.');
    }

    const body: Record<string, unknown> = { fullSync };
    if (gmailAccountId) {
      body.gmailAccountId = gmailAccountId;
    }

    const { error, data } = await supabase.functions.invoke('import-emails', {
      body,
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    if (error) {
      // Si la función no existe (404), dar un mensaje más claro
      if (error.message?.includes('404') || error.message?.includes('CORS')) {
        throw new Error('Edge Function "import-emails" not deployed. Please deploy Supabase Edge Functions first.');
      }
      throw error;
    }

    return data;
  } catch (err) {
    console.error('Email sync error:', err);
    throw err;
  }
}

export async function requestUnsubscribe(emailId: string) {
  const { error, data } = await supabase.functions.invoke('unsubscribe-email', {
    body: { emailId },
  });

  if (error) {
    throw error;
  }

  return data;
}

export interface UnsubscribeLog {
  id: string;
  created_at: string;
  status: string;
  unsubscribe_method: string | null;
  unsubscribe_target: string | null;
  error_message: string | null;
  email: {
    subject: string;
    from_email: string;
  };
}

export async function fetchUnsubscribeLogs(limit = 20): Promise<UnsubscribeLog[]> {
  const { data, error } = await supabase
    .from('unsubscribe_logs')
    .select(`
      id,
      created_at,
      status,
      unsubscribe_method,
      unsubscribe_target,
      error_message,
      email:email_id (
        subject,
        from_email
      )
    `)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Failed to fetch unsubscribe logs:', error);
    return [];
  }

  return data as unknown as UnsubscribeLog[];
}
