const { createClient } = require('@supabase/supabase-js');

class SupabaseDatabase {
  constructor() {
    this.supabaseUrl = process.env.SUPABASE_URL;
    this.supabaseKey = process.env.SUPABASE_ANON_KEY;
    this.databaseUrl = process.env.DATABASE_URL;
    
    if (!this.supabaseUrl || !this.supabaseKey) {
      throw new Error('Supabase configuration missing. Please set SUPABASE_URL and SUPABASE_ANON_KEY environment variables.');
    }

    this.supabase = createClient(this.supabaseUrl, this.supabaseKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
      },
      db: {
        schema: 'public'
      }
    });

    // For PostgreSQL direct connection (if needed)
    if (this.databaseUrl) {
      this.initializePostgresConnection();
    }
  }

  initializePostgresConnection() {
    const { Pool } = require('pg');
    
    this.pool = new Pool({
      connectionString: this.databaseUrl,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    this.pool.on('error', (err) => {
      console.error('Unexpected error on idle client:', err);
    });
  }

  // Supabase query method
  async query(queryText, params = []) {
    try {
      // For PostgreSQL direct queries (complex operations)
      if (this.pool && this.databaseUrl) {
        const client = await this.pool.connect();
        try {
          const result = await client.query(queryText, params);
          return {
            rows: result.rows,
            rowCount: result.rowCount,
            changes: result.rowCount // For compatibility with SQLite interface
          };
        } finally {
          client.release();
        }
      } else {
        // Fallback to Supabase client for simple queries
        throw new Error('Direct SQL queries require DATABASE_URL. Use Supabase client methods instead.');
      }
    } catch (error) {
      console.error('Database query error:', error);
      throw error;
    }
  }

  // Supabase-specific methods for common operations
  async getUsers() {
    try {
      const { data, error } = await this.supabase
        .from('users')
        .select('*');
      
      if (error) throw error;
      return { rows: data };
    } catch (error) {
      console.error('Error fetching users:', error);
      throw error;
    }
  }

  async getConsultants() {
    try {
      const { data, error } = await this.supabase
        .from('consultants')
        .select('*')
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      return { rows: data };
    } catch (error) {
      console.error('Error fetching consultants:', error);
      throw error;
    }
  }

  async getActiveConsultants() {
    try {
      const { data, error } = await this.supabase
        .from('consultants')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      return { rows: data };
    } catch (error) {
      console.error('Error fetching active consultants:', error);
      throw error;
    }
  }

  async getAssignments(limit = 100) {
    try {
      const { data, error } = await this.supabase
        .from('assignments')
        .select(`
          *,
          consultants(id, name, email),
          users(id, username, first_name, last_name)
        `)
        .order('assigned_at', { ascending: false })
        .limit(limit);
      
      if (error) throw error;
      return { rows: data };
    } catch (error) {
      console.error('Error fetching assignments:', error);
      throw error;
    }
  }

  async createAssignment(assignmentData) {
    try {
      const { data, error } = await this.supabase
        .from('assignments')
        .insert([assignmentData])
        .select()
        .single();
      
      if (error) throw error;
      return { rows: [data] };
    } catch (error) {
      console.error('Error creating assignment:', error);
      throw error;
    }
  }

  async getUserByUsername(username) {
    try {
      const { data, error } = await this.supabase
        .from('users')
        .select('*')
        .eq('username', username)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error; // PGRST116 is "not found"
      return data;
    } catch (error) {
      console.error('Error fetching user by username:', error);
      throw error;
    }
  }

  async createUser(userData) {
    try {
      const { data, error } = await this.supabase
        .from('users')
        .insert([userData])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  }

  // Initialize database tables (run once on deployment)
  async initializeTables() {
    try {
      console.log('Initializing Supabase tables...');
      
      // This would typically be done through Supabase dashboard or migrations
      // For now, we'll just check if tables exist
      const { data: tables, error } = await this.supabase
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_schema', 'public');
      
      if (error) {
        console.error('Error checking tables:', error);
        return false;
      }
      
      const tableNames = tables.map(t => t.table_name);
      const requiredTables = ['users', 'consultants', 'assignments', 'skills', 'consultant_skills'];
      const missingTables = requiredTables.filter(table => !tableNames.includes(table));
      
      if (missingTables.length > 0) {
        console.warn('Missing tables:', missingTables);
        console.log('Please create these tables in your Supabase dashboard or run the SQL migrations.');
        return false;
      }
      
      console.log('✅ All required tables exist');
      return true;
    } catch (error) {
      console.error('Error initializing tables:', error);
      return false;
    }
  }

  // Health check
  async healthCheck() {
    try {
      const { data, error } = await this.supabase
        .from('users')
        .select('count(*)')
        .limit(1);
      
      if (error) throw error;
      
      return {
        status: 'healthy',
        database: 'supabase',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Health check failed:', error);
      return {
        status: 'unhealthy',
        database: 'supabase',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  async close() {
    if (this.pool) {
      await this.pool.end();
    }
  }
}

// Export singleton instance
const database = new SupabaseDatabase();

// Export both the instance and the class
module.exports = database;
module.exports.SupabaseDatabase = SupabaseDatabase;