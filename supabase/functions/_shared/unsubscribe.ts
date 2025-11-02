import { jsonResponse } from "./util.ts";
import { 
  extractUnsubscribeLinkWithAI, 
  analyzeUnsubscribePageWithAI,
  extractFormDataWithAI 
} from "./openai.ts";

type UnsubscribeMethod = "http" | "mailto" | "form-auto" | "ai-auto" | "manual" | "unknown";

export type UnsubscribeAttempt =
  | { status: "success"; method: "http" | "form-auto" | "ai-auto"; target: string }
  | { status: "error"; method: UnsubscribeMethod; target: string | null; error: string };

/**
 * Attempt to automatically submit a form using AI-extracted data
 */
async function attemptAIFormSubmit(pageUrl: string, pageHtml: string): Promise<boolean> {
  console.log("[unsubscribe] Attempting AI-guided form submission...");
  
  try {
    // Use AI to extract form data
    const formData = await extractFormDataWithAI(pageHtml);
    
    if (Object.keys(formData).length === 0) {
      console.log("[unsubscribe] No form data extracted by AI");
      return false;
    }

    console.log("[unsubscribe] AI extracted form fields:", Object.keys(formData));

    // Try to find form action
    const formMatch = /<form[^>]*action=["']([^"']*)["']/i.exec(pageHtml);
    if (!formMatch) {
      console.log("[unsubscribe] No form action found");
      return false;
    }

    const formAction = formMatch[1];
    const actionUrl = formAction.startsWith('http') 
      ? formAction 
      : new URL(formAction, pageUrl).href;

    console.log("[unsubscribe] Submitting to:", actionUrl);

    // Submit the form
    const formParams = new URLSearchParams(formData);
    
    // Add common confirmation parameters
    formParams.append('confirm', '1');
    formParams.append('confirmed', 'yes');
    formParams.append('unsubscribe', 'true');
    
    const response = await fetch(actionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      body: formParams.toString(),
      redirect: 'follow'
    });

    console.log("[unsubscribe] Form submission response:", response.status);

    if (response.ok) {
      const responseText = await response.text();
      
      // Use AI to analyze the response
      const analysis = await analyzeUnsubscribePageWithAI(response.url || actionUrl, responseText);
      
      if (analysis.actionType === "success") {
        console.log("[unsubscribe] ✓ AI-guided form submitted successfully!");
        return true;
      }
    }
  } catch (error) {
    console.error("[unsubscribe] AI form submit failed:", error);
  }

  return false;
}

export async function attemptUnsubscribe(html: string | null, text: string | null): Promise<UnsubscribeAttempt> {
  console.log("[unsubscribe] 🤖 Starting AI-powered unsubscribe...");

  // STEP 1: Use AI to find the unsubscribe link
  const { link, method } = await extractUnsubscribeLinkWithAI(html, text);

  if (!link) {
    console.log("[unsubscribe] ❌ AI couldn't find any unsubscribe link");
    return {
      status: "error",
      method: "unknown",
      target: null,
      error: "No unsubscribe link found in email"
    };
  }

  if (method === "mailto") {
    console.log("[unsubscribe] ❌ Mailto link found, cannot auto-send emails");
    return {
      status: "error",
      method: "mailto",
      target: link,
      error: "Mailto links require manual email sending"
    };
  }

  console.log("[unsubscribe] ✓ AI found link:", link);

  // STEP 2: Try to access the unsubscribe page
  try {
    console.log("[unsubscribe] 📄 Fetching unsubscribe page...");
    const response = await fetch(link, {
      method: "GET",
      redirect: "follow",
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!response.ok) {
      return {
        status: "error",
        method: "http",
        target: link,
        error: `Unsubscribe page responded with status ${response.status}`
      };
    }

    const pageHtml = await response.text();
    const finalUrl = response.url || link;

    console.log("[unsubscribe] ✓ Page loaded, analyzing with AI...");

    // STEP 3: Use AI to analyze the page
    const analysis = await analyzeUnsubscribePageWithAI(finalUrl, pageHtml);

    console.log("[unsubscribe] AI analysis:", analysis.actionType, "-", analysis.message);

    // STEP 4: Handle based on AI analysis
    switch (analysis.actionType) {
      case "success":
        console.log("[unsubscribe] ✅ AI confirms: Unsubscribe successful!");
        return {
          status: "success",
          method: "http",
          target: finalUrl
        };

      case "form":
        {
          console.log("[unsubscribe] 📝 AI detected form, checking MCP server availability...");
          
          // Try MCP server first (for complex interactions like radio buttons)
          const mcpServerUrl = Deno.env.get("MCP_SERVER_URL");
          
          if (mcpServerUrl) {
            try {
              console.log("[unsubscribe] 🤖 Calling MCP server for automated interaction...");
              console.log("[unsubscribe] ⏱ This may take 30-90 seconds on first request (server wake-up + browser launch)...");
              const mcpResponse = await fetch(`${mcpServerUrl}/unsubscribe`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: finalUrl }),
                signal: AbortSignal.timeout(90000) // 90 second timeout (allows for Render cold start + Puppeteer)
              });
              
              if (mcpResponse.ok) {
                const mcpResult = await mcpResponse.json();
                console.log("[unsubscribe] MCP result:", mcpResult);
                
                if (mcpResult.success) {
                  console.log("[unsubscribe] ✅ MCP server successfully automated the unsubscribe!");
                  return {
                    status: "success",
                    method: "ai-auto",
                    target: finalUrl
                  };
                }
              } else {
                console.log("[unsubscribe] ⚠ MCP server returned error:", mcpResponse.status);
              }
            } catch (mcpError) {
              console.error("[unsubscribe] ⚠ MCP server unavailable:", mcpError);
              // Fall through to traditional form submit
            }
          } else {
            console.log("[unsubscribe] ℹ MCP_SERVER_URL not configured, falling back to basic form submit");
          }
          
          // Fallback: Try basic form submission
          const formSubmitted = await attemptAIFormSubmit(finalUrl, pageHtml);
          
          if (formSubmitted) {
            console.log("[unsubscribe] ✅ AI successfully submitted the form!");
            return {
              status: "success",
              method: "ai-auto",
              target: finalUrl
            };
          }
          
          console.log("[unsubscribe] ❌ AI couldn't auto-submit form");
          return {
            status: "error",
            method: "form-auto",
            target: finalUrl,
            error: "Form detected but requires manual submission"
          };
        }

      case "captcha":
        {
          console.log("[unsubscribe] ❌ CAPTCHA detected, cannot automate");
          return {
            status: "error",
            method: "manual",
            target: finalUrl,
            error: "Page requires CAPTCHA verification"
          };
        }

      case "login":
        {
          console.log("[unsubscribe] ❌ Login required, cannot automate");
          return {
            status: "error",
            method: "manual",
            target: finalUrl,
            error: "Page requires authentication"
          };
        }

      default:
        {
          console.log("[unsubscribe] ❌ AI couldn't determine page status");
          return {
            status: "error",
            method: "unknown",
            target: finalUrl,
            error: "Could not determine unsubscribe status automatically"
          };
        }
    }

  } catch (error) {
    console.error("[unsubscribe] Error:", error);
    return {
      status: "error",
      method: "http",
      target: link,
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
}

export function buildUnsubscribeResponse(attempt: UnsubscribeAttempt) {
  return jsonResponse({ attempt });
}
