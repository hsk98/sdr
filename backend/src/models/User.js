const pool = require('../config/database');
const argon2 = require('argon2');
const crypto = require('crypto');
const { encryptData, decryptData } = require('../utils/encryption');

class User {
  static async create(userData) {
    const { username, email, password, role, firstName, lastName } = userData;
    const hashedPassword = await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 2 ** 16,
      timeCost: 3,
      parallelism: 1,
    });
    
    const query = `
      INSERT INTO users (username, email, password_hash, role, first_name, last_name)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    
    const values = [username, email, hashedPassword, role, firstName, lastName];
    const result = await pool.query(query, values);
    const userId = result.rows[0].id;
    
    // Return the created user
    return await this.findById(userId);
  }

  static async findByUsername(username) {
    const query = 'SELECT * FROM users WHERE username = ?';
    const result = await pool.query(query, [username]);
    return result.rows[0];
  }

  static async findById(id) {
    const query = 'SELECT id, username, email, role, first_name, last_name, mfa_enabled, created_at FROM users WHERE id = ?';
    const result = await pool.query(query, [id]);
    return result.rows[0];
  }

  static async findByIdWithPassword(id) {
    const query = 'SELECT * FROM users WHERE id = ?';
    const result = await pool.query(query, [id]);
    return result.rows[0];
  }

  static async validatePassword(plainPassword, hashedPassword) {
    try {
      return await argon2.verify(hashedPassword, plainPassword);
    } catch (err) {
      return false;
    }
  }

  static async updatePassword(userId, newPassword) {
    const hashedPassword = await argon2.hash(newPassword, {
      type: argon2.argon2id,
      memoryCost: 2 ** 16,
      timeCost: 3,
      parallelism: 1,
    });
    
    const query = 'UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
    await pool.query(query, [hashedPassword, userId]);
    return true;
  }

  static async enableMFA(userId, secret) {
    const encryptedSecret = encryptData(secret);
    const query = 'UPDATE users SET mfa_secret = ?, mfa_enabled = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
    await pool.query(query, [encryptedSecret, userId]);
    return true;
  }

  static async getMFASecret(userId) {
    const query = 'SELECT mfa_secret FROM users WHERE id = ? AND mfa_enabled = 1';
    const result = await pool.query(query, [userId]);
    if (!result.rows[0] || !result.rows[0].mfa_secret) return null;
    return decryptData(result.rows[0].mfa_secret);
  }

  static async disableMFA(userId) {
    const query = 'UPDATE users SET mfa_secret = NULL, mfa_enabled = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
    await pool.query(query, [userId]);
    return true;
  }

  static async getAllSDRs() {
    const query = `
      SELECT id, username, email, first_name, last_name, created_at 
      FROM users 
      WHERE role = 'sdr' 
      ORDER BY created_at
    `;
    const result = await pool.query(query);
    return result.rows;
  }

  static async getAllUsers() {
    const query = `
      SELECT id, username, email, role, first_name, last_name, created_at 
      FROM users 
      ORDER BY created_at DESC
    `;
    const result = await pool.query(query);
    return result.rows;
  }

  static async updateUser(id, userData) {
    const { username, email, role, firstName, lastName } = userData;
    const query = `
      UPDATE users 
      SET username = ?, email = ?, role = ?, first_name = ?, last_name = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;
    const values = [username, email, role, firstName, lastName, id];
    await pool.query(query, values);
    return await this.findById(id);
  }

  static async deleteUser(id) {
    const user = await this.findById(id);
    const query = 'DELETE FROM users WHERE id = ?';
    await pool.query(query, [id]);
    return user;
  }
}

module.exports = User;