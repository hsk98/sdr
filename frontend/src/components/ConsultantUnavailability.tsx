import React, { useState, useEffect } from 'react';
import { assignmentAPI, consultantAPI } from '../services/api';
import { Assignment, Consultant } from '../types';

interface UnavailabilitySchedule {
  id: string;
  consultantId: number;
  startDate: string;
  endDate: string;
  reason: string;
  status: 'scheduled' | 'active' | 'completed';
  reassignmentStrategy: 'automatic' | 'manual' | 'queue';
  affectedAssignments: Assignment[];
  createdAt: string;
}

const ConsultantUnavailability: React.FC = () => {
  const [consultants, setConsultants] = useState<Consultant[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [unavailabilitySchedules, setUnavailabilitySchedules] = useState<UnavailabilitySchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [newSchedule, setNewSchedule] = useState({
    consultantId: '',
    startDate: '',
    endDate: '',
    reason: '',
    reassignmentStrategy: 'automatic' as 'automatic' | 'manual' | 'queue'
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [consultantsData, assignmentsData] = await Promise.all([
        consultantAPI.getActive(),
        assignmentAPI.getAll()
      ]);
      setConsultants(consultantsData);
      setAssignments(assignmentsData);
      
      // Load mock unavailability schedules (in real app, this would be from API)
      loadUnavailabilitySchedules();
    } catch (err: any) {
      console.error('Error loading data:', err);
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const loadUnavailabilitySchedules = () => {
    // Mock data - in real implementation, this would come from the API
    const mockSchedules: UnavailabilitySchedule[] = [
      {
        id: 'unavail_1',
        consultantId: 1,
        startDate: '2024-02-01',
        endDate: '2024-02-05',
        reason: 'Vacation',
        status: 'scheduled',
        reassignmentStrategy: 'automatic',
        affectedAssignments: [],
        createdAt: new Date().toISOString()
      }
    ];
    setUnavailabilitySchedules(mockSchedules);
  };

  const getConsultantActiveAssignments = (consultantId: number) => {
    return assignments.filter(a => a.consultant_id === consultantId && a.status === 'active');
  };

  const scheduleUnavailability = async () => {
    if (!newSchedule.consultantId || !newSchedule.startDate || !newSchedule.endDate || !newSchedule.reason.trim()) {
      setError('All fields are required');
      return;
    }

    if (new Date(newSchedule.startDate) >= new Date(newSchedule.endDate)) {
      setError('End date must be after start date');
      return;
    }

    try {
      const consultantId = parseInt(newSchedule.consultantId);
      const affectedAssignments = getConsultantActiveAssignments(consultantId);
      
      const schedule: UnavailabilitySchedule = {
        id: `unavail_${Date.now()}`,
        consultantId,
        startDate: newSchedule.startDate,
        endDate: newSchedule.endDate,
        reason: newSchedule.reason.trim(),
        status: 'scheduled',
        reassignmentStrategy: newSchedule.reassignmentStrategy,
        affectedAssignments,
        createdAt: new Date().toISOString()
      };

      setUnavailabilitySchedules(prev => [...prev, schedule]);
      
      // If unavailability starts today or in the past, activate immediately
      const today = new Date().toISOString().split('T')[0];
      if (newSchedule.startDate <= today) {
        await activateUnavailability(schedule.id);
      }

      setSuccess(`Unavailability scheduled for ${consultants.find(c => c.id === consultantId)?.name}. ${affectedAssignments.length} assignments will be affected.`);
      setShowScheduleForm(false);
      setNewSchedule({
        consultantId: '',
        startDate: '',
        endDate: '',
        reason: '',
        reassignmentStrategy: 'automatic'
      });

    } catch (err: any) {
      console.error('Error scheduling unavailability:', err);
      setError('Failed to schedule unavailability');
    }
  };

  const activateUnavailability = async (scheduleId: string) => {
    const schedule = unavailabilitySchedules.find(s => s.id === scheduleId);
    if (!schedule) return;

    try {
      // Update status to active
      setUnavailabilitySchedules(prev => prev.map(s => 
        s.id === scheduleId ? { ...s, status: 'active' } : s
      ));

      // Handle reassignment based on strategy
      if (schedule.reassignmentStrategy === 'automatic' && schedule.affectedAssignments.length > 0) {
        await performAutomaticReassignment(schedule);
      }

      setSuccess(`Unavailability activated for consultant. Processing ${schedule.affectedAssignments.length} reassignments.`);

    } catch (err: any) {
      console.error('Error activating unavailability:', err);
      setError('Failed to activate unavailability');
    }
  };

  const performAutomaticReassignment = async (schedule: UnavailabilitySchedule) => {
    const consultant = consultants.find(c => c.id === schedule.consultantId);
    
    for (const assignment of schedule.affectedAssignments) {
      try {
        // Cancel the current assignment
        await assignmentAPI.cancelAssignment(
          assignment.id,
          `Consultant unavailable: ${schedule.reason}`,
          true // reassign immediately
        );

        console.log(`Reassigned assignment ${assignment.id} due to consultant unavailability`);
      } catch (err: any) {
        console.error(`Failed to reassign assignment ${assignment.id}:`, err);
      }
    }
  };

  const cancelUnavailability = async (scheduleId: string) => {
    try {
      const schedule = unavailabilitySchedules.find(s => s.id === scheduleId);
      if (!schedule) return;

      setUnavailabilitySchedules(prev => prev.filter(s => s.id !== scheduleId));
      setSuccess('Unavailability schedule cancelled successfully');
    } catch (err: any) {
      setError('Failed to cancel unavailability schedule');
    }
  };

  const markUnavailabilityComplete = async (scheduleId: string) => {
    try {
      setUnavailabilitySchedules(prev => prev.map(s => 
        s.id === scheduleId ? { ...s, status: 'completed' } : s
      ));
      setSuccess('Unavailability marked as completed');
    } catch (err: any) {
      setError('Failed to complete unavailability');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return '#d69e2e';
      case 'active': return '#e53e3e';
      case 'completed': return '#38a169';
      default: return '#718096';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'scheduled': return '📅';
      case 'active': return '❌';
      case 'completed': return '✅';
      default: return '📋';
    }
  };

  const getStrategyIcon = (strategy: string) => {
    switch (strategy) {
      case 'automatic': return '🤖';
      case 'manual': return '👤';
      case 'queue': return '📋';
      default: return '❓';
    }
  };

  const clearMessages = () => {
    setError('');
    setSuccess('');
  };

  return (
    <div className="consultant-unavailability">
      <div className="unavailability-header">
        <h2>🔄 Consultant Unavailability Management</h2>
        <p>Schedule consultant unavailability and manage automatic reassignments</p>
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

      {/* Quick Actions */}
      <div className="quick-actions">
        <button
          onClick={() => setShowScheduleForm(true)}
          className="schedule-btn"
        >
          📅 Schedule Unavailability
        </button>
        <button
          onClick={loadData}
          className="refresh-btn"
        >
          🔄 Refresh Data
        </button>
      </div>

      {/* Current Consultant Status */}
      <div className="consultant-status-grid">
        <h3>👥 Consultant Status Overview</h3>
        <div className="status-cards">
          {consultants.map(consultant => {
            const activeAssignments = getConsultantActiveAssignments(consultant.id);
            const currentUnavailability = unavailabilitySchedules.find(
              s => s.consultantId === consultant.id && s.status === 'active'
            );
            const upcomingUnavailability = unavailabilitySchedules.find(
              s => s.consultantId === consultant.id && s.status === 'scheduled'
            );

            return (
              <div key={consultant.id} className="consultant-card">
                <div className="consultant-info">
                  <div className="consultant-avatar">
                    {consultant.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                  </div>
                  <div className="consultant-details">
                    <h4>{consultant.name}</h4>
                    <p>{consultant.email}</p>
                  </div>
                </div>
                
                <div className="availability-status">
                  {currentUnavailability ? (
                    <div className="status-badge unavailable">
                      ❌ Unavailable until {formatDate(currentUnavailability.endDate)}
                    </div>
                  ) : upcomingUnavailability ? (
                    <div className="status-badge scheduled">
                      📅 Scheduled unavailable from {formatDate(upcomingUnavailability.startDate)}
                    </div>
                  ) : (
                    <div className="status-badge available">
                      ✅ Available
                    </div>
                  )}
                </div>

                <div className="assignment-count">
                  <strong>{activeAssignments.length}</strong> active assignments
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Unavailability Schedules */}
      <div className="schedules-section">
        <h3>📋 Unavailability Schedules</h3>
        
        {loading ? (
          <div className="loading-state">
            <span className="spinner"></span>
            Loading schedules...
          </div>
        ) : unavailabilitySchedules.length === 0 ? (
          <div className="no-schedules">
            <div className="no-schedules-icon">📅</div>
            <h4>No unavailability schedules</h4>
            <p>Schedule consultant unavailability to manage automatic reassignments</p>
          </div>
        ) : (
          <div className="schedules-list">
            {unavailabilitySchedules.map(schedule => {
              const consultant = consultants.find(c => c.id === schedule.consultantId);
              return (
                <div key={schedule.id} className="schedule-item">
                  <div className="schedule-header">
                    <div className="schedule-info">
                      <h4>{consultant?.name || 'Unknown Consultant'}</h4>
                      <p>{formatDate(schedule.startDate)} - {formatDate(schedule.endDate)}</p>
                    </div>
                    <div className="schedule-status">
                      <span 
                        className="status-badge"
                        style={{ backgroundColor: getStatusColor(schedule.status) }}
                      >
                        {getStatusIcon(schedule.status)} {schedule.status}
                      </span>
                    </div>
                  </div>

                  <div className="schedule-details">
                    <div className="detail-row">
                      <strong>Reason:</strong> {schedule.reason}
                    </div>
                    <div className="detail-row">
                      <strong>Reassignment Strategy:</strong> 
                      <span className="strategy-badge">
                        {getStrategyIcon(schedule.reassignmentStrategy)} {schedule.reassignmentStrategy}
                      </span>
                    </div>
                    <div className="detail-row">
                      <strong>Affected Assignments:</strong> {schedule.affectedAssignments.length}
                    </div>
                  </div>

                  <div className="schedule-actions">
                    {schedule.status === 'scheduled' && (
                      <>
                        <button
                          onClick={() => activateUnavailability(schedule.id)}
                          className="activate-btn"
                        >
                          ▶️ Activate Now
                        </button>
                        <button
                          onClick={() => cancelUnavailability(schedule.id)}
                          className="cancel-btn"
                        >
                          ❌ Cancel
                        </button>
                      </>
                    )}
                    {schedule.status === 'active' && (
                      <button
                        onClick={() => markUnavailabilityComplete(schedule.id)}
                        className="complete-btn"
                      >
                        ✅ Mark Complete
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Schedule Form Modal */}
      {showScheduleForm && (
        <div className="modal-overlay" onClick={() => setShowScheduleForm(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>📅 Schedule Consultant Unavailability</h3>
            </div>

            <div className="modal-body">
              <div className="form-group">
                <label>Consultant:</label>
                <select
                  value={newSchedule.consultantId}
                  onChange={(e) => setNewSchedule(prev => ({ ...prev, consultantId: e.target.value }))}
                  required
                >
                  <option value="">Select consultant...</option>
                  {consultants.map(consultant => (
                    <option key={consultant.id} value={consultant.id}>
                      {consultant.name} - {getConsultantActiveAssignments(consultant.id).length} active assignments
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Start Date:</label>
                  <input
                    type="date"
                    value={newSchedule.startDate}
                    onChange={(e) => setNewSchedule(prev => ({ ...prev, startDate: e.target.value }))}
                    min={new Date().toISOString().split('T')[0]}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>End Date:</label>
                  <input
                    type="date"
                    value={newSchedule.endDate}
                    onChange={(e) => setNewSchedule(prev => ({ ...prev, endDate: e.target.value }))}
                    min={newSchedule.startDate || new Date().toISOString().split('T')[0]}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Reassignment Strategy:</label>
                <select
                  value={newSchedule.reassignmentStrategy}
                  onChange={(e) => setNewSchedule(prev => ({ 
                    ...prev, 
                    reassignmentStrategy: e.target.value as 'automatic' | 'manual' | 'queue'
                  }))}
                >
                  <option value="automatic">🤖 Automatic - Immediately reassign to next available consultant</option>
                  <option value="manual">👤 Manual - Mark for manual reassignment</option>
                  <option value="queue">📋 Queue - Return assignments to general queue</option>
                </select>
              </div>

              <div className="form-group">
                <label>Reason:</label>
                <textarea
                  value={newSchedule.reason}
                  onChange={(e) => setNewSchedule(prev => ({ ...prev, reason: e.target.value }))}
                  placeholder="e.g., Vacation, Medical leave, Training, etc."
                  rows={3}
                  required
                />
              </div>

              {newSchedule.consultantId && (
                <div className="affected-assignments-preview">
                  <h4>Affected Assignments:</h4>
                  <p>{getConsultantActiveAssignments(parseInt(newSchedule.consultantId)).length} active assignments will be affected</p>
                </div>
              )}
            </div>

            <div className="modal-actions">
              <button
                className="btn-secondary"
                onClick={() => setShowScheduleForm(false)}
              >
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={scheduleUnavailability}
                disabled={!newSchedule.consultantId || !newSchedule.startDate || !newSchedule.endDate || !newSchedule.reason.trim()}
              >
                Schedule Unavailability
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .consultant-unavailability {
          background: white;
          border-radius: 16px;
          padding: 2rem;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
        }

        .unavailability-header {
          text-align: center;
          margin-bottom: 2rem;
        }

        .unavailability-header h2 {
          color: #2d3748;
          margin: 0 0 0.5rem 0;
          font-size: 1.8rem;
          font-weight: 700;
        }

        .unavailability-header p {
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

        .quick-actions {
          display: flex;
          gap: 1rem;
          margin-bottom: 2rem;
          justify-content: center;
        }

        .schedule-btn,
        .refresh-btn {
          padding: 0.75rem 1.5rem;
          border: none;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .schedule-btn {
          background: #667eea;
          color: white;
        }

        .schedule-btn:hover {
          background: #5a67d8;
        }

        .refresh-btn {
          background: #e2e8f0;
          color: #4a5568;
        }

        .refresh-btn:hover {
          background: #cbd5e0;
        }

        .consultant-status-grid {
          margin-bottom: 2rem;
        }

        .consultant-status-grid h3 {
          color: #2d3748;
          margin-bottom: 1rem;
        }

        .status-cards {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 1rem;
        }

        .consultant-card {
          background: #f7fafc;
          border-radius: 12px;
          padding: 1.5rem;
          border: 2px solid #e2e8f0;
          transition: all 0.2s;
        }

        .consultant-card:hover {
          border-color: #cbd5e0;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }

        .consultant-info {
          display: flex;
          align-items: center;
          gap: 1rem;
          margin-bottom: 1rem;
        }

        .consultant-avatar {
          width: 50px;
          height: 50px;
          border-radius: 50%;
          background: linear-gradient(135deg, #667eea, #764ba2);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: bold;
          font-size: 1rem;
          flex-shrink: 0;
        }

        .consultant-details h4 {
          margin: 0 0 0.25rem 0;
          color: #2d3748;
        }

        .consultant-details p {
          margin: 0;
          color: #718096;
          font-size: 0.9rem;
        }

        .availability-status {
          margin-bottom: 1rem;
        }

        .status-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 1rem;
          border-radius: 12px;
          font-size: 0.85rem;
          font-weight: 600;
        }

        .status-badge.available {
          background: #c6f6d5;
          color: #276749;
        }

        .status-badge.unavailable {
          background: #fed7d7;
          color: #742a2a;
        }

        .status-badge.scheduled {
          background: #faf089;
          color: #744210;
        }

        .assignment-count {
          color: #4a5568;
          font-size: 0.9rem;
        }

        .schedules-section {
          margin-bottom: 2rem;
        }

        .schedules-section h3 {
          color: #2d3748;
          margin-bottom: 1rem;
        }

        .loading-state {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          padding: 3rem;
          color: #4a5568;
        }

        .no-schedules {
          text-align: center;
          padding: 3rem;
          color: #4a5568;
        }

        .no-schedules-icon {
          font-size: 3rem;
          margin-bottom: 1rem;
        }

        .schedules-list {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .schedule-item {
          background: #f7fafc;
          border-radius: 12px;
          padding: 1.5rem;
          border-left: 4px solid #cbd5e0;
        }

        .schedule-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 1rem;
        }

        .schedule-info h4 {
          margin: 0 0 0.25rem 0;
          color: #2d3748;
        }

        .schedule-info p {
          margin: 0;
          color: #718096;
          font-size: 0.9rem;
        }

        .schedule-details {
          margin-bottom: 1rem;
        }

        .detail-row {
          margin-bottom: 0.5rem;
          color: #4a5568;
          font-size: 0.9rem;
        }

        .strategy-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.25rem;
          background: #e2e8f0;
          padding: 0.25rem 0.5rem;
          border-radius: 4px;
          font-size: 0.8rem;
          margin-left: 0.5rem;
        }

        .schedule-actions {
          display: flex;
          gap: 0.5rem;
          flex-wrap: wrap;
        }

        .activate-btn,
        .cancel-btn,
        .complete-btn {
          padding: 0.5rem 1rem;
          border: none;
          border-radius: 6px;
          font-size: 0.85rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .activate-btn {
          background: #bee3f8;
          color: #2c5282;
        }

        .activate-btn:hover {
          background: #90cdf4;
        }

        .cancel-btn {
          background: #fed7d7;
          color: #742a2a;
        }

        .cancel-btn:hover {
          background: #feb2b2;
        }

        .complete-btn {
          background: #c6f6d5;
          color: #276749;
        }

        .complete-btn:hover {
          background: #9ae6b4;
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

        .form-group {
          margin-bottom: 1rem;
        }

        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
        }

        .form-group label {
          display: block;
          margin-bottom: 0.5rem;
          font-weight: 600;
          color: #2d3748;
        }

        .form-group input,
        .form-group select,
        .form-group textarea {
          width: 100%;
          padding: 0.75rem;
          border: 2px solid #e2e8f0;
          border-radius: 8px;
          font-size: 0.95rem;
        }

        .affected-assignments-preview {
          background: #edf2f7;
          border-radius: 8px;
          padding: 1rem;
          margin-top: 1rem;
        }

        .affected-assignments-preview h4 {
          margin: 0 0 0.5rem 0;
          color: #2d3748;
          font-size: 0.95rem;
        }

        .affected-assignments-preview p {
          margin: 0;
          color: #4a5568;
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
          .consultant-unavailability {
            padding: 1rem;
          }

          .status-cards {
            grid-template-columns: 1fr;
          }

          .schedule-header {
            flex-direction: column;
            gap: 1rem;
          }

          .schedule-actions {
            justify-content: center;
          }

          .form-row {
            grid-template-columns: 1fr;
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

export default ConsultantUnavailability;