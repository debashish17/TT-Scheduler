import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOnboardingStore } from '../../store';
import { simpleTimetableAPI } from '../../api/client';
import { Btn, Eyebrow, Icon, TopBar } from '../ui/primitives';
import toast from 'react-hot-toast';
import { exportAllViewsToExcel, exportSelectedPDFs } from '../../utils/exportHelpers';
import ExportModal from './ExportModal';

const NAV = [
  { id: 'timetable',    label: 'Class',     path: '/timetable'    },
  { id: 'faculty-view', label: 'Faculty',   path: '/faculty-view' },
  { id: 'student-view', label: 'Student',   path: '/student-view' },
  { id: 'analytics',    label: 'Analytics', path: '/analytics'    },
  { id: 'history',      label: 'History',   path: '/history'      },
];

const Bar: React.FC<{ value: number; max: number; color?: string }> = ({ value, max, color = 'var(--brand)' }) => {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="w-full rounded-full overflow-hidden h-1" style={{ background: 'var(--line)' }}>
      <div className="h-1 rounded-full" style={{ width: `${pct}%`, background: color, transition: 'width .3s' }} />
    </div>
  );
};

function computeLocalAnalytics(timetable: any) {
  const { assignments = [], working_days = [], time_slots = [], stats = {}, solver = 'CP-SAT', status = 'FEASIBLE' } = timetable;
  const teacherMap: Record<string, { periods: number; subjects: Set<string>; classes: Set<string> }> = {};
  const subjMap: Record<string, { name: string; total: number; classes: Set<string> }> = {};
  const roomMap: Record<string, number> = {};
  const dayMap: Record<string, number> = {};

  for (const a of assignments) {
    if (!teacherMap[a.teacher_name]) teacherMap[a.teacher_name] = { periods: 0, subjects: new Set(), classes: new Set() };
    teacherMap[a.teacher_name].periods++; teacherMap[a.teacher_name].subjects.add(a.subject_code); teacherMap[a.teacher_name].classes.add(a.class_name);
    if (!subjMap[a.subject_code]) subjMap[a.subject_code] = { name: a.subject_name || a.subject_code, total: 0, classes: new Set() };
    subjMap[a.subject_code].total++; subjMap[a.subject_code].classes.add(a.class_name);
    roomMap[a.room_name] = (roomMap[a.room_name] || 0) + 1;
    dayMap[a.day] = (dayMap[a.day] || 0) + 1;
  }

  const totalSlots = working_days.length * (time_slots.length || 7);
  return {
    summary: {
      total_assignments: assignments.length,
      classes_count: new Set(assignments.map((a: any) => a.class_name)).size,
      teachers_count: Object.keys(teacherMap).length,
      subjects_count: Object.keys(subjMap).length,
      rooms_count: Object.keys(roomMap).length,
      solver: (stats as any).solver || solver,
      solver_status: (stats as any).status || status,
      solve_time_seconds: (stats as any).solve_time_seconds ?? 0,
      periods_per_day: time_slots.length,
    },
    teacher_workload: Object.entries(teacherMap).sort().map(([t, d]) => ({
      teacher_name: t, periods_per_week: d.periods,
      subjects: [...d.subjects].sort(), classes: [...d.classes].sort(),
      overloaded: d.periods > totalSlots * 0.8,
    })),
    subject_distribution: Object.entries(subjMap).sort().map(([code, d]) => ({
      subject_code: code, subject_name: d.name, total_periods: d.total,
      classes_covered: d.classes.size, avg_periods_per_class: Math.round(d.total / Math.max(d.classes.size, 1) * 10) / 10,
    })),
    room_usage: Object.entries(roomMap).sort((a, b) => b[1] - a[1]).map(([r, cnt]) => ({
      room_name: r, assignments: cnt,
      utilization_pct: Math.round(cnt / Math.max(totalSlots, 1) * 100),
    })),
    day_load: working_days.map((d: string) => ({ day: d, sessions: dayMap[d] || 0 })),
  };
}

