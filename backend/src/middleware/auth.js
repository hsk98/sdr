const jwt = require('jsonwebtoken');
const User = require('../models/User');
const auditLogger = require('../utils/logger');

const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      await auditLogger.logSystemEvent('AUTH_FAILED', {
        reason: 'No token provided',
        ip_address: req.ip,
        user_agent: req.get('User-Agent'),
        endpoint: req.path
      });
      return res.status(401).json({ error: 'Access token required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
      issuer: 'sdr-assignment-system',
      audience: 'sdr-users'
    });
    
    const user = await User.findById(decoded.userId);
    
    if (!user) {
      await auditLogger.logSystemEvent('AUTH_FAILED', {
        reason: 'User not found',
        user_id: decoded.userId,
        ip_address: req.ip,
        user_agent: req.get('User-Agent'),
        endpoint: req.path
      });
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Add user context with role-based permissions
    req.user = {
      ...user,
      permissions: getRolePermissions(user.role)
    };
    
    // Log successful authentication for sensitive operations
    if (req.path.includes('/admin') || req.method !== 'GET') {
      await auditLogger.logSystemEvent('AUTH_SUCCESS', {
        user_id: user.id,
        username: user.username,
        role: user.role,
        ip_address: req.ip,
        user_agent: req.get('User-Agent'),
        endpoint: req.path,
        method: req.method
      });
    }
    
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      await auditLogger.logSystemEvent('AUTH_FAILED', {
        reason: 'Invalid token format',
        ip_address: req.ip,
        user_agent: req.get('User-Agent'),
        endpoint: req.path
      });
      return res.status(401).json({ error: 'Invalid token' });
    }
    if (error.name === 'TokenExpiredError') {
      await auditLogger.logSystemEvent('AUTH_FAILED', {
        reason: 'Token expired',
        ip_address: req.ip,
        user_agent: req.get('User-Agent'),
        endpoint: req.path
      });
      return res.status(401).json({ error: 'Token expired' });
    }
    console.error('Auth middleware error:', error);
    await auditLogger.logError('AUTH_MIDDLEWARE_ERROR', error, {
      ip_address: req.ip,
      endpoint: req.path
    });
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Enhanced role-based access control
const getRolePermissions = (role) => {
  const permissions = {
    admin: [
      'view_all_users', 'create_user', 'update_user', 'delete_user',
      'view_all_consultants', 'create_consultant', 'update_consultant', 'delete_consultant',
      'view_all_assignments', 'create_assignment', 'update_assignment', 'delete_assignment',
      'view_analytics', 'view_audit_logs', 'system_admin',
      'manage_skills', 'reassign_leads', 'override_assignments'
    ],
    manager: [
      'view_team_users', 'view_all_consultants', 'create_consultant', 'update_consultant',
      'view_team_assignments', 'create_assignment', 'update_assignment',
      'view_team_analytics', 'manage_skills', 'reassign_leads'
    ],
    sdr: [
      'view_profile', 'update_profile',
      'create_assignment', 'view_own_assignments',
      'reassign_own_leads'
    ]
  };
  
  return permissions[role] || [];
};

const requireRole = (role) => {
  return async (req, res, next) => {
    if (req.user.role !== role) {
      await auditLogger.logSystemEvent('ACCESS_DENIED', {
        user_id: req.user.id,
        username: req.user.username,
        required_role: role,
        user_role: req.user.role,
        ip_address: req.ip,
        user_agent: req.get('User-Agent'),
        endpoint: req.path,
        method: req.method
      });
      return res.status(403).json({ error: `${role} access required` });
    }
    next();
  };
};

const requirePermission = (permission) => {
  return async (req, res, next) => {
    if (!req.user.permissions.includes(permission)) {
      await auditLogger.logSystemEvent('ACCESS_DENIED', {
        user_id: req.user.id,
        username: req.user.username,
        required_permission: permission,
        user_role: req.user.role,
        user_permissions: req.user.permissions,
        ip_address: req.ip,
        user_agent: req.get('User-Agent'),
        endpoint: req.path,
        method: req.method
      });
      return res.status(403).json({ 
        error: 'Insufficient permissions',
        required: permission
      });
    }
    next();
  };
};

const requireAnyRole = (roles) => {
  return async (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      await auditLogger.logSystemEvent('ACCESS_DENIED', {
        user_id: req.user.id,
        username: req.user.username,
        required_roles: roles,
        user_role: req.user.role,
        ip_address: req.ip,
        user_agent: req.get('User-Agent'),
        endpoint: req.path,
        method: req.method
      });
      return res.status(403).json({ 
        error: 'Insufficient permissions',
        required_roles: roles
      });
    }
    next();
  };
};

const requireAdminOrSelf = (req, res, next) => {
  const requestedUserId = parseInt(req.params.userId);
  
  if (req.user.role === 'admin' || req.user.id === requestedUserId) {
    next();
  } else {
    return res.status(403).json({ error: 'Access denied' });
  }
};

module.exports = {
  authenticateToken,
  requireRole,
  requireAdminOrSelf,
  requirePermission,
  requireAnyRole,
  getRolePermissions
};