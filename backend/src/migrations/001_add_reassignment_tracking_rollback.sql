-- Rollback Migration: Remove Reassignment Tracking System
-- Created: $(date)
-- Description: Remove all reassignment tracking tables, functions, and columns

-- Drop trigger and function
DROP TRIGGER IF EXISTS trigger_update_reassignment_history ON assignment_reassignments;
DROP FUNCTION IF EXISTS update_assignment_reassignment_history();
DROP FUNCTION IF EXISTS generate_reassignment_analytics(DATE);

-- Drop view
DROP VIEW IF EXISTS reassignment_report_view;

-- Drop tables (in reverse order of creation)
DROP TABLE IF EXISTS reassignment_analytics;
DROP TABLE IF EXISTS assignment_reassignments;

-- Remove columns from assignments table
ALTER TABLE assignments 
DROP COLUMN IF EXISTS reassignment_count,
DROP COLUMN IF EXISTS reassignment_history,
DROP COLUMN IF EXISTS lead_identifier,
DROP COLUMN IF EXISTS lead_name,
DROP COLUMN IF EXISTS original_assignment_id,
DROP COLUMN IF EXISTS assignment_method,
DROP COLUMN IF EXISTS skills_data,
DROP COLUMN IF EXISTS reassignment_reason;

-- Drop indexes that were created for the new columns
DROP INDEX IF EXISTS idx_assignments_lead_identifier_status;
DROP INDEX IF EXISTS idx_assignments_reassignment_count;
DROP INDEX IF EXISTS idx_assignments_assignment_method;