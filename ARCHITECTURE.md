# Project Architecture & System Design

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                            CLIENT LAYER                                  │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐      │
│  │   Web Browser    │  │   Mobile App     │  │   Admin Panel    │      │
│  │  (React.js)      │  │  (React Native)  │  │  (React.js)      │      │
│  └────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘      │
│           │                     │                      │                │
│           └─────────────────────┼──────────────────────┘                │
│                                 │ HTTPS/REST API                        │
└─────────────────────────────────┼────────────────────────────────────────┘
                                  │
┌─────────────────────────────────┼────────────────────────────────────────┐
│                         API GATEWAY LAYER                                │
├─────────────────────────────────┼────────────────────────────────────────┤
│                         ┌────────▼────────┐                             │
│                         │  Load Balancer  │                             │
│                         └────────┬────────┘                             │
│                                  │                                       │
└──────────────────────────────────┼───────────────────────────────────────┘
                                   │
┌──────────────────────────────────┼───────────────────────────────────────┐
│                      APPLICATION SERVER LAYER                            │
├──────────────────────────────────┼───────────────────────────────────────┤
│      Express.js Server (Node.js + TypeScript)                           │
│                                  │                                       │
│  ┌──────────────────────────────▼──────────────────────────────┐        │
│  │              MIDDLEWARE PIPELINE                            │        │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐      │        │
│  │  │Helmet    │ │CORS      │ │RateLimit │ │Logging   │      │        │
│  │  │Security  │ │Config    │ │Limiter   │ │Middleware│      │        │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘      │        │
│  │                                                             │        │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐                   │        │
│  │  │Auth      │ │Validation│ │Error     │                   │        │
│  │  │Middleware│ │Middleware│ │Handler   │                   │        │
│  │  └──────────┘ └──────────┘ └──────────┘                   │        │
│  └──────────────────────────────────────────────────────────┘        │
│                                  │                                       │
│  ┌───────────────────────────────▼───────────────────────────┐        │
│  │              ROUTING LAYER (/api/v1)                     │        │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐    │        │
│  │  │/auth     │ │/users    │ │/consulta │ │/health   │    │        │
│  │  │register  │ │list      │ │tions     │ │          │    │        │
│  │  │login     │ │get       │ │create    │ │          │    │        │
│  │  │profile   │ │update    │ │list      │ │          │    │        │
│  │  │          │ │delete    │ │get       │ │          │    │        │
│  │  │          │ │          │ │update    │ │          │    │        │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘    │        │
│  └───────────────────────────────────────────────────────────┘        │
│                                  │                                       │
│  ┌───────────────────────────────▼───────────────────────────┐        │
│  │         CONTROLLER LAYER (Request Handlers)             │        │
│  │  ┌──────────────────┐  ┌──────────────────┐             │        │
│  │  │AuthController    │  │ConsultationCtrl  │             │        │
│  │  │- register()      │  │- create()        │             │        │
│  │  │- login()         │  │- getOne()        │             │        │
│  │  │- getProfile()    │  │- update()        │             │        │
│  │  │                  │  │- list()          │             │        │
│  │  └──────────────────┘  └──────────────────┘             │        │
│  └───────────────────────────────────────────────────────────┘        │
│                                  │                                       │
│  ┌───────────────────────────────▼───────────────────────────┐        │
│  │        SERVICE LAYER (Business Logic)                   │        │
│  │  ┌──────────────────┐  ┌──────────────────┐             │        │
│  │  │UserService       │  │ConsultationService             │        │
│  │  │- createUser()    │  │- createConsult() │             │        │
│  │  │- getUserById()   │  │- getConsult()    │             │        │
│  │  │- getUserByEmail()│  │- updateConsult() │             │        │
│  │  │- updateUser()    │  │- listConsults()  │             │        │
│  │  │- listUsers()     │  │                  │             │        │
│  │  └──────────────────┘  └──────────────────┘             │        │
│  └───────────────────────────────────────────────────────────┘        │
│                                  │                                       │
│  ┌───────────────────────────────▼───────────────────────────┐        │
│  │        UTILITY LAYER                                     │        │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐     │        │
│  │  │Security      │ │Logger        │ │ErrorHandler  │     │        │
│  │  │- hash()      │ │- info()      │ │- errorHandler│     │        │
│  │  │- verify()    │ │- error()     │ │- AppError    │     │        │
│  │  │- generate()  │ │- warn()      │ │- ValidationErr      │        │
│  │  │  Token       │ │- debug()     │ │              │     │        │
│  │  └──────────────┘ └──────────────┘ └──────────────┘     │        │
│  │                                                             │        │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐     │        │
│  │  │Database      │ │CacheManager  │ │Config        │     │        │
│  │  │- query()     │ │- get()       │ │- load env    │     │        │
│  │  │- connect()   │ │- set()       │ │- validate    │     │        │
│  │  │- transaction │ │- del()       │ │              │     │        │
│  │  └──────────────┘ └──────────────┘ └──────────────┘     │        │
│  └───────────────────────────────────────────────────────────┘        │
│                                  │                                       │
└──────────────────────────────────┼───────────────────────────────────────┘
                                   │
                ┌──────────────────┼──────────────────┐
                │                  │                  │
