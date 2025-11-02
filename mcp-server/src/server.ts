#!/usr/bin/env node

import express from 'express';
import fetch from 'node-fetch';

const app = express();
app.use(express.json());

// Use Browserless.io for Puppeteer in serverless
const BROWSERLESS_API_KEY = process.env.BROWSERLESS_API_KEY;
const BROWSERLESS_URL = `https://chrome.browserless.io`;

async function autoUnsubscribeWithBrowserless(url: string): Promise<{
  success: boolean;
  method: string;
  message: string;
}> {
  console.log(`[Server] Starting auto-unsubscribe via Browserless for: ${url}`);
  
  if (!BROWSERLESS_API_KEY) {
    console.error('[Server] BROWSERLESS_API_KEY not configured');
    return {
      success: false,
      method: 'unknown',
      message: 'Browserless API key not configured'
    };
  }
  
  try {
    // Use Browserless function API
    const response = await fetch(`${BROWSERLESS_URL}/function?token=${BROWSERLESS_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: `
          module.exports = async ({ page }) => {
            const targetUrl = '${url}';
            
            await page.setViewport({ width: 1280, height: 720 });
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
            
            console.log('Navigating to:', targetUrl);
            await page.goto(targetUrl, { 
              waitUntil: 'networkidle2',
              timeout: 30000 
            });
            
            await page.waitForTimeout(2000);
            
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
                console.log('Success message detected:', keyword);
                return {
                  success: true,
                  method: 'direct-link',
                  message: 'Unsubscribe link worked directly'
                };
              }
            }
            
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
            
            console.log('Page analysis:', analysis);
            
            if (analysis.radioCount > 0) {
              console.log('Found radio buttons, selecting first option...');
              
              await page.evaluate(() => {
                const radios = document.querySelectorAll('input[type="radio"]');
                if (radios.length > 0) {
                  radios[0].click();
                }
              });
              
              await page.waitForTimeout(500);
              
              const submitClicked = await page.evaluate(() => {
                const buttons = Array.from(document.querySelectorAll('button[type="submit"], input[type="submit"], button'));
                const submitButton = buttons.find(btn => {
                  const text = btn.textContent?.toLowerCase() || '';
                  const value = btn.value?.toLowerCase() || '';
                  return text.includes('submit') || text.includes('enviar') || text.includes('confirmar') || 
                         value.includes('submit') || value.includes('enviar');
                });
                
                if (submitButton) {
                  submitButton.click();
                  return true;
                }
                return false;
              });
              
              if (submitClicked) {
                console.log('Submit button clicked');
                await page.waitForTimeout(3000);
                
                const finalText = await page.evaluate(() => document.body.innerText.toLowerCase());
                
                for (const keyword of successKeywords) {
                  if (finalText.includes(keyword.toLowerCase())) {
                    console.log('Success confirmed after form submission');
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
                  message: 'Form submitted successfully'
                };
              }
            }
            
            if (analysis.hasForm && analysis.submitCount > 0) {
              console.log('Found simple form, clicking submit...');
              
              const clicked = await page.evaluate(() => {
                const buttons = document.querySelectorAll('button[type="submit"], input[type="submit"]');
                if (buttons.length > 0) {
                  buttons[0].click();
                  return true;
                }
                return false;
              });
              
              if (clicked) {
                await page.waitForTimeout(3000);
                return {
                  success: true,
                  method: 'form-auto',
                  message: 'Submitted form successfully'
                };
              }
            }
            
            if (pageText.includes('captcha') || pageText.includes('recaptcha')) {
              return {
                success: false,
                method: 'manual',
                message: 'Page requires CAPTCHA verification'
              };
            }
            
            if (pageText.includes('log in') || pageText.includes('sign in') || pageText.includes('password')) {
              return {
                success: false,
                method: 'manual',
                message: 'Page requires authentication'
              };
            }
            
            return {
              success: false,
              method: 'unknown',
              message: 'Could not determine how to unsubscribe'
            };
          };
        `,
        context: {}
      })
    });
    
    if (!response.ok) {
      throw new Error(`Browserless API error: ${response.status}`);
    }
    
    const result = await response.json();
    console.log('[Server] Browserless result:', result);
    
    return result;
    
  } catch (error) {
    console.error('[Server] Error during automation:', error);
    return {
      success: false,
      method: 'unknown',
      message: `Error: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

// Health check endpoint
app.get('/health', (req: any, res: any) => {
  res.json({ 
    status: 'ok', 
    service: 'emailsort-unsubscribe',
    provider: BROWSERLESS_API_KEY ? 'browserless' : 'none'
  });
});

// Main unsubscribe endpoint
app.post('/unsubscribe', async (req: any, res: any) => {
  const { url } = req.body;
  
  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }
  
  try {
    const result = await autoUnsubscribeWithBrowserless(url);
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
  console.log(`[Server] Provider: ${BROWSERLESS_API_KEY ? 'Browserless.io' : 'None (configure BROWSERLESS_API_KEY)'}`);
});

export default app;
