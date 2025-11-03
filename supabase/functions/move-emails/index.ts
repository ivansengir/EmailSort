import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/util.ts";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders() });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
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

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders(), "Content-Type": "application/json" } }
      );
    }

    // Verify the target category exists and belongs to the user
    const { data: targetCategory, error: categoryError } = await supabase
      .from("categories")
      .select("id, name")
      .eq("id", targetCategoryId)
      .eq("user_id", user.id)
      .single();

    if (categoryError || !targetCategory) {
      return new Response(
        JSON.stringify({ error: "Target category not found or access denied" }),
        { status: 404, headers: { ...corsHeaders(), "Content-Type": "application/json" } }
      );
    }

    // Get the emails to move (with their current categories)
    const { data: emailsToMove, error: fetchError } = await supabase
      .from("emails")
      .select("id, category_id")
      .in("id", emailIds)
      .eq("user_id", user.id);

    if (fetchError || !emailsToMove) {
      console.error("[move-emails] Error fetching emails:", fetchError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch emails" }),
        { status: 500, headers: { ...corsHeaders(), "Content-Type": "application/json" } }
      );
    }

    if (emailsToMove.length === 0) {
      return new Response(
        JSON.stringify({ error: "No emails found or access denied" }),
        { status: 404, headers: { ...corsHeaders(), "Content-Type": "application/json" } }
      );
    }

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

    // Update emails to new category
    const { error: updateError } = await supabase
      .from("emails")
      .update({ category_id: targetCategoryId })
      .in("id", emailIds)
      .eq("user_id", user.id);

    if (updateError) {
      console.error("[move-emails] Error updating emails:", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to move emails" }),
        { status: 500, headers: { ...corsHeaders(), "Content-Type": "application/json" } }
      );
    }

    // Update category counts (but don't fail if RPC errors occur)
    try {
      // Decrement old categories
      for (const [oldCategoryId, count] of categoryChanges.entries()) {
        for (let i = 0; i < count; i++) {
          const { error: decrementError } = await supabase.rpc("decrement_category_email_count", {
            category_uuid: oldCategoryId,
          });
          if (decrementError) {
            console.error(`[move-emails] Warning: Error decrementing count for ${oldCategoryId}:`, decrementError);
          }
        }
      }

      // Increment new category
      for (let i = 0; i < emailsToMove.length; i++) {
        const { error: incrementError } = await supabase.rpc("increment_category_email_count", {
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
