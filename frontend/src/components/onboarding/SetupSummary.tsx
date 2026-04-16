import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FaPlay, FaArrowLeft, FaSchool, FaBook, FaClock, FaDoorOpen,
  FaClipboardList, FaUsers, FaTrash, FaExclamationTriangle,
  FaCheckCircle, FaMagic, FaTimes, FaLightbulb, FaRobot, FaHistory,
} from 'react-icons/fa';
import { useOnboardingStore } from '../../store';
import { simpleTimetableAPI, snapshotsAPI } from '../../api/client';
import { useAuthStore } from '../../store/authStore';

// ─── Types ───────────────────────────────────────────────────────
interface SolverWarning {
  level: 'error' | 'warning' | 'info';
  code: string;
  message: string;
  detail?: Record<string, any>;
}

interface ResolveFix {
  id: string;
  label: string;
  description: string;
  apply: () => void;
}

interface AiFixState {
  teachers: any[];
  rooms: any[];
  subjects: any[];
  timeData: any;
}

// ─── AI: apply ALL fixes at once (accumulated, no closure issues) ─
function computeAllFixes(
  warnings: SolverWarning[],
  initial: AiFixState,
): { teachers: any[]; rooms: any[]; subjects: any[]; timeData: any; log: string[] } {
  let teachers = [...(initial.teachers || [])];
  let rooms    = [...(initial.rooms    || [])];
  let subjects = [...(initial.subjects || [])];
  let td       = { ...(initial.timeData || {}) };
  const log: string[] = [];
  const seen   = new Set<string>();

  for (const w of warnings) {
    const d = w.detail || {};

    if (w.code === 'NO_TEACHER_FOR_SUBJECT') {
      const sc = d.subject as string;
      const k  = `add_t_${sc}`;
      if (!seen.has(k)) {
        seen.add(k);
        teachers.push({ name: `Auto-Teacher (${sc})`, subjects: [sc] });
        log.push(`✔ Added teacher for "${sc}"`);
      }
    }

    if (w.code === 'UNKNOWN_SUBJECT_CODE') {
      const tName = d.teacher as string;
      const bad   = (d.unknown_codes as string[]) || [];
      const k     = `fix_unknown_${tName}`;
      if (!seen.has(k)) {
        seen.add(k);
        teachers = teachers.map((t: any) =>
          t.name === tName
            ? { ...t, subjects: (t.subjects || []).filter((s: string) => !bad.includes(s)) }
            : t,
        );
        log.push(`✔ Removed invalid codes [${bad.join(', ')}] from "${tName}"`);
      }
    }

    if (w.code === 'SCHEDULE_OVERSUBSCRIBED' && !seen.has('reduce_ppw')) {
      seen.add('reduce_ppw');
      subjects = subjects.map((s: any) => ({
        ...s,
        periods_per_week: Math.max(1, (parseInt(s.periods_per_week) || 3) - 1),
      }));
      log.push('✔ Reduced periods/week by 1 for all subjects');
    }

    if (w.code === 'TEACHER_CAPACITY_EXCEEDED') {
      const sc = d.subject as string;
      const k  = `extra_t_${sc}`;
      if (!seen.has(k)) {
        seen.add(k);
        const cnt = teachers.filter((t: any) => (t.subjects || []).includes(sc)).length;
        teachers.push({ name: `${sc} Teacher ${cnt + 1}`, subjects: [sc] });
        log.push(`✔ Added extra teacher for "${sc}"`);
      }
    }

    if (w.code === 'NO_ROOM_FOR_CLASS') {
      const cn   = d.class as string;
      const size = (d.class_size as number) || 30;
      const k    = `room_${cn}`;
      if (!seen.has(k)) {
        seen.add(k);
        rooms.push({ name: `Large Room ${rooms.length + 1}`, capacity: size });
        log.push(`✔ Added large room (cap ${size}) for "${cn}"`);
      }
    }

    if (w.code === 'FEWER_ROOMS_THAN_CLASSES') {
      const needed = (d.classes as number || 0) - rooms.length;
      if (needed > 0 && !seen.has('fill_rooms')) {
        seen.add('fill_rooms');
        for (let i = 0; i < needed; i++) {
          rooms.push({ name: `Room ${rooms.length + 1}`, capacity: 40 });
        }
        log.push(`✔ Added ${needed} room(s) to match class count`);
      }
    }

    if (w.code === 'UNPLACED_SESSION') {
      const sc  = d.subject as string;
      const fix = ((d.fix as string) || '').toLowerCase();
      if (fix.includes('teacher') && !seen.has(`up_t_${sc}`)) {
        seen.add(`up_t_${sc}`);
        teachers.push({ name: `Extra Teacher (${sc})`, subjects: [sc] });
        log.push(`✔ Added teacher for unplaced "${sc}" session`);
      } else if (fix.includes('room') && !seen.has('up_room')) {
        seen.add('up_room');
        rooms.push({ name: `Room ${rooms.length + 1}`, capacity: 40 });
        log.push('✔ Added room for unplaced session');
      } else if (!seen.has(`up_ppw_${sc}`) && !seen.has('reduce_ppw')) {
        seen.add(`up_ppw_${sc}`);
        subjects = subjects.map((s: any) =>
          s.code === sc
            ? { ...s, periods_per_week: Math.max(1, (parseInt(s.periods_per_week) || 3) - 1) }
            : s,
        );
        log.push(`✔ Reduced periods/week for "${sc}"`);
      }
    }
  }

  return { teachers, rooms, subjects, timeData: td, log };
}

