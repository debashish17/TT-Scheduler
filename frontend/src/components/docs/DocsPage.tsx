import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Section {
  id: string;
  label: string;
  group?: string;
}

// ─── Sidebar sections ─────────────────────────────────────────────────────────
const SECTIONS: Section[] = [
  { id: 'quickstart',   label: 'Quickstart',    group: 'Getting Started' },
  { id: 'features',     label: 'Features',      group: 'Product' },
  { id: 'solver',       label: 'How the Solver Works', group: 'Product' },
  { id: 'constraints',  label: 'Constraints',   group: 'Product' },
  { id: 'excel-import', label: 'Excel Import',  group: 'Guides' },
  { id: 'api',          label: 'API Reference', group: 'Guides' },
  { id: 'user-manual',  label: 'User Manual',   group: 'Guides' },
  { id: 'changelog',    label: 'Changelog',     group: 'Guides' },
  { id: 'about',        label: 'About',         group: 'Company' },
  { id: 'contact',      label: 'Contact',       group: 'Company' },
];

// ─── Small reusable primitives ────────────────────────────────────────────────
const Tag: React.FC<{ children: React.ReactNode; color?: string }> = ({ children, color = 'var(--ink)' }) => (
  <span
    className="inline-block font-mono text-[11px] px-2 py-0.5 rounded-md font-medium"
    style={{ background: color, color: '#fff', letterSpacing: '0.02em' }}
  >
    {children}
  </span>
);

const Code: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <code
    className="font-mono text-[13px] px-1.5 py-0.5 rounded"
    style={{ background: 'var(--paper-2, #F0EFE9)', color: 'var(--ink)' }}
  >
    {children}
  </code>
);

const Pre: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <pre
    className="rounded-xl p-5 overflow-x-auto text-[13px] leading-relaxed my-5 font-mono"
    style={{ background: 'var(--ink)', color: 'var(--paper)' }}
  >
    {children}
  </pre>
);

const Divider = () => <hr style={{ border: 'none', borderTop: '1px solid var(--line)', margin: '40px 0' }} />;

const SectionHead: React.FC<{ id: string; children: React.ReactNode }> = ({ id, children }) => (
  <h2
    id={id}
    className="serif tracking-tight leading-tight mb-4 scroll-mt-24"
    style={{ fontSize: 32, color: 'var(--ink)' }}
  >
    {children}
  </h2>
);

const SubHead: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h3 className="font-bold text-base mb-3 mt-8" style={{ color: 'var(--ink)' }}>{children}</h3>
);

const P: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="text-sm leading-relaxed mb-4" style={{ color: 'var(--ink-2)' }}>{children}</p>
);

const UL: React.FC<{ items: React.ReactNode[] }> = ({ items }) => (
  <ul className="space-y-2 mb-5 text-sm" style={{ color: 'var(--ink-2)' }}>
    {items.map((it, i) => (
      <li key={i} className="flex items-start gap-2">
        <span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: 'var(--ink-3)' }} />
        <span>{it}</span>
      </li>
    ))}
  </ul>
);

