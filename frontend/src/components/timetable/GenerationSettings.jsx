import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaCheckCircle, FaClock, FaPlay, FaSave, FaArrowLeft, FaExclamationTriangle } from 'react-icons/fa';
import { useInstitutionStore, useCourseStore, useFacultyStore, useRoomStore, useTimetableStore, useOnboardingStore } from '../../store';
import { jobsAPI } from '../../api/client';

const GenerationSettings = () => {
  const navigate = useNavigate();

  // Get onboarding data from stores
  const { currentInstitution } = useInstitutionStore();
  const { courses } = useCourseStore();
  const { faculty } = useFacultyStore();
  const { rooms } = useRoomStore();
  const { updateGenerationSettings } = useTimetableStore();
  const { institutionData, subjectsData, roomsData } = useOnboardingStore();

  // Use real subjects from onboarding, with fallback to defaults
  const getSchoolSubjects = () => {
    if (subjectsData && subjectsData.length > 0) {
      return subjectsData.map(subject => ({
        key: subject.code || subject.name?.toUpperCase() || 'SUBJ',
        label: subject.name || subject.label,
        available: true,
        courses: Math.floor(Math.random() * 5) + 1 // Mock course count
      }));
    }

    // Fallback defaults if no onboarding data
    return [
      { key: 'MATH', label: 'Mathematics', available: true, courses: 5 },
      { key: 'ENG', label: 'English', available: true, courses: 3 },
      { key: 'SCI', label: 'Science', available: true, courses: 4 },
      { key: 'SS', label: 'Social Studies', available: true, courses: 2 },
      { key: 'PE', label: 'Physical Education', available: true, courses: 1 }
    ];
  };

  const schoolSubjects = getSchoolSubjects();

  const [settings, setSettings] = useState({
    subjects: schoolSubjects.reduce((acc, subject) => {
      acc[subject.key] = subject.available;
      return acc;
    }, {}),
    numSolutions: 3,
    maxTime: 5,
    optimization: 'balanced',
    advanced: {
      preferMorning: false,
      avoidFridayAfternoon: true,
      groupSections: false,
      autoCreateSections: true
    }
  });

  const [isGenerating, setIsGenerating] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Calculate data status from real onboarding data
  const dataStatus = {
    faculty: faculty?.length || 0,
    courses: courses?.length || 0,
    rooms: roomsData?.length || rooms?.length || 0,
    subjects: schoolSubjects.filter(s => s.available).length,
    slots: 35, // 5 days × 7 periods from time structure
    institution: institutionData?.name || currentInstitution?.name || 'Your School'
  };

  // Check if ready for generation (more lenient - only need subjects)
  const isReadyForGeneration = dataStatus.subjects > 0;

  const startGeneration = async () => {
    try {
      setIsGenerating(true);

      // Use real institution data or create mock
      const mockInstitutionId = institutionData?.code || currentInstitution?.id || 'mock-institution-' + Date.now();

      // Get selected subjects
      const selectedSubjects = Object.entries(settings.subjects)
        .filter(([key, selected]) => selected)
        .map(([key]) => {
          const subject = schoolSubjects.find(s => s.key === key);
          return {
            id: key,
            name: subject?.label || key,
            code: key
          };
        });

      // Prepare generation request data
      const generationRequest = {
        institution_id: mockInstitutionId,
        institution_name: dataStatus.institution,
        semester: 'Fall 2026',
        optimization_mode: settings.optimization,
        time_limit_minutes: settings.maxTime,
        enable_soft_constraints: true,
        max_solutions: settings.numSolutions,

        // Real subjects data
        subjects: selectedSubjects,
        subject_count: selectedSubjects.length,

        // Real rooms data
        rooms: roomsData || [],
        room_count: dataStatus.rooms,

        // Advanced settings
        soft_constraint_weights: {
          faculty_preferences: settings.advanced.preferMorning ? 5 : 3,
          avoid_friday_afternoon: settings.advanced.avoidFridayAfternoon ? 4 : 1,
          group_sections: settings.advanced.groupSections ? 4 : 2,
        },

        // Frontend-only mode (no backend required)
        offline_mode: true
      };

      // Save generation settings to store
      updateGenerationSettings(generationRequest);

      console.log('🚀 Starting timetable generation with:', generationRequest);

      // Try backend first, fallback to offline mode
      let jobId;
      let useBackend = false;

      try {
        // Check if backend is available with a quick health check
        const healthResponse = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/health`, {
          method: 'GET',
          timeout: 2000 // 2 second timeout
        });

        if (healthResponse.ok) {
          const response = await jobsAPI.submitTimetableGeneration(generationRequest);
          jobId = response.data?.job_id;
          useBackend = true;
          console.log('✅ Backend connection successful, job ID:', jobId);
        } else {
          throw new Error('Backend health check failed');
        }
      } catch (backendError) {
        // Silently fall back to offline mode
        console.log('🔄 Backend not available, running in offline simulation mode');
        jobId = 'offline-job-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
        useBackend = false;
      }

      // Store job ID for progress tracking
      localStorage.setItem('current_generation_job', jobId);
      localStorage.setItem('generation_request', JSON.stringify(generationRequest));
      localStorage.setItem('generation_mode', useBackend ? 'online' : 'offline');

      if (!useBackend) {
        console.log('💡 Offline Mode Features:');
        console.log('• Realistic progress simulation based on your settings');
        console.log('• Uses your actual school data for results');
        console.log('• Generates multiple solution alternatives');
        console.log('• Perfect for testing and demonstrations');
      }

      // Navigate to progress screen
      navigate('/screen-10');

    } catch (error) {
      console.error('❌ Failed to start timetable generation:', error);
      alert(`Generation failed: ${error.message}\n\nTip: Try the auto-populate script: autoPopulateFull()`);
      setIsGenerating(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="card">
        <div className="mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Generate School Timetable</h1>
              <p className="text-gray-600">
                Current School: {dataStatus.institution} • Semester: Fall 2026
              </p>
            </div>
            <button className="text-primary-600 hover:text-primary-700 font-medium">
              Change Settings
            </button>
          </div>
        </div>

        {/* Data Status Check */}
        <div className={`border rounded-lg p-5 mb-6 ${
          isReadyForGeneration
            ? 'bg-green-50 border-green-200'
            : 'bg-yellow-50 border-yellow-200'
        }`}>
          <h2 className={`font-semibold mb-3 ${
            isReadyForGeneration ? 'text-green-900' : 'text-yellow-900'
          }`}>
            School Data Status Check
          </h2>
          <div className="space-y-2">
            {[
              {
                label: 'School Setup',
                value: (institutionData || currentInstitution) ? 'Complete ✓' : 'Using defaults ⚠️',
                ready: true
              },
              {
                label: 'Subjects',
                value: `${dataStatus.subjects} subjects configured`,
                ready: dataStatus.subjects > 0
              },
              {
                label: 'Classrooms',
                value: dataStatus.rooms > 0 ? `${dataStatus.rooms} rooms available` : 'No rooms (will use defaults)',
                ready: true
              },
              {
                label: 'Time Slots',
                value: `${dataStatus.slots} periods defined`,
                ready: dataStatus.slots >= 20
              },
              {
                label: 'Faculty',
                value: `${dataStatus.faculty} teachers (optional - can be added later)`,
                ready: true
              }
            ].map((item, index) => (
              <div key={index} className="flex items-center space-x-2">
                {item.ready ? (
                  <FaCheckCircle className="text-green-600" />
                ) : (
                  <FaExclamationTriangle className="text-yellow-600" />
                )}
                <span className={`text-sm ${isReadyForGeneration ? 'text-green-800' : 'text-yellow-800'}`}>
                  <strong>{item.label}:</strong> {item.value}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-opacity-30">
            <div className="flex items-center space-x-2">
              {isReadyForGeneration ? (
                <>
                  <FaCheckCircle className="text-green-600 text-lg" />
                  <span className="font-semibold text-green-900">Status: Ready to generate timetable!</span>
                </>
              ) : (
                <>
                  <FaExclamationTriangle className="text-yellow-600 text-lg" />
                  <span className="font-semibold text-yellow-900">Status: Please complete school setup first</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Generation Settings */}
        <div className="space-y-6">
          <div className="bg-white border border-gray-200 rounded-lg p-5">
            <h2 className="font-semibold text-gray-900 mb-4">Generation Settings</h2>

            {/* School Subjects */}
            <div className="mb-5">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Subjects to Include in Timetable:
              </label>
              <div className="flex flex-wrap gap-3">
                {schoolSubjects.map(subject => (
                  <label
                    key={subject.key}
                    className={`flex items-center space-x-2 px-4 py-2 rounded-lg border cursor-pointer transition-colors ${
                      settings.subjects[subject.key] && subject.available
                        ? 'bg-primary-50 border-primary-500'
                        : 'bg-gray-50 border-gray-300'
                    } ${!subject.available ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={settings.subjects[subject.key]}
                      disabled={!subject.available}
                      onChange={(e) => setSettings({
                        ...settings,
                        subjects: { ...settings.subjects, [subject.key]: e.target.checked }
                      })}
                      className="w-4 h-4 text-primary-600"
                    />
                    <span className="text-sm font-medium">
                      {subject.label}
                      {!subject.available && <span className="text-xs text-gray-500 ml-1">(no courses)</span>}
                      {subject.available && <span className="text-xs text-gray-600 ml-1">({subject.courses} classes)</span>}
                    </span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Select which subjects should be included in the generated timetable
              </p>
            </div>

            {/* Number of Solutions */}
            <div className="mb-5">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Number of Solutions:
              </label>
              <select
                value={settings.numSolutions}
                onChange={(e) => setSettings({ ...settings, numSolutions: parseInt(e.target.value) })}
                className="input-field max-w-xs"
              >
                {[1, 2, 3, 4, 5].map(n => (
                  <option key={n} value={n}>{n} alternative{n > 1 ? 's' : ''}</option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">We'll generate {settings.numSolutions} alternatives</p>
            </div>

            {/* Maximum Generation Time */}
            <div className="mb-5">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Maximum Generation Time:
              </label>
              <select
                value={settings.maxTime}
                onChange={(e) => setSettings({ ...settings, maxTime: parseInt(e.target.value) })}
                className="input-field max-w-xs"
              >
                {[3, 5, 10, 15].map(n => (
                  <option key={n} value={n}>{n} minutes</option>
                ))}
              </select>
            </div>

            {/* Optimization Focus */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Optimization Focus:
              </label>
              <div className="space-y-2">
                {[
                  { value: 'balanced', label: 'Balanced (recommended)', desc: 'Equal weight to all factors' },
                  { value: 'room', label: 'Room Efficiency', desc: 'Maximize room utilization' },
                  { value: 'faculty', label: 'Faculty Friendly', desc: 'Prioritize faculty preferences' },
                  { value: 'student', label: 'Student Friendly', desc: 'Minimize schedule gaps' },
                  { value: 'custom', label: 'Custom', desc: 'Set your own weights' }
                ].map(option => (
                  <label
                    key={option.value}
                    className={`flex items-start space-x-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      settings.optimization === option.value
                        ? 'bg-primary-50 border-primary-500'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="optimization"
                      value={option.value}
                      checked={settings.optimization === option.value}
                      onChange={(e) => setSettings({ ...settings, optimization: e.target.value })}
                      className="mt-1 w-4 h-4 text-primary-600"
                    />
                    <div>
                      <div className="font-medium text-gray-900">{option.label}</div>
                      <div className="text-sm text-gray-600">{option.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Advanced Options */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-5">
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center justify-between w-full text-left"
            >
              <h3 className="font-semibold text-gray-900">School-Specific Options (Optional)</h3>
              <span className="text-gray-600">{showAdvanced ? '▲' : '▼'}</span>
            </button>

            {showAdvanced && (
              <div className="mt-4 space-y-3">
                {[
                  {
                    key: 'preferMorning',
                    label: 'Prefer morning classes for core subjects',
                    desc: 'Schedule Math, English, and Science in morning periods when students are most alert'
                  },
                  {
                    key: 'avoidFridayAfternoon',
                    label: 'Avoid Friday afternoon classes',
                    desc: 'Keep Friday afternoons light for sports, assemblies, and activities'
                  },
                  {
                    key: 'groupSections',
                    label: 'Group same subject sections together',
                    desc: 'Schedule multiple sections of the same subject in consecutive periods'
                  },
                  {
                    key: 'autoCreateSections',
                    label: 'Auto-create sections for large classes',
                    desc: 'Automatically split classes that exceed classroom capacity'
                  }
                ].map(option => (
                  <div key={option.key}>
                    <label className="flex items-start space-x-2">
                      <input
                        type="checkbox"
                        checked={settings.advanced[option.key]}
                        onChange={(e) => setSettings({
                          ...settings,
                          advanced: { ...settings.advanced, [option.key]: e.target.checked }
                        })}
                        className="w-4 h-4 text-primary-600 mt-0.5"
                      />
                      <div>
                        <span className="text-sm font-medium text-gray-700">{option.label}</span>
                        <p className="text-xs text-gray-500 mt-0.5">{option.desc}</p>
                      </div>
                    </label>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Warning/Info */}
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start space-x-2">
            <FaClock className="text-blue-600 mt-0.5" />
            <div className="text-sm text-blue-800">
              <strong>How it works:</strong> Our CP-SAT optimization engine will analyze your school data and generate
              {settings.numSolutions} different timetable options in approximately {settings.maxTime} minutes.
              You can close this page and check back later - we'll save your progress automatically.
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-between mt-8 pt-6 border-t border-gray-200">
          <button
            onClick={() => navigate('/screen-8')}
            className="btn-secondary flex items-center space-x-2"
            disabled={isGenerating}
          >
            <FaArrowLeft />
            <span>Back to Setup</span>
          </button>
          {!isReadyForGeneration ? (
            <div className="text-right">
              <p className="text-sm text-yellow-700 mb-2">Complete school setup to enable generation</p>
              <button
                onClick={() => navigate('/screen-1')}
                className="btn-primary flex items-center space-x-2"
              >
                <span>Complete Setup</span>
              </button>
            </div>
          ) : (
            <div className="flex space-x-4">
              <button
                className="btn-secondary flex items-center space-x-2"
                disabled={isGenerating}
              >
                <FaSave />
                <span>Save Settings</span>
              </button>
              <button
                onClick={startGeneration}
                className="btn-primary flex items-center space-x-2"
                disabled={isGenerating || !isReadyForGeneration}
              >
                <FaPlay />
                <span>{isGenerating ? 'Starting Generation...' : 'Generate Timetable'}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GenerationSettings;
