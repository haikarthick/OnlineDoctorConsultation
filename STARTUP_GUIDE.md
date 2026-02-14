# 🏥 VetCare Platform - Startup & Testing Guide

## ✅ System Status

Both servers are currently running and operational:

- **Backend API**: Running on `http://localhost:3000`
- **Frontend App**: Running on `http://localhost:5173`
- **Status**: ✅ Ready for use

---

## 🚀 Quick Start

### 1. Access the Application

Open your browser and navigate to:
```
http://localhost:5173
```

You should see the VetCare Platform login screen.

### 2. Create Your Account

Click "Don't have an account? Register here"

**Fill in the registration form:**
- **Email**: Any email address (e.g., `user@example.com`)
- **Password**: Any password (minimum requirements apply)
- **Phone**: Any phone number (e.g., `+1234567890`)
- **First Name**: Your name
- **Last Name**: Your last name
- **Role**: Select one of:
  - `Veterinarian` - Access vet-specific features
  - `Pet Owner` - Access pet owner features
  - `Farmer` - Access farmer features

Click **Register**

### 3. Login

Use the credentials you just created to login:
- **Email**: (the email you registered with)
- **Password**: (the password you registered with)

### 4. Explore the Dashboard

After logging in, you'll see:
- **Role-specific Dashboard** with statistics
- **Sidebar Navigation** with role-filtered menu items
- **Quick Action Buttons** for common tasks
- **Activity Feed** showing recent actions

---

## 🔐 Test Credentials

The system uses mock authentication. You can create multiple test accounts with different roles:

**Example 1: Veterinarian**
```
Email: vet@example.com
Password: VetPass123
Role: Veterinarian
Phone: +1-800-VET-CARE
```

**Example 2: Pet Owner**
```
Email: owner@example.com
Password: OwnerPass456
Role: Pet Owner
Phone: +1-555-PETS-NOW
```

**Example 3: Farmer**
```
Email: farmer@example.com
Password: FarmPass789
Role: Farmer
Phone: +1-555-FARM-001
```

---

## 📱 Testing Role-Based Features

### Veterinarian View
- **Dashboard**: Shows consultation stats, pending appointments, revenue metrics
- **Menu Items**: Consultations, Appointments, Patients, Reports, Settings
- **Features**: Book consultations, manage appointments, view medical records

### Pet Owner View
- **Dashboard**: Shows pet health status, upcoming appointments, medical history
- **Menu Items**: Consultations, Appointments, Medical Records, Settings
- **Features**: Book consultations, reschedule appointments, view pet records

### Farmer View
- **Dashboard**: Shows livestock stats, health alerts, vet contact info
- **Menu Items**: Consultations, Animals, Medical Records, Settings
- **Features**: Request consultations, manage animal health

---

## 📄 Available Pages & Features

### 1. **Dashboard**
- Role-specific overview
- Statistics cards (consultations, appointments, etc.)
- Quick action buttons
- Activity feed

### 2. **Consultations**
- View consultation history
- Book new consultations
- See consultation details (doctor, date, status)
- Status: scheduled, pending, completed

### 3. **Appointments**
- View scheduled appointments
- Reschedule appointments
- See appointment details (doctor, time, type)
- Card-based grid layout

### 4. **Medical Records**
- Access health/medical records
- View record details (pet name, type, doctor)
- Download records
- Track vaccination history

### 5. **Settings**
- **Profile Section**: Edit name, email, phone
- **Preferences**: Notification settings, SMS alerts, marketing consent
- **Security**: Change password, 2FA, active sessions
- **Danger Zone**: Delete account option

### 6. **Other Modules** (role-specific)
- **Patients** (Veterinarian)
- **Animals** (Farmer)
- **Reports** (Veterinarian)

---

## 🧪 Testing Scenarios

### Scenario 1: Create Account & Login
1. Click "Register here"
2. Fill in test credentials
3. Select a role
4. Click Register
5. Login with created credentials
6. Verify dashboard loads correctly

**Expected Result**: ✅ Dashboard displays with role-specific data

### Scenario 2: Navigation & Role-Based Filtering
1. Login as Veterinarian
2. Check sidebar menu - should show: Dashboard, Consultations, Appointments, Patients, Reports, Settings
3. Logout and login as Pet Owner
4. Check sidebar menu - should show: Dashboard, Consultations, Appointments, Medical Records, Settings

**Expected Result**: ✅ Menu items change based on role

### Scenario 3: Responsive Design
1. Open app in browser at `http://localhost:5173`
2. Resize browser window to simulate:
   - Mobile (320-480px width)
   - Tablet (481-768px width)
   - Desktop (769px+ width)
3. Check hamburger menu appears on mobile
4. Verify layout adapts properly

**Expected Result**: ✅ UI responsive on all screen sizes

### Scenario 4: Page Navigation
1. Login to dashboard
2. Click each menu item:
   - Consultations
   - Appointments
   - Medical Records
   - Settings
3. Verify each page loads and displays content

**Expected Result**: ✅ All pages load without errors

### Scenario 5: Settings Form
1. Go to Settings page
2. Update profile information
3. Toggle preferences
4. Verify form is editable (all input fields work)

**Expected Result**: ✅ All form controls are functional

---

## 🔌 API Endpoints Reference

