import React, { useState } from 'react';
import { WizardShell } from '../WizardShell';
import { useWizardStore } from '../wizardStore';
import { useOnboardingStore } from '../../../store';
import { Btn, Chip, Icon } from '../../ui/primitives';

interface Teacher { name: string; subjects: string[] }

const DEFAULT_SCHOOL: Teacher[] = [
  { name: 'Mrs. Sharma', subjects: ['ENG'] },
  { name: 'Mr. Verma',   subjects: ['MAT'] },
  { name: 'Mrs. Iyer',   subjects: ['SCI'] },
  { name: 'Mr. Das',     subjects: ['SST'] },
  { name: 'Ms. Nair',    subjects: ['CS']  },
  { name: 'Mr. Singh',   subjects: ['PHY'] },
];

const DEFAULT_COLLEGE: Teacher[] = [
  { name: 'Dr. Iyer',  subjects: ['CS301', 'CS204'] },
  { name: 'Dr. Khan',  subjects: ['CS302', 'CS391'] },
  { name: 'Prof. Rao', subjects: ['CS303', 'CS392'] },
  { name: 'Dr. Menon', subjects: ['CS304']          },
  { name: 'Dr. Shah',  subjects: ['MA301']          },
  { name: 'Dr. Bose',  subjects: ['HS301']          },
];

const TInput: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = (props) => (
  <input {...props} className="w-full px-2 py-1.5 rounded text-sm outline-none"
    style={{ background: 'var(--paper-2)', border: '1px solid var(--line)', color: 'var(--ink)' }}
    onFocus={e => (e.target.style.borderColor = 'var(--ink)')}
    onBlur={e => (e.target.style.borderColor = 'var(--line)')} />
);