┌───────────────▼──────────┐ ┌─────▼──────────┐ ┌───▼─────────────────┐
│   DATA LAYER             │ │  CACHE LAYER   │ │  STORAGE LAYER      │
├──────────────────────────┤ ├────────────────┤ ├─────────────────────┤
│   PostgreSQL             │ │   Redis        │ │   MinIO/S3          │
│                          │ │                │ │   (for files)       │
│ ┌──────────────────────┐ │ │ ┌────────────┐ │ │ ┌─────────────────┐ │
│ │ Users Table          │ │ │ │Sessions    │ │ │ │Medical Records  │ │
│ │ Consultations Table  │ │ │ │Cached Data │ │ │ │Prescriptions    │ │
│ │ Medical_Records Tbl  │ │ │ │Temp Cache  │ │ │ │Lab Reports      │ │
│ │                      │ │ │ └────────────┘ │ │ │Images           │ │
│ │ Connection Pool: 10  │ │ │                │ │ │                 │ │
│ │ ACID Transactions    │ │ │ TTL Support    │ │ │Encrypted Storage│ │
│ │ Indexes for Perf.    │ │ │                │ │ │                 │ │
│ └──────────────────────┘ │ │                │ │ │                 │ │
└──────────────────────────┘ └────────────────┘ │ └─────────────────┘ │
                                                 └─────────────────────┘
```

---

## Data Flow Diagrams

### 1. User Registration Flow

```
Client (Browser/App)
        │
        │ 1. POST /auth/register
        │    {email, firstName, lastName, phone, password, role}
        ▼
┌───────────────────┐
│   Express Route   │
│  POST /auth/reg   │
└────────┬──────────┘
         │
         │ 2. Call AuthController.register()
         ▼
┌───────────────────────────────┐
│  AuthController.register()    │
│  - Validate input fields      │
│  - Check email uniqueness     │
└────────┬──────────────────────┘
         │
         │ 3. Call UserService.createUser()
         ▼
┌───────────────────────────────┐
│  UserService.createUser()     │
│  - Hash password (bcryptjs)   │
│  - Generate UUID              │
│  - Build SQL query            │
└────────┬──────────────────────┘
         │
         │ 4. Call database.query()
         ▼
┌───────────────────────────────┐
│  PostgreSQL Database          │
│  - INSERT into users table    │
│  - Return user record         │
└────────┬──────────────────────┘
         │
         │ 5. Call SecurityUtils.generateToken()
         ▼
┌───────────────────────────────┐
│  JWT Token Generation         │
│  - payload: {userId, role}    │
│  - sign with secret key       │
│  - expire in 24h              │
└────────┬──────────────────────┘
         │
         │ 6. Log operation
         ▼
