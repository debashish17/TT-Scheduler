import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOnboardingStore } from '../../store';
import { Btn, Icon, TopBar } from '../ui/primitives';
import toast from 'react-hot-toast';
import { exportAllViewsToExcel, exportSelectedPDFs } from '../../utils/exportHelpers';
import ExportModal from './ExportModal';
import { buildSubjectColor, SchoolTable, Legend } from './SharedTimetableGrid';
import { hydrateRunIntoWizard } from './hydrateRunIntoWizard';
import { useWizardStore } from '../wizard/wizardStore';

const NAV = [
  { id: 'timetable',    label: 'Class',     path: '/timetable'    },
  { id: 'faculty-view', label: 'Faculty',   path: '/faculty-view' },
  { id: 'student-view', label: 'Student',   path: '/student-view' },
  { id: 'analytics',    label: 'Analytics', path: '/analytics'    },
  { id: 'history',      label: 'History',   path: '/history'      },
];

const TimetableGrid: React.FC = () => {
  const navigate = useNavigate();
  const { generatedTimetable, institutionData } = useOnboardingStore();

  // ── ALL hooks declared up-front (rules-of-hooks: no hooks after the
  //    early return below). Derived values that depend on the timetable
  //    are computed unconditionally and default safely when null.
  const [exportingExcel, setExportingExcel] = useState(false);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  // Pre-compute the class list so the selectedClass default is stable.
  const earlyAssignments = (generatedTimetable as any)?.assignments ?? [];
  const earlyClasses = [
    ...new Set((earlyAssignments as any[]).map((a: any) => a.class_name)),
  ].sort() as string[];
  const [selectedClass, setSelectedClass] = useState<string>(earlyClasses[0] || '');

  /**
   * Regenerate = hydrate the saved run's wizard inputs and jump to step 1
   * so the user can tweak inputs and re-solve. If we can't infer the run id
   * (e.g. user is viewing a fresh local solve that wasn't auto-saved), fall
   * back to /wizard with current store data preserved.
   */
  const handleRegenerate = async () => {
    const runId = (generatedTimetable as any)?.run_id;
    const runKind: 'school' | 'college' = useWizardStore.getState().workflow === 'college'
      ? 'college'
      : 'school';
    if (!runId) {
      navigate('/wizard/step/1');
      return;
    }
    setRegenerating(true);
    try {
      await hydrateRunIntoWizard(runId, runKind);
      navigate('/wizard/step/1');
    } catch {
      toast.error('Could not load saved inputs — opening the wizard with current data.');
      navigate('/wizard/step/1');
    } finally {
      setRegenerating(false);
    }
  };

  if (!generatedTimetable) {
    return (
      <div className="screen-enter p-8 max-w-2xl mx-auto text-center py-24">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6"
          style={{ background: 'var(--paper-2)' }}>
          <Icon name="grid" size={28} style={{ color: 'var(--ink-3)' } as React.CSSProperties} />
        </div>
        <h2 className="serif text-4xl tracking-tight mb-2">No timetable yet</h2>
        <p className="text-sm mb-8" style={{ color: 'var(--ink-3)' }}>
          Complete the wizard to generate a clash-free schedule.
        </p>
        <Btn variant="primary" size="md" onClick={() => navigate('/wizard')}>Start wizard</Btn>
      </div>
    );
  }

  const { assignments = [], working_days = [], time_slots = [], stats = {}, warnings = [], lunch_period_index = -1 } = generatedTimetable as any;
  const lunchPeriod: number = lunch_period_index >= 0 ? lunch_period_index + 1 : -1;
  const errors   = (warnings as any[]).filter((w: any) => w.level === 'error');
  const cautions = (warnings as any[]).filter((w: any) => w.level === 'warning');

  const classes = earlyClasses;
  const allSubjects = [...new Set((assignments as any[]).map((a: any) => a.subject_code))] as string[];
  const subjectColor = buildSubjectColor(allSubjects);
  const periods = (time_slots as any[]).map((s: any, i: number) => ({ period: i + 1, ...s }));

  // selectedClass's initializer ran on first render when the timetable may
  // not have loaded yet (so earlyClasses was empty and we defaulted to '').
  // Resolve a sane current value at render time: stick with the user's pick
  // if it's still in the list, otherwise pick the first class.
  const activeClass = (selectedClass && classes.includes(selectedClass))
    ? selectedClass
    : (classes[0] || '');
  const classAssignments = (assignments as any[]).filter((a: any) => a.class_name === activeClass);

  const handleExportExcel = async () => {
    setExportingExcel(true);
    const tid = toast.loading('Generating Excel Sheets…');
    try {
      exportAllViewsToExcel(institutionData?.name || 'Timetable', assignments, working_days, time_slots);
      toast.success('Downloaded!', { id: tid });
    } catch { toast.error('Failed to generate Excel', { id: tid }); }
    finally { setExportingExcel(false); }
  };

  const handleExportPdf = async (selections: any) => {
    setIsPdfModalOpen(false);
    setExportingPdf(true);
    const tid = toast.loading('Generating PDFs…');
    try {
      await exportSelectedPDFs(institutionData?.name || 'Timetable', selections, assignments, working_days, time_slots);
      toast.success('Downloaded!', { id: tid });
    } catch { toast.error('Failed to generate PDF archive', { id: tid }); }
    finally { setExportingPdf(false); }
  };

  return (
    <div className="screen-enter">
      <TopBar
        title="Timetable"
        crumbs={[institutionData?.name || 'School', activeClass]}
        actions={
          <>
            <Btn variant="ghost" size="sm" onClick={handleExportExcel} disabled={exportingExcel}>
              <Icon name="dl" size={13} /> {exportingExcel ? 'Exporting…' : 'Excel'}
            </Btn>
            <Btn variant="ghost" size="sm" onClick={() => setIsPdfModalOpen(true)} disabled={exportingPdf}>
              <Icon name="file" size={13} /> {exportingPdf ? 'Exporting…' : 'PDF'}
            </Btn>
          </>
        }
      />

      <div className="p-8 max-w-[1400px] mx-auto">
        {/* View nav */}
        <div className="flex gap-1 mb-6 edge rounded-full overflow-hidden p-1 w-fit" style={{ background: 'var(--paper)' }}>
          {NAV.map(n => (
            <button key={n.id} onClick={() => navigate(n.path)}
              className="px-4 py-1.5 rounded-full text-sm font-medium transition-colors"
              style={{
                background: window.location.pathname === n.path ? 'var(--ink)' : 'transparent',
                color: window.location.pathname === n.path ? 'var(--paper)' : 'var(--ink-3)',
              }}>
              {n.label}
            </button>
          ))}
        </div>

        {/* Stats strip */}
        <div className="flex items-center gap-6 mb-6 text-sm mono" style={{ color: 'var(--ink-3)' }}>
          <span>{(stats as any).solver || 'CP-SAT'}</span>
          <span style={{ color: 'var(--line)' }}>|</span>
          <span>{(assignments as any[]).length} assignments</span>
          <span style={{ color: 'var(--line)' }}>|</span>
          <span>{(stats as any).solve_time_seconds?.toFixed(1) ?? '—'}s solve</span>
          <span style={{ color: 'var(--line)' }}>|</span>
          <span style={{ color: (stats as any).clashes === 0 ? 'var(--ok)' : 'var(--err)' }}>
            {(stats as any).clashes ?? 0} clashes
          </span>
        </div>

        {/* Warnings */}
        {(errors.length > 0 || cautions.length > 0) && (
          <div className="space-y-2 mb-6">
            {[...errors, ...cautions].map((w: any, i: number) => (
              <div key={i} className="flex gap-3 items-start rounded-xl px-4 py-3"
                style={{ background: w.level === 'error' ? '#FEF2F2' : '#FFFBEB', border: `1px solid ${w.level === 'error' ? '#FECACA' : '#FDE68A'}` }}>
                <Icon name="x" size={14} style={{ color: w.level === 'error' ? 'var(--err)' : 'var(--warn)', marginTop: 2 } as React.CSSProperties} />
                <p className="text-sm">{w.message}</p>
              </div>
            ))}
          </div>
        )}

        {/* Class pills */}
        {classes.length > 1 && (
          <div className="flex flex-wrap gap-2 mb-6">
            {classes.map(cls => (
              <button key={cls} onClick={() => setSelectedClass(cls)}
                className="px-3 py-1 rounded-full text-sm font-medium transition-colors"
                style={{
                  background: activeClass === cls ? 'var(--ink)' : 'var(--paper)',
                  color: activeClass === cls ? 'var(--paper)' : 'var(--ink-2)',
                  border: `1px solid ${activeClass === cls ? 'var(--ink)' : 'var(--line)'}`,
                }}>
                {cls}
              </button>
            ))}
          </div>
        )}

        {/* Grid */}
        <div className="edge rounded-xl overflow-hidden mb-6" style={{ background: 'var(--paper)' }}>
          <div className="overflow-x-auto">
            <SchoolTable
              assignments={classAssignments}
              working_days={working_days}
              periods={periods}
              lunchPeriod={lunchPeriod}
              subjectColor={subjectColor}
              secondaryField="teacher_name"
            />
          </div>
          <Legend codes={allSubjects} codeColor={subjectColor} assignments={assignments} />
        </div>

        {/* Action row */}
        <div className="flex items-center justify-between">
          <Btn variant="ghost" size="sm" disabled={regenerating} onClick={handleRegenerate}>
            {regenerating ? 'Loading…' : '← Regenerate'}
          </Btn>
          <div className="flex gap-2">
            <Btn variant="ghost" size="sm" onClick={() => navigate('/faculty-view')}>Faculty</Btn>
            <Btn variant="ghost" size="sm" onClick={() => navigate('/student-view')}>Student</Btn>
            <Btn variant="ghost" size="sm" onClick={() => navigate('/analytics')}>Analytics</Btn>
          </div>
        </div>
      </div>

      <style>{`@media print { body*{visibility:hidden} .screen-enter,.screen-enter *{visibility:visible} .screen-enter{position:absolute;left:0;top:0;width:100%} }`}</style>
      <ExportModal isOpen={isPdfModalOpen} onClose={() => setIsPdfModalOpen(false)} onExport={handleExportPdf} />
    </div>
  );
};

export default TimetableGrid;
