/**
 * Async Timetable Generation Component
 * Full-featured timetable generation with real-time progress tracking
 */
import React, { useState, useEffect } from 'react';
import { FiPlay, FiSettings, FiDownload, FiRefreshCw, FiCheck, FiX, FiClock } from 'react-icons/fi';
import api from '../../api/client';
import { useJobProgress, useForm } from '../../hooks/useAPI';
import { useInstitutionStore, useTimetableStore, useJobStore } from '../../store';
import { formatDuration, getStatusColor, downloadFile } from '../../utils/helpers';
import toast from 'react-hot-toast';

const AsyncTimetableGeneration = () => {
  const { currentInstitution } = useInstitutionStore();
  const { generationSettings, updateGenerationSettings, addTimetable } = useTimetableStore();
  const { addJob, updateJob, completeJob, failJob } = useJobStore();

  const [currentJobId, setCurrentJobId] = useState(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Form handler for generation settings
  const { values, handleChange, handleSubmit, isSubmitting } = useForm(
    {
      semester: '',
      optimization_mode: generationSettings.optimization_mode,
      time_limit_minutes: generationSettings.time_limit_minutes,
      enable_soft_constraints: generationSettings.enable_soft_constraints,
      notify_email: '',
    },
    async (formValues) => {
      if (!currentInstitution) {
        toast.error('Please select an institution first');
        return;
      }

      try {
        // Submit async timetable generation job
        const response = await api.jobs.submitTimetableGeneration(
          {
            institution_id: currentInstitution.id,
            semester: formValues.semester,
            optimization_mode: formValues.optimization_mode,
            time_limit_minutes: formValues.time_limit_minutes,
            enable_soft_constraints: formValues.enable_soft_constraints,
          },
          formValues.notify_email || null
        );

        const jobData = response.data;
        setCurrentJobId(jobData.job_id);

        // Add to job store
        addJob({
          job_id: jobData.job_id,
          type: 'timetable_generation',
          semester: formValues.semester,
          submitted_at: new Date().toISOString(),
          status: 'PENDING',
        });

        // Update generation settings
        updateGenerationSettings({
          optimization_mode: formValues.optimization_mode,
          time_limit_minutes: formValues.time_limit_minutes,
          enable_soft_constraints: formValues.enable_soft_constraints,
        });

        toast.success('Timetable generation job submitted!');
      } catch (error) {
        toast.error('Failed to submit generation job');
        console.error(error);
      }
    }
  );

  // Job progress tracking with WebSocket
  const {
    status,
    isConnected,
    cancel,
    isComplete,
    isSuccess,
    isFailure,
    isRunning,
  } = useJobProgress(currentJobId, {
    autoConnect: !!currentJobId,
    onProgress: (data) => {
      updateJob(currentJobId, {
        status: data.status,
        progress: data.progress_percentage,
        current_step: data.current_step_name,
      });
    },
    onSuccess: (data) => {
      completeJob(currentJobId, data.result);
      if (data.result?.timetable_id) {
        // Add timetable to store
        addTimetable({
          id: data.result.timetable_id,
          semester: values.semester,
          assignment_rate: data.result.assignment_rate,
          generation_time: data.result.generation_time,
          created_at: new Date().toISOString(),
        });
      }
    },
    onError: (data) => {
      failJob(currentJobId, data.error);
    },
  });

  const handleCancel = async () => {
    try {
      await cancel();
      setCurrentJobId(null);
      toast.success('Job cancelled');
    } catch (error) {
      toast.error('Failed to cancel job');
    }
  };

  const handleDownloadResult = async () => {
    if (!status.result?.timetable_id) return;

    try {
      const response = await api.timetable.export(
        status.result.timetable_id,
        'excel',
        { include_metadata: true }
      );

      const filename = `timetable_${values.semester || 'export'}_${new Date().toISOString().split('T')[0]}.xlsx`;
      downloadFile(response.data, filename);

      toast.success('Timetable downloaded!');
    } catch (error) {
      toast.error('Failed to download timetable');
    }
  };

  const handleReset = () => {
    setCurrentJobId(null);
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="bg-white shadow rounded-lg p-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Generate Timetable
        </h1>
        <p className="text-gray-600">
          Advanced CP-SAT optimization engine with real-time progress tracking
        </p>
      </div>

      {/* Institution Info */}
      {currentInstitution && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-900">Current Institution</p>
              <p className="text-lg font-semibold text-blue-700">
                {currentInstitution.name}
              </p>
            </div>
            <span className="text-sm text-blue-600">{currentInstitution.code}</span>
          </div>
        </div>
      )}

      {/* Generation Form */}
      {!currentJobId && (
        <div className="bg-white shadow rounded-lg p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Settings */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Semester *
                </label>
                <input
                  type="text"
                  name="semester"
                  value={values.semester}
                  onChange={handleChange}
                  placeholder="e.g., Fall 2024"
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Optimization Mode
                </label>
                <select
                  name="optimization_mode"
                  value={values.optimization_mode}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="fast">Fast (≤2 min) - Quick results</option>
                  <option value="balanced">Balanced (≤5 min) - Good quality</option>
                  <option value="quality">Quality (≤15 min) - Best results</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Time Limit (minutes)
                </label>
                <input
                  type="number"
                  name="time_limit_minutes"
                  value={values.time_limit_minutes}
                  onChange={handleChange}
                  min="1"
                  max="60"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="flex items-center">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    name="enable_soft_constraints"
                    checked={values.enable_soft_constraints}
                    onChange={handleChange}
                    className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Enable Soft Constraints
                  </span>
                </label>
              </div>
            </div>

            {/* Advanced Settings */}
            <div>
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center space-x-2 text-blue-600 hover:text-blue-700 font-medium"
              >
                <FiSettings />
                <span>{showAdvanced ? 'Hide' : 'Show'} Advanced Settings</span>
              </button>

              {showAdvanced && (
                <div className="mt-4 p-4 bg-gray-50 rounded-lg space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email Notification (Optional)
                    </label>
                    <input
                      type="email"
                      name="notify_email"
                      value={values.notify_email}
                      onChange={handleChange}
                      placeholder="your.email@example.com"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <p className="mt-1 text-sm text-gray-500">
                      Receive email when generation completes
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Submit Button */}
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isSubmitting || !currentInstitution}
                className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                <FiPlay />
                <span>{isSubmitting ? 'Submitting...' : 'Generate Timetable'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Progress Tracking */}
      {currentJobId && (
        <div className="bg-white shadow rounded-lg p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Generation Progress</h2>
              <p className="text-sm text-gray-600 mt-1">Job ID: {currentJobId}</p>
            </div>
            <div className="flex items-center space-x-3">
              {/* WebSocket Status */}
              <div
                className={`flex items-center space-x-2 px-3 py-1 rounded-full text-sm ${
                  isConnected
                    ? 'bg-green-100 text-green-800'
                    : 'bg-gray-100 text-gray-800'
                }`}
              >
                <div
                  className={`w-2 h-2 rounded-full ${
                    isConnected ? 'bg-green-600 animate-pulse' : 'bg-gray-400'
                  }`}
                />
                <span>{isConnected ? 'Live' : 'Polling'}</span>
              </div>

              {/* Status Badge */}
              <span
                className={`px-4 py-2 rounded-full text-sm font-medium ${getStatusColor(
                  status.state
                )}`}
              >
                {status.state}
              </span>
            </div>
          </div>

          {/* Progress Bar */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">
                {status.currentStep || 'Initializing...'}
              </span>
              <span className="text-sm font-medium text-gray-900">
                {status.progress.toFixed(1)}%
              </span>
            </div>
            <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-300 ease-out"
                style={{ width: `${status.progress}%` }}
              />
            </div>
            <p className="mt-2 text-sm text-gray-600">{status.message}</p>
          </div>

          {/* Running State */}
          {isRunning && (
            <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
                <div>
                  <p className="font-medium text-blue-900">
                    Optimization in progress...
                  </p>
                  <p className="text-sm text-blue-700">
                    This may take {values.time_limit_minutes} minutes or less
                  </p>
                </div>
              </div>
              <button
                onClick={handleCancel}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Cancel
              </button>
            </div>
          )}

          {/* Success State */}
          {isSuccess && status.result && (
            <div className="space-y-4">
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-start space-x-3">
                  <FiCheck className="text-green-600 text-2xl flex-shrink-0 mt-1" />
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-green-900">
                      Generation Completed Successfully!
                    </h3>
                    <p className="text-sm text-green-700 mt-1">
                      Your timetable has been generated and is ready for review.
                    </p>
                  </div>
                </div>
              </div>

              {/* Results Summary */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-white border border-gray-200 rounded-lg">
                  <p className="text-sm text-gray-600">Assignment Rate</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {status.result.assignment_rate}%
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {status.result.assignment_count} courses assigned
                  </p>
                </div>

                <div className="p-4 bg-white border border-gray-200 rounded-lg">
                  <p className="text-sm text-gray-600">Generation Time</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatDuration(status.result.generation_time)}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {values.optimization_mode} mode
                  </p>
                </div>

                <div className="p-4 bg-white border border-gray-200 rounded-lg">
                  <p className="text-sm text-gray-600">Quality Score</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {status.result.penalty_score || 0}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Lower is better</p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-3">
                <button
                  onClick={handleDownloadResult}
                  className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <FiDownload />
                  <span>Download Timetable</span>
                </button>

                <button
                  onClick={() => {
                    window.location.href = `/timetables/${status.result.timetable_id}`;
                  }}
                  className="flex items-center space-x-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  <FiCheck />
                  <span>View Timetable</span>
                </button>

                <button
                  onClick={handleReset}
                  className="flex items-center space-x-2 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <FiRefreshCw />
                  <span>Generate Another</span>
                </button>
              </div>
            </div>
          )}

          {/* Failure State */}
          {isFailure && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-start space-x-3">
                <FiX className="text-red-600 text-2xl flex-shrink-0 mt-1" />
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-red-900">
                    Generation Failed
                  </h3>
                  <p className="text-sm text-red-700 mt-1">
                    {status.error || 'An unexpected error occurred'}
                  </p>
                  <button
                    onClick={handleReset}
                    className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                  >
                    Try Again
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Info Cards */}
      {!currentJobId && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex items-start space-x-3">
              <FiClock className="text-blue-600 text-2xl flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-semibold text-gray-900">Real-Time Progress</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Track generation progress with WebSocket updates and 8-step detailed tracking
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex items-start space-x-3">
              <FiSettings className="text-green-600 text-2xl flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-semibold text-gray-900">Smart Optimization</h3>
                <p className="text-sm text-gray-600 mt-1">
                  CP-SAT solver with 8 hard constraints and soft constraint optimization
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex items-start space-x-3">
              <FiDownload className="text-purple-600 text-2xl flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-semibold text-gray-900">Multiple Formats</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Export to Excel, PDF, or CSV with comprehensive metadata and analytics
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AsyncTimetableGeneration;