// ─── Manual single-fix analyser (same as before) ─────────────────
function analyzeWarnings(
  warnings: SolverWarning[],
  teachersData: any[],
  roomsData: any[],
  subjectsData: any[],
  classesData: any[],
  timeData: any,
  setTeachersData: (d: any[]) => void,
  setRoomsData: (d: any[]) => void,
  setSubjectsData: (d: any[]) => void,
  setTimeData: (d: any) => void,
): ResolveFix[] {
  const fixes: ResolveFix[] = [];
  const seen = new Set<string>();

  for (const w of warnings) {
    const d = w.detail || {};

    if (w.code === 'NO_TEACHER_FOR_SUBJECT') {
      const sc = d.subject as string;
      const k  = `add_teacher_${sc}`;
      if (!seen.has(k)) {
        seen.add(k);
        fixes.push({
          id: k,
          label: `Add a teacher for "${sc}"`,
          description: `Creates an auto-teacher assigned only to "${sc}" so the solver has someone to fill those periods.`,
          apply: () => setTeachersData([...(teachersData || []), { name: `Auto-Teacher (${sc})`, subjects: [sc] }]),
        });
      }
    }

    if (w.code === 'UNKNOWN_SUBJECT_CODE') {
      const tName = d.teacher as string;
      const bad   = (d.unknown_codes as string[]) || [];
      const k     = `fix_unknown_${tName}`;
      if (!seen.has(k)) {
        seen.add(k);
        fixes.push({
          id: k,
          label: `Fix subject codes for teacher "${tName}"`,
          description: `Removes the unrecognized code(s) [${bad.join(', ')}] from "${tName}"'s subject list.`,
          apply: () =>
            setTeachersData(
              (teachersData || []).map((t: any) =>
                t.name === tName
                  ? { ...t, subjects: (t.subjects || []).filter((s: string) => !bad.includes(s)) }
                  : t,
              ),
            ),
        });
      }
    }

    if (w.code === 'SCHEDULE_OVERSUBSCRIBED') {
      if (!seen.has('reduce_ppw')) {
        seen.add('reduce_ppw');
        fixes.push({
          id: 'reduce_ppw',
          label: 'Reduce periods/week for all subjects by 1',
          description: `There are ${d.sessions_needed} sessions needed but only ${d.slots_available} slots. Reducing each subject's weekly periods by 1 frees up enough room.`,
          apply: () =>
            setSubjectsData(
              (subjectsData || []).map((s: any) => ({
                ...s,
                periods_per_week: Math.max(1, (parseInt(s.periods_per_week) || 3) - 1),
              })),
            ),
        });
      }
      const ppd = parseInt(timeData?.periodsPerDay) || 7;
      if (ppd < 10 && !seen.has('add_period')) {
        seen.add('add_period');
        fixes.push({
          id: 'add_period',
          label: 'Add 1 more period per day',
          description: `Increases the school day from ${ppd} to ${ppd + 1} periods.`,
          apply: () => setTimeData({ ...(timeData || {}), periodsPerDay: String(ppd + 1) }),
        });
      }
      const curDays: string[] = timeData?.workingDays || ['Monday','Tuesday','Wednesday','Thursday','Friday'];
      const missing = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'].filter(
        (day) => !curDays.includes(day),
      );
      if (missing.length > 0 && !seen.has('add_day')) {
        seen.add('add_day');
        const nextDay = missing[0];
        fixes.push({
          id: 'add_day',
          label: `Add ${nextDay} as a working day`,
          description: `Adds ${nextDay} to the schedule giving each class ${ppd} extra slots/week.`,
          apply: () => setTimeData({ ...(timeData || {}), workingDays: [...curDays, nextDay] }),
        });
      }
    }

    if (w.code === 'TEACHER_CAPACITY_EXCEEDED') {
      const sc = d.subject as string;
      const k  = `extra_teacher_${sc}`;
      if (!seen.has(k)) {
        seen.add(k);
        fixes.push({
          id: k,
          label: `Add an extra teacher for "${sc}"`,
          description: `${d.sessions_needed} sessions needed but teacher(s) can only cover ${d.teacher_capacity}. A second teacher doubles coverage.`,
          apply: () => {
            const cnt = (teachersData || []).filter((t: any) => (t.subjects || []).includes(sc)).length;
            setTeachersData([...(teachersData || []), { name: `${sc} Teacher ${cnt + 2}`, subjects: [sc] }]);
          },
        });
      }
    }

    if (w.code === 'NO_ROOM_FOR_CLASS') {
      const cn   = d.class as string;
      const size = (d.class_size as number) || 30;
      const k    = `room_${cn}`;
      if (!seen.has(k)) {
        seen.add(k);
        fixes.push({
          id: k,
          label: `Add a room large enough for "${cn}" (${size} students)`,
          description: `No existing room can fit ${size} students. A new room with capacity ${size} allows the solver to place "${cn}".`,
          apply: () =>
            setRoomsData([...(roomsData || []), { name: `Large Room ${(roomsData || []).length + 1}`, capacity: size }]),
        });
      }
    }

    if (w.code === 'FEWER_ROOMS_THAN_CLASSES') {
      const numClasses = (d.classes as number) || 0;
      const numRooms   = (d.rooms as number) || 0;
      const needed     = numClasses - numRooms;
      const k          = 'fill_rooms';
      if (!seen.has(k) && needed > 0) {
        seen.add(k);
        fixes.push({
          id: k,
          label: `Add ${needed} more room${needed > 1 ? 's' : ''} to match class count`,
          description: `You have ${numClasses} classes but only ${numRooms} rooms. Adding ${needed} room(s) removes the bottleneck.`,
          apply: () => {
            const start = (roomsData || []).length + 1;
            const newRooms = Array.from({ length: needed }, (_, i) => ({
              name: `Room ${start + i}`,
              capacity: 40,
            }));
            setRoomsData([...(roomsData || []), ...newRooms]);
          },
        });
      }
    }

    if (w.code === 'UNPLACED_SESSION') {
      const sc  = d.subject as string;
      const fix = ((d.fix as string) || '').toLowerCase();
      if (fix.includes('teacher') && !seen.has(`up_t_${sc}`)) {
        seen.add(`up_t_${sc}`);
        fixes.push({
          id: `up_t_${sc}`,
          label: `Add a teacher for "${sc}"`,
          description: d.fix as string,
          apply: () =>
            setTeachersData([...(teachersData || []), { name: `Extra Teacher (${sc})`, subjects: [sc] }]),
        });
      } else if (fix.includes('room') && !seen.has('up_room')) {
        seen.add('up_room');
        fixes.push({
          id: 'up_room',
          label: `Add a room for unplaced session`,
          description: d.fix as string,
          apply: () =>
            setRoomsData([...(roomsData || []), { name: `Room ${(roomsData || []).length + 1}`, capacity: 40 }]),
        });
      } else if (!seen.has(`up_ppw_${sc}`) && !seen.has('reduce_ppw')) {
        seen.add(`up_ppw_${sc}`);
        fixes.push({
          id: `up_ppw_${sc}`,
          label: `Reduce periods/week for "${sc}"`,
          description: `"${sc}" couldn't be placed. Reducing its weekly frequency by 1 gives the solver more flexibility.`,
          apply: () =>
            setSubjectsData(
              (subjectsData || []).map((s: any) =>
                s.code === sc
                  ? { ...s, periods_per_week: Math.max(1, (parseInt(s.periods_per_week) || 3) - 1) }
                  : s,
              ),
            ),
        });
      }
    }
  }

  return fixes;
}

