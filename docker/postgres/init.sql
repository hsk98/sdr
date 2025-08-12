-- SDR Assignment System Database Initialization
-- This script creates the database schema and inserts initial data

-- Create the database (if not exists)
SELECT 'CREATE DATABASE sdr_assignment_system'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'sdr_assignment_system')\gexec

-- Connect to the database
\c sdr_assignment_system;

-- Create extension for UUID generation (if needed)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (SDRs and Admins)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('sdr', 'admin')),
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Business consultants table
CREATE TABLE IF NOT EXISTS consultants (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    phone VARCHAR(20),
    is_active BOOLEAN DEFAULT true,
    specialty VARCHAR(100),
    hourly_rate DECIMAL(10,2),
    timezone VARCHAR(50) DEFAULT 'UTC',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Assignments table to track SDR-consultant assignments
CREATE TABLE IF NOT EXISTS assignments (
    id SERIAL PRIMARY KEY,
    sdr_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    consultant_id INTEGER REFERENCES consultants(id) ON DELETE CASCADE,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled'))
);

-- Assignment counter to track round-robin fairness
CREATE TABLE IF NOT EXISTS assignment_counts (
    consultant_id INTEGER REFERENCES consultants(id) ON DELETE CASCADE PRIMARY KEY,
    assignment_count INTEGER DEFAULT 0,
    last_assigned_at TIMESTAMP
);

-- Consultant availability management
CREATE TABLE IF NOT EXISTS consultant_availability (
    id SERIAL PRIMARY KEY,
    consultant_id INTEGER REFERENCES consultants(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sunday, 6=Saturday
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    is_available BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(consultant_id, day_of_week, start_time)
);

-- Consultant time-off periods
CREATE TABLE IF NOT EXISTS consultant_timeoff (
    id SERIAL PRIMARY KEY,
    consultant_id INTEGER REFERENCES consultants(id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    reason VARCHAR(200),
    is_approved BOOLEAN DEFAULT false,
    approved_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CHECK (end_date >= start_date)
);

-- Assignment metrics for analytics
CREATE TABLE IF NOT EXISTS assignment_metrics (
    id SERIAL PRIMARY KEY,
    assignment_id INTEGER REFERENCES assignments(id) ON DELETE CASCADE,
    response_time_minutes INTEGER,
    completion_time_minutes INTEGER,
    consultant_rating INTEGER CHECK (consultant_rating BETWEEN 1 AND 5),
    sdr_rating INTEGER CHECK (sdr_rating BETWEEN 1 AND 5),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Bulk operation logs
CREATE TABLE IF NOT EXISTS bulk_operations (
    id SERIAL PRIMARY KEY,
    operation_type VARCHAR(50) NOT NULL, -- 'create', 'update', 'delete', 'import'
    entity_type VARCHAR(50) NOT NULL, -- 'consultants', 'users', 'assignments'
    total_records INTEGER NOT NULL,
    successful_records INTEGER NOT NULL,
    failed_records INTEGER NOT NULL,
    initiated_by INTEGER REFERENCES users(id),
    file_name VARCHAR(255),
    error_log TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

-- System audit logs
CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    table_name VARCHAR(50) NOT NULL,
    record_id INTEGER NOT NULL,
    action VARCHAR(20) NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
    old_values JSONB,
    new_values JSONB,
    changed_by INTEGER REFERENCES users(id),
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Data validation rules
CREATE TABLE IF NOT EXISTS validation_rules (
    id SERIAL PRIMARY KEY,
    entity_type VARCHAR(50) NOT NULL,
    field_name VARCHAR(50) NOT NULL,
    rule_type VARCHAR(30) NOT NULL, -- 'required', 'format', 'range', 'custom'
    rule_config JSONB NOT NULL,
    error_message TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_consultants_active ON consultants(is_active);
CREATE INDEX IF NOT EXISTS idx_consultants_email ON consultants(email);
CREATE INDEX IF NOT EXISTS idx_consultants_specialty ON consultants(specialty);
CREATE INDEX IF NOT EXISTS idx_assignments_sdr_id ON assignments(sdr_id);
CREATE INDEX IF NOT EXISTS idx_assignments_consultant_id ON assignments(consultant_id);
CREATE INDEX IF NOT EXISTS idx_assignments_status ON assignments(status);
CREATE INDEX IF NOT EXISTS idx_assignments_assigned_at ON assignments(assigned_at);
CREATE INDEX IF NOT EXISTS idx_assignment_counts_count ON assignment_counts(assignment_count);
CREATE INDEX IF NOT EXISTS idx_assignment_counts_last_assigned ON assignment_counts(last_assigned_at);

-- New indexes for enhanced features
CREATE INDEX IF NOT EXISTS idx_availability_consultant_day ON consultant_availability(consultant_id, day_of_week);
CREATE INDEX IF NOT EXISTS idx_availability_time ON consultant_availability(start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_timeoff_consultant_dates ON consultant_timeoff(consultant_id, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_timeoff_approved ON consultant_timeoff(is_approved);
CREATE INDEX IF NOT EXISTS idx_metrics_assignment ON assignment_metrics(assignment_id);
CREATE INDEX IF NOT EXISTS idx_metrics_response_time ON assignment_metrics(response_time_minutes);
CREATE INDEX IF NOT EXISTS idx_metrics_completion_time ON assignment_metrics(completion_time_minutes);
CREATE INDEX IF NOT EXISTS idx_bulk_ops_type ON bulk_operations(operation_type, entity_type);
CREATE INDEX IF NOT EXISTS idx_bulk_ops_user ON bulk_operations(initiated_by);
CREATE INDEX IF NOT EXISTS idx_audit_table_record ON audit_logs(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(changed_by);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_validation_entity ON validation_rules(entity_type, field_name);
CREATE INDEX IF NOT EXISTS idx_validation_active ON validation_rules(is_active);

-- Insert default admin user (password: admin123)
-- Password hash for 'admin123' using bcrypt with salt rounds 10
INSERT INTO users (username, email, password_hash, role, first_name, last_name) 
VALUES ('admin', 'admin@company.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin', 'Admin', 'User')
ON CONFLICT (username) DO NOTHING;

-- Insert sample SDR users
INSERT INTO users (username, email, password_hash, role, first_name, last_name) VALUES 
('john.doe', 'john.doe@company.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'sdr', 'John', 'Doe'),
('jane.smith', 'jane.smith@company.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'sdr', 'Jane', 'Smith'),
('mike.johnson', 'mike.johnson@company.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'sdr', 'Mike', 'Johnson')
ON CONFLICT (username) DO NOTHING;

-- Insert sample consultants
INSERT INTO consultants (name, email, phone, specialty, hourly_rate, timezone) VALUES 
('John Smith', 'john.smith@consulting.com', '+1-555-0101', 'Business Strategy', 150.00, 'America/New_York'),
('Sarah Johnson', 'sarah.johnson@consulting.com', '+1-555-0102', 'Marketing', 120.00, 'America/Los_Angeles'),
('Mike Davis', 'mike.davis@consulting.com', '+1-555-0103', 'Financial Planning', 175.00, 'America/Chicago'),
('Emily Brown', 'emily.brown@consulting.com', '+1-555-0104', 'Operations', 140.00, 'America/New_York'),
('David Wilson', 'david.wilson@consulting.com', '+1-555-0105', 'Technology', 160.00, 'America/Denver'),
('Lisa Anderson', 'lisa.anderson@consulting.com', '+1-555-0106', 'HR & Recruiting', 130.00, 'America/Los_Angeles'),
('Tom Martinez', 'tom.martinez@consulting.com', '+1-555-0107', 'Sales', 145.00, 'America/Phoenix'),
('Anna Taylor', 'anna.taylor@consulting.com', '+1-555-0108', 'Legal', 200.00, 'America/New_York')
ON CONFLICT (email) DO NOTHING;

-- Initialize assignment counts for all consultants
INSERT INTO assignment_counts (consultant_id, assignment_count) 
SELECT id, 0 FROM consultants 
ON CONFLICT (consultant_id) DO NOTHING;

-- Insert sample availability schedules (Monday-Friday, 9 AM - 5 PM for all consultants)
INSERT INTO consultant_availability (consultant_id, day_of_week, start_time, end_time) 
SELECT 
    c.id,
    day_week.day,
    '09:00:00'::TIME,
    '17:00:00'::TIME
FROM consultants c
CROSS JOIN (VALUES (1), (2), (3), (4), (5)) AS day_week(day)
ON CONFLICT (consultant_id, day_of_week, start_time) DO NOTHING;

-- Insert sample validation rules
INSERT INTO validation_rules (entity_type, field_name, rule_type, rule_config, error_message) VALUES
('consultants', 'name', 'required', '{}', 'Consultant name is required'),
('consultants', 'email', 'required', '{}', 'Consultant email is required'),
('consultants', 'email', 'format', '{"pattern": "^[\\w\\.-]+@[\\w\\.-]+\\.[a-zA-Z]{2,}$"}', 'Invalid email format'),
('consultants', 'phone', 'format', '{"pattern": "^\\+?[1-9]\\d{1,14}$"}', 'Invalid phone number format'),
('consultants', 'hourly_rate', 'range', '{"min": 0, "max": 1000}', 'Hourly rate must be between $0 and $1000'),
('users', 'username', 'required', '{}', 'Username is required'),
('users', 'email', 'required', '{}', 'Email is required'),
('users', 'email', 'format', '{"pattern": "^[\\w\\.-]+@[\\w\\.-]+\\.[a-zA-Z]{2,}$"}', 'Invalid email format'),
('users', 'password', 'required', '{}', 'Password is required'),
('users', 'first_name', 'required', '{}', 'First name is required'),
('users', 'last_name', 'required', '{}', 'Last name is required')
ON CONFLICT DO NOTHING;

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for automatic timestamp updates
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_consultants_updated_at ON consultants;
CREATE TRIGGER update_consultants_updated_at 
    BEFORE UPDATE ON consultants 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_availability_updated_at ON consultant_availability;
CREATE TRIGGER update_availability_updated_at 
    BEFORE UPDATE ON consultant_availability 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_timeoff_updated_at ON consultant_timeoff;
CREATE TRIGGER update_timeoff_updated_at 
    BEFORE UPDATE ON consultant_timeoff 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_validation_updated_at ON validation_rules;
CREATE TRIGGER update_validation_updated_at 
    BEFORE UPDATE ON validation_rules 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to check consultant availability
CREATE OR REPLACE FUNCTION check_consultant_availability(
    p_consultant_id INTEGER,
    p_check_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) RETURNS BOOLEAN AS $$
DECLARE
    day_of_week INTEGER;
    time_of_day TIME;
    is_available BOOLEAN := false;
    is_on_timeoff BOOLEAN := false;
BEGIN
    -- Extract day of week (0=Sunday) and time
    day_of_week := EXTRACT(DOW FROM p_check_time);
    time_of_day := p_check_time::TIME;
    
    -- Check if consultant is on time-off
    SELECT EXISTS(
        SELECT 1 FROM consultant_timeoff 
        WHERE consultant_id = p_consultant_id 
        AND p_check_time::DATE BETWEEN start_date AND end_date
        AND is_approved = true
    ) INTO is_on_timeoff;
    
    IF is_on_timeoff THEN
        RETURN false;
    END IF;
    
    -- Check regular availability schedule
    SELECT EXISTS(
        SELECT 1 FROM consultant_availability 
        WHERE consultant_id = p_consultant_id 
        AND day_of_week = day_of_week
        AND time_of_day BETWEEN start_time AND end_time
        AND is_available = true
    ) INTO is_available;
    
    RETURN is_available;
END;
$$ LANGUAGE plpgsql;

-- Function to get available consultants
CREATE OR REPLACE FUNCTION get_available_consultants(
    p_check_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) RETURNS TABLE(
    consultant_id INTEGER,
    name VARCHAR(100),
    email VARCHAR(100),
    specialty VARCHAR(100),
    assignment_count INTEGER,
    last_assigned_at TIMESTAMP
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id,
        c.name,
        c.email,
        c.specialty,
        COALESCE(ac.assignment_count, 0),
        ac.last_assigned_at
    FROM consultants c
    LEFT JOIN assignment_counts ac ON c.id = ac.consultant_id
    WHERE c.is_active = true
    AND check_consultant_availability(c.id, p_check_time) = true
    ORDER BY 
        COALESCE(ac.assignment_count, 0) ASC,
        ac.last_assigned_at ASC NULLS FIRST;
END;
$$ LANGUAGE plpgsql;

-- Function for audit logging
CREATE OR REPLACE FUNCTION log_audit_changes() RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        INSERT INTO audit_logs (table_name, record_id, action, old_values, changed_by)
        VALUES (TG_TABLE_NAME, OLD.id, TG_OP, row_to_json(OLD), 
                COALESCE(current_setting('app.current_user_id', true)::INTEGER, NULL));
        RETURN OLD;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO audit_logs (table_name, record_id, action, old_values, new_values, changed_by)
        VALUES (TG_TABLE_NAME, NEW.id, TG_OP, row_to_json(OLD), row_to_json(NEW),
                COALESCE(current_setting('app.current_user_id', true)::INTEGER, NULL));
        RETURN NEW;
    ELSIF TG_OP = 'INSERT' THEN
        INSERT INTO audit_logs (table_name, record_id, action, new_values, changed_by)
        VALUES (TG_TABLE_NAME, NEW.id, TG_OP, row_to_json(NEW),
                COALESCE(current_setting('app.current_user_id', true)::INTEGER, NULL));
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create audit triggers
DROP TRIGGER IF EXISTS audit_users_changes ON users;
CREATE TRIGGER audit_users_changes
    AFTER INSERT OR UPDATE OR DELETE ON users
    FOR EACH ROW EXECUTE FUNCTION log_audit_changes();

DROP TRIGGER IF EXISTS audit_consultants_changes ON consultants;
CREATE TRIGGER audit_consultants_changes
    AFTER INSERT OR UPDATE OR DELETE ON consultants
    FOR EACH ROW EXECUTE FUNCTION log_audit_changes();

DROP TRIGGER IF EXISTS audit_assignments_changes ON assignments;
CREATE TRIGGER audit_assignments_changes
    AFTER INSERT OR UPDATE OR DELETE ON assignments
    FOR EACH ROW EXECUTE FUNCTION log_audit_changes();

-- Grant necessary permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres;

-- Display initialization summary
DO $$
DECLARE
    user_count INTEGER;
    consultant_count INTEGER;
    admin_count INTEGER;
    sdr_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO user_count FROM users;
    SELECT COUNT(*) INTO consultant_count FROM consultants;
    SELECT COUNT(*) INTO admin_count FROM users WHERE role = 'admin';
    SELECT COUNT(*) INTO sdr_count FROM users WHERE role = 'sdr';
    
    RAISE NOTICE 'Database initialization complete!';
    RAISE NOTICE 'Users created: % (% admins, % SDRs)', user_count, admin_count, sdr_count;
    RAISE NOTICE 'Consultants created: %', consultant_count;
    RAISE NOTICE 'Default credentials - Username: admin, Password: admin123';
END $$;