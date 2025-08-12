export interface User {
  id: number;
  username: string;
  email: string;
  role: 'sdr' | 'admin';
  firstName: string;
  lastName: string;
}

export interface Consultant {
  id: number;
  name: string;
  email: string;
  phone?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  assignment_count?: number;
}

export interface Lead {
  id: number;
  salesforce_lead_id?: string;
  sdr_id: number;
  company_name: string;
  contact_name: string;
  contact_email?: string;
  contact_phone?: string;
  lead_source?: string;
  industry?: string;
  estimated_value?: number;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'new' | 'qualified' | 'assigned' | 'in_consultation' | 'completed' | 'lost';
  notes?: string;
  created_at: string;
  updated_at: string;
  sdr_username?: string;
  sdr_first_name?: string;
  sdr_last_name?: string;
}

export interface Assignment {
  id: number;
  lead_id: number;
  consultant_id: number;
  assigned_at: string;
  status: 'active' | 'completed' | 'cancelled';
  consultant_name?: string;
  consultant_email?: string;
  consultant_phone?: string;
  sdr_username?: string;
  sdr_first_name?: string;
  sdr_last_name?: string;
  display_sdr_name?: string;
  display_lead_id?: string;
  display_lead_name?: string;
  is_manual?: boolean;
  manual_reason?: string;
  created_by?: number;
  // Lead information for display
  lead?: Lead;
  company_name?: string;
  contact_name?: string;
  priority?: string;
  // Additional fields for blind assignments
  lead_name?: string;
  lead_identifier?: string;
  sdr_id?: number;
}

export interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  loading: boolean;
}

export interface AssignmentStats {
  name: string;
  email: string;
  assignment_count: number;
  last_assigned_at: string | null;
  total_assignments: number;
  active_assignments: number;
}