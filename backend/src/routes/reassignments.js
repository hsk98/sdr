const express = require('express');
const router = express.Router();
const db = require('../config/database');
const auth = require('../middleware/auth');

/**
 * @route   POST /api/reassignments
 * @desc    Create a new reassignment record
 * @access  Private (SDRs and Admins)
 */
router.post('/', auth, async (req, res) => {
  const startTime = Date.now();
  
  try {
    const {
      assignmentId,
      originalConsultantId,
      newConsultantId,
      reason,
      leadIdentifier,
      leadName,
      previousSkillsMatchScore,
      newSkillsMatchScore,
      skillsRequirements = [],
      exclusionList = [],
      reassignmentSource = 'user_request',
      sessionId,
      userAgent,
      ipAddress
    } = req.body;

    const sdrId = req.user.userId;

    // Get current reassignment count for this assignment
    const assignmentQuery = await db.query(
      'SELECT reassignment_count FROM assignments WHERE id = $1',
      [assignmentId]
    );

    if (assignmentQuery.rows.length === 0) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    const currentCount = assignmentQuery.rows[0].reassignment_count;
    const reassignmentNumber = currentCount + 1;
    const processingTime = Date.now() - startTime;

    // Create reassignment record
    const result = await db.query(`
      INSERT INTO assignment_reassignments (
        assignment_id, sdr_id, original_consultant_id, new_consultant_id,
        reassignment_number, reason, lead_identifier, lead_name,
        previous_skills_match_score, new_skills_match_score,
        skills_requirements, exclusion_list, reassignment_source,
        processing_time_ms, session_id, user_agent, ip_address
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      RETURNING id, timestamp
    `, [
      assignmentId, sdrId, originalConsultantId, newConsultantId,
      reassignmentNumber, reason, leadIdentifier, leadName,
      previousSkillsMatchScore, newSkillsMatchScore,
      JSON.stringify(skillsRequirements), JSON.stringify(exclusionList),
      reassignmentSource, processingTime, sessionId, userAgent, ipAddress
    ]);

    res.status(201).json({
      reassignmentId: result.rows[0].id,
      reassignmentNumber,
      timestamp: result.rows[0].timestamp,
      processingTimeMs: processingTime
    });

  } catch (error) {
    console.error('Failed to create reassignment record:', error);
    res.status(500).json({ 
      error: 'Failed to create reassignment record',
      details: error.message 
    });
  }
});

/**
 * @route   GET /api/reassignments/assignment/:id
 * @desc    Get all reassignments for a specific assignment
 * @access  Private (SDRs and Admins)
 */
router.get('/assignment/:id', auth, async (req, res) => {
  try {
    const assignmentId = req.params.id;

    const result = await db.query(`
      SELECT 
        ar.*,
        oc.name as original_consultant_name,
        nc.name as new_consultant_name,
        u.username as sdr_username,
        u.first_name || ' ' || u.last_name as sdr_name
      FROM assignment_reassignments ar
      LEFT JOIN consultants oc ON ar.original_consultant_id = oc.id
      LEFT JOIN consultants nc ON ar.new_consultant_id = nc.id
      LEFT JOIN users u ON ar.sdr_id = u.id
      WHERE ar.assignment_id = $1
      ORDER BY ar.reassignment_number ASC
    `, [assignmentId]);

    res.json(result.rows);

  } catch (error) {
    console.error('Failed to get reassignment history:', error);
    res.status(500).json({ 
      error: 'Failed to get reassignment history',
      details: error.message 
    });
  }
});

/**
 * @route   GET /api/reassignments/analytics
 * @desc    Get reassignment analytics and metrics
 * @access  Private (Admins only)
 */
