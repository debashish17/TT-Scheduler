/**
 * API Client for TT-Scheduler Backend
 * Centralized API communication with axios
 */
import axios from 'axios';
import { supabase } from '../lib/supabase';

// API Base Configuration
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const API_VERSION = '/api/v1';

// Create axios instance
const apiClient = axios.create({
  baseURL: `${API_BASE_URL}${API_VERSION}`,
  timeout: 90000, // 90 seconds (CP-SAT solver can take up to 60s)
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for adding auth token
apiClient.interceptors.request.use(
  async (config) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        config.headers.Authorization = `Bearer ${session.access_token}`;
      } else {
        // Fallback to legacy auth_token
        const token = localStorage.getItem('auth_token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
      }
    } catch (e) {
      console.error('Error getting session for API request:', e);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      // Server responded with error status
      const { status, data } = error.response;

      switch (status) {
        case 401:
          // Unauthorized - clear token
          localStorage.removeItem('auth_token');
          Object.keys(localStorage).forEach(key => {
            if (key.startsWith('sb-') && key.endsWith('-auth-token')) {
              localStorage.removeItem(key);
            }
          });
          console.warn('Authentication token missing or invalid');
          window.location.href = '/login';
          break;
        case 403:
          // Forbidden
          console.error('Access forbidden:', data.detail);
          break;
        case 404:
          // Not found
          console.error('Resource not found:', data.detail);
          break;
        case 500:
          // Server error
          console.error('Server error:', data.detail);
          break;
        default:
          console.error('API error:', data.detail || error.message);
      }
    } else if (error.request) {
      // Request made but no response - backend likely not running
      // This is expected in offline mode, so don't log as error
      console.log('Backend not available - this is normal for offline testing');
    } else {
      // Something else happened
      console.error('Error:', error.message);
    }

    return Promise.reject(error);
  }
);

// Export axios instance for custom requests
export { apiClient };

// ============================================
// SCHOOL TIMETABLE
// ============================================
export const schoolAPI = {
  /** Generate a school timetable. Auto-saves on success; returns { run_id, ...result }. */
  generate: (data: any) =>
    apiClient.post('/school/generate', data, { timeout: 180000 }),

  /** List the user's saved school runs (summary). */
  listRuns: () => apiClient.get('/school/runs'),

  /** Load a specific school run as a wizard-shaped payload (for Duplicate flow). */
  getRun: (id: string) => apiClient.get(`/school/runs/${id}`),

  /** Load a saved run's full solver result for the /timetable view (for Load flow). */
  getRunResult: (id: string) => apiClient.get(`/school/runs/${id}/result`),

  /** Delete a school run. */
  deleteRun: (id: string) => apiClient.delete(`/school/runs/${id}`),

  /** Compute analytics from a school timetable result. */
  getAnalytics: (resultData: any) => apiClient.post('/school/analytics', resultData),

  /** Export a school timetable as .xlsx. */
  exportExcel: (resultData: any) =>
    apiClient.post('/school/export/excel', resultData, { responseType: 'blob' }),
};

// ============================================
// COLLEGE TIMETABLE
// ============================================
export const collegeAPI = {
  generate: (data: any) =>
    apiClient.post('/college/generate', data, { timeout: 300000 }),

  listRuns: () => apiClient.get('/college/runs'),
  getRun: (id: string) => apiClient.get(`/college/runs/${id}`),
  getRunResult: (id: string) => apiClient.get(`/college/runs/${id}/result`),
  deleteRun: (id: string) => apiClient.delete(`/college/runs/${id}`),

  getAnalytics: (resultData: any) => apiClient.post('/college/analytics', resultData),

  exportExcel: (resultData: any) =>
    apiClient.post('/college/export/excel', resultData, { responseType: 'blob' }),
};

// ============================================
// RUNS — cross-product history list
// ============================================
export const runsAPI = {
  /** List runs across both products. Each row has a `kind` field. */
  list: () => apiClient.get('/runs/'),
};

export const config = {
  API_BASE_URL,
  API_VERSION,
};

export default {
  school:  schoolAPI,
  college: collegeAPI,
  runs:    runsAPI,
};
