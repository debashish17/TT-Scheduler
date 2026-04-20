import React, { useState } from 'react';
import { WizardShell } from './WizardShell';
import { useWizardStore } from './wizardStore';
import { useOnboardingStore } from '../../../store';
import { Btn, Chip, Icon } from '../../ui/primitives';

interface Row { name: string; code: string; periods_per_week: number; type: string; target_classes?: string[] }

const DEFAULT_SCHOOL: Row[] = [
  { code: 'ENG', name: 'English',       periods_per_week: 6, type: 'Core' },
  { code: 'MAT', name: 'Mathematics',   periods_per_week: 6, type: 'Core' },
  { code: 'SCI', name: 'Science',       periods_per_week: 5, type: 'Core' },
  { code: 'SST', name: 'Social Studies',periods_per_week: 4, type: 'Core' },
  { code: 'CS',  name: 'Computer Sc.',  periods_per_week: 3, type: 'Elective' },
  { code: 'PHY', name: 'Phys. Ed.',     periods_per_week: 2, type: 'Activity' },
];

const DEFAULT_COLLEGE: Row[] = [
  { code: 'CS301', name: 'Algorithms',    periods_per_week: 3, type: 'Theory' },
  { code: 'CS302', name: 'Databases',     periods_per_week: 3, type: 'Theory' },
  { code: 'CS303', name: 'Operating Sys.',periods_per_week: 3, type: 'Theory' },
  { code: 'CS304', name: 'Networks',      periods_per_week: 3, type: 'Theory' },
  { code: 'MA301', name: 'Discrete Math', periods_per_week: 3, type: 'Theory' },
  { code: 'CS391', name: 'DB Lab',        periods_per_week: 2, type: 'Lab' },
  { code: 'CS392', name: 'OS Lab',        periods_per_week: 2, type: 'Lab' },
  { code: 'HS301', name: 'Ethics',        periods_per_week: 1, type: 'Seminar' },
];

const TYPES_SCHOOL  = ['Core', 'Elective', 'Activity', 'Language'];
const TYPES_COLLEGE = ['Theory', 'Lab', 'Seminar', 'Tutorial', 'Elective'];

const TInput: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { style?: React.CSSProperties }> = ({ style, ...props }) => (
  <input {...props} className="w-full px-2 py-1.5 rounded text-sm outline-none"
    style={{ background: 'var(--paper-2)', border: '1px solid var(--line)', color: 'var(--ink)', ...style }}
    onFocus={e => (e.target.style.borderColor = 'var(--ink)')}
    onBlur={e => (e.target.style.borderColor = 'var(--line)')} />
);

const TSelect: React.FC<React.SelectHTMLAttributes<HTMLSelectElement>> = ({ children, ...rest }) => (
  <select {...rest} className="w-full px-2 py-1.5 rounded text-sm outline-none"
    style={{ background: 'var(--paper-2)', border: '1px solid var(--line)', color: 'var(--ink)' }}>
    {children}
  </select>
);

