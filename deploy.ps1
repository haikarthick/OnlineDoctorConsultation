# ═══════════════════════════════════════════════════════════════
#  VetCare Platform - Automated Cloud Deployment (PowerShell)
#  Usage: .\deploy.ps1 [command]
#
#  Commands:
#    secrets     Generate secure random secrets
#    deploy      Build, push, and deploy latest code
#    rollback    Roll back to previous image tag
#    status      Show running services status
#    logs        Tail production logs
#    backup      Create database backup
#    destroy     Tear down all containers/volumes
# ═══════════════════════════════════════════════════════════════
param(
    [Parameter(Position=0)]
    [ValidateSet('secrets','deploy','rollback','status','logs','backup','destroy','help')]
    [string]$Command = 'help',

    [Parameter(Position=1)]
    [string]$Arg = ''
)

$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$ComposeFile = Join-Path $ProjectRoot 'docker-compose.prod.yml'
$EnvFile = Join-Path $ProjectRoot '.env'

function Write-Log   { param($msg) Write-Host "[INFO]  $msg" -ForegroundColor Cyan }
function Write-Warn  { param($msg) Write-Host "[WARN]  $msg" -ForegroundColor Yellow }
function Write-Err   { param($msg) Write-Host "[ERROR] $msg" -ForegroundColor Red }
function Write-Ok    { param($msg) Write-Host "[OK]    $msg" -ForegroundColor Green }

# ── Pre-flight ────────────────────────────────────────────────
function Test-Preflight {
    Write-Log "Running pre-flight checks..."

    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        Write-Err "Docker is not installed or not in PATH"; exit 1
    }
    if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
        Write-Err "Git is not installed or not in PATH"; exit 1
    }
    if (-not (Test-Path $EnvFile)) {
        Write-Err "Missing .env file. Copy .env.production.template to .env and fill in values."
        exit 1
    }

    # Parse and validate env file
    $envVars = @{}
    Get-Content $EnvFile | ForEach-Object {
        if ($_ -match '^([^#=]+)=(.*)$') {
            $envVars[$Matches[1].Trim()] = $Matches[2].Trim()
        }
    }

    $required = @('JWT_SECRET', 'POSTGRES_PASSWORD', 'CORS_ORIGIN')
    foreach ($var in $required) {
        $val = $envVars[$var]
        if (-not $val -or $val.StartsWith('CHANGE_ME')) {
            Write-Err "Environment variable $var is not set or uses placeholder value."
            exit 1
        }
    }

    Write-Ok "Pre-flight checks passed"
}

# ── Generate Secrets ──────────────────────────────────────────
function New-Secrets {
    Write-Log "Generating secure secrets..."

    $jwt = -join ((1..64) | ForEach-Object { [char](Get-Random -Minimum 33 -Maximum 126) })
    $dbPass = -join ((1..32) | ForEach-Object { [char](Get-Random -Minimum 65 -Maximum 122) })
    $redisPass = -join ((1..32) | ForEach-Object { [char](Get-Random -Minimum 65 -Maximum 122) })

    Write-Host ""
    Write-Host "Generated secrets (save these securely!):" -ForegroundColor Green
    Write-Host ("=" * 50)
    Write-Host "JWT_SECRET=$jwt"
    Write-Host "POSTGRES_PASSWORD=$dbPass"
    Write-Host "DB_PASSWORD=$dbPass"
    Write-Host "REDIS_PASSWORD=$redisPass"
    Write-Host ("=" * 50)
    Write-Host ""
    Write-Host "Add these to your .env file."
}

# ── Deploy ────────────────────────────────────────────────────
function Start-Deployment {
    Test-Preflight

    Write-Log "Building Docker images..."
    $tag = git rev-parse --short HEAD 2>$null
    if (-not $tag) { $tag = 'latest' }
    docker compose -f $ComposeFile build --parallel
    Write-Ok "Images built (tag: $tag)"

    Write-Log "Starting services..."
    docker compose -f $ComposeFile up -d --remove-orphans

    Write-Log "Waiting for health checks (up to 60s)..."
    $healthy = $false
    for ($i = 0; $i -lt 30; $i++) {
        Start-Sleep -Seconds 2
        try {
            $response = Invoke-WebRequest -Uri "http://localhost:3000/api/v1/health" -UseBasicParsing -TimeoutSec 3 -ErrorAction SilentlyContinue
            if ($response.StatusCode -eq 200) {
                $healthy = $true
                break
            }
        } catch { }
    }

    if ($healthy) {
        Write-Ok "All services healthy!"
    } else {
        Write-Err "Services did not become healthy within timeout"
        docker compose -f $ComposeFile logs --tail=30
        exit 1
    }

    docker compose -f $ComposeFile ps
    Write-Ok "Deployment complete! Tag: $tag"
}

