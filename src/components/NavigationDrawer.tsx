import React from 'react';
import { ScreenView, UserProfile } from '../types';

interface NavigationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile;
  onSelectScreen: (screen: ScreenView) => void;
  onLogout: () => void;
}

export const NavigationDrawer: React.FC<NavigationDrawerProps> = ({
  isOpen,
  onClose,
  user,
  onSelectScreen,
  onLogout,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Drawer Panel */}
      <div className="relative w-72 max-w-[80vw] bg-white h-full shadow-2xl z-10 flex flex-col p-5 border-r border-[#c3c6d6]">
        {/* Drawer Header */}
        <div className="flex justify-between items-start mb-6 pb-4 border-b border-[#c3c6d6]/60">
          <div className="flex items-center gap-3">
            <img
              src={user.avatarUrl}
              alt={user.name}
              className="w-12 h-12 rounded-full object-cover border-2 border-[#0052cc]"
            />
            <div>
              <h3 className="font-bold text-sm text-[#041b3c]">{user.name}</h3>
              <p className="text-xs text-[#585f6a] capitalize">{user.role.replace('_', ' ')}</p>
              <span className="text-[10px] text-[#0052cc] font-bold bg-[#e0e8ff] px-2 py-0.5 rounded-full inline-block mt-0.5">
                {user.department}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-[#737685] hover:text-[#041b3c] rounded-full hover:bg-[#f1f3ff]"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Navigation Sections */}
        <div className="space-y-4 flex-1 overflow-y-auto">
          <div>
            <span className="text-[10px] font-bold text-[#737685] uppercase tracking-wider block mb-2">
              Application Modules
            </span>
            <div className="space-y-1">
              <button
                onClick={() => {
                  onSelectScreen('intern_checkin');
                  onClose();
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold text-[#041b3c] hover:bg-[#e0e8ff] transition-colors text-left cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px] text-[#0052cc]">
                  fingerprint
                </span>
                <span>GPS Check-in</span>
              </button>

              <button
                onClick={() => {
                  onSelectScreen('intern_history');
                  onClose();
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold text-[#041b3c] hover:bg-[#e0e8ff] transition-colors text-left cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px] text-[#0052cc]">
                  history
                </span>
                <span>Attendance History</span>
              </button>

              <button
                onClick={() => {
                  onSelectScreen('intern_profile');
                  onClose();
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold text-[#041b3c] hover:bg-[#e0e8ff] transition-colors text-left cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px] text-[#0052cc]">
                  person
                </span>
                <span>My Profile</span>
              </button>

              {(user.role === 'payroll_admin' || user.role === 'supervisor') && (
                <button
                  onClick={() => {
                    onSelectScreen('admin_interns');
                    onClose();
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold text-[#0052cc] bg-[#e0e8ff]/60 hover:bg-[#e0e8ff] transition-colors text-left cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px] text-[#0052cc]">
                    manage_accounts
                  </span>
                  <span>Interns Directory</span>
                </button>
              )}

              {(user.role === 'payroll_admin' || user.role === 'supervisor') && (
                <button
                  onClick={() => {
                    onSelectScreen('attendance_logs');
                    onClose();
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold text-[#041b3c] hover:bg-[#e0e8ff] transition-colors text-left cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px] text-[#0052cc]">
                    list_alt
                  </span>
                  <span>Attendance Log (Raw)</span>
                </button>
              )}

              {(user.role === 'supervisor' || user.role === 'payroll_admin') && (
                <button
                  onClick={() => {
                    onSelectScreen('supervisor_portal');
                    onClose();
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold text-[#041b3c] hover:bg-[#e0e8ff] transition-colors text-left cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px] text-[#0052cc]">
                    supervisor_account
                  </span>
                  <span>Supervisor Portal</span>
                </button>
              )}

              {(user.role === 'payroll_admin' || user.role === 'supervisor') && (
                <button
                  onClick={() => {
                    onSelectScreen('payroll_admin');
                    onClose();
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold text-[#041b3c] hover:bg-[#e0e8ff] transition-colors text-left cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px] text-[#0052cc]">
                    payments
                  </span>
                  <span>Payroll Export</span>
                </button>
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-[#c3c6d6]/60">
            <span className="text-[10px] font-bold text-[#737685] uppercase tracking-wider block mb-1">
              Account Info
            </span>
            <div className="p-3 bg-[#f1f3ff] rounded-xl text-xs space-y-1">
              <p className="text-[11px] text-[#585f6a]">
                Email: <span className="font-semibold text-[#041b3c]">{user.email}</span>
              </p>
              <p className="text-[11px] text-[#585f6a]">
                Bank: <span className="font-semibold text-[#041b3c]">{user.bankName}</span>
              </p>
              <p className="text-[11px] text-[#585f6a]">
                Stipend: <span className="font-bold text-[#003d9b]">{user.dailyRateTHB} THB/day</span>
              </p>
            </div>
          </div>
        </div>

        {/* Drawer Footer */}
        <div className="pt-4 border-t border-[#c3c6d6]/60">
          <button
            onClick={() => {
              onLogout();
              onClose();
            }}
            className="w-full py-2.5 bg-[#ffdad6] text-[#ba1a1a] rounded-lg text-xs font-bold hover:bg-[#fed0ca] transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">logout</span>
            <span>Sign Out (Firebase)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
