# 🏥 VetCare Platform - Professional Online Doctor Consultation System

A comprehensive, enterprise-grade veterinary consultation platform with role-based access, modern UI, and full authentication system.

## ✨ Features

### 🔐 Authentication & Authorization
- Multi-role support: **Veterinarian**, **Pet Owner**, **Farmer**
- Secure JWT-based authentication with 24-hour token expiration
- bcryptjs password hashing (10 salt rounds)
- Role-based dashboard and menu filtering
- Persistent login with localStorage
- Register/Login flows with validation

### 🎨 Professional UI/UX
- **Responsive Design**: Works on Desktop, Tablet, Mobile (480px - 1200px+)
- **Modern Interface**: Gradient design system with purple theme (#667eea → #764ba2)
- **Professional Navigation**: 
  - Desktop: Fixed sidebar with user profile
  - Mobile: Hamburger menu with slide-in drawer
  - Active route highlighting
- **Component Library**: Reusable cards, buttons, badges, tables
- **Smooth Animations**: Fade-in, slide-up effects on page transitions

### 📱 Module-Based Architecture
Easily extensible system with core modules:
- **Dashboard**: Role-aware overview with stats and quick actions
- **Consultations**: Book and manage doctor consultations
- **Appointments**: View and reschedule appointments
- **Medical Records**: Access and download health records
- **Settings**: Profile, preferences, security configuration

### 🛠 Technology Stack

**Frontend**
- React 18.2.0 with TypeScript
- Vite 5.4.21 (lightning-fast dev server)
- React Router for navigation
- Context API for state management
- CSS-in-JS and modular stylesheets

**Backend**
- Node.js with Express 4.18.2
- TypeScript for type safety
- In-memory mock database (SQL parsing)
- In-memory mock Redis cache
- JWT authentication with jsonwebtoken
- bcryptjs for password security
- Winston for logging
- CORS and security middleware

**Database**
- PostgreSQL 18 (ready for production)
- Mock in-memory database for development
- Schema with users, consultations, medical records tables

## 🚀 Quick Start

### Prerequisites
- Node.js v24+
- npm or yarn
- PostgreSQL 18 (optional - uses mock DB in dev)

### Installation

```bash
# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### Running the Application

#### Terminal 1 - Backend Server
```bash
cd backend
npm run dev
# Server runs on http://localhost:3000
```

#### Terminal 2 - Frontend Server
```bash
cd frontend
npm run dev
# Application runs on http://localhost:5173
```

### Access Points
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3000
- **Health Check**: http://localhost:3000/api/v1/health

## 📋 Available Endpoints

### Authentication
- `POST /api/v1/auth/register` - User registration
- `POST /api/v1/auth/login` - User login
- `GET /api/v1/health` - Health check

### Response Format
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "role": "pet_owner"
    },
    "token": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

## 👥 User Roles & Permissions

### Veterinarian
- View all patients
- Manage consultations
- Generate reports
- Access medical history

### Pet Owner
- Book consultations
- View pet profiles
- Access medical records
- Schedule appointments

### Farmer
- Manage herd of animals
- Schedule vaccinations
- Access livestock records
- Consult veterinarians

## 🎯 Navigation Menu (Role-Filtered)

| Module | Vet | Pet Owner | Farmer |
|--------|-----|-----------|--------|
| Dashboard | ✓ | ✓ | ✓ |
| Consultations | ✓ | ✓ | ✓ |
| Appointments | ✓ | ✓ | ✓ |
| Medical Records | ✓ | ✓ | ✗ |
| Patients | ✓ | ✗ | ✗ |
| My Animals | ✗ | ✓ | ✓ |
| Reports | ✓ | ✗ | ✓ |
| Settings | ✓ | ✓ | ✓ |

## 🎨 UI Components

### Dashboard
- **Stats Cards**: Show key metrics with icons
- **Quick Actions**: Role-specific action buttons
- **Recent Activity**: Timeline of recent events
- **Pro Tips Section**: Educational resources

### Navigation
- **User Profile Section**: Avatar, name, role
- **Menu Items**: Dynamic filtering by role
- **Active Route Indicator**: Visual highlight
- **Logout Button**: Secure session termination

### Module Pages
- **Data Tables**: Sortable, responsive tables
- **Cards**: Information display with actions
- **Forms**: Input validation and error handling
- **Status Badges**: Color-coded status indicators

## 📊 Design System

### Color Palette
- Primary Gradient: `#667eea` → `#764ba2`
- Background: `#f5f5f5`
- Surface: `#ffffff`
- Text: `#1a1a1a`
- Text Secondary: `#666666`
- Border: `#e0e0e0`

### Spacing
- 8px grid system
- 4px, 8px, 12px, 16px, 24px, 32px padding options

### Typography
- Heading: 28-32px, 700 weight
- Subheading: 16-18px, 600 weight
- Body: 13-14px, 500 weight
- Label: 12-13px, 600 weight

### Breakpoints
- Desktop: >1200px (full layout)
- Tablet: 768px-1200px (adjusted grid)
- Mobile: <768px (sidebar hamburger)
- Small Mobile: <480px (compact buttons)

## 🔒 Security Features

- **Password Hashing**: bcryptjs with 10 salt rounds
- **Token-Based Auth**: JWT with 24-hour expiration
- **CORS Protection**: Configured for localhost development
- **Input Validation**: Client and server-side validation
- **Secure Headers**: Helmet.js integration
- **Rate Limiting**: 100 requests per 15 minutes

## 📦 Project Structure

```
OnlineDoctorConsultation/
├── backend/
│   ├── src/
│   │   ├── controllers/        # Route handlers
│   │   ├── services/           # Business logic
│   │   ├── middleware/         # Auth, logging
│   │   ├── utils/              # Helpers, database
│   │   ├── models/             # Type definitions
│   │   ├── routes/             # API endpoints
│   │   ├── app.ts              # Express app
│   │   └── index.ts            # Server entry
│   ├── tests/                  # Test suites
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/
│   ├── src/
│   │   ├── components/         # Reusable components
│   │   ├── pages/              # Page components
│   │   ├── context/            # Auth context
│   │   ├── types/              # TypeScript types
│   │   ├── App.tsx             # Main app component
│   │   ├── main.tsx            # Entry point
│   │   └── App.css             # Global styles
│   ├── index.html              # HTML template
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
│
└── README.md
```

## 🧪 Testing

### Manual Testing Steps

1. **Register a New User**
   - Navigate to registration page
   - Fill in all fields
   - Select a role (Veterinarian/Pet Owner/Farmer)
   - Submit

2. **Login**
   - Enter email and password
   - Verify dashboard loads
   - Check role-specific menu items

3. **Navigate Modules**
   - Click menu items
   - Verify role-based filtering
   - Check responsive layout on mobile

4. **Test API**
   - Health check: `curl http://localhost:3000/api/v1/health`
   - Register: `curl -X POST http://localhost:3000/api/v1/auth/register ...`

## 📝 Environment Configuration

### Backend (.env)
```env
NODE_ENV=development
PORT=3000
MOCK_DB=true
MOCK_CACHE=true
CORS_ORIGIN=http://localhost:5173
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=24h
DB_PASSWORD=computer
```

### Frontend (No .env needed)
- API Base: `http://localhost:3000`
- Token Storage: `localStorage['authToken']`
- User Data: `localStorage['authUser']`

## 🎓 Learning Resources

### Authentication Flow
1. User registers with email, password, and role
2. Backend hashes password with bcryptjs
3. User data stored in mock database
4. JWT token generated and returned
5. Frontend stores token in localStorage
6. All subsequent requests include token in headers

### State Management
- **AuthContext**: Centralized authentication state
- **useAuth Hook**: Access auth anywhere in app
- **localStorage**: Persistent user session
- **React useState**: Local component state

### Responsive Design
- Mobile-first approach
- Flexbox and CSS Grid layouts
- Media queries at 480px, 768px, 1200px
- Hamburger menu on mobile
- Sidebar on desktop

## 🚨 Troubleshooting

### Frontend blank screen
- Clear browser cache and reload
- Check console for errors (F12)
- Verify backend is running
- Restart dev server with `npm run dev`

### Backend API not responding
- Check if port 3000 is in use: `netstat -ano | findstr ":3000"`
- Verify database connection in logs
- Restart backend server

### Authentication failed
- Verify email/password are correct
- Check localStorage for token: `localStorage.getItem('authToken')`
- Clear localStorage if corrupted: `localStorage.clear()`
- Register a new account

### Styling issues
- Clear CSS cache: Hard refresh (Ctrl+Shift+R)
- Check if Navigation.css is loading
- Verify media query breakpoints

## 📈 Performance Optimizations

- Lazy loading with React.lazy()
- Code splitting by routes
- Vite's hot module replacement (HMR)
- Optimized bundle size
- localStorage for reduced API calls

## 🔄 Deployment Ready

The application is ready for production deployment with:
- TypeScript compilation
- Production build optimization
- Security middleware
- Environment configuration
- Error handling and logging
- Database migration scripts

## 📞 Support

For issues or questions:
1. Check the troubleshooting section
2. Review component documentation
3. Check browser console for errors
4. Verify backend logs

## 📄 License

This project is provided as-is for demonstration and educational purposes.

---

**Version**: 1.0.0  
**Last Updated**: January 19, 2026  
**Status**: ✅ Production Ready
