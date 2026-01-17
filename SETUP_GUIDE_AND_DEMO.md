# Project Setup Guide & Demo

## Prerequisites Check
- Node.js 18+ - **NOT INSTALLED ON THIS SYSTEM**
- Docker & Docker Compose - **Can be used as alternative**
- PostgreSQL 15+ - **Optional (included in Docker Compose)**
- Redis 7+ - **Optional (included in Docker Compose)**

## Quick Start Options

### Option 1: Docker Compose (Recommended - No Node.js Required)

```bash
# Navigate to project root
cd OnlineDoctorConsultation

# Start all services
docker-compose up -d

# Services will be available at:
# - API: http://localhost:3000/api/v1
# - PostgreSQL: localhost:5432
# - Redis: localhost:6379

# View logs
docker-compose logs -f backend

# Stop services
docker-compose down
```

### Option 2: Local Development (Requires Node.js 18+)

```bash
# Install dependencies
cd backend
npm install

# Create logs directory
mkdir logs

# Run tests
npm run test

# Start development server
npm run dev

# Server runs at http://localhost:3000
```

## Project Structure Overview

```
OnlineDoctorConsultation/
├── backend/
│   ├── src/
│   │   ├── app.ts                 # Express app configuration
│   │   ├── index.ts               # Server entry point
│   │   ├── config/                # Configuration management
│   │   │   └── index.ts           # Environment & app config
│   │   ├── controllers/           # Request handlers
│   │   │   ├── AuthController.ts  # Authentication logic
│   │   │   └── ConsultationController.ts
│   │   ├── services/              # Business logic
│   │   │   ├── UserService.ts     # User management
│   │   │   └── ConsultationService.ts
│   │   ├── models/                # TypeScript interfaces
│   │   │   └── types.ts
│   │   ├── middleware/            # Express middleware
│   │   │   └── auth.ts            # Auth, logging, validation
│   │   ├── routes/                # API route definitions
│   │   │   └── index.ts
│   │   └── utils/                 # Utilities
│   │       ├── logger.ts          # Winston logging
│   │       ├── errors.ts          # Custom error classes
│   │       ├── errorHandler.ts    # Error middleware
│   │       ├── database.ts        # PostgreSQL connection
│   │       ├── cacheManager.ts    # Redis cache
│   │       └── security.ts        # JWT & password hashing
│   ├── tests/
│   │   ├── unit/
│   │   │   ├── security.test.ts   # Security utilities tests
│   │   │   └── UserService.test.ts # Service tests
│   │   ├── integration/
│   │   │   └── auth.integration.test.ts # API endpoint tests
│   │   └── setup.ts               # Test configuration
│   ├── package.json
│   ├── tsconfig.json
│   ├── jest.config.js
│   └── .env
├── frontend/
│   ├── src/
│   │   ├── components/            # React components
│   │   ├── pages/                 # Page components
│   │   ├── services/              # API client services
│   │   └── hooks/                 # Custom React hooks
│   ├── package.json
│   └── tsconfig.json
├── docker/
│   ├── Dockerfile.backend         # Backend containerization
│   └── init.sql                   # Database schema
├── docker-compose.yml             # Multi-container setup
├── .github/workflows/ci-cd.yml   # GitHub Actions CI/CD
├── .gitignore
└── README.md
```

## Architecture & Design Patterns

### 1. **Layered Architecture**
```
┌─────────────────────────┐
│   Presentation Layer    │
│   (Controllers/Routes)  │
├─────────────────────────┤
│   Business Logic Layer  │
│   (Services)            │
├─────────────────────────┤
│   Data Access Layer     │
│   (Database/Cache)      │
├─────────────────────────┤
│   Utility/Support Layer │
│   (Logging, Errors)     │
└─────────────────────────┘
```

### 2. **Key Design Patterns Implemented**

**a) Service Pattern**
```typescript
// Controllers delegate to Services
// Services contain business logic
// Services use Database/Cache utilities

class UserService {
  async createUser(userData) {
    // Validate data
    // Hash password using SecurityUtils
    // Save to database
    // Log operation
  }
}
```

**b) Error Handling Pattern**
```typescript
// Custom error classes for different scenarios
try {
  await userService.createUser(data);
} catch (error) {
  if (error instanceof ConflictError) {
    // Handle conflict
  } else if (error instanceof ValidationError) {
    // Handle validation
  } else {
    // Generic error handling
  }
}
```

**c) Middleware Pipeline**
```typescript
// Request flows through middleware stack
// Authentication → Validation → Business Logic → Response
app.post('/endpoint', 
  authMiddleware,
  validateBody(schema),
  asyncHandler(controller.method)
);
```

**d) Dependency Injection**
```typescript
// Services are instantiated once and exported
export default new UserService();

// Used throughout application
import UserService from '../services/UserService';
```

### 3. **Security Implementation**

