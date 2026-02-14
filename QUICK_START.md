# QUICK START GUIDE

## Prerequisites Verified ✓
- Node.js v24.13.0 ✓
- npm 11.6.2 ✓
- PostgreSQL 18 (installed on E:\Program Files\PostgreSQL\18) ✓
- Database "veterinary_consultation" created ✓
- All dependencies installed ✓

---

## START THE APPLICATION (3 Simple Steps)

### Step 1: Open Terminal 1 - Start Backend
```powershell
cd "e:\VisualStduio Source Code\OnlineDoctorConsultation\backend"
npm run dev
```

**Expected Output:**
```
> veterinary-consultation-backend@1.0.0 dev
> ts-node --project tsconfig.json src/index.ts

[info]: Using Mock Database (In-Memory)
[info]: Mock database connected successfully
[info]: Database initialized
[info]: Server running on port 3000 in development mode
```

✓ Backend is ready when you see: **"Server running on port 3000"**

---

### Step 2: Open Terminal 2 - Start Frontend
```powershell
cd "e:\VisualStduio Source Code\OnlineDoctorConsultation\frontend"
npm run dev
```

**Expected Output:**
```
  VITE v5.4.21  ready in 3696 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```

✓ Frontend is ready when you see: **"Local: http://localhost:5173/"**

---

### Step 3: Open Browser
```
http://localhost:5173
```

✓ You should see the **Registration/Login Page**

---

## TEST THE APPLICATION

### Registration
1. Click "Create Account" button
2. Fill in form:
   - First Name: John
   - Last Name: Doe
   - Email: john@test.com
   - Phone: 555-1234
   - Password: TestPass123
   - Role: Pet Owner
3. Click "REGISTER"
4. Should see success message

### Login
1. You're redirected to login
2. Enter:
   - Email: john@test.com
   - Password: TestPass123
3. Click "LOGIN"
4. Should see Dashboard with:
   - Active Consultations
   - My Pets section
   - Appointment History
   - Medical Records

---

## API ENDPOINTS (Direct Testing)

### Health Check
```powershell
Invoke-WebRequest -Uri "http://localhost:3000/api/v1/health" -UseBasicParsing
```

### Register User
```powershell
$body = @{
    firstName = "Test"
    lastName = "User"
    email = "test@example.com"
    phone = "1234567890"
    password = "TestPass123"
    role = "pet_owner"
} | ConvertTo-Json

Invoke-WebRequest -Uri "http://localhost:3000/api/v1/auth/register" `
    -Method POST `
    -ContentType "application/json" `
    -Body $body `
    -UseBasicParsing
```

### Login
```powershell
$body = @{
    email = "test@example.com"
    password = "TestPass123"
} | ConvertTo-Json

Invoke-WebRequest -Uri "http://localhost:3000/api/v1/auth/login" `
    -Method POST `
    -ContentType "application/json" `
    -Body $body `
    -UseBasicParsing
```

---

## STOP THE APPLICATION

To gracefully stop the servers:
1. **Backend**: Press `Ctrl+C` in Terminal 1
2. **Frontend**: Press `Ctrl+C` in Terminal 2

Both will shutdown cleanly.

---

## LOGS AND DEBUGGING

### Backend Logs
Location: `backend/logs/`
- `combined.log` - All logs
- `error.log` - Error messages only

View latest logs:
```powershell
Get-Content "backend/logs/combined.log" -Tail 20
```

### Frontend Debug
- Open Browser DevTools: `F12`
- Check Console tab for React/JavaScript errors
- Check Network tab for API calls

---

## COMMON ISSUES & FIXES

### "Port 3000 already in use"
```powershell
# Find process using port 3000
netstat -ano | findstr ":3000"

# Kill the process (replace PID with actual number)
taskkill /PID <PID> /F
```

### "Port 5173 already in use"
```powershell
# Find process using port 5173
netstat -ano | findstr ":5173"

# Kill the process
taskkill /PID <PID> /F
```

### "Cannot find module" errors
```powershell
# Reinstall dependencies
rm -Recurse node_modules
npm install
```

### Backend crashes immediately
- Check .env file exists and is readable
- Check PostgreSQL password is correct
- Try clearing cache: `npm cache clean --force`

### Frontend won't load
- Clear browser cache: `Ctrl+Shift+Delete`
- Clear Vite cache: Delete `.vite` folder in frontend
- Restart frontend server

---

## ACCOUNT FOR TESTING

Use these credentials to test without registering:

| Field | Value |
|-------|-------|
| Email | test@example.com |
| Password | TestPass123 |

Create new test accounts as needed - they're stored in mock database.

---

## NEXT: REGISTER A NEW USER

1. Go to http://localhost:5173
2. Click "Create Account"
3. Fill all fields
4. Click REGISTER
5. Login with your credentials
6. Access Dashboard

---

## PROJECT FILES

- **Backend**: `backend/src/` (TypeScript)
- **Frontend**: `frontend/src/` (React + TypeScript)
- **Database**: PostreSQL @ localhost:5432
- **Configuration**: `.env` files
- **Tests**: `backend/tests/`

---

## NEED HELP?

### Check Status
```powershell
# Backend health
Invoke-WebRequest -Uri http://localhost:3000/api/v1/health

# Frontend
Invoke-WebRequest -Uri http://localhost:5173
```

### View Logs
```powershell
Get-Content backend/logs/combined.log -Tail 50
```

### Restart Everything
```powershell
# Terminal 1: Kill backend
# Terminal 2: Kill frontend
# Then run steps 1-3 above again
```

---

**Happy Coding! 🎉**
