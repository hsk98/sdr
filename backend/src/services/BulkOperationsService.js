const { Pool } = require('pg');
const config = require('../config/database');
const csv = require('csv-parser');
const fs = require('fs');
const ValidationService = require('./ValidationService');

class BulkOperationsService {
  constructor() {
    this.pool = new Pool(config);
  }

  // Bulk create consultants
  async bulkCreateConsultants(consultants, userId = null) {
    const operation = await this.startBulkOperation('create', 'consultants', consultants.length, userId);
    
    let successful = 0;
    let failed = 0;
    const errors = [];

    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Set user context for audit logging
      if (userId) {
        await client.query('SET app.current_user_id = $1', [userId]);
      }

      for (const [index, consultant] of consultants.entries()) {
        try {
          // Validate consultant data
          const validationResult = await ValidationService.validateEntity('consultants', consultant);
          if (!validationResult.isValid) {
            throw new Error(`Validation failed: ${validationResult.errors.join(', ')}`);
          }

          const query = `
            INSERT INTO consultants (name, email, phone, specialty, hourly_rate, timezone, notes)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id
          `;
          
          const values = [
            consultant.name,
            consultant.email,
            consultant.phone || null,
            consultant.specialty || null,
            consultant.hourly_rate || null,
            consultant.timezone || 'UTC',
            consultant.notes || null
          ];

          const result = await client.query(query, values);
          
          // Initialize assignment count
          await client.query(
            'INSERT INTO assignment_counts (consultant_id, assignment_count) VALUES ($1, 0)',
            [result.rows[0].id]
          );

          successful++;
        } catch (error) {
          failed++;
          errors.push(`Row ${index + 1}: ${error.message}`);
        }
      }

      await client.query('COMMIT');
      await this.completeBulkOperation(operation.id, successful, failed, errors.join('\n'));
      
      return {
        operationId: operation.id,
        total: consultants.length,
        successful,
        failed,
        errors: errors.slice(0, 10) // Limit error display
      };

    } catch (error) {
      await client.query('ROLLBACK');
      await this.completeBulkOperation(operation.id, successful, failed, error.message);
      throw error;
    } finally {
      client.release();
    }
  }

  // Bulk update consultants
  async bulkUpdateConsultants(updates, userId = null) {
    const operation = await this.startBulkOperation('update', 'consultants', updates.length, userId);
    
    let successful = 0;
    let failed = 0;
    const errors = [];

    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      if (userId) {
        await client.query('SET app.current_user_id = $1', [userId]);
      }

      for (const [index, update] of updates.entries()) {
        try {
          if (!update.id) {
            throw new Error('ID is required for updates');
          }

          // Validate update data
          const validationResult = await ValidationService.validateEntity('consultants', update, true);
          if (!validationResult.isValid) {
            throw new Error(`Validation failed: ${validationResult.errors.join(', ')}`);
          }

          const setParts = [];
          const values = [];
          let paramIndex = 1;

          const updateableFields = ['name', 'email', 'phone', 'specialty', 'hourly_rate', 'timezone', 'notes', 'is_active'];
          
          for (const field of updateableFields) {
            if (update.hasOwnProperty(field)) {
              setParts.push(`${field} = $${paramIndex}`);
              values.push(update[field]);
              paramIndex++;
            }
          }

          if (setParts.length === 0) {
            throw new Error('No valid fields to update');
          }

          setParts.push(`updated_at = CURRENT_TIMESTAMP`);
          values.push(update.id);

          const query = `
            UPDATE consultants 
            SET ${setParts.join(', ')}
            WHERE id = $${paramIndex}
          `;

          const result = await client.query(query, values);
          
          if (result.rowCount === 0) {
            throw new Error('Consultant not found');
          }

          successful++;
        } catch (error) {
          failed++;
          errors.push(`Row ${index + 1} (ID: ${update.id}): ${error.message}`);
        }
      }

      await client.query('COMMIT');
      await this.completeBulkOperation(operation.id, successful, failed, errors.join('\n'));
      
      return {
        operationId: operation.id,
        total: updates.length,
        successful,
        failed,
        errors: errors.slice(0, 10)
      };

    } catch (error) {
      await client.query('ROLLBACK');
      await this.completeBulkOperation(operation.id, successful, failed, error.message);
      throw error;
    } finally {
      client.release();
    }
  }

  // Bulk delete consultants
  async bulkDeleteConsultants(consultantIds, userId = null) {
    const operation = await this.startBulkOperation('delete', 'consultants', consultantIds.length, userId);
    
    let successful = 0;
    let failed = 0;
    const errors = [];

    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      if (userId) {
        await client.query('SET app.current_user_id = $1', [userId]);
      }

      for (const [index, consultantId] of consultantIds.entries()) {
        try {
          // Check if consultant has active assignments
          const activeAssignments = await client.query(
            'SELECT COUNT(*) FROM assignments WHERE consultant_id = $1 AND status = $2',
            [consultantId, 'active']
          );

          if (parseInt(activeAssignments.rows[0].count) > 0) {
            throw new Error('Cannot delete consultant with active assignments');
          }

          const result = await client.query(
            'DELETE FROM consultants WHERE id = $1',
            [consultantId]
          );
          
          if (result.rowCount === 0) {
            throw new Error('Consultant not found');
          }

          successful++;
        } catch (error) {
          failed++;
          errors.push(`ID ${consultantId}: ${error.message}`);
        }
      }

      await client.query('COMMIT');
      await this.completeBulkOperation(operation.id, successful, failed, errors.join('\n'));
      
      return {
        operationId: operation.id,
        total: consultantIds.length,
        successful,
        failed,
        errors: errors.slice(0, 10)
      };

    } catch (error) {
      await client.query('ROLLBACK');
      await this.completeBulkOperation(operation.id, successful, failed, error.message);
      throw error;
    } finally {
      client.release();
    }
  }

  // Import from CSV file
  async importFromCSV(filePath, entityType, userId = null) {
    return new Promise((resolve, reject) => {
      const results = [];
      const errors = [];

      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (data) => {
          results.push(data);
        })
        .on('end', async () => {
          try {
            let operationResult;
            
            switch (entityType) {
              case 'consultants':
                operationResult = await this.bulkCreateConsultants(results, userId);
                break;
              default:
                throw new Error(`Unsupported entity type: ${entityType}`);
            }
            
            // Clean up the uploaded file
            fs.unlinkSync(filePath);
            
            resolve(operationResult);
          } catch (error) {
            reject(error);
          }
        })
        .on('error', (error) => {
          reject(error);
        });
    });
  }

  // Bulk set availability schedules
  async bulkSetAvailability(availabilityData, userId = null) {
    const operation = await this.startBulkOperation('update', 'availability', availabilityData.length, userId);
    
    let successful = 0;
    let failed = 0;
    const errors = [];

    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      if (userId) {
        await client.query('SET app.current_user_id = $1', [userId]);
      }

      for (const [index, availability] of availabilityData.entries()) {
        try {
          const { consultantId, schedules } = availability;

          if (!consultantId || !schedules || !Array.isArray(schedules)) {
            throw new Error('Invalid availability data structure');
          }

          // Clear existing availability for consultant
          await client.query(
            'DELETE FROM consultant_availability WHERE consultant_id = $1',
            [consultantId]
          );

          // Insert new availability schedules
          for (const schedule of schedules) {
            const { dayOfWeek, startTime, endTime, isAvailable = true } = schedule;
            
            await client.query(`
              INSERT INTO consultant_availability (consultant_id, day_of_week, start_time, end_time, is_available)
              VALUES ($1, $2, $3, $4, $5)
            `, [consultantId, dayOfWeek, startTime, endTime, isAvailable]);
          }

          successful++;
        } catch (error) {
          failed++;
          errors.push(`Consultant ${availability.consultantId}: ${error.message}`);
        }
      }

      await client.query('COMMIT');
      await this.completeBulkOperation(operation.id, successful, failed, errors.join('\n'));
      
      return {
        operationId: operation.id,
        total: availabilityData.length,
        successful,
        failed,
        errors: errors.slice(0, 10)
      };

    } catch (error) {
      await client.query('ROLLBACK');
      await this.completeBulkOperation(operation.id, successful, failed, error.message);
      throw error;
    } finally {
      client.release();
    }
  }

  // Start a bulk operation record
  async startBulkOperation(operationType, entityType, totalRecords, userId = null, fileName = null) {
    const query = `
      INSERT INTO bulk_operations (operation_type, entity_type, total_records, successful_records, failed_records, initiated_by, file_name)
      VALUES ($1, $2, $3, 0, 0, $4, $5)
      RETURNING id, created_at
    `;
    
    const result = await this.pool.query(query, [operationType, entityType, totalRecords, userId, fileName]);
    return result.rows[0];
  }

  // Complete a bulk operation record
  async completeBulkOperation(operationId, successful, failed, errorLog = null) {
    const query = `
      UPDATE bulk_operations 
      SET successful_records = $1, failed_records = $2, error_log = $3, completed_at = CURRENT_TIMESTAMP
      WHERE id = $4
    `;
    
    await this.pool.query(query, [successful, failed, errorLog, operationId]);
  }

  // Get bulk operation history
  async getBulkOperationHistory(limit = 50, offset = 0) {
    const query = `
      SELECT 
        bo.*,
        u.first_name || ' ' || u.last_name as initiated_by_name
      FROM bulk_operations bo
      LEFT JOIN users u ON bo.initiated_by = u.id
      ORDER BY bo.created_at DESC
      LIMIT $1 OFFSET $2
    `;
    
    const result = await this.pool.query(query, [limit, offset]);
    return result.rows;
  }

  // Get specific bulk operation details
  async getBulkOperationDetails(operationId) {
    const query = `
      SELECT 
        bo.*,
        u.first_name || ' ' || u.last_name as initiated_by_name
      FROM bulk_operations bo
      LEFT JOIN users u ON bo.initiated_by = u.id
      WHERE bo.id = $1
    `;
    
    const result = await this.pool.query(query, [operationId]);
    return result.rows[0];
  }

  // Export data to CSV
  async exportToCSV(entityType, filters = {}) {
    let query;
    let params = [];
    
    switch (entityType) {
      case 'consultants':
        query = `
          SELECT 
            c.*,
            ac.assignment_count,
            ac.last_assigned_at
          FROM consultants c
          LEFT JOIN assignment_counts ac ON c.id = ac.consultant_id
          WHERE c.is_active = true
          ORDER BY c.name
        `;
        break;
      
      case 'assignments':
        query = `
          SELECT 
            a.id,
            a.assigned_at,
            a.status,
            c.name as consultant_name,
            c.email as consultant_email,
            u.first_name || ' ' || u.last_name as sdr_name,
            u.email as sdr_email,
            am.response_time_minutes,
            am.completion_time_minutes,
            am.consultant_rating,
            am.sdr_rating
          FROM assignments a
          JOIN consultants c ON a.consultant_id = c.id
          JOIN users u ON a.sdr_id = u.id
          LEFT JOIN assignment_metrics am ON a.id = am.assignment_id
          ORDER BY a.assigned_at DESC
        `;
        break;
        
      default:
        throw new Error(`Unsupported entity type for export: ${entityType}`);
    }
    
    const result = await this.pool.query(query, params);
    return result.rows;
  }
}

module.exports = new BulkOperationsService();