import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOnboardingStore } from '../../store';
import { Btn, Eyebrow, Chip, Dot, Icon, TopBar } from '../ui/primitives';
import toast from 'react-hot-toast';
import { exportAllViewsToExcel, exportSelectedPDFs } from '../../utils/exportHelpers';
import ExportModal from './ExportModal';

// ─── Colour palette ───────────────────────────────────────────────────────────
const PALETTE = [
  '#0369A1', '#0F766E', '#7C3AED', '#B45309',
  '#BE185D', '#065F46', '#1D4ED8', '#9D174D',
];

const NAV = [
  { id: 'timetable',   label: 'Class',     path: '/timetable'    },
  { id: 'faculty-view',label: 'Faculty',   path: '/faculty-view' },
  { id: 'student-view',label: 'Student',   path: '/student-view' },
  { id: 'analytics',   label: 'Analytics', path: '/analytics'    },
  { id: 'history',     label: 'History',   path: '/history'      },
];

const TimetableGrid: React.FC = () => {
  const navigate = useNavigate();
  const { generatedTimetable, institutionData } = useOnboardingStore();
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

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
        <Btn variant="primary" size="md" onClick={() => navigate('/wizard')}>
          Start wizard
        </Btn>
      </div>
    );
  }

  const { assignments = [], working_days = [], time_slots = [], stats = {}, warnings = [] } = generatedTimetable as any;
  const errors   = (warnings as any[]).filter(w => w.level === 'error');
  const cautions = (warnings as any[]).filter(w => w.level === 'warning');

  const classes = [...new Set((assignments as any[]).map(a => a.class_name))].sort() as string[];
  const currentClass = selectedClass || classes[0] || '';
  const allSubjects  = [...new Set((assignments as any[]).map(a => a.subject_code))] as string[];
  const subjectColor: Record<string, string> = {};
  allSubjects.forEach((c, i) => { subjectColor[c] = PALETTE[i % PALETTE.length]; });

  const classGrid: Record<string, Record<number, any>> = {};
  (working_days as string[]).forEach(d => { classGrid[d] = {}; });
  (assignments as any[]).filter(a => a.class_name === currentClass).forEach(a => {
    if (!classGrid[a.day]) classGrid[a.day] = {};
    classGrid[a.day][a.period] = a;
  });
  const periods = (time_slots as any[]).map((s, i) => ({ period: i + 1, ...s }));

  const handleExportExcel = async () => {
    setExportingExcel(true);
    const tid = toast.loading('Generating Excel Sheets…');
    try {
      exportAllViewsToExcel(institutionData?.name || 'Timetable', assignments, working_days, time_slots);
      toast.success('Downloaded!', { id: tid });
    } catch (err) {
      toast.error('Failed to generate Excel', { id: tid });
    } finally { setExportingExcel(false); }
  };

  const handleExportPdf = async (selections: any) => {
    setIsPdfModalOpen(false);
    setExportingPdf(true);
    const tid = toast.loading('Generating PDFs…');
    try {
      await exportSelectedPDFs(institutionData?.name || 'Timetable', selections, assignments, working_days, time_slots);
      toast.success('Downloaded!', { id: tid });
    } catch {
      toast.error('Failed to generate PDF archive', { id: tid });
    } finally { setExportingPdf(false); }
  };

  return (
    <div className="screen-enter">
      <TopBar
        title="Timetable"
        crumbs={[institutionData?.name || 'School', currentClass]}
        actions={
          <>
            <Btn variant="ghost" size="sm" onClick={handleExportExcel} disabled={exportingExcel}>
              <Icon name="dl" size={13} /> {exportingExcel ? 'Exporting…' : 'Excel'}
            </Btn>
            <Btn variant="ghost" size="sm" onClick={() => setIsPdfModalOpen(true)} disabled={exportingPdf}>
              <Icon name="file" size={13} /> {exportingPdf ? 'Exporting…' : 'PDF'}
            </Btn>
            <Btn variant="ghost" size="sm" onClick={() => openDownload('pdf')}>
              <Icon name="file" size={13} /> PDF
            </Btn>
          </>
        }
      />

      <div className="p-8 max-w-[1400px] mx-auto">
        {/* View nav */}
        <div className="flex gap-1 mb-6 edge rounded-full overflow-hidden p-1 w-fit" style={{ background: 'var(--paper)' }}>
          {NAV.map(n => (
            <button
              key={n.id}
              onClick={() => navigate(n.path)}
              className="px-4 py-1.5 rounded-full text-sm font-medium transition-colors"
              style={{
                background: window.location.pathname === n.path ? 'var(--ink)' : 'transparent',
                color: window.location.pathname === n.path ? 'var(--paper)' : 'var(--ink-3)',
              }}
            >
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
            {[...errors, ...cautions].map((w: any, i) => (
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
              <button
                key={cls}
                onClick={() => setSelectedClass(cls)}
                className="px-3 py-1 rounded-full text-sm font-medium transition-colors"
                style={{
                  background: currentClass === cls ? 'var(--ink)' : 'var(--paper)',
                  color: currentClass === cls ? 'var(--paper)' : 'var(--ink-2)',
                  border: `1px solid ${currentClass === cls ? 'var(--ink)' : 'var(--line)'}`,
                }}
              >
                {cls}
              </button>
            ))}
          </div>
        )}

        {/* Grid */}
        <div className="edge rounded-xl overflow-hidden mb-6" style={{ background: 'var(--paper)' }}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr style={{ background: 'var(--ink)', color: 'var(--paper)' }}>
                  <th className="px-4 py-3 text-left text-[11px] mono font-medium w-28">Period</th>
                  {(working_days as string[]).map(day => (
                    <th key={day} className="px-3 py-3 text-center text-[11px] mono font-medium">
                      {day.slice(0, 3).toUpperCase()}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {periods.map((slot: any, pi: number) => (
                  <tr key={pi} style={{ borderTop: '1px solid var(--line)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--paper-2)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td className="px-4 py-2" style={{ borderRight: '1px solid var(--line)' }}>
                      <div className="text-[11px] font-semibold">P{slot.period}</div>
                      <div className="text-[10px] mono" style={{ color: 'var(--ink-3)' }}>
                        {slot.start}–{slot.end}
                      </div>
                    </td>
                    {(working_days as string[]).map(day => {
                      const a = classGrid[day]?.[slot.period];
                      return (
                        <td key={day} className="px-2 py-2 text-center" style={{ borderRight: '1px solid var(--line)' }}>
                          {a ? (
                            <div className="rounded-lg px-2 py-1.5 text-left"
                              style={{ background: subjectColor[a.subject_code] + '18', border: `1px solid ${subjectColor[a.subject_code]}33` }}>
                              <div className="text-[11px] font-semibold" style={{ color: subjectColor[a.subject_code] }}>
                                {a.subject_code}
                              </div>
                              <div className="text-[10px] truncate" style={{ color: 'var(--ink-2)' }}>{a.teacher_name}</div>
                              <div className="text-[10px]" style={{ color: 'var(--ink-3)' }}>{a.room_name}</div>
                            </div>
                          ) : (
                            <div className="text-[11px]" style={{ color: 'var(--line)' }}>—</div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Legend */}
          <div className="px-4 py-3 flex flex-wrap gap-2" style={{ borderTop: '1px solid var(--line)', background: 'var(--paper-2)' }}>
            {allSubjects.map(code => {
              const subj = (assignments as any[]).find(a => a.subject_code === code);
              return (
                <span key={code} className="px-2.5 py-1 rounded-full text-[11px] font-medium"
                  style={{ background: subjectColor[code] + '18', color: subjectColor[code], border: `1px solid ${subjectColor[code]}33` }}>
                  {code}{subj?.subject_name ? ` — ${subj.subject_name}` : ''}
                </span>
              );
            })}
          </div>
        </div>

        {/* Action row */}
        <div className="flex items-center justify-between">
          <Btn variant="ghost" size="sm" onClick={() => navigate('/wizard')}>
            ← Regenerate
          </Btn>
          <div className="flex gap-2">
            <Btn variant="ghost" size="sm" onClick={() => navigate('/faculty-view')}>Faculty</Btn>
            <Btn variant="ghost" size="sm" onClick={() => navigate('/student-view')}>Student</Btn>
            <Btn variant="ghost" size="sm" onClick={() => navigate('/analytics')}>Analytics</Btn>
          </div>
        </div>
      </div>

      <style>{`@media print { body*{visibility:hidden} .screen-enter,.screen-enter *{visibility:visible} .screen-enter{position:absolute;left:0;top:0;width:100%} }`}</style>

      <ExportModal 
        isOpen={isPdfModalOpen} 
        onClose={() => setIsPdfModalOpen(false)} 
        onExport={handleExportPdf} 
      />
    </div>
  );
};

export default TimetableGrid;
