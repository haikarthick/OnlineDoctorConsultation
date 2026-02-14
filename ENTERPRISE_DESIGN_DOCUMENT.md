# Enterprise Solution Design Document

## VetCare — Online Veterinary Consultation Platform

**Version:** 2.0  
**Date:** February 14, 2026  
**Classification:** Internal — Engineering  

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current State Analysis](#2-current-state-analysis)
3. [Issues Identified & Fixes Applied](#3-issues-identified--fixes-applied)
4. [Target Architecture](#4-target-architecture)
5. [Backend Design](#5-backend-design)
6. [Frontend Design](#6-frontend-design)
7. [Database Design](#7-database-design)
8. [Security Architecture](#8-security-architecture)
9. [Infrastructure & DevOps](#9-infrastructure--devops)
10. [API Design Standards](#10-api-design-standards)
11. [Testing Strategy](#11-testing-strategy)
12. [Performance & Scalability](#12-performance--scalability)
13. [Monitoring & Observability](#13-monitoring--observability)
14. [Recommended Improvements Roadmap](#14-recommended-improvements-roadmap)
15. [Cost Estimation](#15-cost-estimation)

---

## 1. Executive Summary

VetCare is an online veterinary consultation platform connecting pet owners and farmers with licensed veterinarians. The platform supports real-time consultations, appointment management, medical records, and role-based access control.

### Current Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18 + TypeScript + Vite |
| **Backend** | Node.js + Express + TypeScript |
| **Database** | PostgreSQL 15 |
| **Cache** | Redis 7 |
| **Auth** | JWT (bcrypt + jsonwebtoken) |
| **Container** | Docker + Docker Compose |

### Key Metrics (Post-Fix)

- **Backend Tests:** 18/18 passing (100%)
- **TypeScript:** Zero compilation errors
- **API Coverage:** Auth (register, login, profile) + Consultations (CRUD) + Health check
- **Security:** Helmet, CORS, rate limiting, JWT auth, input validation (Joi)
- **Roles:** pet_owner, farmer, veterinarian, admin

---

## 2. Current State Analysis

### 2.1 Strengths
- Clean TypeScript codebase with proper typing
- Layered architecture (Controller → Service → Database)
- Comprehensive error hierarchy (AppError → ValidationError, NotFoundError, etc.)
- Structured logging with Winston (file + console transports)
- Security middleware (Helmet, CORS, rate limiting)
- Docker Compose for local development
- Mock database/Redis for development without infrastructure
- Role-based access control

### 2.2 Weaknesses Identified

| # | Category | Issue | Severity |
|---|----------|-------|----------|
| 1 | **Backend** | 404 handler placed after error handler (wrong order) | 🔴 Critical |
| 2 | **Backend** | `ConsultationService.getConsultation` wraps `NotFoundError` inside `DatabaseError` | 🔴 Critical |
| 3 | **Backend** | Generic `Error('Access denied')` instead of `ForbiddenError` | 🟡 Medium |
| 4 | **Backend** | `cacheManager.ts` uses `if (true)` — always mock Redis | 🟡 Medium |
| 5 | **Backend** | Cache `connect()` never called in server startup | 🟡 Medium |
| 6 | **Backend** | No SIGINT handler for graceful shutdown | 🟡 Medium |
| 7 | **Backend** | `errors.ts` has logging side-effects in constructors | 🟡 Medium |
| 8 | **Backend** | No input validation on API routes (Joi schemas defined but unused) | 🔴 Critical |
| 9 | **Backend** | CORS origin defaults to port 3001 but frontend runs on 5173 | 🟡 Medium |
| 10 | **Backend** | Missing `.env.example` documentation | 🟢 Low |
| 11 | **Frontend** | No API service layer (empty `services/` directory) | 🔴 Critical |
| 12 | **Frontend** | No error boundary component | 🟡 Medium |
| 13 | **Frontend** | `admin` role missing from `UserRole` type | 🟡 Medium |
| 14 | **Frontend** | Manual state-based routing instead of react-router-dom | 🟢 Low |
| 15 | **Frontend** | Static hardcoded data in all module pages | 🟡 Medium |
| 16 | **Infra** | Dockerfile uses `npm ci --only=production` then `npm run build` (tsc not available) | 🔴 Critical |
| 17 | **Infra** | Docker Compose backend missing env vars and health check | 🟡 Medium |
| 18 | **Infra** | No restart policies on services | 🟢 Low |
| 19 | **Database** | No `updated_at` auto-update trigger | 🟡 Medium |
| 20 | **Database** | Missing sessions table for refresh tokens | 🟡 Medium |

---

## 3. Issues Identified & Fixes Applied

### 3.1 Backend Fixes

#### ✅ Fix 1: Error Handler Ordering (`app.ts`)
**Problem:** The 404 handler was placed after the error handler middleware, meaning unhandled errors would pass through the error handler, but 404 responses for unknown routes would never reach it properly.

**Fix:** Moved the 404 handler before the error handler. The error handler is now the last middleware in the chain.

#### ✅ Fix 2: NotFoundError Unwrapping (`ConsultationService.ts`)
**Problem:** `getConsultation()` threw `NotFoundError` inside the try block, but the catch block wrapped ALL errors (including `NotFoundError`) in a `DatabaseError`, masking the original 404 status.

**Fix:** Added `instanceof NotFoundError` check in catch block to re-throw application errors without wrapping.

#### ✅ Fix 3: ForbiddenError Usage (`ConsultationController.ts`)
**Problem:** Access denied checks used `throw new Error('Access denied')` — a generic error that produces 500 instead of 403.

**Fix:** Replaced with `ForbiddenError` from the error hierarchy, producing proper 403 responses.

#### ✅ Fix 4: Cache Manager Environment Detection (`cacheManager.ts`)
**Problem:** Hardcoded `if (true)` always used mock Redis regardless of environment.

**Fix:** Changed to `process.env.NODE_ENV !== 'production' || process.env.MOCK_REDIS === 'true'` for proper environment-based selection.

#### ✅ Fix 5: Cache Initialization (`index.ts`)
**Problem:** Server startup logged "Cache initialized" but never called `cacheManager.connect()`.

**Fix:** Added actual `cacheManager.connect()` call before the log message.

#### ✅ Fix 6: Graceful Shutdown (`index.ts`)
**Problem:** Only `SIGTERM` was handled (no `SIGINT`), and the handler didn't close the HTTP server before disconnecting services.

**Fix:** Added unified shutdown handler for both `SIGTERM` and `SIGINT` with proper `server.close()` and 30-second forced shutdown timeout.

#### ✅ Fix 7: Error Constructor Side Effects (`errors.ts`)
**Problem:** `DatabaseError` and `ServiceError` constructors called `logger.error()`, causing duplicate logging (constructor + error handler).

**Fix:** Removed logging from constructors. All error logging now occurs in the centralized `errorHandler` middleware.

#### ✅ Fix 8: Input Validation (`validation.ts` + `routes/index.ts`)
**Problem:** No request body validation on any route despite Joi being a dependency.

**Fix:** Created comprehensive Joi schemas for register, login, create/update consultation. Applied `validateBody` middleware to all relevant routes.

#### ✅ Fix 9: CORS Configuration (`config/index.ts`)
**Problem:** Default CORS origin was `http://localhost:3001` but the Vite frontend runs on port `5173`.

**Fix:** Changed default to `http://localhost:5173` and made credentials default to `true`.

#### ✅ Fix 10: Environment Documentation (`.env.example`)
**Problem:** No `.env.example` to document required environment variables.

**Fix:** Created comprehensive `.env.example` with all configuration options and defaults.

### 3.2 Frontend Fixes

#### ✅ Fix 11: API Service Layer (`services/api.ts`)
**Problem:** Empty `services/` directory with no API integration. All pages used hardcoded static data.

**Fix:** Created `ApiService` class with Axios, including request/response interceptors, automatic token attachment, 401 redirect handling, and typed methods for all backend endpoints.

#### ✅ Fix 12: Error Boundary (`components/ErrorBoundary.tsx`)
**Problem:** No error boundary to catch React rendering errors.

**Fix:** Created `ErrorBoundary` component with retry/reload buttons and dev-mode error details. Wrapped `<App />` in `main.tsx`.

#### ✅ Fix 13: Admin Role (`types/index.ts`)
**Problem:** Backend supports `admin` role but frontend `UserRole` type only had 3 roles.

**Fix:** Added `'admin'` to `UserRole` union type.

#### ✅ Fix 14: Custom Hook (`hooks/useApi.ts`)
**Problem:** No reusable state management for API calls.

**Fix:** Created `useApi<T>` hook with loading/error/data state management and `useNotification` hook for toast messages.

### 3.3 Infrastructure Fixes

#### ✅ Fix 15: Multi-Stage Dockerfile (`Dockerfile.backend`)
**Problem:** `npm ci --only=production` excluded dev dependencies (TypeScript), then `npm run build` (tsc) failed.

**Fix:** Implemented multi-stage Docker build — builder stage installs all deps and compiles, production stage copies only compiled output with production deps.

#### ✅ Fix 16: Docker Compose Hardening (`docker-compose.yml`)
**Problem:** Missing environment variables, no backend health check, no restart policies, dev-mode configuration.

**Fix:** Added all required env vars, health check for backend, `restart: unless-stopped` on all services, production NODE_ENV.

### 3.4 Database Fixes

#### ✅ Fix 17: Auto-Update Triggers (`init.sql`)
**Problem:** `updated_at` column never auto-updated — relied on application code.

**Fix:** Added `update_updated_at_column()` trigger function applied to all tables.

#### ✅ Fix 18: Sessions Table (`init.sql`)
**Problem:** No table to store refresh tokens or manage sessions.

**Fix:** Added `sessions` table with user reference, refresh token, and expiration.

---

## 4. Target Architecture

### 4.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        LOAD BALANCER (Nginx/ALB)                    │
│                    SSL Termination + Rate Limiting                   │
└──────────────────────┬─────────────────────┬────────────────────────┘
                       │                     │
          ┌────────────▼──────────┐ ┌────────▼───────────────┐
          │    Frontend (CDN)     │ │     API Gateway         │
          │   React SPA + Vite   │ │   /api/v1/*             │
          │   Static Assets      │ │   Auth + Rate Limit     │
          └───────────────────────┘ └────────┬───────────────┘
                                             │
                    ┌────────────────────────▼────────────────────────┐
                    │              APPLICATION LAYER                   │
                    │                                                  │
                    │  ┌──────────┐ ┌──────────┐ ┌──────────────────┐ │
                    │  │   Auth   │ │Consult.  │ │  Medical Records │ │
                    │  │ Service  │ │ Service  │ │    Service       │ │
                    │  └────┬─────┘ └────┬─────┘ └───────┬──────────┘ │
                    │       │            │               │            │
                    └───────┼────────────┼───────────────┼────────────┘
                            │            │               │
                    ┌───────▼────────────▼───────────────▼────────────┐
                    │              DATA LAYER                          │
                    │                                                  │
                    │  ┌──────────────┐      ┌──────────────────────┐ │
                    │  │ PostgreSQL   │      │      Redis           │ │
                    │  │ (Primary)    │      │  Session Cache       │ │
                    │  │ Users, etc.  │      │  Rate Limiting       │ │
                    │  └──────────────┘      └──────────────────────┘ │
                    └─────────────────────────────────────────────────┘
```

### 4.2 Component Interaction

```
Client Request
    │
    ▼
┌─────────────┐
│   Helmet    │  ← Security headers
│   CORS      │  ← Cross-origin policy
│   Rate Limiter │ ← DDoS protection
└──────┬──────┘
       ▼
┌─────────────┐
│  Request    │  ← Logging + Request ID
│  Logger     │
└──────┬──────┘
       ▼
┌─────────────┐
│  Validation │  ← Joi schema validation
│  Middleware  │
└──────┬──────┘
       ▼
┌─────────────┐
│    Auth     │  ← JWT verification
│  Middleware  │  ← Role-based access
└──────┬──────┘
       ▼
┌─────────────┐
│ Controller  │  ← Request/Response handling
└──────┬──────┘
       ▼
┌─────────────┐
│  Service    │  ← Business logic
└──────┬──────┘
       ▼
┌─────────────┐
│  Database   │  ← Data persistence
│  + Cache    │  ← Performance caching
└─────────────┘
```

---

## 5. Backend Design

### 5.1 Directory Structure (Current)

```
backend/
├── src/
│   ├── app.ts                    # Express app configuration
│   ├── index.ts                  # Server entry point
│   ├── config/
│   │   └── index.ts              # Environment configuration
│   ├── controllers/
│   │   ├── AuthController.ts     # Authentication endpoints
│   │   └── ConsultationController.ts
│   ├── middleware/
│   │   ├── auth.ts               # JWT + role middleware
│   │   └── validation.ts         # Joi request validation schemas ✨ NEW
│   ├── models/
│   │   └── types.ts              # TypeScript interfaces
│   ├── routes/
│   │   └── index.ts              # Route definitions
│   ├── services/
│   │   ├── ConsultationService.ts
│   │   └── UserService.ts
│   └── utils/
│       ├── cacheManager.ts       # Redis/Mock cache
│       ├── database.ts           # PostgreSQL/Mock database
│       ├── errorHandler.ts       # Central error handler
│       ├── errors.ts             # Error class hierarchy
│       ├── logger.ts             # Winston logger
│       ├── mockDatabase.ts       # In-memory DB for dev
│       ├── mockRedis.ts          # In-memory cache for dev
│       └── security.ts           # Password + JWT utils
├── tests/
│   ├── setup.ts
│   ├── unit/
│   └── integration/
├── .env.example                  # ✨ NEW
├── package.json
├── tsconfig.json
└── jest.config.js
```

### 5.2 Recommended Structure (Enterprise)

```
backend/
├── src/
│   ├── app.ts
│   ├── server.ts
│   ├── config/
│   │   ├── index.ts
│   │   ├── database.config.ts
│   │   ├── redis.config.ts
│   │   └── cors.config.ts
│   ├── modules/                  # ← Feature-based modules
│   │   ├── auth/
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   ├── auth.routes.ts
│   │   │   ├── auth.validation.ts
│   │   │   ├── auth.types.ts
│   │   │   └── __tests__/
│   │   ├── consultation/
│   │   │   ├── consultation.controller.ts
│   │   │   ├── consultation.service.ts
│   │   │   ├── consultation.routes.ts
│   │   │   ├── consultation.validation.ts
│   │   │   ├── consultation.types.ts
│   │   │   └── __tests__/
│   │   ├── medical-records/
│   │   ├── user/
│   │   └── notification/
│   ├── shared/
│   │   ├── middleware/
│   │   ├── database/
│   │   ├── cache/
│   │   ├── errors/
│   │   ├── logger/
│   │   └── types/
│   └── infrastructure/
│       ├── database/
│       │   ├── migrations/
│       │   └── seeds/
│       └── messaging/
├── tests/
│   ├── e2e/
│   ├── integration/
│   └── fixtures/
├── docs/
│   └── api/
│       └── openapi.yaml
└── scripts/
```

### 5.3 API Endpoints

| Method | Endpoint | Auth | Validation | Description |
|--------|----------|------|-----------|-------------|
| POST | `/api/v1/auth/register` | ❌ | ✅ registerSchema | User registration |
| POST | `/api/v1/auth/login` | ❌ | ✅ loginSchema | User authentication |
| GET | `/api/v1/auth/profile` | ✅ JWT | — | Get current user profile |
| POST | `/api/v1/consultations` | ✅ JWT | ✅ createConsultationSchema | Create consultation |
| GET | `/api/v1/consultations` | ✅ JWT | — | List consultations (paginated) |
| GET | `/api/v1/consultations/:id` | ✅ JWT | — | Get single consultation |
| PUT | `/api/v1/consultations/:id` | ✅ JWT | ✅ updateConsultationSchema | Update consultation |
| GET | `/api/v1/health` | ❌ | — | Health check |

---

## 6. Frontend Design

### 6.1 Current Structure

```
frontend/
├── src/
│   ├── main.tsx                  # Entry point + ErrorBoundary ✨ FIXED
│   ├── App.tsx                   # Router + Layout
│   ├── components/
│   │   ├── Layout.tsx
│   │   ├── Navigation.tsx
│   │   └── ErrorBoundary.tsx     # ✨ NEW
│   ├── context/
│   │   └── AuthContext.tsx       # Auth state management
│   ├── hooks/
│   │   └── useApi.ts             # ✨ NEW — API call hook
│   ├── pages/
│   │   ├── Home.tsx
│   │   ├── Dashboard.tsx
│   │   ├── Login.tsx
│   │   ├── Register.tsx
│   │   ├── Consultations.tsx
│   │   ├── Appointments.tsx
│   │   ├── MedicalRecords.tsx
│   │   └── Settings.tsx
│   ├── services/
│   │   └── api.ts                # ✨ NEW — Axios API client
│   └── types/
│       └── index.ts              # ✨ FIXED — Added admin role
```

### 6.2 Recommended Architecture

```
frontend/
├── src/
│   ├── app/
│   │   ├── App.tsx
│   │   ├── Router.tsx            # ← react-router-dom routes
│   │   └── providers.tsx         # ← Compose providers
│   ├── components/
│   │   ├── ui/                   # ← Shared UI components
│   │   │   ├── Button.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Modal.tsx
│   │   │   ├── DataTable.tsx
│   │   │   ├── Skeleton.tsx
│   │   │   └── Toast.tsx
│   │   └── layout/
│   │       ├── Layout.tsx
│   │       ├── Navigation.tsx
│   │       └── ErrorBoundary.tsx
│   ├── features/                 # ← Feature-based organization
│   │   ├── auth/
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   └── api/
│   │   ├── consultations/
│   │   ├── appointments/
│   │   ├── medical-records/
│   │   └── settings/
│   ├── hooks/                    # ← Shared hooks
│   ├── services/                 # ← API layer
│   ├── stores/                   # ← Zustand stores
│   └── types/
```

---

## 7. Database Design

### 7.1 Entity-Relationship Diagram

```
┌──────────────┐         ┌───────────────────┐
│    users     │         │   consultations   │
├──────────────┤         ├───────────────────┤
│ id (PK)      │◄───┐    │ id (PK)           │
│ email (UQ)   │    ├────│ user_id (FK)      │
│ first_name   │    │    │ veterinarian_id(FK)│───┐
│ last_name    │    │    │ animal_type       │   │
│ role         │    │    │ symptom_desc      │   │
│ phone        │    │    │ status            │   │
│ password_hash│    │    │ scheduled_at      │   │
│ is_active    │    │    │ started_at        │   │
│ created_at   │    │    │ completed_at      │   │
│ updated_at   │    │    │ diagnosis         │   │
└──────────────┘    │    │ prescription      │   │
       ▲            │    │ created_at        │   │
       │            │    │ updated_at        │   │
       │            │    └───────────────────┘   │
       │            │              ▲              │
       │            │              │              │
       │    ┌───────┴──────────┐   │              │
       │    │ medical_records  │   │              │
       │    ├──────────────────┤   │              │
       │    │ id (PK)          │   │              │
       ├────│ user_id (FK)     │   │              │
       │    │ consultation_id  │───┘              │
       │    │ record_type      │                  │
       │    │ content          │                  │
       │    │ file_url         │                  │
       │    │ created_at       │                  │
       │    │ updated_at       │                  │
       │    └──────────────────┘                  │
       │                                          │
       │    ┌──────────────────┐                  │
       │    │    sessions      │ ✨ NEW           │
       │    ├──────────────────┤                  │
       └────│ user_id (FK)     │                  │
            │ id (PK)          │                  │
            │ refresh_token    │                  │
            │ expires_at       │                  │
            │ created_at       │                  │
            └──────────────────┘                  │
                                                  │
                    users.id ◄────────────────────┘
```

### 7.2 Indexes Applied

| Table | Index | Columns | Purpose |
|-------|-------|---------|---------|
| users | idx_users_email | email | Login lookup |
| users | idx_users_role | role | Role-based queries |
| users | idx_users_is_active | is_active | Active user filtering |
| consultations | idx_consultations_user_id | user_id | Patient consultations |
| consultations | idx_consultations_vet_id | veterinarian_id | Vet dashboard |
| consultations | idx_consultations_status | status | Status filtering |
| consultations | idx_consultations_scheduled | scheduled_at | Calendar sorting |
| medical_records | idx_records_user_id | user_id | Patient records |
| medical_records | idx_records_consultation | consultation_id | Consultation records |
| sessions | idx_sessions_user_id | user_id | User sessions |
| sessions | idx_sessions_token | refresh_token | Token lookup |

### 7.3 Recommended Future Tables

```sql
-- Animals/Pets table
CREATE TABLE animals (
  id UUID PRIMARY KEY,
  owner_id UUID REFERENCES users(id),
  name VARCHAR(100) NOT NULL,
  species VARCHAR(50) NOT NULL,       -- dog, cat, cow, horse, etc.
  breed VARCHAR(100),
  age_months INTEGER,
  weight_kg DECIMAL(6,2),
  medical_history TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Payments table
CREATE TABLE payments (
  id UUID PRIMARY KEY,
  consultation_id UUID REFERENCES consultations(id),
  user_id UUID REFERENCES users(id),
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',
  status VARCHAR(20) CHECK (status IN ('pending', 'completed', 'refunded', 'failed')),
  payment_method VARCHAR(50),
  transaction_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Notifications table
CREATE TABLE notifications (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Veterinarian profiles table
CREATE TABLE vet_profiles (
  user_id UUID PRIMARY KEY REFERENCES users(id),
  license_number VARCHAR(100) NOT NULL,
  specialization VARCHAR(255),
  experience_years INTEGER,
  education TEXT,
  consultation_fee DECIMAL(8,2),
  availability JSONB,              -- schedule data
  is_verified BOOLEAN DEFAULT false,
  verified_at TIMESTAMP,
  rating DECIMAL(3,2) DEFAULT 0,
  total_reviews INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Reviews table
CREATE TABLE reviews (
  id UUID PRIMARY KEY,
  consultation_id UUID REFERENCES consultations(id),
  reviewer_id UUID REFERENCES users(id),
  veterinarian_id UUID REFERENCES users(id),
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 8. Security Architecture

### 8.1 Current Implementation

| Layer | Mechanism | Status |
|-------|-----------|--------|
| Transport | HTTPS (via reverse proxy) | ✅ Ready |
| Headers | Helmet.js (CSP, HSTS, X-Frame, etc.) | ✅ Active |
| CORS | Configurable origin whitelist | ✅ Fixed |
| Rate Limiting | express-rate-limit (100 req/15min) | ✅ Active |
| Authentication | JWT Bearer tokens (24h expiry) | ✅ Active |
| Password | bcrypt with salt rounds=10 | ✅ Active |
| Input Validation | Joi schemas on all write endpoints | ✅ Fixed |
| Authorization | Role-based middleware | ✅ Active |
| Error Handling | No sensitive info in production errors | ✅ Active |

### 8.2 Recommended Enhancements

| Priority | Enhancement | Description |
|----------|------------|-------------|
| 🔴 P0 | **Refresh Token Rotation** | Implement refresh token flow; current JWT has no renewal mechanism |
| 🔴 P0 | **Password Policy** | Enforce minimum 8 chars with complexity (now enforced via Joi) |
| 🟡 P1 | **Account Lockout** | Lock after 5 failed login attempts for 15 minutes |
| 🟡 P1 | **CSRF Protection** | Add CSRF tokens for state-changing operations |
| 🟡 P1 | **Request ID Propagation** | Use `uuid` for request IDs instead of `Date.now()-Math.random()` |
| 🟡 P1 | **API Key for Service-to-Service** | When adding microservices |
| 🟢 P2 | **OAuth 2.0 / SSO** | Google/Apple Sign-In for pet owners |
| 🟢 P2 | **2FA/MFA** | TOTP-based two-factor for veterinarians |
| 🟢 P2 | **Data Encryption at Rest** | PostgreSQL TDE or application-level encryption |
| 🟢 P2 | **Audit Logging** | Immutable audit trail for all data modifications |

### 8.3 JWT Token Flow (Recommended)

```
┌──────────┐     POST /auth/login      ┌──────────┐
│  Client  │ ───────────────────────── ▶│  Server  │
│          │                            │          │
│          │ ◀─── access_token (15m) ──│          │
│          │      refresh_token (7d)    │          │
│          │      (httpOnly cookie)     │          │
│          │                            │          │
│          │     GET /api/* + Bearer    │          │
│          │ ───────────────────────── ▶│          │
│          │ ◀─── Response ────────────│          │
│          │                            │          │
│          │  POST /auth/refresh        │          │
│          │  (cookie: refresh_token)   │          │
│          │ ───────────────────────── ▶│          │
│          │ ◀─── new access_token ────│          │
│          │      new refresh_token     │          │
└──────────┘      (rotation)           └──────────┘
```

---

## 9. Infrastructure & DevOps

### 9.1 Current Docker Architecture

```yaml
# docker-compose.yml (Fixed)
Services:
  ├── postgres (PostgreSQL 15-alpine)
  │   ├── Health check: pg_isready
  │   ├── Persistent volume: postgres_data
  │   └── Init script: init.sql
  ├── redis (Redis 7-alpine)
  │   ├── Health check: redis-cli ping
  │   └── Persistent volume: redis_data
  └── backend (Node 18-alpine, multi-stage build)
      ├── Health check: wget /api/v1/health
      ├── Depends on: postgres + redis (healthy)
      └── Restart: unless-stopped
```

### 9.2 Recommended Production Architecture (AWS)

```
┌─────────────────────────────────────────────────────────────┐
│                        AWS Cloud                             │
│                                                              │
│  ┌──────────────┐    ┌──────────────┐   ┌───────────────┐  │
│  │ CloudFront   │    │     ALB      │   │  S3 Bucket    │  │
│  │ (CDN)        │────│ (Load Bal.)  │   │ (Static/Docs) │  │
│  └──────┬───────┘    └──────┬───────┘   └───────────────┘  │
│         │                   │                                │
│         │           ┌───────▼────────┐                      │
│         │           │   ECS Fargate  │                      │
│         │           │   (Auto-scale) │                      │
│         │           │                │                      │
│         │           │ ┌────────────┐ │                      │
│         │           │ │  API       │ │                      │
│  ┌──────▼───────┐   │ │  Container │ │                      │
│  │ S3 + CF      │   │ │  x 2-10   │ │                      │
│  │ (Frontend)   │   │ └────────────┘ │                      │
│  └──────────────┘   └───────┬────────┘                      │
│                             │                                │
│              ┌──────────────┼──────────────┐                │
│              │              │              │                 │
│      ┌───────▼──────┐ ┌────▼──────┐ ┌─────▼──────┐        │
│      │   RDS        │ │ ElastiC.  │ │    SQS     │        │
│      │ PostgreSQL   │ │  Redis    │ │  (Queues)  │        │
│      │ Multi-AZ     │ │ Cluster   │ │            │        │
│      └──────────────┘ └───────────┘ └────────────┘        │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ CloudWatch   │  │   Secrets    │  │   WAF            │  │
│  │ (Monitoring) │  │   Manager    │  │ (Firewall)       │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 9.3 CI/CD Pipeline (Recommended)

```
┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐
│  Commit  │──▶│   Lint   │──▶│   Test   │──▶│  Build   │──▶│  Deploy  │
│          │   │  + Type  │   │ Unit +   │   │  Docker  │   │  Staging │
│          │   │  Check   │   │ Integr.  │   │  Image   │   │   / Prod │
└──────────┘   └──────────┘   └──────────┘   └──────────┘   └──────────┘
                                   │
                              ┌────▼─────┐
                              │ Coverage │
                              │ Gate 80% │
                              └──────────┘
```

**Recommended CI/CD Tools:**
- **GitHub Actions** for CI/CD pipelines
- **Docker Hub / ECR** for container registry
- **Terraform** for infrastructure as code
- **ArgoCD** for GitOps deployment (if Kubernetes)

---

## 10. API Design Standards

### 10.1 Response Format (Current - Good)

```json
// Success
{
  "success": true,
  "data": { ... }
}

// Error
{
  "success": false,
  "error": {
    "message": "Human readable message",
    "code": "ERROR_CODE",
    "statusCode": 400,
    "timestamp": "2026-02-14T10:00:00Z",
    "requestId": "abc-123"
  }
}
```

### 10.2 Recommended Enhancements

```json
// Paginated List Response
{
  "success": true,
  "data": [...],
  "pagination": {
    "total": 100,
    "limit": 10,
    "offset": 0,
    "hasMore": true
  },
  "meta": {
    "requestId": "uuid-v4",
    "timestamp": "2026-02-14T10:00:00Z",
    "version": "v1"
  }
}
```

### 10.3 Recommended Future Endpoints

| Category | Endpoint | Method | Description |
|----------|----------|--------|-------------|
| **Users** | `/api/v1/users/:id` | GET | Get user by ID (admin) |
| **Users** | `/api/v1/users` | GET | List users (admin, paginated) |
| **Animals** | `/api/v1/animals` | POST | Register animal |
| **Animals** | `/api/v1/animals` | GET | List user's animals |
| **Vets** | `/api/v1/veterinarians` | GET | Search available vets |
| **Vets** | `/api/v1/veterinarians/:id/availability` | GET | Check availability |
| **Records** | `/api/v1/medical-records` | POST | Create record |
| **Records** | `/api/v1/medical-records` | GET | List records |
| **Payments** | `/api/v1/payments` | POST | Process payment |
| **Notifications** | `/api/v1/notifications` | GET | Get notifications |
| **Reviews** | `/api/v1/reviews` | POST | Submit review |
| **Auth** | `/api/v1/auth/refresh` | POST | Refresh access token |
| **Auth** | `/api/v1/auth/logout` | POST | Invalidate tokens |
| **Auth** | `/api/v1/auth/forgot-password` | POST | Password reset email |

---

## 11. Testing Strategy

### 11.1 Current Coverage

| Category | Suites | Tests | Status |
|----------|--------|-------|--------|
| Unit - Security | 1 | 5 | ✅ Pass |
| Unit - UserService | 1 | 5 | ✅ Pass |
| Integration - Auth | 1 | 4 | ✅ Pass |
| **Total** | **3** | **18** | **100%** |

### 11.2 Coverage Report

| File | Statements | Branches | Functions | Lines |
|------|-----------|----------|-----------|-------|
| app.ts | 100% | 100% | 100% | 100% |
| security.ts | 100% | 100% | 100% | 100% |
| logger.ts | 100% | 100% | 100% | 100% |
| UserService.ts | 69% | 64% | 67% | 69% |
| AuthController.ts | 46% | 47% | 67% | 46% |
| ConsultationController.ts | 11% | 0% | 0% | 11% |
| ConsultationService.ts | 12% | 0% | 0% | 12% |
| **Overall** | **54%** | **37%** | **45%** | **54%** |

### 11.3 Recommended Testing Plan

| Level | Target Coverage | Priority Tests |
|-------|----------------|----------------|
| **Unit Tests** | 80%+ | All services, controllers, utilities |
| **Integration Tests** | 70%+ | All API endpoints, DB operations |
| **E2E Tests** | Critical paths | Register → Login → Create Consultation → Complete |
| **Performance Tests** | Baselines | Response time < 200ms p95, throughput > 1000 rps |
| **Security Tests** | OWASP Top 10 | SQL injection, XSS, CSRF, auth bypass |

### 11.4 Missing Tests to Add

```
tests/
├── unit/
│   ├── ConsultationService.test.ts     ← Missing
│   ├── ConsultationController.test.ts  ← Missing
│   ├── AuthController.test.ts          ← Missing
│   ├── errorHandler.test.ts            ← Missing
│   ├── cacheManager.test.ts            ← Missing
│   └── validation.test.ts             ← Missing
├── integration/
│   ├── consultation.integration.test.ts ← Missing
│   └── health.integration.test.ts      ← Missing
└── e2e/
    └── full-flow.e2e.test.ts           ← Missing
```

---

## 12. Performance & Scalability

### 12.1 Current Performance Considerations

| Aspect | Current | Recommendation |
|--------|---------|----------------|
| Rate Limiting | 100 req/15min global | Tiered: 100 public, 1000 authenticated |
| DB Pooling | min:2, max:10 | Scale to max:50 for production |
| Caching | In-memory mock | Redis with TTL-based invalidation |
| Payload Size | 10MB limit | Keep for file uploads, 1MB for JSON |
| Query Performance | Slow query logging > 1s | Add query plan analysis |
| Connection Timeout | 2s | Appropriate for start, add retry logic |

### 12.2 Recommended Caching Strategy

```
Cache Layer Strategy:
├── L1: In-Memory (Node.js process)
│   └── Hot config, user sessions (< 1ms)
├── L2: Redis
│   ├── User profiles (TTL: 5 min)
│   ├── Consultation lists (TTL: 30 sec)
│   ├── Vet availability (TTL: 1 min)
│   └── Rate limiting counters
└── L3: PostgreSQL
    └── Source of truth for all data
```

### 12.3 Scaling Strategy

| Phase | Users | Architecture | Infra |
|-------|-------|-------------|-------|
| **Phase 1** (Current) | 0-1K | Monolith | Single server + Docker |
| **Phase 2** | 1K-10K | Monolith + CDN | 2-3 app servers + RDS + ElastiCache |
| **Phase 3** | 10K-100K | Modular Monolith | ECS/K8s + Multi-AZ RDS + Redis Cluster |
| **Phase 4** | 100K+ | Microservices | Service mesh + Event-driven + CQRS |

---

## 13. Monitoring & Observability

### 13.1 Current State
- **Logging:** Winston with file + console transports
- **Request Logging:** Method, path, status, duration
- **Error Tracking:** Stack traces in error.log

### 13.2 Recommended Stack

```
┌──────────────────────────────────────────────┐
│              Observability Stack               │
├──────────────┬──────────────┬────────────────┤
│   Metrics    │    Logs      │    Traces      │
│              │              │                │
│  Prometheus  │ ELK Stack    │  Jaeger/       │
│  + Grafana   │ or CloudWatch│  OpenTelemetry │
│              │              │                │
│  - CPU/Memory│ - App logs   │ - Request      │
│  - Response  │ - Access logs│   tracing      │
│    times     │ - Error logs │ - DB query     │
│  - Active    │ - Audit logs │   tracing      │
│    connections│              │                │
│  - Error rate│              │                │
└──────────────┴──────────────┴────────────────┘
```

### 13.3 Key Metrics to Track

| Category | Metric | Alert Threshold |
|----------|--------|----------------|
| Availability | Uptime % | < 99.9% |
| Latency | p50, p95, p99 response time | p95 > 500ms |
| Errors | Error rate | > 1% of requests |
| Saturation | CPU usage | > 80% sustained |
| Saturation | Memory usage | > 85% |
| Saturation | DB connection pool | > 80% utilization |
| Business | Active consultations/hr | — |
| Business | Registration rate/day | — |
| Security | Failed login attempts/min | > 50 |

---

## 14. Recommended Improvements Roadmap

### Phase 1: Foundation (Weeks 1-4) — 🟢 Mostly Complete

- [x] Fix error handler ordering
- [x] Add input validation (Joi schemas)
- [x] Fix error re-throwing in services
- [x] Add ErrorBoundary to frontend
- [x] Create API service layer
- [x] Fix Docker multi-stage build
- [x] Add database triggers
- [x] Fix CORS configuration
- [ ] Add comprehensive unit tests (target 80%)
- [ ] Add OpenAPI/Swagger documentation
- [ ] Implement react-router-dom properly
- [ ] Connect frontend pages to real API

### Phase 2: Features (Weeks 5-8)

- [ ] Implement refresh token rotation
- [ ] Add animal/pet management module
- [ ] Implement real-time chat (WebSocket/Socket.io)
- [ ] Add file upload for medical documents (S3/MinIO)
- [ ] Build vet profile & verification workflow
- [ ] Implement appointment scheduling with calendar
- [ ] Add notification system (email + in-app)
- [ ] Payment integration (Stripe)

### Phase 3: Production Readiness (Weeks 9-12)

- [ ] Set up CI/CD pipeline (GitHub Actions)
- [ ] Add integration & E2E tests
- [ ] Implement audit logging
- [ ] Add monitoring (Prometheus + Grafana)
- [ ] Set up centralized logging (ELK/CloudWatch)
- [ ] Configure auto-scaling
- [ ] Security audit (OWASP Top 10)
- [ ] Performance testing & optimization
- [ ] Database migration framework (node-pg-migrate)

### Phase 4: Scale (Weeks 13-20)

- [ ] Video consultation (WebRTC)
- [ ] Mobile app (React Native)
- [ ] Admin dashboard
- [ ] Analytics & reporting engine
- [ ] Multi-language support (i18n)
- [ ] API versioning strategy
- [ ] Rate limiting per user tier
- [ ] Horizontal scaling (Kubernetes)

---

## 15. Cost Estimation

### Development Environment

| Resource | Tool | Cost |
|----------|------|------|
| Development | Docker Desktop | Free |
| Source Control | GitHub (Private) | Free-$4/user/mo |
| CI/CD | GitHub Actions | Free tier: 2000 min/mo |

### Production (Small Scale: 1K users)

| Resource | Service | Monthly Cost |
|----------|---------|-------------|
| Compute | AWS ECS Fargate (2 tasks) | ~$70 |
| Database | RDS PostgreSQL (db.t3.micro) | ~$25 |
| Cache | ElastiCache Redis (t3.micro) | ~$15 |
| CDN | CloudFront | ~$10 |
| Storage | S3 | ~$5 |
| Domain + SSL | Route53 + ACM | ~$1 |
| Monitoring | CloudWatch | ~$10 |
| **Total** | | **~$136/month** |

### Production (Medium Scale: 10K users)

| Resource | Service | Monthly Cost |
|----------|---------|-------------|
| Compute | ECS Fargate (4-8 tasks, auto-scale) | ~$300 |
| Database | RDS PostgreSQL (db.r5.large, Multi-AZ) | ~$350 |
| Cache | ElastiCache Redis (r5.large) | ~$150 |
| CDN | CloudFront | ~$50 |
| Storage | S3 | ~$20 |
| Load Balancer | ALB | ~$25 |
| Monitoring | CloudWatch + Datadog | ~$100 |
| **Total** | | **~$995/month** |

---

## Appendix A: Technology Decision Matrix

| Concern | Current Choice | Alternatives | Recommendation |
|---------|---------------|-------------|----------------|
| Runtime | Node.js 18 | Deno, Bun | **Keep Node.js** — mature ecosystem |
| Framework | Express 4 | Fastify, NestJS, Hono | **Consider NestJS** for enterprise (DI, modules) |
| ORM | Raw SQL | Prisma, TypeORM, Drizzle | **Add Prisma** — type safety + migrations |
| State Mgmt | React Context | Zustand, Redux Toolkit, Jotai | **Keep Zustand** (already a dependency) |
| Routing | Manual state | react-router-dom v6 | **Use react-router** (already a dependency) |
| Forms | Manual | react-hook-form + zod | **Add react-hook-form** for complex forms |
| UI Library | Custom CSS | Tailwind, shadcn/ui, MUI | **Consider Tailwind + shadcn** |
| Real-time | None | Socket.io, WebSocket | **Add Socket.io** for consultations |
| File Storage | None | S3, MinIO, Cloudinary | **Add S3** for medical documents |
| Email | None | SendGrid, AWS SES, Resend | **Add SendGrid** for notifications |
| Payments | None | Stripe, PayPal | **Add Stripe** for consultation fees |

---

## Appendix B: Files Modified in This Review

| File | Action | Changes |
|------|--------|---------|
| `backend/src/app.ts` | Modified | Fixed 404/error handler ordering |
| `backend/src/index.ts` | Modified | Added cache init, SIGINT handler, graceful shutdown |
| `backend/src/config/index.ts` | Modified | Fixed CORS default origin + credentials |
| `backend/src/controllers/ConsultationController.ts` | Modified | Use ForbiddenError instead of Error |
| `backend/src/services/ConsultationService.ts` | Modified | Re-throw NotFoundError without wrapping |
| `backend/src/services/UserService.ts` | Modified | Import AppError for proper re-throwing |
| `backend/src/utils/cacheManager.ts` | Modified | Environment-based Redis/mock selection |
| `backend/src/utils/errors.ts` | Modified | Removed constructor side-effects |
| `backend/src/routes/index.ts` | Modified | Added Joi validation to all write routes |
| `backend/src/middleware/validation.ts` | **Created** | Joi validation schemas |
| `backend/.env.example` | **Created** | Environment variable documentation |
| `frontend/src/main.tsx` | Modified | Wrapped app in ErrorBoundary |
| `frontend/src/types/index.ts` | Modified | Added admin role |
| `frontend/src/services/api.ts` | **Created** | Axios API service layer |
| `frontend/src/hooks/useApi.ts` | **Created** | useApi + useNotification hooks |
| `frontend/src/components/ErrorBoundary.tsx` | **Created** | React error boundary |
| `docker/Dockerfile.backend` | Modified | Multi-stage build |
| `docker/init.sql` | Modified | Added triggers, sessions table, indexes |
| `docker-compose.yml` | Modified | Added env vars, health checks, restart policies |

---

*Document generated as part of the VetCare platform enterprise review — February 2026*
