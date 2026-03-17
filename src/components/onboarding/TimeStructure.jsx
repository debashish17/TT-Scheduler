import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ProgressBar from '../common/ProgressBar';
import { FaArrowRight, FaArrowLeft, FaUtensils } from 'react-icons/fa';

const TimeStructure = () => {
  const navigate = useNavigate();
  const [timeData, setTimeData] = useState({
    workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    startTime: '08:00',
    endTime: '17:00',
    theoryDuration: 50,
    labDuration: 110,
    tutorialDuration: 50,
    lunchBreak: { enabled: true, time: '13:00', duration: 60 },
    eveningBreak: { enabled: false, after: 5, duration: 10 }
  });

  const steps = ['Institution', 'Workflow', 'Departments', 'Time', 'Slots', 'Rooms', 'Rules'];

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  const toggleDay = (day) => {
    if (timeData.workingDays.includes(day)) {
      setTimeData({ ...timeData, workingDays: timeData.workingDays.filter(d => d !== day) });
    } else {
      setTimeData({ ...timeData, workingDays: [...timeData.workingDays, day] });
    }
  };

  const generatePreview = () => {
    const periods = [];
    let periodCount = 0;
    
    // Parse start and end times
    const [startHour, startMin] = timeData.startTime.split(':').map(Number);
    const [endHour, endMin] = timeData.endTime.split(':').map(Number);
    
    let currentHour = startHour;
    let currentMin = startMin;
    
    const formatTime = (hour, min) => {
      const h = hour % 12 || 12;
      const period = hour >= 12 ? 'PM' : 'AM';
      return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')} ${period}`;
    };
    
    const addMinutes = (hour, min, duration) => {
      min += duration;
      hour += Math.floor(min / 60);
      min = min % 60;
      return [hour, min];
    };
    
    const isBeforeEnd = (hour, min) => {
      const currentMinutes = hour * 60 + min;
      const endMinutes = endHour * 60 + endMin;
      return currentMinutes < endMinutes;
    };
    
    while (isBeforeEnd(currentHour, currentMin)) {
      // Check for lunch break
      const lunchTime = timeData.lunchBreak.time.split(':').map(Number);
      if (timeData.lunchBreak.enabled && currentHour === lunchTime[0] && currentMin === lunchTime[1]) {
        const lunchEnd = addMinutes(currentHour, currentMin, timeData.lunchBreak.duration);
        periods.push({
          time: `${formatTime(currentHour, currentMin)} - ${formatTime(lunchEnd[0], lunchEnd[1])}`,
          label: `🍴 Lunch (${timeData.lunchBreak.duration} min)`,
          isBreak: true
        });
        [currentHour, currentMin] = lunchEnd;
        continue;
      }
      
      // Check for evening break
      if (timeData.eveningBreak.enabled && periodCount === timeData.eveningBreak.after) {
        const breakEnd = addMinutes(currentHour, currentMin, timeData.eveningBreak.duration);
        periods.push({
          time: `${formatTime(currentHour, currentMin)} - ${formatTime(breakEnd[0], breakEnd[1])}`,
          label: `☕ Break (${timeData.eveningBreak.duration} min)`,
          isBreak: true
        });
        [currentHour, currentMin] = breakEnd;
        continue;
      }
      
      // Add regular period
      const periodEnd = addMinutes(currentHour, currentMin, timeData.theoryDuration);
      if (!isBeforeEnd(periodEnd[0], periodEnd[1])) break;
      
      periodCount++;
      periods.push({
        time: `${formatTime(currentHour, currentMin)} - ${formatTime(periodEnd[0], periodEnd[1])}`,
        label: `Period ${periodCount}`
      });
      [currentHour, currentMin] = periodEnd;
    }
    
    return { periods, totalPeriods: periodCount };
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="card">
        <ProgressBar currentStep={4} totalSteps={7} steps={steps} />

        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold mb-2 text-gray-800">Time Structure</h2>
            <p className="text-gray-600 mb-6">Define when classes can happen</p>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-6">
                {/* Working Days */}
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">
                    Working Days <span className="text-red-500">*</span>
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {days.map((day) => (
                      <button
                        key={day}
                        onClick={() => toggleDay(day)}
                        className={`px-4 py-2 rounded-lg font-medium transition-all ${
                          timeData.workingDays.includes(day)
                            ? 'bg-primary-600 text-white shadow-md'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {day.substring(0, 3)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Daily Schedule */}
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Daily Schedule</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Classes Start</label>
                      <input
                        type="time"
                        value={timeData.startTime}
                        onChange={(e) => setTimeData({ ...timeData, startTime: e.target.value })}
                        className="input-field"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Classes End</label>
                      <input
                        type="time"
                        value={timeData.endTime}
                        onChange={(e) => setTimeData({ ...timeData, endTime: e.target.value })}
                        className="input-field"
                      />
                    </div>
                  </div>
                </div>

                {/* Class Duration */}
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">
                    Class Duration <span className="text-red-500">*</span>
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Theory Class (minutes)</label>
                      <select
                        value={timeData.theoryDuration}
                        onChange={(e) => setTimeData({ ...timeData, theoryDuration: parseInt(e.target.value) })}
                        className="input-field"
                      >
                        <option value="45">45</option>
                        <option value="50">50</option>
                        <option value="55">55</option>
                        <option value="60">60</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Lab Session (minutes)</label>
                      <select
                        value={timeData.labDuration}
                        onChange={(e) => setTimeData({ ...timeData, labDuration: parseInt(e.target.value) })}
                        className="input-field"
                      >
                        <option value="90">90</option>
                        <option value="110">110 (2 hours)</option>
                        <option value="120">120</option>
                        <option value="180">180 (3 hours)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Tutorial/Practical (minutes)</label>
                      <select
                        value={timeData.tutorialDuration}
                        onChange={(e) => setTimeData({ ...timeData, tutorialDuration: parseInt(e.target.value) })}
                        className="input-field"
                      >
                        <option value="45">45</option>
                        <option value="50">50</option>
                        <option value="55">55</option>
                        <option value="60">60</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Break Times */}
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Break Times</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={timeData.lunchBreak.enabled}
                          onChange={(e) => setTimeData({
                            ...timeData,
                            lunchBreak: { ...timeData.lunchBreak, enabled: e.target.checked }
                          })}
                          className="w-4 h-4 text-primary-600"
                        />
                        <FaUtensils className="text-orange-600" />
                        <span className="font-medium">Lunch Break</span>
                      </div>
                      {timeData.lunchBreak.enabled && (
                        <div className="flex items-center space-x-2 text-sm">
                          <span>At</span>
                          <input
                            type="time"
                            value={timeData.lunchBreak.time}
                            onChange={(e) => setTimeData({
                              ...timeData,
                              lunchBreak: { ...timeData.lunchBreak, time: e.target.value }
                            })}
                            className="px-2 py-1 border rounded"
                          />
                          <span>,</span>
                          <input
                            type="number"
                            value={timeData.lunchBreak.duration}
                            onChange={(e) => setTimeData({
                              ...timeData,
                              lunchBreak: { ...timeData.lunchBreak, duration: parseInt(e.target.value) }
                            })}
                            className="w-16 px-2 py-1 border rounded"
                          />
                          <span>min</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Preview */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">
                  Preview: Your Daily Schedule
                  <span className="ml-2 text-xs text-blue-600">(Updates in real-time)</span>
                </h3>
                <div className="bg-gradient-to-br from-blue-50 to-purple-50 p-4 rounded-xl border border-blue-200">
                  <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
                    {generatePreview().periods.map((period, index) => (
                      <div
                        key={index}
                        className={`p-3 rounded-lg transition-all duration-200 ${
                          period.isBreak
                            ? 'bg-yellow-100 border border-yellow-300'
                            : 'bg-white border border-gray-200'
                        }`}
                      >
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-mono text-gray-700">{period.time}</span>
                          <span className={`text-sm font-medium ${period.isBreak ? 'text-yellow-800' : 'text-gray-900'}`}>
                            {period.label}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 pt-4 border-t border-blue-200">
                    <div className="text-sm text-gray-700 space-y-1">
                      <div className="flex justify-between">
                        <span>Total Periods per Day:</span>
                        <span className="font-semibold">{generatePreview().totalPeriods}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Total Periods per Week:</span>
                        <span className="font-semibold">
                          {generatePreview().totalPeriods * timeData.workingDays.length} ({timeData.workingDays.length} days × {generatePreview().totalPeriods} periods)
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-between mt-8 pt-6 border-t border-gray-200">
          <button onClick={() => navigate('/onboarding/departments')} className="btn-secondary flex items-center space-x-2">
            <FaArrowLeft />
            <span>Back</span>
          </button>
          <button onClick={() => navigate('/onboarding/slots')} className="btn-primary flex items-center space-x-2">
            <span>Next: Define Slots</span>
            <FaArrowRight />
          </button>
        </div>
      </div>
    </div>
  );
};

export default TimeStructure;
