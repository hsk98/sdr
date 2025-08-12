const Assignment = require('../models/Assignment');
const Consultant = require('../models/Consultant');
const AssignmentService = require('../services/AssignmentService');
const auditLogger = require('../utils/logger');
const pool = require('../config/database');

const getNextAssignment = async (req, res) => {
  try {
    const sdrId = req.user.id;
    const sdrInfo = `${req.user.first_name} ${req.user.last_name} (${req.user.username})`;
    const { leadId, leadName } = req.body || {};
    
    // Comprehensive audit logging for blind assignment
    try {
      await auditLogger.logSystemEvent('BLIND_ASSIGNMENT_REQUEST', {
        sdr_id: sdrId,
        sdr_info: sdrInfo,
        lead_info: leadId ? { leadId, leadName } : null,
        timestamp: new Date().toISOString(),
        ip_address: req.ip,
        user_agent: req.headers['user-agent']
      });
    } catch (logError) {
      console.error('Audit logging failed:', logError);
      // Continue processing even if logging fails
    }

    // Get consultants directly for blind assignment
    const consultants = await AssignmentService.getConsultantsWithStats();
    
    if (consultants.length === 0) {
      await auditLogger.logSystemEvent('BLIND_ASSIGNMENT_FAILED_NO_CONSULTANTS', {
        sdr_id: sdrId,
        reason: 'No available consultants'
      });
      
      return res.status(404).json({ 
        error: 'No available consultants for assignment',
        code: 'NO_CONSULTANTS_AVAILABLE'
      });
    }

    // Select consultant using round-robin logic with fallback
    let nextConsultant;
    try {
      nextConsultant = await AssignmentService.selectConsultantUsingAdvancedRoundRobin(consultants, sdrId);
    } catch (error) {
      console.error('Advanced round-robin failed, using simple fallback:', error);
      // Fallback to simple round-robin: pick consultant with least assignments
      nextConsultant = consultants.sort((a, b) => a.assignment_count - b.assignment_count)[0];
    }
    
    if (!nextConsultant) {
      await auditLogger.logSystemEvent('BLIND_ASSIGNMENT_FAILED_NO_CONSULTANTS', {
        sdr_id: sdrId,
        reason: 'No suitable consultant found'
      });
      
      return res.status(404).json({ 
        error: 'No suitable consultant found for assignment',
        code: 'NO_SUITABLE_CONSULTANT'
      });
    }
    
    // Create assignment using Assignment model directly for blind assignment
    const assignmentDetails = await Assignment.createManual({
      leadId: leadId || `blind_${Date.now()}`,
      leadName: leadName || 'Blind Assignment',
      consultantId: nextConsultant.id,
      isManual: false,
      manualReason: 'Blind round-robin assignment',
      createdBy: sdrId
    });
    
    const response = {
      message: 'Assignment created successfully',
      assignment: assignmentDetails,
      consultant: {
        id: nextConsultant.id,
        name: nextConsultant.name,
        email: nextConsultant.email,
        phone: nextConsultant.phone
      },
      metadata: {
        assignment_method: 'blind_round_robin',
        fairness_score: nextConsultant.fairness_score,
        assignment_count: nextConsultant.assignment_count,
        last_assigned_at: nextConsultant.last_assigned_at,
        is_blind: true,
        assigned_at: new Date().toISOString()
      },
      auditInfo: {
        assignmentId: assignmentDetails.id,
        sdrId: sdrId,
        consultantSelected: nextConsultant.name,
        selectionCriteria: 'blind_round_robin_fairness'
      }
    };

    // Comprehensive success audit
    await auditLogger.logSystemEvent('BLIND_ASSIGNMENT_COMPLETED', {
      sdr_id: sdrId,
      consultant_id: nextConsultant.id,
      consultant_name: nextConsultant.name,
      assignment_id: assignmentDetails.id,
      lead_info: leadId ? { leadId, leadName } : null,
      fairness_metrics: {
        consultant_assignment_count: nextConsultant.assignment_count,
        fairness_score: nextConsultant.fairness_score
      },
      response_metadata: response.metadata
    });
    
    res.json(response);
  } catch (error) {
    await auditLogger.logError('BLIND_ASSIGNMENT_ERROR', error, {
      sdr_id: req.user?.id,
      user_agent: req.headers['user-agent'],
      ip_address: req.ip,
      error_type: 'system_error'
    });
    
    console.error('Blind assignment error:', error);
    
    if (error.message.includes('No active consultants')) {
      res.status(404).json({ 
        error: 'No active consultants available for assignment',
        code: 'NO_ACTIVE_CONSULTANTS'
      });
    } else if (error.message.includes('No suitable consultant')) {
      res.status(409).json({ 
        error: 'No suitable consultant found based on current assignment criteria',
        code: 'NO_SUITABLE_CONSULTANT'
      });
    } else {
      res.status(500).json({ 
        error: 'Internal server error during assignment',
        code: 'ASSIGNMENT_ERROR'
      });
    }
  }
};

