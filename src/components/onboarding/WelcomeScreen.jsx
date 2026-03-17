import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ProgressBar from '../common/ProgressBar';
import { FaGraduationCap, FaArrowRight } from 'react-icons/fa';

const WelcomeScreen = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    institutionName: '',
    institutionType: 'Engineering College',
    city: '',
    state: '',
    country: 'India',
    email: '',
    phone: '',
    website: ''
  });

  const steps = ['Institution', 'Workflow', 'Departments', 'Time', 'Slots', 'Rooms', 'Rules'];

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleNext = () => {
    navigate('/onboarding/workflow');
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="card">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-primary-100 rounded-full mb-4">
            <FaGraduationCap className="text-4xl text-primary-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome to Smart Timetable Scheduler</h1>
          <p className="text-gray-600">Let's set up your institution in just a few steps</p>
        </div>

        <ProgressBar currentStep={1} totalSteps={7} steps={steps} />

        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold mb-4 text-gray-800">Institution Information</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Institution Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="institutionName"
                  value={formData.institutionName}
                  onChange={handleChange}
                  placeholder="ABC College of Engineering"
                  className="input-field"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Institution Type <span className="text-red-500">*</span>
                </label>
                <select
                  name="institutionType"
                  value={formData.institutionType}
                  onChange={handleChange}
                  className="input-field"
                >
                  <option>Engineering College</option>
                  <option>Medical College</option>
                  <option>Arts & Science College</option>
                  <option>Management Institute</option>
                  <option>Polytechnic</option>
                  <option>University</option>
                  <option>Other</option>
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">City</label>
                  <input
                    type="text"
                    name="city"
                    value={formData.city}
                    onChange={handleChange}
                    placeholder="Belagavi"
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">State</label>
                  <input
                    type="text"
                    name="state"
                    value={formData.state}
                    onChange={handleChange}
                    placeholder="Karnataka"
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Country</label>
                  <input
                    type="text"
                    name="country"
                    value={formData.country}
                    onChange={handleChange}
                    className="input-field"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="admin@abccollege.edu"
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="+91-9876543210"
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Website</label>
                  <input
                    type="url"
                    name="website"
                    value={formData.website}
                    onChange={handleChange}
                    placeholder="www.abccollege.edu"
                    className="input-field"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-between mt-8 pt-6 border-t border-gray-200">
          <button className="btn-secondary" disabled>
            Back
          </button>
          <button onClick={handleNext} className="btn-primary flex items-center space-x-2">
            <span>Next: Workflow Setup</span>
            <FaArrowRight />
          </button>
        </div>
      </div>
    </div>
  );
};

export default WelcomeScreen;
