import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ProgressBar from '../common/ProgressBar';
import { FaArrowRight, FaArrowLeft, FaCheck } from 'react-icons/fa';

const WorkflowConfig = () => {
  const navigate = useNavigate();
  const [selectedWorkflow, setSelectedWorkflow] = useState('multi-level');

  const steps = ['Institution', 'Workflow', 'Departments', 'Time', 'Slots', 'Rooms', 'Rules'];

  return (
    <div className="max-w-4xl mx-auto">
      <div className="card">
        <ProgressBar currentStep={2} totalSteps={7} steps={steps} />

        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold mb-2 text-gray-800">Choose Your Workflow</h2>
            <p className="text-gray-600 mb-6">How do you want to manage timetables?</p>

            <div className="space-y-4">
              <div
                onClick={() => setSelectedWorkflow('simple')}
                className={`border-2 rounded-xl p-6 cursor-pointer transition-all duration-200 ${
                  selectedWorkflow === 'simple'
                    ? 'border-primary-500 bg-primary-50 shadow-md'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0 mt-1">
                    <div
                      className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                        selectedWorkflow === 'simple'
                          ? 'border-primary-500 bg-primary-500'
                          : 'border-gray-300'
                      }`}
                    >
                      {selectedWorkflow === 'simple' && <div className="w-3 h-3 bg-white rounded-full" />}
                    </div>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      Simple Workflow - Single Admin
                      <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                        Recommended for small
                      </span>
                    </h3>
                    <ul className="space-y-2 mb-3">
                      <li className="flex items-center text-gray-700">
                        <FaCheck className="text-green-500 mr-2" />
                        You manage everything centrally
                      </li>
                      <li className="flex items-center text-gray-700">
                        <FaCheck className="text-green-500 mr-2" />
                        Fastest setup
                      </li>
                      <li className="flex items-center text-gray-700">
                        <FaCheck className="text-green-500 mr-2" />
                        Best for: &lt; 5 departments, &lt; 50 faculty
                      </li>
                    </ul>
                    <div className="bg-gray-100 p-3 rounded-lg text-sm text-gray-600">
                      <strong>Example:</strong> You create timetables for all departments
                    </div>
                  </div>
                </div>
              </div>

              <div
                onClick={() => setSelectedWorkflow('multi-level')}
                className={`border-2 rounded-xl p-6 cursor-pointer transition-all duration-200 ${
                  selectedWorkflow === 'multi-level'
                    ? 'border-primary-500 bg-primary-50 shadow-md'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0 mt-1">
                    <div
                      className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                        selectedWorkflow === 'multi-level'
                          ? 'border-primary-500 bg-primary-500'
                          : 'border-gray-300'
                      }`}
                    >
                      {selectedWorkflow === 'multi-level' && <div className="w-3 h-3 bg-white rounded-full" />}
                    </div>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      Multi-Level Workflow - Department Admins
                    </h3>
                    <ul className="space-y-2 mb-3">
                      <li className="flex items-center text-gray-700">
                        <FaCheck className="text-green-500 mr-2" />
                        Each department manages their own timetable
                      </li>
                      <li className="flex items-center text-gray-700">
                        <FaCheck className="text-green-500 mr-2" />
                        You coordinate shared resources (rooms)
                      </li>
                      <li className="flex items-center text-gray-700">
                        <FaCheck className="text-green-500 mr-2" />
                        Best for: 5+ departments, 50+ faculty
                      </li>
                    </ul>
                    <div className="bg-gray-100 p-3 rounded-lg text-sm text-gray-600">
                      <strong>Example:</strong> CS admin handles CS dept, IT admin handles IT dept
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                ℹ️ You can add department admins later if needed
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-between mt-8 pt-6 border-t border-gray-200">
          <button onClick={() => navigate('/onboarding/welcome')} className="btn-secondary flex items-center space-x-2">
            <FaArrowLeft />
            <span>Back</span>
          </button>
          <button onClick={() => navigate('/onboarding/departments')} className="btn-primary flex items-center space-x-2">
            <span>Next: Departments</span>
            <FaArrowRight />
          </button>
        </div>
      </div>
    </div>
  );
};

export default WorkflowConfig;
