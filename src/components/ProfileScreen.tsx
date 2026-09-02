import React from 'react';
import { UserProfile } from '../types';

interface ProfileScreenProps {
  user: UserProfile;
  onBack: () => void;
  onLogout: () => void;
  onNavigate: (tab: 'checkin' | 'history' | 'profile') => void;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({
  user,
  onBack,
  onLogout,
  onNavigate,
}) => {
  return (
    <div className="bg-[#f9f9ff] text-[#041b3c] min-h-screen flex flex-col antialiased font-sans pb-24">
      {/* TopAppBar */}
      <header className="fixed top-0 w-full z-40 bg-white border-b border-[#c3c6d6] flex justify-between items-center px-6 h-16 shadow-xs">
        <button
          onClick={onBack}
          className="material-symbols-outlined text-[#003d9b] p-2 rounded-full hover:bg-[#f1f3ff] cursor-pointer"
        >
          arrow_back
        </button>
        <h1 className="text-[18px] font-bold text-[#003d9b]">Intern Profile</h1>
        <div className="w-8" />
      </header>

      {/* Main Content */}
      <main className="flex-1 pt-20 px-6 max-w-md mx-auto w-full flex flex-col gap-6">
        {/* Profile Card */}
        <div className="bg-white border border-[#c3c6d6] rounded-2xl p-6 flex flex-col items-center text-center shadow-xs mt-2">
          <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-[#0052cc] p-0.5 shadow-md mb-3">
            <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover rounded-full" />
          </div>
          <h2 className="text-[20px] font-bold text-[#041b3c]">{user.name}</h2>
          <span className="text-xs font-semibold text-[#0052cc] bg-[#e0e8ff] px-3 py-1 rounded-full mt-1">
            {user.department} Intern • {user.team}
          </span>
          <p className="text-xs text-[#585f6a] mt-2">{user.email}</p>
        </div>

        {/* Details List */}
        <div className="bg-white border border-[#c3c6d6] rounded-xl p-5 shadow-xs space-y-3">
          <h3 className="text-xs font-bold text-[#585f6a] uppercase tracking-wider mb-2">
            Placement & Payroll Details
          </h3>

          <div className="flex justify-between items-center py-2 border-b border-[#c3c6d6]/50 text-xs">
            <span className="text-[#585f6a]">Internship Period</span>
            <span className="font-semibold text-[#041b3c]">{user.internshipPeriod}</span>
          </div>

          <div className="flex justify-between items-center py-2 border-b border-[#c3c6d6]/50 text-xs">
            <span className="text-[#585f6a]">Daily Stipend Rate</span>
            <span className="font-bold text-[#003d9b]">{user.dailyRateTHB} THB / day</span>
          </div>

          <div className="flex justify-between items-center py-2 border-b border-[#c3c6d6]/50 text-xs">
            <span className="text-[#585f6a]">Bank Beneficiary</span>
            <span className="font-semibold text-[#041b3c]">{user.bankName}</span>
          </div>

          <div className="flex justify-between items-center py-2 text-xs">
            <span className="text-[#585f6a]">Account Number</span>
            <span className="font-mono text-[#041b3c] font-semibold">{user.accountNumber}</span>
          </div>
        </div>

        {/* Action Button */}
        <div className="space-y-2">
          <button
            onClick={() => onNavigate('history')}
            className="w-full py-3 bg-[#0052cc] hover:bg-[#0040a2] text-white rounded-xl text-xs font-semibold shadow-xs flex items-center justify-center gap-2 cursor-pointer transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">calendar_month</span>
            <span>View Full Attendance History</span>
          </button>

          <button
            onClick={onLogout}
            className="w-full py-2.5 border border-[#ba1a1a] text-[#ba1a1a] hover:bg-[#ffdad6]/30 rounded-xl text-xs font-semibold cursor-pointer transition-colors flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]">logout</span>
            <span>Sign Out / Switch User</span>
          </button>
        </div>
      </main>

      {/* BottomNavBar */}
      <nav className="fixed bottom-0 left-0 w-full flex justify-around items-center h-20 px-4 bg-white border-t border-[#c3c6d6] z-40">
        <button
          onClick={() => onNavigate('checkin')}
          className="flex flex-col items-center justify-center text-[#585f6a] hover:text-[#003d9b] transition-all cursor-pointer"
        >
          <span className="material-symbols-outlined">home</span>
          <span className="text-[12px] font-semibold mt-1">Home</span>
        </button>

        <button
          onClick={() => onNavigate('history')}
          className="flex flex-col items-center justify-center text-[#585f6a] hover:text-[#003d9b] transition-all cursor-pointer"
        >
          <span className="material-symbols-outlined">history</span>
          <span className="text-[12px] font-semibold mt-1">History</span>
        </button>

        <button
          onClick={() => onNavigate('profile')}
          className="flex flex-col items-center justify-center bg-[#0052cc] text-white rounded-full px-5 py-1.5 cursor-pointer shadow-sm"
        >
          <span className="material-symbols-outlined filled" style={{ fontVariationSettings: "'FILL' 1" }}>
            person
          </span>
          <span className="text-[12px] font-semibold mt-0.5">Profile</span>
        </button>
      </nav>
    </div>
  );
};
