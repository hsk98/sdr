const { Pool } = require('pg');
const config = require('../config/database');

class AnalyticsService {
  constructor() {
    this.pool = new Pool(config);
  }

  // Assignment distribution analytics
  async getAssignmentDistribution(timeframe = '30 days') {
    const query = `
      SELECT 
        c.id,
        c.name,
        c.specialty,
        COUNT(a.id) as total_assignments,
        COUNT(CASE WHEN a.status = 'completed' THEN 1 END) as completed_assignments,
        COUNT(CASE WHEN a.status = 'active' THEN 1 END) as active_assignments,
        COUNT(CASE WHEN a.status = 'cancelled' THEN 1 END) as cancelled_assignments,
        ROUND(
          COUNT(CASE WHEN a.status = 'completed' THEN 1 END) * 100.0 / 
          NULLIF(COUNT(a.id), 0), 2
        ) as completion_rate,
        COALESCE(ac.assignment_count, 0) as lifetime_assignments
      FROM consultants c
      LEFT JOIN assignments a ON c.id = a.consultant_id 
        AND a.assigned_at >= NOW() - INTERVAL '${timeframe}'
      LEFT JOIN assignment_counts ac ON c.id = ac.consultant_id
      WHERE c.is_active = true
      GROUP BY c.id, c.name, c.specialty, ac.assignment_count
      ORDER BY COUNT(a.id) DESC
    `;
    
    const result = await this.pool.query(query);
    return result.rows;
  }

  // Performance metrics
  async getPerformanceMetrics(timeframe = '30 days') {
    const query = `
      SELECT 
        COUNT(a.id) as total_assignments,
        COUNT(CASE WHEN a.status = 'completed' THEN 1 END) as completed_assignments,
        COUNT(CASE WHEN a.status = 'active' THEN 1 END) as active_assignments,
        COUNT(CASE WHEN a.status = 'cancelled' THEN 1 END) as cancelled_assignments,
        ROUND(
          COUNT(CASE WHEN a.status = 'completed' THEN 1 END) * 100.0 / 
          NULLIF(COUNT(a.id), 0), 2
        ) as overall_completion_rate,
        ROUND(AVG(am.response_time_minutes), 2) as avg_response_time,
        ROUND(AVG(am.completion_time_minutes), 2) as avg_completion_time,
        ROUND(AVG(am.consultant_rating), 2) as avg_consultant_rating,
        ROUND(AVG(am.sdr_rating), 2) as avg_sdr_rating
      FROM assignments a
      LEFT JOIN assignment_metrics am ON a.id = am.assignment_id
      WHERE a.assigned_at >= NOW() - INTERVAL '${timeframe}'
    `;
    
    const result = await this.pool.query(query);
    return result.rows[0];
  }

  // SDR performance analytics
  async getSDRPerformance(timeframe = '30 days') {
    const query = `
      SELECT 
        u.id,
        u.first_name,
        u.last_name,
        u.email,
        COUNT(a.id) as total_assignments,
        COUNT(CASE WHEN a.status = 'completed' THEN 1 END) as completed_assignments,
        ROUND(
          COUNT(CASE WHEN a.status = 'completed' THEN 1 END) * 100.0 / 
          NULLIF(COUNT(a.id), 0), 2
        ) as completion_rate,
        ROUND(AVG(am.response_time_minutes), 2) as avg_response_time,
        ROUND(AVG(am.completion_time_minutes), 2) as avg_completion_time,
        ROUND(AVG(am.sdr_rating), 2) as avg_rating
      FROM users u
      LEFT JOIN assignments a ON u.id = a.sdr_id 
        AND a.assigned_at >= NOW() - INTERVAL '${timeframe}'
      LEFT JOIN assignment_metrics am ON a.id = am.assignment_id
      WHERE u.role = 'sdr'
      GROUP BY u.id, u.first_name, u.last_name, u.email
      ORDER BY COUNT(a.id) DESC
    `;
    
    const result = await this.pool.query(query);
    return result.rows;
  }

