import React from 'react';
import { ScreenView, UserProfile } from '../types';

interface ScreenSwitcherBarProps {
  currentScreen: ScreenView;
  onSelectScreen: (screen: ScreenView) => void;
  currentUser: UserProfile | null;
  onLogout: () => void;
  isMobileSimulator: boolean;
  onToggleMobileSimulator: () => void;
}

export const ScreenSwitcherBar: React.FC<ScreenSwitcherBarProps> = ({
  currentScreen,
  onSelectScreen,
  currentUser,
  onLogout,
  isMobileSimulator,
  onToggleMobileSimulator,
}) => {
  // Determine relevant navigation items based on user role
  const getNavScreens = (): { id: ScreenView; label: string; icon: string; badge?: string }[] => {
    if (!currentUser) {
      return [{ id: 'login', label: 'Login', icon: 'lock', badge: 'Firebase' }];
    }

    if (currentUser.role === 'intern') {
      return [
        { id: 'intern_checkin', label: 'Check-in', icon: 'fingerprint', badge: 'Mobile' },
        { id: 'intern_history', label: 'History', icon: 'history', badge: 'Timecard' },
        { id: 'attendance_logs', label: 'Attendance Log', icon: 'list_alt', badge: 'Review' },
        { id: 'intern_profile', label: 'Profile', icon: 'person', badge: 'Intern' },
      ];
    }

    return [
      { id: 'payroll_admin', label: 'Payroll Export', icon: 'payments', badge: 'Finance' },
      { id: 'attendance_logs', label: 'Attendance Log', icon: 'list_alt', badge: 'Overview' },
      { id: 'admin_interns', label: 'Interns Directory', icon: 'manage_accounts', badge: 'Directory' },
      { id: 'intern_checkin', label: 'Check-in View', icon: 'fingerprint', badge: 'Intern' },
    ];
  };

  const navScreens = getNavScreens();

  return (
    <div className="bg-[#041b3c] text-white px-4 py-2 flex items-center justify-between gap-3 text-xs border-b border-[#1d3052] z-50 sticky top-0 shadow-md flex-wrap print:hidden">
      {/* Brand & Database Status */}
      <div className="flex items-center gap-2.5">
        <div className="flex items-center gap-1.5 font-black text-[#b2c5ff] tracking-wide">
          <span className="material-symbols-outlined text-[16px] text-[#0052cc] bg-white rounded p-0.5">
            how_to_reg
          </span>
          <span>Intern Check-in</span>
        </div>
        <div className="flex items-center gap-1 bg-[#10B981]/20 text-[#10B981] px-2 py-0.5 rounded-full text-[10px] font-semibold border border-[#10B981]/30">
          <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse" />
          <span>Firestore Live</span>
        </div>
      </div>

      {/* Navigation tabs */}
      <div className="flex items-center gap-1 overflow-x-auto py-0.5">
        {navScreens.map((s) => {
          const isActive = currentScreen === s.id;
          return (
            <button
              key={s.id}
              onClick={() => onSelectScreen(s.id)}
              className={`px-3 py-1 rounded-md text-[11px] font-semibold flex items-center gap-1.5 transition-all whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'bg-[#0052cc] text-white shadow-xs'
                  : 'text-[#c3c6d6] hover:text-white hover:bg-[#1d3052]'
              }`}
            >
              <span className="material-symbols-outlined text-[14px]">{s.icon}</span>
              <span>{s.label}</span>
              {s.badge && (
                <span
                  className={`text-[9px] px-1 py-0.2 rounded font-mono ${
                    isActive ? 'bg-white/20 text-white' : 'bg-[#1d3052] text-[#b2c5ff]'
                  }`}
                >
                  {s.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Authenticated User Status & Sign Out */}
      <div className="flex items-center gap-3">
        {(currentScreen === 'intern_checkin' ||
          currentScreen === 'intern_history' ||
          currentScreen === 'intern_profile' ||
          currentScreen === 'login') && (
          <button
            onClick={onToggleMobileSimulator}
            className={`px-2.5 py-1 rounded text-[11px] font-medium flex items-center gap-1 border transition-colors cursor-pointer ${
              isMobileSimulator
                ? 'bg-[#b2c5ff] text-[#041b3c] border-[#b2c5ff] font-bold'
                : 'border-[#434654] text-[#c3c6d6] hover:text-white'
            }`}
            title="Toggle Phone Frame view"
          >
            <span className="material-symbols-outlined text-[14px]">
              {isMobileSimulator ? 'smartphone' : 'laptop'}
            </span>
            <span className="hidden md:inline">
              {isMobileSimulator ? 'Phone Frame' : 'Full Screen'}
            </span>
          </button>
        )}

        {currentUser ? (
          <div className="flex items-center gap-2 border-l border-[#434654] pl-3">
            <div className="flex items-center gap-2">
              <img
                src={currentUser.avatarUrl}
                alt={currentUser.name}
                className="w-6 h-6 rounded-full object-cover border border-[#b2c5ff]"
              />
              <div className="hidden sm:flex flex-col text-left">
                <span className="text-[11px] font-bold text-white leading-tight">
                  {currentUser.name}
                </span>
                <span className="text-[9px] text-[#b2c5ff] capitalize leading-none">
                  {currentUser.role.replace('_', ' ')} • {currentUser.department}
                </span>
              </div>
            </div>

            <button
              onClick={onLogout}
              className="p-1 rounded text-[#c3c6d6] hover:text-[#ba1a1a] hover:bg-white/10 transition-colors flex items-center gap-1 cursor-pointer text-[11px] ml-1"
              title="Sign Out of Firebase Auth"
            >
              <span className="material-symbols-outlined text-[16px]">logout</span>
              <span className="hidden lg:inline">Sign Out</span>
            </button>
          </div>
        ) : (
          <button
            onClick={() => onSelectScreen('login')}
            className="bg-[#0052cc] hover:bg-[#0040a2] text-white px-3 py-1 rounded text-[11px] font-semibold flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-[14px]">login</span>
            <span>Sign In</span>
          </button>
        )}
      </div>
    </div>
  );
};
