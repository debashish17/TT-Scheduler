import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaArrowLeft, FaArrowRight, FaTrash, FaPlus } from 'react-icons/fa';
import { useOnboardingStore } from '../../store';

const steps = ['Institution', 'Batches', 'Subjects', 'Teachers', 'Schedule', 'Rooms', 'Rules', 'Generate'];

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

const TeacherSetup = () => {
  const navigate = useNavigate();
  const { subjectsData, teachersData, setTeachersData } = useOnboardingStore();

  const [teachers, setTeachers] = useState(() => {
    if (teachersData && teachersData.length > 0) {
      return teachersData;
    }
    return [
      { name: '', subjects: [] }
    ];
  });

  const addTeacher = () => setTeachers([...teachers, { name: '', subjects: [] }]);
  const removeTeacher = (i) => setTeachers(teachers.filter((_, idx) => idx !== i));
  const updateTeacherName = (i, value) => {
    const updated = [...teachers];
    updated[i].name = value;
    setTeachers(updated);
  };

  const toggleSubject = (i, subjectCode) => {
    const updated = [...teachers];
    const currentSubjects = updated[i].subjects;
    if (currentSubjects.includes(subjectCode)) {
      updated[i].subjects = currentSubjects.filter(code => code !== subjectCode);
    } else {
      updated[i].subjects = [...currentSubjects, subjectCode];
    }
    setTeachers(updated);
  };

  const handleNext = () => {
    const parsedTeachers = teachers
      .filter(t => t.name.trim())
      .map(t => ({
        name: t.name.trim(),
        subjects: t.subjects.map(s => s.trim().toUpperCase()).filter(Boolean),
      }));
    
    setTeachersData(parsedTeachers);
    navigate('/screen-5'); // Next is TimeStructure (was screen-4, now screen-5)
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-2xl shadow-lg p-8">
        <ProgressBar current={4} total={8} steps={steps} />

        <h2 className="text-2xl font-bold text-gray-800 mb-1">Teachers</h2>
        <p className="text-gray-500 mb-6">
          Add your teachers and select which subjects they can teach. You can assign multiple subjects per teacher or leave it blank to indicate they can teach anything.
        </p>

        <div className="bg-gray-50 rounded-xl p-6 border border-gray-100">
          <div className="space-y-6">
            {teachers.map((teacher, i) => (
              <div key={i} className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex-1 max-w-sm mr-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Teacher Name</label>
                    <input 
                      type="text" 
                      value={teacher.name} 
                      onChange={e => updateTeacherName(i, e.target.value)}
                      placeholder="e.g., Mr. Smith"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" 
                    />
                  </div>
                  <button onClick={() => removeTeacher(i)} className="text-red-400 hover:text-red-600 mt-5 p-2" title="Remove teacher">
                    <FaTrash size={14} />
                  </button>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Subjects Taught (Select all that apply)</label>
                  <div className="flex flex-wrap gap-2">
                    {subjectsData && subjectsData.length > 0 ? (
                        subjectsData.map((sub, idx) => {
                            const isSelected = teacher.subjects.includes(sub.code.toUpperCase());
                            return (
                                <button
                                    key={idx}
                                    onClick={() => toggleSubject(i, sub.code.toUpperCase())}
                                    className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
                                        isSelected 
                                        ? 'bg-blue-100 border-blue-500 text-blue-700 font-medium' 
                                        : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                                    }`}
                                >
                                    {sub.name} ({sub.code})
                                </button>
                            );
                        })
                    ) : (
                        <p className="text-xs text-amber-600 italic py-1">No subjects defined yet. You can go back to add them.</p>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-2">
                    * If you don't select any subjects, the algorithm assumes this teacher can teach any subject as needed (Auto-Resolve).
                  </p>
                </div>
              </div>
            ))}
            
            <button 
              onClick={addTeacher} 
              className="flex items-center justify-center w-full py-3 border-2 border-dashed border-blue-300 rounded-lg text-blue-600 hover:bg-blue-50 hover:border-blue-400 font-medium transition-all"
            >
              <FaPlus className="mr-2" size={14} />
              <span>Add Another Teacher</span>
            </button>
          </div>
        </div>

        <div className="flex justify-between mt-8 pt-6 border-t border-gray-200">
          <button onClick={() => navigate('/screen-3')}
            className="flex items-center space-x-2 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors">
            <FaArrowLeft />
            <span>Back: Subjects</span>
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

export default TeacherSetup;