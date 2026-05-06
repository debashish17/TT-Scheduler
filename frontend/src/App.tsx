import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

import { useRestoreSnapshot } from './hooks/useRestoreSnapshot';
import { useOnboardingStore } from './store';

const TimetableRouter: React.FC = () => {
  const { generatedTimetable } = useOnboardingStore();
  const isCollege = (generatedTimetable as any)?.solver === 'CP-SAT-College';
  return isCollege ? <CollegeTimetableGrid /> : <TimetableGrid />;
};

import LandingPage from './components/landing/LandingPage';
import DocsPage from './components/docs/DocsPage';
import AppShell from './components/layout/AppShell';
import DashboardPage from './components/dashboard/DashboardPage';

import Login from './components/auth/Login';
import Signup from './components/auth/Signup';
import ForgotPassword from './components/auth/ForgotPassword';
import ResetPassword from './components/auth/ResetPassword';
import ProtectedRoute from './components/common/ProtectedRoute';

import WorkflowSelector from './components/wizard/WorkflowSelector';
import WizardStep from './components/wizard/WizardStep';

import TimetableGrid from './components/timetable/TimetableGrid';
import CollegeTimetableGrid from './components/timetable/CollegeTimetableGrid';
import FacultyView from './components/timetable/FacultyView';
import StudentView from './components/timetable/StudentView';
import AnalyticsView from './components/timetable/AnalyticsView';
import TimetableHistory from './components/timetable/TimetableHistory';

function App() {
  useRestoreSnapshot();

  return (
    <Router>
      <Routes>
        {/* Public */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/docs" element={<DocsPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* Protected */}
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<AppShell><DashboardPage /></AppShell>} />

          {/* Wizard */}
          <Route path="/wizard" element={<AppShell><WorkflowSelector /></AppShell>} />
          <Route path="/wizard/step/1" element={<AppShell><WizardStep step={1} /></AppShell>} />
          <Route path="/wizard/step/2" element={<AppShell><WizardStep step={2} /></AppShell>} />
          <Route path="/wizard/step/3" element={<AppShell><WizardStep step={3} /></AppShell>} />
          <Route path="/wizard/step/4" element={<AppShell><WizardStep step={4} /></AppShell>} />
          <Route path="/wizard/step/5" element={<AppShell><WizardStep step={5} /></AppShell>} />
          <Route path="/wizard/step/6" element={<AppShell><WizardStep step={6} /></AppShell>} />
          <Route path="/wizard/step/7" element={<AppShell><WizardStep step={7} /></AppShell>} />

          {/* Timetable */}
          <Route path="/timetable" element={<AppShell><TimetableRouter /></AppShell>} />
          <Route path="/faculty-view" element={<AppShell><FacultyView /></AppShell>} />
          <Route path="/student-view" element={<AppShell><StudentView /></AppShell>} />
          <Route path="/analytics" element={<AppShell><AnalyticsView /></AppShell>} />
          <Route path="/history" element={<AppShell><TimetableHistory /></AppShell>} />
        </Route>

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
