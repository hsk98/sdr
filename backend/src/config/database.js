// Database configuration - supports multiple database types
const dbType = process.env.DB_TYPE || 'sqlite';
console.log(`Using ${dbType} database`);

// Switch between database types based on environment
switch (dbType) {
  case 'supabase':
    module.exports = require('./database-supabase');
    break;
  case 'postgres':
  case 'postgresql':
    module.exports = require('./database-postgres');
    break;
  case 'sqlite':
  default:
    // Keep the existing SQLite implementation
    const sqlite3 = require('sqlite3').verbose();
    const path = require('path');

const dbPath = path.join(__dirname, '../../database.sqlite');

class SQLitePool {
  constructor() {
    this.db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('Error opening database:', err);
      } else {
        console.log('Connected to SQLite database');
        this.initializeDatabase();
      }
    });
  }

  initializeDatabase() {
    const schema = `
      -- Users table (SDRs and Admins)
      CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username VARCHAR(50) UNIQUE NOT NULL,
          email VARCHAR(100) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          role VARCHAR(20) NOT NULL CHECK (role IN ('sdr', 'admin')),
          first_name VARCHAR(50) NOT NULL,
          last_name VARCHAR(50) NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Business consultants table
      CREATE TABLE IF NOT EXISTS consultants (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name VARCHAR(100) NOT NULL,
          email VARCHAR(100) UNIQUE NOT NULL,
          phone VARCHAR(20),
          is_active BOOLEAN DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Assignments table to track lead-consultant assignments
      CREATE TABLE IF NOT EXISTS assignments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          lead_id INTEGER REFERENCES leads(id),
          lead_identifier VARCHAR(100),
          lead_name VARCHAR(200),
          consultant_id INTEGER REFERENCES consultants(id),
          assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
          is_manual BOOLEAN DEFAULT 0,
          manual_reason TEXT,
          created_by INTEGER REFERENCES users(id)
      );

      -- Leads table to track sales leads from CRM (Salesforce, etc.)
      CREATE TABLE IF NOT EXISTS leads (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          salesforce_lead_id VARCHAR(50) UNIQUE,
          sdr_id INTEGER REFERENCES users(id),
          company_name VARCHAR(200) NOT NULL,
          contact_name VARCHAR(100) NOT NULL,
          contact_email VARCHAR(100),
          contact_phone VARCHAR(20),
          lead_source VARCHAR(100),
          industry VARCHAR(100),
          estimated_value DECIMAL(10,2),
          priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
          status VARCHAR(30) DEFAULT 'new' CHECK (status IN ('new', 'qualified', 'assigned', 'in_consultation', 'completed', 'lost')),
          notes TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Assignment counter to track round-robin fairness
      CREATE TABLE IF NOT EXISTS assignment_counts (
          consultant_id INTEGER REFERENCES consultants(id) PRIMARY KEY,
          assignment_count INTEGER DEFAULT 0,
          last_assigned_at DATETIME
      );
    `;

    this.db.exec(schema, async (err) => {
      if (err) {
        console.error('Error creating schema:', err);
      } else {
        console.log('Database schema initialized');
        await this.migrateDatabase();
        await this.insertDefaultData();
      }
    });
  }

  async migrateDatabase() {
    try {
      // Add manual assignment columns if they don't exist
      this.db.run(`ALTER TABLE assignments ADD COLUMN is_manual BOOLEAN DEFAULT 0`, (err) => {
        if (err && !err.message.includes('duplicate column name')) {
          console.error('Error adding is_manual column:', err);
        }
      });
      
      this.db.run(`ALTER TABLE assignments ADD COLUMN manual_reason TEXT`, (err) => {
        if (err && !err.message.includes('duplicate column name')) {
          console.error('Error adding manual_reason column:', err);
        }
      });
      
      this.db.run(`ALTER TABLE assignments ADD COLUMN created_by INTEGER REFERENCES users(id)`, (err) => {
        if (err && !err.message.includes('duplicate column name')) {
          console.error('Error adding created_by column:', err);
        }
      });

      // Add lead_id column to assignments table (for migration from sdr_id to lead_id)
      this.db.run(`ALTER TABLE assignments ADD COLUMN lead_id INTEGER REFERENCES leads(id)`, (err) => {
        if (err && !err.message.includes('duplicate column name')) {
          console.error('Error adding lead_id column:', err);
        }
      });

      // Add lead identifier and name columns for manual assignments
      this.db.run(`ALTER TABLE assignments ADD COLUMN lead_identifier VARCHAR(100)`, (err) => {
        if (err && !err.message.includes('duplicate column name')) {
          console.error('Error adding lead_identifier column:', err);
        }
      });

      this.db.run(`ALTER TABLE assignments ADD COLUMN lead_name VARCHAR(200)`, (err) => {
        if (err && !err.message.includes('duplicate column name')) {
          console.error('Error adding lead_name column:', err);
        }
      });

      // Add sdr_id column for blind assignments
      this.db.run(`ALTER TABLE assignments ADD COLUMN sdr_id INTEGER REFERENCES users(id)`, (err) => {
        if (err && !err.message.includes('duplicate column name')) {
          console.error('Error adding sdr_id column:', err);
        } else {
          console.log('Database migration completed successfully');
        }
      });
    } catch (error) {
      console.error('Error during database migration:', error);
    }
  }

  async insertDefaultData() {
    const bcrypt = require('bcryptjs');
    
    try {
      // Hash the password properly
      const hashedPassword = await bcrypt.hash('admin123', 10);
      
      // Insert default admin user (password: admin123)
      const adminInsert = `
        INSERT OR IGNORE INTO users (username, email, password_hash, role, first_name, last_name) 
        VALUES (?, ?, ?, ?, ?, ?)
      `;

      this.db.run(adminInsert, ['admin', 'admin@company.com', hashedPassword, 'admin', 'Admin', 'User'], (err) => {
        if (err && !err.message.includes('UNIQUE constraint failed')) {
          console.error('Error inserting admin user:', err);
        } else {
          console.log('Admin user created with username: admin, password: admin123');
        }
      });

      // Insert sample consultants
      const consultants = [
        ['John Smith', 'john.smith@consulting.com', '+1-555-0101'],
        ['Sarah Johnson', 'sarah.johnson@consulting.com', '+1-555-0102'],
        ['Mike Davis', 'mike.davis@consulting.com', '+1-555-0103'],
        ['Emily Brown', 'emily.brown@consulting.com', '+1-555-0104'],
        ['David Wilson', 'david.wilson@consulting.com', '+1-555-0105']
      ];

      const consultantInsert = `INSERT OR IGNORE INTO consultants (name, email, phone) VALUES (?, ?, ?)`;
      
      consultants.forEach(consultant => {
        this.db.run(consultantInsert, consultant, (err) => {
          if (err && !err.message.includes('UNIQUE constraint failed')) {
            console.error('Error inserting consultant:', err);
          }
        });
      });

      // Insert sample leads
      const leads = [
        ['SF001', 'Acme Corp', 'John Doe', 'john.doe@acmecorp.com', '+1-555-1001', 'Website', 'Technology', 50000, 'high', 'qualified'],
        ['SF002', 'Beta Industries', 'Jane Smith', 'jane.smith@betaindustries.com', '+1-555-1002', 'Referral', 'Manufacturing', 75000, 'medium', 'new'],
        ['SF003', 'Gamma Solutions', 'Mike Johnson', 'mike.johnson@gammasolutions.com', '+1-555-1003', 'Cold Call', 'Healthcare', 100000, 'urgent', 'qualified'],
        ['SF004', 'Delta Enterprises', 'Sarah Wilson', 'sarah.wilson@deltaenterprises.com', '+1-555-1004', 'LinkedIn', 'Finance', 25000, 'low', 'new'],
        ['SF005', 'Epsilon Co', 'Tom Brown', 'tom.brown@epsilonco.com', '+1-555-1005', 'Trade Show', 'Retail', 60000, 'high', 'qualified']
      ];

      const leadInsert = `INSERT OR IGNORE INTO leads (salesforce_lead_id, company_name, contact_name, contact_email, contact_phone, lead_source, industry, estimated_value, priority, status, sdr_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`;
      
      leads.forEach(lead => {
        this.db.run(leadInsert, lead, (err) => {
          if (err && !err.message.includes('UNIQUE constraint failed')) {
            console.error('Error inserting lead:', err);
          }
        });
      });

      // Initialize assignment counts for all consultants
      setTimeout(() => {
        this.db.run(`
          INSERT OR IGNORE INTO assignment_counts (consultant_id, assignment_count) 
          SELECT id, 0 FROM consultants
        `, (err) => {
          if (err) {
            console.error('Error initializing assignment counts:', err);
          } else {
            console.log('Sample data inserted successfully');
          }
        });
      }, 1000);
      
    } catch (error) {
      console.error('Error in insertDefaultData:', error);
    }
  }

  query(sql, params = []) {
    return new Promise((resolve, reject) => {
      // Convert PostgreSQL-style placeholders ($1, $2) to SQLite-style (?, ?)
      let sqliteQuery = sql;
      let sqliteParams = [...params]; // Start with original params
      
      // Replace $1, $2, etc. with ?
      let paramIndex = 1;
      const hasPositionalParams = sqliteQuery.includes('$');
      
      if (hasPositionalParams) {
        sqliteParams = []; // Reset if we're converting from positional
        while (sqliteQuery.includes('$' + paramIndex)) {
          sqliteQuery = sqliteQuery.replace('$' + paramIndex, '?');
          sqliteParams.push(params[paramIndex - 1]);
          paramIndex++;
        }
      }

      // Handle different query types
      if (sqliteQuery.trim().toUpperCase().startsWith('SELECT') || 
          sqliteQuery.trim().toUpperCase().includes('RETURNING')) {
        
        // For queries with RETURNING, we need to handle them differently
        if (sqliteQuery.includes('RETURNING')) {
          const parts = sqliteQuery.split('RETURNING');
          const mainQuery = parts[0];
          
          this.db.run(mainQuery, sqliteParams, function(err) {
            if (err) {
              reject(err);
            } else {
              // For INSERT/UPDATE with RETURNING, return the affected row
              if (mainQuery.trim().toUpperCase().startsWith('INSERT')) {
                resolve({ rows: [{ id: this.lastID }] });
              } else {
                resolve({ rows: [{}] });
              }
            }
          });
        } else {
          this.db.all(sqliteQuery, sqliteParams, (err, rows) => {
            if (err) {
              reject(err);
            } else {
              resolve({ rows: rows || [] });
            }
          });
        }
      } else {
        this.db.run(sqliteQuery, sqliteParams, function(err) {
          if (err) {
            reject(err);
          } else {
            resolve({ 
              rows: [{ id: this.lastID }],
              rowCount: this.changes 
            });
          }
        });
      }
    });
  }

  connect() {
    return {
      query: this.query.bind(this),
      release: () => {}
    };
  }
}

    module.exports = new SQLitePool();
    break;
}