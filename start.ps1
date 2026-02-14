###############################################################################
#  VetCare Platform - One-Click Startup Script
#  Usage:   .\start.ps1          (from the project root)
#  Stops:   Run .\stop.ps1       or close the server windows
###############################################################################

$ErrorActionPreference = "SilentlyContinue"
$root = $PSScriptRoot

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "   VetCare Platform - Starting Up           " -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Kill any existing processes on ports 3000 and 5173
Write-Host "[1/5] Cleaning up old processes..." -ForegroundColor Yellow
Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue |
    ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue |
    ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
Start-Sleep -Seconds 2
Write-Host "       Ports cleared." -ForegroundColor Green

# Step 2: Install backend dependencies if needed
$backendPath = Join-Path $root "backend"
Write-Host "[2/5] Checking backend dependencies..." -ForegroundColor Yellow
if (!(Test-Path (Join-Path $backendPath "node_modules"))) {
    Write-Host "       Installing backend packages..." -ForegroundColor Yellow
    Push-Location $backendPath
    npm install --silent 2>$null
    Pop-Location
}
Write-Host "       Backend ready." -ForegroundColor Green

# Step 3: Install frontend dependencies if needed
$frontendPath = Join-Path $root "frontend"
Write-Host "[3/5] Checking frontend dependencies..." -ForegroundColor Yellow
if (!(Test-Path (Join-Path $frontendPath "node_modules"))) {
    Write-Host "       Installing frontend packages..." -ForegroundColor Yellow
    Push-Location $frontendPath
    npm install --silent 2>$null
    Pop-Location
}
Write-Host "       Frontend ready." -ForegroundColor Green

# Step 4: Start Backend in a new window
Write-Host "[4/5] Starting Backend (port 3000)..." -ForegroundColor Yellow
$backendCmd = "Set-Location -LiteralPath '" + $backendPath + "'; " +
              "`$Host.UI.RawUI.WindowTitle = 'VetCare Backend'; " +
              "npx ts-node src/index.ts"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $backendCmd
Start-Sleep -Seconds 6
Write-Host "       Backend started." -ForegroundColor Green

# Step 5: Start Frontend in a new window
Write-Host "[5/5] Starting Frontend (port 5173)..." -ForegroundColor Yellow
$frontendCmd = "Set-Location -LiteralPath '" + $frontendPath + "'; " +
               "`$Host.UI.RawUI.WindowTitle = 'VetCare Frontend'; " +
               "npx vite --host"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $frontendCmd
Start-Sleep -Seconds 4
Write-Host "       Frontend started." -ForegroundColor Green

# Verify
Write-Host ""
Write-Host "  Verifying..." -ForegroundColor Cyan
try {
    $h = Invoke-RestMethod -Uri http://localhost:3000/api/v1/health -TimeoutSec 10
    Write-Host "  Backend API:  OK" -ForegroundColor Green
} catch {
    Write-Host "  Backend API:  Starting... refresh in a few seconds" -ForegroundColor Yellow
}
try {
    $f = Invoke-WebRequest -Uri http://localhost:5173 -UseBasicParsing -TimeoutSec 10
    Write-Host "  Frontend UI:  OK" -ForegroundColor Green
} catch {
    Write-Host "  Frontend UI:  Starting... refresh in a few seconds" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "   VetCare is RUNNING!                      " -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Browser:   http://localhost:5173" -ForegroundColor White
Write-Host "  API:       http://localhost:3000" -ForegroundColor White
Write-Host "  Health:    http://localhost:3000/api/v1/health" -ForegroundColor White
Write-Host ""
Write-Host "  Stop:      .\stop.ps1" -ForegroundColor Gray
Write-Host ""

Start-Process "http://localhost:5173"
