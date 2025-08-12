-- Migration: Add Reassignment Tracking System
-- Created: $(date)
-- Description: Add comprehensive tracking for assignment reassignments

-- Add reassignment fields to assignments table
ALTER TABLE assignments 
ADD COLUMN reassignment_count INTEGER DEFAULT 0,
ADD COLUMN reassignment_history TEXT DEFAULT '[]',
ADD COLUMN lead_identifier VARCHAR(255),
ADD COLUMN lead_name VARCHAR(255),
ADD COLUMN original_assignment_id INTEGER REFERENCES assignments(id),
ADD COLUMN assignment_method VARCHAR(50) DEFAULT 'round_robin' CHECK (assignment_method IN ('round_robin', 'skills_based', 'vip', 'manual')),
ADD COLUMN skills_data TEXT DEFAULT '{}', -- JSON for skills requirements and matches
ADD COLUMN reassignment_reason VARCHAR(500);

-- Create comprehensive reassignment tracking table
CREATE TABLE assignment_reassignments (
    id SERIAL PRIMARY KEY,
    assignment_id INTEGER REFERENCES assignments(id) ON DELETE CASCADE,
    sdr_id INTEGER REFERENCES users(id),
    original_consultant_id INTEGER REFERENCES consultants(id),
    new_consultant_id INTEGER REFERENCES consultants(id),
    reassignment_number INTEGER NOT NULL,
    reason VARCHAR(500),
    lead_identifier VARCHAR(255) NOT NULL,
    lead_name VARCHAR(255) NOT NULL,
    previous_skills_match_score DECIMAL(3,2),
    new_skills_match_score DECIMAL(3,2),
    skills_requirements TEXT DEFAULT '[]', -- JSON array of skill requirements
    exclusion_list TEXT DEFAULT '[]', -- JSON array of excluded consultant IDs
    reassignment_source VARCHAR(50) DEFAULT 'user_request' CHECK (reassignment_source IN ('user_request', 'system_automatic', 'admin_override')),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processing_time_ms INTEGER, -- Track how long reassignment took
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    
    -- Metadata for analytics
    session_id VARCHAR(100),
    user_agent TEXT,
    ip_address INET
);

-- Create reassignment analytics summary table for faster reporting
CREATE TABLE reassignment_analytics (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    sdr_id INTEGER REFERENCES users(id),
    consultant_id INTEGER REFERENCES consultants(id),
    total_reassignments INTEGER DEFAULT 0,
    successful_reassignments INTEGER DEFAULT 0,
    failed_reassignments INTEGER DEFAULT 0,
    avg_processing_time_ms DECIMAL(10,2),
    most_common_reason VARCHAR(500),
    skills_based_reassignments INTEGER DEFAULT 0,
    
    -- Aggregate metrics
    avg_reassignment_count DECIMAL(3,1), -- Average number of reassignments per lead
    max_reassignments_single_lead INTEGER DEFAULT 0,
    unique_leads_reassigned INTEGER DEFAULT 0,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(date, sdr_id, consultant_id)
);

-- Create indexes for optimal performance
CREATE INDEX idx_assignment_reassignments_assignment_id ON assignment_reassignments(assignment_id);
CREATE INDEX idx_assignment_reassignments_sdr_id ON assignment_reassignments(sdr_id);
CREATE INDEX idx_assignment_reassignments_original_consultant ON assignment_reassignments(original_consultant_id);
CREATE INDEX idx_assignment_reassignments_new_consultant ON assignment_reassignments(new_consultant_id);
CREATE INDEX idx_assignment_reassignments_lead_identifier ON assignment_reassignments(lead_identifier);
CREATE INDEX idx_assignment_reassignments_timestamp ON assignment_reassignments(timestamp);
CREATE INDEX idx_assignment_reassignments_reassignment_number ON assignment_reassignments(reassignment_number);
CREATE INDEX idx_assignment_reassignments_success ON assignment_reassignments(success);

-- Indexes for analytics table
CREATE INDEX idx_reassignment_analytics_date ON reassignment_analytics(date);
CREATE INDEX idx_reassignment_analytics_sdr_id ON reassignment_analytics(sdr_id);
CREATE INDEX idx_reassignment_analytics_consultant_id ON reassignment_analytics(consultant_id);

-- Create composite indexes for common queries
CREATE INDEX idx_assignments_lead_identifier_status ON assignments(lead_identifier, status);
CREATE INDEX idx_assignments_reassignment_count ON assignments(reassignment_count);
CREATE INDEX idx_assignments_assignment_method ON assignments(assignment_method);

-- Add trigger to automatically update reassignment_history JSON when reassignments are created
CREATE OR REPLACE FUNCTION update_assignment_reassignment_history()
RETURNS TRIGGER AS $$
BEGIN
    -- Update the assignments table with new reassignment count and history
    UPDATE assignments 
    SET 
        reassignment_count = reassignment_count + 1,
        reassignment_history = jsonb_set(
            COALESCE(reassignment_history::jsonb, '[]'::jsonb),
            '{' || jsonb_array_length(COALESCE(reassignment_history::jsonb, '[]'::jsonb)) || '}',
            jsonb_build_object(
                'reassignment_number', NEW.reassignment_number,
                'from_consultant_id', NEW.original_consultant_id,
                'to_consultant_id', NEW.new_consultant_id,
                'timestamp', NEW.timestamp,
                'reason', NEW.reason,
                'skills_match_improvement', 
                CASE 
                    WHEN NEW.new_skills_match_score IS NOT NULL AND NEW.previous_skills_match_score IS NOT NULL 
                    THEN NEW.new_skills_match_score - NEW.previous_skills_match_score
                    ELSE null
                END
            )::jsonb
        )::text
    WHERE id = NEW.assignment_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER trigger_update_reassignment_history
    AFTER INSERT ON assignment_reassignments
    FOR EACH ROW
    EXECUTE FUNCTION update_assignment_reassignment_history();

