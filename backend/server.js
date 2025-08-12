require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

// Security middleware imports
const { 
  authLimiter, 
  apiLimiter, 
  strictApiLimiter,
  securityHeaders,
  sanitizeInput,
  corsOptions
} = require('./src/middleware/security');
const {
  sessionMiddleware,
  cleanupExpiredSessions,
  sessionSecurity,
  sessionTimeout
} = require('./src/middleware/session');
const auditLogger = require('./src/utils/logger');

const authRoutes = require('./src/routes/auth');
const consultantRoutes = require('./src/routes/consultants');
const assignmentRoutes = require('./src/routes/assignments');
const leadRoutes = require('./src/routes/leads');
const analyticsRoutes = require('./src/routes/analytics');
const skillsRoutes = require('./src/routes/skills');
const mfaRoutes = require('./src/routes/mfa');
const adminRoutes = require('./src/routes/admin');
// const availabilityRoutes = require('./src/routes/availability');
// const bulkRoutes = require('./src/routes/bulk');
// const validationRoutes = require('./src/routes/validation');

const app = express();
const PORT = process.env.PORT || 3001;

// SSL/HTTPS configuration
const https = require('https');
const { getSSLConfig } = require('./src/config/ssl');
const sslConfig = getSSLConfig();

// Trust proxy if behind reverse proxy (nginx, etc.)
app.set('trust proxy', process.env.NODE_ENV === 'production');

// Security middleware
app.use(securityHeaders);
app.use(cors(corsOptions));
app.use(sessionMiddleware);
app.use(cleanupExpiredSessions);
app.use(sessionSecurity);
app.use(sessionTimeout);

// Request parsing with size limits
app.use(express.json({ 
  limit: '10mb',
  strict: true
}));
app.use(express.urlencoded({ 
  extended: true, 
  limit: '10mb'
}));

// Input sanitization
app.use(sanitizeInput);

// Enhanced logging
app.use(morgan('combined', {
  stream: {
    write: (message) => {
      auditLogger.logSystemEvent('HTTP_REQUEST', {
        message: message.trim(),
        timestamp: new Date().toISOString()
      });
    }
  }
}));

// Global rate limiting
app.use('/api/', apiLimiter);

// Health check endpoint (no rate limiting)
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'SDR Assignment System API is running',
    timestamp: new Date().toISOString(),
    version: process.env.APP_VERSION || '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

// Apply stricter rate limiting to auth endpoints
app.use('/api/auth', authLimiter, authRoutes);

// Apply strict rate limiting to admin and analytics endpoints
app.use('/api/admin', strictApiLimiter, adminRoutes);
app.use('/api/analytics', strictApiLimiter, analyticsRoutes);

// Standard rate limiting for other endpoints
app.use('/api/consultants', consultantRoutes);
app.use('/api/assignments', assignmentRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/skills', skillsRoutes);
app.use('/api/mfa', authLimiter, mfaRoutes);
// app.use('/api/availability', availabilityRoutes);
// app.use('/api/bulk', bulkRoutes);
// app.use('/api/validation', validationRoutes);

// Enhanced error handling
app.use(async (err, req, res, next) => {
  console.error('Server error:', err.stack);
  
  // Log security-related errors
  await auditLogger.logError('SERVER_ERROR', err, {
    user_id: req.user?.id,
    ip_address: req.ip,
    user_agent: req.get('User-Agent'),
    endpoint: req.path,
    method: req.method
  });
  
  // Don't expose internal errors in production
  const isDevelopment = process.env.NODE_ENV === 'development';
  const errorMessage = isDevelopment 
    ? err.message 
    : 'Something went wrong!';
  
  res.status(err.status || 500).json({ 
    error: errorMessage,
    ...(isDevelopment && { stack: err.stack })
  });
});

// 404 handler with logging
app.use(async (req, res) => {
  await auditLogger.logSystemEvent('ROUTE_NOT_FOUND', {
    path: req.path,
    method: req.method,
    ip_address: req.ip,
    user_agent: req.get('User-Agent'),
    user_id: req.user?.id
  });
  
  res.status(404).json({ 
    error: 'Route not found',
    path: req.path,
    method: req.method
  });
});

// Start server with HTTPS if enabled
if (sslConfig.enabled && sslConfig.options) {
  // HTTPS server
  const httpsServer = https.createServer(sslConfig.options, app);
  httpsServer.listen(sslConfig.port, () => {
    console.log(`🔒 HTTPS Server running on port ${sslConfig.port}`);
    console.log(`🔗 Access via: https://localhost:${sslConfig.port}`);
  });
  
  // HTTP to HTTPS redirect server (if enabled)
  if (sslConfig.redirectHttp) {
    const httpApp = express();
    httpApp.use((req, res) => {
      res.redirect(301, `https://${req.headers.host.replace(/:\d+/, `:${sslConfig.port}`)}${req.url}`);
    });
    httpApp.listen(PORT, () => {
      console.log(`📄 HTTP redirect server running on port ${PORT} -> HTTPS ${sslConfig.port}`);
    });
  }
} else {
  // HTTP server (development or when HTTPS is disabled)
  app.listen(PORT, () => {
    console.log(`🌐 HTTP Server running on port ${PORT}`);
    if (process.env.NODE_ENV === 'production') {
      console.warn('⚠️  Running in production without HTTPS! Enable SSL for security.');
    }
  });
}