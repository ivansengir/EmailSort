#!/usr/bin/env node

import express from 'express';
import puppeteer, { Browser } from "puppeteer";

const app = express();
app.use(express.json());

let browser: Browser | null = null;

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
  console.log(`[Server] Starting auto-unsubscribe for: ${url}`);
  
  const browser = await getBrowser();
  const page = await browser.newPage();
  
  try {
    await page.setViewport({ width: 1280, height: 720 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    console.log(`[Server] Navigating to: ${url}`);
    await page.goto(url, { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const successKeywords = [
      'successfully unsubscribed',
      'you have been removed',
      'confirmado',
      'éxito',
      'successfully removed',
      'no longer receive',
      'unsubscription confirmed',
      'has sido dado de baja',
      'te has dado de baja'
    ];
    
    const pageText = await page.evaluate(() => document.body.innerText.toLowerCase());
    
    for (const keyword of successKeywords) {
      if (pageText.includes(keyword.toLowerCase())) {
        console.log(`[Server] ✓ Success message detected: "${keyword}"`);
        return {
          success: true,
          method: 'direct-link',
          message: 'Unsubscribe link worked directly, no form needed'
        };
      }
    }
    
    console.log('[Server] Analyzing page for interactive elements...');
    
    const analysis = await page.evaluate(() => {
      const forms = document.querySelectorAll('form');
      const radioButtons = document.querySelectorAll('input[type="radio"]');
      const checkboxes = document.querySelectorAll('input[type="checkbox"]');
      const submitButtons = document.querySelectorAll('button[type="submit"], input[type="submit"], button:not([type])');
      
      return {
        hasForm: forms.length > 0,
        radioCount: radioButtons.length,
        checkboxCount: checkboxes.length,
        submitCount: submitButtons.length
      };
    });
    
    console.log('[Server] Page analysis:', JSON.stringify(analysis, null, 2));
    
    // Handle radio button forms (MediaMarkt)
    if (analysis.radioCount > 0) {
      console.log(`[Server] Found ${analysis.radioCount} radio buttons, selecting first option...`);
      
      await page.evaluate(() => {
        const radios = document.querySelectorAll('input[type="radio"]');
        if (radios.length > 0) {
          (radios[0] as HTMLInputElement).click();
        }
      });
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
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
        console.log('[Server] Submit button clicked, waiting for response...');
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        const finalText = await page.evaluate(() => document.body.innerText.toLowerCase());
        
        for (const keyword of successKeywords) {
          if (finalText.includes(keyword.toLowerCase())) {
            console.log(`[Server] ✓ Success confirmed after form submission`);
            return {
              success: true,
              method: 'ai-auto',
              message: 'Selected radio button and submitted form successfully'
            };
          }
        }
        
        return {
          success: true,
          method: 'ai-auto',
          message: 'Form submitted (selected first option and clicked submit)'
        };
      }
    }
    
    // Handle simple forms
    if (analysis.hasForm && analysis.submitCount > 0) {
      console.log('[Server] Found simple form, clicking submit...');
      
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
          method: 'form-auto',
          message: 'Submitted form by clicking submit button'
        };
      }
    }
    
    if (pageText.includes('captcha') || pageText.includes('recaptcha')) {
      console.log('[Server] ⚠ CAPTCHA detected');
      return {
        success: false,
        method: 'manual',
        message: 'Page requires CAPTCHA verification - manual intervention needed'
      };
    }
    
    if (pageText.includes('log in') || pageText.includes('sign in') || pageText.includes('password')) {
      console.log('[Server] ⚠ Login required');
      return {
        success: false,
        method: 'manual',
        message: 'Page requires authentication - manual intervention needed'
      };
    }
    
    console.log('[Server] ⚠ Could not determine action');
    return {
      success: false,
      method: 'unknown',
      message: 'Could not automatically determine how to unsubscribe from this page'
    };
    
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
