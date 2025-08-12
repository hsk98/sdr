import React, { useState, useEffect } from 'react';
import { assignmentAPI, consultantAPI } from '../services/api';
import { Assignment, Consultant } from '../types';

interface BulkOperation {
  id: string;
  type: 'reassign' | 'cancel' | 'delete' | 'rebalance';
  assignments: Assignment[];
  targetConsultantId?: number;
  reason: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  progress?: number;
  error?: string;
}

const BulkAssignmentCorrections: React.FC = () => {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [consultants, setConsultants] = useState<Consultant[]>([]);
  const [selectedAssignments, setSelectedAssignments] = useState<number[]>([]);
  const [bulkOperations, setBulkOperations] = useState<BulkOperation[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeOperation, setActiveOperation] = useState<BulkOperation | null>(null);
  const [filters, setFilters] = useState({
    status: 'all',
    consultant: 'all',
    dateRange: '7d'
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [assignmentsData, consultantsData] = await Promise.all([
        assignmentAPI.getAll(),
        consultantAPI.getActive()
      ]);
      setAssignments(assignmentsData);
      setConsultants(consultantsData);
    } catch (err: any) {
      console.error('Error loading data:', err);
      setError('Failed to load assignment data');
    } finally {
      setLoading(false);
    }
  };

  const filteredAssignments = assignments.filter(assignment => {
    const statusMatch = filters.status === 'all' || assignment.status === filters.status;
    const consultantMatch = filters.consultant === 'all' || assignment.consultant_id.toString() === filters.consultant;
    
    let dateMatch = true;
    if (filters.dateRange !== 'all') {
      const days = parseInt(filters.dateRange.replace('d', ''));
      const assignedDate = new Date(assignment.assigned_at);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      dateMatch = assignedDate >= cutoffDate;
    }
    
    return statusMatch && consultantMatch && dateMatch;
  });

  const toggleAssignmentSelection = (assignmentId: number) => {
    setSelectedAssignments(prev => 
      prev.includes(assignmentId)
        ? prev.filter(id => id !== assignmentId)
        : [...prev, assignmentId]
    );
  };

  const selectAll = () => {
    if (selectedAssignments.length === filteredAssignments.length) {
      setSelectedAssignments([]);
    } else {
      setSelectedAssignments(filteredAssignments.map(a => a.id));
    }
  };

  const getSelectedAssignmentObjects = () => {
    return assignments.filter(a => selectedAssignments.includes(a.id));
  };

  const initiateBulkOperation = (type: BulkOperation['type']) => {
    if (selectedAssignments.length === 0) {
      setError('Please select at least one assignment');
      return;
    }

    const newOperation: BulkOperation = {
      id: `bulk_${Date.now()}`,
      type,
      assignments: getSelectedAssignmentObjects(),
      reason: '',
      status: 'pending'
    };

    setActiveOperation(newOperation);
  };

  const executeBulkOperation = async () => {
    if (!activeOperation || !activeOperation.reason.trim()) {
      setError('Reason is required for bulk operations');
      return;
    }

    const updatedOperation = { ...activeOperation, status: 'in_progress' as const, progress: 0 };
    setBulkOperations(prev => [...prev, updatedOperation]);
    setActiveOperation(null);

    try {
      const total = updatedOperation.assignments.length;
      let completed = 0;
      const errors: string[] = [];

      for (const assignment of updatedOperation.assignments) {
        try {
          switch (updatedOperation.type) {
            case 'cancel':
              await assignmentAPI.cancelAssignment(assignment.id, updatedOperation.reason);
              break;
            case 'delete':
              await assignmentAPI.deleteAssignment(assignment.id, updatedOperation.reason);
              break;
            case 'reassign':
              if (updatedOperation.targetConsultantId) {
                // First cancel the current assignment
                await assignmentAPI.cancelAssignment(assignment.id, 'Bulk reassignment operation');
                // Then create a new assignment (this would need a new API endpoint)
                await assignmentAPI.createManagerOverride({
                  leadId: assignment.display_lead_id || `reassign_${assignment.id}`,
                  leadName: assignment.display_lead_name || 'Bulk Reassignment',
                  consultantId: updatedOperation.targetConsultantId,
                  reason: `Bulk reassignment: ${updatedOperation.reason}`,
                  overrideType: 'bulk_reassignment'
                });
              }
              break;
          }
          completed++;
        } catch (err: any) {
          errors.push(`Assignment ${assignment.id}: ${err.response?.data?.error || err.message}`);
        }

        // Update progress
        const progress = Math.round((completed / total) * 100);
        setBulkOperations(prev => prev.map(op => 
          op.id === updatedOperation.id 
            ? { ...op, progress }
            : op
        ));
      }

      // Mark operation as completed
      setBulkOperations(prev => prev.map(op => 
        op.id === updatedOperation.id 
          ? { 
              ...op, 
              status: errors.length > 0 ? 'failed' : 'completed',
              error: errors.length > 0 ? errors.join('; ') : undefined
            }
          : op
      ));

      if (errors.length === 0) {
        setSuccess(`Bulk ${updatedOperation.type} operation completed successfully for ${completed} assignments`);
      } else {
        setError(`Bulk operation completed with ${errors.length} errors. Check operation details.`);
      }

      // Clear selections and reload data
      setSelectedAssignments([]);
      await loadData();

    } catch (err: any) {
      setBulkOperations(prev => prev.map(op => 
        op.id === updatedOperation.id 
          ? { ...op, status: 'failed', error: err.message }
          : op
      ));
      setError('Bulk operation failed');
    }
  };

  const clearMessages = () => {
    setError('');
    setSuccess('');
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return '#48bb78';
      case 'completed': return '#38a169';
      case 'cancelled': return '#e53e3e';
      default: return '#718096';
    }
  };

  const getOperationIcon = (type: string) => {
    switch (type) {
      case 'reassign': return '🔄';
      case 'cancel': return '❌';
      case 'delete': return '🗑️';
      case 'rebalance': return '⚖️';
      default: return '📋';
    }
  };

  const getOperationStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return '#38a169';
      case 'failed': return '#e53e3e';
      case 'in_progress': return '#3182ce';
      case 'pending': return '#d69e2e';
      default: return '#718096';
    }
  };

  return (
    <div className="bulk-corrections">
      <div className="bulk-header">
        <h2>📦 Bulk Assignment Corrections</h2>
        <p>Select multiple assignments and perform bulk operations for efficient management</p>
      </div>

      {/* Alert Messages */}
      {(error || success) && (
        <div className="alert-container">
          {error && (
            <div className="alert alert-error">
              <span className="alert-icon">⚠️</span>
              <span className="alert-message">{error}</span>
              <button onClick={clearMessages} className="alert-close">×</button>
            </div>
          )}
          {success && (
            <div className="alert alert-success">
              <span className="alert-icon">✅</span>
              <span className="alert-message">{success}</span>
              <button onClick={clearMessages} className="alert-close">×</button>
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="filters-section">
        <div className="filter-grid">
          <div className="filter-group">
            <label>Status:</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          <div className="filter-group">
            <label>Consultant:</label>
            <select
              value={filters.consultant}
              onChange={(e) => setFilters(prev => ({ ...prev, consultant: e.target.value }))}
            >
              <option value="all">All Consultants</option>
              {consultants.map(consultant => (
                <option key={consultant.id} value={consultant.id.toString()}>
                  {consultant.name}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label>Date Range:</label>
            <select
              value={filters.dateRange}
              onChange={(e) => setFilters(prev => ({ ...prev, dateRange: e.target.value }))}
            >
              <option value="all">All Time</option>
              <option value="1d">Last 24 hours</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
            </select>
          </div>
        </div>
      </div>

      {/* Selection and Bulk Actions */}
      <div className="bulk-actions-section">
        <div className="selection-info">
          <button onClick={selectAll} className="select-all-btn">
            {selectedAssignments.length === filteredAssignments.length ? '☑️ Deselect All' : '☐ Select All'}
          </button>
          <span className="selection-count">
            {selectedAssignments.length} of {filteredAssignments.length} selected
          </span>
        </div>

        {selectedAssignments.length > 0 && (
          <div className="bulk-actions">
            <button
              onClick={() => initiateBulkOperation('cancel')}
              className="bulk-action-btn cancel-btn"
            >
              ❌ Cancel Selected
            </button>
            <button
              onClick={() => initiateBulkOperation('reassign')}
              className="bulk-action-btn reassign-btn"
            >
              🔄 Reassign Selected
            </button>
            <button
              onClick={() => initiateBulkOperation('delete')}
              className="bulk-action-btn delete-btn"
            >
              🗑️ Delete Selected
            </button>
          </div>
        )}
      </div>

      {/* Assignments Table */}
      {loading ? (
        <div className="loading-state">
          <span className="spinner"></span>
          Loading assignments...
        </div>
      ) : (
        <div className="assignments-table">
          <table>
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    checked={selectedAssignments.length === filteredAssignments.length && filteredAssignments.length > 0}
                    onChange={selectAll}
                  />
                </th>
                <th>Lead/Company</th>
                <th>Consultant</th>
                <th>SDR</th>
                <th>Status</th>
                <th>Assigned</th>
              </tr>
            </thead>
            <tbody>
              {filteredAssignments.map(assignment => (
                <tr 
                  key={assignment.id}
                  className={selectedAssignments.includes(assignment.id) ? 'selected' : ''}
                >
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedAssignments.includes(assignment.id)}
                      onChange={() => toggleAssignmentSelection(assignment.id)}
                    />
                  </td>
                  <td>
                    <div className="lead-info">
                      <strong>{assignment.display_lead_name || 'Unknown Lead'}</strong>
                      <small>{assignment.display_lead_id}</small>
                    </div>
                  </td>
                  <td>
                    <div className="consultant-info">
                      <strong>{assignment.consultant_name}</strong>
                      <small>{assignment.consultant_email}</small>
                    </div>
                  </td>
                  <td>
                    <span className={assignment.is_manual ? 'manual-assignment' : ''}>
                      {assignment.display_sdr_name}
                    </span>
                  </td>
                  <td>
                    <span 
                      className="status-badge"
                      style={{ backgroundColor: getStatusColor(assignment.status) }}
                    >
                      {assignment.status}
                    </span>
                  </td>
                  <td>
                    <time>{formatDate(assignment.assigned_at)}</time>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredAssignments.length === 0 && (
            <div className="no-assignments">
              <div className="no-assignments-icon">📭</div>
              <h3>No assignments found</h3>
              <p>Try adjusting your filter criteria</p>
            </div>
          )}
        </div>
      )}

      {/* Bulk Operations History */}
      {bulkOperations.length > 0 && (
        <div className="operations-history">
          <h3>🕒 Recent Bulk Operations</h3>
          <div className="operations-list">
            {bulkOperations.slice(-5).reverse().map(operation => (
              <div key={operation.id} className="operation-item">
                <div className="operation-header">
                  <div className="operation-info">
                    <span className="operation-icon">{getOperationIcon(operation.type)}</span>
                    <span className="operation-type">Bulk {operation.type}</span>
                    <span className="operation-count">({operation.assignments.length} assignments)</span>
                  </div>
                  <span 
                    className="operation-status"
                    style={{ color: getOperationStatusColor(operation.status) }}
                  >
                    {operation.status}
                  </span>
                </div>
                
                {operation.status === 'in_progress' && operation.progress !== undefined && (
                  <div className="progress-bar">
                    <div 
                      className="progress-fill"
                      style={{ width: `${operation.progress}%` }}
                    ></div>
                    <span className="progress-text">{operation.progress}%</span>
                  </div>
                )}
                
                {operation.error && (
                  <div className="operation-error">
                    <span className="error-icon">⚠️</span>
                    <span>{operation.error}</span>
                  </div>
                )}
                
                <div className="operation-reason">
                  <strong>Reason:</strong> {operation.reason}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bulk Operation Modal */}
      {activeOperation && (
        <div className="modal-overlay" onClick={() => setActiveOperation(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                {getOperationIcon(activeOperation.type)} Bulk {activeOperation.type.charAt(0).toUpperCase() + activeOperation.type.slice(1)}
              </h3>
            </div>

            <div className="modal-body">
              <p>
                <strong>Operation:</strong> {activeOperation.type}<br/>
                <strong>Assignments:</strong> {activeOperation.assignments.length} selected
              </p>

              {activeOperation.type === 'reassign' && (
                <div className="form-group">
                  <label>Target Consultant:</label>
                  <select
                    value={activeOperation.targetConsultantId || ''}
                    onChange={(e) => setActiveOperation({
                      ...activeOperation,
                      targetConsultantId: parseInt(e.target.value)
                    })}
                    required
                  >
                    <option value="">Select consultant...</option>
                    {consultants.map(consultant => (
                      <option key={consultant.id} value={consultant.id}>
                        {consultant.name} - {consultant.email}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="form-group">
                <label>Reason (required):</label>
                <textarea
                  value={activeOperation.reason}
                  onChange={(e) => setActiveOperation({
                    ...activeOperation,
                    reason: e.target.value
                  })}
                  placeholder="Provide detailed reason for this bulk operation..."
                  rows={3}
                  required
                />
              </div>

              <div className="assignment-preview">
                <h4>Assignments to be affected:</h4>
                <div className="preview-list">
                  {activeOperation.assignments.slice(0, 5).map(assignment => (
                    <div key={assignment.id} className="preview-item">
                      {assignment.display_lead_name} → {assignment.consultant_name}
                    </div>
                  ))}
                  {activeOperation.assignments.length > 5 && (
                    <div className="preview-more">
                      +{activeOperation.assignments.length - 5} more assignments
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="modal-actions">
              <button
                className="btn-secondary"
                onClick={() => setActiveOperation(null)}
              >
                Cancel
              </button>
              <button
                className="btn-primary btn-danger"
                onClick={executeBulkOperation}
                disabled={
                  !activeOperation.reason.trim() ||
                  (activeOperation.type === 'reassign' && !activeOperation.targetConsultantId)
                }
              >
                Execute Bulk {activeOperation.type}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .bulk-corrections {
          background: white;
          border-radius: 16px;
          padding: 2rem;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
        }

        .bulk-header {
          text-align: center;
          margin-bottom: 2rem;
        }

        .bulk-header h2 {
          color: #2d3748;
          margin: 0 0 0.5rem 0;
          font-size: 1.8rem;
          font-weight: 700;
        }

        .bulk-header p {
          color: #4a5568;
          margin: 0;
          font-size: 1rem;
        }

        .alert-container {
          margin-bottom: 1.5rem;
        }

        .alert {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 1rem;
          border-radius: 8px;
          margin-bottom: 0.5rem;
        }

        .alert-error {
          background: #fed7d7;
          color: #742a2a;
          border: 1px solid #feb2b2;
        }

        .alert-success {
          background: #c6f6d5;
          color: #276749;
          border: 1px solid #9ae6b4;
        }

        .alert-close {
          margin-left: auto;
          background: none;
          border: none;
          font-size: 1.2rem;
          cursor: pointer;
          color: inherit;
        }

        .filters-section {
          background: #f7fafc;
          border-radius: 12px;
          padding: 1.5rem;
          margin-bottom: 1.5rem;
        }

        .filter-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1rem;
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

        .filter-group select {
          padding: 0.75rem;
          border: 2px solid #e2e8f0;
          border-radius: 8px;
          font-size: 0.95rem;
        }

        .bulk-actions-section {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1.5rem;
          padding: 1rem;
          background: #edf2f7;
          border-radius: 8px;
        }

        .selection-info {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .select-all-btn {
          background: none;
          border: 2px solid #cbd5e0;
          border-radius: 6px;
          padding: 0.5rem 1rem;
          cursor: pointer;
          font-weight: 600;
          transition: all 0.2s;
        }

        .select-all-btn:hover {
          border-color: #a0aec0;
          background: #f7fafc;
        }

        .selection-count {
          font-weight: 600;
          color: #4a5568;
        }

        .bulk-actions {
          display: flex;
          gap: 0.5rem;
        }

        .bulk-action-btn {
          padding: 0.75rem 1rem;
          border: none;
          border-radius: 6px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          font-size: 0.9rem;
        }

        .cancel-btn {
          background: #fed7d7;
          color: #742a2a;
        }

        .cancel-btn:hover {
          background: #feb2b2;
        }

        .reassign-btn {
          background: #bee3f8;
          color: #2c5282;
        }

        .reassign-btn:hover {
          background: #90cdf4;
        }

        .delete-btn {
          background: #e2e8f0;
          color: #4a5568;
        }

        .delete-btn:hover {
          background: #cbd5e0;
        }

        .loading-state {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          padding: 3rem;
          color: #4a5568;
        }

        .assignments-table {
          background: white;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
          margin-bottom: 2rem;
        }

        .assignments-table table {
          width: 100%;
          border-collapse: collapse;
        }

        .assignments-table th,
        .assignments-table td {
          padding: 1rem;
          text-align: left;
          border-bottom: 1px solid #e2e8f0;
        }

        .assignments-table th {
          background: #f7fafc;
          font-weight: 600;
          color: #2d3748;
        }

        .assignments-table tr.selected {
          background: #e6fffa;
        }

        .lead-info,
        .consultant-info {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .lead-info strong,
        .consultant-info strong {
          color: #2d3748;
        }

        .lead-info small,
        .consultant-info small {
          color: #718096;
          font-size: 0.85rem;
        }

        .manual-assignment {
          background: #fef5e7;
          padding: 0.25rem 0.5rem;
          border-radius: 4px;
          font-size: 0.85rem;
          font-weight: 600;
        }

        .status-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.25rem;
          padding: 0.25rem 0.75rem;
          border-radius: 12px;
          color: white;
          font-size: 0.85rem;
          font-weight: 600;
        }

        .no-assignments {
          text-align: center;
          padding: 3rem;
          color: #4a5568;
        }

        .no-assignments-icon {
          font-size: 3rem;
          margin-bottom: 1rem;
        }

        .operations-history {
          margin-top: 2rem;
        }

        .operations-history h3 {
          color: #2d3748;
          margin-bottom: 1rem;
        }

        .operations-list {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .operation-item {
          background: #f7fafc;
          border-radius: 8px;
          padding: 1rem;
          border-left: 4px solid #cbd5e0;
        }

        .operation-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.5rem;
        }

        .operation-info {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .operation-type {
          font-weight: 600;
          color: #2d3748;
        }

        .operation-count {
          color: #718096;
          font-size: 0.9rem;
        }

        .operation-status {
          font-weight: 600;
          text-transform: uppercase;
          font-size: 0.8rem;
        }

        .progress-bar {
          position: relative;
          background: #e2e8f0;
          border-radius: 8px;
          height: 20px;
          margin-bottom: 0.5rem;
          overflow: hidden;
        }

        .progress-fill {
          background: #48bb78;
          height: 100%;
          transition: width 0.3s ease;
        }

        .progress-text {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          font-size: 0.8rem;
          font-weight: 600;
          color: #2d3748;
        }

        .operation-error {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          color: #742a2a;
          background: #fed7d7;
          padding: 0.5rem;
          border-radius: 4px;
          margin-bottom: 0.5rem;
          font-size: 0.9rem;
        }

        .operation-reason {
          color: #4a5568;
          font-size: 0.9rem;
        }

        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .modal-content {
          background: white;
          border-radius: 16px;
          padding: 2rem;
          max-width: 600px;
          width: 90%;
          max-height: 80vh;
          overflow-y: auto;
        }

        .modal-header h3 {
          margin: 0 0 1rem 0;
          color: #2d3748;
        }

        .modal-body {
          margin-bottom: 2rem;
        }

        .modal-body p {
          margin-bottom: 1rem;
          padding: 1rem;
          background: #f7fafc;
          border-radius: 8px;
        }

        .modal-body .form-group {
          margin-bottom: 1rem;
        }

        .modal-body label {
          display: block;
          margin-bottom: 0.5rem;
          font-weight: 600;
          color: #2d3748;
        }

        .modal-body select,
        .modal-body textarea {
          width: 100%;
          padding: 0.75rem;
          border: 2px solid #e2e8f0;
          border-radius: 8px;
          resize: vertical;
        }

        .assignment-preview {
          background: #edf2f7;
          border-radius: 8px;
          padding: 1rem;
        }

        .assignment-preview h4 {
          margin: 0 0 0.75rem 0;
          color: #2d3748;
          font-size: 0.95rem;
        }

        .preview-list {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .preview-item {
          background: white;
          padding: 0.5rem;
          border-radius: 4px;
          font-size: 0.9rem;
          color: #4a5568;
        }

        .preview-more {
          font-style: italic;
          color: #718096;
          text-align: center;
          padding: 0.5rem;
        }

        .modal-actions {
          display: flex;
          gap: 1rem;
          justify-content: flex-end;
        }

        .btn-secondary,
        .btn-primary {
          padding: 0.75rem 1.5rem;
          border: none;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-secondary {
          background: #e2e8f0;
          color: #4a5568;
        }

        .btn-secondary:hover {
          background: #cbd5e0;
        }

        .btn-primary {
          background: #667eea;
          color: white;
        }

        .btn-primary:hover:not(:disabled) {
          background: #5a67d8;
        }

        .btn-primary:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .btn-danger {
          background: #e53e3e !important;
        }

        .btn-danger:hover:not(:disabled) {
          background: #c53030 !important;
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
          .bulk-corrections {
            padding: 1rem;
          }

          .filter-grid {
            grid-template-columns: 1fr;
          }

          .bulk-actions-section {
            flex-direction: column;
            gap: 1rem;
            align-items: stretch;
          }

          .bulk-actions {
            justify-content: center;
          }

          .assignments-table {
            font-size: 0.9rem;
          }

          .modal-content {
            margin: 1rem;
            max-width: none;
          }

          .modal-actions {
            flex-direction: column;
          }
        }
      `}</style>
    </div>
  );
};

export default BulkAssignmentCorrections;