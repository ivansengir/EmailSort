#!/usr/bin/env node

import 'dotenv/config';
import express from 'express';
import puppeteer, { Browser } from "puppeteer";
import OpenAI from "openai";

const app = express();
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

let browser: Browser | null = null;

/**
 * Use OpenAI to analyze the page and decide what action to take
 */
async function analyzePageWithAI(pageHtml: string, pageText: string): Promise<{
  action: 'success' | 'click_button' | 'select_option' | 'fill_form' | 'captcha' | 'login' | 'unknown';
  selector?: string;
  value?: string;
  message: string;
}> {
  try {
    // Extract relevant HTML structure (buttons, forms, inputs)
    const htmlContext = pageHtml
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove scripts
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '') // Remove styles
      .substring(0, 8000); // Limit size

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an AI that analyzes unsubscribe pages and determines what action to take.

Your task:
1. Determine if the page already shows success (user is unsubscribed)
2. If not, identify what needs to be clicked/selected to unsubscribe
3. Provide a CSS selector for the element to interact with

You must respond with a JSON object in this exact format:
{
  "action": "success" | "click_button" | "select_option" | "fill_form" | "captcha" | "login" | "unknown",
  "selector": "CSS selector of element to interact with (if applicable)",
  "value": "value to select/enter (if applicable)",
  "message": "explanation of what was found"
}`
        },
        {
          role: "user",
          content: `Analyze this unsubscribe page and respond with a JSON object:

PAGE TEXT:
${pageText.substring(0, 2000)}

HTML STRUCTURE:
${htmlContext}

What action should be taken? Respond in JSON format.`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.1
    });

    const result = JSON.parse(completion.choices[0].message.content || '{"action": "unknown", "message": "No response"}');
    
    console.log('[Server] AI Decision:', result);
    
    return {
      action: result.action || 'unknown',
      selector: result.selector,
      value: result.value,
      message: result.message || "Unknown"
    };
  } catch (error) {
    console.error('[Server] AI analysis error:', error);
    return {
      action: 'unknown',
      message: 'AI analysis failed'
    };
  }
}

/**
 * Quick check if page shows success (for after form submission)
 */
async function checkSuccessWithAI(pageText: string): Promise<{
  isSuccess: boolean;
  message: string;
}> {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are analyzing a webpage to determine if an email unsubscribe action was successful. Look for confirmation messages, success indicators, or error messages. Respond with a JSON object."
        },
        {
          role: "user",
          content: `Analyze this webpage content and determine if the unsubscribe was successful:\n\n${pageText.substring(0, 3000)}\n\nRespond with a JSON object: { "success": true/false, "reason": "explanation" }`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.1
    });

    const result = JSON.parse(completion.choices[0].message.content || '{"success": false, "reason": "No response"}');
    
    return {
      isSuccess: result.success === true,
      message: result.reason || "Unknown"
    };
  } catch (error) {
    console.error('[Server] AI success check error:', error);
    return {
      isSuccess: false,
      message: 'AI analysis failed'
    };
  }
}

async function getBrowser(): Promise<Browser> {
  if (!browser) {
    console.log("[Server] Launching browser...");
    browser = await puppeteer.launch({
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--disable-extensions'
      ]
    });
  }
  return browser;
}

async function autoUnsubscribe(url: string): Promise<{
  success: boolean;
  method: string;
  message: string;
}> {
  console.log(`[Server] Starting AI-guided auto-unsubscribe for: ${url}`);
  
  const browser = await getBrowser();
  const page = await browser.newPage();
  
  try {
    await page.setViewport({ width: 1280, height: 720 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    console.log(`[Server] Navigating to: ${url}`);
    await page.goto(url, { 
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });
    
    // Wait for page to stabilize
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Get page content for AI analysis
    let pageHtml: string;
    let pageText: string;
    
    try {
      pageHtml = await page.content();
      pageText = await page.evaluate(() => document.body.innerText);
    } catch {
      console.error('[Server] ❌ Failed to get page content');
      return {
        success: false,
        method: 'unknown',
        message: 'Failed to analyze page content'
      };
    }
    
    console.log('[Server] 🤖 Asking AI to analyze the page...');
    const aiDecision = await analyzePageWithAI(pageHtml, pageText);
    
    console.log(`[Server] AI Decision: ${aiDecision.action} - ${aiDecision.message}`);
    
    // Handle AI decision
    switch (aiDecision.action) {
      case 'success':
        console.log('[Server] ✅ Page already shows success!');
        return {
          success: true,
          method: 'direct-link',
          message: aiDecision.message
        };
      
      case 'click_button':
      case 'select_option':
        if (!aiDecision.selector) {
          return {
            success: false,
            method: 'ai-auto',
            message: 'AI found action but no selector provided'
          };
        }
        
        console.log(`[Server] 🖱️ AI says: ${aiDecision.action} on selector: ${aiDecision.selector}`);
        
        try {
          // Wait for element and click it
          await page.waitForSelector(aiDecision.selector, { timeout: 5000 });
          
          if (aiDecision.action === 'select_option' && aiDecision.value) {
            // Select a specific option (radio button, checkbox, dropdown)
            await page.evaluate((selector, value) => {
              const element = document.querySelector(selector) as HTMLInputElement | HTMLSelectElement;
              if (element) {
                if (element.tagName === 'SELECT') {
                  element.value = value;
                } else if (element.type === 'radio' || element.type === 'checkbox') {
                  element.checked = true;
                }
                element.dispatchEvent(new Event('change', { bubbles: true }));
              }
            }, aiDecision.selector, aiDecision.value);
          } else {
            // Simple click
            await page.click(aiDecision.selector);
          }
          
          console.log('[Server] ✓ Element clicked, waiting for response...');
          await new Promise(resolve => setTimeout(resolve, 3000));
          
          // Check if there's a submit button to click
          const hasSubmit = await page.evaluate(() => {
            const buttons = document.querySelectorAll('button[type="submit"], input[type="submit"]');
            return buttons.length > 0;
          });
          
          if (hasSubmit) {
            console.log('[Server] 📝 Found submit button, clicking...');
            await page.click('button[type="submit"], input[type="submit"]');
            await new Promise(resolve => setTimeout(resolve, 3000));
          }
          
          // Get result and check with AI
          let resultText: string;
          try {
            resultText = await page.evaluate(() => document.body.innerText);
          } catch {
            return {
              success: true,
              method: 'ai-auto',
              message: 'Action completed (page redirected)'
            };
          }
          
          const successCheck = await checkSuccessWithAI(resultText);
          
          return {
            success: successCheck.isSuccess,
            method: 'ai-auto',
            message: successCheck.message
          };
          
        } catch (error) {
          console.error('[Server] ❌ Failed to interact with element:', error);
          return {
            success: false,
            method: 'ai-auto',
            message: `Could not find or click element: ${aiDecision.selector}`
          };
        }
      
      case 'fill_form':
        console.log('[Server] 📝 AI detected form that needs filling');
        return {
          success: false,
          method: 'manual',
          message: 'Form requires data input - manual intervention needed'
        };
      
      case 'captcha':
        console.log('[Server] ⚠️ AI detected CAPTCHA');
        return {
          success: false,
          method: 'manual',
          message: aiDecision.message || 'CAPTCHA detected - manual intervention needed'
        };
      
      case 'login':
        console.log('[Server] ⚠️ AI detected login requirement');
        return {
          success: false,
          method: 'manual',
          message: aiDecision.message || 'Login required - manual intervention needed'
        };
      
      default:
        console.log('[Server] ❓ AI could not determine action');
        return {
          success: false,
          method: 'unknown',
          message: aiDecision.message || 'Could not determine how to unsubscribe'
        };
    }
    
  } catch (error) {
    console.error('[Server] Error during automation:', error);
    return {
      success: false,
      method: 'unknown',
      message: `Error: ${error instanceof Error ? error.message : String(error)}`
    };
  } finally {
    await page.close();
  }
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'emailsort-unsubscribe' });
});

// Main unsubscribe endpoint
app.post('/unsubscribe', async (req, res) => {
  const { url } = req.body;
  
  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }
  
  try {
    const result = await autoUnsubscribe(url);
    res.json(result);
  } catch (error) {
    console.error('[Server] Unhandled error:', error);
    res.status(500).json({
      success: false,
      method: 'error',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`[Server] EmailSort Unsubscribe Server listening on port ${PORT}`);
  console.log(`[Server] Health check: http://localhost:${PORT}/health`);
  console.log(`[Server] Unsubscribe endpoint: http://localhost:${PORT}/unsubscribe`);
});

// Cleanup on exit
process.on('SIGINT', async () => {
  console.log("[Server] Shutting down...");
  if (browser) {
    await browser.close();
  }
  process.exit(0);
});
