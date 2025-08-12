const db = require('../config/database');
const AssignmentService = require('../services/AssignmentService');
const auditLogger = require('../utils/logger');

/**
 * Enhanced assignment creation that supports reassignment tracking
 */
const createAssignmentWithTracking = async (req, res) => {
  const startTime = Date.now();
  
  try {
    const sdrId = req.user.id;
    const sdrInfo = `${req.user.first_name} ${req.user.last_name} (${req.user.username})`;
    const { 
      leadId, 
      leadName,
      excludeConsultants = [],
      isReassignment = false,
      originalAssignmentId = null,
      originalConsultantId = null,
      reassignmentReason = null,
      skillsRequirements = [],
      skillsMatchScore = null,
      assignmentMethod = 'round_robin'
    } = req.body;

    // Enhanced audit logging with reassignment context
    await auditLogger.logSystemEvent('ASSIGNMENT_REQUEST', {
      sdr_id: sdrId,
      sdr_info: sdrInfo,
      lead_info: { leadId, leadName },
      is_reassignment: isReassignment,
      original_assignment_id: originalAssignmentId,
      excluded_consultants: excludeConsultants,
      assignment_method: assignmentMethod,
      timestamp: new Date().toISOString(),
      ip_address: req.ip,
      user_agent: req.headers['user-agent']
    });

    // Get consultants with exclusion logic
    let consultants = await AssignmentService.getConsultantsWithStats();
    
    // Filter out excluded consultants
    if (excludeConsultants.length > 0) {
      consultants = consultants.filter(consultant => 
        !excludeConsultants.includes(consultant.id.toString()) &&
        !excludeConsultants.includes(consultant.name)
      );
      
      console.log(`[ReassignmentController] Excluded ${excludeConsultants.length} consultants, ${consultants.length} remaining`);
    }
    
    if (consultants.length === 0) {
      await auditLogger.logSystemEvent('ASSIGNMENT_FAILED_NO_CONSULTANTS', {
        sdr_id: sdrId,
        reason: 'No available consultants after exclusions',
        excluded_consultants: excludeConsultants
      });
      
      return res.status(404).json({ 
        error: 'No available consultants for assignment',
        code: 'NO_CONSULTANTS_AVAILABLE',
        details: excludeConsultants.length > 0 ? 'All available consultants have been excluded' : 'No active consultants'
      });
    }

    // Select consultant using enhanced round-robin logic
    let selectedConsultant;
    try {
      selectedConsultant = await AssignmentService.selectConsultantUsingAdvancedRoundRobin(consultants, sdrId);
    } catch (error) {
      console.error('Advanced round-robin failed, using simple fallback:', error);
      selectedConsultant = consultants.sort((a, b) => a.assignment_count - b.assignment_count)[0];
    }
    
    if (!selectedConsultant) {
      await auditLogger.logSystemEvent('ASSIGNMENT_FAILED_NO_CONSULTANT', {
        sdr_id: sdrId,
        reason: 'No suitable consultant found',
        available_consultants: consultants.length
      });
      
      return res.status(404).json({ 
        error: 'No suitable consultant found for assignment',
        code: 'NO_SUITABLE_CONSULTANT'
      });
    }

    // Create the assignment with enhanced tracking data
    const assignmentData = {
      leadId: leadId || `assignment_${Date.now()}`,
      leadName: leadName || 'Assignment',
      consultantId: selectedConsultant.id,
      isManual: false,
      manualReason: isReassignment ? `Reassignment from consultant ${originalConsultantId}` : 'System assignment',
      createdBy: sdrId,
      
      // Enhanced tracking fields
      leadIdentifier: leadId,
      assignmentMethod: assignmentMethod,
      skillsData: JSON.stringify({
        requirements: skillsRequirements,
        matchScore: skillsMatchScore,
        isSkillsBased: skillsRequirements.length > 0
      }),
      originalAssignmentId: originalAssignmentId,
      reassignmentReason: reassignmentReason
    };

    // Create assignment record
    const assignmentDetails = await createAssignmentWithEnhancedTracking(assignmentData);
    
    // If this is a reassignment, create reassignment tracking record
    if (isReassignment && originalAssignmentId && originalConsultantId) {
      await createReassignmentRecord({
        assignmentId: assignmentDetails.id,
        sdrId: sdrId,
        originalConsultantId: originalConsultantId,
        newConsultantId: selectedConsultant.id,
        leadIdentifier: leadId,
        leadName: leadName,
        reason: reassignmentReason,
        skillsRequirements: skillsRequirements,
        exclusionList: excludeConsultants,
        skillsMatchScore: skillsMatchScore,
        processingTime: Date.now() - startTime,
        sessionId: req.headers['x-session-id'],
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip
      });
    }

    const response = {
      message: isReassignment ? 'Reassignment completed successfully' : 'Assignment created successfully',
      assignment: assignmentDetails,
      consultant: {
        id: selectedConsultant.id,
        name: selectedConsultant.name,
        email: selectedConsultant.email,
        phone: selectedConsultant.phone
      },
      metadata: {
        assignment_method: assignmentMethod,
        fairness_score: selectedConsultant.fairness_score,
        assignment_count: selectedConsultant.assignment_count,
        last_assigned_at: selectedConsultant.last_assigned_at,
        is_reassignment: isReassignment,
        original_assignment_id: originalAssignmentId,
        excluded_consultants_count: excludeConsultants.length,
        skills_based: skillsRequirements.length > 0,
        skills_match_score: skillsMatchScore,
        processing_time_ms: Date.now() - startTime,
        assigned_at: new Date().toISOString()
      }
    };

    // Enhanced success audit logging
    await auditLogger.logSystemEvent('ASSIGNMENT_COMPLETED', {
      sdr_id: sdrId,
      consultant_id: selectedConsultant.id,
      consultant_name: selectedConsultant.name,
      assignment_id: assignmentDetails.id,
      lead_info: { leadId, leadName },
      is_reassignment: isReassignment,
      original_assignment_id: originalAssignmentId,
      fairness_metrics: {
        consultant_assignment_count: selectedConsultant.assignment_count,
        fairness_score: selectedConsultant.fairness_score
      },
      performance_metrics: {
        processing_time_ms: Date.now() - startTime,
        consultants_evaluated: consultants.length,
        excluded_consultants: excludeConsultants.length
      },
      response_metadata: response.metadata
    });
    
    res.json(response);

  } catch (error) {
    await auditLogger.logError('ASSIGNMENT_ERROR', error, {
      sdr_id: req.user?.id,
      user_agent: req.headers['user-agent'],
      ip_address: req.ip,
      processing_time_ms: Date.now() - startTime,
      error_type: 'system_error'
    });
    
    console.error('Assignment error:', error);
    
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
        code: 'ASSIGNMENT_ERROR',
        details: error.message
      });
    }
  }
};

