import axios from 'axios';
import { Consultant, Assignment, AssignmentStats, Lead } from '../types';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

const api = axios.create({
  baseURL: API_BASE_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const authAPI = {
  login: async (username: string, password: string) => {
    const response = await api.post('/auth/login', { username, password });
    return response.data;
  },
  
  register: async (userData: {
    username: string;
    email: string;
    password: string;
    role: string;
    firstName: string;
    lastName: string;
  }) => {
    const response = await api.post('/auth/register', userData);
    return response.data;
  },
  
  getProfile: async () => {
    const response = await api.get('/auth/profile');
    return response.data;
  },

  getUsers: async () => {
    const response = await api.get('/auth/users');
    return response.data;
  },

  updateUser: async (id: number, userData: {
    username: string;
    email: string;
    role: string;
    firstName: string;
    lastName: string;
  }) => {
    const response = await api.put(`/auth/users/${id}`, userData);
    return response.data;
  },

  deleteUser: async (id: number) => {
    const response = await api.delete(`/auth/users/${id}`);
    return response.data;
  },
};

export const consultantAPI = {
  getAll: async (): Promise<Consultant[]> => {
    const response = await api.get('/consultants');
    return response.data;
  },
  
  getActive: async (): Promise<Consultant[]> => {
    const response = await api.get('/consultants/active');
    return response.data;
  },
  
  getById: async (id: number): Promise<Consultant> => {
    const response = await api.get(`/consultants/${id}`);
    return response.data;
  },
  
  create: async (consultant: Omit<Consultant, 'id' | 'created_at' | 'updated_at' | 'is_active'>) => {
    const response = await api.post('/consultants', consultant);
    return response.data;
  },
  
  update: async (id: number, consultant: Partial<Consultant>) => {
    const response = await api.put(`/consultants/${id}`, consultant);
    return response.data;
  },
  
  delete: async (id: number) => {
    const response = await api.delete(`/consultants/${id}`);
    return response.data;
  },
};

export const assignmentAPI = {
  getNext: async (leadData?: { leadId?: string; leadName?: string }) => {
    const response = await api.post('/assignments/next', leadData);
    return response.data;
  },

  assignBlind: async (leadData: { 
    leadId: string; 
    leadName: string; 
    excludeConsultants?: string[];
    isReassignment?: boolean;
    originalAssignmentId?: string;
    originalConsultantId?: string;
    reassignmentReason?: string;
  }) => {
    const response = await api.post('/assignments/next', leadData);
    return response.data;
  },
  
  getMy: async (): Promise<Assignment[]> => {
    const response = await api.get('/assignments/my');
    return response.data;
  },
  
  getMyLatest: async (): Promise<Assignment> => {
    const response = await api.get('/assignments/my/latest');
    return response.data;
  },
  
  getAll: async (): Promise<Assignment[]> => {
    const response = await api.get('/assignments');
    return response.data;
  },
  
  updateStatus: async (id: number, status: string) => {
    const response = await api.put(`/assignments/${id}/status`, { status });
    return response.data;
  },
  
  getStats: async (): Promise<AssignmentStats[]> => {
    const response = await api.get('/assignments/stats');
    return response.data;
  },

  getAnalytics: async (timeframe: string = '7d') => {
    const response = await api.get(`/assignments/analytics?timeframe=${timeframe}`);
    return response.data;
  },

  getFairnessReport: async () => {
    const response = await api.get('/assignments/fairness');
    return response.data;
  },

  getAuditLogs: async (filters: any = {}) => {
    const params = new URLSearchParams();
    Object.keys(filters).forEach(key => {
      if (filters[key]) params.append(key, filters[key]);
    });
    const response = await api.get(`/assignments/audit-logs?${params}`);
    return response.data;
  },

  forceRebalance: async (reason?: string) => {
    const response = await api.post('/assignments/rebalance', { reason });
    return response.data;
  },

  createManual: async (assignmentData: {
    leadId: string;
    leadName: string;
    consultantId: number;
    reason: string;
  }) => {
    const response = await api.post('/assignments/manual', assignmentData);
    return response.data;
  },

  getChartAnalytics: async () => {
    const response = await api.get('/assignments/chart-analytics');
    return response.data;
  },

  createManagerOverride: async (overrideData: {
    leadId: string;
    leadName: string;
    consultantId: number;
    reason: string;
    overrideType?: string;
  }) => {
    const response = await api.post('/assignments/manager-override', overrideData);
    return response.data;
  },

  deleteAssignment: async (id: number, reason: string, rebalanceQueue: boolean = true) => {
    const response = await api.delete(`/assignments/${id}`, {
      data: { reason, rebalanceQueue }
    });
    return response.data;
  },

  cancelAssignment: async (id: number, reason: string, reassignImmediately: boolean = false) => {
    const response = await api.put(`/assignments/${id}/cancel`, {
      reason,
      reassignImmediately
    });
    return response.data;
  },
};

export const leadAPI = {
  getAll: async (): Promise<Lead[]> => {
    const response = await api.get('/leads');
    return response.data;
  },
  
  getQualified: async (): Promise<Lead[]> => {
    const response = await api.get('/leads/qualified');
    return response.data;
  },
  
  getMy: async (): Promise<Lead[]> => {
    const response = await api.get('/leads/my');
    return response.data;
  },
  
  create: async (leadData: Omit<Lead, 'id' | 'created_at' | 'updated_at'>) => {
    const response = await api.post('/leads', leadData);
    return response.data;
  },
  
  update: async (id: number, leadData: Partial<Lead>) => {
    const response = await api.put(`/leads/${id}`, leadData);
    return response.data;
  },
  
  delete: async (id: number) => {
    const response = await api.delete(`/leads/${id}`);
    return response.data;
  },
};

export default api;