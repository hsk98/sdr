const express = require('express');
const router = express.Router();
const { getArabicSpeakers, testSkillsAssignment, getConsultantSkills } = require('../controllers/skillsController');
const { authenticateToken } = require('../middleware/auth');

// Test routes for skills functionality
router.get('/arabic-speakers', authenticateToken, getArabicSpeakers);
router.post('/test-assignment', authenticateToken, testSkillsAssignment);
router.get('/consultant-skills', authenticateToken, getConsultantSkills);

module.exports = router;