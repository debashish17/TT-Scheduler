import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaPlay, FaArrowLeft, FaSchool, FaBook, FaClock, FaDoorOpen, FaClipboardList, FaUsers, FaTrash, FaExclamationTriangle, FaCheckCircle } from 'react-icons/fa';
import { useOnboardingStore } from '../../store';
import { simpleTimetableAPI } from '../../api/client';

const SetupSummary = () => {
  const navigate = useNavigate();
  const {
    institutionData, classesData, subjectsData, teachersData,
    timeData, roomsData, constraintsData,
    setGeneratedTimetable, setTimetableError, clearOnboardingData
  } = useOnboardingStore();

  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [solverWarnings, setSolverWarnings] = useState([]);

  // ── Hard Reset ──────────────────────────────────────────────
  const handleReset = () => {
    if (window.confirm('Clear ALL onboarding data and start over from Step 1?')) {
      clearOnboardingData();
      navigate('/screen-1');
    }
  };

  // ── Section definitions (with defensive filtering) ──────────
  const sections = [
    {
      icon: <FaSchool className="text-blue-500" />,
      title: 'Institution',
      ready: !!institutionData,
      detail: institutionData?.name || 'Not set',
      action: '/screen-1',
    },
    {
      icon: <FaUsers className="text-indigo-500" />,
      title: 'Batches',
      ready: (classesData || []).filter(c => c?.name?.trim()).length > 0,
      detail: (classesData || []).filter(c => c?.name?.trim()).length > 0
        ? `${classesData.filter(c => c?.name?.trim()).length} batches`
        : 'No batches added',
      action: '/screen-2',
    },
    {
      icon: <FaBook className="text-green-500" />,
      title: 'Subjects',
      ready: (subjectsData || []).filter(s => s?.name?.trim() && s?.code?.trim()).length > 0,
      detail: (subjectsData || []).filter(s => s?.name?.trim() && s?.code?.trim()).length > 0
        ? `${subjectsData.filter(s => s?.name?.trim() && s?.code?.trim()).length} subjects`
        : 'No subjects added',
      action: '/screen-3',
    },
    {
      icon: <FaClock className="text-purple-500" />,
      title: 'Schedule',
      ready: !!(timeData?.workingDays?.length > 0 && (parseInt(timeData?.periodsPerDay) || 0) > 0),
      detail: timeData?.workingDays?.length > 0
        ? `${timeData.workingDays.length} days, ${parseInt(timeData.periodsPerDay) || '?'} periods/day`
        : 'Not set',
      action: '/screen-4',
    },
    {
      icon: <FaDoorOpen className="text-orange-500" />,
      title: 'Classrooms',
      ready: (roomsData || []).filter(r => r?.name?.trim()).length > 0,
      detail: (roomsData || []).filter(r => r?.name?.trim()).length > 0
        ? `${roomsData.filter(r => r?.name?.trim()).length} rooms`
        : 'No rooms added',
      action: '/screen-5',
    },
    {
      icon: <FaClipboardList className="text-red-500" />,
      title: 'Rules',
      ready: !!constraintsData,
      detail: constraintsData
        ? `Max ${parseInt(constraintsData.max_consecutive_periods) || 3} consecutive periods`
        : 'Using defaults',
      action: '/screen-6',
    },
  ];

  const missingRequired = sections.filter(s => !s.ready && s.title !== 'Rules');

  // ── Build request (fully defensive — filters bad persisted data) ──
  const buildRequest = () => {
    const subj = (subjectsData || [])
      .filter(s => s?.name?.trim() && s?.code?.trim())
      .map(s => ({
        name: s.name.trim(),
        code: s.code.trim(),
        periods_per_week: Math.max(1, parseInt(s.periods_per_week) || 3),
        target_classes: Array.isArray(s.target_classes) ? s.target_classes : [],
      }));

    const teachers = (teachersData || [])
      .filter(t => t?.name?.trim())
      .map(t => ({
        name: t.name.trim(),
        subjects: Array.isArray(t.subjects) ? t.subjects.filter(Boolean) : [],
      }));

    const finalTeachers = teachers.length > 0
      ? teachers
      : subj.map(s => ({ name: `${s.name} Teacher`, subjects: [s.code] }));

    const classes = (classesData || [])
      .filter(c => c?.name?.trim())
      .map(c => ({ name: c.name.trim(), size: Math.max(1, parseInt(c.size) || 30) }));

    const rooms = (roomsData || [])
      .filter(r => r?.name?.trim())
      .map(r => ({ name: r.name.trim(), capacity: Math.max(1, parseInt(r.capacity) || 40) }));

    const td = timeData || {};
    const constraints = constraintsData || {};
    const periodsPerDay = Math.max(1, parseInt(td.periodsPerDay) || 7);
    const lunchAfterPeriod = td.haslunch ? Math.max(0, parseInt(td.lunchAfterPeriod) || 4) : 0;

    return {
      institution_name: institutionData?.name?.trim() || 'My School',
      subjects: subj,
      teachers: finalTeachers,
      classes,
      rooms,
      working_days: Array.isArray(td.workingDays) && td.workingDays.length > 0
        ? td.workingDays
        : ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      periods_per_day: periodsPerDay,
      period_duration_minutes: Math.max(15, parseInt(td.periodDuration) || 45),
      start_time: td.startTime || '08:00',
      constraints: {
        max_consecutive_periods: Math.max(1, parseInt(constraints.max_consecutive_periods) || 3),
        lunch_after_period: lunchAfterPeriod,
        max_periods_per_day_per_teacher: Math.max(1, parseInt(constraints.max_periods_per_day_per_teacher) || 6),
      },
    };
  };

  // ── Generate ────────────────────────────────────────────────
  const handleGenerate = async () => {
    if (missingRequired.length > 0) {
      setError(`Please complete: ${missingRequired.map(s => s.title).join(', ')}`);
      return;
    }
    setIsGenerating(true);
    setError(null);

    try {
      const request = buildRequest();
      console.log('Generating timetable with:', request);

      // Client-side guard — prevent sending empty arrays
      if (!request.subjects.length) {
        setError('No valid subjects found — go back to Subjects and add at least one.');
        return;
      }
      if (!request.classes.length) {
        setError('No valid classes found — go back to Batches and add at least one.');
        return;
      }
      if (!request.rooms.length) {
        setError('No valid rooms found — go back to Classrooms and add at least one with a name.');
        return;
      }

      const response = await simpleTimetableAPI.generate(request);
      const timetableData = response.data;
      setGeneratedTimetable(timetableData);

      const warnings = timetableData.warnings || [];
      setSolverWarnings(warnings);

      // Auto-save to DB (non-blocking — failure shows warning, doesn't block navigation)
      try {
        const savePayload = {
          institution_name: request.institution_name,
          name: `${request.institution_name} Timetable`,
          solver: timetableData.solver || 'CP-SAT',
          status: timetableData.status || 'FEASIBLE',
          solve_time: timetableData.solve_time || 0,
          assignments: timetableData.assignments || [],
          working_days: request.working_days,
          periods_per_day: request.periods_per_day,
          stats: timetableData.stats || {},
        };
        const saveResult = await simpleTimetableAPI.saveTimetable(savePayload);
        console.log('Timetable saved to DB:', saveResult.data);
      } catch (saveErr: any) {
        console.warn('DB save warning (timetable still visible):', saveErr.message);
      }

      // Navigate immediately only if no warnings — otherwise show them first
      if (warnings.length === 0) {
        navigate('/timetable');
      }

    } catch (err: any) {
      let msg;
      if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
        msg = 'The solver is taking too long to respond. Try reducing periods_per_week or adding more rooms/teachers, then try again.';
      } else if (!err.response) {
        msg = 'Cannot reach the backend. Make sure the server is running on http://localhost:8000.';
      } else {
        let detail = err.response?.data?.detail;
        if (Array.isArray(detail)) {
          msg = detail.map(d => `${d.loc?.slice(-1)[0] || 'field'}: ${d.msg}`).join('; ');
        } else if (detail && typeof detail === 'object') {
          msg = JSON.stringify(detail);
        } else {
          msg = detail || err.message || 'Generation failed';
        }
      }
      setError(msg);
      setTimetableError(msg);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-2xl shadow-lg p-8">
        <div className="flex items-start justify-between mb-8">
          <div className="text-center flex-1">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
              <FaPlay className="text-2xl text-green-600" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900">Ready to Generate</h1>
            <p className="text-gray-500 mt-1">Review your setup and generate your timetable using CP-SAT</p>
          </div>
          {/* Reset button */}
          <button
            onClick={handleReset}
            title="Clear all data and start over"
            className="flex items-center gap-1.5 px-3 py-2 text-xs text-red-500 border border-red-200 rounded-lg hover:bg-red-50 transition-colors">
            <FaTrash size={10} /> Reset All
          </button>
        </div>

        {/* Summary Cards */}
        <div className="space-y-3 mb-8">
          {sections.map((section, i) => (
            <div key={i} className={`flex items-center border rounded-xl p-4 ${
              section.ready ? 'border-green-200 bg-green-50' : 'border-yellow-200 bg-yellow-50'
            }`}>
              <div className="mr-3 text-xl">{section.icon}</div>
              <div className="flex-1">
                <div className="font-medium text-gray-800">{section.title}</div>
                <div className={`text-sm ${section.ready ? 'text-green-700' : 'text-yellow-700'}`}>{section.detail}</div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                  section.ready ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                }`}>{section.ready ? '✓ Ready' : '⚠ Missing'}</span>
                <button onClick={() => navigate(section.action)}
                  className="text-xs text-blue-600 hover:underline">Edit</button>
              </div>
            </div>
          ))}
        </div>

        {/* Error display */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
            ❌ {error}
          </div>
        )}

        {/* Solver warnings from backend */}
        {solverWarnings.length > 0 && (
          <div className="mb-6 space-y-2">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">
              Timetable generated with {solverWarnings.length} issue{solverWarnings.length > 1 ? 's' : ''}:
            </h3>
            {solverWarnings.map((w, i) => (
              <div key={i} className={`flex gap-3 items-start rounded-xl px-4 py-3 border text-sm ${
                w.level === 'error'
                  ? 'bg-red-50 border-red-200 text-red-800'
                  : 'bg-yellow-50 border-yellow-200 text-yellow-800'
              }`}>
                <FaExclamationTriangle className={`mt-0.5 shrink-0 ${w.level === 'error' ? 'text-red-500' : 'text-yellow-500'}`} />
                <div className="min-w-0">
                  <p className="font-medium">{w.message}</p>
                  {w.detail && (
                    <p className="text-xs opacity-75 mt-0.5 font-mono">
                      {Object.entries(w.detail).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join(' · ')}
                    </p>
                  )}
                </div>
              </div>
            ))}
            <button
              onClick={() => navigate('/timetable')}
              className="mt-3 w-full flex items-center justify-center gap-2 px-6 py-3 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 transition-colors">
              <FaCheckCircle /> View Timetable Anyway
            </button>
          </div>
        )}

        {/* Teacher auto-note */}
        {(!teachersData || teachersData.length === 0) && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl text-blue-700 text-sm">
            💡 No teachers added — the solver will auto-create one teacher per subject.
          </div>
        )}

        {/* Generate Button */}
        <div className="text-center">
          <button
            onClick={handleGenerate}
            disabled={isGenerating || missingRequired.length > 0}
            className={`px-10 py-4 rounded-xl font-semibold text-lg transition-all ${
              isGenerating || missingRequired.length > 0
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5'
            }`}>
            {isGenerating ? (
              <span className="flex items-center gap-3">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                Generating Timetable...
              </span>
            ) : '🎯 Generate Timetable with CP-SAT'}
          </button>
          {isGenerating && (
            <p className="text-sm text-gray-500 mt-3">CP-SAT solver is working. This may take up to 60 seconds.</p>
          )}
        </div>

        <div className="flex justify-start mt-8 pt-6 border-t border-gray-200">
          <button onClick={() => navigate('/screen-6')}
            className="flex items-center space-x-2 px-5 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors text-sm">
            <FaArrowLeft size={12} />
            <span>Back to Rules</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default SetupSummary;
