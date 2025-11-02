# EmailSort MCP Server

Model Context Protocol server for **fully automated email unsubscription** using Puppeteer.

## 🎯 What it does

Automates complex unsubscribe pages that require:
- ✅ Radio button selection (like MediaMarkt)
- ✅ Checkbox interactions
- ✅ Form submissions
- ✅ Multi-step flows

## 🚀 Quick Start

### Local Development

```bash
cd mcp-server
npm install
npm run dev
```

Test endpoint:
```bash
curl http://localhost:3001/health
# Response: {"status":"ok","service":"emailsort-unsubscribe"}
```

### Deploy to Railway (Recommended)

1. Install Railway CLI:
```bash
npm install -g @railway/cli
```

2. Deploy:
```bash
cd mcp-server
railway login
railway init  # First time only
railway up
```

3. Get your deployment URL from Railway dashboard

4. Add to Supabase:
   - Go to: Project Settings → Edge Functions → Secrets
   - Add secret:
     - **Name**: `MCP_SERVER_URL`
     - **Value**: `https://your-app.up.railway.app`

5. Redeploy Edge Functions:
```bash
cd ..
npx supabase functions deploy unsubscribe-email --no-verify-jwt
npx supabase functions deploy bulk-actions --no-verify-jwt
```

## 🔧 API

### POST /unsubscribe

**Request:**
```json
{
  "url": "https://service-my.mediamarkt.es/pub/sf/FormLink?..."
}
```

**Response (Success):**
```json
{
  "success": true,
  "method": "ai-auto",
  "message": "Selected radio button and submitted form successfully"
}
```

**Response (Manual Required):**
```json
{
  "success": false,
  "method": "manual",
  "message": "Page requires CAPTCHA verification - manual intervention needed"
}
```

## 📊 Methods

- `direct-link`: Unsubscribe confirmed immediately ✅
- `ai-auto`: Puppeteer automated the full process 🤖
- `form-auto`: Simple form submitted ✅
- `manual`: CAPTCHA/login required ⚠️
- `unknown`: Could not determine action ❓

## 🧪 Testing

Test with real unsubscribe link:
```bash
curl -X POST http://localhost:3001/unsubscribe \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com/unsubscribe?token=abc"}'
```

## 📝 Logs

**Railway:** Dashboard → Deployments → View Logs

**Local:** Logs appear in console

Look for:
- `[Server] Found 5 radio buttons, selecting first option...`
- `[Server] ✓ Success message detected`

## 💰 Cost

**Railway:**
- Hobby: $5/month (500 hours)
- Pro: $20/month (unlimited)

**Render:**
- Free tier available
- Starter: $7/month

## 🔗 More Info

See [SETUP_MCP_SERVER.md](../SETUP_MCP_SERVER.md) for detailed deployment options and troubleshooting.
