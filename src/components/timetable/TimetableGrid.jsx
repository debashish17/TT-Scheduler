import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaSave, FaFileExport, FaChartBar, FaCheck, FaTimes, FaEdit } from 'react-icons/fa';

const TimetableGrid = () => {
  const navigate = useNavigate();
  const [selectedCell, setSelectedCell] = useState(null);
  const [editMode, setEditMode] = useState(false);

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  const timeSlots = [
    { time: '08:00 - 08:50', code: 'A1' },
    { time: '09:00 - 09:50', code: 'B1' },
    { time: '10:00 - 10:15', code: 'BREAK', isBreak: true },
    { time: '10:15 - 11:05', code: 'C1' },
    { time: '11:05 - 11:55', code: 'D1' },
    { time: '12:00 - 01:00', code: 'LUNCH', isBreak: true },
    { time: '01:00 - 01:50', code: 'E1' },
    { time: '02:00 - 02:50', code: 'F1' }
  ];

  const timetableData = {
    Monday: {
      'A1': { course: 'CSE301', faculty: 'Dr.Rajesh', room: '101', batch: 'CS-23-A' },
      'B1': { course: 'MAT201', faculty: 'Dr.Kumar', room: '105', batch: 'CS-23-A' },
      'C1': { course: 'CSE303', faculty: 'Dr.Patel', room: '103', batch: 'CS-23-A' },
      'D1': { course: 'PHY201', faculty: 'Dr.Singh', room: '104', batch: 'CS-23-A' },
      'E1': { course: 'CSE401', faculty: 'Dr.Priya', room: '201', batch: 'CS-23-A' },
      'F1': { course: 'ENG201', faculty: 'Dr.Sharma', room: '102', batch: 'CS-23-A' }
    },
    Tuesday: {
      'A1': { course: 'CSE401', faculty: 'Dr.Priya', room: '203', batch: 'CS-23-A' },
      'B1': { course: 'CSE302', faculty: 'Dr.Sharma', room: '102', batch: 'CS-23-B' },
      'C1': { course: 'ENG201', faculty: 'Dr.Singh', room: '104', batch: 'CS-23-A' },
      'D1': { course: 'MAT201', faculty: 'Dr.Kumar', room: '105', batch: 'CS-23-B' },
      'E1': { course: 'CSE303', faculty: 'Dr.Patel', room: '103', batch: 'CS-23-B' },
      'F1': { course: 'PHY201', faculty: 'Dr.Verma', room: '106', batch: 'CS-23-B' }
    },
    Wednesday: {
      'A1': { course: 'CSE301', faculty: 'Dr.Rajesh', room: '101', batch: 'CS-23-B' },
      'B1': { course: 'MAT201', faculty: 'Dr.Kumar', room: '105', batch: 'CS-23-B' },
      'C1': { course: 'CSE303', faculty: 'Dr.Patel', room: '103', batch: 'CS-23-A' },
      'D1': null,
      'E1': { course: 'CSE401', faculty: 'Dr.Priya', room: '201', batch: 'CS-23-B' },
      'F1': { course: 'ENG201', faculty: 'Dr.Sharma', room: '102', batch: 'CS-23-B' }
    },
    Thursday: {
      'A1': { course: 'CSE401', faculty: 'Dr.Priya', room: '203', batch: 'CS-23-B' },
      'B1': { course: 'CSE302', faculty: 'Dr.Sharma', room: '102', batch: 'CS-23-A' },
      'C1': { course: 'ENG201', faculty: 'Dr.Singh', room: '104', batch: 'CS-23-A' },
      'D1': { course: 'MAT201', faculty: 'Dr.Kumar', room: '105', batch: 'CS-23-A' },
      'E1': null,
      'F1': { course: 'PHY201', faculty: 'Dr.Verma', room: '106', batch: 'CS-23-A' }
    },
    Friday: {
      'A1': { course: 'CSE302', faculty: 'Dr.Sharma', room: '102', batch: 'CS-23-A' },
      'B1': { course: 'CSE401', faculty: 'Dr.Verma', room: '201', batch: 'CS-24-A' },
      'C1': { course: 'MAT201', faculty: 'Dr.Kumar', room: '105', batch: 'CS-23-A' },
      'D1': { course: 'CSE303', faculty: 'Dr.Patel', room: '103', batch: 'CS-24-A' },
      'E1': null,
      'F1': null
    }
  };

  const handleCellClick = (day, slot) => {
    if (slot.isBreak) return;
    const cellData = timetableData[day]?.[slot.code];
    setSelectedCell({ day, slot: slot.code, data: cellData });
    setEditMode(true);
  };

  const closeModal = () => {
    setSelectedCell(null);
    setEditMode(false);
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="card">
        {/* Header */}
        <div className="mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Solution 1 - Balanced</h1>
              <p className="text-gray-600">Fall 2026 | Computer Science Department</p>
            </div>
            <div className="flex space-x-2">
              <button className="px-4 py-2 bg-primary-50 text-primary-700 border border-primary-200 rounded-lg hover:bg-primary-100 transition-colors text-sm font-medium">
                All Departments
              </button>
              <button 
                onClick={() => navigate('/timetable/faculty')}
                className="px-4 py-2 bg-green-50 text-green-700 border border-green-200 rounded-lg hover:bg-green-100 transition-colors text-sm font-medium"
              >
                Faculty View
              </button>
              <button className="px-4 py-2 bg-purple-50 text-purple-700 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors text-sm font-medium">
                Room View
              </button>
              <button className="px-4 py-2 bg-orange-50 text-orange-700 border border-orange-200 rounded-lg hover:bg-orange-100 transition-colors text-sm font-medium">
                Batch View
              </button>
            </div>
          </div>

          <div className="mt-4 flex space-x-3">
            <select className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm">
              <option>All Batches</option>
              <option>CS-23-A</option>
              <option>CS-23-B</option>
              <option>CS-24-A</option>
            </select>
            <select className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm">
              <option>All Faculty</option>
              <option>Dr. Rajesh</option>
              <option>Dr. Priya</option>
              <option>Dr. Kumar</option>
            </select>
            <select className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm">
              <option>All Rooms</option>
              <option>101</option>
              <option>102</option>
              <option>103</option>
            </select>
          </div>
        </div>

        {/* Timetable Grid */}
        <div className="overflow-x-auto mb-6">
          <table className="min-w-full border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-300 px-4 py-3 text-left text-sm font-semibold text-gray-700 w-32">
                  Time / Day
                </th>
                {days.map((day) => (
                  <th key={day} className="border border-gray-300 px-4 py-3 text-center text-sm font-semibold text-gray-700">
                    {day}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {timeSlots.map((slot, index) => (
                <tr key={index} className={slot.isBreak ? 'bg-yellow-50' : ''}>
                  <td className="border border-gray-300 px-4 py-3">
                    <div className="text-sm font-medium text-gray-900">{slot.time}</div>
                    <div className="text-xs text-gray-500">{slot.code}</div>
                  </td>
                  {days.map((day) => {
                    if (slot.isBreak) {
                      return (
                        <td key={day} className="border border-gray-300 text-center">
                          <div className="text-sm font-medium text-yellow-700">{slot.code}</div>
                        </td>
                      );
                    }
                    const cellData = timetableData[day]?.[slot.code];
                    return (
                      <td
                        key={day}
                        className="border border-gray-300 p-2 hover:bg-blue-50 cursor-pointer transition-colors"
                        onClick={() => handleCellClick(day, slot)}
                      >
                        {cellData ? (
                          <div className="bg-gradient-to-br from-blue-100 to-blue-200 rounded-lg p-3 shadow-sm">
                            <div className="text-sm font-bold text-blue-900">{cellData.course}</div>
                            <div className="text-xs text-blue-700">{cellData.faculty}</div>
                            <div className="text-xs text-blue-600">Room {cellData.room}</div>
                            <div className="text-xs text-blue-600">{cellData.batch}</div>
                          </div>
                        ) : (
                          <div className="h-20 flex items-center justify-center text-gray-400 text-xs">
                            Free
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-lg">
            <div className="text-2xl font-bold text-blue-700">145</div>
            <div className="text-sm text-blue-600">Total Classes</div>
          </div>
          <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-lg">
            <div className="text-2xl font-bold text-green-700">91%</div>
            <div className="text-sm text-green-600">Room Utilization</div>
          </div>
          <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-lg">
            <div className="text-2xl font-bold text-purple-700">45</div>
            <div className="text-sm text-purple-600">Faculty Assigned</div>
          </div>
          <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-lg">
            <div className="flex items-center space-x-2">
              <FaCheck className="text-green-600 text-3xl" />
              <div>
                <div className="text-lg font-bold text-green-700">0 Conflicts</div>
                <div className="text-xs text-green-600">All Clear</div>
              </div>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center space-x-6 mb-6 p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-green-500 rounded"></div>
            <span className="text-sm text-gray-700">No conflicts</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-yellow-500 rounded"></div>
            <span className="text-sm text-gray-700">Warning (soft constraint)</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-red-500 rounded"></div>
            <span className="text-sm text-gray-700">Critical conflict</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-between items-center">
          <div className="flex space-x-3">
            <button className="btn-secondary flex items-center space-x-2">
              <FaSave />
              <span>Save Changes</span>
            </button>
            <button className="btn-secondary flex items-center space-x-2">
              <FaFileExport />
              <span>Export PDF</span>
            </button>
            <button className="btn-secondary flex items-center space-x-2">
              <FaChartBar />
              <span>View Analytics</span>
            </button>
          </div>
          <button className="btn-primary flex items-center space-x-2">
            <FaCheck />
            <span>Approve & Publish</span>
          </button>
        </div>
      </div>

      {/* Edit Modal */}
      {editMode && selectedCell && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={closeModal}>
          <div className="bg-white rounded-xl p-6 max-w-2xl w-full mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Edit Class Assignment</h2>
              <button onClick={closeModal} className="text-gray-500 hover:text-gray-700">
                <FaTimes className="text-2xl" />
              </button>
            </div>

            {selectedCell.data ? (
              <>
                <div className="bg-gray-50 rounded-lg p-4 mb-6">
                  <h3 className="font-semibold text-gray-900 mb-3">Current Assignment:</h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-gray-600">Course:</span>
                      <div className="font-medium text-gray-900">{selectedCell.data.course}</div>
                    </div>
                    <div>
                      <span className="text-gray-600">Faculty:</span>
                      <div className="font-medium text-gray-900">{selectedCell.data.faculty}</div>
                    </div>
                    <div>
                      <span className="text-gray-600">Batch:</span>
                      <div className="font-medium text-gray-900">{selectedCell.data.batch}</div>
                    </div>
                    <div>
                      <span className="text-gray-600">Room:</span>
                      <div className="font-medium text-gray-900">{selectedCell.data.room}</div>
                    </div>
                    <div>
                      <span className="text-gray-600">Slot:</span>
                      <div className="font-medium text-gray-900">{selectedCell.slot} ({selectedCell.day})</div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4 mb-6">
                  <h3 className="font-semibold text-gray-900">Change:</h3>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Faculty</label>
                    <select className="input-field">
                      <option>{selectedCell.data.faculty}</option>
                      <option>Dr. Kumar</option>
                      <option>Dr. Sharma</option>
                      <option>Dr. Verma</option>
                    </select>
                    <p className="text-xs text-green-600 mt-1">✓ Faculty is free</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Room</label>
                    <select className="input-field">
                      <option>Room {selectedCell.data.room}</option>
                      <option>Room 102</option>
                      <option>Room 103</option>
                      <option>Room 105</option>
                    </select>
                    <p className="text-xs text-yellow-600 mt-1">⚠️ Room utilization will be 45%</p>
                    <p className="text-xs text-gray-500">💡 Suggested: Room 105 (70% util)</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Batch</label>
                    <select className="input-field">
                      <option>{selectedCell.data.batch}</option>
                      <option>CS-23-B</option>
                      <option>CS-24-A</option>
                    </select>
                    <p className="text-xs text-green-600 mt-1">✓ No conflicts</p>
                  </div>
                </div>

                <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-6">
                  <div className="flex items-center space-x-2">
                    <FaCheck className="text-green-600" />
                    <span className="text-sm text-green-800 font-medium">Conflict Check: No conflicts detected</span>
                  </div>
                </div>

                <div className="flex justify-end space-x-3">
                  <button onClick={closeModal} className="btn-secondary">
                    Cancel
                  </button>
                  <button className="btn-primary">
                    Apply Changes
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="text-center py-8">
                  <p className="text-gray-600 mb-6">This slot is currently free. Would you like to assign a class?</p>
                  <button className="btn-primary flex items-center space-x-2 mx-auto">
                    <span>Assign Class</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default TimetableGrid;
