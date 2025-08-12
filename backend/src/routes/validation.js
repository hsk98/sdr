const express = require('express');
const router = express.Router();
const ValidationService = require('../services/ValidationService');
const { authenticateToken, requireRole } = require('../middleware/auth');

// Validate single entity
router.post('/validate/:entityType', authenticateToken, async (req, res) => {
  try {
    const { entityType } = req.params;
    const { data, isUpdate = false } = req.body;
    
    const validation = await ValidationService.validateEntity(entityType, data, isUpdate);
    res.json(validation);
  } catch (error) {
    console.error('Error validating entity:', error);
    res.status(500).json({ error: 'Failed to validate entity' });
  }
});

// Batch validate entities
router.post('/validate-batch/:entityType', authenticateToken, async (req, res) => {
  try {
    const { entityType } = req.params;
    const { dataArray } = req.body;
    
    if (!Array.isArray(dataArray)) {
      return res.status(400).json({ error: 'dataArray must be an array' });
    }
    
    const validation = await ValidationService.validateBatch(entityType, dataArray);
    res.json(validation);
  } catch (error) {
    console.error('Error batch validating entities:', error);
    res.status(500).json({ error: 'Failed to batch validate entities' });
  }
});

// Get validation rules for entity type
router.get('/rules/:entityType', authenticateToken, async (req, res) => {
  try {
    const { entityType } = req.params;
    const rules = ValidationService.getValidationRules(entityType);
    res.json(rules);
  } catch (error) {
    console.error('Error getting validation rules:', error);
    res.status(500).json({ error: 'Failed to get validation rules' });
  }
});

// Add new validation rule (admin only)
router.post('/rules', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { entityType, fieldName, ruleType, ruleConfig, errorMessage } = req.body;
    
    const ruleId = await ValidationService.addValidationRule(
      entityType, 
      fieldName, 
      ruleType, 
      ruleConfig, 
      errorMessage
    );
    
    res.status(201).json({ id: ruleId, message: 'Validation rule added successfully' });
  } catch (error) {
    console.error('Error adding validation rule:', error);
    res.status(500).json({ error: error.message || 'Failed to add validation rule' });
  }
});

// Update validation rule (admin only)
router.put('/rules/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const ruleId = req.params.id;
    const updates = req.body;
    
    await ValidationService.updateValidationRule(ruleId, updates);
    res.json({ message: 'Validation rule updated successfully' });
  } catch (error) {
    console.error('Error updating validation rule:', error);
    res.status(500).json({ error: error.message || 'Failed to update validation rule' });
  }
});

// Delete validation rule (admin only)
router.delete('/rules/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const ruleId = req.params.id;
    
    await ValidationService.deleteValidationRule(ruleId);
    res.json({ message: 'Validation rule deleted successfully' });
  } catch (error) {
    console.error('Error deleting validation rule:', error);
    res.status(500).json({ error: 'Failed to delete validation rule' });
  }
});

module.exports = router;