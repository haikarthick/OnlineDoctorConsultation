# ⚡ VetCare Platform - Quick Commands Reference

## 🖥️ Server Commands

### Start Backend (Port 3000)
```powershell
cd backend
npm run dev
```

**Output should show:**
```
[info]: Using Mock Database (In-Memory)
[info]: Using Mock Redis Cache (In-Memory)
[info]: Server running on port 3000 in development mode
```

### Start Frontend (Port 5173)
```powershell
cd frontend
npm run dev
```

**Output should show:**
```
VITE v5.4.21 ready in XXX ms
➜  Local:   http://localhost:5173/
```

### Start Both Servers (from root directory)
```powershell
# Terminal 1
cd backend && npm run dev

# Terminal 2 (new terminal)
cd frontend && npm run dev
```

---

## 🧹 Cleanup & Reinstall Commands

### Clean Frontend Dependencies
```powershell
cd frontend
rm -Force node_modules -ErrorAction SilentlyContinue
npm install
```

### Clean Backend Dependencies
```powershell
cd backend
rm -Force node_modules -ErrorAction SilentlyContinue
npm install
```

### Full System Reset
```powershell
# Frontend
cd frontend && rm -Force node_modules && npm install

# Backend
cd backend && rm -Force node_modules && npm install

# Then start both servers
```

---

## 🧪 Testing Commands

### Run PowerShell Tests
```powershell
.\system_test.ps1
```

### Run Bash Tests
```bash
./system_test.sh
```

### Check Backend Health
```powershell
Invoke-WebRequest -Uri 'http://localhost:3000/api/v1/health'
```

### Check Frontend Status
```powershell
Invoke-WebRequest -Uri 'http://localhost:5173'
```

### Check Running Processes
```powershell
Get-Process node | Select-Object ProcessName, Handles, WorkingSet
```

### Check Port Usage
```powershell
netstat -ano | findstr ":3000"  # Backend
netstat -ano | findstr ":5173"  # Frontend
```

---

## 📋 Build Commands

### Build Frontend for Production
```powershell
cd frontend
npm run build
```

Output: Creates `dist/` folder with production-ready files

### Build Backend
```powershell
cd backend
npm run build
```

---

## 🐳 Docker Commands

### Start with Docker Compose
```powershell
docker-compose up
```

### Stop Docker Services
```powershell
docker-compose down
```

### View Docker Logs
```powershell
docker-compose logs -f
```

---

## 📚 Development Workflow

### 1. Initial Setup
```powershell
# Frontend setup
cd frontend && npm install

# Backend setup  
cd backend && npm install
```

### 2. Development Mode
```powershell
# Terminal 1 - Backend
cd backend && npm run dev

# Terminal 2 - Frontend
cd frontend && npm run dev
```

### 3. Access Application
Open browser: `http://localhost:5173`

### 4. Hot Reload
Both servers support hot reload:
- **Frontend**: Automatic on file save (Vite)
- **Backend**: Automatic on file save (ts-node watch)

---

## 🔍 Debugging Commands

### View Backend Logs
```powershell
# If backend running in terminal, logs display directly
# Check for errors like "EADDRINUSE" (port already in use)
```

### Check Frontend Console Errors
```
1. Open http://localhost:5173
2. Press F12 to open DevTools
3. Click "Console" tab
4. Check for errors (red messages)
```

### Monitor Network Requests
```
1. Open http://localhost:5173
2. Press F12 to open DevTools
3. Click "Network" tab
4. Perform actions to see API calls
```

### View Authentication Token
```javascript
// In browser console (F12 → Console):
localStorage.getItem('authToken')
localStorage.getItem('userRole')
localStorage.getItem('userEmail')
```

### Clear Browser Storage
```javascript
// In browser console (F12 → Console):
localStorage.clear()
sessionStorage.clear()
// Then refresh page
```

---

## 🛑 Troubleshooting Commands

### Kill Process on Port 3000
```powershell
$process = Get-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess
$process | Stop-Process -Force
```

### Kill Process on Port 5173
```powershell
$process = Get-Process -Id (Get-NetTCPConnection -LocalPort 5173).OwningProcess
$process | Stop-Process -Force
```

### Kill All Node Processes
```powershell
Get-Process node | Stop-Process -Force
```

### Reset Everything (Complete Clean)
```powershell
# Kill processes
Get-Process node | Stop-Process -Force -ErrorAction SilentlyContinue

# Clean directories
cd frontend && rm -Force node_modules && npm install
cd ../backend && rm -Force node_modules && npm install

# Start fresh
cd ../backend && npm run dev
# In new terminal:
cd frontend && npm run dev
```

---

## 📊 Quick Status Check

