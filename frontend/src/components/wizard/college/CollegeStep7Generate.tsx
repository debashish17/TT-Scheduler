import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { WizardShell } from '../WizardShell';
import { useWizardStore } from '../wizardStore';
import { useOnboardingStore } from '../../../store';
import { Btn, Eyebrow, Chip, Icon } from '../../ui/primitives';
import { collegeAPI } from '../../../api/client';

// ─── Types ───────────────────────────────────────────────────────
interface PreflightCheck {
  level: 'error' | 'warning';
  message: string;
}

interface SolverWarning {
  level: 'error' | 'warning' | 'info';
  code: string;
  message: string;
  detail?: Record<string, any>;
}

interface CollegeFixState {
  faculty: any[];
  rooms: any[];
  courseOfferings: any[];
}

// ─── College autofix ─────────────────────────────────────────────────────────
function computeCollegeFixes(
  warnings: SolverWarning[],
  initial: CollegeFixState,
): { faculty: any[]; rooms: any[]; courseOfferings: any[]; log: string[] } {
  let faculty = [...(initial.faculty || [])];
  let rooms = [...(initial.rooms || [])];
  let courseOfferings = [...(initial.courseOfferings || [])];
  const log: string[] = [];
  const seen = new Set<string>();

  for (const w of warnings) {
    const d = w.detail || {};

    if (w.code === 'NO_QUALIFIED_FACULTY') {
      const courseCode = d.course_code as string;
      const k = `add_fac_${courseCode}`;
      if (!seen.has(k)) {
        seen.add(k);
        let count = 1;
        while (faculty.some(f => f.code === `${courseCode}_FAC_${count}`)) count++;
        faculty.push({
          code: `${courseCode}_FAC_${count}`,
          name: `${courseCode} Faculty ${count}`,
          department: '',
          courses_can_teach: [courseCode],
          max_hours_per_week: 20,
        });
        log.push(`✔ Added faculty for course "${courseCode}"`);
      }
    }

    if (w.code === 'NO_LECTURE_ROOM_FOR_COURSE') {
      const courseCode = d.course_code as string;
      const requiredType = (d.required_type as string) || 'classroom';
      const minSize = (d.min_section_size as number) || 30;
      const k = `add_lect_room_${courseCode}`;
      if (!seen.has(k)) {
        seen.add(k);
        rooms.push({
          name: `${requiredType.charAt(0).toUpperCase() + requiredType.slice(1)} ${rooms.length + 1}`,
          capacity: minSize,
          room_type: requiredType,
        });
        log.push(`✔ Added ${requiredType} (cap ${minSize}) for course "${courseCode}"`);
      }
    }

    if (w.code === 'NO_LAB_ROOM_FOR_COURSE') {
      const courseCode = d.course_code as string;
      const labType = (d.required_lab_type as string) || 'lab';
      const k = `add_lab_${labType}_${courseCode}`;
      if (!seen.has(k)) {
        seen.add(k);
        rooms.push({
          name: `${labType.charAt(0).toUpperCase() + labType.slice(1)} ${rooms.length + 1}`,
          capacity: 30,
          room_type: labType,
        });
        log.push(`✔ Added ${labType} room for course "${courseCode}"`);
      }
    }

    if (w.code === 'NO_LAB_ROOM_CAPACITY') {
      const courseCode = d.course_code as string;
      const labType = (d.required_lab_type as string) || 'lab';
      const minSize = (d.min_section_size as number) || 30;
      const k = `add_lab_cap_${courseCode}`;
      if (!seen.has(k)) {
        seen.add(k);
        rooms.push({
          name: `${labType.charAt(0).toUpperCase() + labType.slice(1)} ${rooms.length + 1}`,
          capacity: minSize,
          room_type: labType,
        });
        log.push(`✔ Added larger ${labType} (cap ${minSize}) for course "${courseCode}"`);
      }
    }

    if (w.code === 'SCHEDULE_OVERSUBSCRIBED' && !seen.has('reduce_lpw')) {
      seen.add('reduce_lpw');
      courseOfferings = courseOfferings.map((c: any) => ({
        ...c,
        lectures_per_week: Math.max(1, (c.lectures_per_week ?? 3) - 1),
      }));
      log.push('✔ Reduced lectures/week by 1 for all courses');
    }

    // DEPT_COURSE_MISMATCH and MINIMUM_LOAD_INFEASIBLE are intentionally skipped
  }

  return { faculty, rooms, courseOfferings, log };
}

