import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOnboardingStore } from '../../store';
import { useWizardStore } from '../wizard/wizardStore';
import { Btn, Icon } from '../ui/primitives';
import { apiClient } from '../../api/client';
import toast from 'react-hot-toast';

interface AIDraftModalProps {
  open: boolean;
  onClose: () => void;
}

const EXAMPLES = [
  'A high school with 3 classes (10A, 10B, 10C), 6 subjects (Math, English, Science, History, PE, Art), and 8 teachers. Mon–Fri, 7 periods per day starting at 8 AM.',
  'A college with 2 departments: CS (4 courses) and Math (3 courses), 10 faculty members, 5 classrooms and 2 labs. 6 periods per day.',
  'Primary school with 4 sections for Grade 5. Subjects: English, Hindi, Math, Science, Social Studies, Art. 6 periods/day, Mon–Sat.',
];

// ─── AI-output adapters ───────────────────────────────────────────────────────
// The AI prompt asks for wizard-exact shapes, but model drift happens. These
// adapters normalize whatever we get into the shapes the wizard stores expect.

const DAY_FULL: Record<string, string> = {
  mon: 'Monday', monday: 'Monday',
  tue: 'Tuesday', tues: 'Tuesday', tuesday: 'Tuesday',
  wed: 'Wednesday', weds: 'Wednesday', wednesday: 'Wednesday',
  thu: 'Thursday', thur: 'Thursday', thurs: 'Thursday', thursday: 'Thursday',
  fri: 'Friday', friday: 'Friday',
  sat: 'Saturday', saturday: 'Saturday',
  sun: 'Sunday', sunday: 'Sunday',
};

const normalizeDays = (days: any): string[] => {
  if (!Array.isArray(days)) return ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  return days.map(d => DAY_FULL[String(d).trim().toLowerCase()] || d);
};

/** Convert AI's school time_data into the shape Step5Schedule expects. */
const adaptSchoolTimeData = (raw: any): any => {
  if (!raw || typeof raw !== 'object') return null;
  const periodsPerDay = raw.periodsPerDay ?? raw.periods_per_day ?? 7;
  const periodDuration = raw.periodDuration
    ?? raw.period_duration
    ?? raw.periodDurationMinutes
    ?? raw.period_duration_minutes
    ?? 45;
  // Lunch — accept lunchAfterPeriod (1-based) OR lunchPeriodIndex (0-based).
  let lunchAfterPeriod: number;
  if (raw.lunchAfterPeriod != null) {
    lunchAfterPeriod = Number(raw.lunchAfterPeriod);
  } else if (raw.lunch_after_period != null) {
    lunchAfterPeriod = Number(raw.lunch_after_period);
  } else if (raw.lunchPeriodIndex != null) {
    lunchAfterPeriod = Number(raw.lunchPeriodIndex) + 1; // 0-based → 1-based
  } else {
    lunchAfterPeriod = 4;
  }
  const lunchDuration = raw.lunchDuration
    ?? raw.lunch_duration
    ?? raw.lunchDurationMinutes
    ?? raw.lunch_duration_minutes
    ?? 30;
  const haslunch = raw.haslunch ?? raw.hasLunch ?? (lunchAfterPeriod > 0 && lunchDuration > 0);
  const out = {
    workingDays: normalizeDays(raw.workingDays ?? raw.working_days),
    startTime: raw.startTime ?? raw.start_time ?? '08:00',
    periodDuration: Number(periodDuration),
    periodsPerDay: Number(periodsPerDay),
    lunchAfterPeriod: Number(lunchAfterPeriod),
    lunchDuration: Number(lunchDuration),
    haslunch: Boolean(haslunch),
  };
  // Step5Schedule's workflow heuristic classifies a payload as "school" only
  // when `startTime === '08:30'` OR `periodDuration === 45`. If neither matches,
  // it resets the data to school defaults (clobbering AI's other values).
  // Snap periodDuration so the heuristic stays satisfied without changing the
  // AI's intent for periods, lunch, or working days.
  if (out.startTime !== '08:30' && out.periodDuration !== 45) {
    out.periodDuration = 45;
  }
  return out;
};

/** Convert AI's college_schedule into the shape CollegeStep5Schedule expects. */
const adaptCollegeSchedule = (raw: any): any => {
  if (!raw || typeof raw !== 'object') return null;
  return {
    workingDays: normalizeDays(raw.workingDays ?? raw.working_days),
    periodsPerDay: Number(raw.periodsPerDay ?? raw.periods_per_day ?? 6),
    periodDurationMinutes: Number(
      raw.periodDurationMinutes
      ?? raw.period_duration_minutes
      ?? raw.periodDuration
      ?? raw.period_duration
      ?? 60
    ),
    startTime: raw.startTime ?? raw.start_time ?? '08:00',
    lunchPeriodIndex: Number(raw.lunchPeriodIndex ?? raw.lunch_period_index ?? 3),
  };
};

