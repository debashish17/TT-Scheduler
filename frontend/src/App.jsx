import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

// Onboarding Screens (simplified flow)
import WelcomeScreen from './components/onboarding/WelcomeScreen';          // Step 1: Institution + Teachers
import BatchSetup from './components/onboarding/BatchSetup';                // Step 2: Batches
import DepartmentSetup from './components/onboarding/DepartmentSetup';      // Step 3: Subjects
import TimeStructure from './components/onboarding/TimeStructure';          // Step 3: Schedule (days + periods)
import ClassroomSetup from './components/onboarding/ClassroomSetup';        // Step 4: Rooms
import Constraints from './components/onboarding/Constraints';              // Step 5: Rules
import SetupSummary from './components/onboarding/SetupSummary';            // Step 6: Review + Generate

// Timetable View Screens
import TimetableGrid from './components/timetable/TimetableGrid';           // Master grid
import FacultyView from './components/timetable/FacultyView';               // By teacher
import StudentView from './components/timetable/StudentView';               // By class

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gradient-to-br from-slate-100 to-blue-50 py-8">
        <div className="container mx-auto px-4">
          <Routes>
            {/* Redirect root to screen 1 */}
            <Route path="/" element={<Navigate to="/screen-1" replace />} />

            {/* === ONBOARDING FLOW === */}
            <Route path="/screen-1" element={<WelcomeScreen />} />       {/* Institution + Teachers */}
            <Route path="/screen-2" element={<BatchSetup />} />          {/* Batches */}
            <Route path="/screen-3" element={<DepartmentSetup />} />     {/* Subjects */}
            <Route path="/screen-4" element={<TimeStructure />} />       {/* Schedule */}
            <Route path="/screen-5" element={<ClassroomSetup />} />      {/* Rooms */}
            <Route path="/screen-6" element={<Constraints />} />         {/* Rules */}
            <Route path="/screen-7" element={<SetupSummary />} />        {/* Review + Generate */}

            {/* === TIMETABLE VIEWS === */}
            <Route path="/timetable" element={<TimetableGrid />} />
            <Route path="/faculty-view" element={<FacultyView />} />
            <Route path="/student-view" element={<StudentView />} />

            {/* Fallback: redirect old screen numbers or unknown paths */}
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