  // Time-based analytics (daily/weekly trends)
  async getTimeBasedAnalytics(timeframe = '30 days', groupBy = 'day') {
    const dateFormat = groupBy === 'day' ? 'YYYY-MM-DD' : 'YYYY-"W"WW';
    const query = `
      SELECT 
        TO_CHAR(a.assigned_at, '${dateFormat}') as period,
        COUNT(a.id) as total_assignments,
        COUNT(CASE WHEN a.status = 'completed' THEN 1 END) as completed_assignments,
        COUNT(CASE WHEN a.status = 'active' THEN 1 END) as active_assignments,
        COUNT(CASE WHEN a.status = 'cancelled' THEN 1 END) as cancelled_assignments,
        COUNT(DISTINCT a.consultant_id) as unique_consultants,
        COUNT(DISTINCT a.sdr_id) as unique_sdrs
      FROM assignments a
      WHERE a.assigned_at >= NOW() - INTERVAL '${timeframe}'
      GROUP BY TO_CHAR(a.assigned_at, '${dateFormat}')
      ORDER BY period DESC
    `;
    
    const result = await this.pool.query(query);
    return result.rows;
  }

  // Consultant utilization analytics
  async getConsultantUtilization(timeframe = '30 days') {
    const query = `
      SELECT 
        c.id,
        c.name,
        c.specialty,
        c.hourly_rate,
        COUNT(a.id) as assignments_received,
        COUNT(CASE WHEN a.status = 'completed' THEN 1 END) as assignments_completed,
        SUM(CASE WHEN a.status = 'completed' AND am.completion_time_minutes IS NOT NULL 
            THEN am.completion_time_minutes ELSE 0 END) as total_billable_minutes,
        ROUND(
          SUM(CASE WHEN a.status = 'completed' AND am.completion_time_minutes IS NOT NULL 
              THEN (am.completion_time_minutes / 60.0) * c.hourly_rate ELSE 0 END), 2
        ) as estimated_revenue,
        ROUND(AVG(am.consultant_rating), 2) as avg_rating,
        check_consultant_availability(c.id, NOW()) as currently_available
      FROM consultants c
      LEFT JOIN assignments a ON c.id = a.consultant_id 
        AND a.assigned_at >= NOW() - INTERVAL '${timeframe}'
      LEFT JOIN assignment_metrics am ON a.id = am.assignment_id
      WHERE c.is_active = true
      GROUP BY c.id, c.name, c.specialty, c.hourly_rate
      ORDER BY assignments_received DESC
    `;
    
    const result = await this.pool.query(query);
    return result.rows;
  }

  // Availability analytics
  async getAvailabilityAnalytics() {
    const query = `
      SELECT 
        c.id,
        c.name,
        c.specialty,
        c.timezone,
        COUNT(ca.id) as scheduled_hours,
        COUNT(CASE WHEN ca.is_available = true THEN 1 END) as available_hours,
        EXISTS(
          SELECT 1 FROM consultant_timeoff ct 
          WHERE ct.consultant_id = c.id 
          AND CURRENT_DATE BETWEEN ct.start_date AND ct.end_date
          AND ct.is_approved = true
        ) as currently_on_timeoff,
        check_consultant_availability(c.id, NOW()) as available_now
      FROM consultants c
      LEFT JOIN consultant_availability ca ON c.id = ca.consultant_id
      WHERE c.is_active = true
      GROUP BY c.id, c.name, c.specialty, c.timezone
      ORDER BY available_hours DESC
    `;
    
    const result = await this.pool.query(query);
    return result.rows;
  }

  // Assignment fairness analytics
  async getFairnessAnalytics(timeframe = '30 days') {
    const query = `
      WITH assignment_stats AS (
        SELECT 
          c.id,
          c.name,
          COUNT(a.id) as recent_assignments,
          COALESCE(ac.assignment_count, 0) as lifetime_assignments
        FROM consultants c
        LEFT JOIN assignments a ON c.id = a.consultant_id 
          AND a.assigned_at >= NOW() - INTERVAL '${timeframe}'
        LEFT JOIN assignment_counts ac ON c.id = ac.consultant_id
        WHERE c.is_active = true
        GROUP BY c.id, c.name, ac.assignment_count
      ),
      stats_summary AS (
        SELECT 
          AVG(recent_assignments) as avg_recent,
          AVG(lifetime_assignments) as avg_lifetime,
          STDDEV(recent_assignments) as stddev_recent,
          STDDEV(lifetime_assignments) as stddev_lifetime
        FROM assignment_stats
      )
      SELECT 
        s.*,
        ss.avg_recent,
        ss.avg_lifetime,
        ABS(s.recent_assignments - ss.avg_recent) as recent_deviation,
        ABS(s.lifetime_assignments - ss.avg_lifetime) as lifetime_deviation,
        CASE 
          WHEN ss.stddev_recent > 0 THEN 
            ABS(s.recent_assignments - ss.avg_recent) / ss.stddev_recent
          ELSE 0 
        END as recent_fairness_score,
        CASE 
          WHEN ss.stddev_lifetime > 0 THEN 
            ABS(s.lifetime_assignments - ss.avg_lifetime) / ss.stddev_lifetime
          ELSE 0 
        END as lifetime_fairness_score
      FROM assignment_stats s
      CROSS JOIN stats_summary ss
      ORDER BY recent_fairness_score DESC
    `;
    
    const result = await this.pool.query(query);
    return result.rows;
  }