router.get('/analytics', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const {
      startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      endDate = new Date().toISOString().split('T')[0],
      sdrId,
      consultantId
    } = req.query;

    // Build query conditions
    let conditions = ['DATE(ar.timestamp) BETWEEN $1 AND $2'];
    let params = [startDate, endDate];
    let paramCount = 2;

    if (sdrId) {
      conditions.push(`ar.sdr_id = $${++paramCount}`);
      params.push(sdrId);
    }

    if (consultantId) {
      conditions.push(`(ar.original_consultant_id = $${++paramCount} OR ar.new_consultant_id = $${paramCount})`);
      params.push(consultantId);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get comprehensive analytics
    const analyticsQuery = `
      WITH reassignment_stats AS (
        SELECT 
          COUNT(*) as total_reassignments,
          COUNT(*) FILTER (WHERE success = true) as successful_reassignments,
          COUNT(*) FILTER (WHERE success = false) as failed_reassignments,
          AVG(processing_time_ms) as avg_processing_time,
          AVG(reassignment_number) as avg_reassignments_per_lead,
          MAX(reassignment_number) as max_reassignments_single_lead,
          COUNT(DISTINCT lead_identifier) as unique_leads_reassigned,
          COUNT(*) FILTER (WHERE skills_requirements != '[]') as skills_based_reassignments,
          COUNT(*) FILTER (WHERE reassignment_source = 'user_request') as user_initiated,
          COUNT(*) FILTER (WHERE reassignment_source = 'system_automatic') as system_initiated,
          COUNT(*) FILTER (WHERE reassignment_source = 'admin_override') as admin_initiated
        FROM assignment_reassignments ar
        ${whereClause}
      ),
      consultant_stats AS (
        SELECT 
          nc.name as consultant_name,
          COUNT(*) as times_reassigned_to,
          AVG(ar.new_skills_match_score) as avg_skills_match_score
        FROM assignment_reassignments ar
        JOIN consultants nc ON ar.new_consultant_id = nc.id
        ${whereClause}
        GROUP BY nc.name
        ORDER BY times_reassigned_to DESC
        LIMIT 10
      ),
      sdr_stats AS (
        SELECT 
          u.username,
          u.first_name || ' ' || u.last_name as sdr_name,
          COUNT(*) as total_reassignments,
          AVG(ar.processing_time_ms) as avg_processing_time,
          COUNT(DISTINCT ar.lead_identifier) as unique_leads_reassigned
        FROM assignment_reassignments ar
        JOIN users u ON ar.sdr_id = u.id
        ${whereClause}
        GROUP BY u.id, u.username, u.first_name, u.last_name
        ORDER BY total_reassignments DESC
      ),
      daily_trends AS (
        SELECT 
          DATE(ar.timestamp) as date,
          COUNT(*) as reassignments_count,
          AVG(ar.processing_time_ms) as avg_processing_time,
          COUNT(*) FILTER (WHERE ar.success = true) as successful_count
        FROM assignment_reassignments ar
        ${whereClause}
        GROUP BY DATE(ar.timestamp)
        ORDER BY date DESC
      ),
      reason_analysis AS (
        SELECT 
          COALESCE(reason, 'No reason provided') as reason,
          COUNT(*) as count,
          ROUND(COUNT(*)::numeric / (SELECT COUNT(*) FROM assignment_reassignments ar ${whereClause})::numeric * 100, 2) as percentage
        FROM assignment_reassignments ar
        ${whereClause}
        GROUP BY reason
        ORDER BY count DESC
        LIMIT 10
      )
      SELECT 
        (SELECT row_to_json(reassignment_stats) FROM reassignment_stats) as overall_stats,
        (SELECT json_agg(row_to_json(consultant_stats)) FROM consultant_stats) as consultant_stats,
        (SELECT json_agg(row_to_json(sdr_stats)) FROM sdr_stats) as sdr_stats,
        (SELECT json_agg(row_to_json(daily_trends)) FROM daily_trends) as daily_trends,
        (SELECT json_agg(row_to_json(reason_analysis)) FROM reason_analysis) as reason_analysis
    `;

    const result = await db.query(analyticsQuery, params);
    const analytics = result.rows[0];

    // Calculate additional metrics
    const overallStats = analytics.overall_stats || {};
    const successRate = overallStats.total_reassignments > 0 
      ? (overallStats.successful_reassignments / overallStats.total_reassignments * 100).toFixed(2)
      : 0;

    res.json({
      dateRange: { startDate, endDate },
      filters: { sdrId, consultantId },
      overallStats: {
        ...overallStats,
        successRate: parseFloat(successRate)
      },
      consultantStats: analytics.consultant_stats || [],
      sdrStats: analytics.sdr_stats || [],
      dailyTrends: analytics.daily_trends || [],
      reasonAnalysis: analytics.reason_analysis || []
    });

  } catch (error) {
    console.error('Failed to get reassignment analytics:', error);
    res.status(500).json({ 
      error: 'Failed to get reassignment analytics',
      details: error.message 
    });
  }
});

/**
 * @route   GET /api/reassignments/trends
 * @desc    Get reassignment trends over time
 * @access  Private (Admins only)
 */
