# Enhanced Round-Robin Assignment System

## Overview

The SDR Assignment System now features an advanced round-robin algorithm that ensures fair distribution of consultants to SDRs while handling edge cases and providing comprehensive audit trails.

## Key Features

### 1. Advanced Fairness Algorithm
- **Multi-criteria scoring** based on assignment counts, recency, and workload
- **Dynamic balancing** that adapts to consultant availability changes
- **Bias prevention** through weighted fairness scores

### 2. Edge Case Handling
- **No available consultants**: Graceful error handling with specific error codes
- **All consultants busy**: Fallback to most available consultant
- **Consultant availability changes**: Real-time adaptation to status changes
- **Duplicate assignments**: Prevention of same consultant to same SDR within 24h

### 3. Comprehensive Audit Trail
- **All assignment events** logged with timestamps and metadata
- **Consultant availability changes** tracked with change history
- **System events** logged for troubleshooting and compliance
- **User actions** audited for accountability

## API Endpoints

### Assignment Endpoints

#### Get Next Assignment (Enhanced)
```
POST /api/assignments/next
Authorization: Bearer <sdr_token>
```

**Response:**
```json
{
  "message": "Assignment created successfully",
  "assignment": {
    "id": 123,
    "sdr_id": 45,
    "consultant_id": 67,
    "assigned_at": "2023-08-02T10:30:00Z",
    "status": "active"
  },
  "consultant": {
    "id": 67,
    "name": "John Smith",
    "email": "john.smith@consulting.com",
    "phone": "+1-555-0101"
  },
  "metadata": {
    "assignment_method": "advanced_round_robin",
    "fairness_score": -2.5,
    "assignment_count": 3,
    "last_assigned_at": "2023-08-01T14:20:00Z"
  }
}
```

### Analytics Endpoints

#### Assignment Analytics
```
GET /api/assignments/analytics?timeframe=7d
Authorization: Bearer <admin_token>
```

**Parameters:**
- `timeframe`: `1d`, `7d`, `30d`, `90d`

#### Fairness Report
```
GET /api/assignments/fairness
Authorization: Bearer <admin_token>
```

**Response:**
```json
{
  "fairness_score": 87.5,
  "consultants": [
    {
      "name": "John Smith",
      "assignment_count": 5,
      "deviation_from_expected": -0.2,
      "last_assigned_at": "2023-08-02T09:15:00Z"
    }
  ],
  "analysis": {
    "total_consultants": 5,
    "total_assignments": 25,
    "expected_per_consultant": 5.0,
    "standard_deviation": 1.25,
    "fairness_score": 87.5
  }
}
```

#### Audit Logs
```
GET /api/assignments/audit-logs?action=ASSIGNMENT_CREATED&limit=50
Authorization: Bearer <admin_token>
```

**Parameters:**
- `action`: Filter by specific action type
- `sdr_id`: Filter by SDR
- `consultant_id`: Filter by consultant
- `from_date`: Start date (ISO format)
- `to_date`: End date (ISO format)
- `limit`: Number of results (default: 100)

#### Force Rebalance
```
POST /api/assignments/rebalance
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "reason": "Manual rebalancing after consultant changes"
}
```

## Fairness Algorithm Details

### Scoring Mechanism

Each consultant receives a **fairness score** where lower scores indicate higher priority for assignment:

```
Base Score = (consultant_assignments - average_assignments)
+ (assignments_last_24h * 2)          // Recent assignment penalty
+ (active_assignments * 1.5)          // Active workload penalty
- (hours_since_last_assignment / 24)  // Time bonus (max 2 points)
- (never_assigned_bonus * 10)         // New consultant bonus
```

### Selection Process

1. **Calculate fairness scores** for all active consultants
2. **Sort by fairness score** (ascending)
3. **Apply business rules**:
   - Max 3 active assignments per consultant
   - No same consultant to same SDR within 24h
   - Prefer consultants not assigned in last 4 hours
4. **Select the most fair consultant**

### Business Rules

#### Availability Rules
- Consultant must be marked as `is_active = true`
- Consultant should have fewer than 3 active assignments
- Avoid assigning same consultant to same SDR within 24 hours

#### Fairness Rules
- New consultants get priority (never assigned bonus)
- Recent assignments reduce priority
- Time since last assignment increases priority
- Active workload reduces priority

## Edge Cases Handled

