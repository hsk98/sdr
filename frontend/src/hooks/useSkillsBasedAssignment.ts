import { useState, useCallback } from 'react';
import { 
  Skill, 
  SkillRequirement, 
  ConsultantSkill, 
  SkillsBasedAssignment,
  PREDEFINED_SKILLS 
} from '../types/skills';

interface ConsultantWithSkills {
  id: number;
  name: string;
  email: string;
  phone?: string;
  isActive: boolean;
  skills: ConsultantSkill[];
  currentAssignments: number;
  maxAssignments: number;
  lastAssignedAt: string | null;
}

interface SkillMatchResult {
  consultant: ConsultantWithSkills;
  matchingSkills: Skill[];
  matchScore: number;
  isExactMatch: boolean;
  missingSkills: Skill[];
}

export const useSkillsBasedAssignment = () => {
  const [isMatching, setIsMatching] = useState(false);
  const [matchResults, setMatchResults] = useState<SkillMatchResult[]>([]);

  // Calculate match score between required skills and consultant skills
  const calculateMatchScore = useCallback((
    requiredSkills: SkillRequirement[],
    consultantSkills: ConsultantSkill[]
  ): number => {
    if (requiredSkills.length === 0) return 1; // Perfect match if no skills required

    const consultantSkillIds = new Set(consultantSkills.map(cs => cs.skillId));
    let totalScore = 0;
    let maxPossibleScore = 0;

    requiredSkills.forEach(req => {
      // Weight based on priority
      const priorityWeight = {
        'low': 1,
        'medium': 2, 
        'high': 3,
        'critical': 5
      }[req.priority];

      maxPossibleScore += priorityWeight;

      if (consultantSkillIds.has(req.skillId)) {
        totalScore += priorityWeight;
      }
    });

    return maxPossibleScore > 0 ? totalScore / maxPossibleScore : 0;
  }, []);

  // Find consultants that match required skills
  const findMatchingConsultants = useCallback(async (
    requiredSkills: SkillRequirement[],
    excludedConsultants: string[] = []
  ): Promise<SkillMatchResult[]> => {
    setIsMatching(true);
    
    try {
      // Fetch consultants with their skills from API
      const response = await fetch('/api/consultants/with-skills');
      if (!response.ok) {
        throw new Error('Failed to fetch consultants with skills');
      }

      const consultants: ConsultantWithSkills[] = await response.json();
      
      // Filter to active consultants only and exclude specified consultants
      const activeConsultants = consultants.filter(c => 
        c.isActive && 
        c.currentAssignments < c.maxAssignments &&
        !excludedConsultants.includes(c.id.toString()) &&
        !excludedConsultants.includes(c.name)
      );

      const results: SkillMatchResult[] = [];

      for (const consultant of activeConsultants) {
        const matchScore = calculateMatchScore(requiredSkills, consultant.skills);
        
        // Find matching skills
        const consultantSkillIds = new Set(consultant.skills.map(cs => cs.skillId));
        const matchingSkills = PREDEFINED_SKILLS.filter(skill =>
          requiredSkills.some(req => req.skillId === skill.id) &&
          consultantSkillIds.has(skill.id)
        );

        // Find missing critical skills
        const missingSkills = PREDEFINED_SKILLS.filter(skill =>
          requiredSkills.some(req => 
            req.skillId === skill.id && 
            req.priority === 'critical' &&
            !consultantSkillIds.has(skill.id)
          )
        );

        // Check if it's an exact match (all required skills present)
        const isExactMatch = requiredSkills.every(req =>
          consultantSkillIds.has(req.skillId)
        );

        results.push({
          consultant,
          matchingSkills,
          matchScore,
          isExactMatch,
          missingSkills
        });
      }

      // Sort by match score (descending), then by assignment count (ascending)
      results.sort((a, b) => {
        if (a.matchScore !== b.matchScore) {
          return b.matchScore - a.matchScore;
        }
        return a.consultant.currentAssignments - b.consultant.currentAssignments;
      });

      setMatchResults(results);
      return results;

    } catch (error) {
      console.error('[SkillsAssignment] Failed to find matching consultants:', error);
      throw error;
    } finally {
      setIsMatching(false);
    }
  }, [calculateMatchScore]);

  // Perform skills-based assignment
  const assignWithSkills = useCallback(async (
    leadId: string,
    leadName: string,
    requiredSkills: SkillRequirement[],
    excludedConsultants: string[] = []
  ): Promise<{
    success: boolean;
    assignment?: any;
    skillsInfo?: SkillsBasedAssignment;
    error?: string;
    fallbackMessage?: string;
  }> => {
    try {
      // If no skills required, use standard assignment
      if (requiredSkills.length === 0) {
        const response = await fetch('/api/assignments/blind', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ leadId, leadName, excludeConsultants: excludedConsultants })
        });

        if (!response.ok) throw new Error('Standard assignment failed');
        
        const result = await response.json();
        return { success: true, assignment: result };
      }

      // Find matching consultants (excluding specified consultants)
      const matchResults = await findMatchingConsultants(requiredSkills, excludedConsultants);

      // Check for exact matches first
      const exactMatches = matchResults.filter(r => r.isExactMatch);
      
      if (exactMatches.length > 0) {
        // Use best exact match
        const selectedConsultant = exactMatches[0];
        
        const assignmentResponse = await fetch('/api/assignments/skills-based', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            leadId,
            leadName,
            consultantId: selectedConsultant.consultant.id,
            requiredSkills,
            matchScore: selectedConsultant.matchScore,
            matchType: 'exact',
            excludeConsultants: excludedConsultants
          })
        });

        if (!assignmentResponse.ok) throw new Error('Skills-based assignment failed');
        
        const assignment = await assignmentResponse.json();
        
        const skillsInfo: SkillsBasedAssignment = {
          requiredSkills,
          matchedSkills: selectedConsultant.matchingSkills,
          consultantSkills: selectedConsultant.consultant.skills,
          matchScore: selectedConsultant.matchScore,
          fallbackUsed: false,
          alternativeConsultants: matchResults.slice(1, 4).map(r => ({
            consultantId: r.consultant.id,
            consultantName: r.consultant.name,
            matchingSkills: r.matchingSkills.map(s => s.name),
            matchScore: r.matchScore
          }))
        };

        return { success: true, assignment, skillsInfo };
      }

      // No exact matches - check for partial matches
      const partialMatches = matchResults.filter(r => r.matchScore > 0.5);
      
      if (partialMatches.length > 0) {
        // Check if critical skills are missing
        const criticalSkillsMissing = requiredSkills.some(req => 
          req.priority === 'critical' &&
          !partialMatches[0].consultant.skills.some(cs => cs.skillId === req.skillId)
        );

        if (criticalSkillsMissing) {
          const missingCriticalSkills = requiredSkills
            .filter(req => 
              req.priority === 'critical' &&
              !partialMatches[0].consultant.skills.some(cs => cs.skillId === req.skillId)
            )
            .map(req => PREDEFINED_SKILLS.find(s => s.id === req.skillId)?.name)
            .filter(Boolean);

          return {
            success: false,
            error: `No consultants available with required critical skills: ${missingCriticalSkills.join(', ')}`,
            fallbackMessage: 'Consider removing critical skill requirements or contact admin to add skilled consultants.'
          };
        }

        // Use best partial match with fallback warning
        const selectedConsultant = partialMatches[0];
        
        const assignmentResponse = await fetch('/api/assignments/skills-based', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            leadId,
            leadName,
            consultantId: selectedConsultant.consultant.id,
            requiredSkills,
            matchScore: selectedConsultant.matchScore,
            matchType: 'partial',
            excludeConsultants: excludedConsultants
          })
        });

        if (!assignmentResponse.ok) throw new Error('Partial skills-based assignment failed');
        
        const assignment = await assignmentResponse.json();
        
        const skillsInfo: SkillsBasedAssignment = {
          requiredSkills,
          matchedSkills: selectedConsultant.matchingSkills,
          consultantSkills: selectedConsultant.consultant.skills,
          matchScore: selectedConsultant.matchScore,
          fallbackUsed: true,
          alternativeConsultants: partialMatches.slice(1, 4).map(r => ({
            consultantId: r.consultant.id,
            consultantName: r.consultant.name,
            matchingSkills: r.matchingSkills.map(s => s.name),
            matchScore: r.matchScore
          }))
        };

        return { 
          success: true, 
          assignment, 
          skillsInfo,
          fallbackMessage: `Partial skill match (${Math.round(selectedConsultant.matchScore * 100)}%). Some required skills may not be available.`
        };
      }

      // No suitable matches found
      const requiredSkillNames = requiredSkills.map(req =>
        PREDEFINED_SKILLS.find(s => s.id === req.skillId)?.name
      ).filter(Boolean);

      return {
        success: false,
        error: `No consultants available with required skills: ${requiredSkillNames.join(', ')}`,
        fallbackMessage: 'Try removing some skill requirements or use standard assignment without skills filtering.'
      };

    } catch (error) {
      console.error('[SkillsAssignment] Assignment failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Skills-based assignment failed'
      };
    }
  }, [findMatchingConsultants]);

  // Get available consultants for each skill
  const getSkillAvailability = useCallback(async (): Promise<Record<string, number>> => {
    try {
      const response = await fetch('/api/consultants/skill-availability');
      if (!response.ok) throw new Error('Failed to fetch skill availability');
      
      return await response.json();
    } catch (error) {
      console.error('[SkillsAssignment] Failed to get skill availability:', error);
      return {};
    }
  }, []);

  // Validate if skills combination is feasible
  const validateSkillsCombination = useCallback(async (
    requiredSkills: SkillRequirement[]
  ): Promise<{
    isValid: boolean;
    warnings: string[];
    suggestions: string[];
  }> => {
    const warnings: string[] = [];
    const suggestions: string[] = [];

    try {
      const matchResults = await findMatchingConsultants(requiredSkills);
      
      if (matchResults.length === 0) {
        warnings.push('No consultants available with any of the selected skills');
        suggestions.push('Consider reducing skill requirements or using standard assignment');
        return { isValid: false, warnings, suggestions };
      }

      const exactMatches = matchResults.filter(r => r.isExactMatch);
      if (exactMatches.length === 0) {
        warnings.push('No consultants match all required skills exactly');
        suggestions.push('Some skills may be unavailable - assignment will use best partial match');
      }

      const criticalSkills = requiredSkills.filter(r => r.priority === 'critical');
      if (criticalSkills.length > 0) {
        const criticalSkillsAvailable = criticalSkills.every(crit =>
          matchResults.some(r => 
            r.consultant.skills.some(cs => cs.skillId === crit.skillId)
          )
        );
        
        if (!criticalSkillsAvailable) {
          warnings.push('Some critical skills are not available');
          suggestions.push('Consider changing critical skills to high priority');
          return { isValid: false, warnings, suggestions };
        }
      }

      if (matchResults.length < 3) {
        warnings.push('Limited consultant options available for selected skills');
        suggestions.push('Consider broadening skill requirements for more options');
      }

      return { 
        isValid: true, 
        warnings: warnings.length > 0 ? warnings : [], 
        suggestions: suggestions.length > 0 ? suggestions : [] 
      };

    } catch (error) {
      return {
        isValid: false,
        warnings: ['Unable to validate skills combination'],
        suggestions: ['Please try again or contact support']
      };
    }
  }, [findMatchingConsultants]);

  return {
    isMatching,
    matchResults,
    findMatchingConsultants,
    assignWithSkills,
    getSkillAvailability,
    validateSkillsCombination,
    calculateMatchScore
  };
};