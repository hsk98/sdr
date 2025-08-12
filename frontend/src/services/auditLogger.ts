interface AuditLogEntry {
  id?: string;
  timestamp: string;
  userId: number | string;
  userEmail: string;
  action: string;
  entityType: 'assignment' | 'consultant' | 'lead' | 'system';
  entityId?: number | string;
  details: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
}

interface LogContext {
  userId: number | string;
  userEmail: string;
  sessionId?: string;
}

class AuditLogger {
  private context: LogContext | null = null;
  private logQueue: AuditLogEntry[] = [];
  private batchSize = 10;
  private flushInterval = 5000; // 5 seconds
  private isOnline = navigator.onLine;

  constructor() {
    this.setupEventListeners();
    this.startBatchProcessor();
  }

  // Set logging context (call on login)
  setContext(context: LogContext) {
    this.context = context;
    this.log('system', 'user_session_start', {
      userId: context.userId,
      userEmail: context.userEmail
    });
  }

  // Clear context (call on logout)
  clearContext() {
    if (this.context) {
      this.log('system', 'user_session_end', {
        userId: this.context.userId,
        userEmail: this.context.userEmail
      });
    }
    this.context = null;
  }

  // Main logging method
  async log(
    entityType: AuditLogEntry['entityType'],
    action: string,
    details: Record<string, any> = {},
    entityId?: number | string
  ): Promise<void> {
    if (!this.context) {
      console.warn('[AuditLogger] No context set, cannot log audit entry');
      return;
    }

    const entry: AuditLogEntry = {
      id: this.generateId(),
      timestamp: new Date().toISOString(),
      userId: this.context.userId,
      userEmail: this.context.userEmail,
      sessionId: this.context.sessionId,
      action,
      entityType,
      entityId,
      details: {
        ...details,
        userAgent: navigator.userAgent,
        url: window.location.href
      },
      ipAddress: await this.getClientIP()
    };

    // Add to queue
    this.logQueue.push(entry);

    // If queue is full or we're offline, process immediately
    if (this.logQueue.length >= this.batchSize || !this.isOnline) {
      await this.flushQueue();
    }
  }

  // Specific logging methods for common actions
  async logAssignment(action: 'created' | 'updated' | 'completed' | 'cancelled', assignmentData: any) {
    await this.log('assignment', `assignment_${action}`, {
      leadId: assignmentData.leadId || assignmentData.lead_identifier,
      leadName: assignmentData.leadName || assignmentData.lead_name,
      consultantId: assignmentData.consultantId || assignmentData.consultant_id,
      consultantName: assignmentData.consultantName || assignmentData.consultant_name,
      assignmentMethod: assignmentData.assignmentMethod || 'blind',
      previousStatus: assignmentData.previousStatus,
      newStatus: assignmentData.status
    }, assignmentData.id);
  }

  async logDataValidation(field: string, error: string, value: any) {
    await this.log('system', 'validation_error', {
      field,
      error,
      valueLength: typeof value === 'string' ? value.length : undefined,
      valueType: typeof value
    });
  }

  async logSecurityEvent(eventType: 'xss_attempt' | 'injection_attempt' | 'invalid_access', details: Record<string, any>) {
    await this.log('system', `security_${eventType}`, {
      ...details,
      severity: 'high',
      requiresReview: true
    });
  }

  async logSystemError(error: Error, context: Record<string, any> = {}) {
    await this.log('system', 'error', {
      errorMessage: error.message,
      errorStack: error.stack,
      errorName: error.name,
      ...context
    });
  }

  async logOfflineAction(action: string, data: any) {
    await this.log('system', 'offline_action', {
      action,
      data,
      queuedAt: new Date().toISOString()
    });
  }

  async logIntegrityCheck(result: any) {
    await this.log('system', 'integrity_check', {
      isValid: result.isValid,
      conflictCount: result.conflicts?.length || 0,
      warningCount: result.warnings?.length || 0,
      conflicts: result.conflicts,
      warnings: result.warnings
    });
  }

  // Flush queue to server
  private async flushQueue(): Promise<void> {
    if (this.logQueue.length === 0) return;

    const batch = [...this.logQueue];
    this.logQueue = [];

    try {
      if (this.isOnline) {
        const response = await fetch('/api/audit/batch', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ entries: batch })
        });