┌───────────────────────────────┐
│  Winston Logger               │
│  - info: "User created"       │
│  - file: logs/combined.log    │
└────────┬──────────────────────┘
         │
         │ 7. Return response
         ▼
Client receives:
  {
    success: true,
    data: {
      user: { id, email, firstName, lastName, role },
      token: "eyJhbGciOiJIUzI1NiIs..."
    }
  }
```

### 2. Consultation Creation Flow

```
Client (Authenticated)
        │
        │ 1. POST /consultations
        │    Headers: Authorization: Bearer <token>
        │    Body: {veterinarianId, animalType, symptomDescription}
        ▼
┌───────────────────┐
│   Middleware      │
│  authMiddleware   │
└────────┬──────────┘
         │ 2. Verify JWT token
         │    Extract userId, userRole
         ▼
┌──────────────────────────────┐
│  ConsultationController      │
│  .createConsultation()       │
│  - Validate fields           │
│  - Check vet exists          │
└────────┬─────────────────────┘
         │
         │ 3. Call ConsultationService.create()
         ▼
┌──────────────────────────────┐
│  ConsultationService         │
│  - Generate UUID for consultation
│  - Build SQL INSERT          │
└────────┬─────────────────────┘
         │
         │ 4. database.query()
         ▼
┌──────────────────────────────┐
│  PostgreSQL                  │
│  INSERT into consultations   │
│  - id, user_id, vet_id       │
│  - animal_type, symptoms     │
│  - status: "scheduled"       │
└────────┬─────────────────────┘
         │
         │ 5. Cache in Redis (optional)
         ▼
┌──────────────────────────────┐
│  Redis Cache                 │
│  SET consultation:{id}       │
│  TTL: 1 hour                 │
└────────┬─────────────────────┘
         │
         │ 6. Log operation
         ▼
┌──────────────────────────────┐
│  Winston Logger              │
│  - info: "Consultation created"
└────────┬─────────────────────┘
         │
         │ 7. Return 201 Created
         ▼
Client receives:
  {
    success: true,
    data: {
      id: "uuid",
      userId: "user-uuid",
      veterinarianId: "vet-uuid",
      animalType: "cow",
      symptomDescription: "...",
      status: "scheduled",
      scheduledAt: "...",
      createdAt: "..."
    }
  }
```

---

## Component Interaction Diagram

```
                      ┌─────────────────────┐
                      │   HTTP Request      │
                      └──────────┬──────────┘
                                 │
                    ┌────────────┴────────────┐
                    │                         │
             ┌──────▼──────┐          ┌──────▼──────┐
             │  Helmet     │          │  CORS       │
             │  (Security) │          │  (Headers)  │
             └──────┬──────┘          └──────┬──────┘
                    │                         │
                    └────────────┬────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │  Request Logger        │
                    │  (Winston + RequestID) │
                    └────────────┬────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │  Rate Limiter          │
                    │  (100 req/15min)       │
                    └────────────┬────────────┘
                                 │
            ┌────────────────────▼────────────────────┐
            │         Route Matching                  │
            │   /api/v1/auth/register                │
            │   /api/v1/auth/login                   │
            │   /api/v1/consultations                │
            └────────────────┬─────────────────────────┘
                             │
         ┌───────────────────┼───────────────────┐
         │                   │                   │
  ┌──────▼──────┐   ┌────────▼────────┐  ┌──────▼──────┐
  │ Auth Routes │   │ Consultation     │  │ Health      │
  │             │   │ Routes           │  │ Endpoint    │
  └──────┬──────┘   └────────┬────────┘  └──────┬──────┘
         │                   │                   │
    ┌────▼──────┐       ┌────▼────┐         ┌───▼──┐
    │AuthMiddle │       │Auth Mid │         │Return│
    │ware       │       │ware     │         │"OK"  │
    └────┬──────┘       └────┬────┘         └──────┘
         │                   │
    ┌────▼────────────┬──────▼────────────┐
    │                 │                   │