  // Custom analytics report
  async generateCustomReport(filters = {}) {
    const {
      startDate,
      endDate,
      consultantIds,
      sdrIds,
      specialties,
      statuses
    } = filters;

    let whereClause = 'WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (startDate) {
      whereClause += ` AND a.assigned_at >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      whereClause += ` AND a.assigned_at <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }

    if (consultantIds && consultantIds.length > 0) {
      whereClause += ` AND a.consultant_id = ANY($${paramIndex})`;
      params.push(consultantIds);
      paramIndex++;
    }

    if (sdrIds && sdrIds.length > 0) {
      whereClause += ` AND a.sdr_id = ANY($${paramIndex})`;
      params.push(sdrIds);
      paramIndex++;
    }

    if (specialties && specialties.length > 0) {
      whereClause += ` AND c.specialty = ANY($${paramIndex})`;
      params.push(specialties);
      paramIndex++;
    }

    if (statuses && statuses.length > 0) {
      whereClause += ` AND a.status = ANY($${paramIndex})`;
      params.push(statuses);
      paramIndex++;
    }

    const query = `
      SELECT 
        a.id,
        a.assigned_at,
        a.status,
        c.name as consultant_name,
        c.email as consultant_email,
        c.specialty,
        u.first_name || ' ' || u.last_name as sdr_name,
        u.email as sdr_email,
        am.response_time_minutes,
        am.completion_time_minutes,
        am.consultant_rating,
        am.sdr_rating,
        am.notes
      FROM assignments a
      JOIN consultants c ON a.consultant_id = c.id
      JOIN users u ON a.sdr_id = u.id
      LEFT JOIN assignment_metrics am ON a.id = am.assignment_id
      ${whereClause}
      ORDER BY a.assigned_at DESC
    `;

    const result = await this.pool.query(query, params);
    return result.rows;
  }

  // Dashboard summary
  async getDashboardSummary() {
    const queries = {
      overview: `
        SELECT 
          COUNT(CASE WHEN role = 'sdr' THEN 1 END) as total_sdrs,
          COUNT(CASE WHEN is_active = true THEN 1 END) as active_consultants,
          (SELECT COUNT(*) FROM assignments WHERE status = 'active') as active_assignments,
          (SELECT COUNT(*) FROM assignments WHERE assigned_at >= CURRENT_DATE) as todays_assignments
        FROM users u
        FULL OUTER JOIN consultants c ON true
      `,
      recentActivity: `
        SELECT 
          'assignment' as activity_type,
          a.assigned_at as activity_time,
          u.first_name || ' ' || u.last_name as actor,
          'assigned to ' || c.name as description
        FROM assignments a
        JOIN users u ON a.sdr_id = u.id
        JOIN consultants c ON a.consultant_id = c.id
        WHERE a.assigned_at >= NOW() - INTERVAL '24 hours'
        ORDER BY a.assigned_at DESC
        LIMIT 10
      `,
      topPerformers: `
        SELECT 
          c.name,
          COUNT(a.id) as assignments_count,
          ROUND(AVG(am.consultant_rating), 2) as avg_rating
        FROM consultants c
        LEFT JOIN assignments a ON c.id = a.consultant_id
        LEFT JOIN assignment_metrics am ON a.id = am.assignment_id
        WHERE a.assigned_at >= NOW() - INTERVAL '7 days'
        GROUP BY c.id, c.name
        HAVING COUNT(a.id) > 0
        ORDER BY avg_rating DESC, assignments_count DESC
        LIMIT 5
      `
    };

    const results = {};
    for (const [key, query] of Object.entries(queries)) {
      const result = await this.pool.query(query);
      results[key] = result.rows;
    }

    return results;
  }
}

module.exports = new AnalyticsService();