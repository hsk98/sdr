import React, { useState, useEffect, useCallback } from 'react';
import { assignmentAPI } from '../services/api';
import { useAutoSave } from '../hooks/useAutoSave';
import { useDataValidation } from '../hooks/useDataValidation';
import { useOfflineMode } from '../hooks/useOfflineMode';
import { useDataIntegrity } from '../hooks/useDataIntegrity';
import { useSkillsBasedAssignment } from '../hooks/useSkillsBasedAssignment';
import { auditLogger } from '../services/auditLogger';
import { useAuth } from '../contexts/AuthContext';
import SkillsSelector from './SkillsSelector';
import ReassignmentHistory from './ReassignmentHistory';
import { SkillRequirement, SkillsBasedAssignment } from '../types/skills';
import '../styles/skills-assignment.css';

interface BlindAssignmentProps {
  onAssignmentComplete: (assignment: any) => void;
  onError: (error: string) => void;
  onSuccess: (message: string) => void;
}

const BlindAssignment: React.FC<BlindAssignmentProps> = ({ 
  onAssignmentComplete, 
  onError, 
  onSuccess 
}) => {
  const { user } = useAuth();
  const [leadData, setLeadData] = useState({
    leadId: '',
    leadName: ''
  });
  const [isAssigning, setIsAssigning] = useState(false);
  const [assignmentResult, setAssignmentResult] = useState<any>(null);
  const [showResult, setShowResult] = useState(false);
  const [assignedLeadData, setAssignedLeadData] = useState<{leadId: string; leadName: string} | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{[key: string]: string}>({});
  const [warnings, setWarnings] = useState<string[]>([]);
  const [isRestoringData, setIsRestoringData] = useState(false);
  const [selectedSkills, setSelectedSkills] = useState<SkillRequirement[]>([]);
  const [, setSkillsValidation] = useState<{isValid: boolean; warnings: string[]}>({
    isValid: true,
    warnings: []
  });
  const [assignmentSkillsInfo, setAssignmentSkillsInfo] = useState<SkillsBasedAssignment | null>(null);
  const [isReassigning, setIsReassigning] = useState(false);
  const [reassignmentCount, setReassignmentCount] = useState(0);
  const [excludedConsultants, setExcludedConsultants] = useState<string[]>([]);

  // Initialize hooks
  const {
    validateForm,
    validateField,
    sanitizeInput,
    getLeadAssignmentRules,
    checkDuplicateLead,
    clearErrors
  } = useDataValidation();

  const {
    isOnline,
    executeOperation,
    queueSize
  } = useOfflineMode();

  const {
    performIntegrityCheck,
    isCheckingIntegrity
  } = useDataIntegrity();

  const {
    assignWithSkills,
    validateSkillsCombination,
    isMatching: isMatchingSkills
  } = useSkillsBasedAssignment();

  // Auto-save functionality
  const {
    saveImmediately,
    clearSavedData,
    hasSavedData
  } = useAutoSave({
    key: 'blind_assignment_form',
    data: { leadData, selectedSkills },
    enabled: !showResult,
    onSave: (data) => {
      console.log('[BlindAssignment] Auto-saved form data:', data);
    },
    onRestore: (data) => {
      console.log('[BlindAssignment] Restoring form data:', data);
      if (data.leadData) setLeadData(data.leadData);
      if (data.selectedSkills) setSelectedSkills(data.selectedSkills);
      setIsRestoringData(false);
    }
  });

  // Initialize audit logging
  useEffect(() => {
    if (user) {
      auditLogger.setContext({
        userId: user.id,
        userEmail: user.email,
        sessionId: `session_${Date.now()}`
      });
    }
  }, [user]);

  // Handle real-time field validation
  const handleFieldChange = useCallback((field: string, value: string) => {
    const sanitizedValue = sanitizeInput(value);
    setLeadData(prev => ({ ...prev, [field]: sanitizedValue }));
    
    // Real-time validation
    const rules = getLeadAssignmentRules();
    const error = validateField(field, sanitizedValue, rules);
    
    setFieldErrors(prev => {
      const newErrors = { ...prev };
      if (error) {
        newErrors[field] = error;
        auditLogger.logDataValidation(field, error, sanitizedValue);
      } else {
        delete newErrors[field];
      }
      return newErrors;
    });
  }, [sanitizeInput, validateField, getLeadAssignmentRules]);

  // Check for duplicates when lead data changes
  useEffect(() => {
    const checkDuplicates = async () => {
      if (leadData.leadId && leadData.leadName && leadData.leadId.length >= 3) {
        try {
          const isDuplicate = await checkDuplicateLead(leadData.leadId, leadData.leadName);
          if (isDuplicate) {
            setWarnings(prev => [
              ...prev.filter(w => !w.includes('duplicate')),
              `Warning: A lead with ID "${leadData.leadId}" or name "${leadData.leadName}" may already exist.`
            ]);
          } else {
            setWarnings(prev => prev.filter(w => !w.includes('duplicate')));
          }
        } catch (error) {
          console.warn('[BlindAssignment] Duplicate check failed:', error);
        }
      }
    };

    const timeoutId = setTimeout(checkDuplicates, 1000);
    return () => clearTimeout(timeoutId);
  }, [leadData.leadId, leadData.leadName, checkDuplicateLead]);

  // Validate skills combination when skills change
  useEffect(() => {
    const validateSkills = async () => {
      if (selectedSkills.length > 0) {
        try {
          const validation = await validateSkillsCombination(selectedSkills);
          setSkillsValidation(validation);
          
          if (!validation.isValid) {
            setWarnings(prev => [
              ...prev.filter(w => !w.includes('skill')),
              ...validation.warnings.map(w => `Skills: ${w}`)
            ]);
          } else {
            setWarnings(prev => prev.filter(w => !w.includes('Skills:')));
          }
        } catch (error) {
          console.warn('[BlindAssignment] Skills validation failed:', error);
        }
      } else {
        setSkillsValidation({ isValid: true, warnings: [] });
        setWarnings(prev => prev.filter(w => !w.includes('Skills:')));
      }
    };

    const timeoutId = setTimeout(validateSkills, 1500);
    return () => clearTimeout(timeoutId);
  }, [selectedSkills, validateSkillsCombination]);

  const handleBlindAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Clear previous warnings
    setWarnings([]);
    
    // Validate form data
    const rules = getLeadAssignmentRules();
    const isValidForm = validateForm(leadData, rules);
    
    if (!isValidForm) {
      onError('Please fix validation errors before submitting');
      return;
    }

    setIsAssigning(true);
    setAssignmentResult(null);
    setShowResult(false);

    try {
      const leadInfo = {
        leadId: sanitizeInput(leadData.leadId.trim()),
        leadName: sanitizeInput(leadData.leadName.trim())
      };

      // Log assignment attempt
      await auditLogger.log('assignment', 'assignment_attempt', {
        leadId: leadInfo.leadId,
        leadName: leadInfo.leadName,
        selectedSkills: selectedSkills.map(s => ({ skillId: s.skillId, priority: s.priority })),
        skillsBasedAssignment: selectedSkills.length > 0,
        isOnline,
        validationPassed: true
      });

      // Perform comprehensive integrity check
      console.log('[BlindAssignment] Performing integrity check...');
      const integrityResult = await performIntegrityCheck(leadInfo.leadId, leadInfo.leadName);
      
      await auditLogger.logIntegrityCheck(integrityResult);

      // Handle conflicts
      if (!integrityResult.isValid) {
        const errorMessages = integrityResult.conflicts.map(c => c.message);
        onError(`Cannot proceed with assignment: ${errorMessages.join(', ')}`);
        setIsAssigning(false);
        return;
      }

      // Show warnings if any
      if (integrityResult.warnings.length > 0) {
        const warningMessages = integrityResult.warnings.map(w => w.message);
        setWarnings(warningMessages);
      }

      // Save form data immediately before submission
      saveImmediately();

      let result;
      let skillsInfo: SkillsBasedAssignment | null = null;
      
      if (isOnline) {
        // Use skills-based assignment if skills are selected
        if (selectedSkills.length > 0) {
          console.log('[BlindAssignment] Attempting skills-based assignment...');
          const skillsResult = await assignWithSkills(leadInfo.leadId, leadInfo.leadName, selectedSkills);
          
          if (skillsResult.success) {
            result = skillsResult.assignment;
            skillsInfo = skillsResult.skillsInfo || null;
            
            // Show fallback message if partial match was used
            if (skillsResult.fallbackMessage) {
              setWarnings(prev => [...prev, skillsResult.fallbackMessage!]);
            }
          } else {
            onError(skillsResult.error || 'Skills-based assignment failed');
            if (skillsResult.fallbackMessage) {
              setWarnings(prev => [...prev, skillsResult.fallbackMessage!]);
            }
            setIsAssigning(false);
            return;
          }
        } else {
          // Standard assignment without skills
          console.log('[BlindAssignment] Attempting standard assignment...');
          result = await assignmentAPI.assignBlind(leadInfo);
        }
        
        // Log successful assignment
        await auditLogger.logAssignment('created', {
          ...leadInfo,
          ...result,
          assignmentMethod: selectedSkills.length > 0 ? 'skills-based' : 'blind',
          selectedSkills: selectedSkills.length > 0 ? selectedSkills : undefined,
          skillsInfo: skillsInfo || undefined,
          immediate: true
        });
        
        console.log('[BlindAssignment] Assignment completed successfully');
      } else {
        // Queue for offline processing
        console.log('[BlindAssignment] Offline - queuing assignment...');
        const { operationId } = await executeOperation('assignment', {
          ...leadInfo,
          selectedSkills: selectedSkills.length > 0 ? selectedSkills : undefined
        }, { immediate: false });
        
        await auditLogger.logOfflineAction('queued_assignment', {
          ...leadInfo,
          operationId
        });
        
        // Create mock result for UI
        result = {
          assignment: {
            id: `pending_${Date.now()}`,
            lead_identifier: leadInfo.leadId,
            lead_name: leadInfo.leadName,
            status: 'queued'
          },
          consultant: {
            name: 'Assignment Queued',
            email: 'Will be assigned when connection is restored'
          },
          isOfflineAssignment: true
        };
        
        onSuccess('Assignment queued successfully - will be processed when connection is restored!');
      }

      setAssignmentResult(result);
      setAssignmentSkillsInfo(skillsInfo);
      setAssignedLeadData(leadInfo);
      setShowResult(true);
      onAssignmentComplete(result);
      
      if (isOnline) {
        onSuccess(isReassigning ? 'Different consultant assigned successfully!' : 'Blind assignment completed successfully!');
      }
      
      // Only clear form if this is a new assignment, not a reassignment
      if (!isReassigning) {
        setLeadData({ leadId: '', leadName: '' });
        setSelectedSkills([]);
        clearSavedData();
        clearErrors();
        setFieldErrors({});
      }
      
    } catch (err: any) {
      console.error('[BlindAssignment] Assignment failed:', err);
      
      const errorMessage = err.response?.data?.error || err.message || 'Failed to create blind assignment';
      
      // Log the error
      await auditLogger.logSystemError(err, {
        leadId: leadData.leadId,
        leadName: leadData.leadName,
        context: 'blind_assignment'
      });

      // If online request failed, try queuing for offline processing
      if (isOnline && err.name !== 'ValidationError') {
        console.log('[BlindAssignment] Online request failed, queuing for offline processing...');
        try {
          await executeOperation('assignment', {
            leadId: sanitizeInput(leadData.leadId.trim()),
            leadName: sanitizeInput(leadData.leadName.trim())
          }, { immediate: false });
          
          onSuccess('Request failed but has been queued for retry when connection improves');
          return;
        } catch (queueError) {
          console.error('[BlindAssignment] Failed to queue assignment:', queueError);
        }
      }
      
      onError(`Assignment failed: ${errorMessage}`);
    } finally {
      setIsAssigning(false);
      setIsReassigning(false);
    }
  };

  const resetForm = () => {
    setLeadData({ leadId: '', leadName: '' });
    setSelectedSkills([]);
    setAssignmentResult(null);
    setAssignmentSkillsInfo(null);
    setAssignedLeadData(null);
    setShowResult(false);
    setIsReassigning(false);
    setReassignmentCount(0);
    setExcludedConsultants([]);
    clearSavedData();
    clearErrors();
    setFieldErrors({});
    setWarnings([]);
  };

  const handleRequestDifferentConsultant = async () => {
    if (!assignmentResult || !assignedLeadData) {
      onError('No current assignment to change');
      return;
    }

    // Add current consultant to exclusion list
    const currentConsultantId = assignmentResult.consultant?.id || assignmentResult.consultant?.name;
    if (currentConsultantId) {
      setExcludedConsultants(prev => [...prev, currentConsultantId]);
    }

    setIsReassigning(true);
    setIsAssigning(true);
    setReassignmentCount(prev => prev + 1);

    try {
      console.log(`[BlindAssignment] Requesting different consultant (attempt #${reassignmentCount + 1})...`);
      
      // Log reassignment attempt
      await auditLogger.log('assignment', 'reassignment_attempt', {
        originalAssignmentId: assignmentResult.assignment?.id,
        originalConsultant: assignmentResult.consultant?.name,
        leadId: assignedLeadData.leadId,
        leadName: assignedLeadData.leadName,
        reassignmentNumber: reassignmentCount + 1,
        excludedConsultants: excludedConsultants.concat(currentConsultantId)
      });

      let result;
      let skillsInfo: SkillsBasedAssignment | null = null;
      
      if (isOnline) {
        // Use skills-based assignment if skills were originally selected
        if (selectedSkills.length > 0) {
          console.log('[BlindAssignment] Requesting different consultant with skills...');
          const skillsResult = await assignWithSkills(
            assignedLeadData.leadId, 
            assignedLeadData.leadName, 
            selectedSkills,
            excludedConsultants.concat(currentConsultantId)
          );
          
          if (skillsResult.success) {
            result = skillsResult.assignment;
            skillsInfo = skillsResult.skillsInfo || null;
            
            if (skillsResult.fallbackMessage) {
              setWarnings(prev => [...prev, skillsResult.fallbackMessage!]);
            }
          } else {
            onError(skillsResult.error || 'Could not find a different qualified consultant');
            return;
          }
        } else {
          // Standard reassignment without skills
          console.log('[BlindAssignment] Requesting different consultant without skills...');
          result = await assignmentAPI.assignBlind({
            leadId: assignedLeadData.leadId,
            leadName: assignedLeadData.leadName,
            excludeConsultants: excludedConsultants.concat(currentConsultantId),
            isReassignment: true,
            originalAssignmentId: assignmentResult.assignment?.id,
            originalConsultantId: currentConsultantId,
            reassignmentReason: 'User requested different consultant'
          });
        }
        
        // Log successful reassignment
        await auditLogger.logAssignment('created', {
          ...assignedLeadData,
          ...result,
          originalAssignmentId: assignmentResult.assignment?.id,
          originalConsultant: assignmentResult.consultant?.name,
          newConsultant: result.consultant?.name,
          reassignmentNumber: reassignmentCount + 1,
          assignmentMethod: selectedSkills.length > 0 ? 'skills-based' : 'blind',
          selectedSkills: selectedSkills.length > 0 ? selectedSkills : undefined,
          skillsInfo: skillsInfo || undefined,
          immediate: true
        });
        
        console.log('[BlindAssignment] Reassignment completed successfully');
      } else {
        // Queue for offline processing
        console.log('[BlindAssignment] Offline - queuing reassignment...');
        const { operationId } = await executeOperation('assignment', {
          ...assignedLeadData,
          originalAssignmentId: assignmentResult.assignment?.id,
          excludeConsultants: excludedConsultants.concat(currentConsultantId),
          selectedSkills: selectedSkills.length > 0 ? selectedSkills : undefined
        }, { immediate: false });
        
        await auditLogger.logOfflineAction('queued_reassignment', {
          ...assignedLeadData,
          operationId,
          reassignmentNumber: reassignmentCount + 1
        });
        
        // Create mock result for UI
        result = {
          assignment: {
            id: assignmentResult.assignment?.id, // Keep same assignment ID
            lead_identifier: assignedLeadData.leadId,
            lead_name: assignedLeadData.leadName,
            status: 'queued_reassignment'
          },
          consultant: {
            name: 'Reassignment Queued',
            email: 'New consultant will be assigned when connection is restored'
          },
          isOfflineAssignment: true
        };
        
        onSuccess('Reassignment queued successfully - new consultant will be assigned when connection is restored!');
      }

      setAssignmentResult(result);
      setAssignmentSkillsInfo(skillsInfo);
      
      if (isOnline) {
        onSuccess(`Different consultant assigned successfully! (Assignment #${reassignmentCount + 1})`);
      }
      
    } catch (err: any) {
      console.error('[BlindAssignment] Reassignment failed:', err);
      
      const errorMessage = err.response?.data?.error || err.message || 'Failed to find different consultant';
      
      // Log the error
      await auditLogger.logSystemError(err, {
        leadId: assignedLeadData.leadId,
        leadName: assignedLeadData.leadName,
        context: 'consultant_reassignment',
        reassignmentNumber: reassignmentCount + 1
      });
      
      onError(`Could not find different consultant: ${errorMessage}`);
      
      // Revert reassignment count if failed
      setReassignmentCount(prev => Math.max(0, prev - 1));
    } finally {
      setIsAssigning(false);
      setIsReassigning(false);
    }
  };

  return (
    <div className="blind-assignment-container">
      <div className="blind-assignment-header">
        <h2>🎯 Meeting Assignment</h2>
        <p className="blind-description">
          Enter lead details and click "Assign Meeting" to get your consultant assignment. 
          The system will fairly assign the next available consultant.
        </p>
      </div>

      {/* System Status Indicators */}
      <div className="system-status">
        <div className={`status-indicator ${isOnline ? 'online' : 'offline'}`}>
          <span className="status-icon">{isOnline ? '🟢' : '🔴'}</span>
          <span>{isOnline ? 'Online' : 'Offline'}</span>
        </div>
        {queueSize > 0 && (
          <div className="status-indicator queued">
            <span className="status-icon">⏳</span>
            <span>{queueSize} queued</span>
          </div>
        )}
        {isCheckingIntegrity && (
          <div className="status-indicator checking">
            <span className="status-icon">🔍</span>
            <span>Checking...</span>
          </div>
        )}
      </div>

      {/* Data Recovery Notice */}
      {hasSavedData() && !isRestoringData && !showResult && (
        <div className="recovery-notice">
          <span className="recovery-icon">💾</span>
          <span>Unsaved data found. It has been automatically restored.</span>
        </div>
      )}

      {/* Warnings Display */}
      {warnings.length > 0 && (
        <div className="warnings-container">
          {warnings.map((warning, index) => (
            <div key={index} className="warning-item">
              <span className="warning-icon">⚠️</span>
              <span>{warning}</span>
            </div>
          ))}
        </div>
      )}

      {!showResult ? (
        <form onSubmit={handleBlindAssignment} className="blind-assignment-form">
          <div className="form-group">
            <label htmlFor="leadId">Lead ID:</label>
            <input
              id="leadId"
              type="text"
              value={leadData.leadId}
              onChange={(e) => handleFieldChange('leadId', e.target.value)}
              placeholder="e.g., SF001, 00Q5e00001abcde"
              disabled={isAssigning || isCheckingIntegrity}
              required
              className={fieldErrors.leadId ? 'error' : ''}
            />
            {fieldErrors.leadId && (
              <span className="field-error">{fieldErrors.leadId}</span>
            )}
            <small>Enter the lead identifier from your CRM system</small>
          </div>

          <div className="form-group">
            <label htmlFor="leadName">Lead/Company Name:</label>
            <input
              id="leadName"
              type="text"
              value={leadData.leadName}
              onChange={(e) => handleFieldChange('leadName', e.target.value)}
              placeholder="e.g., Acme Corp, John Doe - Tech Solutions"
              disabled={isAssigning || isCheckingIntegrity}
              required
              className={fieldErrors.leadName ? 'error' : ''}
            />
            {fieldErrors.leadName && (
              <span className="field-error">{fieldErrors.leadName}</span>
            )}
            <small>Enter the company or lead name for identification</small>
          </div>

          {/* Skills Selector */}
          <SkillsSelector
            selectedSkills={selectedSkills}
            onSkillsChange={setSelectedSkills}
            onValidationChange={(isValid, warnings) => setSkillsValidation({ isValid, warnings })}
            disabled={isAssigning || isCheckingIntegrity || isMatchingSkills}
            showAvailability={true}
          />

          <div className="blind-assignment-actions">
            <button 
              type="submit" 
              disabled={isAssigning || isCheckingIntegrity || isMatchingSkills || Object.keys(fieldErrors).length > 0}
              className="assign-meeting-btn"
            >
              {isAssigning || isCheckingIntegrity || isMatchingSkills ? (
                <>
                  <span className="spinner"></span>
                  {isCheckingIntegrity ? 'Validating...' : 
                   isMatchingSkills ? 'Matching Skills...' : 
                   (isOnline ? 'Assigning...' : 'Queuing...')}
                </>
              ) : (
                <>
                  <span>🎯</span>
                  {selectedSkills.length > 0 ? 
                    (isOnline ? 'Assign with Skills' : 'Queue Skills Assignment') :
                    (isOnline ? 'Assign Meeting' : 'Queue Assignment')
                  }
                </>
              )}
            </button>

            <button 
              type="button" 
              onClick={resetForm}
              disabled={isAssigning || isCheckingIntegrity || isMatchingSkills}
              className="clear-btn"
            >
              Clear
            </button>
          </div>

          <div className="blind-assignment-info">
            <div className="info-item">
              <span className="info-icon">🔒</span>
              <span>Consultant selection is completely blind and fair</span>
            </div>
            <div className="info-item">
              <span className="info-icon">📊</span>
              <span>System uses round-robin algorithm for equal distribution</span>
            </div>
            <div className="info-item">
              <span className="info-icon">🛡️</span>
              <span>All assignments are logged for audit trail</span>
            </div>
            <div className="info-item">
              <span className="info-icon">💾</span>
              <span>Data auto-saved every 3 seconds for recovery</span>
            </div>
            <div className="info-item">
              <span className="info-icon">🔍</span>
              <span>Real-time validation and duplicate detection</span>
            </div>
            {!isOnline && (
              <div className="info-item offline-notice">
                <span className="info-icon">📡</span>
                <span>Offline mode - assignments will be processed when online</span>
              </div>
            )}
          </div>
        </form>
      ) : (
        <div className="assignment-result">
          <div className="announcement-banner">
            <div className="announcement-icon">🎯</div>
            <div className="announcement-content">
              <h2>Assignment Complete!</h2>
              <p className="lead-info">Lead: <strong>{assignedLeadData?.leadName}</strong> ({assignedLeadData?.leadId})</p>
              <div className="assigned-to">
                <span>Assigned to:</span>
                <div className="consultant-name">{assignmentResult.consultant?.name}</div>
              </div>
            </div>
          </div>

          <div className="consultant-details-card">
            <div className="consultant-avatar">
              {assignmentResult.consultant?.name?.split(' ').map((n: string) => n[0]).join('').toUpperCase() || ''}
            </div>
            <div className="consultant-info">
              <h4>{assignmentResult.consultant?.name}</h4>
              <div className="contact-details">
                <div className="contact-item">
                  <span className="contact-icon">📧</span>
                  <span>{assignmentResult.consultant?.email}</span>
                </div>
                {assignmentResult.consultant?.phone && (
                  <div className="contact-item">
                    <span className="contact-icon">📞</span>
                    <span>{assignmentResult.consultant?.phone}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="assignment-metadata">
            <div className="meta-item">
              <span className="meta-label">Lead</span>
              <span className="meta-value">{assignedLeadData?.leadName}</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">Lead ID</span>
              <span className="meta-value">{assignedLeadData?.leadId}</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">Assignment ID</span>
              <span className="meta-value">
                #{assignmentResult.assignment?.id}
                {reassignmentCount > 0 && (
                  <span className="reassignment-badge">Assignment #{reassignmentCount + 1}</span>
                )}
              </span>
            </div>
            <div className="meta-item">
              <span className="meta-label">Method</span>
              <span className="meta-value">
                {assignmentSkillsInfo ? 'Skills-Based Assignment' : 'Blind Round-Robin'}
              </span>
            </div>
            {assignmentSkillsInfo && (
              <>
                <div className="meta-item">
                  <span className="meta-label">Match Score</span>
                  <span className="meta-value">{Math.round(assignmentSkillsInfo.matchScore * 100)}%</span>
                </div>
                <div className="meta-item">
                  <span className="meta-label">Match Type</span>
                  <span className="meta-value">
                    {assignmentSkillsInfo.fallbackUsed ? 'Partial Match' : 'Exact Match'}
                  </span>
                </div>
              </>
            )}
            <div className="meta-item">
              <span className="meta-label">Assigned</span>
              <span className="meta-value">Just now</span>
            </div>
          </div>

          {/* Skills Matching Information */}
          {assignmentSkillsInfo && assignmentSkillsInfo.matchedSkills.length > 0 && (
            <div className="skills-match-info">
              <div className="skills-match-header">
                <span className="skills-icon">🎯</span>
                <h4>Skills Match Information</h4>
                <div className={`match-score-badge ${assignmentSkillsInfo.fallbackUsed ? 'partial' : 'exact'}`}>
                  {Math.round(assignmentSkillsInfo.matchScore * 100)}% Match
                </div>
              </div>
              
              <div className="matched-skills">
                <h5>Matched Skills:</h5>
                <div className="skills-list">
                  {assignmentSkillsInfo.matchedSkills.map((skill, index) => (
                    <span key={index} className="skill-badge matched">
                      ✅ {skill.name}
                    </span>
                  ))}
                </div>
              </div>

              {assignmentSkillsInfo.fallbackUsed && (
                <div className="fallback-notice">
                  <span className="fallback-icon">ℹ️</span>
                  <span>
                    This assignment uses the best available consultant. Some required skills may not be perfectly matched.
                  </span>
                </div>
              )}

              <div className="consultant-qualifications">
                <h5>Why {assignmentResult.consultant?.name} was selected:</h5>
                <ul className="qualification-list">
                  <li>
                    <span className="qualification-icon">🎯</span>
                    Best skill match among available consultants ({Math.round(assignmentSkillsInfo.matchScore * 100)}% compatibility)
                  </li>
                  <li>
                    <span className="qualification-icon">⚖️</span>
                    Maintains fair distribution within the skilled consultant pool
                  </li>
                  {assignmentSkillsInfo.matchedSkills.length > 0 && (
                    <li>
                      <span className="qualification-icon">✅</span>
                      Qualified in {assignmentSkillsInfo.matchedSkills.length} of the requested skill{assignmentSkillsInfo.matchedSkills.length !== 1 ? 's' : ''}
                    </li>
                  )}
                </ul>
              </div>

              {assignmentSkillsInfo.alternativeConsultants && assignmentSkillsInfo.alternativeConsultants.length > 0 && (
                <div className="alternative-consultants">
                  <h5>Other qualified consultants:</h5>
                  <div className="alternatives-list">
                    {assignmentSkillsInfo.alternativeConsultants.slice(0, 2).map((alt, index) => (
                      <div key={index} className="alternative-item">
                        <span className="alt-name">{alt.consultantName}</span>
                        <span className="alt-score">{Math.round(alt.matchScore * 100)}% match</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Simple Completion Note */}
          <div className="completion-note">
            <div className="note-header">
              <span className="note-icon">📋</span>
              <h4>Next Step</h4>
            </div>
            <p className="note-text">
              Please update the Salesforce record for <strong>{assignedLeadData?.leadName}</strong> with consultant <strong>{assignmentResult.consultant?.name}</strong> and mark the assignment as complete.
            </p>
          </div>

          <div className="result-actions">
            <button 
              onClick={handleRequestDifferentConsultant}
              disabled={isAssigning || isReassigning}
              className="request-different-btn"
            >
              {isReassigning ? (
                <>
                  <span className="spinner"></span>
                  Finding different consultant...
                </>
              ) : (
                <>
                  <span>🔄</span>
                  Request Different Consultant
                </>
              )}
            </button>
            <button 
              onClick={() => {
                // Copy comprehensive assignment info to clipboard
                const assignmentInfo = `Assignment Details:
Lead: ${assignedLeadData?.leadName} (${assignedLeadData?.leadId})
Consultant: ${assignmentResult.consultant?.name}
Email: ${assignmentResult.consultant?.email}
Phone: ${assignmentResult.consultant?.phone || 'N/A'}
Assignment ID: #${assignmentResult.assignment?.id}${reassignmentCount > 0 ? ` (Assignment #${reassignmentCount + 1})` : ''}
Assigned: ${new Date().toLocaleString()}

Next Steps:
- Update Salesforce record status to "Assigned"
- Set consultant field to ${assignmentResult.consultant?.name}
- Add consultant email: ${assignmentResult.consultant?.email}
- Schedule meeting with consultant`;
                
                navigator.clipboard.writeText(assignmentInfo).then(() => {
                  onSuccess('Assignment details copied to clipboard!');
                }).catch(() => {
                  console.log('Could not copy to clipboard');
                  // Fallback: show the info in an alert
                  alert(assignmentInfo);
                });
              }}
              className="copy-info-btn"
              disabled={isAssigning || isReassigning}
            >
              <span>📋</span>
              Copy Assignment Details
            </button>
            <button 
              onClick={resetForm}
              className="assign-another-btn"
              disabled={isAssigning || isReassigning}
            >
              <span>➕</span>
              Assign Another Meeting
            </button>
          </div>

          {/* Reassignment History */}
          <ReassignmentHistory 
            assignmentId={assignmentResult?.assignment?.id}
            inline={true}
            showFullHistory={false}
          />
        </div>
      )}

    </div>
  );
};

export default BlindAssignment;