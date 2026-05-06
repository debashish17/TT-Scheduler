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
import { runsAPI, schoolAPI, collegeAPI } from '../api/client';

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

      // ── Step 3: Fetch latest run from backend ────────────────
      try {
        const res = await runsAPI.list();
        const runs: any[] = res.data?.runs ?? [];
        if (runs.length > 0) {
          // Pick the most recent run (list is newest-first).
          // The new getRun endpoint returns the wizard request shape directly
          // (no wrapper). We import the appropriate getRun based on kind.
          const latest = runs[0];
          const runRes = latest.kind === 'college'
            ? await collegeAPI.getRun(latest.id)
            : await schoolAPI.getRun(latest.id);
          const run = runRes.data;

          // Map new wizard-shaped fields → store fields
          setInstitutionData({ name: run.institution_name } || null);
          setClassesData(    run.classes       || []);
          setSubjectsData(   run.subjects      || []);
          setTeachersData(   run.teachers      || []);
          setTimeData(       run.working_days ? {
            workingDays: run.working_days,
            periodsPerDay: run.periods_per_day,
            periodDuration: run.period_duration_minutes,
            startTime: run.start_time,
            lunchDuration: run.lunch_duration_minutes,
            lunchAfterPeriod: run.constraints?.lunch_after_period ?? 0,
            haslunch: (run.lunch_duration_minutes ?? 0) > 0
              && (run.constraints?.lunch_after_period ?? 0) > 0,
          } : null);
          setRoomsData(      run.rooms         || []);
          setConstraintsData(run.constraints   || null);
          // generated_timetable is not returned by getRun — user must re-run solver

          console.log(
            `✅ Run restored for user ${user.id}: ` +
            `"${run.institution_name}" (${latest.created_at?.slice(0, 10)})`
          );
        } else {
          console.log('ℹ️ No previous run found for user, starting fresh.');
        }
      } catch (err) {
        // Backend unreachable — use whatever localStorage has; that's fine
        console.warn('Run restore skipped (backend unavailable):', err);
      }

      // Mark userId in store and in our session ref
      setUserId(user.id);
      restoredForRef.current = user.id;
    };

    run();
  }, [user, loading]);
}
