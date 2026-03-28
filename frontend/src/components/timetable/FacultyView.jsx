import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaArrowLeft, FaCalendarAlt, FaUserTie, FaGraduationCap, FaChartBar, FaFileExcel, FaPrint } from 'react-icons/fa';
import { useOnboardingStore } from '../../store';
import { simpleTimetableAPI } from '../../api/client';
import toast from 'react-hot-toast';

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

const NAV_TABS = [
  { id: 'class', icon: <FaCalendarAlt />, label: 'Class', path: '/timetable' },
  { id: 'faculty', icon: <FaUserTie />, label: 'Faculty', path: '/faculty-view' },
  { id: 'student', icon: <FaGraduationCap />, label: 'Student', path: '/student-view' },
  { id: 'analytics', icon: <FaChartBar />, label: 'Analytics', path: '/analytics' },
];

const FacultyView = () => {
  const navigate = useNavigate();
  const { generatedTimetable, institutionData } = useOnboardingStore();
  const [exporting, setExporting] = useState(false);

  if (!generatedTimetable) {
    return (
      <div className="max-w-4xl mx-auto text-center py-20">
        <div className="text-6xl mb-4">👩‍🏫</div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">No Timetable</h2>
        <p className="text-gray-500 mb-6">Generate a timetable first.</p>
        <button onClick={() => navigate('/screen-1')}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">
          Go to Setup
        </button>
      </div>
    );
  }

  const { assignments = [], working_days = [], time_slots = [], stats = {} } = generatedTimetable;

  const teachers = [...new Set(assignments.map(a => a.teacher_name))].sort();
  const allSubjects = [...new Set(assignments.map(a => a.subject_code))];
  const subjectColors = {};
  allSubjects.forEach((code, i) => { subjectColors[code] = COLORS[i % COLORS.length]; });

  const [selectedTeacher, setSelectedTeacher] = useState(teachers[0] || '');

  const teacherAssignments = assignments.filter(a => a.teacher_name === selectedTeacher);
  const grid = {};
  working_days.forEach(day => { grid[day] = {}; });
  teacherAssignments.forEach(a => {
    if (!grid[a.day]) grid[a.day] = {};
    grid[a.day][a.period] = a;
  });

  const periods = time_slots.map((s, i) => ({ period: i + 1, ...s }));
  const totalPeriodsThisWeek = teacherAssignments.length;
  const subjectsTaught = [...new Set(teacherAssignments.map(a => a.subject_code))];
  const classesTaught = [...new Set(teacherAssignments.map(a => a.class_name))];

  const handleExportExcel = async () => {
    setExporting(true);
    const toastId = toast.loading('Generating Excel file…');
    try {
      const res = await simpleTimetableAPI.exportExcel({
        institution_name: institutionData?.name || 'My School',
        assignments, working_days, time_slots, stats,
      });
      const url = URL.createObjectURL(res.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${(institutionData?.name || 'Timetable').replace(/ /g, '_')}_Timetable.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.success('Excel downloaded!', { id: toastId });
    } catch {
      toast.error('Export failed. Is the backend running?', { id: toastId });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto">
      {/* Print header */}
      <div className="hidden print:block text-center mb-4">
        <h1 className="text-2xl font-bold">{institutionData?.name || 'School'} — Faculty Timetable</h1>
        <p className="text-sm text-gray-500">Teacher: {selectedTeacher}</p>
      </div>

      {/* Header */}
      <div className="bg-white rounded-2xl shadow-lg p-6 mb-4 print:hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <FaUserTie className="text-purple-600" /> Faculty Timetable
            </h1>
            <p className="text-gray-500 text-sm mt-1">{teachers.length} teachers • {assignments.length} total assignments</p>
          </div>

          {/* Nav tabs */}
          <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
            {NAV_TABS.map(tab => (
              <button key={tab.id} onClick={() => navigate(tab.path)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  tab.id === 'faculty' ? 'bg-white shadow text-purple-600' : 'text-gray-600 hover:text-gray-800'
                }`}>
                {tab.icon}{tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Teacher Selector */}
      <div className="bg-white rounded-2xl shadow-lg p-4 mb-4 print:hidden">
        <label className="text-sm font-semibold text-gray-700 mb-2 block">Select Teacher:</label>
        <div className="flex flex-wrap gap-2">
          {teachers.map(teacher => (
            <button key={teacher} onClick={() => setSelectedTeacher(teacher)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedTeacher === teacher
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}>
              {teacher}
            </button>
          ))}
        </div>

        {selectedTeacher && (
          <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-gray-100 text-sm">
            <div><span className="text-gray-500">Periods/week: </span><strong className="text-purple-700">{totalPeriodsThisWeek}</strong></div>
            <div><span className="text-gray-500">Subjects: </span><strong className="text-purple-700">{subjectsTaught.join(', ')}</strong></div>
            <div><span className="text-gray-500">Classes: </span><strong className="text-purple-700">{classesTaught.join(', ')}</strong></div>
          </div>
        )}
      </div>

      {/* Grid */}
      <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead>
              <tr className="bg-purple-900 text-white">
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
                    const a = grid[day]?.[slot.period];
                    return (
                      <td key={day} className="px-2 py-2 text-center border-r border-gray-100">
                        {a ? (
                          <div className={`rounded-lg border px-2 py-1.5 text-xs ${subjectColors[a.subject_code] || COLORS[0]}`}>
                            <div className="font-semibold">{a.subject_code}</div>
                            <div className="text-xs opacity-80">{a.class_name}</div>
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
      </div>

      {/* Actions */}
      <div className="mt-4 flex flex-wrap justify-between items-center gap-3 print:hidden">
        <button onClick={() => navigate('/timetable')}
          className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 text-sm">
          <FaArrowLeft size={12} /> Class View
        </button>
        <div className="flex flex-wrap gap-2">
          <button onClick={handleExportExcel} disabled={exporting}
            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium disabled:opacity-60">
            <FaFileExcel /> {exporting ? 'Exporting…' : 'Export Excel'}
          </button>
          <button onClick={() => window.print()}
            className="flex items-center gap-2 px-5 py-2.5 bg-slate-600 text-white rounded-lg hover:bg-slate-700 text-sm font-medium">
            <FaPrint /> Print
          </button>
          <button onClick={() => navigate('/student-view')}
            className="px-5 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium">
            → Student View
          </button>
        </div>
      </div>

      <style>{`
        @media print {
          body * { visibility: hidden; }
          .max-w-7xl, .max-w-7xl * { visibility: visible; }
          .max-w-7xl { position: absolute; left: 0; top: 0; width: 100%; }
          .print\\:hidden { display: none !important; }
          .print\\:block { display: block !important; }
        }
      `}</style>
    </div>
  );
};

export default FacultyView;
