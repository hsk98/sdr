const pool = require('../config/database');

class Assignment {
  static async create(sdrId, consultantId) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      const assignmentQuery = `
        INSERT INTO assignments (sdr_id, consultant_id)
        VALUES ($1, $2)
        RETURNING *
      `;
      const assignmentResult = await client.query(assignmentQuery, [sdrId, consultantId]);
      
      const updateCountQuery = `
        UPDATE assignment_counts 
        SET assignment_count = assignment_count + 1, last_assigned_at = CURRENT_TIMESTAMP
        WHERE consultant_id = $1
      `;
      await client.query(updateCountQuery, [consultantId]);
      
      await client.query('COMMIT');
      return assignmentResult.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async findAll() {
    const query = `
      SELECT a.*, 
             CASE 
               WHEN a.is_manual = 1 THEN admin_u.username 
               ELSE u.username 
             END as sdr_username,
             CASE 
               WHEN a.is_manual = 1 THEN admin_u.first_name 
               ELSE u.first_name 
             END as sdr_first_name,
             CASE 
               WHEN a.is_manual = 1 THEN admin_u.last_name 
               ELSE u.last_name 
             END as sdr_last_name,
             CASE 
               WHEN a.is_manual = 1 THEN 'Manual (' || admin_u.first_name || ' ' || admin_u.last_name || ')'
               ELSE u.first_name || ' ' || u.last_name
             END as display_sdr_name,
             c.name as consultant_name, c.email as consultant_email,
             l.company_name, l.contact_name, l.salesforce_lead_id,
             COALESCE(a.lead_identifier, l.salesforce_lead_id, CAST(a.lead_id AS TEXT)) as display_lead_id,
             COALESCE(a.lead_name, l.company_name || ' - ' || l.contact_name) as display_lead_name
      FROM assignments a
      LEFT JOIN users u ON a.sdr_id = u.id
      LEFT JOIN users admin_u ON a.created_by = admin_u.id
      LEFT JOIN leads l ON a.lead_id = l.id
      JOIN consultants c ON a.consultant_id = c.id
      ORDER BY a.assigned_at DESC
    `;
    
    const result = await pool.query(query);
    return result.rows;
  }

  static async findBySDR(sdrId) {
    const query = `
      SELECT a.*, c.name as consultant_name, c.email as consultant_email, c.phone as consultant_phone
      FROM assignments a
      JOIN consultants c ON a.consultant_id = c.id
      WHERE a.sdr_id = ?
      ORDER BY a.assigned_at DESC
    `;
    
    const result = await pool.query(query, [sdrId]);
    return result.rows;
  }

  static async findLatestBySDR(sdrId) {
    const query = `
      SELECT a.*, c.name as consultant_name, c.email as consultant_email, c.phone as consultant_phone
      FROM assignments a
      JOIN consultants c ON a.consultant_id = c.id
      WHERE a.sdr_id = ? AND a.status = 'active'
      ORDER BY a.assigned_at DESC
      LIMIT 1
    `;
    
    const result = await pool.query(query, [sdrId]);
    return result.rows[0];
  }

  static async updateStatus(id, status, additionalData = {}) {
    const baseQuery = `
      UPDATE assignments 
      SET status = ?
      WHERE id = ?
    `;
    
    // Handle additional data for cancellations etc.
    let query = baseQuery;
    let params = [status, id];
    
    if (additionalData.cancellation_reason) {
      query = `
        UPDATE assignments 
        SET status = ?, manual_reason = ?, cancelled_at = ?
        WHERE id = ?
      `;
      params = [status, additionalData.cancellation_reason, additionalData.cancelled_at, id];
    }
    
    await pool.query(query, params);
    
    const selectQuery = 'SELECT * FROM assignments WHERE id = ?';
    const result = await pool.query(selectQuery, [id]);
    return result.rows[0];
  }

  static async findById(id) {
    const query = `
      SELECT a.*, c.name as consultant_name, c.email as consultant_email, c.phone as consultant_phone
      FROM assignments a
      LEFT JOIN consultants c ON a.consultant_id = c.id
      WHERE a.id = ?
    `;
    
    const result = await pool.query(query, [id]);
    return result.rows[0];
  }

  static async deleteById(id) {
    const query = `DELETE FROM assignments WHERE id = ?`;
    const result = await pool.query(query, [id]);
    return result.rowsAffected || result.changes || 1;
  }

  static async getAssignmentStats() {
    const query = `
      SELECT c.name, c.email, ac.assignment_count, ac.last_assigned_at,
             COUNT(a.id) as total_assignments,
             COUNT(CASE WHEN a.status = 'active' THEN 1 END) as active_assignments
      FROM consultants c
      LEFT JOIN assignment_counts ac ON c.id = ac.consultant_id
      LEFT JOIN assignments a ON c.id = a.consultant_id
      WHERE c.is_active = 1
      GROUP BY c.id, c.name, c.email, ac.assignment_count, ac.last_assigned_at
      ORDER BY ac.assignment_count DESC
    `;
    
    const result = await pool.query(query);
    return result.rows;
  }

  static async createManual(assignmentData) {
    console.log('Assignment.createManual called with:', assignmentData);
    
    const {
      leadId,
      leadName,
      consultantId,
      isManual,
      manualReason,
      createdBy
    } = assignmentData;

    try {
      console.log('Executing assignment insert query...');
      
      // Simple direct insertion - SQLite compatible
      const assignmentQuery = `
        INSERT INTO assignments (
          sdr_id, consultant_id, lead_identifier, lead_name, assigned_at, status, is_manual, manual_reason, created_by
        )
        VALUES (?, ?, ?, ?, datetime('now'), 'active', ?, ?, ?)
      `;
      
      const queryParams = [
        createdBy, // sdr_id
        consultantId, 
        leadId,
        leadName,
        isManual ? 1 : 0, 
        manualReason, 
        createdBy
      ];
      
      console.log('Query:', assignmentQuery);
      console.log('Params:', queryParams);
      
      const result = await pool.query(assignmentQuery, queryParams);
      console.log('Insert result:', result);
      
      // SQLite returns lastID in different ways depending on the connection wrapper
      const assignmentId = result.rows?.[0]?.id || result.lastID || result.insertId;
      console.log('Assignment ID:', assignmentId);
      
      // Update assignment counts for round-robin tracking
      console.log('Updating assignment counts...');
      const updateCountQuery = `
        INSERT OR REPLACE INTO assignment_counts (consultant_id, assignment_count, last_assigned_at)
        VALUES (
          ?, 
          COALESCE((SELECT assignment_count FROM assignment_counts WHERE consultant_id = ?), 0) + 1,
          datetime('now')
        )
      `;
      await pool.query(updateCountQuery, [consultantId, consultantId]);
      console.log('Assignment counts updated');
      
      // Return the created assignment with lead info
      const response = {
        id: assignmentId,
        lead_identifier: leadId,
        lead_name: leadName,
        consultant_id: consultantId,
        assigned_at: new Date().toISOString(),
        status: 'active',
        is_manual: isManual,
        manual_reason: manualReason,
        created_by: createdBy
      };
      
      console.log('Returning assignment:', response);
      return response;
    } catch (error) {
      console.error('Manual assignment creation error:', error);
      console.error('Error details:', error.message);
      console.error('Error stack:', error.stack);
      throw error;
    }
  }
}

module.exports = Assignment;