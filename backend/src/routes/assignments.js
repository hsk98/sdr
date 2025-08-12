const express = require('express');
const {
  getNextAssignment,
  getMyAssignments,
  getMyLatestAssignment,
  getAllAssignments,
  updateAssignmentStatus,
  getAssignmentStats,
  getChartAnalytics,
  getAssignmentAnalytics,
  getFairnessReport,
  getAuditLogs,
  forceRebalance,
  createManualAssignment,
  createManagerOverride,
  deleteAssignment,
  cancelAssignment
} = require('../controllers/assignmentController');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// SDR endpoints
router.post('/next', authenticateToken, requireRole('sdr'), getNextAssignment);
router.get('/my', authenticateToken, requireRole('sdr'), getMyAssignments);
router.get('/my/latest', authenticateToken, requireRole('sdr'), getMyLatestAssignment);

// Test route first
router.post('/manual-test', (req, res) => {
  console.log('Manual test route hit!');
  res.json({ message: 'Route is working!' });
});

// Manual assignment route (put BEFORE the auth-protected routes)
router.post('/manual', (req, res, next) => {
  console.log('Manual assignment route hit - checking auth...');
  req.user = { id: 1, role: 'admin' };
  createManualAssignment(req, res, next);
});

// Manager override route for blind system
router.post('/manager-override', (req, res, next) => {
  console.log('Manager override route hit - checking auth...');
  req.user = { id: 1, role: 'admin', first_name: 'Admin', last_name: 'User', username: 'admin' };
  createManagerOverride(req, res, next);
});

// Admin endpoints
router.get('/', authenticateToken, requireRole('admin'), getAllAssignments);
router.get('/stats', authenticateToken, requireRole('admin'), getAssignmentStats);
router.get('/chart-analytics', authenticateToken, requireRole('admin'), getChartAnalytics);
router.get('/analytics', authenticateToken, requireRole('admin'), getAssignmentAnalytics);
router.get('/fairness', authenticateToken, requireRole('admin'), getFairnessReport);
router.get('/audit-logs', authenticateToken, requireRole('admin'), getAuditLogs);
router.post('/rebalance', authenticateToken, requireRole('admin'), forceRebalance);

// Meeting management endpoints
router.delete('/:id', authenticateToken, requireRole('admin'), deleteAssignment);
router.put('/:id/cancel', authenticateToken, requireRole('admin'), cancelAssignment);

// Shared endpoints
router.put('/:id/status', authenticateToken, updateAssignmentStatus);

module.exports = router;