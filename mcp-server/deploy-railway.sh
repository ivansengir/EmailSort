#!/bin/bash
# Railway deployment script
# Run this from the mcp-server directory

echo "🚀 Deploying MCP Server to Railway..."

# Check if railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI not found. Installing..."
    npm install -g @railway/cli
fi

# Login to Railway
echo "🔐 Logging in to Railway..."
railway login

# Link to project (or create new)
echo "🔗 Linking to Railway project..."
if [ ! -d ".railway" ]; then
    echo "Creating new Railway project..."
    railway init
fi

# Deploy
echo "📦 Deploying..."
railway up

echo "✅ Deployment complete!"
echo ""
echo "Next steps:"
echo "1. Get your deployment URL from Railway dashboard"
echo "2. Add MCP_SERVER_URL secret to Supabase:"
echo "   Supabase Dashboard → Project Settings → Edge Functions → Secrets"
echo "   Name: MCP_SERVER_URL"
echo "   Value: https://your-railway-url.up.railway.app"
echo ""
echo "3. Redeploy Edge Functions (already done if you just deployed them)"
echo ""
echo "4. Test with: curl https://your-railway-url.up.railway.app/health"
