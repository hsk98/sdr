const express = require('express');
const router = express.Router();
const MFAController = require('../controllers/mfaController');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { validateMFAToken, handleValidationErrors } = require('../middleware/security');

// Setup MFA for user
router.post('/setup', authenticateToken, MFAController.setupMFA);

// Enable MFA after verification
router.post('/enable', authenticateToken, validateMFAToken, handleValidationErrors, MFAController.enableMFA);

// Verify MFA token during login
router.post('/verify', validateMFAToken, handleValidationErrors, MFAController.verifyMFA);

// Disable MFA
router.post('/disable', authenticateToken, MFAController.disableMFA);

// Get MFA status
router.get('/status', authenticateToken, MFAController.getMFAStatus);

// Generate backup codes
router.post('/backup-codes', authenticateToken, MFAController.generateBackupCodes);

module.exports = router;