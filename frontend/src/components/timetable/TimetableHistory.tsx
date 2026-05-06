import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { runsAPI, schoolAPI, collegeAPI } from '../../api/client';
import { useOnboardingStore } from '../../store';
import { useWizardStore } from '../wizard/wizardStore';
import { Btn, Chip, Dot, Icon, TopBar } from '../ui/primitives';
import { hydrateRunIntoWizard } from './hydrateRunIntoWizard';
import toast from 'react-hot-toast';

interface RunSummary {
  id: string;
  kind: 'school' | 'college';
  name: string;
  status: string;
  solver: string;
  solve_time_seconds?: number | null;
  parent_run_id?: string | null;
  created_at: string | null;
  // Aggregate counts from backend
  assignments_count?: number;
  subjects_count?: number;   // subjects (school) or courses (college)
  teachers_count?: number;   // teachers (school) or faculty (college)
  classes_count?: number;    // classes (school) or sections (college)
  rooms_count?: number;
  students_count?: number;   // sum of class sizes (school) or course enrolments (college)
  // Aliased for display convenience
  institution_name?: string;
}

/** Strip the " timetable" suffix the backend appends by default. */
function displayName(name: string | undefined): string {
  if (!name) return 'Untitled';
  return name.replace(/\s+timetable\s*$/i, '').trim() || name;
}

