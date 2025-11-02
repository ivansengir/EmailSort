// deno-lint-ignore-file no-explicit-any
// @ts-expect-error - Deno std import available at runtime.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { getServiceClient, getUserFromAuthHeader, jsonResponse, errorResponse, corsHeaders } from "../_shared/util.ts";
import { refreshGmailAccessToken, moveMessageToTrash } from "../_shared/gmail.ts";
import { attemptUnsubscribe } from "../_shared/unsubscribe.ts";

interface BulkRequest {
  action: "delete" | "unsubscribe";
  emailIds: string[];
}

type EmailRow = {
  id: string;
  gmail_message_id: string;
  gmail_thread_id: string;
  gmail_account_id: string;
  category_id: string;
  content_text: string | null;
  content_html: string | null;
};

type GmailAccountRow = {
  id: string;
  oauth_token: string | null;
  oauth_refresh_token: string | null;
  token_expires_at: string | null;
};

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders() });
  }

  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

  const supabase = getServiceClient();
  let authUser;

  try {
    authUser = await getUserFromAuthHeader(supabase, req);
  } catch (error) {
    console.error("[bulk-actions] Auth error:", error);
    return errorResponse("Unauthorized", 401);
  }

  console.log("[bulk-actions] Auth user:", authUser.id);

  // Get public.users record
  const { data: user, error: userError } = await supabase
    .from("users")
    .select("id")
    .eq("auth_id", authUser.id)
    .maybeSingle();

  if (userError || !user) {
    console.error("[bulk-actions] Failed to find user:", userError);
    return errorResponse("User not found", 404);
  }

  console.log("[bulk-actions] Public user ID:", user.id);

  const payload = (await req.json().catch(() => null)) as BulkRequest | null;
  if (!payload || !payload.emailIds?.length || !payload.action) {
    console.error("[bulk-actions] Invalid payload:", payload);
    return errorResponse("Invalid request", 400);
  }

  console.log(`[bulk-actions] Action: ${payload.action}, Email IDs count: ${payload.emailIds.length}`);
  console.log(`[bulk-actions] Email IDs received:`, payload.emailIds);

  const { data: emails, error: emailError } = await supabase
    .from("emails")
    .select("id, gmail_message_id, gmail_thread_id, gmail_account_id, category_id, content_text, content_html")
    .in("id", payload.emailIds)
    .eq("user_id", user.id);

  if (emailError) {
    console.error("[bulk-actions] Failed to load emails:", emailError);
    return errorResponse("Failed to load emails", 500);
  }

  console.log(`[bulk-actions] Found ${emails?.length || 0} emails matching user ${user.id}`);

  if (!emails?.length) {
    return jsonResponse({ message: "No emails found" });
  }

  const typedEmails = (emails ?? []) as EmailRow[];

  const gmailAccountIds = [...new Set(typedEmails.map((email) => email.gmail_account_id))];
  const { data: accounts, error: accountError } = await supabase
    .from("gmail_accounts")
    .select("id, oauth_token, oauth_refresh_token, token_expires_at")
    .in("id", gmailAccountIds);

  if (accountError) {
    console.error("Failed to load Gmail accounts", accountError);
    return errorResponse("Failed to load Gmail accounts", 500);
  }

  const typedAccounts = (accounts ?? []) as GmailAccountRow[];
  const accountMap = new Map(typedAccounts.map((acc) => [acc.id, acc]));
  
  interface ActionResult {
    emailId?: string;
    status: string;
    error?: string;
    method?: string | null;
    target?: string | null;
  }
  const results: ActionResult[] = [];

  for (const email of typedEmails) {
    console.log(`[bulk-actions] Processing email ID: ${email.id}, from: ${email.gmail_account_id}`);
    
    const account = accountMap.get(email.gmail_account_id);
    if (!account) {
      results.push({ emailId: email.id, status: "error", error: "Missing Gmail account" });
      continue;
    }

    let accessToken = account.oauth_token as string | null;
    const refreshToken = account.oauth_refresh_token as string | null;
    const expiresAt = account.token_expires_at ? new Date(account.token_expires_at) : null;
    const now = new Date();

    if (!accessToken || !refreshToken) {
      results.push({ emailId: email.id, status: "error", error: "Account missing tokens" });
      continue;
    }

    if (!expiresAt || expiresAt <= now) {
      try {
        const refreshed = await refreshGmailAccessToken(refreshToken);
        accessToken = refreshed.accessToken;
        const { error: updateError } = await supabase
          .from("gmail_accounts")
          .update({ oauth_token: accessToken, token_expires_at: new Date(Date.now() + refreshed.expiresIn * 1000).toISOString() })
          .eq("id", account.id);
        if (updateError) {
          console.error("Failed to persist refreshed token", updateError);
        }
      } catch (error) {
        console.error("Token refresh failed", error);
        results.push({ emailId: email.id, status: "error", error: "Token refresh failed" });
        continue;
      }
    }

    try {
      if (payload.action === "delete") {
        console.log(`[bulk-actions] Deleting email ${email.id} (${email.gmail_message_id}) in Gmail...`);
        await moveMessageToTrash(accessToken as string, email.gmail_message_id);
        console.log(`[bulk-actions] Email moved to trash in Gmail, updating database...`);
        const { error: updateEmailError } = await supabase
          .from("emails")
          .update({ is_deleted: true })
          .eq("id", email.id);
        if (updateEmailError) {
          console.error(`[bulk-actions] Database update failed for ${email.id}:`, updateEmailError);
          throw updateEmailError;
        }
        console.log(`[bulk-actions] ✓ Email ${email.id} deleted successfully`);
        results.push({ emailId: email.id, status: "deleted" });
      } else if (payload.action === "unsubscribe") {
        console.log(`[bulk-actions] Attempting unsubscribe for email ${email.id}...`);
        console.log(`[bulk-actions] Email ${email.id} - HTML length: ${email.content_html?.length || 0}, Text length: ${email.content_text?.length || 0}`);
        const attempt = await attemptUnsubscribe(email.content_html, email.content_text);
        const { error: logError } = await supabase
          .from("unsubscribe_logs")
          .insert({
            user_id: user.id,
            email_id: email.id,
            status: attempt.status,
            unsubscribe_method: attempt.method,
            unsubscribe_target: attempt.target,
            error_message: attempt.status === "error" ? attempt.error : null,
            attempt_count: 1,
            last_attempted_at: new Date().toISOString(),
          });
        if (logError) {
          console.error("[bulk-actions] Failed to log unsubscribe:", logError);
        }
        console.log(`[bulk-actions] ✓ Unsubscribe attempt for ${email.id}: ${attempt.status}, target: ${attempt.target}`);
        results.push({ emailId: email.id, status: attempt.status, method: attempt.method, target: attempt.target });
      }
    } catch (error) {
      console.error(`[bulk-actions] Bulk action error for email ${email.id}:`, error);
      results.push({ emailId: email.id, status: "error", error: (error as Error).message });
    }
  }

  console.log(`[bulk-actions] Bulk action completed. Results:`, results);
  return jsonResponse({ results });
});
