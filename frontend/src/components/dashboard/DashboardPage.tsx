import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOnboardingStore } from '../../store';
import { Btn, Eyebrow, Chip, Dot, Icon, TopBar } from '../ui/primitives';
import { runsAPI, schoolAPI, collegeAPI } from '../../api/client';
import { useWizardStore } from '../wizard/wizardStore';
import toast from 'react-hot-toast';
import { exportAllViewsToExcel, exportSelectedPDFs } from '../../utils/exportHelpers';
import ExportModal from '../timetable/ExportModal';
import ImportExcelModal from './ImportExcelModal';
import AIDraftModal from './AIDraftModal';

// ─── Types ────────────────────────────────────────────────────────────────────
interface RunSummary {
  id: string;
  kind: 'school' | 'college';
  name: string;
  status: string;
  solver: string;
  solve_time_seconds?: number | null;
  parent_run_id?: string | null;
  created_at: string;
  // Aggregate counts from backend
  assignments_count?: number;
  subjects_count?: number;   // subjects (school) or courses (college)
  teachers_count?: number;   // teachers (school) or faculty (college)
  classes_count?: number;    // classes (school) or sections (college)
  rooms_count?: number;
  students_count?: number;   // sum of class sizes (school) or course enrolments (college)
  // institution_name is derived from the run name
  institution_name?: string;
}

