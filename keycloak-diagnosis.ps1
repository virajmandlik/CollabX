#!/usr/bin/env pwsh
# Keycloak Connection Diagnosis Tool

Write-Host "=============================================="
Write-Host "🔍 Keycloak Connection Diagnosis Tool" -ForegroundColor Green
Write-Host "=============================================="

# Check if Keycloak is running
Write-Host "`n🔄 Checking if Keycloak is running..." -ForegroundColor Cyan
try {
    $keycloakResponse = Invoke-RestMethod -Uri "http://localhost:8080" -Method Get -ErrorAction Stop
    Write-Host "✅ Keycloak is running" -ForegroundColor Green
} catch {
    Write-Host "❌ Cannot connect to Keycloak at http://localhost:8080" -ForegroundColor Red
    Write-Host "Error: $_" -ForegroundColor Red
    Write-Host "Make sure docker-compose is running with 'docker-compose up'" -ForegroundColor Yellow
    exit 1
}

# Check realm configuration
Write-Host "`n🔄 Checking realm configuration..." -ForegroundColor Cyan
try {
    $realmResponse = Invoke-RestMethod -Uri "http://localhost:8080/realms/whiteboard-app" -Method Get -ErrorAction Stop
    Write-Host "✅ Realm 'whiteboard-app' exists" -ForegroundColor Green
    Write-Host "Public key: " -NoNewline
    Write-Host $realmResponse.public_key.Substring(0, 20) -ForegroundColor Gray -NoNewline
    Write-Host "..." -ForegroundColor Gray
} catch {
    Write-Host "❌ Cannot access realm 'whiteboard-app'" -ForegroundColor Red
    Write-Host "Error: $_" -ForegroundColor Red
    Write-Host "The realm may not be created. Run 'docker-compose up' and check Keycloak logs" -ForegroundColor Yellow
    exit 1
}

# Check OpenID configuration
Write-Host "`n🔄 Checking OpenID configuration..." -ForegroundColor Cyan
try {
    $openidConfig = Invoke-RestMethod -Uri "http://localhost:8080/realms/whiteboard-app/.well-known/openid-configuration" -Method Get -ErrorAction Stop
    Write-Host "✅ OpenID configuration is available" -ForegroundColor Green
    Write-Host "  Issuer: $($openidConfig.issuer)" -ForegroundColor Gray
    Write-Host "  Token endpoint: $($openidConfig.token_endpoint)" -ForegroundColor Gray
} catch {
    Write-Host "❌ Cannot access OpenID configuration" -ForegroundColor Red
    Write-Host "Error: $_" -ForegroundColor Red
    exit 1
}

# Check backend connectivity
Write-Host "`n🔄 Checking backend connectivity..." -ForegroundColor Cyan
try {
    $backendResponse = Invoke-RestMethod -Uri "http://localhost:4000/test" -Method Get -ErrorAction Stop
    Write-Host "✅ Backend is running and responding" -ForegroundColor Green
    Write-Host "Response: $($backendResponse.status) - $($backendResponse.message)" -ForegroundColor Gray
} catch {
    Write-Host "❌ Cannot connect to backend at http://localhost:4000" -ForegroundColor Red
    Write-Host "Error: $_" -ForegroundColor Red
    Write-Host "Make sure the backend service is running with 'docker-compose up'" -ForegroundColor Yellow
    exit 1
}

# Check Keycloak config via backend
Write-Host "`n🔄 Checking Keycloak configuration via backend..." -ForegroundColor Cyan
try {
    $backendKeycloakConfig = Invoke-RestMethod -Uri "http://localhost:4000/debug/keycloak-config" -Method Get -ErrorAction Stop
    Write-Host "✅ Backend Keycloak config retrieved" -ForegroundColor Green
    Write-Host "  Server URL: $($backendKeycloakConfig.server_url)" -ForegroundColor Gray
    Write-Host "  Realm: $($backendKeycloakConfig.realm)" -ForegroundColor Gray
    Write-Host "  Client ID: $($backendKeycloakConfig.client_id)" -ForegroundColor Gray
} catch {
    Write-Host "❌ Cannot retrieve Keycloak config from backend" -ForegroundColor Red
    Write-Host "Error: $_" -ForegroundColor Red
    exit 1
}

# Check if the frontend config matches backend
Write-Host "`n🔄 Checking frontend Keycloak configuration..." -ForegroundColor Cyan
$frontendContent = Get-Content -Path "frontend/src/keycloak.ts" -Raw
if ($frontendContent -match 'url: `http://\${currentHost}:8080`' -and 
    $frontendContent -match "realm: 'whiteboard-app'" -and 
    $frontendContent -match "clientId: 'whiteboard-client'") {
    Write-Host "✅ Frontend Keycloak configuration looks correct" -ForegroundColor Green
} else {
    Write-Host "⚠️ Frontend Keycloak configuration may have issues" -ForegroundColor Yellow
    Write-Host "Please check frontend/src/keycloak.ts to ensure it matches backend config" -ForegroundColor Yellow
}

# Summary
Write-Host "`n=============================================="
Write-Host "🎯 Diagnosis Summary" -ForegroundColor Green
Write-Host "=============================================="
Write-Host "✅ Keycloak is running on http://localhost:8080" -ForegroundColor Green
Write-Host "✅ Realm 'whiteboard-app' exists" -ForegroundColor Green
Write-Host "✅ OpenID configuration is properly configured" -ForegroundColor Green
Write-Host "✅ Backend is running and responding" -ForegroundColor Green
Write-Host "`n📝 Next Steps:" -ForegroundColor Yellow
Write-Host "1. Make sure the client 'whiteboard-client' is properly set up in the Keycloak admin console" -ForegroundColor Yellow
Write-Host "2. Verify valid redirect URIs include http://localhost:5173/* and http://localhost:4000/*" -ForegroundColor Yellow
Write-Host "3. Check that Web Origins are set to allow http://localhost:5173 and http://localhost:4000" -ForegroundColor Yellow
Write-Host "4. Run your frontend with: cd frontend && npm run dev" -ForegroundColor Yellow
Write-Host "5. Check browser console for any Keycloak-related errors" -ForegroundColor Yellow

Write-Host "`n🔗 Helpful Links:" -ForegroundColor Cyan
Write-Host "- Keycloak Admin Console: http://localhost:8080/admin/" -ForegroundColor Cyan
Write-Host "- Keycloak Documentation: https://www.keycloak.org/documentation.html" -ForegroundColor Cyan
Write-Host "==============================================" 