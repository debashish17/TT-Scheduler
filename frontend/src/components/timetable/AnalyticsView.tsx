import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FaChartBar, FaCalendarAlt, FaUserTie, FaGraduationCap,
  FaFileExcel, FaPrint, FaArrowLeft, FaClock, FaBook, FaDoorOpen
} from 'react-icons/fa';
import { useOnboardingStore } from '../../store';
import { simpleTimetableAPI } from '../../api/client';
import toast from 'react-hot-toast';

const NAV_TABS = [
  { id: 'class', icon: <FaCalendarAlt />, label: 'Class', path: '/timetable' },
  { id: 'faculty', icon: <FaUserTie />, label: 'Faculty', path: '/faculty-view' },
  { id: 'student', icon: <FaGraduationCap />, label: 'Student', path: '/student-view' },
  { id: 'analytics', icon: <FaChartBar />, label: 'Analytics', path: '/analytics' },
];

// Mini bar for visualising a % or count quickly
const MiniBar = ({ value, max, color = 'bg-blue-500' }: { value: number, max: number, color?: string }) => {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
      <div className={`${color} h-1.5 rounded-full transition-all`} style={{ width: `${pct}%` }} />
    </div>
  );
};

const StatCard = ({ icon, label, value, sub, color = 'text-blue-600', bg = 'bg-blue-50' }: { icon: React.ReactNode, label: React.ReactNode, value: React.ReactNode, sub?: React.ReactNode, color?: string, bg?: string }) => (
  <div className={`${bg} rounded-2xl p-5 flex items-start gap-4`}>
    <div className={`text-2xl ${color} mt-0.5`}>{icon}</div>
    <div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      <div className="text-sm font-medium text-gray-600">{label}</div>
      {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
    </div>
  </div>
);

const AnalyticsView = () => {
  const navigate = useNavigate();
  const { generatedTimetable, institutionData } = useOnboardingStore();
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState(null);

  // Compute analytics from backend
  useEffect(() => {
    if (!generatedTimetable) return;
    setLoading(true);
    setError(null);
    simpleTimetableAPI.getAnalytics(generatedTimetable)
      .then(res => setAnalytics(res.data))
      .catch(err => {
        console.warn('Backend analytics failed, computing locally', err);
        // Fallback: compute client-side
        setAnalytics(computeLocalAnalytics(generatedTimetable));
      })
      .finally(() => setLoading(false));
  }, [generatedTimetable]);

  if (!generatedTimetable) {
    return (
      <div className="max-w-4xl mx-auto text-center py-20">
        <div className="text-6xl mb-4">📊</div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">No Timetable Data</h2>
        <p className="text-gray-500 mb-6">Generate a timetable first to view analytics.</p>
        <button onClick={() => navigate('/screen-1')}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">
          Go to Setup
        </button>
      </div>
    );
  }

  const handleExportExcel = async () => {
    setExporting(true);
    const tid = toast.loading('Generating Excel…');
    try {
      const { assignments, working_days, time_slots, stats } = generatedTimetable;
      const res = await simpleTimetableAPI.exportExcel({
        institution_name: institutionData?.name || 'My School',
        assignments, working_days, time_slots, stats,
      });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(institutionData?.name || 'Timetable').replace(/ /g, '_')}_Timetable.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success('Downloaded!', { id: tid });
    } catch {
      toast.error('Export failed.', { id: tid });
    } finally {
      setExporting(false);
    }
  };

  const { stats = {}, working_days = [], time_slots = [] } = generatedTimetable;
  const solverLabel = stats.solver || generatedTimetable.solver || 'CP-SAT';
  const solveTime = stats.solve_time_seconds ?? generatedTimetable.solve_time ?? '—';

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="bg-white rounded-2xl shadow-lg p-6 mb-6 print:hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <FaChartBar className="text-blue-600" /> Timetable Analytics
            </h1>
            <p className="text-gray-500 text-sm mt-1">
              {institutionData?.name || 'School'} — Real data from {solverLabel} solver
            </p>
          </div>
          <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
            {NAV_TABS.map(tab => (
              <button key={tab.id} onClick={() => navigate(tab.path)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  tab.id === 'analytics' ? 'bg-white shadow text-blue-600' : 'text-gray-600 hover:text-gray-800'
                }`}>
                {tab.icon}{tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin h-10 w-10 rounded-full border-4 border-blue-600 border-t-transparent" />
          <span className="ml-3 text-gray-500">Computing analytics…</span>
        </div>
      )}

      {!loading && analytics && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
            <StatCard icon={<FaCalendarAlt />} label="Assignments" value={analytics.summary.total_assignments} bg="bg-blue-50" color="text-blue-600" />
            <StatCard icon={<FaGraduationCap />} label="Classes" value={analytics.summary.classes_count} bg="bg-green-50" color="text-green-600" />
            <StatCard icon={<FaUserTie />} label="Teachers" value={analytics.summary.teachers_count} bg="bg-purple-50" color="text-purple-600" />
            <StatCard icon={<FaBook />} label="Subjects" value={analytics.summary.subjects_count} bg="bg-orange-50" color="text-orange-600" />
            <StatCard icon={<FaDoorOpen />} label="Rooms" value={analytics.summary.rooms_count} bg="bg-pink-50" color="text-pink-600" />
            <StatCard icon={<FaClock />} label="Solve Time" value={`${solveTime}s`} sub={solverLabel} bg="bg-slate-50" color="text-slate-600" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Teacher Workload */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                <FaUserTie className="text-purple-500" /> Teacher Workload
              </h2>
              <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                {analytics.teacher_workload.map((t, i) => (
                  <div key={i} className="rounded-xl border border-gray-100 p-3 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-gray-800 text-sm">{t.teacher_name}</span>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                          t.overloaded ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                        }`}>
                          {t.periods_per_week} periods
                        </span>
                        {t.overloaded && <span className="text-xs text-red-500">⚠ High</span>}
                      </div>
                    </div>
                    <MiniBar value={t.periods_per_week} max={working_days.length * (time_slots.length || 7)} color="bg-purple-400" />
                    <div className="text-xs text-gray-400 mt-1">
                      {t.subjects.join(' · ')} • {t.classes.join(', ')}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Subject Distribution */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                <FaBook className="text-orange-500" /> Subject Distribution
              </h2>
              <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                {analytics.subject_distribution.map((s, i) => {
                  const maxPeriods = Math.max(...analytics.subject_distribution.map(x => x.total_periods));
                  return (
                    <div key={i} className="rounded-xl border border-gray-100 p-3 hover:bg-gray-50 transition-colors">
                      <div className="flex items-center justify-between mb-1">
                        <div>
                          <span className="font-semibold text-gray-800 text-sm">{s.subject_code}</span>
                          <span className="text-gray-500 text-xs ml-2">{s.subject_name}</span>
                        </div>
                        <span className="text-xs font-bold text-orange-600">{s.total_periods} periods</span>
                      </div>
                      <MiniBar value={s.total_periods} max={maxPeriods} color="bg-orange-400" />
                      <div className="text-xs text-gray-400 mt-1">
                        {s.classes_covered} class(es) • avg {s.avg_periods_per_class}/class
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Room Usage */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                <FaDoorOpen className="text-pink-500" /> Room Utilisation
              </h2>
              <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                {analytics.room_usage.map((r, i) => (
                  <div key={i} className="rounded-xl border border-gray-100 p-3 hover:bg-gray-50">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-gray-800 text-sm">{r.room_name}</span>
                      <span className="text-xs font-bold text-pink-600">
                        {r.assignments} sessions ({r.utilization_pct}%)
                      </span>
                    </div>
                    <MiniBar value={r.utilization_pct} max={100} color={
                      r.utilization_pct > 80 ? 'bg-red-400' : r.utilization_pct > 50 ? 'bg-yellow-400' : 'bg-pink-400'
                    } />
                  </div>
                ))}
              </div>
            </div>

            {/* Day Load */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                <FaCalendarAlt className="text-blue-500" /> Session Load per Day
              </h2>
              <div className="space-y-4">
                {analytics.day_load.map((d, i) => {
                  const maxSessions = Math.max(...analytics.day_load.map(x => x.sessions));
                  return (
                    <div key={i}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-gray-700">{d.day}</span>
                        <span className="text-sm font-bold text-blue-600">{d.sessions} sessions</span>
                      </div>
                      <MiniBar value={d.sessions} max={maxSessions} color="bg-blue-400" />
                    </div>
                  );
                })}
              </div>

              {/* Solver info */}
              <div className="mt-6 pt-4 border-t border-gray-100">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="text-gray-500 text-xs">Solver</div>
                    <div className="font-bold text-gray-800">{analytics.summary.solver}</div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="text-gray-500 text-xs">Status</div>
                    <div className="font-bold text-green-700">{analytics.summary.solver_status}</div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="text-gray-500 text-xs">Solve Time</div>
                    <div className="font-bold text-gray-800">{analytics.summary.solve_time_seconds}s</div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="text-gray-500 text-xs">Periods/Day</div>
                    <div className="font-bold text-gray-800">{analytics.summary.periods_per_day}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Actions */}
      <div className="mt-4 flex flex-wrap justify-between items-center gap-3 print:hidden">
        <button onClick={() => navigate('/timetable')}
          className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 text-sm">
          <FaArrowLeft size={12} /> Back to Timetable
        </button>
        <div className="flex gap-2">
          <button onClick={handleExportExcel} disabled={exporting}
            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium disabled:opacity-60">
            <FaFileExcel /> {exporting ? 'Exporting…' : 'Export Excel'}
          </button>
          <button onClick={() => window.print()}
            className="flex items-center gap-2 px-5 py-2.5 bg-slate-600 text-white rounded-lg hover:bg-slate-700 text-sm font-medium">
            <FaPrint /> Print
          </button>
        </div>
      </div>

      <style>{`
        @media print {
          body * { visibility: hidden; }
          .max-w-7xl, .max-w-7xl * { visibility: visible; }
          .max-w-7xl { position: absolute; left: 0; top: 0; width: 100%; }
          .print\\:hidden { display: none !important; }
        }
      `}</style>
    </div>
  );
};

// Fallback: compute analytics locally if backend is unreachable
function computeLocalAnalytics(timetable) {
  const { assignments = [], working_days = [], time_slots = [], stats = {}, solver = 'CP-SAT', status = 'FEASIBLE', solve_time = 0 } = timetable;

  const teacherMap: Record<string, { periods_per_week: number, subjects: Set<string>, classes: Set<string> }> = {};
  const subjMap: Record<string, { name: string, total: number, classes: Set<string> }> = {};
  const roomMap: Record<string, number> = {};
  const dayMap: Record<string, number> = {};

  for (const a of assignments) {
    // Teacher
    if (!teacherMap[a.teacher_name]) teacherMap[a.teacher_name] = { periods_per_week: 0, subjects: new Set(), classes: new Set() };
    teacherMap[a.teacher_name].periods_per_week++;
    teacherMap[a.teacher_name].subjects.add(a.subject_code);
    teacherMap[a.teacher_name].classes.add(a.class_name);

    // Subject
    if (!subjMap[a.subject_code]) subjMap[a.subject_code] = { name: a.subject_name || a.subject_code, total: 0, classes: new Set() };
    subjMap[a.subject_code].total++;
    subjMap[a.subject_code].classes.add(a.class_name);

    // Room
    roomMap[a.room_name] = (roomMap[a.room_name] || 0) + 1;

    // Day
    dayMap[a.day] = (dayMap[a.day] || 0) + 1;
  }

  const totalWeekSlots = working_days.length * (time_slots.length || 7);
  const teacher_workload = Object.entries(teacherMap).sort().map(([t, d]) => ({
    teacher_name: t,
    periods_per_week: d.periods_per_week,
    subjects: [...d.subjects].sort(),
    classes: [...d.classes].sort(),
    utilization_pct: Math.round(d.periods_per_week / Math.max(totalWeekSlots, 1) * 100),
    overloaded: d.periods_per_week > totalWeekSlots * 0.8,
  }));

  const subject_distribution = Object.entries(subjMap).sort().map(([code, d]) => ({
    subject_code: code,
    subject_name: d.name,
    total_periods: d.total,
    classes_covered: d.classes.size,
    avg_periods_per_class: Math.round(d.total / Math.max(d.classes.size, 1) * 10) / 10,
  }));

  const room_usage = Object.entries(roomMap).sort((a, b) => b[1] - a[1]).map(([r, cnt]) => ({
    room_name: r,
    assignments: cnt,
    utilization_pct: Math.round(cnt / Math.max(totalWeekSlots, 1) * 100 * 10) / 10,
  }));

  const day_load = working_days.map(d => ({ day: d, sessions: dayMap[d] || 0 }));

  return {
    summary: {
      total_assignments: assignments.length,
      classes_count: new Set(assignments.map(a => a.class_name)).size,
      teachers_count: Object.keys(teacherMap).length,
      subjects_count: Object.keys(subjMap).length,
      rooms_count: Object.keys(roomMap).length,
      working_days_count: working_days.length,
      periods_per_day: time_slots.length,
      solver,
      solver_status: status,
      solve_time_seconds: solve_time,
    },
    teacher_workload,
    subject_distribution,
    room_usage,
    day_load,
  };
}

export default AnalyticsView;
