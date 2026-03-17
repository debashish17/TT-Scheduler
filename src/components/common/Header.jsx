import React from 'react';
import { FaGraduationCap } from 'react-icons/fa';
import { useLocation } from 'react-router-dom';

const Header = () => {
  const location = useLocation();
  const isOnboarding = location.pathname.includes('/onboarding/');

  return (
    <header className="bg-white shadow-md border-b border-gray-200">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-primary-600 p-2 rounded-lg">
              <FaGraduationCap className="text-white text-2xl" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Smart Timetable Scheduler</h1>
              <p className="text-sm text-gray-600">
                {isOnboarding ? 'Setup Your Institution' : 'Manage Your Schedules'}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <button className="text-gray-600 hover:text-gray-900">
              <span className="text-sm font-medium">Help</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
