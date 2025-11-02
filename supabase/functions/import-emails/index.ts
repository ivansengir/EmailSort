// deno-lint-ignore-file no-explicit-any
// @ts-expect-error - Deno std import available at runtime.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { getServiceClient, getUserFromAuthHeader, jsonResponse, errorResponse, corsHeaders } from "../_shared/util.ts";
import {
  refreshGmailAccessToken,
  listRecentMessages,
  getMessage,
  archiveMessage,
  extractPlainText,
  extractHtml,
} from "../_shared/gmail.ts";
import { categorizeEmail, summarizeEmail } from "../_shared/openai.ts";

type GmailAccountRow = {
  id: string;
  oauth_token: string | null;
  oauth_refresh_token: string | null;
  token_expires_at: string | null;
  email: string;
  last_sync_at: string | null;
};

type CategoryRow = {
  id: string;
  name: string;
  description: string;
};

interface ImportRequestBody {
  gmailAccountId?: string;
  maxResults?: number;
  query?: string;
  fullSync?: boolean; // Force full sync, ignoring last_sync_at
  syncMode?: 'last30' | 'all'; // New: sync mode selector
}

serve(async (req: Request) => {
  console.log("[import-emails] Request received:", req.method, req.url);
  
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    console.log("[import-emails] Handling OPTIONS preflight");
    return new Response(null, { 
      status: 200,
      headers: corsHeaders() 
    });
  }

  if (req.method !== "POST") {
    console.log("[import-emails] Method not allowed:", req.method);
    return errorResponse("Method not allowed", 405);
  }

  const supabase = getServiceClient();
  let user;
  let dbUserId: string;

  try {
    console.log("[import-emails] Authenticating user...");
    const authHeader = req.headers.get("Authorization");
    console.log("[import-emails] Auth header present:", !!authHeader);
    user = await getUserFromAuthHeader(supabase, req);
    console.log("[import-emails] Auth user ID (auth.users):", user.id);
    
    // Get the user from the public.users table to get the correct user_id
    const { data: dbUser, error: userError } = await supabase
      .from("users")
      .select("id, email")
      .eq("auth_id", user.id)
      .single();
    
    if (userError || !dbUser) {
      console.error("[import-emails] User not found in users table:", userError);
      throw new Error("User profile not found in database");
    }
    
    dbUserId = dbUser.id;
    console.log("[import-emails] DB User ID (public.users):", dbUserId);
  } catch (error) {
    console.error("[import-emails] Auth error:", error);
    return new Response(JSON.stringify({ 
      error: "Unauthorized",
      message: error instanceof Error ? error.message : "Unknown error"
    }), { 
      status: 401,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders()
      }
    });
  }

  const body = (await req.json().catch(() => ({}))) as ImportRequestBody;
  const { gmailAccountId, maxResults = 10, query, fullSync = false, syncMode } = body;
  
  // Determine actual maxResults based on syncMode
  let actualMaxResults = maxResults;
  if (syncMode === 'last30') {
    actualMaxResults = 30;
  } else if (syncMode === 'all') {
    actualMaxResults = 500; // Limit to 500 for safety, but process all available
  }
  
  console.log("[import-emails] Request params:", { gmailAccountId, maxResults: actualMaxResults, query, fullSync, syncMode });

  const { data: accounts, error: accountsError } = await supabase
    .from("gmail_accounts")
    .select("id, oauth_token, oauth_refresh_token, token_expires_at, email, last_sync_at")
    .eq("user_id", dbUserId)
    .order("created_at", { ascending: true });

  if (accountsError) {
    console.error("[import-emails] Error fetching gmail accounts:", accountsError);
    return errorResponse("Failed to load Gmail accounts", 500);
  }
  
  console.log("[import-emails] Found gmail accounts:", accounts?.length || 0);

  const typedAccounts = (accounts ?? []) as GmailAccountRow[];

  const filteredAccounts = typedAccounts.filter((account) =>
    gmailAccountId ? account.id === gmailAccountId : true,
  );

  if (!filteredAccounts.length) {
    return jsonResponse({ message: "No Gmail accounts to sync", syncedEmails: [] });
  }

  const { data: categories, error: categoriesError } = await supabase
    .from("categories")
    .select("id, name, description")
    .eq("user_id", dbUserId);

  if (categoriesError) {
    console.error("[import-emails] Error fetching categories:", categoriesError);
    return errorResponse("Failed to load categories", 500);
  }

  const typedCategories = (categories ?? []) as CategoryRow[];
  console.log("[import-emails] Found categories:", typedCategories.length);

  if (!typedCategories.length) {
    console.warn("[import-emails] No categories configured for user:", dbUserId);
    return jsonResponse({ 
      message: "Please create at least one category before syncing emails", 
      syncedEmails: [],
      needsCategories: true 
    }, { status: 200 });
  }

  // Ensure "Others" category exists for emails that don't fit existing categories
  let othersCategory = typedCategories.find(c => c.name.toLowerCase() === 'others');
  if (!othersCategory) {
    console.log("[import-emails] Creating 'Others' category automatically...");
    const { data: newOthersCategory, error: createOthersError } = await supabase
      .from("categories")
      .insert({
        user_id: dbUserId,
        name: "Others",
        description: "Emails that don't fit into any specific category"
      })
      .select()
      .single();
    
    if (createOthersError) {
      console.error("[import-emails] Failed to create Others category:", createOthersError);
    } else {
      othersCategory = newOthersCategory as CategoryRow;
      typedCategories.push(othersCategory);
      console.log("[import-emails] 'Others' category created:", othersCategory.id);
    }
  }

  interface SyncedEmail {
    id?: string;
    subject?: string;
    from?: string;
    category?: string;
    emailId?: string;
    gmailMessageId?: string;
    categoryId?: string;
    summary?: string;
    accountId?: string;
    error?: string;
  }
  const syncedEmails: SyncedEmail[] = [];

  for (const account of filteredAccounts) {
    try {
      console.log("[import-emails] Processing account:", account.email);
      let accessToken = account.oauth_token as string;
      const refreshToken = account.oauth_refresh_token as string;
      const expiresAt = account.token_expires_at ? new Date(account.token_expires_at) : null;
      const now = new Date();

      if (!accessToken || !refreshToken) {
        throw new Error("Account is missing OAuth credentials");
      }

      if (!expiresAt || expiresAt <= now) {
        console.log("[import-emails] Token expired, refreshing...");
        const refreshed = await refreshGmailAccessToken(refreshToken);
        accessToken = refreshed.accessToken;
        const newExpiry = new Date(Date.now() + refreshed.expiresIn * 1000).toISOString();
        const { error: updateTokenError } = await supabase
          .from("gmail_accounts")
          .update({ oauth_token: accessToken, token_expires_at: newExpiry })
          .eq("id", account.id);
        if (updateTokenError) {
          console.error("[import-emails] Failed to persist refreshed token:", updateTokenError);
        }
      }

      // If user explicitly provides a query, use it.
      // If fullSync is true, get emails from inbox without date filter.
      // Otherwise, if last_sync_at exists, only get new emails.
      // If no last_sync_at (first sync), get inbox emails.
      let searchQuery: string;
      if (query) {
        searchQuery = query;
        console.log("[import-emails] Using custom query:", query);
      } else if (fullSync || !account.last_sync_at) {
        // Full sync - just get inbox emails, no date filter
        searchQuery = "in:inbox";
        console.log("[import-emails] Full sync mode - searching in:inbox");
      } else {
        // Incremental sync - get emails after last sync
        searchQuery = `after:${account.last_sync_at}`;
        console.log("[import-emails] Incremental sync - searching after:", account.last_sync_at);
      }
      
      console.log("[import-emails] Final search query:", searchQuery);
      console.log("[import-emails] Calling Gmail API...");
      const list = await listRecentMessages(accessToken, searchQuery);
      console.log("[import-emails] Gmail API response:", JSON.stringify(list));
      const messages = (list.messages ?? []).slice(0, actualMaxResults);
      console.log("[import-emails] Messages after slicing:", messages.length);

      let processedCount = 0;
      let skippedCount = 0;
      let errorCount = 0;

      for (const messageMeta of messages) {
        try {
          console.log(`[import-emails] Processing message ${processedCount + skippedCount + errorCount + 1}/${messages.length}: ${messageMeta.id}`);
          
          const existing = await supabase
            .from("emails")
            .select("id")
            .eq("gmail_account_id", account.id)
            .eq("gmail_message_id", messageMeta.id)
            .maybeSingle();

          if (existing.data) {
            console.log(`[import-emails] Message ${messageMeta.id} already exists, skipping`);
            skippedCount++;
            continue;
          }

          console.log(`[import-emails] Fetching full message details for ${messageMeta.id}`);
          const message = await getMessage(accessToken, messageMeta.id);
        const headers = message.payload?.headers ?? [];

        const subject = headers.find((h) => h.name.toLowerCase() === "subject")?.value ?? "(sin asunto)";
        const from = headers.find((h) => h.name.toLowerCase() === "from")?.value ?? "";
        const to = headers.find((h) => h.name.toLowerCase() === "to")?.value ?? "";
        const dateHeader = headers.find((h) => h.name.toLowerCase() === "date")?.value ?? new Date().toISOString();
        const date = new Date(dateHeader).toISOString();

        const plainBody = extractPlainText(message.payload);
        const htmlBody = extractHtml(message.payload);
        const snippet = message.snippet ?? plainBody.slice(0, 120);

        const categorization = await categorizeEmail({
          categories: typedCategories.map((c) => ({ id: c.id, name: c.name, description: c.description })),
          email: {
            subject,
            from,
            snippet,
            body: plainBody || htmlBody,
          },
        });

        const summary = await summarizeEmail(subject, plainBody || htmlBody || snippet);

        const { data: inserted, error: insertError } = await supabase
          .from("emails")
          .insert({
            user_id: dbUserId,
            gmail_account_id: account.id,
            category_id: categorization.categoryId,
            gmail_message_id: message.id,
            gmail_thread_id: message.threadId,
            subject,
            from_email: from,
            from_name: from,
            to_email: to,
            date,
            content_text: plainBody,
            content_html: htmlBody,
            ai_summary: summary,
            categorization_confidence: categorization.confidence,
            is_archived: true,
            is_deleted: false,
          })
          .select()
          .single();

        if (insertError) {
          console.error("[import-emails] Failed to insert email:", insertError);
          errorCount++;
          continue;
        }

        console.log(`[import-emails] Email inserted successfully: ${inserted.id}`);

        const { error: countUpdateError } = await supabase.rpc("increment_category_email_count", {
          category_uuid: categorization.categoryId,
        });

        if (countUpdateError) {
          console.error("[import-emails] Failed to update category count:", countUpdateError);
        }

        console.log(`[import-emails] Archiving message ${message.id} in Gmail...`);
        try {
          await archiveMessage(accessToken, message.id);
          console.log(`[import-emails] ✓ Message ${message.id} archived in Gmail`);
        } catch (archiveError) {
          console.error(`[import-emails] ✗ Failed to archive message ${message.id}:`, archiveError);
          // Continue even if archive fails
        }

        syncedEmails.push({
          emailId: inserted.id,
          gmailMessageId: message.id,
          categoryId: categorization.categoryId,
          summary,
        });
        
        processedCount++;
        
        // Dynamic delay based on sync mode to avoid OpenAI rate limits
        // OpenAI gpt-4o-mini: 500 requests/min, 200k tokens/min
        // For 'all' mode: wait 500ms between emails (max 120/min)
        // For 'last30' mode: wait 300ms between emails (max 200/min)
        // For normal mode: wait 200ms between emails
        let delayMs = 200;
        if (syncMode === 'all') {
          delayMs = 500;
        } else if (syncMode === 'last30') {
          delayMs = 300;
        }
        
        if (processedCount < messages.length) {
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
        } catch (messageError) {
          console.error(`[import-emails] Error processing message ${messageMeta.id}:`, messageError);
          errorCount++;
          
          // Enhanced rate limit detection and handling
          const errorMessage = messageError instanceof Error ? messageError.message : String(messageError);
          const isRateLimit = errorMessage.toLowerCase().includes('rate_limit') || 
                             errorMessage.toLowerCase().includes('429') ||
                             errorMessage.toLowerCase().includes('too many requests');
          
          if (isRateLimit) {
            console.warn('[import-emails] ⚠️ OpenAI rate limit detected! Pausing for 10 seconds...');
            
            // Add rate limit info to response
            syncedEmails.push({
              error: 'RATE_LIMIT_HIT',
              gmailMessageId: messageMeta.id,
            });
            
            // Wait 10 seconds before continuing
            await new Promise(resolve => setTimeout(resolve, 10000));
          }
        }
      }
      
      console.log(`[import-emails] Sync complete for account ${account.email}: ${processedCount} imported, ${skippedCount} skipped, ${errorCount} errors`);

      await supabase
        .from("gmail_accounts")
        .update({ last_sync_at: new Date().toISOString() })
        .eq("id", account.id);
    } catch (error) {
      console.error(`[import-emails] Sync error for account ${account.id}:`, error);
      syncedEmails.push({
        accountId: account.id,
        error: (error as Error).message,
      });
    }
  }

  // Check if rate limit was hit during processing
  const rateLimitHit = syncedEmails.some(e => e.error === 'RATE_LIMIT_HIT');
  
  return jsonResponse({ 
    syncedEmails,
    rateLimitHit,
    message: rateLimitHit 
      ? '⚠️ OpenAI rate limit reached. Some emails were not processed. Please wait 1 minute and try syncing again.'
      : undefined
  });
});
