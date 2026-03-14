# ─────────────────────────────────────────────────────────────
# setup-render-environments.ps1
# ─────────────────────────────────────────────────────────────
# Creates 1 free PostgreSQL database + 2 web services (DEV + PROD)
# on Render.com using the REST API.
#
# Both services share ONE database with schema-based separation:
#   DEV  → vetcare-dev  → schema: vetcare_dev
#   PROD → vetcare-app  → schema: vetcare_prod
#
# Usage:
#   1. Create a Render API key at https://dashboard.render.com/u/settings#api-keys
#   2. Run:
#      $env:RENDER_API_KEY = "rnd_xxxxx"
#      .\setup-render-environments.ps1
# ─────────────────────────────────────────────────────────────
$ErrorActionPreference = "Stop"

$API = "https://api.render.com/v1"
$REPO_URL = "https://github.com/haikarthick/OnlineDoctorConsultation"

# ── Validate API key ──────────────────────────────────────────
if (-not $env:RENDER_API_KEY) {
    Write-Host @"
══════════════════════════════════════════════════════════
  RENDER_API_KEY not set!

  1. Go to https://dashboard.render.com/u/settings#api-keys
  2. Create an API key
  3. Run:
     `$env:RENDER_API_KEY = "rnd_xxxxx"
     .\setup-render-environments.ps1
══════════════════════════════════════════════════════════
"@ -ForegroundColor Red
    exit 1
}

$Headers = @{
    "Authorization" = "Bearer $($env:RENDER_API_KEY)"
    "Content-Type"  = "application/json"
}

# ── Environment definitions ──────────────────────────────────
$Environments = @(
    @{ Name = "dev";  Branch = "develop"; NodeEnv = "development"; Seed = "true";  Schema = "vetcare_dev";  SvcName = "vetcare-dev" }
    @{ Name = "prod"; Branch = "main";    NodeEnv = "production";  Seed = "false"; Schema = "vetcare_prod"; SvcName = "vetcare-app" }
)

# ── Verify API key ────────────────────────────────────────────
Write-Host "Verifying Render API key..." -ForegroundColor Cyan
try {
    $owners = Invoke-RestMethod -Uri "$API/owners" -Headers $Headers -Method Get
    $ownerId = $owners[0].owner.id
    Write-Host "Authenticated (owner: $ownerId)" -ForegroundColor Green
} catch {
    Write-Host "Invalid API key or API unreachable" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "══════════════════════════════════════════════════════════" -ForegroundColor Yellow
Write-Host "  VetCare — Free-Tier Render Setup (1 DB + 2 Services)" -ForegroundColor Yellow
Write-Host "══════════════════════════════════════════════════════════" -ForegroundColor Yellow
Write-Host ""

# ── Get existing resources ────────────────────────────────────
$existingDbs = try { Invoke-RestMethod -Uri "$API/postgres" -Headers $Headers -Method Get } catch { @() }
$existingSvcs = try { Invoke-RestMethod -Uri "$API/services?type=web_service&limit=50" -Headers $Headers -Method Get } catch { @() }

# ── Create Single Database ────────────────────────────────────
Write-Host "━━━ Creating Database ━━━" -ForegroundColor Cyan
$dbName = "vetcare-db"
Write-Host -NoNewline "  $dbName ... "

$existing = $existingDbs | Where-Object { $_.postgres.name -eq $dbName }
if ($existing) {
    $dbId = $existing.postgres.id
    Write-Host "exists ($dbId)" -ForegroundColor Gray
} else {
    $body = @{
        name         = $dbName
        databaseName = "vetcare"
        databaseUser = "vetcare"
        plan         = "free"
        region       = "oregon"
        version      = "16"
    } | ConvertTo-Json

    $result = Invoke-RestMethod -Uri "$API/postgres" -Headers $Headers -Method Post -Body $body
    $dbId = $result.postgres.id
    Write-Host "created ($dbId)" -ForegroundColor Green
}

# Wait for database
Write-Host ""
Write-Host "━━━ Waiting for database to be available ━━━" -ForegroundColor Cyan
Write-Host -NoNewline "  $dbName ... "
for ($i = 0; $i -lt 30; $i++) {
    try {
        $status = (Invoke-RestMethod -Uri "$API/postgres/$dbId" -Headers $Headers -Method Get).status
        if ($status -eq "available" -or $status -eq "running" -or $status -eq "created") { break }
    } catch { }
    Start-Sleep -Seconds 5
}

$dbConnString = ""
try {
    $connInfo = Invoke-RestMethod -Uri "$API/postgres/$dbId/connection-info" -Headers $Headers -Method Get
    $dbConnString = if ($connInfo.internalConnectionString) { $connInfo.internalConnectionString } else { $connInfo.externalConnectionString }
} catch { }
Write-Host "ready" -ForegroundColor Green

# ── Create Web Services ──────────────────────────────────────
Write-Host ""
Write-Host "━━━ Creating Web Services ━━━" -ForegroundColor Cyan
$deployHooks = @{}

foreach ($env in $Environments) {
    $svcName = $env.SvcName
    Write-Host -NoNewline "  $svcName (branch: $($env.Branch)) ... "

    $existing = $existingSvcs | Where-Object { $_.service.name -eq $svcName }
    if ($existing) {
        $svcId = $existing.service.id
        Write-Host "exists ($svcId)" -ForegroundColor Gray
    } else {
        $body = @{
            type         = "web_service"
            name         = $svcName
            repo         = $REPO_URL
            branch       = $env.Branch
            plan         = "free"
            runtime      = "node"
            region       = "oregon"
            buildCommand = "chmod +x render-build.sh && ./render-build.sh"
            startCommand = "chmod +x render-start.sh && ./render-start.sh"
            autoDeploy   = "yes"
            envVars      = @(
                @{ key = "DATABASE_URL";    value = $dbConnString }
                @{ key = "DB_SCHEMA";       value = $env.Schema }
                @{ key = "NODE_ENV";        value = $env.NodeEnv }
                @{ key = "SEED_ON_STARTUP"; value = $env.Seed }
            )
        } | ConvertTo-Json -Depth 5

        $result = Invoke-RestMethod -Uri "$API/services" -Headers $Headers -Method Post -Body $body
        $svcId = $result.service.id
        Write-Host "created ($svcId)" -ForegroundColor Green
    }

    # Get deploy hook URL
    try {
        $svcDetails = Invoke-RestMethod -Uri "$API/services/$svcId" -Headers $Headers -Method Get
        $hook = $svcDetails.serviceDetails.deployHookUrl
        if (-not $hook) { $hook = $svcDetails.deployHookUrl }
    } catch {
        $hook = ""
    }
    $deployHooks[$env.Name] = $hook
}

# ── Summary ──────────────────────────────────────────────────
Write-Host ""
Write-Host "══════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host "  ALL RESOURCES CREATED!" -ForegroundColor Green
Write-Host "══════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host ""

Write-Host "┌──────────┬──────────────────────┬──────────────┬──────────────────┐"
Write-Host "│ Env      │ Service              │ Branch       │ DB Schema        │"
Write-Host "├──────────┼──────────────────────┼──────────────┼──────────────────┤"
foreach ($env in $Environments) {
    Write-Host ("│ {0,-8} │ {1,-20} │ {2,-12} │ {3,-16} │" -f $env.Name, $env.SvcName, $env.Branch, $env.Schema)
}
Write-Host "└──────────┴──────────────────────┴──────────────┴──────────────────┘"

Write-Host ""
Write-Host "━━━ Service URLs ━━━" -ForegroundColor Cyan
foreach ($env in $Environments) {
    Write-Host "  $($env.SvcName): https://$($env.SvcName).onrender.com"
}

Write-Host ""
Write-Host "━━━ Deploy Hook URLs ━━━" -ForegroundColor Cyan
Write-Host "Add these as GitHub Secrets (repo → Settings → Secrets → Actions):"
Write-Host ""
foreach ($env in $Environments) {
    $secretName = "RENDER_DEPLOY_HOOK_$($env.Name.ToUpper())"
    $hook = $deployHooks[$env.Name]
    if ($hook) {
        Write-Host "  $secretName" -ForegroundColor Yellow
        Write-Host "    $hook"
    } else {
        Write-Host "  $secretName — get from Render Dashboard → $($env.SvcName) → Settings → Deploy Hook" -ForegroundColor DarkYellow
    }
    Write-Host ""
}

# ── Auto-set GitHub secrets if gh CLI is available ────────────
$ghAvailable = Get-Command gh -ErrorAction SilentlyContinue
if ($ghAvailable) {
    Write-Host ""
    $reply = Read-Host "🔧 Set GitHub secrets automatically using 'gh' CLI? (y/n)"
    if ($reply -match '^[Yy]$') {
        foreach ($env in $Environments) {
            $secretName = "RENDER_DEPLOY_HOOK_$($env.Name.ToUpper())"
            $hook = $deployHooks[$env.Name]
            if ($hook) {
                gh secret set $secretName --body $hook
                Write-Host "  ✅ $secretName → set" -ForegroundColor Green
            }
        }
        Write-Host ""
        Write-Host "✅ All GitHub secrets configured!" -ForegroundColor Green
    }
} else {
    Write-Host "💡 Tip: Install GitHub CLI (gh) to auto-set secrets: https://cli.github.com/" -ForegroundColor DarkCyan
}

Write-Host ""
Write-Host "══════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host "  Setup complete! Push to 'develop' to deploy to DEV." -ForegroundColor Green
Write-Host "══════════════════════════════════════════════════════════" -ForegroundColor Green
