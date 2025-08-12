const pool = require('../config/database');

// Get consultants with Arabic speaking skill
const getArabicSpeakers = async (req, res) => {
  try {
    console.log('[SKILLS] Getting Arabic speakers...');
    
    const query = `
      SELECT DISTINCT c.id, c.name, c.email, c.phone, c.is_active,
        GROUP_CONCAT(s.name) as skills
      FROM consultants c
      JOIN consultant_skills cs ON c.id = cs.consultant_id
      JOIN skills s ON cs.skill_id = s.id
      WHERE c.is_active = 1 
        AND cs.skill_id = 'lang_arabic'
        AND cs.is_active = 1
      GROUP BY c.id, c.name, c.email, c.phone, c.is_active
      ORDER BY c.name
    `;
    
    const result = await pool.query(query);
    console.log('[SKILLS] Found Arabic speakers:', result.rows.length);
    
    res.json(result.rows);
  } catch (error) {
    console.error('[SKILLS] Error getting Arabic speakers:', error);
    res.status(500).json({ error: 'Failed to get Arabic speakers' });
  }
};

// Test skills-based assignment
const testSkillsAssignment = async (req, res) => {
  try {
    const { requiredSkills = [] } = req.body;
    console.log('[SKILLS] Testing assignment with required skills:', requiredSkills);
    
    if (requiredSkills.length === 0) {
      return res.status(400).json({ error: 'No skills specified' });
    }
    
    // Build query to find consultants with ALL required skills
    const skillPlaceholders = requiredSkills.map(() => '?').join(',');
    const query = `
      SELECT c.id, c.name, c.email, c.phone,
        GROUP_CONCAT(s.name) as matching_skills,
        COUNT(DISTINCT cs.skill_id) as skill_count
      FROM consultants c
      JOIN consultant_skills cs ON c.id = cs.consultant_id
      JOIN skills s ON cs.skill_id = s.id
      WHERE c.is_active = 1 
        AND cs.is_active = 1
        AND cs.skill_id IN (${skillPlaceholders})
      GROUP BY c.id, c.name, c.email, c.phone
      HAVING COUNT(DISTINCT cs.skill_id) = ?
      ORDER BY c.name
    `;
    
    const params = [...requiredSkills, requiredSkills.length];
    const result = await pool.query(query, params);
    
    console.log('[SKILLS] Found matching consultants:', result.rows.length);
    
    if (result.rows.length === 0) {
      return res.json({ 
        success: false, 
        message: `No consultants available with required skills: ${requiredSkills.join(', ')}`,
        availableConsultants: []
      });
    }
    
    // For testing, just return the first matching consultant
    const selectedConsultant = result.rows[0];
    
    res.json({
      success: true,
      message: 'Skills-based assignment successful',
      selectedConsultant: {
        id: selectedConsultant.id,
        name: selectedConsultant.name,
        email: selectedConsultant.email,
        phone: selectedConsultant.phone,
        matchingSkills: selectedConsultant.matching_skills.split(',')
      },
      availableConsultants: result.rows.map(c => ({
        id: c.id,
        name: c.name,
        matchingSkills: c.matching_skills.split(',')
      }))
    });
    
  } catch (error) {
    console.error('[SKILLS] Error in skills assignment:', error);
    res.status(500).json({ error: 'Skills assignment failed' });
  }
};

// Get consultant skills breakdown
const getConsultantSkills = async (req, res) => {
  try {
    const query = `
      SELECT c.id, c.name,
        GROUP_CONCAT(s.name) as skills,
        COUNT(cs.skill_id) as skill_count
      FROM consultants c
      LEFT JOIN consultant_skills cs ON c.id = cs.consultant_id AND cs.is_active = 1
      LEFT JOIN skills s ON cs.skill_id = s.id AND s.is_active = 1
      WHERE c.is_active = 1
      GROUP BY c.id, c.name
      ORDER BY c.name
    `;
    
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('[SKILLS] Error getting consultant skills:', error);
    res.status(500).json({ error: 'Failed to get consultant skills' });
  }
};

module.exports = {
  getArabicSpeakers,
  testSkillsAssignment,
  getConsultantSkills
};