const AnalyticsView: React.FC = () => {
  const navigate = useNavigate();
  const { generatedTimetable, institutionData } = useOnboardingStore();
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);

  useEffect(() => {
    if (!generatedTimetable) return;
    setLoading(true);
    simpleTimetableAPI.getAnalytics(generatedTimetable)
      .then(res => setAnalytics(res.data))
      .catch(() => setAnalytics(computeLocalAnalytics(generatedTimetable)))
      .finally(() => setLoading(false));
  }, [generatedTimetable]);

  if (!generatedTimetable) {
    return (
      <div className="screen-enter p-8 max-w-2xl mx-auto text-center py-24">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6" style={{ background: 'var(--paper-2)' }}>
          <Icon name="spark" size={28} style={{ color: 'var(--ink-3)' } as React.CSSProperties} />
        </div>
        <h2 className="serif text-4xl tracking-tight mb-2">No timetable yet</h2>
        <p className="text-sm mb-8" style={{ color: 'var(--ink-3)' }}>Generate a timetable first.</p>
        <Btn variant="primary" size="md" onClick={() => navigate('/wizard')}>Start wizard</Btn>
      </div>
    );
  }

  const handleExportExcel = async () => {
    setExportingExcel(true);
    const tid = toast.loading('Generating Excel Sheets…');
    try {
      const { assignments, working_days, time_slots } = generatedTimetable as any;
      exportAllViewsToExcel(institutionData?.name || 'Timetable', assignments, working_days, time_slots);
      toast.success('Downloaded!', { id: tid });
    } catch { toast.error('Export failed', { id: tid }); } finally { setExportingExcel(false); }
  };

  const handleExportPdf = async (selections: any) => {
    setIsPdfModalOpen(false);
    setExportingPdf(true);
    const tid = toast.loading('Generating PDFs…');
    try {
      const { assignments, working_days, time_slots } = generatedTimetable as any;
      await exportSelectedPDFs(institutionData?.name || 'Timetable', selections, assignments, working_days, time_slots);
      toast.success('Downloaded!', { id: tid });
    } catch {
      toast.error('Failed to generate PDF archive', { id: tid });
    } finally { setExportingPdf(false); }
  };

  return (
    <div className="screen-enter">
      <TopBar
        title="Analytics"
        crumbs={[institutionData?.name || 'School', 'Analytics']}
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

        {loading && (
          <div className="flex items-center py-16">
            <div className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin mr-3"
              style={{ borderColor: 'var(--brand)', borderTopColor: 'transparent' }} />
            <span className="text-sm" style={{ color: 'var(--ink-3)' }}>Computing analytics…</span>
          </div>
        )}

        {!loading && analytics && (
          <>
            {/* Summary strip */}
            <div className="grid grid-cols-3 md:grid-cols-6 gap-0 edge rounded-xl overflow-hidden mb-8" style={{ background: 'var(--paper)' }}>
              {[
                { label: 'Assignments', v: analytics.summary.total_assignments },
                { label: 'Classes',     v: analytics.summary.classes_count },
                { label: 'Teachers',    v: analytics.summary.teachers_count },
                { label: 'Subjects',    v: analytics.summary.subjects_count },
                { label: 'Rooms',       v: analytics.summary.rooms_count },
                { label: 'Solve time',  v: `${analytics.summary.solve_time_seconds}s` },
              ].map((s, i) => (
                <div key={s.label} className="p-4 text-center"
                  style={{ borderRight: i < 5 ? '1px solid var(--line)' : undefined }}>
                  <div className="serif text-3xl leading-none mb-1">{s.v}</div>
                  <div className="text-[10px] mono" style={{ color: 'var(--ink-3)' }}>{s.label}</div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* Teacher workload */}
              <div className="edge rounded-xl p-6" style={{ background: 'var(--paper)' }}>
                <Eyebrow className="block mb-4">Teacher workload</Eyebrow>
                <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                  {analytics.teacher_workload.map((t: any, i: number) => (
                    <div key={i} className="rounded-lg p-3" style={{ background: 'var(--paper-2)', border: '1px solid var(--line)' }}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm font-medium">{t.teacher_name}</span>
                        <span className="mono text-[12px]" style={{ color: t.overloaded ? 'var(--err)' : 'var(--ok)' }}>
                          {t.periods_per_week} periods{t.overloaded ? ' ⚠' : ''}
                        </span>
                      </div>
                      <Bar value={t.periods_per_week} max={Math.max(...analytics.teacher_workload.map((x: any) => x.periods_per_week))} color={t.overloaded ? 'var(--err)' : 'var(--brand)'} />
                      <div className="text-[11px] mono mt-1.5" style={{ color: 'var(--ink-3)' }}>
                        {t.subjects.join(' · ')} · {t.classes.join(', ')}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Subject distribution */}
              <div className="edge rounded-xl p-6" style={{ background: 'var(--paper)' }}>
                <Eyebrow className="block mb-4">Subject distribution</Eyebrow>
                <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                  {analytics.subject_distribution.map((s: any, i: number) => {
                    const maxP = Math.max(...analytics.subject_distribution.map((x: any) => x.total_periods));
                    return (
                      <div key={i} className="rounded-lg p-3" style={{ background: 'var(--paper-2)', border: '1px solid var(--line)' }}>
                        <div className="flex items-center justify-between mb-1.5">
                          <div>
                            <span className="text-sm font-semibold mono">{s.subject_code}</span>
                            <span className="text-[12px] ml-2" style={{ color: 'var(--ink-3)' }}>{s.subject_name}</span>
                          </div>
                          <span className="mono text-[12px]" style={{ color: 'var(--brand)' }}>{s.total_periods} periods</span>
                        </div>
                        <Bar value={s.total_periods} max={maxP} />
                        <div className="text-[11px] mono mt-1.5" style={{ color: 'var(--ink-3)' }}>
                          {s.classes_covered} class · avg {s.avg_periods_per_class}/class
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Room utilisation */}
              <div className="edge rounded-xl p-6" style={{ background: 'var(--paper)' }}>
                <Eyebrow className="block mb-4">Room utilisation</Eyebrow>
                <div className="space-y-3">
                  {analytics.room_usage.map((r: any, i: number) => (
                    <div key={i} className="rounded-lg p-3" style={{ background: 'var(--paper-2)', border: '1px solid var(--line)' }}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm font-medium mono">{r.room_name}</span>
                        <span className="mono text-[12px]" style={{ color: r.utilization_pct > 80 ? 'var(--err)' : r.utilization_pct > 50 ? 'var(--warn)' : 'var(--ok)' }}>
                          {r.assignments} sessions · {r.utilization_pct}%
                        </span>
                      </div>
                      <Bar value={r.utilization_pct} max={100} color={r.utilization_pct > 80 ? 'var(--err)' : r.utilization_pct > 50 ? 'var(--warn)' : 'var(--ok)'} />
                    </div>
                  ))}
                </div>
              </div>

              {/* Day load + solver info */}
              <div className="edge rounded-xl p-6" style={{ background: 'var(--paper)' }}>
                <Eyebrow className="block mb-4">Sessions per day</Eyebrow>
                <div className="space-y-3 mb-6">
                  {analytics.day_load.map((d: any, i: number) => {
                    const maxS = Math.max(...analytics.day_load.map((x: any) => x.sessions));
                    return (
                      <div key={i}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm">{d.day}</span>
                          <span className="mono text-[12px]" style={{ color: 'var(--brand)' }}>{d.sessions}</span>
                        </div>
                        <Bar value={d.sessions} max={maxS} />
                      </div>
                    );
                  })}
                </div>
                <div className="grid grid-cols-2 gap-2 pt-4" style={{ borderTop: '1px solid var(--line)' }}>
                  {[
                    { l: 'Solver',       v: analytics.summary.solver },
                    { l: 'Status',       v: analytics.summary.solver_status },
                    { l: 'Solve time',   v: `${analytics.summary.solve_time_seconds}s` },
                    { l: 'Periods/day',  v: analytics.summary.periods_per_day },
                  ].map(s => (
                    <div key={s.l} className="rounded-lg p-3" style={{ background: 'var(--paper-2)' }}>
                      <div className="text-[10px] mono mb-0.5" style={{ color: 'var(--ink-3)' }}>{s.l}</div>
                      <div className="text-sm font-semibold">{s.v}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
      <ExportModal isOpen={isPdfModalOpen} onClose={() => setIsPdfModalOpen(false)} onExport={handleExportPdf} />
    </div>
  );
};

export default AnalyticsView;
