import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaArrowRight, FaArrowLeft, FaCheck } from 'react-icons/fa';
import { useOnboardingStore } from '../../store';

const steps = ['Institution', 'Subjects', 'Schedule', 'Rooms', 'Rules', 'Generate'];

const ProgressBar = ({ current, total, steps: stepLabels }) => (
  <div className="mb-8">
    <div className="flex justify-between mb-2">
      {stepLabels.map((label, i) => (
        <div key={i} className="flex flex-col items-center">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
            i + 1 < current ? 'bg-green-500 text-white' :
            i + 1 === current ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'
          }`}>{i + 1 < current ? '✓' : i + 1}</div>
          <span className="text-xs text-gray-500 mt-1 hidden md:block">{label}</span>
        </div>
      ))}
    </div>
    <div className="w-full bg-gray-200 h-2 rounded-full">
      <div className="bg-blue-600 h-2 rounded-full transition-all" style={{ width: `${((current - 1) / (total - 1)) * 100}%` }} />
    </div>
  </div>
);

const Constraints = () => {
  const navigate = useNavigate();
  const { setConstraintsData } = useOnboardingStore();

  const [constraints, setConstraints] = useState({
    max_consecutive_periods: 3,
    lunch_after_period: 4,
    max_periods_per_day_per_teacher: 6,
  });

  const update = (key, val) => setConstraints({ ...constraints, [key]: val });

  const handleFinish = () => {
    setConstraintsData(constraints);
    navigate('/screen-6');
  };

  const HARD_CONSTRAINTS = [
    'No teacher teaches two classes at the same time',
    'No room hosts two classes at the same time',
    'No class has two subjects at the same time',
    'Each subject gets the correct number of periods per week',
  ];

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-2xl shadow-lg p-8">
        <ProgressBar current={5} total={6} steps={steps} />

        <h2 className="text-2xl font-bold text-gray-800 mb-1">Scheduling Rules</h2>
        <p className="text-gray-500 mb-6">These rules guide the timetable generator. Hard constraints are always enforced automatically.</p>

        {/* Hard constraints - always enforced */}
        <div className="bg-green-50 border border-green-200 rounded-xl p-5 mb-6">
          <h3 className="font-semibold text-green-900 mb-3 flex items-center gap-2">
            <FaCheck className="text-green-600" /> Automatically Enforced Hard Constraints
          </h3>
          <div className="space-y-2">
            {HARD_CONSTRAINTS.map((c, i) => (
              <div key={i} className="flex items-center gap-2 text-green-800 text-sm">
                <FaCheck className="text-green-500 flex-shrink-0" size={12} />
                {c}
              </div>
            ))}
          </div>
        </div>

        {/* Soft / configurable constraints */}
        <div className="space-y-5">
          <h3 className="font-semibold text-gray-800">Configurable Rules</h3>

          {/* Max consecutive */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-gray-800">Max Consecutive Periods (per teacher)</div>
                <div className="text-sm text-gray-500 mt-0.5">How many periods a teacher can teach in a row without a break</div>
              </div>
              <select value={constraints.max_consecutive_periods}
                onChange={e => update('max_consecutive_periods', parseInt(e.target.value))}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500">
                {[2, 3, 4, 5].map(n => <option key={n} value={n}>{n} periods</option>)}
              </select>
            </div>
          </div>

          {/* Lunch break */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-gray-800">Lunch Break After Period</div>
                <div className="text-sm text-gray-500 mt-0.5">Set to 0 to disable. Must match the schedule structure you set earlier.</div>
              </div>
              <input type="number" value={constraints.lunch_after_period}
                onChange={e => update('lunch_after_period', parseInt(e.target.value) || 0)}
                min="0" max="14"
                className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 text-center" />
            </div>
          </div>

          {/* Max periods per teacher per day */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-gray-800">Max Teaching Periods Per Day</div>
                <div className="text-sm text-gray-500 mt-0.5">Maximum periods any teacher should teach in a single day</div>
              </div>
              <select value={constraints.max_periods_per_day_per_teacher}
                onChange={e => update('max_periods_per_day_per_teacher', parseInt(e.target.value))}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500">
                {[4, 5, 6, 7, 8].map(n => <option key={n} value={n}>{n} periods</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-800">
          💡 The CP-SAT optimizer will try to respect all these rules while fitting all subjects into the available time slots.
          Advanced features like teacher preferences, weighted objectives, and lab scheduling will be added later.
        </div>

        <div className="flex justify-between mt-8 pt-6 border-t border-gray-200">
          <button onClick={() => navigate('/screen-4')}
            className="flex items-center space-x-2 px-5 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors">
            <FaArrowLeft />
            <span>Back</span>
          </button>
          <button onClick={handleFinish}
            className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors">
            <span>Review & Generate</span>
            <FaArrowRight />
          </button>
        </div>
      </div>
    </div>
  );
};

export default Constraints;
