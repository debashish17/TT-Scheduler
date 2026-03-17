import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaCheckCircle, FaClock, FaPlay, FaSave } from 'react-icons/fa';

const GenerationSettings = () => {
  const navigate = useNavigate();
  const [settings, setSettings] = useState({
    departments: {
      CS: true,
      IT: true,
      ECE: true,
      MECH: false
    },
    numSolutions: 3,
    maxTime: 5,
    optimization: 'balanced',
    advanced: {
      preferMorning: false,
      avoidFridayAfternoon: false,
      groupSections: false,
      autoCreateSections: true
    }
  });

  const [showAdvanced, setShowAdvanced] = useState(false);

  const startGeneration = () => {
    navigate('/timetable/progress');
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="card">
        <div className="mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Timetable Generation</h1>
              <p className="text-gray-600">Current Semester: Fall 2026</p>
            </div>
            <button className="text-primary-600 hover:text-primary-700 font-medium">
              Change Semester
            </button>
          </div>
        </div>

        {/* Data Status Check */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-5 mb-6">
          <h2 className="font-semibold text-green-900 mb-3">Data Status Check</h2>
          <div className="space-y-2">
            {[
              { label: 'Faculty', value: '45 members added' },
              { label: 'Courses', value: '120 courses added' },
              { label: 'Batches', value: '12 batches added' },
              { label: 'Rooms', value: '30 rooms available' },
              { label: 'Slots', value: '70 slots defined' }
            ].map((item, index) => (
              <div key={index} className="flex items-center space-x-2">
                <FaCheckCircle className="text-green-600" />
                <span className="text-sm text-green-800">
                  <strong>{item.label}:</strong> {item.value}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-green-200">
            <div className="flex items-center space-x-2">
              <FaCheckCircle className="text-green-600 text-lg" />
              <span className="font-semibold text-green-900">Status: Ready to generate timetable</span>
            </div>
          </div>
        </div>

        {/* Generation Settings */}
        <div className="space-y-6">
          <div className="bg-white border border-gray-200 rounded-lg p-5">
            <h2 className="font-semibold text-gray-900 mb-4">Generation Settings</h2>
            
            {/* Departments */}
            <div className="mb-5">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Departments to Include:
              </label>
              <div className="flex flex-wrap gap-3">
                {[
                  { key: 'CS', label: 'Computer Science', available: true },
                  { key: 'IT', label: 'Information Technology', available: true },
                  { key: 'ECE', label: 'Electronics', available: true },
                  { key: 'MECH', label: 'Mechanical', available: false }
                ].map(dept => (
                  <label
                    key={dept.key}
                    className={`flex items-center space-x-2 px-4 py-2 rounded-lg border cursor-pointer transition-colors ${
                      settings.departments[dept.key] && dept.available
                        ? 'bg-primary-50 border-primary-500'
                        : 'bg-gray-50 border-gray-300'
                    } ${!dept.available ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={settings.departments[dept.key]}
                      disabled={!dept.available}
                      onChange={(e) => setSettings({
                        ...settings,
                        departments: { ...settings.departments, [dept.key]: e.target.checked }
                      })}
                      className="w-4 h-4 text-primary-600"
                    />
                    <span className="text-sm font-medium">
                      {dept.label}
                      {!dept.available && <span className="text-xs text-gray-500 ml-1">(no courses)</span>}
                    </span>
                  </label>
                ))}
              </div>
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
              <h3 className="font-semibold text-gray-900">Advanced Options (Optional)</h3>
              <span className="text-gray-600">{showAdvanced ? '▲' : '▼'}</span>
            </button>
            
            {showAdvanced && (
              <div className="mt-4 space-y-3">
                {[
                  { key: 'preferMorning', label: 'Prefer morning classes over afternoon' },
                  { key: 'avoidFridayAfternoon', label: 'Avoid Friday afternoon classes' },
                  { key: 'groupSections', label: 'Group same course sections together' },
                  { key: 'autoCreateSections', label: 'Auto-create sections for large enrollments' }
                ].map(option => (
                  <label key={option.key} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={settings.advanced[option.key]}
                      onChange={(e) => setSettings({
                        ...settings,
                        advanced: { ...settings.advanced, [option.key]: e.target.checked }
                      })}
                      className="w-4 h-4 text-primary-600"
                    />
                    <span className="text-sm text-gray-700">{option.label}</span>
                  </label>
                ))}
                {settings.advanced.autoCreateSections && (
                  <p className="text-xs text-gray-600 ml-6">
                    (Create multiple sections if students &gt; room capacity)
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Warning */}
        <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-start space-x-2">
            <FaClock className="text-yellow-600 mt-0.5" />
            <div className="text-sm text-yellow-800">
              <strong>Note:</strong> Generation will take 3-5 minutes. You can close this page and check back later. 
              We'll notify you when complete.
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end space-x-4 mt-8 pt-6 border-t border-gray-200">
          <button className="btn-secondary flex items-center space-x-2">
            <FaSave />
            <span>Save as Draft</span>
          </button>
          <button onClick={startGeneration} className="btn-primary flex items-center space-x-2">
            <FaPlay />
            <span>Start Generation</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default GenerationSettings;