/**
 * Create assignment with enhanced tracking fields
 */
const createAssignmentWithEnhancedTracking = async (assignmentData) => {
  const {
    leadId,
    leadName,
    consultantId,
    isManual,
    manualReason,
    createdBy,
    leadIdentifier,
    assignmentMethod,
    skillsData,
    originalAssignmentId,
    reassignmentReason
  } = assignmentData;

  const query = `
    INSERT INTO assignments (
      sdr_id, consultant_id, assigned_at, status,
      lead_identifier, lead_name, assignment_method,
      skills_data, original_assignment_id, reassignment_reason
    ) VALUES ($1, $2, CURRENT_TIMESTAMP, 'active', $3, $4, $5, $6, $7, $8)
    RETURNING id, assigned_at
  `;

  const result = await db.query(query, [
    createdBy,
    consultantId,
    leadIdentifier,
    leadName,
    assignmentMethod,
    skillsData,
    originalAssignmentId,
    reassignmentReason
  ]);

  // Update consultant assignment count
  await db.query(`
    INSERT INTO assignment_counts (consultant_id, assignment_count, last_assigned_at)
    VALUES ($1, 1, CURRENT_TIMESTAMP)
    ON CONFLICT (consultant_id)
    DO UPDATE SET 
      assignment_count = assignment_counts.assignment_count + 1,
      last_assigned_at = CURRENT_TIMESTAMP
  `, [consultantId]);

  return {
    id: result.rows[0].id,
    lead_identifier: leadId,
    lead_name: leadName,
    consultant_id: consultantId,
    assigned_at: result.rows[0].assigned_at,
    status: 'active'
  };
};

