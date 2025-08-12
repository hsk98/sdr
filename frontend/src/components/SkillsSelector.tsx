import React, { useState, useEffect, useCallback } from 'react';
import { 
  Skill, 
  SkillRequirement, 
  SkillCategory,
  PREDEFINED_SKILLS, 
  SKILL_CATEGORIES,
  getSkillsByCategory 
} from '../types/skills';
import '../styles/skills-selector.css';

interface SkillsSelectorProps {
  selectedSkills: SkillRequirement[];
  onSkillsChange: (skills: SkillRequirement[]) => void;
  onValidationChange?: (isValid: boolean, warnings: string[]) => void;
  disabled?: boolean;
  showAvailability?: boolean;
}

const SkillsSelector: React.FC<SkillsSelectorProps> = ({
  selectedSkills,
  onSkillsChange,
  onValidationChange,
  disabled = false,
  showAvailability = true
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [customSkill, setCustomSkill] = useState('');
  const [skillAvailability, setSkillAvailability] = useState<Record<string, number>>({});
  const [skillsByCategory] = useState(() => getSkillsByCategory());

  // Load skill availability on mount
  useEffect(() => {
    if (showAvailability) {
      loadSkillAvailability();
    }
  }, [showAvailability]);

  const loadSkillAvailability = async () => {
    try {
      const response = await fetch('/api/consultants/skill-availability');
      if (response.ok) {
        const availability = await response.json();
        setSkillAvailability(availability);
      }
    } catch (error) {
      console.warn('[SkillsSelector] Could not load skill availability:', error);
    }
  };

  // Handle skill selection
  const handleSkillToggle = useCallback((skill: Skill) => {
    const existingIndex = selectedSkills.findIndex(s => s.skillId === skill.id);
    
    if (existingIndex >= 0) {
      // Remove skill
      const updatedSkills = selectedSkills.filter((_, index) => index !== existingIndex);
      onSkillsChange(updatedSkills);
    } else {
      // Add skill with default medium priority
      const newSkill: SkillRequirement = {
        skillId: skill.id,
        required: true,
        priority: 'medium'
      };
      onSkillsChange([...selectedSkills, newSkill]);
    }
  }, [selectedSkills, onSkillsChange]);

  // Handle priority change
  const handlePriorityChange = useCallback((skillId: string, priority: SkillRequirement['priority']) => {
    const updatedSkills = selectedSkills.map(skill =>
      skill.skillId === skillId ? { ...skill, priority } : skill
    );
    onSkillsChange(updatedSkills);
  }, [selectedSkills, onSkillsChange]);

  // Handle custom skill
  const handleCustomSkillAdd = useCallback(() => {
    if (!customSkill.trim()) return;

    const customSkillObj: SkillRequirement = {
      skillId: `custom_${Date.now()}`,
      required: true,
      priority: 'medium',
      customNote: customSkill.trim()
    };

    onSkillsChange([...selectedSkills, customSkillObj]);
    setCustomSkill('');
  }, [customSkill, selectedSkills, onSkillsChange]);

  // Remove skill
  const handleRemoveSkill = useCallback((skillId: string) => {
    const updatedSkills = selectedSkills.filter(skill => skill.skillId !== skillId);
    onSkillsChange(updatedSkills);
  }, [selectedSkills, onSkillsChange]);

  // Get skill name by ID
  const getSkillName = useCallback((skillId: string) => {
    const predefinedSkill = PREDEFINED_SKILLS.find(s => s.id === skillId);
    if (predefinedSkill) return predefinedSkill.name;
    
    const customSkill = selectedSkills.find(s => s.skillId === skillId);
    return customSkill?.customNote || 'Unknown Skill';
  }, [selectedSkills]);

  // Get availability count for skill
  const getAvailabilityCount = (skillId: string) => {
    return skillAvailability[skillId] || 0;
  };

  // Get availability status styling
  const getAvailabilityStatus = (count: number) => {
    if (count === 0) return 'unavailable';
    if (count <= 2) return 'limited';
    return 'available';
  };

  const renderSkillsByCategory = (category: SkillCategory, skills: Skill[]) => (
    <div key={category} className="skill-category">
      <h4 className="skill-category-title">{SKILL_CATEGORIES[category]}</h4>
      <div className="skills-grid">
        {skills.map(skill => {
          const isSelected = selectedSkills.some(s => s.skillId === skill.id);
          const availabilityCount = getAvailabilityCount(skill.id);
          const availabilityStatus = getAvailabilityStatus(availabilityCount);

          return (
            <div
              key={skill.id}
              className={`skill-option ${isSelected ? 'selected' : ''} ${availabilityStatus}`}
              onClick={() => !disabled && handleSkillToggle(skill)}
            >
              <div className="skill-content">
                <div className="skill-name">{skill.name}</div>
                {showAvailability && (
                  <div className={`availability-badge ${availabilityStatus}`}>
                    {availabilityCount} available
                  </div>
                )}
              </div>
              {skill.description && (
                <div className="skill-description">{skill.description}</div>
              )}
              {isSelected && (
                <div className="skill-priority-selector" onClick={(e) => e.stopPropagation()}>
                  <label>Priority:</label>
                  <select
                    value={selectedSkills.find(s => s.skillId === skill.id)?.priority || 'medium'}
                    onChange={(e) => handlePriorityChange(skill.id, e.target.value as SkillRequirement['priority'])}
                    disabled={disabled}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="skills-selector">
      <div className="skills-header">
        <label className="skills-label">Special Requirements</label>
        <button
          type="button"
          className={`expand-toggle ${isExpanded ? 'expanded' : ''}`}
          onClick={() => setIsExpanded(!isExpanded)}
          disabled={disabled}
        >
          <span className="toggle-text">
            {selectedSkills.length > 0 
              ? `${selectedSkills.length} requirement${selectedSkills.length !== 1 ? 's' : ''} selected` 
              : 'No special requirements'
            }
          </span>
          <span className="toggle-icon">{isExpanded ? '▲' : '▼'}</span>
        </button>
      </div>

      {/* Selected Skills Summary */}
      {selectedSkills.length > 0 && !isExpanded && (
        <div className="selected-skills-summary">
          {selectedSkills.map(skill => {
            const skillName = getSkillName(skill.skillId);
            return (
              <span key={skill.skillId} className={`skill-chip ${skill.priority}`}>
                {skillName}
                {skill.priority === 'critical' && ' (Critical)'}
                <button
                  type="button"
                  className="skill-remove"
                  onClick={() => handleRemoveSkill(skill.skillId)}
                  disabled={disabled}
                >
                  ×
                </button>
              </span>
            );
          })}
        </div>
      )}

      {/* Expanded Skills Selector */}
      {isExpanded && (
        <div className="skills-expanded">
          <div className="skills-categories">
            {Object.entries(skillsByCategory).map(([category, skills]) =>
              renderSkillsByCategory(category as SkillCategory, skills)
            )}
          </div>

          {/* Custom Skill Input */}
          <div className="custom-skill-section">
            <h4 className="skill-category-title">Custom Requirements</h4>
            <div className="custom-skill-input">
              <input
                type="text"
                value={customSkill}
                onChange={(e) => setCustomSkill(e.target.value)}
                placeholder="Enter custom requirement..."
                disabled={disabled}
                onKeyPress={(e) => e.key === 'Enter' && handleCustomSkillAdd()}
              />
              <button
                type="button"
                onClick={handleCustomSkillAdd}
                disabled={disabled || !customSkill.trim()}
                className="add-custom-btn"
              >
                Add
              </button>
            </div>
          </div>

          {/* Skills Validation Warnings */}
          {selectedSkills.length > 0 && (
            <div className="skills-validation">
              <div className="validation-summary">
                <span className="validation-icon">💡</span>
                <span>
                  {selectedSkills.filter(s => s.priority === 'critical').length > 0 && 
                    'Critical requirements may limit available consultants. '
                  }
                  Assignment will prioritize exact skill matches.
                </span>
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
};

export default SkillsSelector;