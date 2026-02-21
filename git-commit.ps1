# ============================================================
# VetCare - Auto Git Commit & Push Script
# ============================================================
# Usage:
#   .\git-commit.ps1                     → Commit + push with timestamp message
#   .\git-commit.ps1 "your message"      → Commit + push with custom message
#   .\git-commit.ps1 -NoPush             → Commit only (skip push)
# ============================================================

param(
    [Parameter(Position = 0)]
    [string]$Message = "",

    [switch]$NoPush
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host ""
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "  VetCare - Git Auto Commit" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# Navigate to repo root
Set-Location $RepoRoot
Write-Host "[1/5] Repository: $RepoRoot" -ForegroundColor Gray

# Check if git is available
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Host "ERROR: git is not installed or not in PATH." -ForegroundColor Red
    exit 1
}

# Check if this is a git repo
if (-not (Test-Path ".git")) {
    Write-Host "ERROR: Not a git repository. Run 'git init' first." -ForegroundColor Red
    exit 1
}

# Show current branch
$branch = git rev-parse --abbrev-ref HEAD 2>&1
Write-Host "[2/5] Branch: $branch" -ForegroundColor Gray

# Check for changes
$status = git status --porcelain 2>&1
if ([string]::IsNullOrWhiteSpace($status)) {
    Write-Host ""
    Write-Host "No changes to commit. Working tree is clean." -ForegroundColor Green
    Write-Host ""
    exit 0
}

# Show summary of changes
$modified = ($status | Where-Object { $_ -match '^ ?M' }).Count
$added    = ($status | Where-Object { $_ -match '^\?\?' -or $_ -match '^ ?A' }).Count
$deleted  = ($status | Where-Object { $_ -match '^ ?D' }).Count
$total    = ($status | Measure-Object).Count

Write-Host "[3/5] Changes detected:" -ForegroundColor Yellow
Write-Host "       Modified: $modified | New: $added | Deleted: $deleted | Total: $total" -ForegroundColor Yellow
Write-Host ""

# Show changed files
Write-Host "  Changed files:" -ForegroundColor Gray
$status | ForEach-Object {
    $statusCode = $_.Substring(0, 2).Trim()
    $file = $_.Substring(3)
    switch ($statusCode) {
        "M"  { Write-Host "    ~ $file" -ForegroundColor DarkYellow }
        "A"  { Write-Host "    + $file" -ForegroundColor Green }
        "D"  { Write-Host "    - $file" -ForegroundColor Red }
        "??" { Write-Host "    + $file (new)" -ForegroundColor Green }
        default { Write-Host "    ? $file [$statusCode]" -ForegroundColor Gray }
    }
}
Write-Host ""

# Stage all changes
Write-Host "[4/5] Staging all changes..." -ForegroundColor Gray
git add -A 2>&1 | Out-Null

# Build commit message
if ([string]::IsNullOrWhiteSpace($Message)) {
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $Message = "update: VetCare changes - $timestamp"
}

# Commit
Write-Host "[5/5] Committing: $Message" -ForegroundColor Gray
$commitResult = git commit -m $Message 2>&1

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "ERROR: Commit failed!" -ForegroundColor Red
    Write-Host $commitResult -ForegroundColor Red
    exit 1
}

# Show commit info
$commitHash = git rev-parse --short HEAD 2>&1
Write-Host ""
Write-Host "Committed successfully!" -ForegroundColor Green
Write-Host "  Commit: $commitHash" -ForegroundColor Gray
Write-Host "  Branch: $branch" -ForegroundColor Gray
Write-Host "  Files:  $total changed" -ForegroundColor Gray

# Push (default behavior — use -NoPush to skip)
if (-not $NoPush) {
    Write-Host ""
    Write-Host "Pushing to origin/$branch..." -ForegroundColor Cyan

    # git writes progress to stderr, so capture both streams
    $pushOutput = git push origin $branch 2>&1 | Out-String

    # Check if push actually succeeded by verifying local matches remote
    $localHash  = git rev-parse HEAD 2>&1
    $remoteHash = git ls-remote origin $branch 2>&1 | ForEach-Object { ($_ -split '\t')[0] }

    if ($localHash -eq $remoteHash) {
        Write-Host "Pushed successfully to origin/$branch!" -ForegroundColor Green
    } else {
        Write-Host "Push may have failed:" -ForegroundColor Red
        Write-Host $pushOutput -ForegroundColor Yellow
        Write-Host "You can push manually: git push origin $branch" -ForegroundColor Yellow
    }
} else {
    Write-Host ""
    Write-Host "Skipping push (-NoPush flag set)." -ForegroundColor Yellow
    Write-Host "Push manually: git push origin $branch" -ForegroundColor Gray
}

Write-Host ""
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "  Done!" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""
