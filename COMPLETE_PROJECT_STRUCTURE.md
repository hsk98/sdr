# SDR Assignment System - Complete Project Structure

## 📁 Root Directory Structure

```
sdr-assignment-system/
├── 📄 README.md                           # Main project documentation
├── 📄 DASHBOARD_FEATURES.md               # SDR dashboard feature documentation
├── 📄 DEPLOYMENT.md                       # Deployment guide and instructions
├── 📄 ROUND_ROBIN_DOCUMENTATION.md        # Round-robin algorithm documentation
├── 🐳 docker-compose.yml                  # Development Docker configuration
├── 🐳 docker-compose.prod.yml             # Production Docker configuration
├── 📁 backend/                            # Backend API server
├── 📁 frontend/                           # React frontend application
├── 📁 docker/                             # Docker configuration files
├── 📁 scripts/                            # Deployment and utility scripts
├── 📄 setup.sh                            # Main setup script
├── 📄 setup-simple.sh                     # Simplified setup script
└── 📄 install-postgresql.sh               # PostgreSQL installation script
```

## 🔧 Backend (`/backend/`)

### Core Files
```
backend/
├── 📄 server.js                           # Main Express server entry point
├── 📄 package.json                        # Node.js dependencies and scripts
├── 📄 Dockerfile                          # Docker container configuration
├── 📄 database.sqlite                     # SQLite database (development)
└── 📁 logs/                               # Application logs directory
```

### Source Code (`/backend/src/`)

#### Configuration (`/src/config/`)
```
config/
├── 📄 database.js                         # Main database configuration
├── 📄 database-postgres.js                # PostgreSQL configuration
└── 📄 database-sqlite.js                  # SQLite configuration
```
- **Purpose**: Database connection settings for different environments
- **Features**: Automatic fallback from PostgreSQL to SQLite

#### Controllers (`/src/controllers/`)
```
controllers/
├── 📄 authController.js                   # Authentication logic
├── 📄 consultantController.js             # Consultant management logic
└── 📄 assignmentController.js             # Assignment management logic
```
- **Purpose**: Handle HTTP requests and business logic
- **Features**: Input validation, error handling, response formatting

#### Middleware (`/src/middleware/`)
```
middleware/
└── 📄 auth.js                             # JWT authentication middleware
```
- **Purpose**: Request processing and security
- **Features**: Token validation, role-based access control

#### Models (`/src/models/`)
```
models/
├── 📄 User.js                             # User data model
├── 📄 Consultant.js                       # Consultant data model
├── 📄 Assignment.js                       # Assignment data model
└── 📄 schema.sql                          # Database schema definition
```
- **Purpose**: Data models and database operations
- **Features**: CRUD operations, data validation

#### Routes (`/src/routes/`)
```
routes/
├── 📄 auth.js                             # Authentication endpoints
├── 📄 consultants.js                      # Consultant CRUD endpoints
├── 📄 assignments.js                      # Assignment management endpoints
├── 📄 analytics.js                        # Analytics and reporting endpoints
├── 📄 availability.js                     # Consultant availability endpoints
├── 📄 bulk.js                             # Bulk operations endpoints
└── 📄 validation.js                       # Data validation endpoints
```
- **Purpose**: API route definitions and handlers
- **Features**: RESTful endpoints, middleware integration

#### Services (`/src/services/`)
```
services/
├── 📄 AssignmentService.js                # Enhanced round-robin logic
├── 📄 AnalyticsService.js                 # Analytics and reporting
├── 📄 BulkOperationsService.js            # Bulk data operations
└── 📄 ValidationService.js                # Data validation engine
```
- **Purpose**: Business logic and complex operations
- **Features**: Algorithm implementation, data processing

#### Utilities (`/src/utils/`)
```
utils/
└── 📄 logger.js                           # Audit logging system
```
- **Purpose**: Shared utilities and helper functions
- **Features**: File-based logging, audit trails

## ⚛️ Frontend (`/frontend/`)

### Core Files
```
frontend/
├── 📄 package.json                        # React dependencies and scripts
├── 📄 tsconfig.json                       # TypeScript configuration
├── 📄 Dockerfile                          # Docker container configuration
├── 📄 nginx.conf                          # Nginx configuration for production
└── 📁 node_modules/                       # Node.js dependencies
```

### Public Assets (`/public/`)
```
public/
└── 📄 index.html                          # Main HTML template
```
- **Purpose**: Static files and HTML template
- **Features**: PWA configuration, meta tags

### Source Code (`/src/`)

#### Main Files
```
src/
├── 📄 index.tsx                           # React application entry point
├── 📄 App.tsx                             # Main app component
└── 📄 App.css                             # Global styles
```

#### Components (`/src/components/`)
```
components/
├── 📄 Login.tsx                           # Login form component
├── 📄 Login.css                           # Login component styles
├── 📄 SDRDashboard.tsx                    # SDR dashboard component
├── 📄 SDRDashboard.css                    # SDR dashboard styles
├── 📄 AdminDashboard.tsx                  # Admin dashboard component
├── 📄 Dashboard.css                       # General dashboard styles
└── 📄 ProtectedRoute.tsx                  # Route protection component
```
- **Purpose**: React UI components
- **Features**: Modern responsive design, accessibility features

