import React, { useState, useEffect, useCallback } from 'react';
import {
  SkillManagement,
  SkillCategory,
  SKILL_CATEGORIES,
  PREDEFINED_SKILLS
} from '../types/skills';
import { useAuth } from '../contexts/AuthContext';
import '../styles/skills-database.css';

interface SkillFormData {
  id?: string;
  name: string;
  category: SkillCategory;
  description: string;
  requiresVerification: boolean;
  isActive: boolean;
}

const SkillsDatabaseManagement: React.FC = () => {
  const { user } = useAuth();
  const [skills, setSkills] = useState<SkillManagement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingSkill, setEditingSkill] = useState<SkillManagement | null>(null);
  const [formData, setFormData] = useState<SkillFormData>({
    name: '',
    category: 'specialization',
    description: '',
    requiresVerification: true,
    isActive: true
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<SkillCategory | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');

  useEffect(() => {
    loadSkills();
  }, []);

  const loadSkills = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/skills');
      if (response.ok) {
        const data = await response.json();
        setSkills(data);
      }
    } catch (error) {
      console.error('[SkillsDatabaseManagement] Failed to load skills:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const url = editingSkill 
        ? `/api/admin/skills/${editingSkill.id}` 
        : '/api/admin/skills';
      
      const method = editingSkill ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          createdBy: user?.id,
          updatedAt: new Date().toISOString()
        })
      });

      if (response.ok) {
        await loadSkills();
        resetForm();
      }
    } catch (error) {
      console.error('[SkillsDatabaseManagement] Failed to save skill:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      category: 'specialization',
      description: '',
      requiresVerification: true,
      isActive: true
    });
    setEditingSkill(null);
    setShowAddForm(false);
  };

  const handleEdit = (skill: SkillManagement) => {
    setFormData({
      id: skill.id,
      name: skill.name,
      category: skill.category,
      description: skill.description || '',
      requiresVerification: skill.requiresVerification,
      isActive: skill.isActive
    });
    setEditingSkill(skill);
    setShowAddForm(true);
  };

  const handleDeactivate = async (skillId: string) => {
    if (!window.confirm('Are you sure you want to deactivate this skill? This will prevent new assignments but keep existing ones.')) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/skills/${skillId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          isActive: false,
          updatedAt: new Date().toISOString()
        })
      });

      if (response.ok) {
        await loadSkills();
      }
    } catch (error) {
      console.error('[SkillsDatabaseManagement] Failed to deactivate skill:', error);
    }
  };

  const handleDelete = async (skillId: string) => {
    if (!window.confirm('Are you sure you want to delete this skill? This action cannot be undone and will remove it from all consultants.')) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/skills/${skillId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        await loadSkills();
      }
    } catch (error) {
      console.error('[SkillsDatabaseManagement] Failed to delete skill:', error);
    }
  };

  const initializePredefinedSkills = async () => {
    if (!window.confirm('This will add all predefined skills to the database. Continue?')) {
      return;
    }

    try {
      const response = await fetch('/api/admin/skills/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          skills: PREDEFINED_SKILLS.map(skill => ({
            ...skill,
            isActive: true,
            requiresVerification: true,
            createdBy: user?.id
          }))
        })
      });

      if (response.ok) {
        await loadSkills();
      }
    } catch (error) {
      console.error('[SkillsDatabaseManagement] Failed to initialize predefined skills:', error);
    }
  };

  const filteredSkills = skills.filter(skill => {
    const matchesSearch = skill.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (skill.description?.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCategory = filterCategory === 'all' || skill.category === filterCategory;
    const matchesStatus = filterStatus === 'all' || 
                         (filterStatus === 'active' && skill.isActive) ||
                         (filterStatus === 'inactive' && !skill.isActive);
    
    return matchesSearch && matchesCategory && matchesStatus;
  });

  const skillCategoryCounts = skills.reduce((acc, skill) => {
    acc[skill.category] = (acc[skill.category] || 0) + 1;
    return acc;
  }, {} as Record<SkillCategory, number>);

  if (loading) {
    return (
      <div className="skills-database-management loading">
        <div className="loading-spinner">Loading skills database...</div>
      </div>
    );
  }

  return (
    <div className="skills-database-management">
      <div className="header">
        <div className="header-content">
          <h2>Skills Database Management</h2>
          <p>Manage the master list of skills available for consultant assignments</p>
        </div>
        <div className="header-actions">
          <button 
            onClick={() => setShowAddForm(true)}
            className="add-skill-button"
          >
            ➕ Add New Skill
          </button>
          <button 
            onClick={initializePredefinedSkills}
            className="initialize-button"
          >
            🔧 Initialize Predefined Skills
          </button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="stats-cards">
        <div className="stat-card total">
          <div className="stat-number">{skills.length}</div>
          <div className="stat-label">Total Skills</div>
        </div>
        <div className="stat-card active">
          <div className="stat-number">{skills.filter(s => s.isActive).length}</div>
          <div className="stat-label">Active Skills</div>
        </div>
        <div className="stat-card verified">
          <div className="stat-number">{skills.filter(s => s.requiresVerification).length}</div>
          <div className="stat-label">Require Verification</div>
        </div>
        <div className="stat-card consultants">
          <div className="stat-number">{skills.reduce((sum, s) => sum + (s.consultantCount || 0), 0)}</div>
          <div className="stat-label">Total Assignments</div>
        </div>
      </div>

      {/* Category Breakdown */}
      <div className="category-breakdown">
        <h3>Skills by Category</h3>
        <div className="category-cards">
          {Object.entries(SKILL_CATEGORIES).map(([key, label]) => (
            <div key={key} className="category-card">
              <div className="category-name">{label}</div>
              <div className="category-count">{skillCategoryCounts[key as SkillCategory] || 0} skills</div>
            </div>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="filters">
        <div className="search-box">
          <input
            type="text"
            placeholder="Search skills by name or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <span className="search-icon">🔍</span>
        </div>
        
        <div className="filter-group">
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

        <div className="filter-group">
          <select 
            value={filterStatus} 
            onChange={(e) => setFilterStatus(e.target.value as 'all' | 'active' | 'inactive')}
          >
            <option value="all">All Status</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
          </select>
        </div>
      </div>

      {/* Add/Edit Form Modal */}
      {showAddForm && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>{editingSkill ? 'Edit Skill' : 'Add New Skill'}</h3>
              <button onClick={resetForm} className="close-button">✕</button>
            </div>
            
            <form onSubmit={handleFormSubmit} className="skill-form">
              <div className="form-group">
                <label>Skill Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  placeholder="e.g., Arabic Speaker, Real Estate Expert"
                />
              </div>

              <div className="form-group">
                <label>Category *</label>
                <select
                  required
                  value={formData.category}
                  onChange={(e) => setFormData({...formData, category: e.target.value as SkillCategory})}
                >
                  {Object.entries(SKILL_CATEGORIES).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  placeholder="Describe what this skill entails..."
                  rows={3}
                />
              </div>

              <div className="form-group checkbox-group">
                <label>
                  <input
                    type="checkbox"
                    checked={formData.requiresVerification}
                    onChange={(e) => setFormData({...formData, requiresVerification: e.target.checked})}
                  />
                  Requires Verification
                </label>
                <small>Check if this skill needs admin verification before activation</small>
              </div>

              <div className="form-group checkbox-group">
                <label>
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({...formData, isActive: e.target.checked})}
                  />
                  Active
                </label>
                <small>Active skills are available for consultant assignment</small>
              </div>

              <div className="form-actions">
                <button type="button" onClick={resetForm} className="cancel-button">
                  Cancel
                </button>
                <button type="submit" className="save-button">
                  {editingSkill ? 'Update Skill' : 'Create Skill'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Skills List */}
      <div className="skills-list">
        <div className="list-header">
          <h3>Skills ({filteredSkills.length})</h3>
        </div>
        
        {filteredSkills.length === 0 ? (
          <div className="empty-state">
            <p>No skills match your current filters.</p>
            {skills.length === 0 && (
              <button onClick={initializePredefinedSkills} className="initialize-button">
                Initialize with Predefined Skills
              </button>
            )}
          </div>
        ) : (
          <div className="skills-grid">
            {filteredSkills.map(skill => (
              <div key={skill.id} className={`skill-card ${!skill.isActive ? 'inactive' : ''}`}>
                <div className="skill-header">
                  <div className="skill-title">
                    <h4>{skill.name}</h4>
                    <span className={`status-badge ${skill.isActive ? 'active' : 'inactive'}`}>
                      {skill.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div className="skill-category">
                    {SKILL_CATEGORIES[skill.category]}
                  </div>
                </div>

                {skill.description && (
                  <p className="skill-description">{skill.description}</p>
                )}

                <div className="skill-stats">
                  <div className="stat-item">
                    <span className="stat-icon">👥</span>
                    <span>{skill.consultantCount || 0} consultants</span>
                  </div>
                  {skill.requiresVerification && (
                    <div className="stat-item">
                      <span className="stat-icon">🔍</span>
                      <span>Requires verification</span>
                    </div>
                  )}
                  {skill.demandScore && (
                    <div className="stat-item">
                      <span className="stat-icon">📊</span>
                      <span>Demand: {skill.demandScore}</span>
                    </div>
                  )}
                </div>

                <div className="skill-meta">
                  <div className="meta-item">
                    <small>Created: {new Date(skill.createdAt).toLocaleDateString()}</small>
                  </div>
                  <div className="meta-item">
                    <small>Updated: {new Date(skill.updatedAt).toLocaleDateString()}</small>
                  </div>
                </div>

                <div className="skill-actions">
                  <button 
                    onClick={() => handleEdit(skill)}
                    className="edit-button"
                  >
                    ✏️ Edit
                  </button>
                  {skill.isActive ? (
                    <button 
                      onClick={() => handleDeactivate(skill.id)}
                      className="deactivate-button"
                    >
                      🚫 Deactivate
                    </button>
                  ) : (
                    <button 
                      onClick={() => handleEdit(skill)}
                      className="activate-button"
                    >
                      ✅ Activate
                    </button>
                  )}
                  <button 
                    onClick={() => handleDelete(skill.id)}
                    className="delete-button"
                  >
                    🗑️ Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
};

export default SkillsDatabaseManagement;