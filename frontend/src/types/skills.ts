export interface Skill {
  id: string;
  name: string;
  category: SkillCategory;
  description?: string;
}

export type SkillCategory = 
  | 'language'
  | 'property_type'
  | 'client_type'
  | 'specialization'
  | 'custom';

export interface ConsultantSkill {
  skillId: string;
  consultantId: number;
  proficiencyLevel?: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  certifiedDate?: string;
  isActive: boolean;
}

export interface SkillRequirement {
  skillId: string;
  required: boolean;
  priority: 'low' | 'medium' | 'high' | 'critical';
  customNote?: string;
}

export interface SkillsBasedAssignment {
  requiredSkills: SkillRequirement[];
  matchedSkills: Skill[];
  consultantSkills: ConsultantSkill[];
  matchScore: number;
  fallbackUsed: boolean;
  alternativeConsultants?: Array<{
    consultantId: number;
    consultantName: string;
    matchingSkills: string[];
    matchScore: number;
  }>;
}

// Predefined skill options
export const PREDEFINED_SKILLS: Skill[] = [
  // Language Skills
  {
    id: 'lang_arabic',
    name: 'Arabic Speaker',
    category: 'language',
    description: 'Fluent in Arabic language for Middle Eastern clients'
  },
  {
    id: 'lang_english_only',
    name: 'English Only',
    category: 'language',
    description: 'English-speaking clients preferred'
  },
  {
    id: 'lang_spanish',
    name: 'Spanish Speaker',
    category: 'language',
    description: 'Fluent in Spanish for Hispanic clients'
  },
  {
    id: 'lang_mandarin',
    name: 'Mandarin Speaker',
    category: 'language',
    description: 'Fluent in Mandarin for Chinese clients'
  },

  // Property Type Specializations
  {
    id: 'prop_residential',
    name: 'Residential Properties',
    category: 'property_type',
    description: 'Specializes in residential real estate'
  },
  {
    id: 'prop_commercial',
    name: 'Commercial Properties',
    category: 'property_type',
    description: 'Specializes in commercial real estate transactions'
  },
  {
    id: 'prop_luxury',
    name: 'Luxury Properties',
    category: 'property_type',
    description: 'Specializes in luxury and high-end properties'
  },
  {
    id: 'prop_industrial',
    name: 'Industrial Properties',
    category: 'property_type',
    description: 'Specializes in industrial and warehouse properties'
  },

  // Client Type Specializations
  {
    id: 'client_first_time',
    name: 'First-Time Buyers',
    category: 'client_type',
    description: 'Experienced with first-time home buyers'
  },
  {
    id: 'client_investors',
    name: 'Real Estate Investors',
    category: 'client_type',
    description: 'Specializes in working with property investors'
  },
  {
    id: 'client_relocating',
    name: 'Relocating Clients',
    category: 'client_type',
    description: 'Helps clients relocating from other areas'
  },
  {
    id: 'client_seniors',
    name: 'Senior Citizens',
    category: 'client_type',
    description: 'Experienced with senior citizen clients'
  },

  // Specialized Services
  {
    id: 'spec_foreclosure',
    name: 'Foreclosure Specialist',
    category: 'specialization',
    description: 'Specializes in foreclosure and distressed properties'
  },
  {
    id: 'spec_new_construction',
    name: 'New Construction',
    category: 'specialization',
    description: 'Specializes in new construction properties'
  },
  {
    id: 'spec_short_sale',
    name: 'Short Sale Specialist',
    category: 'specialization',
    description: 'Experienced in short sale transactions'
  },
  {
    id: 'spec_international',
    name: 'International Clients',
    category: 'specialization',
    description: 'Experienced with international buyers and sellers'
  },
  {
    id: 'spec_lease_option',
    name: 'Lease-to-Own',
    category: 'specialization',
    description: 'Specializes in lease-to-own arrangements'
  }
];

export const SKILL_CATEGORIES: Record<SkillCategory, string> = {
  language: 'Language Requirements',
  property_type: 'Property Type Specialization',
  client_type: 'Client Type Specialization',
  specialization: 'Special Services',
  custom: 'Custom Requirements'
};

// Extended interfaces for admin management
export interface ConsultantSkillManagement extends ConsultantSkill {
  id?: number;
  skillName?: string;
  skillCategory?: SkillCategory;
  verificationStatus: 'pending' | 'verified' | 'rejected' | 'expired';
  certifiedBy?: string;
  verifiedDate?: string;
  expirationDate?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SkillManagement extends Skill {
  isActive: boolean;
  requiresVerification: boolean;
  createdBy: number;
  createdAt: string;
  updatedAt: string;
  consultantCount?: number;
  demandScore?: number;
}

export interface SkillAssignmentHistory {
  id: number;
  consultantId: number;
  consultantName: string;
  skillId: string;
  skillName: string;
  action: 'added' | 'removed' | 'verified' | 'expired';
  performedBy: number;
  performedByName: string;
  timestamp: string;
  notes?: string;
}

export interface SkillAnalytics {
  skillId: string;
  skillName: string;
  category: SkillCategory;
  consultantCount: number;
  demandCount: number;
  assignmentSuccessRate: number;
  averageMatchScore: number;
  utilizationRate: number;
  trendData: Array<{
    date: string;
    demand: number;
    availability: number;
    successRate: number;
  }>;
}

export interface BulkSkillOperation {
  consultantIds: number[];
  skillIds: string[];
  action: 'add' | 'remove' | 'verify';
  verificationStatus?: ConsultantSkillManagement['verificationStatus'];
  notes?: string;
  expirationDate?: string;
}

export interface SkillDemandData {
  skillId: string;
  skillName: string;
  category: SkillCategory;
  totalDemand: number;
  availableConsultants: number;
  gapAnalysis: number;
  averageWaitTime: number;
  priorityLevel: 'low' | 'medium' | 'high' | 'critical';
}

export const getSkillsByCategory = (): Record<SkillCategory, Skill[]> => {
  return PREDEFINED_SKILLS.reduce((acc, skill) => {
    if (!acc[skill.category]) {
      acc[skill.category] = [];
    }
    acc[skill.category].push(skill);
    return acc;
  }, {} as Record<SkillCategory, Skill[]>);
};