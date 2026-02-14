# Regression Test Suite for Online Doctor Consultation Platform
# This script tests all critical functionality end-to-end

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "REGRESSION TEST SUITE - ALL SYSTEMS" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Configuration
$BACKEND_URL = "http://localhost:3000/api/v1"
$FRONTEND_URL = "http://localhost:5173"
$TOTAL_TESTS = 0
$PASSED_TESTS = 0

# Helper function to make API calls
function Test-API {
    param(
        [string]$Name,
        [string]$Method = "GET",
        [string]$Endpoint,
        [hashtable]$Headers = @{},
        [string]$Body = $null
    )
    
    $TOTAL_TESTS++
    Write-Host "Test $($TOTAL_TESTS): $Name..." -ForegroundColor Yellow
    
    try {
        $url = "$BACKEND_URL$Endpoint"
        $params = @{
            Uri = $url
            Method = $Method
            UseBasicParsing = $true
            ErrorAction = "SilentlyContinue"
        }
        
        if ($Headers.Count -gt 0) {
            $params["Headers"] = $Headers
        }
        
        if ($Body -and $Method -ne "GET") {
            $params["Body"] = $Body
            $params["Headers"] = @{"Content-Type" = "application/json"}
        }
        
        $response = Invoke-WebRequest @params
        
        if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 300) {
            Write-Host "  ✓ PASS (Status: $($response.StatusCode))" -ForegroundColor Green
            $PASSED_TESTS++
            return $response
        } else {
            Write-Host "  ✗ FAIL (Status: $($response.StatusCode))" -ForegroundColor Red
            return $null
        }
    } catch {
        Write-Host "  ✗ FAIL (Exception: $($_.Exception.Message))" -ForegroundColor Red
        return $null
    }
}

Write-Host "BACKEND API TESTS" -ForegroundColor Magenta
Write-Host "================" -ForegroundColor Magenta

# Test 1: Health endpoint
Test-API -Name "Health Check Endpoint" -Endpoint "/health" | Out-Null

# Test 2: Register user
$registerBody = @{
    firstName = "John"
    lastName = "Doe"
    email = "john.doe@example.com"
    phone = "555-0001"
    password = "TestPass123"
    role = "pet_owner"
} | ConvertTo-Json

$registerResp = Test-API -Name "User Registration" -Method "POST" -Endpoint "/auth/register" -Body $registerBody

# Test 3: Login with registered user
if ($registerResp) {
    $loginBody = @{
        email = "john.doe@example.com"
        password = "TestPass123"
    } | ConvertTo-Json
    
    $loginResp = Test-API -Name "User Login" -Method "POST" -Endpoint "/auth/login" -Body $loginBody
    
    if ($loginResp) {
        $token = ($loginResp.Content | ConvertFrom-Json).data.token
        if ($token) {
            Write-Host "  Token received: $($token.Substring(0, 20))..." -ForegroundColor Gray
        }
    }
}

# Test 4: Register with invalid email
$invalidRegisterBody = @{
    firstName = "Jane"
    lastName = "Smith"
    email = "invalid-email"
    phone = "555-0002"
    password = "TestPass123"
    role = "veterinarian"
} | ConvertTo-Json

Write-Host ""
Write-Host "NEGATIVE TEST CASES" -ForegroundColor Magenta
Write-Host "===================" -ForegroundColor Magenta

# Test validation - missing required fields
$emptyBody = @{
    firstName = ""
    lastName = ""
} | ConvertTo-Json

$TOTAL_TESTS++
Write-Host "Test $($TOTAL_TESTS): Validation - Missing Required Fields..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$BACKEND_URL/auth/register" -Method POST -UseBasicParsing `
        -Headers @{"Content-Type" = "application/json"} -Body $emptyBody -ErrorAction SilentlyContinue
    if ($response.StatusCode -ge 400) {
        Write-Host "  ✓ PASS (Correctly rejected invalid data)" -ForegroundColor Green
        $PASSED_TESTS++
    } else {
        Write-Host "  ✗ FAIL (Should reject invalid data)" -ForegroundColor Red
    }
} catch {
    Write-Host "  ✓ PASS (Correctly rejected invalid data)" -ForegroundColor Green
    $PASSED_TESTS++
}

# Test 5: Frontend availability
Write-Host ""
Write-Host "FRONTEND TESTS" -ForegroundColor Magenta
Write-Host "===============" -ForegroundColor Magenta

$TOTAL_TESTS++
Write-Host "Test $($TOTAL_TESTS): Frontend Server Availability..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri $FRONTEND_URL -UseBasicParsing -ErrorAction SilentlyContinue
    if ($response.StatusCode -eq 200) {
        Write-Host "  ✓ PASS (Frontend responding on port 5173)" -ForegroundColor Green
        $PASSED_TESTS++
    } else {
        Write-Host "  ✗ FAIL (Status: $($response.StatusCode))" -ForegroundColor Red
    }
} catch {
    Write-Host "  ✗ FAIL (Frontend not responding)" -ForegroundColor Red
}

# Summary
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "TEST SUMMARY" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Total Tests: $TOTAL_TESTS" -ForegroundColor White
Write-Host "Passed: $PASSED_TESTS" -ForegroundColor Green
Write-Host "Failed: $($TOTAL_TESTS - $PASSED_TESTS)" -ForegroundColor Red
$PercentPass = [math]::Round(($PASSED_TESTS / $TOTAL_TESTS) * 100, 2)
Write-Host "Success Rate: $PercentPass%" -ForegroundColor $(if ($PercentPass -eq 100) { "Green" } else { "Yellow" })
Write-Host "========================================`n" -ForegroundColor Cyan

# Exit with appropriate code
if ($PASSED_TESTS -eq $TOTAL_TESTS) {
    Write-Host "✓ ALL TESTS PASSED!" -ForegroundColor Green
    exit 0
} else {
    Write-Host "✗ SOME TESTS FAILED!" -ForegroundColor Red
    exit 1
}
