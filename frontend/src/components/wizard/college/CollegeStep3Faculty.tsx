import React, { useState } from 'react';
import { WizardShell } from '../WizardShell';
import { useWizardStore } from '../wizardStore';
import { useOnboardingStore } from '../../../store';
import { Btn, Icon } from '../../ui/primitives';

/* ── Mini primitives ── */
const TInput: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = ({ className = '', ...props }) => (
  <input {...props} className={`w-full px-2 py-1.5 rounded text-sm outline-none ${className}`}
    style={{ background: 'var(--paper)', border: '1px solid var(--line)', color: 'var(--ink)' }}
    onFocus={e => (e.target.style.borderColor = 'var(--ink)')}
    onBlur={e => (e.target.style.borderColor = 'var(--line)')} />
);

const TSelect: React.FC<React.SelectHTMLAttributes<HTMLSelectElement>> = ({ children, ...rest }) => (
  <select {...rest} className="w-full px-2 py-1.5 rounded text-sm outline-none"
    style={{ background: 'var(--paper)', border: '1px solid var(--line)', color: 'var(--ink)' }}>
    {children}
  </select>
);

/* ── Types ── */
interface FacultyRow {
  code: string;
  name: string;
  department: string;
  courses_can_teach: string[];
  max_hours_per_week: number;
}

const DEFAULT_ROWS: FacultyRow[] = [
  { code: 'FAC01', name: 'Dr. Sharma',   department: 'CS', courses_can_teach: ['CS501', 'CS502'],        max_hours_per_week: 18 },
  { code: 'FAC02', name: 'Dr. Mehta',    department: 'CS', courses_can_teach: ['CS503', 'CS504'],        max_hours_per_week: 18 },
  { code: 'FAC03', name: 'Prof. Iyer',   department: 'CS', courses_can_teach: ['CS504', 'CS505'],        max_hours_per_week: 16 },
  { code: 'FAC04', name: 'Dr. Verma',    department: 'CS', courses_can_teach: ['CS502', 'CS505'],        max_hours_per_week: 18 },
  { code: 'FAC05', name: 'Prof. Nair',   department: 'IT', courses_can_teach: ['IT501', 'IT502'],        max_hours_per_week: 18 },
  { code: 'FAC06', name: 'Dr. Reddy',    department: 'IT', courses_can_teach: ['IT502', 'IT503'],        max_hours_per_week: 16 },
];

/* ── Weekly session count for a course by credits ── */
const sessionsPerWeek = (credits: number): number => {
  if (credits === 4) return 4; // 3 lectures + 1 lab block (2 periods but 1 session)
  return credits;
};

