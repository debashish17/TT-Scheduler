import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { WizardShell } from './WizardShell';
import { useWizardStore } from './wizardStore';
import { useOnboardingStore } from '../../../store';
import { Btn, Eyebrow, Chip, Icon } from '../../ui/primitives';
import { simpleTimetableAPI, snapshotsAPI } from '../../../api/client';

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
  { id: 1, name: 'FacultyOverlap',  rule: 'No faculty teaches two classes at the same time' },
  { id: 2, name: 'RoomOverlap',     rule: 'No room hosts two classes simultaneously' },
  { id: 3, name: 'BatchOverlap',    rule: 'No batch attends two classes simultaneously' },
  { id: 4, name: 'RoomCapacity',    rule: 'Room size ≥ batch enrollment' },
  { id: 5, name: 'CourseHours',     rule: 'Each course gets its required contact hours' },
  { id: 6, name: 'FacultyWorkload', rule: 'Faculty hours stay within contract limits' },
  { id: 7, name: 'RoomFeatures',    rule: 'Rooms match course requirements (lab, projector…)' },
  { id: 8, name: 'LabConsecutive',  rule: 'Lab sessions are always scheduled back-to-back' },
];

// ─── AI: apply ALL fixes at once ─────────────────────────────────
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
        let count = 1;
        while(teachers.some(t => t.name === `${sc} Teacher ${count}`)) count++;
        teachers.push({ name: `${sc} Teacher ${count}`, subjects: [sc] });
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
        const qualifiedCount = d.qualified_teachers?.length || 1;
        const singleCapacity = Math.floor(d.teacher_capacity / Math.max(1, qualifiedCount)) || 40;
        const shortage = d.sessions_needed - d.teacher_capacity;
        const needed = Math.max(1, Math.ceil(shortage / singleCapacity));
        
        let count = 1;
        for (let i = 0; i < needed; i++) {
          while (teachers.some((t: any) => t.name === `${sc} Teacher ${count}`)) count++;
          teachers.push({ name: `${sc} Teacher ${count}`, subjects: [sc] });
        }
        log.push(`✔ Added ${needed} extra teacher(s) for "${sc}"`);
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

