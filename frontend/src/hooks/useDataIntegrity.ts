import { useState, useCallback, useRef } from 'react';

interface ConsultantAvailability {
  id: number;
  name: string;
  email: string;
  isActive: boolean;
  currentAssignments: number;
  maxAssignments: number;
  lastAssignedAt: string | null;
}

interface AssignmentConflict {
  type: 'duplicate_lead' | 'consultant_overload' | 'quota_exceeded' | 'consultant_unavailable';
  message: string;
  severity: 'warning' | 'error';
  data?: any;
}

interface IntegrityCheckResult {
  isValid: boolean;
  conflicts: AssignmentConflict[];
  warnings: AssignmentConflict[];
}

export const useDataIntegrity = () => {
  const [isCheckingIntegrity, setIsCheckingIntegrity] = useState(false);
  const [lastCheckTime, setLastCheckTime] = useState<Date | null>(null);
  const consultantCacheRef = useRef<Map<number, ConsultantAvailability>>(new Map());
  const duplicateCheckCacheRef = useRef<Map<string, boolean>>(new Map());

  // Cache consultant data to reduce API calls
  const updateConsultantCache = useCallback((consultant: ConsultantAvailability) => {
    consultantCacheRef.current.set(consultant.id, {
      ...consultant,
      lastAssignedAt: new Date().toISOString()
    });
  }, []);

  // Check consultant availability
  const checkConsultantAvailability = useCallback(async (consultantId: number): Promise<{
    available: boolean;
    consultant?: ConsultantAvailability;
    reason?: string;
  }> => {
    try {
      // Check cache first (valid for 1 minute)
      const cached = consultantCacheRef.current.get(consultantId);
      if (cached) {
        const cacheAge = Date.now() - new Date(cached.lastAssignedAt || 0).getTime();
        if (cacheAge < 60000) { // 1 minute cache
          return {
            available: cached.isActive && cached.currentAssignments < cached.maxAssignments,
            consultant: cached,
            reason: !cached.isActive ? 'Consultant is inactive' : 
                   cached.currentAssignments >= cached.maxAssignments ? 'Consultant has reached maximum assignments' : undefined
          };
        }
      }

      // Fetch fresh data from API
      const response = await fetch(`/api/consultants/${consultantId}/availability`);
      if (!response.ok) {
        throw new Error('Failed to check consultant availability');
      }

      const consultant: ConsultantAvailability = await response.json();
      
      // Update cache
      updateConsultantCache(consultant);

      return {
        available: consultant.isActive && consultant.currentAssignments < consultant.maxAssignments,
        consultant,
        reason: !consultant.isActive ? 'Consultant is inactive' : 
               consultant.currentAssignments >= consultant.maxAssignments ? 'Consultant has reached maximum assignments' : undefined
      };
    } catch (error) {
      console.error('[DataIntegrity] Failed to check consultant availability:', error);
      return {
        available: false,
        reason: 'Unable to verify consultant availability'
      };
    }
  }, [updateConsultantCache]);

  // Check for duplicate leads
  const checkDuplicateLead = useCallback(async (leadId: string, leadName: string): Promise<{
    isDuplicate: boolean;
    existingAssignment?: any;
  }> => {
    try {
      const cacheKey = `${leadId}_${leadName}`.toLowerCase();
      
      // Check cache first
      if (duplicateCheckCacheRef.current.has(cacheKey)) {
        return { isDuplicate: duplicateCheckCacheRef.current.get(cacheKey)! };
      }

      const response = await fetch('/api/assignments/check-duplicate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId, leadName })
      });

      if (!response.ok) {
        throw new Error('Failed to check for duplicate leads');
      }

      const result = await response.json();
      
      // Cache result for 5 minutes
      duplicateCheckCacheRef.current.set(cacheKey, result.isDuplicate);
      setTimeout(() => {
        duplicateCheckCacheRef.current.delete(cacheKey);
      }, 300000);

      return result;
    } catch (error) {
      console.error('[DataIntegrity] Failed to check for duplicates:', error);
      return { isDuplicate: false };
    }
  }, []);

  // Check assignment quotas
  const checkAssignmentQuotas = useCallback(async (): Promise<{
    withinQuota: boolean;
    currentCount: number;
    maxCount: number;
    resetTime?: string;
  }> => {
    try {
      const response = await fetch('/api/assignments/quota-status');
      if (!response.ok) {
        throw new Error('Failed to check assignment quotas');
      }

      const quotaData = await response.json();
      return {
        withinQuota: quotaData.currentCount < quotaData.maxCount,
        currentCount: quotaData.currentCount,
        maxCount: quotaData.maxCount,
        resetTime: quotaData.resetTime
      };
    } catch (error) {
      console.error('[DataIntegrity] Failed to check quotas:', error);
      return {
        withinQuota: true,
        currentCount: 0,
        maxCount: Infinity
      };
    }
  }, []);

  // Comprehensive integrity check before assignment
  const performIntegrityCheck = useCallback(async (
    leadId: string,
    leadName: string,
    consultantId?: number
  ): Promise<IntegrityCheckResult> => {
    setIsCheckingIntegrity(true);
    const conflicts: AssignmentConflict[] = [];
    const warnings: AssignmentConflict[] = [];

    try {
      // 1. Check for duplicate leads
      const duplicateCheck = await checkDuplicateLead(leadId, leadName);
      if (duplicateCheck.isDuplicate) {
        conflicts.push({
          type: 'duplicate_lead',
          severity: 'error',
          message: `Lead "${leadName}" (${leadId}) already has an active assignment`,
          data: duplicateCheck.existingAssignment
        });
      }

      // 2. Check consultant availability if specified
      if (consultantId) {
        const availabilityCheck = await checkConsultantAvailability(consultantId);
        if (!availabilityCheck.available) {
          conflicts.push({
            type: 'consultant_unavailable',
            severity: 'error',
            message: availabilityCheck.reason || 'Consultant is not available',
            data: availabilityCheck.consultant
          });
        }
      }

      // 3. Check assignment quotas
      const quotaCheck = await checkAssignmentQuotas();
      if (!quotaCheck.withinQuota) {
        conflicts.push({
          type: 'quota_exceeded',
          severity: 'error',
          message: `Assignment quota exceeded (${quotaCheck.currentCount}/${quotaCheck.maxCount})`,
          data: quotaCheck
        });
      } else if (quotaCheck.currentCount > quotaCheck.maxCount * 0.9) {
        // Warning when approaching quota limit
        warnings.push({
          type: 'quota_exceeded',
          severity: 'warning',
          message: `Approaching assignment quota (${quotaCheck.currentCount}/${quotaCheck.maxCount})`,
          data: quotaCheck
        });
      }

      // 4. Additional business rule checks could go here
      
      setLastCheckTime(new Date());
      
      return {
        isValid: conflicts.length === 0,
        conflicts,
        warnings
      };
    } catch (error) {
      console.error('[DataIntegrity] Integrity check failed:', error);
      conflicts.push({
        type: 'consultant_unavailable',
        severity: 'error',
        message: 'Unable to perform complete integrity check. Proceed with caution.'
      });

      return {
        isValid: false,
        conflicts,
        warnings
      };
    } finally {
      setIsCheckingIntegrity(false);
    }
  }, [checkDuplicateLead, checkConsultantAvailability, checkAssignmentQuotas]);

  // Verify assignment after creation
  const verifyAssignment = useCallback(async (assignmentId: number): Promise<{
    isValid: boolean;
    assignment?: any;
    error?: string;
  }> => {
    try {
      const response = await fetch(`/api/assignments/${assignmentId}/verify`);
      if (!response.ok) {
        throw new Error('Failed to verify assignment');
      }

      const assignment = await response.json();
      
      // Additional verification logic could go here
      return {
        isValid: true,
        assignment
      };
    } catch (error) {
      console.error('[DataIntegrity] Assignment verification failed:', error);
      return {
        isValid: false,
        error: error instanceof Error ? error.message : 'Unknown verification error'
      };
    }
  }, []);

  // Real-time conflict monitoring
  const startConflictMonitoring = useCallback((
    leadId: string,
    leadName: string,
    onConflict: (conflicts: AssignmentConflict[]) => void,
    intervalMs: number = 30000
  ) => {
    const checkForConflicts = async () => {
      const result = await performIntegrityCheck(leadId, leadName);
      if (result.conflicts.length > 0 || result.warnings.length > 0) {
        onConflict([...result.conflicts, ...result.warnings]);
      }
    };

    // Initial check
    checkForConflicts();

    // Set up interval monitoring
    const interval = setInterval(checkForConflicts, intervalMs);

    // Return cleanup function
    return () => clearInterval(interval);
  }, [performIntegrityCheck]);

  // Clear caches
  const clearCaches = useCallback(() => {
    consultantCacheRef.current.clear();
    duplicateCheckCacheRef.current.clear();
    console.log('[DataIntegrity] Caches cleared');
  }, []);

  return {
    isCheckingIntegrity,
    lastCheckTime,
    performIntegrityCheck,
    checkConsultantAvailability,
    checkDuplicateLead,
    checkAssignmentQuotas,
    verifyAssignment,
    startConflictMonitoring,
    clearCaches
  };
};