# 🚀 VetCare Platform — Complete Run Guide

> **Step-by-step commands to run the entire project locally from scratch.**
> No Docker, PostgreSQL, or Redis installation needed — the system runs 100 % in-memory for development.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Quick Start (3 Commands)](#2-quick-start-3-commands)
3. [Step-by-Step Guide](#3-step-by-step-guide)
4. [Verify Everything Works](#4-verify-everything-works)
5. [Feature Flags Reference](#5-feature-flags-reference)
6. [API Endpoints Reference](#6-api-endpoints-reference)
7. [Frontend Pages Reference](#7-frontend-pages-reference)
8. [Running Tests](#8-running-tests)
9. [Production Deployment (Docker)](#9-production-deployment-docker)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. Prerequisites

| Tool | Minimum Version | Check Command |
|------|-----------------|---------------|
| **Node.js** | 18.x or higher | `node --version` |
| **npm** | 9.x or higher | `npm --version` |
| **Git** | Any | `git --version` |

> **That's it!** No PostgreSQL, Redis, or Docker needed for local development.
> The system uses in-memory mocks (MOCK_DB=true, MOCK_REDIS=true).

---

## 2. Quick Start (3 Commands)

Open **two separate terminals** in your project folder:

### Terminal 1 — Backend
```powershell
cd backend
npm install
npm run dev
```

### Terminal 2 — Frontend
```powershell
cd frontend
npm install
npm run dev
```

### Open Browser
Navigate to **http://localhost:5173** — the app is ready!

---

## 3. Step-by-Step Guide

### Step 1: Clone / Navigate to the project

```powershell
# If cloning from GitHub:
git clone <your-repo-url>
cd OnlineDoctorConsultation

# Or navigate to your local folder:
cd "e:\VisualStduio Source Code\OnlineDoctorConsultation"
```

### Step 2: Install Backend Dependencies

```powershell
cd backend
npm install
```

This installs: Express, TypeScript, Jest, JWT, bcrypt, Joi, Winston, etc.

### Step 3: Verify the `.env` File

The `.env` file at `backend/.env` should already be configured. Verify it contains:

```dotenv
NODE_ENV=development
PORT=3000
MOCK_DB=true          # Uses in-memory database (no PostgreSQL needed)
MOCK_REDIS=true       # Uses in-memory cache (no Redis needed)
JWT_SECRET=your-super-secret-jwt-key-change-in-production
CORS_ORIGIN=http://localhost:5173

# All feature flags OFF for zero-cost go-live
FEATURE_REDIS_CACHE=false
FEATURE_PAYMENTS=false
FEATURE_EMAIL_NOTIFICATIONS=false
FEATURE_FILE_STORAGE=false
FEATURE_REALTIME_CHAT=false
FEATURE_OAUTH_SSO=false
FEATURE_TWO_FACTOR_AUTH=false
FEATURE_AUDIT_LOGGING=false
FEATURE_ADVANCED_RATE_LIMITING=false
FEATURE_ANALYTICS=false
```

### Step 4: Start the Backend Server

```powershell
npm run dev
```

**Expected output:**
```
[info]: Using Mock Database (In-Memory)
[info]: Using Mock Redis Cache (In-Memory)
[info]: Mock database connected successfully
[info]: Database initialized
[info]: Mock Redis cache connected successfully
[info]: Cache initialized
[info]: Server running on port 3000 in development mode
```

### Step 5: Open a New Terminal — Install Frontend Dependencies

```powershell
cd frontend
npm install
```

This installs: React 18, Vite 5, react-router-dom v6, Axios, etc.

### Step 6: Start the Frontend Dev Server

```powershell
npm run dev
```

**Expected output:**
```
VITE v5.x.x  ready in XXXms

  ➜  Local:   http://localhost:5173/
  ➜  Network: http://192.168.x.x:5173/
```

### Step 7: Open the App

Navigate to **http://localhost:5173** in your browser.

- **Home Page** → Click "Get Started" → Register → Login → Dashboard
- The Vite dev server automatically proxies `/api/*` requests to the backend on port 3000.

---

## 4. Verify Everything Works

### 4.1 Health Check (Backend)

Open a third terminal or use your browser:

```powershell
# PowerShell
Invoke-RestMethod -Uri http://localhost:3000/api/v1/health | ConvertTo-Json

# Or curl (if available)
curl http://localhost:3000/api/v1/health
```

**Expected:**
```json
{ "status": "OK", "timestamp": "2025-..." }
```

### 4.2 Feature Flags Check

```powershell
Invoke-RestMethod -Uri http://localhost:3000/api/v1/features | ConvertTo-Json -Depth 3
```

**Expected:** All 10 flags showing `false` (zero-cost mode).

### 4.3 Test Registration via API

```powershell
$body = '{"email":"demo@vetcare.com","password":"Demo@1234","firstName":"Demo","lastName":"User","phone":"+1234567890","role":"pet_owner"}'
Invoke-RestMethod -Uri http://localhost:3000/api/v1/auth/register -Method POST -Body $body -ContentType 'application/json' | ConvertTo-Json -Depth 3
```

### 4.4 Test Login via API

```powershell
$body = '{"email":"demo@vetcare.com","password":"Demo@1234"}'
Invoke-RestMethod -Uri http://localhost:3000/api/v1/auth/login -Method POST -Body $body -ContentType 'application/json' | ConvertTo-Json -Depth 3
```

### 4.5 Full Browser Test

1. Go to http://localhost:5173
2. Click **Get Started** → lands on `/register`
3. Fill in: First Name, Last Name, Email, Phone, Password, Role
4. Click **Register** → auto-logs you in → Dashboard
5. Use the sidebar to navigate: Dashboard, Consultations, Animals, Medical Records, Settings

---

## 5. Feature Flags Reference

All optional features are OFF by default. Enable any feature by editing `backend/.env`:

| Flag | Env Variable | Default | What It Enables |
|------|-------------|---------|-----------------|
| Redis Cache | `FEATURE_REDIS_CACHE=true` | OFF | Real Redis instead of in-memory cache |
| Payments | `FEATURE_PAYMENTS=true` | OFF | Stripe payment processing endpoints |
| Email Notifications | `FEATURE_EMAIL_NOTIFICATIONS=true` | OFF | SendGrid / SES email sending |
| File Storage | `FEATURE_FILE_STORAGE=true` | OFF | S3 / cloud file uploads |
| Real-time Chat | `FEATURE_REALTIME_CHAT=true` | OFF | Socket.io live consultation chat |
| OAuth SSO | `FEATURE_OAUTH_SSO=true` | OFF | Google / Facebook social login |
| Two-Factor Auth | `FEATURE_TWO_FACTOR_AUTH=true` | OFF | TOTP 2FA / MFA |
| Audit Logging | `FEATURE_AUDIT_LOGGING=true` | OFF | Database audit trail for compliance |
| Rate Limiting | `FEATURE_ADVANCED_RATE_LIMITING=true` | OFF | Advanced per-user rate limiting |
| Analytics | `FEATURE_ANALYTICS=true` | OFF | Analytics / reporting dashboard |

### How to Enable a Feature

1. Open `backend/.env`
2. Change the flag from `false` to `true`:
   ```dotenv
   FEATURE_PAYMENTS=true
   ```
3. Restart the backend: `npm run dev`
4. Verify: `GET http://localhost:3000/api/v1/features`

### Core Features (Always ON)

These are always enabled and cannot be turned off:
- ✅ User Registration & Login (JWT authentication)
- ✅ User Profiles
- ✅ Consultation Management (CRUD)
- ✅ Animal / Pet Management (CRUD)
- ✅ Veterinarian Profiles
- ✅ Medical Records
- ✅ Notifications (in-app)
- ✅ Reviews & Ratings

---

## 6. API Endpoints Reference

**Base URL:** `http://localhost:3000/api/v1`

### Public Endpoints (No Auth Required)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/features` | List all feature flags |
| POST | `/auth/register` | Register new user |
| POST | `/auth/login` | Login, receive JWT token |

### Protected Endpoints (JWT Required)

Add header: `Authorization: Bearer <token>`

#### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/auth/profile` | Get current user profile |

#### Consultations
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/consultations` | Create a consultation |
| GET | `/consultations` | List consultations |
| GET | `/consultations/:id` | Get consultation details |
| PUT | `/consultations/:id` | Update consultation |

#### Animals / Pets
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/animals` | Add a pet |
| GET | `/animals` | List your pets |
| GET | `/animals/:id` | Get pet details |
| PUT | `/animals/:id` | Update pet info |
| DELETE | `/animals/:id` | Remove pet (soft delete) |

#### Veterinarian Profiles
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/vet-profiles` | Create vet profile |
| GET | `/vet-profiles/me` | Get my vet profile |
| GET | `/vet-profiles` | List all vets |
| GET | `/vet-profiles/:userId` | Get specific vet |
| PUT | `/vet-profiles` | Update my vet profile |

#### Medical Records
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/medical-records` | Create record |
| GET | `/medical-records` | List records |
| GET | `/medical-records/:id` | Get record |
| PUT | `/medical-records/:id` | Update record |
| DELETE | `/medical-records/:id` | Delete record |

#### Notifications
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/notifications` | List notifications |
| PUT | `/notifications/:id/read` | Mark as read |
| PUT | `/notifications/read-all` | Mark all as read |

#### Payments (Feature-gated)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/payments` | Create payment |
| GET | `/payments` | List my payments |

> **Note:** Payment endpoints return 404 unless `FEATURE_PAYMENTS=true` in `.env`.

#### Reviews
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/reviews` | Submit a review |
| GET | `/reviews/vet/:vetUserId` | Get reviews for a vet |

---

## 7. Frontend Pages Reference

| Route | Page | Description |
|-------|------|-------------|
| `/` | Home | Landing page with Get Started CTA |
| `/login` | Login | Email/password login form |
| `/register` | Register | Registration with role selection |
| `/dashboard` | Dashboard | Overview with stats cards |
| `/consultations` | Consultations | Create & manage consultations |
| `/appointments` | Appointments | Appointment scheduling |
| `/medical-records` | Medical Records | View medical records |
| `/animals` | Animals | Add & manage your pets |
| `/settings` | Settings | User settings |

---

## 8. Running Tests

### Backend Unit & Integration Tests

```powershell
cd backend

# Run all tests with coverage
npm test

# Run only unit tests
npm run test:unit

# Run only integration tests
npm run test:integration

# Watch mode (re-runs on file changes)
npm run test:watch
```

**Expected:** 3 test suites, 18 tests, all passing.

### TypeScript Compilation Check

```powershell
# Backend
cd backend
npx tsc --noEmit

# Frontend
cd frontend
npx tsc --noEmit
```

**Expected:** Zero errors on both.

### Frontend Dev Build Check

```powershell
cd frontend
npm run build
```

---

## 9. Production Deployment (Docker)

When you're ready for production with real PostgreSQL and Redis:

### Step 1: Update Environment Variables

In `backend/.env`, change:
```dotenv
MOCK_DB=false
MOCK_REDIS=false
```

And enable desired features:
```dotenv
FEATURE_REDIS_CACHE=true
FEATURE_AUDIT_LOGGING=true
```

### Step 2: Start with Docker Compose

```powershell
docker-compose up --build -d
```

This starts:
- **PostgreSQL 15** on port 5432
- **Redis 7** on port 6379
- **Backend API** on port 3000

### Step 3: Access the App

- **Backend API:** http://localhost:3000/api/v1/health
- **Frontend:** Serve the built frontend separately or add nginx container

### Docker Compose Services

| Service | Image | Port | Description |
|---------|-------|------|-------------|
| postgres | postgres:15-alpine | 5432 | PostgreSQL database |
| redis | redis:7-alpine | 6379 | Redis cache |
| backend | Custom Node.js | 3000 | Express API server |

---

## 10. Troubleshooting

### "Port 3000 already in use"

```powershell
# Windows: Find and kill the process
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Then restart
cd backend && npm run dev
```

### "Port 5173 already in use"

```powershell
netstat -ano | findstr :5173
taskkill /PID <PID> /F

cd frontend && npm run dev
```

### "Module not found" errors

```powershell
# Reinstall dependencies
cd backend && Remove-Item -Recurse -Force node_modules && npm install
cd ../frontend && Remove-Item -Recurse -Force node_modules && npm install
```

### "ts-node not found"

```powershell
cd backend
npm install
npx ts-node --version  # Should print the version
```

### Backend starts but API returns errors

1. Check `.env` exists in `backend/` folder
2. Verify `MOCK_DB=true` and `MOCK_REDIS=true` are set
3. Check the console logs for specific error messages

### Frontend shows blank page

1. Ensure the backend is running on port 3000
2. Check browser console (F12) for errors
3. Verify `vite.config.ts` has the proxy configuration:
   ```ts
   proxy: { '/api': { target: 'http://localhost:3000', changeOrigin: true } }
   ```

### Tests fail

```powershell
cd backend
npm test -- --verbose 2>&1
```

Look for specific assertion failures in the output.

---

## Architecture Overview

```
┌─────────────┐     proxy /api/*     ┌──────────────────┐
│   Browser    │ ──────────────────── │  Vite Dev Server │
│  :5173       │                      │  (React + TS)    │
└─────────────┘                      └────────┬─────────┘
                                              │
                                     http://localhost:3000
                                              │
                                     ┌────────▼─────────┐
                                     │  Express Backend  │
                                     │  (TypeScript)     │
                                     ├──────────────────┤
                                     │  Feature Flags   │ ← All OFF by default
                                     │  JWT Auth        │ ← Always ON
                                     │  Mock DB         │ ← In-memory (dev)
                                     │  Mock Redis      │ ← In-memory (dev)
                                     └──────────────────┘
```

### Database Tables (10)

| Table | Description |
|-------|-------------|
| `users` | All users (pet owners, farmers, vets) |
| `vet_profiles` | Veterinarian-specific profile data |
| `animals` | Pets / animals owned by users |
| `consultations` | Consultation requests & records |
| `medical_records` | Medical history for animals |
| `sessions` | Active JWT sessions |
| `payments` | Payment records (feature-gated) |
| `notifications` | In-app notifications |
| `reviews` | Consultation reviews & ratings |
| `audit_logs` | Audit trail (feature-gated) |

---

## One-Liner Start Scripts

### Start Everything (PowerShell)

```powershell
# From the project root — starts both servers
Start-Process powershell -ArgumentList "-NoExit","-Command","cd backend; npm run dev"
Start-Process powershell -ArgumentList "-NoExit","-Command","cd frontend; npm run dev"
```

### Stop Everything (PowerShell)

```powershell
# Kill Node.js processes on ports 3000 and 5173
Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
```

---

**🎉 You're all set! The VetCare platform is running locally with zero infrastructure cost.**