### Health Check
```
GET http://localhost:3000/api/v1/health
```
Response:
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T12:00:00Z"
}
```

### Authentication
```
POST http://localhost:3000/api/v1/auth/register
POST http://localhost:3000/api/v1/auth/login
```

### Dashboard
```
GET http://localhost:3000/api/v1/dashboard
```

### Consultations
```
GET http://localhost:3000/api/v1/consultations
POST http://localhost:3000/api/v1/consultations
```

### Appointments
```
GET http://localhost:3000/api/v1/appointments
PUT http://localhost:3000/api/v1/appointments/:id
```

### Medical Records
```
GET http://localhost:3000/api/v1/medical-records
```

---

## 🛠️ Troubleshooting

### Issue: "Cannot connect to localhost:5173"
**Solution:**
1. Check if frontend is running: `npm run dev` from `frontend` directory
2. Verify port 5173 is not in use by another application
3. Check firewall settings allow localhost connections

### Issue: "Backend API not responding"
**Solution:**
1. Check if backend is running: `npm run dev` from `backend` directory
2. Verify port 3000 is not in use
3. Check backend console for errors

### Issue: "UI looks empty or incomplete"
**Solution:**
1. Clear browser cache: Ctrl+Shift+Delete
2. Refresh page: Ctrl+F5 (hard refresh)
3. Check browser console for errors: F12 → Console tab
4. Verify all components are imported in App.tsx

### Issue: "Login fails"
**Solution:**
1. Verify account was created during registration
2. Check password is entered correctly (case-sensitive)
3. Try creating a new test account
4. Check backend logs for auth errors

### Issue: "Role-based menu not changing"
**Solution:**
1. Logout and login again
2. Clear localStorage: Open DevTools → Application → Storage → localStorage → Clear All
3. Refresh the page
4. Try with a different role account

---

## 📊 System Architecture

### Frontend Stack
- **Framework**: React 18.2.0
- **Build Tool**: Vite 5.4.21
- **Language**: TypeScript
- **Styling**: CSS3 with Flexbox & Grid
- **State Management**: Context API
- **Routing**: React Router patterns
- **Authentication**: JWT in localStorage

### Backend Stack
- **Runtime**: Node.js 24
- **Framework**: Express 4.18.2
- **Language**: TypeScript
- **Database**: Mock In-Memory (PostgreSQL ready)
- **Cache**: Mock Redis In-Memory
- **Authentication**: JWT + bcryptjs
- **Security**: CORS, Rate Limiting, Error Handling

### Security Features
- ✅ Password hashing with bcryptjs
- ✅ JWT token-based authentication (24hr expiration)
- ✅ CORS protection
- ✅ Rate limiting on auth endpoints
- ✅ Secure error messages (no sensitive info leaks)
- ✅ Token refresh mechanism

---

## 📱 Responsive Design Breakpoints

The application is optimized for:

- **Mobile**: 320px - 480px
  - Full-width layout
  - Hamburger menu navigation
  - Single-column lists

- **Tablet**: 481px - 768px
  - Two-column layouts where applicable
  - Side menu with label collapse
  - Optimized touch targets

- **Desktop**: 769px+
  - Full sidebar navigation
  - Multi-column layouts
  - Expanded feature sets

---

## 🚦 Running Tests

### Manual Testing
Use the provided test scripts:

**PowerShell** (Windows):
```powershell
.\system_test.ps1
```

**Bash** (Linux/Mac):
```bash
./system_test.sh
```

These scripts verify:
- Backend API health
- Frontend server status
- Authentication endpoints
- Component presence
- System components

---

## 📝 Project Structure

```
OnlineDoctorConsultation/
├── frontend/
│   ├── src/
│   │   ├── App.tsx                 # Main app with routing
│   │   ├── AuthContext.tsx         # Auth state management
│   │   ├── Layout.tsx              # App shell
│   │   ├── Navigation.tsx          # Sidebar menu
│   │   ├── pages/
│   │   │   ├── Login.tsx
│   │   │   ├── Register.tsx
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Consultations.tsx
│   │   │   ├── Appointments.tsx
│   │   │   ├── MedicalRecords.tsx
│   │   │   └── Settings.tsx
│   │   ├── styles/
│   │   │   └── ModulePage.css
│   │   └── index.tsx
│   └── package.json
│
├── backend/
│   ├── src/
│   │   ├── app.ts                  # Express app
│   │   ├── controllers/
│   │   ├── services/
│   │   ├── models/
│   │   ├── routes/
│   │   ├── middleware/
│   │   └── utils/
│   └── package.json
│
├── docker-compose.yml              # Docker configuration
├── STARTUP_GUIDE.md               # This file
├── SYSTEM_COMPLETE.md             # Complete system documentation
└── README.md                       # Project README
```

---

## ✨ Features Summary

### ✅ Implemented
- Multi-role authentication system
- Role-based dashboard
- Role-based menu filtering
- Professional responsive UI
- Mock database for development
- JWT token authentication
- Password hashing & security
- Settings page with forms
- Modular page architecture
- Comprehensive error handling
- CORS and security headers

### 🎯 Ready to Deploy
- Production-ready code structure
- Environment-based configuration
- Security best practices
- Error handling & logging
- Comprehensive documentation
- Test procedures

---

## 📞 Support

For issues or questions:
1. Check the [Troubleshooting](#-troubleshooting) section
2. Review the [SYSTEM_COMPLETE.md](SYSTEM_COMPLETE.md) for detailed documentation
3. Check browser console (F12) for error messages
4. Check backend logs for API errors
5. Verify ports 3000 and 5173 are available

---

## 🎉 You're All Set!

The VetCare Platform is ready to use. Start by:

1. **Opening** `http://localhost:5173`
2. **Creating** a test account with your preferred role
3. **Logging in** to explore the dashboard
4. **Testing** navigation and role-based features
5. **Checking** responsive design on mobile

**Enjoy exploring the platform!** 🚀
