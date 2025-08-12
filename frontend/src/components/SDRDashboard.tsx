import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { assignmentAPI } from '../services/api';
import { Assignment } from '../types';
import BlindAssignment from './BlindAssignment';
import './SDRDashboard.css';

interface AssignmentWithMetadata extends Assignment {
  consultant?: {
    id: number;
    name: string;
    email: string;
    phone?: string;
  };
  metadata?: {
    assignment_method: string;
    fairness_score: number;
    assignment_count: number;
    last_assigned_at: string;
  };
}

const SDRDashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const [assignment, setAssignment] = useState<AssignmentWithMetadata | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [completingAssignment, setCompletingAssignment] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    loadLatestAssignment();
    loadMyAssignments();
  }, []);

  const loadLatestAssignment = async () => {
    try {
      const latestAssignment = await assignmentAPI.getMyLatest();
      setAssignment(latestAssignment);
    } catch (err: any) {
      if (err.response?.status !== 404) {
        console.error('Error loading latest assignment:', err);
      }
    }
  };

  const loadMyAssignments = async () => {
    try {
      const myAssignments = await assignmentAPI.getMy();
      setAssignments(myAssignments);
    } catch (err: any) {
      console.error('Error loading assignments:', err);
    }
  };


  const markAsCompleted = async () => {
    if (!assignment) return;
    
    setCompletingAssignment(true);
    setError('');
    
    try {
      await assignmentAPI.updateStatus(assignment.id, 'completed');
      setAssignment(null);
      setSuccess('Assignment marked as completed!');
      await loadMyAssignments();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update assignment');
    } finally {
      setCompletingAssignment(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString();
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return '🔄';
      case 'completed': return '✅';
      case 'cancelled': return '❌';
      default: return '📋';
    }
  };

  const clearMessages = () => {
    setError('');
    setSuccess('');
  };

  useEffect(() => {
    if (error || success) {
      const timer = setTimeout(clearMessages, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, success]);

  return (
    <div className="sdr-dashboard">
      {/* Header */}
      <header className="sdr-header">
        <div className="header-content">
          <div className="user-welcome">
            <h1>Welcome back</h1>
            <p>{user?.firstName} {user?.lastName}</p>
          </div>
          <button onClick={logout} className="logout-button">
            <span>👋</span>
            Logout
          </button>
        </div>
      </header>

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

      {/* Main Content */}
      <main className="sdr-main">
        {/* Current Assignment Section */}
        <section className="assignment-section">
          <div className="section-header">
            <h2>Current Assignment</h2>
            <div className="assignment-badge">
              {assignment ? '1 Active' : '0 Active'}
            </div>
          </div>

          {assignment ? (
            <div className="current-assignment-card">
              <div className="assignment-content">
                <div className="assignment-info">
                  <h3 className="lead-title">
                    {assignment.lead_name || assignment.display_lead_name || 'Lead Assignment'}
                  </h3>
                  <p className="assignment-meta">
                    Assigned {formatDate(assignment.assigned_at)} • ID: {assignment.lead_identifier || assignment.display_lead_id || 'N/A'}
                  </p>
                </div>

                <div className="consultant-info">
                  <div className="consultant-header">
                    <div className="consultant-avatar">
                      {(assignment.consultant_name || assignment.consultant?.name || '').split(' ').map(n => n[0]).join('').toUpperCase()}
                    </div>
                    <div className="consultant-details">
                      <h4 className="consultant-name">
                        {assignment.consultant_name || assignment.consultant?.name}
                      </h4>
                      <p className="consultant-contact">
                        {assignment.consultant_email || assignment.consultant?.email}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="assignment-actions">
                  <div className="primary-actions">
                    <button 
                      className="action-btn call"
                      onClick={() => {
                        const phone = assignment.consultant_phone || assignment.consultant?.phone;
                        if (phone) {
                          window.location.href = `tel:${phone}`;
                        } else {
                          setError('Phone number not available');
                        }
                      }}
                      disabled={!assignment.consultant_phone && !assignment.consultant?.phone}
                    >
                      📞 Call
                    </button>
                    <button 
                      className="action-btn email"
                      onClick={() => {
                        const email = assignment.consultant_email || assignment.consultant?.email;
                        const subject = `Meeting Assignment - ${assignment.lead_name || 'Lead'}`;
                        if (email) window.location.href = `mailto:${email}?subject=${encodeURIComponent(subject)}`;
                      }}
                    >
                      📧 Email
                    </button>
                  </div>

                  <div className="secondary-actions">
                    <button 
                      onClick={markAsCompleted} 
                      disabled={completingAssignment}
                      className="complete-btn"
                    >
                      {completingAssignment ? (
                        <>
                          <span className="spinner"></span>
                          Completing...
                        </>
                      ) : (
                        <>
                          ✅ Complete Assignment
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <BlindAssignment
              onAssignmentComplete={(newAssignment) => {
                setAssignment(newAssignment.assignment || newAssignment);
                loadMyAssignments();
              }}
              onError={(errorMsg) => setError(errorMsg)}
              onSuccess={(successMsg) => setSuccess(successMsg)}
            />
          )}
        </section>

        {/* Assignment History Section */}
        <section className="history-section">
          <div className="section-header">
            <h2>Recent History</h2>
            <div className="history-badge">
              {assignments.length} Total
            </div>
          </div>

          {assignments.length > 0 ? (
            <div className="history-list">
              {assignments.slice(0, 10).map((assign) => (
                <div key={assign.id} className="history-item">
                  <div className="history-consultant">
                    <div className="history-avatar">
                      {assign.consultant_name?.split(' ').map(n => n[0]).join('').toUpperCase() || ''}
                    </div>
                    <div className="history-details">
                      <h4>{assign.consultant_name}</h4>
                      <p>{assign.consultant_email}</p>
                    </div>
                  </div>
                  
                  <div className="history-meta">
                    <div className="history-time">
                      {formatDate(assign.assigned_at)}
                    </div>
                    <div className={`history-status ${assign.status}`}>
                      {getStatusIcon(assign.status)}
                    </div>
                  </div>
                </div>
              ))}
              
              {assignments.length > 10 && (
                <div className="load-more">
                  <button className="load-more-button">
                    View All {assignments.length} Assignments
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="no-history">
              <div className="no-history-icon">📊</div>
              <h3>No Assignments Yet</h3>
              <p>Your assignment history will appear here once you start getting assignments.</p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

export default SDRDashboard;