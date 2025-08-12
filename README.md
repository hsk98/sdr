# SDR Assignment System

A web application for managing round-robin assignment of business consultants to SDRs (Sales Development Representatives).

## Features

### 🎯 Smart Assignment System
- **Advanced Round-robin**: AI-powered fairness algorithm with multi-criteria selection
- **Edge Case Handling**: Graceful handling of consultant availability changes
- **Business Rules**: Configurable assignment limits and cooldown periods

### 🔐 Secure Authentication
- **JWT-based Authentication**: Secure token-based sessions
- **Role-based Access**: Separate interfaces for SDRs and Admins
- **Session Management**: Automatic token refresh and logout

### 📱 Modern SDR Dashboard
- **One-click Assignment**: Large, intuitive "Get Next Assignment" button
- **Consultant Details**: Clean display with contact information and avatars
- **Assignment History**: Visual timeline with status indicators and timestamps
- **Mobile-first Design**: Responsive, touch-friendly interface
- **Real-time Updates**: Live data synchronization

### ⚙️ Comprehensive Admin Panel
- **Consultant Management**: Full CRUD operations with availability tracking
- **User Administration**: Create and manage SDR accounts
- **Advanced Analytics**: Assignment distribution, fairness scoring, and trends
- **Audit Logging**: Complete activity trail for compliance
- **System Monitoring**: Health checks and performance metrics

### 🚀 Enterprise Features
- **Docker Deployment**: Production-ready containerization
- **Database Flexibility**: PostgreSQL for production, SQLite for development
- **Horizontal Scaling**: Load balancer ready with Redis support
- **Comprehensive Logging**: File-based audit trails with filtering

## Tech Stack

- **Backend**: Node.js, Express.js, PostgreSQL
- **Frontend**: React, TypeScript, React Router
- **Authentication**: JWT-based authentication
- **Database**: PostgreSQL with connection pooling

## Project Structure

```
sdr-assignment-system/
├── backend/
│   ├── src/
│   │   ├── config/          # Database configuration
│   │   ├── controllers/     # Route handlers
│   │   ├── middleware/      # Authentication middleware
│   │   ├── models/          # Database models and schema
│   │   └── routes/          # API routes
│   ├── .env                 # Environment variables
│   ├── package.json
│   └── server.js           # Main server file
├── frontend/
│   ├── src/
│   │   ├── components/      # React components
│   │   ├── contexts/        # React contexts
│   │   ├── services/        # API services
│   │   └── types/          # TypeScript types
│   ├── public/
│   └── package.json
└── README.md
```

## Quick Start

### Option 1: Docker (Recommended)

**Prerequisites**: Docker and Docker Compose

```bash
# Clone the repository
git clone <repository-url>
cd sdr-assignment-system

# Quick setup with Docker
./scripts/setup.sh

# Or manually:
cp .env.example .env
docker-compose up -d
```

**Access URLs:**
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001
- Full Application: http://localhost:8080

### Option 2: Local Development

**Prerequisites**: Node.js 18+, PostgreSQL 14+ (or use SQLite)

```bash
# Clone and install
git clone <repository-url>
cd sdr-assignment-system

# Install dependencies
cd backend && npm install
cd ../frontend && npm install

# Quick setup with SQLite (no PostgreSQL needed)
cd backend
cp .env.example .env
# Edit .env to set DATABASE_TYPE=sqlite

# Start services
cd backend && npm run dev    # Terminal 1
cd frontend && npm start     # Terminal 2
```

## Production Deployment

### Docker Production Deployment

```bash
# Setup production environment
cp .env.example .env
# Edit .env for production settings

# Deploy to production
./scripts/production-deploy.sh

# Or manually:
docker-compose -f docker-compose.prod.yml up -d
```

### Manual Production Setup

1. **Database Setup**:
```sql
CREATE DATABASE sdr_assignment_system;
psql -d sdr_assignment_system -f docker/postgres/init.sql
```

2. **Environment Configuration**:
```env
NODE_ENV=production
JWT_SECRET=your-secure-32-character-secret
DB_HOST=your-postgres-host
DB_PASSWORD=your-secure-password
```

3. **Build and Deploy**:
```bash
# Backend
cd backend
npm install --production
npm start

# Frontend  
cd frontend
npm run build
# Serve build/ with nginx or static server
```

## Default Credentials

**Admin Account**:
- Username: `admin`
- Password: `admin123`

**Note**: Create SDR accounts through the admin panel after logging in.

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration (admin only)
- `GET /api/auth/profile` - Get user profile

### Consultants
- `GET /api/consultants` - Get all consultants
- `GET /api/consultants/active` - Get active consultants
- `POST /api/consultants` - Create consultant (admin only)
- `PUT /api/consultants/:id` - Update consultant (admin only)
- `DELETE /api/consultants/:id` - Delete consultant (admin only)

### Assignments
- `POST /api/assignments/next` - Get next assignment (SDR only)
- `GET /api/assignments/my` - Get my assignments (SDR only)
- `GET /api/assignments/my/latest` - Get latest assignment (SDR only)
- `GET /api/assignments` - Get all assignments (admin only)
- `GET /api/assignments/stats` - Get assignment statistics (admin only)
- `PUT /api/assignments/:id/status` - Update assignment status

## Usage

### For SDRs
1. Log in with your SDR credentials
2. Click "Get Next Assignment" to receive a consultant
3. Contact the assigned consultant
4. Mark assignment as "Completed" when done

### For Admins
1. Log in with admin credentials
2. **Consultants Tab**: Add, edit, or remove business consultants
3. **Assignments Tab**: View all assignments across the team
4. **Statistics Tab**: Monitor assignment distribution and fairness
5. **Users Tab**: Create new SDR and admin accounts

## Round-Robin Logic

The system ensures fair distribution by:
1. Tracking assignment counts for each consultant
2. Assigning the consultant with the lowest assignment count
3. Using last assignment date as a tiebreaker
4. Only considering active consultants for assignments

## Development

### Running Tests
```bash
# Backend tests
cd backend
npm test

# Frontend tests
cd frontend
npm test
```

### Building for Production
```bash
# Build frontend
cd frontend
npm run build

# Start backend in production mode
cd backend
NODE_ENV=production npm start
```

## Security Considerations

- Change the default JWT secret in production
- Use strong passwords for database and admin accounts
- Enable HTTPS in production
- Regularly update dependencies
- Consider implementing rate limiting for API endpoints

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License