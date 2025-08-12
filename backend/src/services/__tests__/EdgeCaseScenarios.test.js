// Edge Case Scenario Testing - Focused Implementation Tests
// Testing how the system handles critical failure scenarios

describe('SDR Assignment System - Edge Case Scenarios', () => {

  describe('Scenario 1: All Consultants Are Unavailable', () => {
    
    test('should handle empty consultant pool gracefully', () => {
      function handleEmptyConsultantPool(consultants) {
        if (!consultants || consultants.length === 0) {
          return {
            success: false,
            error: 'NO_CONSULTANTS_AVAILABLE',
            message: 'No consultants are currently available for assignment',
            suggestedRetryTime: new Date(Date.now() + 30 * 60000), // 30 minutes
            alternativeActions: [
              'Check consultant availability schedules',
              'Contact administrator to add more consultants',
              'Try again during business hours'
            ]
          };
        }
        return { success: true };
      }

      const result = handleEmptyConsultantPool([]);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('NO_CONSULTANTS_AVAILABLE');
      expect(result.message).toContain('No consultants are currently available');
      expect(result.suggestedRetryTime).toBeInstanceOf(Date);
      expect(result.alternativeActions).toHaveLength(3);
    });

    test('should filter out unavailable consultants correctly', () => {
      function filterAvailableConsultants(consultants, currentTime = new Date()) {
        return consultants.filter(consultant => {
          // Check if consultant is active
          if (!consultant.is_active) return false;
          
          // Check if consultant is on time-off
          if (consultant.timeoff_periods) {
            const onTimeOff = consultant.timeoff_periods.some(period => 
              currentTime >= new Date(period.start_date) && 
              currentTime <= new Date(period.end_date)
            );
            if (onTimeOff) return false;
          }
          
          // Check availability schedule
          const dayOfWeek = currentTime.getDay();
          const timeOfDay = currentTime.getHours() * 60 + currentTime.getMinutes();
          
          if (consultant.availability_schedule) {
            const todaySchedule = consultant.availability_schedule.find(
              schedule => schedule.day_of_week === dayOfWeek
            );
            
            if (!todaySchedule) return false;
            
            const startMinutes = todaySchedule.start_hour * 60 + todaySchedule.start_minute;
            const endMinutes = todaySchedule.end_hour * 60 + todaySchedule.end_minute;
            
            return timeOfDay >= startMinutes && timeOfDay <= endMinutes;
          }
          
          return true; // Default to available if no schedule specified
        });
      }

      const consultants = [
        {
          id: 1,
          name: 'John Smith',
          is_active: true,
          timeoff_periods: [{
            start_date: '2023-12-01',
            end_date: '2023-12-05'
          }]
        },
        {
          id: 2,
          name: 'Jane Doe',
          is_active: false // Inactive
        },
        {
          id: 3,
          name: 'Bob Wilson',
          is_active: true,
          availability_schedule: [{
            day_of_week: 1, // Monday
            start_hour: 9,
            start_minute: 0,
            end_hour: 17,
            end_minute: 0
          }]
        }
      ];

      // Test during John's time-off period
      const duringTimeOff = new Date('2023-12-03T10:00:00Z');
      const available1 = filterAvailableConsultants(consultants, duringTimeOff);
      expect(available1).toHaveLength(0); // All filtered out

      // Test on Monday during Bob's hours
      const mondayWorkHours = new Date('2023-12-04T10:00:00Z'); // Monday 10 AM
      mondayWorkHours.getDay = () => 1; // Force Monday
      const available2 = filterAvailableConsultants(consultants, mondayWorkHours);
      expect(available2).toHaveLength(1);
      expect(available2[0].name).toBe('Bob Wilson');
    });

    test('should provide detailed unavailability reasons', () => {
      function analyzeUnavailability(consultants) {
        const analysis = {
          total: consultants.length,
          inactive: 0,
          onTimeOff: 0,
          outsideBusinessHours: 0,
          reasons: []
        };

        consultants.forEach(consultant => {
          if (!consultant.is_active) {
            analysis.inactive++;
            analysis.reasons.push(`${consultant.name} is inactive`);
          }
          
          if (consultant.on_time_off) {
            analysis.onTimeOff++;
            analysis.reasons.push(`${consultant.name} is on time off`);
          }
          
          if (consultant.outside_hours) {
            analysis.outsideBusinessHours++;
            analysis.reasons.push(`${consultant.name} is outside business hours`);
          }
        });

        return analysis;
      }

      const unavailableConsultants = [
        { id: 1, name: 'John Smith', is_active: false },
        { id: 2, name: 'Jane Doe', is_active: true, on_time_off: true },
        { id: 3, name: 'Bob Wilson', is_active: true, outside_hours: true }
      ];

      const analysis = analyzeUnavailability(unavailableConsultants);
      
      expect(analysis.total).toBe(3);
      expect(analysis.inactive).toBe(1);
      expect(analysis.onTimeOff).toBe(1);
      expect(analysis.outsideBusinessHours).toBe(1);
      expect(analysis.reasons).toHaveLength(3);
      expect(analysis.reasons[0]).toContain('John Smith is inactive');
    });
  });

  describe('Scenario 2: Concurrent Assignment Requests', () => {

    test('should handle race condition with optimistic locking', () => {
      class AssignmentManager {
        constructor() {
          this.assignments = new Map();
          this.consultantVersions = new Map();
        }

        attemptAssignment(sdrId, consultantId, expectedVersion) {
          const currentVersion = this.consultantVersions.get(consultantId) || 0;
          
          // Optimistic locking check
          if (expectedVersion !== currentVersion) {
            throw new Error('CONCURRENT_MODIFICATION: Consultant data was modified by another request');
          }

          // Check if consultant is already assigned
          const existingAssignment = Array.from(this.assignments.values()).find(
            assignment => assignment.consultantId === consultantId && assignment.status === 'active'
          );

          if (existingAssignment) {
            throw new Error('CONSULTANT_ALREADY_ASSIGNED: Consultant is currently assigned to another SDR');
          }

          // Create assignment
          const assignmentId = Date.now() + Math.random();
          this.assignments.set(assignmentId, {
            id: assignmentId,
            sdrId,
            consultantId,
            status: 'active',
            assignedAt: new Date()
          });

          // Increment version for next requests
          this.consultantVersions.set(consultantId, currentVersion + 1);

          return {
            success: true,
            assignmentId,
            version: currentVersion + 1
          };
        }
      }

      const manager = new AssignmentManager();
      
      // First SDR gets assignment successfully
      const result1 = manager.attemptAssignment(1, 100, 0);
      expect(result1.success).toBe(true);
      expect(result1.version).toBe(1);

      // Second SDR tries same consultant with old version
      expect(() => {
        manager.attemptAssignment(2, 100, 0); // Using old version
      }).toThrow('CONCURRENT_MODIFICATION');

      // Second SDR tries same consultant with correct version but consultant is assigned
      expect(() => {
        manager.attemptAssignment(2, 100, 1);
      }).toThrow('CONSULTANT_ALREADY_ASSIGNED');
    });

    test('should implement proper transaction rollback on conflicts', () => {
      class TransactionalAssignment {
        constructor() {
          this.state = {
            assignments: [],
            consultantCounts: new Map()
          };
        }

        async executeWithTransaction(operations) {
          const originalState = JSON.parse(JSON.stringify({
            assignments: this.state.assignments,
            consultantCounts: Array.from(this.state.consultantCounts.entries())
          }));

          try {
            // Execute all operations
            for (const operation of operations) {
              await operation();
            }
            return { success: true };
          } catch (error) {
            // Rollback to original state
            this.state.assignments = originalState.assignments;
            this.state.consultantCounts = new Map(originalState.consultantCounts);
            
            return {
              success: false,
              error: error.message,
              rolledBack: true
            };
          }
        }

        createAssignment(sdrId, consultantId) {
          return () => {
            // Simulate conflict
            if (this.state.assignments.some(a => a.consultantId === consultantId)) {
              throw new Error('Consultant already assigned');
            }
            
            this.state.assignments.push({ sdrId, consultantId, status: 'active' });
          };
        }

        updateConsultantCount(consultantId) {
          return () => {
            const currentCount = this.state.consultantCounts.get(consultantId) || 0;
            this.state.consultantCounts.set(consultantId, currentCount + 1);
          };
        }
      }

      const transactional = new TransactionalAssignment();

      // Successful transaction
      const successResult = transactional.executeWithTransaction([
        transactional.createAssignment(1, 100),
        transactional.updateConsultantCount(100)
      ]);

      expect(successResult.success).toBe(true);
      expect(transactional.state.assignments).toHaveLength(1);

      // Failed transaction with rollback
      const failResult = transactional.executeWithTransaction([
        transactional.createAssignment(2, 100), // Should fail - consultant already assigned
        transactional.updateConsultantCount(100)
      ]);

      expect(failResult.success).toBe(false);
      expect(failResult.rolledBack).toBe(true);
      expect(transactional.state.assignments).toHaveLength(1); // Unchanged
    });

    test('should queue concurrent requests when resource is locked', async () => {
      class QueuedAssignmentManager {
        constructor() {
          this.locks = new Map();
          this.queue = [];
        }

        async requestAssignment(sdrId, consultantId) {
          const lockKey = `consultant_${consultantId}`;
          
          if (this.locks.has(lockKey)) {
            // Add to queue
            return new Promise((resolve) => {
              this.queue.push({
                sdrId,
                consultantId,
                resolve,
                timestamp: Date.now()
              });
            });
          }

          // Acquire lock
          this.locks.set(lockKey, sdrId);
          
          try {
            // Simulate assignment process
            await new Promise(resolve => setTimeout(resolve, 10));
            
            const result = {
              success: true,
              sdrId,
              consultantId,
              assignedAt: new Date()
            };

            // Release lock and process queue
            this.locks.delete(lockKey);
            this.processQueue(consultantId);
            
            return result;
          } catch (error) {
            this.locks.delete(lockKey);
            throw error;
          }
        }

        processQueue(consultantId) {
          const queuedRequest = this.queue.find(req => req.consultantId === consultantId);
          if (queuedRequest) {
            this.queue = this.queue.filter(req => req !== queuedRequest);
            // Process next request
            setTimeout(() => {
              queuedRequest.resolve({
                success: false,
                error: 'CONSULTANT_NO_LONGER_AVAILABLE',
                queuePosition: 1
              });
            }, 1);
          }
        }
      }

      const queueManager = new QueuedAssignmentManager();

      // Start concurrent requests
      const request1Promise = queueManager.requestAssignment(1, 200);
      const request2Promise = queueManager.requestAssignment(2, 200);

      const [result1, result2] = await Promise.all([request1Promise, request2Promise]);

      expect(result1.success).toBe(true);
      expect(result1.sdrId).toBe(1);
      
      expect(result2.success).toBe(false);
      expect(result2.error).toBe('CONSULTANT_NO_LONGER_AVAILABLE');
    });
  });

  describe('Scenario 3: Consultant Removal with Pending Assignments', () => {

    test('should prevent deletion when active assignments exist', () => {
      function validateConsultantDeletion(consultantId, assignments) {
        const activeAssignments = assignments.filter(
          assignment => assignment.consultantId === consultantId && assignment.status === 'active'
        );

        if (activeAssignments.length > 0) {
          return {
            canDelete: false,
            reason: 'ACTIVE_ASSIGNMENTS_EXIST',
            activeAssignments: activeAssignments.length,
            affectedSDRs: activeAssignments.map(a => a.sdrId),
            suggestedActions: [
              'Complete or cancel active assignments',
              'Reassign active assignments to other consultants',
              'Use soft delete (deactivate) instead of hard delete'
            ]
          };
        }

        return { canDelete: true };
      }

      const assignments = [
        { id: 1, consultantId: 100, sdrId: 1, status: 'active' },
        { id: 2, consultantId: 100, sdrId: 2, status: 'completed' },
        { id: 3, consultantId: 101, sdrId: 3, status: 'active' }
      ];

      const result = validateConsultantDeletion(100, assignments);
      
      expect(result.canDelete).toBe(false);
      expect(result.reason).toBe('ACTIVE_ASSIGNMENTS_EXIST');
      expect(result.activeAssignments).toBe(1);
      expect(result.affectedSDRs).toEqual([1]);
      expect(result.suggestedActions).toHaveLength(3);
    });

    test('should handle reassignment of orphaned assignments', () => {
      function reassignOrphanedAssignments(deletedConsultantId, assignments, availableConsultants) {
        const orphanedAssignments = assignments.filter(
          assignment => assignment.consultantId === deletedConsultantId && assignment.status === 'active'
        );

        const reassignmentResults = [];

        orphanedAssignments.forEach(assignment => {
          // Simple round-robin for reassignment
          const availableConsultant = availableConsultants.find(c => 
            c.id !== deletedConsultantId && c.is_active
          );

          if (availableConsultant) {
            reassignmentResults.push({
              originalAssignmentId: assignment.id,
              originalConsultantId: deletedConsultantId,
              newConsultantId: availableConsultant.id,
              newConsultantName: availableConsultant.name,
              sdrId: assignment.sdrId,
              reassignedAt: new Date(),
              reason: 'CONSULTANT_DELETED'
            });
          } else {
            reassignmentResults.push({
              originalAssignmentId: assignment.id,
              status: 'FAILED',
              reason: 'NO_AVAILABLE_CONSULTANTS',
              sdrId: assignment.sdrId
            });
          }
        });

        return {
          totalOrphaned: orphanedAssignments.length,
          successfulReassignments: reassignmentResults.filter(r => !r.status).length,
          failedReassignments: reassignmentResults.filter(r => r.status === 'FAILED').length,
          details: reassignmentResults
        };
      }

      const assignments = [
        { id: 1, consultantId: 100, sdrId: 1, status: 'active' },
        { id: 2, consultantId: 100, sdrId: 2, status: 'active' }
      ];

      const availableConsultants = [
        { id: 101, name: 'Replacement Consultant 1', is_active: true },
        { id: 102, name: 'Replacement Consultant 2', is_active: true }
      ];

      const result = reassignOrphanedAssignments(100, assignments, availableConsultants);
      
      expect(result.totalOrphaned).toBe(2);
      expect(result.successfulReassignments).toBe(2);
      expect(result.failedReassignments).toBe(0);
      expect(result.details[0].newConsultantId).toBe(101);
      expect(result.details[0].reason).toBe('CONSULTANT_DELETED');
    });

    test('should implement soft delete for data integrity', () => {
      class ConsultantManager {
        constructor() {
          this.consultants = new Map();
          this.deletionLog = [];
        }

        softDelete(consultantId, reason = 'ADMIN_REQUEST') {
          const consultant = this.consultants.get(consultantId);
          if (!consultant) {
            throw new Error('Consultant not found');
          }

          // Update consultant status
          consultant.is_active = false;
          consultant.deleted_at = new Date();
          consultant.deletion_reason = reason;

          // Log the deletion
          this.deletionLog.push({
            consultantId,
            deletedAt: new Date(),
            reason,
            previousStatus: 'active'
          });

          return {
            success: true,
            consultantId,
            action: 'SOFT_DELETED',
            canRestore: true,
            deletedAt: consultant.deleted_at
          };
        }

        restore(consultantId) {
          const consultant = this.consultants.get(consultantId);
          if (!consultant || consultant.is_active) {
            throw new Error('Consultant not found or already active');
          }

          consultant.is_active = true;
          consultant.restored_at = new Date();
          delete consultant.deleted_at;
          delete consultant.deletion_reason;

          return {
            success: true,
            consultantId,
            action: 'RESTORED',
            restoredAt: consultant.restored_at
          };
        }
      }

      const manager = new ConsultantManager();
      manager.consultants.set(100, {
        id: 100,
        name: 'John Smith',
        is_active: true
      });

      // Soft delete
      const deleteResult = manager.softDelete(100, 'ADMIN_REQUEST');
      expect(deleteResult.success).toBe(true);
      expect(deleteResult.action).toBe('SOFT_DELETED');
      expect(deleteResult.canRestore).toBe(true);

      const consultant = manager.consultants.get(100);
      expect(consultant.is_active).toBe(false);
      expect(consultant.deleted_at).toBeInstanceOf(Date);

      // Restore
      const restoreResult = manager.restore(100);
      expect(restoreResult.success).toBe(true);
      expect(restoreResult.action).toBe('RESTORED');
      expect(consultant.is_active).toBe(true);
    });
  });

  describe('Scenario 4: Database Connection Failures', () => {

    test('should implement exponential backoff retry strategy', async () => {
      class DatabaseRetryManager {
        constructor(maxRetries = 3, baseDelay = 100) {
          this.maxRetries = maxRetries;
          this.baseDelay = baseDelay;
        }

        async executeWithRetry(operation, operationName = 'database_operation') {
          let lastError;
          
          for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
              const result = await operation();
              return {
                success: true,
                result,
                attempts: attempt
              };
            } catch (error) {
              lastError = error;
              
              if (attempt === this.maxRetries) {
                break; // Don't wait after the last attempt
              }

              // Calculate exponential backoff delay
              const delay = this.baseDelay * Math.pow(2, attempt - 1);
              const jitter = Math.random() * 0.1 * delay; // Add 10% jitter
              
              await new Promise(resolve => setTimeout(resolve, delay + jitter));
            }
          }

          return {
            success: false,
            error: lastError.message,
            attempts: this.maxRetries,
            finalAttemptFailed: true
          };
        }
      }

      const retryManager = new DatabaseRetryManager(3, 50);
      let attemptCount = 0;

      // Mock operation that fails first 2 times, succeeds on 3rd
      const mockOperation = async () => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error('Connection timeout');
        }
        return { data: 'success' };
      };

      const result = await retryManager.executeWithRetry(mockOperation, 'get_assignment');
      
      expect(result.success).toBe(true);
      expect(result.result.data).toBe('success');
      expect(result.attempts).toBe(3);
    });

    test('should gracefully handle persistent connection failures', async () => {
      class ConnectionFailureHandler {
        constructor() {
          this.fallbackData = new Map();
          this.offlineQueue = [];
        }

        async handlePersistentFailure(operation, fallbackKey) {
          try {
            return await operation();
          } catch (error) {
            // Check if we have fallback data
            if (this.fallbackData.has(fallbackKey)) {
              return {
                success: true,
                data: this.fallbackData.get(fallbackKey),
                source: 'FALLBACK_CACHE',
                warning: 'Database unavailable, using cached data'
              };
            }

            // Queue operation for retry when connection is restored
            this.offlineQueue.push({
              operation,
              fallbackKey,
              timestamp: Date.now(),
              retryCount: 0
            });

            return {
              success: false,
              error: 'DATABASE_UNAVAILABLE',
              message: 'Service temporarily unavailable. Please try again later.',
              queued: true,
              estimatedRetryTime: new Date(Date.now() + 5 * 60000) // 5 minutes
            };
          }
        }

        setCachedData(key, data) {
          this.fallbackData.set(key, data);
        }
      }

      const handler = new ConnectionFailureHandler();
      
      // Set some cached data
      handler.setCachedData('consultants', [
        { id: 1, name: 'Cached Consultant', assignment_count: 5 }
      ]);

      // Mock persistent failure operation
      const failingOperation = async () => {
        throw new Error('Connection lost');
      };

      const result = await handler.handlePersistentFailure(failingOperation, 'consultants');
      
      expect(result.success).toBe(true);
      expect(result.source).toBe('FALLBACK_CACHE');
      expect(result.warning).toContain('Database unavailable');
      expect(result.data).toHaveLength(1);
    });

    test('should implement circuit breaker pattern', () => {
      class CircuitBreaker {
        constructor(failureThreshold = 5, timeoutDuration = 60000) {
          this.failureThreshold = failureThreshold;
          this.timeoutDuration = timeoutDuration;
          this.failureCount = 0;
          this.lastFailureTime = null;
          this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
        }

        async execute(operation) {
          if (this.state === 'OPEN') {
            if (Date.now() - this.lastFailureTime < this.timeoutDuration) {
              throw new Error('CIRCUIT_BREAKER_OPEN: Service temporarily unavailable');
            } else {
              this.state = 'HALF_OPEN';
            }
          }

          try {
            const result = await operation();
            this.onSuccess();
            return result;
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

        getState() {
          return {
            state: this.state,
            failureCount: this.failureCount,
            isOpen: this.state === 'OPEN'
          };
        }
      }

      const circuitBreaker = new CircuitBreaker(3, 1000);
      
      // Simulate failures to trip the circuit breaker
      const failingOperation = async () => {
        throw new Error('Database connection failed');
      };

      // First 3 failures should be allowed through
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(failingOperation);
        } catch (error) {
          expect(error.message).toBe('Database connection failed');
        }
      }

      // Circuit breaker should now be open
      expect(circuitBreaker.getState().state).toBe('OPEN');
      
      // Next call should be rejected immediately
      expect(async () => {
        await circuitBreaker.execute(failingOperation);
      }).rejects.toThrow('CIRCUIT_BREAKER_OPEN');
    });
  });

  describe('Scenario 5: Invalid Data Submission through API', () => {

    test('should validate and sanitize input data', () => {
      class InputValidator {
        static validateSDRId(sdrId) {
          if (sdrId === null || sdrId === undefined) {
            throw new Error('SDR ID is required');
          }
          
          if (typeof sdrId !== 'number' || sdrId <= 0 || !Number.isInteger(sdrId)) {
            throw new Error('SDR ID must be a positive integer');
          }
          
          if (sdrId > 2147483647) { // Max int32
            throw new Error('SDR ID exceeds maximum value');
          }
          
          return true;
        }

        static validateConsultantData(data) {
          const errors = [];
          const sanitized = {};

          // Name validation
          if (!data.name || typeof data.name !== 'string') {
            errors.push('Name is required and must be a string');
          } else {
            sanitized.name = data.name.trim().substring(0, 100); // Limit length
            if (sanitized.name.length === 0) {
              errors.push('Name cannot be empty');
            }
          }

          // Email validation
          if (!data.email || typeof data.email !== 'string') {
            errors.push('Email is required and must be a string');
          } else {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(data.email)) {
              errors.push('Invalid email format');
            } else {
              sanitized.email = data.email.toLowerCase().trim();
            }
          }

          // Phone validation (optional)
          if (data.phone) {
            if (typeof data.phone !== 'string') {
              errors.push('Phone must be a string');
            } else {
              const phoneRegex = /^\+?[\d\s\-\(\)]+$/;
              if (!phoneRegex.test(data.phone)) {
                errors.push('Invalid phone format');
              } else {
                sanitized.phone = data.phone.trim();
              }
            }
          }

          // Hourly rate validation
          if (data.hourly_rate !== undefined) {
            const rate = Number(data.hourly_rate);
            if (isNaN(rate) || rate < 0 || rate > 10000) {
              errors.push('Hourly rate must be a number between 0 and 10000');
            } else {
              sanitized.hourly_rate = Math.round(rate * 100) / 100; // Round to 2 decimals
            }
          }

          return {
            isValid: errors.length === 0,
            errors,
            sanitizedData: sanitized
          };
        }

        static sanitizeStringInput(input, maxLength = 255) {
          if (typeof input !== 'string') {
            return '';
          }
          
          return input
            .trim()
            .substring(0, maxLength)
            .replace(/[<>]/g, '') // Remove potential HTML
            .replace(/[\x00-\x1F\x7F]/g, ''); // Remove control characters
        }
      }

      // Test SDR ID validation
      expect(() => InputValidator.validateSDRId(null)).toThrow('SDR ID is required');
      expect(() => InputValidator.validateSDRId(-1)).toThrow('positive integer');
      expect(() => InputValidator.validateSDRId('abc')).toThrow('positive integer');
      expect(InputValidator.validateSDRId(123)).toBe(true);

      // Test consultant data validation
      const validData = {
        name: 'John Smith',
        email: 'john@example.com',
        phone: '+1-555-0101',
        hourly_rate: 150.50
      };

      const validResult = InputValidator.validateConsultantData(validData);
      expect(validResult.isValid).toBe(true);
      expect(validResult.sanitizedData.hourly_rate).toBe(150.5);

      // Test invalid data
      const invalidData = {
        name: '',
        email: 'invalid-email',
        hourly_rate: -50
      };

      const invalidResult = InputValidator.validateConsultantData(invalidData);
      expect(invalidResult.isValid).toBe(false);
      expect(invalidResult.errors).toHaveLength(3);
    });

    test('should detect and prevent SQL injection attempts', () => {
      class SQLInjectionDetector {
        static detectSQLInjection(input) {
          if (typeof input !== 'string') {
            return { isSafe: true, sanitized: input };
          }

          const suspiciousPatterns = [
            /('|(\\')|(;|\\;))/i, // Single quotes and semicolons
            /(union|select|insert|update|delete|drop|create|alter|exec|execute)/i,
            /(\*|%|_|\||\||&|\^|\$|#|@|!|~|`)/,
            /(script|javascript|vbscript|onload|onerror)/i,
            /(\.\.\/|\.\.\\|etc\/passwd|windows\\system)/i
          ];

          const detectedPatterns = [];
          
          for (const pattern of suspiciousPatterns) {
            if (pattern.test(input)) {
              detectedPatterns.push(pattern.toString());
            }
          }

          const isSafe = detectedPatterns.length === 0;
          const sanitized = isSafe ? input : input.replace(/['";\-\*%_|&\^$#@!~`<>]/g, '');

          return {
            isSafe,
            detectedPatterns,
            sanitized,
            originalLength: input.length,
            sanitizedLength: sanitized.length
          };
        }
      }

      const testCases = [
        "'; DROP TABLE users; --",
        "1 OR 1=1",
        "UNION SELECT * FROM passwords",
        "<script>alert('xss')</script>",
        "../../etc/passwd",
        "John Smith" // Safe input
      ];

      testCases.forEach((testCase, index) => {
        const result = SQLInjectionDetector.detectSQLInjection(testCase);
        
        if (index < testCases.length - 1) {
          // Malicious inputs
          expect(result.isSafe).toBe(false);
          expect(result.detectedPatterns.length).toBeGreaterThan(0);
          expect(result.sanitized.length).toBeLessThan(result.originalLength);
        } else {
          // Safe input
          expect(result.isSafe).toBe(true);
          expect(result.detectedPatterns).toHaveLength(0);
        }
      });
    });

    test('should handle payload size limits', () => {
      class PayloadValidator {
        static validatePayloadSize(data, maxSizeBytes = 1024 * 1024) { // 1MB default
          const jsonString = JSON.stringify(data);
          const sizeBytes = new Blob([jsonString]).size;
          
          if (sizeBytes > maxSizeBytes) {
            return {
              isValid: false,
              error: 'PAYLOAD_TOO_LARGE',
              actualSize: sizeBytes,
              maxSize: maxSizeBytes,
              exceededBy: sizeBytes - maxSizeBytes
            };
          }
          
          return {
            isValid: true,
            size: sizeBytes
          };
        }

        static validateFieldLengths(data, limits = {}) {
          const defaultLimits = {
            name: 100,
            email: 255,
            phone: 20,
            notes: 1000,
            specialty: 50
          };

          const effectiveLimits = { ...defaultLimits, ...limits };
          const violations = [];

          Object.entries(data).forEach(([field, value]) => {
            if (typeof value === 'string' && effectiveLimits[field]) {
              if (value.length > effectiveLimits[field]) {
                violations.push({
                  field,
                  actualLength: value.length,
                  maxLength: effectiveLimits[field],
                  exceededBy: value.length - effectiveLimits[field]
                });
              }
            }
          });

          return {
            isValid: violations.length === 0,
            violations
          };
        }
      }

      // Test oversized payload
      const largeData = {
        name: 'A'.repeat(10000),
        notes: 'B'.repeat(100000)
      };

      const sizeResult = PayloadValidator.validatePayloadSize(largeData, 50000);
      expect(sizeResult.isValid).toBe(false);
      expect(sizeResult.error).toBe('PAYLOAD_TOO_LARGE');

      // Test field length limits
      const longFieldData = {
        name: 'John Smith',
        email: 'a'.repeat(300) + '@example.com', // Too long
        notes: 'B'.repeat(2000) // Too long
      };

      const lengthResult = PayloadValidator.validateFieldLengths(longFieldData);
      expect(lengthResult.isValid).toBe(false);
      expect(lengthResult.violations).toHaveLength(2);
      expect(lengthResult.violations[0].field).toBe('email');
    });
  });

  describe('System Resilience and Error Recovery', () => {

    test('should maintain consistent state during partial failures', () => {
      class StateManager {
        constructor() {
          this.state = {
            assignments: [],
            consultantCounts: new Map(),
            operationLog: []
          };
        }

        executeAtomicOperation(operations) {
          const checkpoint = this.createCheckpoint();
          
          try {
            operations.forEach((operation, index) => {
              try {
                operation.execute(this.state);
                this.state.operationLog.push({
                  operation: operation.name,
                  index,
                  status: 'SUCCESS',
                  timestamp: Date.now()
                });
              } catch (error) {
                // Rollback to checkpoint
                this.restoreCheckpoint(checkpoint);
                throw new Error(`Operation ${operation.name} failed: ${error.message}`);
              }
            });
            
            return { success: true, operations: operations.length };
          } catch (error) {
            return { 
              success: false, 
              error: error.message,
              rolledBack: true,
              checkpoint: checkpoint.timestamp 
            };
          }
        }

        createCheckpoint() {
          return {
            timestamp: Date.now(),
            assignments: [...this.state.assignments],
            consultantCounts: new Map(this.state.consultantCounts),
            operationLog: [...this.state.operationLog]
          };
        }

        restoreCheckpoint(checkpoint) {
          this.state.assignments = [...checkpoint.assignments];
          this.state.consultantCounts = new Map(checkpoint.consultantCounts);
          this.state.operationLog = [...checkpoint.operationLog];
        }
      }

      const stateManager = new StateManager();
      
      const operations = [
        {
          name: 'CREATE_ASSIGNMENT',
          execute: (state) => {
            state.assignments.push({ id: 1, sdrId: 1, consultantId: 100 });
          }
        },
        {
          name: 'UPDATE_COUNT',
          execute: (state) => {
            state.consultantCounts.set(100, 1);
          }
        },
        {
          name: 'FAILING_OPERATION',
          execute: (state) => {
            throw new Error('Simulated failure');
          }
        }
      ];

      const result = stateManager.executeAtomicOperation(operations);
      
      expect(result.success).toBe(false);
      expect(result.rolledBack).toBe(true);
      expect(stateManager.state.assignments).toHaveLength(0); // Should be rolled back
      expect(stateManager.state.consultantCounts.size).toBe(0); // Should be rolled back
    });

    test('should provide comprehensive error information for debugging', () => {
      class ErrorReporter {
        static createErrorReport(error, context = {}) {
          return {
            timestamp: new Date().toISOString(),
            errorType: error.constructor.name,
            message: error.message,
            stack: error.stack,
            context: {
              operation: context.operation || 'unknown',
              userId: context.userId,
              requestId: context.requestId || Math.random().toString(36),
              userAgent: context.userAgent,
              ipAddress: context.ipAddress
            },
            systemState: {
              memoryUsage: process.memoryUsage ? process.memoryUsage() : null,
              uptime: process.uptime ? process.uptime() : null,
              nodeVersion: process.version || null
            },
            recovery: {
              canRetry: context.canRetry || false,
              suggestedAction: context.suggestedAction || 'Contact support',
              estimatedRecoveryTime: context.estimatedRecoveryTime
            }
          };
        }
      }

      const testError = new Error('Database connection failed');
      const context = {
        operation: 'GET_NEXT_ASSIGNMENT',
        userId: 123,
        canRetry: true,
        suggestedAction: 'Try again in a few minutes'
      };

      const errorReport = ErrorReporter.createErrorReport(testError, context);
      
      expect(errorReport.errorType).toBe('Error');
      expect(errorReport.message).toBe('Database connection failed');
      expect(errorReport.context.operation).toBe('GET_NEXT_ASSIGNMENT');
      expect(errorReport.context.userId).toBe(123);
      expect(errorReport.recovery.canRetry).toBe(true);
      expect(errorReport.timestamp).toBeDefined();
    });
  });
});

// Export test utilities for use in other test files
module.exports = {
  // Helper functions that can be used in integration tests
  simulateUnavailableConsultants: () => [],
  simulateConcurrentRequests: async (count) => {
    const promises = Array.from({ length: count }, (_, i) => 
      Promise.resolve({ sdrId: i + 1, timestamp: Date.now() })
    );
    return Promise.all(promises);
  },
  createMockDatabase: () => ({
    connected: false,
    query: jest.fn(),
    connect: jest.fn(),
    disconnect: jest.fn()
  })
};