/* ── Component ── */
const CollegeStep3Faculty: React.FC = () => {
  const { workflow } = useWizardStore();
  const { collegeFaculty, setCollegeFaculty, collegeInstitution, courseOfferings } = useOnboardingStore();

  const deptCodes: string[] =
    collegeInstitution?.departments?.map(d => d.code).filter(Boolean) ?? ['CS'];

  const allCourseCodes: string[] = (courseOfferings ?? []).map(c => c.code).filter(Boolean);

  // Map code -> credits for load estimation
  const creditsMap: Record<string, number> = {};
  (courseOfferings ?? []).forEach(c => { creditsMap[c.code] = c.credits; });

  const [rows, setRows] = useState<FacultyRow[]>(() => {
    if (!collegeFaculty?.length) {
      setTimeout(() => setCollegeFaculty(DEFAULT_ROWS), 0);
      return DEFAULT_ROWS;
    }
    return collegeFaculty.map(r => ({ ...r }));
  });

  const update = (next: FacultyRow[]) => {
    setRows(next);
    setCollegeFaculty(next);
  };

  const updateRow = (index: number, patch: Partial<FacultyRow>) => {
    update(rows.map((r, i) => i === index ? { ...r, ...patch } : r));
  };

  const toggleCourse = (rowIndex: number, courseCode: string) => {
    const current = rows[rowIndex].courses_can_teach;
    const next = current.includes(courseCode)
      ? current.filter(c => c !== courseCode)
      : [...current, courseCode];
    updateRow(rowIndex, { courses_can_teach: next });
  };

  const addRow = () => {
    update([...rows, {
      code: '',
      name: '',
      department: deptCodes[0] ?? 'CS',
      courses_can_teach: [],
      max_hours_per_week: 18,
    }]);
  };

  const removeRow = (index: number) => {
    update(rows.filter((_, i) => i !== index));
  };

  /* Sole-qualifier warning: for each faculty, count courses where they are the
     only faculty who can teach it, then sum their forced session load. */
  const computeWarning = (row: FacultyRow): boolean => {
    const soleCourses = row.courses_can_teach.filter(code => {
      const qualifiers = rows.filter(r => r.courses_can_teach.includes(code));
      return qualifiers.length === 1;
    });
    const forcedLoad = soleCourses.reduce((sum, code) => sum + sessionsPerWeek(creditsMap[code] ?? 3), 0);
    return forcedLoad > row.max_hours_per_week;
  };

  return (
    <WizardShell step={3} title="Faculty">
      <p className="text-sm mb-6" style={{ color: 'var(--ink-3)' }}>
        Add faculty members and assign which courses they can teach. The solver picks allocations automatically.
      </p>

      <div className="space-y-4">
        {rows.map((row, i) => {
          const hasWarning = computeWarning(row);
          return (
            <div key={i} className="rounded-xl p-4"
              style={{ border: `1px solid ${hasWarning ? 'var(--warn)' : 'var(--line)'}`, background: 'var(--paper)' }}>

              {/* Row header */}
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="grid grid-cols-4 gap-3 flex-1">
                  {/* Code */}
                  <div>
                    <div className="text-[11px] font-medium mb-1" style={{ color: 'var(--ink-3)' }}>Code</div>
                    <TInput
                      value={row.code}
                      placeholder="FAC01"
                      onChange={e => updateRow(i, { code: e.target.value.toUpperCase() })}
                    />
                  </div>
                  {/* Name */}
                  <div className="col-span-2">
                    <div className="text-[11px] font-medium mb-1" style={{ color: 'var(--ink-3)' }}>Full name</div>
                    <TInput
                      value={row.name}
                      placeholder="Prof. A"
                      onChange={e => updateRow(i, { name: e.target.value })}
                    />
                  </div>
                  {/* Department */}
                  <div>
                    <div className="text-[11px] font-medium mb-1" style={{ color: 'var(--ink-3)' }}>Department</div>
                    <TSelect
                      value={row.department}
                      onChange={e => updateRow(i, { department: e.target.value })}
                    >
                      {deptCodes.map(c => <option key={c} value={c}>{c}</option>)}
                    </TSelect>
                  </div>
                </div>

                {/* Max hrs + delete */}
                <div className="flex items-start gap-2 shrink-0">
                  <div>
                    <div className="text-[11px] font-medium mb-1" style={{ color: 'var(--ink-3)' }}>Max hrs/wk</div>
                    <TInput
                      type="number"
                      min={1}
                      max={40}
                      value={row.max_hours_per_week}
                      onChange={e => updateRow(i, { max_hours_per_week: Math.max(1, Number(e.target.value)) })}
                      style={{ width: 70 }}
                      className=""
                    />
                  </div>
                  <button
                    onClick={() => removeRow(i)}
                    className="mt-5 flex items-center justify-center w-7 h-7 rounded"
                    style={{ color: 'var(--err)', background: 'transparent', border: 'none', cursor: 'pointer' }}
                  >
                    <Icon name="x" size={14} />
                  </button>
                </div>
              </div>

              {/* Course chip picker */}
              <div>
                <div className="text-[11px] font-medium mb-2" style={{ color: 'var(--ink-3)' }}>
                  Courses can teach
                  {row.courses_can_teach.length > 0 && (
                    <span className="ml-2 font-normal">({row.courses_can_teach.length} selected)</span>
                  )}
                </div>
                {allCourseCodes.length === 0 ? (
                  <span className="text-[11px]" style={{ color: 'var(--ink-3)' }}>
                    No courses yet — add them in Step 2 first.
                  </span>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {allCourseCodes.map(code => {
                      const selected = row.courses_can_teach.includes(code);
                      return (
                        <button
                          key={code}
                          onClick={() => toggleCourse(i, code)}
                          className="px-2.5 py-1 rounded-full text-[11px] font-medium transition-all"
                          style={{
                            background: selected ? 'var(--brand)' : 'var(--paper-2)',
                            color: selected ? 'white' : 'var(--ink-2)',
                            border: `1px solid ${selected ? 'var(--brand)' : 'var(--line)'}`,
                            cursor: 'pointer',
                          }}
                        >
                          {code}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Warning badge */}
              {hasWarning && (
                <div className="mt-3 flex items-center gap-2 rounded-md px-3 py-2 text-[12px]"
                  style={{ background: 'color-mix(in srgb, var(--warn) 12%, var(--paper))', border: '1px solid var(--warn)', color: 'var(--ink-2)' }}>
                  <Icon name="bolt" size={13} />
                  <span>Minimum forced load may exceed cap</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {rows.length === 0 && (
        <p className="text-sm text-center py-6" style={{ color: 'var(--ink-3)' }}>
          No faculty yet. Add your first faculty member below.
        </p>
      )}

      <div className="mt-4">
        <Btn variant="ghost" size="sm" onClick={addRow}>
          <Icon name="plus" size={14} /> Add faculty
        </Btn>
      </div>
    </WizardShell>
  );
};

export default CollegeStep3Faculty;
