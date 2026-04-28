import React, { useState } from 'react';
import { WizardShell } from '../WizardShell';
import { useWizardStore } from '../wizardStore';
import { useOnboardingStore } from '../../../store';

/* ── Mini primitives ── */
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

/* ── Types ── */
interface ScheduleData {
  workingDays: string[];
  periodsPerDay: number;
  periodDurationMinutes: number;
  startTime: string;
  lunchPeriodIndex: number;
}

const ALL_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const DEFAULT_SCHEDULE: ScheduleData = {
  workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  periodsPerDay: 8,
  periodDurationMinutes: 60,
  startTime: '08:00',
  lunchPeriodIndex: 4,
};

/* ── Helper: add minutes to HH:MM ── */
const addMins = (t: string, m: number): string => {
  const [h, min] = t.split(':').map(Number);
  const total = h * 60 + min + m;
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
};

/* ── Component ── */
const CollegeStep5Schedule: React.FC = () => {
  const { workflow } = useWizardStore();
  void workflow; // used only to satisfy import; college wizard always uses this step
  const { collegeSchedule, setCollegeSchedule } = useOnboardingStore();

  const [data, setData] = useState<ScheduleData>(() => {
    if (!collegeSchedule) {
      setTimeout(() => setCollegeSchedule(DEFAULT_SCHEDULE), 0);
      return DEFAULT_SCHEDULE;
    }
    return { ...DEFAULT_SCHEDULE, ...collegeSchedule };
  });

  const save = (patch: Partial<ScheduleData>) => {
    const next = { ...data, ...patch };
    setData(next);
    setCollegeSchedule(next);
  };

  const toggleDay = (day: string) => {
    const days = data.workingDays.includes(day)
      ? data.workingDays.filter(d => d !== day)
      : [...data.workingDays, day];
    save({ workingDays: days });
  };

  /* ── Compute lunch period options ── */
  const lunchOptions: { value: number; label: string }[] = [];
  let cursor = data.startTime;
  for (let p = 1; p <= data.periodsPerDay; p++) {
    const end = addMins(cursor, data.periodDurationMinutes);
    lunchOptions.push({ value: p - 1, label: `Period ${p} (${cursor} – ${end})` });
    cursor = end;
  }

  return (
    <WizardShell step={4} title="Schedule">
      <div className="space-y-6">
        <p className="text-sm" style={{ color: 'var(--ink-3)' }}>
          Define the weekly schedule structure. The solver uses this to build the time grid.
        </p>

        {/* Working days */}
        <div>
          <span className="block text-[12px] font-medium mb-2" style={{ color: 'var(--ink-2)' }}>Working days</span>
          <div className="flex flex-wrap gap-2">
            {ALL_DAYS.map(day => {
              const on = data.workingDays.includes(day);
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleDay(day)}
                  className="px-3 py-1.5 rounded-full text-sm font-medium transition-colors"
                  style={{
                    background: on ? 'var(--ink)' : 'var(--paper)',
                    color: on ? 'var(--paper)' : 'var(--ink-2)',
                    border: `1px solid ${on ? 'var(--ink)' : 'var(--line)'}`,
                    cursor: 'pointer',
                  }}
                >
                  {day.slice(0, 3)}
                </button>
              );
            })}
          </div>
        </div>

        {/* Time fields */}
        <div className="grid grid-cols-2 gap-4">
          <Field label="Start time" hint="HH:MM">
            <TInput
              type="time"
              value={data.startTime}
              onChange={e => save({ startTime: e.target.value })}
            />
          </Field>

          <Field label="Period duration" hint="minutes">
            <TInput
              type="number"
              min={30}
              max={120}
              value={data.periodDurationMinutes}
              onChange={e => save({ periodDurationMinutes: Math.min(120, Math.max(30, parseInt(e.target.value) || 60)) })}
            />
          </Field>

          <Field label="Periods per day">
            <TInput
              type="number"
              min={1}
              max={15}
              value={data.periodsPerDay}
              onChange={e => {
                const n = Math.min(15, Math.max(1, parseInt(e.target.value) || 1));
                // Clamp lunchPeriodIndex if it exceeds new period count
                const lunch = data.lunchPeriodIndex >= n ? n - 1 : data.lunchPeriodIndex;
                save({ periodsPerDay: n, lunchPeriodIndex: lunch });
              }}
            />
          </Field>

          <div className="col-span-2">
            <Field label="Lunch period">
              <TSelect
                value={data.lunchPeriodIndex}
                onChange={e => {
                  const val = parseInt(e.target.value);
                  save({ lunchPeriodIndex: val });
                }}
              >
                <option value={-1}>None (no lunch block)</option>
                {lunchOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </TSelect>
              <p className="mt-1.5 text-[11px]" style={{ color: 'var(--ink-3)' }}>
                Selected period will be blocked for all sections — no classes scheduled then.
              </p>
            </Field>
          </div>
        </div>

        {/* Live preview */}
        <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--line)' }}>
          <div className="px-4 py-2.5" style={{ background: 'var(--paper-2)', borderBottom: '1px solid var(--line)' }}>
            <span className="text-[10px] font-semibold tracking-widest uppercase" style={{ color: 'var(--ink-3)' }}>
              Time grid preview
            </span>
          </div>
          <div className="p-4 flex flex-col gap-1 max-h-60 overflow-y-auto">
            {(() => {
              const slots: { label: string; start: string; end: string; isLunch: boolean }[] = [];
              let c = data.startTime;
              for (let p = 1; p <= data.periodsPerDay; p++) {
                const end = addMins(c, data.periodDurationMinutes);
                const isLunch = data.lunchPeriodIndex >= 0 && p - 1 === data.lunchPeriodIndex;
                slots.push({ label: `P${p}`, start: c, end, isLunch });
                c = end;
              }
              return slots.map((s, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 text-[12px] rounded-md px-3 py-1.5"
                  style={{
                    background: s.isLunch ? 'color-mix(in srgb, var(--warn) 10%, transparent)' : 'color-mix(in srgb, var(--brand) 8%, transparent)',
                    color: s.isLunch ? 'var(--warn)' : 'var(--brand)',
                  }}
                >
                  <span className="mono font-semibold w-8">{s.label}</span>
                  <span className="mono">{s.start} – {s.end}</span>
                  {s.isLunch && (
                    <span className="ml-auto text-[10px] opacity-70">lunch</span>
                  )}
                </div>
              ));
            })()}
          </div>
        </div>
      </div>
    </WizardShell>
  );
};

export default CollegeStep5Schedule;