/**
 * Ensure each subject has `target_classes`. If the AI inverted the mapping
 * (put `subjects` on classes_data instead), reconstruct it. Final fallback:
 * give every subject every class.
 */
const adaptSchoolSubjects = (subjects: any[], classes: any[]): any[] => {
  if (!Array.isArray(subjects)) return [];
  const allClassNames = Array.isArray(classes)
    ? classes.map(c => c?.name).filter(Boolean)
    : [];
  // Build inverted map: subject_code -> [class_names] from classes_data[].subjects
  const invertedMap: Record<string, string[]> = {};
  if (Array.isArray(classes)) {
    for (const c of classes) {
      if (!c?.name || !Array.isArray(c.subjects)) continue;
      for (const subjCode of c.subjects) {
        if (!invertedMap[subjCode]) invertedMap[subjCode] = [];
        invertedMap[subjCode].push(c.name);
      }
    }
  }
  return subjects.map(s => {
    const existing = Array.isArray(s.target_classes) ? s.target_classes : null;
    const inverted = invertedMap[s.code];
    return {
      name: s.name,
      code: s.code,
      periods_per_week: Number(s.periods_per_week ?? s.periodsPerWeek ?? 3),
      target_classes: existing && existing.length > 0
        ? existing
        : (inverted && inverted.length > 0 ? inverted : allClassNames),
    };
  });
};

/** Strip any `subjects` field from class entries; the wizard doesn't use it. */
const adaptSchoolClasses = (classes: any[]): any[] => {
  if (!Array.isArray(classes)) return [];
  return classes.map(c => ({
    name: c.name,
    size: Number(c.size ?? 30),
  }));
};

/** Strip teacher.code (wizard doesn't store it); keep name + subjects. */
const adaptSchoolTeachers = (teachers: any[]): any[] => {
  if (!Array.isArray(teachers)) return [];
  return teachers.map(t => ({
    name: t.name,
    subjects: Array.isArray(t.subjects) ? t.subjects : [],
  }));
};

/** Rooms: coerce capacity to number and drop the `type` field if present. */
const adaptSchoolRooms = (rooms: any[]): any[] => {
  if (!Array.isArray(rooms)) return [];
  return rooms.map(r => ({
    name: r.name,
    capacity: Number(r.capacity ?? 40),
  }));
};

/** Map school constraints to the keys Step6Constraints expects. */
const adaptSchoolConstraints = (raw: any): any => {
  if (!raw || typeof raw !== 'object') return null;
  return {
    max_consecutive_periods: Number(
      raw.max_consecutive_periods ?? raw.maxConsecutivePeriods ?? 3
    ),
    max_periods_per_day_per_teacher: Number(
      raw.max_periods_per_day_per_teacher ?? raw.maxPeriodsPerDayPerTeacher ?? 6
    ),
  };
};