**Password Security**
```typescript
// bcryptjs with 10 salt rounds
const hash = await SecurityUtils.hashPassword(password);
const isValid = await SecurityUtils.comparePassword(password, hash);
```

**JWT Authentication**
```typescript
// Token generation
const token = SecurityUtils.generateToken({
  userId: user.id,
  email: user.email,
  role: user.role
});

// Token verification in middleware
const decoded = jwt.verify(token, secret);
```

**Request Security**
```typescript
// Helmet for HTTP headers
// CORS configuration
// Rate limiting (100 requests per 15 minutes)
// Parameterized SQL queries (SQL injection prevention)
```

## API Endpoints Demo

### 1. User Registration
```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "farmer@example.com",
    "firstName": "Rajesh",
    "lastName": "Kumar",
    "phone": "+919876543210",
    "password": "SecurePass123!",
    "role": "farmer"
  }'

# Response:
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid-here",
      "email": "farmer@example.com",
      "firstName": "Rajesh",
      "lastName": "Kumar",
      "role": "farmer"
    },
    "token": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

### 2. User Login
```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "farmer@example.com",
    "password": "SecurePass123!"
  }'

# Response:
{
  "success": true,
  "data": {
    "user": { ... },
    "token": "..."
  }
}
```

### 3. Get User Profile
```bash
curl -X GET http://localhost:3000/api/v1/auth/profile \
  -H "Authorization: Bearer <token-from-login>"

# Response:
{
  "success": true,
  "data": {
    "id": "...",
    "email": "...",
    "firstName": "...",
    ...
  }
}
```

### 4. Create Consultation
```bash
curl -X POST http://localhost:3000/api/v1/consultations \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "veterinarianId": "vet-uuid",
    "animalType": "cow",
    "symptomDescription": "Not eating, weakness",
    "scheduledAt": "2024-01-22T10:00:00Z"
  }'

# Response:
{
  "success": true,
  "data": {
    "id": "consultation-uuid",
    "userId": "...",
    "veterinarianId": "...",
    "animalType": "cow",
    "status": "scheduled",
    "createdAt": "2024-01-19T10:00:00Z"
  }
}
```

### 5. Health Check
```bash
curl http://localhost:3000/api/v1/health

# Response:
{
  "status": "OK",
  "timestamp": "2024-01-19T10:00:00.000Z"
}
```

## Testing Strategy

### Unit Tests (Tests/Unit/)
- Test individual functions and methods
- Mock external dependencies
- Focus on business logic

**Example: Password Hashing**
```typescript
it('should hash password correctly', async () => {
  const hash = await SecurityUtils.hashPassword('password');
  const match = await SecurityUtils.comparePassword('password', hash);
  expect(match).toBe(true);
});
```

### Integration Tests (Tests/Integration/)
- Test API endpoints end-to-end
- Use real application context
- Test middleware and error handling

**Example: Authentication Flow**
```typescript
it('should register and login user', async () => {
  const registerRes = await request(app)
    .post('/api/v1/auth/register')
    .send({ ... });
  
  expect(registerRes.status).toBe(201);
  expect(registerRes.body.data.token).toBeDefined();
});
```

### Test Coverage Goals
- Line Coverage: 80%+
- Branch Coverage: 75%+
- Function Coverage: 85%+

## Logging Framework

### Log Levels
1. **ERROR** - Application errors that need attention
2. **WARN** - Warning conditions
3. **INFO** - General informational messages
4. **DEBUG** - Debugging information
5. **TRACE** - Detailed trace information

### Log Files
- `logs/error.log` - Only errors (max 5MB, 5 files)
- `logs/combined.log` - All logs (max 5MB, 5 files)
- Console - Development mode only

### Log Format
```json
{
  "timestamp": "2024-01-19 10:00:00",
  "level": "info",
  "service": "veterinary-consultation-api",
  "message": "User created successfully",
  "userId": "uuid",
  "requestId": "req-uuid",
  "duration": "45ms"
}
```

## Error Handling Examples

### Validation Error (400)
```json
{
  "success": false,
  "error": {
    "message": "Email already registered",
    "code": "VALIDATION_ERROR",
    "statusCode": 400,
    "timestamp": "2024-01-19T10:00:00.000Z",
    "requestId": "..."
  }
}
```

### Not Found Error (404)
```json
{
  "success": false,
  "error": {
    "message": "User with id 123 not found",
    "code": "NOT_FOUND",
    "statusCode": 404,
    "timestamp": "..."
  }
}
```

### Unauthorized Error (401)
```json
{
  "success": false,
  "error": {
    "message": "Unauthorized access",
    "code": "UNAUTHORIZED",
    "statusCode": 401,
    "timestamp": "..."
  }
}
```

## Environment Configuration

### Development (.env)
```
NODE_ENV=development
PORT=3000
DB_HOST=localhost
DB_PORT=5432
REDIS_HOST=localhost
LOG_LEVEL=debug
```

### Production
```
NODE_ENV=production
PORT=3000
DB_HOST=prod-db-server
DB_PASSWORD=<secure-password>
REDIS_HOST=prod-redis-server
JWT_SECRET=<secure-secret>
LOG_LEVEL=error
```

## Database Schema

### users table
```sql
- id (UUID, PRIMARY KEY)
- email (VARCHAR, UNIQUE)
- first_name, last_name (VARCHAR)
- role (farmer, pet_owner, veterinarian, admin)
- phone (VARCHAR)
- password_hash (VARCHAR)
- is_active (BOOLEAN)
- created_at, updated_at (TIMESTAMP)
```

### consultations table
```sql
- id (UUID, PRIMARY KEY)
- user_id, veterinarian_id (UUID, FOREIGN KEY)
- animal_type (VARCHAR)
- symptom_description (TEXT)
- status (scheduled, in_progress, completed, cancelled)
- scheduled_at, started_at, completed_at (TIMESTAMP)
- diagnosis, prescription (TEXT)
- created_at, updated_at (TIMESTAMP)
```

## CI/CD Pipeline (GitHub Actions)

### Automated Checks
1. **Code Quality**
   - ESLint for code style
   - TypeScript compilation check

2. **Testing**
   - Unit tests with Jest
   - Integration tests with Supertest
   - Code coverage report

3. **Building**
   - Docker image build
   - Frontend build

4. **Deployment Ready**
   - All checks must pass before merge
   - Automatic deployment on main branch

## Running the Demo

### Docker Compose Method (No Node.js needed)
```bash
# 1. Start services
docker-compose up -d

