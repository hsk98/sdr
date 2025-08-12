const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const config = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');
const ValidationService = require('../services/ValidationService');

const pool = new Pool(config);

// Get consultant availability schedule
router.get('/consultant/:id', authenticateToken, async (req, res) => {
  try {
    const consultantId = req.params.id;
    
    const query = `
      SELECT 
        ca.*,
        CASE ca.day_of_week
          WHEN 0 THEN 'Sunday'
          WHEN 1 THEN 'Monday'
          WHEN 2 THEN 'Tuesday'
          WHEN 3 THEN 'Wednesday'
          WHEN 4 THEN 'Thursday'
          WHEN 5 THEN 'Friday'
          WHEN 6 THEN 'Saturday'
        END as day_name
      FROM consultant_availability ca
      WHERE ca.consultant_id = $1
      ORDER BY ca.day_of_week, ca.start_time
    `;
    
    const result = await pool.query(query, [consultantId]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error getting consultant availability:', error);
    res.status(500).json({ error: 'Failed to get consultant availability' });
  }
});

// Set consultant availability schedule
router.post('/consultant/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
  const client = await pool.connect();
  
  try {
    const consultantId = req.params.id;
    const { schedules } = req.body;
    
    if (!Array.isArray(schedules)) {
      return res.status(400).json({ error: 'Schedules must be an array' });
    }

    await client.query('BEGIN');
    
    // Set user context for audit logging
    await client.query('SET app.current_user_id = $1', [req.user.id]);

    // Clear existing availability
    await client.query(
      'DELETE FROM consultant_availability WHERE consultant_id = $1',
      [consultantId]
    );

    // Insert new schedules
    for (const schedule of schedules) {
      const { dayOfWeek, startTime, endTime, isAvailable = true } = schedule;
      
      // Validate schedule data
      if (dayOfWeek < 0 || dayOfWeek > 6) {
        throw new Error('Day of week must be between 0 (Sunday) and 6 (Saturday)');
      }
      
      await client.query(`
        INSERT INTO consultant_availability (consultant_id, day_of_week, start_time, end_time, is_available)
        VALUES ($1, $2, $3, $4, $5)
      `, [consultantId, dayOfWeek, startTime, endTime, isAvailable]);
    }

    await client.query('COMMIT');
    
    res.json({ 
      message: 'Availability schedule updated successfully',
      consultantId,
      schedulesCount: schedules.length
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error setting consultant availability:', error);
    res.status(500).json({ error: error.message || 'Failed to set consultant availability' });
  } finally {
    client.release();
  }
});

// Get consultant time-off requests
router.get('/timeoff/consultant/:id', authenticateToken, async (req, res) => {
  try {
    const consultantId = req.params.id;
    
    const query = `
      SELECT 
        ct.*,
        u.first_name || ' ' || u.last_name as approved_by_name
      FROM consultant_timeoff ct
      LEFT JOIN users u ON ct.approved_by = u.id
      WHERE ct.consultant_id = $1
      ORDER BY ct.start_date DESC
    `;
    
    const result = await pool.query(query, [consultantId]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error getting timeoff requests:', error);
    res.status(500).json({ error: 'Failed to get timeoff requests' });
  }
});

// Create time-off request
router.post('/timeoff', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { consultantId, startDate, endDate, reason } = req.body;
    
    // Validate required fields
    if (!consultantId || !startDate || !endDate) {
      return res.status(400).json({ error: 'consultantId, startDate, and endDate are required' });
    }

    // Validate date range
    if (new Date(startDate) > new Date(endDate)) {
      return res.status(400).json({ error: 'Start date must be before end date' });
    }

    const query = `
      INSERT INTO consultant_timeoff (consultant_id, start_date, end_date, reason, is_approved, approved_by)
      VALUES ($1, $2, $3, $4, true, $5)
      RETURNING *
    `;
    
    const result = await pool.query(query, [consultantId, startDate, endDate, reason, req.user.id]);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating timeoff request:', error);
    res.status(500).json({ error: 'Failed to create timeoff request' });
  }
});

// Update time-off request
router.put('/timeoff/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const timeoffId = req.params.id;
    const { startDate, endDate, reason, isApproved } = req.body;
    
    const setParts = [];
    const values = [];
    let paramIndex = 1;

    if (startDate !== undefined) {
      setParts.push(`start_date = $${paramIndex}`);
      values.push(startDate);
      paramIndex++;
    }

    if (endDate !== undefined) {
      setParts.push(`end_date = $${paramIndex}`);
      values.push(endDate);
      paramIndex++;
    }

    if (reason !== undefined) {
      setParts.push(`reason = $${paramIndex}`);
      values.push(reason);
      paramIndex++;
    }

    if (isApproved !== undefined) {
      setParts.push(`is_approved = $${paramIndex}`);
      values.push(isApproved);
      paramIndex++;
      
      setParts.push(`approved_by = $${paramIndex}`);
      values.push(req.user.id);
      paramIndex++;
    }

    if (setParts.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    setParts.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(timeoffId);

    const query = `
      UPDATE consultant_timeoff 
      SET ${setParts.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await pool.query(query, values);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Time-off request not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating timeoff request:', error);
    res.status(500).json({ error: 'Failed to update timeoff request' });
  }
});

// Delete time-off request
router.delete('/timeoff/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const timeoffId = req.params.id;
    
    const result = await pool.query(
      'DELETE FROM consultant_timeoff WHERE id = $1 RETURNING *',
      [timeoffId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Time-off request not found' });
    }

    res.json({ message: 'Time-off request deleted successfully' });
  } catch (error) {
    console.error('Error deleting timeoff request:', error);
    res.status(500).json({ error: 'Failed to delete timeoff request' });
  }
});

// Check if consultant is available at specific time
router.get('/check/:consultantId', authenticateToken, async (req, res) => {
  try {
    const consultantId = req.params.consultantId;
    const { checkTime = new Date().toISOString() } = req.query;
    
    const query = `SELECT check_consultant_availability($1, $2) as is_available`;
    const result = await pool.query(query, [consultantId, checkTime]);
    
    res.json({ 
      consultantId: parseInt(consultantId),
      checkTime,
      isAvailable: result.rows[0].is_available 
    });
  } catch (error) {
    console.error('Error checking consultant availability:', error);
    res.status(500).json({ error: 'Failed to check consultant availability' });
  }
});

// Get all available consultants at specific time
router.get('/available', authenticateToken, async (req, res) => {
  try {
    const { checkTime = new Date().toISOString() } = req.query;
    
    const query = `SELECT * FROM get_available_consultants($1)`;
    const result = await pool.query(query, [checkTime]);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error getting available consultants:', error);
    res.status(500).json({ error: 'Failed to get available consultants' });
  }
});

// Get all pending time-off requests (admin only)
router.get('/timeoff/pending', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const query = `
      SELECT 
        ct.*,
        c.name as consultant_name,
        c.email as consultant_email,
        u.first_name || ' ' || u.last_name as approved_by_name
      FROM consultant_timeoff ct
      JOIN consultants c ON ct.consultant_id = c.id
      LEFT JOIN users u ON ct.approved_by = u.id
      WHERE ct.is_approved = false
      ORDER BY ct.created_at DESC
    `;
    
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Error getting pending timeoff requests:', error);
    res.status(500).json({ error: 'Failed to get pending timeoff requests' });
  }
});

module.exports = router;