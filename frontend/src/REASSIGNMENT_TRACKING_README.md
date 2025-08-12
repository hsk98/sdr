# Comprehensive Reassignment Tracking System

## Overview

This document describes the comprehensive reassignment tracking system that has been implemented to monitor and analyze assignment reassignments in the SDR Assignment System. The system provides detailed tracking, analytics, and reporting capabilities for understanding assignment changes and consultant performance.

## Database Schema

### Core Tables

#### `assignment_reassignments`
The primary tracking table that records every reassignment attempt:

```sql
CREATE TABLE assignment_reassignments (
    id SERIAL PRIMARY KEY,
    assignment_id INTEGER REFERENCES assignments(id),
    sdr_id INTEGER REFERENCES users(id),
    original_consultant_id INTEGER REFERENCES consultants(id),
    new_consultant_id INTEGER REFERENCES consultants(id),
    reassignment_number INTEGER NOT NULL,
    reason VARCHAR(500),
    lead_identifier VARCHAR(255) NOT NULL,
    lead_name VARCHAR(255) NOT NULL,
    previous_skills_match_score DECIMAL(3,2),
    new_skills_match_score DECIMAL(3,2),
    skills_requirements TEXT DEFAULT '[]',
    exclusion_list TEXT DEFAULT '[]',
    reassignment_source VARCHAR(50) DEFAULT 'user_request',
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processing_time_ms INTEGER,
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    session_id VARCHAR(100),
    user_agent TEXT,
    ip_address INET
);
```

#### Enhanced `assignments` Table
Extended with reassignment tracking fields:

```sql
ALTER TABLE assignments 
ADD COLUMN reassignment_count INTEGER DEFAULT 0,
ADD COLUMN reassignment_history TEXT DEFAULT '[]',
ADD COLUMN lead_identifier VARCHAR(255),
ADD COLUMN lead_name VARCHAR(255),
ADD COLUMN original_assignment_id INTEGER REFERENCES assignments(id),
ADD COLUMN assignment_method VARCHAR(50) DEFAULT 'round_robin',
ADD COLUMN skills_data TEXT DEFAULT '{}',
ADD COLUMN reassignment_reason VARCHAR(500);
```

#### `reassignment_analytics`
Daily aggregated analytics for performance reporting:

```sql
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
    avg_reassignment_count DECIMAL(3,1),
    max_reassignments_single_lead INTEGER DEFAULT 0,
    unique_leads_reassigned INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## API Endpoints

### Reassignment Tracking API (`/api/reassignments`)

#### `POST /api/reassignments`
Create a new reassignment record:
```typescript
{
  assignmentId: string;
  originalConsultantId: string;
  newConsultantId: string;
  reason?: string;
  leadIdentifier: string;
  leadName: string;
  previousSkillsMatchScore?: number;
  newSkillsMatchScore?: number;
  skillsRequirements?: any[];
  exclusionList?: string[];
  reassignmentSource?: 'user_request' | 'system_automatic' | 'admin_override';
  sessionId?: string;
  userAgent?: string;
  ipAddress?: string;
}
```

#### `GET /api/reassignments/assignment/:id`
Get reassignment history for a specific assignment.

#### `GET /api/reassignments/analytics`
Get comprehensive analytics with filters:
- Date range filtering
- SDR filtering
- Consultant filtering
- Returns overall statistics, consultant stats, SDR performance, daily trends, and reason analysis

#### `GET /api/reassignments/trends`
Get reassignment trends over time:
- Supports daily, weekly, monthly aggregation
- Configurable time periods
- Success rates and performance metrics

#### `GET /api/reassignments/report`
Get detailed reassignment report with pagination:
- Sortable columns
- Advanced filtering
- Export-ready format

#### `POST /api/reassignments/analytics/generate`
Generate daily analytics (typically run via cron job).

## Frontend Components

### ReassignmentAnalyticsDashboard
Comprehensive analytics dashboard featuring:
- **Overall Statistics**: Total reassignments, success rates, processing times
- **Source Breakdown**: User vs system vs admin initiated reassignments  
- **Daily Trends**: Visual charts showing reassignment patterns over time
- **Top Consultants**: Most frequently reassigned-to consultants
- **SDR Performance**: Individual SDR reassignment activity
- **Reason Analysis**: Common reasons for reassignments

### ReassignmentReporting
Detailed tabular reporting interface with:
- **Advanced Filtering**: Date ranges, minimum reassignments
- **Sortable Columns**: All key metrics sortable
- **Row Selection**: Bulk operations support
- **CSV Export**: Complete data export functionality
- **Pagination**: Efficient handling of large datasets

### ReassignmentHistory
Individual assignment history component:
- **Timeline View**: Chronological reassignment history
- **Skills Improvement Tracking**: Before/after skills match scores
- **Consultant Change Visualization**: Clear from→to consultant display
- **Metadata Display**: Timestamps, processing times, reasons
- **Inline Mode**: Compact display for embedded use

### Enhanced BlindAssignment
Updated with reassignment functionality:
- **"Request Different Consultant" Button**: Positioned as primary action
- **Exclusion Logic**: Automatically excludes previously assigned consultants
- **Reassignment Counter**: Tracks and displays assignment attempts
- **Loading States**: Clear visual feedback during reassignment
- **Skills Preservation**: Maintains original skills requirements

## Key Features

### 1. Comprehensive Tracking
- **Every reassignment attempt** is logged with detailed metadata
- **Skills match scores** tracked before and after reassignment
- **Processing times** measured and stored for performance analysis
- **Exclusion lists** maintained to prevent consultant cycling
- **Session context** captured for user behavior analysis

### 2. Advanced Analytics
- **Success rates** calculated across multiple dimensions
- **Performance trends** identified over time
- **Bottlenecks identified** through processing time analysis
- **Usage patterns** analyzed by SDR and consultant
- **Skills effectiveness** measured through match score improvements

### 3. Real-time Reporting
- **Live dashboards** with up-to-date metrics
- **Interactive filtering** across all dimensions
- **Export capabilities** for external analysis
- **Pagination support** for large datasets
- **Responsive design** for mobile access

### 4. User Experience
- **Intuitive interface** for requesting reassignments
- **Clear visual feedback** during processing
- **Historical context** available for each assignment
- **Reason capture** for quality improvement
- **Error handling** with meaningful messages

## Database Functions

### Automatic History Updates
```sql
CREATE OR REPLACE FUNCTION update_assignment_reassignment_history()
RETURNS TRIGGER AS $$
BEGIN
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
```

### Daily Analytics Generation
```sql
CREATE OR REPLACE FUNCTION generate_reassignment_analytics(target_date DATE DEFAULT CURRENT_DATE - INTERVAL '1 day')
RETURNS void AS $$
BEGIN
    -- Generates comprehensive daily analytics
    -- Called by cron job or admin interface
    INSERT INTO reassignment_analytics (...)
    SELECT ... FROM assignment_reassignments ...
    -- Complex aggregation logic
