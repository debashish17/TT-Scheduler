import React, { useState } from 'react';
import { WizardShell } from '../WizardShell';
import { useWizardStore } from '../wizardStore';
import { useOnboardingStore } from '../../../store';
import { Btn, Icon } from '../../ui/primitives';

/* ── Mini primitives ── */
const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <label className="block">
    <div className="flex items-baseline justify-between mb-1.5">
      <span className="text-[12px] font-medium" style={{ color: 'var(--ink-2)' }}>{label}</span>
    </div>
    {children}
  </label>
);

const TInput: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = ({ className = '', ...props }) => (
  <input {...props} className={`w-full px-3 py-2 rounded-md text-sm outline-none ${className}`}
    style={{ background: 'var(--paper)', border: '1px solid var(--line)', color: 'var(--ink)' }}
    onFocus={e => (e.target.style.borderColor = 'var(--ink)')}
    onBlur={e => (e.target.style.borderColor = 'var(--line)')} />
);

const TSelect: React.FC<React.SelectHTMLAttributes<HTMLSelectElement>> = ({ children, ...rest }) => (
  <select {...rest} className="w-full px-3 py-2 rounded-md text-sm outline-none"
    style={{ background: 'var(--paper)', border: '1px solid var(--line)', color: 'var(--ink)' }}>
    {children}
  </select>
);

/* ── Types ── */
interface Department { code: string; name: string }

interface InstitutionState {
  name: string;
  semester: number;
  departments: Department[];
}

const DEFAULT_DEPTS: Department[] = [
  { code: 'CS', name: 'Computer Science' },
  { code: 'IT', name: 'Information Technology' },
];

const DEFAULT_STATE: InstitutionState = {
  name: 'Demo Engineering College',
  semester: 5,
  departments: DEFAULT_DEPTS,
};

/* ── Component ── */
const CollegeStep1Institution: React.FC = () => {
  const { workflow } = useWizardStore();
  const { collegeInstitution, setCollegeInstitution } = useOnboardingStore();

  const [data, setData] = useState<InstitutionState>(() => {
    if (!collegeInstitution) {
      const defaults = { ...DEFAULT_STATE };
      setTimeout(() => setCollegeInstitution(defaults), 0);
      return defaults;
    }
    return {
      name: collegeInstitution.name ?? '',
      semester: collegeInstitution.semester ?? 1,
      departments: collegeInstitution.departments?.length ? collegeInstitution.departments : DEFAULT_DEPTS,
    };
  });

  const save = (patch: Partial<InstitutionState>) => {
    const next = { ...data, ...patch };
    setData(next);
    setCollegeInstitution(next);
  };

  const updateDept = (index: number, field: keyof Department, value: string) => {
    const next = data.departments.map((d, i) => i === index ? { ...d, [field]: value } : d);
    save({ departments: next });
  };

  const addDept = () => {
    save({ departments: [...data.departments, { code: '', name: '' }] });
  };

  const removeDept = (index: number) => {
    if (data.departments.length <= 1) return;
    save({ departments: data.departments.filter((_, i) => i !== index) });
  };

  return (
    <WizardShell step={1} title="Institution">
      <p className="text-sm mb-6" style={{ color: 'var(--ink-3)' }}>
        Basic info about your college. Departments defined here are used throughout the wizard.
      </p>

      <div className="grid grid-cols-2 gap-4 mb-8">
        <Field label="Institution name">
          <TInput
            value={data.name}
            placeholder="e.g. IIIT Bangalore"
            onChange={e => save({ name: e.target.value })}
          />
        </Field>
        <Field label="Semester number">
          <TSelect
            value={data.semester}
            onChange={e => save({ semester: Number(e.target.value) })}
          >
            {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
              <option key={n} value={n}>Semester {n}</option>
            ))}
          </TSelect>
        </Field>
      </div>

      {/* Departments table */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[12px] font-medium" style={{ color: 'var(--ink-2)' }}>
            Departments
          </span>
          <span className="text-[11px]" style={{ color: 'var(--ink-3)' }}>
            {data.departments.length} department{data.departments.length !== 1 ? 's' : ''} · minimum 1 required
          </span>
        </div>

        <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--line)' }}>
          {/* Header */}
          <div className="grid grid-cols-[1fr_2fr_40px] gap-0 px-3 py-2"
            style={{ background: 'var(--paper-2)', borderBottom: '1px solid var(--line)' }}>
            <span className="text-[11px] font-semibold" style={{ color: 'var(--ink-3)' }}>CODE</span>
            <span className="text-[11px] font-semibold" style={{ color: 'var(--ink-3)' }}>NAME</span>
            <span />
          </div>

          {/* Rows */}
          {data.departments.map((dept, i) => (
            <div
              key={i}
              className="grid grid-cols-[1fr_2fr_40px] gap-2 items-center px-3 py-2"
              style={{ borderBottom: i < data.departments.length - 1 ? '1px solid var(--line)' : undefined }}
            >
              <TInput
                value={dept.code}
                placeholder="CS"
                onChange={e => updateDept(i, 'code', e.target.value.toUpperCase())}
              />
              <TInput
                value={dept.name}
                placeholder="Computer Science"
                onChange={e => updateDept(i, 'name', e.target.value)}
              />
              <button
                onClick={() => removeDept(i)}
                disabled={data.departments.length <= 1}
                className="flex items-center justify-center w-7 h-7 rounded"
                style={{
                  color: data.departments.length <= 1 ? 'var(--ink-3)' : 'var(--err)',
                  opacity: data.departments.length <= 1 ? 0.4 : 1,
                  cursor: data.departments.length <= 1 ? 'not-allowed' : 'pointer',
                  background: 'transparent',
                  border: 'none',
                }}
              >
                <Icon name="x" size={14} />
              </button>
            </div>
          ))}
        </div>

        <div className="mt-3">
          <Btn variant="ghost" size="sm" onClick={addDept}>
            <Icon name="plus" size={14} /> Add department
          </Btn>
        </div>
      </div>
    </WizardShell>
  );
};

export default CollegeStep1Institution;
