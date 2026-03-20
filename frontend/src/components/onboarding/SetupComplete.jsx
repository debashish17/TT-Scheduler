import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FaCheckCircle, FaGraduationCap, FaClock, FaDoorOpen, FaRulerCombined, FaDownload, FaArrowRight, FaArrowLeft } from 'react-icons/fa';
import { useOnboardingStore } from '../../store';

const SetupComplete = () => {
  const navigate = useNavigate();

  // Get real onboarding data from store
  const {
    institutionData,
    workflowData,
    subjectsData,
    timeData,
    roomsData,
    constraintsData
  } = useOnboardingStore();

  // Use real data or fallback to defaults
  const institutionInfo = institutionData || {
    name: 'Your School',
    type: 'School',
    workflow: 'Simple Workflow (Single Admin)',
    code: 'SCH-2026-' + Math.random().toString(36).substr(2, 6).toUpperCase()
  };

  const subjects = subjectsData && subjectsData.length > 0 ? subjectsData : [
    'Mathematics', 'English', 'Science', 'Social Studies', 'Physical Education'
  ];

  const timeStructure = timeData || {
    workingDays: 'Monday to Friday (5 days)',
    dailyHours: '8:00 AM - 3:30 PM',
    periodsPerDay: 7,
    periodDuration: 50,
    breaks: 'Morning Break (20 min), Lunch (45 min)'
  };

  const roomStats = {
    total: roomsData?.length || 0,
    lectureHalls: roomsData?.filter(r => r.type === 'Lecture Hall').length || 0,
    computerLabs: roomsData?.filter(r => r.type === 'Computer Lab').length || 0,
    otherLabs: roomsData?.filter(r => r.type && r.type.includes('Lab') && r.type !== 'Computer Lab').length || 0,
    totalCapacity: roomsData?.reduce((sum, r) => sum + parseInt(r.capacity || 0), 0) || 0
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="card">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-24 h-24 bg-green-100 rounded-full mb-4">
            <FaCheckCircle className="text-5xl text-green-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">🎉 Setup Complete!</h1>
          <p className="text-gray-600">Your institution profile has been successfully created</p>
        </div>

        <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Your Institution Profile</h2>
          
          <div className="space-y-4">
            {/* Basic Information */}
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <div className="flex items-start space-x-3">
                <FaGraduationCap className="text-primary-600 text-xl mt-1" />
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 mb-2">📋 Basic Information</h3>
                  <div className="text-sm text-gray-700 space-y-1">
                    <div className="flex justify-between">
                      <span>Name:</span>
                      <span className="font-medium">{institutionInfo.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Type:</span>
                      <span className="font-medium">{institutionInfo.type}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Workflow:</span>
                      <span className="font-medium">{workflowData || institutionInfo.workflow}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Institution Code:</span>
                      <span className="font-medium text-primary-600">{institutionInfo.code}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Subjects */}
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <div className="flex items-start space-x-3">
                <FaGraduationCap className="text-green-600 text-xl mt-1" />
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 mb-2">📚 Subjects ({subjects.length})</h3>
                  <div className="text-sm text-gray-700">
                    <ul className="list-disc list-inside space-y-1">
                      {subjects.map((subject, index) => (
                        <li key={index}>{typeof subject === 'string' ? subject : subject.name || subject.label}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {/* Time Structure */}
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <div className="flex items-start space-x-3">
                <FaClock className="text-blue-600 text-xl mt-1" />
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 mb-2">⏰ Time Structure</h3>
                  <div className="text-sm text-gray-700 space-y-1">
                    <div className="flex justify-between">
                      <span>Working Days:</span>
                      <span className="font-medium">{timeStructure.workingDays}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Daily Hours:</span>
                      <span className="font-medium">{timeStructure.dailyHours}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Periods per Day:</span>
                      <span className="font-medium">{timeStructure.periodsPerDay} periods</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Period Duration:</span>
                      <span className="font-medium">{timeStructure.periodDuration} minutes</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Breaks:</span>
                      <span className="font-medium">{timeStructure.breaks}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Resources */}
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <div className="flex items-start space-x-3">
                <FaDoorOpen className="text-purple-600 text-xl mt-1" />
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 mb-2">🏫 Resources</h3>
                  <div className="text-sm text-gray-700 space-y-1">
                    <div className="flex justify-between">
                      <span>Classrooms:</span>
                      <span className="font-medium">{roomStats.total} rooms</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Total Capacity:</span>
                      <span className="font-medium">{roomStats.totalCapacity} students</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Lab/Special Rooms:</span>
                      <span className="font-medium">{roomStats.computerLabs + roomStats.otherLabs} labs</span>
                    </div>
                    {roomStats.total === 0 && (
                      <div className="text-xs text-gray-500 mt-2">
                        No rooms added yet - you can add them during generation setup
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Custom Constraints */}
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <div className="flex items-start space-x-3">
                <FaRulerCombined className="text-orange-600 text-xl mt-1" />
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 mb-2">📌 Custom Constraints</h3>
                  <div className="text-sm text-gray-700">
                    <ul className="list-disc list-inside space-y-1">
                      <li>Max consecutive classes: 3</li>
                      <li>No Saturday classes</li>
                      <li>First year: Morning only</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Next Steps */}
        <div className="bg-white border-2 border-primary-200 rounded-xl p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Next Steps:</h2>
          <div className="space-y-3">
            <div className="flex items-center space-x-3">
              <div className="flex-shrink-0 w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center font-bold">
                ✓
              </div>
              <span className="text-gray-600">Institution setup complete</span>
            </div>
            <div className="flex items-center space-x-3">
              <div className="flex-shrink-0 w-8 h-8 bg-primary-500 text-white rounded-full flex items-center justify-center font-bold">
                2
              </div>
              <span className="text-gray-900 font-medium">Configure timetable generation settings</span>
            </div>
            <div className="flex items-center space-x-3">
              <div className="flex-shrink-0 w-8 h-8 bg-gray-300 text-gray-600 rounded-full flex items-center justify-center font-bold">
                3
              </div>
              <span className="text-gray-600">Add faculty and course details</span>
            </div>
            <div className="flex items-center space-x-3">
              <div className="flex-shrink-0 w-8 h-8 bg-gray-300 text-gray-600 rounded-full flex items-center justify-center font-bold">
                4
              </div>
              <span className="text-gray-600">Generate your school timetable using CP-SAT</span>
            </div>
            <div className="flex items-center space-x-3">
              <div className="flex-shrink-0 w-8 h-8 bg-gray-300 text-gray-600 rounded-full flex items-center justify-center font-bold">
                5
              </div>
              <span className="text-gray-600">View and export faculty & student timetables</span>
            </div>
          </div>
        </div>

        <div className="flex justify-between items-center">
          <button onClick={() => navigate('/screen-7')} className="btn-secondary flex items-center space-x-2">
            <FaArrowLeft />
            <span>Back</span>
          </button>
          <div className="flex space-x-3">
            <button className="btn-secondary flex items-center space-x-2">
              <FaDownload />
              <span>Download Setup Summary PDF</span>
            </button>
            <button
              onClick={() => navigate('/screen-9')}
              className="btn-primary flex items-center space-x-2"
            >
              <span>Go to Timetable Generator</span>
              <FaArrowRight />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SetupComplete;