# 2. Wait for services to be healthy (30 seconds)
# Check: docker-compose ps

# 3. Test API endpoints using curl or Postman
curl http://localhost:3000/api/v1/health

# 4. View logs
docker-compose logs -f backend

# 5. Stop services
docker-compose down
```

### Local Development Method (With Node.js)
```bash
# 1. Install Node.js 18+
# 2. Install dependencies
cd backend && npm install

# 3. Create logs directory
mkdir logs

# 4. Run tests
npm run test

# 5. Start server
npm run dev

# 6. Test endpoints
curl http://localhost:3000/api/v1/health
```

## Key Features Implemented

✅ **Enterprise Architecture**
- Layered architecture with separation of concerns
- Service-oriented design
- Dependency injection pattern

✅ **Security**
- JWT authentication
- Password hashing (bcryptjs)
- SQL injection prevention
- CORS and rate limiting

✅ **Error Handling**
- Custom error classes
- Proper HTTP status codes
- Error logging and tracking

✅ **Logging**
- Winston logging framework
- Separate error and combined logs
- Request ID tracking

✅ **Database**
- PostgreSQL with connection pooling
- Transaction support
- Schema migrations
- Performance indexes

✅ **Caching**
- Redis integration
- TTL support
- Cache invalidation

✅ **Testing**
- Unit tests with Jest
- Integration tests with Supertest
- Test fixtures and mocking
- Code coverage tracking

✅ **DevOps**
- Docker containerization
- Docker Compose for local development
- GitHub Actions CI/CD
- Environment configuration

✅ **API Design**
- RESTful endpoints
- Proper versioning (/api/v1/)
- Consistent response format
- Comprehensive documentation

## Future Enhancements

### Phase 2: AI Features
- Symptom analysis using LLMs (Ollama/Mistral)
- Medical image recognition (TensorFlow)
- Prescription generation assistance

### Phase 3: Real-time Features
- WebRTC video consultations (Janus/LiveKit)
- Real-time chat (Socket.io)
- Push notifications (FCM)

### Phase 4: Scaling
- Microservices separation
- Message queue (RabbitMQ/Kafka)
- Kubernetes deployment
- Multi-region setup

### Phase 5: Localization
- Multi-language support
- Regional language NLP
- Local payment gateways
- Regional compliance

## Support & Troubleshooting

### Common Issues

**Port Already in Use**
```bash
# Check what's using the port
netstat -ano | findstr :3000

# Kill the process
taskkill /PID <PID> /F
```

**Database Connection Failed**
```bash
# Check PostgreSQL is running
# Verify connection string in .env
# Ensure database exists
psql -U postgres -h localhost -d veterinary_consultation
```

**Redis Connection Failed**
```bash
# Check Redis is running
redis-cli ping

# If not running, start Redis
# Or use Docker: docker run -p 6379:6379 redis:7-alpine
```

## Contact & Resources

- **Documentation**: See README.md
- **Issues**: Create GitHub issues
- **Contributing**: Follow commit conventions
- **License**: MIT

---

**Created**: January 2024
**Last Updated**: January 19, 2024
**Version**: 1.0.0
