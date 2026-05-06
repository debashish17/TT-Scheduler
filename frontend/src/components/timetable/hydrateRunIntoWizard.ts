/**
 * Shared helper for "load a saved run's inputs into the wizard so the user
 * can edit and regenerate."
 *
 * Used by:
 *  - TimetableHistory's Load + Duplicate buttons
 *  - TimetableGrid / CollegeTimetableGrid's Regenerate button
 */
import { schoolAPI, collegeAPI } from '../../api/client';
import { useOnboardingStore } from '../../store';
import { useWizardStore } from '../wizard/wizardStore';

type RunKind = 'school' | 'college';

/**
 * Fetch a saved run's wizard inputs and hydrate the onboarding store so the
 * wizard renders prefilled. Always clears `generatedTimetable` (the user is
 * editing inputs, not viewing a result).
 *
 * Throws if the API call fails. Caller handles toast/error UX.
 */
export async function hydrateRunIntoWizard(
  runId: string,
  runKind: RunKind,
): Promise<{ institutionName: string }> {
  const res = runKind === 'college'
    ? await collegeAPI.getRun(runId)
    : await schoolAPI.getRun(runId);
  const run = res.data;

  const store = useOnboardingStore.getState();

  // Generic fields (school wizard steps). For college runs these are
  // populated with empty defaults so school steps don't show stale data.
  store.setInstitutionData(run.institution_name ? { name: run.institution_name } : null);
  store.setClassesData(   runKind === 'school' ? (run.classes  || []) : []);
  store.setSubjectsData(  runKind === 'school' ? (run.subjects || []) : []);
  store.setTeachersData(  runKind === 'school' ? (run.teachers || []) : []);
  store.setTimeData(      run.working_days ? {
    workingDays: run.working_days,
    periodsPerDay: run.periods_per_day,
    periodDuration: run.period_duration_minutes,
    startTime: run.start_time,
    lunchDuration: run.lunch_duration_minutes,
    lunchAfterPeriod: run.constraints?.lunch_after_period ?? 0,
    haslunch: (run.lunch_duration_minutes ?? 0) > 0
      && (run.constraints?.lunch_after_period ?? 0) > 0,
  } : null);
  store.setRoomsData(      runKind === 'school' ? (run.rooms || []) : []);
  store.setConstraintsData(runKind === 'school' ? (run.constraints || null) : null);

  if (runKind === 'college') {
    store.setCollegeInstitution(run.institution_name ? {
      name: run.institution_name,
      semester: run.semester,
      departments: run.departments || [],
    } : null);
    store.setCourseOfferings(run.course_offerings || []);
    store.setCollegeFaculty( run.faculty           || []);
    store.setCollegeSchedule(run.working_days ? {
      workingDays: run.working_days,
      periodsPerDay: run.periods_per_day,
      periodDurationMinutes: run.period_duration_minutes,
      startTime: run.start_time,
      lunchPeriodIndex: run.constraints?.lunch_period_index ?? 3,
    } : null);
    store.setCollegeRooms(      run.rooms       || []);
    store.setCollegeConstraints(run.constraints || null);
  }

  // Intentionally DO NOT clear generatedTimetable here.
  //  - Duplicate / Regenerate: keep the previously-rendered schedule visible
  //    so the user can flip back to /timetable while editing, and only
  //    overwrite it when they actually click Generate again.
  //  - "New run" (WorkflowSelector) is the explicit reset point — it calls
  //    clearOnboardingData(), which wipes generatedTimetable.
  //  - Load: TimetableHistory.handleLoad sets generatedTimetable to the
  //    saved run's result directly, so it overwrites whatever was there.
  useWizardStore.getState().setWorkflow(runKind);

  return { institutionName: run.institution_name || 'Untitled' };
}