┌───▼────┐      ┌─────▼──┐         ┌──────▼──┐
│Auth    │      │Validation          │Async   │
│Ctrlr   │      │Middleware          │Handler │
└───┬────┘      └─────┬──┘         └──────┬──┘
    │                 │                   │
┌───▼──────────────────▼───────────────────▼──┐
│         Service Layer                       │
│  ┌─────────────────┐  ┌─────────────────┐   │
│  │UserService      │  │ConsultationService  │
│  │- createUser()   │  │- createConsult()    │
│  │- login logic    │  │- getConsult()       │
│  └────────┬────────┘  └────────┬─────────────┤
└───────────┼──────────────────────┼──────────┘
            │                      │
        ┌───▼──────────────────────▼──┐
        │    Database Utils          │
        │  ┌────────────────────────┐ │
        │  │ query()                │ │
        │  │ transaction()          │ │
        │  │ Connection Pool (10)   │ │
        │  └────────────────────────┘ │
        └───┬──────────────────────────┘
            │
        ┌───▼──────────────┐
        │   PostgreSQL     │
        │   (Primary DB)   │
        └──────────────────┘

        ┌─────────────────┐
        │ Cache (Redis)   │
        │ - Sessions      │
        │ - Cached Data   │
        └─────────────────┘

        ┌─────────────────┐
        │ Logger (Winston)│
        │ - error.log     │
        │ - combined.log  │
        └─────────────────┘
```

---

## Module Dependencies

```
app.ts (Entry Point)
    │
    ├─► config/index.ts (Environment Configuration)
    │
    ├─► middleware/auth.ts
    │   ├─► jsonwebtoken (JWT)
    │   └─► express
    │
    ├─► routes/index.ts
    │   ├─► controllers/AuthController.ts
    │   ├─► controllers/ConsultationController.ts
    │   └─► asyncHandler (utils/errorHandler.ts)
    │
    ├─► utils/errorHandler.ts
    │   ├─► logger.ts
    │   └─► errors.ts
    │
    ├─► utils/logger.ts (Winston)
    │
    ├─► utils/database.ts (PostgreSQL)
    │   └─► pg (PostgreSQL driver)
    │
    ├─► utils/cacheManager.ts (Redis)
    │   └─► ioredis
    │
    └─► Third-party middleware
        ├─► helmet (Security headers)
        ├─► cors (CORS configuration)
        ├─► express-rate-limit (Rate limiting)
        └─► express-async-errors (Error handling)

Controllers
    │
    ├─► AuthController.ts
    │   └─► UserService
    │
    └─► ConsultationController.ts
        └─► ConsultationService

Services
    │
    ├─► UserService.ts
    │   ├─► database.ts
    │   ├─► security.ts (Password & JWT)
    │   └─► errors.ts
    │
    └─► ConsultationService.ts
        ├─► database.ts
        ├─► cacheManager.ts (optional)
        └─► errors.ts

Utils
    │
    ├─► database.ts
    │   └─► pg (PostgreSQL)
    │
    ├─► cacheManager.ts
    │   └─► ioredis (Redis)
    │
    ├─► security.ts
    │   ├─► bcryptjs (Password hashing)
    │   └─► jsonwebtoken (JWT)
    │
    ├─► logger.ts
    │   └─► winston
    │
    ├─► errorHandler.ts
    │   └─► errors.ts
    │
    └─► errors.ts (Custom Error Classes)