/**
 * Create detailed reassignment tracking record
 */
const createReassignmentRecord = async (reassignmentData) => {
  const {
    assignmentId,
    sdrId,
    originalConsultantId,
    newConsultantId,
    leadIdentifier,
    leadName,
    reason,
    skillsRequirements,
    exclusionList,
    skillsMatchScore,
    processingTime,
    sessionId,
    userAgent,
    ipAddress
  } = reassignmentData;

  // Get current reassignment count
  const countResult = await db.query(
    'SELECT COALESCE(reassignment_count, 0) as count FROM assignments WHERE id = $1',
    [assignmentId]
  );
  
  const reassignmentNumber = (countResult.rows[0]?.count || 0) + 1;

  const query = `
    INSERT INTO assignment_reassignments (
      assignment_id, sdr_id, original_consultant_id, new_consultant_id,
      reassignment_number, reason, lead_identifier, lead_name,
      new_skills_match_score, skills_requirements, exclusion_list,
      reassignment_source, processing_time_ms, session_id, user_agent, ip_address
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'user_request', $12, $13, $14, $15)
    RETURNING id, timestamp
  `;

  const result = await db.query(query, [
    assignmentId,
    sdrId,
    originalConsultantId,
    newConsultantId,
    reassignmentNumber,
    reason,
    leadIdentifier,
    leadName,
    skillsMatchScore,
    JSON.stringify(skillsRequirements),
    JSON.stringify(exclusionList),
    processingTime,
    sessionId,
    userAgent,
    ipAddress
  ]);

  console.log(`[ReassignmentController] Created reassignment record ${result.rows[0].id} for assignment ${assignmentId}`);
  
  return {
    reassignmentId: result.rows[0].id,
    reassignmentNumber: reassignmentNumber,
    timestamp: result.rows[0].timestamp
  };
};

/**
 * Get reassignment history for an assignment
 */
const getAssignmentHistory = async (req, res) => {
  try {
    const assignmentId = req.params.id;
    const sdrId = req.user.id;

    // Verify the assignment belongs to this SDR or user is admin
    const assignmentCheck = await db.query(
      'SELECT sdr_id FROM assignments WHERE id = $1',
      [assignmentId]
    );

    if (assignmentCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    if (assignmentCheck.rows[0].sdr_id !== sdrId && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get comprehensive assignment history
    const historyQuery = `
      SELECT 
        ar.*,
        oc.name as original_consultant_name,
        oc.email as original_consultant_email,
        nc.name as new_consultant_name,
        nc.email as new_consultant_email,
        u.username as sdr_username,
        u.first_name || ' ' || u.last_name as sdr_name
      FROM assignment_reassignments ar
      LEFT JOIN consultants oc ON ar.original_consultant_id = oc.id
      LEFT JOIN consultants nc ON ar.new_consultant_id = nc.id
      LEFT JOIN users u ON ar.sdr_id = u.id
      WHERE ar.assignment_id = $1
      ORDER BY ar.reassignment_number ASC
    `;

    const result = await db.query(historyQuery, [assignmentId]);

    // Also get current assignment details
    const assignmentQuery = `
      SELECT 
        a.*,
        c.name as current_consultant_name,
        c.email as current_consultant_email,
        c.phone as current_consultant_phone
      FROM assignments a
      JOIN consultants c ON a.consultant_id = c.id
      WHERE a.id = $1
    `;

    const assignmentResult = await db.query(assignmentQuery, [assignmentId]);

    res.json({
      assignment: assignmentResult.rows[0],
      reassignmentHistory: result.rows,
      totalReassignments: result.rows.length,
      lastReassignmentAt: result.rows.length > 0 ? result.rows[result.rows.length - 1].timestamp : null
    });

  } catch (error) {
    console.error('Failed to get assignment history:', error);
    res.status(500).json({ 
      error: 'Failed to get assignment history',
      details: error.message 
    });
  }
};

module.exports = {
  createAssignmentWithTracking,
  createAssignmentWithEnhancedTracking,
  createReassignmentRecord,
  getAssignmentHistory
};