import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Btn, Eyebrow, Chip, Dot, Icon } from '../ui/primitives';

const DEMO_URL = 'https://youtu.be/FnEJKE4fZ2M';

// ─── Mock data for demo grid ──────────────────────────────────────────────────
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const PERIODS = [
  { p: 1, start: '09:00' }, { p: 2, start: '09:55' }, { p: 3, start: '10:50' },
  { p: 4, start: '11:45' }, { p: 5, start: '13:30' }, { p: 6, start: '14:25' }, { p: 7, start: '15:20' },
];
const SUBJECT_COLORS: Record<string, string> = {
  CS301: '#0369A1', CS302: '#0F766E', CS303: '#7C3AED', CS304: '#B45309',
  MA301: '#BE185D', CS391: '#065F46', CS392: '#065F46', HS301: '#4B5563',
};
const GRID: Record<string, Record<number, string | null>> = {
  Mon: { 1: 'CS301', 2: 'CS302', 3: 'MA301', 4: 'CS303', 5: 'CS391', 6: 'CS391', 7: 'HS301' },
  Tue: { 1: 'CS303', 2: 'CS301', 3: 'CS304', 4: 'MA301', 5: 'CS392', 6: 'CS392', 7: null },
  Wed: { 1: 'CS302', 2: 'CS304', 3: 'CS303', 4: 'CS301', 5: null, 6: 'HS301', 7: 'MA301' },
  Thu: { 1: 'MA301', 2: 'CS303', 3: 'CS302', 4: 'CS304', 5: 'CS391', 6: 'CS391', 7: null },
  Fri: { 1: 'CS304', 2: 'CS301', 3: 'HS301', 4: 'CS302', 5: 'CS392', 6: 'CS392', 7: 'MA301' },
};

const CONSTRAINTS = [
  { id: 1, name: 'FacultyOverlap', rule: 'No faculty teaches two classes at the same time' },
  { id: 2, name: 'RoomOverlap', rule: 'No room hosts two classes simultaneously' },
  { id: 3, name: 'BatchOverlap', rule: 'No batch attends two classes simultaneously' },
  { id: 4, name: 'RoomCapacity', rule: 'Room size ≥ batch enrollment' },
  { id: 5, name: 'CourseHours', rule: 'Each course gets its required contact hours' },
  { id: 6, name: 'FacultyWorkload', rule: 'Faculty hours stay within contract limits' },
  { id: 7, name: 'RoomFeatures', rule: 'Rooms match course requirements (lab, projector…)' },
  { id: 8, name: 'LabConsecutive', rule: 'Lab sessions are always scheduled back-to-back' },
];