```

---

## Request-Response Cycle

```
REQUEST PHASE:
├─► Client sends HTTP request
│   └─► Method, Path, Headers, Body
│
├─► Express receives request
│   └─► req, res objects created
│
├─► Security Middleware Chain
│   ├─► Helmet (Set security headers)
│   ├─► CORS (Check origin)
│   └─► Rate Limiter (Check IP limits)
│
├─► Request Logger
│   └─► Log request ID and metadata
│
├─► Route Matching
│   └─► Find matching route handler
│
├─► Authentication Middleware (if protected)
│   ├─► Extract token from header
│   ├─► Verify JWT signature
│   └─► Set userId and userRole on request
│
├─► Validation Middleware (if schema provided)
│   ├─► Parse request body
│   ├─► Validate against Joi schema
│   └─► Return 400 if invalid
│
├─► Controller (Business Logic)
│   └─► Process request with context
│
├─► Service Layer (Core Business Logic)
│   ├─► Validate business rules
│   ├─► Call database operations
│   └─► Call cache operations
│
├─► Data Access Layer
│   ├─► Execute SQL queries
│   ├─► Manage transactions
│   └─► Handle errors
│
├─► Response Preparation
│   ├─► Format data
│   └─► Add metadata
│
RESPONSE PHASE:
├─► Send HTTP response
│   ├─► Status code
│   ├─► Headers
│   └─► Body (JSON)
│
├─► Logger (on response complete)
│   └─► Log response status and duration
│
└─► Close connection

ERROR HANDLING:
If error occurs at any step:
├─► Create custom Error object
│   ├─► AppError (400, 401, 403, 404, 409, 500)
│   └─► Error details and code
│
├─► Error Handler Middleware
│   ├─► Check error type
│   ├─► Log error with context
│   └─► Format error response
│
└─► Send error response (JSON)
    ├─► Status code
    ├─► Error message
    ├─► Error code
    └─► Timestamp
```

---

## Scaling Architecture (Future)

```
Current Single-Server Architecture:
┌──────────────────────┐
│  Express Server      │
│  - Auth              │
│  - Consultations     │
│  - Users             │
└──────────────────────┘

Future Microservices Architecture:
┌────────────────┐
│  API Gateway   │
│  (nginx/Kong)  │
└────────┬───────┘
         │
    ┌────┼────┬─────────────────┐
    │    │    │                 │
┌───▼─┐ ┌─▼───┐ ┌────────┐  ┌──▼──┐
│Auth │ │User │ │Consult │  │Notif│
│Svc  │ │Svc  │ │Svc     │  │Svc  │
└──┬──┘ └──┬──┘ └───┬────┘  └──┬──┘
   │       │       │         │
   └───┬───┴───┬───┴─────────┘
       │       │
   ┌───▼──┐ ┌─▼────┐
   │ DB   │ │Redis │
   └──────┘ └──────┘

   Message Queue (RabbitMQ/Kafka):
   ├─► User events
   ├─► Consultation events
   └─► Notification queue

   Kubernetes Orchestration:
   ├─► Service replicas
   ├─► Auto-scaling
   ├─► Health checks
   └─► Load balancing
```

---

## Database Schema & Relationships

```
users
├── id (UUID, PRIMARY KEY)
├── email (VARCHAR, UNIQUE)
├── first_name (VARCHAR)
├── last_name (VARCHAR)
├── role (ENUM: farmer, pet_owner, veterinarian, admin)
├── phone (VARCHAR)
├── password_hash (VARCHAR)
├── is_active (BOOLEAN)
├── created_at (TIMESTAMP)
└── updated_at (TIMESTAMP)
    │
    └─► Has Many Consultations (as user_id)
    └─► Has Many Consultations (as veterinarian_id)
    └─► Has Many Medical Records

consultations
├── id (UUID, PRIMARY KEY)
├── user_id (UUID, FOREIGN KEY → users.id)
├── veterinarian_id (UUID, FOREIGN KEY → users.id)
├── animal_type (VARCHAR)
├── symptom_description (TEXT)
├── status (ENUM: scheduled, in_progress, completed, cancelled)
├── scheduled_at (TIMESTAMP)
├── started_at (TIMESTAMP)
├── completed_at (TIMESTAMP)
├── diagnosis (TEXT)
├── prescription (TEXT)
├── created_at (TIMESTAMP)
└── updated_at (TIMESTAMP)
    │
    └─► Belongs To User
    └─► Belongs To Veterinarian
    └─► Has Many Medical Records

