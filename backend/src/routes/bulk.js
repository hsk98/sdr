const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const BulkOperationsService = require('../services/BulkOperationsService');
const { authenticateToken, requireRole } = require('../middleware/auth');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, '/tmp/'); // Use system temp directory
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  }
});

// Bulk create consultants
router.post('/consultants/create', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { consultants } = req.body;
    
    if (!Array.isArray(consultants)) {
      return res.status(400).json({ error: 'Consultants must be an array' });
    }

    const result = await BulkOperationsService.bulkCreateConsultants(consultants, req.user.id);
    res.status(201).json(result);
  } catch (error) {
    console.error('Error in bulk create consultants:', error);
    res.status(500).json({ error: error.message || 'Failed to bulk create consultants' });
  }
});

// Bulk update consultants
router.put('/consultants/update', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { updates } = req.body;
    
    if (!Array.isArray(updates)) {
      return res.status(400).json({ error: 'Updates must be an array' });
    }

    const result = await BulkOperationsService.bulkUpdateConsultants(updates, req.user.id);
    res.json(result);
  } catch (error) {
    console.error('Error in bulk update consultants:', error);
    res.status(500).json({ error: error.message || 'Failed to bulk update consultants' });
  }
});

// Bulk delete consultants
router.delete('/consultants/delete', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { consultantIds } = req.body;
    
    if (!Array.isArray(consultantIds)) {
      return res.status(400).json({ error: 'ConsultantIds must be an array' });
    }

    const result = await BulkOperationsService.bulkDeleteConsultants(consultantIds, req.user.id);
    res.json(result);
  } catch (error) {
    console.error('Error in bulk delete consultants:', error);
    res.status(500).json({ error: error.message || 'Failed to bulk delete consultants' });
  }
});

// Import from CSV
router.post('/import/:entityType', authenticateToken, requireRole(['admin']), upload.single('csvFile'), async (req, res) => {
  try {
    const { entityType } = req.params;
    
    if (!req.file) {
      return res.status(400).json({ error: 'CSV file is required' });
    }

    const result = await BulkOperationsService.importFromCSV(req.file.path, entityType, req.user.id);
    res.status(201).json(result);
  } catch (error) {
    console.error('Error importing from CSV:', error);
    res.status(500).json({ error: error.message || 'Failed to import from CSV' });
  }
});

// Export to CSV
router.get('/export/:entityType', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { entityType } = req.params;
    const filters = req.query;
    
    const data = await BulkOperationsService.exportToCSV(entityType, filters);
    
    // Set headers for CSV download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${entityType}-export-${Date.now()}.csv"`);
    
    // Convert data to CSV format
    if (data.length === 0) {
      return res.send('No data available for export');
    }
    
    const headers = Object.keys(data[0]);
    const csvData = [
      headers.join(','),
      ...data.map(row => 
        headers.map(header => {
          const value = row[header];
          // Escape commas and quotes in CSV values
          if (value === null || value === undefined) return '';
          const stringValue = String(value);
          if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
            return `"${stringValue.replace(/"/g, '""')}"`;
          }
          return stringValue;
        }).join(',')
      )
    ].join('\n');
    
    res.send(csvData);
  } catch (error) {
    console.error('Error exporting to CSV:', error);
    res.status(500).json({ error: error.message || 'Failed to export to CSV' });
  }
});

// Bulk set availability schedules
router.post('/availability/set', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { availabilityData } = req.body;
    
    if (!Array.isArray(availabilityData)) {
      return res.status(400).json({ error: 'AvailabilityData must be an array' });
    }

    const result = await BulkOperationsService.bulkSetAvailability(availabilityData, req.user.id);
    res.json(result);
  } catch (error) {
    console.error('Error in bulk set availability:', error);
    res.status(500).json({ error: error.message || 'Failed to bulk set availability' });
  }
});

// Get bulk operation history
router.get('/operations', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    const history = await BulkOperationsService.getBulkOperationHistory(parseInt(limit), parseInt(offset));
    res.json(history);
  } catch (error) {
    console.error('Error getting bulk operation history:', error);
    res.status(500).json({ error: 'Failed to get bulk operation history' });
  }
});

// Get specific bulk operation details
router.get('/operations/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const operationId = req.params.id;
    const operation = await BulkOperationsService.getBulkOperationDetails(operationId);
    
    if (!operation) {
      return res.status(404).json({ error: 'Bulk operation not found' });
    }
    
    res.json(operation);
  } catch (error) {
    console.error('Error getting bulk operation details:', error);
    res.status(500).json({ error: 'Failed to get bulk operation details' });
  }
});

// CSV template download
router.get('/template/:entityType', authenticateToken, requireRole(['admin']), (req, res) => {
  const { entityType } = req.params;
  
  let template;
  
  switch (entityType) {
    case 'consultants':
      template = 'name,email,phone,specialty,hourly_rate,timezone,notes\n' +
                'John Smith,john@example.com,+1-555-0101,Business Strategy,150.00,America/New_York,Sample consultant\n' +
                'Jane Doe,jane@example.com,+1-555-0102,Marketing,120.00,America/Los_Angeles,Another sample';
      break;
    
    case 'availability':
      template = 'consultantId,dayOfWeek,startTime,endTime,isAvailable\n' +
                '1,1,09:00:00,17:00:00,true\n' +
                '1,2,09:00:00,17:00:00,true\n' +
                '2,1,10:00:00,18:00:00,true';
      break;
    
    default:
      return res.status(400).json({ error: `No template available for entity type: ${entityType}` });
  }
  
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${entityType}-template.csv"`);
  res.send(template);
});

module.exports = router;