# ── Rollback ──────────────────────────────────────────────────
function Start-Rollback {
    param([string]$Tag)
    if (-not $Tag) {
        Write-Err "Usage: .\deploy.ps1 rollback <image-tag>"
        exit 1
    }

    Write-Log "Rolling back to tag: $Tag"
    $env:IMAGE_TAG = $Tag
    docker compose -f $ComposeFile pull
    docker compose -f $ComposeFile up -d --remove-orphans

    Start-Sleep -Seconds 10
    try {
        Invoke-WebRequest -Uri "http://localhost:3000/api/v1/health" -UseBasicParsing -TimeoutSec 5 | Out-Null
        Write-Ok "Rollback to $Tag successful!"
    } catch {
        Write-Err "Rollback health check failed!"
        exit 1
    }
}

# ── Status ────────────────────────────────────────────────────
function Show-Status {
    Write-Log "Service Status:"
    docker compose -f $ComposeFile ps

    Write-Log "Health Check:"
    try {
        $health = Invoke-RestMethod -Uri "http://localhost:3000/api/v1/health" -TimeoutSec 5
        $health | ConvertTo-Json -Depth 3 | Write-Host
    } catch {
        Write-Warn "API unreachable"
    }
}

# ── Logs ──────────────────────────────────────────────────────
function Show-Logs {
    param([string]$Service)
    if ($Service) {
        docker compose -f $ComposeFile logs -f $Service
    } else {
        docker compose -f $ComposeFile logs -f --tail=100
    }
}

# ── Backup ────────────────────────────────────────────────────
function New-Backup {
    Write-Log "Creating database backup..."
    $timestamp = Get-Date -Format 'yyyyMMdd_HHmmss'
    $backupFile = "backup_${timestamp}.sql"

    docker compose -f $ComposeFile exec -T postgres pg_dump -U vetcare_app veterinary_consultation > $backupFile

    Write-Ok "Database backup saved: $backupFile"
}

# ── Destroy ───────────────────────────────────────────────────
function Remove-All {
    Write-Warn "This will DESTROY all containers and data volumes!"
    $confirm = Read-Host "Type 'yes-destroy-everything' to confirm"
    if ($confirm -ne 'yes-destroy-everything') {
        Write-Log "Cancelled."; return
    }
    docker compose -f $ComposeFile down -v --remove-orphans
    Write-Ok "All services destroyed."
}

# ── Main ──────────────────────────────────────────────────────
switch ($Command) {
    'secrets'  { New-Secrets }
    'deploy'   { Start-Deployment }
    'rollback' { Start-Rollback -Tag $Arg }
    'status'   { Show-Status }
    'logs'     { Show-Logs -Service $Arg }
    'backup'   { New-Backup }
    'destroy'  { Remove-All }
    default {
        Write-Host ""
        Write-Host "  VetCare Platform - Deployment Automation" -ForegroundColor Cyan
        Write-Host "  ========================================="
        Write-Host ""
        Write-Host "  Usage: .\deploy.ps1 <command>"
        Write-Host ""
        Write-Host "  Commands:"
        Write-Host "    secrets    Generate secure random secrets for .env"
        Write-Host "    deploy     Build, migrate, and deploy all services"
        Write-Host "    rollback   Roll back to a specific image tag"
        Write-Host "    status     Show service status and health checks"
        Write-Host "    logs       Tail production logs"
        Write-Host "    backup     Create a database backup"
        Write-Host "    destroy    Tear down everything (DANGEROUS)"
        Write-Host ""
        Write-Host "  Quick Start:"
        Write-Host "    1. Copy-Item .env.production.template .env"
        Write-Host "    2. .\deploy.ps1 secrets    # Generate secrets"
        Write-Host "    3. .\deploy.ps1 deploy     # Deploy everything"
        Write-Host ""
    }
}
