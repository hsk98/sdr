import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { consultantAPI, assignmentAPI, authAPI } from '../services/api';
import { Consultant, Assignment, AssignmentStats } from '../types';
import ChartAnalytics from './ChartAnalytics';
import MeetingManagement from './MeetingManagement';
import ConsultantSkillsManagement from './ConsultantSkillsManagement';
import SkillsDatabaseManagement from './SkillsDatabaseManagement';
import BulkSkillsManagement from './BulkSkillsManagement';
import SkillsAnalyticsDashboard from './SkillsAnalyticsDashboard';
import ReassignmentAnalyticsDashboard from './ReassignmentAnalyticsDashboard';
import ReassignmentReporting from './ReassignmentReporting';
import './Dashboard.css';

const AdminDashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'consultants' | 'assignments' | 'stats' | 'analytics' | 'users' | 'meetings' | 'skills' | 'skills-database' | 'bulk-skills' | 'skills-analytics' | 'reassignment-analytics' | 'reassignment-reports'>('dashboard');
  const [selectedConsultantForSkills, setSelectedConsultantForSkills] = useState<number | null>(null);
  const [consultants, setConsultants] = useState<Consultant[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [stats, setStats] = useState<AssignmentStats[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [showAddConsultant, setShowAddConsultant] = useState(false);
  const [showAddUser, setShowAddUser] = useState(false);
  const [editingConsultant, setEditingConsultant] = useState<Consultant | null>(null);
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [showManualAssignment, setShowManualAssignment] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    loadConsultants();
    loadAssignments();
    loadStats();
    loadUsers();
  }, []);

  // Auto-dismiss messages after 4 seconds
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => {
        setSuccess('');
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        setError('');
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const loadConsultants = async () => {
    try {
      const data = await consultantAPI.getAll();
      setConsultants(data);
    } catch (err) {
      setError('Failed to load consultants');
    }
  };

  const loadAssignments = async () => {
    try {
      const data = await assignmentAPI.getAll();
      setAssignments(data);
    } catch (err) {
      setError('Failed to load assignments');
    }
  };

  const loadStats = async () => {
    try {
      const data = await assignmentAPI.getStats();
      setStats(data);
    } catch (err) {
      setError('Failed to load stats');
    }
  };

  const loadUsers = async () => {
    try {
      const data = await authAPI.getUsers();
      setUsers(data);
    } catch (err) {
      setError('Failed to load users');
    }
  };

  const generateReport = () => {
    try {
      // Create CSV content
      const headers = ['ID', 'SDR/Admin', 'Consultant', 'Lead ID', 'Lead Name', 'Assigned Date', 'Status', 'Type', 'Manual Reason'];
      const csvContent = [
        headers.join(','),
        ...assignments.map(assignment => [
          assignment.id,
          `"${assignment.display_sdr_name || `${assignment.sdr_first_name || ''} ${assignment.sdr_last_name || ''}`.trim()}"`,
          `"${assignment.consultant_name || ''}"`,
          `"${assignment.display_lead_id || assignment.lead_id || ''}"`,
          `"${assignment.display_lead_name || assignment.company_name || ''}"`,
          `"${new Date(assignment.assigned_at).toLocaleString()}"`,
          assignment.status,
          assignment.is_manual ? 'Manual' : 'Automatic',
          `"${assignment.manual_reason || ''}"`
        ].join(','))
      ].join('\n');

      // Create and download file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `assignments-report-${new Date().toISOString().slice(0, 10)}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setSuccess('Report generated and downloaded successfully!');
    } catch (error) {
      console.error('Failed to generate report:', error);
      setError('Failed to generate report. Please try again.');
    }
  };

  const handleDeleteConsultant = async (id: number) => {
    if (window.confirm('Are you sure you want to delete this consultant?')) {
      try {
        await consultantAPI.delete(id);
        setSuccess('Consultant deleted successfully');
        loadConsultants();
        loadStats();
      } catch (err: any) {
        setError(err.response?.data?.error || 'Failed to delete consultant');
      }
    }
  };

  const handleDeleteUser = async (id: number) => {
    if (window.confirm('Are you sure you want to delete this user?')) {
      try {
        await authAPI.deleteUser(id);
        setSuccess('User deleted successfully');
        loadUsers();
      } catch (err: any) {
        setError(err.response?.data?.error || 'Failed to delete user');
      }
    }
  };

  const ConsultantForm: React.FC<{ consultant?: Consultant; onClose: () => void }> = ({ 
    consultant, 
    onClose 
  }) => {
    const [formData, setFormData] = useState({
      name: consultant?.name || '',
      email: consultant?.email || '',
      phone: consultant?.phone || '',
      is_active: consultant?.is_active ?? true
    });

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      try {
        if (consultant) {
          await consultantAPI.update(consultant.id, formData);
          setSuccess('Consultant updated successfully');
        } else {
          await consultantAPI.create(formData);
          setSuccess('Consultant created successfully');
        }
        loadConsultants();
        loadStats();
        onClose();
      } catch (err: any) {
        setError(err.response?.data?.error || 'Failed to save consultant');
      }
    };

    return (
      <div className="modal-overlay">
        <div className="modal">
          <h3>{consultant ? 'Edit Consultant' : 'Add Consultant'}</h3>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Name:</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                required
              />
            </div>
            <div className="form-group">
              <label>Email:</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                required
              />
            </div>
            <div className="form-group">
              <label>Phone:</label>
              <input
                type="text"
                value={formData.phone}
                onChange={(e) => setFormData({...formData, phone: e.target.value})}
              />
            </div>
            <div className="form-group">
              <label>
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({...formData, is_active: e.target.checked})}
                />
                Active
              </label>
            </div>
            <div className="form-actions">
              <button type="submit">Save</button>
              <button type="button" onClick={onClose}>Cancel</button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  const ManualAssignmentForm: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const [formData, setFormData] = useState({
      leadId: '',
      leadName: '',
      consultantId: '',
      reason: ''
    });

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      
      if (!formData.leadId.trim() || !formData.leadName.trim()) {
        setError('Lead ID and Lead Name are required');
        return;
      }

      try {
        await assignmentAPI.createManual({
          leadId: formData.leadId.trim(),
          leadName: formData.leadName.trim(),
          consultantId: parseInt(formData.consultantId),
          reason: formData.reason.trim()
        });
        
        const consultantName = consultants.find(c => c.id === parseInt(formData.consultantId))?.name || 'Unknown';
        setSuccess(`Assignment created: ${formData.leadName} → ${consultantName}`);
        
        // Reset form
        setFormData({ leadId: '', leadName: '', consultantId: '', reason: '' });
        
        loadAssignments();
        loadStats();
        onClose();
      } catch (err: any) {
        console.error('Manual assignment error:', err);
        const errorMessage = err.response?.data?.error || err.message || 'Failed to create manual assignment';
        setError(`Assignment failed: ${errorMessage}`);
      }
    };

    return (
      <div className="modal-overlay">
        <div className="modal">
          <h3>Manual Lead Assignment</h3>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Lead ID (Salesforce or Internal):</label>
              <input
                type="text"
                value={formData.leadId}
                onChange={(e) => setFormData({...formData, leadId: e.target.value})}
                placeholder="e.g., SF001, 00Q5e00001abcde, or internal ID"
                required
              />
              <small style={{color: '#666', fontSize: '12px', marginTop: '4px', display: 'block'}}>
                Enter Salesforce Lead ID or internal lead ID from your CRM
              </small>
            </div>
            <div className="form-group">
              <label>Lead/Company Name:</label>
              <input
                type="text"
                value={formData.leadName}
                onChange={(e) => setFormData({...formData, leadName: e.target.value})}
                placeholder="e.g., Acme Corp, John Doe - TechStart Inc"
                required
              />
              <small style={{color: '#666', fontSize: '12px', marginTop: '4px', display: 'block'}}>
                Enter company name or contact name for verification
              </small>
            </div>
            <div className="form-group">
              <label>Select Consultant:</label>
              <select
                value={formData.consultantId}
                onChange={(e) => setFormData({...formData, consultantId: e.target.value})}
                required
              >
                <option value="">Choose a consultant...</option>
                {consultants.filter(c => c.is_active).map(consultant => (
                  <option key={consultant.id} value={consultant.id}>
                    {consultant.name} ({consultant.email})
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Reason for Manual Assignment:</label>
              <input
                type="text"
                value={formData.reason}
                onChange={(e) => setFormData({...formData, reason: e.target.value})}
                placeholder="e.g., Client preference, timezone match, industry expertise..."
                required
              />
            </div>
            <div className="form-actions">
              <button type="submit">Create Assignment</button>
              <button type="button" onClick={onClose}>Cancel</button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  const UserForm: React.FC<{ user?: any; onClose: () => void }> = ({ user, onClose }) => {
    const [formData, setFormData] = useState({
      username: user?.username || '',
      email: user?.email || '',
      password: '',
      firstName: user?.first_name || '',
      lastName: user?.last_name || '',
      role: user?.role || 'sdr'
    });

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      console.log('Submitting user form with data:', formData);
      try {
        if (user) {
          // Update existing user
          const result = await authAPI.updateUser(user.id, {
            username: formData.username,
            email: formData.email,
            role: formData.role,
            firstName: formData.firstName,
            lastName: formData.lastName
          });
          console.log('User update successful:', result);
          setSuccess('User updated successfully');
        } else {
          // Create new user
          const result = await authAPI.register(formData);
          console.log('User creation successful:', result);
          setSuccess('User created successfully');
        }
        loadUsers(); // Reload the users list
        onClose();
      } catch (err: any) {
        console.error('User operation failed:', err);
        console.error('Error response:', err.response?.data);
        setError(err.response?.data?.error || `Failed to ${user ? 'update' : 'create'} user`);
      }
    };

    return (
      <div className="modal-overlay">
        <div className="modal">
          <h3>{user ? 'Edit User' : 'Add User'}</h3>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Username:</label>
              <input
                type="text"
                value={formData.username}
                onChange={(e) => setFormData({...formData, username: e.target.value})}
                required
              />
            </div>
            <div className="form-group">
              <label>Email:</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                required
              />
            </div>
            {!user && (
              <div className="form-group">
                <label>Password:</label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                  required
                />
              </div>
            )}
            <div className="form-group">
              <label>First Name:</label>
              <input
                type="text"
                value={formData.firstName}
                onChange={(e) => setFormData({...formData, firstName: e.target.value})}
                required
              />
            </div>
            <div className="form-group">
              <label>Last Name:</label>
              <input
                type="text"
                value={formData.lastName}
                onChange={(e) => setFormData({...formData, lastName: e.target.value})}
                required
              />
            </div>
            <div className="form-group">
              <label>Role:</label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({...formData, role: e.target.value})}
              >
                <option value="sdr">SDR</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div className="form-actions">
              <button type="submit">Create User</button>
              <button type="button" onClick={onClose}>Cancel</button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <h1>Admin Dashboard</h1>
        <div className="user-info">
          <span>Welcome, {user?.firstName} {user?.lastName}</span>
          <button onClick={logout} className="logout-btn">Logout</button>
        </div>
      </header>

      <nav className="admin-nav">
        <button 
          className={activeTab === 'dashboard' ? 'active' : ''}
          onClick={() => setActiveTab('dashboard')}
        >
          Dashboard
        </button>
        <button 
          className={activeTab === 'consultants' ? 'active' : ''}
          onClick={() => setActiveTab('consultants')}
        >
          Consultants
        </button>
        <button 
          className={activeTab === 'assignments' ? 'active' : ''}
          onClick={() => setActiveTab('assignments')}
        >
          Assignments
        </button>
        <button 
          className={activeTab === 'stats' ? 'active' : ''}
          onClick={() => setActiveTab('stats')}
        >
          Statistics
        </button>
        <button 
          className={activeTab === 'analytics' ? 'active' : ''}
          onClick={() => setActiveTab('analytics')}
        >
          📊 Analytics
        </button>
        <button 
          className={activeTab === 'users' ? 'active' : ''}
          onClick={() => setActiveTab('users')}
        >
          Users
        </button>
        <button 
          className={activeTab === 'meetings' ? 'active' : ''}
          onClick={() => setActiveTab('meetings')}
        >
          📋 Meetings
        </button>
        <button 
          className={activeTab === 'skills-database' ? 'active' : ''}
          onClick={() => setActiveTab('skills-database')}
        >
          🎯 Skills Database
        </button>
        <button 
          className={activeTab === 'bulk-skills' ? 'active' : ''}
          onClick={() => setActiveTab('bulk-skills')}
        >
          📦 Bulk Skills
        </button>
        <button 
          className={activeTab === 'skills-analytics' ? 'active' : ''}
          onClick={() => setActiveTab('skills-analytics')}
        >
          📈 Skills Analytics
        </button>
        <button 
          className={activeTab === 'reassignment-analytics' ? 'active' : ''}
          onClick={() => setActiveTab('reassignment-analytics')}
        >
          🔄 Reassignment Analytics
        </button>
        <button 
          className={activeTab === 'reassignment-reports' ? 'active' : ''}
          onClick={() => setActiveTab('reassignment-reports')}
        >
          📋 Reassignment Reports
        </button>
      </nav>

      {error && (
        <div className="error-message">
          {error}
          <button 
            onClick={() => setError('')}
            className="message-close"
            aria-label="Close error message"
          >
            ×
          </button>
        </div>
      )}
      {success && (
        <div className="success-message">
          {success}
          <button 
            onClick={() => setSuccess('')}
            className="message-close"
            aria-label="Close success message"
          >
            ×
          </button>
        </div>
      )}

      <main className="admin-main">
        {activeTab === 'dashboard' && (
          <div className="dashboard-homepage">
            {/* Key Metrics Section */}
            <div className="metrics-grid">
              <div className="metric-card">
                <div className="metric-header">
                  <h3>Active Consultants</h3>
                  <div className="metric-status status-good"></div>
                </div>
                <div className="metric-value">{consultants.filter(c => c.is_active).length}</div>
                <div className="metric-detail">
                  {consultants.length - consultants.filter(c => c.is_active).length} inactive
                </div>
              </div>

              <div className="metric-card">
                <div className="metric-header">
                  <h3>Assignments Today</h3>
                  <div className="metric-trend trend-up">↗ +12%</div>
                </div>
                <div className="metric-value">{assignments.filter(a => 
                  new Date(a.assigned_at).toDateString() === new Date().toDateString()
                ).length}</div>
                <div className="metric-detail">vs yesterday</div>
              </div>

              <div className="metric-card">
                <div className="metric-header">
                  <h3>Queue Status</h3>
                  <div className="metric-status status-good"></div>
                </div>
                <div className="metric-value">Healthy</div>
                <div className="metric-detail">
                  Next: {consultants.length > 0 ? consultants.sort((a, b) => 
                    (a.assignment_count || 0) - (b.assignment_count || 0)
                  )[0]?.name : 'No consultants'}
                </div>
              </div>

              <div className="metric-card">
                <div className="metric-header">
                  <h3>System Status</h3>
                  <div className="metric-status status-good"></div>
                </div>
                <div className="metric-value">All Systems</div>
                <div className="metric-detail">Operational</div>
              </div>
            </div>

            {/* Main Dashboard Content */}
            <div className="dashboard-content">
              {/* Assignment Activity - Left Column */}
              <div className="dashboard-section assignment-activity">
                <div className="section-header-small">
                  <h3>Recent Assignment Activity</h3>
                  <span className="live-indicator">Live</span>
                </div>
                <div className="activity-feed">
                  {assignments.slice(0, 8).map((assignment, index) => (
                    <div key={assignment.id} className="activity-item">
                      <div className="activity-time">
                        {new Date(assignment.assigned_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </div>
                      <div className="activity-content">
                        <div className="activity-sdr">{assignment.sdr_first_name} {assignment.sdr_last_name}</div>
                        <div className="activity-consultant">→ {assignment.consultant_name}</div>
                      </div>
                      <div className={`activity-status status-${assignment.status}`}>
                        {assignment.status}
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="activity-stats">
                  <div className="stat-item">
                    <span className="stat-label">Most Active Today:</span>
                    <span className="stat-value">
                      {stats.length > 0 ? stats.sort((a, b) => b.total_assignments - a.total_assignments)[0]?.name : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Consultant Overview - Center */}
              <div className="dashboard-section consultant-overview">
                <div className="section-header-small">
                  <h3>Consultant Overview</h3>
                  <button 
                    className="btn-small"
                    onClick={() => setActiveTab('consultants')}
                  >
                    Manage All
                  </button>
                </div>
                
                <div className="consultant-grid">
                  {consultants.slice(0, 6).map(consultant => (
                    <div key={consultant.id} className="consultant-card">
                      <div className="consultant-info">
                        <div className="consultant-name">{consultant.name}</div>
                        <div className="consultant-email">{consultant.email}</div>
                      </div>
                      <div className="consultant-status">
                        <div className={`status-indicator ${consultant.is_active ? 'available' : 'offline'}`}>
                          {consultant.is_active ? 'Available' : 'Offline'}
                        </div>
                        <div className="assignment-count">
                          {stats.find(s => s.name === consultant.name)?.total_assignments || 0} assignments
                        </div>
                      </div>
                      <div className="consultant-actions">
                        <button className="toggle-btn" disabled={!consultant.is_active}>
                          {consultant.is_active ? 'Active' : 'Inactive'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {consultants.length > 6 && (
                  <div className="view-all-link">
                    <button onClick={() => setActiveTab('consultants')}>
                      View All {consultants.length} Consultants →
                    </button>
                  </div>
                )}
              </div>

              {/* Quick Actions Panel - Right Column */}
              <div className="dashboard-section quick-actions">
                <div className="section-header-small">
                  <h3>Quick Actions</h3>
                </div>
                
                <div className="action-buttons">
                  <button 
                    className="action-btn primary"
                    onClick={() => setShowAddConsultant(true)}
                  >
                    <span className="btn-icon">+</span>
                    Add New Consultant
                  </button>
                  
                  <button 
                    className="action-btn secondary"
                    onClick={() => setShowManualAssignment(true)}
                  >
                    <span className="btn-icon">⚡</span>
                    Manual Assignment
                  </button>
                  
                  <button className="action-btn warning">
                    <span className="btn-icon">↻</span>
                    Reset Queue
                  </button>
                  
                  <button 
                    className="action-btn outline"
                    onClick={() => setActiveTab('assignments')}
                  >
                    <span className="btn-icon">📋</span>
                    View All Assignments
                  </button>
                  
                  <button 
                    className="action-btn outline"
                    onClick={generateReport}
                  >
                    <span className="btn-icon">📊</span>
                    Generate Report
                  </button>
                </div>

                {/* Recent Alerts */}
                <div className="alerts-section">
                  <h4>System Alerts</h4>
                  <div className="alert-item alert-info">
                    <div className="alert-icon">ℹ️</div>
                    <div className="alert-content">
                      <div className="alert-title">System Healthy</div>
                      <div className="alert-time">All systems operational</div>
                    </div>
                  </div>
                  
                  {consultants.filter(c => !c.is_active).length > 0 && (
                    <div className="alert-item alert-warning">
                      <div className="alert-icon">⚠️</div>
                      <div className="alert-content">
                        <div className="alert-title">Consultants Offline</div>
                        <div className="alert-time">{consultants.filter(c => !c.is_active).length} consultants currently offline</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'consultants' && (
          <div className="consultants-section">
            <div className="section-header">
              <h2>Consultants</h2>
              <button onClick={() => setShowAddConsultant(true)}>Add Consultant</button>
            </div>
            
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Phone</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {consultants.map((consultant) => (
                    <tr key={consultant.id}>
                      <td>{consultant.name}</td>
                      <td>{consultant.email}</td>
                      <td>{consultant.phone || '-'}</td>
                      <td>
                        <span className={`status ${consultant.is_active ? 'active' : 'inactive'}`}>
                          {consultant.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="actions">
                        <button onClick={() => setEditingConsultant(consultant)}>Edit</button>
                        <button 
                          onClick={() => {
                            setSelectedConsultantForSkills(consultant.id);
                            setActiveTab('skills');
                          }}
                          className="skills-btn"
                        >
                          🎯 Skills
                        </button>
                        <button 
                          onClick={() => handleDeleteConsultant(consultant.id)}
                          className="delete-btn"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'assignments' && (
          <div className="assignments-section">
            <div className="section-header">
              <h2>All Assignments</h2>
            </div>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>SDR</th>
                    <th>Consultant</th>
                    <th>Assigned Date</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {assignments.map((assignment) => (
                    <tr key={assignment.id}>
                      <td>{assignment.display_sdr_name || `${assignment.sdr_first_name} ${assignment.sdr_last_name}`}</td>
                      <td>{assignment.consultant_name}</td>
                      <td>{new Date(assignment.assigned_at).toLocaleString()}</td>
                      <td>
                        <span className={`status ${assignment.status}`}>
                          {assignment.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'stats' && (
          <div className="stats-section">
            <div className="section-header">
              <h2>Assignment Statistics</h2>
            </div>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Consultant</th>
                    <th>Total Assignments</th>
                    <th>Active Assignments</th>
                    <th>Last Assigned</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.map((stat, index) => (
                    <tr key={index}>
                      <td>{stat.name}</td>
                      <td>{stat.total_assignments}</td>
                      <td>{stat.active_assignments}</td>
                      <td>
                        {stat.last_assigned_at 
                          ? new Date(stat.last_assigned_at).toLocaleString()
                          : 'Never'
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'analytics' && (
          <ChartAnalytics />
        )}

        {activeTab === 'users' && (
          <div className="users-section">
            <div className="section-header">
              <h2>User Management</h2>
              <button onClick={() => setShowAddUser(true)}>Add User</button>
            </div>
            
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Username</th>
                    <th>Email</th>
                    <th>Name</th>
                    <th>Role</th>
                    <th>Created</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: '#666666' }}>
                        No users found. Create your first SDR or Admin account.
                      </td>
                    </tr>
                  ) : (
                    users.map((user) => (
                      <tr key={user.id}>
                        <td>{user.username}</td>
                        <td>{user.email}</td>
                        <td>{user.first_name} {user.last_name}</td>
                        <td>
                          <span className={`status ${user.role === 'admin' ? 'completed' : 'active'}`}>
                            {user.role.toUpperCase()}
                          </span>
                        </td>
                        <td>{new Date(user.created_at).toLocaleDateString()}</td>
                        <td className="actions">
                          <button onClick={() => setEditingUser(user)}>Edit</button>
                          <button 
                            onClick={() => handleDeleteUser(user.id)}
                            className="delete-btn"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'meetings' && (
          <MeetingManagement />
        )}

        {activeTab === 'skills' && selectedConsultantForSkills && (
          <ConsultantSkillsManagement 
            consultantId={selectedConsultantForSkills} 
            onClose={() => {
              setSelectedConsultantForSkills(null);
              setActiveTab('consultants');
            }}
          />
        )}

        {activeTab === 'skills-database' && (
          <SkillsDatabaseManagement />
        )}

        {activeTab === 'bulk-skills' && (
          <BulkSkillsManagement />
        )}

        {activeTab === 'skills-analytics' && (
          <SkillsAnalyticsDashboard />
        )}

        {activeTab === 'reassignment-analytics' && (
          <ReassignmentAnalyticsDashboard />
        )}

        {activeTab === 'reassignment-reports' && (
          <ReassignmentReporting />
        )}
      </main>

      {showAddConsultant && (
        <ConsultantForm onClose={() => setShowAddConsultant(false)} />
      )}

      {editingConsultant && (
        <ConsultantForm 
          consultant={editingConsultant}
          onClose={() => setEditingConsultant(null)} 
        />
      )}

      {showAddUser && (
        <UserForm onClose={() => setShowAddUser(false)} />
      )}

      {editingUser && (
        <UserForm 
          user={editingUser}
          onClose={() => setEditingUser(null)} 
        />
      )}

      {showManualAssignment && (
        <ManualAssignmentForm onClose={() => setShowManualAssignment(false)} />
      )}
    </div>
  );
};

export default AdminDashboard;