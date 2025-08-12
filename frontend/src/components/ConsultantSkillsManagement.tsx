import React, { useState, useEffect, useCallback } from 'react';
import {
  ConsultantSkillManagement,
  SkillManagement,
  SkillAssignmentHistory,
  PREDEFINED_SKILLS,
  SKILL_CATEGORIES,
  SkillCategory
} from '../types/skills';
import '../styles/consultant-skills.css';

interface Consultant {
  id: number;
  name: string;
  email: string;
  isActive: boolean;
}

interface ConsultantSkillsManagementProps {
  consultantId?: number;
  onClose?: () => void;
}

const ConsultantSkillsManagement: React.FC<ConsultantSkillsManagementProps> = ({
  consultantId,
  onClose
}) => {
  const [consultant, setConsultant] = useState<Consultant | null>(null);
  const [consultantSkills, setConsultantSkills] = useState<ConsultantSkillManagement[]>([]);
  const [availableSkills, setAvailableSkills] = useState<SkillManagement[]>([]);
  const [skillHistory, setSkillHistory] = useState<SkillAssignmentHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedSkillId, setSelectedSkillId] = useState<string>('');
  const [verificationNotes, setVerificationNotes] = useState('');
  const [activeTab, setActiveTab] = useState<'current' | 'available' | 'history'>('current');
  const [filterCategory, setFilterCategory] = useState<SkillCategory | 'all'>('all');

  // Load consultant data
  useEffect(() => {
    if (consultantId) {
      loadConsultantData();
      loadConsultantSkills();
      loadAvailableSkills();
      loadSkillHistory();
    }
  }, [consultantId]);

  const loadConsultantData = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/consultants/${consultantId}`);
      if (response.ok) {
        const data = await response.json();
        setConsultant(data);
      }
    } catch (error) {
      console.error('[ConsultantSkillsManagement] Failed to load consultant:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadConsultantSkills = async () => {
    try {
      const response = await fetch(`/api/admin/consultants/${consultantId}/skills`);
      if (response.ok) {
        const skills = await response.json();
        setConsultantSkills(skills);
      }
    } catch (error) {
      console.error('[ConsultantSkillsManagement] Failed to load consultant skills:', error);
    }
  };

  const loadAvailableSkills = async () => {
    try {
      const response = await fetch('/api/admin/skills');
      if (response.ok) {
        const skills = await response.json();
        setAvailableSkills(skills);
      }
    } catch (error) {
      console.error('[ConsultantSkillsManagement] Failed to load available skills:', error);
    }
  };

  const loadSkillHistory = async () => {
    try {
      const response = await fetch(`/api/admin/consultants/${consultantId}/skills/history`);
      if (response.ok) {
        const history = await response.json();
        setSkillHistory(history);
      }
    } catch (error) {
      console.error('[ConsultantSkillsManagement] Failed to load skill history:', error);
    }
  };

  const addSkillToConsultant = async () => {
    if (!selectedSkillId || !consultantId) return;

    try {
      const response = await fetch(`/api/admin/consultants/${consultantId}/skills`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          skillId: selectedSkillId,
          verificationStatus: 'pending',
          notes: verificationNotes
        })
      });

      if (response.ok) {
        await loadConsultantSkills();
        await loadSkillHistory();
        setSelectedSkillId('');
        setVerificationNotes('');
      }
    } catch (error) {
      console.error('[ConsultantSkillsManagement] Failed to add skill:', error);
    }
  };

  const updateSkillVerification = async (
    skillId: string, 
    verificationStatus: ConsultantSkillManagement['verificationStatus'],
    notes?: string,
    expirationDate?: string
  ) => {
    try {
      const response = await fetch(`/api/admin/consultants/${consultantId}/skills/${skillId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          verificationStatus,
          notes,
          expirationDate,
          verifiedDate: verificationStatus === 'verified' ? new Date().toISOString() : undefined
        })
      });

      if (response.ok) {
        await loadConsultantSkills();
        await loadSkillHistory();
      }
    } catch (error) {
      console.error('[ConsultantSkillsManagement] Failed to update skill verification:', error);
    }
  };

  const removeSkillFromConsultant = async (skillId: string) => {
    if (!window.confirm('Are you sure you want to remove this skill from the consultant?')) return;

    try {
      const response = await fetch(`/api/admin/consultants/${consultantId}/skills/${skillId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        await loadConsultantSkills();
        await loadSkillHistory();
      }
    } catch (error) {
      console.error('[ConsultantSkillsManagement] Failed to remove skill:', error);
    }
  };

  const getVerificationStatusBadge = (status: ConsultantSkillManagement['verificationStatus']) => {
    const badges = {
      'pending': { color: '#f59e0b', bg: '#fef3c7', text: 'Pending' },
      'verified': { color: '#10b981', bg: '#d1fae5', text: 'Verified' },
      'rejected': { color: '#ef4444', bg: '#fee2e2', text: 'Rejected' },
      'expired': { color: '#6b7280', bg: '#f3f4f6', text: 'Expired' }
    };
    const badge = badges[status];
    
    return (
      <span 
        className="verification-badge"
        style={{
          backgroundColor: badge.bg,
          color: badge.color,
          padding: '4px 8px',
          borderRadius: '4px',
          fontSize: '12px',
          fontWeight: '600'
        }}
      >
        {badge.text}
      </span>
    );
  };

  const filteredAvailableSkills = availableSkills.filter(skill => {
    const isNotAssigned = !consultantSkills.some(cs => cs.skillId === skill.id);
    const matchesCategory = filterCategory === 'all' || skill.category === filterCategory;
    return isNotAssigned && matchesCategory && skill.isActive;
  });

  const filteredConsultantSkills = consultantSkills.filter(skill => 
    filterCategory === 'all' || skill.skillCategory === filterCategory
  );

  if (loading && !consultant) {
    return (
      <div className="consultant-skills-management loading">
        <div className="loading-spinner">Loading consultant skills...</div>
      </div>
    );
  }

  return (
    <div className="consultant-skills-management">
      <div className="skills-header">
        <div className="consultant-info">
          <h2>Skills Management</h2>
          {consultant && (
            <div className="consultant-details">
              <h3>{consultant.name}</h3>
              <p>{consultant.email}</p>
              <span className={`status-badge ${consultant.isActive ? 'active' : 'inactive'}`}>
                {consultant.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
          )}
        </div>
        {onClose && (
          <button onClick={onClose} className="close-button">
            ✕ Close
          </button>
        )}
      </div>

      {/* Category Filter */}
      <div className="category-filter">
        <label>Filter by Category:</label>
        <select 
          value={filterCategory} 
          onChange={(e) => setFilterCategory(e.target.value as SkillCategory | 'all')}
        >
          <option value="all">All Categories</option>
          {Object.entries(SKILL_CATEGORIES).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
      </div>

      {/* Tab Navigation */}
      <div className="skills-tabs">
        <button 
          className={`tab-button ${activeTab === 'current' ? 'active' : ''}`}
          onClick={() => setActiveTab('current')}
        >
          Current Skills ({filteredConsultantSkills.length})
        </button>
        <button 
          className={`tab-button ${activeTab === 'available' ? 'active' : ''}`}
          onClick={() => setActiveTab('available')}
        >
          Available Skills ({filteredAvailableSkills.length})
        </button>
        <button 
          className={`tab-button ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          History ({skillHistory.length})
        </button>
      </div>

      {/* Current Skills Tab */}
      {activeTab === 'current' && (
        <div className="current-skills-tab">
          <h3>Current Skills</h3>
          {filteredConsultantSkills.length === 0 ? (
            <div className="empty-state">
              <p>No skills assigned for the selected category.</p>
            </div>
          ) : (
            <div className="skills-grid">
              {filteredConsultantSkills.map(skill => (
                <div key={skill.skillId} className="skill-card current">
                  <div className="skill-header">
                    <h4>{skill.skillName}</h4>
                    {getVerificationStatusBadge(skill.verificationStatus)}
                  </div>
                  
                  <div className="skill-details">
                    <p><strong>Category:</strong> {skill.skillCategory && SKILL_CATEGORIES[skill.skillCategory]}</p>
                    <p><strong>Added:</strong> {new Date(skill.createdAt).toLocaleDateString()}</p>
                    {skill.verifiedDate && (
                      <p><strong>Verified:</strong> {new Date(skill.verifiedDate).toLocaleDateString()}</p>
                    )}
                    {skill.expirationDate && (
                      <p><strong>Expires:</strong> {new Date(skill.expirationDate).toLocaleDateString()}</p>
                    )}
                    {skill.notes && (
                      <p><strong>Notes:</strong> {skill.notes}</p>
                    )}
                  </div>

                  <div className="skill-actions">
                    {skill.verificationStatus === 'pending' && (
                      <>
                        <button 
                          onClick={() => updateSkillVerification(skill.skillId, 'verified')}
                          className="verify-button"
                        >
                          ✓ Verify
                        </button>
                        <button 
                          onClick={() => updateSkillVerification(skill.skillId, 'rejected', 'Verification failed')}
                          className="reject-button"
                        >
                          ✗ Reject
                        </button>
                      </>
                    )}
                    {skill.verificationStatus === 'verified' && (
                      <button 
                        onClick={() => {
                          const expirationDate = prompt('Set expiration date (YYYY-MM-DD):');
                          if (expirationDate) {
                            updateSkillVerification(skill.skillId, 'expired', 'Manual expiration', expirationDate);
                          }
                        }}
                        className="expire-button"
                      >
                        📅 Set Expiry
                      </button>
                    )}
                    <button 
                      onClick={() => removeSkillFromConsultant(skill.skillId)}
                      className="remove-button"
                    >
                      🗑️ Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Available Skills Tab */}
      {activeTab === 'available' && (
        <div className="available-skills-tab">
          <h3>Add New Skills</h3>
          
          <div className="add-skill-form">
            <div className="form-group">
              <label>Select Skill:</label>
              <select 
                value={selectedSkillId} 
                onChange={(e) => setSelectedSkillId(e.target.value)}
              >
                <option value="">Choose a skill...</option>
                {filteredAvailableSkills.map(skill => (
                  <option key={skill.id} value={skill.id}>
                    {skill.name} - {SKILL_CATEGORIES[skill.category]}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="form-group">
              <label>Initial Notes:</label>
              <textarea 
                value={verificationNotes}
                onChange={(e) => setVerificationNotes(e.target.value)}
                placeholder="Optional notes about this skill assignment..."
                rows={3}
              />
            </div>
            
            <button 
              onClick={addSkillToConsultant}
              disabled={!selectedSkillId}
              className="add-skill-button"
            >
              ➕ Add Skill
            </button>
          </div>

          <div className="available-skills-grid">
            {filteredAvailableSkills.map(skill => (
              <div key={skill.id} className="skill-card available">
                <div className="skill-header">
                  <h4>{skill.name}</h4>
                  <span className="category-badge">
                    {SKILL_CATEGORIES[skill.category]}
                  </span>
                </div>
                
                {skill.description && (
                  <p className="skill-description">{skill.description}</p>
                )}
                
                <div className="skill-stats">
                  <span>👥 {skill.consultantCount || 0} consultants</span>
                  {skill.requiresVerification && (
                    <span className="verification-required">🔍 Requires Verification</span>
                  )}
                </div>
                
                <button 
                  onClick={() => {
                    setSelectedSkillId(skill.id);
                    addSkillToConsultant();
                  }}
                  className="quick-add-button"
                >
                  Quick Add
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <div className="history-tab">
          <h3>Skill Assignment History</h3>
          
          {skillHistory.length === 0 ? (
            <div className="empty-state">
              <p>No skill assignment history found.</p>
            </div>
          ) : (
            <div className="history-timeline">
              {skillHistory.map(entry => (
                <div key={entry.id} className={`history-entry ${entry.action}`}>
                  <div className="history-timestamp">
                    {new Date(entry.timestamp).toLocaleString()}
                  </div>
                  <div className="history-content">
                    <h4>{entry.skillName}</h4>
                    <p>
                      <strong>{entry.action.toUpperCase()}</strong> by {entry.performedByName}
                    </p>
                    {entry.notes && (
                      <p className="history-notes">{entry.notes}</p>
                    )}
                  </div>
                  <div className={`history-icon ${entry.action}`}>
                    {entry.action === 'added' && '➕'}
                    {entry.action === 'removed' && '➖'}
                    {entry.action === 'verified' && '✅'}
                    {entry.action === 'expired' && '⏰'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

    </div>
  );
};

export default ConsultantSkillsManagement;