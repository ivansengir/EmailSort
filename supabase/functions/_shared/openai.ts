// @ts-expect-error - Deno edge function import resolved at deploy time.
import OpenAI from "npm:openai@^4.0.0";
import { requireEnv } from "./util.ts";

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) {
    client = new OpenAI({ apiKey: requireEnv("OPENAI_API_KEY") });
  }
  return client;
}

/**
 * Generic retry wrapper for OpenAI API calls with exponential backoff
 */
async function callOpenAIWithRetry<T>(
  operationName: string,
  operation: () => Promise<T>,
  maxRetries = 3
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 1) {
        const delay = Math.pow(2, attempt - 1) * 1000; // 2s, 4s, 8s
        console.log(`[AI] ${operationName}: Retry attempt ${attempt}/${maxRetries} after ${delay}ms delay...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      console.log(`[AI] ${operationName}: Calling OpenAI API (attempt ${attempt}/${maxRetries})...`);
      const result = await operation();
      console.log(`[AI] ${operationName}: ✓ Success`);
      return result;
      
    } catch (error) {
      lastError = error as Error;
      console.error(`[AI] ${operationName}: Attempt ${attempt}/${maxRetries} failed:`, error);
      
      // Check if it's a rate limit error
      if (error instanceof Error && (
        error.message?.includes('rate_limit') || 
        error.message?.includes('429')
      )) {
        console.log(`[AI] ${operationName}: Rate limit detected, will retry...`);
      }
      
      // If this was the last attempt, throw
      if (attempt === maxRetries) {
        throw new Error(`${operationName} failed after ${maxRetries} attempts: ${lastError?.message}`);
      }
    }
  }

  // Should never reach here, but TypeScript needs it
  throw new Error(`${operationName} failed: ${lastError?.message || 'Unknown error'}`);
}

interface CategorizationPromptInput {
  categories: Array<{ id: string; name: string; description: string }>;
  email: {
    subject: string;
    from: string;
    snippet: string;
    body: string;
  };
}

export async function categorizeEmail(input: CategorizationPromptInput) {
  const completion = await getClient().chat.completions.create({
    model: "gpt-5-mini", // Higher rate limits (200k TPM vs 30k TPM for gpt-5-mini)
    messages: [
      {
        role: "system",
        content:
          "You are an expert email categorization assistant. Analyze the email and choose the BEST matching category. If the email doesn't clearly fit any specific category, choose 'Others'. Be strict: only categorize an email under a specific category if it truly belongs there. Return JSON with keys categoryId, categoryName, confidence (0-100).",
      },
      {
        role: "user",
        content: JSON.stringify(input),
      },
    ],
    response_format: {
      type: "json_schema", // gpt-5-mini supports json_schema for better structure
      json_schema: {
        name: "EmailClassification",
        schema: {
          type: "object",
          properties: {
            categoryId: { type: "string" },
            categoryName: { type: "string" },
            confidence: { type: "number" },
          },
          required: ["categoryId", "categoryName", "confidence"],
          additionalProperties: false,
        },
      },
    },
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new Error("Unexpected categorization response format");
  }

  return JSON.parse(content) as {
    categoryId: string;
    categoryName: string;
    confidence: number;
  };
}

export async function summarizeEmail(subject: string, body: string) {
  const completion = await getClient().chat.completions.create({
    model: "gpt-5-mini", // Also use gpt-5-mini for better quality summaries
    messages: [
      {
        role: "system",
        content:
          "You are an assistant that summarizes emails in neutral tone. Limit to 2 concise sentences and mention key action items if any.",
      },
      {
        role: "user",
        content: JSON.stringify({ subject, body }),
      },
    ],
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new Error("Unexpected summary response format");
  }

  return content.trim();
}

/**
 * OPTIMIZED: Categorize AND summarize in a single OpenAI call
 * Reduces API calls by 50% and processing time significantly
 */
export async function categorizeAndSummarizeEmail(input: CategorizationPromptInput) {
  const completion = await getClient().chat.completions.create({
    model: "gpt-5-mini",
    messages: [
      {
        role: "system",
        content:
          "You are an expert email assistant. Analyze the email and: 1) Choose the BEST matching category (be strict, use 'Others' if uncertain), 2) Create a 2-sentence summary with key action items. Return JSON with categoryId, categoryName, confidence (0-100), and summary.",
      },
      {
        role: "user",
        content: JSON.stringify(input),
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "EmailAnalysis",
        schema: {
          type: "object",
          properties: {
            categoryId: { type: "string" },
            categoryName: { type: "string" },
            confidence: { type: "number" },
            summary: { type: "string" },
          },
          required: ["categoryId", "categoryName", "confidence", "summary"],
          additionalProperties: false,
        },
      },
    },
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new Error("Unexpected response format");
  }

  return JSON.parse(content) as {
    categoryId: string;
    categoryName: string;
    confidence: number;
    summary: string;
  };
}

/**
 * Use AI to extract unsubscribe link from email content
 */
export async function extractUnsubscribeLinkWithAI(
  htmlContent: string | null,
  textContent: string | null
): Promise<{ link: string | null; method: "http" | "mailto" | null }> {
  console.log("[AI] Analyzing email for unsubscribe link...");

  const content = htmlContent || textContent || "";
  
  // Don't truncate - we need the full email to find footer links
  // Most emails are under 100KB anyway
  const emailContent = content.length > 50000 
    ? content.substring(0, 50000) + "...[truncated]" 
    : content;

  console.log("[AI] Email content length:", emailContent.length);

  const completion = await getClient().chat.completions.create({
    model: "gpt-5-mini",
    messages: [
      {
        role: "system",
        content: "You are an expert at finding unsubscribe links in emails. You must find ANY link that allows unsubscribing, in ANY language. Return ONLY the complete URL, nothing else."
      },
      {
        role: "user",
        content: `Analyze this email and find the unsubscribe link. 

The link might be:
- In the footer/bottom of the email
- Associated with text like: "unsubscribe", "opt out", "opt-out", "darse de baja", "cancelar suscripción", "manage preferences", "gestionar preferencias", "configuración", "settings", "preferences"
- A "mailto:" link for unsubscribe
- ANY link that clearly allows the user to stop receiving emails

EMAIL CONTENT:
${emailContent}

CRITICAL: Return ONLY the complete URL (including https:// or mailto:) or exactly "NO_LINK" if absolutely no unsubscribe method exists.
Do not add any explanation, just the URL.`
      }
    ],
    temperature: 1,
    max_completion_tokens: 300,
  });

  const result = completion.choices[0]?.message?.content?.trim() || "NO_LINK";
  console.log("[AI] Raw AI response:", result);
  console.log("[AI] First 200 chars of email content:", emailContent.substring(0, 200));

  if (result === "NO_LINK" || result.includes("NO_LINK")) {
    console.log("[AI] ❌ AI couldn't find any unsubscribe link");
    return { link: null, method: null };
  }

  // Extract URL from response (in case AI added extra text)
  const urlMatch = result.match(/(https?:\/\/[^\s<>"']+|mailto:[^\s<>"']+)/i);
  const link = urlMatch ? urlMatch[1] : result.trim();

  const method = link.startsWith("mailto:") ? "mailto" : "http";
  
  console.log("[AI] ✓ Found link:", link, "method:", method);
  return { link, method };
}

/**
 * Use AI to analyze an unsubscribe page and determine next action
 */
export async function analyzeUnsubscribePageWithAI(
  pageUrl: string,
  pageHtml: string
): Promise<{
  needsAction: boolean;
  actionType: "success" | "form" | "captcha" | "login" | "unknown";
  formData?: Record<string, string>;
  message: string;
}> {
  console.log("[AI] Analyzing unsubscribe page:", pageUrl);

  // Truncate HTML to save tokens
  const truncatedHtml = pageHtml.length > 12000 
    ? pageHtml.substring(0, 12000) + "...[truncated]" 
    : pageHtml;

  const htmlLength = truncatedHtml.length;
  console.log(`[AI] HTML length: ${htmlLength} characters (${Math.ceil(htmlLength / 4)} estimated tokens)`);

  const completion = await callOpenAIWithRetry("Analyze Unsubscribe Page", async () => {
    const completion = await getClient().chat.completions.create({
      model: "gpt-5-mini",
      messages: [
        {
          role: "system",
          content: "You are a web page analyzer. Return only valid JSON with the analysis."
        },
        {
          role: "user",
          content: `Analyze this unsubscribe page and determine the status:

Page URL: ${pageUrl}

Page HTML:
${truncatedHtml}

Respond in this exact JSON format:
{
  "status": "success" | "needs_form" | "needs_captcha" | "needs_login" | "unknown",
  "confidence": "high" | "medium" | "low",
  "message": "Brief explanation"
}

Guidelines:
- "success": Page confirms unsubscribe is complete ("successfully unsubscribed", "you have been removed", "confirmado", "éxito")
- "needs_form": Page has a simple form that needs a button click
- "needs_captcha": Page requires CAPTCHA
- "needs_login": Page requires authentication  
- "unknown": Cannot determine

Return only JSON.`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 1,
      max_completion_tokens: 300,
    });

    const result = completion.choices[0]?.message?.content;
    
    if (!result) {
      // Log detailed error info
      console.error("[AI] Empty response from OpenAI:", {
        choices: completion.choices?.length || 0,
        finishReason: completion.choices[0]?.finish_reason,
        usage: completion.usage
      });
      throw new Error("No response from AI - empty content");
    }

    console.log("[AI] ✓ Page analysis response:", result);
    return result;
  });

  return parseAnalysisResult(completion);
}

// Helper function to parse the analysis result
function parseAnalysisResult(result: string) {

  const analysis = JSON.parse(result);
  
  const needsAction = analysis.status !== "success";
  
  let actionType: "success" | "form" | "captcha" | "login" | "unknown";
  switch (analysis.status) {
    case "success":
      actionType = "success";
      break;
    case "needs_form":
      actionType = "form";
      break;
    case "needs_captcha":
      actionType = "captcha";
      break;
    case "needs_login":
      actionType = "login";
      break;
    default:
      actionType = "unknown";
  }

  console.log("[AI] ✓ Analysis complete:", actionType, "confidence:", analysis.confidence);

  return {
    needsAction,
    actionType,
    message: analysis.message || "Analysis complete"
  };
}

/**
 * Use AI to extract form data from HTML for auto-submission
 */
export async function extractFormDataWithAI(pageHtml: string): Promise<Record<string, string>> {
  console.log("[AI] Extracting form data...");

  const truncatedHtml = pageHtml.length > 10000 
    ? pageHtml.substring(0, 10000) + "...[truncated]" 
    : pageHtml;

  const completion = await getClient().chat.completions.create({
    model: "gpt-5-mini",
    messages: [
      {
        role: "system",
        content: "You are an HTML form analyzer. Extract form fields that can be auto-filled. Return only valid JSON."
      },
      {
        role: "user",
        content: `Extract form data from this HTML needed to submit an unsubscribe form:

${truncatedHtml}

Return JSON with key-value pairs for all hidden inputs and auto-fillable fields.
Only include fields that don't require user input.

Format: { "field_name": "field_value" }

Return only JSON.`
      }
    ],
    response_format: { type: "json_object" },
    temperature: 1,
    max_completion_tokens: 500,
  });

  const result = completion.choices[0]?.message?.content;
  if (!result) {
    return {};
  }

  const formData = JSON.parse(result);
  console.log("[AI] ✓ Extracted form data:", Object.keys(formData).length, "fields");
  
  return formData;
}
