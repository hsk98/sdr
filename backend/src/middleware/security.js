const rateLimit = require('express-rate-limit');
const { body, validationResult, param } = require('express-validator');
const helmet = require('helmet');
const crypto = require('crypto');

// Rate limiting configurations
const createRateLimiter = (windowMs, max, message) => {
  return rateLimit({
    windowMs,
    max,
    message: { error: message },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      res.status(429).json({
        error: message,
        retryAfter: Math.round(windowMs / 1000)
      });
    }
  });
};

// Different rate limits for different endpoints
const authLimiter = createRateLimiter(
  15 * 60 * 1000, // 15 minutes
  5, // limit each IP to 5 requests per windowMs
  'Too many login attempts, please try again later'
);

const apiLimiter = createRateLimiter(
  15 * 60 * 1000, // 15 minutes
  100, // limit each IP to 100 requests per windowMs
  'Too many API requests, please try again later'
);

const strictApiLimiter = createRateLimiter(
  15 * 60 * 1000, // 15 minutes
  10, // limit sensitive endpoints
  'Too many requests to sensitive endpoint, please try again later'
);

// Input validation rules
const validateLogin = [
  body('username')
    .trim()
    .isLength({ min: 3, max: 50 })
    .matches(/^[a-zA-Z0-9_-]+$/)
    .withMessage('Username must be 3-50 characters and contain only letters, numbers, underscores, and hyphens'),
  body('password')
    .isLength({ min: 8, max: 128 })
    .withMessage('Password must be 8-128 characters long')
];

const validateRegistration = [
  body('username')
    .trim()
    .isLength({ min: 3, max: 50 })
    .matches(/^[a-zA-Z0-9_-]+$/)
    .withMessage('Username must be 3-50 characters and contain only letters, numbers, underscores, and hyphens'),
  body('email')
    .trim()
    .isEmail()
    .normalizeEmail()
    .withMessage('Must be a valid email address'),
  body('password')
    .isLength({ min: 8, max: 128 })
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character'),
  body('role')
    .isIn(['sdr', 'admin', 'manager'])
    .withMessage('Role must be sdr, admin, or manager'),
  body('firstName')
    .trim()
    .isLength({ min: 1, max: 50 })
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage('First name must be 1-50 characters and contain only letters, spaces, apostrophes, and hyphens'),
  body('lastName')
    .trim()
    .isLength({ min: 1, max: 50 })
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage('Last name must be 1-50 characters and contain only letters, spaces, apostrophes, and hyphens')
];

const validateAssignment = [
  body('leadName')
    .trim()
    .isLength({ min: 1, max: 200 })
    .matches(/^[a-zA-Z\s'-\.]+$/)
    .withMessage('Lead name must be 1-200 characters and contain only letters, spaces, apostrophes, hyphens, and periods'),
  body('leadCompany')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .matches(/^[a-zA-Z0-9\s&.,'-]+$/)
    .withMessage('Company name must be valid'),
  body('leadPhone')
    .optional()
    .trim()
    .matches(/^\+?[1-9]\d{1,14}$/)
    .withMessage('Phone number must be in valid international format'),
  body('leadEmail')
    .optional()
    .trim()
    .isEmail()
    .normalizeEmail()
    .withMessage('Must be a valid email address'),
  body('requiredSkills')
    .optional()
    .isArray()
    .withMessage('Required skills must be an array'),
  body('requiredSkills.*')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .matches(/^[a-zA-Z0-9_\s-]+$/)
    .withMessage('Skill names must be valid')
];

const validateId = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('ID must be a positive integer')
];

// Security headers configuration
const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
});

// Input sanitization middleware
const sanitizeInput = (req, res, next) => {
  const sanitizeObject = (obj) => {
    for (const key in obj) {
      if (typeof obj[key] === 'string') {
        // Remove potential XSS patterns
        obj[key] = obj[key]
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/javascript:/gi, '')
          .replace/on\w+\s*=/gi, '')
          .trim();
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        sanitizeObject(obj[key]);
      }
    }
  };

  if (req.body) sanitizeObject(req.body);
  if (req.query) sanitizeObject(req.query);
  if (req.params) sanitizeObject(req.params);
  
  next();
};

// Validation error handler
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array().map(err => ({
        field: err.path,
        message: err.msg,
        value: err.value
      }))
    });
  }
  next();
};

// API key validation middleware
const validateApiKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  
  if (!apiKey) {
    return res.status(401).json({ error: 'API key required' });
  }
  
  // Hash the provided API key and compare with stored hashes
  const hashedKey = crypto.createHash('sha256').update(apiKey).digest('hex');
  const validKeys = process.env.API_KEYS ? process.env.API_KEYS.split(',') : [];
  
  if (!validKeys.includes(hashedKey)) {
    return res.status(401).json({ error: 'Invalid API key' });
  }
  
  next();
};

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = process.env.ALLOWED_ORIGINS 
      ? process.env.ALLOWED_ORIGINS.split(',') 
      : ['http://localhost:3000', 'http://localhost:3001'];
    
    // Allow requests with no origin (mobile apps, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
  exposedHeaders: ['X-Total-Count', 'X-Rate-Limit-Remaining'],
  maxAge: 86400 // 24 hours
};

module.exports = {
  authLimiter,
  apiLimiter,
  strictApiLimiter,
  validateLogin,
  validateRegistration,
  validateAssignment,
  validateId,
  securityHeaders,
  sanitizeInput,
  handleValidationErrors,
  validateApiKey,
  corsOptions
};