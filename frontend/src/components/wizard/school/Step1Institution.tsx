import React, { useState } from 'react';
import { WizardShell } from '../WizardShell';
import { useWizardStore } from '../wizardStore';
import { useOnboardingStore } from '../../../store';

const Field: React.FC<{ label: string; hint?: string; children: React.ReactNode }> = ({ label, hint, children }) => (
  <label className="block">
    <div className="flex items-baseline justify-between mb-1.5">
      <span className="text-[12px] font-medium" style={{ color: 'var(--ink-2)' }}>{label}</span>
      {hint && <span className="text-[11px] mono" style={{ color: 'var(--ink-3)' }}>{hint}</span>}
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

const Step1Institution: React.FC = () => {
  const { workflow } = useWizardStore();
  const { institutionData, setInstitutionData } = useOnboardingStore();
  const isSchool = workflow === 'school';

  const [data, setData] = useState(() => {
    // If no data exists, use workflow-appropriate defaults and persist them immediately
    if (!institutionData) {
      const defaults = {
        name: isSchool ? 'Delhi Public School, RK Puram' : 'IIIT Bangalore',
        type: isSchool ? 'School' : 'College',
        city: isSchool ? 'New Delhi' : 'Bangalore',
        email: isSchool ? 'principal@dps.edu' : 'admin@iiitb.ac.in',
        academicYear: '2026–27',
        term: isSchool ? 'Annual' : 'Semester 1',
      };
      setTimeout(() => setInstitutionData({ ...defaults, workflow }), 0);
      return defaults;
    }

    // Check if existing data matches current workflow. Prefer the explicit
    // `workflow` field; fall back to `type` for legacy data that predates it.
    const dataIsSchool = institutionData.workflow
      ? institutionData.workflow === 'school'
      : institutionData.type === 'School';
    const workflowMismatch = isSchool !== dataIsSchool;

    // If workflow changed, reset to appropriate defaults
    if (workflowMismatch) {
      const defaults = {
        name: isSchool ? 'Delhi Public School, RK Puram' : 'IIIT Bangalore',
        type: isSchool ? 'School' : 'College',
        city: isSchool ? 'New Delhi' : 'Bangalore',
        email: isSchool ? 'principal@dps.edu' : 'admin@iiitb.ac.in',
        academicYear: institutionData.academicYear ?? '2026–27',
        term: isSchool ? 'Annual' : 'Semester 1',
      };
      setTimeout(() => setInstitutionData({ ...defaults, workflow }), 0);
      return defaults;
    }
    
    // Data matches workflow, use it
    return {
      name: institutionData.name ?? (isSchool ? 'Delhi Public School, RK Puram' : 'IIIT Bangalore'),
      type: institutionData.type ?? (isSchool ? 'School' : 'College'),
      city: institutionData.city ?? (isSchool ? 'New Delhi' : 'Bangalore'),
      email: institutionData.email ?? (isSchool ? 'principal@dps.edu' : 'admin@iiitb.ac.in'),
      academicYear: institutionData.academicYear ?? '2026–27',
      term: institutionData.term ?? (isSchool ? 'Annual' : 'Semester 1'),
    };
  });

  const save = (patch: Partial<typeof data>) => {
    const next = { ...data, ...patch };
    setData(next);
    setInstitutionData({ ...next, workflow });
  };

  return (
    <WizardShell step={1} title="Institution">
      <p className="text-sm mb-6" style={{ color: 'var(--ink-3)' }}>
        {isSchool
          ? 'Basic info about your school. This names the run and sets the admin contact.'
          : 'Basic info about your institution. Used to label the timetable run.'}
      </p>
      <div className="grid grid-cols-2 gap-4">
        <Field label={isSchool ? 'School name' : 'Institution name'}>
          <TInput value={data.name} onChange={e => save({ name: e.target.value })} />
        </Field>
        <Field label="Type">
          <TSelect value={data.type} onChange={e => save({ type: e.target.value })}>
            {isSchool
              ? <><option>School</option><option>Coaching Institute</option><option>Training Centre</option></>
              : <><option>College</option><option>University</option><option>Engineering Institute</option><option>Management Institute</option></>}
          </TSelect>
        </Field>
        <Field label="City">
          <TInput value={data.city} onChange={e => save({ city: e.target.value })} />
        </Field>
        <Field label={isSchool ? 'Principal email' : 'Admin email'}>
          <TInput type="email" value={data.email} onChange={e => save({ email: e.target.value })} />
        </Field>
        <Field label="Academic year">
          <TInput value={data.academicYear} onChange={e => save({ academicYear: e.target.value })} />
        </Field>
        <Field label="Term / Semester">
          <TSelect value={data.term} onChange={e => save({ term: e.target.value })}>
            {isSchool
              ? <><option>Annual</option><option>Term 1</option><option>Term 2</option><option>Term 3</option></>
              : <><option>Semester 1</option><option>Semester 2</option><option>Full year</option></>}
          </TSelect>
        </Field>
      </div>
    </WizardShell>
  );
};

export default Step1Institution;
