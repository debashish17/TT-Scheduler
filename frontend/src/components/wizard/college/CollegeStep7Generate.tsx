import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { WizardShell } from '../WizardShell';
import { useWizardStore } from '../wizardStore';
import { useOnboardingStore } from '../../../store';
import { Btn, Eyebrow, Chip, Icon } from '../../ui/primitives';
import { simpleTimetableAPI, snapshotsAPI } from '../../../api/client';

// ─── Types ───────────────────────────────────────────────────────
interface PreflightCheck {
  level: 'error' | 'warning';
  message: string;
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
  } = useOnboardingStore();

  const [isGenerating, setIsGenerating] = useState(false);
  const [solveProgress, setSolveProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [solverWarnings, setSolverWarnings] = useState<any[]>([]);
  const [showSolverWarnings, setShowSolverWarnings] = useState(false);

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
  const buildCollegeRequest = () => {
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
      course_offerings: courseOfferings.map(c => ({
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
      faculty: collegeFaculty.map(f => ({
        code: f.code,
        name: f.name,
        department: f.department,
        courses_can_teach: f.courses_can_teach,
        max_hours_per_week: f.max_hours_per_week,
      })),
      rooms: collegeRooms.map(r => ({
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

  // ─── Generate handler ─────────────────────────────────────────────────────
  const handleGenerate = async () => {
    setIsGenerating(true);
    setError(null);
    setSolverWarnings([]);
    setSolveProgress(0);
    setShowSolverWarnings(false);

    try {
      const request = buildCollegeRequest();

      console.log('📤 College timetable request:', JSON.stringify(request, null, 2));

      // Simulate progress
      let p = 0;
      const progressTick = setInterval(() => {
        p += 0.04 + Math.random() * 0.05;
        if (p > 0.9) p = 0.9;
        setSolveProgress(p);
      }, 150);

      const response = await simpleTimetableAPI.generateCollege(request);
      clearInterval(progressTick);
      setSolveProgress(1);

      const timetableData = response.data;
      setGeneratedTimetable(timetableData);

      const warnings: any[] = timetableData.warnings || [];
      setSolverWarnings(warnings);

      if (warnings.length > 0) {
        setShowSolverWarnings(true);
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
            institution_data: collegeInstitution || {},
            classes_data: courseOfferings || [],
            subjects_data: courseOfferings || [],
            teachers_data: collegeFaculty || [],
            time_data: collegeSchedule || {},
            rooms_data: collegeRooms || [],
            constraints_data: collegeConstraints || {},
            generated_timetable: timetableData,
          });
        } catch (snapErr: any) {
          console.warn('Snapshot save warning:', snapErr.message);
        }
      }

      // Navigate after short delay (gives time to see solve overlay complete)
      await new Promise((r) => setTimeout(r, 700));
      navigate('/timetable');
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
    </>
  );
};

export default CollegeStep7Generate;
