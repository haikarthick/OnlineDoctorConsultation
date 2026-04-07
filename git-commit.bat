@echo off
:: ============================================================
:: VetCare - Git Auto Commit (cmd.exe fallback, no pwsh needed)
:: Usage:
::   git-commit.bat                     -> Commit + push with timestamp
::   git-commit.bat "your message"      -> Commit + push with custom message
:: ============================================================
setlocal EnableDelayedExpansion

cd /d "%~dp0"

echo.
echo ======================================
echo   VetCare - Git Auto Commit
echo ======================================
echo.

:: Check git
where git >nul 2>&1
if errorlevel 1 (
    echo ERROR: git is not installed or not in PATH.
    exit /b 1
)

:: Check if git repo
if not exist ".git" (
    echo ERROR: Not a git repository.
    exit /b 1
)

:: Get current branch
for /f "tokens=*" %%b in ('git rev-parse --abbrev-ref HEAD 2^>^&1') do set BRANCH=%%b
echo Branch: %BRANCH%

:: Check for changes
git status --porcelain > "%TEMP%\gitstatus.tmp" 2>&1
for %%A in ("%TEMP%\gitstatus.tmp") do set FILESIZE=%%~zA
if %FILESIZE%==0 (
    echo No changes to commit. Working tree is clean.
    del "%TEMP%\gitstatus.tmp"
    exit /b 0
)
del "%TEMP%\gitstatus.tmp"

:: Build commit message
set MSG=%~1
if "!MSG!"=="" (
    for /f "tokens=1-3 delims=/ " %%a in ('date /t') do set DATEVAL=%%c-%%b-%%a
    for /f "tokens=1-2 delims=: " %%a in ('time /t') do set TIMEVAL=%%a:%%b
    set MSG=update: VetCare changes - !DATEVAL! !TIMEVAL!
)

:: Stage all
echo Staging all changes...
git add -A

:: Commit
echo Committing: !MSG!
git commit -m "!MSG!"
if errorlevel 1 (
    echo ERROR: Commit failed!
    exit /b 1
)

for /f "tokens=*" %%h in ('git rev-parse --short HEAD 2^>^&1') do set HASH=%%h
echo.
echo Committed: !HASH! on !BRANCH!

:: Push
echo Pushing to origin/!BRANCH!...
git push origin !BRANCH!
if errorlevel 1 (
    echo WARNING: Push may have failed. Run: git push origin !BRANCH!
) else (
    echo Pushed successfully!
)

echo.
echo ======================================
echo   Done!
echo ======================================
echo.
endlocal