const Table: React.FC<{ head: string[]; rows: React.ReactNode[][] }> = ({ head, rows }) => (
  <div className="overflow-x-auto rounded-xl my-5" style={{ border: '1px solid var(--line)' }}>
    <table className="w-full text-sm">
      <thead>
        <tr style={{ background: 'var(--paper-2, #F0EFE9)', borderBottom: '1px solid var(--line)' }}>
          {head.map(h => (
            <th key={h} className="text-left py-2.5 px-4 text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--ink-3)' }}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i} style={{ borderTop: i > 0 ? '1px solid var(--line)' : undefined }}>
            {row.map((cell, j) => (
              <td key={j} className="py-2.5 px-4" style={{ color: 'var(--ink-2)' }}>{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const Step: React.FC<{ n: number; title: string; children: React.ReactNode }> = ({ n, title, children }) => (
  <div className="flex gap-4 mb-6">
    <div
      className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5"
      style={{ background: 'var(--ink)', color: 'var(--paper)' }}
    >
      {n}
    </div>
    <div>
      <div className="font-semibold text-sm mb-1" style={{ color: 'var(--ink)' }}>{title}</div>
      <div className="text-sm leading-relaxed" style={{ color: 'var(--ink-2)' }}>{children}</div>
    </div>
  </div>
);

// ─── Contact card ─────────────────────────────────────────────────────────────
const ContactCard: React.FC<{ icon: React.ReactNode; label: string; value: string; href: string }> = ({ icon, label, value, href }) => (
  <a
    href={href}
    target="_blank"
    rel="noopener noreferrer"
    className="flex items-center gap-3 rounded-xl p-4 transition-opacity hover:opacity-70"
    style={{ border: '1px solid var(--line)', background: 'var(--paper)', textDecoration: 'none', minWidth: 0 }}
  >
    <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'var(--ink)' }}>
      {icon}
    </div>
    <div style={{ minWidth: 0 }}>
      <div className="text-[10px] mono mb-0.5 uppercase tracking-wide" style={{ color: 'var(--ink-3)' }}>{label}</div>
      <div className="text-[13px] font-medium truncate" style={{ color: 'var(--ink)' }}>{value}</div>
    </div>
  </a>
);

// ─── Main DocsPage ─────────────────────────────────────────────────────────────
const DocsPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeId, setActiveId] = useState('quickstart');
  const contentRef = useRef<HTMLDivElement>(null);

  // Scroll to hash on load / hash change
  useEffect(() => {
    const hash = location.hash.replace('#', '');
    if (hash) {
      const el = document.getElementById(hash);
      if (el) {
        setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
        setActiveId(hash);
      }
    }
  }, [location.hash]);

  // Highlight active section on scroll
  useEffect(() => {
    const observers: IntersectionObserver[] = [];
    SECTIONS.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (!el) return;
      const obs = new IntersectionObserver(
        ([entry]) => { if (entry.isIntersecting) setActiveId(id); },
        { rootMargin: '-20% 0px -70% 0px', threshold: 0 }
      );
      obs.observe(el);
      observers.push(obs);
    });
    return () => observers.forEach(o => o.disconnect());
  }, []);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); setActiveId(id); }
  };

  // Group sections for sidebar
  const groups = SECTIONS.reduce<Record<string, Section[]>>((acc, s) => {
    const g = s.group ?? 'Other';
    if (!acc[g]) acc[g] = [];
    acc[g].push(s);
    return acc;
  }, {});

  return (
    <div className="min-h-screen" style={{ background: 'var(--paper)', color: 'var(--ink)' }}>

      {/* ── Top nav ── */}
      <header
        className="sticky top-0 z-50 flex items-center justify-between px-8 h-14"
        style={{ background: 'var(--paper)', borderBottom: '1px solid var(--line)' }}
      >
        <button onClick={() => navigate('/')} className="flex items-center gap-2.5 hover:opacity-70 transition-opacity">
          <div className="w-6 h-6 rounded flex items-center justify-center" style={{ background: 'var(--ink)' }}>
            <div className="grid grid-cols-2 gap-[1.5px]">
              <div className="w-[3px] h-[3px] rounded-[1px] bg-white" />
              <div className="w-[3px] h-[3px] rounded-[1px] bg-white opacity-40" />
              <div className="w-[3px] h-[3px] rounded-[1px] bg-white opacity-40" />
              <div className="w-[3px] h-[3px] rounded-[1px] bg-white" />
            </div>
          </div>
          <span className="font-bold tracking-tight text-sm">TT-Scheduler</span>
          <span className="text-sm" style={{ color: 'var(--ink-3)' }}>/</span>
          <span className="text-sm font-medium" style={{ color: 'var(--ink-2)' }}>Docs</span>
        </button>
        <button
          onClick={() => navigate('/')}
          className="text-sm hover:opacity-70 transition-opacity flex items-center gap-1.5"
          style={{ color: 'var(--ink-2)' }}
        >
          ← Back to site
        </button>
      </header>

      {/* ── Body ── */}
      <div className="max-w-[1280px] mx-auto flex" style={{ minHeight: 'calc(100vh - 56px)' }}>

        {/* ── Sidebar ── */}
        <aside
          className="hidden md:block w-[240px] shrink-0 py-10 pr-6"
          style={{ position: 'sticky', top: 56, height: 'calc(100vh - 56px)', overflowY: 'auto', borderRight: '1px solid var(--line)' }}
        >
          {Object.entries(groups).map(([group, items]) => (
            <div key={group} className="mb-6">
              <div className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--ink-3)' }}>
                {group}
              </div>
              {items.map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => scrollTo(id)}
                  className="w-full text-left px-3 py-1.5 rounded-lg text-sm transition-colors"
                  style={{
                    background: activeId === id ? 'var(--ink)' : 'transparent',
                    color: activeId === id ? 'var(--paper)' : 'var(--ink-2)',
                    fontWeight: activeId === id ? 600 : 400,
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          ))}
        </aside>

        {/* ── Content ── */}
        <main ref={contentRef} className="flex-1 px-8 md:px-12 py-10 max-w-[800px]">

          {/* ──────────────────── QUICKSTART ──────────────────── */}
          <section id="quickstart" className="mb-16">
            <div className="text-[11px] mono mb-3 font-medium" style={{ color: 'var(--ink-3)' }}>GETTING STARTED</div>
            <SectionHead id="quickstart">Quickstart</SectionHead>
            <P>Go from zero to a fully solved, clash-free timetable in under five minutes. Here's how:</P>

            <Step n={1} title="Create an account">
              Visit the landing page and click <strong>Open the app</strong>. Sign up with your email or Google account. No credit card required.
            </Step>
            <Step n={2} title="Choose your institution type">
              Select <strong>School</strong> (classes, subjects, teachers) or <strong>College</strong> (departments, courses, faculty, labs). You can run both from the same account.
            </Step>
            <Step n={3} title="Run the 7-step wizard">
              The wizard collects everything the solver needs:
              <br /><br />
              <strong>School:</strong> Institution → Classes → Subjects → Teachers → Schedule → Rooms → Rules &amp; Generate
              <br /><br />
              <strong>College:</strong> Institution → Courses → Faculty → Schedule → Rooms → Constraints → Generate
            </Step>
            <Step n={4} title="Or import from Excel">
              Skip manual entry by uploading an Excel file from the dashboard. See the <button onClick={() => scrollTo('excel-import')} className="underline hover:opacity-70" style={{ color: 'var(--brand, #0369A1)' }}>Excel Import</button> section for the exact sheet format.
            </Step>
            <Step n={5} title="Hit Generate">
              The CP-SAT solver runs in the cloud and returns a complete, conflict-free timetable — typically in under 5 seconds.
            </Step>
            <Step n={6} title="Download or share">
              Export your timetable as Excel (Class / Faculty / Room views) or PDF. All past runs are saved in history and can be reopened at any time.
            </Step>
          </section>

          <Divider />

          {/* ──────────────────── FEATURES ──────────────────── */}
          <section id="features" className="mb-16">
            <div className="text-[11px] mono mb-3 font-medium" style={{ color: 'var(--ink-3)' }}>PRODUCT</div>
            <SectionHead id="features">Features</SectionHead>
            <P>TT-Scheduler is built for real institutions — not toy examples. Here's what it supports out of the box.</P>

            <SubHead>Two institution modes</SubHead>
            <UL items={[
              <><strong>School mode:</strong> Define classes (e.g. 10-A), subjects with weekly periods, and teachers. The solver assigns every subject to a room and time slot while respecting teacher availability and room capacity.</>,
              <><strong>College mode:</strong> Define departments, courses with lecture + lab hours, faculty workload caps, and room types (classroom, computer lab, etc.). Lab sessions are automatically scheduled as consecutive paired blocks.</>,
            ]} />

            <SubHead>Excel import</SubHead>
            <P>Upload a structured Excel file from the dashboard to pre-fill all wizard fields in one step. No manual entry needed for large institutions.</P>

            <SubHead>CP-SAT solver</SubHead>
            <P>Powered by Google OR-Tools 9.10. The solver models your timetable as a constraint satisfaction problem and guarantees zero clashes — every run produces a mathematically valid schedule.</P>

            <SubHead>AI draft</SubHead>
            <P>Describe your institution in plain English and the AI pre-fills the wizard for you. Useful for quickly scaffolding a new timetable structure.</P>

            <SubHead>Export formats</SubHead>
            <UL items={[
              'Excel (.xlsx) — Class View, Faculty View, Room View sheets',
              'PDF — per-class, per-faculty, per-room, per-student (downloaded as a zip)',
              'User Manual PDF — available via the "Read the docs" button on the landing page',
            ]} />

            <SubHead>Run history</SubHead>
            <P>Every solver run is saved. You can reopen any past run, compare outputs, and delete runs you no longer need.</P>
          </section>

          <Divider />

          {/* ──────────────────── SOLVER ──────────────────── */}
          <section id="solver" className="mb-16">
            <div className="text-[11px] mono mb-3 font-medium" style={{ color: 'var(--ink-3)' }}>PRODUCT</div>
            <SectionHead id="solver">How the Solver Works</SectionHead>
            <P>
              TT-Scheduler uses <strong>Google OR-Tools CP-SAT 9.10</strong> — a Constraint Programming solver with SAT-based propagation. It models the timetabling problem as a set of boolean variables and hard constraints, then finds a feasible assignment that also minimises soft penalties.
            </P>

            <SubHead>Decision variables</SubHead>
            <P>
              For each <em>(session, day, period, room)</em> tuple the solver creates a boolean variable: <Code>x[session, day, period, room] ∈ {'{'} 0, 1 {'}'}</Code>. A value of 1 means that session is assigned to that slot and room.
            </P>

            <SubHead>Hard constraints enforced by the model</SubHead>
            <Table
              head={['Constraint', 'Description']}
              rows={[
                ['No teacher/faculty overlap', 'A teacher can teach at most one session per (day, period).'],
                ['No room overlap', 'A room can host at most one session per (day, period).'],
                ['No class/section overlap', 'A class or section attends at most one session per (day, period).'],
                ['Room capacity', 'The room\'s capacity must be ≥ the enrolled students for that session.'],
                ['Same teacher per subject-class bundle', 'All periods of a given (class, subject) pair are assigned to the same teacher, preventing mid-term teacher switches (school mode).'],
                ['No back-to-back same subject', 'The same subject cannot appear in two consecutive periods on the same day for the same class/section.'],
                ['Lab pairs consecutive', 'College lab sessions are scheduled as two back-to-back periods on the same day with the same faculty and room.'],
                ['Max periods per day', 'Configurable cap on how many periods a teacher/faculty can be scheduled per day.'],
                ['Lunch period', 'The designated lunch period is excluded from schedulable slots entirely (college) or treated as a display gap (school).'],
              ]}
            />

            <SubHead>Soft objectives</SubHead>
            <P>After satisfying all hard constraints, the solver minimises a weighted penalty sum. The default soft objective spreads each subject's sessions across different days of the week to avoid all periods of one subject clustering on a single day.</P>
            <P>You can add your own soft rules in the wizard's Rules step — see <button onClick={() => scrollTo('constraints')} className="underline hover:opacity-70" style={{ color: 'var(--brand, #0369A1)' }}>Constraints</button>.</P>

            <SubHead>Solve time</SubHead>
            <P>Most school timetables solve in 1–5 seconds. College timetables with lab constraints and large room sets typically solve in 3–15 seconds. The solver runs with a time limit; if no feasible solution is found within the limit a diagnostic error is returned explaining which constraint is infeasible.</P>
          </section>

          <Divider />

          {/* ──────────────────── CONSTRAINTS ──────────────────── */}
          <section id="constraints" className="mb-16">
            <div className="text-[11px] mono mb-3 font-medium" style={{ color: 'var(--ink-3)' }}>PRODUCT</div>
            <SectionHead id="constraints">Constraints</SectionHead>
            <P>TT-Scheduler distinguishes between <strong>hard constraints</strong> (the solver must satisfy them — no exceptions) and <strong>soft constraints</strong> (the solver tries to satisfy them, weighted by priority).</P>

            <SubHead>Hard constraints</SubHead>
            <P>The following built-in hard constraints are always active and cannot be turned off:</P>
            <UL items={[
              'No teacher/faculty overlap',
              'No room overlap',
              'No class/section overlap',
              'Room capacity enforcement',
              'Required contact hours per subject/course',
              'Lab sessions scheduled as consecutive pairs (college)',
            ]} />
            <P>The following hard constraints are <em>configurable</em> in the Rules / Constraints step:</P>
            <Table
              head={['Parameter', 'Mode', 'Description']}
              rows={[
                [<Code>max_periods_per_day_per_teacher</Code>, 'School', 'Maximum periods a single teacher is scheduled on any given day.'],
                [<Code>max_periods_per_day_per_faculty</Code>, 'College', 'Maximum periods a single faculty member teaches per day.'],
                [<Code>lunch_after_period</Code>, 'School', 'Insert a lunch break after this period number.'],
                [<Code>lunch_period_index</Code>, 'College', 'Zero-based period index to reserve for lunch (excluded from scheduling).'],
              ]}
            />

            <SubHead>Soft constraints</SubHead>
            <P>Soft rules are added in the wizard's final step. Each rule takes a <Code>weight</Code> from 1 (mild preference) to 10 (strong preference). The solver minimises the total penalty cost.</P>
            <Table
              head={['Type', 'Target', 'When', 'Effect']}
              rows={[
                [<Code>avoid_day</Code>, 'Teacher / Faculty code', 'Day name (e.g. Friday)', 'Penalises scheduling this person on that day.'],
                [<Code>avoid_slot</Code>, 'Teacher / Faculty code', 'Period number (1-based)', 'Penalises scheduling this person in that period.'],
                [<Code>prefer_slot</Code>, 'Teacher / Faculty code', 'Period number (1-based)', 'Rewards scheduling this person in that period.'],
                [<Code>spread_subject</Code>, 'Subject / Course code', '—', 'Penalises placing multiple sessions of this subject on the same day.'],
                [<Code>group_on_day</Code>, 'Subject / Course code', '—', 'Rewards placing all sessions of this subject on the same day.'],
              ]}
            />

            <SubHead>Example payload</SubHead>
            <Pre>{`// Soft constraint: avoid scheduling Dr. Sharma on Fridays (weight 8)
{
  "type": "avoid_day",
  "target": "DR_SHARMA",
  "when": "Friday",
  "weight": 8
}

// Soft constraint: spread Physics across the week (weight 5)
{
  "type": "spread_subject",
  "target": "PHY301",
  "weight": 5
}`}</Pre>
          </section>

          <Divider />

          {/* ──────────────────── EXCEL IMPORT ──────────────────── */}
          <section id="excel-import" className="mb-16">
            <div className="text-[11px] mono mb-3 font-medium" style={{ color: 'var(--ink-3)' }}>GUIDES</div>
            <SectionHead id="excel-import">Excel Import</SectionHead>
            <P>Instead of manually entering every teacher, class, and subject in the wizard, you can upload an Excel file (<Code>.xlsx</Code>, <Code>.xls</Code>, or <Code>.csv</Code>) from the dashboard. The importer reads named sheets and maps the columns directly into the wizard state.</P>

            <SubHead>School template</SubHead>
            <Table
              head={['Sheet', 'Required columns']}
              rows={[
                [<Code>Teachers</Code>, <><Code>name</Code>, <Code>subjects_can_teach</Code> (comma-separated subject codes)</>],
                [<Code>Subjects</Code>, <><Code>code</Code>, <Code>name</Code>, <Code>periods_per_week</Code></>],
                [<Code>Classes</Code>, <><Code>name</Code>, <Code>size</Code>, <Code>subjects</Code> (comma-separated subject codes)</>],
                [<Code>Rooms</Code>, <><Code>name</Code>, <Code>capacity</Code></>],
              ]}
            />

            <SubHead>College template</SubHead>
            <Table
              head={['Sheet', 'Required columns']}
              rows={[
                [<Code>Departments</Code>, <><Code>code</Code>, <Code>name</Code></>],
                [<Code>Courses</Code>, <><Code>code</Code>, <Code>name</Code>, <Code>department</Code>, <Code>year</Code>, <Code>credits</Code>, <Code>lectures_per_week</Code>, <Code>has_lab</Code>, <Code>required_lecture_room_type</Code>, <Code>required_lab_room_type</Code>, <Code>enrolled_students</Code>, <Code>is_elective</Code></>],
                [<Code>Faculty</Code>, <><Code>code</Code>, <Code>name</Code>, <Code>department</Code>, <Code>courses_can_teach</Code> (comma-separated), <Code>max_hours_per_week</Code></>],
                [<Code>Rooms</Code>, <><Code>name</Code>, <Code>capacity</Code>, <Code>room_type</Code></>],
              ]}
            />

            <SubHead>Notes</SubHead>
            <UL items={[
              <>Boolean fields (<Code>has_lab</Code>, <Code>is_elective</Code>) accept: <Code>true</Code>, <Code>yes</Code>, <Code>y</Code>, or <Code>1</Code> (case-insensitive).</>,
              <><Code>has_lab</Code> defaults to <Code>true</Code> when <Code>credits === 4</Code> and the column is omitted.</>,
              <>Default <Code>required_lecture_room_type</Code> is <Code>classroom</Code>; default lab room type is <Code>computer_lab</Code>.</>,
              'Sheet names are case-sensitive — use exactly the names shown above.',
            ]} />
          </section>

          <Divider />

          {/* ──────────────────── API ──────────────────── */}
          <section id="api" className="mb-16">
            <div className="text-[11px] mono mb-3 font-medium" style={{ color: 'var(--ink-3)' }}>GUIDES</div>
            <SectionHead id="api">API Reference</SectionHead>
            <P>The TT-Scheduler backend exposes a REST API at <Code>https://tt-scheduler.onrender.com</Code>. Interactive Swagger docs are available at <a href="https://tt-scheduler.onrender.com/api/v1/docs" target="_blank" rel="noopener noreferrer" className="underline hover:opacity-70" style={{ color: 'var(--brand, #0369A1)' }}>/api/v1/docs</a>.</P>

            <SubHead>Authentication</SubHead>
            <P>All protected endpoints require a Supabase JWT in the <Code>Authorization</Code> header:</P>
            <Pre>{`Authorization: Bearer <supabase_access_token>`}</Pre>

            <SubHead>Endpoints</SubHead>
            <Table
              head={['Method', 'Path', 'Description']}
              rows={[
                [<Tag color="#16a34a">GET</Tag>, <Code>/health</Code>, 'Service health check. No auth required.'],
                [<Tag color="#16a34a">GET</Tag>, <Code>/</Code>, 'API metadata and docs link.'],
                [<Tag color="#2563eb">POST</Tag>, <Code>/api/v1/school/generate</Code>, 'Run the school timetable solver.'],
                [<Tag color="#16a34a">GET</Tag>, <Code>/api/v1/school/runs</Code>, 'List all school runs for the authenticated user.'],
                [<Tag color="#16a34a">GET</Tag>, <Code>/api/v1/school/runs/{'{id}'}</Code>, 'Get a school run summary.'],
                [<Tag color="#16a34a">GET</Tag>, <Code>/api/v1/school/runs/{'{id}'}/result</Code>, 'Get the full timetable assignments for a run.'],
                [<Tag color="#dc2626">DEL</Tag>, <Code>/api/v1/school/runs/{'{id}'}</Code>, 'Delete a school run.'],
                [<Tag color="#2563eb">POST</Tag>, <Code>/api/v1/school/export/excel</Code>, 'Export a school timetable as .xlsx.'],
                [<Tag color="#2563eb">POST</Tag>, <Code>/api/v1/college/generate</Code>, 'Run the college timetable solver.'],
                [<Tag color="#16a34a">GET</Tag>, <Code>/api/v1/college/runs</Code>, 'List all college runs.'],
                [<Tag color="#16a34a">GET</Tag>, <Code>/api/v1/college/runs/{'{id}'}/result</Code>, 'Get college timetable assignments.'],
                [<Tag color="#dc2626">DEL</Tag>, <Code>/api/v1/college/runs/{'{id}'}</Code>, 'Delete a college run.'],
                [<Tag color="#2563eb">POST</Tag>, <Code>/api/v1/college/export/excel</Code>, 'Export a college timetable as .xlsx.'],
                [<Tag color="#16a34a">GET</Tag>, <Code>/api/v1/runs/</Code>, 'List all runs (school + college) for the user.'],
                [<Tag color="#2563eb">POST</Tag>, <Code>/api/v1/timetable/ai-draft</Code>, 'Generate wizard pre-fill from a natural language description.'],
              ]}
            />

            <SubHead>Example: generate a school timetable</SubHead>
            <Pre>{`POST /api/v1/school/generate
Authorization: Bearer <token>
Content-Type: application/json

{
  "institution": { "name": "Delhi Public School", "type": "school" },
  "classes":     [{ "name": "10-A", "size": 40 }],
  "subjects":    [{ "code": "MATH", "name": "Mathematics", "periods_per_week": 6, "target_classes": ["10-A"] }],
  "teachers":    [{ "name": "Mr. Sharma", "subjects": ["MATH"] }],
  "rooms":       [{ "name": "Room 101", "capacity": 45 }],
  "schedule": {
    "working_days": ["Monday","Tuesday","Wednesday","Thursday","Friday"],
    "periods_per_day": 7,
    "period_duration_minutes": 45,
    "start_time": "09:00"
  },
  "constraints": { "max_periods_per_day_per_teacher": 4 },
  "soft_constraints": []
}`}</Pre>
          </section>

          <Divider />

          {/* ──────────────────── USER MANUAL ──────────────────── */}
          <section id="user-manual" className="mb-16">
            <div className="text-[11px] mono mb-3 font-medium" style={{ color: 'var(--ink-3)' }}>GUIDES</div>
            <SectionHead id="user-manual">User Manual</SectionHead>
            <P>The full TT-Scheduler User Manual is available as a PDF. It covers the complete workflow — from setting up your institution to generating, exporting, and managing timetables — with screenshots and step-by-step instructions.</P>

            <a
              href="/TT-Scheduler_User_Manual.pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-3 rounded-xl px-5 py-4 transition-opacity hover:opacity-80"
              style={{ background: 'var(--ink)', color: 'var(--paper)', textDecoration: 'none' }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="12" y1="18" x2="12" y2="12"/>
                <line x1="9" y1="15" x2="15" y2="15"/>
              </svg>
              <div>
                <div className="font-semibold text-sm">TT-Scheduler_User_Manual.pdf</div>
                <div className="text-[11px] mono mt-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>Opens in a new tab</div>
              </div>
            </a>
          </section>

          <Divider />

          {/* ──────────────────── CHANGELOG ──────────────────── */}
          <section id="changelog" className="mb-16">
            <div className="text-[11px] mono mb-3 font-medium" style={{ color: 'var(--ink-3)' }}>GUIDES</div>
            <SectionHead id="changelog">Changelog</SectionHead>
            <Table
              head={['Version', 'Date', 'What\'s new']}
              rows={[
                ['v1.0.0', 'Apr 2026', 'Initial release — school and college solver, 7-step wizard, Excel import/export, PDF export, run history, AI draft, soft constraints, user accounts via Supabase.'],
              ]}
            />
            <P>Future releases will be listed here. Watch the <a href="https://github.com/tt-scheduler" target="_blank" rel="noopener noreferrer" className="underline hover:opacity-70" style={{ color: 'var(--brand, #0369A1)' }}>GitHub repository</a> for updates.</P>
          </section>

          <Divider />

          {/* ──────────────────── ABOUT ──────────────────── */}
          <section id="about" className="mb-16">
            <div className="text-[11px] mono mb-3 font-medium" style={{ color: 'var(--ink-3)' }}>COMPANY</div>
            <SectionHead id="about">About</SectionHead>

            <div
              className="rounded-2xl p-8 mb-8"
              style={{ background: 'var(--ink)', color: 'var(--paper)' }}
            >
              <div className="flex items-center gap-3 mb-5">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.1)' }}>
                  <div className="grid grid-cols-2 gap-[2px]">
                    <div className="w-[4px] h-[4px] rounded-[1px] bg-white" />
                    <div className="w-[4px] h-[4px] rounded-[1px] bg-white opacity-40" />
                    <div className="w-[4px] h-[4px] rounded-[1px] bg-white opacity-40" />
                    <div className="w-[4px] h-[4px] rounded-[1px] bg-white" />
                  </div>
                </div>
                <span className="font-bold text-lg tracking-tight">TT-Scheduler</span>
              </div>
              <p className="text-sm leading-relaxed mb-4" style={{ color: 'rgba(255,255,255,0.7)' }}>
                TT-Scheduler is an open-source timetable generator built for schools and colleges. Manual scheduling is time-consuming, error-prone, and frustrating for administrators. We built TT-Scheduler to eliminate that entirely.
              </p>
              <p className="text-sm leading-relaxed mb-4" style={{ color: 'rgba(255,255,255,0.7)' }}>
                At its core is <strong style={{ color: 'white' }}>Google OR-Tools CP-SAT 9.10</strong> — a world-class constraint programming solver that models your institution's requirements as a mathematical problem and finds a provably valid solution in seconds. No heuristics, no manual tweaking, no clashes.
              </p>
              <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.7)' }}>
                The stack is <strong style={{ color: 'white' }}>FastAPI</strong> on the backend (deployed on Render), <strong style={{ color: 'white' }}>React + Vite</strong> on the frontend, and <strong style={{ color: 'white' }}>Supabase</strong> for authentication and database. The project is open-source and actively maintained.
              </p>
            </div>

            <SubHead>What we support</SubHead>
            <UL items={[
              'School timetabling: classes, subjects, teacher assignment, room allocation',
              'College timetabling: departments, courses, lecture + lab scheduling, faculty workload',
              'Soft preference rules — availability, subject spreading, day grouping',
              'Excel-based bulk import and multi-format export',
              'Full run history with re-openable results',
            ]} />
          </section>

          <Divider />

          {/* ──────────────────── CONTACT ──────────────────── */}
          <section id="contact" className="mb-16">
            <div className="text-[11px] mono mb-3 font-medium" style={{ color: 'var(--ink-3)' }}>COMPANY</div>
            <SectionHead id="contact">Contact</SectionHead>
            <P>Have a question, found a bug, or want to contribute? Reach out to either of the developers directly.</P>

            {[
              {
                name: 'Mukul Singh',
                email: 'mukulsinghbbsr@gmail.com',
                github: 'github.com/Mukul2956',
                githubHref: 'https://github.com/Mukul2956',
                linkedin: 'linkedin.com/in/mukul-singh29',
                linkedinHref: 'https://linkedin.com/in/mukul-singh29',
              },
              {
                name: 'Dibya Debashish Bhoi',
                email: 'ddev54081@gmail.com',
                github: 'github.com/debashish17',
                githubHref: 'https://github.com/debashish17',
                linkedin: 'linkedin.com/in/debashish1729',
                linkedinHref: 'https://linkedin.com/in/debashish1729',
              },
            ].map(dev => (
              <div
                key={dev.name}
                className="rounded-2xl p-6 mb-4"
                style={{ border: '1px solid var(--line)', background: 'var(--paper)' }}
              >
                <div className="font-bold text-base mb-4" style={{ color: 'var(--ink)' }}>{dev.name}</div>
                <div className="flex flex-col gap-2">
                  <ContactCard
                    icon={
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                        <polyline points="22,6 12,13 2,6"/>
                      </svg>
                    }
                    label="Email"
                    value={dev.email}
                    href={`mailto:${dev.email}`}
                  />
                  <ContactCard
                    icon={
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                        <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
                      </svg>
                    }
                    label="GitHub"
                    value={dev.github}
                    href={dev.githubHref}
                  />
                  <ContactCard
                    icon={
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                      </svg>
                    }
                    label="LinkedIn"
                    value={dev.linkedin}
                    href={dev.linkedinHref}
                  />
                </div>
              </div>
            ))}
          </section>

        </main>
      </div>
    </div>
  );
};

export default DocsPage;
