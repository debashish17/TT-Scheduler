import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaArrowRight, FaArrowLeft, FaPlus, FaTrash } from 'react-icons/fa';
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

const TEMPLATES = {
  primary: [
    { name: 'Mathematics', code: 'MATH', periods_per_week: 5 },
    { name: 'English', code: 'ENG', periods_per_week: 5 },
    { name: 'Science', code: 'SCI', periods_per_week: 4 },
    { name: 'Social Studies', code: 'SS', periods_per_week: 3 },
    { name: 'Art & Craft', code: 'ART', periods_per_week: 2 },
    { name: 'Physical Education', code: 'PE', periods_per_week: 2 },
  ],
  secondary: [
    { name: 'Mathematics', code: 'MATH', periods_per_week: 6 },
    { name: 'English', code: 'ENG', periods_per_week: 5 },
    { name: 'Physics', code: 'PHY', periods_per_week: 4 },
    { name: 'Chemistry', code: 'CHE', periods_per_week: 4 },
    { name: 'Biology', code: 'BIO', periods_per_week: 3 },
    { name: 'History', code: 'HIST', periods_per_week: 3 },
    { name: 'Physical Education', code: 'PE', periods_per_week: 2 },
  ],
  college: [
    { name: 'Data Structures', code: 'DS', periods_per_week: 4 },
    { name: 'Mathematics', code: 'MATH', periods_per_week: 4 },
    { name: 'Computer Networks', code: 'CN', periods_per_week: 3 },
    { name: 'Operating Systems', code: 'OS', periods_per_week: 3 },
    { name: 'English', code: 'ENG', periods_per_week: 2 },
  ],
};

const DepartmentSetup = () => {
  const navigate = useNavigate();
  const { classesData, subjectsData, setSubjectsData } = useOnboardingStore();

  const [subjects, setSubjects] = useState(
    subjectsData?.length > 0 ? subjectsData : [
      { name: 'Mathematics', code: 'MATH', periods_per_week: 5, target_classes: [] },
      { name: 'English', code: 'ENG', periods_per_week: 5, target_classes: [] },
      { name: 'Science', code: 'SCI', periods_per_week: 4, target_classes: [] },
      { name: 'Social Studies', code: 'SS', periods_per_week: 3, target_classes: [] },
    ]
  );

  const addSubject = () => setSubjects([...subjects, { name: '', code: '', periods_per_week: 3, target_classes: [] }]);
  const removeSubject = (i) => setSubjects(subjects.filter((_, idx) => idx !== i));
  const update = (i, field, value) => {
    const updated = [...subjects];
    // Always store numeric fields as numbers, not strings
    updated[i][field] = field === 'periods_per_week' ? (parseInt(value) || 1) : value;
    setSubjects(updated);
  };

  
  const toggleClass = (i, className) => {
    const updated = [...subjects];
    const target = updated[i].target_classes || [];
    if (target.includes(className)) {
      updated[i].target_classes = target.filter(c => c !== className);
    } else {
      updated[i].target_classes = [...target, className];
    }
    setSubjects(updated);
  };

  const handleNext = () => {
    const valid = subjects.filter(s => s.name.trim() && s.code.trim());
    if (valid.length === 0) { alert('Add at least one subject'); return; }
    setSubjectsData(valid);
    navigate('/screen-4');
  };

  const totalPeriods = subjects.reduce((s, sub) => s + (parseInt(sub.periods_per_week) || 0), 0);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-2xl shadow-lg p-8">
        <ProgressBar current={3} total={7} steps={steps} />

        <h2 className="text-2xl font-bold text-gray-800 mb-1">Subjects</h2>
        <p className="text-gray-500 mb-6">Add the subjects taught in your school and how many periods each needs per week.</p>

        {/* Quick templates */}
        <div className="flex flex-wrap gap-2 mb-6">
          <span className="text-sm font-medium text-gray-600 self-center">Quick templates:</span>
          {Object.entries({ primary: 'Primary School', secondary: 'Secondary School', college: 'College' }).map(([key, label]) => (
            <button key={key} onClick={() => setSubjects(TEMPLATES[key])}
              className="px-4 py-1.5 bg-blue-50 text-blue-700 text-sm rounded-lg border border-blue-200 hover:bg-blue-100 transition-colors">
              {label}
            </button>
          ))}
        </div>

        {/* Subjects table */}
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="grid grid-cols-12 gap-3 text-xs font-medium text-gray-500 uppercase mb-3">
            <div className="col-span-4">Subject Name & Targets</div>
            <div className="col-span-3">Code</div>
            <div className="col-span-3">Periods / Week</div>
            <div className="col-span-1"></div>
          </div>

          {subjects.map((subj, i) => (
            <div key={i} className="mb-4 border-b border-gray-100 pb-4">
              <div className="grid grid-cols-12 gap-3 mb-2">
                <div className="col-span-4">
                  <input type="text" value={subj.name} onChange={e => update(i, 'name', e.target.value)}
                    placeholder="Mathematics"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="col-span-3">
                  <input type="text" value={subj.code} onChange={e => update(i, 'code', e.target.value.toUpperCase())}
                    placeholder="MATH"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="col-span-3">
                  <input type="number" value={subj.periods_per_week} onChange={e => update(i, 'periods_per_week', parseInt(e.target.value) || 1)}
                    min="1" max="15"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="col-span-1 flex items-center">
                  <button onClick={() => removeSubject(i)} className="text-red-400 hover:text-red-600">
                    <FaTrash size={12} />
                  </button>
                </div>
              </div>
              
              {/* Target Classes Selection */}
              {classesData && classesData.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  <span className="text-[10px] uppercase text-gray-400 font-bold self-center">For Batches:</span>
                  {classesData.map((cls, idx) => {
                    const isSelected = (subj.target_classes || []).includes(cls.name);
                    return (
                      <button 
                        key={idx}
                        onClick={() => toggleClass(i, cls.name)}
                        className={`text-xs px-2 py-1 rounded-md border ${
                          isSelected 
                            ? 'bg-blue-100 text-blue-700 border-blue-300' 
                            : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
                        }`}
                      >
                        {cls.name}
                      </button>
                    );
                  })}
                  {(subj.target_classes || []).length === 0 && (
                    <span className="text-xs text-orange-500 italic self-center ml-2">(Applies to all batches if none selected)</span>
                  )}
                </div>
              )}
            </div>
          ))}

          <button onClick={addSubject} className="flex items-center space-x-1 text-blue-600 hover:text-blue-700 text-sm font-medium mt-3">
            <FaPlus size={12} />
            <span>Add Subject</span>
          </button>
        </div>

        <div className="mt-4 p-3 bg-blue-50 rounded-lg text-sm text-blue-800">
          📊 Total: <strong>{subjects.length}</strong> subjects, <strong>{totalPeriods}</strong> periods per week per class
        </div>

        <div className="flex justify-between mt-8 pt-6 border-t border-gray-200">
          <button onClick={() => navigate('/screen-2')}
            className="flex items-center space-x-2 px-5 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors">
            <FaArrowLeft />
            <span>Back</span>
          </button>
          <button onClick={handleNext}
            className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors">
            <span>Next: Schedule</span>
            <FaArrowRight />
          </button>
        </div>
      </div>
    </div>
  );
};

export default DepartmentSetup;