const getMyAssignments = async (req, res) => {
  try {
    const sdrId = req.user.id;
    const assignments = await Assignment.findBySDR(sdrId);
    res.json(assignments);
  } catch (error) {
    console.error('Get my assignments error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getMyLatestAssignment = async (req, res) => {
  try {
    const sdrId = req.user.id;
    const assignment = await Assignment.findLatestBySDR(sdrId);
    
    if (!assignment) {
      return res.status(404).json({ error: 'No active assignments found' });
    }
    
    res.json(assignment);
  } catch (error) {
    console.error('Get latest assignment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getAllAssignments = async (req, res) => {
  try {
    const assignments = await Assignment.findAll();
    res.json(assignments);
  } catch (error) {
    console.error('Get all assignments error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const updateAssignmentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    if (!['active', 'completed', 'cancelled'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    
    const assignment = await Assignment.updateStatus(id, status);
    
    if (!assignment) {
      return res.status(404).json({ error: 'Assignment not found' });
    }
    
    res.json(assignment);
  } catch (error) {
    console.error('Update assignment status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getAssignmentStats = async (req, res) => {
  try {
    const stats = await Assignment.getAssignmentStats();
    res.json(stats);
  } catch (error) {
    console.error('Get assignment stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getChartAnalytics = async (req, res) => {
  try {
    console.log('Chart analytics called');
    
    // Simplified consultant distribution query first
    const consultantDistributionQuery = `
      SELECT 
        c.name as consultant_name,
        COUNT(a.id) as total_assignments,
        COUNT(CASE WHEN a.is_manual = 1 THEN 1 END) as manual_assignments,
        COUNT(CASE WHEN a.is_manual = 0 OR a.is_manual IS NULL THEN 1 END) as automatic_assignments,
        COUNT(CASE WHEN a.status = 'active' THEN 1 END) as active_assignments,
        COUNT(CASE WHEN a.status = 'completed' THEN 1 END) as completed_assignments
      FROM consultants c
      LEFT JOIN assignments a ON c.id = a.consultant_id
      WHERE c.is_active = 1
      GROUP BY c.id, c.name
      ORDER BY total_assignments DESC
    `;

    console.log('Running consultant distribution query...');
    const consultantDistributionResult = await pool.query(consultantDistributionQuery);
    console.log('Consultant distribution result:', consultantDistributionResult.rows);

    // Simple assignment trends (last 30 days)
    const trendsQuery = `
      SELECT 
        DATE(a.assigned_at) as assignment_date,
        COUNT(*) as total_assignments,
        COUNT(CASE WHEN a.is_manual = 1 THEN 1 END) as manual_assignments,
        COUNT(CASE WHEN a.is_manual = 0 OR a.is_manual IS NULL THEN 1 END) as automatic_assignments
      FROM assignments a
      WHERE DATE(a.assigned_at) >= DATE('now', '-30 days')
      GROUP BY DATE(a.assigned_at)
      ORDER BY assignment_date
    `;

    console.log('Running trends query...');
    const trendsResult = await pool.query(trendsQuery);
    console.log('Trends result:', trendsResult.rows);

    // SDR-Consultant matrix (simplified)
    const sdrConsultantQuery = `
      SELECT 
        CASE 
          WHEN a.is_manual = 1 THEN 'Manual Assignment'
          ELSE COALESCE(u.first_name || ' ' || u.last_name, 'Unknown SDR')
        END as sdr_name,
        c.name as consultant_name,
        COUNT(*) as assignment_count,
        AVG(CASE WHEN a.status = 'completed' THEN 1.0 ELSE 0.0 END) as completion_rate
      FROM assignments a
      LEFT JOIN users u ON a.sdr_id = u.id
      JOIN consultants c ON a.consultant_id = c.id
      GROUP BY 
        CASE 
          WHEN a.is_manual = 1 THEN 'Manual Assignment'
          ELSE COALESCE(u.first_name || ' ' || u.last_name, 'Unknown SDR')
        END, 
        c.name
      ORDER BY assignment_count DESC
    `;

    console.log('Running SDR-consultant query...');
    const sdrConsultantResult = await pool.query(sdrConsultantQuery);
    console.log('SDR-consultant result:', sdrConsultantResult.rows);

    res.json({
      sdrConsultantMatrix: sdrConsultantResult.rows,
      consultantDistribution: consultantDistributionResult.rows,
      assignmentTrends: trendsResult.rows,
      sdrBiasAnalysis: [], // Will implement later
      generated_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('Get chart analytics error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
};

const getAssignmentAnalytics = async (req, res) => {
  try {
    const { timeframe = '7d' } = req.query;
    const analytics = await AssignmentService.getAssignmentAnalytics(timeframe);
    
    await auditLogger.logSystemEvent('ANALYTICS_ACCESSED', {
      accessed_by: req.user.id,
      timeframe,
      timestamp: new Date().toISOString()
    });
    
    res.json({
      timeframe,
      analytics,
      generated_at: new Date().toISOString()
    });
  } catch (error) {
    await auditLogger.logError('GET_ANALYTICS_ERROR', error, {
      user_id: req.user?.id
    });
    console.error('Get assignment analytics error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getFairnessReport = async (req, res) => {
  try {
    const fairnessReport = await AssignmentService.getFairnessReport();
    
    await auditLogger.logSystemEvent('FAIRNESS_REPORT_ACCESSED', {
      accessed_by: req.user.id,
      fairness_score: fairnessReport.fairness_score,
      timestamp: new Date().toISOString()
    });
    
    res.json({
      ...fairnessReport,
      generated_at: new Date().toISOString()
    });
  } catch (error) {
    await auditLogger.logError('GET_FAIRNESS_REPORT_ERROR', error, {
      user_id: req.user?.id
    });
    console.error('Get fairness report error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getAuditLogs = async (req, res) => {
  try {
    const filters = {
      action: req.query.action,
      sdr_id: req.query.sdr_id ? parseInt(req.query.sdr_id) : undefined,
      consultant_id: req.query.consultant_id ? parseInt(req.query.consultant_id) : undefined,
      from_date: req.query.from_date,
      to_date: req.query.to_date,
      limit: req.query.limit ? parseInt(req.query.limit) : 100
    };

    const logs = await auditLogger.getAuditLogs(filters);
    
    await auditLogger.logSystemEvent('AUDIT_LOGS_ACCESSED', {
      accessed_by: req.user.id,
      filters,
      results_count: logs.length,
      timestamp: new Date().toISOString()
    });
    
    res.json({
      logs,
      filters,
      count: logs.length,
      generated_at: new Date().toISOString()
    });
  } catch (error) {
    await auditLogger.logError('GET_AUDIT_LOGS_ERROR', error, {
      user_id: req.user?.id
    });
    console.error('Get audit logs error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const forceRebalance = async (req, res) => {
  try {
    await auditLogger.logSystemEvent('FORCE_REBALANCE_INITIATED', {
      initiated_by: req.user.id,
      reason: req.body.reason || 'Manual rebalance',
      timestamp: new Date().toISOString()
    });

    // Reset assignment counts to ensure fair redistribution
    const resetQuery = `
      UPDATE assignment_counts 
      SET assignment_count = (
        SELECT COUNT(*) 
        FROM assignments 
        WHERE consultant_id = assignment_counts.consultant_id
      ),
      last_assigned_at = (
        SELECT MAX(assigned_at)
        FROM assignments 
        WHERE consultant_id = assignment_counts.consultant_id
      )
    `;
    
    await pool.query(resetQuery);
    
    await auditLogger.logSystemEvent('FORCE_REBALANCE_COMPLETED', {
      initiated_by: req.user.id,
      timestamp: new Date().toISOString()
    });

    res.json({
      message: 'Assignment counts rebalanced successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    await auditLogger.logError('FORCE_REBALANCE_ERROR', error, {
      user_id: req.user?.id
    });
    console.error('Force rebalance error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const createManagerOverride = async (req, res) => {
  console.log('Manager override request received:', req.body);
  
  try {
    const { leadId, leadName, consultantId, reason, overrideType = 'manager_override' } = req.body;

    console.log('Parsed override data:', { leadId, leadName, consultantId, reason, overrideType });

    if (!leadId || !leadName || !consultantId || !reason) {
      console.log('Missing required fields for override');
      return res.status(400).json({ 
        error: 'Lead ID, lead name, consultant ID, and reason are required for manager override' 
      });
    }

    // Verify consultant exists and is active
    const consultant = await Consultant.findById(consultantId);
    if (!consultant) {
      return res.status(404).json({ error: 'Consultant not found' });
    }
    
    if (!consultant.is_active) {
      return res.status(400).json({ error: 'Consultant is not active' });
    }

    // Create manager override assignment with enhanced audit trail
    const Assignment = require('../models/Assignment');
    const assignmentDetails = await Assignment.createManual({
      leadId: leadId,
      leadName: leadName,
      consultantId: consultantId,
      isManual: true,
      manualReason: reason,
      createdBy: req.user.id,
      overrideType: overrideType
    });

    // Comprehensive audit logging for manager override
    await auditLogger.logSystemEvent('MANAGER_OVERRIDE_ASSIGNMENT', {
      manager_id: req.user.id,
      manager_info: `${req.user.first_name} ${req.user.last_name} (${req.user.username})`,
      lead_identifier: leadId,
      lead_name: leadName,
      consultant_id: consultantId,
      consultant_name: consultant.name,
      assignment_id: assignmentDetails.id,
      override_reason: reason,
      override_type: overrideType,
      timestamp: new Date().toISOString(),
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
      fairness_impact: 'bypassed_blind_system'
    });

    const response = {
      message: 'Manager override assignment created successfully',
      assignment: assignmentDetails,
      lead: {
        id: leadId,
        name: leadName
      },
      consultant: {
        id: consultant.id,
        name: consultant.name,
        email: consultant.email,
        phone: consultant.phone
      },
      override: {
        type: overrideType,
        reason: reason,
        managerId: req.user.id,
        timestamp: new Date().toISOString()
      }
    };

    res.status(201).json(response);
    
  } catch (error) {
    console.error('Manager override error:', error);
    
    try {
      await auditLogger.logError('MANAGER_OVERRIDE_ERROR', error, {
        manager_id: req.user?.id,
        lead_identifier: req.body?.leadId,
        consultant_id: req.body?.consultantId,
        error_type: 'override_failure'
      });
    } catch (auditError) {
      console.error('Audit logging failed:', auditError);
    }
    
    res.status(500).json({ 
      error: 'Internal server error during manager override',
      details: error.message 
    });
  }
};

const createManualAssignment = async (req, res) => {
  // Redirect to manager override for audit consistency
  req.body.overrideType = 'manual_assignment';
  return createManagerOverride(req, res);
};

const deleteAssignment = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason, rebalanceQueue = true } = req.body;

    console.log(`Delete assignment request for ID: ${id}`);

    if (!reason) {
      return res.status(400).json({ 
        error: 'Reason is required for assignment deletion' 
      });
    }

    // Get assignment details before deletion for audit trail
    const assignment = await Assignment.findById(id);
    if (!assignment) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    const consultant = await Consultant.findById(assignment.consultant_id);

    // Log deletion initiation
    await auditLogger.logSystemEvent('ASSIGNMENT_DELETION_INITIATED', {
      assignment_id: parseInt(id),
      assignment_details: {
        consultant_id: assignment.consultant_id,
        consultant_name: consultant?.name || 'Unknown',
        sdr_id: assignment.sdr_id,
        lead_identifier: assignment.lead_identifier,
        lead_name: assignment.lead_name,
        original_status: assignment.status,
        assigned_at: assignment.assigned_at
      },
      deletion_reason: reason,
      deleted_by: req.user.id,
      user_info: `${req.user.first_name} ${req.user.last_name} (${req.user.username})`,
      rebalance_requested: rebalanceQueue,
      timestamp: new Date().toISOString(),
      ip_address: req.ip,
      user_agent: req.headers['user-agent']
    });

    // Delete the assignment
    const deletedAssignment = await Assignment.deleteById(id);

    if (rebalanceQueue && consultant) {
      // Rebalance queue by updating assignment counts
      const rebalanceQuery = `
        UPDATE assignment_counts 
        SET assignment_count = assignment_count - 1,
            last_assigned_at = CASE 
              WHEN assignment_count > 1 THEN (
                SELECT MAX(assigned_at)
                FROM assignments 
                WHERE consultant_id = ? AND id != ?
              )
              ELSE NULL
            END
        WHERE consultant_id = ?
      `;
      
      await pool.query(rebalanceQuery, [assignment.consultant_id, id, assignment.consultant_id]);

      await auditLogger.logSystemEvent('QUEUE_REBALANCED_AFTER_DELETION', {
        assignment_id: parseInt(id),
        consultant_id: assignment.consultant_id,
        consultant_name: consultant.name,
        rebalance_action: 'decremented_assignment_count',
        triggered_by: req.user.id,
        timestamp: new Date().toISOString()
      });
    }

    // Log successful deletion
    await auditLogger.logSystemEvent('ASSIGNMENT_DELETED_SUCCESSFULLY', {
      assignment_id: parseInt(id),
      consultant_id: assignment.consultant_id,
      consultant_name: consultant?.name || 'Unknown',
      deletion_reason: reason,
      deleted_by: req.user.id,
      queue_rebalanced: rebalanceQueue,
      timestamp: new Date().toISOString()
    });

    res.json({
      message: 'Assignment deleted successfully',
      deletedAssignment: {
        id: assignment.id,
        consultant_name: consultant?.name || 'Unknown',
        lead_name: assignment.lead_name,
        status: assignment.status
      },
      rebalanced: rebalanceQueue,
      reason: reason,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Delete assignment error:', error);
    
    await auditLogger.logError('ASSIGNMENT_DELETION_ERROR', error, {
      assignment_id: req.params?.id,
      deleted_by: req.user?.id,
      error_type: 'deletion_failure'
    });
    
    res.status(500).json({ 
      error: 'Internal server error during assignment deletion',
      details: error.message 
    });
  }
};

const cancelAssignment = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason, reassignImmediately = false } = req.body;

    if (!reason) {
      return res.status(400).json({ 
        error: 'Reason is required for assignment cancellation' 
      });
    }

    const assignment = await Assignment.findById(id);
    if (!assignment) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    if (assignment.status === 'cancelled') {
      return res.status(400).json({ error: 'Assignment is already cancelled' });
    }

    const consultant = await Consultant.findById(assignment.consultant_id);

    // Log cancellation initiation
    await auditLogger.logSystemEvent('ASSIGNMENT_CANCELLATION_INITIATED', {
      assignment_id: parseInt(id),
      original_status: assignment.status,
      consultant_id: assignment.consultant_id,
      consultant_name: consultant?.name || 'Unknown',
      cancellation_reason: reason,
      cancelled_by: req.user.id,
      reassign_immediately: reassignImmediately,
      timestamp: new Date().toISOString()
    });

    // Update assignment status to cancelled
    const cancelledAssignment = await Assignment.updateStatus(id, 'cancelled', {
      cancellation_reason: reason,
      cancelled_by: req.user.id,
      cancelled_at: new Date().toISOString()
    });

    let reassignmentResult = null;

    if (reassignImmediately && assignment.sdr_id) {
      try {
        // Get next consultant for reassignment
        const nextConsultant = await AssignmentService.getNextConsultant(assignment.sdr_id);
        
        if (nextConsultant) {
          // Create new assignment
          reassignmentResult = await AssignmentService.createAssignment(assignment.sdr_id, nextConsultant.id, {
            leadId: assignment.lead_identifier,
            leadName: assignment.lead_name,
            isReassignment: true,
            originalAssignmentId: assignment.id,
            reassignmentReason: `Auto-reassignment due to cancellation: ${reason}`
          });

          await auditLogger.logSystemEvent('AUTOMATIC_REASSIGNMENT_COMPLETED', {
            original_assignment_id: parseInt(id),
            new_assignment_id: reassignmentResult.id,
            original_consultant_id: assignment.consultant_id,
            new_consultant_id: nextConsultant.id,
            reassignment_reason: reason,
            triggered_by: req.user.id,
            timestamp: new Date().toISOString()
          });
        }
      } catch (reassignError) {
        console.error('Reassignment failed:', reassignError);
        await auditLogger.logError('AUTOMATIC_REASSIGNMENT_FAILED', reassignError, {
          original_assignment_id: parseInt(id)
        });
      }
    }

    await auditLogger.logSystemEvent('ASSIGNMENT_CANCELLED_SUCCESSFULLY', {
      assignment_id: parseInt(id),
      consultant_id: assignment.consultant_id,
      cancellation_reason: reason,
      cancelled_by: req.user.id,
      reassignment_created: !!reassignmentResult,
      new_assignment_id: reassignmentResult?.id || null,
      timestamp: new Date().toISOString()
    });

    res.json({
      message: 'Assignment cancelled successfully',
      cancelledAssignment: cancelledAssignment,
      reassignment: reassignmentResult ? {
        id: reassignmentResult.id,
        consultant_name: reassignmentResult.consultant_name,
        created_at: reassignmentResult.assigned_at
      } : null,
      reason: reason,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Cancel assignment error:', error);
    
    await auditLogger.logError('ASSIGNMENT_CANCELLATION_ERROR', error, {
      assignment_id: req.params?.id,
      cancelled_by: req.user?.id
    });
    
    res.status(500).json({ 
      error: 'Internal server error during assignment cancellation',
      details: error.message 
    });
  }
};

module.exports = {
  getNextAssignment,
  getMyAssignments,
  getMyLatestAssignment,
  getAllAssignments,
  updateAssignmentStatus,
  getAssignmentStats,
  getChartAnalytics,
  getAssignmentAnalytics,
  getFairnessReport,
  getAuditLogs,
  forceRebalance,
  createManualAssignment,
  createManagerOverride,
  deleteAssignment,
  cancelAssignment
};