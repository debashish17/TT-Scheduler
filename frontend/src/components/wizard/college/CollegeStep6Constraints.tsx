import React, { useState } from 'react';
import { WizardShell } from '../WizardShell';
import { useWizardStore } from '../wizardStore';
import { useOnboardingStore } from '../../../store';
import { Chip, Icon } from '../../ui/primitives';

const CONSTRAINTS = [
  { id: 1, name: 'FacultyOverlap',  rule: 'No faculty teaches two sections at the same time' },
  { id: 2, name: 'RoomOverlap',     rule: 'No room hosts two sections simultaneously' },
  { id: 3, name: 'SectionOverlap',  rule: 'No section attends two courses simultaneously' },
  { id: 4, name: 'RoomCapacity',    rule: 'Room capacity ≥ section enrollment' },
  { id: 5, name: 'FacultyWorkload', rule: 'Faculty hours stay within weekly contract limits' },
  { id: 6, name: 'RoomType',        rule: 'Rooms match course requirements (lab, lecture hall…)' },
  { id: 7, name: 'LabConsecutive',  rule: 'Lab sessions are always scheduled back-to-back' },
  { id: 8, name: 'MaxConsecutive',  rule: 'Avoid scheduling faculty back-to-back beyond the limit' },
];

interface ConstraintsData {
  maxConsecutivePeriods: number;
  maxPeriodsPerDayPerFaculty: number;
}

const DEFAULT: ConstraintsData = { maxConsecutivePeriods: 3, maxPeriodsPerDayPerFaculty: 6 };