// ─── Solving overlay ──────────────────────────────────────────────────────────
const SOLVER_STEPS = [
  'Validating problem',
  'Deriving sections',
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

const CollegeStep7Generate: React.FC = () => {
  const navigate = useNavigate();
  const { workflow } = useWizardStore();
  const {
    collegeInstitution, courseOfferings, collegeFaculty, collegeRooms,
    collegeSchedule, collegeConstraints, softConstraintsCollege,
    setGeneratedTimetable, setTimetableError,
    setCourseOfferings, setCollegeFaculty, setCollegeRooms,
  } = useOnboardingStore();

  const [isGenerating, setIsGenerating] = useState(false);
  const [solveProgress, setSolveProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [solverWarnings, setSolverWarnings] = useState<any[]>([]);
  const [showSolverWarnings, setShowSolverWarnings] = useState(false);

  // ─── Autofix state ────────────────────────────────────────────────────────
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [aiSolveLog, setAiSolveLog] = useState<string[]>([]);
  const [isAiSolving, setIsAiSolving] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [newFacultyNames, setNewFacultyNames] = useState<{ original: string; current: string }[]>([]);
  const [newRoomNames, setNewRoomNames] = useState<{ original: string; current: string }[]>([]);
  const pendingRenameRef = useRef<{ faculty: { original: string; current: string }[]; rooms: { original: string; current: string }[] } | null>(null);

  // ─── Pre-flight checks (computed on render) ──────────────────────────────
  const computePreflightChecks = (): PreflightCheck[] => {
    const checks: PreflightCheck[] = [];
    const rooms = collegeRooms ?? [];
    const courses = courseOfferings ?? [];
    const faculty = collegeFaculty ?? [];
    const roomTypes = new Set(rooms.map(r => r.room_type));

    // Error: empty collections
    if (courses.length === 0) {
      checks.push({ level: 'error', message: 'Add at least one course offering.' });
    }
    if (faculty.length === 0) {
      checks.push({ level: 'error', message: 'Add at least one faculty member.' });
    }
    if (rooms.length === 0) {
      checks.push({ level: 'error', message: 'Add at least one room.' });
    }

    for (const c of courses) {
      // Error: required lecture room type missing
      if (c.required_lecture_room_type && !roomTypes.has(c.required_lecture_room_type)) {
        checks.push({
          level: 'error',
          message: `Course ${c.code} needs a '${c.required_lecture_room_type}' but no such room exists.`,
        });
      }

      // Error: required lab room type missing or too small
      if (c.required_lab_room_type) {
        const labRooms = rooms.filter(r => r.room_type === c.required_lab_room_type);
        if (labRooms.length === 0) {
          checks.push({
            level: 'error',
            message: `Course ${c.code} needs a '${c.required_lab_room_type}' lab room but none exists.`,
          });
        } else {
          // Check total lab capacity across all lab rooms of the required type
          const totalLabCap = labRooms.reduce((sum, r) => sum + r.capacity, 0);
          const maxLabCap = Math.max(...labRooms.map(r => r.capacity));
          if (totalLabCap < c.enrolled_students) {
            checks.push({
              level: 'error',
              message: `Course ${c.code} has ${c.enrolled_students} enrolled but all '${c.required_lab_room_type}' rooms combined hold only ${totalLabCap}. Add more lab rooms.`,
            });
          } else if (maxLabCap < 1) {
            checks.push({
              level: 'error',
              message: `Course ${c.code} has no usable '${c.required_lab_room_type}' lab rooms.`,
            });
          }
        }
      }

      // Error: no qualified faculty
      const hasQualified = faculty.some(f => f.courses_can_teach.includes(c.code));
      if (!hasQualified) {
        checks.push({
          level: 'error',
          message: `Course ${c.code} has no qualified faculty.`,
        });
      }

      // Warning: unknown department
      const deptCodes = new Set((collegeInstitution?.departments ?? []).map((d: { code: string; name: string }) => d.code));
      if (c.department && deptCodes.size > 0 && !deptCodes.has(c.department)) {
        checks.push({
          level: 'warning',
          message: `Course ${c.code} references unknown department '${c.department}'.`,
        });
      }
    }

    return checks;
  };

  const preflight = computePreflightChecks();
  const hasErrors = preflight.some(w => w.level === 'error');

  // ─── Build college request ────────────────────────────────────────────────
  const buildCollegeRequest = (overrides: { faculty?: any[]; rooms?: any[]; courseOfferings?: any[] } = {}) => {
    const schedule = collegeSchedule ?? {
      workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      periodsPerDay: 7,
      periodDurationMinutes: 60,
      startTime: '08:00',
      lunchPeriodIndex: 3,
    };
    const constraints = collegeConstraints ?? { maxConsecutivePeriods: 3, maxPeriodsPerDayPerFaculty: 6 };
    const institution = collegeInstitution ?? { name: 'My College', semester: 1, departments: [] };

    return {
      mode: 'college',
      institution_name: institution.name,
      semester: institution.semester,
      departments: institution.departments,
      course_offerings: (overrides.courseOfferings ?? courseOfferings).map(c => ({
        code: c.code,
        name: c.name,
        department: c.department,
        year: c.year,
        credits: c.credits,
        lectures_per_week: c.credits === 2 ? 2 : 3,
        has_lab: c.credits === 4,
        required_lecture_room_type: c.required_lecture_room_type,
        required_lab_room_type: c.credits === 4 ? c.required_lab_room_type : null,
        enrolled_students: c.enrolled_students,
        is_elective: c.is_elective,
        faculty_codes: collegeFaculty
          .filter(f => f.courses_can_teach.includes(c.code))
          .map(f => f.code),
      })),
      faculty: (overrides.faculty ?? collegeFaculty).map(f => ({
        code: f.code,
        name: f.name,
        department: f.department,
        courses_can_teach: f.courses_can_teach,
        max_hours_per_week: f.max_hours_per_week,
      })),
      rooms: (overrides.rooms ?? collegeRooms).map(r => ({
        name: r.name,
        capacity: r.capacity,
        room_type: r.room_type,
      })),
      working_days: schedule.workingDays,
      periods_per_day: schedule.periodsPerDay,
      period_duration_minutes: schedule.periodDurationMinutes,
      start_time: schedule.startTime,
      constraints: {
        lunch_period_index: schedule.lunchPeriodIndex,
        max_consecutive_periods: constraints.maxConsecutivePeriods,
        max_periods_per_day_per_faculty: constraints.maxPeriodsPerDayPerFaculty,
      },
      soft_constraints: (softConstraintsCollege ?? []).map((sc: any) => ({
        type: sc.type,
        target: sc.target,
        ...(sc.when != null ? { when: sc.when } : {}),
        weight: sc.weight,
      })),
    };
  };

  // ─── Autofix handler ──────────────────────────────────────────────────────
  const handleCollegeAiSolve = async () => {
    setIsAiSolving(true);
    try {
      const result = computeCollegeFixes(solverWarnings, {
        faculty: collegeFaculty || [],
        rooms: collegeRooms || [],
        courseOfferings: courseOfferings || [],
      });

      setAiSolveLog(result.log);
      await new Promise((r) => setTimeout(r, 900));

      const origFacultyCodes = new Set((collegeFaculty || []).map((f: any) => f.code));
      const origRoomNames = new Set((collegeRooms || []).map((r: any) => r.name));
      const newFaculty = result.faculty
        .filter((f: any) => !origFacultyCodes.has(f.code))
        .map((f: any) => ({ original: f.name, current: f.name }));
      const newRooms = result.rooms
        .filter((r: any) => !origRoomNames.has(r.name))
        .map((r: any) => ({ original: r.name, current: r.name }));

      if (newFaculty.length > 0 || newRooms.length > 0) {
        pendingRenameRef.current = { faculty: newFaculty, rooms: newRooms };
      }

      setCollegeFaculty(result.faculty);
      setCollegeRooms(result.rooms);
      setCourseOfferings(result.courseOfferings);

      setShowResolveModal(false);

      await runGenerate({
        faculty: result.faculty,
        rooms: result.rooms,
        courseOfferings: result.courseOfferings,
      });
    } finally {
      setIsAiSolving(false);
    }
  };

  // ─── Generate handler ─────────────────────────────────────────────────────
  const runGenerate = async (overrides: { faculty?: any[]; rooms?: any[]; courseOfferings?: any[] } = {}) => {
    setIsGenerating(true);
    setError(null);
    setSolverWarnings([]);
    setSolveProgress(0);
    setShowSolverWarnings(false);
    setAiSolveLog([]);

    try {
      const request = buildCollegeRequest(overrides);

      console.log('📤 College timetable request:', JSON.stringify(request, null, 2));

      // Simulate progress
      let p = 0;
      const progressTick = setInterval(() => {
        p += 0.04 + Math.random() * 0.05;
        if (p > 0.9) p = 0.9;
        setSolveProgress(p);
      }, 150);

      const response = await collegeAPI.generate(request);
      clearInterval(progressTick);
      setSolveProgress(1);

      const timetableData = response.data;
      setGeneratedTimetable(timetableData);

      const warnings: SolverWarning[] = timetableData.warnings || [];
      setSolverWarnings(warnings);

      if (warnings.length > 0) {
        const result = computeCollegeFixes(warnings, {
          faculty: overrides.faculty ?? collegeFaculty ?? [],
          rooms: overrides.rooms ?? collegeRooms ?? [],
          courseOfferings: overrides.courseOfferings ?? courseOfferings ?? [],
        });
        setAiSolveLog(result.log);
        setShowResolveModal(true);
      } else {
        const hasAssignments = (timetableData.assignments?.length ?? 0) > 0;
        await new Promise((r) => setTimeout(r, 700));
        if (
          hasAssignments &&
          pendingRenameRef.current &&
          (pendingRenameRef.current.faculty.length > 0 || pendingRenameRef.current.rooms.length > 0)
        ) {
          setNewFacultyNames(pendingRenameRef.current.faculty);
          setNewRoomNames(pendingRenameRef.current.rooms);
          pendingRenameRef.current = null;
          setShowRenameModal(true);
        } else {
          pendingRenameRef.current = null;
          navigate('/timetable');
        }
      }

      // Auto-save is built into /college/generate — run_id is returned in timetableData.
      // No separate save call needed.
      if (timetableData.run_id) {
        console.log(`Run saved automatically: ${timetableData.run_id}`);
      }

    } catch (err: any) {
      let msg: string;
      if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
        msg = 'Solver took too long. Try reducing course load or adding more resources.';
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

  const handleGenerate = async () => {
    await runGenerate();
  };

  const handleRenameConfirm = () => {
    const updatedFaculty = (collegeFaculty || []).map((f: any) => {
      const match = newFacultyNames.find(x => x.original === f.name);
      return match ? { ...f, name: match.current, code: match.current.replace(/\s+/g, '_').toUpperCase() } : f;
    });
    const updatedRooms = (collegeRooms || []).map((r: any) => {
      const match = newRoomNames.find(x => x.original === r.name);
      return match ? { ...r, name: match.current } : r;
    });
    setCollegeFaculty(updatedFaculty);
    setCollegeRooms(updatedRooms);
    setShowRenameModal(false);
    navigate('/timetable');
  };

  // ─── Room type summary ────────────────────────────────────────────────────
  const roomTypeSummary = (collegeRooms ?? []).reduce((acc: Record<string, number>, r) => {
    if (r?.room_type) {
      acc[r.room_type] = (acc[r.room_type] ?? 0) + 1;
    }
    return acc;
  }, {});

  const labCount = courseOfferings.filter(c => c.credits === 4).length;
  const schedule = collegeSchedule ?? { workingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], periodsPerDay: 7, periodDurationMinutes: 60 };

  return (
    <>
      <WizardShell step={7} title="Generate">
        <div className="space-y-6">

          {/* ── Pre-flight warnings panel ── */}
          {preflight.length > 0 && (
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--line)' }}>
              <div className="px-4 py-2.5 text-[11px] mono font-semibold" style={{ background: 'var(--paper-2)', color: 'var(--ink-3)', borderBottom: '1px solid var(--line)' }}>
                PRE-FLIGHT CHECKS
              </div>
              <div className="divide-y" style={{ borderColor: 'var(--line)' }}>
                {preflight.map((check, i) => (
                  <div key={i} className="flex items-start gap-3 px-4 py-3">
                    <div
                      className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-[10px] font-bold"
                      style={{
                        background: check.level === 'error' ? 'rgba(239,68,68,0.1)' : 'rgba(234,179,8,0.1)',
                        color: check.level === 'error' ? 'rgb(220,38,38)' : 'rgb(161,98,7)',
                      }}
                    >
                      {check.level === 'error' ? '✕' : '!'}
                    </div>
                    <span className="text-sm" style={{ color: check.level === 'error' ? 'rgb(220,38,38)' : 'rgb(161,98,7)' }}>
                      {check.message}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {preflight.length === 0 && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}>
              <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold" style={{ background: 'rgba(34,197,94,0.15)', color: 'rgb(22,163,74)' }}>
                ✓
              </div>
              <span className="text-sm font-medium" style={{ color: 'rgb(22,163,74)' }}>All pre-flight checks passed</span>
            </div>
          )}

          {/* ── Summary section ── */}
          <div className="edge rounded-xl overflow-hidden" style={{ background: 'var(--paper)' }}>
            <div className="px-4 py-2.5 text-[11px] mono font-semibold" style={{ background: 'var(--paper-2)', color: 'var(--ink-3)', borderBottom: '1px solid var(--line)' }}>
              SOLVER INPUT SUMMARY
            </div>
            <div className="divide-y" style={{ borderColor: 'var(--line)' }}>
              {[
                { label: 'Departments', value: (collegeInstitution?.departments ?? []).length },
                { label: 'Course offerings', value: `${courseOfferings.length}${labCount > 0 ? ` (${labCount} with labs)` : ''}` },
                { label: 'Faculty', value: collegeFaculty.length },
                {
                  label: 'Rooms',
                  value: collegeRooms.length > 0
                    ? `${collegeRooms.length} — ${Object.entries(roomTypeSummary).map(([t, n]) => `${n} ${t}`).join(', ')}`
                    : '0',
                },
                {
                  label: 'Schedule',
                  value: `${schedule.workingDays.length} days × ${schedule.periodsPerDay} periods × ${schedule.periodDurationMinutes}min`,
                },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-[12px] mono" style={{ color: 'var(--ink-3)' }}>{label}</span>
                  <span className="text-sm font-medium" style={{ color: 'var(--ink)' }}>{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Solver warnings from last run ── */}
          {showSolverWarnings && solverWarnings.length > 0 && (
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(234,179,8,0.3)', background: 'rgba(234,179,8,0.05)' }}>
              <div className="flex items-center justify-between px-4 py-2.5" style={{ borderBottom: '1px solid rgba(234,179,8,0.2)' }}>
                <span className="text-[11px] mono font-semibold" style={{ color: 'rgb(161,98,7)' }}>
                  SOLVER WARNINGS ({solverWarnings.length})
                </span>
                <button
                  className="text-[11px] mono"
                  style={{ color: 'var(--ink-3)' }}
                  onClick={() => setShowSolverWarnings(false)}
                >
                  dismiss
                </button>
              </div>
              <div className="divide-y px-4" style={{ borderColor: 'rgba(234,179,8,0.15)' }}>
                {solverWarnings.map((w, i) => (
                  <div key={i} className="py-2.5">
                    <div className="text-[12px] font-medium" style={{ color: 'rgb(161,98,7)' }}>
                      {w.code ?? 'WARNING'}
                    </div>
                    <div className="text-sm mt-0.5" style={{ color: 'var(--ink-2)' }}>{w.message}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Error display ── */}
          {error && (
            <div className="p-4 rounded-lg text-sm" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: 'rgb(220,38,38)' }}>
              {error}
            </div>
          )}

          {/* ── Generate button ── */}
          <div className="pt-4 flex items-center justify-between" style={{ borderTop: '1px solid var(--line)' }}>
            <div>
              <div className="eyebrow mb-0.5" style={{ color: 'var(--ink-3)' }}>Solver ready</div>
              <div className="text-sm" style={{ color: 'var(--ink-2)' }}>
                CP-SAT college solver · enrollment-driven sections · lab continuity enforced
              </div>
            </div>
            <Btn variant="brand" size="lg" onClick={handleGenerate} disabled={isGenerating || hasErrors}>
              {isGenerating ? 'Solving...' : <><Icon name="bolt" size={14} /> Generate timetable</>}
            </Btn>
          </div>

        </div>
      </WizardShell>

      {isGenerating && <SolvingOverlay progress={solveProgress} />}

      {/* Auto Resolve Modal */}
      {showResolveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 backdrop-blur-sm"
            style={{ background: 'rgba(0,0,0,0.35)' }}
            onClick={() => { if (!isAiSolving) setShowResolveModal(false); }}
          />
          <div
            className="relative w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden rounded-2xl edge"
            style={{ background: 'var(--paper)' }}
          >
            <div
              className="flex items-center justify-between px-6 pt-5 pb-4"
              style={{ borderBottom: '1px solid var(--line)' }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: 'var(--brand-soft)' }}
                >
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
                    <div
                      key={i}
                      className="flex items-start gap-3 px-4 py-3 text-sm"
                      style={{ borderTop: i > 0 ? '1px solid var(--line)' : undefined, color: 'var(--ink-2)' }}
                    >
                      <div
                        className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                        style={{ background: 'var(--brand-soft)' }}
                      >
                        <Icon name="check" size={11} style={{ color: 'var(--brand)' } as any} />
                      </div>
                      <span>{line.replace('✔', '').trim()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="px-6 py-4 flex gap-3" style={{ borderTop: '1px solid var(--line)' }}>
              <Btn
                variant="ghost"
                size="md"
                onClick={() => setShowResolveModal(false)}
                disabled={isAiSolving}
                className="flex-1 justify-center"
              >
                Cancel
              </Btn>
              <Btn
                variant="brand"
                size="md"
                onClick={handleCollegeAiSolve}
                disabled={aiSolveLog.length === 0 || isAiSolving}
                className="flex-1 justify-center"
              >
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

      {/* Rename New Resources Modal */}
      {showRenameModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 backdrop-blur-sm" style={{ background: 'rgba(0,0,0,0.38)' }} />
          <div
            className="relative w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden rounded-2xl edge"
            style={{ background: 'var(--paper)' }}
          >
            <div className="flex items-center gap-3 px-6 pt-5 pb-4" style={{ borderBottom: '1px solid var(--line)' }}>
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: 'var(--brand-soft)' }}
              >
                <Icon name="spark" size={16} style={{ color: 'var(--brand)' } as any} />
              </div>
              <div>
                <h2 className="font-semibold text-[15px]">Rename New Resources</h2>
                <Eyebrow>Auto-added during conflict resolution</Eyebrow>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              <p className="text-sm" style={{ color: 'var(--ink-3)' }}>
                These faculty and rooms were created automatically. You can rename them before viewing your timetable.
              </p>

              {newFacultyNames.length > 0 && (
                <div>
                  <Eyebrow className="block mb-3">New faculty</Eyebrow>
                  <div className="space-y-2">
                    {newFacultyNames.map((item, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                          style={{ background: 'var(--paper-2)', color: 'var(--ink-3)' }}
                        >
                          <span className="text-[10px] mono">{i + 1}</span>
                        </div>
                        <input
                          value={item.current}
                          onChange={e =>
                            setNewFacultyNames(prev =>
                              prev.map((x, j) => j === i ? { ...x, current: e.target.value } : x)
                            )
                          }
                          className="flex-1 px-3 py-2 rounded-lg text-sm outline-none"
                          style={{ background: 'var(--paper)', border: '1px solid var(--ink)', color: 'var(--ink)' }}
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
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                          style={{ background: 'var(--paper-2)', color: 'var(--ink-3)' }}
                        >
                          <span className="text-[10px] mono">{i + 1}</span>
                        </div>
                        <input
                          value={item.current}
                          onChange={e =>
                            setNewRoomNames(prev =>
                              prev.map((x, j) => j === i ? { ...x, current: e.target.value } : x)
                            )
                          }
                          className="flex-1 px-3 py-2 rounded-lg text-sm outline-none"
                          style={{ background: 'var(--paper)', border: '1px solid var(--ink)', color: 'var(--ink)' }}
                          placeholder={item.original}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-4 flex gap-3" style={{ borderTop: '1px solid var(--line)' }}>
              <Btn
                variant="ghost"
                size="md"
                onClick={() => { setShowRenameModal(false); navigate('/timetable'); }}
                className="flex-1 justify-center"
              >
                Skip
              </Btn>
              <Btn
                variant="brand"
                size="md"
                onClick={handleRenameConfirm}
                className="flex-1 justify-center"
              >
                Save &amp; View Timetable
              </Btn>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default CollegeStep7Generate;
