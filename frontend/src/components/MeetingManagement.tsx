import React, { useState, useEffect } from 'react';
import { assignmentAPI, consultantAPI } from '../services/api';
import { Assignment, Consultant } from '../types';
import VIPAssignment from './VIPAssignment';
import AuditTrail from './AuditTrail';
import BulkAssignmentCorrections from './BulkAssignmentCorrections';
import ConsultantUnavailability from './ConsultantUnavailability';

const MeetingManagement: React.FC = () => {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [consultants, setConsultants] = useState<Consultant[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'vip' | 'bulk' | 'reassign' | 'audit'>('overview');
  const [selectedAssignments, setSelectedAssignments] = useState<number[]>([]);
  const [actionModal, setActionModal] = useState<{
    type: 'delete' | 'cancel' | 'reassign' | null;
    assignment?: Assignment;
    reason: string;
    targetConsultant?: number;
    reassignImmediately?: boolean;
    rebalanceQueue?: boolean;
  }>({
    type: null,
    reason: '',
    reassignImmediately: false,
    rebalanceQueue: true
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

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

  const handleDeleteAssignment = async () => {
    if (!actionModal.assignment || !actionModal.reason.trim()) {
      setError('Reason is required for deletion');
      return;
    }

    try {
      await assignmentAPI.deleteAssignment(
        actionModal.assignment.id,
        actionModal.reason.trim(),
        actionModal.rebalanceQueue
      );
      
      setSuccess(`Assignment for ${actionModal.assignment.display_lead_name} deleted successfully`);
      setActionModal({ type: null, reason: '', rebalanceQueue: true });
      await loadData();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete assignment');
    }
  };

  const handleCancelAssignment = async () => {
    if (!actionModal.assignment || !actionModal.reason.trim()) {
      setError('Reason is required for cancellation');
      return;
    }

    try {
      await assignmentAPI.cancelAssignment(
        actionModal.assignment.id,
        actionModal.reason.trim(),
        actionModal.reassignImmediately
      );
      
      setSuccess(`Assignment for ${actionModal.assignment.display_lead_name} cancelled successfully`);
      setActionModal({ type: null, reason: '', reassignImmediately: false });
      await loadData();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to cancel assignment');
    }
  };

  const filteredAssignments = assignments.filter(assignment => {
    const matchesSearch = searchTerm === '' || 
      assignment.display_lead_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      assignment.consultant_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      assignment.display_sdr_name?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || assignment.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return '#48bb78';
      case 'completed': return '#38a169';
      case 'cancelled': return '#e53e3e';
      default: return '#718096';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return '🔄';
      case 'completed': return '✅';
      case 'cancelled': return '❌';
      default: return '📋';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const clearMessages = () => {
    setError('');
    setSuccess('');
  };

  return (
    <div className="meeting-management">
      <div className="management-header">
        <h2>📋 Meeting Management</h2>
        <p>Manage assignments, handle cancellations, and create VIP overrides</p>
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

      {/* Tab Navigation */}
      <div className="tab-navigation">
        <button 
          className={`tab-button ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          📊 Overview
        </button>
        <button 
          className={`tab-button ${activeTab === 'vip' ? 'active' : ''}`}
          onClick={() => setActiveTab('vip')}
        >
          👑 VIP Assignment
        </button>
        <button 
          className={`tab-button ${activeTab === 'bulk' ? 'active' : ''}`}
          onClick={() => setActiveTab('bulk')}
        >
          📦 Bulk Actions
        </button>
        <button 
          className={`tab-button ${activeTab === 'reassign' ? 'active' : ''}`}
          onClick={() => setActiveTab('reassign')}
        >
          🔄 Reassignments
        </button>
        <button 
          className={`tab-button ${activeTab === 'audit' ? 'active' : ''}`}
          onClick={() => setActiveTab('audit')}
        >
          🔍 Audit Trail
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="overview-tab">
          {/* Filters */}
          <div className="filters-section">
            <div className="search-group">
              <input
                type="text"
                placeholder="Search by lead name, consultant, or SDR..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
              />
            </div>
            <div className="filter-group">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="status-filter"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
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
                    <th>Lead/Company</th>
                    <th>Consultant</th>
                    <th>SDR</th>
                    <th>Status</th>
                    <th>Assigned</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAssignments.map(assignment => (
                    <tr key={assignment.id}>
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
                          {getStatusIcon(assignment.status)} {assignment.status}
                        </span>
                      </td>
                      <td>
                        <time>{formatDate(assignment.assigned_at)}</time>
                      </td>
                      <td>
                        <div className="action-buttons">
                          {assignment.status === 'active' && (
                            <>
                              <button
                                className="action-btn cancel-btn"
                                onClick={() => setActionModal({
                                  type: 'cancel',
                                  assignment,
                                  reason: '',
                                  reassignImmediately: false
                                })}
                              >
                                ❌ Cancel
                              </button>
                              <button
                                className="action-btn reassign-btn"
                                onClick={() => setActionModal({
                                  type: 'reassign',
                                  assignment,
                                  reason: '',
                                  targetConsultant: undefined
                                })}
                              >
                                🔄 Reassign
                              </button>
                            </>
                          )}
                          <button
                            className="action-btn delete-btn"
                            onClick={() => setActionModal({
                              type: 'delete',
                              assignment,
                              reason: '',
                              rebalanceQueue: true
                            })}
                          >
                            🗑️ Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {filteredAssignments.length === 0 && (
                <div className="no-assignments">
                  <div className="no-assignments-icon">📭</div>
                  <h3>No assignments found</h3>
                  <p>Try adjusting your search or filter criteria</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === 'vip' && (
        <div className="vip-tab">
          <VIPAssignment
            onAssignmentComplete={() => {
              loadData();
            }}
            onError={setError}
            onSuccess={setSuccess}
          />
        </div>
      )}

      {activeTab === 'bulk' && (
        <div className="bulk-tab">
          <BulkAssignmentCorrections />
        </div>
      )}

      {activeTab === 'reassign' && (
        <div className="reassign-tab">
          <ConsultantUnavailability />
        </div>
      )}

      {activeTab === 'audit' && (
        <div className="audit-tab">
          <AuditTrail />
        </div>
      )}

      {/* Action Modal */}
      {actionModal.type && (
        <div className="modal-overlay" onClick={() => setActionModal({ type: null, reason: '', rebalanceQueue: true })}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                {actionModal.type === 'delete' && '🗑️ Delete Assignment'}
                {actionModal.type === 'cancel' && '❌ Cancel Assignment'}
                {actionModal.type === 'reassign' && '🔄 Reassign Meeting'}
              </h3>
            </div>

            <div className="modal-body">
              <p>
                <strong>Lead:</strong> {actionModal.assignment?.display_lead_name}<br/>
                <strong>Consultant:</strong> {actionModal.assignment?.consultant_name}<br/>
                <strong>Status:</strong> {actionModal.assignment?.status}
              </p>

              <div className="form-group">
                <label>Reason (required):</label>
                <textarea
                  value={actionModal.reason}
                  onChange={(e) => setActionModal({...actionModal, reason: e.target.value})}
                  placeholder="Provide a detailed reason for this action..."
                  rows={3}
                  required
                />
              </div>

              {actionModal.type === 'cancel' && (
                <div className="form-group">
                  <label>
                    <input
                      type="checkbox"
                      checked={actionModal.reassignImmediately}
                      onChange={(e) => setActionModal({...actionModal, reassignImmediately: e.target.checked})}
                    />
                    Reassign immediately to next available consultant
                  </label>
                </div>
              )}

              {actionModal.type === 'delete' && (
                <div className="form-group">
                  <label>
                    <input
                      type="checkbox"
                      checked={actionModal.rebalanceQueue}
                      onChange={(e) => setActionModal({...actionModal, rebalanceQueue: e.target.checked})}
                    />
                    Rebalance assignment queue (recommended)
                  </label>
                </div>
              )}
            </div>

            <div className="modal-actions">
              <button
                className="btn-secondary"
                onClick={() => setActionModal({ type: null, reason: '', rebalanceQueue: true })}
              >
                Cancel
              </button>
              <button
                className={`btn-primary ${actionModal.type === 'delete' ? 'btn-danger' : ''}`}
                onClick={() => {
                  if (actionModal.type === 'delete') handleDeleteAssignment();
                  else if (actionModal.type === 'cancel') handleCancelAssignment();
                }}
                disabled={!actionModal.reason.trim()}
              >
                {actionModal.type === 'delete' && 'Delete Assignment'}
                {actionModal.type === 'cancel' && 'Cancel Assignment'}
                {actionModal.type === 'reassign' && 'Reassign Meeting'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .meeting-management {
          background: white;
          border-radius: 16px;
          padding: 2rem;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
        }

        .management-header {
          text-align: center;
          margin-bottom: 2rem;
        }

        .management-header h2 {
          color: #2d3748;
          margin: 0 0 0.5rem 0;
          font-size: 1.8rem;
          font-weight: 700;
        }

        .management-header p {
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

        .tab-navigation {
          display: flex;
          gap: 0.5rem;
          margin-bottom: 2rem;
          border-bottom: 2px solid #e2e8f0;
        }

        .tab-button {
          padding: 0.75rem 1.5rem;
          background: none;
          border: none;
          border-bottom: 3px solid transparent;
          cursor: pointer;
          font-weight: 600;
          color: #4a5568;
          transition: all 0.2s;
        }

        .tab-button:hover {
          color: #2d3748;
          border-bottom-color: #cbd5e0;
        }

        .tab-button.active {
          color: #667eea;
          border-bottom-color: #667eea;
        }

        .filters-section {
          display: flex;
          gap: 1rem;
          margin-bottom: 1.5rem;
          flex-wrap: wrap;
        }

        .search-input,
        .status-filter {
          padding: 0.75rem;
          border: 2px solid #e2e8f0;
          border-radius: 8px;
          font-size: 0.95rem;
        }

        .search-input {
          flex: 1;
          min-width: 300px;
        }

        .assignments-table {
          overflow-x: auto;
        }

        .assignments-table table {
          width: 100%;
          border-collapse: collapse;
          background: white;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
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

        .action-buttons {
          display: flex;
          gap: 0.5rem;
          flex-wrap: wrap;
        }

        .action-btn {
          padding: 0.5rem 0.75rem;
          border: none;
          border-radius: 6px;
          font-size: 0.8rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
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

        .no-assignments {
          text-align: center;
          padding: 3rem;
          color: #4a5568;
        }

        .no-assignments-icon {
          font-size: 3rem;
          margin-bottom: 1rem;
        }

        .bulk-actions-placeholder,
        .reassignment-placeholder {
          text-align: center;
          padding: 3rem;
          background: #f7fafc;
          border-radius: 12px;
          color: #4a5568;
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
          max-width: 500px;
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

        .modal-body textarea {
          width: 100%;
          padding: 0.75rem;
          border: 2px solid #e2e8f0;
          border-radius: 8px;
          resize: vertical;
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
          width: 16px;
          height: 16px;
          border: 2px solid transparent;
          border-top: 2px solid currentColor;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        @media (max-width: 768px) {
          .meeting-management {
            padding: 1rem;
          }

          .tab-navigation {
            flex-wrap: wrap;
          }

          .filters-section {
            flex-direction: column;
          }

          .search-input {
            min-width: unset;
          }

          .assignments-table {
            font-size: 0.9rem;
          }

          .action-buttons {
            flex-direction: column;
          }

          .modal-content {
            margin: 1rem;
            max-width: none;
          }
        }
      `}</style>
    </div>
  );
};

export default MeetingManagement;