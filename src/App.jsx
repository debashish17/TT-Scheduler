import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Header from './components/common/Header';
import WelcomeScreen from './components/onboarding/WelcomeScreen';
import WorkflowConfig from './components/onboarding/WorkflowConfig';
import DepartmentSetup from './components/onboarding/DepartmentSetup';
import TimeStructure from './components/onboarding/TimeStructure';
import SlotDefinition from './components/onboarding/SlotDefinition';
import ClassroomSetup from './components/onboarding/ClassroomSetup';
import Constraints from './components/onboarding/Constraints';
import SetupComplete from './components/onboarding/SetupComplete';
import GenerationSettings from './components/timetable/GenerationSettings';
import GenerationProgress from './components/timetable/GenerationProgress';
import SolutionComparison from './components/timetable/SolutionComparison';
import TimetableGrid from './components/timetable/TimetableGrid';
import FacultyView from './components/timetable/FacultyView';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
        <Header />
        <div className="container mx-auto px-4 py-8 max-w-7xl">
          <Routes>
            <Route path="/" element={<Navigate to="/onboarding/welcome" replace />} />
            <Route path="/onboarding/welcome" element={<WelcomeScreen />} />
            <Route path="/onboarding/workflow" element={<WorkflowConfig />} />
            <Route path="/onboarding/departments" element={<DepartmentSetup />} />
            <Route path="/onboarding/time-structure" element={<TimeStructure />} />
            <Route path="/onboarding/slots" element={<SlotDefinition />} />
            <Route path="/onboarding/classrooms" element={<ClassroomSetup />} />
            <Route path="/onboarding/constraints" element={<Constraints />} />
            <Route path="/onboarding/complete" element={<SetupComplete />} />
            <Route path="/timetable/generate" element={<GenerationSettings />} />
            <Route path="/timetable/progress" element={<GenerationProgress />} />
            <Route path="/timetable/comparison" element={<SolutionComparison />} />
            <Route path="/timetable/grid" element={<TimetableGrid />} />
            <Route path="/timetable/faculty" element={<FacultyView />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
}

export default App;