router.get('/trends', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const {
      period = 'daily', // daily, weekly, monthly
      days = 30
    } = req.query;

    let groupBy, dateFormat;
    switch (period) {
      case 'weekly':
        groupBy = "date_trunc('week', ar.timestamp)";
        dateFormat = 'YYYY-"W"IW';
        break;
      case 'monthly':
        groupBy = "date_trunc('month', ar.timestamp)";
        dateFormat = 'YYYY-MM';
        break;
      default: // daily
        groupBy = "DATE(ar.timestamp)";
        dateFormat = 'YYYY-MM-DD';
    }

    const query = `
      SELECT 
        ${groupBy} as period,
        to_char(${groupBy}, '${dateFormat}') as period_label,
        COUNT(*) as total_reassignments,
        COUNT(*) FILTER (WHERE success = true) as successful_reassignments,
        COUNT(*) FILTER (WHERE success = false) as failed_reassignments,
        AVG(processing_time_ms) as avg_processing_time,
        COUNT(DISTINCT lead_identifier) as unique_leads,
        AVG(reassignment_number) as avg_reassignment_number,
        COUNT(*) FILTER (WHERE skills_requirements != '[]') as skills_based_count,
        COUNT(DISTINCT sdr_id) as active_sdrs,
        COUNT(DISTINCT new_consultant_id) as consultants_assigned_to
      FROM assignment_reassignments ar
      WHERE ar.timestamp >= NOW() - INTERVAL '${parseInt(days)} days'
      GROUP BY ${groupBy}
      ORDER BY period DESC
      LIMIT 100
    `;

    const result = await db.query(query);

    res.json({
      period,
      days: parseInt(days),
      trends: result.rows.map(row => ({
        period: row.period,
        periodLabel: row.period_label,
        totalReassignments: parseInt(row.total_reassignments),
        successfulReassignments: parseInt(row.successful_reassignments),
        failedReassignments: parseInt(row.failed_reassignments),
        successRate: row.total_reassignments > 0 
          ? (row.successful_reassignments / row.total_reassignments * 100).toFixed(2)
          : 0,
        avgProcessingTime: row.avg_processing_time ? parseFloat(row.avg_processing_time).toFixed(2) : null,
        uniqueLeads: parseInt(row.unique_leads),
        avgReassignmentNumber: row.avg_reassignment_number ? parseFloat(row.avg_reassignment_number).toFixed(2) : null,
        skillsBasedCount: parseInt(row.skills_based_count),
        activeSDRs: parseInt(row.active_sdrs),
        consultantsAssignedTo: parseInt(row.consultants_assigned_to)
      }))
    });

  } catch (error) {
    console.error('Failed to get reassignment trends:', error);
    res.status(500).json({ 
      error: 'Failed to get reassignment trends',
      details: error.message 
    });
  }
});

/**
 * @route   GET /api/reassignments/report
 * @desc    Get comprehensive reassignment report
 * @access  Private (Admins only)
 */
router.get('/report', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const {
      startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      endDate = new Date().toISOString().split('T')[0],
      limit = 100,
      offset = 0,
      sortBy = 'reassignment_time',
      sortOrder = 'DESC',
      minReassignments = 0
    } = req.query;

    // Validate sort parameters
    const validSortFields = ['reassignment_time', 'reassignment_count', 'skills_improvement', 'processing_time_ms'];
    const validSortOrders = ['ASC', 'DESC'];
    
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'reassignment_time';
    const sortDirection = validSortOrders.includes(sortOrder.toUpperCase()) ? sortOrder.toUpperCase() : 'DESC';

    const query = `
      SELECT 
        assignment_id,
        lead_identifier,
        lead_name,
        reassignment_count,
        assignment_method,
        sdr_username,
        sdr_name,
        current_consultant_name,
        current_consultant_email,
        initial_assignment_time,
        assignment_status,
        reassignment_number,
        reassignment_time,
        reassignment_reason,
        reassignment_source,
        processing_time_ms,
        previous_skills_match_score,
        new_skills_match_score,
        skills_improvement,
        original_consultant_name,
        new_consultant_name,
        reassignment_successful,
        error_message
      FROM reassignment_report_view
      WHERE DATE(reassignment_time) BETWEEN $1 AND $2
        AND reassignment_count >= $3
      ORDER BY ${sortField} ${sortDirection}
      LIMIT $4 OFFSET $5
    `;

    const countQuery = `
      SELECT COUNT(*) as total
      FROM reassignment_report_view
      WHERE DATE(reassignment_time) BETWEEN $1 AND $2
        AND reassignment_count >= $3
    `;

    const [reportResult, countResult] = await Promise.all([
      db.query(query, [startDate, endDate, minReassignments, limit, offset]),
      db.query(countQuery, [startDate, endDate, minReassignments])
    ]);

    res.json({
      dateRange: { startDate, endDate },
      filters: { minReassignments },
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: parseInt(countResult.rows[0].total),
        hasMore: (parseInt(offset) + parseInt(limit)) < parseInt(countResult.rows[0].total)
      },
      sort: { field: sortField, order: sortDirection },
      data: reportResult.rows
    });

  } catch (error) {
    console.error('Failed to get reassignment report:', error);
    res.status(500).json({ 
      error: 'Failed to get reassignment report',
      details: error.message 
    });
  }
});

/**
 * @route   POST /api/reassignments/analytics/generate
 * @desc    Generate analytics for a specific date (usually run daily)
 * @access  Private (Admins only)
 */
router.post('/analytics/generate', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { date = new Date().toISOString().split('T')[0] } = req.body;

    await db.query('SELECT generate_reassignment_analytics($1)', [date]);

    res.json({
      success: true,
      message: `Analytics generated for ${date}`,
      date
    });

  } catch (error) {
    console.error('Failed to generate analytics:', error);
    res.status(500).json({ 
      error: 'Failed to generate analytics',
      details: error.message 
    });
  }
});

module.exports = router;