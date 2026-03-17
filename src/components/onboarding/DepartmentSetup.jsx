import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ProgressBar from '../common/ProgressBar';
import { FaArrowRight, FaArrowLeft, FaPlus, FaTrash } from 'react-icons/fa';

const DepartmentSetup = () => {
  const navigate = useNavigate();
  const [departments, setDepartments] = useState([
    { name: 'Computer Science', code: 'CS', admin: 'None' },
    { name: 'Information Technology', code: 'IT', admin: 'None' },
    { name: 'Electronics & Communication', code: 'ECE', admin: 'None' }
  ]);

  const steps = ['Institution', 'Workflow', 'Departments', 'Time', 'Slots', 'Rooms', 'Rules'];

  const addDepartment = () => {
    setDepartments([...departments, { name: '', code: '', admin: 'None' }]);
  };

  const removeDepartment = (index) => {
    setDepartments(departments.filter((_, i) => i !== index));
  };

  const updateDepartment = (index, field, value) => {
    const updated = [...departments];
    updated[index][field] = value;
    setDepartments(updated);
  };

  const loadTemplate = (template) => {
    if (template === 'engineering') {
      setDepartments([
        { name: 'Computer Science', code: 'CS', admin: 'None' },
        { name: 'Information Technology', code: 'IT', admin: 'None' },
        { name: 'Electronics & Communication', code: 'ECE', admin: 'None' },
        { name: 'Mechanical Engineering', code: 'MECH', admin: 'None' },
        { name: 'Electrical Engineering', code: 'EEE', admin: 'None' }
      ]);
    } else if (template === 'medical') {
      setDepartments([
        { name: 'MBBS', code: 'MBBS', admin: 'None' },
        { name: 'Nursing', code: 'NSG', admin: 'None' },
        { name: 'Pharmacy', code: 'PHM', admin: 'None' }
      ]);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="card">
        <ProgressBar currentStep={3} totalSteps={7} steps={steps} />

        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold mb-2 text-gray-800">Departments</h2>
            <p className="text-gray-600 mb-6">Add the departments in your institution</p>

            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-700 mb-3">Quick Setup Options:</h3>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => loadTemplate('engineering')}
                  className="px-4 py-2 bg-blue-50 text-blue-700 rounded-lg border border-blue-200 hover:bg-blue-100 transition-colors"
                >
                  Engineering College Template
                </button>
                <button
                  onClick={() => loadTemplate('medical')}
                  className="px-4 py-2 bg-green-50 text-green-700 rounded-lg border border-green-200 hover:bg-green-100 transition-colors"
                >
                  Medical College Template
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="grid grid-cols-12 gap-4 mb-3 text-sm font-medium text-gray-700">
                  <div className="col-span-5">Department Name</div>
                  <div className="col-span-3">Code</div>
                  <div className="col-span-3">Assign Admin</div>
                  <div className="col-span-1"></div>
                </div>

                {departments.map((dept, index) => (
                  <div key={index} className="grid grid-cols-12 gap-4 mb-3">
                    <div className="col-span-5">
                      <input
                        type="text"
                        value={dept.name}
                        onChange={(e) => updateDepartment(index, 'name', e.target.value)}
                        placeholder="Department Name"
                        className="input-field"
                      />
                    </div>
                    <div className="col-span-3">
                      <input
                        type="text"
                        value={dept.code}
                        onChange={(e) => updateDepartment(index, 'code', e.target.value)}
                        placeholder="CODE"
                        className="input-field"
                      />
                    </div>
                    <div className="col-span-3">
                      <select
                        value={dept.admin}
                        onChange={(e) => updateDepartment(index, 'admin', e.target.value)}
                        className="input-field"
                      >
                        <option>None</option>
                        <option>Dr. Smith</option>
                        <option>Dr. Johnson</option>
                      </select>
                    </div>
                    <div className="col-span-1 flex items-center">
                      <button
                        onClick={() => removeDepartment(index)}
                        className="text-red-500 hover:text-red-700 transition-colors"
                      >
                        <FaTrash />
                      </button>
                    </div>
                  </div>
                ))}

                <button
                  onClick={addDepartment}
                  className="flex items-center space-x-2 text-primary-600 hover:text-primary-700 font-medium mt-4"
                >
                  <FaPlus />
                  <span>Add Another Department</span>
                </button>
              </div>
            </div>

            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                💡 Tip: You can add department admins now or later from the admin management section
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-between mt-8 pt-6 border-t border-gray-200">
          <button onClick={() => navigate('/onboarding/workflow')} className="btn-secondary flex items-center space-x-2">
            <FaArrowLeft />
            <span>Back</span>
          </button>
          <button onClick={() => navigate('/onboarding/time-structure')} className="btn-primary flex items-center space-x-2">
            <span>Next: Time Structure</span>
            <FaArrowRight />
          </button>
        </div>
      </div>
    </div>
  );
};

export default DepartmentSetup;
