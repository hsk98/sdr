const pool = require('../config/database');

class Consultant {
  static async create(consultantData) {
    const { name, email, phone } = consultantData;
    
    try {
      const insertQuery = `
        INSERT INTO consultants (name, email, phone)
        VALUES (?, ?, ?)
      `;
      const result = await pool.query(insertQuery, [name, email, phone]);
      const consultantId = result.rows[0].id;
      
      const countQuery = `
        INSERT INTO assignment_counts (consultant_id, assignment_count)
        VALUES (?, 0)
      `;
      await pool.query(countQuery, [consultantId]);
      
      // Return the created consultant
      return await this.findById(consultantId);
    } catch (error) {
      throw error;
    }
  }

  static async findAll() {
    const query = 'SELECT * FROM consultants ORDER BY name';
    const result = await pool.query(query);
    return result.rows;
  }

  static async findActive() {
    const query = 'SELECT * FROM consultants WHERE is_active = 1 ORDER BY name';
    const result = await pool.query(query);
    return result.rows;
  }

  static async findById(id) {
    const query = 'SELECT * FROM consultants WHERE id = ?';
    const result = await pool.query(query, [id]);
    return result.rows[0];
  }

  static async update(id, consultantData) {
    const { name, email, phone, is_active } = consultantData;
    
    const query = `
      UPDATE consultants 
      SET name = ?, email = ?, phone = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;
    
    const values = [name, email, phone, is_active, id];
    await pool.query(query, values);
    return await this.findById(id);
  }

  static async delete(id) {
    const consultant = await this.findById(id);
    const query = 'DELETE FROM consultants WHERE id = ?';
    await pool.query(query, [id]);
    return consultant;
  }

  static async getNextForAssignment() {
    const query = `
      SELECT c.*, ac.assignment_count, ac.last_assigned_at
      FROM consultants c
      LEFT JOIN assignment_counts ac ON c.id = ac.consultant_id
      WHERE c.is_active = 1
      ORDER BY ac.assignment_count ASC, ac.last_assigned_at ASC
      LIMIT 1
    `;
    
    const result = await pool.query(query);
    return result.rows[0];
  }
}

module.exports = Consultant;