-- Function to automatically generate daily reassignment analytics
CREATE OR REPLACE FUNCTION generate_reassignment_analytics(target_date DATE DEFAULT CURRENT_DATE - INTERVAL '1 day')
RETURNS void AS $$
BEGIN
    -- Insert or update daily analytics
    INSERT INTO reassignment_analytics (
        date, sdr_id, consultant_id, 
        total_reassignments, successful_reassignments, failed_reassignments,
        avg_processing_time_ms, most_common_reason, skills_based_reassignments,
        avg_reassignment_count, max_reassignments_single_lead, unique_leads_reassigned
    )
    SELECT 
        target_date,
        ar.sdr_id,
        ar.new_consultant_id,
        COUNT(*) as total_reassignments,
        COUNT(*) FILTER (WHERE ar.success = true) as successful_reassignments,
        COUNT(*) FILTER (WHERE ar.success = false) as failed_reassignments,
        AVG(ar.processing_time_ms) as avg_processing_time_ms,
        MODE() WITHIN GROUP (ORDER BY ar.reason) as most_common_reason,
        COUNT(*) FILTER (WHERE ar.skills_requirements != '[]') as skills_based_reassignments,
        AVG(ar.reassignment_number) as avg_reassignment_count,
        MAX(ar.reassignment_number) as max_reassignments_single_lead,
        COUNT(DISTINCT ar.lead_identifier) as unique_leads_reassigned
    FROM assignment_reassignments ar
    WHERE DATE(ar.timestamp) = target_date
    GROUP BY ar.sdr_id, ar.new_consultant_id
    ON CONFLICT (date, sdr_id, consultant_id) 
    DO UPDATE SET
        total_reassignments = EXCLUDED.total_reassignments,
        successful_reassignments = EXCLUDED.successful_reassignments,
        failed_reassignments = EXCLUDED.failed_reassignments,
        avg_processing_time_ms = EXCLUDED.avg_processing_time_ms,
        most_common_reason = EXCLUDED.most_common_reason,
        skills_based_reassignments = EXCLUDED.skills_based_reassignments,
        avg_reassignment_count = EXCLUDED.avg_reassignment_count,
        max_reassignments_single_lead = EXCLUDED.max_reassignments_single_lead,
        unique_leads_reassigned = EXCLUDED.unique_leads_reassigned,
        updated_at = CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

-- Create view for comprehensive reassignment reporting
CREATE VIEW reassignment_report_view AS
SELECT 
    a.id as assignment_id,
    a.lead_identifier,
    a.lead_name,
    a.reassignment_count,
    a.assignment_method,
    u.username as sdr_username,
    u.first_name || ' ' || u.last_name as sdr_name,
    c.name as current_consultant_name,
    c.email as current_consultant_email,
    a.assigned_at as initial_assignment_time,
    a.status as assignment_status,
    
    -- Reassignment details
    ar.reassignment_number,
    ar.timestamp as reassignment_time,
    ar.reason as reassignment_reason,
    ar.reassignment_source,
    ar.processing_time_ms,
    
    -- Skills information
    ar.previous_skills_match_score,
    ar.new_skills_match_score,
    (ar.new_skills_match_score - ar.previous_skills_match_score) as skills_improvement,
    
    -- Consultant information
    oc.name as original_consultant_name,
    nc.name as new_consultant_name,
    
    -- Success metrics
    ar.success as reassignment_successful,
    ar.error_message
    
FROM assignments a
JOIN users u ON a.sdr_id = u.id
JOIN consultants c ON a.consultant_id = c.id
LEFT JOIN assignment_reassignments ar ON a.id = ar.assignment_id
LEFT JOIN consultants oc ON ar.original_consultant_id = oc.id
LEFT JOIN consultants nc ON ar.new_consultant_id = nc.id
WHERE a.reassignment_count > 0
ORDER BY a.assigned_at DESC, ar.reassignment_number ASC;

-- Add comments for documentation
COMMENT ON TABLE assignment_reassignments IS 'Comprehensive tracking of all assignment reassignments with detailed metadata';
COMMENT ON TABLE reassignment_analytics IS 'Daily aggregated analytics for reassignment patterns and performance metrics';
COMMENT ON VIEW reassignment_report_view IS 'Comprehensive view for reassignment reporting and analysis';

-- Add constraints for data integrity
ALTER TABLE assignment_reassignments 
ADD CONSTRAINT chk_reassignment_number_positive CHECK (reassignment_number > 0);

ALTER TABLE assignment_reassignments
ADD CONSTRAINT chk_different_consultants CHECK (original_consultant_id != new_consultant_id);

ALTER TABLE reassignment_analytics
ADD CONSTRAINT chk_failed_not_greater_than_total CHECK (failed_reassignments <= total_reassignments);