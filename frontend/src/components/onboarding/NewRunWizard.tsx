import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Btn, Eyebrow, Chip, Icon, TopBar } from '../ui/primitives';
import { useOnboardingStore } from '../../store';

// ─── Shared form primitives ───────────────────────────────────────────────────
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
  <input
    {...props}
    className={`w-full px-3 py-2 rounded-md text-sm outline-none ${className}`}
    style={{ background: 'var(--paper)', border: '1px solid var(--line)', color: 'var(--ink)' }}
    onFocus={e => (e.target.style.borderColor = 'var(--ink)')}
    onBlur={e => (e.target.style.borderColor = 'var(--line)')}
  />
);

const TSelect: React.FC<React.SelectHTMLAttributes<HTMLSelectElement>> = ({ children, ...rest }) => (
  <select
    {...rest}
    className="w-full px-3 py-2 rounded-md text-sm outline-none"
    style={{ background: 'var(--paper)', border: '1px solid var(--line)', color: 'var(--ink)' }}
  >
    {children}
  </select>
);

const AddRow: React.FC<{ label: string }> = ({ label }) => (
  <button
    type="button"
    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm transition-colors rounded-b-lg"
    style={{ color: 'var(--ink-3)' }}
    onMouseEnter={e => (e.currentTarget.style.background = 'var(--paper-2)')}
    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
  >
    <Icon name="plus" size={13} /> {label}
  </button>
);

// ─── Step 1: Institution basics ───────────────────────────────────────────────
const Step1Institution: React.FC<{ workflow: string }> = ({ workflow }) => {
  const isSchool = workflow === 'school';
  return (
    <div className="space-y-6">
      <p className="text-sm" style={{ color: 'var(--ink-3)' }}>
        {isSchool
          ? 'Basic info about your school. This names the run and sets the admin contact.'
          : 'Basic info about your institution. Used to label the timetable run.'}
      </p>
      <div className="grid grid-cols-2 gap-4">
        <Field label={isSchool ? 'School name' : 'Institution name'}>
          <TInput defaultValue={isSchool ? 'Delhi Public School, RK Puram' : 'IIIT Bangalore'} />
        </Field>
        <Field label="Type">
          <TSelect defaultValue={isSchool ? 'School' : 'College'}>
            {isSchool
              ? <><option>School</option><option>Coaching Institute</option><option>Training Centre</option></>
              : <><option>College</option><option>University</option><option>Engineering Institute</option><option>Management Institute</option></>
            }
          </TSelect>
        </Field>
        <Field label="City"><TInput defaultValue={isSchool ? 'New Delhi' : 'Bangalore'} /></Field>
        <Field label={isSchool ? 'Principal email' : 'Admin email'}>
          <TInput type="email" defaultValue={isSchool ? 'principal@dps.edu' : 'admin@iiitb.ac.in'} />
        </Field>
        <Field label="Academic year">
          <TInput defaultValue="2026–27" />
        </Field>
        <Field label="Term / Semester">
          <TSelect defaultValue={isSchool ? 'Annual' : 'Semester 1'}>
            {isSchool
              ? <><option>Annual</option><option>Term 1</option><option>Term 2</option><option>Term 3</option></>
              : <><option>Semester 1</option><option>Semester 2</option><option>Full year</option></>
            }
          </TSelect>
        </Field>
      </div>
    </div>
  );
};

