import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOnboardingStore } from '../../store';
import { Btn, Eyebrow, Chip, Dot, Icon, TopBar } from '../ui/primitives';
import { snapshotsAPI } from '../../api/client';
import DownloadModal from '../ui/DownloadModal';

// ─── Types ────────────────────────────────────────────────────────────────────
interface SnapshotSummary {
  id: string;
  institution_name: string;
  created_at: string;
  // flat summary fields from getHistory
  solve_time?: string;
  total_assignments?: number;
  subjects_count?: number;
  teachers_count?: number;
  rooms_count?: number;
  // full snapshot fields from getLatest
  classes_data?: any[];
  teachers_data?: any[];
  rooms_data?: any[];
  generated_timetable?: {
    stats?: {
      clashes?: number;
      solve_time_seconds?: number;
    };
  };
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
  const { institutionData, generatedTimetable } = useOnboardingStore();
  const [q, setQ] = useState('');

  const [latest, setLatest] = useState<SnapshotSummary | null>(null);
  const [history, setHistory] = useState<SnapshotSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Download modal state
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [downloadFormat, setDownloadFormat] = useState<'excel' | 'pdf'>('excel');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);

    Promise.all([
      snapshotsAPI.getLatest().catch(() => null),
      snapshotsAPI.getHistory().catch(() => null),
    ]).then(([latestRes, historyRes]) => {
      if (cancelled) return;
      const snap = latestRes?.data;
      setLatest(snap?.found ? snap.snapshot : null);
      setHistory(historyRes?.data?.snapshots ?? []);
      setLoading(false);
    }).catch(() => {
      if (!cancelled) { setError(true); setLoading(false); }
    });

    return () => { cancelled = true; };
  }, []);

  const filtered = history.filter(r =>
    (r.institution_name ?? '').toLowerCase().includes(q.toLowerCase())
  );

  const inst = latest?.institution_name || institutionData?.name || 'My Institution';
  const dept = institutionData?.type || 'College';

  const latestClashes = latest?.generated_timetable?.stats?.clashes ?? 0;
  const latestSolveRaw = latest?.generated_timetable?.stats?.solve_time_seconds
    ?? (latest?.solve_time != null ? parseFloat(String(latest.solve_time)) : undefined);
  const latestSolve = formatSolveTime(latestSolveRaw);
  const latestWhen = latest ? relativeTime(latest.created_at) : null;

  // Real stats from latest snapshot
  const latestStudents = latest?.classes_data
    ? latest.classes_data.reduce((sum: number, c: any) => sum + (parseInt(c.size) || 30), 0)
    : null;
  const latestFaculty = latest?.teachers_data?.length ?? null;
  const latestRooms   = latest?.rooms_data?.length ?? null;
  const latestClasses = latest?.classes_data?.length ?? null;

  // Active timetable data (for download modal)
  const activeTimetable = generatedTimetable ?? latest?.generated_timetable ?? null;

  const openDownload = (fmt: 'excel' | 'pdf') => {
    setDownloadFormat(fmt);
    setShowDownloadModal(true);
  };

  return (
    <div className="screen-enter">
      <TopBar
        title="Dashboard"
        crumbs={[inst, dept]}
        actions={
          <>
            <Btn variant="ghost" size="sm">
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
                  {latest.institution_name}
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
              <Btn variant="brand" size="sm" onClick={() => navigate(latest ? '/timetable' : '/wizard')}>
                <Icon name="grid" size={13} /> {latest ? 'Open timetable' : 'Create timetable'}
              </Btn>
              {latest && activeTimetable && (
                <>
                  <Btn variant="ghost" size="sm" onClick={() => openDownload('excel')}>
                    <Icon name="dl" size={13} /> Excel
                  </Btn>
                  <Btn variant="ghost" size="sm" onClick={() => openDownload('pdf')}>
                    <Icon name="file" size={13} /> PDF
                  </Btn>
                  <Btn variant="ghost" size="sm">
                    <Icon name="spark" size={13} /> Compare versions
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
              { icon: 'import',  title: 'Import Excel',    sub: 'Roster + rooms',            onClick: () => {} },
              { icon: 'stack',   title: 'Duplicate a run', sub: 'Tweak and resolve',         onClick: () => {} },
              { icon: 'sparkle', title: 'AI draft',        sub: 'Describe in plain English', onClick: () => {} },
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
            {
              label: 'Active students',
              v: latestStudents != null ? latestStudents.toLocaleString() : '—',
              d: latestClasses != null ? `${latestClasses} class${latestClasses !== 1 ? 'es' : ''}` : 'no data yet',
            },
            {
              label: 'Faculty',
              v: latestFaculty != null ? String(latestFaculty) : '—',
              d: 'from latest run',
            },
            {
              label: 'Rooms',
              v: latestRooms != null ? String(latestRooms) : '—',
              d: 'from latest run',
            },
            {
              label: 'Avg. solve time',
              v: latestSolve !== '—' ? latestSolve : '—',
              d: 'latest run',
            },
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
                  filtered.map((r, idx) => {
                    const clashes = r.generated_timetable?.stats?.clashes ?? 0;
                    const solveRaw = r.solve_time ?? r.generated_timetable?.stats?.solve_time_seconds;
                    const solve = solveRaw != null ? formatSolveTime(parseFloat(String(solveRaw))) : '—';
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
                          <div className="font-medium">{r.institution_name}</div>
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
                          <Btn variant="ghost" size="sm" onClick={() => navigate('/timetable')}>
                            Open <Icon name="arrow" size={12} />
                          </Btn>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Download modal */}
      {showDownloadModal && activeTimetable && (
        <DownloadModal
          format={downloadFormat}
          onClose={() => setShowDownloadModal(false)}
          timetableData={activeTimetable}
          institutionName={inst}
        />
      )}
    </div>
  );
};

export default DashboardPage;
