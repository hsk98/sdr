const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole, requirePermission } = require('../middleware/auth');
const { validateApiKey, handleValidationErrors } = require('../middleware/security');
const auditLogger = require('../utils/logger');

// System health and metrics (admin only)
router.get('/system/health', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: process.env.APP_VERSION || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      database: {
        connected: true // TODO: Add actual database health check
      }
    };
    
    res.json(health);
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({ error: 'Health check failed' });
  }
});

// Security logs and audit trail (admin only)
router.get('/security/logs', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { 
      limit = 100, 
      offset = 0, 
      level = 'all',
      action = null,
      userId = null,
      startDate = null,
      endDate = null
    } = req.query;
    
    // Log the access
    await auditLogger.logSystemEvent('SECURITY_LOGS_ACCESSED', {
      accessed_by: req.user.id,
      filters: { limit, offset, level, action, userId, startDate, endDate },
      ip_address: req.ip,
      user_agent: req.get('User-Agent')
    });
    
    // TODO: Implement actual log retrieval with filters
    const logs = await auditLogger.getSecurityLogs({
      limit: parseInt(limit),
      offset: parseInt(offset),
      level,
      action,
      userId,
      startDate,
      endDate
    });
    
    res.json(logs);
  } catch (error) {
    console.error('Security logs error:', error);
    await auditLogger.logError('SECURITY_LOGS_ERROR', error, {
      user_id: req.user.id,
      ip_address: req.ip
    });
    res.status(500).json({ error: 'Failed to retrieve security logs' });
  }
});

// System configuration (admin only)
router.get('/system/config', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const config = {
      security: {
        mfaEnabled: process.env.MFA_ENABLED === 'true',
        sessionTimeout: process.env.SESSION_TIMEOUT || '8h',
        rateLimiting: {
          enabled: true,
          authLimit: 5,
          apiLimit: 100
        }
      },
      features: {
        skillsBasedAssignment: true,
        reassignmentTracking: true,
        auditLogging: true
      },
      database: {
        type: 'sqlite',
        encrypted: process.env.DB_ENCRYPTION_ENABLED === 'true'
      }
    };
    
    res.json(config);
  } catch (error) {
    console.error('Config error:', error);
    res.status(500).json({ error: 'Failed to retrieve system configuration' });
  }
});

// API key management (admin only)
router.post('/api-keys/generate', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { name, permissions = [] } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'API key name is required' });
    }
    
    // Generate secure API key
    const crypto = require('crypto');
    const apiKey = crypto.randomBytes(32).toString('hex');
    const hashedKey = crypto.createHash('sha256').update(apiKey).digest('hex');
    
    // TODO: Store API key in database with metadata
    
    await auditLogger.logSystemEvent('API_KEY_GENERATED', {
      key_name: name,
      permissions,
      generated_by: req.user.id,
      ip_address: req.ip,
      user_agent: req.get('User-Agent')
    });
    
    res.json({
      apiKey, // Only return once, never store plain text
      hashedKey,
      name,
      permissions,
      createdAt: new Date().toISOString(),
      message: 'Store this API key securely. It will not be shown again.'
    });
  } catch (error) {
    console.error('API key generation error:', error);
    await auditLogger.logError('API_KEY_GENERATION_ERROR', error, {
      user_id: req.user.id,
      ip_address: req.ip
    });
    res.status(500).json({ error: 'Failed to generate API key' });
  }
});

// Data export for compliance (admin only)
router.post('/data/export', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { type, userId, startDate, endDate } = req.body;
    
    if (!type || !['user_data', 'audit_logs', 'assignments', 'all'].includes(type)) {
      return res.status(400).json({ error: 'Valid export type is required' });
    }
    
    await auditLogger.logSystemEvent('DATA_EXPORT_REQUESTED', {
      export_type: type,
      target_user_id: userId,
      date_range: { startDate, endDate },
      requested_by: req.user.id,\n      ip_address: req.ip,\n      user_agent: req.get('User-Agent')\n    });\n    \n    // TODO: Implement actual data export\n    res.json({\n      message: 'Data export initiated',\n      exportId: crypto.randomUUID(),\n      estimatedCompletionTime: '5 minutes',\n      downloadUrl: '/api/admin/data/download/export-id'\n    });\n  } catch (error) {\n    console.error('Data export error:', error);\n    await auditLogger.logError('DATA_EXPORT_ERROR', error, {\n      user_id: req.user.id,\n      ip_address: req.ip\n    });\n    res.status(500).json({ error: 'Failed to initiate data export' });\n  }\n});\n\n// GDPR data deletion (admin only)\nrouter.delete('/data/user/:userId', authenticateToken, requireRole('admin'), async (req, res) => {\n  try {\n    const { userId } = req.params;\n    const { reason, confirmation } = req.body;\n    \n    if (confirmation !== 'DELETE_ALL_USER_DATA') {\n      return res.status(400).json({ \n        error: 'Confirmation phrase required for data deletion' \n      });\n    }\n    \n    await auditLogger.logSystemEvent('USER_DATA_DELETION_REQUESTED', {\n      target_user_id: userId,\n      reason,\n      requested_by: req.user.id,\n      ip_address: req.ip,\n      user_agent: req.get('User-Agent')\n    });\n    \n    // TODO: Implement GDPR-compliant data deletion\n    \n    res.json({\n      message: 'User data deletion initiated',\n      userId,\n      deletionId: crypto.randomUUID(),\n      status: 'pending'\n    });\n  } catch (error) {\n    console.error('Data deletion error:', error);\n    await auditLogger.logError('DATA_DELETION_ERROR', error, {\n      user_id: req.user.id,\n      target_user_id: req.params.userId,\n      ip_address: req.ip\n    });\n    res.status(500).json({ error: 'Failed to initiate data deletion' });\n  }\n});\n\nmodule.exports = router;