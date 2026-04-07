/**
 * API Client for TT-Scheduler Backend
 * Centralized API communication with axios
 */
import axios from 'axios';

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
  (config) => {
    // Get the active session from Supabase
    // VITE_SUPABASE_PROJECT_ID could be useful or simply reading from Supabase client
    const supabaseTokenStr = localStorage.getItem('sb-' + (import.meta.env.VITE_SUPABASE_PROJECT_ID || 'your-project-id') + '-auth-token');
    
    if (supabaseTokenStr) {
      try {
        const authData = JSON.parse(supabaseTokenStr);
        if (authData?.access_token) {
          config.headers.Authorization = `Bearer ${authData.access_token}`;
        }
      } catch(e) {}
    } else {
       // fallback if the user overrides
       const token = localStorage.getItem('auth_token');
       if (token) {
         config.headers.Authorization = `Bearer ${token}`;
       }
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
          // Unauthorized - clear token (no login redirect in simplified app)
          localStorage.removeItem('auth_token');
          console.warn('Authentication token missing or invalid');
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

// ============================================
// INSTITUTION APIs
// ============================================

export const institutionAPI = {
  list: (params) => apiClient.get('/institutions/', { params }),
  get: (id) => apiClient.get(`/institutions/${id}`),
  create: (data) => apiClient.post('/institutions/', data),
  update: (id, data) => apiClient.put(`/institutions/${id}`, data),
  delete: (id) => apiClient.delete(`/institutions/${id}`),
  search: (query) => apiClient.get('/institutions/search', { params: { q: query } }),
  statistics: (id) => apiClient.get(`/institutions/${id}/statistics`),
};

// ============================================
// FACULTY APIs
// ============================================

export const facultyAPI = {
  list: (params) => apiClient.get('/faculty/', { params }),
  get: (id, includeWorkload = false) =>
    apiClient.get(`/faculty/${id}`, { params: { include_workload: includeWorkload } }),
  create: (data) => apiClient.post('/faculty/', data),
  update: (id, data) => apiClient.put(`/faculty/${id}`, data),
  delete: (id, hardDelete = false) =>
    apiClient.delete(`/faculty/${id}`, { params: { hard_delete: hardDelete } }),
  workload: (id) => apiClient.get(`/faculty/${id}/workload`),
  departmentStats: (departmentId) =>
    apiClient.get(`/faculty/stats/department/${departmentId}`),

  // Import/Export
  importExcel: (institutionId, file, onUploadProgress) => {
    const formData = new FormData();
    formData.append('file', file);

    return apiClient.post(`/faculty/import`, formData, {
      params: { institution_id: institutionId },
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress,
    });
  },
  downloadTemplate: () =>
    apiClient.get('/faculty/import/template', { responseType: 'blob' }),
  exportExcel: (params) =>
    apiClient.get('/faculty/export', { params, responseType: 'blob' }),
};

// ============================================
// COURSE APIs
// ============================================

export const courseAPI = {
  list: (params) => apiClient.get('/courses/', { params }),
  get: (id) => apiClient.get(`/courses/${id}`),
  create: (data) => apiClient.post('/courses/', data),
  update: (id, data) => apiClient.put(`/courses/${id}`, data),
  delete: (id) => apiClient.delete(`/courses/${id}`),
};

// ============================================
// ROOM APIs
// ============================================

export const roomAPI = {
  list: (params) => apiClient.get('/rooms/', { params }),
  get: (id) => apiClient.get(`/rooms/${id}`),
  create: (data) => apiClient.post('/rooms/', data),
  update: (id, data) => apiClient.put(`/rooms/${id}`, data),
  delete: (id) => apiClient.delete(`/rooms/${id}`),
};

// ============================================
// TIMETABLE APIs
// ============================================

export const timetableAPI = {
  list: (params) => apiClient.get('/timetables/', { params }),
  get: (id, includeAssignments = true, formatAsGrid = false) =>
    apiClient.get(`/timetables/${id}`, {
      params: { include_assignments: includeAssignments, format_as_grid: formatAsGrid },
    }),
  generate: (data) => apiClient.post('/timetables/generate', data),
  delete: (id, hardDelete = false) =>
    apiClient.delete(`/timetables/${id}`, { params: { hard_delete: hardDelete } }),

  // Analysis and comparison
  compare: (timetableIds, criteria) =>
    apiClient.post('/timetables/compare', { timetable_ids: timetableIds, comparison_criteria: criteria }),
  analytics: (id) => apiClient.get(`/timetables/${id}/analytics`),
  batchView: (timetableId, batchId) =>
    apiClient.get(`/timetables/${timetableId}/batches/${batchId}`),

  // Export
  export: (id, format = 'excel', options = {}) =>
    apiClient.post(
      `/timetables/${id}/export`,
      { timetable_id: id, export_format: format, ...options },
      { responseType: 'blob' }
    ),

  // Optimization
  optimize: (id, mode = 'balanced', timeLimit = 10) =>
    apiClient.post(`/timetables/${id}/optimize`, null, {
      params: { optimization_mode: mode, time_limit_minutes: timeLimit },
    }),
};

// ============================================
// BACKGROUND JOBS APIs
// ============================================

export const jobsAPI = {
  // Job submission
  submitTimetableGeneration: (data, notifyEmail = null) =>
    apiClient.post('/jobs/timetables/generate', data, {
      params: notifyEmail ? { notify_email: notifyEmail } : {},
    }),
  submitTimetableOptimization: (timetableId, params) =>
    apiClient.post(`/jobs/timetables/${timetableId}/optimize`, null, { params }),

  submitFacultyImport: (institutionId, file, notifyEmail = null) => {
    const formData = new FormData();
    formData.append('file', file);

    return apiClient.post(`/jobs/import/faculty`, formData, {
      params: { institution_id: institutionId, notify_email: notifyEmail },
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  submitCourseImport: (institutionId, file) => {
    const formData = new FormData();
    formData.append('file', file);

    return apiClient.post(`/jobs/import/courses`, formData, {
      params: { institution_id: institutionId },
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  submitRoomImport: (institutionId, file) => {
    const formData = new FormData();
    formData.append('file', file);

    return apiClient.post(`/jobs/import/rooms`, formData, {
      params: { institution_id: institutionId },
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  validateImport: (importType, file) => {
    const formData = new FormData();
    formData.append('file', file);

    return apiClient.post(`/jobs/import/validate`, formData, {
      params: { import_type: importType },
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  // Analytics jobs
  submitAnalyticsReport: (institutionId, reportType = 'comprehensive', params = {}) =>
    apiClient.post('/jobs/analytics/report', null, {
      params: { institution_id: institutionId, report_type: reportType, ...params },
    }),

  submitFacultyWorkloadAnalysis: (institutionId, semester = null) =>
    apiClient.post('/jobs/analytics/faculty-workload', null, {
      params: { institution_id: institutionId, semester },
    }),

  submitRoomUtilizationReport: (institutionId, periodDays = 30) =>
    apiClient.post('/jobs/analytics/room-utilization', null, {
      params: { institution_id: institutionId, period_days: periodDays },
    }),

  // Job management
  getStatus: (jobId) => apiClient.get(`/jobs/${jobId}/status`),
  list: (params) => apiClient.get('/jobs', { params }),
  cancel: (jobId) => apiClient.delete(`/jobs/${jobId}`),
  retry: (jobId) => apiClient.post(`/jobs/${jobId}/retry`),

  // Maintenance
  submitCleanup: (daysOld = 30) =>
    apiClient.post('/jobs/maintenance/cleanup', null, {
      params: { days_old: daysOld },
    }),
};

// ============================================
// DEPARTMENT APIs
// ============================================

export const departmentAPI = {
  list: (params) => apiClient.get('/departments/', { params }),
  get: (id) => apiClient.get(`/departments/${id}`),
  create: (data) => apiClient.post('/departments/', data),
  update: (id, data) => apiClient.put(`/departments/${id}`, data),
  delete: (id) => apiClient.delete(`/departments/${id}`),
};

// ============================================
// BATCH APIs
// ============================================

export const batchAPI = {
  list: (params) => apiClient.get('/batches/', { params }),
  get: (id) => apiClient.get(`/batches/${id}`),
  create: (data) => apiClient.post('/batches/', data),
  update: (id, data) => apiClient.put(`/batches/${id}`, data),
  delete: (id) => apiClient.delete(`/batches/${id}`),
};

// Export axios instance for custom requests
export { apiClient };

// Simple timetable generation (no DB setup needed)
export const simpleTimetableAPI = {
  generate: (data) => apiClient.post('/timetable/generate-simple', data, { timeout: 90000 }),

  // Compute analytics from solver result (real data, no DB)
  getAnalytics: (resultData) => apiClient.post('/timetable/analytics', resultData),

  // Export timetable to Excel (.xlsx binary)
  exportExcel: (resultData) =>
    apiClient.post('/timetable/export/excel', resultData, { responseType: 'blob' }),

  // Save generated timetable to Supabase DB
  saveTimetable: (data) => apiClient.post('/timetable/save', data),
};

// Export base URLs for WebSocket and other purposes
export const config = {
  API_BASE_URL,
  API_VERSION,
  WS_BASE_URL: API_BASE_URL.replace('http', 'ws'),
};

export default {
  institution: institutionAPI,
  faculty: facultyAPI,
  course: courseAPI,
  room: roomAPI,
  timetable: timetableAPI,
  simpleTimetable: simpleTimetableAPI,
  jobs: jobsAPI,
  department: departmentAPI,
  batch: batchAPI,
};
