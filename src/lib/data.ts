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
  // First check if there are any Gmail accounts
  const { data: accounts } = await supabase
    .from('gmail_accounts')
    .select('id')
    .limit(1);

  const hasAccounts = accounts && accounts.length > 0;

  // Fetch categories with dynamic email count based on actual non-deleted emails
  const { data, error } = await supabase
    .from('categories')
    .select(`
      id,
      user_id,
      name,
      description,
      color,
      order_index,
      created_at,
      updated_at,
      emails:emails!category_id(count)
    `)
    .eq('emails.is_deleted', false)
    .order('order_index', { ascending: true })
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Failed to load categories', error);
    return [];
  }

  // Map the results to include computed email_count
  type CategoryWithEmailCount = Omit<Category, 'email_count'> & { 
    emails?: Array<{ count: number }> 
  };
  const categories = (data ?? []).map((cat: CategoryWithEmailCount) => {
    // Remove the emails property and compute email_count
    const { emails, ...categoryData } = cat;
    return {
      ...categoryData,
      // If no accounts, force count to 0, otherwise use actual count from join
      email_count: hasAccounts ? (emails?.[0]?.count || 0) : 0,
    } as Category;
  });

  return categories;
}

interface CategoryInput {
  userId: string;
  name: string;
  description: string;
  color?: string;
}

export async function addCategory(input: CategoryInput) {
  // Get the max order_index to place new category at the end
  const { data: maxOrderData } = await supabase
    .from('categories')
    .select('order_index')
    .eq('user_id', input.userId)
    .order('order_index', { ascending: false })
    .limit(1);

  const maxOrder = maxOrderData?.[0]?.order_index ?? -1;

  const { error } = await supabase.from('categories').insert({
    user_id: input.userId,
    name: input.name,
    description: input.description,
    color: input.color ?? '#3b82f6',
    order_index: maxOrder + 1,
  });

  if (error) {
    throw error;
  }
}

interface CategoryUpdate {
  name?: string;
  description?: string;
  color?: string;
}

export async function updateCategory(categoryId: string, updates: CategoryUpdate) {
  const { error } = await supabase
    .from('categories')
    .update(updates)
    .eq('id', categoryId);

  if (error) {
    throw error;
  }
}

export async function reorderCategories(categoryIds: string[]) {
  // Update order_index for each category
  const updates = categoryIds.map((id, index) => ({
    id,
    order_index: index,
  }));

  for (const update of updates) {
    const { error } = await supabase
      .from('categories')
      .update({ order_index: update.order_index })
      .eq('id', update.id);

    if (error) {
      console.error('Failed to update category order:', error);
      throw error;
    }
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

export async function invokeEmailSync(
  gmailAccountId?: string, 
  fullSync = true, 
  syncMode?: 'last30' | 'all'
) {
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
    if (syncMode) {
      body.syncMode = syncMode;
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
