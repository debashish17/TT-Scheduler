import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ProgressBar from '../common/ProgressBar';
import { FaArrowRight, FaArrowLeft, FaPlus, FaUpload } from 'react-icons/fa';

const SlotDefinition = () => {
  const navigate = useNavigate();
  const [useSlots, setUseSlots] = useState('yes');
  const [slotConfig, setSlotConfig] = useState({
    theoryGroups: 7,
    variantsPerGroup: 2
  });

  const steps = ['Institution', 'Workflow', 'Departments', 'Time', 'Slots', 'Rooms', 'Rules'];

  const theorySlots = [
    { code: 'A1', day1: 'Tuesday', time1: '09:00', day2: 'Thursday', time2: '09:00' },
    { code: 'A2', day1: 'Tuesday', time1: '09:00', day2: 'Thursday', time2: '09:00' },
    { code: 'B1', day1: 'Monday', time1: '10:00', day2: 'Wednesday', time2: '10:00' },
    { code: 'B2', day1: 'Monday', time1: '10:00', day2: 'Wednesday', time2: '10:00' },
    { code: 'C1', day1: 'Tuesday', time1: '11:00', day2: 'Thursday', time2: '11:00' },
    { code: 'C2', day1: 'Tuesday', time1: '11:00', day2: 'Thursday', time2: '11:00' }
  ];

  const labSlots = [
    { code: 'L1', day: 'Monday', startTime: '08:00', duration: 110 },
    { code: 'L2', day: 'Monday', startTime: '10:00', duration: 110 },
    { code: 'L3', day: 'Monday', startTime: '02:00', duration: 110 },
    { code: 'L4', day: 'Tuesday', startTime: '08:00', duration: 110 }
  ];

  return (
    <div className="max-w-6xl mx-auto">
      <div className="card">
        <ProgressBar currentStep={5} totalSteps={7} steps={steps} />

        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold mb-2 text-gray-800">Slot Definition</h2>
            <p className="text-gray-600 mb-6">Map time slots to your university's naming convention</p>

            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-700 mb-3">
                Do you use a slot-based system? <span className="text-red-500">*</span>
              </h3>
              
              <div className="space-y-3">
                <div
                  onClick={() => setUseSlots('yes')}
                  className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                    useSlots === 'yes'
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <div
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                        useSlots === 'yes' ? 'border-primary-500 bg-primary-500' : 'border-gray-300'
                      }`}
                    >
                      {useSlots === 'yes' && <div className="w-2.5 h-2.5 bg-white rounded-full" />}
                    </div>
                    <div>
                      <span className="font-medium">Yes - We use slots like A1, B1, C1 (VIT-style)</span>
                      <p className="text-sm text-gray-600">I'll define the slot mappings</p>
                    </div>
                  </div>
                </div>

                <div
                  onClick={() => setUseSlots('no')}
                  className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                    useSlots === 'no'
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <div
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                        useSlots === 'no' ? 'border-primary-500 bg-primary-500' : 'border-gray-300'
                      }`}
                    >
                      {useSlots === 'no' && <div className="w-2.5 h-2.5 bg-white rounded-full" />}
                    </div>
                    <div>
                      <span className="font-medium">No - Just use plain time slots</span>
                      <p className="text-sm text-gray-600">Skip slot setup, use direct time allocation</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {useSlots === 'yes' && (
              <>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                  <h3 className="font-medium mb-3">Slot Configuration</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-700 mb-2">
                        How many theory slot groups?
                      </label>
                      <select
                        value={slotConfig.theoryGroups}
                        onChange={(e) => setSlotConfig({ ...slotConfig, theoryGroups: parseInt(e.target.value) })}
                        className="input-field"
                      >
                        {[5, 6, 7, 8, 9, 10].map(n => (
                          <option key={n} value={n}>{n} (A, B, C, ...)</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-700 mb-2">
                        How many variants per group?
                      </label>
                      <select
                        value={slotConfig.variantsPerGroup}
                        onChange={(e) => setSlotConfig({ ...slotConfig, variantsPerGroup: parseInt(e.target.value) })}
                        className="input-field"
                      >
                        {[1, 2, 3, 4].map(n => (
                          <option key={n} value={n}>{n}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 mt-2">
                    This creates: A1, A2, B1, B2, C1, C2, D1, D2, E1, E2... 
                    <span className="font-semibold ml-1">
                      Total: {slotConfig.theoryGroups * slotConfig.variantsPerGroup} theory slots
                    </span>
                  </p>
                </div>

                {/* Theory Slots Table */}
                <div className="mb-6">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-lg font-semibold">Define Theory Slots</h3>
                    <div className="flex space-x-2">
                      <button className="px-4 py-2 bg-green-50 text-green-700 border border-green-200 rounded-lg hover:bg-green-100 transition-colors flex items-center space-x-2">
                        <FaUpload />
                        <span>Import from Excel</span>
                      </button>
                      <button className="px-4 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors">
                        Download Template
                      </button>
                    </div>
                  </div>
                  
                  <div className="overflow-x-auto bg-white rounded-lg border border-gray-200">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Slot Code</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Day 1</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time 1</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Day 2</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time 2</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {theorySlots.map((slot, index) => (
                          <tr key={index} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm font-medium text-gray-900">{slot.code}</td>
                            <td className="px-4 py-3 text-sm text-gray-700">{slot.day1}</td>
                            <td className="px-4 py-3 text-sm text-gray-700">{slot.time1}</td>
                            <td className="px-4 py-3 text-sm text-gray-700">{slot.day2}</td>
                            <td className="px-4 py-3 text-sm text-gray-700">{slot.time2}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Lab Slots Table */}
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-lg font-semibold">Define Lab Slots</h3>
                    <button className="px-4 py-2 bg-primary-50 text-primary-700 border border-primary-200 rounded-lg hover:bg-primary-100 transition-colors flex items-center space-x-2">
                      <FaPlus />
                      <span>Add Lab Slot</span>
                    </button>
                  </div>
                  
                  <div className="overflow-x-auto bg-white rounded-lg border border-gray-200">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Slot Code</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Day</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Start Time</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Duration</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {labSlots.map((slot, index) => (
                          <tr key={index} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm font-medium text-gray-900">{slot.code}</td>
                            <td className="px-4 py-3 text-sm text-gray-700">{slot.day}</td>
                            <td className="px-4 py-3 text-sm text-gray-700">{slot.startTime}</td>
                            <td className="px-4 py-3 text-sm text-gray-700">{slot.duration} min</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800 mb-2">
                    💡 <strong>Quick Setup:</strong> Import your current slot structure
                  </p>
                  <p className="text-sm text-yellow-700">
                    Upload your existing timetable Excel/PDF - We'll detect slot patterns automatically
                  </p>
                  <button className="mt-3 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors">
                    Upload Current Timetable
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="flex justify-between mt-8 pt-6 border-t border-gray-200">
          <button onClick={() => navigate('/onboarding/time-structure')} className="btn-secondary flex items-center space-x-2">
            <FaArrowLeft />
            <span>Back</span>
          </button>
          <button onClick={() => navigate('/onboarding/classrooms')} className="btn-primary flex items-center space-x-2">
            <span>Next: Classrooms</span>
            <FaArrowRight />
          </button>
        </div>
      </div>
    </div>
  );
};

export default SlotDefinition;
