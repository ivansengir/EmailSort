// Edge Function para agregar cuentas adicionales de Gmail
// @ts-expect-error - Deno std import available at runtime.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { getServiceClient, getUserFromAuthHeader, jsonResponse, errorResponse, corsHeaders } from "../_shared/util.ts";

serve(async (req: Request) => {
  console.log("[add-gmail-account] Request received:", req.method);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    console.log("[add-gmail-account] Handling OPTIONS preflight");
    return new Response(null, { 
      status: 200,
      headers: corsHeaders() 
    });
  }

  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

  const supabase = getServiceClient();
  let user;

  try {
    console.log("[add-gmail-account] Authenticating user...");
    user = await getUserFromAuthHeader(supabase, req);
    console.log("[add-gmail-account] User authenticated:", user.id);
  } catch (error) {
    console.error("[add-gmail-account] Auth error:", error);
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

  interface AddAccountBody {
    email: string;
    accessToken: string;
    refreshToken: string;
    expiresIn?: number;
  }

  const body = (await req.json().catch(() => ({}))) as AddAccountBody;
  const { email, accessToken, refreshToken, expiresIn } = body;

  if (!email || !accessToken || !refreshToken) {
    return errorResponse("Missing required fields: email, accessToken, refreshToken", 400);
  }

  console.log("[add-gmail-account] Adding account:", email);

  // Get the database user ID
  const { data: dbUser, error: userError } = await supabase
    .from('users')
    .select('id')
    .eq('auth_id', user.id)
    .single();

  if (userError || !dbUser) {
    console.error("[add-gmail-account] User lookup error:", userError);
    return errorResponse("User not found in database", 404);
  }

  const tokenExpiry = expiresIn
    ? new Date(Date.now() + expiresIn * 1000).toISOString()
    : null;

  // Check if this email is already connected for this user
  const { data: existingAccount } = await supabase
    .from('gmail_accounts')
    .select('id')
    .eq('user_id', dbUser.id)
    .eq('email', email)
    .maybeSingle();

  if (existingAccount) {
    // Update existing account
    const { error: updateError } = await supabase
      .from('gmail_accounts')
      .update({
        oauth_token: accessToken,
        oauth_refresh_token: refreshToken,
        token_expires_at: tokenExpiry,
      })
      .eq('id', existingAccount.id);

    if (updateError) {
      console.error("[add-gmail-account] Update error:", updateError);
      return errorResponse("Failed to update account", 500);
    }

    console.log("[add-gmail-account] Account updated:", email);
    return jsonResponse({ 
      message: "Gmail account updated successfully",
      email,
      accountId: existingAccount.id,
    });
  }

  // Insert new account
  const { data: newAccount, error: insertError } = await supabase
    .from('gmail_accounts')
    .insert({
      user_id: dbUser.id,
      email: email,
      oauth_token: accessToken,
      oauth_refresh_token: refreshToken,
      token_expires_at: tokenExpiry,
      is_primary: false, // Additional accounts are never primary
    })
    .select()
    .single();

  if (insertError) {
    console.error("[add-gmail-account] Insert error:", insertError);
    return errorResponse("Failed to add Gmail account", 500);
  }

  console.log("[add-gmail-account] Account added:", email);
  return jsonResponse({ 
    message: "Gmail account added successfully",
    email,
    accountId: newAccount.id,
  });
});
