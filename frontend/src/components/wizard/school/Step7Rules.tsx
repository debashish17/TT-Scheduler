import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { WizardShell } from '../WizardShell';
import { useWizardStore } from '../wizardStore';
import { useOnboardingStore } from '../../../store';
import { Btn, Eyebrow, Chip, Icon } from '../../ui/primitives';
import { schoolAPI } from '../../../api/client';

// ─── Types ───────────────────────────────────────────────────────
interface SolverWarning {
  level: 'error' | 'warning' | 'info';
  code: string;
  message: string;
  detail?: Record<string, any>;
}

interface AiFixState {
  teachers: any[];
  rooms: any[];
  subjects: any[];
  timeData: any;
}

const CONSTRAINTS = [
  { id: 1, name: 'FacultyOverlap', rule: 'No faculty teaches two classes at the same time' },
  { id: 2, name: 'RoomOverlap', rule: 'No room hosts two classes simultaneously' },
  { id: 3, name: 'BatchOverlap', rule: 'No batch attends two classes simultaneously' },
  { id: 4, name: 'RoomCapacity', rule: 'Room size ≥ batch enrollment' },
  { id: 5, name: 'CourseHours', rule: 'Each course gets its required contact hours' },
  { id: 6, name: 'FacultyWorkload', rule: 'Faculty hours stay within contract limits' },
  { id: 7, name: 'RoomFeatures', rule: 'Rooms match course requirements (lab, projector…)' },
  { id: 8, name: 'LabConsecutive', rule: 'Lab sessions are always scheduled back-to-back' },
];

// ─── AI: apply ALL fixes at once ─────────────────────────────────
function computeAllFixes(
  warnings: SolverWarning[],
  initial: AiFixState,
): { teachers: any[]; rooms: any[]; subjects: any[]; timeData: any; log: string[] } {
  let teachers = [...(initial.teachers || [])];
  let rooms = [...(initial.rooms || [])];
  let subjects = [...(initial.subjects || [])];
  let td = { ...(initial.timeData || {}) };
  const log: string[] = [];
  const seen = new Set<string>();

  for (const w of warnings) {
    const d = w.detail || {};

    if (w.code === 'NO_TEACHER_FOR_SUBJECT') {
      const sc = d.subject as string;
      const k = `add_t_${sc}`;
      if (!seen.has(k)) {
        seen.add(k);
        let count = 1;
        while (teachers.some(t => t.name === `${sc} Teacher ${count}`)) count++;
        teachers.push({ name: `${sc} Teacher ${count}`, subjects: [sc] });
        log.push(`✔ Added teacher for "${sc}"`);
      }
    }

    if (w.code === 'UNKNOWN_SUBJECT_CODE') {
      const tName = d.teacher as string;
      const bad = (d.unknown_codes as string[]) || [];
      const k = `fix_unknown_${tName}`;
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
      const k = `extra_t_${sc}`;
      if (!seen.has(k)) {
        seen.add(k);
        const qualifiedCount = d.qualified_teachers?.length || 1;
        // Use the realistic per-teacher capacity if backend provided it
        // (factors in max_per_day_teacher and same-teacher-per-class rule).
        const classesPerTeacher = Math.max(1, d.classes_per_teacher || 1);
        const ppw = Math.max(1, d.ppw || 3);
        const nClasses = Math.max(1, d.n_classes || 1);
        // Total teachers needed = ceil(n_classes / classes_per_teacher).
        // Add +1 buffer so CP-SAT has slack for the same-teacher-per-class
        // and no-consecutive-same-subject constraints (avoids unfit sessions).
        // Subtract existing qualified teachers.
        const totalTeachersNeeded = Math.ceil(nClasses / classesPerTeacher) + 1;
        const needed = Math.max(1, totalTeachersNeeded - qualifiedCount);

        let count = 1;
        for (let i = 0; i < needed; i++) {
          while (teachers.some((t: any) => t.name === `${sc} Teacher ${count}`)) count++;
          teachers.push({ name: `${sc} Teacher ${count}`, subjects: [sc] });
        }
        log.push(`✔ Added ${needed} extra teacher(s) for "${sc}"`);
      }
    }

    if (w.code === 'NO_ROOM_FOR_CLASS') {
      const cn = d.class as string;
      const size = (d.class_size as number) || 30;
      const k = `room_${cn}`;
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
      const sc = d.subject as string | undefined;
      const fix = ((d.fix as string) || '').toLowerCase();
      if (sc) {
        // Per-subject unplaced session (from greedy solver)
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
      } else {
        // Bulk unplaced sessions from CP-SAT — add an extra room + reduce all periods
        if (!seen.has('up_bulk_room')) {
          seen.add('up_bulk_room');
          rooms.push({ name: `Room ${rooms.length + 1}`, capacity: 40 });
          log.push('✔ Added extra room to help place unscheduled sessions');
        }
        if (!seen.has('reduce_ppw') && !seen.has('up_bulk_ppw')) {
          seen.add('up_bulk_ppw');
          subjects = subjects.map((s: any) => ({
            ...s,
            periods_per_week: Math.max(1, (parseInt(s.periods_per_week) || 3) - 1),
          }));
          log.push('✔ Reduced periods/week by 1 for all subjects to ease scheduling');
        }
      }
    }
  }

  return { teachers, rooms, subjects, timeData: td, log };
}

