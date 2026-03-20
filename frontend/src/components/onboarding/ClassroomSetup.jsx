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

const ClassroomSetup = () => {
  const navigate = useNavigate();
  const { roomsData, setRoomsData } = useOnboardingStore();

  const [rooms, setRooms] = useState(roomsData?.length > 0 ? roomsData : []);
  const [newRoom, setNewRoom] = useState({ name: '', capacity: '', type: 'Classroom' });

  const ROOM_TYPES = ['Classroom', 'Computer Lab', 'Science Lab', 'Seminar Hall', 'Auditorium'];

  const addRoom = () => {
    if (!newRoom.name.trim()) { alert('Please enter a room name'); return; }
    if (!newRoom.capacity || newRoom.capacity < 1) { alert('Please enter a valid capacity'); return; }
    setRooms([...rooms, { ...newRoom, capacity: parseInt(newRoom.capacity) }]);
    setNewRoom({ name: '', capacity: '', type: 'Classroom' });
  };

  const removeRoom = (i) => setRooms(rooms.filter((_, idx) => idx !== i));

  const handleNext = () => {
    if (rooms.length === 0) { alert('Add at least one classroom'); return; }
    setRoomsData(rooms);
    navigate('/screen-6');
  };

  const totalCapacity = rooms.reduce((s, r) => s + r.capacity, 0);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-2xl shadow-lg p-8">
        <ProgressBar current={5} total={7} steps={steps} />

        <h2 className="text-2xl font-bold text-gray-800 mb-1">Classrooms</h2>
        <p className="text-gray-500 mb-6">Add your classrooms and labs. The scheduler will assign classes to rooms that can fit them.</p>

        {/* Stats */}
        {rooms.length > 0 && (
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-blue-50 rounded-xl p-4 text-center border border-blue-100">
              <div className="text-2xl font-bold text-blue-700">{rooms.length}</div>
              <div className="text-xs text-blue-600 mt-1">Total Rooms</div>
            </div>
            <div className="bg-green-50 rounded-xl p-4 text-center border border-green-100">
              <div className="text-2xl font-bold text-green-700">{totalCapacity}</div>
              <div className="text-xs text-green-600 mt-1">Total Seats</div>
            </div>
            <div className="bg-purple-50 rounded-xl p-4 text-center border border-purple-100">
              <div className="text-2xl font-bold text-purple-700">
                {rooms.length > 0 ? Math.round(totalCapacity / rooms.length) : 0}
              </div>
              <div className="text-xs text-purple-600 mt-1">Avg Capacity</div>
            </div>
          </div>
        )}

        {/* Rooms Table */}
        {rooms.length > 0 && (
          <div className="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden mb-6">
            <table className="w-full">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Room Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Capacity</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {rooms.map((room, i) => (
                  <tr key={i} className="bg-white hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{room.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{room.capacity} seats</td>
                    <td className="px-4 py-3"><span className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-full">{room.type}</span></td>
                    <td className="px-4 py-3">
                      <button onClick={() => removeRoom(i)} className="text-red-400 hover:text-red-600"><FaTrash size={12} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Add Room Form */}
        <div className="bg-gray-50 rounded-xl border border-gray-200 p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Add a Classroom</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Room Name / Number *</label>
              <input type="text" value={newRoom.name}
                onChange={e => setNewRoom({ ...newRoom, name: e.target.value })}
                onKeyDown={e => e.key === 'Enter' && addRoom()}
                placeholder="e.g., Room 101"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Capacity (seats) *</label>
              <input type="number" value={newRoom.capacity}
                onChange={e => setNewRoom({ ...newRoom, capacity: e.target.value })}
                onKeyDown={e => e.key === 'Enter' && addRoom()}
                placeholder="40"
                min="1" max="500"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Type</label>
              <select value={newRoom.type} onChange={e => setNewRoom({ ...newRoom, type: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500">
                {ROOM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <button onClick={addRoom}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors">
            <FaPlus size={12} />
            <span>Add Room</span>
          </button>
          <p className="text-xs text-gray-400 mt-2">Press Enter in any field to add quickly.</p>
        </div>

        <div className="flex justify-between mt-8 pt-6 border-t border-gray-200">
          <button onClick={() => navigate('/screen-4')}
            className="flex items-center space-x-2 px-5 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors">
            <FaArrowLeft />
            <span>Back</span>
          </button>
          <button onClick={handleNext}
            className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors">
            <span>Next: Rules</span>
            <FaArrowRight />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ClassroomSetup;
