import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaCheckCircle, FaSpinner, FaClock } from 'react-icons/fa';

const GenerationProgress = () => {
  const navigate = useNavigate();
  const [progress, setProgress] = useState(65);
  const [elapsedTime, setElapsedTime] = useState(192); // seconds

  const progressSteps = [
    { label: 'Data validation complete', time: '5 sec', status: 'completed' },
    { label: 'Multi-section detection complete', time: '8 sec', status: 'completed', details: [
      '→ Created 2 sections for CSE401 (Machine Learning)',
      '→ Created 2 sections for CSE301 (Data Structures)'
    ]},
    { label: 'Constraint Programming complete', time: '58 sec', status: 'completed', details: [
      '→ Base solution generated (Fitness: 8,234)'
    ]},
    { label: 'Genetic Algorithm - Solution 1 complete', time: '75 sec', status: 'completed', details: [
      '→ Optimized solution (Fitness: 10,623)'
    ]},
    { label: 'Genetic Algorithm - Solution 2 in progress', time: '45 sec', status: 'in-progress', details: [
      '→ Current best fitness: 10,589'
    ]},
    { label: 'Genetic Algorithm - Solution 3 pending', status: 'pending' }
  ];

  useEffect(() => {
    // Simulate progress
    const timer = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(timer);
          setTimeout(() => navigate('/timetable/comparison'), 1000);
          return 100;
        }
        return prev + 2;
      });
      setElapsedTime(prev => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [navigate]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins} minute${mins !== 1 ? 's' : ''} ${secs} second${secs !== 1 ? 's' : ''}`;
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="card">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-primary-100 rounded-full mb-4">
            <FaSpinner className="text-4xl text-primary-600 animate-spin" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Generating Timetable...</h1>
          <p className="text-gray-600">Please wait, this may take a few minutes</p>
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="relative w-full h-8 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="absolute top-0 left-0 h-full bg-gradient-to-r from-primary-500 to-primary-600 transition-all duration-500 ease-out flex items-center justify-end pr-3"
              style={{ width: `${progress}%` }}
            >
              <span className="text-white font-semibold text-sm">{progress}%</span>
            </div>
          </div>
        </div>

        {/* Status */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold text-blue-900">
                Current Status: Running Genetic Algorithm (2/3)
              </div>
              <div className="text-sm text-blue-700 mt-1">
                Elapsed Time: {formatTime(elapsedTime)}
              </div>
            </div>
            <FaClock className="text-blue-600 text-2xl" />
          </div>
        </div>

        {/* Progress Log */}
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Progress Log:</h2>
          <div className="space-y-4">
            {progressSteps.map((step, index) => (
              <div key={index} className="flex items-start space-x-3">
                <div className="flex-shrink-0 mt-1">
                  {step.status === 'completed' ? (
                    <FaCheckCircle className="text-green-500 text-lg" />
                  ) : step.status === 'in-progress' ? (
                    <FaSpinner className="text-primary-500 text-lg animate-spin" />
                  ) : (
                    <div className="w-5 h-5 border-2 border-gray-300 rounded-full"></div>
                  )}
                </div>
                <div className="flex-1">
                  <div className={`font-medium ${
                    step.status === 'completed' ? 'text-gray-900' :
                    step.status === 'in-progress' ? 'text-primary-600' :
                    'text-gray-400'
                  }`}>
                    {step.label} {step.time && `(${step.time})`}
                  </div>
                  {step.details && (
                    <div className="mt-1 ml-2 text-sm text-gray-600">
                      {step.details.map((detail, i) => (
                        <div key={i}>{detail}</div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Info Box */}
        <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
          <p className="text-sm text-gray-700 text-center mb-3">
            You can safely close this page
          </p>
          <div className="flex justify-center space-x-4">
            <button className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm">
              Copy Progress Link
            </button>
            <button className="px-4 py-2 bg-primary-50 text-primary-700 border border-primary-200 rounded-lg hover:bg-primary-100 transition-colors text-sm">
              Continue Waiting
            </button>
          </div>
          <p className="text-xs text-gray-600 text-center mt-3">
            We'll send you an email when generation completes
          </p>
        </div>
      </div>
    </div>
  );
};

export default GenerationProgress;
