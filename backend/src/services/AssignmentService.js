const pool = require('../config/database');
const auditLogger = require('../utils/logger');

class AssignmentService {
  
  /**
   * Get the next consultant using enhanced round-robin logic for a lead
   * @param {number} leadId - The lead ID requesting assignment
   * @returns {Object} Next consultant with assignment metadata
   */
  async getNextConsultantForLead(leadId) {
    try {
      auditLogger.logSystemEvent('ASSIGNMENT_REQUEST_STARTED', { lead_id: leadId });

      // Get all active consultants with their assignment statistics
      const consultants = await this.getConsultantsWithStats();
      
      if (consultants.length === 0) {
        await auditLogger.logAssignmentFailure(leadId, 'NO_ACTIVE_CONSULTANTS');
        throw new Error('No active consultants available for assignment');
      }

      // Apply advanced round-robin selection
      const selectedConsultant = await this.selectConsultantUsingAdvancedRoundRobin(consultants, leadId);
      
      if (!selectedConsultant) {
        await auditLogger.logAssignmentFailure(leadId, 'NO_SUITABLE_CONSULTANT_FOUND');
        throw new Error('No suitable consultant found based on assignment criteria');
      }

      await auditLogger.logRoundRobinSelection(selectedConsultant.id, {
        selection_algorithm: 'advanced_round_robin',
        assignment_count: selectedConsultant.assignment_count,
        last_assigned_at: selectedConsultant.last_assigned_at,
        total_active_consultants: consultants.length
      });

      return selectedConsultant;

    } catch (error) {
      await auditLogger.logError('GET_NEXT_CONSULTANT_ERROR', error, { lead_id: leadId });
      throw error;
    }
  }

  /**
   * Legacy method - kept for backward compatibility
   * @deprecated Use getNextConsultantForLead instead
   */
  async getNextConsultant(sdrId) {
    // For backward compatibility, find the first qualified lead for this SDR
    const Lead = require('../models/Lead');
    const leads = await Lead.findBySDR(sdrId);
    const qualifiedLead = leads.find(lead => lead.status === 'qualified' || lead.status === 'new');
    
    if (!qualifiedLead) {
      throw new Error('No qualified leads found for this SDR');
    }

    return this.getNextConsultantForLead(qualifiedLead.id);
  }

  /**
   * Get all active consultants with comprehensive assignment statistics
   */
  async getConsultantsWithStats() {
    const query = `
      SELECT 
        c.*,
        COALESCE(ac.assignment_count, 0) as assignment_count,
        ac.last_assigned_at,
        COUNT(CASE WHEN a.status = 'active' THEN 1 END) as active_assignments,
        COUNT(CASE WHEN a.status = 'completed' THEN 1 END) as completed_assignments,
        COUNT(CASE WHEN a.assigned_at >= datetime('now', '-7 days') THEN 1 END) as assignments_last_7_days,
        COUNT(CASE WHEN a.assigned_at >= datetime('now', '-24 hours') THEN 1 END) as assignments_last_24h
      FROM consultants c
      LEFT JOIN assignment_counts ac ON c.id = ac.consultant_id
      LEFT JOIN assignments a ON c.id = a.consultant_id
      WHERE c.is_active = 1
      GROUP BY c.id, c.name, c.email, c.phone, c.is_active, c.created_at, c.updated_at, ac.assignment_count, ac.last_assigned_at
      ORDER BY c.name
    `;

    const result = await pool.query(query);
    return result.rows;
  }

  /**
   * Advanced round-robin selection with multiple fairness criteria
   */
  async selectConsultantUsingAdvancedRoundRobin(consultants, sdrId) {
    try {
      // Calculate fairness scores for each consultant
      const consultantsWithScores = consultants.map(consultant => ({
        ...consultant,
        fairness_score: this.calculateFairnessScore(consultant, consultants)
      }));

      // Sort by fairness score (lower is better), then by last assignment time
      consultantsWithScores.sort((a, b) => {
        // Primary: Fairness score (lower is better)
        if (a.fairness_score !== b.fairness_score) {
          return a.fairness_score - b.fairness_score;
        }

        // Secondary: Last assignment time (older first, null first)
        if (!a.last_assigned_at && !b.last_assigned_at) return 0;
        if (!a.last_assigned_at) return -1;
        if (!b.last_assigned_at) return 1;
        
        return new Date(a.last_assigned_at) - new Date(b.last_assigned_at);
      });

      // Apply additional business rules
      const finalSelection = await this.applyBusinessRules(consultantsWithScores, sdrId);

      await auditLogger.logSystemEvent('CONSULTANT_SELECTION_DETAILS', {
        sdr_id: sdrId,
        consultants_evaluated: consultants.length,
        selected_consultant_id: finalSelection?.id,
        selection_criteria: {
          fairness_score: finalSelection?.fairness_score,
          assignment_count: finalSelection?.assignment_count,
          last_assigned_at: finalSelection?.last_assigned_at
        }
      });

      return finalSelection;

    } catch (error) {
      await auditLogger.logError('ADVANCED_ROUND_ROBIN_ERROR', error, { sdr_id: sdrId });
      throw error;
    }
  }