// ─── Component ────────────────────────────────────────────────────
const SetupSummary = () => {
  const navigate = useNavigate();
  const {
    institutionData, classesData, subjectsData, teachersData,
    timeData, roomsData, constraintsData,
    setGeneratedTimetable, setTimetableError, clearOnboardingData,
    setTeachersData, setRoomsData, setSubjectsData, setTimeData,
  } = useOnboardingStore();

  const [isGenerating,      setIsGenerating]      = useState(false);
  const [error,             setError]              = useState<string | null>(null);
  const [solverWarnings,    setSolverWarnings]     = useState<SolverWarning[]>([]);

  // Auto Resolve state
  const [autoResolveEnabled, setAutoResolveEnabled] = useState(false);
  const [showResolveModal,   setShowResolveModal]   = useState(false);
  const [resolveOptions,     setResolveOptions]     = useState<ResolveFix[]>([]);
  const [selectedFixIndex,   setSelectedFixIndex]   = useState(0);
  const [isApplying,         setIsApplying]         = useState(false);

  // AI Solve state
  const [isAiSolving, setIsAiSolving] = useState(false);
  const [aiSolveLog,  setAiSolveLog]  = useState<string[]>([]);

  // ── Hard Reset ─────────────────────────────────────────────────
  const handleReset = () => {
    if (window.confirm('Clear ALL onboarding data and start over from Step 1?')) {
      clearOnboardingData();
      navigate('/screen-1');
    }
  };

  // ── Section definitions ────────────────────────────────────────
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
      ready: (classesData || []).filter((c: any) => c?.name?.trim()).length > 0,
      detail:
        (classesData || []).filter((c: any) => c?.name?.trim()).length > 0
          ? `${classesData.filter((c: any) => c?.name?.trim()).length} batches`
          : 'No batches added',
      action: '/screen-2',
    },
    {
      icon: <FaBook className="text-green-500" />,
      title: 'Subjects',
      ready: (subjectsData || []).filter((s: any) => s?.name?.trim() && s?.code?.trim()).length > 0,
      detail:
        (subjectsData || []).filter((s: any) => s?.name?.trim() && s?.code?.trim()).length > 0
          ? `${subjectsData.filter((s: any) => s?.name?.trim() && s?.code?.trim()).length} subjects`
          : 'No subjects added',
      action: '/screen-3',
    },
    {
      icon: <FaClock className="text-purple-500" />,
      title: 'Schedule',
      ready: !!(timeData?.workingDays?.length > 0 && (parseInt(timeData?.periodsPerDay) || 0) > 0),
      detail:
        timeData?.workingDays?.length > 0
          ? `${timeData.workingDays.length} days, ${parseInt(timeData.periodsPerDay) || '?'} periods/day`
          : 'Not set',
      action: '/screen-4',
    },
    {
      icon: <FaDoorOpen className="text-orange-500" />,
      title: 'Classrooms',
      ready: (roomsData || []).filter((r: any) => r?.name?.trim()).length > 0,
      detail:
        (roomsData || []).filter((r: any) => r?.name?.trim()).length > 0
          ? `${roomsData.filter((r: any) => r?.name?.trim()).length} rooms`
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

  const missingRequired = sections.filter((s) => !s.ready && s.title !== 'Rules');

  // ── Build request ──────────────────────────────────────────────
  const buildRequest = () => {
    const subj = (subjectsData || [])
      .filter((s: any) => s?.name?.trim() && s?.code?.trim())
      .map((s: any) => ({
        name: s.name.trim(),
        code: s.code.trim(),
        periods_per_week: Math.max(1, parseInt(s.periods_per_week) || 3),
        target_classes: Array.isArray(s.target_classes) ? s.target_classes : [],
      }));

    const teachers = (teachersData || [])
      .filter((t: any) => t?.name?.trim())
      .map((t: any) => ({
        name: t.name.trim(),
        subjects: Array.isArray(t.subjects) ? t.subjects.filter(Boolean) : [],
      }));

    const finalTeachers =
      teachers.length > 0
        ? teachers
        : subj.map((s: any) => ({ name: `${s.name} Teacher`, subjects: [s.code] }));

    const classes = (classesData || [])
      .filter((c: any) => c?.name?.trim())
      .map((c: any) => ({ name: c.name.trim(), size: Math.max(1, parseInt(c.size) || 30) }));

    const rooms = (roomsData || [])
      .filter((r: any) => r?.name?.trim())
      .map((r: any) => ({ name: r.name.trim(), capacity: Math.max(1, parseInt(r.capacity) || 40) }));

    const td          = timeData || {};
    const constraints = constraintsData || {};
    const periodsPerDay     = Math.max(1, parseInt(td.periodsPerDay) || 7);
    const lunchAfterPeriod  = td.haslunch ? Math.max(0, parseInt(td.lunchAfterPeriod) || 4) : 0;

    return {
      institution_name: institutionData?.name?.trim() || 'My School',
      subjects: subj,
      teachers: finalTeachers,
      classes,
      rooms,
      working_days:
        Array.isArray(td.workingDays) && td.workingDays.length > 0
          ? td.workingDays
          : ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      periods_per_day: periodsPerDay,
      period_duration_minutes: Math.max(15, parseInt(td.periodDuration) || 45),
      start_time: td.startTime || '08:00',
      constraints: {
        max_consecutive_periods: Math.max(1, parseInt(constraints.max_consecutive_periods) || 3),
        lunch_after_period: lunchAfterPeriod,
        max_periods_per_day_per_teacher: Math.max(
          1,
          parseInt(constraints.max_periods_per_day_per_teacher) || 6,
        ),
      },
    };
  };

  // ── Core generate (called on initial click and after any fix) ──
  const runGenerate = async () => {
    setIsGenerating(true);
    setError(null);
    setSolverWarnings([]);
    setAutoResolveEnabled(false);
    setAiSolveLog([]);

    try {
      const request = buildRequest();

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

      const warnings: SolverWarning[] = timetableData.warnings || [];
      setSolverWarnings(warnings);
      if (warnings.length > 0) setAutoResolveEnabled(true);

      // Auto-save timetable row (non-blocking)
      try {
        simpleTimetableAPI.saveTimetable({
          institution_name: request.institution_name,
          name: `${request.institution_name} Timetable`,
          solver: timetableData.solver || 'CP-SAT',
          status: timetableData.status || 'FEASIBLE',
          solve_time: timetableData.solve_time || 0,
          assignments: timetableData.assignments || [],
          working_days: request.working_days,
          periods_per_day: request.periods_per_day,
          stats: timetableData.stats || {},
        });
      } catch (saveErr: any) {
        console.warn('DB save warning:', saveErr.message);
      }

      // Save full snapshot — all inputs + solver result — per authenticated user
      try {
        snapshotsAPI.save({
          institution_name:  request.institution_name,
          institution_data:  institutionData    || {},
          classes_data:      classesData        || [],
          subjects_data:     subjectsData       || [],
          teachers_data:     teachersData       || [],
          time_data:         timeData           || {},
          rooms_data:        roomsData          || [],
          constraints_data:  constraintsData    || {},
          generated_timetable: timetableData,
        });
        console.log('✅ Full snapshot saved to DB');
      } catch (snapErr: any) {
        console.warn('Snapshot save warning (timetable still visible):', snapErr.message);
      }

      if (warnings.length === 0) navigate('/timetable');
    } catch (err: any) {
      let msg: string;
      if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
        msg = 'The solver is taking too long. Try reducing periods_per_week or adding more rooms/teachers.';
      } else if (!err.response) {
        msg = 'Cannot reach the backend. Make sure the server is running on http://localhost:8000.';
      } else {
        const detail = err.response?.data?.detail;
        if (Array.isArray(detail)) {
          msg = detail.map((d: any) => `${d.loc?.slice(-1)[0] || 'field'}: ${d.msg}`).join('; ');
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

  const handleGenerate = async () => {
    if (missingRequired.length > 0) {
      setError(`Please complete: ${missingRequired.map((s) => s.title).join(', ')}`);
      return;
    }
    await runGenerate();
  };

  // ── Open manual-resolve modal ──────────────────────────────────
  const handleOpenAutoResolve = () => {
    // Generate the preview so the user knows exactly what we will do
    const result = computeAllFixes(solverWarnings, {
      teachers: teachersData || [],
      rooms:    roomsData    || [],
      subjects: subjectsData || [],
      timeData: timeData     || {},
    });
    setAiSolveLog(result.log);
    setShowResolveModal(true);
  };

  // ── Apply ONE chosen fix and re-generate ───────────────────────
  const handleApplyFix = async () => {
    if (!resolveOptions.length) return;
    setIsApplying(true);
    try {
      resolveOptions[selectedFixIndex].apply();
      await new Promise((r) => setTimeout(r, 50));
      setShowResolveModal(false);
      await runGenerate();
    } finally {
      setIsApplying(false);
    }
  };

  // ── AI Solve: apply ALL fixes at once ─────────────────────────
  const handleAiSolve = async () => {
    setIsAiSolving(true);
    setAiSolveLog([]);
    try {
      const result = computeAllFixes(solverWarnings, {
        teachers: teachersData || [],
        rooms:    roomsData    || [],
        subjects: subjectsData || [],
        timeData: timeData     || {},
      });

      // Show the applied log inside the modal briefly
      setAiSolveLog(result.log);
      await new Promise((r) => setTimeout(r, 900)); // brief pause so user sees the log

      // Commit all fixes to the store at once
      setTeachersData(result.teachers);
      setRoomsData(result.rooms);
      setSubjectsData(result.subjects);
      setTimeData(result.timeData);

      await new Promise((r) => setTimeout(r, 60)); // let Zustand propagate
      setShowResolveModal(false);
      await runGenerate();
    } finally {
      setIsAiSolving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-2xl shadow-lg p-8">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div className="text-center flex-1">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
              <FaPlay className="text-2xl text-green-600" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900">Ready to Generate</h1>
            <p className="text-gray-500 mt-1">Review your setup and generate your timetable using CP-SAT</p>
          </div>
          <button
            onClick={handleReset}
            title="Clear all data and start over"
            className="flex items-center gap-1.5 px-3 py-2 text-xs text-red-500 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
          >
            <FaTrash size={10} /> Reset All
          </button>
        </div>

        {/* Summary Cards */}
        <div className="space-y-3 mb-8">
          {sections.map((section, i) => (
            <div
              key={i}
              className={`flex items-center border rounded-xl p-4 ${
                section.ready ? 'border-green-200 bg-green-50' : 'border-yellow-200 bg-yellow-50'
              }`}
            >
              <div className="mr-3 text-xl">{section.icon}</div>
              <div className="flex-1">
                <div className="font-medium text-gray-800">{section.title}</div>
                <div className={`text-sm ${section.ready ? 'text-green-700' : 'text-yellow-700'}`}>
                  {section.detail}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                    section.ready
                      ? 'bg-green-100 text-green-700'
                      : 'bg-yellow-100 text-yellow-700'
                  }`}
                >
                  {section.ready ? '✓ Ready' : '⚠ Missing'}
                </span>
                <button
                  onClick={() => navigate(section.action)}
                  className="text-xs text-blue-600 hover:underline"
                >
                  Edit
                </button>
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

        {/* Solver warnings */}
        {solverWarnings.length > 0 && (
          <div className="mb-6 space-y-2">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">
              Timetable generated with {solverWarnings.length} issue
              {solverWarnings.length > 1 ? 's' : ''}:
            </h3>
            {solverWarnings.map((w, i) => (
              <div
                key={i}
                className={`flex gap-3 items-start rounded-xl px-4 py-3 border text-sm ${
                  w.level === 'error'
                    ? 'bg-red-50 border-red-200 text-red-800'
                    : 'bg-yellow-50 border-yellow-200 text-yellow-800'
                }`}
              >
                <FaExclamationTriangle
                  className={`mt-0.5 shrink-0 ${
                    w.level === 'error' ? 'text-red-500' : 'text-yellow-500'
                  }`}
                />
                <div className="min-w-0">
                  <p className="font-medium">{w.message}</p>
                  {w.detail && (
                    <p className="text-xs opacity-75 mt-0.5 font-mono">
                      {Object.entries(w.detail)
                        .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
                        .join(' · ')}
                    </p>
                  )}
                </div>
              </div>
            ))}

            {/* Warning action row */}
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => navigate('/timetable')}
                className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 transition-colors text-sm"
              >
                <FaCheckCircle /> View Timetable Anyway
              </button>

              <button
                onClick={handleOpenAutoResolve}
                disabled={!autoResolveEnabled}
                title={
                  autoResolveEnabled
                    ? 'Analyze conflicts and pick a fix'
                    : 'Generate the timetable first to detect conflicts'
                }
                className={`flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-medium transition-all text-sm border-2 ${
                  autoResolveEnabled
                    ? 'bg-purple-600 text-white border-purple-600 hover:bg-purple-700 shadow-md'
                    : 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                }`}
              >
                <FaMagic className={autoResolveEnabled ? 'animate-pulse' : ''} />
                Auto Resolve
              </button>
            </div>
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
            }`}
          >
            {isGenerating ? (
              <span className="flex items-center gap-3">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Generating Timetable...
              </span>
            ) : (
              '🎯 Generate Timetable with CP-SAT'
            )}
          </button>
          {isGenerating && (
            <p className="text-sm text-gray-500 mt-3">CP-SAT solver is working. This may take up to 60 seconds.</p>
          )}
        </div>

        {/* Back button */}
        <div className="flex justify-start mt-8 pt-6 border-t border-gray-200">
          <button
            onClick={() => navigate('/screen-7')}
            className="flex items-center space-x-2 px-5 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors text-sm"
          >
            <FaArrowLeft size={12} />
            <span>Back to Rules</span>
          </button>
        </div>
      </div>

      {/* ── Auto Resolve Modal (Batch Review) ───────────────────── */}
      {showResolveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => { if (!isApplying && !isAiSolving) setShowResolveModal(false); }}
          />

          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
                  <FaMagic className="text-purple-600 text-lg" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Batch Auto Resolve</h2>
                  <p className="text-xs text-gray-500">
                    {aiSolveLog.length} automatic fix{aiSolveLog.length !== 1 ? 'es' : ''} proposed
                  </p>
                </div>
              </div>
              <button
                onClick={() => { if (!isApplying && !isAiSolving) setShowResolveModal(false); }}
                className="text-gray-400 hover:text-gray-600 transition-colors p-1"
                disabled={isApplying || isAiSolving}
              >
                <FaTimes />
              </button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              <div className="rounded-2xl border border-purple-200 bg-purple-50 p-4">
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-9 h-9 bg-purple-600 rounded-xl flex items-center justify-center shrink-0">
                    <FaRobot className="text-white text-base" />
                  </div>
                  <div>
                    <p className="font-bold text-purple-900 text-sm">Review Proposed Changes</p>
                    <p className="text-xs text-purple-700 mt-0.5">
                      Applying these generated fixes will resolve the mathematical impossibilities in the current schedule layout, allowing CP-SAT to successfully schedule all classes.
                    </p>
                  </div>
                </div>

                {aiSolveLog.length === 0 ? (
                   <p className="text-sm text-gray-600 my-4 text-center">No auto fixes identified.</p>
                ) : (
                  <div className="bg-white rounded-xl divide-y divide-gray-100 shadow-sm border border-purple-100 mt-4 overflow-hidden">
                    {aiSolveLog.map((line, i) => (
                      <div key={i} className="p-3 flex gap-3 text-sm text-gray-700">
                         <div className="mt-0.5 shrink-0 flex items-center justify-center w-5 h-5 bg-green-100 rounded-full">
                           <FaCheckCircle className="text-green-600 text-xs" />
                         </div>
                         <p>{line.replace('✔', '').trim()}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Modal footer */}
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
              <button
                onClick={() => setShowResolveModal(false)}
                disabled={isApplying || isAiSolving}
                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 transition-colors text-sm font-medium disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAiSolve}
                disabled={aiSolveLog.length === 0 || isApplying || isAiSolving}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all bg-purple-600 text-white hover:bg-purple-700 shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isAiSolving ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Applying...
                  </>
                ) : (
                  <>
                    <FaMagic />
                    Accept & Apply All
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SetupSummary;
