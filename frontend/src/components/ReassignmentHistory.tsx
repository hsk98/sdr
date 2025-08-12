import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import '../styles/reassignment-history.css';

interface ReassignmentRecord {
  id: string;
  reassignmentNumber: number;
  timestamp: string;
  reason: string | null;
  reassignmentSource: string;
  processingTimeMs: number;
  previousSkillsMatchScore: number | null;
  newSkillsMatchScore: number | null;
  skillsRequirements: string;
  exclusionList: string;
  originalConsultantName: string;
  originalConsultantEmail: string;
  newConsultantName: string;
  newConsultantEmail: string;
  sdrUsername: string;
  sdrName: string;
  success: boolean;
  errorMessage: string | null;
}

interface AssignmentInfo {
  id: string;
  leadIdentifier: string;
  leadName: string;
  assignmentMethod: string;
  reassignmentCount: number;
  currentConsultantName: string;
  currentConsultantEmail: string;
  currentConsultantPhone: string;
  assignedAt: string;
  status: string;
}

interface ReassignmentHistoryData {
  assignment: AssignmentInfo;
  reassignmentHistory: ReassignmentRecord[];
  totalReassignments: number;
  lastReassignmentAt: string | null;
}

interface ReassignmentHistoryProps {
  assignmentId?: string;
  leadId?: string;
  inline?: boolean;
  showFullHistory?: boolean;
}

