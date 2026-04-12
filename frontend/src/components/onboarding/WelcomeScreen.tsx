import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaGraduationCap, FaArrowRight, FaPlus, FaTrash, FaHistory } from 'react-icons/fa';
import { useOnboardingStore } from '../../store';

const steps = ['Institution', 'Batches', 'Subjects', 'Schedule', 'Rooms', 'Rules', 'Generate'];

const ProgressBar = ({ current, total, steps: stepLabels }) => (
  <div className="mb-8">
    <div className="flex justify-between mb-2">
      {stepLabels.map((label, i) => (
        <div key={i} className="flex flex-col items-center">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
            i + 1 < current ? 'bg-green-500 text-white' :
            i + 1 === current ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'
          }`}>{i + 1 < current ? '✓' : i + 1}</div>
          <span className="text-xs text-gray-500 mt-1 hidden md:block">{label}</span>
        </div>
      ))}
    </div>
    <div className="w-full bg-gray-200 h-2 rounded-full">
      <div className="bg-blue-600 h-2 rounded-full transition-all" style={{ width: `${((current - 1) / (total - 1)) * 100}%` }} />
    </div>
  </div>
);

const WelcomeScreen = () => {
  const navigate = useNavigate();
  const { setInstitutionData, setTeachersData } = useOnboardingStore();

  const [formData, setFormData] = useState({
    institutionName: '',
    institutionType: 'School',
    city: '',
    country: 'India',
    email: '',
  });

  const [teachers, setTeachers] = useState([
    { name: '', subjects: '' },
  ]);

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const addTeacher = () => setTeachers([...teachers, { name: '', subjects: '' }]);
  const removeTeacher = (i) => setTeachers(teachers.filter((_, idx) => idx !== i));
  const updateTeacher = (i, field, value) => {
    const updated = [...teachers];
    updated[i][field] = value;
    setTeachers(updated);
  };

  const handleNext = () => {
    setInstitutionData({
      name: formData.institutionName || 'My School',
      type: formData.institutionType,
      city: formData.city,
      country: formData.country,
      email: formData.email,
    });

    // Parse teachers: subjects field is comma-separated codes
    const parsedTeachers = teachers
      .filter(t => t.name.trim())
      .map(t => ({
        name: t.name.trim(),
        subjects: t.subjects.split(',').map(s => s.trim().toUpperCase()).filter(Boolean),
      }));
    setTeachersData(parsedTeachers);

    navigate('/screen-2');
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-2xl shadow-lg p-8">
        {/* Header with History shortcut */}
        <div className="flex items-start justify-between mb-8">
          <div className="text-center flex-1">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
              <FaGraduationCap className="text-3xl text-blue-600" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900">Smart Timetable Scheduler</h1>
            <p className="text-gray-500 mt-1">Set up your institution in a few easy steps</p>
          </div>
          <button
            onClick={() => navigate('/history')}
            title="View your previously generated timetables"
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-indigo-600 border border-indigo-200 bg-indigo-50 rounded-xl hover:bg-indigo-100 transition-colors shrink-0"
          >
            <FaHistory size={13} />
            My History
          </button>
        </div>

        <ProgressBar current={1} total={7} steps={steps} />

        <div className="space-y-6">
          {/* Institution Info */}
          <div>
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Institution Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">School Name *</label>
                <input type="text" name="institutionName" value={formData.institutionName}
                  onChange={handleChange} placeholder="e.g., St. Xavier's High School"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select name="institutionType" value={formData.institutionType} onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                  <option>School</option>
                  <option>College</option>
                  <option>University</option>
                  <option>Coaching Institute</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                <input type="text" name="city" value={formData.city} onChange={handleChange}
                  placeholder="e.g., Mumbai"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input type="email" name="email" value={formData.email} onChange={handleChange}
                  placeholder="admin@school.edu"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
          </div>

          {/* Teachers */}
          <div>
            <h2 className="text-xl font-semibold text-gray-800 mb-1">Teachers <span className="text-sm font-normal text-gray-500">(optional — can add more later)</span></h2>
            <p className="text-sm text-gray-500 mb-4">Add teachers and which subjects they can teach. Leave subjects blank = can teach all.</p>

            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <div className="grid grid-cols-12 gap-3 text-xs font-medium text-gray-500 uppercase">
                <div className="col-span-5">Teacher Name</div>
                <div className="col-span-6">Subjects They Teach (codes, comma-separated)</div>
                <div className="col-span-1"></div>
              </div>
              {teachers.map((teacher, i) => (
                <div key={i} className="grid grid-cols-12 gap-3">
                  <div className="col-span-5">
                    <input type="text" value={teacher.name} onChange={e => updateTeacher(i, 'name', e.target.value)}
                      placeholder="Mr. Smith"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div className="col-span-6">
                    <input type="text" value={teacher.subjects} onChange={e => updateTeacher(i, 'subjects', e.target.value)}
                      placeholder="MATH, SCI, ENG"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div className="col-span-1 flex items-center justify-center">
                    <button onClick={() => removeTeacher(i)} className="text-red-400 hover:text-red-600">
                      <FaTrash size={12} />
                    </button>
                  </div>
                </div>
              ))}
              <button onClick={addTeacher} className="flex items-center space-x-2 text-blue-600 hover:text-blue-700 text-sm font-medium mt-2">
                <FaPlus size={12} />
                <span>Add Teacher</span>
              </button>
            </div>
          </div>
        </div>

        <div className="flex justify-end mt-8 pt-6 border-t border-gray-200">
          <button onClick={handleNext}
            className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors">
            <span>Next: Subjects</span>
            <FaArrowRight />
          </button>
        </div>
      </div>
    </div>
  );
};

export default WelcomeScreen;
