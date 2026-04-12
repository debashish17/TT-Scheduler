/**
 * TimetableHistory — shows all past generated timetables for the logged-in user.
 * Users can browse their history in reverse-chronological order and load any
 * previous timetable (with all its inputs) back into the app.
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FaHistory, FaCalendarAlt, FaUserTie, FaBook, FaDoorOpen,
  FaUsers, FaArrowLeft, FaPlay, FaChartBar, FaSpinner, FaCheckCircle,
} from 'react-icons/fa';
import { snapshotsAPI } from '../../api/client';
import { useOnboardingStore } from '../../store';
import toast from 'react-hot-toast';

interface SnapshotSummary {
  id: string;
  institution_name: string;
  created_at: string | null;
  solver: string;
  total_assignments: number;
  solve_time: string;
  subjects_count: number;
  teachers_count: number;
  rooms_count: number;
  classes_count: number;
}

const TimetableHistory = () => {
  const navigate = useNavigate();
  const {
    setInstitutionData, setClassesData, setSubjectsData, setTeachersData,
    setTimeData, setRoomsData, setConstraintsData, setGeneratedTimetable,
  } = useOnboardingStore();

  const [snapshots,  setSnapshots]  = useState<SnapshotSummary[]>([]);
  const [isLoading,  setIsLoading]  = useState(true);
  const [loadingId,  setLoadingId]  = useState<string | null>(null);
  const [error,      setError]      = useState<string | null>(null);

  // ── Fetch history on mount ───────────────────────────────────
  useEffect(() => {
    const fetchHistory = async () => {
      setIsLoading(true);
      try {
        const res = await snapshotsAPI.getHistory();
        setSnapshots(res.data.snapshots || []);
      } catch (e: any) {
        if (!e.response) {
          setError('Cannot reach the backend. Make sure the server is running on http://localhost:8000.');
        } else {
          setError(e.response?.data?.detail || 'Failed to load history.');
        }
      } finally {
        setIsLoading(false);
      }
    };
    fetchHistory();
  }, []);

  // ── Load a historical snapshot into the store ────────────────
  const handleLoad = async (id: string) => {
    setLoadingId(id);
    try {
      const res = await snapshotsAPI.getById(id);
      if (!res.data.found) {
        toast.error('Snapshot not found.');
        return;
      }
      const snap = res.data.snapshot;

      setInstitutionData(snap.institution_data  || null);
      setClassesData(    snap.classes_data       || []);
      setSubjectsData(   snap.subjects_data      || []);
      setTeachersData(   snap.teachers_data      || []);
      setTimeData(       snap.time_data          || null);
      setRoomsData(      snap.rooms_data         || []);
      setConstraintsData(snap.constraints_data   || null);
      setGeneratedTimetable(snap.generated_timetable || null);

      toast.success(`Loaded "${snap.institution_name}" — navigating to timetable`);
      navigate('/timetable');
    } catch (e: any) {
      toast.error('Failed to load snapshot.');
    } finally {
      setLoadingId(null);
    }
  };

  // ── Helpers ──────────────────────────────────────────────────
  const formatDate = (iso: string | null) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  const formatSolveTime = (t: string) => {
    const n = parseFloat(t);
    return isNaN(n) ? '—' : `${n.toFixed(1)}s`;
  };

  return (
    <div className="max-w-5xl mx-auto py-4">
      {/* Header */}
      <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-indigo-100 rounded-2xl flex items-center justify-center">
              <FaHistory className="text-2xl text-indigo-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Timetable History</h1>
              <p className="text-gray-500 text-sm mt-0.5">
                All your previously generated timetables — click any to restore it
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate('/timetable')}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors text-sm"
          >
            <FaArrowLeft size={12} /> Back to Timetable
          </button>
        </div>
      </div>

      {/* States */}
      {isLoading && (
        <div className="flex items-center justify-center py-20 text-gray-500">
          <FaSpinner className="animate-spin text-3xl mr-3 text-indigo-500" />
          <span className="text-lg">Loading your history...</span>
        </div>
      )}

      {error && !isLoading && (
        <div className="bg-white rounded-2xl shadow-sm border border-red-100 p-8 text-center">
          <div className="text-5xl mb-4">🔌</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Backend Not Running</h2>
          <p className="text-gray-500 text-sm mb-6 max-w-md mx-auto">
            The history feature requires the backend server to be running.<br />
            Start it with: <code className="bg-gray-100 px-2 py-0.5 rounded text-xs font-mono">uvicorn app.main:app --reload</code>
            &nbsp;from the <code className="bg-gray-100 px-2 py-0.5 rounded text-xs font-mono">backend/</code> folder.
          </p>
          <div className="flex gap-3 justify-center flex-wrap">
            <button
              onClick={() => { setError(null); setIsLoading(true); snapshotsAPI.getHistory().then(r => { setSnapshots(r.data.snapshots || []); setIsLoading(false); }).catch(e => { setError(e.response ? (e.response.data?.detail || 'Failed to load.') : 'Cannot reach the backend.'); setIsLoading(false); }); }}
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-semibold text-sm hover:bg-indigo-700 transition-colors"
            >
              🔄 Retry
            </button>
            <button
              onClick={() => navigate('/screen-1')}
              className="flex items-center gap-2 px-5 py-2.5 border border-gray-300 text-gray-700 rounded-xl font-medium text-sm hover:bg-gray-50 transition-colors"
            >
              Start New Timetable
            </button>
          </div>
          {error && error !== 'Cannot reach the backend. Make sure the server is running on http://localhost:8000.' && (
            <p className="mt-4 text-xs text-red-500 font-mono bg-red-50 rounded-lg px-3 py-2 inline-block">{error}</p>
          )}
        </div>
      )}

      {!isLoading && !error && snapshots.length === 0 && (
        <div className="text-center py-20">
          <div className="text-6xl mb-4">📋</div>
          <h2 className="text-xl font-bold text-gray-700 mb-2">No History Yet</h2>
          <p className="text-gray-500 mb-6">
            Generate your first timetable and it will appear here automatically.
          </p>
          <button
            onClick={() => navigate('/screen-1')}
            className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors"
          >
            Start Creating
          </button>
        </div>
      )}

      {/* Snapshot cards */}
      {!isLoading && !error && snapshots.length > 0 && (
        <div className="space-y-4">
          {snapshots.map((snap, idx) => (
            <div
              key={snap.id}
              className={`bg-white rounded-2xl shadow-sm border-2 transition-all duration-200 ${
                idx === 0
                  ? 'border-indigo-200 shadow-indigo-50'
                  : 'border-gray-100 hover:border-gray-200'
              }`}
            >
              <div className="p-6">
                <div className="flex items-start justify-between gap-4">
                  {/* Left: Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <h3 className="text-lg font-bold text-gray-900 truncate">
                        {snap.institution_name || 'Untitled Timetable'}
                      </h3>
                      {idx === 0 && (
                        <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full text-xs font-semibold">
                          Latest
                        </span>
                      )}
                      <span className="px-2 py-0.5 bg-green-50 text-green-700 rounded-full text-xs font-medium border border-green-200">
                        {snap.solver}
                      </span>
                    </div>
                    <p className="text-sm text-gray-400 mb-4">
                      🕒 {formatDate(snap.created_at)}
                    </p>

                    {/* Stats grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                      {[
                        { icon: <FaCheckCircle className="text-green-500" />, label: 'Assignments', value: snap.total_assignments },
                        { icon: <FaChartBar className="text-blue-500" />,     label: 'Solve Time',  value: formatSolveTime(snap.solve_time) },
                        { icon: <FaBook className="text-purple-500" />,       label: 'Subjects',    value: snap.subjects_count },
                        { icon: <FaUserTie className="text-orange-500" />,    label: 'Teachers',    value: snap.teachers_count },
                        { icon: <FaDoorOpen className="text-red-500" />,      label: 'Rooms',       value: snap.rooms_count },
                      ].map((stat) => (
                        <div
                          key={stat.label}
                          className="flex flex-col items-center bg-gray-50 rounded-xl p-3 text-center"
                        >
                          <div className="text-base mb-1">{stat.icon}</div>
                          <div className="text-lg font-bold text-gray-800">{stat.value}</div>
                          <div className="text-xs text-gray-400">{stat.label}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Right: Load button */}
                  <div className="flex flex-col gap-2 shrink-0">
                    <button
                      onClick={() => handleLoad(snap.id)}
                      disabled={loadingId === snap.id}
                      className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all ${
                        idx === 0
                          ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-md hover:shadow-indigo-200'
                          : 'bg-gray-800 text-white hover:bg-gray-900'
                      } disabled:opacity-60 disabled:cursor-not-allowed`}
                    >
                      {loadingId === snap.id ? (
                        <><FaSpinner className="animate-spin" /> Loading...</>
                      ) : (
                        <><FaPlay /> Load</>
                      )}
                    </button>
                    <button
                      onClick={() => {
                        if (idx === 0) navigate('/timetable');
                        else handleLoad(snap.id).then(() => navigate('/analytics'));
                      }}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                    >
                      <FaChartBar size={12} /> Analytics
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {/* Footer note */}
          <p className="text-center text-xs text-gray-400 py-2">
            Showing last {snapshots.length} timetable{snapshots.length !== 1 ? 's' : ''} — history is preserved per user account
          </p>
        </div>
      )}
    </div>
  );
};

export default TimetableHistory;
