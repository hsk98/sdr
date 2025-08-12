-- SDR Assignment System Database Schema

-- Create database (run this manually first)
-- CREATE DATABASE sdr_assignment_system;

-- Users table (SDRs and Admins)
CREATE TABLE users (
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
CREATE TABLE consultants (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    phone VARCHAR(20),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Assignments table to track SDR-consultant assignments
CREATE TABLE assignments (
    id SERIAL PRIMARY KEY,
    sdr_id INTEGER REFERENCES users(id),
    consultant_id INTEGER REFERENCES consultants(id),
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled'))
);

-- Assignment counter to track round-robin fairness
CREATE TABLE assignment_counts (
    consultant_id INTEGER REFERENCES consultants(id) PRIMARY KEY,
    assignment_count INTEGER DEFAULT 0,
    last_assigned_at TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_consultants_active ON consultants(is_active);
CREATE INDEX idx_assignments_sdr_id ON assignments(sdr_id);
CREATE INDEX idx_assignments_consultant_id ON assignments(consultant_id);
CREATE INDEX idx_assignments_status ON assignments(status);
CREATE INDEX idx_assignment_counts_count ON assignment_counts(assignment_count);

-- Insert default admin user (password: admin123)
INSERT INTO users (username, email, password_hash, role, first_name, last_name) 
VALUES ('admin', 'admin@company.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin', 'Admin', 'User');

-- Insert sample consultants
INSERT INTO consultants (name, email, phone) VALUES 
('John Smith', 'john.smith@consulting.com', '+1-555-0101'),
('Sarah Johnson', 'sarah.johnson@consulting.com', '+1-555-0102'),
('Mike Davis', 'mike.davis@consulting.com', '+1-555-0103'),
('Emily Brown', 'emily.brown@consulting.com', '+1-555-0104'),
('David Wilson', 'david.wilson@consulting.com', '+1-555-0105');

-- Initialize assignment counts for all consultants
INSERT INTO assignment_counts (consultant_id, assignment_count) 
SELECT id, 0 FROM consultants;