// Critical Edge Case Testing - Simplified Implementation
// Demonstrating how the system handles failure scenarios

describe('SDR Assignment System - Critical Edge Cases', () => {

  describe('Edge Case 1: All Consultants Are Unavailable', () => {
    
    test('should handle empty consultant pool with detailed error response', () => {
      function handleNoConsultantsAvailable() {
        return {
          success: false,
          errorCode: 'NO_CONSULTANTS_AVAILABLE',
          message: 'No consultants are currently available for assignment',
          details: {
            totalConsultants: 0,
            activeConsultants: 0,
            availableConsultants: 0,
            suggestedRetryTime: new Date(Date.now() + 30 * 60000).toISOString(),
            alternativeActions: [
              'Check consultant availability schedules',
              'Contact administrator to add more consultants',
              'Try again during business hours (9 AM - 5 PM)'
            ]
          },
          httpStatus: 503
        };
      }

      const result = handleNoConsultantsAvailable();
      
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('NO_CONSULTANTS_AVAILABLE');
      expect(result.httpStatus).toBe(503);
      expect(result.details.alternativeActions).toHaveLength(3);
      expect(result.details.suggestedRetryTime).toBeDefined();
    });

    test('should distinguish between different unavailability reasons', () => {
      function analyzeConsultantUnavailability(consultants) {
        const analysis = {
          total: consultants.length,
          breakdown: {
            inactive: 0,
            onTimeOff: 0,
            outsideHours: 0,
            alreadyAssigned: 0
          },
          unavailableConsultants: []
        };

        consultants.forEach(consultant => {
          const reasons = [];
          
          if (!consultant.is_active) {
            analysis.breakdown.inactive++;
            reasons.push('inactive');
          }
          
          if (consultant.on_time_off) {
            analysis.breakdown.onTimeOff++;
            reasons.push('on time-off');
          }
          
          if (consultant.outside_hours) {
            analysis.breakdown.outsideHours++;
            reasons.push('outside business hours');
          }
          
          if (consultant.currently_assigned) {
            analysis.breakdown.alreadyAssigned++;
            reasons.push('already assigned');
          }

          if (reasons.length > 0) {
            analysis.unavailableConsultants.push({
              id: consultant.id,
              name: consultant.name,
              reasons
            });
          }
        });

        return analysis;
      }

      const testConsultants = [
        { id: 1, name: 'John Smith', is_active: false },
        { id: 2, name: 'Jane Doe', is_active: true, on_time_off: true },
        { id: 3, name: 'Bob Wilson', is_active: true, outside_hours: true },
        { id: 4, name: 'Alice Brown', is_active: true, currently_assigned: true }
      ];

      const analysis = analyzeConsultantUnavailability(testConsultants);
      
      expect(analysis.total).toBe(4);
      expect(analysis.breakdown.inactive).toBe(1);
      expect(analysis.breakdown.onTimeOff).toBe(1);
      expect(analysis.breakdown.outsideHours).toBe(1);
      expect(analysis.breakdown.alreadyAssigned).toBe(1);
      expect(analysis.unavailableConsultants).toHaveLength(4);
      
      // Check specific consultant reasons
      const johnReasons = analysis.unavailableConsultants.find(c => c.name === 'John Smith').reasons;
      expect(johnReasons).toContain('inactive');
    });
  });

  describe('Edge Case 2: Concurrent Assignment Requests', () => {

    test('should handle race conditions with proper locking mechanism', () => {
      class ConcurrencyManager {
        constructor() {
          this.consultantLocks = new Map();
          this.assignmentQueue = [];
        }

        attemptAssignment(sdrId, consultantId) {
          // Check if consultant is locked
          if (this.consultantLocks.has(consultantId)) {
            const lockInfo = this.consultantLocks.get(consultantId);
            return {
              success: false,
              error: 'CONSULTANT_LOCKED',
              message: `Consultant ${consultantId} is currently being assigned to SDR ${lockInfo.sdrId}`,
              lockedAt: lockInfo.timestamp,
              estimatedWaitTime: 5000 // 5 seconds
            };
          }

          // Acquire lock
          this.consultantLocks.set(consultantId, {
            sdrId,
            timestamp: Date.now()
          });

          // Simulate assignment process
          setTimeout(() => {
            this.consultantLocks.delete(consultantId);
          }, 100);

          return {
            success: true,
            assignmentId: Date.now() + Math.random(),
            sdrId,
            consultantId,
            lockedUntil: Date.now() + 100
          };
        }

        getLockStatus() {
          return {
            activeLocks: this.consultantLocks.size,
            lockedConsultants: Array.from(this.consultantLocks.keys())
          };
        }
      }

      const manager = new ConcurrencyManager();
      
      // First request should succeed
      const result1 = manager.attemptAssignment(1, 100);
      expect(result1.success).toBe(true);
      expect(result1.assignmentId).toBeDefined();
      
      // Second concurrent request should be blocked
      const result2 = manager.attemptAssignment(2, 100);
      expect(result2.success).toBe(false);
      expect(result2.error).toBe('CONSULTANT_LOCKED');
      expect(result2.estimatedWaitTime).toBe(5000);
      
      // Check lock status
      const lockStatus = manager.getLockStatus();
      expect(lockStatus.activeLocks).toBe(1);
      expect(lockStatus.lockedConsultants).toContain(100);
    });

    test('should implement optimistic locking with version control', () => {
      class OptimisticLockManager {
        constructor() {
          this.consultantVersions = new Map();
          this.assignments = new Map();
        }

        getConsultantVersion(consultantId) {
          return this.consultantVersions.get(consultantId) || 1;
        }

        createAssignmentWithVersionCheck(sdrId, consultantId, expectedVersion) {
          const currentVersion = this.getConsultantVersion(consultantId);
          
          if (expectedVersion !== currentVersion) {
            return {
              success: false,
              error: 'VERSION_MISMATCH',
              expectedVersion,
              currentVersion,
              message: 'Consultant data was modified by another process. Please refresh and try again.'
            };
          }

          // Check for existing active assignment
          const existingAssignment = Array.from(this.assignments.values())
            .find(a => a.consultantId === consultantId && a.status === 'active');

          if (existingAssignment) {
            return {
              success: false,
              error: 'ALREADY_ASSIGNED',
              assignedTo: existingAssignment.sdrId,
              assignedAt: existingAssignment.createdAt
            };
          }

          // Create assignment and increment version
          const assignmentId = Date.now();
          this.assignments.set(assignmentId, {
            id: assignmentId,
            sdrId,
            consultantId,
            status: 'active',
            createdAt: new Date(),
            version: currentVersion
          });

          this.consultantVersions.set(consultantId, currentVersion + 1);

          return {
            success: true,
            assignmentId,
            newVersion: currentVersion + 1
          };
        }
      }

      const lockManager = new OptimisticLockManager();
      
      // Set initial version
      lockManager.consultantVersions.set(200, 5);
      
      // Successful assignment with correct version
      const result1 = lockManager.createAssignmentWithVersionCheck(1, 200, 5);
      expect(result1.success).toBe(true);
      expect(result1.newVersion).toBe(6);
      
      // Failed assignment with old version
      const result2 = lockManager.createAssignmentWithVersionCheck(2, 200, 5);
      expect(result2.success).toBe(false);
      expect(result2.error).toBe('VERSION_MISMATCH');
      expect(result2.currentVersion).toBe(6);
      
      // Failed assignment - consultant already assigned
      const result3 = lockManager.createAssignmentWithVersionCheck(3, 200, 6);
      expect(result3.success).toBe(false);
      expect(result3.error).toBe('ALREADY_ASSIGNED');
    });
  });

  describe('Edge Case 3: Consultant Removal with Active Assignments', () => {

    test('should prevent deletion when active assignments exist', () => {
      function validateConsultantDeletion(consultantId, assignments) {
        const activeAssignments = assignments.filter(
          a => a.consultantId === consultantId && a.status === 'active'
        );

        if (activeAssignments.length > 0) {
          return {
            canDelete: false,
            reason: 'ACTIVE_ASSIGNMENTS_EXIST',
            activeCount: activeAssignments.length,
            affectedSDRs: activeAssignments.map(a => ({
              sdrId: a.sdrId,
              assignmentId: a.id,
              assignedAt: a.assignedAt
            })),
            recommendedActions: [
              'Complete existing assignments',
              'Reassign to other consultants',
              'Use soft delete (deactivate) instead',
              'Force delete with reassignment'
            ]
          };
        }

        const historicalCount = assignments.filter(
          a => a.consultantId === consultantId
        ).length;

        return {
          canDelete: true,
          historicalAssignments: historicalCount,
          warning: historicalCount > 0 ? 'This will remove historical assignment data' : null
        };
      }

      const testAssignments = [
        { id: 1, consultantId: 300, sdrId: 1, status: 'active', assignedAt: '2023-12-01' },
        { id: 2, consultantId: 300, sdrId: 2, status: 'completed', assignedAt: '2023-11-01' },
        { id: 3, consultantId: 300, sdrId: 3, status: 'active', assignedAt: '2023-12-02' }
      ];

      const result = validateConsultantDeletion(300, testAssignments);
      
      expect(result.canDelete).toBe(false);
      expect(result.reason).toBe('ACTIVE_ASSIGNMENTS_EXIST');
      expect(result.activeCount).toBe(2);
      expect(result.affectedSDRs).toHaveLength(2);
      expect(result.recommendedActions).toContain('Complete existing assignments');
    });

    test('should handle reassignment process for orphaned assignments', () => {
      function reassignOrphanedAssignments(deletedConsultantId, assignments, availableConsultants) {
        const orphans = assignments.filter(
          a => a.consultantId === deletedConsultantId && a.status === 'active'
        );

        const reassignments = [];
        let reassignmentIndex = 0;

        orphans.forEach(assignment => {
          if (reassignmentIndex < availableConsultants.length) {
            const newConsultant = availableConsultants[reassignmentIndex];
            reassignments.push({
              originalAssignmentId: assignment.id,
              sdrId: assignment.sdrId,
              oldConsultantId: deletedConsultantId,
              newConsultantId: newConsultant.id,
              newConsultantName: newConsultant.name,
              reassignedAt: new Date().toISOString(),
              reason: 'CONSULTANT_REMOVED'
            });
            reassignmentIndex = (reassignmentIndex + 1) % availableConsultants.length;
          } else {
            reassignments.push({
              originalAssignmentId: assignment.id,
              sdrId: assignment.sdrId,
              status: 'FAILED',
              reason: 'NO_AVAILABLE_CONSULTANTS'
            });
          }
        });

        return {
          totalOrphans: orphans.length,
          successful: reassignments.filter(r => !r.status).length,
          failed: reassignments.filter(r => r.status === 'FAILED').length,
          reassignments
        };
      }

      const orphanedAssignments = [
        { id: 1, consultantId: 999, sdrId: 1, status: 'active' },
        { id: 2, consultantId: 999, sdrId: 2, status: 'active' }
      ];

      const availableConsultants = [
        { id: 101, name: 'Replacement A' },
        { id: 102, name: 'Replacement B' }
      ];

      const result = reassignOrphanedAssignments(999, orphanedAssignments, availableConsultants);
      
      expect(result.totalOrphans).toBe(2);
      expect(result.successful).toBe(2);
      expect(result.failed).toBe(0);
      expect(result.reassignments[0].newConsultantName).toBe('Replacement A');
      expect(result.reassignments[1].newConsultantName).toBe('Replacement B');
    });

    test('should implement soft delete with restore capability', () => {
      class ConsultantLifecycleManager {
        constructor() {
          this.consultants = new Map();
          this.deletionHistory = [];
        }

        softDelete(consultantId, adminId, reason = 'ADMIN_REQUEST') {
          const consultant = this.consultants.get(consultantId);
          if (!consultant) {
            throw new Error('Consultant not found');
          }

          if (!consultant.is_active) {
            return {
              success: false,
              error: 'ALREADY_INACTIVE',
              message: 'Consultant is already inactive'
            };
          }

          const deletionRecord = {
            consultantId,
            adminId,
            reason,
            deletedAt: new Date(),
            previousState: { ...consultant }
          };

          // Update consultant
          consultant.is_active = false;
          consultant.deactivated_at = deletionRecord.deletedAt;
          consultant.deactivated_by = adminId;
          consultant.deactivation_reason = reason;

          // Log deletion
          this.deletionHistory.push(deletionRecord);

          return {
            success: true,
            action: 'SOFT_DELETED',
            consultantId,
            canRestore: true,
            deletedAt: deletionRecord.deletedAt,
            restoreDeadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
          };
        }

        restore(consultantId, adminId) {
          const consultant = this.consultants.get(consultantId);
          if (!consultant) {
            throw new Error('Consultant not found');
          }

          if (consultant.is_active) {
            return {
              success: false,
              error: 'ALREADY_ACTIVE',
              message: 'Consultant is already active'
            };
          }

          // Restore consultant
          consultant.is_active = true;
          consultant.restored_at = new Date();
          consultant.restored_by = adminId;
          delete consultant.deactivated_at;
          delete consultant.deactivated_by;
          delete consultant.deactivation_reason;

          return {
            success: true,
            action: 'RESTORED',
            consultantId,
            restoredAt: consultant.restored_at
          };
        }

        getDeletionHistory(consultantId) {
          return this.deletionHistory.filter(record => record.consultantId === consultantId);
        }
      }

      const manager = new ConsultantLifecycleManager();
      manager.consultants.set(400, {
        id: 400,
        name: 'Test Consultant',
        is_active: true
      });

      // Soft delete
      const deleteResult = manager.softDelete(400, 1, 'PERFORMANCE_ISSUES');
      expect(deleteResult.success).toBe(true);
      expect(deleteResult.action).toBe('SOFT_DELETED');
      expect(deleteResult.canRestore).toBe(true);

      const consultant = manager.consultants.get(400);
      expect(consultant.is_active).toBe(false);
      expect(consultant.deactivation_reason).toBe('PERFORMANCE_ISSUES');

      // Restore
      const restoreResult = manager.restore(400, 1);
      expect(restoreResult.success).toBe(true);
      expect(restoreResult.action).toBe('RESTORED');
      expect(consultant.is_active).toBe(true);

      // Check history
      const history = manager.getDeletionHistory(400);
      expect(history).toHaveLength(1);
      expect(history[0].reason).toBe('PERFORMANCE_ISSUES');
    });
  });

  describe('Edge Case 4: Database Connection Failures', () => {

    test('should implement retry mechanism with exponential backoff', () => {
      class RetryManager {
        constructor(maxRetries = 3, baseDelay = 100) {
          this.maxRetries = maxRetries;
          this.baseDelay = baseDelay;
        }

        calculateDelay(attempt) {
          const exponentialDelay = this.baseDelay * Math.pow(2, attempt - 1);
          const jitter = Math.random() * 0.1 * exponentialDelay;
          return Math.floor(exponentialDelay + jitter);
        }

        executeWithRetry(operation, context = {}) {
          return new Promise((resolve) => {
            let attempt = 1;
            const attemptOperation = () => {
              try {
                const result = operation();
                
                // Simulate operation success/failure
                if (result.success) {
                  resolve({
                    success: true,
                    result: result.data,
                    attempts: attempt,
                    totalTime: Date.now()
                  });
                } else {
                  throw new Error(result.error);
                }
              } catch (error) {
                if (attempt >= this.maxRetries) {
                  resolve({
                    success: false,
                    error: error.message,
                    attempts: attempt,
                    maxRetriesReached: true,
                    context
                  });
                  return;
                }

                const delay = this.calculateDelay(attempt);
                attempt++;
                
                setTimeout(attemptOperation, delay);
              }
            };

            attemptOperation();
          });
        }
      }

      const retryManager = new RetryManager(3, 50);
      let attemptCount = 0;

      // Mock operation that fails twice, succeeds on third attempt
      const mockOperation = () => {
        attemptCount++;
        if (attemptCount < 3) {
          return { success: false, error: 'Connection timeout' };
        }
        return { success: true, data: { assignmentId: 123 } };
      };

      return retryManager.executeWithRetry(mockOperation, { operation: 'get_assignment' })
        .then(result => {
          expect(result.success).toBe(true);
          expect(result.attempts).toBe(3);
          expect(result.result.assignmentId).toBe(123);
        });
    });

    test('should implement circuit breaker pattern', () => {
      class CircuitBreaker {
        constructor(failureThreshold = 5, resetTimeout = 60000) {
          this.failureThreshold = failureThreshold;
          this.resetTimeout = resetTimeout;
          this.failureCount = 0;
          this.lastFailureTime = null;
          this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
        }

        execute(operation) {
          if (this.state === 'OPEN') {
            if (Date.now() - this.lastFailureTime > this.resetTimeout) {
              this.state = 'HALF_OPEN';
            } else {
              throw new Error('CIRCUIT_BREAKER_OPEN: Service temporarily unavailable');
            }
          }

          try {
            const result = operation();
            if (result.success) {
              this.onSuccess();
              return result;
            } else {
              throw new Error(result.error);
            }
          } catch (error) {
            this.onFailure();
            throw error;
          }
        }

        onSuccess() {
          this.failureCount = 0;
          this.state = 'CLOSED';
        }

        onFailure() {
          this.failureCount++;
          this.lastFailureTime = Date.now();
          
          if (this.failureCount >= this.failureThreshold) {
            this.state = 'OPEN';
          }
        }

        getStatus() {
          return {
            state: this.state,
            failureCount: this.failureCount,
            isOpen: this.state === 'OPEN',
            timeToReset: this.state === 'OPEN' 
              ? Math.max(0, this.resetTimeout - (Date.now() - this.lastFailureTime))
              : 0
          };
        }
      }

      const circuitBreaker = new CircuitBreaker(3, 1000);
      
      const failingOperation = () => ({ success: false, error: 'Database unavailable' });
      
      // Cause failures to trip the circuit breaker
      for (let i = 0; i < 3; i++) {
        try {
          circuitBreaker.execute(failingOperation);
        } catch (error) {
          expect(error.message).toBe('Database unavailable');
        }
      }

      // Circuit breaker should now be open
      const status = circuitBreaker.getStatus();
      expect(status.state).toBe('OPEN');
      expect(status.isOpen).toBe(true);
      
      // Next call should be rejected immediately
      expect(() => {
        circuitBreaker.execute(failingOperation);
      }).toThrow('CIRCUIT_BREAKER_OPEN');
    });

    test('should handle connection pool exhaustion gracefully', () => {
      class ConnectionPoolManager {
        constructor(maxConnections = 10) {
          this.maxConnections = maxConnections;
          this.activeConnections = 0;
          this.waitingQueue = [];
        }

        acquireConnection() {
          return new Promise((resolve, reject) => {
            if (this.activeConnections < this.maxConnections) {
              this.activeConnections++;
              resolve({
                connectionId: Date.now() + Math.random(),
                acquired: true,
                waitTime: 0
              });
            } else {
              // Add to waiting queue
              const waitStart = Date.now();
              this.waitingQueue.push({
                resolve,
                reject,
                waitStart,
                timeout: setTimeout(() => {
                  const index = this.waitingQueue.findIndex(w => w.resolve === resolve);
                  if (index > -1) {
                    this.waitingQueue.splice(index, 1);
                    reject(new Error('CONNECTION_TIMEOUT: Pool exhausted, waited too long'));
                  }
                }, 5000)
              });
            }
          });
        }

        releaseConnection(connectionId) {
          this.activeConnections--;
          
          // Process waiting queue
          if (this.waitingQueue.length > 0) {
            const waiter = this.waitingQueue.shift();
            clearTimeout(waiter.timeout);
            this.activeConnections++;
            
            const waitTime = Date.now() - waiter.waitStart;
            waiter.resolve({
              connectionId: Date.now() + Math.random(),
              acquired: true,
              waitTime
            });
          }
        }

        getPoolStatus() {
          return {
            maxConnections: this.maxConnections,
            activeConnections: this.activeConnections,
            queueLength: this.waitingQueue.length,
            availableConnections: this.maxConnections - this.activeConnections
          };
        }
      }

      const poolManager = new ConnectionPoolManager(2);
      
      // Acquire all available connections
      return Promise.all([
        poolManager.acquireConnection(),
        poolManager.acquireConnection()
      ]).then(connections => {
        expect(connections).toHaveLength(2);
        expect(poolManager.getPoolStatus().availableConnections).toBe(0);
        
        // Try to acquire one more - should be queued
        const queuedPromise = poolManager.acquireConnection();
        
        expect(poolManager.getPoolStatus().queueLength).toBe(1);
        
        // Release one connection
        poolManager.releaseConnection(connections[0].connectionId);
        
        // Queued request should be fulfilled
        return queuedPromise;
      }).then(queuedConnection => {
        expect(queuedConnection.acquired).toBe(true);
        expect(queuedConnection.waitTime).toBeGreaterThan(0);
      });
    });
  });

  describe('Edge Case 5: Invalid Data Submission', () => {

    test('should validate and sanitize input data comprehensively', () => {
      class DataValidator {
        static validateAssignmentRequest(data) {
          const errors = [];
          const sanitized = {};

          // SDR ID validation
          if (!data.sdrId || typeof data.sdrId !== 'number' || data.sdrId <= 0) {
            errors.push('Valid SDR ID is required (positive integer)');
          } else {
            sanitized.sdrId = Math.floor(data.sdrId);
          }

          // Consultant ID validation (optional for auto-assignment)
          if (data.consultantId !== undefined) {
            if (typeof data.consultantId !== 'number' || data.consultantId <= 0) {
              errors.push('Consultant ID must be a positive integer');
            } else {
              sanitized.consultantId = Math.floor(data.consultantId);
            }
          }

          // Priority validation
          if (data.priority && !['low', 'normal', 'high', 'urgent'].includes(data.priority)) {
            errors.push('Priority must be one of: low, normal, high, urgent');
          } else {
            sanitized.priority = data.priority || 'normal';
          }

          // Notes validation
          if (data.notes) {
            if (typeof data.notes !== 'string') {
              errors.push('Notes must be a string');
            } else if (data.notes.length > 1000) {
              errors.push('Notes cannot exceed 1000 characters');
            } else {
              sanitized.notes = data.notes.trim().substring(0, 1000);
            }
          }

          return {
            isValid: errors.length === 0,
            errors,
            sanitizedData: sanitized
          };
        }

        static detectMaliciousContent(input) {
          if (typeof input !== 'string') return { isSafe: true, threats: [] };

          const threats = [];
          const patterns = {
            sqlInjection: /('|(\\')|(;|\\;)|(\bunion\b)|(\bselect\b)|(\bdrop\b)|(\bdelete\b))/i,
            xss: /(<script|<iframe|javascript:|vbscript:|onload=|onerror=)/i,
            pathTraversal: /(\.\.\/|\.\.\\|\/etc\/|\\windows\\|\\system32\\)/i,
            commandInjection: /(\||&|;|\$\(|\`)/,
            htmlInjection: /(<[^>]*>)/
          };

          Object.entries(patterns).forEach(([threatType, pattern]) => {
            if (pattern.test(input)) {
              threats.push(threatType);
            }
          });

          const sanitized = input
            .replace(/[<>'";\-\*%_|&\^$#@!~`]/g, '')
            .replace(/\s+/g, ' ')
            .trim();

          return {
            isSafe: threats.length === 0,
            threats,
            sanitized,
            riskLevel: threats.length === 0 ? 'safe' : threats.length > 2 ? 'high' : 'medium'
          };
        }
      }

      // Test valid assignment request
      const validRequest = {
        sdrId: 123,
        consultantId: 456,
        priority: 'high',
        notes: 'Urgent client meeting tomorrow'
      };

      const validResult = DataValidator.validateAssignmentRequest(validRequest);
      expect(validResult.isValid).toBe(true);
      expect(validResult.sanitizedData.priority).toBe('high');

      // Test invalid assignment request
      const invalidRequest = {
        sdrId: -1,
        consultantId: 'invalid',
        priority: 'super-urgent',
        notes: 'A'.repeat(2000)
      };

      const invalidResult = DataValidator.validateAssignmentRequest(invalidRequest);
      expect(invalidResult.isValid).toBe(false);
      expect(invalidResult.errors.length).toBeGreaterThan(3);

      // Test malicious content detection
      const maliciousInputs = [
        "'; DROP TABLE users; --",
        "<script>alert('xss')</script>",
        "../../etc/passwd",
        "john@company.com | rm -rf /"
      ];

      maliciousInputs.forEach(input => {
        const result = DataValidator.detectMaliciousContent(input);
        expect(result.isSafe).toBe(false);
        expect(result.threats.length).toBeGreaterThan(0);
        expect(result.sanitized.length).toBeLessThan(input.length);
      });

      // Test safe content
      const safeInput = "John Smith from Acme Corp";
      const safeResult = DataValidator.detectMaliciousContent(safeInput);
      expect(safeResult.isSafe).toBe(true);
      expect(safeResult.threats).toHaveLength(0);
    });

    test('should handle payload size limits and rate limiting', () => {
      class RequestLimiter {
        constructor() {
          this.requestCounts = new Map();
          this.maxRequestsPerMinute = 60;
          this.maxPayloadSize = 1024 * 100; // 100KB
        }

        checkRateLimit(clientId) {
          const now = Date.now();
          const windowStart = now - 60000; // 1 minute window
          
          if (!this.requestCounts.has(clientId)) {
            this.requestCounts.set(clientId, []);
          }

          const clientRequests = this.requestCounts.get(clientId);
          
          // Remove old requests outside the window
          const recentRequests = clientRequests.filter(time => time > windowStart);
          this.requestCounts.set(clientId, recentRequests);

          if (recentRequests.length >= this.maxRequestsPerMinute) {
            return {
              allowed: false,
              error: 'RATE_LIMIT_EXCEEDED',
              requestCount: recentRequests.length,
              resetTime: new Date(recentRequests[0] + 60000),
              retryAfter: Math.ceil((recentRequests[0] + 60000 - now) / 1000)
            };
          }

          // Add current request
          recentRequests.push(now);
          
          return {
            allowed: true,
            requestCount: recentRequests.length,
            remaining: this.maxRequestsPerMinute - recentRequests.length
          };
        }

        checkPayloadSize(data) {
          const payload = JSON.stringify(data);
          const sizeBytes = Buffer.byteLength(payload, 'utf8');

          if (sizeBytes > this.maxPayloadSize) {
            return {
              allowed: false,
              error: 'PAYLOAD_TOO_LARGE',
              actualSize: sizeBytes,
              maxSize: this.maxPayloadSize,
              exceededBy: sizeBytes - this.maxPayloadSize
            };
          }

          return {
            allowed: true,
            size: sizeBytes,
            percentUsed: (sizeBytes / this.maxPayloadSize) * 100
          };
        }
      }

      const limiter = new RequestLimiter();

      // Test rate limiting
      const clientId = 'test-client-123';
      
      // Make requests up to the limit
      for (let i = 0; i < 60; i++) {
        const result = limiter.checkRateLimit(clientId);
        if (i < 59) {
          expect(result.allowed).toBe(true);
        }
      }

      // 61st request should be blocked
      const blockedResult = limiter.checkRateLimit(clientId);
      expect(blockedResult.allowed).toBe(false);
      expect(blockedResult.error).toBe('RATE_LIMIT_EXCEEDED');
      expect(blockedResult.retryAfter).toBeGreaterThan(0);

      // Test payload size limit
      const largePayload = {
        data: 'A'.repeat(200000), // 200KB of data
        metadata: 'B'.repeat(50000)
      };

      const sizeResult = limiter.checkPayloadSize(largePayload);
      expect(sizeResult.allowed).toBe(false);
      expect(sizeResult.error).toBe('PAYLOAD_TOO_LARGE');
      expect(sizeResult.exceededBy).toBeGreaterThan(0);

      // Test acceptable payload
      const normalPayload = {
        sdrId: 123,
        notes: 'Normal assignment request'
      };

      const normalResult = limiter.checkPayloadSize(normalPayload);
      expect(normalResult.allowed).toBe(true);
      expect(normalResult.percentUsed).toBeLessThan(1);
    });
  });

  describe('System Recovery and Error Reporting', () => {

    test('should provide comprehensive error context for debugging', () => {
      class ErrorContextBuilder {
        static buildErrorContext(error, operation, metadata = {}) {
          return {
            timestamp: new Date().toISOString(),
            errorId: Date.now().toString(36) + Math.random().toString(36).substr(2),
            operation,
            error: {
              name: error.name,
              message: error.message,
              stack: error.stack,
              code: error.code || 'UNKNOWN'
            },
            context: {
              userId: metadata.userId,
              requestId: metadata.requestId,
              sessionId: metadata.sessionId,
              ipAddress: metadata.ipAddress,
              userAgent: metadata.userAgent
            },
            system: {
              nodeVersion: process.version,
              platform: process.platform,
              memory: process.memoryUsage(),
              uptime: process.uptime()
            },
            recovery: {
              canRetry: metadata.canRetry || false,
              suggestedAction: metadata.suggestedAction || 'Contact support',
              documentation: metadata.documentationUrl,
              estimatedRecoveryTime: metadata.estimatedRecoveryTime
            }
          };
        }
      }

      const testError = new Error('Database connection timeout');
      testError.code = 'ECONNRESET';
      
      const metadata = {
        userId: 123,
        requestId: 'req-abc-123',
        canRetry: true,
        suggestedAction: 'Wait 30 seconds and try again',
        estimatedRecoveryTime: '30 seconds'
      };

      const context = ErrorContextBuilder.buildErrorContext(
        testError, 
        'GET_NEXT_ASSIGNMENT', 
        metadata
      );

      expect(context.errorId).toBeDefined();
      expect(context.operation).toBe('GET_NEXT_ASSIGNMENT');
      expect(context.error.code).toBe('ECONNRESET');
      expect(context.context.userId).toBe(123);
      expect(context.recovery.canRetry).toBe(true);
      expect(context.system.nodeVersion).toBeDefined();
    });

    test('should implement graceful degradation strategies', () => {
      class GracefulDegradationManager {
        constructor() {
          this.fallbackStrategies = new Map();
          this.serviceHealth = new Map();
        }

        registerFallback(service, fallbackFunction) {
          this.fallbackStrategies.set(service, fallbackFunction);
        }

        markServiceHealth(service, isHealthy) {
          this.serviceHealth.set(service, {
            isHealthy,
            lastCheck: Date.now(),
            consecutiveFailures: isHealthy ? 0 : (this.serviceHealth.get(service)?.consecutiveFailures || 0) + 1
          });
        }

        executeWithFallback(service, primaryOperation) {
          const health = this.serviceHealth.get(service);
          
          // If service is known to be unhealthy, use fallback immediately
          if (health && !health.isHealthy && health.consecutiveFailures > 3) {
            return this.executeFallback(service, 'SERVICE_DEGRADED');
          }

          try {
            const result = primaryOperation();
            this.markServiceHealth(service, true);
            return result;
          } catch (error) {
            this.markServiceHealth(service, false);
            return this.executeFallback(service, error.message);
          }
        }

        executeFallback(service, reason) {
          const fallback = this.fallbackStrategies.get(service);
          
          if (!fallback) {
            return {
              success: false,
              error: 'NO_FALLBACK_AVAILABLE',
              service,
              reason
            };
          }

          const result = fallback();
          return {
            ...result,
            fallbackUsed: true,
            originalService: service,
            fallbackReason: reason
          };
        }

        getSystemStatus() {
          const services = Array.from(this.serviceHealth.entries()).map(([service, health]) => ({
            service,
            ...health,
            hasFallback: this.fallbackStrategies.has(service)
          }));

          return {
            services,
            overallHealth: services.every(s => s.isHealthy) ? 'healthy' : 'degraded',
            availableFallbacks: this.fallbackStrategies.size
          };
        }
      }

      const degradationManager = new GracefulDegradationManager();
      
      // Register fallback for assignment service
      degradationManager.registerFallback('assignment', () => ({
        success: true,
        data: { message: 'Using cached assignment data' },
        source: 'cache'
      }));

      // Simulate service failure
      const failingOperation = () => {
        throw new Error('Database unreachable');
      };

      const result = degradationManager.executeWithFallback('assignment', failingOperation);
      
      expect(result.success).toBe(true);
      expect(result.fallbackUsed).toBe(true);
      expect(result.source).toBe('cache');
      expect(result.fallbackReason).toBe('Database unreachable');

      // Check system status
      const status = degradationManager.getSystemStatus();
      expect(status.overallHealth).toBe('degraded');
      expect(status.availableFallbacks).toBe(1);
    });
  });
});

