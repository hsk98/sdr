import React, { useState, useEffect } from 'react';
import { assignmentAPI } from '../services/api';

interface AuditLog {
  id: number;
  action: string;
  details: any;
  timestamp: string;
  user_id?: number;
  assignment_id?: number;
  consultant_id?: number;
  created_at: string;
}

const AuditTrail: React.FC = () => {
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    action: '',
    sdr_id: '',
    consultant_id: '',
    from_date: '',
    to_date: '',
    limit: '100'
  });
  const [error, setError] = useState('');

  useEffect(() => {
    loadAuditLogs();
  }, []);

  const loadAuditLogs = async () => {
    try {
      setLoading(true);
      const logs = await assignmentAPI.getAuditLogs(filters);
      setAuditLogs(logs.logs || []);
    } catch (err: any) {
      console.error('Error loading audit logs:', err);
      setError('Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const applyFilters = () => {
    loadAuditLogs();
  };

  const resetFilters = () => {
    setFilters({
      action: '',
      sdr_id: '',
      consultant_id: '',
      from_date: '',
      to_date: '',
      limit: '100'
    });
    setTimeout(loadAuditLogs, 100);
  };

  const getActionIcon = (action: string) => {
    const actionMap: { [key: string]: string } = {
      'BLIND_ASSIGNMENT_REQUEST': '🎯',
      'BLIND_ASSIGNMENT_COMPLETED': '✅',
      'BLIND_ASSIGNMENT_FAILED': '❌',
      'MANAGER_OVERRIDE_ASSIGNMENT': '👑',
      'ASSIGNMENT_DELETION_INITIATED': '🗑️',
      'ASSIGNMENT_DELETED_SUCCESSFULLY': '✅',
      'ASSIGNMENT_CANCELLATION_INITIATED': '❌',
      'ASSIGNMENT_CANCELLED_SUCCESSFULLY': '✅',
      'AUTOMATIC_REASSIGNMENT_COMPLETED': '🔄',
      'QUEUE_REBALANCED_AFTER_DELETION': '⚖️',
      'FORCE_REBALANCE_INITIATED': '🔧',
      'ANALYTICS_ACCESSED': '📊',
      'AUDIT_LOGS_ACCESSED': '🔍'
    };
    return actionMap[action] || '📋';
  };

  const getActionColor = (action: string) => {
    if (action.includes('FAILED') || action.includes('ERROR')) return '#e53e3e';
    if (action.includes('COMPLETED') || action.includes('SUCCESSFULLY')) return '#38a169';
    if (action.includes('INITIATED') || action.includes('REQUEST')) return '#3182ce';
    if (action.includes('OVERRIDE') || action.includes('MANUAL')) return '#d69e2e';
    return '#4a5568';
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  const formatDetails = (details: any) => {
    if (!details) return 'No details available';
    
    // Handle different types of audit details
    if (typeof details === 'string') {
      try {
        return JSON.stringify(JSON.parse(details), null, 2);
      } catch {
        return details;
      }
    }
    
    return JSON.stringify(details, null, 2);
  };

  const getAssignmentComparison = (log: AuditLog) => {
    const details = log.details;
    
    if (log.action === 'MANAGER_OVERRIDE_ASSIGNMENT' && details) {
      return (
        <div className="assignment-comparison">
          <div className="comparison-header">
            <h4>Assignment Override Details</h4>
          </div>
          <div className="comparison-content">
            <div className="override-info">
              <strong>Override Type:</strong> {details.override_type || 'Manual Assignment'}<br/>
              <strong>Lead:</strong> {details.lead_name} ({details.lead_identifier})<br/>
              <strong>Consultant:</strong> {details.consultant_name}<br/>
              <strong>Manager:</strong> {details.manager_info}<br/>
              <strong>Reason:</strong> {details.override_reason}
            </div>
            <div className="impact-note">
              <span className="impact-icon">⚠️</span>
              <span>This bypassed the normal round-robin queue</span>
            </div>
          </div>
        </div>
      );
    }

    if (log.action === 'AUTOMATIC_REASSIGNMENT_COMPLETED' && details) {
      return (
        <div className="assignment-comparison">
          <div className="comparison-header">
            <h4>Assignment Reassignment</h4>
          </div>
          <div className="comparison-grid">
            <div className="original-assignment">
              <h5>❌ Original Assignment</h5>
              <p><strong>Assignment ID:</strong> {details.original_assignment_id}</p>
              <p><strong>Consultant ID:</strong> {details.original_consultant_id}</p>
            </div>
            <div className="new-assignment">
              <h5>✅ New Assignment</h5>
              <p><strong>Assignment ID:</strong> {details.new_assignment_id}</p>
              <p><strong>Consultant ID:</strong> {details.new_consultant_id}</p>
            </div>
          </div>
          <div className="reassignment-reason">
            <strong>Reason:</strong> {details.reassignment_reason}
          </div>
        </div>
      );
    }

    if (log.action === 'BLIND_ASSIGNMENT_COMPLETED' && details) {
      return (
        <div className="assignment-comparison">
          <div className="comparison-header">
            <h4>Blind Assignment Success</h4>
          </div>
          <div className="blind-assignment-details">
            <div className="assignment-info">
              <p><strong>SDR:</strong> {details.sdr_id}</p>
              <p><strong>Consultant:</strong> {details.consultant_name} (ID: {details.consultant_id})</p>
              <p><strong>Assignment ID:</strong> {details.assignment_id}</p>
              {details.lead_info && (
                <p><strong>Lead:</strong> {details.lead_info.leadName} ({details.lead_info.leadId})</p>
              )}
            </div>
            <div className="fairness-metrics">
              <h5>Fairness Metrics</h5>
              <p><strong>Assignment Count:</strong> {details.fairness_metrics?.consultant_assignment_count}</p>
              <p><strong>Fairness Score:</strong> {details.fairness_metrics?.fairness_score}</p>
            </div>
          </div>
        </div>
      );
    }

    return null;
  };

  const actionOptions = [
    'BLIND_ASSIGNMENT_REQUEST',
    'BLIND_ASSIGNMENT_COMPLETED',
    'MANAGER_OVERRIDE_ASSIGNMENT',
    'ASSIGNMENT_DELETION_INITIATED',
    'ASSIGNMENT_CANCELLATION_INITIATED',
    'AUTOMATIC_REASSIGNMENT_COMPLETED',
    'QUEUE_REBALANCED_AFTER_DELETION'
  ];

  return (
    <div className="audit-trail">
      <div className="audit-header">
        <h2>🔍 Assignment Audit Trail</h2>
        <p>Complete history of all assignment operations and modifications</p>
      </div>

      {/* Filters Section */}
      <div className="filters-section">
        <div className="filter-grid">
          <div className="filter-group">
            <label>Action Type:</label>
            <select
              value={filters.action}
              onChange={(e) => handleFilterChange('action', e.target.value)}
            >
              <option value="">All Actions</option>
              {actionOptions.map(action => (
                <option key={action} value={action}>
                  {getActionIcon(action)} {action.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label>SDR ID:</label>
            <input
              type="text"
              value={filters.sdr_id}
              onChange={(e) => handleFilterChange('sdr_id', e.target.value)}
              placeholder="Enter SDR ID"
            />
          </div>

          <div className="filter-group">
            <label>Consultant ID:</label>
            <input
              type="text"
              value={filters.consultant_id}
              onChange={(e) => handleFilterChange('consultant_id', e.target.value)}
              placeholder="Enter Consultant ID"
            />
          </div>

          <div className="filter-group">
            <label>From Date:</label>
            <input
              type="date"
              value={filters.from_date}
              onChange={(e) => handleFilterChange('from_date', e.target.value)}
            />
          </div>

          <div className="filter-group">
            <label>To Date:</label>
            <input
              type="date"
              value={filters.to_date}
              onChange={(e) => handleFilterChange('to_date', e.target.value)}
            />
          </div>

          <div className="filter-group">
            <label>Limit:</label>
            <select
              value={filters.limit}
              onChange={(e) => handleFilterChange('limit', e.target.value)}
            >
              <option value="50">50 records</option>
              <option value="100">100 records</option>
              <option value="200">200 records</option>
              <option value="500">500 records</option>
            </select>
          </div>
        </div>

        <div className="filter-actions">
          <button onClick={applyFilters} className="apply-filters-btn">
            🔍 Apply Filters
          </button>
          <button onClick={resetFilters} className="reset-filters-btn">
            🔄 Reset
          </button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="error-message">
          <span className="error-icon">⚠️</span>
          <span>{error}</span>
          <button onClick={() => setError('')} className="error-close">×</button>
        </div>
      )}

      {/* Audit Logs Display */}
      {loading ? (
        <div className="loading-state">
          <span className="spinner"></span>
          Loading audit logs...
        </div>
      ) : (
        <div className="audit-logs">
          {auditLogs.length === 0 ? (
            <div className="no-logs">
              <div className="no-logs-icon">📋</div>
              <h3>No audit logs found</h3>
              <p>Try adjusting your filter criteria or check back later</p>
            </div>
          ) : (
            auditLogs.map((log) => (
              <div key={log.id} className="audit-log-item">
                <div className="log-header">
                  <div className="log-action">
                    <span 
                      className="action-icon"
                      style={{ color: getActionColor(log.action) }}
                    >
                      {getActionIcon(log.action)}
                    </span>
                    <span className="action-text">
                      {log.action.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div className="log-timestamp">
                    {formatTimestamp(log.timestamp || log.created_at)}
                  </div>
                </div>

                {/* Assignment Comparison */}
                {getAssignmentComparison(log)}

                {/* Raw Details (Collapsible) */}
                <details className="log-details">
                  <summary>View Raw Details</summary>
                  <pre className="log-details-content">
                    {formatDetails(log.details)}
                  </pre>
                </details>
              </div>
            ))
          )}
        </div>
      )}

      <style>{`
        .audit-trail {
          background: white;
          border-radius: 16px;
          padding: 2rem;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
        }

        .audit-header {
          text-align: center;
          margin-bottom: 2rem;
        }

        .audit-header h2 {
          color: #2d3748;
          margin: 0 0 0.5rem 0;
          font-size: 1.8rem;
          font-weight: 700;
        }

        .audit-header p {
          color: #4a5568;
          margin: 0;
          font-size: 1rem;
        }

        .filters-section {
          background: #f7fafc;
          border-radius: 12px;
          padding: 1.5rem;
          margin-bottom: 2rem;
        }

        .filter-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1rem;
          margin-bottom: 1rem;
        }

        .filter-group {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .filter-group label {
          font-weight: 600;
          color: #2d3748;
          font-size: 0.9rem;
        }

        .filter-group input,
        .filter-group select {
          padding: 0.75rem;
          border: 2px solid #e2e8f0;
          border-radius: 8px;
          font-size: 0.95rem;
        }

        .filter-actions {
          display: flex;
          gap: 1rem;
          justify-content: center;
        }

        .apply-filters-btn,
        .reset-filters-btn {
          padding: 0.75rem 1.5rem;
          border: none;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .apply-filters-btn {
          background: #667eea;
          color: white;
        }

        .apply-filters-btn:hover {
          background: #5a67d8;
        }

        .reset-filters-btn {
          background: #e2e8f0;
          color: #4a5568;
        }

        .reset-filters-btn:hover {
          background: #cbd5e0;
        }

        .error-message {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 1rem;
          background: #fed7d7;
          color: #742a2a;
          border: 1px solid #feb2b2;
          border-radius: 8px;
          margin-bottom: 1.5rem;
        }

        .error-close {
          margin-left: auto;
          background: none;
          border: none;
          font-size: 1.2rem;
          cursor: pointer;
          color: inherit;
        }

        .loading-state {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          padding: 3rem;
          color: #4a5568;
        }

        .no-logs {
          text-align: center;
          padding: 3rem;
          color: #4a5568;
        }

        .no-logs-icon {
          font-size: 3rem;
          margin-bottom: 1rem;
        }

        .audit-logs {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .audit-log-item {
          background: #f7fafc;
          border-radius: 12px;
          padding: 1.5rem;
          border-left: 4px solid #cbd5e0;
        }

        .log-header {
          display: flex;
          justify-content: between;
          align-items: center;
          margin-bottom: 1rem;
        }

        .log-action {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          flex: 1;
        }

        .action-icon {
          font-size: 1.5rem;
        }

        .action-text {
          font-weight: 600;
          color: #2d3748;
          text-transform: capitalize;
        }

        .log-timestamp {
          color: #718096;
          font-size: 0.9rem;
          font-family: monospace;
        }

        .assignment-comparison {
          background: white;
          border-radius: 8px;
          padding: 1rem;
          margin-bottom: 1rem;
          border: 2px solid #e2e8f0;
        }

        .comparison-header h4 {
          margin: 0 0 1rem 0;
          color: #2d3748;
          font-size: 1.1rem;
        }

        .comparison-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
          margin-bottom: 1rem;
        }

        .original-assignment,
        .new-assignment {
          padding: 1rem;
          border-radius: 8px;
        }

        .original-assignment {
          background: #fed7d7;
          border: 1px solid #feb2b2;
        }

        .new-assignment {
          background: #c6f6d5;
          border: 1px solid #9ae6b4;
        }

        .original-assignment h5,
        .new-assignment h5 {
          margin: 0 0 0.5rem 0;
          font-size: 0.9rem;
        }

        .override-info {
          line-height: 1.6;
          margin-bottom: 1rem;
        }

        .impact-note {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem;
          background: #fef5e7;
          border-radius: 6px;
          font-size: 0.9rem;
          color: #744210;
        }

        .blind-assignment-details {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
        }

        .assignment-info,
        .fairness-metrics {
          padding: 1rem;
          background: #edf2f7;
          border-radius: 8px;
        }

        .fairness-metrics h5 {
          margin: 0 0 0.5rem 0;
          color: #2d3748;
        }

        .reassignment-reason {
          margin-top: 1rem;
          padding: 0.75rem;
          background: #bee3f8;
          border-radius: 6px;
          font-size: 0.9rem;
        }

        .log-details {
          margin-top: 1rem;
        }

        .log-details summary {
          cursor: pointer;
          font-weight: 600;
          color: #4a5568;
          padding: 0.5rem;
        }

        .log-details summary:hover {
          color: #2d3748;
        }

        .log-details-content {
          background: #1a202c;
          color: #e2e8f0;
          padding: 1rem;
          border-radius: 8px;
          overflow-x: auto;
          font-size: 0.85rem;
          line-height: 1.4;
          margin-top: 0.5rem;
        }

        .spinner {
          width: 20px;
          height: 20px;
          border: 2px solid transparent;
          border-top: 2px solid currentColor;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        @media (max-width: 768px) {
          .audit-trail {
            padding: 1rem;
          }

          .filter-grid {
            grid-template-columns: 1fr;
          }

          .filter-actions {
            flex-direction: column;
          }

          .log-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 0.5rem;
          }

          .comparison-grid,
          .blind-assignment-details {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
};

export default AuditTrail;