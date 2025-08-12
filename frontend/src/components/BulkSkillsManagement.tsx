import React, { useState, useEffect, useRef } from 'react';
import {
  BulkSkillOperation,
  SkillManagement,
  ConsultantSkillManagement,
  SkillAssignmentHistory,
  SKILL_CATEGORIES
} from '../types/skills';
import { useAuth } from '../contexts/AuthContext';
import '../styles/bulk-skills.css';

interface Consultant {
  id: number;
  name: string;
  email: string;
  isActive: boolean;
  currentSkills: string[];
}

interface BulkOperationResult {
  success: boolean;
  processedCount: number;
  errors: string[];
  warnings: string[];
}

const BulkSkillsManagement: React.FC = () => {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [consultants, setConsultants] = useState<Consultant[]>([]);
  const [skills, setSkills] = useState<SkillManagement[]>([]);
  const [selectedConsultants, setSelectedConsultants] = useState<number[]>([]);
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [operation, setOperation] = useState<BulkSkillOperation['action']>('add');
  const [verificationStatus, setVerificationStatus] = useState<ConsultantSkillManagement['verificationStatus']>('pending');
  const [bulkNotes, setBulkNotes] = useState('');
  const [expirationDate, setExpirationDate] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [operationHistory, setOperationHistory] = useState<SkillAssignmentHistory[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  
  const [importData, setImportData] = useState<string>('');
  const [showImportModal, setShowImportModal] = useState(false);
  const [importPreview, setImportPreview] = useState<any[]>([]);

  useEffect(() => {
    loadConsultants();
    loadSkills();
    loadOperationHistory();
  }, []);

  const loadConsultants = async () => {
    try {
      const response = await fetch('/api/admin/consultants');
      if (response.ok) {
        const data = await response.json();
        setConsultants(data);
      }
    } catch (error) {
      console.error('[BulkSkillsManagement] Failed to load consultants:', error);
    }
  };

  const loadSkills = async () => {
    try {
      const response = await fetch('/api/admin/skills?active=true');
      if (response.ok) {
        const data = await response.json();
        setSkills(data);
      }
    } catch (error) {
      console.error('[BulkSkillsManagement] Failed to load skills:', error);
    }
  };

  const loadOperationHistory = async () => {
    try {
      const response = await fetch('/api/admin/skills/history?limit=50');
      if (response.ok) {
        const data = await response.json();
        setOperationHistory(data);
      }
    } catch (error) {
      console.error('[BulkSkillsManagement] Failed to load operation history:', error);
    }
  };

  const handleBulkOperation = async () => {
    if (selectedConsultants.length === 0 || selectedSkills.length === 0) {
      alert('Please select at least one consultant and one skill.');
      return;
    }

    if (!window.confirm(`Are you sure you want to ${operation} ${selectedSkills.length} skill(s) for ${selectedConsultants.length} consultant(s)?`)) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/admin/skills/bulk-operation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          consultantIds: selectedConsultants,
          skillIds: selectedSkills,
          action: operation,
          verificationStatus: operation === 'add' ? verificationStatus : undefined,
          notes: bulkNotes,
          expirationDate: operation === 'add' && expirationDate ? expirationDate : undefined,
          performedBy: user?.id
        } as BulkSkillOperation)
      });

      if (response.ok) {
        const result: BulkOperationResult = await response.json();
        
        if (result.success) {
          alert(`Operation completed successfully! Processed ${result.processedCount} assignments.`);
          
          if (result.warnings.length > 0) {
            console.warn('Warnings:', result.warnings);
          }
          
          // Reset form
          setSelectedConsultants([]);
          setSelectedSkills([]);
          setBulkNotes('');
          setExpirationDate('');
          
          // Reload data
          await loadConsultants();
          await loadOperationHistory();
        } else {
          alert(`Operation completed with errors. Processed: ${result.processedCount}. Errors: ${result.errors.join(', ')}`);
        }
      }
    } catch (error) {
      console.error('[BulkSkillsManagement] Bulk operation failed:', error);
      alert('Bulk operation failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleImportFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setImportData(text);
      parseImportData(text);
      setShowImportModal(true);
    };
    reader.readAsText(file);
  };

  const parseImportData = (data: string) => {
    try {
      const lines = data.split('\n');
      const header = lines[0].toLowerCase().split(',').map(h => h.trim());
      
      const requiredColumns = ['consultant_email', 'skill_name'];
      const hasRequiredColumns = requiredColumns.every(col => header.includes(col));
      
      if (!hasRequiredColumns) {
        alert(`CSV must contain columns: ${requiredColumns.join(', ')}`);
        return;
      }

      const preview = lines.slice(1, 6).map((line, index) => {
        const values = line.split(',').map(v => v.trim());
        const row: any = {};
        header.forEach((col, i) => {
          row[col] = values[i] || '';
        });
        return { ...row, lineNumber: index + 2 };
      }).filter(row => row.consultant_email && row.skill_name);

      setImportPreview(preview);
    } catch (error) {
      console.error('Error parsing CSV:', error);
      alert('Error parsing CSV file. Please check the format.');
    }
  };

  const handleImport = async () => {
    if (!importData) return;

    setLoading(true);
    try {
      const response = await fetch('/api/admin/skills/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          csvData: importData,
          performedBy: user?.id,
          defaultVerificationStatus: verificationStatus
        })
      });

      if (response.ok) {
        const result: BulkOperationResult = await response.json();
        alert(`Import completed! Processed ${result.processedCount} assignments.`);
        
        if (result.errors.length > 0) {
          console.error('Import errors:', result.errors);
        }
        
        setShowImportModal(false);
        setImportData('');
        setImportPreview([]);
        
        await loadConsultants();
        await loadOperationHistory();
      }
    } catch (error) {
      console.error('[BulkSkillsManagement] Import failed:', error);
      alert('Import failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      const response = await fetch('/api/admin/skills/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          consultantIds: selectedConsultants.length > 0 ? selectedConsultants : undefined,
          skillIds: selectedSkills.length > 0 ? selectedSkills : undefined
        })
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `consultant-skills-export-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('[BulkSkillsManagement] Export failed:', error);
      alert('Export failed. Please try again.');
    }
  };

  const toggleConsultantSelection = (consultantId: number) => {
    setSelectedConsultants(prev => 
      prev.includes(consultantId) 
        ? prev.filter(id => id !== consultantId)
        : [...prev, consultantId]
    );
  };

  const toggleSkillSelection = (skillId: string) => {
    setSelectedSkills(prev => 
      prev.includes(skillId) 
        ? prev.filter(id => id !== skillId)
        : [...prev, skillId]
    );
  };

  const selectAllConsultants = () => {
    setSelectedConsultants(consultants.map(c => c.id));
  };

  const clearConsultantSelection = () => {
    setSelectedConsultants([]);
  };

  const selectAllSkills = () => {
    setSelectedSkills(skills.map(s => s.id));
  };

  const clearSkillSelection = () => {
    setSelectedSkills([]);
  };

  const skillsByCategory = skills.reduce((acc, skill) => {
    if (!acc[skill.category]) {
      acc[skill.category] = [];
    }
    acc[skill.category].push(skill);
    return acc;
  }, {} as Record<string, SkillManagement[]>);

  return (
    <div className="bulk-skills-management">
      <div className="header">
        <div className="header-content">
          <h2>Bulk Skills Management</h2>
          <p>Manage skills for multiple consultants simultaneously</p>
        </div>
        <div className="header-actions">
          <button onClick={() => setShowHistory(!showHistory)} className="history-button">
            📋 {showHistory ? 'Hide' : 'Show'} History
          </button>
          <button onClick={() => fileInputRef.current?.click()} className="import-button">
            📥 Import Skills
          </button>
          <button onClick={handleExport} className="export-button">
            📤 Export Skills
          </button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        onChange={handleImportFile}
        style={{ display: 'none' }}
      />

      {/* Operation History */}
      {showHistory && (
        <div className="operation-history">
          <h3>Recent Operations</h3>
          <div className="history-list">
            {operationHistory.slice(0, 10).map(entry => (
              <div key={entry.id} className={`history-entry ${entry.action}`}>
                <div className="history-info">
                  <div className="history-main">
                    <strong>{entry.consultantName}</strong> - {entry.skillName}
                  </div>
                  <div className="history-details">
                    {entry.action.toUpperCase()} by {entry.performedByName} on {new Date(entry.timestamp).toLocaleString()}
                  </div>
                  {entry.notes && (
                    <div className="history-notes">{entry.notes}</div>
                  )}
                </div>
                <div className={`history-badge ${entry.action}`}>
                  {entry.action === 'added' && '➕'}
                  {entry.action === 'removed' && '➖'}
                  {entry.action === 'verified' && '✅'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bulk-operation-panel">
        <div className="operation-config">
          <h3>Bulk Operation Configuration</h3>
          
          <div className="config-grid">
            <div className="config-group">
              <label>Operation Type:</label>
              <select 
                value={operation} 
                onChange={(e) => setOperation(e.target.value as BulkSkillOperation['action'])}
              >
                <option value="add">Add Skills</option>
                <option value="remove">Remove Skills</option>
                <option value="verify">Update Verification</option>
              </select>
            </div>

            {operation === 'add' && (
              <div className="config-group">
                <label>Initial Verification Status:</label>
                <select 
                  value={verificationStatus} 
                  onChange={(e) => setVerificationStatus(e.target.value as ConsultantSkillManagement['verificationStatus'])}
                >
                  <option value="pending">Pending</option>
                  <option value="verified">Verified</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
            )}

            {(operation === 'add' || operation === 'verify') && (
              <div className="config-group">
                <label>Expiration Date (Optional):</label>
                <input
                  type="date"
                  value={expirationDate}
                  onChange={(e) => setExpirationDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
            )}
          </div>

          <div className="notes-section">
            <label>Bulk Operation Notes:</label>
            <textarea
              value={bulkNotes}
              onChange={(e) => setBulkNotes(e.target.value)}
              placeholder="Enter notes for this bulk operation..."
              rows={3}
            />
          </div>
        </div>

        <div className="selection-summary">
          <div className="summary-card">
            <div className="summary-number">{selectedConsultants.length}</div>
            <div className="summary-label">Selected Consultants</div>
          </div>
          <div className="summary-card">
            <div className="summary-number">{selectedSkills.length}</div>
            <div className="summary-label">Selected Skills</div>
          </div>
          <div className="summary-card">
            <div className="summary-number">{selectedConsultants.length * selectedSkills.length}</div>
            <div className="summary-label">Total Operations</div>
          </div>
        </div>

        <div className="operation-actions">
          <button 
            onClick={handleBulkOperation}
            disabled={loading || selectedConsultants.length === 0 || selectedSkills.length === 0}
            className="execute-button"
          >
            {loading ? 'Processing...' : `Execute Bulk ${operation.charAt(0).toUpperCase() + operation.slice(1)}`}
          </button>
        </div>
      </div>

      <div className="selection-panels">
        {/* Consultant Selection */}
        <div className="selection-panel">
          <div className="panel-header">
            <h3>Select Consultants ({selectedConsultants.length} selected)</h3>
            <div className="panel-actions">
              <button onClick={selectAllConsultants} className="select-all-button">
                Select All
              </button>
              <button onClick={clearConsultantSelection} className="clear-button">
                Clear
              </button>
            </div>
          </div>
          
          <div className="consultants-list">
            {consultants.map(consultant => (
              <div 
                key={consultant.id} 
                className={`consultant-item ${selectedConsultants.includes(consultant.id) ? 'selected' : ''} ${!consultant.isActive ? 'inactive' : ''}`}
                onClick={() => toggleConsultantSelection(consultant.id)}
              >
                <div className="consultant-info">
                  <div className="consultant-name">{consultant.name}</div>
                  <div className="consultant-email">{consultant.email}</div>
                  <div className="consultant-skills">
                    {consultant.currentSkills.length} skills assigned
                  </div>
                </div>
                <div className="selection-indicator">
                  {selectedConsultants.includes(consultant.id) && '✓'}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Skills Selection */}
        <div className="selection-panel">
          <div className="panel-header">
            <h3>Select Skills ({selectedSkills.length} selected)</h3>
            <div className="panel-actions">
              <button onClick={selectAllSkills} className="select-all-button">
                Select All
              </button>
              <button onClick={clearSkillSelection} className="clear-button">
                Clear
              </button>
            </div>
          </div>
          
          <div className="skills-by-category">
            {Object.entries(skillsByCategory).map(([category, categorySkills]) => (
              <div key={category} className="skills-category">
                <h4 className="category-header">
                  {SKILL_CATEGORIES[category as keyof typeof SKILL_CATEGORIES]}
                </h4>
                <div className="category-skills">
                  {categorySkills.map(skill => (
                    <div 
                      key={skill.id} 
                      className={`skill-item ${selectedSkills.includes(skill.id) ? 'selected' : ''}`}
                      onClick={() => toggleSkillSelection(skill.id)}
                    >
                      <div className="skill-info">
                        <div className="skill-name">{skill.name}</div>
                        {skill.description && (
                          <div className="skill-description">{skill.description}</div>
                        )}
                        <div className="skill-stats">
                          👥 {skill.consultantCount || 0} consultants
                        </div>
                      </div>
                      <div className="selection-indicator">
                        {selectedSkills.includes(skill.id) && '✓'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Import Modal */}
      {showImportModal && (
        <div className="modal-overlay">
          <div className="modal-content import-modal">
            <div className="modal-header">
              <h3>Import Skills from CSV</h3>
              <button onClick={() => setShowImportModal(false)} className="close-button">✕</button>
            </div>
            
            <div className="modal-body">
              <div className="import-instructions">
                <h4>CSV Format Requirements:</h4>
                <ul>
                  <li>Required columns: consultant_email, skill_name</li>
                  <li>Optional columns: verification_status, notes, expiration_date</li>
                  <li>Use comma-separated values</li>
                  <li>Include header row</li>
                </ul>
              </div>

              {importPreview.length > 0 && (
                <div className="import-preview">
                  <h4>Preview (first 5 rows):</h4>
                  <table>
                    <thead>
                      <tr>
                        {Object.keys(importPreview[0]).filter(k => k !== 'lineNumber').map(key => (
                          <th key={key}>{key}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {importPreview.map((row, index) => (
                        <tr key={index}>
                          {Object.entries(row).filter(([k]) => k !== 'lineNumber').map(([key, value]) => (
                            <td key={key}>{String(value)}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="import-config">
                <label>Default Verification Status for New Skills:</label>
                <select 
                  value={verificationStatus} 
                  onChange={(e) => setVerificationStatus(e.target.value as ConsultantSkillManagement['verificationStatus'])}
                >
                  <option value="pending">Pending</option>
                  <option value="verified">Verified</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
            </div>

            <div className="modal-actions">
              <button onClick={() => setShowImportModal(false)} className="cancel-button">
                Cancel
              </button>
              <button 
                onClick={handleImport} 
                disabled={loading || importPreview.length === 0}
                className="import-confirm-button"
              >
                {loading ? 'Importing...' : `Import ${importPreview.length} Records`}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default BulkSkillsManagement;