function toUtc(iso: string): string {
  return iso.endsWith('Z') ? iso : iso + 'Z';
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(toUtc(iso)).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function relativeTime(iso: string | null): string {
  if (!iso) return '—';
  const diff = Date.now() - new Date(toUtc(iso)).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return mins <= 1 ? 'Just now' : `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return days === 1 ? 'Yesterday' : `${days}d ago`;
}

const TimetableHistory: React.FC = () => {
  const navigate = useNavigate();
  const {
    setInstitutionData, setGeneratedTimetable, clearOnboardingData,
  } = useOnboardingStore();

  const [snapshots,    setSnapshots]   = useState<RunSummary[]>([]);
  const [loading,      setLoading]     = useState(true);
  const [loadingId,    setLoadingId]   = useState<string | null>(null);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [deletingId,   setDeletingId]  = useState<string | null>(null);
  const [error,        setError]       = useState<string | null>(null);

  const fetchHistory = () => {
    setLoading(true); setError(null);
    runsAPI.list()
      .then(r => {
        setSnapshots((r.data.runs || []) as RunSummary[]);
      })
      .catch(e => setError(e.response?.data?.detail || 'Cannot reach the backend.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchHistory(); }, []);

  const handleLoad = async (id: string) => {
    setLoadingId(id);
    try {
      const runMeta = snapshots.find(s => s.id === id);
      const runKind: 'school' | 'college' = runMeta?.kind ?? 'school';

      // Fetch the full solver-shaped result so the timetable view can render
      // without re-running the solver.
      const resultRes = runKind === 'college'
        ? await collegeAPI.getRunResult(id)
        : await schoolAPI.getRunResult(id);
      const result = resultRes.data;

      // Set the institution name (for headers in the timetable view) and the
      // generated timetable in the store. Don't touch the wizard data — the
      // user is viewing a saved run, not editing inputs.
      const instName = displayName(runMeta?.name);
      setInstitutionData(instName !== 'Untitled' ? { name: instName } : null);
      setGeneratedTimetable(result);
      useWizardStore.getState().setWorkflow(runKind);

      toast.success(`Loaded "${instName}"`);
      navigate('/timetable');
    } catch { toast.error('Failed to load timetable.');
    } finally { setLoadingId(null); }
  };

  const handleDuplicate = async (id: string) => {
    setDuplicatingId(id);
    try {
      const runMeta = snapshots.find(s => s.id === id);
      const runKind: 'school' | 'college' = runMeta?.kind ?? 'school';
      const { institutionName } = await hydrateRunIntoWizard(id, runKind);
      toast.success(`Duplicated "${institutionName}" — adjust and re-generate`);
      navigate('/wizard/step/1');
    } catch { toast.error('Failed to duplicate run.');
    } finally { setDuplicatingId(null); }
  };

  const handleDelete = async (id: string) => {
    try {
      const runMeta = snapshots.find(s => s.id === id);
      if (runMeta?.kind === 'college') {
        await collegeAPI.deleteRun(id);
      } else {
        await schoolAPI.deleteRun(id);
      }
      toast.success('Timetable deleted');
      const storeState = useOnboardingStore.getState();
      if (storeState.generatedTimetable && (storeState.generatedTimetable as any).run_id === id) {
        clearOnboardingData();
      }
      fetchHistory();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to delete timetable.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="screen-enter">
      <TopBar
        title="History"
        crumbs={['Timetable history']}
        actions={
          <Btn variant="ghost" size="sm" onClick={() => navigate('/timetable')}>
            ← Back to timetable
          </Btn>
        }
      />

      <div className="p-8 max-w-[900px] mx-auto">
        {loading && (
          <div className="flex items-center justify-center py-24">
            <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin mr-3"
              style={{ borderColor: 'var(--brand)', borderTopColor: 'transparent' }} />
            <span className="text-sm" style={{ color: 'var(--ink-3)' }}>Loading history…</span>
          </div>
        )}

        {error && !loading && (
          <div className="edge rounded-xl p-10 text-center" style={{ background: 'var(--paper)' }}>
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5"
              style={{ background: 'var(--paper-2)' }}>
              <Icon name="x" size={22} style={{ color: 'var(--err)' } as React.CSSProperties} />
            </div>
            <h2 className="serif text-2xl mb-2">Backend not reachable</h2>
            <p className="text-sm mb-2" style={{ color: 'var(--ink-3)' }}>
              Start the server: <code className="mono px-1.5 py-0.5 rounded text-xs"
                style={{ background: 'var(--paper-2)' }}>uvicorn app.main:app --reload</code>
            </p>
            <p className="text-xs mono mb-6" style={{ color: 'var(--err)' }}>{error}</p>
            <div className="flex gap-2 justify-center">
              <Btn variant="primary" size="sm" onClick={fetchHistory}>Retry</Btn>
              <Btn variant="ghost" size="sm" onClick={() => navigate('/wizard')}>New timetable</Btn>
            </div>
          </div>
        )}

        {!loading && !error && snapshots.length === 0 && (
          <div className="edge rounded-xl p-16 text-center" style={{ background: 'var(--paper)' }}>
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5"
              style={{ background: 'var(--paper-2)' }}>
              <Icon name="stack" size={22} style={{ color: 'var(--ink-3)' } as React.CSSProperties} />
            </div>
            <h2 className="serif text-2xl mb-2">No history yet</h2>
            <p className="text-sm mb-6" style={{ color: 'var(--ink-3)' }}>
              Generate your first timetable to see it here.
            </p>
            <Btn variant="primary" size="sm" onClick={() => navigate('/wizard')}>
              <Icon name="plus" size={13} /> Start creating
            </Btn>
          </div>
        )}

        {!loading && !error && snapshots.length > 0 && (
          <div className="space-y-3">
            {snapshots.map((snap, idx) => (
              <div
                key={snap.id}
                className="edge rounded-xl p-6 transition-shadow"
                style={{
                  background: 'var(--paper)',
                  boxShadow: idx === 0 ? '0 0 0 1.5px var(--brand)' : undefined,
                }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="font-semibold truncate">
                        {displayName(snap.name)}
                      </h3>
                      {idx === 0 && <Chip tone="ok"><Dot color="var(--ok)" /> latest</Chip>}
                      {snap.solver && (
                        <Chip tone="neutral">{snap.solver}</Chip>
                      )}
                      {snap.kind && (
                        <Chip tone="neutral">{snap.kind}</Chip>
                      )}
                    </div>
                    <p className="text-[12px] mono mb-4" style={{ color: 'var(--ink-3)' }}>
                      {formatDate(snap.created_at)} · {relativeTime(snap.created_at)}
                    </p>

                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                      {[
                        { label: 'Assignments', v: snap.assignments_count ?? '—' },
                        { label: 'Solve time',  v: snap.solve_time_seconds != null ? `${snap.solve_time_seconds.toFixed(1)}s` : '—' },
                        { label: snap.kind === 'college' ? 'Courses' : 'Subjects', v: snap.subjects_count ?? '—' },
                        { label: snap.kind === 'college' ? 'Faculty' : 'Teachers', v: snap.teachers_count ?? '—' },
                        { label: 'Rooms', v: snap.rooms_count ?? '—' },
                      ].map(s => (
                        <div key={s.label} className="rounded-lg p-3 text-center"
                          style={{ background: 'var(--paper-2)' }}>
                          <div className="serif text-2xl leading-none mb-1">{s.v}</div>
                          <div className="text-[10px] mono" style={{ color: 'var(--ink-3)' }}>{s.label}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 shrink-0">
                    <Btn
                      variant={idx === 0 ? 'brand' : 'primary'}
                      size="sm"
                      disabled={loadingId === snap.id}
                      onClick={() => handleLoad(snap.id)}
                    >
                      {loadingId === snap.id ? 'Loading…' : 'Load'}
                    </Btn>
                    <Btn
                      variant="soft"
                      size="sm"
                      disabled={duplicatingId === snap.id}
                      onClick={() => handleDuplicate(snap.id)}
                    >
                      {duplicatingId === snap.id ? 'Duplicating…' : 'Duplicate'}
                    </Btn>
                    <Btn variant="ghost" size="sm" onClick={() => navigate('/analytics')}>
                      Analytics
                    </Btn>
                    {deletingId === snap.id ? (
                      <div className="flex bg-red-50 dark:bg-red-900/20 rounded border border-red-200 dark:border-red-800/30 overflow-hidden">
                        <Btn
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(snap.id)}
                          style={{ color: 'var(--err)', borderRadius: 0, padding: '4px 8px' }}
                        >
                          Sure?
                        </Btn>
                        <Btn
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeletingId(null)}
                          style={{ color: 'var(--ink-2)', borderRadius: 0, padding: '4px 8px' }}
                        >
                          Cancel
                        </Btn>
                      </div>
                    ) : (
                      <Btn
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeletingId(snap.id)}
                        style={{ color: 'var(--err)' }}
                      >
                        Delete
                      </Btn>
                    )}
                  </div>
                </div>
              </div>
            ))}

            <p className="text-center text-[11px] mono py-2" style={{ color: 'var(--ink-3)' }}>
              {snapshots.length} timetable{snapshots.length !== 1 ? 's' : ''} — history is per account
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default TimetableHistory;
