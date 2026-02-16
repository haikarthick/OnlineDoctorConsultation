###############################################################################
#  VetCare Platform - One-Click Startup Script
#  Usage:   .\start.ps1          (from the project root)
#  Stops:   Run .\stop.ps1       or close the server windows
###############################################################################

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
    Push-Location -LiteralPath $backendPath
    npm install --silent 2>$null
    Pop-Location
}
Write-Host "       Backend ready." -ForegroundColor Green

# Step 3: Install frontend dependencies if needed
$frontendPath = Join-Path $root "frontend"
Write-Host "[3/5] Checking frontend dependencies..." -ForegroundColor Yellow
if (!(Test-Path (Join-Path $frontendPath "node_modules"))) {
    Write-Host "       Installing frontend packages..." -ForegroundColor Yellow
    Push-Location -LiteralPath $frontendPath
    npm install --silent 2>$null
    Pop-Location
}
Write-Host "       Frontend ready." -ForegroundColor Green

# Step 4: Start Backend in a new window
Write-Host "[4/5] Starting Backend (port 3000)..." -ForegroundColor Yellow
$backendCmd = "Set-Location -LiteralPath '${backendPath}'; `$Host.UI.RawUI.WindowTitle = 'VetCare Backend'; Write-Host 'Starting VetCare Backend...' -ForegroundColor Cyan; npx ts-node src/index.ts"
$backendBytes = [System.Text.Encoding]::Unicode.GetBytes($backendCmd)
$backendEncoded = [Convert]::ToBase64String($backendBytes)
Start-Process powershell -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-EncodedCommand", $backendEncoded
Start-Sleep -Seconds 10
Write-Host "       Backend started." -ForegroundColor Green

# Step 5: Start Frontend in a new window
Write-Host "[5/5] Starting Frontend (port 5173)..." -ForegroundColor Yellow
$frontendCmd = "Set-Location -LiteralPath '${frontendPath}'; `$Host.UI.RawUI.WindowTitle = 'VetCare Frontend'; Write-Host 'Starting VetCare Frontend...' -ForegroundColor Cyan; npx vite --host --port 5173"
$frontendBytes = [System.Text.Encoding]::Unicode.GetBytes($frontendCmd)
$frontendEncoded = [Convert]::ToBase64String($frontendBytes)
Start-Process powershell -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-EncodedCommand", $frontendEncoded
Start-Sleep -Seconds 10
Write-Host "       Frontend started." -ForegroundColor Green

# Verify with retries
Write-Host ""
Write-Host "  Verifying..." -ForegroundColor Cyan

$backendOk = $false
$frontendOk = $false
for ($i = 1; $i -le 5; $i++) {
    if (!$backendOk) {
        try {
            $null = Invoke-WebRequest -Uri http://localhost:3000/api/v1/health -UseBasicParsing -TimeoutSec 3
            $backendOk = $true
        } catch {}
    }
    if (!$frontendOk) {
        try {
            $null = Invoke-WebRequest -Uri http://localhost:5173 -UseBasicParsing -TimeoutSec 3
            $frontendOk = $true
        } catch {}
    }
    if ($backendOk -and $frontendOk) { break }
    Write-Host "       Waiting for servers (attempt $i/5)..." -ForegroundColor Gray
    Start-Sleep -Seconds 4
}

if ($backendOk) {
    Write-Host "  Backend API:  OK" -ForegroundColor Green
} else {
    Write-Host "  Backend API:  FAILED to start - check the VetCare Backend window for errors" -ForegroundColor Red
}
if ($frontendOk) {
    Write-Host "  Frontend UI:  OK" -ForegroundColor Green
} else {
    Write-Host "  Frontend UI:  FAILED to start - check the VetCare Frontend window for errors" -ForegroundColor Red
}

Write-Host ""
if ($backendOk -and $frontendOk) {
    Write-Host "============================================" -ForegroundColor Green
    Write-Host "   VetCare is RUNNING!                      " -ForegroundColor Green
    Write-Host "============================================" -ForegroundColor Green
} else {
    Write-Host "============================================" -ForegroundColor Yellow
    Write-Host "   VetCare partially started - see above    " -ForegroundColor Yellow
    Write-Host "============================================" -ForegroundColor Yellow
}
Write-Host ""
Write-Host "  Browser:   http://localhost:5173" -ForegroundColor White
Write-Host "  API:       http://localhost:3000" -ForegroundColor White
Write-Host "  Health:    http://localhost:3000/api/v1/health" -ForegroundColor White
Write-Host ""
Write-Host "  Stop:      .\stop.ps1" -ForegroundColor Gray
Write-Host ""

if ($frontendOk) {
    Start-Process "http://localhost:5173"
}
