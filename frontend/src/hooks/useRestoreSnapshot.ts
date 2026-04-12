/**
 * useRestoreSnapshot
 *
 * On every login (when a Supabase user becomes available), this hook:
 *  1. Detects if the stored data belongs to a different user → clears it
 *  2. Fetches the most-recent snapshot from the backend
 *  3. Hydrates the onboarding store so the user immediately sees their last session
 *
 * Runs silently in the background — the app is fully usable even if the
 * backend is unreachable (falls back to whatever is already in localStorage).
 */
import { useEffect, useRef } from 'react';
import { useAuthStore } from '../store/authStore';
import { useOnboardingStore } from '../store';
import { snapshotsAPI } from '../api/client';

export function useRestoreSnapshot() {
  const user   = useAuthStore((s) => s.user);
  const loading = useAuthStore((s) => s.isLoading);

  const {
    userId,
    generatedTimetable,
    setUserId,
    setInstitutionData,
    setClassesData,
    setSubjectsData,
    setTeachersData,
    setTimeData,
    setRoomsData,
    setConstraintsData,
    setGeneratedTimetable,
    clearOnboardingData,
  } = useOnboardingStore();

  // Track whether we've already restored for this user in this session
  const restoredForRef = useRef<string | null>(null);

  useEffect(() => {
    // Wait until auth is resolved
    if (loading) return;
    // No user → nothing to restore
    if (!user) return;
    // Already restored for this user in this session
    if (restoredForRef.current === user.id) return;

    const run = async () => {
      // ── Step 1: Isolate data per user ────────────────────────
      if (userId && userId !== user.id) {
        // Different user logged in — wipe the previous user's localStorage data
        clearOnboardingData();
      }

      // ── Step 2: Skip if we already have fresh data for this user ─
      // (e.g. page reload with localStorage intact)
      if (userId === user.id && generatedTimetable) {
        restoredForRef.current = user.id;
        return;
      }

      // ── Step 3: Fetch latest snapshot from backend ────────────
      try {
        const res = await snapshotsAPI.getLatest();
        if (res.data?.found && res.data.snapshot) {
          const snap = res.data.snapshot;

          setInstitutionData(snap.institution_data  || null);
          setClassesData(    snap.classes_data       || []);
          setSubjectsData(   snap.subjects_data      || []);
          setTeachersData(   snap.teachers_data      || []);
          setTimeData(       snap.time_data          || null);
          setRoomsData(      snap.rooms_data         || []);
          setConstraintsData(snap.constraints_data   || null);

          if (snap.generated_timetable && snap.generated_timetable.success) {
            setGeneratedTimetable(snap.generated_timetable);
          }

          console.log(
            `✅ Snapshot restored for user ${user.id}: ` +
            `"${snap.institution_name}" (${snap.created_at?.slice(0, 10)})`
          );
        } else {
          console.log('ℹ️ No previous snapshot found for user, starting fresh.');
        }
      } catch (err) {
        // Backend unreachable — use whatever localStorage has; that's fine
        console.warn('Snapshot restore skipped (backend unavailable):', err);
      }

      // Mark userId in store and in our session ref
      setUserId(user.id);
      restoredForRef.current = user.id;
    };

    run();
  }, [user, loading]);
}
