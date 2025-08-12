import React, { useState, useEffect } from 'react';
import { assignmentAPI, consultantAPI } from '../services/api';
import { Consultant } from '../types';

interface VIPAssignmentProps {
  onAssignmentComplete: (assignment: any) => void;
  onError: (error: string) => void;
  onSuccess: (message: string) => void;
}

const VIPAssignment: React.FC<VIPAssignmentProps> = ({
  onAssignmentComplete,
  onError,
  onSuccess
}) => {
  const [vipData, setVipData] = useState({
    leadId: '',
    leadName: '',
    consultantId: '',
    priority: 'high',
    reason: '',
    overrideType: 'vip_client'
  });
  const [consultants, setConsultants] = useState<Consultant[]>([]);
  const [isAssigning, setIsAssigning] = useState(false);
  const [loadingConsultants, setLoadingConsultants] = useState(true);

  useEffect(() => {
    loadConsultants();
  }, []);

  const loadConsultants = async () => {
    try {
      setLoadingConsultants(true);
      const activeConsultants = await consultantAPI.getActive();
      setConsultants(activeConsultants);
    } catch (err: any) {
      console.error('Error loading consultants:', err);
      onError('Failed to load consultants');
    } finally {
      setLoadingConsultants(false);
    }
  };

  const handleVIPAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!vipData.leadId.trim() || !vipData.leadName.trim() || !vipData.consultantId || !vipData.reason.trim()) {
      onError('All fields are required for VIP assignment');
      return;
    }

    setIsAssigning(true);

    try {
      const result = await assignmentAPI.createManagerOverride({
        leadId: vipData.leadId.trim(),
        leadName: vipData.leadName.trim(),
        consultantId: parseInt(vipData.consultantId),
        reason: vipData.reason.trim(),
        overrideType: vipData.overrideType
      });

      onAssignmentComplete(result);
      onSuccess(`VIP assignment created successfully for ${vipData.leadName}`);
      
      // Clear form
      setVipData({
        leadId: '',
        leadName: '',
        consultantId: '',
        priority: 'high',
        reason: '',
        overrideType: 'vip_client'
      });
      
    } catch (err: any) {
      console.error('VIP assignment error:', err);
      const errorMessage = err.response?.data?.error || err.message || 'Failed to create VIP assignment';
      onError(`VIP assignment failed: ${errorMessage}`);
    } finally {
      setIsAssigning(false);
    }
  };

  const resetForm = () => {
    setVipData({
      leadId: '',
      leadName: '',
      consultantId: '',
      priority: 'high',
      reason: '',
      overrideType: 'vip_client'
    });
  };

  const getSelectedConsultant = () => {
    return consultants.find(c => c.id.toString() === vipData.consultantId);
  };

  const priorityOptions = [
    { value: 'critical', label: '🔴 Critical', color: '#e53e3e' },
    { value: 'high', label: '🟠 High', color: '#dd6b20' },
    { value: 'medium', label: '🟡 Medium', color: '#d69e2e' },
    { value: 'normal', label: '🟢 Normal', color: '#38a169' }
  ];

  const overrideTypeOptions = [
    { value: 'vip_client', label: '👑 VIP Client' },
    { value: 'urgent_request', label: '⚡ Urgent Request' },
    { value: 'special_circumstance', label: '⭐ Special Circumstance' },
    { value: 'executive_request', label: '👤 Executive Request' },
    { value: 'strategic_account', label: '🎯 Strategic Account' }
  ];

  return (
    <div className="vip-assignment-container">
      <div className="vip-assignment-header">
        <h2>👑 VIP Manual Assignment</h2>
        <p className="vip-description">
          Create priority assignments for VIP clients, urgent requests, and special circumstances.
          This bypasses the normal queue and assigns directly to your chosen consultant.
        </p>
      </div>

      <form onSubmit={handleVIPAssignment} className="vip-assignment-form">
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="vipLeadId">Lead/Client ID:</label>
            <input
              id="vipLeadId"
              type="text"
              value={vipData.leadId}
              onChange={(e) => setVipData({...vipData, leadId: e.target.value})}
              placeholder="e.g., VIP001, 00Q5e00001abcde"
              disabled={isAssigning}
              required
            />
            <small>Enter the unique identifier for this lead/client</small>
          </div>

          <div className="form-group">
            <label htmlFor="vipLeadName">Company/Client Name:</label>
            <input
              id="vipLeadName"
              type="text"
              value={vipData.leadName}
              onChange={(e) => setVipData({...vipData, leadName: e.target.value})}
              placeholder="e.g., Fortune 500 Corp, Enterprise Client Inc"
              disabled={isAssigning}
              required
            />
            <small>Full company or client name</small>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="vipOverrideType">Assignment Type:</label>
            <select
              id="vipOverrideType"
              value={vipData.overrideType}
              onChange={(e) => setVipData({...vipData, overrideType: e.target.value})}
              disabled={isAssigning}
              required
            >
              {overrideTypeOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <small>Select the type of special assignment</small>
          </div>

          <div className="form-group">
            <label htmlFor="vipPriority">Priority Level:</label>
            <select
              id="vipPriority"
              value={vipData.priority}
              onChange={(e) => setVipData({...vipData, priority: e.target.value})}
              disabled={isAssigning}
              className={`priority-select priority-${vipData.priority}`}
            >
              {priorityOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <small>Indicates urgency level for reporting</small>
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="vipConsultant">Select Consultant:</label>
          {loadingConsultants ? (
            <div className="loading-consultants">
              <span className="spinner"></span>
              Loading consultants...
            </div>
          ) : (
            <select
              id="vipConsultant"
              value={vipData.consultantId}
              onChange={(e) => setVipData({...vipData, consultantId: e.target.value})}
              disabled={isAssigning}
              required
            >
              <option value="">Choose a consultant...</option>
              {consultants.map(consultant => (
                <option key={consultant.id} value={consultant.id}>
                  {consultant.name} - {consultant.email}
                </option>
              ))}
            </select>
          )}
          <small>Select the specific consultant for this VIP assignment</small>
        </div>

        {getSelectedConsultant() && (
          <div className="consultant-preview">
            <h4>Selected Consultant:</h4>
            <div className="consultant-card-mini">
              <div className="consultant-avatar-mini">
                {getSelectedConsultant()!.name.split(' ').map(n => n[0]).join('').toUpperCase()}
              </div>
              <div className="consultant-details-mini">
                <strong>{getSelectedConsultant()!.name}</strong>
                <div className="contact-info-mini">
                  <span>📧 {getSelectedConsultant()!.email}</span>
                  {getSelectedConsultant()!.phone && <span>📞 {getSelectedConsultant()!.phone}</span>}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="form-group">
          <label htmlFor="vipReason">Justification/Reason:</label>
          <textarea
            id="vipReason"
            value={vipData.reason}
            onChange={(e) => setVipData({...vipData, reason: e.target.value})}
            placeholder="e.g., Fortune 500 client requesting specific consultant, urgent deal closure needed, executive mandate..."
            disabled={isAssigning}
            rows={3}
            required
          />
          <small>Provide detailed justification for this manual override (required for audit trail)</small>
        </div>

        <div className="vip-assignment-actions">
          <button 
            type="submit" 
            disabled={isAssigning || loadingConsultants}
            className="create-vip-assignment-btn"
          >
            {isAssigning ? (
              <>
                <span className="spinner"></span>
                Creating VIP Assignment...
              </>
            ) : (
              <>
                <span>👑</span>
                Create VIP Assignment
              </>
            )}
          </button>

          <button 
            type="button" 
            onClick={resetForm}
            disabled={isAssigning}
            className="clear-btn"
          >
            Clear Form
          </button>
        </div>

        <div className="vip-assignment-warning">
          <div className="warning-item">
            <span className="warning-icon">⚠️</span>
            <span>VIP assignments bypass the normal round-robin queue</span>
          </div>
          <div className="warning-item">
            <span className="warning-icon">📋</span>
            <span>All overrides are logged for compliance and audit purposes</span>
          </div>
          <div className="warning-item">
            <span className="warning-icon">👥</span>
            <span>Use responsibly to maintain fair distribution among consultants</span>
          </div>
        </div>
      </form>

      <style>{`
        .vip-assignment-container {
          background: linear-gradient(135deg, #fff5f5, #fed7d7);
          border: 2px solid #feb2b2;
          border-radius: 16px;
          padding: 2rem;
          margin-bottom: 2rem;
        }

        .vip-assignment-header {
          text-align: center;
          margin-bottom: 2rem;
        }

        .vip-assignment-header h2 {
          color: #742a2a;
          margin: 0 0 0.5rem 0;
          font-size: 1.6rem;
          font-weight: 700;
        }

        .vip-description {
          color: #822727;
          margin: 0;
          font-size: 0.95rem;
          line-height: 1.5;
        }

        .vip-assignment-form {
          max-width: 800px;
          margin: 0 auto;
        }

        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1.5rem;
          margin-bottom: 1.5rem;
        }

        .form-group {
          margin-bottom: 1.5rem;
        }

        .form-group label {
          display: block;
          margin-bottom: 0.5rem;
          font-weight: 600;
          color: #742a2a;
          font-size: 0.9rem;
        }

        .form-group input,
        .form-group select,
        .form-group textarea {
          width: 100%;
          padding: 0.75rem;
          border: 2px solid #fed7d7;
          border-radius: 8px;
          font-size: 0.95rem;
          transition: border-color 0.2s;
        }

        .form-group input:focus,
        .form-group select:focus,
        .form-group textarea:focus {
          outline: none;
          border-color: #e53e3e;
        }

        .form-group input:disabled,
        .form-group select:disabled,
        .form-group textarea:disabled {
          background: #fef5e7;
          cursor: not-allowed;
        }

        .form-group small {
          display: block;
          margin-top: 0.25rem;
          color: #975a5a;
          font-size: 0.8rem;
        }

        .priority-select {
          font-weight: 600;
        }

        .priority-select.priority-critical {
          color: #e53e3e;
        }

        .priority-select.priority-high {
          color: #dd6b20;
        }

        .priority-select.priority-medium {
          color: #d69e2e;
        }

        .priority-select.priority-normal {
          color: #38a169;
        }

        .loading-consultants {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem;
          background: #fed7d7;
          border-radius: 8px;
          color: #742a2a;
        }

        .consultant-preview {
          background: rgba(255, 255, 255, 0.7);
          border-radius: 12px;
          padding: 1rem;
          margin-bottom: 1.5rem;
        }

        .consultant-preview h4 {
          margin: 0 0 0.75rem 0;
          color: #742a2a;
          font-size: 0.9rem;
        }

        .consultant-card-mini {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .consultant-avatar-mini {
          width: 50px;
          height: 50px;
          border-radius: 50%;
          background: linear-gradient(135deg, #e53e3e, #c53030);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: bold;
          font-size: 1rem;
          flex-shrink: 0;
        }

        .consultant-details-mini {
          flex: 1;
        }

        .consultant-details-mini strong {
          display: block;
          color: #742a2a;
          margin-bottom: 0.25rem;
        }

        .contact-info-mini {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
          font-size: 0.85rem;
          color: #975a5a;
        }

        .vip-assignment-actions {
          display: flex;
          gap: 1rem;
          margin-bottom: 2rem;
        }

        .create-vip-assignment-btn {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          background: linear-gradient(135deg, #e53e3e, #c53030);
          color: white;
          border: none;
          padding: 1rem 2rem;
          border-radius: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
          font-size: 1rem;
        }

        .create-vip-assignment-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(229, 62, 62, 0.3);
        }

        .create-vip-assignment-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
        }

        .clear-btn {
          background: white;
          color: #742a2a;
          border: 2px solid #fed7d7;
          padding: 1rem 1.5rem;
          border-radius: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .clear-btn:hover:not(:disabled) {
          border-color: #fbb6ce;
          background: #fef5e7;
        }

        .vip-assignment-warning {
          background: linear-gradient(135deg, #fefcbf, #faf089);
          border-radius: 12px;
          padding: 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .warning-item {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          font-size: 0.9rem;
          color: #744210;
        }

        .warning-icon {
          font-size: 1.1rem;
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
          .vip-assignment-container {
            padding: 1.5rem;
          }

          .form-row {
            grid-template-columns: 1fr;
            gap: 1rem;
          }

          .vip-assignment-actions {
            flex-direction: column;
          }

          .consultant-card-mini {
            flex-direction: column;
            text-align: center;
          }
        }
      `}</style>
    </div>
  );
};

export default VIPAssignment;