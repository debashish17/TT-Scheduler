import React, { useState } from 'react';
import { WizardShell } from '../WizardShell';
import { useWizardStore } from '../wizardStore';
import { useOnboardingStore } from '../../../store';
import { Btn, Chip, Icon } from '../../ui/primitives';

interface Row { name: string; size: number; group?: string }

const DEFAULT_SCHOOL: Row[] = [
  { name: 'Class 7', size: 40 },
  { name: 'Class 8',  size: 40 },
  { name: 'Class 9',  size: 40 },
  { name: 'Class 10', size: 40 },
  
];

const DEFAULT_COLLEGE: Row[] = [
  { name: 'CS-1A', group: 'CS · Sem 1', size: 60 },
  { name: 'CS-2A', group: 'CS · Sem 3', size: 60 },
  { name: 'CS-3A', group: 'CS · Sem 5', size: 60 },
  { name: 'CS-4A', group: 'CS · Sem 7', size: 60 },
  { name: 'EC-1A', group: 'EC · Sem 1', size: 60 },
];

const DEFAULT_DEPTS = ['CS', 'EC', 'ME', 'CE', 'MA', 'HS'];

const TInput: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = ({ style, ...props }) => (
  <input
    {...props}
    className="w-full px-2 py-1.5 rounded text-sm outline-none"
    style={{ background: 'var(--paper-2)', border: '1px solid var(--line)', color: 'var(--ink)', ...style }}
    onFocus={e => (e.target.style.borderColor = 'var(--ink)')}
    onBlur={e => (e.target.style.borderColor = 'var(--line)')}
  />
);

