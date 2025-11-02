# Pre-deployment test script
Write-Host "🧪 Testing MCP Server locally..." -ForegroundColor Cyan

cd mcp-server

Write-Host "📦 Installing dependencies..." -ForegroundColor Yellow
npm install

Write-Host "🔨 Building TypeScript..." -ForegroundColor Yellow
npm run build

Write-Host "🚀 Starting server..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "npm start"

Start-Sleep -Seconds 3

Write-Host "🔍 Testing health endpoint..." -ForegroundColor Cyan
$health = Invoke-RestMethod -Uri "http://localhost:3001/health" -Method Get
Write-Host "Health check response:" -ForegroundColor Green
$health | ConvertTo-Json

Write-Host ""
Write-Host "✅ Server is running!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Test unsubscribe endpoint:"
Write-Host '   Invoke-RestMethod -Uri "http://localhost:3001/unsubscribe" -Method Post -Body (ConvertTo-Json @{url="https://example.com"}) -ContentType "application/json"'
Write-Host ""
Write-Host "2. If tests pass, deploy to Render:"
Write-Host "   - Push to GitHub"
Write-Host "   - Create Web Service on Render"
Write-Host "   - Follow DEPLOYMENT.md"