medical_records
├── id (UUID, PRIMARY KEY)
├── user_id (UUID, FOREIGN KEY → users.id)
├── consultation_id (UUID, FOREIGN KEY → consultations.id)
├── record_type (ENUM: diagnosis, prescription, lab_report, vaccination)
├── content (TEXT)
├── file_url (VARCHAR)
├── created_at (TIMESTAMP)
└── updated_at (TIMESTAMP)
    │
    └─► Belongs To User
    └─► Belongs To Consultation

Indexes:
├── idx_users_email
├── idx_users_role
├── idx_consultations_user_id
├── idx_consultations_veterinarian_id
├── idx_consultations_status
├── idx_medical_records_user_id
└── idx_medical_records_consultation_id
```

---

## Payment, Wallet & Cancellation Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                     PAYMENT GATEWAY LAYER                            │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────┐    ┌──────────────────────────────────────────┐     │
│  │ Admin Panel  │───▶│  system_settings (payment.gatewayMode)  │     │
│  │ Gateway     │    │  ┌──────┐  ┌──────┐  ┌──────┐           │     │
│  │ Config      │    │  │ demo │  │ test │  │ live │           │     │
│  └─────────────┘    │  │(stub)│  │(sand)│  │(real)│           │     │
│                     │  └──┬───┘  └──┬───┘  └──┬───┘           │     │
│                     └─────┼─────────┼─────────┼───────────────┘     │
│                           │         │         │                      │
│                     ┌─────▼─────────▼─────────▼───────────────┐     │
│                     │        PaymentService                    │     │
│                     │  createPayment() → booking_id link       │     │
│                     │  processRefund() → wallet credit         │     │
│                     │  getPaymentByBooking()                   │     │
│                     └──────────────────────────────────────────┘     │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│                     WALLET SYSTEM                                    │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────────┐    ┌──────────────────────────────────────┐    │
│  │ wallets           │    │ wallet_transactions                  │    │
│  │ ├─ user_id (1:1)  │    │ ├─ type: credit|debit|refund|bonus  │    │
│  │ ├─ balance        │    │ ├─ amount                            │    │
│  │ ├─ bonus_credits  │    │ ├─ reference_id (booking/payment)    │    │
│  │ └─ currency       │    │ └─ description                       │    │
│  └──────────────────┘    └──────────────────────────────────────┘    │
│                                                                      │
│  WalletService: credit() | debit() | refund() | addBonus()          │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│                 CANCELLATION POLICY ENGINE                           │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Doctor Cancels                    Patient Cancels                   │
│  ┌────────────┐                   ┌───────────────────────────┐     │
│  │ Always:    │                   │ Time-Based Policy:         │     │
│  │ 100% refund│                   │                           │     │
│  │ + goodwill │                   │ ≥24h → 100% refund        │     │
│  │   bonus    │                   │ 2-24h → 50% partial       │     │
│  │   (10%)    │                   │ <2h → no refund            │     │
│  └────────────┘                   └───────────────────────────┘     │
│                                                                      │
│  All configurable via Admin → System Settings                        │
│                                                                      │
│  BookingService.cancelBooking():                                     │
│    1. Set cancelled_by + cancelled_at                                │
│    2. Calculate refund based on canceller role + timing              │
│    3. Process refund → WalletService.refund()                        │
│    4. Optional goodwill bonus → WalletService.addBonus()             │
│    5. Notify both parties (in-app + email)                           │
│                                                                      │
│  Doctor Reliability:                                                 │
│    reliabilityScore = ((total - cancellations) / total) × 100        │
│    isReliable = monthCancellations < maxPerMonth                    │
│    Badge: ✅ Guaranteed (reliable) | ⚠️ X% (unreliable)            │
└──────────────────────────────────────────────────────────────────────┘
```

### New Database Tables

| Table | Purpose |
|-------|---------|
| `wallets` | Per-user wallet with balance + bonus_credits (1:1 with users) |
| `wallet_transactions` | Ledger of all wallet movements (credit, debit, refund, bonus) |

