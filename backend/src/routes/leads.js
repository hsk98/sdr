const express = require('express');
const {
  getAllLeads,
  getQualifiedLeads,
  getMyLeads,
  createLead,
  updateLead,
  deleteLead
} = require('../controllers/leadController');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// Admin endpoints
router.get('/', authenticateToken, requireRole('admin'), getAllLeads);
router.get('/qualified', authenticateToken, getQualifiedLeads);

// SDR endpoints
router.get('/my', authenticateToken, requireRole('sdr'), getMyLeads);
router.post('/', authenticateToken, createLead);
router.put('/:id', authenticateToken, updateLead);
router.delete('/:id', authenticateToken, deleteLead);

module.exports = router;