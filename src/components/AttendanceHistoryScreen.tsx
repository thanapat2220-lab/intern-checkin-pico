import React, { useState, useMemo } from 'react';
import { AttendanceRecord, UserProfile } from '../types';
import { getChronologicalMonthsList, formatMonthYear } from '../utils/dateUtils';
import { isMissingCheckout, calculateDurationStr } from '../utils/attendanceLogUtils';
import { getMergedRecordNotes } from '../utils/noteUtils';

interface AttendanceHistoryScreenProps {
  user: UserProfile;
  attendanceLogs: AttendanceRecord[];
  onBack: () => void;
  onNavigate: (tab: 'checkin' | 'history' | 'profile') => void;
  approvalStatus?: 'pending' | 'approved';
  onCheckOut?: (recordId: string, checkOutTime: string, note?: string) => void;
}

export const AttendanceHistoryScreen: React.FC<AttendanceHistoryScreenProps> = ({
  user,
  attendanceLogs,
  onBack,
  onNavigate,
  approvalStatus = 'pending',
  onCheckOut,
}) => {
  // Generate chronological list of months (e.g. past 4 months + current month + 1 future month)
  const months = useMemo(() => getChronologicalMonthsList(4, 1), []);
  const currentMonthStr = formatMonthYear();
  
  // Default to the current month in the list
  const initialIndex = useMemo(() => {
    const idx = months.indexOf(currentMonthStr);
    return idx !== -1 ? idx : Math.max(0, months.length - 2);
  }, [months, currentMonthStr]);

  const [selectedMonthIndex, setSelectedMonthIndex] = useState(initialIndex);
  const [visibleCount, setVisibleCount] = useState(5);
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [resolvingLog, setResolvingLog] = useState<AttendanceRecord | null>(null);
  const [resolveTime, setResolveTime] = useState('11:30 PM');
  const [resolveNote, setResolveNote] = useState('');

  const selectedMonth = months[selectedMonthIndex] || currentMonthStr;

  const handlePrevMonth = () => {
    if (selectedMonthIndex > 0) {
      setSelectedMonthIndex(selectedMonthIndex - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonthIndex < months.length - 1) {
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
            disabled={selectedMonthIndex === months.length - 1}
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
            const isMissing = isMissingCheckout(log);

            return (
              <div
                key={log.id}
                className={`bg-white border rounded-xl p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative overflow-hidden transition-all hover:shadow-xs ${
                  isMissing ? 'border-2 border-[#f87171] bg-[#fffaf8]' : 'border-[#c3c6d6]'
                }`}
              >
                <div className="flex items-center gap-3.5 w-full md:w-auto">
                  {/* Month / Date Badge */}
                  <div className={`flex flex-col items-center justify-center p-2 rounded-lg min-w-[56px] border ${
                    isMissing
                      ? 'bg-[#fee2e2] text-[#b91c1c] border-[#f87171]/50'
                      : 'bg-[#f1f3ff] text-[#003d9b] border-[#c3c6d6]/50'
                  }`}>
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

                      {/* Missing Check-out Status Badge */}
                      {isMissing && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-[#fee2e2] text-[#b91c1c] px-2.5 py-0.5 rounded-full border border-[#f87171]/50">
                          <span className="material-symbols-outlined text-[13px]">warning</span>
                          Missing Check-out
                        </span>
                      )}
                    </div>

                    {/* Check-in to Check-out Time */}
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[13px] font-medium text-[#041b3c]">
                        {log.checkInTime}
                      </span>
                      <span className="material-symbols-outlined text-[#737685] text-[15px]">
                        arrow_right_alt
                      </span>
                      <span className={`text-[13px] font-medium ${isMissing ? 'text-[#b91c1c] font-bold' : 'text-[#041b3c]'}`}>
                        {log.checkOutTime || '--:--'}
                      </span>
                    </div>

                    {/* Notes (Unified Check-in / Check-out) */}
                    {getMergedRecordNotes(log) && (
                      <p className="text-[12px] text-[#585f6a] mt-1 flex items-center gap-1.5 flex-wrap">
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#0052cc] bg-[#f1f3ff] px-2 py-0.5 rounded border border-[#c3c6d6]/60">
                          <span className="material-symbols-outlined text-[13px]">notes</span>
                          <span>Notes:</span>
                          <span className="font-normal text-[#041b3c]">{getMergedRecordNotes(log)}</span>
                        </span>
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between md:justify-end w-full md:w-auto gap-4 border-t border-[#c3c6d6]/60 md:border-none pt-2.5 md:pt-0">
                  {isMissing ? (
                    <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
                      <div className="flex flex-col md:items-end">
                        <span className="text-[10px] font-semibold text-[#b91c1c] uppercase tracking-wider">
                          Status
                        </span>
                        <span className="text-[13px] font-bold text-[#b91c1c]">
                          Missing Check-out
                        </span>
                      </div>

                      {onCheckOut && (
                        <button
                          type="button"
                          onClick={() => {
                            setResolvingLog(log);
                            setResolveTime('11:30 PM');
                            setResolveNote('');
                          }}
                          className="px-3 py-1.5 bg-[#ea580c] hover:bg-[#c2410c] text-white text-[11px] font-bold rounded-lg shadow-xs transition-all flex items-center gap-1 cursor-pointer active:scale-95"
                        >
                          <span className="material-symbols-outlined text-[14px]">alarm_on</span>
                          <span>Log Check-out</span>
                        </button>
                      )}
                    </div>
                  ) : (
                    <>
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
                    </>
                  )}
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
                  Your {selectedMonth} attendance sheet was forwarded to supervisor for payroll verification.
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

      {/* Missed Check-out Resolution Modal */}
      {resolvingLog && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-[#c3c6d6] flex flex-col gap-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#e8edff]">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-[#fee2e2] text-[#b91c1c] flex items-center justify-center">
                  <span className="material-symbols-outlined text-[20px]">history_toggle_off</span>
                </div>
                <div>
                  <h3 className="text-[16px] font-bold text-[#041b3c]">Log Missed Check-out</h3>
                  <p className="text-[11px] text-[#585f6a]">
                    {resolvingLog.dayOfWeek}, {resolvingLog.monthName} {resolvingLog.date}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setResolvingLog(null)}
                className="text-[#737685] hover:text-[#041b3c] p-1"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="text-[12px] bg-[#fff7ed] text-[#7c2d12] p-3 rounded-xl border border-[#f97316]/30">
              <span className="font-bold block text-[#9a3412]">Event & Exhibition Shift</span>
              Check-in was recorded at <strong>{resolvingLog.checkInTime}</strong>. Please enter your departure time for supervisor review.
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#434654] uppercase tracking-wider mb-1.5">
                Quick Presets
              </label>
              <div className="grid grid-cols-3 gap-2">
                {['09:00 PM', '10:30 PM', '11:45 PM', '01:00 AM', '02:00 AM', '03:00 AM'].map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setResolveTime(t)}
                    className={`py-1.5 px-2 text-[11px] font-semibold rounded-lg border cursor-pointer ${
                      resolveTime === t
                        ? 'bg-[#003d9b] text-white border-[#003d9b]'
                        : 'bg-[#f1f3ff] text-[#041b3c] border-[#c3c6d6]/60 hover:bg-[#e0e8ff]'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#434654] uppercase tracking-wider mb-1">
                Actual Departure Time
              </label>
              <input
                type="text"
                value={resolveTime}
                onChange={(e) => setResolveTime(e.target.value)}
                placeholder="e.g. 11:30 PM or 01:00 AM"
                className="w-full px-3 py-2 text-[14px] font-bold bg-[#f9f9ff] border border-[#c3c6d6] rounded-xl text-[#041b3c]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#434654] uppercase tracking-wider mb-1">
                Note for Supervisor
              </label>
              <input
                type="text"
                value={resolveNote}
                onChange={(e) => setResolveNote(e.target.value)}
                placeholder="e.g. worked until 1 AM at event, forgot to check out"
                className="w-full px-3 py-2 text-[12px] bg-[#f9f9ff] border border-[#c3c6d6] rounded-xl text-[#041b3c]"
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-[#e8edff]">
              <button
                type="button"
                onClick={() => setResolvingLog(null)}
                className="w-full py-2.5 px-4 rounded-xl border border-[#c3c6d6] text-xs font-semibold text-[#434654] hover:bg-[#f1f3ff]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onCheckOut && resolvingLog) {
                    onCheckOut(resolvingLog.id, resolveTime, resolveNote);
                  }
                  setResolvingLog(null);
                }}
                className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-[#ea580c] hover:bg-[#c2410c] flex items-center justify-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[16px]">save</span>
                <span>Save Check-out</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
