# SDR Assignment System - Project Structure

## Overview
A full-stack web application for managing round-robin assignment of business consultants to SDRs with Docker deployment support.

## Project Structure

```
sdr-assignment-system/
├── backend/                          # Express.js API Server
│   ├── src/
│   │   ├── config/                   # Database and app configuration
│   │   │   └── database.js           # Database connection setup
│   │   ├── controllers/              # Request handlers
│   │   │   ├── authController.js     # Authentication logic
│   │   │   ├── consultantController.js # Consultant management
│   │   │   └── assignmentController.js # Assignment logic
│   │   ├── middleware/               # Express middleware
│   │   │   └── auth.js               # JWT authentication middleware
│   │   ├── models/                   # Data models and database schema
│   │   │   ├── User.js               # User model (SDRs and Admins)
│   │   │   ├── Consultant.js         # Consultant model
│   │   │   ├── Assignment.js         # Assignment model
│   │   │   └── schema.sql            # Database schema
│   │   ├── routes/                   # API route definitions
│   │   │   ├── auth.js               # Authentication routes
│   │   │   ├── consultants.js        # Consultant routes
│   │   │   └── assignments.js        # Assignment routes
│   │   ├── services/                 # Business logic services
│   │   │   └── AssignmentService.js  # Enhanced round-robin logic
│   │   └── utils/                    # Utility functions
│   │       └── logger.js             # Audit logging system
│   ├── logs/                         # Application logs
│   ├── .env                          # Environment variables
│   ├── .dockerignore                 # Docker ignore file
│   ├── Dockerfile                    # Backend Docker configuration
│   ├── package.json                  # Backend dependencies
│   └── server.js                     # Main server file
├── frontend/                         # React.js Client App
│   ├── public/                       # Static files
│   │   └── index.html                # Main HTML template
│   ├── src/
│   │   ├── components/               # React components
│   │   │   ├── Login.tsx             # Login page
│   │   │   ├── Login.css             # Login styles
│   │   │   ├── SDRDashboard.tsx      # SDR interface
│   │   │   ├── AdminDashboard.tsx    # Admin panel
│   │   │   ├── ProtectedRoute.tsx    # Route protection
│   │   │   └── Dashboard.css         # Dashboard styles
│   │   ├── contexts/                 # React contexts
│   │   │   └── AuthContext.tsx       # Authentication context
│   │   ├── services/                 # API service layer
│   │   │   └── api.ts                # API client functions
│   │   ├── types/                    # TypeScript type definitions
│   │   │   └── index.ts              # Shared types
│   │   ├── App.tsx                   # Main app component
│   │   ├── App.css                   # Global styles
│   │   └── index.tsx                 # App entry point
│   ├── .dockerignore                 # Docker ignore file
│   ├── Dockerfile                    # Frontend Docker configuration
│   ├── package.json                  # Frontend dependencies
│   └── tsconfig.json                 # TypeScript configuration
├── docker/                           # Docker configuration files
│   ├── postgres/                     # PostgreSQL configuration
│   │   └── init.sql                  # Database initialization
│   └── nginx/                        # Nginx configuration
│       └── nginx.conf                # Reverse proxy setup
├── docker-compose.yml                # Multi-container orchestration
├── docker-compose.prod.yml           # Production configuration
├── .env.example                      # Environment template
├── README.md                         # Project documentation
├── DEPLOYMENT.md                     # Deployment instructions
└── ROUND_ROBIN_DOCUMENTATION.md     # Assignment algorithm docs

## Technology Stack

### Backend
- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: PostgreSQL 14+ (with SQLite fallback)
- **Authentication**: JWT (JSON Web Tokens)
- **Security**: Helmet.js, CORS, bcryptjs
- **Logging**: Custom audit logger with file storage

### Frontend
- **Framework**: React 18+ with TypeScript
- **Routing**: React Router DOM
- **HTTP Client**: Axios
- **State Management**: React Context API
- **Styling**: CSS3 with responsive design

### Infrastructure
- **Containerization**: Docker & Docker Compose
- **Reverse Proxy**: Nginx
- **Database**: PostgreSQL (containerized)
- **Deployment**: Multi-stage Docker builds

## Key Features

### Authentication & Authorization
- JWT-based authentication
- Role-based access control (SDR, Admin)
- Protected routes and API endpoints
- Session management

### Round-Robin Assignment
- Advanced fairness algorithm
- Multi-criteria consultant selection
- Business rule enforcement
- Edge case handling

### Data Management
- CRUD operations for consultants
- Assignment tracking and history
- User management (admin only)
- Data validation and sanitization

### Monitoring & Analytics
- Comprehensive audit logging
- Assignment analytics and reporting
- Fairness scoring and monitoring
- System health endpoints

### User Interfaces
- **SDR Dashboard**: Get assignments, view history
- **Admin Panel**: Manage consultants, users, view analytics
- **Responsive Design**: Works on desktop and mobile
- **Real-time Updates**: Dynamic data loading

## Database Schema

### Users Table
- User authentication and profile information
- Role-based access control
- SDR and Admin user types

### Consultants Table
- Business consultant information
- Availability status management
- Contact details and metadata

### Assignments Table
- Assignment tracking and history
- Status management (active, completed, cancelled)
- Relationship between SDRs and consultants

### Assignment Counts Table
- Round-robin fairness tracking
- Assignment counters per consultant
- Last assignment timestamps

## Security Features

### Authentication
- Password hashing with bcryptjs
- JWT token-based sessions
- Token expiration and refresh
- Protected API endpoints

### Authorization
- Role-based route protection
- API endpoint access control
- User action auditing
- Admin-only operations

### Data Protection
- Input validation and sanitization
- SQL injection prevention
- XSS protection headers
- CORS configuration

## Deployment Options

### Development
- Local development with npm/yarn
- SQLite database for quick setup
- Hot reloading for both frontend and backend

### Docker Development
- Multi-container setup with docker-compose
- PostgreSQL database container
- Nginx reverse proxy
- Volume mounting for development

### Production Deployment
- Multi-stage Docker builds
- Optimized production images
- Environment-based configuration
- Health checks and monitoring

## Environment Configuration

### Development
- SQLite database (no setup required)
- Local file-based logging
- Debug mode enabled
- Hot reloading

### Production
- PostgreSQL database
- Centralized logging
- Performance optimizations
- Security hardening

This structure provides a scalable, maintainable, and deployable full-stack application with enterprise-level features.