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
interface CourseRow {
  code: string;
  name: string;
  department: string;
  year: number;
  credits: number;
  enrolled_students: number;
  is_elective: boolean;
  required_lecture_room_type: string;
  required_lab_room_type: string | null;
}

const LECTURE_ROOM_TYPES = ['classroom', 'lecture_hall', 'seminar_room'];
const LAB_ROOM_TYPES = ['computer_lab', 'physics_lab', 'chemistry_lab'];

const creditsLabel = (credits: number): string => {
  if (credits === 2) return '2 lectures/week';
  if (credits === 3) return '3 lectures/week';
  if (credits === 4) return '3 lectures + 1 lab block (2 periods)/week';
  return '';
};

const DEFAULT_ROWS: CourseRow[] = [
  // CS dept — 3 lecture-only, 2 with lab
  // enrolled > largest single lecture hall → auto-splits into 2 sections each
  { code: 'CS501', name: 'Theory of Computation', department: 'CS', year: 3, credits: 3, enrolled_students: 160, is_elective: false, required_lecture_room_type: 'lecture_hall', required_lab_room_type: null },
  { code: 'CS502', name: 'Compiler Design',        department: 'CS', year: 3, credits: 3, enrolled_students: 150, is_elective: false, required_lecture_room_type: 'lecture_hall', required_lab_room_type: null },
  { code: 'CS503', name: 'Computer Networks',      department: 'CS', year: 3, credits: 3, enrolled_students: 140, is_elective: false, required_lecture_room_type: 'lecture_hall', required_lab_room_type: null },
  // enrolled 110 → 2 lecture sections; lab each section fits in 60-cap lab
  { code: 'CS504', name: 'Operating Systems Lab',  department: 'CS', year: 3, credits: 4, enrolled_students: 110, is_elective: false, required_lecture_room_type: 'lecture_hall', required_lab_room_type: 'computer_lab' },
  { code: 'CS505', name: 'Database Systems Lab',   department: 'CS', year: 3, credits: 4, enrolled_students: 110, is_elective: false, required_lecture_room_type: 'lecture_hall', required_lab_room_type: 'computer_lab' },
  // IT dept
  { code: 'IT501', name: 'Software Engineering',   department: 'IT', year: 3, credits: 3, enrolled_students: 150, is_elective: false, required_lecture_room_type: 'lecture_hall', required_lab_room_type: null },
  { code: 'IT502', name: 'Web Technologies Lab',   department: 'IT', year: 3, credits: 4, enrolled_students: 110, is_elective: false, required_lecture_room_type: 'lecture_hall', required_lab_room_type: 'computer_lab' },
  { code: 'IT503', name: 'Machine Learning',       department: 'IT', year: 3, credits: 2, enrolled_students: 130, is_elective: true,  required_lecture_room_type: 'lecture_hall', required_lab_room_type: null },
];

