// deno-lint-ignore-file no-explicit-any
// @ts-expect-error - Deno std import available at runtime.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { getServiceClient, getUserFromAuthHeader, jsonResponse, errorResponse, corsHeaders } from "../_shared/util.ts";
import { refreshGmailAccessToken, moveMessageToTrash, archiveMessage } from "../_shared/gmail.ts";

serve(async (req: Request) => {
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
    console.error("[test-bulk] Auth error:", error);
    return errorResponse("Unauthorized", 401);
  }

  console.log("[test-bulk] Auth user:", authUser.id);

  // Get public.users record
  const { data: user, error: userError } = await supabase
    .from("users")
    .select("id")
    .eq("auth_id", authUser.id)
    .maybeSingle();

  if (userError || !user) {
    console.error("[test-bulk] Failed to find user:", userError);
    return errorResponse("User not found", 404);
  }

  console.log("[test-bulk] Public user ID:", user.id);

  // Get user's emails
  const { data: emails, error: emailError } = await supabase
    .from("emails")
    .select("id, gmail_message_id, gmail_account_id, subject, is_deleted")
    .eq("user_id", user.id)
    .eq("is_deleted", false)
    .limit(1);

  if (emailError) {
    console.error("[test-bulk] Failed to fetch emails:", emailError);
    return errorResponse("Failed to fetch emails", 500);
  }

  if (!emails || emails.length === 0) {
    return jsonResponse({ message: "No emails found to test" });
  }

  const email = emails[0];
  console.log("[test-bulk] Testing with email:", email.id, email.subject);

  // Get Gmail account
  const { data: account, error: accountError } = await supabase
    .from("gmail_accounts")
    .select("id, oauth_token, oauth_refresh_token, token_expires_at")
    .eq("id", email.gmail_account_id)
    .single();

  if (accountError || !account) {
    console.error("[test-bulk] Failed to fetch Gmail account:", accountError);
    return errorResponse("Failed to fetch Gmail account", 500);
  }

  console.log("[test-bulk] Gmail account:", account.id);

  let accessToken = account.oauth_token as string | null;
  const refreshToken = account.oauth_refresh_token as string | null;
  const expiresAt = account.token_expires_at ? new Date(account.token_expires_at) : null;
  const now = new Date();

  if (!accessToken || !refreshToken) {
    return errorResponse("Account missing tokens", 400);
  }

  // Refresh token if expired
  if (!expiresAt || expiresAt <= now) {
    console.log("[test-bulk] Token expired, refreshing...");
    try {
      const refreshed = await refreshGmailAccessToken(refreshToken);
      accessToken = refreshed.accessToken;
      const { error: updateError } = await supabase
        .from("gmail_accounts")
        .update({ 
          oauth_token: accessToken, 
          token_expires_at: new Date(Date.now() + refreshed.expiresIn * 1000).toISOString() 
        })
        .eq("id", account.id);
      if (updateError) {
        console.error("[test-bulk] Failed to persist refreshed token:", updateError);
      }
      console.log("[test-bulk] Token refreshed successfully");
    } catch (error) {
      console.error("[test-bulk] Token refresh failed:", error);
      return errorResponse("Token refresh failed", 500);
    }
  }

  // Test 1: Archive message in Gmail
  console.log("[test-bulk] Test 1: Archiving message in Gmail...");
  try {
    await archiveMessage(accessToken as string, email.gmail_message_id);
    console.log("[test-bulk] ✓ Archive successful");
  } catch (error) {
    console.error("[test-bulk] ✗ Archive failed:", error);
    return jsonResponse({ 
      test: "archive",
      status: "failed", 
      error: (error as Error).message 
    });
  }

  // Test 2: Move message to trash in Gmail
  console.log("[test-bulk] Test 2: Moving message to trash in Gmail...");
  try {
    await moveMessageToTrash(accessToken as string, email.gmail_message_id);
    console.log("[test-bulk] ✓ Move to trash successful");
  } catch (error) {
    console.error("[test-bulk] ✗ Move to trash failed:", error);
    return jsonResponse({ 
      test: "trash",
      status: "failed", 
      error: (error as Error).message 
    });
  }

  // Test 3: Update database
  console.log("[test-bulk] Test 3: Updating database...");
  const { error: updateError } = await supabase
    .from("emails")
    .update({ is_deleted: true })
    .eq("id", email.id);

  if (updateError) {
    console.error("[test-bulk] ✗ Database update failed:", updateError);
    return jsonResponse({ 
      test: "database",
      status: "failed", 
      error: updateError.message 
    });
  }

  console.log("[test-bulk] ✓ Database update successful");

  return jsonResponse({
    status: "success",
    message: "All tests passed",
    userId: user.id,
    email: {
      id: email.id,
      subject: email.subject,
      gmail_message_id: email.gmail_message_id
    }
  });
});
