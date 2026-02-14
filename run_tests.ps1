Write-Host "REGRESSION TEST SUITE" -ForegroundColor Cyan
Write-Host "=====================`n" -ForegroundColor Cyan

$passed = 0
$failed = 0

Write-Host "Test 1: Backend Health Endpoint..." -ForegroundColor Yellow
try {
    $resp = Invoke-WebRequest -Uri "http://localhost:3000/api/v1/health" -UseBasicParsing -ErrorAction SilentlyContinue
    if ($resp.StatusCode -eq 200) {
        Write-Host "  PASS - Backend responding" -ForegroundColor Green
        $passed++
    } else {
        Write-Host "  FAIL - Status $($resp.StatusCode)" -ForegroundColor Red
        $failed++
    }
} catch {
    Write-Host "  FAIL - Connection error" -ForegroundColor Red
    $failed++
}

Write-Host "`nTest 2: User Registration..." -ForegroundColor Yellow
try {
    $body = @{firstName="Test";lastName="User";email="test@test.com";phone="1234567890";password="TestPass123";role="pet_owner"} | ConvertTo-Json
    $resp = Invoke-WebRequest -Uri "http://localhost:3000/api/v1/auth/register" -Method POST -UseBasicParsing `
        -Headers @{"Content-Type"="application/json"} -Body $body -ErrorAction SilentlyContinue
    if ($resp.StatusCode -eq 201) {
        Write-Host "  PASS - User registered" -ForegroundColor Green
        $passed++
    } else {
        Write-Host "  FAIL - Status $($resp.StatusCode)" -ForegroundColor Red
        $failed++
    }
} catch {
    Write-Host "  FAIL - $($_.Exception.Message)" -ForegroundColor Red
    $failed++
}

Write-Host "`nTest 3: User Login..." -ForegroundColor Yellow
try {
    $body = @{email="test@test.com";password="TestPass123"} | ConvertTo-Json
    $resp = Invoke-WebRequest -Uri "http://localhost:3000/api/v1/auth/login" -Method POST -UseBasicParsing `
        -Headers @{"Content-Type"="application/json"} -Body $body -ErrorAction SilentlyContinue
    if ($resp.StatusCode -eq 200) {
        Write-Host "  PASS - Login successful" -ForegroundColor Green
        $passed++
    } else {
        Write-Host "  FAIL - Status $($resp.StatusCode)" -ForegroundColor Red
        $failed++
    }
} catch {
    Write-Host "  FAIL - $($_.Exception.Message)" -ForegroundColor Red
    $failed++
}

Write-Host "`nTest 4: Frontend Server..." -ForegroundColor Yellow
try {
    $resp = Invoke-WebRequest -Uri "http://localhost:5173" -UseBasicParsing -ErrorAction SilentlyContinue
    if ($resp.StatusCode -eq 200) {
        Write-Host "  PASS - Frontend running" -ForegroundColor Green
        $passed++
    } else {
        Write-Host "  FAIL - Status $($resp.StatusCode)" -ForegroundColor Red
        $failed++
    }
} catch {
    Write-Host "  FAIL - Frontend not responding" -ForegroundColor Red
    $failed++
}

Write-Host "`n=====================" -ForegroundColor Cyan
Write-Host "Total Passed: $passed" -ForegroundColor Green
Write-Host "Total Failed: $failed" -ForegroundColor Red
Write-Host "=====================" -ForegroundColor Cyan
