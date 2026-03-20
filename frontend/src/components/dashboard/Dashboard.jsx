/**
 * Main Dashboard Component
 * Overview of timetables, jobs, and system status
 */
import React, { useState, useEffect } from 'react';
import {
  FiCalendar,
  FiUsers,
  FiClock,
  FiBarChart2,
  FiPlay,
  FiCheckCircle,
  FiXCircle,
  FiDownload,
  FiRefreshCw,
  FiTrendingUp,
} from 'react-icons/fi';
import { Link } from 'react-router-dom';
import { useAsync } from '../../hooks/useAPI';
import { useInstitutionStore, useJobStore } from '../../store';
import { formatDate, formatDuration, getStatusColor } from '../../utils/helpers';
import api from '../../api/client';

const Dashboard = () => {
  const { currentInstitution } = useInstitutionStore();
  const { activeJobs, completedJobs, failedJobs } = useJobStore();

  // Fetch dashboard data
  const { data: stats, loading: statsLoading, refetch: refetchStats } = useAsync(
    () => currentInstitution ? api.institution.statistics(currentInstitution.id) : Promise.resolve({ data: null }),
    [currentInstitution?.id]
  );

  const { data: recentTimetables, loading: timetablesLoading, refetch: refetchTimetables } = useAsync(
    () => currentInstitution ? api.timetable.list({
      institution_id: currentInstitution.id,
      limit: 5
    }) : Promise.resolve({ data: [] }),
    [currentInstitution?.id]
  );

  const statsData = stats?.data || {};
  const timetablesList = recentTimetables?.data || [];

  // Calculate job statistics
  const totalActiveJobs = activeJobs.length;
  const completedToday = completedJobs.filter(job => {
    const today = new Date().toDateString();
    return new Date(job.completed_at).toDateString() === today;
  }).length;

  const successRate = completedJobs.length > 0
    ? Math.round((completedJobs.length / (completedJobs.length + failedJobs.length)) * 100)
    : 0;

  if (!currentInstitution) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center p-8">
          <FiCalendar className="mx-auto text-6xl text-gray-400 mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">No Institution Selected</h2>
          <p className="text-gray-600 mb-6">Please select an institution to view the dashboard.</p>
          <Link
            to="/institutions"
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Select Institution
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-gray-600">{currentInstitution.name}</p>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={() => {
                refetchStats();
                refetchTimetables();
              }}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <FiRefreshCw />
              <span>Refresh</span>
            </button>
            <Link
              to="/generate"
              className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <FiPlay />
              <span>Generate Timetable</span>
            </Link>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Timetables</p>
                <p className="text-3xl font-bold text-gray-900">
                  {statsLoading ? '...' : (statsData.total_timetables || 0)}
                </p>
              </div>
              <FiCalendar className="text-blue-600 text-2xl" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Faculty Members</p>
                <p className="text-3xl font-bold text-gray-900">
                  {statsLoading ? '...' : (statsData.total_faculty || 0)}
                </p>
              </div>
              <FiUsers className="text-green-600 text-2xl" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Active Jobs</p>
                <p className="text-3xl font-bold text-gray-900">{totalActiveJobs}</p>
              </div>
              <FiClock className="text-orange-600 text-2xl" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Success Rate</p>
                <p className="text-3xl font-bold text-gray-900">{successRate}%</p>
              </div>
              <FiTrendingUp className="text-purple-600 text-2xl" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Timetables */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">Recent Timetables</h2>
                <Link
                  to="/timetables"
                  className="text-blue-600 hover:text-blue-700 font-medium"
                >
                  View All
                </Link>
              </div>
            </div>

            <div className="p-6">
              {timetablesLoading ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="animate-pulse">
                      <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
                      <div className="h-3 bg-gray-200 rounded w-1/2" />
                    </div>
                  ))}
                </div>
              ) : timetablesList.length > 0 ? (
                <div className="space-y-4">
                  {timetablesList.map((timetable) => (
                    <div key={timetable.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-900">{timetable.semester}</h3>
                        <p className="text-sm text-gray-600">
                          Created {formatDate(timetable.created_at)}
                        </p>
                        <div className="flex items-center space-x-4 mt-2">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(timetable.status)}`}>
                            {timetable.status}
                          </span>
                          {timetable.assignment_rate && (
                            <span className="text-sm text-gray-600">
                              {timetable.assignment_rate}% assigned
                            </span>
                          )}
                        </div>
                      </div>
                      <Link
                        to={`/timetables/${timetable.id}`}
                        className="ml-4 px-3 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        View
                      </Link>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <FiCalendar className="mx-auto text-4xl text-gray-400 mb-4" />
                  <p className="text-gray-600">No timetables created yet</p>
                  <Link
                    to="/generate"
                    className="mt-4 inline-flex items-center space-x-2 text-blue-600 hover:text-blue-700"
                  >
                    <FiPlay />
                    <span>Create your first timetable</span>
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* Job Activity */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">Job Activity</h2>
                <Link
                  to="/jobs"
                  className="text-blue-600 hover:text-blue-700 font-medium"
                >
                  View All
                </Link>
              </div>
            </div>

            <div className="p-6">
              {totalActiveJobs > 0 || completedJobs.length > 0 ? (
                <div className="space-y-4">
                  {/* Active Jobs */}
                  {activeJobs.slice(0, 3).map((job) => (
                    <div key={job.job_id} className="flex items-center space-x-3 p-3 bg-blue-50 rounded-lg">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{job.type.replace('_', ' ')}</p>
                        <p className="text-sm text-gray-600">{job.semester || 'In Progress'}</p>
                      </div>
                      <span className="text-sm text-blue-600">{job.progress || 0}%</span>
                    </div>
                  ))}

                  {/* Recent Completed Jobs */}
                  {completedJobs.slice(0, 2).map((job) => (
                    <div key={job.job_id} className="flex items-center space-x-3 p-3 border border-gray-200 rounded-lg">
                      <FiCheckCircle className="text-green-600 text-xl" />
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{job.type.replace('_', ' ')}</p>
                        <p className="text-sm text-gray-600">
                          Completed {formatDate(job.completed_at)}
                        </p>
                      </div>
                    </div>
                  ))}

                  {/* Recent Failed Jobs */}
                  {failedJobs.slice(0, 1).map((job) => (
                    <div key={job.job_id} className="flex items-center space-x-3 p-3 border border-red-200 bg-red-50 rounded-lg">
                      <FiXCircle className="text-red-600 text-xl" />
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{job.type.replace('_', ' ')}</p>
                        <p className="text-sm text-red-600">{job.error}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <FiClock className="mx-auto text-4xl text-gray-400 mb-4" />
                  <p className="text-gray-600">No recent job activity</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Link
              to="/generate"
              className="flex flex-col items-center p-6 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <FiPlay className="text-3xl text-blue-600 mb-3" />
              <span className="font-medium text-gray-900">Generate Timetable</span>
              <span className="text-sm text-gray-600 text-center mt-1">
                Create optimized schedules
              </span>
            </Link>

            <Link
              to="/faculty/import"
              className="flex flex-col items-center p-6 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <FiUsers className="text-3xl text-green-600 mb-3" />
              <span className="font-medium text-gray-900">Import Faculty</span>
              <span className="text-sm text-gray-600 text-center mt-1">
                Bulk import from Excel
              </span>
            </Link>

            <Link
              to="/analytics"
              className="flex flex-col items-center p-6 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <FiBarChart2 className="text-3xl text-purple-600 mb-3" />
              <span className="font-medium text-gray-900">View Analytics</span>
              <span className="text-sm text-gray-600 text-center mt-1">
                Performance insights
              </span>
            </Link>

            <Link
              to="/export"
              className="flex flex-col items-center p-6 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <FiDownload className="text-3xl text-orange-600 mb-3" />
              <span className="font-medium text-gray-900">Export Data</span>
              <span className="text-sm text-gray-600 text-center mt-1">
                Download reports
              </span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;