/* ── Component ── */
const CollegeStep2CourseOfferings: React.FC = () => {
  const { workflow } = useWizardStore();
  const { courseOfferings, setCourseOfferings, collegeInstitution } = useOnboardingStore();

  const deptCodes: string[] =
    collegeInstitution?.departments?.map(d => d.code).filter(Boolean) ?? ['CS'];

  const [rows, setRows] = useState<CourseRow[]>(() => {
    if (!courseOfferings?.length) {
      setTimeout(() => setCourseOfferings(DEFAULT_ROWS), 0);
      return DEFAULT_ROWS;
    }
    return courseOfferings.map(r => ({ ...r }));
  });

  const update = (next: CourseRow[]) => {
    setRows(next);
    setCourseOfferings(next);
  };

  const updateRow = (index: number, patch: Partial<CourseRow>) => {
    const next = rows.map((r, i) => {
      if (i !== index) return r;
      const updated = { ...r, ...patch };
      // When credits changes away from 4, clear lab room type
      if (patch.credits !== undefined && patch.credits !== 4) {
        updated.required_lab_room_type = null;
      }
      return updated;
    });
    update(next);
  };

  const addRow = () => {
    const newRow: CourseRow = {
      code: '',
      name: '',
      department: deptCodes[0] ?? 'CS',
      year: 1,
      credits: 3,
      enrolled_students: 30,
      is_elective: false,
      required_lecture_room_type: 'classroom',
      required_lab_room_type: null,
    };
    update([...rows, newRow]);
  };

  const removeRow = (index: number) => {
    update(rows.filter((_, i) => i !== index));
  };

  return (
    <WizardShell step={2} title="Course Offerings">
      <p className="text-sm mb-3" style={{ color: 'var(--ink-3)' }}>
        Define courses offered this semester. Each course specifies weekly session load.
      </p>

      {/* Helper text */}
      <div className="rounded-md px-3 py-2 mb-5 text-[12px]"
        style={{ background: 'var(--paper-2)', border: '1px solid var(--line)', color: 'var(--ink-2)' }}>
        2cr = 2 lectures/week &nbsp;·&nbsp; 3cr = 3 lectures/week &nbsp;·&nbsp; 4cr = 3 lectures + 1 lab block/week
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--line)' }}>
              {['Code', 'Name', 'Dept', 'Year', 'Cr', 'Enrolled', 'Elective', 'Lecture Room', 'Lab Room', 'Load', ''].map(h => (
                <th key={h} className="text-left pb-2 pr-2 text-[11px] font-semibold whitespace-nowrap"
                  style={{ color: 'var(--ink-3)' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} style={{ borderBottom: '1px solid var(--line)' }}>
                {/* Code */}
                <td className="py-2 pr-2" style={{ minWidth: 80 }}>
                  <TInput
                    value={row.code}
                    placeholder="CS301"
                    onChange={e => updateRow(i, { code: e.target.value.toUpperCase() })}
                  />
                </td>
                {/* Name */}
                <td className="py-2 pr-2" style={{ minWidth: 140 }}>
                  <TInput
                    value={row.name}
                    placeholder="Course name"
                    onChange={e => updateRow(i, { name: e.target.value })}
                  />
                </td>
                {/* Department */}
                <td className="py-2 pr-2" style={{ minWidth: 80 }}>
                  <TSelect
                    value={row.department}
                    onChange={e => updateRow(i, { department: e.target.value })}
                  >
                    {deptCodes.map(c => <option key={c} value={c}>{c}</option>)}
                  </TSelect>
                </td>
                {/* Year */}
                <td className="py-2 pr-2" style={{ minWidth: 60 }}>
                  <TSelect
                    value={row.year}
                    onChange={e => updateRow(i, { year: Number(e.target.value) })}
                  >
                    {[1, 2, 3, 4].map(y => <option key={y} value={y}>{y}</option>)}
                  </TSelect>
                </td>
                {/* Credits */}
                <td className="py-2 pr-2" style={{ minWidth: 55 }}>
                  <TSelect
                    value={row.credits}
                    onChange={e => updateRow(i, { credits: Number(e.target.value) })}
                  >
                    {[2, 3, 4].map(c => <option key={c} value={c}>{c}</option>)}
                  </TSelect>
                </td>
                {/* Enrolled */}
                <td className="py-2 pr-2" style={{ minWidth: 70 }}>
                  <TInput
                    type="number"
                    min={1}
                    value={row.enrolled_students}
                    onChange={e => updateRow(i, { enrolled_students: Math.max(1, Number(e.target.value)) })}
                  />
                </td>
                {/* Elective */}
                <td className="py-2 pr-2 text-center" style={{ minWidth: 60 }}>
                  <input
                    type="checkbox"
                    checked={row.is_elective}
                    onChange={e => updateRow(i, { is_elective: e.target.checked })}
                    className="w-4 h-4 rounded cursor-pointer"
                    style={{ accentColor: 'var(--brand)' }}
                  />
                </td>
                {/* Lecture Room Type */}
                <td className="py-2 pr-2" style={{ minWidth: 110 }}>
                  <TSelect
                    value={row.required_lecture_room_type}
                    onChange={e => updateRow(i, { required_lecture_room_type: e.target.value })}
                  >
                    {LECTURE_ROOM_TYPES.map(t => (
                      <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
                    ))}
                  </TSelect>
                </td>
                {/* Lab Room Type — only when credits == 4 */}
                <td className="py-2 pr-2" style={{ minWidth: 110 }}>
                  {row.credits === 4 ? (
                    <TSelect
                      value={row.required_lab_room_type ?? ''}
                      onChange={e => updateRow(i, { required_lab_room_type: e.target.value || null })}
                    >
                      <option value="">— select —</option>
                      {LAB_ROOM_TYPES.map(t => (
                        <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
                      ))}
                    </TSelect>
                  ) : (
                    <span className="text-[11px]" style={{ color: 'var(--ink-3)' }}>N/A</span>
                  )}
                </td>
                {/* Load hint */}
                <td className="py-2 pr-2 whitespace-nowrap" style={{ minWidth: 100 }}>
                  <span className="text-[11px]" style={{ color: 'var(--brand)' }}>
                    {creditsLabel(row.credits)}
                  </span>
                </td>
                {/* Delete */}
                <td className="py-2">
                  <button
                    onClick={() => removeRow(i)}
                    className="flex items-center justify-center w-7 h-7 rounded"
                    style={{ color: 'var(--err)', background: 'transparent', border: 'none', cursor: 'pointer' }}
                  >
                    <Icon name="x" size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {rows.length === 0 && (
        <p className="text-sm text-center py-6" style={{ color: 'var(--ink-3)' }}>
          No courses yet. Add your first course below.
        </p>
      )}

      <div className="mt-4">
        <Btn variant="ghost" size="sm" onClick={addRow}>
          <Icon name="plus" size={14} /> Add course
        </Btn>
      </div>
    </WizardShell>
  );
};

export default CollegeStep2CourseOfferings;