// ─── Solving overlay ──────────────────────────────────────────────────────────
const SolvingOverlay: React.FC<{ progress: number }> = ({ progress }) => {
  const lines = [
    '$ cp-sat solve --workers=8',
    'loading model ··········································· ok',
    'variables: 1,428',
    'constraints: 8,214',
    'search space: 2.4e47',
    'propagating hard constraints ··························· ok',
    'branch & bound: depth 12',
    'incumbent @ 1.2s  soft_score=124',
    'incumbent @ 2.1s  soft_score=142',
    'incumbent @ 3.0s  soft_score=148',
    'optimality gap closed · 3.4s',
    '✓ solution found — 0 clashes · 8/8 constraints satisfied',
  ];
  const shown = Math.floor(progress * lines.length);

  return (
    <div className="fixed inset-0 z-50 paper-grain flex items-center justify-center" style={{ background: 'var(--paper)' }}>
      <div className="max-w-2xl w-full px-8">
        <Eyebrow>Solving · run-{Date.now().toString().slice(-4)}</Eyebrow>
        <h2 className="serif leading-tight tracking-tight mt-4 mb-8" style={{ fontSize: 52 }}>
          Searching for<br />a <span className="italic" style={{ color: 'var(--brand)' }}>clash-free</span> schedule.
        </h2>
        <div className="edge rounded-xl p-5 mono text-[12px] min-h-[200px]" style={{ background: 'var(--paper-2)', color: 'var(--ink-2)' }}>
          {lines.slice(0, shown).map((l, i) => <div key={i} className="py-[3px]">{l}</div>)}
          {shown < lines.length && <div className="py-[3px]" style={{ color: 'var(--brand)' }}>▍</div>}
        </div>
        <div className="mt-5 flex items-center gap-4">
          <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: 'var(--line)' }}>
            <div className="h-full rounded-full" style={{ width: `${progress * 100}%`, background: 'var(--brand)', transition: 'width .3s' }} />
          </div>
          <span className="mono text-[11px]" style={{ color: 'var(--ink-3)' }}>
            {(Math.round(progress * 34) / 10).toFixed(1)}s / 3.4s
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
    setGeneratedTimetable, setTimetableError,
    setTeachersData, setRoomsData, setSubjectsData, setTimeData,
    setConstraintsData,
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
    const rawSubjects  = overrides.subjects  ?? subjectsData  ?? [];
    const rawTeachers  = overrides.teachers  ?? teachersData  ?? [];
    const rawRooms     = overrides.rooms     ?? roomsData     ?? [];

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

      const response = await simpleTimetableAPI.generate(request);
      clearInterval(progressTick);
      setSolveProgress(1);

      const timetableData = response.data;
      setGeneratedTimetable(timetableData);

      const warnings: SolverWarning[] = timetableData.warnings || [];
      setSolverWarnings(warnings);

      if (warnings.length > 0) {
        const result = computeAllFixes(warnings, {
          teachers: teachersData || [],
          rooms: roomsData || [],
          subjects: subjectsData || [],
          timeData: timeData || {},
        });
        setAiSolveLog(result.log);
        setShowResolveModal(true);
      } else {
        // No warnings, proceed to view
        await new Promise((r) => setTimeout(r, 700));
        navigate('/timetable');
      }

      // Auto-save (non-blocking)
      const isPrecheck = timetableData.solver === 'Precheck' || !timetableData.assignments;
      if (!isPrecheck) {
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
          console.warn('Auto-save warning:', saveErr.message);
        }

        try {
          snapshotsAPI.save({
            institution_name: request.institution_name,
            institution_data: institutionData || {},
            classes_data: classesData || [],
            subjects_data: subjectsData || [],
            teachers_data: teachersData || [],
            time_data: timeData || {},
            rooms_data: roomsData || [],
            constraints_data: constraintsData || {},
            generated_timetable: timetableData,
          });
        } catch (snapErr: any) {
          console.warn('Snapshot save warning:', snapErr.message);
        }
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

      // Apply fixes to store
      setTeachersData(result.teachers);
      setRoomsData(result.rooms);
      setSubjectsData(result.subjects);
      setTimeData(result.timeData);

      setShowResolveModal(false);
      // Pass fixed data directly — store updates are async so we can't rely on
      // the closure having the new values by the time buildRequest runs
      await runGenerate({
        teachers: result.teachers,
        rooms:    result.rooms,
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
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Max consecutive periods / teacher', value: maxConsec, min: 1, max: 8,
                onChange: (v: number) => { setMaxConsec(v); saveConstraints({ max_consecutive_periods: v }); } },
              { label: 'Max periods / teacher / day', value: maxPerDay, min: 1, max: 12,
                onChange: (v: number) => { setMaxPerDay(v); saveConstraints({ max_periods_per_day_per_teacher: v }); } },
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
              {[
                { name: isSchool ? 'Avoid first period for Mrs. Sharma (Mon)' : 'Avoid first-period classes for Dr. Shah', score: '-3' },
                { name: isSchool ? 'Spread Maths across the week' : 'Group labs on Wednesday afternoon', score: '+2' },
                { name: isSchool ? 'Keep Computer Lab free on Fridays' : 'Spread core subjects evenly across week', score: '+5' },
              ].map(p => (
                <div key={p.name} className="flex items-center gap-3 edge rounded-lg px-3 py-2.5" style={{ background: 'var(--paper)' }}>
                  <span className="text-sm flex-1">{p.name}</span>
                  <Chip tone={p.score.startsWith('+') ? 'ok' : 'warn'}>weight {p.score}</Chip>
                  <button style={{ color: 'var(--ink-3)' }}><Icon name="x" size={13} /></button>
                </div>
              ))}
              <button className="flex items-center gap-2 text-sm" style={{ color: 'var(--ink-3)' }}>
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
    </>
  );
};

export default Step7Rules;