const Step4Teachers: React.FC = () => {
  const { workflow } = useWizardStore();
  const { teachersData, setTeachersData, subjectsData } = useOnboardingStore();
  const isSchool = workflow === 'school';

  const defaults = isSchool ? DEFAULT_SCHOOL : DEFAULT_COLLEGE;
  const [teachers, setTeachers] = useState<Teacher[]>(() => {
    // No data, use defaults and persist them immediately
    if (!teachersData?.length) {
      setTimeout(() => setTeachersData(defaults), 0);
      return defaults;
    }
    
    // Check if existing teachers' subjects match current workflow
    const subjectCodes = (subjectsData ?? []).map((s: any) => s.code).filter(Boolean);
    
    // If we have no subjects data, we can't verify, so trust the existing data
    if (subjectCodes.length === 0) {
      return teachersData.map((t: any) => ({ 
        name: t.name ?? '', 
        subjects: Array.isArray(t.subjects) ? t.subjects : [] 
      }));
    }
    
    // Check if any teacher's subjects exist in current subject list
    const teachersHaveValidSubjects = teachersData.some((t: any) => 
      Array.isArray(t.subjects) && 
      t.subjects.some((subj: string) => subjectCodes.includes(subj))
    );
    
    // If teachers reference subjects that don't exist in current workflow, reset
    if (!teachersHaveValidSubjects) {
      return defaults;
    }
    
    // Data matches workflow, use it
    return teachersData.map((t: any) => ({ 
      name: t.name ?? '', 
      subjects: Array.isArray(t.subjects) ? t.subjects : [] 
    }));
  });

  // Subject codes from Step 3 (fallback to empty list)
  const availableSubjects: string[] = (subjectsData ?? []).map((s: any) => s.code).filter(Boolean);

  const updateName = (i: number, value: string) => {
    const next = teachers.map((t, idx) => idx === i ? { ...t, name: value } : t);
    setTeachers(next);
    setTeachersData(next);
  };

  const toggleSubject = (i: number, code: string) => {
    const next = teachers.map((t, idx) => {
      if (idx !== i) return t;
      const subs = t.subjects.includes(code) ? t.subjects.filter(s => s !== code) : [...t.subjects, code];
      return { ...t, subjects: subs };
    });
    setTeachers(next);
    setTeachersData(next);
  };

  const addSubjectManual = (i: number, code: string) => {
    const c = code.trim().toUpperCase();
    if (!c) return;
    const next = teachers.map((t, idx) => {
      if (idx !== i || t.subjects.includes(c)) return t;
      return { ...t, subjects: [...t.subjects, c] };
    });
    setTeachers(next);
    setTeachersData(next);
  };

  const addTeacher = () => {
    const next = [...teachers, { name: '', subjects: [] }];
    setTeachers(next);
    setTeachersData(next);
  };

  const removeTeacher = (i: number) => {
    const next = teachers.filter((_, idx) => idx !== i);
    setTeachers(next);
    setTeachersData(next);
  };

  return (
    <WizardShell step={4} title={isSchool ? 'Teachers' : 'Faculty'}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <p className="text-sm" style={{ color: 'var(--ink-3)' }}>
            {isSchool
              ? 'Add each teacher and the subjects they can teach.'
              : 'Add faculty with their assigned courses.'}
          </p>
          <div className="flex gap-2">
            <Btn variant="soft" size="sm"><Icon name="import" size={13} /> Import Excel</Btn>
          </div>
        </div>

        <div className="space-y-3">
          {teachers.map((t, i) => (
            <div key={i} className="edge rounded-lg p-4" style={{ background: 'var(--paper)' }}>
              <div className="flex items-center gap-3 mb-3">
                <div className="flex-1">
                  <TInput
                    value={t.name}
                    onChange={e => updateName(i, e.target.value)}
                    placeholder={isSchool ? 'Teacher name' : 'Faculty name (e.g. Dr. Sharma)'}
                  />
                </div>
                <button onClick={() => removeTeacher(i)} style={{ color: 'var(--ink-3)' }}>
                  <Icon name="x" size={14} />
                </button>
              </div>

              {/* Subject chips — from Step 3 list */}
              {availableSubjects.length > 0 ? (
                <div>
                  <div className="text-[11px] mono mb-2" style={{ color: 'var(--ink-3)' }}>
                    Subjects (click to assign):
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {availableSubjects.map(code => {
                      const assigned = t.subjects.includes(code);
                      return (
                        <button key={code} onClick={() => toggleSubject(i, code)}
                          className="px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors"
                          style={{
                            background: assigned ? 'var(--ink)' : 'var(--paper-2)',
                            color: assigned ? 'var(--paper)' : 'var(--ink-2)',
                            border: `1px solid ${assigned ? 'var(--ink)' : 'var(--line)'}`,
                          }}>
                          {code}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                /* Fallback: free-text subject entry if Step 3 not filled */
                <SubjectInput subjects={t.subjects}
                  onAdd={code => addSubjectManual(i, code)}
                  onRemove={code => toggleSubject(i, code)} />
              )}
            </div>
          ))}
        </div>

        <button type="button" onClick={addTeacher}
          className="flex items-center gap-2 text-sm"
          style={{ color: 'var(--ink-3)' }}>
          <Icon name="plus" size={13} /> Add {isSchool ? 'teacher' : 'faculty member'}
        </button>

        {/* Summary strip */}
        <div className="flex items-center gap-4 px-4 py-3 rounded-lg text-sm mono"
          style={{ background: 'var(--brand-soft)', color: 'var(--brand)' }}>
          <span><strong>{teachers.length}</strong> {isSchool ? 'teachers' : 'faculty'}</span>
          <span style={{ color: 'var(--line)' }}>|</span>
          <span><strong>{teachers.filter(t => t.name.trim()).length}</strong> named</span>
          <span style={{ color: 'var(--line)' }}>|</span>
          <span><strong>{teachers.filter(t => t.subjects.length > 0).length}</strong> with subjects assigned</span>
        </div>
      </div>
    </WizardShell>
  );
};

// Small helper for free-text subject entry
const SubjectInput: React.FC<{ subjects: string[]; onAdd: (c: string) => void; onRemove: (c: string) => void }> = ({ subjects, onAdd, onRemove }) => {
  const [val, setVal] = useState('');
  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {subjects.map(s => (
          <span key={s} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium"
            style={{ background: 'var(--ink)', color: 'var(--paper)' }}>
            {s}
            <button onClick={() => onRemove(s)}><Icon name="x" size={9} /></button>
          </span>
        ))}
      </div>
      <div className="flex gap-2 items-center">
        <input value={val} onChange={e => setVal(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { onAdd(val); setVal(''); } }}
          placeholder="Subject code, press Enter"
          className="px-2 py-1 rounded text-[12px] outline-none"
          style={{ background: 'var(--paper-2)', border: '1px solid var(--line)', color: 'var(--ink)', width: 160 }} />
        <button onClick={() => { onAdd(val); setVal(''); }} className="text-[12px]"
          style={{ color: 'var(--ink-3)' }}>
          <Icon name="plus" size={11} />
        </button>
      </div>
    </div>
  );
};

export default Step4Teachers;
