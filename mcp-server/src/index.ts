#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import puppeteer, { Browser, Page } from "puppeteer";

/**
 * MCP Server for automated email unsubscription
 * Uses Puppeteer to navigate pages and interact with forms
 */

let browser: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browser) {
    console.error("[MCP] Launching browser...");
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu'
      ]
    });
  }
  return browser;
}

async function closeBrowser() {
  if (browser) {
    await browser.close();
    browser = null;
  }
}

/**
 * Main tool: Automatically unsubscribe from email
 * Handles: direct links, forms, radio buttons, checkboxes, etc.
 */
async function autoUnsubscribe(url: string): Promise<{
  success: boolean;
  method: string;
  message: string;
  screenshots?: string[];
}> {
  console.error(`[MCP] Starting auto-unsubscribe for: ${url}`);
  
  const browser = await getBrowser();
  const page = await browser.newPage();
  
  try {
    // Set viewport and user agent to appear as real browser
    await page.setViewport({ width: 1280, height: 720 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    console.error(`[MCP] Navigating to: ${url}`);
    await page.goto(url, { 
      waitUntil: 'domcontentloaded', // Faster than networkidle2, good enough for forms
      timeout: 60000 // 60 seconds for slow pages like MediaMarkt
    });
    
    // Wait a bit for any dynamic content
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Check for immediate success messages
    const successKeywords = [
      'successfully unsubscribed',
      'you have been removed',
      'confirmado',
      'éxito',
      'successfully removed',
      'no longer receive',
      'unsubscription confirmed'
    ];
    
    const pageText = await page.evaluate(() => document.body.innerText.toLowerCase());
    
    for (const keyword of successKeywords) {
      if (pageText.includes(keyword.toLowerCase())) {
        console.error(`[MCP] ✓ Success message detected: "${keyword}"`);
        return {
          success: true,
          method: 'direct-link',
          message: 'Unsubscribe link worked directly, no form needed'
        };
      }
    }
    
    // Look for forms, radio buttons, checkboxes
    console.error('[MCP] Analyzing page for interactive elements...');
    
    const analysis = await page.evaluate(() => {
      const forms = document.querySelectorAll('form');
      const radioButtons = document.querySelectorAll('input[type="radio"]');
      const checkboxes = document.querySelectorAll('input[type="checkbox"]');
      const submitButtons = document.querySelectorAll('button[type="submit"], input[type="submit"], button:not([type])');
      
      return {
        hasForm: forms.length > 0,
        radioCount: radioButtons.length,
        checkboxCount: checkboxes.length,
        submitCount: submitButtons.length,
        formHTML: forms.length > 0 ? forms[0].innerHTML : null
      };
    });
    
    console.error('[MCP] Page analysis:', JSON.stringify(analysis, null, 2));
    
    // Handle radio button forms (like MediaMarkt)
    if (analysis.radioCount > 0) {
      console.error(`[MCP] Found ${analysis.radioCount} radio buttons, selecting first option...`);
      
      // Select the first radio button
      await page.evaluate(() => {
        const radios = document.querySelectorAll('input[type="radio"]');
        if (radios.length > 0) {
          (radios[0] as HTMLInputElement).click();
        }
      });
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Find and click submit button
      const submitClicked = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button[type="submit"], input[type="submit"], button'));
        const submitButton = buttons.find(btn => {
          const text = btn.textContent?.toLowerCase() || '';
          const value = (btn as HTMLInputElement).value?.toLowerCase() || '';
          return text.includes('submit') || text.includes('enviar') || text.includes('confirmar') || 
                 value.includes('submit') || value.includes('enviar');
        });
        
        if (submitButton) {
          (submitButton as HTMLElement).click();
          return true;
        }
        return false;
      });
      
      if (submitClicked) {
        console.error('[MCP] Submit button clicked, waiting for response...');
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        const finalText = await page.evaluate(() => document.body.innerText.toLowerCase());
        
        // Check for success again
        for (const keyword of successKeywords) {
          if (finalText.includes(keyword.toLowerCase())) {
            console.error(`[MCP] ✓ Success confirmed after form submission`);
            return {
              success: true,
              method: 'radio-form',
              message: 'Selected radio button and submitted form successfully'
            };
          }
        }
        
        return {
          success: true,
          method: 'radio-form',
          message: 'Form submitted (selected first option and clicked submit)'
        };
      }
    }
    
    // Handle simple forms with submit button
    if (analysis.hasForm && analysis.submitCount > 0) {
      console.error('[MCP] Found simple form, clicking submit...');
      
      const clicked = await page.evaluate(() => {
        const buttons = document.querySelectorAll('button[type="submit"], input[type="submit"]');
        if (buttons.length > 0) {
          (buttons[0] as HTMLElement).click();
          return true;
        }
        return false;
      });
      
      if (clicked) {
        await new Promise(resolve => setTimeout(resolve, 3000));
        return {
          success: true,
          method: 'simple-form',
          message: 'Submitted form by clicking submit button'
        };
      }
    }
    
    // Check for CAPTCHA
    if (pageText.includes('captcha') || pageText.includes('recaptcha')) {
      console.error('[MCP] ⚠ CAPTCHA detected');
      return {
        success: false,
        method: 'captcha-required',
        message: 'Page requires CAPTCHA verification - manual intervention needed'
      };
    }
    
    // Check for login requirement
    if (pageText.includes('log in') || pageText.includes('sign in') || pageText.includes('password')) {
      console.error('[MCP] ⚠ Login required');
      return {
        success: false,
        method: 'login-required',
        message: 'Page requires authentication - manual intervention needed'
      };
    }
    
    console.error('[MCP] ⚠ Could not determine action');
    return {
      success: false,
      method: 'unknown',
      message: 'Could not automatically determine how to unsubscribe from this page'
    };
    
  } catch (error) {
    console.error('[MCP] Error during automation:', error);
    return {
      success: false,
      method: 'error',
      message: `Error: ${error instanceof Error ? error.message : String(error)}`
    };
  } finally {
    await page.close();
  }
}

/**
 * Initialize MCP Server
 */
const server = new Server(
  {
    name: "emailsort-unsubscribe",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "auto_unsubscribe",
        description: "Automatically unsubscribe from an email by navigating to the unsubscribe URL and interacting with the page (forms, radio buttons, checkboxes, etc.)",
        inputSchema: {
          type: "object",
          properties: {
            url: {
              type: "string",
              description: "The unsubscribe URL to navigate to",
            },
          },
          required: ["url"],
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "auto_unsubscribe") {
    const url = request.params.arguments?.url as string;
    
    if (!url) {
      throw new Error("URL is required");
    }
    
    const result = await autoUnsubscribe(url);
    
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }
  
  throw new Error(`Unknown tool: ${request.params.name}`);
});

/**
 * Start server
 */
async function main() {
  console.error("[MCP] EmailSort Unsubscribe MCP Server starting...");
  
  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  console.error("[MCP] Server ready and listening for requests");
  
  // Cleanup on exit
  process.on('SIGINT', async () => {
    console.error("[MCP] Shutting down...");
    await closeBrowser();
    process.exit(0);
  });
}

main().catch((error) => {
  console.error("[MCP] Fatal error:", error);
  process.exit(1);
});
