import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Header from './components/common/Header';
import { Toaster } from 'react-hot-toast';

// Onboarding Screens
import WelcomeScreen from './components/onboarding/WelcomeScreen';        // Step 1: Institution + Teachers
import BatchSetup from './components/onboarding/BatchSetup';              // Step 2: Batches
import DepartmentSetup from './components/onboarding/DepartmentSetup';    // Step 3: Subjects
import TimeStructure from './components/onboarding/TimeStructure';        // Step 4: Schedule
import ClassroomSetup from './components/onboarding/ClassroomSetup';      // Step 5: Rooms
import Constraints from './components/onboarding/Constraints';            // Step 6: Rules
import SetupSummary from './components/onboarding/SetupSummary';          // Step 7: Review + Generate
import WorkflowConfig from './components/onboarding/WorkflowConfig';      // Workflow chooser (optional)
import SetupComplete from './components/onboarding/SetupComplete';        // Setup complete confirmation

// Timetable View Screens
import TimetableGrid from './components/timetable/TimetableGrid';         // Master grid (class view)
import FacultyView from './components/timetable/FacultyView';             // By teacher
import StudentView from './components/timetable/StudentView';             // By class/student
import AnalyticsView from './components/timetable/AnalyticsView';         // Real analytics dashboard

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gradient-to-br from-slate-100 to-blue-50">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <Routes>
            {/* Redirect root to screen 1 */}
            <Route path="/" element={<Navigate to="/screen-1" replace />} />

            {/* === ONBOARDING FLOW === */}
            <Route path="/screen-1" element={<WelcomeScreen />} />     {/* Institution + Teachers */}
            <Route path="/screen-2" element={<BatchSetup />} />        {/* Batches */}
            <Route path="/screen-3" element={<DepartmentSetup />} />   {/* Subjects */}
            <Route path="/screen-4" element={<TimeStructure />} />     {/* Schedule */}
            <Route path="/screen-5" element={<ClassroomSetup />} />    {/* Rooms */}
            <Route path="/screen-6" element={<Constraints />} />       {/* Rules */}
            <Route path="/screen-7" element={<SetupSummary />} />      {/* Review + Generate */}

            {/* === ADDITIONAL ONBOARDING SCREENS === */}
            <Route path="/workflow" element={<WorkflowConfig />} />
            <Route path="/setup-complete" element={<SetupComplete />} />

            {/* === TIMETABLE VIEWS === */}
            <Route path="/timetable" element={<TimetableGrid />} />
            <Route path="/faculty-view" element={<FacultyView />} />
            <Route path="/student-view" element={<StudentView />} />
            <Route path="/analytics" element={<AnalyticsView />} />

            {/* Fallback redirects for old screen numbers */}
            <Route path="/screen-8" element={<Navigate to="/screen-7" replace />} />
            <Route path="/screen-9" element={<Navigate to="/screen-7" replace />} />
            <Route path="/screen-10" element={<Navigate to="/timetable" replace />} />
            <Route path="/screen-11" element={<Navigate to="/timetable" replace />} />
            <Route path="/screen-12" element={<Navigate to="/timetable" replace />} />
            <Route path="/screen-13" element={<Navigate to="/faculty-view" replace />} />
            <Route path="*" element={<Navigate to="/screen-1" replace />} />
          </Routes>
        </div>

        {/* Global Toast Notifications */}
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#1e293b',
              color: '#fff',
              borderRadius: '12px',
              padding: '14px 18px',
            },
            success: { duration: 3000 },
          }}
        />
      </div>
    </Router>
  );
}

export default App;
