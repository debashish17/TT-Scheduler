/**
 * Global App Store using Zustand
 * Central state management for the TT-Scheduler application
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Authentication Store
 */
export const useAuthStore = create<any>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,

      login: (user, token) =>
        set({
          user,
          token,
          isAuthenticated: true,
        }),

      logout: () =>
        set({
          user: null,
          token: null,
          isAuthenticated: false,
        }),

      updateUser: (userData) =>
        set((state) => ({
          user: { ...state.user, ...userData },
        })),
    }),
    {
      name: 'auth-storage',
    }
  )
);

/**
 * Institution Store
 */
export const useInstitutionStore = create<any>()(
  persist(
    (set) => ({
      currentInstitution: null,
      institutions: [],

      setCurrentInstitution: (institution) =>
        set({ currentInstitution: institution }),

      setInstitutions: (institutions) =>
        set({ institutions }),

      addInstitution: (institution) =>
        set((state) => ({
          institutions: [...state.institutions, institution],
        })),

      updateInstitution: (id, updates) =>
        set((state) => ({
          institutions: state.institutions.map((inst) =>
            inst.id === id ? { ...inst, ...updates } : inst
          ),
          currentInstitution:
            state.currentInstitution?.id === id
              ? { ...state.currentInstitution, ...updates }
              : state.currentInstitution,
        })),

      removeInstitution: (id) =>
        set((state) => ({
          institutions: state.institutions.filter((inst) => inst.id !== id),
          currentInstitution:
            state.currentInstitution?.id === id ? null : state.currentInstitution,
        })),
    }),
    {
      name: 'institution-storage',
    }
  )
);

/**
 * Job Tracking Store
 */
export const useJobStore = create<any>()((set, get) => ({
  activeJobs: [],
  completedJobs: [],
  failedJobs: [],

  addJob: (job) =>
    set((state) => ({
      activeJobs: [...state.activeJobs, job],
    })),

  updateJob: (jobId, updates) =>
    set((state) => ({
      activeJobs: state.activeJobs.map((job) =>
        job.job_id === jobId ? { ...job, ...updates } : job
      ),
    })),

  completeJob: (jobId, result) =>
    set((state) => {
      const job = state.activeJobs.find((j) => j.job_id === jobId);
      return {
        activeJobs: state.activeJobs.filter((j) => j.job_id !== jobId),
        completedJobs: [
          ...state.completedJobs,
          { ...job, ...result, completed_at: new Date().toISOString() },
        ],
      };
    }),

  failJob: (jobId, error) =>
    set((state) => {
      const job = state.activeJobs.find((j) => j.job_id === jobId);
      return {
        activeJobs: state.activeJobs.filter((j) => j.job_id !== jobId),
        failedJobs: [
          ...state.failedJobs,
          { ...job, error, failed_at: new Date().toISOString() },
        ],
      };
    }),

  removeJob: (jobId) =>
    set((state) => ({
      activeJobs: state.activeJobs.filter((j) => j.job_id !== jobId),
      completedJobs: state.completedJobs.filter((j) => j.job_id !== jobId),
      failedJobs: state.failedJobs.filter((j) => j.job_id !== jobId),
    })),

  clearCompletedJobs: () => set({ completedJobs: [] }),
  clearFailedJobs: () => set({ failedJobs: [] }),
  clearAllJobs: () =>
    set({
      activeJobs: [],
      completedJobs: [],
      failedJobs: [],
    }),

  getJobById: (jobId) => {
    const state = get() as any;
    return (
      state.activeJobs.find((j: any) => j.job_id === jobId) ||
      state.completedJobs.find((j: any) => j.job_id === jobId) ||
      state.failedJobs.find((j: any) => j.job_id === jobId)
    );
  },
}));

/**
 * Timetable Store
 */
