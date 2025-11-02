// deno-lint-ignore-file no-explicit-any
// @ts-expect-error - Deno std import available at runtime.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { getServiceClient, getUserFromAuthHeader, jsonResponse, errorResponse, corsHeaders } from "../_shared/util.ts";
import { refreshGmailAccessToken, listRecentMessages } from "../_shared/gmail.ts";

serve(async (req: Request) => {
  console.log("[test-gmail] Request received:", req.method);
  
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders() });
  }

  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

  const supabase = getServiceClient();
  let user;
  let dbUserId: string;

  try {
    user = await getUserFromAuthHeader(supabase, req);
    console.log("[test-gmail] Auth user ID (auth.users):", user.id);
    
    // Get the user from the public.users table
    const { data: dbUser, error: userError } = await supabase
      .from("users")
      .select("id, email")
      .eq("auth_id", user.id)
      .single();
    
    if (userError || !dbUser) {
      console.error("[test-gmail] User not found in users table:", userError);
      return errorResponse("User profile not found in database", 500);
    }
    
    dbUserId = dbUser.id;
    console.log("[test-gmail] DB User ID (public.users):", dbUserId);
  } catch (error) {
    console.error("[test-gmail] Auth error:", error);
    return errorResponse("Unauthorized", 401);
  }

  try {
    // Get user's Gmail accounts
    const { data: accounts, error: accountsError } = await supabase
      .from("gmail_accounts")
      .select("*")
      .eq("user_id", dbUserId)
      .order("created_at", { ascending: true });

    if (accountsError) {
      console.error("[test-gmail] Error fetching accounts:", accountsError);
      return errorResponse("Failed to load Gmail accounts", 500);
    }
    
    console.log("[test-gmail] Found accounts:", accounts?.length || 0);

    if (!accounts || accounts.length === 0) {
      return jsonResponse({ message: "No Gmail accounts found" });
    }

    const account = accounts[0];
    console.log("[test-gmail] Testing account:", account.email);
    console.log("[test-gmail] Has token:", !!account.oauth_token);
    console.log("[test-gmail] Has refresh token:", !!account.oauth_refresh_token);
    console.log("[test-gmail] Token expires at:", account.token_expires_at);

    // Check if token needs refresh
    let accessToken = account.oauth_token;
    const refreshToken = account.oauth_refresh_token;
    const expiresAt = account.token_expires_at ? new Date(account.token_expires_at) : null;
    const now = new Date();

    if (!accessToken || !refreshToken) {
      return errorResponse("Account is missing OAuth credentials", 400);
    }

    if (!expiresAt || expiresAt <= now) {
      console.log("[test-gmail] Token expired, refreshing...");
      try {
        const refreshed = await refreshGmailAccessToken(refreshToken);
        accessToken = refreshed.accessToken;
        console.log("[test-gmail] Token refreshed successfully");
      } catch (refreshError: any) {
        console.error("[test-gmail] Token refresh failed:", refreshError);
        return errorResponse(`Token refresh failed: ${refreshError.message}`, 500);
      }
    }

    // Test different queries
    const queries = [
      "in:inbox",
      "is:unread",
      "-in:spam -in:trash",
    ];

    const results: any = {};

    for (const query of queries) {
      try {
        console.log(`[test-gmail] Testing query: ${query}`);
        const list = await listRecentMessages(accessToken, query);
        results[query] = {
          messageCount: list.messages?.length || 0,
          hasNextPage: !!list.nextPageToken,
          firstMessageIds: list.messages?.slice(0, 5).map(m => m.id) || []
        };
        console.log(`[test-gmail] Query "${query}" returned ${results[query].messageCount} messages`);
      } catch (queryError: any) {
        console.error(`[test-gmail] Query "${query}" failed:`, queryError);
        results[query] = {
          error: queryError.message
        };
      }
    }

    return jsonResponse({
      account: {
        email: account.email,
        lastSync: account.last_sync_at,
        tokenExpires: account.token_expires_at,
      },
      queries: results,
      success: true
    });

  } catch (error: any) {
    console.error("[test-gmail] Unexpected error:", error);
    return errorResponse(error.message || "Unknown error", 500);
  }
});
