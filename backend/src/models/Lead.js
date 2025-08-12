const pool = require('../config/database');

class Lead {
  static async create(leadData) {
    const {
      salesforceLeadId,
      sdrId,
      companyName,
      contactName,
      contactEmail,
      contactPhone,
      leadSource,
      industry,
      estimatedValue,
      priority,
      notes
    } = leadData;

    const query = `
      INSERT INTO leads (
        salesforce_lead_id, sdr_id, company_name, contact_name, 
        contact_email, contact_phone, lead_source, industry, 
        estimated_value, priority, notes
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING *
    `;
    
    const result = await pool.query(query, [
      salesforceLeadId, sdrId, companyName, contactName,
      contactEmail, contactPhone, leadSource, industry,
      estimatedValue, priority, notes
    ]);
    return result.rows[0];
  }

  static async findAll() {
    const query = `
      SELECT l.*, u.username as sdr_username, u.first_name as sdr_first_name, 
             u.last_name as sdr_last_name
      FROM leads l
      LEFT JOIN users u ON l.sdr_id = u.id
      ORDER BY l.created_at DESC
    `;
    
    const result = await pool.query(query);
    return result.rows;
  }

  static async findById(id) {
    const query = `
      SELECT l.*, u.username as sdr_username, u.first_name as sdr_first_name, 
             u.last_name as sdr_last_name
      FROM leads l
      LEFT JOIN users u ON l.sdr_id = u.id
      WHERE l.id = ?
    `;
    
    const result = await pool.query(query, [id]);
    return result.rows[0];
  }

  static async findBySDR(sdrId) {
    const query = `
      SELECT * FROM leads 
      WHERE sdr_id = ? 
      ORDER BY created_at DESC
    `;
    
    const result = await pool.query(query, [sdrId]);
    return result.rows;
  }

  static async findQualifiedLeads() {
    const query = `
      SELECT l.*, u.username as sdr_username, u.first_name as sdr_first_name, 
             u.last_name as sdr_last_name
      FROM leads l
      LEFT JOIN users u ON l.sdr_id = u.id
      WHERE l.status IN ('qualified', 'new') 
      AND l.id NOT IN (
        SELECT lead_id FROM assignments WHERE status = 'active' AND lead_id IS NOT NULL
      )
      ORDER BY 
        CASE l.priority 
          WHEN 'urgent' THEN 1
          WHEN 'high' THEN 2
          WHEN 'medium' THEN 3
          WHEN 'low' THEN 4
        END,
        l.created_at ASC
    `;
    
    const result = await pool.query(query);
    return result.rows;
  }

  static async updateStatus(id, status) {
    const query = `
      UPDATE leads 
      SET status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
      RETURNING *
    `;
    
    const result = await pool.query(query, [status, id]);
    return result.rows[0];
  }

  static async update(id, leadData) {
    const {
      companyName,
      contactName,
      contactEmail,
      contactPhone,
      leadSource,
      industry,
      estimatedValue,
      priority,
      status,
      notes
    } = leadData;

    const query = `
      UPDATE leads 
      SET company_name = ?, contact_name = ?, contact_email = ?,
          contact_phone = ?, lead_source = ?, industry = ?,
          estimated_value = ?, priority = ?, status = ?, notes = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
      RETURNING *
    `;
    
    const result = await pool.query(query, [
      companyName, contactName, contactEmail, contactPhone,
      leadSource, industry, estimatedValue, priority, status, notes, id
    ]);
    return result.rows[0];
  }

  static async delete(id) {
    const query = `DELETE FROM leads WHERE id = ? RETURNING *`;
    const result = await pool.query(query, [id]);
    return result.rows[0];
  }

  static async findByIdOrSalesforceId(leadId) {
    const query = `
      SELECT l.*, u.username as sdr_username, u.first_name as sdr_first_name, 
             u.last_name as sdr_last_name
      FROM leads l
      LEFT JOIN users u ON l.sdr_id = u.id
      WHERE l.id = ? OR l.salesforce_lead_id = ?
    `;
    
    const result = await pool.query(query, [leadId, leadId]);
    return result.rows[0];
  }

  static async findByNameOrCompany(searchTerm) {
    const query = `
      SELECT l.*, u.username as sdr_username, u.first_name as sdr_first_name, 
             u.last_name as sdr_last_name
      FROM leads l
      LEFT JOIN users u ON l.sdr_id = u.id
      WHERE LOWER(l.company_name) LIKE LOWER(?) 
         OR LOWER(l.contact_name) LIKE LOWER(?)
         OR LOWER(l.company_name || ' - ' || l.contact_name) LIKE LOWER(?)
      ORDER BY l.created_at DESC
    `;
    
    const searchPattern = `%${searchTerm}%`;
    const result = await pool.query(query, [searchPattern, searchPattern, searchPattern]);
    return result.rows;
  }

  static async findByIdAndName(leadId, leadName) {
    // First try to find by ID (either internal or Salesforce)
    const leadById = await this.findByIdOrSalesforceId(leadId);
    
    if (leadById) {
      // Verify the name matches (fuzzy match)
      const nameMatch = leadById.company_name.toLowerCase().includes(leadName.toLowerCase()) ||
                       leadById.contact_name.toLowerCase().includes(leadName.toLowerCase()) ||
                       leadName.toLowerCase().includes(leadById.company_name.toLowerCase()) ||
                       leadName.toLowerCase().includes(leadById.contact_name.toLowerCase());
      
      if (nameMatch) {
        return leadById;
      } else {
        throw new Error(`Lead ID "${leadId}" found but name "${leadName}" does not match. Found: ${leadById.company_name} - ${leadById.contact_name}`);
      }
    }

    // If not found by ID, try to find by name
    const leadsByName = await this.findByNameOrCompany(leadName);
    
    if (leadsByName.length === 0) {
      throw new Error(`No leads found matching ID "${leadId}" or name "${leadName}"`);
    }
    
    if (leadsByName.length === 1) {
      return leadsByName[0];
    }
    
    // Multiple matches - provide helpful error
    const matches = leadsByName.slice(0, 5).map(l => `${l.company_name} - ${l.contact_name} (ID: ${l.id})`).join(', ');
    throw new Error(`Multiple leads found for "${leadName}". Please be more specific. Found: ${matches}${leadsByName.length > 5 ? ` and ${leadsByName.length - 5} more...` : ''}`);
  }
}

module.exports = Lead;