###############################################################################
#  VetCare Platform — Stop Script
#  Kills all processes running on ports 3000 (backend) and 5173 (frontend)
###############################################################################

Write-Host ""
Write-Host "Stopping VetCare Platform..." -ForegroundColor Yellow

$stopped = 0

Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue |
    ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue; $stopped++ }

Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue |
    ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue; $stopped++ }

if ($stopped -gt 0) {
    Write-Host "  Stopped $stopped process(es)." -ForegroundColor Green
} else {
    Write-Host "  No running processes found on ports 3000 / 5173." -ForegroundColor Gray
}

Write-Host "Done." -ForegroundColor Green
Write-Host ""