const ReassignmentHistory: React.FC<ReassignmentHistoryProps> = ({
  assignmentId,
  leadId,
  inline = false,
  showFullHistory = false
}) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [historyData, setHistoryData] = useState<ReassignmentHistoryData | null>(null);
  const [expanded, setExpanded] = useState(showFullHistory);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (assignmentId) {
      loadReassignmentHistory();
    }
  }, [assignmentId]);

  const loadReassignmentHistory = async () => {
    if (!assignmentId) return;

    setLoading(true);
    setError('');
    
    try {
      const response = await fetch(`/api/reassignments/assignment/${assignmentId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        if (response.status === 404) {
          setError('Assignment not found or no reassignment history available');
        } else {
          throw new Error('Failed to load reassignment history');
        }
        return;
      }

      const data = await response.json();
      setHistoryData(data);
      
    } catch (error) {
      console.error('Failed to load reassignment history:', error);
      setError('Failed to load reassignment history');
    } finally {
      setLoading(false);
    }
  };

  const formatDateTime = (timestamp: string): string => {
    return new Date(timestamp).toLocaleString();
  };

  const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  const getSourceIcon = (source: string): string => {
    switch (source) {
      case 'user_request': return '👤';
      case 'system_automatic': return '🤖';
      case 'admin_override': return '👨‍💼';
      default: return '🔄';
    }
  };

  const getSourceLabel = (source: string): string => {
    switch (source) {
      case 'user_request': return 'User Request';
      case 'system_automatic': return 'System Automatic';
      case 'admin_override': return 'Admin Override';
      default: return 'Unknown';
    }
  };

  const calculateSkillsImprovement = (previous: number | null, current: number | null): number | null => {
    if (previous === null || current === null) return null;
    return current - previous;
  };

  if (!assignmentId) {
    return null;
  }

  if (loading) {
    return (
      <div className={`reassignment-history ${inline ? 'inline' : ''}`}>
        <div className="loading-state">
          <span className="loading-spinner">⏳</span>
          <span>Loading reassignment history...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`reassignment-history ${inline ? 'inline' : ''}`}>
        <div className="error-state">
          <span className="error-icon">❌</span>
          <span>{error}</span>
        </div>
      </div>
    );
  }

  if (!historyData || historyData.totalReassignments === 0) {
    if (inline) return null;
    
    return (
      <div className="reassignment-history">
        <div className="no-history-state">
          <span className="no-history-icon">📋</span>
          <span>No reassignments for this assignment</span>
        </div>
      </div>
    );
  }

  const displayedHistory = expanded ? historyData.reassignmentHistory : historyData.reassignmentHistory.slice(0, 3);

  return (
    <div className={`reassignment-history ${inline ? 'inline' : ''}`}>
      {!inline && (
        <div className="history-header">
          <div className="header-content">
            <h3>🔄 Reassignment History</h3>
            <div className="history-stats">
              <span className="stat-item">
                <span className="stat-value">{historyData.totalReassignments}</span>
                <span className="stat-label">Total Reassignments</span>
              </span>
              {historyData.lastReassignmentAt && (
                <span className="stat-item">
                  <span className="stat-value">Latest:</span>
                  <span className="stat-label">{formatDateTime(historyData.lastReassignmentAt)}</span>
                </span>
              )}
            </div>
          </div>
          
          {historyData.totalReassignments > 3 && (
            <button 
              className="expand-toggle"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? '📄 Show Less' : `📄 Show All (${historyData.totalReassignments})`}
            </button>
          )}
        </div>
      )}

      <div className="history-timeline">
        {displayedHistory.map((record, index) => {
          const skillsImprovement = calculateSkillsImprovement(
            record.previousSkillsMatchScore,
            record.newSkillsMatchScore
          );
          
          return (
            <div key={record.id} className={`history-item ${!record.success ? 'failed' : ''}`}>
              <div className="timeline-marker">
                <div className="marker-circle">
                  <span className="reassignment-number">#{record.reassignmentNumber}</span>
                </div>
                {index < displayedHistory.length - 1 && (
                  <div className="timeline-line" />
                )}
              </div>
              
              <div className="history-content">
                <div className="history-main">
                  <div className="change-summary">
                    <div className="consultant-change">
                      <div className="consultant from">
                        <span className="consultant-name">{record.originalConsultantName}</span>
                        <span className="consultant-email">{record.originalConsultantEmail}</span>
                      </div>
                      <div className="arrow">→</div>
                      <div className="consultant to">
                        <span className="consultant-name">{record.newConsultantName}</span>
                        <span className="consultant-email">{record.newConsultantEmail}</span>
                      </div>
                    </div>
                    
                    {skillsImprovement !== null && (
                      <div className="skills-improvement">
                        <span className="improvement-label">Skills Match:</span>
                        <span className={`improvement-value ${skillsImprovement >= 0 ? 'positive' : 'negative'}`}>
                          {record.previousSkillsMatchScore ? `${(record.previousSkillsMatchScore * 100).toFixed(1)}%` : 'N/A'}
                          →
                          {record.newSkillsMatchScore ? `${(record.newSkillsMatchScore * 100).toFixed(1)}%` : 'N/A'}
                          <span className="improvement-delta">
                            ({skillsImprovement >= 0 ? '+' : ''}{(skillsImprovement * 100).toFixed(1)}%)
                          </span>
                        </span>
                      </div>
                    )}
                  </div>
                  
                  <div className="history-metadata">
                    <div className="meta-row">
                      <span className="meta-item">
                        <span className="meta-icon">🕒</span>
                        <span className="meta-value">{formatDateTime(record.timestamp)}</span>
                      </span>
                      
                      <span className="meta-item">
                        <span className="meta-icon">{getSourceIcon(record.reassignmentSource)}</span>
                        <span className="meta-value">{getSourceLabel(record.reassignmentSource)}</span>
                      </span>
                      
                      <span className="meta-item">
                        <span className="meta-icon">⚡</span>
                        <span className="meta-value">{formatDuration(record.processingTimeMs)}</span>
                      </span>
                      
                      <span className="meta-item">
                        <span className="meta-icon">👤</span>
                        <span className="meta-value">{record.sdrName}</span>
                      </span>
                    </div>
                    
                    {record.reason && (
                      <div className="reason-row">
                        <span className="reason-label">💭 Reason:</span>
                        <span className="reason-text">{record.reason}</span>
                      </div>
                    )}
                    
                    {record.errorMessage && (
                      <div className="error-row">
                        <span className="error-label">❌ Error:</span>
                        <span className="error-text">{record.errorMessage}</span>
                      </div>
                    )}
                    
                    {record.skillsRequirements && record.skillsRequirements !== '[]' && (
                      <div className="skills-row">
                        <span className="skills-label">🎯 Skills:</span>
                        <span className="skills-text">
                          {JSON.parse(record.skillsRequirements).length} requirements specified
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      
      {inline && historyData.totalReassignments > 0 && (
        <div className="inline-summary">
          <span className="summary-text">
            This lead has been reassigned {historyData.totalReassignments} time{historyData.totalReassignments !== 1 ? 's' : ''}
          </span>
          {historyData.lastReassignmentAt && (
            <span className="summary-time">
              (Last: {formatDateTime(historyData.lastReassignmentAt)})
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default ReassignmentHistory;