// ─── Mini timetable grid ──────────────────────────────────────────────────────
const MiniGrid: React.FC<{ animate?: boolean }> = ({ animate = false }) => (
  <div className="w-full">
    <div className="grid gap-[3px]" style={{ gridTemplateColumns: '44px repeat(5, 1fr)' }}>
      <div />
      {DAYS.map(d => (
        <div key={d} className="text-[10px] mono text-center pb-1" style={{ color: 'var(--ink-3)' }}>
          {d.toUpperCase()}
        </div>
      ))}
      {PERIODS.map((slot, pi) => (
        <React.Fragment key={slot.p}>
          <div className="text-[10px] mono flex items-center justify-end pr-1" style={{ color: 'var(--ink-3)' }}>
            {slot.start}
          </div>
          {DAYS.map((d, di) => {
            const code = GRID[d]?.[slot.p] ?? null;
            const bg = code ? SUBJECT_COLORS[code] : 'transparent';
            const idx = pi * 5 + di;
            return (
              <div
                key={d + slot.p}
                className={`rounded-[4px] h-[22px] flex items-center justify-center text-[9px] font-semibold text-white ${animate ? 'fill-in' : ''}`}
                style={{
                  background: code ? bg : 'var(--paper-2)',
                  border: code ? 'none' : '1px solid var(--line)',
                  animationDelay: animate ? `${idx * 35}ms` : '0ms',
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
);

// ─── Nav ─────────────────────────────────────────────────────────────────────
const Nav: React.FC<{ workflow: string; onWorkflow: (w: string) => void; onEnter: () => void }> = ({
  workflow, onWorkflow, onEnter,
}) => (
  <nav className="sticky top-0 z-40 border-b" style={{ backdropFilter: 'blur(12px)', background: 'rgba(250,249,246,0.85)', borderColor: 'var(--line)' }}>
    <div className="max-w-[1280px] mx-auto px-8 h-16 flex items-center justify-between gap-6">
      {/* Logo */}
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-md flex items-center justify-center" style={{ background: 'var(--ink)' }}>
          <div className="grid grid-cols-2 gap-[2px]">
            <div className="w-[4px] h-[4px] rounded-[1px]" style={{ background: 'var(--paper)' }} />
            <div className="w-[4px] h-[4px] rounded-[1px] opacity-40" style={{ background: 'var(--paper)' }} />
            <div className="w-[4px] h-[4px] rounded-[1px] opacity-40" style={{ background: 'var(--paper)' }} />
            <div className="w-[4px] h-[4px] rounded-[1px]" style={{ background: 'var(--paper)' }} />
          </div>
        </div>
        <span className="font-bold tracking-tight">TT-Scheduler</span>
      </div>

      {/* Workflow toggle */}
      <div className="hidden md:flex items-center edge rounded-full p-1" style={{ background: 'var(--paper)' }}>
        {(['school', 'college'] as const).map(w => (
          <button
            key={w}
            onClick={() => onWorkflow(w)}
            className="px-4 py-1.5 rounded-full text-[12px] font-semibold capitalize transition-all"
            style={{
              background: workflow === w ? 'var(--ink)' : 'transparent',
              color: workflow === w ? 'var(--paper)' : 'var(--ink-3)',
            }}
          >
            {w === 'school' ? '🏫 School' : '🎓 College'}
          </button>
        ))}
      </div>

      {/* Links */}
      <div className="hidden md:flex items-center gap-8 text-sm" style={{ color: 'var(--ink-2)' }}>
        <a href="#how" className="hover:opacity-70 transition-opacity">How it works</a>
        <a href="#constraints" className="hover:opacity-70 transition-opacity">Engine</a>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <Btn variant="link" size="sm" onClick={onEnter}>Sign in</Btn>
        <Btn variant="primary" size="sm" onClick={onEnter}>
          Get started <Icon name="arrow" size={14} />
        </Btn>
      </div>
    </div>
  </nav>
);

// ─── Hero ─────────────────────────────────────────────────────────────────────
const Hero: React.FC<{ workflow: string; onEnter: () => void }> = ({ workflow, onEnter }) => {
  const isSchool = workflow === 'school';
  return (
    <section className="max-w-[1280px] mx-auto px-8 pt-16 pb-20">
      <div className="grid grid-cols-12 gap-12 items-center">
        <div className="col-span-12 lg:col-span-7">
          <div className="flex items-center gap-2 mb-6">
            <Eyebrow>Timetabling, solved</Eyebrow>
            <div className="h-px max-w-[60px] flex-1" style={{ background: 'var(--line)' }} />
            <Chip tone={isSchool ? 'ok' : 'brand'}>
              {isSchool ? '🏫 School mode' : '🎓 College mode'}
            </Chip>
          </div>
          <h1
            className="serif leading-[0.9] tracking-tight mb-8"
            style={{ fontSize: 'clamp(56px, 8vw, 112px)' }}
          >
            {isSchool ? (
              <>A clash-free<br />class schedule<br /><span className="italic" style={{ color: 'var(--brand)' }}>in minutes.</span></>
            ) : (
              <>All batches.<br />Zero conflicts.<br /><span className="italic" style={{ color: 'var(--brand)' }}>In 60 seconds.</span></>
            )}
          </h1>
          <p className="text-[17px] leading-relaxed mb-8 max-w-lg" style={{ color: 'var(--ink-2)' }}>
            {isSchool
              ? 'Enter your classes, teachers and periods. A constraint solver builds a complete, conflict-free timetable — no spreadsheets, no manual swaps.'
              : 'Describe your departments, faculty, rooms and credit hours. A CP-SAT solver satisfies 8 hard constraints and returns an optimal timetable in under a minute.'}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Btn variant="primary" size="lg" onClick={onEnter}>
              {isSchool ? 'Schedule my school' : 'Schedule my college'} <Icon name="arrow" size={14} />
            </Btn>
            <Btn variant="ghost" size="lg" onClick={() => window.open(DEMO_URL, '_blank', 'noopener,noreferrer')}>
              <Icon name="play" size={14} /> Demo
            </Btn>
          </div>
          <div className="mt-6 flex items-center gap-5 text-[12px] mono" style={{ color: 'var(--ink-3)' }}>
            <span><Icon name="check" size={12} className="inline mr-1" />Free to start</span>
            <span><Icon name="check" size={12} className="inline mr-1" />Saves every step</span>
          </div>
        </div>

        <div className="col-span-12 lg:col-span-5">
          <div className="edge rounded-2xl p-4" style={{ background: 'var(--paper)' }}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Dot color="var(--ok)" />
                <span className="mono text-[11px]" style={{ color: 'var(--ink-2)' }}>
                  {isSchool ? 'Class 10-B · live' : 'CS-3A · live'}
                </span>
              </div>
              <span className="mono text-[11px]" style={{ color: 'var(--ink-3)' }}>0 clashes · 3.4s</span>
            </div>
            <MiniGrid animate />
            <div className="mt-3 pt-3 border-t flex items-center justify-between text-[11px] mono" style={{ borderColor: 'var(--line)', color: 'var(--ink-3)' }}>
              <span>35/35 slots</span>
              <span>{isSchool ? '4 constraints ✓' : '8 constraints ✓'}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

// ─── Ticker ───────────────────────────────────────────────────────────────────
const Ticker: React.FC<{ workflow: string }> = ({ workflow }) => {
  const schoolItems = [
    'Zero-Clash Schedule', 'Lunch Break Insertion', 'Room Capacity Checks', 'Teacher Conflict Detection',
    'Multi-Section Classes', 'Excel Export', 'PDF Export', 'Auto-Resolve Wizard',
    'Max Periods Per Day', 'Per-Teacher Workload Limit', 'Custom Working Days', 'Drag-Free Timetable',
  ];
  const collegeItems = [
    'CP-SAT Solver', 'Zero-Clash Guarantee', 'Lab Pair Enforcement', 'Weekly Period Allocation',
    'Faculty Workload Balancing', 'Room Capacity Checks', 'Excel & PDF Export', 'Auto-Resolve Wizard',
    'Greedy Fallback Engine', 'Multi-Section Support', 'Live Conflict Diagnostics', 'Constraint Tuning',
  ];
  const items = workflow === 'school' ? schoolItems : collegeItems;
  const row = [...items, ...items];
  return (
    <div className="py-5 overflow-hidden" style={{ borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)' }}>
      <div className="max-w-[1280px] mx-auto px-8 mb-3">
        <Eyebrow>
          {workflow === 'school' ? 'What the school scheduler handles' : "What's packed inside the engine"}
        </Eyebrow>
      </div>
      <div className="flex whitespace-nowrap marquee">
        {row.map((n, i) => (
          <span key={i} className="mx-8 serif text-2xl" style={{ color: 'var(--ink-3)' }}>{n}</span>
        ))}
      </div>
    </div>
  );
};

// ─── Workflow comparison ──────────────────────────────────────────────────────
const WorkflowSection: React.FC<{ workflow: string; onWorkflow: (w: string) => void; onEnter: () => void }> = ({
  workflow, onWorkflow, onEnter,
}) => {
  const isSchool = workflow === 'school';
  const rows = [
    { label: 'Complexity', school: 'Simpler — one department, linear class sections', college: 'Multi-department, batches, electives, credit hours' },
    { label: 'Faculty rules', school: 'Basic — no more than N periods/day', college: 'Contract hours, workload caps, preference windows' },
    { label: 'Rooms', school: 'General classrooms, optional lab', college: 'Typed rooms: lecture halls, seminar rooms, lab clusters' },
    { label: 'Constraints', school: '4 core — no clash, room cap, teacher overlap, limit', college: '8 hard — all 4 above + lab consecutive, credit balance, elective groups' },
    { label: 'Solve time', school: '< 5 seconds typical', college: '< 60 seconds, even at university scale' },
    { label: 'Output views', school: 'Class view, teacher view, printable PDF', college: 'Batch, faculty, room, analytics, Excel, Google Cal' },
  ];
  return (
    <section className="max-w-[1280px] mx-auto px-8 py-24">
      <div className="flex items-end justify-between mb-10 flex-wrap gap-4">
        <div>
          <Eyebrow>Two workflows. One engine.</Eyebrow>
          <h2 className="serif leading-[1] tracking-tight mt-4" style={{ fontSize: 52 }}>
            {isSchool ? 'Built for schools.' : 'Built for colleges.'}<br />
            <span className="italic" style={{ color: 'var(--ink-3)', fontSize: '0.9em' }}>
              {isSchool ? 'Switch to college anytime.' : 'Switch to school anytime.'}
            </span>
          </h2>
        </div>
        <div className="edge rounded-full p-1 flex" style={{ background: 'var(--paper)' }}>
          {(['school', 'college'] as const).map(w => (
            <button
              key={w}
              onClick={() => onWorkflow(w)}
              className="px-4 py-2 rounded-full text-sm font-semibold capitalize transition-all"
              style={{
                background: workflow === w ? 'var(--ink)' : 'transparent',
                color: workflow === w ? 'var(--paper)' : 'var(--ink-2)',
              }}
            >
              {w === 'school' ? '🏫 School' : '🎓 College'}
            </button>
          ))}
        </div>
      </div>

      <div className="edge rounded-2xl overflow-hidden mb-8" style={{ background: 'var(--paper)' }}>
        <div className="grid grid-cols-3 text-sm">
          <div className="py-3 px-5 border-b border-r" style={{ borderColor: 'var(--line)', background: 'var(--paper-2)' }}>
            <span className="eyebrow" style={{ color: 'var(--ink-3)' }}>Feature</span>
          </div>
          <div className="py-3 px-5 border-b border-r flex items-center gap-2 font-semibold" style={{ borderColor: 'var(--line)', background: isSchool ? 'var(--brand-soft)' : 'var(--paper-2)' }}>
            🏫 School {isSchool && <Chip tone="ok">selected</Chip>}
          </div>
          <div className="py-3 px-5 border-b flex items-center gap-2 font-semibold" style={{ borderColor: 'var(--line)', background: !isSchool ? 'var(--brand-soft)' : 'var(--paper-2)' }}>
            🎓 College {!isSchool && <Chip tone="brand">selected</Chip>}
          </div>
          {rows.map((row, i) => (
            <React.Fragment key={row.label}>
              <div className="py-3 px-5 border-r" style={{ borderColor: 'var(--line)', borderBottom: i < rows.length - 1 ? '1px solid var(--line)' : undefined }}>
                <span className="font-medium text-[13px]">{row.label}</span>
              </div>
              <div className="py-3 px-5 text-[13px] leading-snug border-r" style={{ borderColor: 'var(--line)', borderBottom: i < rows.length - 1 ? '1px solid var(--line)' : undefined, background: isSchool ? 'rgba(204,251,241,0.2)' : 'transparent', color: 'var(--ink-2)' }}>
                {row.school}
              </div>
              <div className="py-3 px-5 text-[13px] leading-snug" style={{ borderBottom: i < rows.length - 1 ? '1px solid var(--line)' : undefined, background: !isSchool ? 'rgba(224,242,254,0.2)' : 'transparent', color: 'var(--ink-2)' }}>
                {row.college}
              </div>
            </React.Fragment>
          ))}
        </div>
      </div>

      <div className="text-center">
        <Btn variant="primary" size="lg" onClick={onEnter}>
          Start with {isSchool ? 'School' : 'College'} workflow <Icon name="arrow" size={14} />
        </Btn>
      </div>
    </section>
  );
};

// ─── How It Works ─────────────────────────────────────────────────────────────
const HowItWorks: React.FC<{ workflow: string }> = ({ workflow }) => {
  const isSchool = workflow === 'school';
  const steps = isSchool ? [
    { n: '01', t: 'Describe', d: 'Name your school, add classes (10-A, 10-B…), enter teacher names and subjects. ~3 min.', time: '~3 min' },
    { n: '02', t: 'Schedule', d: 'Set periods per day, break windows, and any teacher preferences.', time: '~2 min' },
    { n: '03', t: 'Solve', d: 'The solver assigns every period instantly with zero clashes.', time: '~5 sec' },
    { n: '04', t: 'Share', d: 'Print or export the finished timetable to Excel or PDF.', time: '1 click' },
  ] : [
    { n: '01', t: 'Describe', d: 'Departments, batches, subjects with credit hours. Import from Excel or fill the wizard.', time: '~8 min' },
    { n: '02', t: 'Constraint', d: '8 hard rules, lab-pair requirements, soft preferences for faculty.', time: '~3 min' },
    { n: '03', t: 'Solve', d: 'CP-SAT explores billions of states. Live logs, progress bar, guaranteed result.', time: '~60 sec' },
    { n: '04', t: 'Distribute', d: 'Grid, faculty, room and batch views. Excel, PDF and Google Calendar.', time: '1 click' },
  ];
  return (
    <section id="how" style={{ borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)', background: 'rgba(243,241,234,0.4)' }}>
      <div className="max-w-[1280px] mx-auto px-8 py-24">
        <div className="flex items-end justify-between mb-14">
          <div>
            <Eyebrow>How {isSchool ? 'School' : 'College'} workflow works</Eyebrow>
            <h2 className="serif leading-[1] tracking-tight mt-4" style={{ fontSize: 52 }}>
              Four steps.<br />One timetable.
            </h2>
          </div>
          <span className="mono text-[12px]" style={{ color: 'var(--ink-3)' }}>
            ≈ {isSchool ? '8' : '12'} minutes total
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-0" style={{ borderTop: '1px solid var(--line)' }}>
          {steps.map((s, i) => (
            <div key={s.n} className="py-8 pr-6 pl-6" style={{ borderRight: i < 3 ? '1px solid var(--line)' : undefined }}>
              <div className="flex items-baseline gap-3 mb-4">
                <span className="mono text-[11px]" style={{ color: 'var(--ink-3)' }}>{s.n}</span>
                <span className="mono text-[11px]" style={{ color: 'var(--ink-3)' }}>{s.time}</span>
              </div>
              <h3 className="serif text-3xl mb-3">{s.t}</h3>
              <p className="text-sm leading-relaxed pr-4" style={{ color: 'var(--ink-2)' }}>{s.d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

// ─── Constraints section ──────────────────────────────────────────────────────
const ConstraintsSection: React.FC<{ workflow: string }> = ({ workflow }) => {
  const isSchool = workflow === 'school';
  const shown = isSchool ? CONSTRAINTS.slice(0, 4) : CONSTRAINTS;
  return (
    <section id="constraints" className="max-w-[1280px] mx-auto px-8 py-24">
      <div className="grid grid-cols-12 gap-8">
        <div className="col-span-12 md:col-span-4 md:sticky" style={{ top: 96 }}>
          <Eyebrow>The engine</Eyebrow>
          <h2 className="serif leading-[1] tracking-tight mt-4 mb-6" style={{ fontSize: 52 }}>
            {isSchool ? 'Four' : 'Eight'} hard rules.<br />
            <span className="italic" style={{ color: 'var(--brand)' }}>Zero exceptions.</span>
          </h2>
          <p className="leading-relaxed text-sm mb-6" style={{ color: 'var(--ink-2)' }}>
            {isSchool
              ? 'Every assignment is checked against four core constraints. If any are violated, the solution is discarded entirely.'
              : 'Google OR-Tools CP-SAT solver checks all eight constraints. If any are violated, the solution is discarded.'}
          </p>
          <div className="mono text-[12px]" style={{ color: 'var(--ink-3)' }}>
            $ solver.search()<br />
            → {isSchool ? '12,400' : '1,428,317'} states<br />
            → {isSchool ? '0.4s' : '3.4s'} solve<br />
            → optimal ✓
          </div>
        </div>
        <div className="col-span-12 md:col-span-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 rounded-2xl overflow-hidden edge" style={{ background: 'var(--line)', gap: 1 }}>
            {shown.map(c => (
              <div key={c.id} className="p-6 lift" style={{ background: 'var(--paper)' }}>
                <div className="flex items-baseline justify-between mb-3">
                  <span className="mono text-[11px]" style={{ color: 'var(--ink-3)' }}>
                    C.{String(c.id).padStart(2, '0')}
                  </span>
                  <Icon name="lock" size={14} className="" style={{ color: 'var(--ink-3)' } as React.CSSProperties} />
                </div>
                <h4 className="font-semibold mb-1.5">{c.name}</h4>
                <p className="text-[13px] leading-snug" style={{ color: 'var(--ink-2)' }}>{c.rule}</p>
              </div>
            ))}
          </div>
          {isSchool && (
            <p className="mt-4 text-[12px] mono" style={{ color: 'var(--ink-3)' }}>
              + 4 more constraints available when you switch to College workflow →
            </p>
          )}
        </div>
      </div>
    </section>
  );
};

// ─── Testimonial ──────────────────────────────────────────────────────────────
const Testimonial: React.FC<{ workflow: string }> = ({ workflow }) => {
  const isSchool = workflow === 'school';
  const schoolHighlights = [
    { n: '01', title: 'Set up in minutes', body: 'Add your classes, teachers and subjects through a guided wizard. No training needed — any coordinator can do it.' },
    { n: '02', title: 'Instant, clash-free result', body: 'The scheduler checks every room, teacher and period simultaneously. You get a complete, conflict-free timetable in seconds.' },
    { n: '03', title: 'Export & share', body: 'Download the finished timetable as a PDF or Excel sheet and share it with staff the same day.' },
  ];
  const collegeHighlights = [
    { n: '01', title: 'Constraint-driven', body: 'Define hard rules once — room capacities, faculty limits, consecutive period caps — and the solver respects every one of them.' },
    { n: '02', title: 'Solver power', body: 'Google OR-Tools CP-SAT searches millions of combinations and guarantees a clash-free result — or tells you exactly why one isn\'t possible.' },
    { n: '03', title: 'Multi-format export', body: 'One-click export to Excel or PDF. Class view, faculty view and room view — every stakeholder gets their own sheet.' },
  ];
  const highlights = isSchool ? schoolHighlights : collegeHighlights;
  return (
    <section className="max-w-[1280px] mx-auto px-8 py-24" style={{ borderTop: '1px solid var(--line)' }}>
      <div className="grid grid-cols-12 gap-8">
        <div className="col-span-12 md:col-span-2">
          <Eyebrow>Why we built this</Eyebrow>
        </div>
        <div className="col-span-12 md:col-span-10">
          {isSchool ? (
            <p className="serif leading-[1.1] tracking-tight max-w-3xl mb-12" style={{ fontSize: 38, color: 'var(--ink)' }}>
              School coordinators shouldn't need a software team to build a timetable.
              We made it{' '}
              <em style={{ color: 'var(--ink-3)' }}>as simple as filling in a form</em>{' '}
              — and the solver handles the rest.
            </p>
          ) : (
            <p className="serif leading-[1.1] tracking-tight max-w-3xl mb-12" style={{ fontSize: 38, color: 'var(--ink)' }}>
              Timetable scheduling is a solved problem in computer science.
              It just hadn't been packaged for the people who actually need it —{' '}
              <em style={{ color: 'var(--ink-3)' }}>registrars and department heads</em>{' '}
              working without a dedicated IT team.
            </p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {highlights.map(h => (
              <div key={h.n} className="edge rounded-xl p-6" style={{ background: 'var(--paper)' }}>
                <span className="mono text-[11px] block mb-3" style={{ color: 'var(--ink-3)' }}>{h.n}</span>
                <h4 className="font-semibold mb-2">{h.title}</h4>
                <p className="text-[13px] leading-relaxed" style={{ color: 'var(--ink-2)' }}>{h.body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};


// ─── CTA ─────────────────────────────────────────────────────────────────────
const CTA: React.FC<{ workflow: string; onEnter: () => void }> = ({ workflow, onEnter }) => {
  const isSchool = workflow === 'school';
  return (
    <section className="max-w-[1280px] mx-auto px-8 py-32 text-center">
      <h2 className="serif tracking-tight leading-[0.9]" style={{ fontSize: 'clamp(56px, 8vw, 120px)' }}>
        {isSchool ? (
          <>Your next<br /><span className="italic" style={{ color: 'var(--brand)' }}>term's schedule,</span><br />waiting.</>
        ) : (
          <>Your fall<br /><span className="italic" style={{ color: 'var(--brand)' }}>timetable,</span><br />waiting.</>
        )}
      </h2>
      <div className="mt-10 flex items-center justify-center gap-3">
        <Btn variant="primary" size="lg" onClick={onEnter}>Open the app <Icon name="arrow" size={14} /></Btn>
        <Btn variant="ghost" size="lg" onClick={() => window.open('/TT-Scheduler_User_Manual.pdf', '_blank')}>Read the docs</Btn>
      </div>
    </section>
  );
};

// ─── Footer ───────────────────────────────────────────────────────────────────
const Footer: React.FC = () => (
  <footer style={{ borderTop: '1px solid var(--line)' }}>
    <div className="max-w-[1280px] mx-auto px-8 py-12 grid grid-cols-2 md:grid-cols-5 gap-8 text-sm">
      <div className="col-span-2">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-6 h-6 rounded flex items-center justify-center" style={{ background: 'var(--ink)' }}>
              <div className="grid grid-cols-2 gap-[1.5px]">
                <div className="w-[3px] h-[3px] rounded-[1px] bg-white" />
                <div className="w-[3px] h-[3px] rounded-[1px] bg-white opacity-40" />
                <div className="w-[3px] h-[3px] rounded-[1px] bg-white opacity-40" />
                <div className="w-[3px] h-[3px] rounded-[1px] bg-white" />
              </div>
            </div>
          <span className="font-bold">TT-Scheduler</span>
        </div>
        <p className="text-[13px] max-w-xs" style={{ color: 'var(--ink-3)' }}>
          Conflict-free timetables for schools and colleges — powered by constraint solving.
        </p>
      </div>
      {[
        { h: 'Product', ls: ['Features', 'Solver', 'Changelog'] },
        { h: 'Docs', ls: ['Quickstart', 'API', 'Constraints', 'Excel import'] },
        { h: 'Company', ls: ['About', 'Customers', 'Blog', 'Contact'] },
      ].map(col => (
        <div key={col.h}>
          <div className="eyebrow mb-3" style={{ color: 'var(--ink-3)' }}>{col.h}</div>
          <ul className="space-y-1.5" style={{ color: 'var(--ink-2)' }}>
            {col.ls.map(l => <li key={l}>{l}</li>)}
          </ul>
        </div>
      ))}
    </div>
    <div style={{ borderTop: '1px solid var(--line)' }}>
      <div className="max-w-[1280px] mx-auto px-8 py-5 flex items-center justify-between text-xs mono" style={{ color: 'var(--ink-3)' }}>
        <span>© 2026 TT-Scheduler · MIT</span>
        <span>solver: CP-SAT 9.10</span>
      </div>
    </div>
  </footer>
);

// ─── Main export ──────────────────────────────────────────────────────────────
const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const [workflow, setWorkflow] = useState<'school' | 'college'>('college');

  const goToApp = () => navigate('/dashboard');

  return (
    <div
      className="screen-enter paper-grain"
      style={{ background: 'var(--paper)', color: 'var(--ink)', minHeight: '100vh' }}
      data-workflow={workflow}
    >
      <Nav workflow={workflow} onWorkflow={w => setWorkflow(w as 'school' | 'college')} onEnter={goToApp} />
      <Hero workflow={workflow} onEnter={goToApp} />
      <Ticker workflow={workflow} />
      <WorkflowSection workflow={workflow} onWorkflow={w => setWorkflow(w as 'school' | 'college')} onEnter={goToApp} />
      <HowItWorks workflow={workflow} />
      <ConstraintsSection workflow={workflow} />
      <Testimonial workflow={workflow} />
      <CTA workflow={workflow} onEnter={goToApp} />
      <Footer />
    </div>
  );
};

export default LandingPage;
