import React, { useState } from 'react';
import { WizardShell } from '../WizardShell';
import { useWizardStore } from '../wizardStore';
import { useOnboardingStore } from '../../../store';
import { Icon } from '../../ui/primitives';

const ALL_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

interface TimeData {
  workingDays: string[];
  startTime: string;
  periodDuration: number;
  periodsPerDay: number;
  lunchAfterPeriod: number;
  lunchDuration: number;
  haslunch: boolean;
}

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <label className="block">
    <span className="block text-[12px] font-medium mb-1.5" style={{ color: 'var(--ink-2)' }}>{label}</span>
    {children}
  </label>
);

const TInput: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = (props) => (
  <input {...props} className="w-full px-3 py-2 rounded-md text-sm outline-none"
    style={{ background: 'var(--paper)', border: '1px solid var(--line)', color: 'var(--ink)' }}
    onFocus={e => (e.target.style.borderColor = 'var(--ink)')}
    onBlur={e => (e.target.style.borderColor = 'var(--line)')} />
);

const Step5Schedule: React.FC = () => {
  const { workflow } = useWizardStore();
  const { timeData, setTimeData } = useOnboardingStore();
  const isSchool = workflow === 'school';

  const [data, setData] = useState<TimeData>(() => {
    // If no data exists, use workflow-appropriate defaults and persist them immediately
    if (!timeData) {
      const defaults: TimeData = {
        workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        startTime: isSchool ? '08:30' : '09:00',
        periodDuration: isSchool ? 45 : 50,
        periodsPerDay: isSchool ? 8 : 7,
        lunchAfterPeriod: 4,
        lunchDuration: isSchool ? 30 : 55,
        haslunch: true,
      };
      setTimeout(() => setTimeData(defaults), 0);
      return defaults;
    }
    
    // Check if existing data matches current workflow by examining typical values
    const isDataSchool = timeData.startTime === '08:30' || timeData.periodDuration === 45;
    const workflowMismatch = isSchool !== isDataSchool;
    
    // If workflow changed, reset to appropriate defaults
    if (workflowMismatch) {
      return {
        workingDays: timeData.workingDays ?? ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        startTime: isSchool ? '08:30' : '09:00',
        periodDuration: isSchool ? 45 : 50,
        periodsPerDay: isSchool ? 8 : 7,
        lunchAfterPeriod: timeData.lunchAfterPeriod ?? 4,
        lunchDuration: isSchool ? 30 : 55,
        haslunch: timeData.haslunch ?? true,
      };
    }
    
    // Data matches workflow, use it
    return timeData;
  });

  const save = (patch: Partial<TimeData>) => {
    const next = { ...data, ...patch };
    setData(next);
    setTimeData(next);
  };

  const toggleDay = (day: string) => {
    const days = data.workingDays.includes(day)
      ? data.workingDays.filter(d => d !== day)
      : [...data.workingDays, day];
    save({ workingDays: days });
  };

  // Compute preview slots
  const addMins = (t: string, m: number) => {
    const [h, min] = t.split(':').map(Number);
    const total = h * 60 + min + m;
    return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
  };

  const slots: { label: string; start: string; end: string; isBreak: boolean }[] = [];
  let cursor = data.startTime;
  for (let p = 1; p <= data.periodsPerDay; p++) {
    const end = addMins(cursor, data.periodDuration);
    slots.push({ label: `P${p}`, start: cursor, end, isBreak: false });
    if (data.haslunch && p === data.lunchAfterPeriod) {
      const lEnd = addMins(end, data.lunchDuration);
      slots.push({ label: 'Lunch', start: end, end: lEnd, isBreak: true });
      cursor = lEnd;
    } else {
      cursor = addMins(end, 5); // 5-min passing time
    }
  }

  return (
    <WizardShell step={5} title="Schedule">
      <div className="space-y-6">
        <p className="text-sm" style={{ color: 'var(--ink-3)' }}>
          Define working days, period timing and break windows. The solver uses this to build the time grid.
        </p>

        {/* Working days */}
        <div>
          <span className="block text-[12px] font-medium mb-2" style={{ color: 'var(--ink-2)' }}>Working days</span>
          <div className="flex flex-wrap gap-2">
            {ALL_DAYS.map(day => {
              const on = data.workingDays.includes(day);
              return (
                <button key={day} onClick={() => toggleDay(day)}
                  className="px-3 py-1.5 rounded-full text-sm font-medium transition-colors"
                  style={{
                    background: on ? 'var(--ink)' : 'var(--paper)',
                    color: on ? 'var(--paper)' : 'var(--ink-2)',
                    border: `1px solid ${on ? 'var(--ink)' : 'var(--line)'}`,
                  }}>
                  {day.slice(0, 3)}
                </button>
              );
            })}
          </div>
        </div>

        {/* Time fields */}
        <div className="grid grid-cols-2 gap-4">
          <Field label="Start time">
            <TInput type="time" value={data.startTime}
              onChange={e => save({ startTime: e.target.value })} />
          </Field>
          <Field label={isSchool ? 'Periods per day' : 'Slots per day'}>
            <TInput type="number" min={1} max={12} value={data.periodsPerDay}
              onChange={e => save({ periodsPerDay: parseInt(e.target.value) || 1 })} />
          </Field>
          <Field label="Period length (min)">
            <TInput type="number" min={20} max={120} value={data.periodDuration}
              onChange={e => save({ periodDuration: parseInt(e.target.value) || 45 })} />
          </Field>
          <Field label="Lunch after period #">
            <TInput type="number" min={1} max={data.periodsPerDay}
              value={data.lunchAfterPeriod}
              onChange={e => save({ lunchAfterPeriod: parseInt(e.target.value) || 4 })} />
          </Field>
          <Field label="Lunch duration (min)">
            <TInput type="number" min={10} max={90} value={data.lunchDuration}
              onChange={e => save({ lunchDuration: parseInt(e.target.value) || 30 })} />
          </Field>
        </div>

        {/* Live preview */}
        <div className="edge rounded-lg overflow-hidden" style={{ background: 'var(--paper)' }}>
          <div className="px-4 py-2.5" style={{ background: 'var(--paper-2)', borderBottom: '1px solid var(--line)' }}>
            <span className="eyebrow text-[10px]" style={{ color: 'var(--ink-3)' }}>Computed time grid preview</span>
          </div>
          <div className="p-4 flex flex-col gap-1 max-h-60 overflow-y-auto">
            {slots.map((s, i) => (
              <div key={i} className="flex items-center gap-3 text-[12px] rounded-md px-3 py-1.5"
                style={{ background: s.isBreak ? 'var(--warn)' + '14' : 'var(--brand-soft)', color: s.isBreak ? 'var(--warn)' : 'var(--brand)' }}>
                <span className="mono font-semibold w-12">{s.label}</span>
                <span className="mono">{s.start} – {s.end}</span>
                {s.isBreak && <span className="ml-auto text-[10px] opacity-70">break</span>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </WizardShell>
  );
};

export default Step5Schedule;
