const fs = require('fs').promises;
const path = require('path');
const pool = require('../config/database');
const crypto = require('crypto');

class AuditLogger {
  constructor() {
    this.logFile = path.join(__dirname, '../../logs/audit.log');
    this.maxLogEntries = parseInt(process.env.MAX_AUDIT_LOGS) || 100000;
    this.cleanupInterval = 24 * 60 * 60 * 1000; // 24 hours
    this.logLevel = process.env.LOG_LEVEL || 'INFO';
    this.enableFileLogging = process.env.ENABLE_FILE_LOGGING === 'true';
    this.logDirectory = process.env.LOG_DIRECTORY || path.join(__dirname, '../../logs');
    this.ensureLogDirectory();
    this.startCleanupSchedule();
  }

  startCleanupSchedule() {
    setInterval(() => {
      this.cleanupOldLogs();
    }, this.cleanupInterval);
  }

  async ensureLogDirectory() {
    try {
      await fs.mkdir(this.logDirectory, { recursive: true });
    } catch (error) {
      console.error('Failed to create log directory:', error);
    }
  }

  async log(level, action, data) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      action,
      ...data
    };

    const logLine = JSON.stringify(logEntry) + '\n';

    try {
      await fs.appendFile(this.logFile, logLine);
      console.log(`[${level.toUpperCase()}] ${action}:`, data);
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  async logAssignment(sdrId, consultantId, assignmentId, metadata = {}) {
    await this.log('INFO', 'ASSIGNMENT_CREATED', {
      sdr_id: sdrId,
      consultant_id: consultantId,
      assignment_id: assignmentId,
      ...metadata
    });
  }

  async logAssignmentFailure(sdrId, reason, metadata = {}) {
    await this.log('ERROR', 'ASSIGNMENT_FAILED', {
      sdr_id: sdrId,
      reason,
      ...metadata
    });
  }

  async logConsultantAvailabilityChange(consultantId, isActive, changedBy) {
    await this.log('INFO', 'CONSULTANT_AVAILABILITY_CHANGED', {
      consultant_id: consultantId,
      is_active: isActive,
      changed_by: changedBy
    });
  }

  async logRoundRobinSelection(consultantId, selectionMetadata) {
    await this.log('INFO', 'ROUND_ROBIN_SELECTION', {
      consultant_id: consultantId,
      ...selectionMetadata
    });
  }

  async logSystemEvent(action, details = {}) {
    try {
      const timestamp = new Date().toISOString();
      const logEntry = {
        timestamp,
        level: 'INFO',
        action,
        details: {
          ...details,
          session_id: details.session_id || crypto.randomBytes(8).toString('hex'),
          server_instance: process.env.SERVER_INSTANCE || 'default'
        }
      };
      
      // Database logging
      try {
        const query = `
          INSERT INTO audit_logs (timestamp, level, action, details)
          VALUES (?, ?, ?, ?)
        `;
        
        await pool.query(query, [
          logEntry.timestamp,
          logEntry.level,
          logEntry.action,
          JSON.stringify(logEntry.details)
        ]);
      } catch (dbError) {
        console.error('Database logging failed:', dbError);
      }
      
      // File logging
      if (this.enableFileLogging) {
        await this.writeToFile('system', logEntry);
      }
      
      // Console logging
      console.log(`[AUDIT] ${timestamp} - ${action}:`, logEntry.details);
    } catch (error) {
      console.error('Failed to log system event:', error);
    }
  }

  async logError(action, error, details = {}) {
    try {
      const timestamp = new Date().toISOString();
      const errorDetails = {
        message: error.message,
        stack: error.stack,
        error_code: error.code,
        error_type: error.constructor.name,
        ...details,
        session_id: details.session_id || crypto.randomBytes(8).toString('hex'),
        server_instance: process.env.SERVER_INSTANCE || 'default'
      };
      
      const logEntry = {
        timestamp,
        level: 'ERROR',
        action,
        details: errorDetails
      };
      
      // Database logging
      try {
        const query = `
          INSERT INTO audit_logs (timestamp, level, action, details)
          VALUES (?, ?, ?, ?)
        `;
        
        await pool.query(query, [
          logEntry.timestamp,
          logEntry.level,
          logEntry.action,
          JSON.stringify(logEntry.details)
        ]);
      } catch (dbError) {
        console.error('Database error logging failed:', dbError);
      }
      
      // File logging
      if (this.enableFileLogging) {
        await this.writeToFile('error', logEntry);
      }
      
      console.error(`[AUDIT ERROR] ${timestamp} - ${action}:`, errorDetails);
    } catch (logError) {
      console.error('Failed to log error:', logError);
      console.error('Original error:', error);
    }
  }

  async writeToFile(type, logEntry) {
    if (!this.enableFileLogging) return;
    
    try {
      const date = new Date().toISOString().split('T')[0];
      const filename = `${type}-${date}.log`;
      const filepath = path.join(this.logDirectory, filename);
      
      const logLine = `${JSON.stringify(logEntry)}\n`;
      await fs.appendFile(filepath, logLine);
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  async getSecurityLogs(filters = {}) {
    try {
      const {
        limit = 100,
        offset = 0,
        level = 'all',
        action = null,
        userId = null,
        startDate = null,
        endDate = null
      } = filters;
      
      let query = 'SELECT * FROM audit_logs WHERE 1=1';
      const params = [];
      
      if (level !== 'all') {
        query += ' AND level = ?';
        params.push(level);
      }
      
      if (action) {
        query += ' AND action = ?';
        params.push(action);
      }
      
      if (userId) {
        query += ' AND JSON_EXTRACT(details, "$.user_id") = ?';
        params.push(userId);
      }
      
      if (startDate) {
        query += ' AND timestamp >= ?';
        params.push(startDate);
      }
      
      if (endDate) {
        query += ' AND timestamp <= ?';
        params.push(endDate);
      }
      
      query += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
      params.push(limit, offset);
      
      const result = await pool.query(query, params);
      
      return {
        logs: result.rows.map(row => ({
          ...row,
          details: JSON.parse(row.details)
        })),
        filters,
        count: result.rows.length
      };
    } catch (error) {
      console.error('Failed to retrieve security logs:', error);
      throw error;
    }
  }

  async cleanupOldLogs() {
    try {
      // Database cleanup
      const query = `
        DELETE FROM audit_logs 
        WHERE id NOT IN (
          SELECT id FROM audit_logs 
          ORDER BY timestamp DESC 
          LIMIT ?
        )
      `;
      
      const result = await pool.query(query, [this.maxLogEntries]);
      
      // File cleanup (keep logs for 90 days)
      if (this.enableFileLogging) {
        await this.cleanupOldLogFiles();
      }
      
      if (result.changes > 0) {
        console.log(`Cleaned up ${result.changes} old audit log entries`);
        await this.logSystemEvent('AUDIT_LOG_CLEANUP', {
          deleted_db_entries: result.changes,
          max_entries: this.maxLogEntries
        });
      }
    } catch (error) {
      console.error('Failed to cleanup old logs:', error);
    }
  }

  async cleanupOldLogFiles() {
    try {
      const files = await fs.readdir(this.logDirectory);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 90); // Keep 90 days
      
      for (const file of files) {
        if (file.endsWith('.log')) {
          const filepath = path.join(this.logDirectory, file);
          const stats = await fs.stat(filepath);
          
          if (stats.mtime < cutoffDate) {
            await fs.unlink(filepath);
            console.log(`Deleted old log file: ${file}`);
          }
        }
      }
    } catch (error) {
      console.error('Failed to cleanup old log files:', error);
    }
  }

  async getAuditLogs(filters = {}) {
    try {
      const content = await fs.readFile(this.logFile, 'utf8');
      const logs = content.split('\n')
        .filter(line => line.trim())
        .map(line => JSON.parse(line))
        .reverse(); // Most recent first

      let filteredLogs = logs;

      if (filters.action) {
        filteredLogs = filteredLogs.filter(log => log.action === filters.action);
      }

      if (filters.sdr_id) {
        filteredLogs = filteredLogs.filter(log => log.sdr_id === filters.sdr_id);
      }

      if (filters.consultant_id) {
        filteredLogs = filteredLogs.filter(log => log.consultant_id === filters.consultant_id);
      }

      if (filters.from_date) {
        filteredLogs = filteredLogs.filter(log => 
          new Date(log.timestamp) >= new Date(filters.from_date)
        );
      }

      if (filters.to_date) {
        filteredLogs = filteredLogs.filter(log => 
          new Date(log.timestamp) <= new Date(filters.to_date)
        );
      }

      return filteredLogs.slice(0, filters.limit || 100);
    } catch (error) {
      console.error('Failed to read audit logs:', error);
      return [];
    }
  }
}

module.exports = new AuditLogger();