### Modified Tables

| Table | New Columns | Purpose |
|-------|-------------|---------|
| `bookings` | `cancelled_by UUID`, `cancelled_at TIMESTAMP` | Track who cancelled and when |
| `payments` | `booking_id UUID` | Link payments to bookings for refund processing |

### New System Settings

| Key | Default | Description |
|-----|---------|-------------|
| `payment.gatewayMode` | `demo` | Payment processing mode (demo/test/live) |
| `payment.gatewayUrl` | `` | Gateway API endpoint URL |
| `payment.gatewayApiKey` | `` | Gateway API authentication key |
| `payment.gatewayProvider` | `stripe` | Payment provider (stripe/razorpay/paypal/square) |
| `cancellation.autoRefundOnDoctorCancel` | `true` | Auto-refund when doctor cancels |
| `cancellation.patientFreeWindowHours` | `24` | Hours before appointment for free cancellation |
| `cancellation.partialRefundPercent` | `50` | Partial refund percentage |
| `cancellation.partialRefundWindowHours` | `2` | Hours threshold for partial vs no refund |
| `cancellation.goodwillBonusPercent` | `10` | Bonus credit on doctor cancellation |
| `cancellation.doctorMaxCancellationsPerMonth` | `3` | Max monthly cancellations before flagged |

---

## Security Architecture

```
┌─────────────────────────────────────────┐
│     Authentication & Authorization      │
├─────────────────────────────────────────┤
│                                         │
│  1. Registration                        │
│     ├─► Validate input                  │
│     ├─► Hash password (bcryptjs)        │
│     ├─► Store in database               │
│     └─► Generate JWT token              │
│                                         │
│  2. Login                               │
│     ├─► Find user by email              │
│     ├─► Compare password hash           │
│     ├─► Generate JWT token              │
│     └─► Return token to client          │
│                                         │
│  3. Authentication (Protected Routes)   │
│     ├─► Extract token from header       │
│     ├─► Verify JWT signature            │
│     ├─► Check token expiry              │
│     ├─► Decode payload                  │
│     └─► Set userId on request           │
│                                         │
│  4. Authorization (Role-Based)          │
│     ├─► Check user role                 │
│     ├─► Verify permissions              │
│     ├─► Allow/Deny access               │
│     └─► Return 403 if forbidden         │
│                                         │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│        Data Protection                  │
├─────────────────────────────────────────┤
│                                         │
│  Passwords:                             │
│  ├─► Never stored in plaintext          │
│  ├─► Hashed with bcryptjs (10 rounds)   │
│  ├─► Unique hash per password           │
│  └─► Verified on login                  │
│                                         │
│  Tokens:                                │
│  ├─► Signed with secret key             │
│  ├─► Expire in 24h                      │
│  ├─► Issued per login                   │
│  └─► Verified on each request           │
│                                         │
│  Sensitive Data:                        │
│  ├─► Passwords never logged             │
│  ├─► Medical records encrypted          │
│  ├─► Patient privacy respected          │
│  └─► GDPR/HIPAA compliance              │
│                                         │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│   Infrastructure Security               │
├─────────────────────────────────────────┤
│                                         │
│  Network:                               │
│  ├─► HTTPS/TLS encryption               │
│  ├─► CORS validation                    │
│  ├─► Rate limiting (100 req/15min)      │
│  └─► Request ID tracking                │
│                                         │
│  Database:                              │
│  ├─► SQL injection prevention           │
│  │   (parameterized queries)            │
│  ├─► Connection pooling                 │
│  ├─► Transaction support                │
│  └─► Access control                     │
│                                         │
│  Application:                           │
│  ├─► Helmet security headers            │
│  ├─► Error message sanitization         │
│  ├─► Input validation                   │
│  └─► Output encoding                    │
│                                         │
└─────────────────────────────────────────┘
```

---

This architecture document provides a comprehensive overview of the system design, data flows, and security implementation. The modular design allows for easy scaling and future enhancements without major refactoring.
