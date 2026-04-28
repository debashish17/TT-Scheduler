import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eyebrow, Icon, TopBar } from '../ui/primitives';
import { useWizardStore } from './wizardStore';
import { useOnboardingStore } from '../../store';

const WorkflowSelector: React.FC = () => {
  const navigate = useNavigate();
  const { setWorkflow, reset } = useWizardStore();
  const { clearOnboardingData } = useOnboardingStore();

  // Clear all previous data when starting a new run
  useEffect(() => {
    reset();
    clearOnboardingData();
  }, [reset, clearOnboardingData]);

  const handleSelect = (w: 'school' | 'college') => {
    setWorkflow(w);
    navigate('/wizard/step/1');
  };

  return (
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
          ]).map(card => (
            <button
              key={card.type}
              onClick={() => handleSelect(card.type)}
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
};

export default WorkflowSelector;
