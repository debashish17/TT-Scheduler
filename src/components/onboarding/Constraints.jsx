import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ProgressBar from '../common/ProgressBar';
import { FaArrowRight, FaArrowLeft, FaCheck, FaPlus, FaTrash, FaEdit, FaTimes } from 'react-icons/fa';

const Constraints = () => {
  const navigate = useNavigate();
  const [constraints, setConstraints] = useState({
    maxConsecutive: 3,
    noSaturday: true,
    maxHoursPerDay: 6,
    minGap: 0,
    firstYearMorning: true,
    maxClassesPerDay: 7,
    labConsecutive: true,
    labOnlyInLabRooms: true,
    priorities: {
      roomUtilization: 2,
      facultyBalance: 1,
      studentGaps: 3,
      facultyPreferences: 4,
      backToBackSections: 5
    }
  });

  const [customConstraints, setCustomConstraints] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [newConstraint, setNewConstraint] = useState({
    name: '',
    description: '',
    type: 'soft',
    category: 'general'
  });

  const steps = ['Institution', 'Workflow', 'Departments', 'Time', 'Slots', 'Rooms', 'Rules'];

  const handleAddConstraint = () => {
    if (!newConstraint.name.trim() || !newConstraint.description.trim()) {
      alert('Please fill in both name and description');
      return;
    }

    if (editingId !== null) {
      // Update existing constraint
      setCustomConstraints(customConstraints.map(c =>
        c.id === editingId ? { ...newConstraint, id: editingId } : c
      ));
      setEditingId(null);
    } else {
      // Add new constraint
      setCustomConstraints([
        ...customConstraints,
        { ...newConstraint, id: Date.now() }
      ]);
    }

    // Reset form
    setNewConstraint({ name: '', description: '', type: 'soft', category: 'general' });
    setShowAddForm(false);
  };

  const handleEditConstraint = (constraint) => {
    setNewConstraint({
      name: constraint.name,
      description: constraint.description,
      type: constraint.type,
      category: constraint.category
    });
    setEditingId(constraint.id);
    setShowAddForm(true);
  };

  const handleDeleteConstraint = (id) => {
    if (confirm('Are you sure you want to delete this constraint?')) {
      setCustomConstraints(customConstraints.filter(c => c.id !== id));
    }
  };

  const handleCancelEdit = () => {
    setNewConstraint({ name: '', description: '', type: 'soft', category: 'general' });
    setEditingId(null);
    setShowAddForm(false);
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="card">
        <ProgressBar currentStep={7} totalSteps={7} steps={steps} />

        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold mb-2 text-gray-800">Institutional Rules & Constraints</h2>
            <p className="text-gray-600 mb-6">Customize the scheduling rules for your institution</p>

            {/* Hard Constraints */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-5 mb-6">
              <h3 className="font-semibold text-green-900 mb-3">
                The system automatically enforces these HARD constraints:
              </h3>
              <div className="space-y-2">
                {[
                  'No faculty teaches two classes simultaneously',
                  'No room hosts two classes simultaneously',
                  'No student batch has overlapping classes',
                  'Room capacity must accommodate batch size',
                  'Each course gets required credit hours',
                  'Faculty workload within specified limits'
                ].map((constraint, index) => (
                  <div key={index} className="flex items-center text-green-800">
                    <FaCheck className="text-green-600 mr-2 flex-shrink-0" />
                    <span className="text-sm">{constraint}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Faculty Constraints */}
            <div className="bg-white border border-gray-200 rounded-lg p-5 mb-5">
              <h3 className="font-semibold text-gray-900 mb-4">Faculty Constraints</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="flex items-center space-x-2">
                    <input type="checkbox" checked className="w-4 h-4 text-primary-600" readOnly />
                    <span className="text-sm">Maximum consecutive classes for any faculty:</span>
                  </label>
                  <select
                    value={constraints.maxConsecutive}
                    onChange={(e) => setConstraints({ ...constraints, maxConsecutive: parseInt(e.target.value) })}
                    className="px-3 py-1.5 border border-gray-300 rounded-lg"
                  >
                    {[2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>

                <div>
                  <label className="flex items-center space-x-2 mb-2">
                    <input type="checkbox" checked className="w-4 h-4 text-primary-600" readOnly />
                    <span className="text-sm">Faculty cannot teach on:</span>
                  </label>
                  <div className="ml-6 flex flex-wrap gap-2">
                    {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(day => (
                      <button
                        key={day}
                        onClick={() => {
                          if (day === 'Saturday') {
                            setConstraints({ ...constraints, noSaturday: !constraints.noSaturday });
                          }
                        }}
                        className={`px-3 py-1 rounded text-sm ${
                          (day === 'Saturday' && constraints.noSaturday)
                            ? 'bg-red-100 text-red-700 border border-red-300'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {day}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <label className="flex items-center space-x-2">
                    <input type="checkbox" checked className="w-4 h-4 text-primary-600" readOnly />
                    <span className="text-sm">Maximum teaching hours per day:</span>
                  </label>
                  <select
                    value={constraints.maxHoursPerDay}
                    onChange={(e) => setConstraints({ ...constraints, maxHoursPerDay: parseInt(e.target.value) })}
                    className="px-3 py-1.5 border border-gray-300 rounded-lg"
                  >
                    {[4, 5, 6, 7, 8].map(n => <option key={n} value={n}>{n} hours</option>)}
                  </select>
                </div>

                <div className="flex items-center justify-between">
                  <label className="flex items-center space-x-2">
                    <input type="checkbox" checked className="w-4 h-4 text-primary-600" readOnly />
                    <span className="text-sm">Minimum gap between classes:</span>
                  </label>
                  <select
                    value={constraints.minGap}
                    onChange={(e) => setConstraints({ ...constraints, minGap: parseInt(e.target.value) })}
                    className="px-3 py-1.5 border border-gray-300 rounded-lg"
                  >
                    <option value="0">0 hours (back-to-back allowed)</option>
                    {[1, 2, 3].map(n => <option key={n} value={n}>{n} hour(s)</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* Student Constraints */}
            <div className="bg-white border border-gray-200 rounded-lg p-5 mb-5">
              <h3 className="font-semibold text-gray-900 mb-4">Student Constraints</h3>
              <div className="space-y-4">
                <div>
                  <label className="flex items-center space-x-2 mb-2">
                    <input
                      type="checkbox"
                      checked={constraints.firstYearMorning}
                      onChange={(e) => setConstraints({ ...constraints, firstYearMorning: e.target.checked })}
                      className="w-4 h-4 text-primary-600"
                    />
                    <span className="text-sm font-medium">First year students:</span>
                  </label>
                  <div className="ml-6">
                    <label className="flex items-center space-x-2">
                      <input type="checkbox" checked={constraints.firstYearMorning} readOnly className="w-4 h-4 text-primary-600" />
                      <span className="text-sm">Only morning classes (before 1 PM)</span>
                    </label>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <label className="flex items-center space-x-2">
                    <input type="checkbox" checked className="w-4 h-4 text-primary-600" readOnly />
                    <span className="text-sm">Maximum classes per day for any batch:</span>
                  </label>
                  <select
                    value={constraints.maxClassesPerDay}
                    onChange={(e) => setConstraints({ ...constraints, maxClassesPerDay: parseInt(e.target.value) })}
                    className="px-3 py-1.5 border border-gray-300 rounded-lg"
                  >
                    {[5, 6, 7, 8, 9].map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* Course Constraints */}
            <div className="bg-white border border-gray-200 rounded-lg p-5 mb-5">
              <h3 className="font-semibold text-gray-900 mb-4">Course Constraints</h3>
              <div className="space-y-3">
                <div>
                  <label className="flex items-center space-x-2 mb-2">
                    <input type="checkbox" checked className="w-4 h-4 text-primary-600" readOnly />
                    <span className="text-sm font-medium">Lab sessions must be:</span>
                  </label>
                  <div className="ml-6 space-y-2">
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={constraints.labConsecutive}
                        onChange={(e) => setConstraints({ ...constraints, labConsecutive: e.target.checked })}
                        className="w-4 h-4 text-primary-600"
                      />
                      <span className="text-sm">In consecutive time slots (2-hour blocks)</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={constraints.labOnlyInLabRooms}
                        onChange={(e) => setConstraints({ ...constraints, labOnlyInLabRooms: e.target.checked })}
                        className="w-4 h-4 text-primary-600"
                      />
                      <span className="text-sm">Only in lab-equipped rooms</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Custom Constraints */}
            <div className="bg-white border border-purple-200 rounded-lg p-5 mb-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">Custom Constraints</h3>
                <button
                  onClick={() => setShowAddForm(!showAddForm)}
                  className="btn-primary flex items-center space-x-2 text-sm"
                >
                  {showAddForm ? <FaTimes /> : <FaPlus />}
                  <span>{showAddForm ? 'Cancel' : 'Add Constraint'}</span>
                </button>
              </div>

              {/* Add/Edit Form */}
              {showAddForm && (
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-4">
                  <h4 className="text-sm font-semibold text-gray-900 mb-3">
                    {editingId ? 'Edit Constraint' : 'New Custom Constraint'}
                  </h4>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Constraint Name *
                      </label>
                      <input
                        type="text"
                        value={newConstraint.name}
                        onChange={(e) => setNewConstraint({ ...newConstraint, name: e.target.value })}
                        placeholder="e.g., No classes after 4 PM on Fridays"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Description *
                      </label>
                      <textarea
                        value={newConstraint.description}
                        onChange={(e) => setNewConstraint({ ...newConstraint, description: e.target.value })}
                        placeholder="Describe the constraint in detail..."
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Constraint Type
                        </label>
                        <select
                          value={newConstraint.type}
                          onChange={(e) => setNewConstraint({ ...newConstraint, type: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        >
                          <option value="soft">Soft (Preference)</option>
                          <option value="hard">Hard (Must Follow)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Category
                        </label>
                        <select
                          value={newConstraint.category}
                          onChange={(e) => setNewConstraint({ ...newConstraint, category: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        >
                          <option value="general">General</option>
                          <option value="faculty">Faculty</option>
                          <option value="student">Student</option>
                          <option value="course">Course</option>
                          <option value="room">Room</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex space-x-2 pt-2">
                      <button
                        onClick={handleAddConstraint}
                        className="btn-primary flex items-center space-x-2 text-sm"
                      >
                        <FaCheck />
                        <span>{editingId ? 'Update' : 'Add'} Constraint</span>
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        className="btn-secondary text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Custom Constraints List */}
              {customConstraints.length === 0 ? (
                <div className="text-center py-8 text-gray-500 text-sm">
                  No custom constraints added yet. Click "Add Constraint" to create one.
                </div>
              ) : (
                <div className="space-y-3">
                  {customConstraints.map((constraint) => (
                    <div
                      key={constraint.id}
                      className="bg-gray-50 border border-gray-200 rounded-lg p-4"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <h4 className="font-semibold text-gray-900">{constraint.name}</h4>
                            <span className={`text-xs px-2 py-1 rounded ${
                              constraint.type === 'hard'
                                ? 'bg-red-100 text-red-700'
                                : 'bg-blue-100 text-blue-700'
                            }`}>
                              {constraint.type}
                            </span>
                            <span className="text-xs px-2 py-1 rounded bg-gray-200 text-gray-700">
                              {constraint.category}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600">{constraint.description}</p>
                        </div>
                        <div className="flex items-center space-x-2 ml-4">
                          <button
                            onClick={() => handleEditConstraint(constraint)}
                            className="text-blue-600 hover:text-blue-800 p-2"
                            title="Edit"
                          >
                            <FaEdit />
                          </button>
                          <button
                            onClick={() => handleDeleteConstraint(constraint.id)}
                            className="text-red-600 hover:text-red-800 p-2"
                            title="Delete"
                          >
                            <FaTrash />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Optimization Priorities */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-5">
              <h3 className="font-semibold text-blue-900 mb-3">
                Optimization Priorities (Rank 1-5, 1 = Highest)
              </h3>
              <div className="space-y-3">
                {[
                  { key: 'roomUtilization', label: 'Room utilization (pack classes efficiently)' },
                  { key: 'facultyBalance', label: 'Faculty workload balance (equal distribution)' },
                  { key: 'studentGaps', label: 'Student schedule gaps (minimize free periods)' },
                  { key: 'facultyPreferences', label: 'Faculty preferences (preferred time slots)' },
                  { key: 'backToBackSections', label: 'Back-to-back sections (same course together)' }
                ].map(({ key, label }) => (
                  <div key={key} className="flex items-center justify-between">
                    <span className="text-sm text-gray-700">{label}</span>
                    <select
                      value={constraints.priorities[key]}
                      onChange={(e) => setConstraints({
                        ...constraints,
                        priorities: { ...constraints.priorities, [key]: parseInt(e.target.value) }
                      })}
                      className="px-3 py-1.5 border border-gray-300 rounded-lg bg-white"
                    >
                      {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-between mt-8 pt-6 border-t border-gray-200">
          <button onClick={() => navigate('/onboarding/classrooms')} className="btn-secondary flex items-center space-x-2">
            <FaArrowLeft />
            <span>Back</span>
          </button>
          <button onClick={() => navigate('/onboarding/complete')} className="btn-primary flex items-center space-x-2">
            <FaCheck />
            <span>Complete Setup</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Constraints;