const CollegeStep6Constraints: React.FC = () => {
  const { workflow } = useWizardStore();
  void workflow;
  const {
    collegeConstraints, setCollegeConstraints,
    softConstraintsCollege, setSoftConstraintsCollege,
    collegeFaculty, courseOfferings,
  } = useOnboardingStore();

  const [active, setActive] = useState<Set<number>>(
    () => new Set(CONSTRAINTS.map(c => c.id))
  );

  const [data, setData] = useState<ConstraintsData>(() => {
    if (!collegeConstraints) {
      setTimeout(() => setCollegeConstraints(DEFAULT), 0);
      return DEFAULT;
    }
    return { ...DEFAULT, ...collegeConstraints };
  });

  const toggle = (id: number) => {
    const n = new Set(active);
    n.has(id) ? n.delete(id) : n.add(id);
    setActive(n);
  };

  const save = (patch: Partial<ConstraintsData>) => {
    const next = { ...data, ...patch };
    setData(next);
    setCollegeConstraints(next);
  };

  type SoftConstraint = { type: string; target: string; when: string | null; weight: number };
  const RULE_TYPES_COLLEGE = [
    { value: 'avoid_day',      label: 'Avoid day',
      help: 'Try not to schedule the chosen faculty on the chosen day.' },
    { value: 'avoid_slot',     label: 'Avoid period',
      help: 'Try not to schedule the chosen faculty at the chosen period.' },
    { value: 'prefer_slot',    label: 'Prefer period',
      help: 'Reward scheduling the chosen faculty at the chosen period.' },
    { value: 'spread_subject', label: 'Spread course',
      help: 'Distribute the chosen course across as many days as possible.' },
    { value: 'group_on_day',   label: 'Group on day',
      help: 'Cluster the chosen course onto the same day if it can.' },
  ];
  const isCourseRule = (t: string) => t === 'spread_subject' || t === 'group_on_day';
  const [showAddPref, setShowAddPref] = useState(false);
  const [showRuleHelp, setShowRuleHelp] = useState(false);
  const [prefType, setPrefType]       = useState('avoid_day');
  const [prefTarget, setPrefTarget]   = useState('');
  const [prefWhen, setPrefWhen]       = useState('');
  const [prefWeight, setPrefWeight]   = useState(3);
  const [softPrefs, setSoftPrefs]     = useState<SoftConstraint[]>(softConstraintsCollege ?? []);

  return (
    <>
    <WizardShell step={6} title="Constraints">
      <div className="space-y-6">
        <p className="text-sm" style={{ color: 'var(--ink-3)' }}>
          Toggle constraints on/off. All are enabled by default.
        </p>

        {/* Constraint grid */}
        <div>
          <div className="flex items-baseline justify-between mb-3">
            <h3 className="font-semibold">Hard constraints</h3>
            <span className="mono text-[11px]" style={{ color: 'var(--ink-3)' }}>
              {active.size}/{CONSTRAINTS.length} active
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {CONSTRAINTS.map(c => {
              const on = active.has(c.id);
              return (
                <button key={c.id} onClick={() => toggle(c.id)}
                  className="flex items-start gap-3 p-3 rounded-lg text-left transition-colors"
                  style={{
                    background: on ? 'var(--ink)' : 'var(--paper)',
                    border: `1px solid ${on ? 'var(--ink)' : 'var(--line)'}`,
                    color: on ? 'var(--paper)' : 'var(--ink)',
                  }}>
                  <div className="w-8 h-8 rounded-md flex items-center justify-center shrink-0"
                    style={{ background: on ? 'rgba(255,255,255,0.1)' : 'var(--paper-2)' }}>
                    <span className="mono text-[10px]">C{String(c.id).padStart(2, '0')}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-[13px]">{c.name}</div>
                    <div className="text-[12px]" style={{ opacity: on ? 0.65 : 1, color: on ? 'inherit' : 'var(--ink-3)' }}>
                      {c.rule}
                    </div>
                  </div>
                  <div className="ml-auto w-8 h-4 rounded-full relative mt-1 shrink-0"
                    style={{ background: on ? 'var(--brand)' : 'var(--line)' }}>
                    <span className="absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all"
                      style={{ left: on ? 18 : 2 }} />
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Numeric limits */}
        {/* "Max consecutive periods / faculty" was removed because the college
            solver hard-codes a same-day-3+ penalty rather than reading this
            value — see audit. Re-add when the solver uses `max_consec` in a
            window-sliding constraint. */}
        <div className="grid grid-cols-2 gap-3">
          {[
            {
              label: 'Max periods / faculty / day',
              value: data.maxPeriodsPerDayPerFaculty, min: 1, max: 12,
              onChange: (v: number) => save({ maxPeriodsPerDayPerFaculty: v }),
            },
          ].map(({ label, value, min, max, onChange }) => (
            <div key={label} className="edge rounded-lg p-3" style={{ background: 'var(--paper)' }}>
              <div className="text-[11px] mono mb-2" style={{ color: 'var(--ink-3)' }}>{label}</div>
              <div className="flex items-center gap-2">
                <button onClick={() => onChange(Math.max(min, value - 1))}
                  className="w-7 h-7 rounded flex items-center justify-center text-sm"
                  style={{ background: 'var(--paper-2)', color: 'var(--ink)' }}>−</button>
                <span className="mono font-semibold text-sm w-6 text-center">{value}</span>
                <button onClick={() => onChange(Math.min(max, value + 1))}
                  className="w-7 h-7 rounded flex items-center justify-center text-sm"
                  style={{ background: 'var(--paper-2)', color: 'var(--ink)' }}>+</button>
              </div>
            </div>
          ))}
        </div>

        {/* Soft preferences */}
        <div className="pt-4" style={{ borderTop: '1px solid var(--line)' }}>
          <h3 className="font-semibold mb-3">Soft preferences</h3>
          <div className="space-y-2">
            {softPrefs.map((p, i) => (
              <div key={i} className="flex items-center gap-3 edge rounded-lg px-3 py-2.5"
                style={{ background: 'var(--paper)' }}>
                <span className="text-sm flex-1">
                  <span className="mono text-[11px] mr-2" style={{ color: 'var(--ink-3)' }}>{p.type.replace(/_/g, ' ')}</span>
                  {p.target}{p.when ? ` — ${p.when}` : ''}
                </span>
                <Chip tone="ok">weight +{p.weight}</Chip>
                <button onClick={() => {
                  const next = softPrefs.filter((_, j) => j !== i);
                  setSoftPrefs(next);
                  setSoftConstraintsCollege(next);
                }} style={{ color: 'var(--ink-3)' }}><Icon name="x" size={13} /></button>
              </div>
            ))}
            {softPrefs.length === 0 && (
              <p className="text-sm" style={{ color: 'var(--ink-3)' }}>No preferences added yet.</p>
            )}
            <button className="flex items-center gap-2 text-sm" style={{ color: 'var(--ink-3)' }}
              onClick={() => { setShowRuleHelp(false); setShowAddPref(true); }}>
              <Icon name="plus" size={13} /> Add preference
            </button>
          </div>
        </div>
      </div>
    </WizardShell>

    {/* Add Soft Preference Modal */}
    {showAddPref && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 backdrop-blur-sm" style={{ background: 'rgba(0,0,0,0.35)' }}
          onClick={() => setShowAddPref(false)} />
        <div className="relative w-full max-w-sm rounded-2xl edge overflow-hidden"
          style={{ background: 'var(--paper)' }}>
          <div className="px-6 pt-5 pb-4" style={{ borderBottom: '1px solid var(--line)' }}>
            <h2 className="font-semibold text-[15px]">Add soft preference</h2>
          </div>
          <div className="px-6 py-4 space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[12px] font-medium" style={{ color: 'var(--ink-2)' }}>Rule type</span>
                <button
                  type="button"
                  onClick={() => setShowRuleHelp(v => !v)}
                  className="flex items-center justify-center w-5 h-5 rounded-full text-[11px] font-semibold transition-colors"
                  style={{
                    background: showRuleHelp ? 'var(--ink)' : 'var(--paper-2)',
                    color: showRuleHelp ? 'var(--paper)' : 'var(--ink-3)',
                  }}
                  aria-label="What do these rules do?"
                  title="What do these rules do?"
                >i</button>
              </div>
              <select value={prefType} onChange={e => {
                  setPrefType(e.target.value);
                  setPrefTarget('');   // target depends on type, clear it
                  setPrefWhen('');
                }}
                className="w-full px-3 py-2 rounded-md text-sm outline-none"
                style={{ background: 'var(--paper)', border: '1px solid var(--line)', color: 'var(--ink)' }}>
                {RULE_TYPES_COLLEGE.map(rt => <option key={rt.value} value={rt.value}>{rt.label}</option>)}
              </select>
              {showRuleHelp && (
                <div className="mt-2 rounded-md px-3 py-2.5 text-[11px] space-y-1.5"
                  style={{ background: 'var(--paper-2)', color: 'var(--ink-2)' }}>
                  {RULE_TYPES_COLLEGE.map(rt => (
                    <div key={rt.value}>
                      <span className="font-semibold mono mr-1.5">{rt.label}:</span>
                      <span>{rt.help}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <span className="text-[12px] font-medium block mb-1" style={{ color: 'var(--ink-2)' }}>
                {isCourseRule(prefType) ? 'Course' : 'Faculty'}
              </span>
              {isCourseRule(prefType) ? (
                (courseOfferings?.length ?? 0) === 0 ? (
                  <div className="px-3 py-2 rounded-md text-sm"
                    style={{ background: 'var(--paper-2)', color: 'var(--ink-3)' }}>
                    No courses added yet — go to step 2 first.
                  </div>
                ) : (
                  <select value={prefTarget} onChange={e => setPrefTarget(e.target.value)}
                    className="w-full px-3 py-2 rounded-md text-sm outline-none"
                    style={{ background: 'var(--paper)', border: '1px solid var(--line)', color: 'var(--ink)' }}>
                    <option value="">— select course —</option>
                    {(courseOfferings || []).filter((c: any) => c?.code).map((c: any) => (
                      <option key={c.code} value={c.code}>
                        {c.code}{c.name ? ` — ${c.name}` : ''}
                      </option>
                    ))}
                  </select>
                )
              ) : (
                (collegeFaculty?.length ?? 0) === 0 ? (
                  <div className="px-3 py-2 rounded-md text-sm"
                    style={{ background: 'var(--paper-2)', color: 'var(--ink-3)' }}>
                    No faculty added yet — go to step 3 first.
                  </div>
                ) : (
                  <select value={prefTarget} onChange={e => setPrefTarget(e.target.value)}
                    className="w-full px-3 py-2 rounded-md text-sm outline-none"
                    style={{ background: 'var(--paper)', border: '1px solid var(--line)', color: 'var(--ink)' }}>
                    <option value="">— select faculty —</option>
                    {(collegeFaculty || []).filter((f: any) => f?.code).map((f: any) => (
                      <option key={f.code} value={f.code}>
                        {f.code}{f.name ? ` — ${f.name}` : ''}
                      </option>
                    ))}
                  </select>
                )
              )}
            </div>
            {prefType === 'avoid_day' && (
              <div>
                <span className="text-[12px] font-medium block mb-1" style={{ color: 'var(--ink-2)' }}>Day</span>
                <select value={prefWhen} onChange={e => setPrefWhen(e.target.value)}
                  className="w-full px-3 py-2 rounded-md text-sm outline-none"
                  style={{ background: 'var(--paper)', border: '1px solid var(--line)', color: 'var(--ink)' }}>
                  <option value="">-- select day --</option>
                  {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(d =>
                    <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            )}
            {(prefType === 'avoid_slot' || prefType === 'prefer_slot') && (
              <div>
                <span className="text-[12px] font-medium block mb-1" style={{ color: 'var(--ink-2)' }}>Period number</span>
                <input type="number" min={1} max={15} value={prefWhen}
                  onChange={e => setPrefWhen(e.target.value)}
                  className="w-full px-3 py-2 rounded-md text-sm outline-none"
                  style={{ background: 'var(--paper)', border: '1px solid var(--line)', color: 'var(--ink)' }} />
              </div>
            )}
            <div>
              <span className="text-[12px] font-medium block mb-1" style={{ color: 'var(--ink-2)' }}>Weight (1–10)</span>
              <div className="flex items-center gap-2">
                <button onClick={() => setPrefWeight(w => Math.max(1, w - 1))}
                  className="w-7 h-7 rounded flex items-center justify-center text-sm"
                  style={{ background: 'var(--paper-2)', color: 'var(--ink)' }}>−</button>
                <span className="mono font-semibold text-sm w-6 text-center">{prefWeight}</span>
                <button onClick={() => setPrefWeight(w => Math.min(10, w + 1))}
                  className="w-7 h-7 rounded flex items-center justify-center text-sm"
                  style={{ background: 'var(--paper-2)', color: 'var(--ink)' }}>+</button>
              </div>
            </div>
          </div>
          <div className="px-6 py-4 flex gap-3" style={{ borderTop: '1px solid var(--line)' }}>
            <button className="flex-1 px-4 py-2 rounded-lg text-sm"
              style={{ background: 'var(--paper-2)', color: 'var(--ink)' }}
              onClick={() => setShowAddPref(false)}>Cancel</button>
            <button className="flex-1 px-4 py-2 rounded-lg text-sm font-medium"
              style={{ background: 'var(--ink)', color: 'var(--paper)' }}
              onClick={() => {
                if (!prefTarget.trim()) return;
                const sc: SoftConstraint = {
                  type: prefType,
                  target: prefTarget.trim(),
                  when: prefWhen.trim() || null,
                  weight: prefWeight,
                };
                const next = [...softPrefs, sc];
                setSoftPrefs(next);
                setSoftConstraintsCollege(next);
                setPrefTarget('');
                setPrefWhen('');
                setPrefWeight(3);
                setShowAddPref(false);
              }}>Add</button>
          </div>
        </div>
      </div>
    )}
  </>
  );
};

export default CollegeStep6Constraints;
