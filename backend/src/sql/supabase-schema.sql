-- SDR Assignment System - Supabase Schema
-- Run this SQL in your Supabase SQL editor to set up the database

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (SDRs and Admins)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('sdr', 'admin', 'manager')),
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    mfa_secret TEXT,
    mfa_enabled BOOLEAN DEFAULT false,
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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Skills table
CREATE TABLE IF NOT EXISTS skills (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    category VARCHAR(50),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Consultant skills junction table
CREATE TABLE IF NOT EXISTS consultant_skills (
    id SERIAL PRIMARY KEY,
    consultant_id INTEGER REFERENCES consultants(id) ON DELETE CASCADE,
    skill_id VARCHAR(50) REFERENCES skills(id) ON DELETE CASCADE,
    proficiency_level INTEGER DEFAULT 1 CHECK (proficiency_level >= 1 AND proficiency_level <= 5),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(consultant_id, skill_id)
);

-- Leads table to track sales leads
CREATE TABLE IF NOT EXISTS leads (
    id SERIAL PRIMARY KEY,
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
    required_skills JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Assignments table to track lead-consultant assignments
CREATE TABLE IF NOT EXISTS assignments (
    id SERIAL PRIMARY KEY,
    lead_id INTEGER REFERENCES leads(id),
    lead_identifier VARCHAR(100),
    lead_name VARCHAR(200),
    consultant_id INTEGER REFERENCES consultants(id),
    sdr_id INTEGER REFERENCES users(id),
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
    is_manual BOOLEAN DEFAULT false,
    manual_reason TEXT,
    assignment_method VARCHAR(50) DEFAULT 'round_robin',
    required_skills JSONB DEFAULT '[]'::jsonb,
    skills_match_score DECIMAL(5,2),
    reassignment_count INTEGER DEFAULT 0,
    created_by INTEGER REFERENCES users(id),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Assignment counter to track round-robin fairness
CREATE TABLE IF NOT EXISTS assignment_counts (
    consultant_id INTEGER REFERENCES consultants(id) PRIMARY KEY,
    assignment_count INTEGER DEFAULT 0,
    last_assigned_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Assignment reassignments tracking
CREATE TABLE IF NOT EXISTS assignment_reassignments (
    id SERIAL PRIMARY KEY,
    assignment_id INTEGER REFERENCES assignments(id) ON DELETE CASCADE,
    sdr_id INTEGER REFERENCES users(id),
    original_consultant_id INTEGER REFERENCES consultants(id),
    new_consultant_id INTEGER REFERENCES consultants(id),
    reassignment_number INTEGER NOT NULL DEFAULT 1,
    reason TEXT,
    lead_identifier VARCHAR(100),
    lead_name VARCHAR(200),
    previous_skills_match_score DECIMAL(5,2),
    new_skills_match_score DECIMAL(5,2),
    skills_requirements JSONB DEFAULT '[]'::jsonb,
    exclusion_list JSONB DEFAULT '[]'::jsonb,
    reassignment_source VARCHAR(50) DEFAULT 'user_request',
    processing_time_ms INTEGER,
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    session_id VARCHAR(100),
    user_agent TEXT,
    ip_address INET,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Audit logs table
CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMP NOT NULL,
    level VARCHAR(10) NOT NULL,
    action VARCHAR(100) NOT NULL,
    details JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_consultants_active ON consultants(is_active);
CREATE INDEX IF NOT EXISTS idx_consultant_skills_consultant ON consultant_skills(consultant_id);
CREATE INDEX IF NOT EXISTS idx_consultant_skills_skill ON consultant_skills(skill_id);
CREATE INDEX IF NOT EXISTS idx_assignments_consultant ON assignments(consultant_id);
CREATE INDEX IF NOT EXISTS idx_assignments_sdr ON assignments(sdr_id);
CREATE INDEX IF NOT EXISTS idx_assignments_status ON assignments(status);
CREATE INDEX IF NOT EXISTS idx_assignments_assigned_at ON assignments(assigned_at);
CREATE INDEX IF NOT EXISTS idx_leads_sdr ON leads(sdr_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_reassignments_assignment ON assignment_reassignments(assignment_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);

-- Insert default admin user (password: admin123)
-- Note: In production, change this password immediately
INSERT INTO users (username, email, password_hash, role, first_name, last_name) 
VALUES (
    'admin', 
    'admin@company.com', 
    '$2a$10$8K1p/a9GOwGhWUvgHx7.hOjFH.9aJ8H4xHUE5WJZ5wDdNjY5.6bKa', -- bcrypt hash of 'admin123'
    'admin', 
    'Admin', 
    'User'
) ON CONFLICT (username) DO NOTHING;

-- Insert sample consultants
INSERT INTO consultants (name, email, phone) VALUES
    ('John Smith', 'john.smith@consulting.com', '+1-555-0101'),
    ('Sarah Johnson', 'sarah.johnson@consulting.com', '+1-555-0102'),
    ('Mike Davis', 'mike.davis@consulting.com', '+1-555-0103'),
    ('Emily Brown', 'emily.brown@consulting.com', '+1-555-0104'),
    ('David Wilson', 'david.wilson@consulting.com', '+1-555-0105')
ON CONFLICT (email) DO NOTHING;

-- Insert sample skills
INSERT INTO skills (id, name, description, category) VALUES
    ('lang_spanish', 'Spanish Language', 'Fluent Spanish speaker', 'language'),
    ('lang_french', 'French Language', 'Fluent French speaker', 'language'),
    ('lang_german', 'German Language', 'Fluent German speaker', 'language'),
    ('lang_arabic', 'Arabic Language', 'Fluent Arabic speaker', 'language'),
    ('tech_saas', 'SaaS Technology', 'Software as a Service expertise', 'technology'),
    ('tech_fintech', 'FinTech', 'Financial technology expertise', 'technology'),
    ('tech_healthcare', 'HealthTech', 'Healthcare technology expertise', 'technology'),
    ('industry_finance', 'Finance Industry', 'Financial services expertise', 'industry'),
    ('industry_healthcare', 'Healthcare Industry', 'Healthcare industry expertise', 'industry'),
    ('industry_manufacturing', 'Manufacturing Industry', 'Manufacturing sector expertise', 'industry'),
    ('real_estate_expert', 'Real Estate Expert', 'Real estate industry specialization', 'industry'),
    ('enterprise_sales', 'Enterprise Sales', 'Large enterprise sales experience', 'sales'),
    ('smb_sales', 'SMB Sales', 'Small and medium business sales', 'sales'),
    ('vip_handling', 'VIP Client Handling', 'High-value client management', 'special')
ON CONFLICT (id) DO NOTHING;

-- Assign some skills to consultants
INSERT INTO consultant_skills (consultant_id, skill_id, proficiency_level) VALUES
    (1, 'lang_spanish', 5),
    (1, 'tech_saas', 4),
    (2, 'lang_french', 5),
    (2, 'industry_finance', 4),
    (3, 'tech_fintech', 5),
    (3, 'enterprise_sales', 4),
    (4, 'lang_arabic', 5),
    (4, 'industry_healthcare', 4),
    (5, 'real_estate_expert', 5),
    (5, 'vip_handling', 4)
ON CONFLICT (consultant_id, skill_id) DO NOTHING;

-- Initialize assignment counts
INSERT INTO assignment_counts (consultant_id, assignment_count)
SELECT id, 0 FROM consultants
ON CONFLICT (consultant_id) DO NOTHING;

-- Enable Row Level Security (RLS) for security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE consultants ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (basic - adjust as needed)
CREATE POLICY "Users can view their own data" ON users
    FOR SELECT USING (id = auth.uid()::integer OR EXISTS (
        SELECT 1 FROM users WHERE id = auth.uid()::integer AND role = 'admin'
    ));

CREATE POLICY "Admins can manage all data" ON consultants
    FOR ALL USING (EXISTS (
        SELECT 1 FROM users WHERE id = auth.uid()::integer AND role IN ('admin', 'manager')
    ));

CREATE POLICY "Users can view assignments" ON assignments
    FOR SELECT USING (
        sdr_id = auth.uid()::integer OR 
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid()::integer AND role IN ('admin', 'manager'))
    );

-- Create functions for automatic timestamp updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_consultants_updated_at BEFORE UPDATE ON consultants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON leads
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_assignments_updated_at BEFORE UPDATE ON assignments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_assignment_counts_updated_at BEFORE UPDATE ON assignment_counts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Success message
SELECT 'SDR Assignment System database schema created successfully!' as message;