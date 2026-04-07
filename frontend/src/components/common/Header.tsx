import { useNavigate, useLocation } from 'react-router-dom';
import { useOnboardingStore } from '../../store';

const TIMETABLE_PATHS = ['/timetable', '/faculty-view', '/student-view', '/analytics'];

const Header = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { clearOnboardingData } = useOnboardingStore();

  const handleLogoClick = () => {
    if (window.confirm('Reset all data and start over from the beginning?')) {
      clearOnboardingData();
      navigate('/screen-1');
    }
  };

  const isTimetablePage = TIMETABLE_PATHS.some(p => location.pathname === p);

  return (
    <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-4">

        {/* Logo */}
        <button
          onClick={handleLogoClick}
          title="Reset and start over"
          className="flex items-center gap-2.5 shrink-0 group"
        >
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shadow-sm group-hover:bg-blue-700 transition-colors">
            <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 text-white" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <span className="text-base font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
            Smart<span className="text-blue-600 group-hover:text-blue-700">TT</span>
          </span>
        </button>

        {/* Timetable page badge */}
        {isTimetablePage && (
          <div className="flex-1 flex justify-center">
            <span className="text-xs font-medium px-3 py-1 bg-green-100 text-green-700 rounded-full">
              ✓ Timetable Generated
            </span>
          </div>
        )}

        {/* Right: reset shortcut on timetable pages */}
        {isTimetablePage && (
          <button
            onClick={handleLogoClick}
            className="text-xs text-gray-400 hover:text-red-500 transition-colors shrink-0"
          >
            Start Over
          </button>
        )}
      </div>
    </header>
  );
};

export default Header;
