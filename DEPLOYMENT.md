# 🚀 Deployment Guide - EmailSort (Render.com)

## Arquitectura del Deployment

```
┌─────────────────────────────────────────────────────────┐
│  Frontend (Vite/React)                                  │
│  Render Static Site                                     │
│  https://emailsort.onrender.com                         │
└────────────────────┬────────────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────────────┐
│  Supabase (Backend)                                     │
│  - PostgreSQL Database                                  │
│  - Edge Functions (Deno)                                │
│  - Authentication                                       │
└────────────────────┬────────────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────────────┐
│  MCP Server (Puppeteer)                                 │
│  Render Web Service (Docker)                            │
│  https://emailsort-mcp.onrender.com                     │
└─────────────────────────────────────────────────────────┘
```

## 📋 Prerequisites

1. GitHub account
2. Render.com account (free tier)
3. Supabase project already set up

## Step 1: Deploy MCP Server (Puppeteer)

### 1.1 Create Web Service on Render

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click **New +** → **Web Service**
3. Connect your GitHub repository
4. Configure:
   - **Name**: `emailsort-mcp-server`
   - **Region**: Oregon (US West)
   - **Root Directory**: `mcp-server`
   - **Environment**: Docker
   - **Plan**: Free

### 1.2 Environment Variables

Add these in Render:
- `NODE_ENV` = `production`
- `PORT` = `3001` (Render will override this, but good to have)

### 1.3 Deploy

Click **Create Web Service**

Wait 5-10 minutes for Docker build (installing Chromium)

### 1.4 Get MCP Server URL

Once deployed, copy the URL (e.g., `https://emailsort-mcp-server.onrender.com`)

**IMPORTANT:** Free tier spins down after 15 min of inactivity. First request after idle will take ~30 seconds to wake up.

## Step 2: Configure Supabase with MCP Server URL

1. Go to Supabase Dashboard
2. Project Settings → Edge Functions → Secrets
3. Click **Add New Secret**:
   - **Name**: `MCP_SERVER_URL`
   - **Value**: `https://emailsort-mcp-server.onrender.com` (your URL from Step 1.4)
4. Save

## Step 3: Redeploy Edge Functions

```bash
cd EmailSort
npx supabase functions deploy unsubscribe-email --no-verify-jwt
npx supabase functions deploy bulk-actions --no-verify-jwt
```

## Step 4: Deploy Frontend (React App)

### 4.1 Create Static Site on Render

1. Render Dashboard → **New +** → **Static Site**
2. Connect same GitHub repository
3. Configure:
   - **Name**: `emailsort-app`
   - **Root Directory**: (leave empty, use repo root)
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `dist`

### 4.2 Environment Variables

Add these:
- `VITE_SUPABASE_URL` = (your Supabase project URL)
- `VITE_SUPABASE_ANON_KEY` = (your Supabase anon key)

Get these from: Supabase Dashboard → Project Settings → API

### 4.3 Deploy

Click **Create Static Site**

Wait 3-5 minutes for build

### 4.4 Get Frontend URL

Copy the URL (e.g., `https://emailsort-app.onrender.com`)

## Step 5: Update Supabase Redirect URLs

1. Supabase Dashboard → Authentication → URL Configuration
2. Add to **Redirect URLs**:
   - `https://emailsort-app.onrender.com/*`
   - `https://emailsort-app.onrender.com`

## Step 6: Test the Complete Flow

1. Visit `https://emailsort-app.onrender.com`
2. Login with Google
3. Import emails
4. Select email with unsubscribe link
5. Click "Unsubscribe"
6. Check logs:
   - Supabase Edge Logs: Should show "Calling MCP server..."
   - Render MCP Logs: Should show "Found X radio buttons..."

## 🐛 Troubleshooting

### MCP Server fails to start

**Error**: "chromium not found"
- **Solution**: Render should install it via Dockerfile. Check build logs.

### Frontend can't connect to Supabase

**Error**: "Supabase client error"
- **Solution**: Check `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set correctly

### MCP Server times out

**Error**: "Request timeout"
- **Solution**: Free tier wakes from sleep. Wait 30-60 seconds and retry.

### Edge Function can't reach MCP Server

**Error**: "MCP server unavailable"
- **Solution**: 
  1. Check `MCP_SERVER_URL` secret in Supabase
  2. Verify MCP service is running: `curl https://your-mcp-url.onrender.com/health`
  3. Check Render logs for errors

## 📊 Free Tier Limits

### Render Free Tier
- **750 hours/month** of runtime
- **Spin down after 15 min** of inactivity
- **500 MB RAM** (sufficient for Puppeteer)
- **Builds**: Unlimited

### Supabase Free Tier
- **500 MB database**
- **2 GB file storage**
- **50,000 monthly active users**
- **500,000 Edge Function invocations/month**

## 💰 Estimated Costs

**Completely FREE** if staying within limits:
- Render: Free tier (MCP + Frontend)
- Supabase: Free tier
- OpenAI: ~$0.0045 per unsubscribe (pay-as-you-go)

**If you exceed free tier:**
- Render: $7/month per service
- Supabase: $25/month for Pro

## 🔧 Monitoring

### MCP Server Health

```bash
curl https://your-mcp-server.onrender.com/health
# Expected: {"status":"ok","service":"emailsort-unsubscribe"}
```

### Test MCP Endpoint

```bash
curl -X POST https://your-mcp-server.onrender.com/unsubscribe \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com/unsubscribe"}'
```

### View Logs

**Render:**
- Dashboard → Your Service → Logs (real-time)

**Supabase:**
- Dashboard → Functions → Edge Logs

## 🚀 CI/CD (Automatic Deployments)

Render automatically redeploys when you push to `main` branch.

To disable:
- Service Settings → Auto-Deploy → Off

## 📝 URLs Summary

After deployment, you'll have:

1. **Frontend**: `https://emailsort-app.onrender.com`
2. **MCP Server**: `https://emailsort-mcp-server.onrender.com`
3. **Supabase API**: `https://[your-project].supabase.co`
4. **Edge Functions**: `https://[your-project].supabase.co/functions/v1/`

## ✅ Final Checklist

- [ ] MCP Server deployed and responding to `/health`
- [ ] `MCP_SERVER_URL` secret added to Supabase
- [ ] Edge Functions redeployed with MCP integration
- [ ] Frontend deployed with correct env vars
- [ ] Supabase redirect URLs updated
- [ ] Tested full unsubscribe flow
- [ ] MediaMarkt email test (radio buttons)

## 🎉 Success!

Your app is now fully deployed and ready to use!

**Share URLs:**
- Frontend: `https://emailsort-app.onrender.com`
- GitHub Repo: `https://github.com/yourusername/EmailSort`
