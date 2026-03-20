import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaCalendarAlt, FaUserTie, FaGraduationCap, FaArrowLeft } from 'react-icons/fa';
import { useOnboardingStore } from '../../store';

const TimetableGrid = () => {
  const navigate = useNavigate();
  const { generatedTimetable, institutionData, timeData } = useOnboardingStore();

  const [activeView, setActiveView] = useState('master'); // 'master' | 'faculty' | 'student'

  if (!generatedTimetable) {
    return (
      <div className="max-w-4xl mx-auto text-center py-20">
        <div className="text-6xl mb-4">📅</div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">No Timetable Generated</h2>
        <p className="text-gray-500 mb-6">Complete the setup and generate a timetable first.</p>
        <button onClick={() => navigate('/screen-6')}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">
          Go to Setup
        </button>
      </div>
    );
  }

  const { assignments = [], working_days = [], time_slots = [], stats = {} } = generatedTimetable;

  // Get unique classes and compute their grids
  const classes = [...new Set(assignments.map(a => a.class_name))].sort();

  // Color map for subjects
  const COLORS = [
    'bg-blue-100 text-blue-800 border-blue-200',
    'bg-green-100 text-green-800 border-green-200',
    'bg-purple-100 text-purple-800 border-purple-200',
    'bg-orange-100 text-orange-800 border-orange-200',
    'bg-pink-100 text-pink-800 border-pink-200',
    'bg-yellow-100 text-yellow-800 border-yellow-200',
    'bg-teal-100 text-teal-800 border-teal-200',
    'bg-indigo-100 text-indigo-800 border-indigo-200',
  ];
  const allSubjects = [...new Set(assignments.map(a => a.subject_code))];
  const subjectColors = {};
  allSubjects.forEach((code, i) => { subjectColors[code] = COLORS[i % COLORS.length]; });

  // Build grid for a specific class
  const buildClassGrid = (className) => {
    const grid = {};
    working_days.forEach(day => { grid[day] = {}; });
    assignments.filter(a => a.class_name === className).forEach(a => {
      if (!grid[a.day]) grid[a.day] = {};
      grid[a.day][a.period] = a;
    });
    return grid;
  };

  const [selectedClass, setSelectedClass] = useState(classes[0] || '');
  const classGrid = buildClassGrid(selectedClass);

  const periods = time_slots.map((s, i) => ({ period: i + 1, ...s }));

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="bg-white rounded-2xl shadow-lg p-6 mb-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              📅 {institutionData?.name || 'School'} Timetable
            </h1>
            <p className="text-gray-500 text-sm mt-1">
              Generated with CP-SAT • {stats.total_assignments} assignments • {stats.solve_time_seconds}s solve time
            </p>
          </div>

          {/* View Tabs */}
          <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
            {[
              { id: 'master', icon: <FaCalendarAlt />, label: 'Class View' },
              { id: 'faculty', icon: <FaUserTie />, label: 'Faculty View' },
            ].map(tab => (
              <button key={tab.id} onClick={() => navigate(tab.id === 'faculty' ? '/faculty-view' : '/timetable')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeView === tab.id ? 'bg-white shadow text-blue-600' : 'text-gray-600 hover:text-gray-800'
                }`}>
                {tab.icon}{tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Class Selector */}
      {classes.length > 1 && (
        <div className="flex gap-2 mb-4 flex-wrap">
          {classes.map(cls => (
            <button key={cls} onClick={() => setSelectedClass(cls)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedClass === cls ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}>
              {cls}
            </button>
          ))}
        </div>
      )}

      {/* Timetable Grid */}
      <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead>
              <tr className="bg-gray-900 text-white">
                <th className="w-28 px-4 py-3 text-left text-sm font-medium">Period</th>
                {working_days.map(day => (
                  <th key={day} className="px-3 py-3 text-center text-sm font-medium">{day.slice(0, 3)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {periods.map((slot, pi) => (
                <tr key={pi} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-2 bg-gray-50 border-r border-gray-100">
                    <div className="text-xs font-semibold text-gray-700">P{slot.period}</div>
                    <div className="text-xs text-gray-400 font-mono">{slot.start}–{slot.end}</div>
                  </td>
                  {working_days.map(day => {
                    const a = classGrid[day]?.[slot.period];
                    return (
                      <td key={day} className="px-2 py-2 text-center border-r border-gray-100">
                        {a ? (
                          <div className={`rounded-lg border px-2 py-1.5 text-xs ${subjectColors[a.subject_code] || COLORS[0]}`}>
                            <div className="font-semibold">{a.subject_code}</div>
                            <div className="text-xs opacity-80 truncate mt-0.5">{a.teacher_name}</div>
                            <div className="text-xs opacity-70">{a.room_name}</div>
                          </div>
                        ) : (
                          <div className="text-gray-200 text-xs py-1">—</div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Legend */}
        <div className="p-4 border-t border-gray-100 bg-gray-50">
          <div className="flex flex-wrap gap-2">
            {allSubjects.map(code => {
              const subj = assignments.find(a => a.subject_code === code);
              return (
                <span key={code} className={`px-3 py-1 rounded-full text-xs font-medium border ${subjectColors[code]}`}>
                  {code} — {subj?.subject_name}
                </span>
              );
            })}
          </div>
        </div>
      </div>

      {/* Action bar */}
      <div className="mt-4 flex justify-between items-center">
        <button onClick={() => navigate('/screen-6')}
          className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 text-sm">
          <FaArrowLeft size={12} /> Back to Setup
        </button>
        <div className="flex gap-3">
          <button onClick={() => navigate('/faculty-view')}
            className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium">
            <FaUserTie /> Faculty View
          </button>
          <button onClick={() => navigate('/student-view')}
            className="flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium">
            <FaGraduationCap /> Student View
          </button>
        </div>
      </div>
    </div>
  );
};

export default TimetableGrid;
