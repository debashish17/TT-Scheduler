import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FaCheckCircle, FaGraduationCap, FaClock, FaDoorOpen, FaRulerCombined, FaDownload, FaArrowRight } from 'react-icons/fa';

const SetupComplete = () => {
  const navigate = useNavigate();

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
                      <span className="font-medium">ABC College of Engineering</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Type:</span>
                      <span className="font-medium">Engineering College</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Workflow:</span>
                      <span className="font-medium">Multi-Level (Department Admins)</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Institution Code:</span>
                      <span className="font-medium text-primary-600">ABC-2026-XY7Z</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Departments */}
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <div className="flex items-start space-x-3">
                <FaGraduationCap className="text-green-600 text-xl mt-1" />
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 mb-2">🏢 Departments (3)</h3>
                  <div className="text-sm text-gray-700">
                    <ul className="list-disc list-inside space-y-1">
                      <li>Computer Science (CS)</li>
                      <li>Information Technology (IT)</li>
                      <li>Electronics & Communication (ECE)</li>
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
                      <span className="font-medium">Mon-Fri (5 days)</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Daily Hours:</span>
                      <span className="font-medium">8:00 AM - 5:00 PM</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Theory Slots:</span>
                      <span className="font-medium">14 (A1, A2, B1, B2, ...)</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Lab Slots:</span>
                      <span className="font-medium">56 (L1-L56)</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Breaks:</span>
                      <span className="font-medium">Morning (15 min), Lunch (60 min)</span>
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
                      <span className="font-medium">30 rooms</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Total Capacity:</span>
                      <span className="font-medium">1500 students</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Lab Facilities:</span>
                      <span className="font-medium">10 labs</span>
                    </div>
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
              <span className="text-gray-900 font-medium">Add faculty members (manually or import Excel)</span>
            </div>
            <div className="flex items-center space-x-3">
              <div className="flex-shrink-0 w-8 h-8 bg-gray-300 text-gray-600 rounded-full flex items-center justify-center font-bold">
                3
              </div>
              <span className="text-gray-600">Add courses (manually or import Excel)</span>
            </div>
            <div className="flex items-center space-x-3">
              <div className="flex-shrink-0 w-8 h-8 bg-gray-300 text-gray-600 rounded-full flex items-center justify-center font-bold">
                4
              </div>
              <span className="text-gray-600">Add student batches</span>
            </div>
            <div className="flex items-center space-x-3">
              <div className="flex-shrink-0 w-8 h-8 bg-gray-300 text-gray-600 rounded-full flex items-center justify-center font-bold">
                5
              </div>
              <span className="text-gray-600">Generate your first timetable!</span>
            </div>
          </div>
        </div>

        <div className="flex justify-between items-center">
          <button className="btn-secondary flex items-center space-x-2">
            <FaDownload />
            <span>Download Setup Summary PDF</span>
          </button>
          <button 
            onClick={() => navigate('/timetable/generate')}
            className="btn-primary flex items-center space-x-2"
          >
            <span>Go to Timetable Generator</span>
            <FaArrowRight />
          </button>
        </div>
      </div>
    </div>
  );
};

export default SetupComplete;
