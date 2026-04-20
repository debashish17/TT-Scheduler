import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { useOnboardingStore } from '../../store';
import { Icon } from '../ui/primitives';

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: 'home',    path: '/dashboard' },
  { id: 'wizard',    label: 'New run',   icon: 'plus',    path: '/wizard' },
  { id: 'viewer',    label: 'Timetable', icon: 'grid',    path: '/timetable' },
  { id: 'faculty',   label: 'Faculty',   icon: 'users',   path: '/faculty-view' },
  { id: 'rooms',     label: 'Rooms',     icon: 'door',    path: '/student-view' },
  { id: 'history',   label: 'History',   icon: 'history', path: '/history' },
];

interface AppShellProps { children: React.ReactNode }

const AppShell: React.FC<AppShellProps> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut } = useAuthStore();
  const { institutionData } = useOnboardingStore();

  const current = NAV_ITEMS.find(it => location.pathname === it.path || location.pathname.startsWith(it.path + '/'))?.id ?? 'dashboard';

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--paper)', color: 'var(--ink)' }}>
      {/* Sidebar */}
      <aside
        className="w-[220px] flex flex-col sticky top-0 h-screen shrink-0"
        style={{ borderRight: '1px solid var(--line)', background: 'var(--paper)' }}
      >
        {/* Logo */}
        <div className="p-5 flex items-center gap-2" style={{ borderBottom: '1px solid var(--line)' }}>
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 hover:opacity-70 transition-opacity"
          >
            <div
              className="w-6 h-6 rounded flex items-center justify-center"
              style={{ background: 'var(--ink)' }}
            >
              <div className="grid grid-cols-2 gap-[1.5px]">
                <div className="w-[3px] h-[3px]" style={{ background: 'var(--paper)' }} />
                <div className="w-[3px] h-[3px] opacity-40" style={{ background: 'var(--paper)' }} />
                <div className="w-[3px] h-[3px] opacity-40" style={{ background: 'var(--paper)' }} />
                <div className="w-[3px] h-[3px]" style={{ background: 'var(--paper)' }} />
              </div>
            </div>
            <span className="font-semibold text-sm tracking-tight">TT-Scheduler</span>
          </button>
        </div>

        {/* Nav body */}
        <div className="p-3 flex-1 overflow-y-auto">
          {/* Institution workspace */}
          <div className="eyebrow mb-2 px-2" style={{ color: 'var(--ink-3)' }}>Workspace</div>
          <div className="edge rounded-lg p-2.5 mb-4" style={{ background: 'var(--paper-2)' }}>
            <div className="text-[13px] font-semibold leading-tight">
              {institutionData?.name || 'My Institution'}
            </div>
            <div className="text-[11px] mono" style={{ color: 'var(--ink-3)' }}>
              {institutionData?.type || 'College'} · Fall 2026
            </div>
          </div>

          {/* Nav links */}
          <nav className="space-y-0.5">
            {NAV_ITEMS.map(it => (
              <button
                key={it.id}
                onClick={() => navigate(it.path)}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] transition-colors"
                style={{
                  background: current === it.id ? 'var(--ink)' : 'transparent',
                  color: current === it.id ? 'var(--paper)' : 'var(--ink-2)',
                }}
              >
                <Icon name={it.icon} size={14} />
                {it.label}
              </button>
            ))}
          </nav>

          {/* Solver stats */}
          <div className="mt-6 pt-4" style={{ borderTop: '1px solid var(--line)' }}>
            <div className="eyebrow mb-2 px-2" style={{ color: 'var(--ink-3)' }}>Solver</div>
            <div className="px-2 text-[11px] mono space-y-1" style={{ color: 'var(--ink-3)' }}>
              <div className="flex justify-between"><span>Engine</span><span>CP-SAT 9.10</span></div>
              <div className="flex justify-between"><span>Queue</span><span>0 pending</span></div>
              <div className="flex justify-between"><span>Avg solve</span><span>3.4s</span></div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3" style={{ borderTop: '1px solid var(--line)' }}>
          <button
            onClick={() => navigate('/')}
            className="w-full text-left text-[11px] mono px-2 py-1 transition-colors hover:opacity-70"
            style={{ color: 'var(--ink-3)' }}
          >
            ← back to site
          </button>
          <div className="flex items-center gap-2 px-2 py-2 mt-1">
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
              style={{ background: 'var(--brand)' }}
            >
              {user?.email?.[0]?.toUpperCase() ?? 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-medium leading-tight truncate">
                {user?.email?.split('@')[0] ?? 'User'}
              </div>
              <div className="text-[10px] truncate" style={{ color: 'var(--ink-3)' }}>
                {user?.email ?? ''}
              </div>
            </div>
            <button
              onClick={() => { signOut(); navigate('/login'); }}
              className="text-[10px] mono transition-opacity hover:opacity-70 shrink-0"
              style={{ color: 'var(--ink-3)' }}
              title="Logout"
            >
              out
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0 overflow-y-auto" style={{ background: 'var(--paper)' }}>
        {children}
      </main>
    </div>
  );
};

export default AppShell;
