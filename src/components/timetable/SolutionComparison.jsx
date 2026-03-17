import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaCheckCircle, FaStar, FaCheck, FaEye, FaChartBar, FaRedo } from 'react-icons/fa';

const SolutionComparison = () => {
  const navigate = useNavigate();
  const [selectedSolution, setSelectedSolution] = useState(null);

  const solutions = [
    {
      id: 1,
      name: 'Balanced',
      score: 10623,
      isBest: true,
      metrics: {
        roomUtilization: { value: 91, unit: '%', isBest: false },
        workloadBalance: { value: 1.5, unit: 'σ', isBest: false },
        studentGaps: { value: 32, unit: 'hrs', isBest: false },
        facultyPreferences: { value: '18/22', isBest: false },
        conflicts: { value: 0, unit: '', isBest: true }
      },
      pros: [
        'Best overall score',
        'Good room utilization (91%)',
        'Well-balanced faculty workload',
        'Reasonable student schedules'
      ],
      cons: [
        'Not the absolute best in any single category'
      ],
      bestFor: 'Most institutions',
      color: 'primary'
    },
    {
      id: 2,
      name: 'Room-Focused',
      score: 10589,
      metrics: {
        roomUtilization: { value: 94, unit: '%', isBest: true },
        workloadBalance: { value: 2.8, unit: 'σ', isBest: false },
        studentGaps: { value: 58, unit: 'hrs', isBest: false },
        facultyPreferences: { value: '14/22', isBest: false },
        conflicts: { value: 0, unit: '', isBest: true }
      },
      pros: [
        'Highest room utilization (94%)',
        'Fewer rooms needed (can save unused rooms)'
      ],
      cons: [
        'More student gaps (58 hours/week)',
        'Less balanced faculty workload'
      ],
      bestFor: 'Institutions with limited room availability',
      color: 'blue'
    },
    {
      id: 3,
      name: 'Faculty Friendly',
      score: 10512,
      metrics: {
        roomUtilization: { value: 84, unit: '%', isBest: false },
        workloadBalance: { value: 0.9, unit: 'σ', isBest: true },
        studentGaps: { value: 28, unit: 'hrs', isBest: true },
        facultyPreferences: { value: '20/22', isBest: true },
        conflicts: { value: 0, unit: '', isBest: true }
      },
      pros: [
        'Most balanced faculty workload (σ = 0.9)',
        'Most faculty preferences matched (20/22)',
        'Least student gaps (28 hours)'
      ],
      cons: [
        'Lower room utilization (84%)'
      ],
      bestFor: 'Institutions prioritizing faculty happiness',
      color: 'green'
    }
  ];

  const selectSolution = (solutionId) => {
    setSelectedSolution(solutionId);
    navigate('/timetable/grid');
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="card">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-4">
            <FaCheckCircle className="text-4xl text-green-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Timetable Generation Complete! ✓</h1>
          <p className="text-gray-600">Generated 3 optimized timetables. Compare and choose:</p>
        </div>

        {/* Comparison Table */}
        <div className="overflow-x-auto mb-8">
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Metric</th>
                  <th className="px-6 py-4 text-center text-sm font-semibold text-primary-700">
                    Solution 1<br />Balanced
                  </th>
                  <th className="px-6 py-4 text-center text-sm font-semibold text-blue-700">
                    Solution 2<br />Room-Focused
                  </th>
                  <th className="px-6 py-4 text-center text-sm font-semibold text-green-700">
                    Solution 3<br />Faculty
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                <tr className="bg-yellow-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">Overall Score</td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center space-x-2">
                      <span className="text-lg font-bold text-primary-600">10,623</span>
                      <FaStar className="text-yellow-500" />
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center text-lg font-bold text-gray-700">10,589</td>
                  <td className="px-6 py-4 text-center text-lg font-bold text-gray-700">10,512</td>
                </tr>
                <tr>
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900">Room Utilization</div>
                    <div className="text-xs text-gray-500">(Higher is better)</div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center space-x-2">
                      <span className="font-semibold text-gray-900">91%</span>
                      <FaCheck className="text-green-500" />
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center space-x-2">
                      <span className="font-semibold text-gray-900">94%</span>
                      <FaStar className="text-yellow-500" />
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="font-semibold text-gray-700">84%</span>
                  </td>
                </tr>
                <tr className="bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900">Workload Balance</div>
                    <div className="text-xs text-gray-500">(Lower is better)</div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center space-x-2">
                      <span className="font-semibold text-gray-900">σ = 1.5</span>
                      <FaCheck className="text-green-500" />
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="font-semibold text-gray-700">σ = 2.8</span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center space-x-2">
                      <span className="font-semibold text-gray-900">σ = 0.9</span>
                      <FaStar className="text-yellow-500" />
                    </div>
                  </td>
                </tr>
                <tr>
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900">Student Gaps</div>
                    <div className="text-xs text-gray-500">(Total per week)</div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center space-x-2">
                      <span className="font-semibold text-gray-900">32 hrs</span>
                      <FaCheck className="text-green-500" />
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="font-semibold text-gray-700">58 hrs</span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center space-x-2">
                      <span className="font-semibold text-gray-900">28 hrs</span>
                      <FaStar className="text-yellow-500" />
                    </div>
                  </td>
                </tr>
                <tr className="bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900">Faculty Preferences</div>
                    <div className="text-xs text-gray-500">Matched</div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center space-x-2">
                      <span className="font-semibold text-gray-900">18/22</span>
                      <FaCheck className="text-green-500" />
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="font-semibold text-gray-700">14/22</span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center space-x-2">
                      <span className="font-semibold text-gray-900">20/22</span>
                      <FaStar className="text-yellow-500" />
                    </div>
                  </td>
                </tr>
                <tr>
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900">Conflicts</div>
                    <div className="text-xs text-gray-500">(Must be zero)</div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center space-x-2">
                      <span className="font-semibold text-green-600">0</span>
                      <FaCheck className="text-green-500" />
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center space-x-2">
                      <span className="font-semibold text-green-600">0</span>
                      <FaCheck className="text-green-500" />
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center space-x-2">
                      <span className="font-semibold text-green-600">0</span>
                      <FaCheck className="text-green-500" />
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex items-center justify-end space-x-4 text-sm">
            <div className="flex items-center space-x-2">
              <FaStar className="text-yellow-500" />
              <span>= Best in category</span>
            </div>
            <div className="flex items-center space-x-2">
              <FaCheck className="text-green-500" />
              <span>= Good</span>
            </div>
          </div>
        </div>

        {/* Detailed Solutions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {solutions.map((solution) => (
            <div
              key={solution.id}
              className={`bg-white border-2 rounded-xl p-6 ${
                solution.isBest ? `border-${solution.color}-500 shadow-lg` : 'border-gray-200'
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">{solution.name}</h3>
                  {solution.isBest && (
                    <span className="inline-block mt-1 px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-semibold rounded">
                      Recommended
                    </span>
                  )}
                </div>
              </div>

              <div className="mb-4">
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Pros:</h4>
                <ul className="space-y-1">
                  {solution.pros.map((pro, index) => (
                    <li key={index} className="text-sm text-gray-600 flex items-start">
                      <span className="text-green-500 mr-2">✓</span>
                      <span>{pro}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mb-4">
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Cons:</h4>
                <ul className="space-y-1">
                  {solution.cons.map((con, index) => (
                    <li key={index} className="text-sm text-gray-600 flex items-start">
                      <span className="text-gray-400 mr-2">•</span>
                      <span>{con}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                <div className="text-xs text-gray-600 mb-1">Best for:</div>
                <div className="text-sm font-medium text-gray-900">{solution.bestFor}</div>
              </div>

              <div className="flex space-x-2">
                <button
                  onClick={() => selectSolution(solution.id)}
                  className={`flex-1 px-4 py-2 bg-${solution.color}-600 text-white rounded-lg hover:bg-${solution.color}-700 transition-colors font-medium flex items-center justify-center space-x-2`}
                >
                  <FaCheck />
                  <span>Select & Edit</span>
                </button>
                <button className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors">
                  <FaEye />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex justify-center">
          <button className="btn-secondary flex items-center space-x-2">
            <FaRedo />
            <span>Regenerate with Different Settings</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default SolutionComparison;
