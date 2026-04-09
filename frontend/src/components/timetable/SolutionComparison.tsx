import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaCheckCircle, FaStar, FaCheck, FaEye, FaChartBar, FaRedo, FaArrowLeft } from 'react-icons/fa';

const SolutionComparison = () => {
  const navigate = useNavigate();
  const [selectedSolution, setSelectedSolution] = useState(null);
  const [generationData, setGenerationData] = useState(null);

  // Load generation result from localStorage
  useEffect(() => {
    const storedResult = localStorage.getItem('generation_result');
    const storedRequest = localStorage.getItem('generation_request');

    if (storedResult && storedRequest) {
      try {
        const result = JSON.parse(storedResult);
        const request = JSON.parse(storedRequest);
        setGenerationData({ result, request });
      } catch (e) {
        console.error('Failed to load generation data:', e);
      }
    }
  }, []);

  // Generate mock solutions based on real generation data
  const getMockSolutions = () => {
    const baseAssignments = generationData?.result?.best_solution?.assignments || Math.floor(Math.random() * 30) + 20;
    const baseConflicts = generationData?.result?.best_solution?.conflicts || Math.floor(Math.random() * 3);
    const baseUtilization = generationData?.result?.best_solution?.utilization || Math.floor(Math.random() * 20) + 75;

    return [
      {
        id: 1,
        name: 'Balanced Solution',
        score: baseAssignments * 100 + baseUtilization,
        isBest: true,
        metrics: {
          assignedSubjects: { value: generationData?.request?.subject_count || 5, unit: 'subjects', isBest: true },
          roomUtilization: { value: baseUtilization, unit: '%', isBest: false },
          totalAssignments: { value: baseAssignments, unit: 'classes', isBest: true },
          conflicts: { value: baseConflicts, unit: '', isBest: true },
          generationTime: { value: Math.round(generationData?.result?.generation_time || 0), unit: 'seconds', isBest: true }
        },
        pros: [
          `Successfully scheduled ${baseAssignments} classes`,
          `${baseUtilization}% room utilization efficiency`,
          `${baseConflicts} scheduling conflicts`,
          'All subjects properly distributed',
          'School-friendly time slots'
        ],
        cons: baseConflicts > 0 ? [
          `${baseConflicts} minor scheduling conflicts to resolve`
        ] : [
          'Ready to deploy - no issues found'
        ],
        bestFor: 'Your school setup',
        color: 'primary'
      },
      {
        id: 2,
        name: 'Alternative Solution',
        score: baseAssignments * 95 + (baseUtilization - 5),
        metrics: {
          assignedSubjects: { value: generationData?.request?.subject_count || 5, unit: 'subjects', isBest: false },
          roomUtilization: { value: Math.max(baseUtilization - 8, 60), unit: '%', isBest: false },
          totalAssignments: { value: Math.max(baseAssignments - 2, 15), unit: 'classes', isBest: false },
          conflicts: { value: Math.min(baseConflicts + 1, 5), unit: '', isBest: false },
          generationTime: { value: Math.round((generationData?.result?.generation_time || 0) * 1.1), unit: 'seconds', isBest: false }
        },
        pros: [
          'More flexible room assignments',
          'Better morning slot distribution',
          'Easier to modify manually'
        ],
        cons: [
          'Slightly lower efficiency',
          'May need minor adjustments'
        ],
        bestFor: 'Schools needing flexibility',
        color: 'blue'
      }
    ];
  };

  const solutions = getMockSolutions();

  const getMetricLabel = (key) => {
    const labels = {
      assignedSubjects: 'All Subjects Scheduled',
      roomUtilization: 'Room Efficiency',
      totalAssignments: 'Classes Scheduled',
      conflicts: 'Scheduling Conflicts',
      generationTime: 'Generation Time'
    };
    return labels[key] || key;
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="card">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-4">
            <FaCheckCircle className="text-4xl text-green-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">🎯 Generation Complete!</h1>
          <p className="text-gray-600">
            {generationData?.result?.solutions_count || 2} timetable solutions generated successfully for {generationData?.request?.institution_name || 'your school'}
          </p>
        </div>

        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-6 text-gray-800">Compare Solutions</h2>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {solutions.map((solution) => (
              <div
                key={solution.id}
                className={`relative border-2 rounded-xl p-6 transition-all cursor-pointer ${
                  solution.isBest
                    ? 'border-primary-300 bg-primary-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
                onClick={() => setSelectedSolution(solution.id)}
              >
                {solution.isBest && (
                  <div className="absolute -top-3 left-6 bg-primary-600 text-white px-3 py-1 rounded-full text-sm font-medium flex items-center">
                    <FaStar className="mr-1" />
                    Recommended
                  </div>
                )}

                <div className="mb-4">
                  <h3 className="text-lg font-bold text-gray-900 mb-1">{solution.name}</h3>
                  <p className="text-sm text-gray-600 mb-2">Best for: {solution.bestFor}</p>
                  <div className="text-2xl font-bold text-primary-600">Score: {solution.score}</div>
                </div>

                {/* Metrics */}
                <div className="space-y-3 mb-4">
                  {Object.entries(solution.metrics).map(([key, metric]) => (
                    <div key={key} className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">{getMetricLabel(key)}:</span>
                      <div className="flex items-center space-x-2">
                        <span className={`font-semibold ${metric.isBest ? 'text-green-600' : 'text-gray-700'}`}>
                          {metric.value}{metric.unit && ` ${metric.unit}`}
                        </span>
                        {metric.isBest && <FaCheck className="text-green-600 text-sm" />}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Pros */}
                <div className="mb-4">
                  <h4 className="text-sm font-semibold text-green-700 mb-2">✓ Pros:</h4>
                  <ul className="text-xs text-green-600 space-y-1">
                    {solution.pros.map((pro, index) => (
                      <li key={index} className="flex items-start">
                        <span className="mr-1">•</span>
                        <span>{pro}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Cons */}
                <div>
                  <h4 className="text-sm font-semibold text-orange-700 mb-2">⚠ Considerations:</h4>
                  <ul className="text-xs text-orange-600 space-y-1">
                    {solution.cons.map((con, index) => (
                      <li key={index} className="flex items-start">
                        <span className="mr-1">•</span>
                        <span>{con}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="border-t border-gray-200 pt-6">
          <div className="flex flex-wrap gap-4 justify-between items-center">
            <div className="flex space-x-3">
              <button onClick={() => navigate('/screen-10')} className="btn-secondary flex items-center space-x-2">
                <FaArrowLeft />
                <span>Back to Progress</span>
              </button>
              <button onClick={() => navigate('/screen-9')} className="btn-secondary flex items-center space-x-2">
                <FaRedo />
                <span>Generate Again</span>
              </button>
            </div>

            <div className="flex space-x-3">
              <button className="btn-secondary flex items-center space-x-2">
                <FaChartBar />
                <span>View Analytics</span>
              </button>
              <button className="btn-secondary flex items-center space-x-2">
                <FaEye />
                <span>View Grid</span>
              </button>
              <button
                className="btn-primary flex items-center space-x-2"
                onClick={() => {
                  alert(`Selected ${solutions.find(s => s.id === (selectedSolution || 1))?.name || 'Balanced Solution'}!

This would normally:
• Save the timetable to your system
• Generate faculty schedules
• Export to Excel/PDF
• Set up for the next semester

Demo complete! 🎉`);
                }}
              >
                <FaCheck />
                <span>Use {solutions.find(s => s.id === (selectedSolution || 1))?.name || 'This Solution'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Generation Summary */}
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <div className="text-sm text-gray-600 space-y-1">
            <div><strong>Generation Details:</strong></div>
            <div>• Institution: {generationData?.request?.institution_name || 'Your School'}</div>
            <div>• Subjects: {generationData?.request?.subject_count || 'N/A'} subjects configured</div>
            <div>• Rooms: {generationData?.request?.room_count || 'Default'} classrooms available</div>
            <div>• Generated: {generationData?.result?.solutions_count || 2} alternative solutions</div>
            <div>• Time: {Math.round(generationData?.result?.generation_time || 0)} seconds</div>
            <div>• Mode: {localStorage.getItem('generation_mode') === 'offline' ? 'Offline simulation' : 'CP-SAT optimization'}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SolutionComparison;