export const useTimetableStore = create<any>()((set: any) => ({
  currentTimetable: null,
  timetables: [],
  generationSettings: {
    optimization_mode: 'balanced',
    time_limit_minutes: 5,
    enable_soft_constraints: true,
  },

  setCurrentTimetable: (timetable) => set({ currentTimetable: timetable }),

  setTimetables: (timetables) => set({ timetables }),

  addTimetable: (timetable) =>
    set((state) => ({
      timetables: [...state.timetables, timetable],
    })),

  updateTimetable: (id, updates) =>
    set((state) => ({
      timetables: state.timetables.map((tt) =>
        tt.id === id ? { ...tt, ...updates } : tt
      ),
      currentTimetable:
        state.currentTimetable?.id === id
          ? { ...state.currentTimetable, ...updates }
          : state.currentTimetable,
    })),

  removeTimetable: (id) =>
    set((state) => ({
      timetables: state.timetables.filter((tt) => tt.id !== id),
      currentTimetable: state.currentTimetable?.id === id ? null : state.currentTimetable,
    })),

  updateGenerationSettings: (settings) =>
    set((state) => ({
      generationSettings: { ...state.generationSettings, ...settings },
    })),
}));

/**
 * UI State Store
 */
export const useUIStore = create<any>()((set) => ({
  sidebarOpen: true,
  theme: 'light',
  notifications: [],

  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),

  setTheme: (theme) => set({ theme }),
  toggleTheme: () =>
    set((state) => ({ theme: state.theme === 'light' ? 'dark' : 'light' })),

  addNotification: (notification) =>
    set((state) => ({
      notifications: [
        ...state.notifications,
        {
          id: Date.now(),
          timestamp: new Date().toISOString(),
          ...notification,
        },
      ],
    })),

  removeNotification: (id) =>
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    })),

  clearNotifications: () => set({ notifications: [] }),
}));

/**
 * Faculty Store
 */
export const useFacultyStore = create<any>()((set: any) => ({
  faculty: [],
  selectedFaculty: null,

  setFaculty: (faculty) => set({ faculty }),

  setSelectedFaculty: (faculty) => set({ selectedFaculty: faculty }),

  addFaculty: (member) =>
    set((state) => ({
      faculty: [...state.faculty, member],
    })),

  updateFaculty: (id, updates) =>
    set((state) => ({
      faculty: state.faculty.map((f) => (f.id === id ? { ...f, ...updates } : f)),
      selectedFaculty:
        state.selectedFaculty?.id === id
          ? { ...state.selectedFaculty, ...updates }
          : state.selectedFaculty,
    })),

  removeFaculty: (id) =>
    set((state) => ({
      faculty: state.faculty.filter((f) => f.id !== id),
      selectedFaculty: state.selectedFaculty?.id === id ? null : state.selectedFaculty,
    })),
}));

/**
 * Course Store
 */
export const useCourseStore = create<any>()((set) => ({
  courses: [],
  selectedCourse: null,

  setCourses: (courses) => set({ courses }),

  setSelectedCourse: (course) => set({ selectedCourse: course }),

  addCourse: (course) =>
    set((state) => ({
      courses: [...state.courses, course],
    })),

  updateCourse: (id, updates) =>
    set((state) => ({
      courses: state.courses.map((c) => (c.id === id ? { ...c, ...updates } : c)),
      selectedCourse:
        state.selectedCourse?.id === id
          ? { ...state.selectedCourse, ...updates }
          : state.selectedCourse,
    })),

  removeCourse: (id) =>
    set((state) => ({
      courses: state.courses.filter((c) => c.id !== id),
      selectedCourse: state.selectedCourse?.id === id ? null : state.selectedCourse,
    })),
}));

/**
 * Room Store
 */
export const useRoomStore = create<any>()((set: any) => ({
  rooms: [],
  selectedRoom: null,

  setRooms: (rooms) => set({ rooms }),

  setSelectedRoom: (room) => set({ selectedRoom: room }),

  addRoom: (room) =>
    set((state) => ({
      rooms: [...state.rooms, room],
    })),

  updateRoom: (id, updates) =>
    set((state) => ({
      rooms: state.rooms.map((r) => (r.id === id ? { ...r, ...updates } : r)),
      selectedRoom:
        state.selectedRoom?.id === id
          ? { ...state.selectedRoom, ...updates }
          : state.selectedRoom,
    })),

  removeRoom: (id) =>
    set((state) => ({
      rooms: state.rooms.filter((r) => r.id !== id),
      selectedRoom: state.selectedRoom?.id === id ? null : state.selectedRoom,
    })),
}));

/**
 * Onboarding Data Store
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
        // College fields reset
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

// Export all stores
export default {
  useAuthStore,
  useInstitutionStore,
  useJobStore,
  useTimetableStore,
  useUIStore,
  useFacultyStore,
  useCourseStore,
  useRoomStore,
  useOnboardingStore,
};