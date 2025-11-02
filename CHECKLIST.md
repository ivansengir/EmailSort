# ✅ Pre-Deployment Checklist

## 📋 Before Deploying

### Code Quality
- [ ] All TypeScript errors resolved
- [ ] Tests pass: `npm run test`
- [ ] Build succeeds: `npm run build`
- [ ] MCP Server builds: `cd mcp-server && npm run build`
- [ ] No console errors in dev mode

### Environment Setup
- [ ] `.env` file configured locally (not committed to git)
- [ ] Supabase project created
- [ ] Google OAuth credentials obtained
- [ ] OpenAI API key with credits available

### Database
- [ ] All migrations executed in Supabase SQL Editor
- [ ] Row-level security policies enabled
- [ ] Database functions created (toggle_email_selection, etc.)
- [ ] Test data cleared (optional)

### Edge Functions
- [ ] Functions deployed:
  - [ ] `import-emails`
  - [ ] `unsubscribe-email`
  - [ ] `bulk-actions`
- [ ] Secrets configured in Supabase:
  - [ ] `OPENAI_API_KEY`
  - [ ] `GOOGLE_OAUTH_CLIENT_ID`
  - [ ] `GOOGLE_OAUTH_CLIENT_SECRET`
  - [ ] `SUPABASE_SERVICE_ROLE_KEY`
  - [ ] `MCP_SERVER_URL` (add after MCP deployment)

## 🚀 Deployment Steps

### 1. Deploy MCP Server to Render

- [ ] Push code to GitHub
- [ ] Create Render account
- [ ] Create new Web Service:
  - [ ] Name: `emailsort-mcp-server`
  - [ ] Root directory: `mcp-server`
  - [ ] Environment: Docker
  - [ ] Plan: Free
- [ ] Wait for deployment (5-10 min)
- [ ] Test health endpoint: `curl https://your-url.onrender.com/health`
- [ ] Copy MCP Server URL

### 2. Configure MCP_SERVER_URL in Supabase

- [ ] Go to Supabase Dashboard → Edge Functions → Secrets
- [ ] Add secret: `MCP_SERVER_URL` = `https://emailsort-mcp-server.onrender.com`
- [ ] Redeploy Edge Functions:
  ```bash
  npx supabase functions deploy unsubscribe-email --no-verify-jwt
  npx supabase functions deploy bulk-actions --no-verify-jwt
  ```

### 3. Deploy Frontend to Render

- [ ] Create new Static Site on Render:
  - [ ] Name: `emailsort-app`
  - [ ] Build command: `npm install && npm run build`
  - [ ] Publish directory: `dist`
- [ ] Add environment variables:
  - [ ] `VITE_SUPABASE_URL`
  - [ ] `VITE_SUPABASE_ANON_KEY`
- [ ] Wait for deployment (3-5 min)
- [ ] Copy Frontend URL

### 4. Update Supabase Redirect URLs

- [ ] Supabase Dashboard → Authentication → URL Configuration
- [ ] Add to Redirect URLs:
  - [ ] `https://emailsort-app.onrender.com/*`
  - [ ] `https://emailsort-app.onrender.com`
- [ ] Save

## 🧪 Post-Deployment Testing

### Basic Functionality
- [ ] Frontend loads without errors
- [ ] Login with Google works
- [ ] Dashboard displays
- [ ] Can create categories
- [ ] Can import emails
- [ ] Emails appear in categories

### Unsubscribe Flow (Simple)
- [ ] Select email with unsubscribe link
- [ ] Click "Unsubscribe"
- [ ] Check status in Unsubscribe Logs page
- [ ] Verify log entry in database

### Unsubscribe Flow (Complex - MediaMarkt)
- [ ] Import MediaMarkt email (if available)
- [ ] Click "Unsubscribe"
- [ ] Wait for MCP Server (may take 30s if cold start)
- [ ] Check Render MCP logs: should show "Found X radio buttons"
- [ ] Verify status: should be "success" or show proper error

### Edge Cases
- [ ] MCP Server cold start (first request after idle)
- [ ] Multiple Gmail accounts
- [ ] Bulk delete multiple emails
- [ ] Bulk unsubscribe multiple emails

## 📊 Monitoring Setup

### Render
- [ ] Enable email notifications for failed deploys
- [ ] Check MCP Server logs for errors
- [ ] Monitor memory usage (should be <500MB)

### Supabase
- [ ] Check Edge Function logs
- [ ] Monitor database size
- [ ] Verify API request count

## 🐛 Common Issues

### Issue: MCP Server times out
**Solution**: Free tier spins down. Wait 30-60 seconds for wake up.

### Issue: Frontend can't reach Supabase
**Solution**: Check environment variables are set correctly in Render.

### Issue: Google login redirects to wrong URL
**Solution**: Update redirect URLs in Supabase Auth settings.

### Issue: Unsubscribe doesn't call MCP Server
**Solution**: 
1. Check `MCP_SERVER_URL` secret in Supabase
2. Redeploy Edge Functions
3. Test MCP health: `curl https://your-mcp-url.onrender.com/health`

## 📝 Final Submission

- [ ] Frontend URL: `https://emailsort-app.onrender.com`
- [ ] GitHub Repo: `https://github.com/yourusername/EmailSort`
- [ ] Both URLs accessible and working
- [ ] README.md updated with deployment URLs
- [ ] DEPLOYMENT.md included in repo

## ✅ Deployment Complete!

Your app is live and ready to use! 🎉

**URLs to share:**
- App: https://emailsort-app.onrender.com
- Code: https://github.com/yourusername/EmailSort
- MCP Server: https://emailsort-mcp-server.onrender.com
