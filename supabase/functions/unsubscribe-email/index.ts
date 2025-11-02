// deno-lint-ignore-file no-explicit-any
// @ts-expect-error - Deno std import available at runtime.
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { getServiceClient, getUserFromAuthHeader, jsonResponse, errorResponse, corsHeaders } from "../_shared/util.ts";
import { attemptUnsubscribe } from "../_shared/unsubscribe.ts";

interface RequestPayload {
  emailId: string;
}

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
    console.error("[unsubscribe-email] Auth error:", error);
    return errorResponse("Unauthorized", 401);
  }

  console.log("[unsubscribe-email] Auth user:", authUser.id);

  // Get public.users record
  const { data: user, error: userError } = await supabase
    .from("users")
    .select("id")
    .eq("auth_id", authUser.id)
    .maybeSingle();

  if (userError || !user) {
    console.error("[unsubscribe-email] Failed to find user:", userError);
    return errorResponse("User not found", 404);
  }

  console.log("[unsubscribe-email] Public user ID:", user.id);

  const payload = (await req.json().catch(() => null)) as RequestPayload | null;
  if (!payload?.emailId) {
    return errorResponse("Missing emailId", 400);
  }

  const { data: email, error: emailError } = await supabase
    .from("emails")
    .select("id, content_text, content_html")
    .eq("id", payload.emailId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (emailError) {
    console.error("[unsubscribe-email] Failed to fetch email:", emailError);
    return errorResponse("Failed to fetch email", 500);
  }

  if (!email) {
    console.error("[unsubscribe-email] Email not found:", payload.emailId);
    return errorResponse("Email not found", 404);
  }

  console.log("[unsubscribe-email] Attempting unsubscribe for email:", email.id);
  console.log("[unsubscribe-email] Email content lengths - HTML:", email.content_html?.length || 0, "Text:", email.content_text?.length || 0);
  console.log("[unsubscribe-email] First 500 chars of HTML:", email.content_html?.substring(0, 500));
  const attempt = await attemptUnsubscribe(email.content_html, email.content_text);
  console.log("[unsubscribe-email] Unsubscribe result:", attempt.status, attempt.method, "target:", attempt.target);

  const { error: logError, data: logRecord } = await supabase
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
    })
    .select()
    .single();

  if (logError) {
    console.error("[unsubscribe-email] Failed to log unsubscribe attempt:", logError);
  }

  console.log("[unsubscribe-email] ✓ Unsubscribe completed:", attempt.status, "target:", attempt.target);
  return jsonResponse({ attempt, log: logRecord });
});
