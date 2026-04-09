/**
 * Job Management Dashboard
 * Monitor and manage all background jobs with real-time updates
 */
import React, { useState, useEffect } from 'react';
import {
  FiClock,
  FiCheckCircle,
  FiXCircle,
  FiPlay,
  FiPause,
  FiRefreshCw,
  FiTrash2,
  FiDownload,
  FiEye,
  FiFilter,
} from 'react-icons/fi';
import { useAsync, useJobProgress } from '../../hooks/useAPI';
import { useJobStore } from '../../store';
import { formatDate, formatDuration, getStatusColor, truncate } from '../../utils/helpers';
import api from '../../api/client';
import toast from 'react-hot-toast';

const JobDashboard = () => {
  const {
    activeJobs,
    completedJobs,
    failedJobs,
    addJob,
    updateJob,
    completeJob,
    failJob,
    removeJob,
    clearCompletedJobs,
    clearFailedJobs
  } = useJobStore();

  const [filter, setFilter] = useState('all');
  const [selectedJob, setSelectedJob] = useState(null);

  // Fetch job list from server
  const { data: serverJobs, loading, error, refetch } = useAsync(
    () => api.jobs.list({ limit: 100 }),
    []
  );

  // Merge server jobs with local store
  useEffect(() => {
    if (serverJobs?.data?.jobs) {
      serverJobs.data.jobs.forEach(job => {
        const existingJob = [...activeJobs, ...completedJobs, ...failedJobs]
          .find(j => j.job_id === job.job_id);

        if (!existingJob) {
          if (job.status === 'STARTED' || job.status === 'PROGRESS') {
            addJob({
              job_id: job.job_id,
              type: job.job_type,
              status: job.status,
              submitted_at: job.started_at || new Date().toISOString(),
            });
          }
        }
      });
    }
  }, [serverJobs, addJob, activeJobs, completedJobs, failedJobs]);

  // Get filtered jobs
  const getFilteredJobs = () => {
    switch (filter) {
      case 'active':
        return activeJobs;
      case 'completed':
        return completedJobs;
      case 'failed':
        return failedJobs;
      default:
        return [...activeJobs, ...completedJobs, ...failedJobs].sort(
          (a: any, b: any) => (new Date(b.submitted_at || b.completed_at || b.failed_at).getTime()) -
                   (new Date(a.submitted_at || a.completed_at || a.failed_at).getTime())
        );
    }
  };

  const filteredJobs = getFilteredJobs();

  // Cancel job
  const handleCancelJob = async (jobId) => {
    try {
      await api.jobs.cancel(jobId);
      removeJob(jobId);
      toast.success('Job cancelled');
    } catch (error) {
      toast.error('Failed to cancel job');
    }
  };

  // Retry job
  const handleRetryJob = async (jobId) => {
    try {
      const response = await api.jobs.retry(jobId);
      toast.success('Job retry requested');
      // Add new job to active list
      if (response.data.new_job_id) {
        addJob({
          job_id: response.data.new_job_id,
          type: 'retry',
          status: 'PENDING',
          submitted_at: new Date().toISOString(),
        });
      }
    } catch (error) {
      toast.error('Failed to retry job');
    }
  };

  // Get job status indicator
  const getJobStatusIcon = (job) => {
    if (activeJobs.find(j => j.job_id === job.job_id)) {
      return <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600" />;
    }
    if (completedJobs.find(j => j.job_id === job.job_id)) {
      return <FiCheckCircle className="text-green-600 text-xl" />;
    }
    if (failedJobs.find(j => j.job_id === job.job_id)) {
      return <FiXCircle className="text-red-600 text-xl" />;
    }
    return <FiClock className="text-gray-400 text-xl" />;
  };

  // Get job status text
  const getJobStatus = (job) => {
    if (activeJobs.find(j => j.job_id === job.job_id)) return 'RUNNING';
    if (completedJobs.find(j => j.job_id === job.job_id)) return 'COMPLETED';
    if (failedJobs.find(j => j.job_id === job.job_id)) return 'FAILED';
    return 'UNKNOWN';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Job Management</h1>
            <p className="text-gray-600">Monitor and manage background tasks</p>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={refetch}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <FiRefreshCw />
              <span>Refresh</span>
            </button>
            <button
              onClick={clearCompletedJobs}
              className="flex items-center space-x-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <FiTrash2 />
              <span>Clear Completed</span>
            </button>
          </div>
        </div>
      </div>

      <div className="p-6">
        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Active Jobs</p>
                <p className="text-3xl font-bold text-blue-600">{activeJobs.length}</p>
              </div>
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Completed</p>
                <p className="text-3xl font-bold text-green-600">{completedJobs.length}</p>
              </div>
              <FiCheckCircle className="text-green-600 text-2xl" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Failed</p>
                <p className="text-3xl font-bold text-red-600">{failedJobs.length}</p>
              </div>
              <FiXCircle className="text-red-600 text-2xl" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Success Rate</p>
                <p className="text-3xl font-bold text-purple-600">
                  {completedJobs.length + failedJobs.length > 0
                    ? Math.round((completedJobs.length / (completedJobs.length + failedJobs.length)) * 100)
                    : 0}%
                </p>
              </div>
              <FiPlay className="text-purple-600 text-2xl" />
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Job List</h2>
              <div className="flex space-x-2">
                {['all', 'active', 'completed', 'failed'].map((filterOption) => (
                  <button
                    key={filterOption}
                    onClick={() => setFilter(filterOption)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      filter === filterOption
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {filterOption.charAt(0).toUpperCase() + filterOption.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Job Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Job ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Progress
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Started
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Duration
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-4 text-center">
                      Loading jobs...
                    </td>
                  </tr>
                ) : filteredJobs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                      No jobs found
                    </td>
                  </tr>
                ) : (
                  filteredJobs.map((job) => (
                    <JobRow
                      key={job.job_id}
                      job={job}
                      status={getJobStatus(job)}
                      statusIcon={getJobStatusIcon(job)}
                      onCancel={() => handleCancelJob(job.job_id)}
                      onRetry={() => handleRetryJob(job.job_id)}
                      onView={() => setSelectedJob(job)}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Job Details Modal */}
        {selectedJob && (
          <JobDetailsModal
            job={selectedJob}
            onClose={() => setSelectedJob(null)}
          />
        )}
      </div>
    </div>
  );
};

// Job Row Component
const JobRow = ({ job, status, statusIcon, onCancel, onRetry, onView }) => {
  const { status: liveStatus } = useJobProgress(job.job_id, {
    autoConnect: status === 'RUNNING',
  });

  const isActive = status === 'RUNNING';
  const isCompleted = status === 'COMPLETED';
  const isFailed = status === 'FAILED';

  const displayProgress = isActive ? (liveStatus.progress || job.progress || 0) :
                       isCompleted ? 100 : 0;

  const startTime = job.submitted_at || job.started_at || job.completed_at || job.failed_at;
  const endTime = job.completed_at || job.failed_at;
  const duration = endTime ?
    Math.round(((new Date(endTime) as any) - (new Date(startTime) as any)) / 1000) : null;

  return (
    <tr className="hover:bg-gray-50">
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center space-x-3">
          {statusIcon}
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(status)}`}>
            {status}
          </span>
        </div>
      </td>

      <td className="px-6 py-4 whitespace-nowrap">
        <div className="text-sm font-mono text-gray-900">
          {truncate(job.job_id, 16)}
        </div>
      </td>

      <td className="px-6 py-4 whitespace-nowrap">
        <div className="text-sm text-gray-900">
          {job.type?.replace('_', ' ') || 'Unknown'}
        </div>
        {job.semester && (
          <div className="text-sm text-gray-500">{job.semester}</div>
        )}
      </td>

      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center space-x-2">
          <div className="flex-1 bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-300 ${
                isActive ? 'bg-blue-600' : isCompleted ? 'bg-green-600' : 'bg-gray-300'
              }`}
              style={{ width: `${displayProgress}%` }}
            />
          </div>
          <span className="text-sm text-gray-600 w-12">{displayProgress.toFixed(0)}%</span>
        </div>
      </td>

      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        {formatDate(startTime)}
      </td>

      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        {duration ? formatDuration(duration) : isActive ? 'Running...' : '-'}
      </td>

      <td className="px-6 py-4 whitespace-nowrap text-right text-sm space-x-2">
        <button
          onClick={onView}
          className="text-blue-600 hover:text-blue-700"
          title="View Details"
        >
          <FiEye />
        </button>

        {isActive && (
          <button
            onClick={onCancel}
            className="text-red-600 hover:text-red-700"
            title="Cancel Job"
          >
            <FiPause />
          </button>
        )}

        {isFailed && (
          <button
            onClick={onRetry}
            className="text-green-600 hover:text-green-700"
            title="Retry Job"
          >
            <FiRefreshCw />
          </button>
        )}
      </td>
    </tr>
  );
};

// Job Details Modal
const JobDetailsModal = ({ job, onClose }) => {
  const { status: liveStatus } = useJobProgress(job.job_id, {
    autoConnect: true,
  });

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full m-4 max-h-[80vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Job Details</h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              ×
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-500">Job ID</label>
              <p className="mt-1 text-sm font-mono text-gray-900">{job.job_id}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-500">Type</label>
              <p className="mt-1 text-sm text-gray-900">{job.type?.replace('_', ' ')}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-500">Status</label>
              <p className="mt-1">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(liveStatus.state || 'UNKNOWN')}`}>
                  {liveStatus.state || 'UNKNOWN'}
                </span>
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-500">Progress</label>
              <p className="mt-1 text-sm text-gray-900">{(liveStatus.progress || 0).toFixed(1)}%</p>
            </div>
          </div>

          {liveStatus.currentStep && (
            <div>
              <label className="block text-sm font-medium text-gray-500">Current Step</label>
              <p className="mt-1 text-sm text-gray-900">{liveStatus.currentStep}</p>
            </div>
          )}

          {liveStatus.message && (
            <div>
              <label className="block text-sm font-medium text-gray-500">Message</label>
              <p className="mt-1 text-sm text-gray-900">{liveStatus.message}</p>
            </div>
          )}

          {liveStatus.error && (
            <div>
              <label className="block text-sm font-medium text-gray-500">Error</label>
              <p className="mt-1 text-sm text-red-600 bg-red-50 p-3 rounded-lg">{liveStatus.error}</p>
            </div>
          )}

          {liveStatus.result && (
            <div>
              <label className="block text-sm font-medium text-gray-500">Result</label>
              <pre className="mt-1 text-sm text-gray-900 bg-gray-50 p-3 rounded-lg overflow-x-auto">
                {JSON.stringify(liveStatus.result, null, 2)}
              </pre>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-gray-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default JobDashboard;
