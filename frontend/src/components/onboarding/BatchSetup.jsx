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

const BatchSetup = () => {
  const navigate = useNavigate();
  const { classesData, setClassesData } = useOnboardingStore();

  const [batches, setBatches] = useState(
    classesData?.length > 0 ? classesData : [
      { name: 'Class 6', size: 40 },
      { name: 'Class 7', size: 40 },
    ]
  );

  const addBatch = () => setBatches([...batches, { name: '', size: 30 }]);
  const removeBatch = (i) => setBatches(batches.filter((_, idx) => idx !== i));
  const update = (i, field, value) => {
    const updated = [...batches];
    updated[i][field] = value;
    setBatches(updated);
  };

  const handleNext = () => {
    const valid = batches.filter(b => b.name.trim() && b.size > 0);
    if (valid.length === 0) { alert('Add at least one valid batch'); return; }
    setClassesData(valid);
    navigate('/screen-3');
  };

  const totalStudents = batches.reduce((s, b) => s + (parseInt(b.size) || 0), 0);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-2xl shadow-lg p-8">
        <ProgressBar current={2} total={7} steps={steps} />

        <h2 className="text-2xl font-bold text-gray-800 mb-1">Batches & Classes</h2>
        <p className="text-gray-500 mb-6">Define the student batches (classes) that need timetables and their total strength.</p>

        <div className="bg-gray-50 rounded-lg p-4">
          <div className="grid grid-cols-12 gap-3 text-xs font-medium text-gray-500 uppercase mb-3">
            <div className="col-span-7">Batch / Class Name</div>
            <div className="col-span-4">Total Strength (Students)</div>
            <div className="col-span-1"></div>
          </div>

          {batches.map((batch, i) => (
            <div key={i} className="grid grid-cols-12 gap-3 mb-2">
              <div className="col-span-7">
                <input type="text" value={batch.name} onChange={e => update(i, 'name', e.target.value)}
                  placeholder="e.g. Class 6"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="col-span-4">
                <input type="number" value={batch.size} onChange={e => update(i, 'size', parseInt(e.target.value) || 0)}
                  min="1" max="500"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="col-span-1 flex items-center">
                <button onClick={() => removeBatch(i)} className="text-red-400 hover:text-red-600">
                  <FaTrash size={12} />
                </button>
              </div>
            </div>
          ))}

          <button onClick={addBatch} className="flex items-center space-x-1 text-blue-600 hover:text-blue-700 text-sm font-medium mt-3">
            <FaPlus size={12} />
            <span>Add Batch</span>
          </button>
        </div>

        <div className="mt-4 p-3 bg-blue-50 rounded-lg text-sm text-blue-800">
          📊 Total: <strong>{batches.length}</strong> batches, <strong>{totalStudents}</strong> students
        </div>

        <div className="flex justify-between mt-8 pt-6 border-t border-gray-200">
          <button onClick={() => navigate('/screen-1')}
            className="flex items-center space-x-2 px-5 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors">
            <FaArrowLeft />
            <span>Back</span>
          </button>
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

export default BatchSetup;