#### Contexts (`/src/contexts/`)
```
contexts/
└── 📄 AuthContext.tsx                     # Authentication state management
```
- **Purpose**: Global state management
- **Features**: User authentication, JWT token handling

#### Services (`/src/services/`)
```
services/
└── 📄 api.ts                              # API client and HTTP requests
```
- **Purpose**: Backend communication
- **Features**: HTTP client, error handling, type safety

#### Types (`/src/types/`)
```
types/
└── 📄 index.ts                            # TypeScript type definitions
```
- **Purpose**: Type safety and IntelliSense
- **Features**: Interface definitions, type exports

## 🐳 Docker Configuration (`/docker/`)

### Database (`/docker/postgres/`)
```
postgres/
└── 📄 init.sql                            # PostgreSQL initialization script
```
- **Purpose**: Database schema and sample data
- **Features**: Complete schema, indexes, functions, triggers

### Reverse Proxy (`/docker/nginx/`)
```
nginx/
└── 📄 nginx.conf                          # Nginx reverse proxy configuration
```
- **Purpose**: Load balancing and SSL termination
- **Features**: Security headers, gzip compression

## 🔧 Scripts (`/scripts/`)

```
scripts/
├── 📄 setup.sh                            # Interactive project setup
├── 📄 production-deploy.sh                # Production deployment
└── 📄 backup.sh                           # Database backup utility
```
- **Purpose**: Automation and deployment
- **Features**: Environment setup, database management

## 📊 Key File Purposes

### 🔐 Authentication & Security
- **`auth.js` (middleware)**: JWT token validation, role-based access
- **`authController.js`**: Login, registration, user management
- **`AuthContext.tsx`**: Frontend authentication state

### 👥 User Management
- **`User.js`**: User data model (SDRs and Admins)
- **SDRDashboard.tsx**: Sales representative interface
- **AdminDashboard.tsx**: Administrative interface

### 👨‍💼 Consultant Management
- **`Consultant.js`**: Consultant data model
- **`consultantController.js`**: CRUD operations
- **`availability.js`**: Availability scheduling
- **`bulk.js`**: Bulk operations and CSV import/export

### 🔄 Assignment System
- **`Assignment.js`**: Assignment data model
- **`AssignmentService.js`**: Enhanced round-robin algorithm
- **`assignmentController.js`**: Assignment management
- **`analytics.js`**: Performance analytics and reporting

### 🛡️ Data Integrity
- **`ValidationService.js`**: Comprehensive validation engine
- **`validation.js`**: Validation API endpoints
- **`logger.js`**: Audit logging system

### 📈 Analytics & Reporting
- **`AnalyticsService.js`**: Advanced analytics engine
- **Performance metrics**: Response times, completion rates
- **Fairness algorithms**: Assignment distribution analysis
- **Custom reporting**: Flexible data export

## 🗄️ Database Architecture

### Core Tables
- **`users`**: SDRs and administrators
- **`consultants`**: Business consultants with specialties
- **`assignments`**: Assignment tracking with status
- **`assignment_counts`**: Round-robin fairness tracking

### Enhanced Tables
- **`consultant_availability`**: Weekly scheduling
- **`consultant_timeoff`**: Time-off management
- **`assignment_metrics`**: Performance tracking
- **`bulk_operations`**: Operation logging
- **`audit_logs`**: Complete audit trail
- **`validation_rules`**: Dynamic validation rules

### Database Functions
- **`check_consultant_availability()`**: Real-time availability checking
- **`get_available_consultants()`**: Smart consultant selection
- **`log_audit_changes()`**: Automatic audit logging

## 🚀 Deployment Architecture

### Development Mode
- **Frontend**: React dev server (port 3000)
- **Backend**: Node.js with nodemon (port 3001)
- **Database**: SQLite for simplicity

### Production Mode
- **Frontend**: Nginx-served static files
- **Backend**: Node.js production server
- **Database**: PostgreSQL with connection pooling
- **Reverse Proxy**: Nginx with SSL and security headers
- **Containerization**: Docker Compose orchestration

## 📋 Key Features by Directory

### Backend Features
✅ **Enhanced Round-Robin Algorithm**
✅ **JWT Authentication & Authorization**
✅ **Comprehensive Analytics Engine**
✅ **Bulk Operations with CSV Support**
✅ **Real-time Availability Management**
✅ **Advanced Data Validation**
✅ **Complete Audit Logging**
✅ **Database Function Integration**

### Frontend Features
✅ **Modern React TypeScript Architecture**
✅ **Mobile-First Responsive Design**
✅ **Context-Based State Management**
✅ **Role-Based UI Components**
✅ **Accessibility Support**
✅ **Progressive Web App Ready**
✅ **Modern CSS with Gradients & Animations**

### Infrastructure Features
✅ **Docker Containerization**
✅ **Multi-Environment Configuration**
✅ **Automated Setup Scripts**
✅ **Production-Ready Nginx Configuration**
✅ **Database Migration System**
✅ **Comprehensive Logging**

This structure provides a scalable, maintainable, and production-ready application with enterprise-level features for consultant assignment management.