### One-Line Status Check
```powershell
Write-Host "Backend:" $(if (Get-Process node -ErrorAction SilentlyContinue) { "Running" } else { "Stopped" }) ; 
Write-Host "Frontend Port:" $(if (netstat -ano -ErrorAction SilentlyContinue | findstr ":5173") { "Listening" } else { "Not Listening" }) ;
Write-Host "Backend Port:" $(if (netstat -ano -ErrorAction SilentlyContinue | findstr ":3000") { "Listening" } else { "Not Listening" })
```

### Detailed Status Check
```powershell
# Backend check
$backend = Invoke-WebRequest -Uri 'http://localhost:3000/api/v1/health' -UseBasicParsing -ErrorAction SilentlyContinue
if ($backend.StatusCode -eq 200) { Write-Host "✓ Backend: OK" } else { Write-Host "✗ Backend: Failed" }

# Frontend check
$frontend = Invoke-WebRequest -Uri 'http://localhost:5173' -UseBasicParsing -ErrorAction SilentlyContinue
if ($frontend.StatusCode -eq 200) { Write-Host "✓ Frontend: OK" } else { Write-Host "✗ Frontend: Failed" }
```

---

## 🔐 Test Credentials

Quick copy-paste credentials for testing:

**Veterinarian:**
```
Email: vet@example.com
Password: VetPass123
Role: Veterinarian
```

**Pet Owner:**
```
Email: owner@example.com
Password: OwnerPass456
Role: Pet Owner
```

**Farmer:**
```
Email: farmer@example.com
Password: FarmPass789
Role: Farmer
```

---

## 📱 Browser DevTools Shortcuts

| Shortcut | Action |
|----------|--------|
| F12 | Open DevTools |
| Ctrl+Shift+C | Inspect Element |
| Ctrl+Shift+J | Open Console |
| Ctrl+Shift+I | Open Inspector |
| F5 | Refresh |
| Ctrl+F5 | Hard Refresh (clear cache) |
| Ctrl+Shift+Delete | Open Storage settings |

---

## 🌐 Access Points

| Service | URL | Port |
|---------|-----|------|
| Frontend | http://localhost:5173 | 5173 |
| Backend API | http://localhost:3000 | 3000 |
| Backend Health | http://localhost:3000/api/v1/health | 3000 |

---

## ✅ Pre-Flight Checklist

Before starting development:

- [ ] Node.js v18+ installed (`node --version`)
- [ ] npm v9+ installed (`npm --version`)
- [ ] Port 3000 available (no other service)
- [ ] Port 5173 available (no other service)
- [ ] Dependencies installed in both frontend and backend
- [ ] Run `npm install` in both directories if unsure
- [ ] Open two terminal windows
- [ ] Start backend in first terminal
- [ ] Start frontend in second terminal
- [ ] Open http://localhost:5173 in browser

---

## 💡 Pro Tips

1. **Keep terminals side-by-side** - Run backend in one terminal, frontend in another
2. **Monitor both outputs** - Watch for errors in both terminals
3. **Hard refresh often** - Use Ctrl+F5 in browser when debugging
4. **Check DevTools** - Open F12 to see any JavaScript errors
5. **Clear cache if issues** - Use Ctrl+Shift+Delete to clear storage
6. **Use consistent ports** - Don't change default 3000 and 5173
7. **Separate terminals** - Never run both in same terminal
8. **Watch file changes** - Both servers auto-reload on code changes
9. **Check process list** - Use `Get-Process node` to verify servers running
10. **Kill cleanly** - Always use Ctrl+C to stop, not force quit

---

## 🎯 Common Workflows

### Adding a New Page
1. Create new component in `frontend/src/pages/`
2. Import in `App.tsx`
3. Add to routing logic
4. Add menu item in `Navigation.tsx` (if needed)
5. Frontend will hot-reload automatically

### Adding a New API Endpoint
1. Create controller in `backend/src/controllers/`
2. Add route in `backend/src/routes/`
3. Backend will auto-reload automatically
4. Test with `Invoke-WebRequest` or browser DevTools

### Testing a Role
1. Logout (click logout button)
2. Register with new email and different role
3. Login with new account
4. Check sidebar shows role-specific menu
5. Test role-specific pages and features

### Debugging API Calls
1. Open browser DevTools (F12)
2. Go to Network tab
3. Perform action that calls API
4. Click API call in Network tab
5. View Request and Response tabs
6. Check Status code (should be 200-299 for success)

---

## 📞 Need Help?

1. **Check logs** - Look at terminal output for error messages
2. **Check console** - Open F12 in browser and check console tab
3. **Check ports** - Use `netstat -ano | findstr ":3000"` to verify ports
4. **Check processes** - Use `Get-Process node` to verify running
5. **Clear cache** - Use `localStorage.clear()` in console
6. **Reinstall** - Run `npm install` again in both directories
7. **Read docs** - Check SYSTEM_COMPLETE.md for detailed info

---

**Last Updated**: 2024
**Platform**: VetCare Online Consultation
**Status**: ✅ Production Ready
