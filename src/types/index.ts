export interface User {
  id: string;
  auth_id: string;
  email: string;
  display_name: string | null;
  has_completed_first_import: boolean;
  created_at: string;
  updated_at: string;
}

export interface GmailAccount {
  id: string;
  user_id: string;
  email: string;
  oauth_token: string;
  oauth_refresh_token: string;
  token_expires_at: string | null;
  is_primary: boolean;
  last_sync_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  user_id: string;
  name: string;
  description: string;
  color: string;
  email_count: number;
  order_index: number;
  created_at: string;
  updated_at: string;
}

export interface Email {
  id: string;
  user_id: string;
  gmail_account_id: string;
  category_id: string;
  gmail_message_id: string;
  gmail_thread_id: string;
  subject: string;
  from_email: string;
  from_name: string | null;
  to_email: string;
  date: string;
  content_text: string | null;
  content_html: string | null;
  ai_summary: string;
  categorization_confidence: number;
  is_archived: boolean;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}
