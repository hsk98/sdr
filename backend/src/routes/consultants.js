const express = require('express');
const {
  getAllConsultants,
  getActiveConsultants,
  getConsultantById,
  createConsultant,
  updateConsultant,
  deleteConsultant
} = require('../controllers/consultantController');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticateToken, getAllConsultants);
router.get('/active', authenticateToken, getActiveConsultants);
router.get('/:id', authenticateToken, getConsultantById);
router.post('/', authenticateToken, requireRole('admin'), createConsultant);
router.put('/:id', authenticateToken, requireRole('admin'), updateConsultant);
router.delete('/:id', authenticateToken, requireRole('admin'), deleteConsultant);

module.exports = router;