const AIDraftModal: React.FC<AIDraftModalProps> = ({ open, onClose }) => {
  const navigate = useNavigate();
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  // Scroll the page to the top when the modal opens, so the modal (anchored
  // near the viewport top via pt-[10vh]) is always visible regardless of
  // where the user was scrolled on the underlying page.
  useEffect(() => {
    if (open) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [open]);

  const {
    clearOnboardingData,
    setInstitutionData, setClassesData, setSubjectsData,
    setTeachersData, setTimeData, setRoomsData, setConstraintsData,
    setCollegeInstitution, setCourseOfferings, setCollegeFaculty,
    setCollegeRooms, setCollegeSchedule, setCollegeConstraints,
  } = useOnboardingStore();

  const handleDraft = async () => {
    if (!description.trim()) {
      toast.error('Please describe your timetable setup first');
      return;
    }
    setLoading(true);
    const tid = toast.loading('AI is drafting your setup…');
    try {
      const res = await apiClient.post(
        '/timetable/ai-draft',
        { description: description.trim() },
        { timeout: 60000 },
      );
      const data = res.data;
      const { institution_data } = data;
      const isCollege = institution_data?.type === 'college';

      // Wipe all stale wizard state before applying the new draft so old
      // college/school data from a previous run doesn't bleed through.
      clearOnboardingData();
      useWizardStore.getState().setWorkflow(isCollege ? 'college' : 'school');

      setInstitutionData(institution_data);

      if (isCollege) {
        if (data.college_institution)  setCollegeInstitution(data.college_institution);
        if (data.course_offerings)     setCourseOfferings(data.course_offerings);
        if (data.college_faculty)      setCollegeFaculty(data.college_faculty);
        if (data.college_rooms)        setCollegeRooms(data.college_rooms);
        const schedule = adaptCollegeSchedule(data.college_schedule);
        if (schedule)                  setCollegeSchedule(schedule);
        if (data.college_constraints)  setCollegeConstraints(data.college_constraints);
      } else {
        // Run adapters so the AI's output works regardless of minor key drift.
        const classes  = adaptSchoolClasses(data.classes_data);
        const subjects = adaptSchoolSubjects(data.subjects_data, data.classes_data);
        const teachers = adaptSchoolTeachers(data.teachers_data);
        const rooms    = adaptSchoolRooms(data.rooms_data);
        const time     = adaptSchoolTimeData(data.time_data);
        const constr   = adaptSchoolConstraints(data.constraints_data);
        if (classes.length)   setClassesData(classes);
        if (subjects.length)  setSubjectsData(subjects);
        if (teachers.length)  setTeachersData(teachers);
        if (rooms.length)     setRoomsData(rooms);
        if (time)             setTimeData(time);
        if (constr)           setConstraintsData(constr);

        // Sanity warning if the AI returned subjects but we couldn't map any
        // to classes — wizard would render but the solver later would schedule nothing.
        const mappedAny = subjects.some((s: any) =>
          Array.isArray(s.target_classes) && s.target_classes.length > 0
        );
        if (subjects.length > 0 && !mappedAny) {
          console.warn('[AI draft] No subject→class mapping inferred; using all classes for every subject.');
        }
      }

      toast.success('Draft ready — review and adjust in the wizard', { id: tid });
      onClose();
      navigate('/wizard/step/1');
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      toast.error(detail || 'AI draft failed. Please try again.', { id: tid });
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] pb-8 overflow-y-auto"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="rounded-2xl shadow-2xl w-full max-w-[560px] mx-4 p-8"
        style={{ background: 'var(--paper)', color: 'var(--ink)' }}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: 'var(--brand-soft)' }}
            >
              <Icon name="sparkle" size={18} style={{ color: 'var(--brand)' } as React.CSSProperties} />
            </div>
            <div>
              <h2 className="serif text-3xl tracking-tight leading-none mb-1">AI draft</h2>
              <p className="text-sm" style={{ color: 'var(--ink-3)' }}>
                Describe in plain English — we'll fill the wizard
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full transition-opacity hover:opacity-60"
          >
            <Icon name="x" size={18} />
          </button>
        </div>

        {/* Textarea */}
        <div className="mb-4">
          <label className="block text-[12px] font-medium mb-2" style={{ color: 'var(--ink-2)' }}>
            Describe your institution's timetable setup
          </label>
          <textarea
            rows={5}
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="e.g. A high school with 4 classes (9A, 9B, 10A, 10B), 7 subjects, 10 teachers, and 5 classrooms. Classes run Mon–Fri, 7 periods per day starting at 8:00 AM."
            className="w-full px-3 py-2.5 rounded-md text-sm outline-none resize-none transition-colors"
            style={{
              background: 'var(--paper)',
              border: '1px solid var(--line)',
              color: 'var(--ink)',
              lineHeight: 1.6,
            }}
            onFocus={e => (e.target.style.borderColor = 'var(--ink)')}
            onBlur={e  => (e.target.style.borderColor = 'var(--line)')}
          />
        </div>

        {/* Example prompts */}
        <div className="mb-6">
          <p className="text-[11px] mono mb-2" style={{ color: 'var(--ink-3)' }}>
            TRY AN EXAMPLE
          </p>
          <div className="space-y-1.5">
            {EXAMPLES.map((ex, i) => (
              <button
                key={i}
                onClick={() => setDescription(ex)}
                className="w-full text-left px-3 py-2 rounded-lg text-[12px] transition-colors"
                style={{ background: 'var(--paper-2)', color: 'var(--ink-2)', lineHeight: 1.5 }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--line)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'var(--paper-2)')}
              >
                {ex}
              </button>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Btn
            variant="brand"
            size="sm"
            onClick={handleDraft}
            disabled={loading || !description.trim()}
            className="flex-1 justify-center"
          >
            <Icon name="sparkle" size={13} />
            {loading ? 'Generating draft…' : 'Generate draft'}
          </Btn>
          <Btn variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Btn>
        </div>

        <p className="mt-4 text-[11px] mono text-center" style={{ color: 'var(--ink-3)' }}>
          Powered by Claude Haiku · Results are fully editable in the wizard
        </p>
      </div>
    </div>
  );
};

export default AIDraftModal;