const Step3Subjects: React.FC = () => {
  const { workflow } = useWizardStore();
  const { subjectsData, setSubjectsData, classesData } = useOnboardingStore();
  const isSchool = workflow === 'school';

  const defaults = isSchool ? DEFAULT_SCHOOL : DEFAULT_COLLEGE;
  const types    = isSchool ? TYPES_SCHOOL   : TYPES_COLLEGE;

  const [rows, setRows] = useState<Row[]>(() => {
    // No data, use defaults and persist them immediately
    if (!subjectsData?.length) {
      setTimeout(() => setSubjectsData(defaults), 0);
      return defaults;
    }
    
    // Check if existing data matches current workflow by examining type values
    const SCHOOL_TYPE_SET = new Set(TYPES_SCHOOL);
    const COLLEGE_TYPE_SET = new Set(TYPES_COLLEGE);
    
    const hasSchoolTypes = subjectsData.some((r: any) => SCHOOL_TYPE_SET.has(r.type));
    const hasCollegeTypes = subjectsData.some((r: any) => COLLEGE_TYPE_SET.has(r.type));
    
    // If data doesn't match workflow, reload defaults
    const isCorrectWorkflow = isSchool ? hasSchoolTypes : hasCollegeTypes;
    if (!isCorrectWorkflow && (hasSchoolTypes || hasCollegeTypes)) {
      return defaults;
    }
    
    // Data matches workflow or is ambiguous, use it
    return subjectsData.map((r: any) => ({
      code: r.code ?? '', name: r.name ?? '',
      periods_per_week: r.periods_per_week ?? 3, type: r.type ?? types[0],
      target_classes: r.target_classes
    }));
  });

  const update = (i: number, field: keyof Row, value: string | number) => {
    const next = rows.map((r, idx) => idx === i ? { ...r, [field]: value } : r);
    setRows(next);
    setSubjectsData(next);
  };

  const toggleClass = (i: number, className: string) => {
    const next = rows.map((r, idx) => {
      if (idx === i) {
        const targetClasses = r.target_classes || [];
        return {
          ...r,
          target_classes: targetClasses.includes(className)
            ? targetClasses.filter(c => c !== className)
            : [...targetClasses, className]
        };
      }
      return r;
    });
    setRows(next);
    setSubjectsData(next);
  };

  const addRow = () => {
    const next = [...rows, { code: '', name: '', periods_per_week: 3, type: types[0], ...(isSchool ? { target_classes: [] } : {}) }];
    setRows(next);
    setSubjectsData(next);
  };

  const removeRow = (i: number) => {
    const next = rows.filter((_, idx) => idx !== i);
    setRows(next);
    setSubjectsData(next);
  };

  const totalPeriods = rows.reduce((s, r) => s + (Number(r.periods_per_week) || 0), 0);

  return (
    <WizardShell step={3} title={isSchool ? 'Subjects' : 'Courses'}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <p className="text-sm" style={{ color: 'var(--ink-3)' }}>
            {isSchool
              ? 'List every subject taught, how many periods per week, and its type.'
              : 'List courses with credit hours and type (theory/lab/seminar).'}
          </p>
          <Btn variant="soft" size="sm"><Icon name="import" size={13} /> Import CSV</Btn>
        </div>

        <div className="edge rounded-lg overflow-hidden" style={{ background: 'var(--paper)' }}>
          <table className="w-full text-sm">
            <thead style={{ background: 'var(--paper-2)' }}>
              <tr style={{ color: 'var(--ink-3)' }}>
                <th className="py-2 px-4 text-left eyebrow font-medium w-24">Code</th>
                <th className="py-2 px-4 text-left eyebrow font-medium">Name</th>
                <th className="py-2 px-4 text-left eyebrow font-medium w-28">{isSchool ? 'Periods/wk' : 'Credits/hrs'}</th>
                <th className="py-2 px-4 text-left eyebrow font-medium w-36">Type</th>
                <th className="py-2 px-4 w-10" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <React.Fragment key={i}>
                  <tr style={{ borderTop: '1px solid var(--line)' }}>
                    <td className="py-2 px-4">
                      <TInput value={r.code} onChange={e => update(i, 'code', e.target.value.toUpperCase())}
                        placeholder="CODE" style={{ width: 80 } as React.CSSProperties} />
                    </td>
                    <td className="py-2 px-4">
                      <TInput value={r.name} onChange={e => update(i, 'name', e.target.value)}
                        placeholder={isSchool ? 'Subject name' : 'Course name'} />
                    </td>
                    <td className="py-2 px-4">
                      <TInput type="number" value={r.periods_per_week} min={1} max={20}
                        onChange={e => update(i, 'periods_per_week', parseInt(e.target.value) || 0)}
                        style={{ width: 70 } as React.CSSProperties} />
                    </td>
                    <td className="py-2 px-4">
                      <TSelect value={r.type} onChange={e => update(i, 'type', e.target.value)}>
                        {types.map(t => <option key={t}>{t}</option>)}
                      </TSelect>
                    </td>
                    <td className="py-2 px-4">
                      <button onClick={() => removeRow(i)} style={{ color: 'var(--ink-3)' }}>
                        <Icon name="x" size={14} />
                      </button>
                    </td>
                  </tr>
                  {isSchool && classesData && classesData.length > 0 && (
                    <tr style={{ borderTop: '1px solid var(--line)', background: 'var(--paper-2)' }}>
                      <td colSpan={5} className="py-3 px-4">
                        <div className="flex flex-wrap gap-2 items-center">
                          <span className="text-xs font-medium" style={{ color: 'var(--ink-3)' }}>For Classes:</span>
                          {classesData.map((cls: any, idx: number) => {
                            const isSelected = (r.target_classes || []).includes(cls.name);
                            return (
                              <button
                                key={idx}
                                onClick={() => toggleClass(i, cls.name)}
                                className="px-2.5 py-1 rounded text-xs font-medium transition-colors"
                                style={{
                                  background: isSelected ? 'var(--brand)' : 'var(--paper)',
                                  color: isSelected ? 'white' : 'var(--ink-2)',
                                  border: isSelected ? 'none' : '1px solid var(--line)'
                                }}
                              >
                                {cls.name}
                              </button>
                            );
                          })}
                          {(r.target_classes || []).length === 0 && (
                            <span className="text-xs italic" style={{ color: 'var(--ink-3)' }}>(Applies to all classes if none selected)</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
          <button type="button" onClick={addRow}
            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm rounded-b-lg"
            style={{ color: 'var(--ink-3)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--paper-2)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            <Icon name="plus" size={13} /> Add {isSchool ? 'subject' : 'course'}
          </button>
        </div>

        {/* Summary strip */}
        <div className="flex items-center gap-4 px-4 py-3 rounded-lg text-sm mono"
          style={{ background: 'var(--brand-soft)', color: 'var(--brand)' }}>
          <span><strong>{rows.length}</strong> {isSchool ? 'subjects' : 'courses'}</span>
          <span style={{ color: 'var(--line)' }}>|</span>
          <span><strong>{totalPeriods}</strong> periods/week total</span>
        </div>

        {!isSchool && (
          <div className="edge rounded-lg p-4 text-sm" style={{ background: 'var(--paper)' }}>
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium">Lab pairing</span>
              <Chip tone="brand">Auto-detect</Chip>
            </div>
            <p style={{ color: 'var(--ink-3)' }}>
              Lab courses will be auto-paired with their theory counterpart and scheduled consecutively.
            </p>
          </div>
        )}
      </div>
    </WizardShell>
  );
};

export default Step3Subjects;