const Step2Classes: React.FC = () => {
  const { workflow } = useWizardStore();
  const { classesData, setClassesData } = useOnboardingStore();
  const isSchool = workflow === 'school';

  const defaults = isSchool ? DEFAULT_SCHOOL : DEFAULT_COLLEGE;
  const [rows, setRows] = useState<Row[]>(() => {
    // No data, use defaults and persist them immediately
    if (!classesData?.length) {
      setTimeout(() => setClassesData(defaults), 0);
      return defaults;
    }
    
    // Check if existing data matches current workflow
    // College data has group values, school data doesn't
    const hasGroupData = classesData.some((r: any) => r.group);
    const isCorrectWorkflow = isSchool ? !hasGroupData : hasGroupData;
    
    // If data doesn't match workflow, reload defaults
    if (!isCorrectWorkflow) {
      return defaults;
    }
    
    // Data matches workflow, use it
    return classesData.map((r: any) => ({ 
      name: r.name ?? '', 
      group: r.group, 
      size: r.size ?? 0 
    }));
  });
  const [depts, setDepts] = useState<string[]>(DEFAULT_DEPTS);
  const [newDept, setNewDept] = useState('');

  const update = (i: number, field: keyof Row, value: string | number) => {
    const next = rows.map((r, idx) => idx === i ? { ...r, [field]: value } : r);
    setRows(next);
    setClassesData(next);
  };

  const addRow = () => {
    const next = [...rows, { name: '', ...(isSchool ? {} : { group: '' }), size: 30 }];
    setRows(next);
    setClassesData(next);
  };

  const removeRow = (i: number) => {
    const next = rows.filter((_, idx) => idx !== i);
    setRows(next);
    setClassesData(next);
  };

  const addDept = () => {
    const d = newDept.trim().toUpperCase();
    if (d && !depts.includes(d)) setDepts(prev => [...prev, d]);
    setNewDept('');
  };

  const totalStudents = rows.reduce((s, r) => s + (Number(r.size) || 0), 0);

  return (
    <WizardShell step={2} title={isSchool ? 'Classes' : 'Batches'}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <p className="text-sm" style={{ color: 'var(--ink-3)' }}>
            {isSchool
              ? 'Add every class section that needs a timetable.'
              : 'Add every batch/section that will receive a unique schedule.'}
          </p>
          <Btn variant="soft" size="sm"><Icon name="import" size={13} /> Import CSV</Btn>
        </div>

        <div className="edge rounded-lg overflow-hidden" style={{ background: 'var(--paper)' }}>
          <table className="w-full text-sm">
            <thead style={{ background: 'var(--paper-2)' }}>
              <tr style={{ color: 'var(--ink-3)' }}>
                <th className="py-2 px-4 text-left eyebrow font-medium">{isSchool ? 'Class name' : 'Batch name'}</th>
                {!isSchool && <th className="py-2 px-4 text-left eyebrow font-medium">Dept · Semester</th>}
                <th className="py-2 px-4 text-left eyebrow font-medium">Students</th>
                <th className="py-2 px-4 w-10" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} style={{ borderTop: '1px solid var(--line)' }}>
                  <td className="py-2 px-4">
                    <TInput
                      value={r.name}
                      onChange={e => update(i, 'name', e.target.value)}
                      placeholder={isSchool ? 'e.g. Class 10-A' : 'e.g. CS-3A'}
                    />
                  </td>
                  {!isSchool && (
                    <td className="py-2 px-4">
                      <TInput
                        value={r.group || ''}
                        onChange={e => update(i, 'group', e.target.value)}
                        placeholder="e.g. CS · Sem 5"
                      />
                    </td>
                  )}
                  <td className="py-2 px-4">
                    <TInput
                      type="number"
                      value={r.size}
                      min={1}
                      onChange={e => update(i, 'size', parseInt(e.target.value) || 0)}
                      style={{ width: 80 } as React.CSSProperties}
                    />
                  </td>
                  <td className="py-2 px-4">
                    <button onClick={() => removeRow(i)} style={{ color: 'var(--ink-3)' }}>
                      <Icon name="x" size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button
            type="button"
            onClick={addRow}
            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm rounded-b-lg"
            style={{ color: 'var(--ink-3)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--paper-2)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <Icon name="plus" size={13} /> Add {isSchool ? 'class' : 'batch'}
          </button>
        </div>

        {/* Summary strip */}
        <div className="flex items-center gap-4 px-4 py-3 rounded-lg text-sm mono"
          style={{ background: 'var(--brand-soft)', color: 'var(--brand)' }}>
          <span><strong>{rows.length}</strong> {isSchool ? 'classes' : 'batches'}</span>
          <span style={{ color: 'var(--line)' }}>|</span>
          <span><strong>{totalStudents}</strong> students total</span>
        </div>

        {/* Departments panel (college only) */}
        {!isSchool && (
          <div className="edge rounded-lg p-4" style={{ background: 'var(--paper)' }}>
            <h4 className="font-medium text-sm mb-3">Departments</h4>
            <div className="flex flex-wrap gap-2 mb-3">
              {depts.map(d => (
                <button
                  key={d}
                  onClick={() => setDepts(prev => prev.filter(x => x !== d))}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-medium transition-colors"
                  style={{ background: 'var(--paper-2)', border: '1px solid var(--line)', color: 'var(--ink-2)' }}
                  title="Click to remove"
                >
                  {d} <Icon name="x" size={10} />
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input
                value={newDept}
                onChange={e => setNewDept(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addDept()}
                placeholder="Add dept (e.g. IT)"
                className="px-2.5 py-1.5 rounded text-sm outline-none"
                style={{ background: 'var(--paper-2)', border: '1px solid var(--line)', color: 'var(--ink)', width: 160 }}
                onFocus={e => (e.target.style.borderColor = 'var(--ink)')}
                onBlur={e => (e.target.style.borderColor = 'var(--line)')}
              />
              <button
                onClick={addDept}
                className="inline-flex items-center gap-1 text-[12px]"
                style={{ color: 'var(--ink-3)' }}
              >
                <Icon name="plus" size={11} /> Add
              </button>
            </div>
          </div>
        )}
      </div>
    </WizardShell>
  );
};

export default Step2Classes;