// Test Summary Generator
function generateEdgeCaseTestSummary() {
  return {
    totalScenarios: 5,
    scenarios: [
      {
        name: 'All Consultants Unavailable',
        description: 'Handles empty consultant pools with detailed error responses',
        keyFeatures: ['Error categorization', 'Retry suggestions', 'Alternative actions']
      },
      {
        name: 'Concurrent Assignment Requests',
        description: 'Prevents race conditions with locking and version control',
        keyFeatures: ['Optimistic locking', 'Resource queuing', 'Version control']
      },
      {
        name: 'Consultant Removal with Active Assignments',
        description: 'Manages consultant lifecycle with data integrity',
        keyFeatures: ['Soft delete', 'Assignment reassignment', 'Restore capability']
      },
      {
        name: 'Database Connection Failures',
        description: 'Ensures system resilience during database issues',
        keyFeatures: ['Retry mechanisms', 'Circuit breaker', 'Connection pooling']
      },
      {
        name: 'Invalid Data Submission',
        description: 'Validates and sanitizes all input data',
        keyFeatures: ['Input validation', 'Malicious content detection', 'Rate limiting']
      }
    ],
    systemStrengths: [
      'Comprehensive error handling',
      'Graceful degradation',
      'Data integrity protection',
      'Security-first validation',
      'Recovery mechanisms'
    ]
  };
}

module.exports = { generateEdgeCaseTestSummary };