# Online Veterinary Doctor Consultation Platform

Enterprise-grade AI-assisted SaaS platform for veterinary consultations connecting farmers, pet owners, and veterinary doctors.

## Architecture Overview

### Technology Stack
- **Backend**: Node.js + Express + TypeScript
- **Database**: PostgreSQL
- **Cache**: Redis
- **Frontend**: React (to be implemented)
- **Containerization**: Docker & Docker Compose
- **Testing**: Jest, Supertest

### Project Structure

```
backend/
├── src/
│   ├── config/          # Configuration management
│   ├── controllers/      # Request handlers
│   ├── services/         # Business logic
│   ├── models/           # Data types and interfaces
│   ├── middleware/       # Express middleware
│   ├── routes/           # API routes
│   ├── utils/            # Utility functions
│   ├── app.ts            # Express app setup
│   └── index.ts          # Server entry point
├── tests/
│   ├── unit/             # Unit tests
│   ├── integration/       # Integration tests
│   └── setup.ts          # Test configuration
├── docker/               # Docker configurations
└── package.json
```

## Key Features

### Architecture Patterns
- **Layered Architecture**: Clean separation of concerns (controllers, services, models)
- **Dependency Injection**: Service-based approach
- **Error Handling**: Custom error classes with proper HTTP status codes
- **Logging**: Winston-based comprehensive logging
- **Middleware Pipeline**: Authentication, validation, request logging
- **Async Error Handling**: Express async errors wrapper

### Security Features
- **Password Hashing**: bcryptjs with salt rounds
- **JWT Authentication**: Token-based authentication
- **CORS Protection**: Configurable CORS policies
- **Helmet**: HTTP headers security
- **Rate Limiting**: Express rate limiter
- **SQL Injection Prevention**: Parameterized queries

### Database
- **Transaction Support**: ACID compliance for critical operations
- **Connection Pooling**: Optimized database connections
- **Schema Migrations**: SQL-based migrations
- **Indexes**: Performance optimization for common queries

## Setup & Installation

### Prerequisites
- Node.js 18+
- Docker & Docker Compose
- PostgreSQL 15+ (if running locally without Docker)
- Redis 7+ (if running locally without Docker)

### Development Setup

1. **Clone and Navigate**
```bash
cd backend
npm install
```

2. **Environment Configuration**
```bash
# .env file is already configured
# Update values as needed for your environment
```

3. **Run with Docker Compose**
```bash
cd ..
docker-compose up -d
```

4. **Run Tests**
```bash
cd backend
npm run test              # Run all tests
npm run test:unit        # Run unit tests only
npm run test:integration # Run integration tests only
```

5. **Development Mode**
```bash
npm run dev
```

## API Documentation

### Authentication Endpoints

**Register User**
```
POST /api/v1/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "phone": "+919876543210",
  "password": "securePassword123!",
  "role": "pet_owner"
}

Response: { token, user }
```

**Login**
```
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securePassword123!"
}

Response: { token, user }
```

**Get Profile**
```
GET /api/v1/auth/profile
Authorization: Bearer <token>

Response: { user }
```

### Consultation Endpoints

**Create Consultation**
```
POST /api/v1/consultations
Authorization: Bearer <token>
Content-Type: application/json

{
  "veterinarianId": "vet-uuid",
  "animalType": "dog",
  "symptomDescription": "Coughing and fever",
  "scheduledAt": "2024-01-20T10:00:00Z"
}

Response: { consultation }
```

**Get Consultation**
```
GET /api/v1/consultations/:id
Authorization: Bearer <token>

Response: { consultation }
```

**Update Consultation**
```
PUT /api/v1/consultations/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "status": "completed",
  "diagnosis": "Bacterial infection",
  "prescription": "Amoxicillin 500mg"
}

Response: { consultation }
```

**List Consultations**
```
GET /api/v1/consultations?limit=10&offset=0
Authorization: Bearer <token>

Response: { consultations }
```

### System Endpoints

**Health Check**
```
GET /api/v1/health

Response: { status: "OK", timestamp }
```

## Testing

### Test Coverage
- Unit Tests: 85%+ coverage for utilities and services
- Integration Tests: API endpoint testing
- Mocking: Database and cache mocking for isolation

### Run Tests
```bash
npm run test              # All tests with coverage
npm run test:watch      # Watch mode
npm run test:unit       # Unit tests only
npm run test:integration # Integration tests only
```

## Deployment

### Docker Build & Run
```bash
# Build
docker build -f docker/Dockerfile.backend -t vet-consultation-api .

# Run with Docker Compose
docker-compose up

# Run individual container
docker run -p 3000:3000 \
  -e DB_HOST=postgres \
  -e REDIS_HOST=redis \
  vet-consultation-api
```

### Environment Variables
```
NODE_ENV=production
PORT=3000
DB_HOST=postgres
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=<secure-password>
DB_NAME=veterinary_consultation
REDIS_HOST=redis
JWT_SECRET=<secure-jwt-secret>
JWT_EXPIRES_IN=24h
```

## Monitoring & Logging

### Logs Location
- `logs/error.log` - Error logs
- `logs/combined.log` - All logs

### Log Format
```json
{
  "level": "info",
  "message": "User logged in",
  "service": "veterinary-consultation-api",
  "timestamp": "2024-01-19T10:00:00Z",
  "userId": "user-uuid",
  "requestId": "req-uuid"
}
```

## Development Workflow

### Code Quality
```bash
npm run lint              # Check code style
npm run lint:fix        # Fix code style issues
```

### Commit Guidelines
- Use conventional commits
- Include test coverage for new features
- Update documentation

## Future Enhancements

1. **AI Features**
   - Symptom analysis using LLMs
   - Medical image recognition
   - Prescription generation assistance

2. **Real-time Features**
   - WebRTC for video consultations
   - Real-time chat
   - Notification system

3. **Scalability**
   - Microservices separation
   - Message queue (RabbitMQ/Kafka)
   - Kubernetes deployment

4. **Localization**
   - Multi-language support
   - Regional language support (Hindi, Tamil, etc.)
   - Local payment gateway integration

## Contributing

1. Create a feature branch
2. Write tests for new features
3. Ensure 85%+ code coverage
4. Submit pull request with description

## License

MIT License - See LICENSE file for details

## Support

For issues and questions:
- Create an issue in the repository
- Check existing documentation
- Contact the development team

---

**Note**: This is a development template. For production deployment, ensure all environment variables are properly configured with secure values.