// ─── Solving overlay ──────────────────────────────────────────────────────────
const SOLVER_STEPS = [
  'Validating problem',
  'Building model',
  'Running diagnostics',
  'Building CP-SAT model',
  'Searching',
  'Extracting solution',
  'Building assignments',
  'Done',
];

const SolvingOverlay: React.FC<{ progress: number }> = ({ progress }) => {
  const currentIdx = Math.min(Math.floor(progress * SOLVER_STEPS.length), SOLVER_STEPS.length - 1);

  return (
    <div className="fixed inset-0 z-50 paper-grain flex items-center justify-center" style={{ background: 'var(--paper)' }}>
      <div className="max-w-lg w-full px-8">
        <Eyebrow>Solving · run-{Date.now().toString().slice(-4)}</Eyebrow>
        <h2 className="serif leading-tight tracking-tight mt-4 mb-8" style={{ fontSize: 48 }}>
          Searching for<br />a <span className="italic" style={{ color: 'var(--brand)' }}>clash-free</span> schedule.
        </h2>
        <div className="edge rounded-xl overflow-hidden" style={{ background: 'var(--paper-2)' }}>
          {SOLVER_STEPS.map((step, i) => {
            const done = i < currentIdx;
            const active = i === currentIdx && progress < 1;
            const pending = i > currentIdx;
            return (
              <div
                key={step}
                className="flex items-center gap-3 px-4 py-3"
                style={{ borderTop: i > 0 ? '1px solid var(--line)' : undefined }}
              >
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[10px]"
                  style={{
                    background: done ? 'var(--brand)' : active ? 'var(--brand-soft)' : 'var(--paper)',
                    border: pending ? '1px solid var(--line)' : undefined,
                  }}
                >
                  {done ? (
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <path d="M2 5l2.5 2.5L8 3" stroke="var(--paper)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : active ? (
                    <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: 'var(--brand)' }} />
                  ) : null}
                </div>
                <span
                  className="text-[13px]"
                  style={{
                    color: done ? 'var(--ink)' : active ? 'var(--ink)' : 'var(--ink-3)',
                    fontWeight: active ? 600 : 400,
                  }}
                >
                  {step}
                </span>
                {active && (
                  <span className="ml-auto mono text-[11px]" style={{ color: 'var(--brand)' }}>running…</span>
                )}
                {done && (
                  <span className="ml-auto mono text-[11px]" style={{ color: 'var(--ink-3)' }}>done</span>
                )}
              </div>
            );
          })}
        </div>
        <div className="mt-5 flex items-center gap-4">
          <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: 'var(--line)' }}>
            <div className="h-full rounded-full" style={{ width: `${progress * 100}%`, background: 'var(--brand)', transition: 'width .3s' }} />
          </div>
          <span className="mono text-[11px]" style={{ color: 'var(--ink-3)' }}>
            {Math.round(progress * 100)}%
          </span>
        </div>
      </div>
    </div>
  );
};

