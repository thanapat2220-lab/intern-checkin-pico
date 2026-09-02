import React, { useState } from 'react';
import { AttendanceRecord, UserProfile } from '../types';

interface AttendanceHistoryScreenProps {
  user: UserProfile;
  attendanceLogs: AttendanceRecord[];
  onBack: () => void;
  onNavigate: (tab: 'checkin' | 'history' | 'profile') => void;
  approvalStatus?: 'pending' | 'approved';
}

const MONTHS = ['August 2023', 'September 2023', 'October 2023', 'November 2023'];

export const AttendanceHistoryScreen: React.FC<AttendanceHistoryScreenProps> = ({
  user,
  attendanceLogs,
  onBack,
  onNavigate,
  approvalStatus = 'pending',
}) => {
  const [selectedMonthIndex, setSelectedMonthIndex] = useState(2); // October 2023
  const [visibleCount, setVisibleCount] = useState(5);
  const [showNotificationModal, setShowNotificationModal] = useState(false);

  const selectedMonth = MONTHS[selectedMonthIndex];

  const handlePrevMonth = () => {
    if (selectedMonthIndex > 0) {
      setSelectedMonthIndex(selectedMonthIndex - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonthIndex < MONTHS.length - 1) {
      setSelectedMonthIndex(selectedMonthIndex + 1);
    }
  };

  const handleLoadMore = () => {
    setVisibleCount((prev) => Math.min(prev + 4, attendanceLogs.length));
  };

  const displayedLogs = attendanceLogs.slice(0, visibleCount);
  const officeDaysCount = attendanceLogs.filter((l) => l.locationType === 'office').length;
  const outsideDaysCount = attendanceLogs.filter((l) => l.locationType === 'outside').length;

  return (
    <div className="bg-[#f9f9ff] text-[#041b3c] min-h-screen flex flex-col antialiased font-sans pb-safe">
      {/* TopAppBar */}
      <header className="fixed top-0 w-full z-40 bg-white/95 backdrop-blur-sm border-b border-[#c3c6d6] shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
        <div className="flex justify-between items-center px-4 md:px-6 h-16 w-full max-w-7xl mx-auto">
          <div className="flex items-center gap-2">
            <button
              onClick={onBack}
              className="material-symbols-outlined text-[#003d9b] cursor-pointer active:opacity-70 hover:bg-[#f1f3ff] transition-colors rounded-full p-2"
              title="Go back"
              aria-label="Back"
            >
              arrow_back
            </button>
            <div className="w-8 h-8 rounded-full bg-[#dae0ee] overflow-hidden flex items-center justify-center border border-[#c3c6d6]">
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.name}
                  className="object-cover w-full h-full"
                />
              ) : (
                <span className="material-symbols-outlined text-[#585f6a] text-[20px]">person</span>
              )}
            </div>
          </div>

          <h1 className="text-[20px] text-[#003d9b] font-bold tracking-tight">
            Attendance History
          </h1>

          <button
            onClick={() => setShowNotificationModal(true)}
            className="material-symbols-outlined text-[#003d9b] cursor-pointer active:opacity-70 hover:bg-[#f1f3ff] transition-colors rounded-full p-2"
            title="Notifications"
          >
            notifications
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-grow pt-20 px-4 md:px-6 max-w-3xl mx-auto w-full flex flex-col gap-5 pb-28">
        {/* Month Selector */}
        <section className="flex items-center justify-between bg-white border border-[#c3c6d6] rounded-lg p-2 shadow-[0px_4px_12px_rgba(0,0,0,0.04)] mt-1">
          <button
            onClick={handlePrevMonth}
            disabled={selectedMonthIndex === 0}
            className="p-2 rounded-full hover:bg-[#f1f3ff] transition-colors active:scale-95 flex items-center justify-center text-[#434654] disabled:opacity-30 cursor-pointer"
            aria-label="Previous Month"
          >
            <span className="material-symbols-outlined">chevron_left</span>
          </button>
          <h2 className="text-[18px] md:text-[20px] font-semibold text-[#041b3c]">
            {selectedMonth}
          </h2>
          <button
            onClick={handleNextMonth}
            disabled={selectedMonthIndex === MONTHS.length - 1}
            className="p-2 rounded-full hover:bg-[#f1f3ff] transition-colors active:scale-95 flex items-center justify-center text-[#434654] disabled:opacity-30 cursor-pointer"
            aria-label="Next Month"
          >
            <span className="material-symbols-outlined">chevron_right</span>
          </button>
        </section>

        {/* Location Breakdown Summary Bar */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white border border-[#c3c6d6] p-3 rounded-xl flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#e0e8ff] text-[#003d9b] flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px]">corporate_fare</span>
            </div>
            <div>
              <span className="text-[11px] font-medium text-[#585f6a] block">Office Days</span>
              <span className="text-[16px] font-bold text-[#003d9b]">{officeDaysCount} Days</span>
            </div>
          </div>

          <div className="bg-white border border-[#c3c6d6] p-3 rounded-xl flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#dae0ee] text-[#434654] flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px]">travel_explore</span>
            </div>
            <div>
              <span className="text-[11px] font-medium text-[#585f6a] block">Outside / Travel</span>
              <span className="text-[16px] font-bold text-[#434654]">{outsideDaysCount} Days</span>
            </div>
          </div>
        </div>

        {/* Daily Log List */}
        <section className="flex flex-col gap-3">
          {displayedLogs.map((log) => {
            const isLate = log.status === 'late';
            const isOffice = log.locationType === 'office';

            return (
              <div
                key={log.id}
                className="bg-white border border-[#c3c6d6] rounded-xl p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative overflow-hidden transition-all hover:shadow-xs"
              >
                <div className="flex items-center gap-3.5 w-full md:w-auto">
                  {/* Month / Date Badge */}
                  <div className="flex flex-col items-center justify-center p-2 rounded-lg min-w-[56px] bg-[#f1f3ff] text-[#003d9b] border border-[#c3c6d6]/50">
                    <span className="text-[11px] font-bold tracking-wider uppercase">
                      {log.monthName}
                    </span>
                    <span className="text-[19px] font-bold leading-tight">{log.date}</span>
                  </div>

                  <div className="flex flex-col">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[14px] text-[#041b3c] font-semibold">{log.dayOfWeek}</span>

                      {/* Location Type Badge: Office (blue) vs Outside (gray) */}
                      {isOffice ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-[#e0e8ff] text-[#003d9b] px-2.5 py-0.5 rounded-full border border-[#003d9b]/20">
                          <span className="material-symbols-outlined text-[13px]">corporate_fare</span>
                          Office
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-[#eceef4] text-[#434654] px-2.5 py-0.5 rounded-full border border-[#c3c6d6]">
                          <span className="material-symbols-outlined text-[13px]">travel_explore</span>
                          Outside
                        </span>
                      )}

                      {isLate && (
                        <span className="text-[10px] font-semibold bg-[#fff8e1] text-[#b45309] px-2 py-0.5 rounded-full border border-[#ffe082]">
                          Late Arrival
                        </span>
                      )}
                    </div>

                    {/* Check-in to Check-out Time */}
                    <div className="flex items-center gap-2 mt-1">
                      <span
                        className={`text-[13px] font-medium ${
                          isLate ? 'text-[#ba1a1a]' : 'text-[#041b3c]'
                        }`}
                      >
                        {log.checkInTime}
                      </span>
                      <span className="material-symbols-outlined text-[#737685] text-[15px]">
                        arrow_right_alt
                      </span>
                      <span className="text-[13px] font-medium text-[#041b3c]">
                        {log.checkOutTime || '--:--'}
                      </span>
                    </div>

                    {/* Location Note / Provincial Site */}
                    {(log.locationNote || log.notes) && (
                      <p className="text-[12px] text-[#585f6a] mt-1 flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px] text-[#0052cc]">
                          location_on
                        </span>
                        {log.locationNote || log.notes}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between md:justify-end w-full md:w-auto gap-5 border-t border-[#c3c6d6]/60 md:border-none pt-2.5 md:pt-0">
                  <div className="flex flex-col md:items-end">
                    <span className="text-[10px] font-semibold text-[#585f6a] uppercase tracking-wider">
                      Duration
                    </span>
                    <span className="text-[15px] font-bold text-[#003d9b]">
                      {log.totalDuration}
                    </span>
                  </div>

                  <span
                    className="material-symbols-outlined text-[#10B981] bg-[#10B981]/10 rounded-full p-1.5 filled"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                    title="Recorded"
                  >
                    check_circle
                  </span>
                </div>
              </div>
            );
          })}

          {visibleCount < attendanceLogs.length && (
            <button
              onClick={handleLoadMore}
              className="w-full py-2.5 border border-[#c3c6d6] rounded-lg text-[#003d9b] font-semibold text-[13px] hover:bg-[#f1f3ff] transition-colors mt-1 cursor-pointer active:scale-[0.99]"
            >
              Load More ({attendanceLogs.length - visibleCount} remaining)
            </button>
          )}
        </section>

        {/* Monthly Summary Card */}
        <section className="bg-[#e0e8ff] rounded-xl p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border border-[#c3c6d6] mt-auto shadow-sm">
          <div className="flex flex-col">
            <h3 className="text-[18px] font-bold text-[#041b3c] mb-0.5">Monthly Summary</h3>
            <span className="text-[13px] text-[#434654]">{selectedMonth}</span>
          </div>

          <div className="flex flex-col md:flex-row gap-6 w-full md:w-auto mt-2 md:mt-0 pt-3 md:pt-0 border-t border-[#c3c6d6]/60 md:border-none">
            <div className="flex flex-col">
              <span className="text-[11px] font-semibold text-[#434654] uppercase tracking-wider">
                Total Days
              </span>
              <span className="text-[26px] font-bold text-[#003d9b] leading-tight">
                {attendanceLogs.length || 18}
              </span>
            </div>

            <div className="flex flex-col">
              <span className="text-[11px] font-semibold text-[#434654] uppercase tracking-wider mb-1.5">
                Approval Status
              </span>
              {approvalStatus === 'approved' ? (
                <div className="flex items-center gap-2 bg-[#E6F4EA] px-3 py-1.5 rounded-full border border-[#137333]/30 w-fit">
                  <div className="w-2 h-2 rounded-full bg-[#137333]" />
                  <span className="text-[11px] text-[#137333] uppercase font-bold">
                    Approved by Manager
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2 bg-[#d7e2ff] px-3 py-1.5 rounded-full border border-[#003d9b]/30 w-fit">
                  <div className="w-2 h-2 rounded-full bg-[#003d9b]" />
                  <span className="text-[11px] text-[#003d9b] uppercase font-bold tracking-wide">
                    Pending Manager Review
                  </span>
                </div>
              )}
            </div>
          </div>
        </section>
      </main>

      {/* BottomNavBar */}
      <nav className="fixed bottom-0 w-full z-40 bg-white border-t border-[#c3c6d6] md:hidden shadow-[0_-2px_10px_rgba(0,0,0,0.03)]">
        <div className="flex justify-around items-center h-20 w-full px-4 pb-safe">
          {/* Home (Inactive) */}
          <button
            onClick={() => onNavigate('checkin')}
            className="flex flex-col items-center justify-center text-[#5c636f] hover:text-[#003d9b] transition-all active:scale-95 cursor-pointer"
          >
            <span className="material-symbols-outlined">home</span>
            <span className="text-[12px] font-semibold mt-1">Home</span>
          </button>

          {/* History (Active) */}
          <button
            onClick={() => onNavigate('history')}
            className="flex flex-col items-center justify-center bg-[#0052cc] text-white rounded-full px-6 py-2 transition-transform active:scale-95 cursor-pointer shadow-sm"
          >
            <span
              className="material-symbols-outlined filled"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              calendar_month
            </span>
            <span className="text-[12px] font-semibold mt-0.5">History</span>
          </button>

          {/* Profile (Inactive) */}
          <button
            onClick={() => onNavigate('profile')}
            className="flex flex-col items-center justify-center text-[#5c636f] hover:text-[#003d9b] transition-all active:scale-95 cursor-pointer"
          >
            <span className="material-symbols-outlined">person</span>
            <span className="text-[12px] font-semibold mt-1">Profile</span>
          </button>
        </div>
      </nav>

      {/* Notification Modal */}
      {showNotificationModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-sm w-full p-5 shadow-xl border border-[#c3c6d6]">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-bold text-[18px] text-[#041b3c] flex items-center gap-2">
                <span className="material-symbols-outlined text-[#0052cc]">notifications</span>
                Notifications
              </h3>
              <button
                onClick={() => setShowNotificationModal(false)}
                className="text-[#737685] hover:text-[#041b3c]"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            <div className="space-y-3 text-sm text-[#434654]">
              <div className="p-3 bg-[#f1f3ff] rounded-lg border border-[#c3c6d6]/50">
                <p className="font-semibold text-[#003d9b]">Monthly Cycle Submission</p>
                <p className="text-xs text-[#585f6a] mt-0.5">
                  Your October attendance sheet was forwarded to Supervisor Amanda Vance for payroll verification.
                </p>
              </div>
              <div className="p-3 bg-[#f9f9ff] rounded-lg border border-[#c3c6d6]/50">
                <p className="font-semibold text-[#041b3c]">Outside Work Recorded</p>
                <p className="text-xs text-[#585f6a] mt-0.5">
                  Trip to Chiang Mai client site logged with GPS coordinates and note saved.
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowNotificationModal(false)}
              className="mt-4 w-full py-2 bg-[#0052cc] text-white font-medium rounded-lg hover:bg-[#0040a2] transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