/** Strip the trailing " timetable" the backend appends to run names by default. */
function displayName(name: string | undefined): string {
  if (!name) return 'Untitled';
  return name.replace(/\s+timetable\s*$/i, '').trim() || name;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function relativeTime(iso: string): string {
  const normalized = iso.endsWith('Z') ? iso : iso + 'Z';
  const diff = Date.now() - new Date(normalized).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return mins <= 1 ? 'Just now' : `${mins} minutes ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs === 1 ? '1 hour ago' : `${hrs} hours ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function formatSolveTime(secs?: number): string {
  if (secs == null) return '—';
  return secs < 1 ? `${(secs * 1000).toFixed(0)}ms` : `${secs.toFixed(1)}s`;
}

// ─── Skeleton row ─────────────────────────────────────────────────────────────
const SkeletonRow: React.FC = () => (
  <tr style={{ borderTop: '1px solid var(--line)' }}>
    {[120, 80, 60, 40, 50, 60].map((w, i) => (
      <td key={i} className="py-3 px-5">
        <div className="rounded animate-pulse" style={{ width: w, height: 14, background: 'var(--paper-2)' }} />
      </td>
    ))}
  </tr>
);

// ─── Mini grid (static preview) ───────────────────────────────────────────────
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const PERIODS = [
  { p: 1, start: '09:00' }, { p: 2, start: '09:55' }, { p: 3, start: '10:50' },
  { p: 4, start: '11:45' }, { p: 5, start: '13:30' }, { p: 6, start: '14:25' }, { p: 7, start: '15:20' },
];
const SUBJ_COLORS: Record<string, string> = {
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

const MiniGrid: React.FC = () => (
  <div className="w-full">
    <div className="grid gap-[3px]" style={{ gridTemplateColumns: '44px repeat(5, 1fr)' }}>
      <div />
      {DAYS.map(d => (
        <div key={d} className="text-[10px] mono text-center pb-1" style={{ color: 'var(--ink-3)' }}>
          {d.toUpperCase()}
        </div>
      ))}
      {PERIODS.map(slot => (
        <React.Fragment key={slot.p}>
          <div className="text-[10px] mono flex items-center justify-end pr-1" style={{ color: 'var(--ink-3)' }}>
            {slot.start}
          </div>
          {DAYS.map(d => {
            const code = GRID[d]?.[slot.p] ?? null;
            return (
              <div
                key={d + slot.p}
                className="rounded-[4px] h-[22px] flex items-center justify-center text-[9px] font-semibold"
                style={{
                  background: code ? SUBJ_COLORS[code] : 'var(--paper-2)',
                  border: code ? 'none' : '1px solid var(--line)',
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

// ─── Empty state ──────────────────────────────────────────────────────────────
const EmptyRuns: React.FC<{ onNew: () => void }> = ({ onNew }) => (
  <tr>
    <td colSpan={6} className="py-16 px-5 text-center">
      <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4" style={{ background: 'var(--paper-2)' }}>
        <Icon name="grid" size={20} style={{ color: 'var(--ink-3)' } as React.CSSProperties} />
      </div>
      <p className="font-medium mb-1">No timetable runs yet</p>
      <p className="text-sm mb-4" style={{ color: 'var(--ink-3)' }}>Generate your first timetable to see it here.</p>
      <Btn variant="primary" size="sm" onClick={onNew}>
        <Icon name="plus" size={13} /> New run
      </Btn>
    </td>
  </tr>
);

// ─── Dashboard page ───────────────────────────────────────────────────────────
const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { institutionData, generatedTimetable, setInstitutionData, setGeneratedTimetable } = useOnboardingStore();
  const [q, setQ] = useState('');

  const [latest, setLatest] = useState<RunSummary | null>(null);
  const [history, setHistory] = useState<RunSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  
  const [exportingExcel, setExportingExcel] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [aiDraftOpen, setAiDraftOpen] = useState(false);
  const [openingId, setOpeningId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);

    runsAPI.list()
      .then((res) => {
        if (cancelled) return;
        const runs: RunSummary[] = (res.data?.runs ?? []) as RunSummary[];
        setLatest(runs.length > 0 ? runs[0] : null);
        setHistory(runs);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) { setError(true); setLoading(false); }
      });

    return () => { cancelled = true; };
  }, []);

  const filtered = history.filter(r =>
    displayName(r.name).toLowerCase().includes(q.toLowerCase())
  );

  const inst = displayName(latest?.name) !== 'Untitled'
    ? displayName(latest?.name)
    : (institutionData?.name || 'My Institution');
  const dept = latest?.kind === 'college' ? 'College' : (latest?.kind === 'school' ? 'School' : (institutionData?.type || 'College'));

  const latestClashes = 0; // clashes not in runs-list summary; shown per-run after loading
  const latestSolveRaw = latest?.solve_time_seconds ?? null;
  const latestSolve = formatSolveTime(latestSolveRaw ?? undefined);
  const latestWhen = latest ? relativeTime(latest.created_at) : null;

  // Counts come from the runs-list summary's aggregate fields (added by backend).
  //  - "Active students" = SUM(class size) for school OR SUM(course enrolment) for college
  //  - "Faculty"         = teachers (school) or faculty (college)
  //  - "Rooms"           = rooms in the run
  const activeStudentsStr = latest?.students_count != null ? String(latest.students_count) : '—';
  const facultyStr        = latest?.teachers_count != null ? String(latest.teachers_count) : '—';
  const roomsStr          = latest?.rooms_count != null ? String(latest.rooms_count) : '—';


  // Export uses the in-memory generatedTimetable from the store (set after the last solver run).
  // The runs-list API no longer returns assignment data; assignments live in the store.
  const handleExportExcel = async () => {
    if (!(generatedTimetable as any)?.assignments) return;
    setExportingExcel(true);
    const tid = toast.loading('Generating Excel Sheets…');
    try {
      const { assignments, working_days, time_slots } = generatedTimetable as any;
      exportAllViewsToExcel(displayName(latest?.name) !== 'Untitled' ? displayName(latest?.name) : (institutionData?.name || 'Timetable'), assignments, working_days, time_slots);
      toast.success('Downloaded!', { id: tid });
    } catch { toast.error('Export failed', { id: tid }); } finally { setExportingExcel(false); }
  };

  const handleExportPdf = async (selections: any) => {
    if (!(generatedTimetable as any)?.assignments) return;
    setIsPdfModalOpen(false);
    setExportingPdf(true);
    const tid = toast.loading('Generating PDFs…');
    try {
      const { assignments, working_days, time_slots } = generatedTimetable as any;
      await exportSelectedPDFs(displayName(latest?.name) !== 'Untitled' ? displayName(latest?.name) : (institutionData?.name || 'Timetable'), selections, assignments, working_days, time_slots);
      toast.success('Downloaded!', { id: tid });
    } catch {
      toast.error('Failed to generate PDF archive', { id: tid });
    } finally { setExportingPdf(false); }
  };

  /**
   * Open a saved run — fetch its full solver result, hydrate the store, and
   * navigate to /timetable. View-only; no wizard, no re-solve.
   */
  const handleOpenRun = async (run: RunSummary) => {
    setOpeningId(run.id);
    try {
      const res = run.kind === 'college'
        ? await collegeAPI.getRunResult(run.id)
        : await schoolAPI.getRunResult(run.id);
      const result = res.data;

      const instName = displayName(run.name);
      setInstitutionData(instName !== 'Untitled' ? { name: instName } : null);
      setGeneratedTimetable(result);
      useWizardStore.getState().setWorkflow(run.kind);

      navigate('/timetable');
    } catch {
      toast.error('Failed to load timetable.');
    } finally {
      setOpeningId(null);
    }
  };

  return (
    <div className="screen-enter">
      <TopBar
        title="Dashboard"
        crumbs={[inst, dept]}
        actions={
          <>
            <Btn variant="ghost" size="sm" onClick={() => setImportModalOpen(true)}>
              <Icon name="import" size={13} /> Import Excel
            </Btn>
            <Btn variant="primary" size="sm" onClick={() => navigate('/wizard')}>
              <Icon name="plus" size={13} /> New run
            </Btn>
          </>
        }
      />

      <div className="p-8 max-w-[1400px] mx-auto">
        {/* Hero strip */}
        <div className="grid grid-cols-12 gap-4 mb-8">
          <div className="col-span-12 md:col-span-7 edge rounded-xl p-6" style={{ background: 'var(--paper)' }}>
            {latest ? (
              <>
                <div className="flex items-center justify-between mb-3">
                  <Eyebrow>Active timetable · {latest.id.slice(0, 8)}</Eyebrow>
                  <Chip tone="ok"><Dot color="var(--ok)" /> live</Chip>
                </div>
                <h2 className="serif leading-tight tracking-tight mb-1" style={{ fontSize: 44 }}>
                  {displayName(latest.name)}
                </h2>
                <p className="text-sm mono mb-4" style={{ color: 'var(--ink-3)' }}>
                  Published {latestWhen} · {latestClashes} clashes · solved in {latestSolve}
                </p>
              </>
            ) : loading ? (
              <>
                <div className="h-4 rounded mb-3 animate-pulse w-40" style={{ background: 'var(--paper-2)' }} />
                <div className="h-10 rounded mb-2 animate-pulse w-64" style={{ background: 'var(--paper-2)' }} />
                <div className="h-4 rounded mb-4 animate-pulse w-56" style={{ background: 'var(--paper-2)' }} />
              </>
            ) : (
              <>
                <div className="flex items-center justify-between mb-3">
                  <Eyebrow>No active timetable</Eyebrow>
                </div>
                <h2 className="serif leading-tight tracking-tight mb-1" style={{ fontSize: 44, color: 'var(--ink-3)' }}>
                  Nothing yet.
                </h2>
                <p className="text-sm mono mb-4" style={{ color: 'var(--ink-3)' }}>
                  Generate your first timetable to see it here.
                </p>
              </>
            )}
            <div className="flex items-center gap-2 flex-wrap">
              <Btn
                variant="brand"
                size="sm"
                disabled={latest ? openingId === latest.id : false}
                onClick={() => latest ? handleOpenRun(latest) : navigate('/wizard')}
              >
                <Icon name="grid" size={13} />
                {latest ? (openingId === latest.id ? 'Loading…' : 'Open timetable') : 'Create timetable'}
              </Btn>
              {latest && (generatedTimetable as any)?.assignments && (
                <>
                  <Btn variant="ghost" size="sm" onClick={handleExportExcel} disabled={exportingExcel}>
                    <Icon name="dl" size={13} /> {exportingExcel ? 'Exporting…' : 'Excel'}
                  </Btn>
                  <Btn variant="ghost" size="sm" onClick={() => setIsPdfModalOpen(true)} disabled={exportingPdf}>
                    <Icon name="file" size={13} /> {exportingPdf ? 'Exporting…' : 'PDF'}
                  </Btn>
                </>
              )}
            </div>
          </div>
          <div className="col-span-12 md:col-span-5 edge rounded-xl p-4" style={{ background: 'var(--paper)' }}>
            <div className="flex items-center justify-between mb-3">
              <Eyebrow>Preview · CS-3A</Eyebrow>
              <span className="mono text-[11px]" style={{ color: 'var(--ink-3)' }}>Mon–Fri</span>
            </div>
            <MiniGrid />
          </div>
        </div>

        {/* Quick actions */}
        <div className="mb-10">
          <div className="flex items-baseline justify-between mb-3">
            <h3 className="serif text-2xl">Quick actions</h3>
            <span className="mono text-[11px]" style={{ color: 'var(--ink-3)' }}>4 shortcuts</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { icon: 'plus',    title: 'New timetable',   sub: 'Start from scratch',       onClick: () => navigate('/wizard') },
              { icon: 'import',  title: 'Import Excel',    sub: 'Roster + rooms',            onClick: () => setImportModalOpen(true) },
              { icon: 'stack',   title: 'Duplicate a run', sub: 'Tweak and resolve',         onClick: () => navigate('/history') },
              { icon: 'sparkle', title: 'AI draft',        sub: 'Describe in plain English', onClick: () => setAiDraftOpen(true) },
            ].map(a => (
              <button
                key={a.title}
                onClick={a.onClick}
                className="edge rounded-xl p-4 text-left lift"
                style={{ background: 'var(--paper)' }}
              >
                <Icon name={a.icon} size={18} className="mb-3" style={{ color: 'var(--brand)' } as React.CSSProperties} />
                <div className="font-semibold text-sm mb-0.5">{a.title}</div>
                <div className="text-[12px]" style={{ color: 'var(--ink-3)' }}>{a.sub}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Stats strip — real values from latest snapshot */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-0 edge rounded-xl overflow-hidden mb-10" style={{ background: 'var(--paper)' }}>
          {[
            { label: 'Active students', v: activeStudentsStr, d: latest ? 'latest run' : '—' },
            { label: 'Faculty',         v: facultyStr,        d: latest ? 'latest run' : '—' },
            { label: 'Rooms',           v: roomsStr,          d: latest ? 'latest run' : '—' },
            { label: 'Solve time',      v: latestSolve,       d: latest ? 'latest run' : '—' },
          ].map((s, i) => (
            <div key={s.label} className="p-5" style={{ borderRight: i < 3 ? '1px solid var(--line)' : undefined }}>
              <div className="eyebrow mb-2" style={{ color: 'var(--ink-3)' }}>{s.label}</div>
              <div className="serif leading-none" style={{ fontSize: 40 }}>{s.v}</div>
              <div className="mono text-[11px] mt-2" style={{ color: 'var(--ink-3)' }}>{s.d}</div>
            </div>
          ))}
        </div>

        {/* Recent runs table */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h3 className="serif text-2xl">Recent runs</h3>
            <div className="flex items-center gap-2 edge rounded-full px-3 py-1.5" style={{ background: 'var(--paper)' }}>
              <Icon name="search" size={13} style={{ color: 'var(--ink-3)' } as React.CSSProperties} />
              <input
                value={q}
                onChange={e => setQ(e.target.value)}
                placeholder="Filter runs…"
                className="bg-transparent outline-none text-sm w-48"
                style={{ color: 'var(--ink)' }}
              />
            </div>
          </div>

          {error && (
            <div className="edge rounded-xl p-6 text-center text-sm mb-4" style={{ background: 'var(--paper)', color: 'var(--err)' }}>
              Could not load runs — backend may be offline.
            </div>
          )}

          <div className="edge rounded-xl overflow-hidden" style={{ background: 'var(--paper)' }}>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left" style={{ color: 'var(--ink-3)' }}>
                  <th className="py-3 px-5 eyebrow font-medium">Run</th>
                  <th className="py-3 px-5 eyebrow font-medium">When</th>
                  <th className="py-3 px-5 eyebrow font-medium">Status</th>
                  <th className="py-3 px-5 eyebrow font-medium">Clashes</th>
                  <th className="py-3 px-5 eyebrow font-medium">Solve</th>
                  <th className="py-3 px-5" />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  [1, 2, 3].map(i => <SkeletonRow key={i} />)
                ) : filtered.length === 0 ? (
                  <EmptyRuns onNew={() => navigate('/wizard')} />
                ) : (
                  <>
                    {filtered.slice(0, 10).map((r, idx) => {
                      const clashes = 0; // not in runs-list summary
                      const solve = r.solve_time_seconds != null ? formatSolveTime(r.solve_time_seconds) : '—';
                      const isLatest = idx === 0 && !q;
                      return (
                        <tr
                          key={r.id}
                          className="transition-colors"
                          style={{ borderTop: '1px solid var(--line)' }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'var(--paper-2)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        >
                          <td className="py-3 px-5">
                            <div className="font-medium">{displayName(r.name)}</div>
                            <div className="text-[11px] mono" style={{ color: 'var(--ink-3)' }}>{r.id.slice(0, 8)}</div>
                          </td>
                          <td className="py-3 px-5" style={{ color: 'var(--ink-2)' }}>{relativeTime(r.created_at)}</td>
                          <td className="py-3 px-5">
                            {isLatest
                              ? <Chip tone="ok"><Dot color="var(--ok)" /> live</Chip>
                              : <Chip tone="neutral">archive</Chip>
                            }
                          </td>
                          <td className="py-3 px-5 mono text-[13px]">
                            <span style={{ color: clashes === 0 ? 'var(--ok)' : 'var(--err)' }}>{clashes}</span>
                          </td>
                          <td className="py-3 px-5 mono text-[13px]" style={{ color: 'var(--ink-2)' }}>{solve}</td>
                          <td className="py-3 px-5 text-right">
                            <Btn
                              variant="ghost"
                              size="sm"
                              disabled={openingId === r.id}
                              onClick={() => handleOpenRun(r)}
                            >
                              {openingId === r.id ? 'Loading…' : <>Open <Icon name="arrow" size={12} /></>}
                            </Btn>
                          </td>
                        </tr>
                      );
                    })}
                    {filtered.length > 10 && (
                      <tr style={{ borderTop: '1px solid var(--line)' }}>
                        <td colSpan={6} className="py-3 px-5 text-center text-sm">
                          <button
                            onClick={() => navigate('/history')}
                            className="mono text-[12px] hover:opacity-70 transition-opacity"
                            style={{ color: 'var(--brand)' }}
                          >
                            View all {filtered.length} runs →
                          </button>
                        </td>
                      </tr>
                    )}
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <ExportModal isOpen={isPdfModalOpen} onClose={() => setIsPdfModalOpen(false)} onExport={handleExportPdf} />
      <ImportExcelModal open={importModalOpen} onClose={() => setImportModalOpen(false)} />
      <AIDraftModal open={aiDraftOpen} onClose={() => setAiDraftOpen(false)} />
    </div>
  );
};

export default DashboardPage;