        if (!response.ok) {
          throw new Error(`Audit logging failed: ${response.status}`);
        }

        console.log(`[AuditLogger] Successfully logged ${batch.length} entries`);
      } else {
        // Store offline for later
        this.storeOfflineLogs(batch);
      }
    } catch (error) {
      console.error('[AuditLogger] Failed to flush audit logs:', error);
      // Re-queue failed entries
      this.logQueue.unshift(...batch);
      
      // Store offline as backup
      this.storeOfflineLogs(batch);
    }
  }

  // Store logs offline in localStorage
  private storeOfflineLogs(entries: AuditLogEntry[]): void {
    try {
      const existingLogs = localStorage.getItem('offline_audit_logs');
      const logs = existingLogs ? JSON.parse(existingLogs) : [];
      
      logs.push(...entries);
      
      // Keep only last 1000 entries to prevent storage bloat
      if (logs.length > 1000) {
        logs.splice(0, logs.length - 1000);
      }
      
      localStorage.setItem('offline_audit_logs', JSON.stringify(logs));
      console.log(`[AuditLogger] Stored ${entries.length} logs offline`);
    } catch (error) {
      console.error('[AuditLogger] Failed to store offline logs:', error);
    }
  }

  // Process offline logs when back online
  private async processOfflineLogs(): Promise<void> {
    try {
      const offlineLogs = localStorage.getItem('offline_audit_logs');
      if (!offlineLogs) return;

      const logs: AuditLogEntry[] = JSON.parse(offlineLogs);
      if (logs.length === 0) return;

      console.log(`[AuditLogger] Processing ${logs.length} offline logs`);

      // Process in smaller batches to avoid overwhelming the server
      const batchSize = 50;
      for (let i = 0; i < logs.length; i += batchSize) {
        const batch = logs.slice(i, i + batchSize);
        
        try {
          const response = await fetch('/api/audit/batch', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
              entries: batch,
              isOfflineSync: true
            })
          });

          if (!response.ok) {
            throw new Error(`Batch ${i / batchSize + 1} failed: ${response.status}`);
          }
        } catch (error) {
          console.error(`[AuditLogger] Failed to sync batch ${i / batchSize + 1}:`, error);
          // Keep failed batches for next sync attempt
          break;
        }
      }

      // Clear processed logs
      localStorage.removeItem('offline_audit_logs');
      console.log('[AuditLogger] Offline log sync completed');
    } catch (error) {
      console.error('[AuditLogger] Failed to process offline logs:', error);
    }
  }

  // Setup event listeners
  private setupEventListeners(): void {
    // Online/offline events
    window.addEventListener('online', () => {
      this.isOnline = true;
      console.log('[AuditLogger] Back online - processing offline logs');
      this.processOfflineLogs();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      console.log('[AuditLogger] Gone offline - logs will be queued');
    });

    // Page unload - flush remaining logs
    window.addEventListener('beforeunload', () => {
      if (this.logQueue.length > 0) {
        // Use sendBeacon for reliable last-minute logging
        const payload = JSON.stringify({ entries: this.logQueue });
        navigator.sendBeacon('/api/audit/batch', payload);
      }
    });
  }

  // Start batch processor
  private startBatchProcessor(): void {
    setInterval(() => {
      if (this.logQueue.length > 0) {
        this.flushQueue();
      }
    }, this.flushInterval);
  }

  // Utility methods
  private generateId(): string {
    return `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async getClientIP(): Promise<string | undefined> {
    try {
      // This would typically be provided by your backend
      // or a service like ipify.org
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      return data.ip;
    } catch {
      return undefined;
    }
  }

  // Get logging statistics
  getStats(): {
    queueSize: number;
    isOnline: boolean;
    hasOfflineLogs: boolean;
    offlineLogCount: number;
  } {
    const offlineLogs = localStorage.getItem('offline_audit_logs');
    const offlineLogCount = offlineLogs ? JSON.parse(offlineLogs).length : 0;

    return {
      queueSize: this.logQueue.length,
      isOnline: this.isOnline,
      hasOfflineLogs: offlineLogCount > 0,
      offlineLogCount
    };
  }
}

// Export singleton instance
export const auditLogger = new AuditLogger();
export type { AuditLogEntry, LogContext };