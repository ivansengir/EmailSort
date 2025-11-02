# Railway deployment script
# Run this from the mcp-server directory

Write-Host "🚀 Deploying MCP Server to Railway..." -ForegroundColor Cyan

# Check if railway CLI is installed
$railwayExists = Get-Command railway -ErrorAction SilentlyContinue
if (-not $railwayExists) {
    Write-Host "❌ Railway CLI not found. Installing..." -ForegroundColor Red
    npm install -g @railway/cli
}

# Login to Railway
Write-Host "🔐 Logging in to Railway..." -ForegroundColor Yellow
railway login

# Link to project (or create new)
Write-Host "🔗 Linking to Railway project..." -ForegroundColor Yellow
$projectExists = Test-Path ".railway"

if (-not $projectExists) {
    Write-Host "Creating new Railway project..." -ForegroundColor Green
    railway init
}

# Deploy
Write-Host "📦 Deploying..." -ForegroundColor Cyan
railway up

Write-Host "✅ Deployment complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Get your deployment URL from Railway dashboard"
Write-Host "2. Add MCP_SERVER_URL secret to Supabase:"
Write-Host "   Supabase Dashboard → Project Settings → Edge Functions → Secrets"
Write-Host "   Name: MCP_SERVER_URL"
Write-Host "   Value: https://your-railway-url.up.railway.app"
Write-Host ""
Write-Host "3. Redeploy Edge Functions (already done if you just deployed them)"
Write-Host ""
Write-Host "4. Test with: curl https://your-railway-url.up.railway.app/health"
