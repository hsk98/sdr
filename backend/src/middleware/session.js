const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const path = require('path');

const sessionConfig = {
  store: new SQLiteStore({
    db: 'sessions.sqlite',
    dir: path.join(__dirname, '../../data'),
    table: 'sessions'
  }),
  secret: process.env.SESSION_SECRET || 'your-super-secret-session-key-change-in-production',
  name: 'sdr.session.id', // Don't use default session name
  resave: false,
  saveUninitialized: false,
  rolling: true, // Reset expiration on activity
  cookie: {
    secure: process.env.NODE_ENV === 'production', // HTTPS only in production
    httpOnly: true, // Prevent XSS
    maxAge: 1000 * 60 * 60 * 8, // 8 hours
    sameSite: 'strict' // CSRF protection
  },
  genid: (req) => {
    // Generate cryptographically secure session IDs
    return require('crypto').randomBytes(32).toString('hex');
  }
};\n\n// Session cleanup middleware\nconst cleanupExpiredSessions = async (req, res, next) => {\n  // Clean up expired sessions every hour\n  if (!req.session.lastCleanup || Date.now() - req.session.lastCleanup > 3600000) {\n    try {\n      const db = require('../config/database');\n      await db.query('DELETE FROM sessions WHERE datetime(datetime, \"unixepoch\") < datetime(\"now\", \"-8 hours\")');\n      req.session.lastCleanup = Date.now();\n    } catch (error) {\n      console.error('Session cleanup error:', error);\n    }\n  }\n  next();\n};\n\n// Session security middleware\nconst sessionSecurity = (req, res, next) => {\n  // Regenerate session ID on login/privilege escalation\n  if (req.path === '/api/auth/login' && req.method === 'POST') {\n    req.session.regenerate((err) => {\n      if (err) {\n        console.error('Session regeneration error:', err);\n      }\n      next();\n    });\n  } else {\n    next();\n  }\n};\n\n// Session timeout middleware\nconst sessionTimeout = (req, res, next) => {\n  if (req.session && req.session.user) {\n    const now = Date.now();\n    const lastActivity = req.session.lastActivity || now;\n    const timeout = 1000 * 60 * 60 * 8; // 8 hours\n    \n    if (now - lastActivity > timeout) {\n      req.session.destroy((err) => {\n        if (err) {\n          console.error('Session destroy error:', err);\n        }\n      });\n      return res.status(401).json({ error: 'Session expired' });\n    }\n    \n    req.session.lastActivity = now;\n  }\n  next();\n};\n\nmodule.exports = {\n  sessionMiddleware: session(sessionConfig),\n  cleanupExpiredSessions,\n  sessionSecurity,\n  sessionTimeout\n};