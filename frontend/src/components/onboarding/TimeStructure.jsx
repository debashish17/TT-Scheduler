import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaArrowRight, FaArrowLeft } from 'react-icons/fa';
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

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const addMinutes = (timeStr, mins) => {
  const [h, m] = timeStr.split(':').map(Number);
  const total = h * 60 + m + mins;
  const newH = Math.floor(total / 60) % 24;
  const newM = total % 60;
  return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
};

const TimeStructure = () => {
  const navigate = useNavigate();
  const { timeData, setTimeData } = useOnboardingStore();

  const [data, setData] = useState(
    timeData || {
      workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      startTime: '08:00',
      periodDuration: 45,
      periodsPerDay: 7,
      lunchAfterPeriod: 4,
      lunchDuration: 30,
      haslunch: true,
    }
  );

  const toggleDay = (day) => {
    if (data.workingDays.includes(day)) {
      setData({ ...data, workingDays: data.workingDays.filter(d => d !== day) });
    } else {
      setData({ ...data, workingDays: [...data.workingDays, day] });
    }
  };

  // Generate preview of time slots
  const generatePreview = () => {
    const slots = [];
    let curr = data.startTime;
    for (let p = 1; p <= data.periodsPerDay; p++) {
      if (data.haslunch && p === data.lunchAfterPeriod + 1) {
        const lunchEnd = addMinutes(curr, data.lunchDuration);
        slots.push({ label: `🍽️ Lunch Break`, time: `${curr} – ${lunchEnd}`, isBreak: true });
        curr = lunchEnd;
      }
      const end = addMinutes(curr, data.periodDuration);
      slots.push({ label: `Period ${p}`, time: `${curr} – ${end}`, isBreak: false });
      curr = end;
    }
    return slots;
  };

  const handleNext = () => {
    if (data.workingDays.length === 0) { alert('Select at least one working day'); return; }
    setTimeData(data);
    navigate('/screen-5');
  };

  const preview = generatePreview();

  return (
    <div className="max-w-5xl mx-auto">
      <div className="bg-white rounded-2xl shadow-lg p-8">
        <ProgressBar current={4} total={7} steps={steps} />

        <h2 className="text-2xl font-bold text-gray-800 mb-1">Schedule Structure</h2>
        <p className="text-gray-500 mb-6">Define when classes happen and how long each period is.</p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left: Settings */}
          <div className="space-y-6">
            {/* Working Days */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Working Days</h3>
              <div className="flex flex-wrap gap-2">
                {DAYS.map(day => (
                  <button key={day} onClick={() => toggleDay(day)}
                    className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                      data.workingDays.includes(day)
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}>
                    {day.slice(0, 3)}
                  </button>
                ))}
              </div>
            </div>

            {/* Start Time */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Classes Start At</label>
              <input type="time" value={data.startTime}
                onChange={e => setData({ ...data, startTime: e.target.value })}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
            </div>

            {/* Period Duration */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Period Duration (minutes)</label>
              <select value={data.periodDuration} onChange={e => setData({ ...data, periodDuration: parseInt(e.target.value) })}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                {[40, 45, 50, 55, 60].map(d => <option key={d} value={d}>{d} minutes</option>)}
              </select>
            </div>

            {/* Periods per day */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Periods Per Day</label>
              <div className="flex items-center gap-3">
                <button onClick={() => setData({ ...data, periodsPerDay: Math.max(1, data.periodsPerDay - 1) })}
                  className="w-8 h-8 bg-gray-200 rounded-full text-lg font-bold hover:bg-gray-300 flex items-center justify-center">−</button>
                <span className="text-2xl font-bold text-blue-600 w-8 text-center">{data.periodsPerDay}</span>
                <button onClick={() => setData({ ...data, periodsPerDay: Math.min(15, data.periodsPerDay + 1) })}
                  className="w-8 h-8 bg-gray-200 rounded-full text-lg font-bold hover:bg-gray-300 flex items-center justify-center">+</button>
              </div>
            </div>

            {/* Lunch break */}
            <div>
              <label className="flex items-center space-x-2 mb-3 cursor-pointer">
                <input type="checkbox" checked={data.haslunch} onChange={e => setData({ ...data, haslunch: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded" />
                <span className="text-sm font-semibold text-gray-700">Lunch Break</span>
              </label>
              {data.haslunch && (
                <div className="ml-6 flex flex-wrap gap-4">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">After period</label>
                    <input type="number" value={data.lunchAfterPeriod}
                      onChange={e => setData({ ...data, lunchAfterPeriod: parseInt(e.target.value) || 1 })}
                      min="1" max={data.periodsPerDay}
                      className="w-20 px-2 py-1.5 border border-gray-300 rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Duration (min)</label>
                    <select value={data.lunchDuration} onChange={e => setData({ ...data, lunchDuration: parseInt(e.target.value) })}
                      className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm">
                      {[20, 30, 45, 60].map(d => <option key={d} value={d}>{d} min</option>)}
                    </select>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right: Preview */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">
              Daily Schedule Preview
              <span className="text-xs font-normal text-blue-500 ml-2">(live preview)</span>
            </h3>
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100 p-4 max-h-96 overflow-y-auto">
              {preview.map((slot, i) => (
                <div key={i} className={`mb-2 px-3 py-2 rounded-lg flex justify-between items-center text-sm ${
                  slot.isBreak ? 'bg-yellow-100 border border-yellow-200' : 'bg-white border border-gray-100 shadow-sm'
                }`}>
                  <span className={slot.isBreak ? 'text-yellow-800 font-medium' : 'text-gray-800 font-medium'}>{slot.label}</span>
                  <span className="text-gray-500 font-mono text-xs">{slot.time}</span>
                </div>
              ))}
              <div className="mt-3 pt-3 border-t border-blue-200 text-sm text-gray-600">
                <div className="flex justify-between">
                  <span>Working days:</span>
                  <strong>{data.workingDays.length}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Periods/week:</span>
                  <strong>{data.periodsPerDay * data.workingDays.length}</strong>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-between mt-8 pt-6 border-t border-gray-200">
          <button onClick={() => navigate('/screen-3')}
            className="flex items-center space-x-2 px-5 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors">
            <FaArrowLeft />
            <span>Back</span>
          </button>
          <button onClick={handleNext}
            className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors">
            <span>Next: Rooms</span>
            <FaArrowRight />
          </button>
        </div>
      </div>
    </div>
  );
};

export default TimeStructure;