  /**
   * Calculate fairness score for a consultant
   * Lower score means higher priority for assignment
   */
  calculateFairnessScore(consultant, allConsultants) {
    const totalConsultants = allConsultants.length;
    const avgAssignments = allConsultants.reduce((sum, c) => sum + c.assignment_count, 0) / totalConsultants;
    
    // Base score: how far above average this consultant is
    let score = consultant.assignment_count - avgAssignments;

    // Penalty for recent assignments (assignments in last 24h)
    score += consultant.assignments_last_24h * 2;

    // Penalty for having active assignments
    score += consultant.active_assignments * 1.5;

    // Bonus for never being assigned (helps new consultants)
    if (consultant.assignment_count === 0) {
      score -= 5;
    }

    // Time-based bonus: longer since last assignment = lower score
    if (consultant.last_assigned_at) {
      const hoursSinceLastAssignment = 
        (Date.now() - new Date(consultant.last_assigned_at)) / (1000 * 60 * 60);
      score -= Math.min(hoursSinceLastAssignment / 24, 2); // Max 2-point bonus for 48+ hours
    } else {
      score -= 10; // Big bonus for never assigned
    }

    return Math.round(score * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Apply additional business rules for consultant selection
   */
  async applyBusinessRules(sortedConsultants, sdrId) {
    if (sortedConsultants.length === 0) {
      return null;
    }

    // Check for consultant-specific rules
    const availableConsultants = await this.filterByAvailabilityRules(sortedConsultants, sdrId);
    
    if (availableConsultants.length === 0) {
      await auditLogger.logSystemEvent('NO_CONSULTANTS_AFTER_BUSINESS_RULES', {
        sdr_id: sdrId,
        original_count: sortedConsultants.length
      });
      // If all consultants are filtered out by business rules, 
      // return the most fair one anyway (emergency fallback)
      return sortedConsultants[0];
    }

    return availableConsultants[0];
  }

  /**
   * Filter consultants based on availability rules
   */
  async filterByAvailabilityRules(consultants, sdrId) {
    // Example business rules (customize as needed):
    
    // Rule 1: Consultant shouldn't have more than 3 active assignments
    const filteredByActiveLimit = consultants.filter(c => c.active_assignments < 3);
    
    // Rule 2: Avoid assigning same consultant to same SDR within 24 hours
    const filteredByRecentAssignment = await this.filterRecentSDRAssignments(
      filteredByActiveLimit, 
      sdrId
    );

    // Rule 3: Prefer consultants who haven't been assigned in the last 4 hours
    const now = new Date();
    const fourHoursAgo = new Date(now.getTime() - 4 * 60 * 60 * 1000);
    
    const preferredConsultants = filteredByRecentAssignment.filter(c => 
      !c.last_assigned_at || new Date(c.last_assigned_at) < fourHoursAgo
    );

    // Return preferred consultants if available, otherwise return all filtered
    return preferredConsultants.length > 0 ? preferredConsultants : filteredByRecentAssignment;
  }

  /**
   * Filter out consultants recently assigned to the same SDR
   */
  async filterRecentSDRAssignments(consultants, sdrId) {
    const query = `
      SELECT consultant_id 
      FROM assignments 
      WHERE sdr_id = ? 
        AND assigned_at >= datetime('now', '-24 hours')
    `;

    const result = await pool.query(query, [sdrId]);
    const recentConsultantIds = result.rows.map(row => row.consultant_id);

    return consultants.filter(c => !recentConsultantIds.includes(c.id));
  }

  /**
   * Create assignment with comprehensive logging
   */
  async createAssignment(leadId, consultantId, metadata = {}) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Create the assignment with optional manual assignment metadata
      const assignmentQuery = `
        INSERT INTO assignments (lead_id, consultant_id, assigned_at, status, is_manual, manual_reason, created_by)
        VALUES (?, ?, datetime('now'), 'active', ?, ?, ?)
      `;
      const assignmentResult = await client.query(assignmentQuery, [
        leadId, 
        consultantId, 
        metadata.is_manual || false,
        metadata.manual_reason || null,
        metadata.created_by || null
      ]);
      const assignmentId = assignmentResult.rows[0]?.id;

      // Update assignment counts
      const updateCountQuery = `
        INSERT OR REPLACE INTO assignment_counts (consultant_id, assignment_count, last_assigned_at)
        VALUES (
          ?, 
          COALESCE((SELECT assignment_count FROM assignment_counts WHERE consultant_id = ?), 0) + 1,
          datetime('now')
        )
      `;
      await client.query(updateCountQuery, [consultantId, consultantId]);

      await client.query('COMMIT');

      // Log successful assignment
      await auditLogger.logAssignment(leadId, consultantId, assignmentId, {
        assignment_method: 'advanced_round_robin',
        timestamp: new Date().toISOString()
      });

      // Get complete assignment details for return
      const assignmentDetails = await this.getAssignmentDetails(assignmentId);
      
      return assignmentDetails;

    } catch (error) {
      await client.query('ROLLBACK');
      await auditLogger.logError('CREATE_ASSIGNMENT_ERROR', error, {
        lead_id: leadId,
        consultant_id: consultantId
      });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get detailed assignment information
   */
  async getAssignmentDetails(assignmentId) {
    const query = `
      SELECT 
        a.*,
        c.name as consultant_name,
        c.email as consultant_email,
        c.phone as consultant_phone,
        u.username as sdr_username,
        u.first_name as sdr_first_name,
        u.last_name as sdr_last_name
      FROM assignments a
      JOIN consultants c ON a.consultant_id = c.id
      JOIN users u ON a.sdr_id = u.id
      WHERE a.id = ?
    `;

    const result = await pool.query(query, [assignmentId]);
    return result.rows[0];
  }

  /**
   * Get assignment analytics and statistics
   */
  async getAssignmentAnalytics(timeframe = '7d') {
    const timeFilter = this.getTimeFilter(timeframe);
    
    const query = `
      SELECT 
        c.name,
        c.email,
        COUNT(*) as total_assignments,
        COUNT(CASE WHEN a.status = 'active' THEN 1 END) as active_assignments,
        COUNT(CASE WHEN a.status = 'completed' THEN 1 END) as completed_assignments,
        AVG(
          CASE 
            WHEN a.status = 'completed' 
            THEN (julianday(datetime('now')) - julianday(a.assigned_at)) * 24 
          END
        ) as avg_completion_hours,
        MIN(a.assigned_at) as first_assignment,
        MAX(a.assigned_at) as last_assignment
      FROM assignments a
      JOIN consultants c ON a.consultant_id = c.id
      WHERE a.assigned_at >= datetime('now', ?)
      GROUP BY c.id, c.name, c.email
      ORDER BY total_assignments DESC
    `;

    const result = await pool.query(query, [timeFilter]);
    return result.rows;
  }

  /**
   * Get time filter for analytics queries
   */
  getTimeFilter(timeframe) {
    const filters = {
      '1d': '-1 day',
      '7d': '-7 days',
      '30d': '-30 days',
      '90d': '-90 days'
    };
    return filters[timeframe] || filters['7d'];
  }

  /**
   * Get assignment fairness report
   */
  async getFairnessReport() {
    const consultants = await this.getConsultantsWithStats();
    
    if (consultants.length === 0) {
      return { fairness_score: 100, consultants: [], analysis: 'No active consultants' };
    }

    const totalAssignments = consultants.reduce((sum, c) => sum + c.assignment_count, 0);
    const expectedPerConsultant = totalAssignments / consultants.length;
    
    // Calculate standard deviation to measure fairness
    const variance = consultants.reduce((sum, c) => {
      return sum + Math.pow(c.assignment_count - expectedPerConsultant, 2);
    }, 0) / consultants.length;
    
    const standardDeviation = Math.sqrt(variance);
    
    // Fairness score: lower standard deviation = higher fairness
    // Scale to 0-100 where 100 is perfectly fair
    const fairnessScore = Math.max(0, Math.min(100, 100 - (standardDeviation * 10)));

    const analysis = {
      total_consultants: consultants.length,
      total_assignments: totalAssignments,
      expected_per_consultant: Math.round(expectedPerConsultant * 100) / 100,
      standard_deviation: Math.round(standardDeviation * 100) / 100,
      fairness_score: Math.round(fairnessScore * 100) / 100
    };

    return {
      fairness_score: analysis.fairness_score,
      consultants: consultants.map(c => ({
        name: c.name,
        assignment_count: c.assignment_count,
        deviation_from_expected: Math.round((c.assignment_count - expectedPerConsultant) * 100) / 100,
        last_assigned_at: c.last_assigned_at
      })),
      analysis
    };
  }
}

module.exports = new AssignmentService();