const Step7Rules: React.FC = () => {
  const navigate = useNavigate();
  const { workflow } = useWizardStore();
  const {
    institutionData, classesData, subjectsData, teachersData,
    timeData, roomsData, constraintsData,
    setGeneratedTimetable, setTimetableError, generatedTimetable,
    setTeachersData, setRoomsData, setSubjectsData, setTimeData,
    setConstraintsData,
    softConstraintsSchool, setSoftConstraintsSchool,
  } = useOnboardingStore();
  const isSchool = workflow === 'school';
  const shown = isSchool ? CONSTRAINTS.slice(0, 4) : CONSTRAINTS;

  const [active, setActive] = useState<Set<number>>(() => {
    const defaultActive = new Set<number>(shown.map(c => c.id));
    if (!constraintsData?.active?.length) return defaultActive;
    const existingActive = new Set<number>((constraintsData.active as number[]));
    if (isSchool && Array.from(existingActive).some((id: number) => id > 4)) {
      return defaultActive;
    }
    return existingActive;
  });

  const [maxConsec, setMaxConsec] = useState<number>(
    constraintsData?.max_consecutive_periods ?? 3
  );
  const [maxPerDay, setMaxPerDay] = useState<number>(
    constraintsData?.max_periods_per_day_per_teacher ?? 6
  );

  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [solveProgress, setSolveProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [solverWarnings, setSolverWarnings] = useState<SolverWarning[]>([]);
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [aiSolveLog, setAiSolveLog] = useState<string[]>([]);
  const [isAiSolving, setIsAiSolving] = useState(false);

  // Soft constraints state
  type SoftConstraint = { type: string; target: string; when: string | null; weight: number };
  const RULE_TYPES = [
    { value: 'avoid_day',      label: 'Avoid day',
      help: 'Try not to schedule the chosen teacher on the chosen day.' },
    { value: 'avoid_slot',     label: 'Avoid period',
      help: 'Try not to schedule the chosen teacher at the chosen period.' },
    { value: 'prefer_slot',    label: 'Prefer period',
      help: 'Reward scheduling the chosen teacher at the chosen period.' },
    { value: 'spread_subject', label: 'Spread subject',
      help: 'Distribute the chosen subject across as many days as possible.' },
    { value: 'group_on_day',   label: 'Group on day',
      help: 'Cluster the chosen subject onto the same day if it can.' },
  ];
  const isSubjectRule = (t: string) => t === 'spread_subject' || t === 'group_on_day';
  const [showAddPref, setShowAddPref] = useState(false);
  const [showRuleHelp, setShowRuleHelp] = useState(false);
  const [prefType, setPrefType]       = useState('avoid_day');
  const [prefTarget, setPrefTarget]   = useState('');
  const [prefWhen, setPrefWhen]       = useState('');
  const [prefWeight, setPrefWeight]   = useState(3);
  const [softPrefs, setSoftPrefs]     = useState<SoftConstraint[]>(softConstraintsSchool ?? []);

  // Rename-after-auto-resolve state
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [newTeacherNames, setNewTeacherNames] = useState<{ original: string; current: string }[]>([]);
  const [newRoomNames, setNewRoomNames] = useState<{ original: string; current: string }[]>([]);
  // Ref so runGenerate's closure can read the latest value without stale-capture
  const pendingRenameRef = useRef<{ teachers: { original: string; current: string }[]; rooms: { original: string; current: string }[] } | null>(null);

  const saveConstraints = (patch: { active?: number[]; max_consecutive_periods?: number; max_periods_per_day_per_teacher?: number }) => {
    setConstraintsData({
      active: patch.active ?? [...active],
      max_consecutive_periods: patch.max_consecutive_periods ?? maxConsec,
      max_periods_per_day_per_teacher: patch.max_periods_per_day_per_teacher ?? maxPerDay,
    });
  };

  const toggle = (id: number) => {
    const n = new Set(active);
    n.has(id) ? n.delete(id) : n.add(id);
    setActive(n);
    saveConstraints({ active: [...n] });
  };

  // Build request — accepts optional overrides so callers can pass freshly-fixed
  // data without waiting for Zustand state to propagate
  const buildRequest = (overrides: { teachers?: any[]; rooms?: any[]; subjects?: any[] } = {}) => {
    const rawSubjects = overrides.subjects ?? subjectsData ?? [];
    const rawTeachers = overrides.teachers ?? teachersData ?? [];
    const rawRooms = overrides.rooms ?? roomsData ?? [];

    const subj = rawSubjects
      .filter((s: any) => s?.name?.trim() && s?.code?.trim())
      .map((s: any) => ({
        name: s.name.trim(),
        code: s.code.trim(),
        periods_per_week: Math.max(1, parseInt(s.periods_per_week) || 3),
        target_classes: Array.isArray(s.target_classes) ? s.target_classes : [],
      }));

    const teachers = rawTeachers
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

    const rooms = rawRooms
      .filter((r: any) => r?.name?.trim())
      .map((r: any) => ({ name: r.name.trim(), capacity: Math.max(1, parseInt(r.capacity) || 40) }));

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
      working_days:
        Array.isArray(td.workingDays) && td.workingDays.length > 0
          ? td.workingDays
          : ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      periods_per_day: periodsPerDay,
      period_duration_minutes: Math.max(15, parseInt(td.periodDuration) || 45),
      lunch_duration_minutes: td.haslunch ? Math.max(5, parseInt(td.lunchDuration) || 30) : 0,
      start_time: td.startTime || '08:00',
      constraints: {
        max_consecutive_periods: Math.max(1, parseInt(constraints.max_consecutive_periods) || 3),
        lunch_after_period: lunchAfterPeriod,
        max_periods_per_day_per_teacher: Math.max(
          1,
          parseInt(constraints.max_periods_per_day_per_teacher) || 6,
        ),
      },
      soft_constraints: (softConstraintsSchool ?? []).map((sc: SoftConstraint) => ({
        type: sc.type,
        target: sc.target,
        ...(sc.when != null ? { when: sc.when } : {}),
        weight: sc.weight,
      })),
    };
  };

  // Generate timetable
  const runGenerate = async (overrides: { teachers?: any[]; rooms?: any[]; subjects?: any[] } = {}) => {
    setIsGenerating(true);
    setError(null);
    setSolverWarnings([]);
    setSolveProgress(0);
    setAiSolveLog([]);

    try {
      const request = buildRequest(overrides);

      // Log the request being sent
      console.log('📤 Sending to backend:', JSON.stringify(request, null, 2));
      console.log('📊 Institution:', institutionData);
      console.log('📚 Subjects:', subjectsData);
      console.log('👨‍🏫 Teachers:', teachersData);
      console.log('📚 Classes:', classesData);
      console.log('🏛️ Rooms:', roomsData);
      console.log('🕐 Time:', timeData);
      console.log('📋 Constraints:', constraintsData);

      if (!request.subjects.length) {
        setError('No valid subjects found — go back and add at least one.');
        setIsGenerating(false);
        return;
      }
      if (!request.classes.length) {
        setError('No valid classes/batches found — go back and add at least one.');
        setIsGenerating(false);
        return;
      }
      if (!request.rooms.length) {
        setError('No valid rooms found — go back and add at least one.');
        setIsGenerating(false);
        return;
      }

      // Simulate progress
      let p = 0;
      const progressTick = setInterval(() => {
        p += 0.04 + Math.random() * 0.05;
        if (p > 0.9) p = 0.9;
        setSolveProgress(p);
      }, 150);

      const response = await schoolAPI.generate(request);
      clearInterval(progressTick);
      setSolveProgress(1);

      const timetableData = response.data;
      setGeneratedTimetable(timetableData);

      const warnings: SolverWarning[] = timetableData.warnings || [];
      setSolverWarnings(warnings);

      const hasAssignments = (timetableData.assignments?.length ?? 0) > 0;

      if (warnings.length > 0) {
        const isRetry = Object.keys(overrides).length > 0;
        if (!isRetry) {
          // First run only — offer autofix modal
          const result = computeAllFixes(warnings, {
            teachers: teachersData || [],
            rooms: roomsData || [],
            subjects: subjectsData || [],
            timeData: timeData || {},
          });
          if (result.log.length > 0) {
            setAiSolveLog(result.log);
            setShowResolveModal(true);
          }
        } else {
          // After autofix retry — navigate with whatever was generated
          await new Promise((r) => setTimeout(r, 700));
          if (
            hasAssignments &&
            pendingRenameRef.current &&
            (pendingRenameRef.current.teachers.length > 0 || pendingRenameRef.current.rooms.length > 0)
          ) {
            setNewTeacherNames(pendingRenameRef.current.teachers);
            setNewRoomNames(pendingRenameRef.current.rooms);
            pendingRenameRef.current = null;
            setIsGenerating(false);
            setShowRenameModal(true);
          } else if (hasAssignments) {
            pendingRenameRef.current = null;
            setIsGenerating(false);
            navigate('/timetable');
            return;
          }
        }
      } else {
        // No warnings — check if a rename prompt is pending and generation succeeded
        await new Promise((r) => setTimeout(r, 700));
        if (
          hasAssignments &&
          pendingRenameRef.current &&
          (pendingRenameRef.current.teachers.length > 0 || pendingRenameRef.current.rooms.length > 0)
        ) {
          setNewTeacherNames(pendingRenameRef.current.teachers);
          setNewRoomNames(pendingRenameRef.current.rooms);
          pendingRenameRef.current = null;
          setIsGenerating(false);
          setShowRenameModal(true);
        } else {
          pendingRenameRef.current = null;
          setIsGenerating(false);
          navigate('/timetable');
          return;
        }
      }

      // Auto-save is built into /school/generate — run_id is returned in timetableData.
      // No separate save call needed.
      if (timetableData.run_id) {
        console.log(`Run saved automatically: ${timetableData.run_id}`);
      }
    } catch (err: any) {
      let msg: string;
      if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
        msg = 'Solver took too long. Try reducing periods/week or adding more resources.';
      } else if (!err.response) {
        msg = 'Cannot reach backend. Check if server is running on http://localhost:8000';
      } else {
        const detail = err.response?.data?.detail;
        if (Array.isArray(detail)) {
          msg = detail.map((d: any) => `${d.loc?.slice(-1)[0]}: ${d.msg}`).join('; ');
        } else {
          msg = detail || err.message || 'Generation failed';
        }
      }
      setError(msg);
      setTimetableError(msg);
    } finally {
      setIsGenerating(false);
      setSolveProgress(0);
    }
  };

  // Apply all fixes and retry
  const handleAiSolve = async () => {
    setIsAiSolving(true);
    try {
      const result = computeAllFixes(solverWarnings, {
        teachers: teachersData || [],
        rooms: roomsData || [],
        subjects: subjectsData || [],
        timeData: timeData || {},
      });

      setAiSolveLog(result.log);
      await new Promise((r) => setTimeout(r, 900));

      // Detect newly-added teachers / rooms so we can offer renaming later
      const origTeacherNames = new Set((teachersData || []).map((t: any) => t.name));
      const origRoomNames = new Set((roomsData || []).map((r: any) => r.name));
      const newTeachers = result.teachers
        .filter((t: any) => !origTeacherNames.has(t.name))
        .map((t: any) => ({ original: t.name, current: t.name }));
      const newRooms = result.rooms
        .filter((r: any) => !origRoomNames.has(r.name))
        .map((r: any) => ({ original: r.name, current: r.name }));

      // Stash in ref so runGenerate's closure can read it after async completes
      if (newTeachers.length > 0 || newRooms.length > 0) {
        pendingRenameRef.current = { teachers: newTeachers, rooms: newRooms };
      }

      // Apply fixes to store
      setTeachersData(result.teachers);
      setRoomsData(result.rooms);
      setSubjectsData(result.subjects);
      setTimeData(result.timeData);

      setShowResolveModal(false);
      await runGenerate({
        teachers: result.teachers,
        rooms: result.rooms,
        subjects: result.subjects,
      });
    } finally {
      setIsAiSolving(false);
    }
  };

  const handleGenerate = async () => {
    console.log('Validating classes:', classesData);
    const validClasses = (classesData || []).filter((c: any) => c?.name?.trim());
    console.log('Valid classes:', validClasses);

    if (!validClasses.length) {
      setError('Please complete: Classes/Batches');
      return;
    }

    console.log('Validating subjects:', subjectsData);
    const validSubjects = (subjectsData || []).filter((s: any) => s?.name?.trim() && s?.code?.trim());
    console.log('Valid subjects:', validSubjects);

    if (!validSubjects.length) {
      setError('Please complete: Subjects');
      return;
    }

    console.log('Validating rooms:', roomsData);
    const validRooms = (roomsData || []).filter((r: any) => r?.name?.trim());
    console.log('Valid rooms:', validRooms);

    if (!validRooms.length) {
      setError('Please complete: Rooms');
      return;
    }

    setError(null);
    await runGenerate();
  };

  return (
    <>
      <WizardShell step={7} title="Rules">
        <div className="space-y-6">
          <p className="text-sm" style={{ color: 'var(--ink-3)' }}>
            Toggle constraints on/off. All are enabled by default.
          </p>

          <div>
            <div className="flex items-baseline justify-between mb-3">
              <h3 className="font-semibold">Hard constraints</h3>
              <span className="mono text-[11px]" style={{ color: 'var(--ink-3)' }}>{active.size}/{shown.length} active</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {shown.map(c => {
                const on = active.has(c.id);
                return (
                  <button key={c.id} onClick={() => toggle(c.id)}
                    className="flex items-start gap-3 p-3 rounded-lg text-left transition-colors"
                    style={{ background: on ? 'var(--ink)' : 'var(--paper)', border: `1px solid ${on ? 'var(--ink)' : 'var(--line)'}`, color: on ? 'var(--paper)' : 'var(--ink)' }}>
                    <div className="w-8 h-8 rounded-md flex items-center justify-center shrink-0"
                      style={{ background: on ? 'rgba(255,255,255,0.1)' : 'var(--paper-2)' }}>
                      <span className="mono text-[10px]">C{String(c.id).padStart(2, '0')}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-[13px]">{c.name}</div>
                      <div className="text-[12px]" style={{ opacity: on ? 0.65 : 1, color: on ? 'inherit' : 'var(--ink-3)' }}>{c.rule}</div>
                    </div>
                    <div className="ml-auto w-8 h-4 rounded-full relative mt-1 shrink-0" style={{ background: on ? 'var(--brand)' : 'var(--line)' }}>
                      <span className="absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all" style={{ left: on ? 18 : 2 }} />
                    </div>
                  </button>
                );
              })}
            </div>
            {isSchool && (
              <p className="mt-3 text-[12px] mono" style={{ color: 'var(--ink-3)' }}>
                Switch to College workflow to unlock 4 additional constraints.
              </p>
            )}
          </div>

          {/* Configurable limits */}
          {/* "Max consecutive periods / teacher" was removed because the school
              solver does not enforce it — see audit. Re-add when the solver
              wires `max_consecutive_periods` into a real CP-SAT constraint. */}
          <div className="grid grid-cols-2 gap-3">
            {[
              {
                label: 'Max periods / teacher / day', value: maxPerDay, min: 1, max: 12,
                onChange: (v: number) => { setMaxPerDay(v); saveConstraints({ max_periods_per_day_per_teacher: v }); }
              },
            ].map(({ label, value, min, max, onChange }) => (
              <div key={label} className="edge rounded-lg p-3" style={{ background: 'var(--paper)' }}>
                <div className="text-[11px] mono mb-2" style={{ color: 'var(--ink-3)' }}>{label}</div>
                <div className="flex items-center gap-2">
                  <button onClick={() => onChange(Math.max(min, value - 1))}
                    className="w-7 h-7 rounded flex items-center justify-center text-sm"
                    style={{ background: 'var(--paper-2)', color: 'var(--ink)' }}>−</button>
                  <span className="mono font-semibold text-sm w-6 text-center">{value}</span>
                  <button onClick={() => onChange(Math.min(max, value + 1))}
                    className="w-7 h-7 rounded flex items-center justify-center text-sm"
                    style={{ background: 'var(--paper-2)', color: 'var(--ink)' }}>+</button>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-4" style={{ borderTop: '1px solid var(--line)' }}>
            <h3 className="font-semibold mb-3">Soft preferences</h3>
            <div className="space-y-2">
              {softPrefs.map((p, i) => (
                <div key={i} className="flex items-center gap-3 edge rounded-lg px-3 py-2.5" style={{ background: 'var(--paper)' }}>
                  <span className="text-sm flex-1">
                    <span className="mono text-[11px] mr-2" style={{ color: 'var(--ink-3)' }}>{p.type.replace(/_/g, ' ')}</span>
                    {p.target}{p.when ? ` — ${p.when}` : ''}
                  </span>
                  <Chip tone="ok">weight +{p.weight}</Chip>
                  <button onClick={() => {
                    const next = softPrefs.filter((_, j) => j !== i);
                    setSoftPrefs(next);
                    setSoftConstraintsSchool(next);
                  }} style={{ color: 'var(--ink-3)' }}><Icon name="x" size={13} /></button>
                </div>
              ))}
              {softPrefs.length === 0 && (
                <p className="text-sm" style={{ color: 'var(--ink-3)' }}>No preferences added yet.</p>
              )}
              <button className="flex items-center gap-2 text-sm" style={{ color: 'var(--ink-3)' }}
                onClick={() => { setShowRuleHelp(false); setShowAddPref(true); }}>
                <Icon name="plus" size={13} /> Add preference
              </button>
            </div>
          </div>

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              ❌ {error}
            </div>
          )}

          <div className="pt-4 flex items-center justify-between" style={{ borderTop: '1px solid var(--line)' }}>
            <div>
              <div className="eyebrow mb-0.5" style={{ color: 'var(--ink-3)' }}>Solver ready</div>
              <div className="text-sm" style={{ color: 'var(--ink-2)' }}>
                {isSchool ? 'All inputs validated · ~240 variables' : 'All inputs validated · 1,428 variables · 8,214 constraints'}
              </div>
            </div>
            <Btn variant="brand" size="lg" onClick={handleGenerate} disabled={isGenerating}>
              {isGenerating ? (
                <>
                  <svg className="animate-spin h-4 w-4 mr-2" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Solving...
                </>
              ) : (
                <>
                  <Icon name="bolt" size={14} /> Generate timetable
                </>
              )}
            </Btn>
          </div>
        </div>
      </WizardShell>

      {isGenerating && <SolvingOverlay progress={solveProgress} />}

      {/* Auto Resolve Modal */}
      {showResolveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 backdrop-blur-sm" style={{ background: 'rgba(0,0,0,0.35)' }}
            onClick={() => { if (!isAiSolving) setShowResolveModal(false); }} />

          <div className="relative w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden rounded-2xl edge"
            style={{ background: 'var(--paper)' }}>

            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-5 pb-4" style={{ borderBottom: '1px solid var(--line)' }}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: 'var(--brand-soft)' }}>
                  <Icon name="sparkle" size={16} style={{ color: 'var(--brand)' } as any} />
                </div>
                <div>
                  <h2 className="font-semibold text-[15px]" style={{ color: 'var(--ink)' }}>Auto Resolve</h2>
                  <Eyebrow>{aiSolveLog.length} fix{aiSolveLog.length !== 1 ? 'es' : ''} proposed</Eyebrow>
                </div>
              </div>
              <button
                onClick={() => setShowResolveModal(false)}
                disabled={isAiSolving}
                className="w-7 h-7 flex items-center justify-center rounded-full transition-colors disabled:opacity-40"
                style={{ color: 'var(--ink-3)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--paper-2)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <Icon name="x" size={14} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
              <p className="text-sm" style={{ color: 'var(--ink-3)' }}>
                These fixes resolve constraint conflicts so CP-SAT can schedule all sessions. Review and apply.
              </p>

              {aiSolveLog.length === 0 ? (
                <div className="py-8 text-center text-sm" style={{ color: 'var(--ink-3)' }}>
                  No automatic fixes identified.
                </div>
              ) : (
                <div className="edge rounded-xl overflow-hidden" style={{ background: 'var(--paper)' }}>
                  {aiSolveLog.map((line, i) => (
                    <div key={i}
                      className="flex items-start gap-3 px-4 py-3 text-sm"
                      style={{ borderTop: i > 0 ? '1px solid var(--line)' : undefined, color: 'var(--ink-2)' }}>
                      <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                        style={{ background: 'var(--brand-soft)' }}>
                        <Icon name="check" size={11} style={{ color: 'var(--brand)' } as any} />
                      </div>
                      <span>{line.replace('✔', '').trim()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 flex gap-3" style={{ borderTop: '1px solid var(--line)' }}>
              <Btn variant="ghost" size="md" onClick={() => setShowResolveModal(false)} disabled={isAiSolving}
                className="flex-1 justify-center">
                Cancel
              </Btn>
              <Btn variant="brand" size="md" onClick={handleAiSolve}
                disabled={aiSolveLog.length === 0 || isAiSolving}
                className="flex-1 justify-center">
                {isAiSolving ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Applying…
                  </>
                ) : (
                  <><Icon name="spark" size={14} /> Accept &amp; Apply All</>
                )}
              </Btn>
            </div>
          </div>
        </div>
      )}

      {/* ── Rename New Resources Modal ── */}
      {showRenameModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 backdrop-blur-sm" style={{ background: 'rgba(0,0,0,0.38)' }} />

          <div className="relative w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden rounded-2xl edge"
            style={{ background: 'var(--paper)' }}>

            {/* Header */}
            <div className="flex items-center gap-3 px-6 pt-5 pb-4" style={{ borderBottom: '1px solid var(--line)' }}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: 'var(--brand-soft)' }}>
                <Icon name="spark" size={16} style={{ color: 'var(--brand)' } as any} />
              </div>
              <div>
                <h2 className="font-semibold text-[15px]">Rename New Resources</h2>
                <Eyebrow>Auto-added during conflict resolution</Eyebrow>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              <p className="text-sm" style={{ color: 'var(--ink-3)' }}>
                These teachers and rooms were created automatically. You can rename them before viewing your timetable.
              </p>

              {newTeacherNames.length > 0 && (
                <div>
                  <Eyebrow className="block mb-3">New teachers</Eyebrow>
                  <div className="space-y-2">
                    {newTeacherNames.map((item, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                          style={{ background: 'var(--paper-2)', color: 'var(--ink-3)' }}>
                          <span className="text-[10px] mono">{i + 1}</span>
                        </div>
                        <input
                          value={item.current}
                          onChange={e => setNewTeacherNames(prev =>
                            prev.map((x, j) => j === i ? { ...x, current: e.target.value } : x)
                          )}
                          className="flex-1 px-3 py-2 rounded-lg text-sm outline-none"
                          style={{
                            background: 'var(--paper)',
                            border: '1px solid var(--ink)',
                            color: 'var(--ink)',
                          }}
                          placeholder={item.original}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {newRoomNames.length > 0 && (
                <div>
                  <Eyebrow className="block mb-3">New rooms</Eyebrow>
                  <div className="space-y-2">
                    {newRoomNames.map((item, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                          style={{ background: 'var(--paper-2)', color: 'var(--ink-3)' }}>
                          <span className="text-[10px] mono">{i + 1}</span>
                        </div>
                        <input
                          value={item.current}
                          onChange={e => setNewRoomNames(prev =>
                            prev.map((x, j) => j === i ? { ...x, current: e.target.value } : x)
                          )}
                          className="flex-1 px-3 py-2 rounded-lg text-sm outline-none"
                          style={{
                            background: 'var(--paper)',
                            border: '1px solid var(--ink)',
                            color: 'var(--ink)',
                          }}
                          placeholder={item.original}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 flex gap-3" style={{ borderTop: '1px solid var(--line)' }}>
              <Btn
                variant="ghost"
                size="md"
                className="flex-1 justify-center"
                onClick={() => {
                  // Skip rename — navigate with auto-generated names
                  setShowRenameModal(false);
                  navigate('/timetable');
                }}
              >
                Skip
              </Btn>
              <Btn
                variant="brand"
                size="md"
                className="flex-[2] justify-center"
                onClick={() => {
                  // Apply renames to the generated timetable's assignments
                  const teacherMap: Record<string, string> = {};
                  newTeacherNames.forEach(({ original, current }) => {
                    if (current.trim() && current !== original) teacherMap[original] = current.trim();
                  });
                  const roomMap: Record<string, string> = {};
                  newRoomNames.forEach(({ original, current }) => {
                    if (current.trim() && current !== original) roomMap[original] = current.trim();
                  });

                  // Update teachersData and roomsData in the store
                  setTeachersData(
                    (teachersData || []).map((t: any) =>
                      teacherMap[t.name] ? { ...t, name: teacherMap[t.name] } : t
                    )
                  );
                  setRoomsData(
                    (roomsData || []).map((r: any) =>
                      roomMap[r.name] ? { ...r, name: roomMap[r.name] } : r
                    )
                  );

                  // Patch the generated timetable's assignments so the grid shows new names
                  if (generatedTimetable) {
                    const patchedAssignments = ((generatedTimetable as any).assignments || []).map((a: any) => ({
                      ...a,
                      teacher_name: teacherMap[a.teacher_name] ?? a.teacher_name,
                      room_name: roomMap[a.room_name] ?? a.room_name,
                    }));
                    setGeneratedTimetable({ ...(generatedTimetable as any), assignments: patchedAssignments });
                  }

                  setShowRenameModal(false);
                  navigate('/timetable');
                }}
              >
                <Icon name="check" size={13} /> Done &amp; View Timetable
              </Btn>
            </div>
          </div>
        </div>
      )}

      {/* Add Soft Preference Modal */}
      {showAddPref && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 backdrop-blur-sm" style={{ background: 'rgba(0,0,0,0.35)' }}
            onClick={() => setShowAddPref(false)} />
          <div className="relative w-full max-w-sm rounded-2xl edge overflow-hidden"
            style={{ background: 'var(--paper)' }}>
            <div className="px-6 pt-5 pb-4" style={{ borderBottom: '1px solid var(--line)' }}>
              <h2 className="font-semibold text-[15px]">Add soft preference</h2>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[12px] font-medium" style={{ color: 'var(--ink-2)' }}>Rule type</span>
                  <button
                    type="button"
                    onClick={() => setShowRuleHelp(v => !v)}
                    className="flex items-center justify-center w-5 h-5 rounded-full text-[11px] font-semibold transition-colors"
                    style={{
                      background: showRuleHelp ? 'var(--ink)' : 'var(--paper-2)',
                      color: showRuleHelp ? 'var(--paper)' : 'var(--ink-3)',
                    }}
                    aria-label="What do these rules do?"
                    title="What do these rules do?"
                  >i</button>
                </div>
                <select value={prefType} onChange={e => {
                    setPrefType(e.target.value);
                    setPrefTarget('');   // target depends on type, clear it
                    setPrefWhen('');
                  }}
                  className="w-full px-3 py-2 rounded-md text-sm outline-none"
                  style={{ background: 'var(--paper)', border: '1px solid var(--line)', color: 'var(--ink)' }}>
                  {RULE_TYPES.map(rt => <option key={rt.value} value={rt.value}>{rt.label}</option>)}
                </select>
                {showRuleHelp && (
                  <div className="mt-2 rounded-md px-3 py-2.5 text-[11px] space-y-1.5"
                    style={{ background: 'var(--paper-2)', color: 'var(--ink-2)' }}>
                    {RULE_TYPES.map(rt => (
                      <div key={rt.value}>
                        <span className="font-semibold mono mr-1.5">{rt.label}:</span>
                        <span>{rt.help}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <span className="text-[12px] font-medium block mb-1" style={{ color: 'var(--ink-2)' }}>
                  {isSubjectRule(prefType) ? 'Subject' : 'Teacher'}
                </span>
                {isSubjectRule(prefType) ? (
                  (subjectsData?.length ?? 0) === 0 ? (
                    <div className="px-3 py-2 rounded-md text-sm"
                      style={{ background: 'var(--paper-2)', color: 'var(--ink-3)' }}>
                      No subjects added yet — go to step 3 first.
                    </div>
                  ) : (
                    <select value={prefTarget} onChange={e => setPrefTarget(e.target.value)}
                      className="w-full px-3 py-2 rounded-md text-sm outline-none"
                      style={{ background: 'var(--paper)', border: '1px solid var(--line)', color: 'var(--ink)' }}>
                      <option value="">— select subject —</option>
                      {(subjectsData || []).filter((s: any) => s?.code).map((s: any) => (
                        <option key={s.code} value={s.code}>
                          {s.code}{s.name ? ` — ${s.name}` : ''}
                        </option>
                      ))}
                    </select>
                  )
                ) : (
                  (teachersData?.length ?? 0) === 0 ? (
                    <div className="px-3 py-2 rounded-md text-sm"
                      style={{ background: 'var(--paper-2)', color: 'var(--ink-3)' }}>
                      No teachers added yet — go to step 4 first.
                    </div>
                  ) : (
                    <select value={prefTarget} onChange={e => setPrefTarget(e.target.value)}
                      className="w-full px-3 py-2 rounded-md text-sm outline-none"
                      style={{ background: 'var(--paper)', border: '1px solid var(--line)', color: 'var(--ink)' }}>
                      <option value="">— select teacher —</option>
                      {(teachersData || []).filter((t: any) => t?.name).map((t: any, i: number) => (
                        <option key={`${t.name}-${i}`} value={t.name}>{t.name}</option>
                      ))}
                    </select>
                  )
                )}
              </div>
              {prefType === 'avoid_day' && (
                <div>
                  <span className="text-[12px] font-medium block mb-1" style={{ color: 'var(--ink-2)' }}>Day</span>
                  <select value={prefWhen} onChange={e => setPrefWhen(e.target.value)}
                    className="w-full px-3 py-2 rounded-md text-sm outline-none"
                    style={{ background: 'var(--paper)', border: '1px solid var(--line)', color: 'var(--ink)' }}>
                    <option value="">-- select day --</option>
                    {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(d =>
                      <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              )}
              {(prefType === 'avoid_slot' || prefType === 'prefer_slot') && (
                <div>
                  <span className="text-[12px] font-medium block mb-1" style={{ color: 'var(--ink-2)' }}>Period number</span>
                  <input type="number" min={1} max={15} value={prefWhen}
                    onChange={e => setPrefWhen(e.target.value)}
                    className="w-full px-3 py-2 rounded-md text-sm outline-none"
                    style={{ background: 'var(--paper)', border: '1px solid var(--line)', color: 'var(--ink)' }} />
                </div>
              )}
              <div>
                <span className="text-[12px] font-medium block mb-1" style={{ color: 'var(--ink-2)' }}>
                  Weight (1 = soft hint, 10 = strong preference)
                </span>
                <div className="flex items-center gap-2">
                  <button onClick={() => setPrefWeight(w => Math.max(1, w - 1))}
                    className="w-7 h-7 rounded flex items-center justify-center text-sm"
                    style={{ background: 'var(--paper-2)', color: 'var(--ink)' }}>−</button>
                  <span className="mono font-semibold text-sm w-6 text-center">{prefWeight}</span>
                  <button onClick={() => setPrefWeight(w => Math.min(10, w + 1))}
                    className="w-7 h-7 rounded flex items-center justify-center text-sm"
                    style={{ background: 'var(--paper-2)', color: 'var(--ink)' }}>+</button>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 flex gap-3" style={{ borderTop: '1px solid var(--line)' }}>
              <button className="flex-1 px-4 py-2 rounded-lg text-sm"
                style={{ background: 'var(--paper-2)', color: 'var(--ink)' }}
                onClick={() => setShowAddPref(false)}>Cancel</button>
              <button className="flex-1 px-4 py-2 rounded-lg text-sm font-medium"
                style={{ background: 'var(--ink)', color: 'var(--paper)' }}
                onClick={() => {
                  if (!prefTarget.trim()) return;
                  const sc: SoftConstraint = {
                    type: prefType,
                    target: prefTarget.trim(),
                    when: prefWhen.trim() || null,
                    weight: prefWeight,
                  };
                  const next = [...softPrefs, sc];
                  setSoftPrefs(next);
                  setSoftConstraintsSchool(next);
                  setPrefTarget('');
                  setPrefWhen('');
                  setPrefWeight(3);
                  setShowAddPref(false);
                }}>Add</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Step7Rules;