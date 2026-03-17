import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ProgressBar from '../common/ProgressBar';
import { FaArrowRight, FaArrowLeft, FaPlus, FaTrash, FaUpload, FaDownload } from 'react-icons/fa';

const ClassroomSetup = () => {
  const navigate = useNavigate();
  const [rooms, setRooms] = useState([
    { number: '101', building: 'Main', capacity: 60, type: 'Lecture Hall', features: ['Projector', 'AC'] },
    { number: '102', building: 'Main', capacity: 60, type: 'Lecture Hall', features: ['Projector', 'AC'] },
    { number: 'L201', building: 'Lab Block', capacity: 30, type: 'Computer Lab', features: ['Computers', 'AC'] }
  ]);

  const [newRoom, setNewRoom] = useState({
    number: '',
    building: 'Main Block',
    capacity: '',
    type: 'Lecture Hall',
    features: []
  });

  const steps = ['Institution', 'Workflow', 'Departments', 'Time', 'Slots', 'Rooms', 'Rules'];

  const roomTypes = ['Lecture Hall', 'Computer Lab', 'Physics Lab', 'Chemistry Lab', 'Seminar Hall', 'Auditorium'];
  const availableFeatures = ['Projector', 'Air Conditioning', 'Smart Board', 'Sound System', 'Computers'];

  const addRoom = () => {
    if (newRoom.number && newRoom.capacity) {
      setRooms([...rooms, { ...newRoom }]);
      setNewRoom({ number: '', building: 'Main Block', capacity: '', type: 'Lecture Hall', features: [] });
    }
  };

  const removeRoom = (index) => {
    setRooms(rooms.filter((_, i) => i !== index));
  };

  const toggleFeature = (feature) => {
    if (newRoom.features.includes(feature)) {
      setNewRoom({ ...newRoom, features: newRoom.features.filter(f => f !== feature) });
    } else {
      setNewRoom({ ...newRoom, features: [...newRoom.features, feature] });
    }
  };

  const getRoomStats = () => {
    const lectureHalls = rooms.filter(r => r.type === 'Lecture Hall');
    const computerLabs = rooms.filter(r => r.type === 'Computer Lab');
    const otherLabs = rooms.filter(r => r.type.includes('Lab') && r.type !== 'Computer Lab');
    
    return {
      total: rooms.length,
      lectureHalls: lectureHalls.length,
      computerLabs: computerLabs.length,
      otherLabs: otherLabs.length,
      totalCapacity: rooms.reduce((sum, r) => sum + parseInt(r.capacity || 0), 0)
    };
  };

  const stats = getRoomStats();

  return (
    <div className="max-w-6xl mx-auto">
      <div className="card">
        <ProgressBar currentStep={6} totalSteps={7} steps={steps} />

        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold mb-2 text-gray-800">Classrooms & Labs</h2>
            <p className="text-gray-600 mb-6">Add your classrooms, labs, and lecture halls</p>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-3 mb-6">
              <button className="px-4 py-2 bg-green-50 text-green-700 border border-green-200 rounded-lg hover:bg-green-100 transition-colors flex items-center space-x-2">
                <FaUpload />
                <span>Import from Excel</span>
              </button>
              <button className="px-4 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors flex items-center space-x-2">
                <FaDownload />
                <span>Download Template</span>
              </button>
            </div>

            {/* Stats Summary */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-lg border border-blue-200">
                <div className="text-2xl font-bold text-blue-700">{stats.total}</div>
                <div className="text-xs text-blue-600">Total Rooms</div>
              </div>
              <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-lg border border-green-200">
                <div className="text-2xl font-bold text-green-700">{stats.lectureHalls}</div>
                <div className="text-xs text-green-600">Lecture Halls</div>
              </div>
              <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-lg border border-purple-200">
                <div className="text-2xl font-bold text-purple-700">{stats.computerLabs}</div>
                <div className="text-xs text-purple-600">Computer Labs</div>
              </div>
              <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-4 rounded-lg border border-orange-200">
                <div className="text-2xl font-bold text-orange-700">{stats.otherLabs}</div>
                <div className="text-xs text-orange-600">Other Labs</div>
              </div>
              <div className="bg-gradient-to-br from-pink-50 to-pink-100 p-4 rounded-lg border border-pink-200">
                <div className="text-2xl font-bold text-pink-700">{stats.totalCapacity}</div>
                <div className="text-xs text-pink-600">Total Capacity</div>
              </div>
            </div>

            {/* Rooms List */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-3">Your Rooms ({rooms.length} added)</h3>
              <div className="overflow-x-auto bg-white rounded-lg border border-gray-200">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Room No.</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Building</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Capacity</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Features</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {rooms.map((room, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{room.number}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">{room.building}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">{room.capacity}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">{room.type}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {room.features.join(', ')}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <button
                            onClick={() => removeRoom(index)}
                            className="text-red-500 hover:text-red-700 transition-colors"
                          >
                            <FaTrash />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Quick Add Form */}
            <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
              <h3 className="text-lg font-semibold mb-4">Quick Add Form</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Room Number</label>
                  <input
                    type="text"
                    value={newRoom.number}
                    onChange={(e) => setNewRoom({ ...newRoom, number: e.target.value })}
                    placeholder="103"
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Building</label>
                  <input
                    type="text"
                    value={newRoom.building}
                    onChange={(e) => setNewRoom({ ...newRoom, building: e.target.value })}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Capacity</label>
                  <input
                    type="number"
                    value={newRoom.capacity}
                    onChange={(e) => setNewRoom({ ...newRoom, capacity: e.target.value })}
                    placeholder="60"
                    className="input-field"
                  />
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
                <select
                  value={newRoom.type}
                  onChange={(e) => setNewRoom({ ...newRoom, type: e.target.value })}
                  className="input-field max-w-md"
                >
                  {roomTypes.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Features</label>
                <div className="flex flex-wrap gap-2">
                  {availableFeatures.map(feature => (
                    <button
                      key={feature}
                      onClick={() => toggleFeature(feature)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        newRoom.features.includes(feature)
                          ? 'bg-primary-600 text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      {feature}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-end">
                <button onClick={addRoom} className="btn-primary flex items-center space-x-2">
                  <FaPlus />
                  <span>Add Room</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-between mt-8 pt-6 border-t border-gray-200">
          <button onClick={() => navigate('/onboarding/slots')} className="btn-secondary flex items-center space-x-2">
            <FaArrowLeft />
            <span>Back</span>
          </button>
          <button onClick={() => navigate('/onboarding/constraints')} className="btn-primary flex items-center space-x-2">
            <span>Next: Define Constraints</span>
            <FaArrowRight />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ClassroomSetup;
