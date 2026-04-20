import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useRestoreSnapshot } from './hooks/useRestoreSnapshot';

// Design-system components
import LandingPage from './components/landing/LandingPage';
import AppShell from './components/layout/AppShell';
import DashboardPage from './components/dashboard/DashboardPage';

// Wizard — each step is its own page
import WorkflowSelector from './components/onboarding/wizard/WorkflowSelector';
import Step1Institution from './components/onboarding/wizard/Step1Institution';
import Step2Classes from './components/onboarding/wizard/Step2Classes';
import Step3Subjects from './components/onboarding/wizard/Step3Subjects';
import Step4Teachers from './components/onboarding/wizard/Step4Teachers';
import Step5Schedule from './components/onboarding/wizard/Step5Schedule';
import Step6Rooms from './components/onboarding/wizard/Step6Rooms';
import Step7Rules from './components/onboarding/wizard/Step7Rules';

// Auth
import Login from './components/auth/Login';
import Signup from './components/auth/Signup';
import ProtectedRoute from './components/common/ProtectedRoute';

// Timetable views
import TimetableGrid from './components/timetable/TimetableGrid';
import FacultyView from './components/timetable/FacultyView';
import StudentView from './components/timetable/StudentView';
import AnalyticsView from './components/timetable/AnalyticsView';
import TimetableHistory from './components/timetable/TimetableHistory';

// Legacy onboarding screens (still reachable via old URLs)
import WelcomeScreen from './components/onboarding/WelcomeScreen';
import BatchSetup from './components/onboarding/BatchSetup';
import DepartmentSetup from './components/onboarding/DepartmentSetup';
import TeacherSetup from './components/onboarding/TeacherSetup';
import TimeStructure from './components/onboarding/TimeStructure';
import ClassroomSetup from './components/onboarding/ClassroomSetup';
import Constraints from './components/onboarding/Constraints';
import SetupSummary from './components/onboarding/SetupSummary';
import SetupComplete from './components/onboarding/SetupComplete';

function App() {
  useRestoreSnapshot();

  return (
    <Router>
      <Routes>
        {/* ── Public ──────────────────────────────────────────── */}
        <Route path="/"       element={<LandingPage />} />
        <Route path="/login"  element={<Login />} />
        <Route path="/signup" element={<Signup />} />

        {/* ── Protected ───────────────────────────────────────── */}
        <Route element={<ProtectedRoute />}>
          {/* Dashboard */}
          <Route path="/dashboard" element={<AppShell><DashboardPage /></AppShell>} />

          {/* Wizard — workflow selector + 7 individual step pages */}
          <Route path="/wizard"         element={<AppShell><WorkflowSelector /></AppShell>} />
          <Route path="/wizard/step/1"  element={<AppShell><Step1Institution /></AppShell>} />
          <Route path="/wizard/step/2"  element={<AppShell><Step2Classes /></AppShell>} />
          <Route path="/wizard/step/3"  element={<AppShell><Step3Subjects /></AppShell>} />
          <Route path="/wizard/step/4"  element={<AppShell><Step4Teachers /></AppShell>} />
          <Route path="/wizard/step/5"  element={<AppShell><Step5Schedule /></AppShell>} />
          <Route path="/wizard/step/6"  element={<AppShell><Step6Rooms /></AppShell>} />
          <Route path="/wizard/step/7"  element={<AppShell><Step7Rules /></AppShell>} />

          {/* Timetable views */}
          <Route path="/timetable"   element={<AppShell><TimetableGrid /></AppShell>} />
          <Route path="/faculty-view" element={<AppShell><FacultyView /></AppShell>} />
          <Route path="/student-view" element={<AppShell><StudentView /></AppShell>} />
          <Route path="/analytics"   element={<AppShell><AnalyticsView /></AppShell>} />
          <Route path="/history"     element={<AppShell><TimetableHistory /></AppShell>} />

          {/* Legacy onboarding (kept accessible) */}
          <Route path="/screen-1" element={<WelcomeScreen />} />
          <Route path="/screen-2" element={<BatchSetup />} />
          <Route path="/screen-3" element={<DepartmentSetup />} />
          <Route path="/screen-4" element={<TeacherSetup />} />
          <Route path="/screen-5" element={<TimeStructure />} />
          <Route path="/screen-6" element={<ClassroomSetup />} />
          <Route path="/screen-7" element={<Constraints />} />
          <Route path="/screen-8" element={<SetupSummary />} />
          <Route path="/setup-complete" element={<SetupComplete />} />

          {/* Old redirects */}
          <Route path="/screen-9"  element={<Navigate to="/screen-7" replace />} />
          <Route path="/screen-10" element={<Navigate to="/timetable" replace />} />
          <Route path="/screen-11" element={<Navigate to="/timetable" replace />} />
          <Route path="/screen-12" element={<Navigate to="/timetable" replace />} />
          <Route path="/screen-13" element={<Navigate to="/faculty-view" replace />} />
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: 'var(--ink, #0A0A0A)',
            color: 'var(--paper, #FAF9F6)',
            borderRadius: '12px',
            padding: '14px 18px',
            fontFamily: 'Manrope, sans-serif',
            fontSize: '13px',
          },
          success: { duration: 3000 },
        }}
      />
    </Router>
  );
}

export default App;
