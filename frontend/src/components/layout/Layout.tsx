/**
 * Main Layout Component
 * Navigation, sidebar, and routing structure
 */
import React from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  FiHome,
  FiCalendar,
  FiUsers,
  FiBookOpen,
  FiMapPin,
  FiClock,
  FiBarChart2,
  FiSettings,
  FiMenu,
  FiX,
  FiBell,
  FiUser,
  FiLogOut,
  FiGrid,
} from 'react-icons/fi';
import { useUIStore, useAuthStore, useInstitutionStore } from '../../store';
import toast from 'react-hot-toast';

const Layout = () => {
  const { sidebarOpen, toggleSidebar, notifications } = useUIStore();
  const { user, logout } = useAuthStore();
  const { currentInstitution, setCurrentInstitution } = useInstitutionStore();
  const location = useLocation();
  const navigate = useNavigate();

  const navigation = [
    { name: 'Dashboard', href: '/', icon: FiHome, current: location.pathname === '/' },
    {
      name: 'Generate Timetable',
      href: '/generate',
      icon: FiCalendar,
      current: location.pathname === '/generate',
    },
    { name: 'Timetables', href: '/timetables', icon: FiCalendar, current: location.pathname.startsWith('/timetables') },
    { name: 'Jobs', href: '/jobs', icon: FiClock, current: location.pathname.startsWith('/jobs') },
    { name: 'Faculty', href: '/faculty', icon: FiUsers, current: location.pathname.startsWith('/faculty') },
    { name: 'Courses', href: '/courses', icon: FiBookOpen, current: location.pathname.startsWith('/courses') },
    { name: 'Rooms', href: '/rooms', icon: FiMapPin, current: location.pathname.startsWith('/rooms') },
    { name: 'Analytics', href: '/analytics', icon: FiBarChart2, current: location.pathname.startsWith('/analytics') },
    { name: 'Settings', href: '/settings', icon: FiSettings, current: location.pathname.startsWith('/settings') },
  ];

  const handleLogout = () => {
    logout();
    toast.success('Logged out successfully');
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0`}
      >
        <div className="flex items-center justify-center h-16 px-4 bg-blue-600">
          <Link to="/" className="text-white text-xl font-bold">
            TT-Scheduler
          </Link>
          <button
            onClick={toggleSidebar}
            className="ml-auto text-white lg:hidden"
          >
            <FiX size={24} />
          </button>
        </div>

        {/* Institution Selector */}
        {currentInstitution && (
          <div className="p-4 bg-blue-50 border-b border-blue-200">
            <div className="flex items-center space-x-3">
              <FiGrid className="text-blue-600" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-blue-900 truncate">
                  {currentInstitution.name}
                </p>
                <p className="text-xs text-blue-600">{currentInstitution.code}</p>
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className="mt-5 px-2">
          <div className="space-y-1">
            {navigation.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors ${
                    item.current
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <Icon
                    className={`mr-3 flex-shrink-0 h-5 w-5 ${
                      item.current ? 'text-blue-500' : 'text-gray-400 group-hover:text-gray-500'
                    }`}
                  />
                  {item.name}
                </Link>
              );
            })}
          </div>
        </nav>
      </div>

      {/* Main content */}
      <div className={`flex-1 ${sidebarOpen ? 'lg:ml-64' : 'lg:ml-64'}`}>
        {/* Top header */}
        <header className="bg-white shadow">
          <div className="flex items-center justify-between px-4 sm:px-6 lg:px-8 h-16">
            <div className="flex items-center">
              <button
                onClick={toggleSidebar}
                className="text-gray-500 hover:text-gray-600 lg:hidden"
              >
                <FiMenu size={24} />
              </button>
            </div>

            <div className="flex items-center space-x-4">
              {/* Notifications */}
              <div className="relative">
                <button className="text-gray-400 hover:text-gray-500 relative">
                  <FiBell size={20} />
                  {notifications.length > 0 && (
                    <span className="absolute -top-1 -right-1 h-4 w-4 bg-red-600 text-white text-xs rounded-full flex items-center justify-center">
                      {notifications.length}
                    </span>
                  )}
                </button>
              </div>

              {/* User menu */}
              <div className="relative">
                <div className="flex items-center space-x-3">
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">
                      {user?.name || 'Guest User'}
                    </p>
                    <p className="text-xs text-gray-500">{user?.email}</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button className="text-gray-400 hover:text-gray-500">
                      <FiUser size={20} />
                    </button>
                    <button
                      onClick={handleLogout}
                      className="text-gray-400 hover:text-red-500"
                    >
                      <FiLogOut size={20} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1">
          <Outlet />
        </main>
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black bg-opacity-50 lg:hidden"
          onClick={toggleSidebar}
        />
      )}
    </div>
  );
};

export default Layout;