END;
$$ LANGUAGE plpgsql;
```

## Performance Considerations

### Database Indexing
Optimized indexes for common query patterns:
```sql
-- Primary access patterns
CREATE INDEX idx_assignment_reassignments_assignment_id ON assignment_reassignments(assignment_id);
CREATE INDEX idx_assignment_reassignments_sdr_id ON assignment_reassignments(sdr_id);
CREATE INDEX idx_assignment_reassignments_timestamp ON assignment_reassignments(timestamp);

-- Analytics queries
CREATE INDEX idx_reassignment_analytics_date ON reassignment_analytics(date);
CREATE INDEX idx_assignments_lead_identifier_status ON assignments(lead_identifier, status);
```

### Caching Strategy
- **Daily analytics** pre-calculated via background jobs
- **Real-time data** cached with 5-minute TTL
- **Export operations** use streaming for large datasets

## Security Features

### Data Protection
- **IP address logging** for security auditing
- **Session tracking** for user behavior analysis
- **Input sanitization** for all user-provided data
- **Access control** enforced at API level

### Audit Trail
- **Complete audit log** of all reassignment activities
- **Error tracking** for failed reassignment attempts
- **Performance monitoring** for system health
- **User action attribution** for accountability

## Migration Guide

### Database Migration
1. Run `001_add_reassignment_tracking.sql` to add all tables and functions
2. Update application configuration for new API endpoints
3. Deploy updated backend code with reassignment controllers
4. Deploy updated frontend code with new components

### Rollback Support
- Rollback script provided: `001_add_reassignment_tracking_rollback.sql`
- Data preservation during rollback (reassignment data retained)
- Graceful degradation if features are disabled

## Usage Examples

### Requesting a Different Consultant
```typescript
// User clicks "Request Different Consultant" button
const handleRequestDifferent = async () => {
  // System automatically:
  // 1. Adds current consultant to exclusion list
  // 2. Runs assignment algorithm with exclusions
  // 3. Creates reassignment record
  // 4. Updates assignment with new consultant
  // 5. Displays results with reassignment counter
};
```

### Viewing Reassignment Analytics
```typescript
// Admin accesses reassignment analytics dashboard
const analytics = await fetch('/api/reassignments/analytics', {
  params: {
    startDate: '2024-01-01',
    endDate: '2024-01-31',
    sdrId: 'optional-sdr-filter'
  }
});
// Displays comprehensive metrics and visualizations
```

### Exporting Reassignment Report
```typescript
// Admin generates CSV export of all reassignments
const report = await fetch('/api/reassignments/report', {
  params: {
    startDate: '2024-01-01',
    endDate: '2024-01-31',
    sortBy: 'reassignment_time',
    sortOrder: 'DESC'
  }
});
// Exports complete reassignment data in CSV format
```

## Future Enhancements

### Planned Features
- **Machine learning** reassignment prediction
- **Automated quality scoring** based on outcome tracking
- **Integration with external CRM** systems
- **Mobile app notifications** for reassignment events
- **Advanced visualization** with D3.js charts

### Metrics to Consider Adding
- **Customer satisfaction scores** post-reassignment  
- **Meeting conversion rates** by reassignment count
- **Revenue impact** of reassignment decisions
- **Consultant workload balance** optimization
- **Seasonal reassignment patterns**

## Support and Troubleshooting

### Common Issues
1. **Performance**: Check database indexes and consider partitioning for large datasets
2. **Memory usage**: Monitor React component re-renders in analytics dashboards  
3. **Data consistency**: Verify trigger functions are executing correctly

### Monitoring
- **Database query performance** via slow query logs
- **API response times** via application monitoring
- **User interface responsiveness** via browser dev tools
- **Error rates** via centralized logging

This comprehensive reassignment tracking system provides unprecedented visibility into assignment changes and enables data-driven optimization of the consultant assignment process.