// ─── Step 2: Classes / Batches ────────────────────────────────────────────────
const Step2ClassesBatches: React.FC<{ workflow: string }> = ({ workflow }) => {
  const isSchool = workflow === 'school';
  const rows = isSchool
    ? [
        { id: '8A',  label: 'Class 8-A',  group: 'Class 8',  size: 40 },
        { id: '9A',  label: 'Class 9-A',  group: 'Class 9',  size: 42 },
        { id: '10A', label: 'Class 10-A', group: 'Class 10', size: 38 },
        { id: '10B', label: 'Class 10-B', group: 'Class 10', size: 40 },
        { id: '11A', label: 'Class 11-A', group: 'Class 11', size: 36 },
      ]
    : [
        { id: 'cs1a', label: 'CS-1A', group: 'CS · Sem 1', size: 60 },
        { id: 'cs2a', label: 'CS-2A', group: 'CS · Sem 3', size: 58 },
        { id: 'cs3a', label: 'CS-3A', group: 'CS · Sem 5', size: 55 },
        { id: 'cs4a', label: 'CS-4A', group: 'CS · Sem 7', size: 52 },
        { id: 'ec1a', label: 'EC-1A', group: 'EC · Sem 1', size: 60 },
      ];

  return (
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
              <th className="py-2 px-4 text-left eyebrow font-medium">{isSchool ? 'Class' : 'Batch'}</th>
              <th className="py-2 px-4 text-left eyebrow font-medium">{isSchool ? 'Grade group' : 'Dept · Semester'}</th>
              <th className="py-2 px-4 text-left eyebrow font-medium">Students</th>
              <th className="py-2 px-4 w-10" />
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} style={{ borderTop: '1px solid var(--line)' }}>
                <td className="py-2 px-4 mono font-medium">{r.label}</td>
                <td className="py-2 px-4" style={{ color: 'var(--ink-2)' }}>{r.group}</td>
                <td className="py-2 px-4 mono text-[12px]">{r.size}</td>
                <td className="py-2 px-4">
                  <button style={{ color: 'var(--ink-3)' }}><Icon name="x" size={14} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <AddRow label={`Add ${isSchool ? 'class' : 'batch'}`} />
      </div>

      {!isSchool && (
        <div className="edge rounded-lg p-4" style={{ background: 'var(--paper)' }}>
          <h4 className="font-medium text-sm mb-3">Departments</h4>
          <div className="flex flex-wrap gap-2">
            {['CS', 'EC', 'ME', 'CE', 'MA', 'HS'].map(d => (
              <Chip key={d} tone="neutral">{d}</Chip>
            ))}
            <button className="inline-flex items-center gap-1 text-[11px]" style={{ color: 'var(--ink-3)' }}>
              <Icon name="plus" size={11} /> Add dept
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Step 3: Subjects ─────────────────────────────────────────────────────────
const Step3Subjects: React.FC<{ workflow: string }> = ({ workflow }) => {
  const isSchool = workflow === 'school';
  const subjects = isSchool
    ? [
        { code: 'ENG', name: 'English',       periods: 6, type: 'Core' },
        { code: 'MAT', name: 'Mathematics',   periods: 6, type: 'Core' },
        { code: 'SCI', name: 'Science',        periods: 5, type: 'Core' },
        { code: 'SST', name: 'Social Studies', periods: 4, type: 'Core' },
        { code: 'CS',  name: 'Computer Sc.',   periods: 3, type: 'Elective' },
        { code: 'PHY', name: 'Phys. Ed.',      periods: 2, type: 'Activity' },
      ]
    : [
        { code: 'CS301', name: 'Algorithms',      periods: 3, type: 'Theory' },
        { code: 'CS302', name: 'Databases',        periods: 3, type: 'Theory' },
        { code: 'CS303', name: 'Operating Sys.',   periods: 3, type: 'Theory' },
        { code: 'CS304', name: 'Networks',         periods: 3, type: 'Theory' },
        { code: 'MA301', name: 'Discrete Math',    periods: 3, type: 'Theory' },
        { code: 'CS391', name: 'DB Lab',           periods: 2, type: 'Lab' },
        { code: 'CS392', name: 'OS Lab',           periods: 2, type: 'Lab' },
        { code: 'HS301', name: 'Ethics',           periods: 1, type: 'Seminar' },
      ];

  return (
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
              <th className="py-2 px-4 text-left eyebrow font-medium">Code</th>
              <th className="py-2 px-4 text-left eyebrow font-medium">Name</th>
              <th className="py-2 px-4 text-left eyebrow font-medium">{isSchool ? 'Periods/week' : 'Credits/hrs'}</th>
              <th className="py-2 px-4 text-left eyebrow font-medium">Type</th>
              <th className="py-2 px-4 w-10" />
            </tr>
          </thead>
          <tbody>
            {subjects.map(s => (
              <tr key={s.code} style={{ borderTop: '1px solid var(--line)' }}>
                <td className="py-2 px-4 mono font-medium text-[12px]">{s.code}</td>
                <td className="py-2 px-4">{s.name}</td>
                <td className="py-2 px-4 mono text-[12px]">{s.periods}</td>
                <td className="py-2 px-4">
                  <Chip tone={s.type === 'Lab' ? 'brand' : s.type === 'Elective' ? 'warn' : 'neutral'}>
                    {s.type}
                  </Chip>
                </td>
                <td className="py-2 px-4">
                  <button style={{ color: 'var(--ink-3)' }}><Icon name="x" size={14} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <AddRow label="Add subject" />
      </div>

      {!isSchool && (
        <div className="edge rounded-lg p-4 text-sm" style={{ background: 'var(--paper)' }}>
          <div className="flex items-center justify-between mb-2">
            <span className="font-medium">Lab pairing</span>
            <Chip tone="brand">Auto-detect</Chip>
          </div>
          <p style={{ color: 'var(--ink-3)' }}>
            CS391 (DB Lab) ↔ CS302 (Databases) and CS392 (OS Lab) ↔ CS303 (Operating Sys.) — labs will be scheduled consecutively.
          </p>
        </div>
      )}
    </div>
  );
};

// ─── Step 4: Teachers / Faculty ───────────────────────────────────────────────
const Step4Teachers: React.FC<{ workflow: string }> = ({ workflow }) => {
  const isSchool = workflow === 'school';
  const people = isSchool
    ? [
        { id: 't1', name: 'Mrs. Sharma',  dept: 'English', load: '28/30', subjects: ['ENG'] },
        { id: 't2', name: 'Mr. Verma',    dept: 'Math',    load: '26/30', subjects: ['MAT'] },
        { id: 't3', name: 'Mrs. Iyer',    dept: 'Science', load: '24/30', subjects: ['SCI'] },
        { id: 't4', name: 'Mr. Das',      dept: 'Social',  load: '20/30', subjects: ['SST'] },
        { id: 't5', name: 'Ms. Nair',     dept: 'CS',      load: '18/24', subjects: ['CS'] },
        { id: 't6', name: 'Mr. Singh',    dept: 'PHY Ed',  load: '12/20', subjects: ['PHY'] },
      ]
    : [
        { id: 'f1', name: 'Dr. Iyer',   dept: 'CS', load: '16/18', subjects: ['CS301', 'CS204'] },
        { id: 'f2', name: 'Dr. Khan',   dept: 'CS', load: '14/18', subjects: ['CS302', 'CS391'] },
        { id: 'f3', name: 'Prof. Rao',  dept: 'CS', load: '18/18', subjects: ['CS303', 'CS392'] },
        { id: 'f4', name: 'Dr. Menon',  dept: 'CS', load: '12/18', subjects: ['CS304'] },
        { id: 'f5', name: 'Dr. Shah',   dept: 'MA', load: '15/18', subjects: ['MA301'] },
        { id: 'f6', name: 'Dr. Bose',   dept: 'HS', load: '10/12', subjects: ['HS301'] },
      ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm" style={{ color: 'var(--ink-3)' }}>
          {isSchool
            ? 'Add each teacher, their department, and which subjects they can teach.'
            : 'Add faculty with department, workload limit, and assigned courses.'}
        </p>
        <div className="flex gap-2">
          <Btn variant="soft" size="sm"><Icon name="import" size={13} /> Import Excel</Btn>
          <Btn variant="ghost" size="sm"><Icon name="sparkle" size={13} /> AI fill</Btn>
        </div>
      </div>

      <div className="edge rounded-lg overflow-hidden" style={{ background: 'var(--paper)' }}>
        <table className="w-full text-sm">
          <thead style={{ background: 'var(--paper-2)' }}>
            <tr style={{ color: 'var(--ink-3)' }}>
              <th className="py-2 px-4 text-left eyebrow font-medium">Name</th>
              <th className="py-2 px-4 text-left eyebrow font-medium">Dept</th>
              <th className="py-2 px-4 text-left eyebrow font-medium">{isSchool ? 'Periods (used/max)' : 'Hours (used/max)'}</th>
              <th className="py-2 px-4 text-left eyebrow font-medium">Subjects</th>
              <th className="py-2 px-4 w-10" />
            </tr>
          </thead>
          <tbody>
            {people.map(p => (
              <tr key={p.id} style={{ borderTop: '1px solid var(--line)' }}>
                <td className="py-2 px-4 font-medium">{p.name}</td>
                <td className="py-2 px-4" style={{ color: 'var(--ink-2)' }}>{p.dept}</td>
                <td className="py-2 px-4 mono text-[12px]">{p.load}</td>
                <td className="py-2 px-4">
                  <div className="flex flex-wrap gap-1">
                    {p.subjects.map(s => <Chip key={s} tone="neutral">{s}</Chip>)}
                  </div>
                </td>
                <td className="py-2 px-4">
                  <button style={{ color: 'var(--ink-3)' }}><Icon name="x" size={14} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <AddRow label={`Add ${isSchool ? 'teacher' : 'faculty member'}`} />
      </div>

      {!isSchool && (
        <div className="grid grid-cols-3 gap-0 edge rounded-lg overflow-hidden" style={{ background: 'var(--paper)' }}>
          {[
            { label: 'Total faculty', v: people.length },
            { label: 'Over-loaded',   v: 1, warn: true },
            { label: 'Avg load',      v: '14.2 hrs' },
          ].map((s, i) => (
            <div key={s.label} className="p-4" style={{ borderRight: i < 2 ? '1px solid var(--line)' : undefined }}>
              <div className="eyebrow mb-1" style={{ color: 'var(--ink-3)' }}>{s.label}</div>
              <div className="serif text-3xl" style={{ color: (s as any).warn ? 'var(--warn)' : 'var(--ink)' }}>{s.v}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Step 5: Schedule / Time structure ────────────────────────────────────────
const Step5Schedule: React.FC<{ workflow: string }> = ({ workflow }) => {
  const isSchool = workflow === 'school';
  return (
    <div className="space-y-6">
      <p className="text-sm" style={{ color: 'var(--ink-3)' }}>
        Define working days, period timing and break windows. The solver uses this to build the time grid.
      </p>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Working days">
          <TInput defaultValue="Monday – Friday" />
        </Field>
        <Field label={isSchool ? 'Periods per day' : 'Slots per day'}>
          <TInput type="number" defaultValue={isSchool ? '8' : '7'} />
        </Field>
        <Field label="School start time">
          <TInput type="time" defaultValue={isSchool ? '08:30' : '09:00'} />
        </Field>
        <Field label="School end time">
          <TInput type="time" defaultValue={isSchool ? '15:00' : '16:10'} />
        </Field>
        <Field label="Period length">
          <TInput defaultValue={isSchool ? '45 min' : '50 min'} />
        </Field>
        <Field label="Break between periods">
          <TInput defaultValue="5 min" />
        </Field>
      </div>

      <div className="pt-4" style={{ borderTop: '1px solid var(--line)' }}>
        <h4 className="font-medium text-sm mb-3">Break windows</h4>
        <div className="space-y-2">
          {(isSchool
            ? [{ label: 'Short break', time: '10:30 – 10:45' }, { label: 'Lunch break', time: '12:30 – 13:00' }]
            : [{ label: 'Recess', time: '11:40 – 11:50' }, { label: 'Lunch break', time: '12:35 – 13:30' }]
          ).map(b => (
            <div key={b.label} className="flex items-center gap-3 edge rounded-lg px-4 py-2.5" style={{ background: 'var(--paper)' }}>
              <span className="text-sm flex-1 font-medium">{b.label}</span>
              <span className="mono text-[12px]" style={{ color: 'var(--ink-2)' }}>{b.time}</span>
              <button style={{ color: 'var(--ink-3)' }}><Icon name="x" size={13} /></button>
            </div>
          ))}
          <button className="flex items-center gap-2 text-sm" style={{ color: 'var(--ink-3)' }}>
            <Icon name="plus" size={13} /> Add break
          </button>
        </div>
      </div>

      <div className="edge rounded-lg p-4" style={{ background: 'var(--paper)' }}>
        <div className="eyebrow mb-2" style={{ color: 'var(--ink-3)' }}>Computed time grid</div>
        <div className="grid grid-cols-5 gap-1 text-[11px] mono">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map(d => (
            <div key={d} className="text-center font-medium py-1" style={{ color: 'var(--ink-2)' }}>{d}</div>
          ))}
          {Array.from({ length: isSchool ? 8 : 7 }).map((_, i) => (
            Array.from({ length: 5 }).map((__, j) => (
              <div
                key={`${i}-${j}`}
                className="rounded-[3px] h-5 flex items-center justify-center"
                style={{ background: 'var(--brand-soft)', color: 'var(--brand)' }}
              >
                P{i + 1}
              </div>
            ))
          ))}
        </div>
      </div>
    </div>
  );
};

// ─── Step 6: Rooms ────────────────────────────────────────────────────────────
const Step6Rooms: React.FC<{ workflow: string }> = ({ workflow }) => {
  const isSchool = workflow === 'school';
  const rooms = isSchool
    ? [
        { id: 'r1', name: 'Room 101',     cap: 42, kind: 'Classroom', feats: 'Whiteboard' },
        { id: 'r2', name: 'Room 102',     cap: 40, kind: 'Classroom', feats: 'Whiteboard' },
        { id: 'r3', name: 'Room 103',     cap: 44, kind: 'Classroom', feats: 'Projector' },
        { id: 'r4', name: 'Room 104',     cap: 38, kind: 'Classroom', feats: 'Smartboard' },
        { id: 'r5', name: 'Computer Lab', cap: 30, kind: 'Lab',       feats: '30 PCs' },
      ]
    : [
        { id: 'r1', name: 'A-101',  cap: 60,  kind: 'Lecture',  feats: 'Projector' },
        { id: 'r2', name: 'A-104',  cap: 40,  kind: 'Seminar',  feats: 'Smartboard' },
        { id: 'r3', name: 'B-108',  cap: 80,  kind: 'Lecture',  feats: 'Projector' },
        { id: 'r4', name: 'B-204',  cap: 80,  kind: 'Lecture',  feats: 'Projector, AC' },
        { id: 'r5', name: 'B-205',  cap: 80,  kind: 'Lecture',  feats: 'Projector' },
        { id: 'r6', name: 'C-301',  cap: 120, kind: 'Lecture',  feats: 'AV suite' },
        { id: 'r7', name: 'Lab-1',  cap: 30,  kind: 'Lab',      feats: '30 PCs, OS image' },
        { id: 'r8', name: 'Lab-2',  cap: 30,  kind: 'Lab',      feats: '30 PCs, MySQL' },
      ];

  const kindTone = (k: string) =>
    k === 'Lab' ? 'brand' : k === 'Seminar' ? 'warn' : 'neutral';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm" style={{ color: 'var(--ink-3)' }}>
          {isSchool
            ? 'List classrooms and labs. Capacity is checked against class size.'
            : 'List all rooms by type. The solver matches courses to rooms by features and capacity.'}
        </p>
        <Btn variant="soft" size="sm"><Icon name="import" size={13} /> Import CSV</Btn>
      </div>

      <div className="edge rounded-lg overflow-hidden" style={{ background: 'var(--paper)' }}>
        <table className="w-full text-sm">
          <thead style={{ background: 'var(--paper-2)' }}>
            <tr style={{ color: 'var(--ink-3)' }}>
              <th className="py-2 px-4 text-left eyebrow font-medium">Room</th>
              <th className="py-2 px-4 text-left eyebrow font-medium">Capacity</th>
              <th className="py-2 px-4 text-left eyebrow font-medium">Type</th>
              <th className="py-2 px-4 text-left eyebrow font-medium">Features</th>
              <th className="py-2 px-4 w-10" />
            </tr>
          </thead>
          <tbody>
            {rooms.map(r => (
              <tr key={r.id} style={{ borderTop: '1px solid var(--line)' }}>
                <td className="py-2 px-4 mono font-medium">{r.name}</td>
                <td className="py-2 px-4 mono text-[12px]">{r.cap}</td>
                <td className="py-2 px-4">
                  <Chip tone={kindTone(r.kind) as any}>{r.kind}</Chip>
                </td>
                <td className="py-2 px-4 text-[13px]" style={{ color: 'var(--ink-2)' }}>{r.feats}</td>
                <td className="py-2 px-4">
                  <button style={{ color: 'var(--ink-3)' }}><Icon name="x" size={14} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <AddRow label="Add room" />
      </div>

      <div className="grid grid-cols-3 gap-0 edge rounded-lg overflow-hidden" style={{ background: 'var(--paper)' }}>
        {[
          { label: 'Total rooms',   v: rooms.length },
          { label: 'Labs',          v: rooms.filter(r => r.kind === 'Lab').length },
          { label: 'Max capacity',  v: Math.max(...rooms.map(r => r.cap)) },
        ].map((s, i) => (
          <div key={s.label} className="p-4" style={{ borderRight: i < 2 ? '1px solid var(--line)' : undefined }}>
            <div className="eyebrow mb-1" style={{ color: 'var(--ink-3)' }}>{s.label}</div>
            <div className="serif text-3xl">{s.v}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Step 7: Rules ────────────────────────────────────────────────────────────
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

const Step7Rules: React.FC<{ workflow: string; onGenerate: () => void }> = ({ workflow, onGenerate }) => {
  const isSchool = workflow === 'school';
  const shown = isSchool ? CONSTRAINTS.slice(0, 4) : CONSTRAINTS;
  const [active, setActive] = useState<Set<number>>(new Set(shown.map(c => c.id)));

  const toggle = (id: number) => {
    const n = new Set(active);
    n.has(id) ? n.delete(id) : n.add(id);
    setActive(n);
  };

  return (
    <div className="space-y-6">
      <p className="text-sm" style={{ color: 'var(--ink-3)' }}>
        Toggle constraints on/off. All are enabled by default. Add soft preferences for instructor or room preferences.
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
              <button
                key={c.id}
                onClick={() => toggle(c.id)}
                className="flex items-start gap-3 p-3 rounded-lg text-left transition-colors"
                style={{
                  background: on ? 'var(--ink)' : 'var(--paper)',
                  border: `1px solid ${on ? 'var(--ink)' : 'var(--line)'}`,
                  color: on ? 'var(--paper)' : 'var(--ink)',
                }}
              >
                <div
                  className="w-8 h-8 rounded-md flex items-center justify-center shrink-0"
                  style={{ background: on ? 'rgba(255,255,255,0.1)' : 'var(--paper-2)' }}
                >
                  <span className="mono text-[10px]">C{String(c.id).padStart(2, '0')}</span>
                </div>
                <div className="min-w-0 flex-1 text-left">
                  <div className="font-medium text-[13px]">{c.name}</div>
                  <div className="text-[12px]" style={{ opacity: on ? 0.65 : 1, color: on ? 'inherit' : 'var(--ink-3)' }}>
                    {c.rule}
                  </div>
                </div>
                <div
                  className="ml-auto w-8 h-4 rounded-full relative mt-1 shrink-0"
                  style={{ background: on ? 'var(--brand)' : 'var(--line)' }}
                >
                  <span
                    className="absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all"
                    style={{ left: on ? 18 : 2 }}
                  />
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

      <div className="pt-4" style={{ borderTop: '1px solid var(--line)' }}>
        <h3 className="font-semibold mb-3">Soft preferences</h3>
        <div className="space-y-2">
          {[
            { name: isSchool ? 'Avoid first period for Mrs. Sharma (Mon)' : 'Avoid first-period classes for Dr. Shah', score: '-3' },
            { name: isSchool ? 'Spread Maths across the week'              : 'Group labs on Wednesday afternoon', score: '+2' },
            { name: isSchool ? 'Keep Computer Lab free on Fridays'         : 'Spread core subjects evenly across week', score: '+5' },
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

      <div className="pt-4 flex items-center justify-between" style={{ borderTop: '1px solid var(--line)' }}>
        <div>
          <div className="eyebrow mb-0.5" style={{ color: 'var(--ink-3)' }}>Solver ready</div>
          <div className="text-sm" style={{ color: 'var(--ink-2)' }}>
            {isSchool ? 'All inputs validated · ~240 variables' : 'All inputs validated · 1,428 variables · 8,214 constraints'}
          </div>
        </div>
        <Btn variant="brand" size="lg" onClick={onGenerate}>
          <Icon name="bolt" size={14} /> Generate timetable
        </Btn>
      </div>
    </div>
  );
};

// ─── Draft panel ──────────────────────────────────────────────────────────────
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const SLOTS = [1, 2, 3, 4, 5, 6, 7];
const TIMES = ['09:00', '09:55', '10:50', '11:45', '13:30', '14:25', '15:20'];
const COLORS: Record<string, string> = {
  CS301: '#0369A1', CS302: '#0F766E', CS303: '#7C3AED', CS304: '#B45309',
  MA301: '#BE185D', CS391: '#065F46', CS392: '#065F46', HS301: '#4B5563',
};
const GRID: Record<string, Record<number, string | null>> = {
  Mon: { 1:'CS301', 2:'CS302', 3:'MA301', 4:'CS303', 5:'CS391', 6:'CS391', 7:'HS301' },
  Tue: { 1:'CS303', 2:'CS301', 3:'CS304', 4:'MA301', 5:'CS392', 6:'CS392', 7:null    },
  Wed: { 1:'CS302', 2:'CS304', 3:'CS303', 4:'CS301', 5:null,    6:'HS301', 7:'MA301' },
  Thu: { 1:'MA301', 2:'CS303', 3:'CS302', 4:'CS304', 5:'CS391', 6:'CS391', 7:null    },
  Fri: { 1:'CS304', 2:'CS301', 3:'HS301', 4:'CS302', 5:'CS392', 6:'CS392', 7:'MA301' },
};

const DraftPanel: React.FC<{ step: number; totalSteps: number }> = ({ step, totalSteps }) => {
  const pct = step / (totalSteps - 1);
  return (
    <div className="sticky top-20 space-y-3">
      <div className="edge rounded-xl p-4" style={{ background: 'var(--paper)' }}>
        <div className="flex items-center justify-between mb-3">
          <Eyebrow>Live draft preview</Eyebrow>
          <span className="mono text-[11px]" style={{ color: 'var(--ink-3)' }}>
            {step === totalSteps - 1 ? 'ready' : 'draft'}
          </span>
        </div>
        <div style={{ opacity: 0.15 + pct * 0.85, transition: 'opacity 0.4s' }}>
          <div className="grid gap-[3px]" style={{ gridTemplateColumns: '40px repeat(5, 1fr)' }}>
            <div />
            {DAYS.map(d => (
              <div key={d} className="text-[9px] mono text-center pb-1" style={{ color: 'var(--ink-3)' }}>{d}</div>
            ))}
            {SLOTS.map((s, si) => (
              <React.Fragment key={s}>
                <div className="text-[9px] mono flex items-center justify-end pr-1" style={{ color: 'var(--ink-3)' }}>
                  {TIMES[si]}
                </div>
                {DAYS.map(d => {
                  const code = GRID[d]?.[s] ?? null;
                  return (
                    <div
                      key={d + s}
                      className="rounded-[3px] h-[20px] flex items-center justify-center text-[8px] font-semibold"
                      style={{
                        background: code ? COLORS[code] : 'var(--paper-2)',
                        border: code ? 'none' : '1px solid var(--line)',
                        color: code ? 'white' : 'var(--ink-3)',
                      }}
                    >
                      {code ? (code.includes('9') ? 'LAB' : code.replace(/[A-Z]+/, '')) : ''}
                    </div>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-0 text-center mono text-[11px]">
          {[
            { l: 'filled',  v: `${Math.round(pct * 35)}/35` },
            { l: 'clashes', v: '0', color: 'var(--ok)' },
            { l: 'step',    v: `${step + 1}/${totalSteps}` },
          ].map((s, i) => (
            <div key={s.l} className="py-2" style={{ borderRight: i < 2 ? '1px solid var(--line)' : undefined }}>
              <div style={{ color: 'var(--ink-3)' }}>{s.l}</div>
              <div className="text-sm font-semibold mt-0.5" style={{ color: (s as any).color }}>
                {s.v}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Progress breakdown */}
      <div className="edge rounded-xl p-4" style={{ background: 'var(--paper)' }}>
        <Eyebrow className="block mb-3">Setup progress</Eyebrow>
        <div className="space-y-2">
          {['Institution', 'Classes', 'Subjects', 'Teachers', 'Schedule', 'Rooms', 'Rules'].map((label, i) => (
            <div key={label} className="flex items-center gap-2">
              <div
                className="w-4 h-4 rounded-full flex items-center justify-center shrink-0 text-[9px]"
                style={{
                  background: i < step ? 'var(--brand)' : i === step ? 'var(--ink)' : 'var(--paper-2)',
                  color: i <= step ? 'white' : 'var(--ink-3)',
                  border: i > step ? '1px solid var(--line)' : 'none',
                }}
              >
                {i < step ? '✓' : i + 1}
              </div>
              <span
                className="text-[12px]"
                style={{ color: i === step ? 'var(--ink)' : i < step ? 'var(--ink-2)' : 'var(--ink-3)' }}
              >
                {label}
              </span>
              {i === step && (
                <span className="ml-auto mono text-[10px]" style={{ color: 'var(--brand)' }}>active</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ─── Solving overlay ──────────────────────────────────────────────────────────
const SolvingOverlay: React.FC<{ progress: number; onDone: () => void }> = ({ progress, onDone }) => {
  useEffect(() => {
    if (progress >= 1) {
      const t = setTimeout(onDone, 700);
      return () => clearTimeout(t);
    }
  }, [progress, onDone]);

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
            <div
              className="h-full rounded-full"
              style={{ width: `${progress * 100}%`, background: 'var(--brand)', transition: 'width .3s' }}
            />
          </div>
          <span className="mono text-[11px]" style={{ color: 'var(--ink-3)' }}>
            {(Math.round(progress * 34) / 10).toFixed(1)}s / 3.4s
          </span>
        </div>
      </div>
    </div>
  );
};

// ─── Workflow selector ────────────────────────────────────────────────────────
const WorkflowSelector: React.FC<{ onSelect: (w: 'school' | 'college') => void }> = ({ onSelect }) => (
  <div className="screen-enter">
    <TopBar title="New run" crumbs={['Dashboard']} />
    <div className="p-8 max-w-[900px] mx-auto">
      <div className="mb-10">
        <Eyebrow>Before we start</Eyebrow>
        <h1 className="serif leading-[1] tracking-tight mt-4 mb-3" style={{ fontSize: 52 }}>
          What are you scheduling?
        </h1>
        <p style={{ color: 'var(--ink-2)' }}>
          The wizard adapts its fields and constraints to your institution type.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {([
          {
            type: 'school' as const,
            emoji: '🏫',
            title: 'School',
            desc: 'Class-based, single-department. Periods, teachers, rooms and simple rules. Best for K-12 schools, coaching institutes and training centres.',
            feats: ['Classes & sections (e.g. 10-A, 10-B)', 'Teachers & subject mapping', 'Periods per day + break windows', '4 core hard constraints'],
            steps: '7 steps  ·  ~10 min',
            cta: 'Start School setup',
          },
          {
            type: 'college' as const,
            emoji: '🎓',
            title: 'College',
            desc: 'Department-and-batch scheduling with credit hours, lab pairs and faculty workload caps. Best for colleges, universities and engineering institutes.',
            feats: ['Departments, batches & credit hours', 'Faculty workload limits', 'Lab-pair & room-type constraints', 'All 8 CP-SAT hard constraints'],
            steps: '7 steps  ·  ~15 min',
            cta: 'Start College setup',
          },
        ] as const).map(card => (
          <button
            key={card.type}
            onClick={() => onSelect(card.type)}
            className="text-left edge rounded-2xl p-8 lift transition-all"
            style={{ background: 'var(--paper)' }}
          >
            <div className="text-4xl mb-5">{card.emoji}</div>
            <h2 className="serif text-4xl mb-2">{card.title}</h2>
            <p className="text-sm leading-relaxed mb-5" style={{ color: 'var(--ink-2)' }}>{card.desc}</p>
            <ul className="space-y-2 text-[13px] mb-6" style={{ color: 'var(--ink-2)' }}>
              {card.feats.map(f => (
                <li key={f} className="flex items-center gap-2">
                  <Icon name="check" size={12} style={{ color: 'var(--brand)' } as React.CSSProperties} />
                  {f}
                </li>
              ))}
            </ul>
            <div className="flex items-center justify-between">
              <span className="mono text-[11px]" style={{ color: 'var(--ink-3)' }}>{card.steps}</span>
              <div className="flex items-center gap-2 text-sm font-semibold">
                {card.cta} <Icon name="arrow" size={14} />
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  </div>
);

// ─── Main Wizard ──────────────────────────────────────────────────────────────
const STEP_LABELS = ['Institution', 'Classes', 'Subjects', 'Teachers', 'Schedule', 'Rooms', 'Rules'];
const SCHOOL_LABELS = ['Institution', 'Classes', 'Subjects', 'Teachers', 'Schedule', 'Rooms', 'Rules'];
const COLLEGE_LABELS = ['Institution', 'Batches', 'Courses', 'Faculty', 'Schedule', 'Rooms', 'Rules'];

const NewRunWizard: React.FC = () => {
  const navigate = useNavigate();
  const { setInstitutionData } = useOnboardingStore();

  const [workflow, setWorkflow] = useState<'school' | 'college' | null>(null);
  const [step, setStep] = useState(0);
  const [solving, setSolving] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleSelect = (w: 'school' | 'college') => {
    setWorkflow(w);
    setInstitutionData({ type: w === 'school' ? 'School' : 'College' } as any);
    setStep(0);
  };

  const startSolve = () => {
    setSolving(true);
    setProgress(0);
    let p = 0;
    const tick = () => {
      p += 0.04 + Math.random() * 0.05;
      if (p >= 1) { setProgress(1); }
      else { setProgress(p); setTimeout(tick, 100 + Math.random() * 100); }
    };
    tick();
  };

  if (!workflow) return <WorkflowSelector onSelect={handleSelect} />;

  const labels = workflow === 'school' ? SCHOOL_LABELS : COLLEGE_LABELS;
  const TOTAL = labels.length;

  const stepContent = [
    <Step1Institution workflow={workflow} />,
    <Step2ClassesBatches workflow={workflow} />,
    <Step3Subjects workflow={workflow} />,
    <Step4Teachers workflow={workflow} />,
    <Step5Schedule workflow={workflow} />,
    <Step6Rooms workflow={workflow} />,
    <Step7Rules workflow={workflow} onGenerate={startSolve} />,
  ][step];

  return (
    <>
      <div className="screen-enter">
        <TopBar
          title={`New run — ${workflow === 'school' ? 'School' : 'College'}`}
          crumbs={['Dashboard']}
          actions={
            <>
              <Btn variant="ghost" size="sm" onClick={() => navigate('/dashboard')}>
                Save &amp; exit
              </Btn>
              <span className="mono text-[11px]" style={{ color: 'var(--ink-3)' }}>
                autosaved
              </span>
            </>
          }
        />

        <div className="px-8 pt-6 pb-16 max-w-[1400px] mx-auto">
          {/* 7-step progress bar */}
          <div className="mb-8">
            <div className="flex items-end justify-between mb-3">
              {labels.map((label, i) => (
                <div key={label} className="flex flex-col items-center" style={{ flex: 1 }}>
                  <button
                    onClick={() => setStep(i)}
                    className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold border transition-all mb-1"
                    style={{
                      background: i < step ? 'var(--brand)' : i === step ? 'var(--ink)' : 'var(--paper)',
                      color: i < step ? 'white' : i === step ? 'var(--paper)' : 'var(--ink-3)',
                      borderColor: i < step ? 'var(--brand)' : i === step ? 'var(--ink)' : 'var(--line)',
                    }}
                  >
                    {i < step ? <Icon name="check" size={12} /> : i + 1}
                  </button>
                  <span className="text-[10px] hidden md:block" style={{ color: i === step ? 'var(--ink)' : 'var(--ink-3)', fontWeight: i === step ? 600 : 400 }}>
                    {label}
                  </span>
                </div>
              ))}
            </div>
            <div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--line)' }}>
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{ width: `${(step / (TOTAL - 1)) * 100}%`, background: 'var(--brand)' }}
              />
            </div>
          </div>

          {/* Two-column layout */}
          <div className="grid grid-cols-12 gap-8">
            <div className="col-span-12 lg:col-span-8">
              <div className="edge rounded-xl p-8" style={{ background: 'var(--paper)' }}>
                {/* Step header */}
                <div className="mb-6 pb-5" style={{ borderBottom: '1px solid var(--line)' }}>
                  <Eyebrow>Step {step + 1} of {TOTAL}</Eyebrow>
                  <h2 className="serif text-[40px] tracking-tight leading-tight mt-2">
                    {labels[step]}
                  </h2>
                </div>

                {stepContent}

                {/* Nav buttons */}
                <div className="mt-8 pt-6 flex items-center justify-between" style={{ borderTop: '1px solid var(--line)' }}>
                  <Btn
                    variant="ghost"
                    size="md"
                    disabled={step === 0}
                    onClick={() => setStep(s => Math.max(0, s - 1))}
                  >
                    ← Back
                  </Btn>
                  {step < TOTAL - 1 && (
                    <Btn variant="primary" size="md" onClick={() => setStep(s => Math.min(TOTAL - 1, s + 1))}>
                      Continue to {labels[step + 1]} <Icon name="arrow" size={14} />
                    </Btn>
                  )}
                </div>
              </div>
            </div>

            <div className="col-span-12 lg:col-span-4">
              <DraftPanel step={step} totalSteps={TOTAL} />
            </div>
          </div>
        </div>
      </div>

      {solving && (
        <SolvingOverlay
          progress={progress}
          onDone={() => { setSolving(false); navigate('/timetable'); }}
        />
      )}
    </>
  );
};

export default NewRunWizard;