### 1. No Active Consultants
```json
{
  "error": "No active consultants available for assignment",
  "code": "NO_ACTIVE_CONSULTANTS"
}
```
**Logged as:** `ASSIGNMENT_FAILED` with reason `NO_ACTIVE_CONSULTANTS`

### 2. No Suitable Consultant Found
When all consultants fail business rules:
```json
{
  "error": "No suitable consultant found based on current assignment criteria",
  "code": "NO_SUITABLE_CONSULTANT"
}
```
**Fallback:** Returns most fair consultant anyway (emergency fallback)

### 3. Consultant Availability Changes
- Real-time adaptation when consultants are activated/deactivated
- Immediate recalculation of fairness scores
- Audit logging of availability changes

### 4. System Errors
All errors are logged with full context:
```json
{
  "error": "Internal server error during assignment",
  "code": "ASSIGNMENT_ERROR"
}
```

## Audit Trail Events

### Assignment Events
- `ASSIGNMENT_REQUEST_INITIATED`: SDR requests assignment
- `ASSIGNMENT_REQUEST_STARTED`: System begins processing
- `ROUND_ROBIN_SELECTION`: Consultant selection details
- `ASSIGNMENT_CREATED`: Successful assignment creation
- `ASSIGNMENT_COMPLETED_SUCCESSFULLY`: Full process completion
- `ASSIGNMENT_FAILED`: Assignment failure with reason

### Consultant Events
- `CONSULTANT_AVAILABILITY_CHANGED`: Active status changes
- `CONSULTANT_UPDATED`: Any consultant information changes

### System Events
- `ANALYTICS_ACCESSED`: Analytics report generation
- `FAIRNESS_REPORT_ACCESSED`: Fairness report access
- `AUDIT_LOGS_ACCESSED`: Audit log access
- `FORCE_REBALANCE_INITIATED`: Manual rebalancing
- `FORCE_REBALANCE_COMPLETED`: Rebalancing completion

## Monitoring and Alerting

### Key Metrics to Monitor

1. **Fairness Score**: Should remain above 70%
2. **Assignment Failures**: Should be minimal
3. **Response Time**: Assignment requests should complete <500ms
4. **Consultant Utilization**: All active consultants should receive assignments

### Recommended Alerts

- Fairness score drops below 60%
- Assignment failure rate exceeds 5%
- Any consultant goes 24+ hours without assignment
- System errors in assignment process

## Performance Optimizations

### Database Optimizations
- Indexed queries for assignment counts and timestamps
- Efficient JOIN operations for consultant statistics
- Prepared statements for frequent operations

### Caching Considerations
- Consultant statistics cached for 5 minutes
- Fairness calculations cached per request
- Assignment counts updated atomically

### Scaling Considerations
- Stateless design allows horizontal scaling
- Database connection pooling
- Async logging to prevent blocking

## Usage Examples

### SDR Getting Assignment
```javascript
// Frontend example
const assignment = await assignmentAPI.getNext();
console.log(`Assigned to: ${assignment.consultant.name}`);
console.log(`Fairness score: ${assignment.metadata.fairness_score}`);
```

### Admin Checking Fairness
```javascript
// Admin checking system fairness
const report = await assignmentAPI.getFairnessReport();
if (report.fairness_score < 70) {
  console.warn('Low fairness score detected:', report.fairness_score);
  // Consider rebalancing
  await assignmentAPI.forceRebalance('Low fairness score');
}
```

### Analyzing Assignment Patterns
```javascript
// Get assignment analytics
const analytics = await assignmentAPI.getAnalytics('7d');
analytics.analytics.forEach(consultant => {
  console.log(`${consultant.name}: ${consultant.total_assignments} assignments`);
});
```

## Configuration

### Environment Variables
```env
# Assignment behavior
MAX_ACTIVE_ASSIGNMENTS_PER_CONSULTANT=3
RECENT_ASSIGNMENT_PENALTY_HOURS=4
SAME_SDR_COOLDOWN_HOURS=24

# Logging
LOG_LEVEL=INFO
AUDIT_LOG_RETENTION_DAYS=90
```

### Customization Points
- Fairness scoring weights in `AssignmentService.calculateFairnessScore()`
- Business rules in `AssignmentService.applyBusinessRules()`
- Time-based penalties and bonuses
- Maximum assignments per consultant

This enhanced round-robin system provides enterprise-level assignment fairness with comprehensive auditing and monitoring capabilities.