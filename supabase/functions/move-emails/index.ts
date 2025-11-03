import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/util.ts";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders() });
  }

  try {
    // Create two clients: one for auth (with user token), one for admin operations
    const authClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { emailIds, targetCategoryId } = await req.json();

    if (!emailIds || !Array.isArray(emailIds) || emailIds.length === 0) {
      return new Response(
        JSON.stringify({ error: "emailIds array is required" }),
        { status: 400, headers: { ...corsHeaders(), "Content-Type": "application/json" } }
      );
    }

    if (!targetCategoryId) {
      return new Response(
        JSON.stringify({ error: "targetCategoryId is required" }),
        { status: 400, headers: { ...corsHeaders(), "Content-Type": "application/json" } }
      );
    }

    console.log(`[move-emails] Moving ${emailIds.length} emails to category ${targetCategoryId}`);

    // Get current user (using auth client with user's token)
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) {
      console.error("[move-emails] No user found in auth");
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders(), "Content-Type": "application/json" } }
      );
    }
    console.log(`[move-emails] User authenticated: ${user.id}`);

    // Verify the target category exists and belongs to the user (using admin client)
    const { data: targetCategory, error: categoryError } = await adminClient
      .from("categories")
      .select("id, name, user_id")
      .eq("id", targetCategoryId)
      .maybeSingle();

    if (categoryError) {
      console.error("[move-emails] Error fetching category:", categoryError);
      return new Response(
        JSON.stringify({ error: "Error fetching category", details: categoryError.message }),
        { status: 500, headers: { ...corsHeaders(), "Content-Type": "application/json" } }
      );
    }

    if (!targetCategory) {
      console.error("[move-emails] Category not found:", targetCategoryId);
      return new Response(
        JSON.stringify({ error: "Target category not found" }),
        { status: 404, headers: { ...corsHeaders(), "Content-Type": "application/json" } }
      );
    }

    if (targetCategory.user_id !== user.id) {
      console.error("[move-emails] Category belongs to different user");
      return new Response(
        JSON.stringify({ error: "Access denied to target category" }),
        { status: 403, headers: { ...corsHeaders(), "Content-Type": "application/json" } }
      );
    }
    
    console.log(`[move-emails] Target category found: ${targetCategory.name}`);

    // Get the emails to move (with their current categories) (using admin client)
    console.log(`[move-emails] Fetching emails:`, emailIds);
    const { data: emailsToMove, error: fetchError } = await adminClient
      .from("emails")
      .select("id, category_id")
      .in("id", emailIds)
      .eq("user_id", user.id);

    if (fetchError) {
      console.error("[move-emails] Error fetching emails:", fetchError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch emails", details: fetchError.message }),
        { status: 500, headers: { ...corsHeaders(), "Content-Type": "application/json" } }
      );
    }

    if (!emailsToMove || emailsToMove.length === 0) {
      console.error("[move-emails] No emails found:", { emailIds, userId: user.id });
      return new Response(
        JSON.stringify({ error: "No emails found or access denied" }),
        { status: 404, headers: { ...corsHeaders(), "Content-Type": "application/json" } }
      );
    }
    console.log(`[move-emails] Found ${emailsToMove.length} emails to move`);

    // Count how many emails are being moved from each category
    const categoryChanges = new Map<string, number>();
    for (const email of emailsToMove) {
      if (email.category_id) {
        categoryChanges.set(
          email.category_id,
          (categoryChanges.get(email.category_id) || 0) + 1
        );
      }
    }

    // Update emails to new category (using admin client to bypass RLS)
    console.log(`[move-emails] Updating emails to category ${targetCategoryId}`);
    const { error: updateError } = await adminClient
      .from("emails")
      .update({ category_id: targetCategoryId })
      .in("id", emailIds)
      .eq("user_id", user.id);

    if (updateError) {
      console.error("[move-emails] Error updating emails:", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to move emails", details: updateError.message }),
        { status: 500, headers: { ...corsHeaders(), "Content-Type": "application/json" } }
      );
    }
    console.log(`[move-emails] Emails updated successfully`);

    // Update category counts (but don't fail if RPC errors occur)
    try {
      // Decrement old categories (using admin client)
      for (const [oldCategoryId, count] of categoryChanges.entries()) {
        for (let i = 0; i < count; i++) {
          const { error: decrementError } = await adminClient.rpc("decrement_category_email_count", {
            category_uuid: oldCategoryId,
          });
          if (decrementError) {
            console.error(`[move-emails] Warning: Error decrementing count for ${oldCategoryId}:`, decrementError);
          }
        }
      }

      // Increment new category (using admin client)
      for (let i = 0; i < emailsToMove.length; i++) {
        const { error: incrementError } = await adminClient.rpc("increment_category_email_count", {
          category_uuid: targetCategoryId,
        });
        if (incrementError) {
          console.error(`[move-emails] Warning: Error incrementing count for ${targetCategoryId}:`, incrementError);
        }
      }
    } catch (rpcError) {
      // Log but don't fail - counts can be recalculated later
      console.error(`[move-emails] Warning: RPC error updating counts:`, rpcError);
    }

    console.log(`[move-emails] ✓ Successfully moved ${emailsToMove.length} emails to ${targetCategory.name}`);

    return new Response(
      JSON.stringify({
        success: true,
        movedCount: emailsToMove.length,
        targetCategory: targetCategory.name,
      }),
      { status: 200, headers: { ...corsHeaders(), "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[move-emails] Unexpected error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ 
        error: "Internal server error",
        details: errorMessage 
      }),
      { status: 500, headers: { ...corsHeaders(), "Content-Type": "application/json" } }
    );
  }
});
