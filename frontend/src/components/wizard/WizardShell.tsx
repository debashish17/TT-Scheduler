/**
 * WizardShell — shared layout for all 7 wizard step pages.
 * Renders the top bar, progress stepper, two-column layout
 * (main content + DraftPanel sidebar), and back/continue nav.
 */
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Btn, Eyebrow, Icon, TopBar } from '../ui/primitives';
import { useWizardStore } from './wizardStore';

const STEPS = [
  { label: 'Institution', path: '/wizard/step/1' },
  { label: 'Classes',     path: '/wizard/step/2' },
  { label: 'Subjects',    path: '/wizard/step/3' },
  { label: 'Teachers',    path: '/wizard/step/4' },
  { label: 'Schedule',    path: '/wizard/step/5' },
  { label: 'Rooms',       path: '/wizard/step/6' },
  { label: 'Rules',       path: '/wizard/step/7' },
];

const COLLEGE_LABELS = ['Institution', 'Courses', 'Faculty', 'Schedule', 'Rooms', 'Constraints', 'Generate'];

const DAYS  = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
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

export const DraftPanel: React.FC<{ currentStep: number; workflow?: string }> = ({ currentStep, workflow }) => {
  const step0 = currentStep - 1; // 0-indexed for progress
  const pct = step0 / 6;
  const sidebarLabels = workflow === 'college' ? COLLEGE_LABELS : STEPS.map(s => s.label);
  return (
    <div className="sticky top-20 space-y-3">
      <div className="edge rounded-xl p-4" style={{ background: 'var(--paper)' }}>
        <div className="flex items-center justify-between mb-3">
          <Eyebrow>Live draft preview</Eyebrow>
          <span className="mono text-[11px]" style={{ color: 'var(--ink-3)' }}>
            {currentStep === 7 ? 'ready' : 'draft'}
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
                    <div key={d + s}
                      className="rounded-[3px] h-[20px] flex items-center justify-center text-[8px] font-semibold"
                      style={{ background: code ? COLORS[code] : 'var(--paper-2)', border: code ? 'none' : '1px solid var(--line)', color: code ? 'white' : 'var(--ink-3)' }}>
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
            { l: 'step',    v: `${currentStep}/7` },
          ].map((s, i) => (
            <div key={s.l} className="py-2" style={{ borderRight: i < 2 ? '1px solid var(--line)' : undefined }}>
              <div style={{ color: 'var(--ink-3)' }}>{s.l}</div>
              <div className="text-sm font-semibold mt-0.5" style={{ color: (s as any).color }}>{s.v}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="edge rounded-xl p-4" style={{ background: 'var(--paper)' }}>
        <Eyebrow className="block mb-3">Setup progress</Eyebrow>
        <div className="space-y-2">
          {sidebarLabels.map((label, i) => (
            <div key={label} className="flex items-center gap-2">
              <div
                className="w-4 h-4 rounded-full flex items-center justify-center shrink-0 text-[9px]"
                style={{
                  background: i < step0 ? 'var(--brand)' : i === step0 ? 'var(--ink)' : 'var(--paper-2)',
                  color: i <= step0 ? 'white' : 'var(--ink-3)',
                  border: i > step0 ? '1px solid var(--line)' : 'none',
                }}>
                {i < step0 ? '✓' : i + 1}
              </div>
              <span className="text-[12px]" style={{ color: i === step0 ? 'var(--ink)' : i < step0 ? 'var(--ink-2)' : 'var(--ink-3)', fontWeight: i === step0 ? 600 : 400 }}>
                {label}
              </span>
              {i === step0 && <span className="ml-auto mono text-[10px]" style={{ color: 'var(--brand)' }}>active</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

interface WizardShellProps {
  step: number; // 1–7
  title: string;
  children: React.ReactNode;
}

export const WizardShell: React.FC<WizardShellProps> = ({ step, title, children }) => {
  const navigate = useNavigate();
  const { workflow } = useWizardStore();

  // Redirect to workflow selector if no workflow chosen
  useEffect(() => {
    if (!workflow) navigate('/wizard', { replace: true });
  }, [workflow, navigate]);

  const labels = workflow === 'school' ? STEPS.map(s => s.label) : COLLEGE_LABELS;
  const TOTAL = 7;
  const prevPath = step > 1 ? `/wizard/step/${step - 1}` : null;
  const nextPath = step < TOTAL ? `/wizard/step/${step + 1}` : null;
  const nextLabel = nextPath ? labels[step] : null;

  return (
    <div className="screen-enter">
      <TopBar
        title={`New run — ${workflow === 'school' ? 'School' : 'College'}`}
        crumbs={['Dashboard']}
        actions={
          <>
            <Btn variant="ghost" size="sm" onClick={() => navigate('/dashboard')}>
              Save &amp; exit
            </Btn>
            <span className="mono text-[11px]" style={{ color: 'var(--ink-3)' }}>autosaved</span>
          </>
        }
      />

      <div className="px-8 pt-6 pb-16 max-w-[1400px] mx-auto">
        {/* Progress bar */}
        <div className="mb-8">
          <div className="flex items-end justify-between mb-3">
            {labels.map((label, i) => (
              <div key={label} className="flex flex-col items-center" style={{ flex: 1 }}>
                <button
                  onClick={() => navigate(`/wizard/step/${i + 1}`)}
                  className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold border transition-all mb-1"
                  style={{
                    background: i < step - 1 ? 'var(--brand)' : i === step - 1 ? 'var(--ink)' : 'var(--paper)',
                    color: i < step - 1 ? 'white' : i === step - 1 ? 'var(--paper)' : 'var(--ink-3)',
                    borderColor: i < step - 1 ? 'var(--brand)' : i === step - 1 ? 'var(--ink)' : 'var(--line)',
                  }}>
                  {i < step - 1 ? <Icon name="check" size={12} /> : i + 1}
                </button>
                <span className="text-[10px] hidden md:block"
                  style={{ color: i === step - 1 ? 'var(--ink)' : 'var(--ink-3)', fontWeight: i === step - 1 ? 600 : 400 }}>
                  {label}
                </span>
              </div>
            ))}
          </div>
          <div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--line)' }}>
            <div className="h-full rounded-full transition-all duration-300"
              style={{ width: `${((step - 1) / (TOTAL - 1)) * 100}%`, background: 'var(--brand)' }} />
          </div>
        </div>

        {/* Two-column */}
        <div className="grid grid-cols-12 gap-8">
          <div className="col-span-12 lg:col-span-8">
            <div className="edge rounded-xl p-8" style={{ background: 'var(--paper)' }}>
              <div className="mb-6 pb-5" style={{ borderBottom: '1px solid var(--line)' }}>
                <Eyebrow>Step {step} of {TOTAL}</Eyebrow>
                <h2 className="serif text-[40px] tracking-tight leading-tight mt-2">{title}</h2>
              </div>

              {children}

              <div className="mt-8 pt-6 flex items-center justify-between" style={{ borderTop: '1px solid var(--line)' }}>
                <Btn variant="ghost" size="md" disabled={!prevPath} onClick={() => prevPath && navigate(prevPath)}>
                  ← Back
                </Btn>
                {nextPath && (
                  <Btn variant="primary" size="md" onClick={() => navigate(nextPath)}>
                    Continue to {nextLabel} <Icon name="arrow" size={14} />
                  </Btn>
                )}
              </div>
            </div>
          </div>
          <div className="col-span-12 lg:col-span-4">
            <DraftPanel currentStep={step} workflow={workflow ?? undefined} />
          </div>
        </div>
      </div>
    </div>
  );
};
