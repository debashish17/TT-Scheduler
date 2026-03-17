import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaArrowLeft, FaEnvelope, FaDownload, FaUser } from 'react-icons/fa';

const FacultyView = () => {
  const navigate = useNavigate();
  const [selectedFaculty, setSelectedFaculty] = useState('Dr. Rajesh Kumar');

  const facultyList = [
    'Dr. Rajesh Kumar',
    'Dr. Priya Sharma',
    'Dr. Arun Kumar',
    'Dr. Meena Patel',
    'Dr. Suresh Verma'
  ];

  const facultyData = {
    name: 'Dr. Rajesh Kumar',
    department: 'Computer Science',
    employeeId: 'CS001',
    workload: '16 hours/week',
    maxWorkload: '18 hours/week',
    schedule: [
      { day: 'Monday', time: '08:00-08:50', course: 'CSE301', batch: 'CS-2023-A', room: '101' },
      { day: 'Monday', time: '10:15-11:05', course: 'CSE401', batch: 'CS-2023-A', room: '203' },
      { day: 'Monday', time: '02:00-02:50', course: 'CSE501', batch: 'CS-2024-A', room: '105' },
      { day: 'Monday', time: '03:00-03:50', course: 'CSE501', batch: 'CS-2024-B', room: '106' },
      { day: 'Tuesday', time: '09:00-09:50', course: 'CSE401', batch: 'CS-2023-B', room: '203' },
      { day: 'Tuesday', time: '11:00-11:50', course: 'CSE301', batch: 'CS-2023-B', room: '101' },
      { day: 'Tuesday', time: '02:00-02:50', course: 'CSE501', batch: 'CS-2024-A', room: '105' },
      { day: 'Wednesday', time: '08:00-08:50', course: 'CSE301', batch: 'CS-2023-A', room: '101' },
      { day: 'Wednesday', time: '10:15-11:05', course: 'CSE401', batch: 'CS-2023-A', room: '203' },
      { day: 'Thursday', time: '09:00-09:50', course: 'CSE401', batch: 'CS-2023-B', room: '203' },
      { day: 'Thursday', time: '11:00-11:50', course: 'CSE301', batch: 'CS-2023-B', room: '101' },
      { day: 'Thursday', time: '03:00-03:50', course: 'CSE501', batch: 'CS-2024-B', room: '106' }
    ],
    dailyWorkload: {
      Monday: 4,
      Tuesday: 3,
      Wednesday: 2,
      Thursday: 3,
      Friday: 0
    },
    preferences: {
      matched: ['Preferred slot: Monday morning (matched)', 'Max consecutive: 2 classes (satisfied)'],
      avoided: ['Avoid slot: Friday (satisfied - no Friday classes)']
    }
  };

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

  const getBarWidth = (hours) => {
    return (hours / 8) * 100; // Assuming max 8 hours per day
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="card">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => navigate('/timetable/grid')}
            className="flex items-center space-x-2 text-primary-600 hover:text-primary-700 mb-4"
          >
            <FaArrowLeft />
            <span>Back to Grid View</span>
          </button>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Timetable - Faculty View</h1>
          <p className="text-gray-600">View individual faculty schedules</p>
        </div>

        {/* Faculty Selector */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Select Faculty:</label>
          <select
            value={selectedFaculty}
            onChange={(e) => setSelectedFaculty(e.target.value)}
            className="input-field max-w-md"
          >
            {facultyList.map((faculty) => (
              <option key={faculty} value={faculty}>
                {faculty}
              </option>
            ))}
          </select>
        </div>

        {/* Faculty Info Card */}
        <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl p-6 mb-6 border border-blue-200">
          <div className="flex items-start space-x-4">
            <div className="flex-shrink-0">
              <div className="w-20 h-20 bg-primary-600 rounded-full flex items-center justify-center">
                <FaUser className="text-white text-3xl" />
              </div>
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">{facultyData.name}</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <div className="text-sm text-gray-600">Department</div>
                  <div className="font-medium text-gray-900">{facultyData.department}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Employee ID</div>
                  <div className="font-medium text-gray-900">{facultyData.employeeId}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Workload</div>
                  <div className="font-medium text-gray-900">{facultyData.workload}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Max Workload</div>
                  <div className="font-medium text-gray-900">{facultyData.maxWorkload}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Weekly Schedule Table */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Weekly Schedule</h3>
          <div className="overflow-x-auto bg-white rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Day
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Course
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Batch
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Room
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {facultyData.schedule.map((item, index) => (
                  <tr key={index} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-medium text-gray-900">{item.day}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-700">{item.time}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex px-3 py-1 text-sm font-medium bg-blue-100 text-blue-800 rounded-full">
                        {item.course}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-700">{item.batch}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-700">{item.room}</span>
                    </td>
                  </tr>
                ))}
                <tr className="bg-green-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm font-medium text-green-800">Friday</span>
                  </td>
                  <td colSpan="4" className="px-6 py-4 text-center">
                    <span className="text-sm font-medium text-green-700">FREE DAY</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Workload Distribution */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Workload Distribution</h3>
          <div className="space-y-3">
            {days.map((day) => (
              <div key={day} className="flex items-center space-x-4">
                <div className="w-24 text-sm font-medium text-gray-700">{day.substring(0, 3)}:</div>
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <div className="flex-1 bg-gray-200 rounded-full h-8 overflow-hidden">
                      <div
                        className={`h-full flex items-center px-3 text-white text-sm font-medium transition-all duration-300 ${
                          facultyData.dailyWorkload[day] === 0
                            ? 'bg-green-500'
                            : facultyData.dailyWorkload[day] <= 2
                            ? 'bg-blue-500'
                            : facultyData.dailyWorkload[day] <= 4
                            ? 'bg-yellow-500'
                            : 'bg-red-500'
                        }`}
                        style={{ width: `${getBarWidth(facultyData.dailyWorkload[day])}%` }}
                      >
                        {facultyData.dailyWorkload[day] > 0 && `${facultyData.dailyWorkload[day]} hrs`}
                      </div>
                    </div>
                    <span className="text-sm text-gray-600 w-16">
                      {facultyData.dailyWorkload[day]} hrs
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Preferences */}
        <div className="bg-gray-50 rounded-lg p-5 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Preferences</h3>
          <div className="space-y-2">
            {facultyData.preferences.matched.map((pref, index) => (
              <div key={index} className="flex items-center space-x-2 text-sm">
                <span className="text-green-500 font-bold">✓</span>
                <span className="text-gray-700">{pref}</span>
              </div>
            ))}
            {facultyData.preferences.avoided.map((pref, index) => (
              <div key={index} className="flex items-center space-x-2 text-sm">
                <span className="text-green-500 font-bold">✓</span>
                <span className="text-gray-700">{pref}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-center space-x-4">
          <button className="btn-secondary flex items-center space-x-2">
            <FaEnvelope />
            <span>Email Schedule</span>
          </button>
          <button className="btn-secondary flex items-center space-x-2">
            <FaDownload />
            <span>Export PDF</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default FacultyView;
