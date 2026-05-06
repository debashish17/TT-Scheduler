/**
 * Zustand stores barrel.
 *
 * Note: `useAuthStore` lives in `./authStore.ts` (Supabase-backed). Import it
 * from there directly, not from this file.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Onboarding Data Store — wizard state across the school and college flows.
 * Persisted to localStorage so the user keeps their work across reloads.
 */
export const useOnboardingStore = create<any>()(
  persist(
    (set) => ({
      // ── User scoping — prevents cross-user data leakage ──
      userId: null as string | null,

      institutionData: null,
      workflowData: null,
      classesData: [],
      subjectsData: [],
      teachersData: [],
      timeData: null,
      slotsData: null,
      roomsData: [],
      constraintsData: null,
      generatedTimetable: null,
      timetableError: null,

      // ── College-specific fields ──
      collegeInstitution: null as {
        name: string;
        semester: number;
        departments: { code: string; name: string }[];
      } | null,

      courseOfferings: [] as Array<{
        code: string;
        name: string;
        department: string;
        year: number;
        credits: number;
        enrolled_students: number;
        is_elective: boolean;
        required_lecture_room_type: string;
        required_lab_room_type: string | null;
      }>,

      collegeFaculty: [] as Array<{
        code: string;
        name: string;
        department: string;
        courses_can_teach: string[];
        max_hours_per_week: number;
      }>,

      collegeRooms: [] as Array<{
        name: string;
        capacity: number;
        room_type: string;
      }>,

      collegeSchedule: null as {
        workingDays: string[];
        periodsPerDay: number;
        periodDurationMinutes: number;
        startTime: string;
        lunchPeriodIndex: number;
      } | null,

      collegeConstraints: null as {
        maxConsecutivePeriods: number;
        maxPeriodsPerDayPerFaculty: number;
      } | null,

      softConstraintsSchool: [] as Array<{
        type: string;
        target: string;
        when: string | null;
        weight: number;
      }>,

      softConstraintsCollege: [] as Array<{
        type: string;
        target: string;
        when: string | null;
        weight: number;
      }>,

      setUserId: (id: string | null) => set({ userId: id }),
      setInstitutionData: (data) => set({ institutionData: data }),
      setWorkflowData: (data) => set({ workflowData: data }),
      setClassesData: (data) => set({ classesData: data }),
      setSubjectsData: (data) => set({ subjectsData: data }),
      setTeachersData: (data) => set({ teachersData: data }),
      setTimeData: (data) => set({ timeData: data }),
      setSlotsData: (data) => set({ slotsData: data }),
      setRoomsData: (data) => set({ roomsData: data }),
      setConstraintsData: (data) => set({ constraintsData: data }),
      setGeneratedTimetable: (data) => set({ generatedTimetable: data, timetableError: null }),
      setTimetableError: (error) => set({ timetableError: error, generatedTimetable: null }),

      // ── College setters ──
      setCollegeInstitution: (data) => set({ collegeInstitution: data }),
      setCourseOfferings: (data) => set({ courseOfferings: data }),
      setCollegeFaculty: (data) => set({ collegeFaculty: data }),
      setCollegeRooms: (data) => set({ collegeRooms: data }),
      setCollegeSchedule: (data) => set({ collegeSchedule: data }),
      setCollegeConstraints: (data) => set({ collegeConstraints: data }),
      setSoftConstraintsSchool: (data) => set({ softConstraintsSchool: data }),
      setSoftConstraintsCollege: (data) => set({ softConstraintsCollege: data }),

      clearOnboardingData: () => set({
        userId: null,
        institutionData: null,
        workflowData: null,
        classesData: [],
        subjectsData: [],
        teachersData: [],
        timeData: null,
        slotsData: null,
        roomsData: [],
        constraintsData: null,
        generatedTimetable: null,
        timetableError: null,
        collegeInstitution: null,
        courseOfferings: [],
        collegeFaculty: [],
        collegeRooms: [],
        collegeSchedule: null,
        collegeConstraints: null,
        softConstraintsSchool: [],
        softConstraintsCollege: [],
      }),
    }),
    {
      name: 'onboarding-storage',
    }
  )
);
