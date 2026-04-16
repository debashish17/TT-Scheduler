/**
 * Custom React Hooks for API and Job Management
 * Provides easy-to-use hooks for interacting with the backend
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../api/client';
import wsClient from '../api/websocket';
import toast from 'react-hot-toast';

/**
 * Hook for tracking background job progress with WebSocket
 * @param {string} jobId - Job ID to track
 * @param {Object} options - Hook options
 * @returns {Object} Job status and control functions
 */
export const useJobProgress = (jobId: any, options: any = {}) => {
  const {
    onProgress = null,
    onSuccess = null,
    onError = null,
    autoConnect = true,
    pollInterval = 2000, // Fallback to polling if WebSocket fails
  } = options;

  const [status, setStatus] = useState({
    state: 'PENDING',
    progress: 0,
    currentStep: null,
    message: '',
    result: null,
    error: null,
  });

  const [isConnected, setIsConnected] = useState(false);
  const pollIntervalRef = useRef(null);
  const wsConnectedRef = useRef(false);

  // WebSocket callbacks
  const wsCallbacks = {
    onConnect: () => {
      setIsConnected(true);
      wsConnectedRef.current = true;
      // Stop polling when WebSocket connects
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    },

    onDisconnect: () => {
      setIsConnected(false);
      wsConnectedRef.current = false;
      // Fallback to polling if WebSocket disconnects
      if (status.state !== 'SUCCESS' && status.state !== 'FAILURE') {
        startPolling();
      }
    },

    onUpdate: (data) => {
      setStatus({
        state: data.status,
        progress: data.progress_percentage || 0,
        currentStep: data.current_step_name || data.current_step,
        message: data.message || '',
        result: data.result || null,
        error: data.error || null,
      });
    },

    onProgress: (data) => {
      if (onProgress) onProgress(data);
    },

    onSuccess: (data) => {
      if (onSuccess) onSuccess(data);
      toast.success('Job completed successfully!');
    },

    onError: (data) => {
      if (onError) onError(data);
      toast.error(`Job failed: ${data.error || 'Unknown error'}`);
    },
  };

  // Polling fallback function
  const pollJobStatus = useCallback(async () => {
    if (wsConnectedRef.current) return; // Skip if WebSocket is active

    try {
      const response = await api.jobs.getStatus(jobId);
      const data = response.data;

      setStatus({
        state: data.status,
        progress: data.progress_percentage || 0,
        currentStep: data.current_step_name || data.current_step,
        message: data.message || '',
        result: data.result || null,
        error: data.error || null,
      });

      // Stop polling if job is complete
      if (data.status === 'SUCCESS' || data.status === 'FAILURE') {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }

        if (data.status === 'SUCCESS' && onSuccess) {
          onSuccess(data);
        } else if (data.status === 'FAILURE' && onError) {
          onError(data);
        }
      }
    } catch (error) {
      console.error('Failed to poll job status:', error);
    }
  }, [jobId, onSuccess, onError]);

  // Start polling
  const startPolling = useCallback(() => {
    if (pollIntervalRef.current) return; // Already polling

    pollIntervalRef.current = setInterval(pollJobStatus, pollInterval);
    // Poll immediately
    pollJobStatus();
  }, [pollJobStatus, pollInterval]);

  // Connect to job updates
  useEffect(() => {
    if (!jobId || !autoConnect) return;

    // Try WebSocket first
    try {
      wsClient.connectToJob(jobId, wsCallbacks);
    } catch (error) {
      console.warn('WebSocket connection failed, falling back to polling:', error);
      startPolling();
    }

    // Cleanup
    return () => {
      wsClient.disconnect(jobId);
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [jobId, autoConnect]);

  // Control functions
  const cancel = async () => {
    try {
      await api.jobs.cancel(jobId);
      toast.success('Job cancelled');
      wsClient.disconnect(jobId);
    } catch (error) {
      toast.error('Failed to cancel job');
      throw error;
    }
  };

  const retry = async () => {
    try {
      const response = await api.jobs.retry(jobId);
      toast.success('Job retry requested');
      return response.data;
    } catch (error) {
      toast.error('Failed to retry job');
      throw error;
    }
  };

  return {
    status,
    isConnected,
    cancel,
    retry,
    isComplete: status.state === 'SUCCESS' || status.state === 'FAILURE',
    isSuccess: status.state === 'SUCCESS',
    isFailure: status.state === 'FAILURE',
    isRunning: status.state === 'PROGRESS' || status.state === 'STARTED',
  };
};

/**
 * Hook for async data fetching with loading and error states
 * @param {Function} fetchFn - Async function to fetch data
 * @param {Array} deps - Dependencies to trigger refetch
 * @returns {Object} Data, loading, and error states
 */
export const useAsync = (fetchFn, deps = []) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const execute = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await fetchFn();
      setData(result.data);
    } catch (err) {
      setError(err);
      console.error('useAsync error:', err);
    } finally {
      setLoading(false);
    }
  }, deps);

  useEffect(() => {
    execute();
  }, [execute]);

  return { data, loading, error, refetch: execute };
};

