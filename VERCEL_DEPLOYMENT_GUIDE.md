# Vercel Deployment Guide with Supabase

## 🚀 Quick Deployment Steps

### 1. Prerequisites
- ✅ GitHub repository with your code (Done!)
- ⚠️  Supabase account and project (You need to create this)
- ⚠️  Vercel account (You need to create this)

### 2. Set Up Supabase Database

#### Create Supabase Project
1. Go to [supabase.com](https://supabase.com)
2. Create new project:
   - **Organization**: Your organization
   - **Project Name**: `sdr-assignment-system`
   - **Database Password**: Choose a strong password
   - **Region**: Choose closest to your users

#### Initialize Database Schema
1. In Supabase Dashboard → **SQL Editor**
2. Copy and paste the contents of `/backend/src/sql/supabase-schema.sql`
3. Click **Run** to create all tables and sample data

#### Get Connection Details
From your Supabase project settings:
- **Project URL**: `https://[YOUR-PROJECT-REF].supabase.co`
- **Anon Key**: Found in Settings → API
- **Database URL**: `postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres`

### 3. Deploy to Vercel

#### Connect GitHub to Vercel
1. Go to [vercel.com](https://vercel.com)
2. Sign up/login with GitHub
3. Click **New Project**
4. Import from GitHub: `hsk98/sdr`
5. Configure project:
   - **Project Name**: `sdr-assignment-system`
   - **Framework**: Detect automatically (Node.js)
   - **Root Directory**: `./` (keep default)

#### Configure Environment Variables
In Vercel project settings → **Environment Variables**, add:

```env
# Database Configuration
DB_TYPE=supabase
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres
SUPABASE_URL=https://[YOUR-PROJECT-REF].supabase.co
SUPABASE_ANON_KEY=[YOUR-ANON-KEY]

# Security (Generate secure values)
JWT_SECRET=your-super-secure-jwt-secret-at-least-32-characters-vercel
SESSION_SECRET=your-super-secure-session-secret-vercel-deployment
ENCRYPTION_KEY=your-32-byte-hex-encryption-key-for-pii-data

# App Configuration
NODE_ENV=production
PORT=3001
JWT_EXPIRES_IN=8h
MFA_ENABLED=true
LOG_LEVEL=INFO
APP_VERSION=1.0.0

# CORS (Add your Vercel domain after deployment)
ALLOWED_ORIGINS=https://your-app-name.vercel.app

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
AUTH_RATE_LIMIT_MAX=5

# Data Retention
DATA_RETENTION_DAYS=2555
```

#### Deploy
1. Click **Deploy**
2. Wait for build to complete (3-5 minutes)
3. Get your deployment URL: `https://your-project-name.vercel.app`

### 4. Post-Deployment Configuration

#### Update CORS Origins
1. Go back to Vercel → Environment Variables
2. Update `ALLOWED_ORIGINS` with your actual Vercel URL:
   ```
   ALLOWED_ORIGINS=https://your-actual-deployment-url.vercel.app
   ```
3. **Redeploy** the project

#### Test Your Deployment
1. Visit your Vercel URL
2. Test login with:
   - **Username**: `admin`
   - **Password**: `admin123`
3. Verify SDR assignment functionality

## 📋 Environment Variables Reference

### Required Variables
```env
DB_TYPE=supabase
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres
SUPABASE_URL=https://[PROJECT-REF].supabase.co
SUPABASE_ANON_KEY=[YOUR-ANON-KEY]
JWT_SECRET=[GENERATE-SECURE-SECRET]
SESSION_SECRET=[GENERATE-SECURE-SECRET]
ENCRYPTION_KEY=[GENERATE-32-BYTE-HEX]
```

### How to Generate Secure Keys
```bash
# JWT Secret (32+ characters)
openssl rand -base64 32

# Session Secret (32+ characters) 
openssl rand -base64 32

# Encryption Key (32 bytes hex)
openssl rand -hex 32
```

## 🔧 Project Structure for Vercel

```
sdr-assignment-system/
├── vercel.json                 # Vercel configuration
├── backend/
│   ├── server.js              # API endpoints
│   └── src/
│       ├── config/
│       │   └── database-supabase.js  # Supabase integration
│       └── sql/
│           └── supabase-schema.sql   # Database schema
└── frontend/
    ├── build/                 # Pre-built React app
    └── src/                   # React source code
```

## 🚨 Common Issues & Solutions

### Build Errors
- **Issue**: `Module not found: @supabase/supabase-js`
- **Solution**: Ensure dependencies are in `package.json` and committed to git

### Database Connection Errors
- **Issue**: `Database configuration missing`
- **Solution**: Verify all Supabase environment variables are set correctly

### CORS Errors
- **Issue**: Frontend can't connect to API
- **Solution**: Update `ALLOWED_ORIGINS` with your actual Vercel domain

### Authentication Issues
- **Issue**: Login fails after deployment
- **Solution**: Check JWT_SECRET and ensure database contains admin user

## 🔒 Security Checklist

- [ ] Changed default admin password from `admin123`
- [ ] Generated secure JWT_SECRET (32+ characters)
- [ ] Generated secure SESSION_SECRET (32+ characters)
- [ ] Generated secure ENCRYPTION_KEY (32 bytes hex)
- [ ] Set correct ALLOWED_ORIGINS for your domain
- [ ] Enabled MFA for admin accounts
- [ ] Verified database RLS policies in Supabase

## 📞 Support

If you encounter issues:
1. Check Vercel deployment logs
2. Check Supabase logs in Dashboard → Logs
3. Verify all environment variables are set
4. Ensure database schema was created successfully

## 🎉 Success!

Once deployed, you'll have:
- ✅ **Live SDR Assignment System** at your Vercel URL
- ✅ **Secure PostgreSQL database** via Supabase
- ✅ **Production-ready security** with MFA, encryption, audit logs
- ✅ **Scalable infrastructure** with serverless functions
- ✅ **Real-time dashboard** for managing assignments

**Default Login**: Username `admin`, Password `admin123` (change immediately!)

---

**Deployment URL**: `https://your-project-name.vercel.app`
**Admin Panel**: `https://your-project-name.vercel.app/admin`
**API Endpoints**: `https://your-project-name.vercel.app/api/*`