import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaPlay, FaArrowLeft, FaSchool, FaBook, FaClock, FaDoorOpen, FaClipboardList } from 'react-icons/fa';
import { useOnboardingStore } from '../../store';
import { simpleTimetableAPI } from '../../api/client';

const SetupSummary = () => {
  const navigate = useNavigate();
  const {
    institutionData, subjectsData, teachersData, timeData, roomsData, constraintsData,
    setGeneratedTimetable, setTimetableError
  } = useOnboardingStore();

  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);

  const sections = [
    {
      icon: <FaSchool className="text-blue-500" />,
      title: 'Institution',
      ready: !!institutionData,
      detail: institutionData?.name || 'Not set',
      action: '/screen-1'
    },
    {
      icon: <FaBook className="text-green-500" />,
      title: 'Subjects',
      ready: subjectsData?.length > 0,
      detail: subjectsData?.length > 0
        ? `${subjectsData.length} subjects, ${subjectsData.reduce((s, sub) => s + (sub.periods_per_week || 0), 0)} periods/week/class`
        : 'No subjects added',
      action: '/screen-2'
    },
    {
      icon: <FaClock className="text-purple-500" />,
      title: 'Schedule',
      ready: !!timeData,
      detail: timeData
        ? `${timeData.workingDays?.length} days, ${timeData.periodsPerDay} periods/day`
        : 'Not set',
      action: '/screen-3'
    },
    {
      icon: <FaDoorOpen className="text-orange-500" />,
      title: 'Classrooms',
      ready: roomsData?.length > 0,
      detail: roomsData?.length > 0
        ? `${roomsData.length} rooms, total capacity: ${roomsData.reduce((s, r) => s + (r.capacity || 0), 0)}`
        : 'No rooms added',
      action: '/screen-4'
    },
    {
      icon: <FaClipboardList className="text-red-500" />,
      title: 'Rules',
      ready: !!constraintsData,
      detail: constraintsData
        ? `Max ${constraintsData.max_consecutive_periods} consecutive periods`
        : 'Using defaults',
      action: '/screen-5'
    },
  ];

  const allReady = sections.every(s => s.ready);
  const missingRequired = sections.filter(s => !s.ready && s.title !== 'Rules');

  const buildRequest = () => {
    const subj = (subjectsData || []).map(s => ({
      name: s.name,
      code: s.code,
      periods_per_week: s.periods_per_week || 3,
    }));

    const teachers = (teachersData || []).filter(t => t.name).map(t => ({
      name: t.name,
      subjects: t.subjects || [],
    }));

    // If no teachers, auto-generate one per subject
    const finalTeachers = teachers.length > 0 ? teachers :
      subj.map(s => ({ name: `${s.name} Teacher`, subjects: [s.code] }));

    // Build one class per entry (user said "school style" — one class for now)
    const classes = [{ name: 'Class A', size: 30 }];

    const rooms = (roomsData || []).map(r => ({
      name: r.name,
      capacity: parseInt(r.capacity) || 40,
    }));

    const td = timeData || {};
    const constraints = constraintsData || {};

    return {
      institution_name: institutionData?.name || 'My School',
      subjects: subj,
      teachers: finalTeachers,
      classes,
      rooms,
      working_days: td.workingDays || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      periods_per_day: td.periodsPerDay || 7,
      period_duration_minutes: td.periodDuration || 45,
      start_time: td.startTime || '08:00',
      constraints: {
        max_consecutive_periods: constraints.max_consecutive_periods || 3,
        lunch_after_period: constraints.lunch_after_period || (td.haslunch ? (td.lunchAfterPeriod || 4) : 0),
        max_periods_per_day_per_teacher: constraints.max_periods_per_day_per_teacher || 6,
      }
    };
  };

  const handleGenerate = async () => {
    if (missingRequired.length > 0) {
      setError(`Please complete: ${missingRequired.map(s => s.title).join(', ')}`);
      return;
    }
    setIsGenerating(true);
    setError(null);

    try {
      const request = buildRequest();
      console.log('Generating timetable with:', request);

      const response = await simpleTimetableAPI.generate(request);
      setGeneratedTimetable(response.data);
      navigate('/timetable');
    } catch (err) {
      const msg = err.response?.data?.detail || err.message || 'Generation failed';
      setError(msg);
      setTimetableError(msg);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-2xl shadow-lg p-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
            <FaPlay className="text-2xl text-green-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Ready to Generate</h1>
          <p className="text-gray-500 mt-1">Review your setup, then generate your timetable using the CP-SAT optimizer</p>
        </div>

        {/* Summary Cards */}
        <div className="space-y-3 mb-8">
          {sections.map((section, i) => (
            <div key={i} className={`flex items-center border rounded-xl p-4 ${
              section.ready ? 'border-green-200 bg-green-50' : 'border-yellow-200 bg-yellow-50'
            }`}>
              <div className="mr-3 text-xl">{section.icon}</div>
              <div className="flex-1">
                <div className="font-medium text-gray-800">{section.title}</div>
                <div className={`text-sm ${section.ready ? 'text-green-700' : 'text-yellow-700'}`}>{section.detail}</div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                  section.ready ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                }`}>{section.ready ? '✓ Ready' : '⚠ Missing'}</span>
                <button onClick={() => navigate(section.action)}
                  className="text-xs text-blue-600 hover:underline">Edit</button>
              </div>
            </div>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
            ❌ {error}
          </div>
        )}

        {/* Teacher note */}
        {(!teachersData || teachersData.length === 0) && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl text-blue-700 text-sm">
            💡 No teachers were added — the solver will auto-create one teacher per subject.
          </div>
        )}

        {/* Generate Button */}
        <div className="text-center">
          <button
            onClick={handleGenerate}
            disabled={isGenerating || missingRequired.length > 0}
            className={`px-10 py-4 rounded-xl font-semibold text-lg transition-all ${
              isGenerating || missingRequired.length > 0
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5'
            }`}>
            {isGenerating ? (
              <span className="flex items-center gap-3">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                Generating Timetable...
              </span>
            ) : '🎯 Generate Timetable with CP-SAT'}
          </button>
          {isGenerating && (
            <p className="text-sm text-gray-500 mt-3">The CP-SAT solver is optimizing your schedule. This may take up to 30 seconds.</p>
          )}
        </div>

        <div className="flex justify-start mt-8 pt-6 border-t border-gray-200">
          <button onClick={() => navigate('/screen-5')}
            className="flex items-center space-x-2 px-5 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors text-sm">
            <FaArrowLeft size={12} />
            <span>Back to Rules</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default SetupSummary;