/**
 * Hook for paginated data fetching
 * @param {Function} fetchFn - Fetch function that accepts skip and limit
 * @param {number} pageSize - Items per page
 * @returns {Object} Pagination state and controls
 */
export const usePagination = (fetchFn, pageSize = 20) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [data, setData] = useState([]);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchPage = useCallback(
    async (page) => {
      setLoading(true);
      setError(null);

      try {
        const skip = (page - 1) * pageSize;
        const response = await fetchFn(skip, pageSize);
        setData(response.data);
        setTotalItems(response.data.total || response.data.length);
        setCurrentPage(page);
      } catch (err) {
        setError(err);
        console.error('Pagination error:', err);
      } finally {
        setLoading(false);
      }
    },
    [fetchFn, pageSize]
  );

  useEffect(() => {
    fetchPage(1);
  }, [fetchFn]);

  const totalPages = Math.ceil(totalItems / pageSize);

  return {
    data,
    loading,
    error,
    currentPage,
    totalPages,
    totalItems,
    nextPage: () => fetchPage(Math.min(currentPage + 1, totalPages)),
    prevPage: () => fetchPage(Math.max(currentPage - 1, 1)),
    goToPage: fetchPage,
    refetch: () => fetchPage(currentPage),
  };
};

/**
 * Hook for file upload with progress tracking
 * @returns {Object} Upload function and state
 */
export const useFileUpload = () => {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);

  const upload = async (uploadFn, file) => {
    setUploading(true);
    setProgress(0);
    setError(null);

    try {
      const response = await uploadFn(file, (progressEvent) => {
        const percentCompleted = Math.round(
          (progressEvent.loaded * 100) / progressEvent.total
        );
        setProgress(percentCompleted);
      });

      setProgress(100);
      return response.data;
    } catch (err) {
      setError(err);
      toast.error('Upload failed');
      throw err;
    } finally {
      setUploading(false);
    }
  };

  return { upload, uploading, progress, error };
};

/**
 * Hook for debounced value (useful for search inputs)
 * @param {any} value - Value to debounce
 * @param {number} delay - Delay in milliseconds
 * @returns {any} Debounced value
 */
export const useDebounce = (value, delay = 500) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
};

/**
 * Hook for local storage state management
 * @param {string} key - Storage key
 * @param {any} initialValue - Initial value
 * @returns {Array} [value, setValue]
 */
export const useLocalStorage = (key, initialValue) => {
  const [storedValue, setStoredValue] = useState(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error('Error reading from localStorage:', error);
      return initialValue;
    }
  });

  const setValue = (value) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.error('Error writing to localStorage:', error);
    }
  };

  return [storedValue, setValue];
};

/**
 * Hook for managing form state
 * @param {Object} initialValues - Initial form values
 * @param {Function} onSubmit - Submit handler
 * @returns {Object} Form state and handlers
 */
export const useForm = <T extends Record<string, any>>(initialValues: T, onSubmit: (values: T) => Promise<void> | void) => {
  const [values, setValues] = useState<T>(initialValues);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setValues((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));

    // Clear error for this field
    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setIsSubmitting(true);
    setErrors({});

    try {
      await onSubmit(values);
    } catch (error: any) {
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setValues(initialValues);
    setErrors({});
    setIsSubmitting(false);
  };

  return {
    values,
    errors,
    isSubmitting,
    handleChange,
    handleSubmit,
    resetForm,
    setValues,
    setErrors,
  };
};

export default {
  useJobProgress,
  useAsync,
  usePagination,
  useFileUpload,
  useDebounce,
  useLocalStorage,
  useForm,
};