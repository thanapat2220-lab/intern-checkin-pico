import React, { useState, useMemo } from 'react';
import { AttendanceRecord, InternMonthlyReview, UserProfile } from '../types';
import { getChronologicalMonthsList, formatMonthYear } from '../utils/dateUtils';
import { isMissingCheckout } from '../utils/attendanceLogUtils';
import { getMergedRecordNotes } from '../utils/noteUtils';
import { AuditBadge } from './AuditBadge';

interface AttendanceHistoryScreenProps {
  user: UserProfile;
  attendanceLogs: AttendanceRecord[];
  onBack: () => void;
  onNavigate: (tab: 'checkin' | 'history' | 'profile') => void;
  approvalStatus?: 'pending' | 'approved';
  onCheckOut?: (recordId: string, checkOutTime: string, note?: string) => Promise<void> | void;
  supervisorReviews?: InternMonthlyReview[];
}

export const AttendanceHistoryScreen: React.FC<AttendanceHistoryScreenProps> = ({
  user,
  attendanceLogs,
  onBack,
  onNavigate,
  approvalStatus = 'pending',
  onCheckOut,
  supervisorReviews,
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
  const [scopeFilter, setScopeFilter] = useState<'month' | 'all'>('month');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
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

  // Helper to sort records chronologically descending (newest first)
  const sortRecordsDesc = (records: AttendanceRecord[]) => {
    return [...records].sort((a, b) => {
      // 1. Sort by epoch timestamp if available
      if (a.createdAt && b.createdAt) {
        const timeA = new Date(a.createdAt).getTime();
        const timeB = new Date(b.createdAt).getTime();
        if (timeA !== timeB) return timeB - timeA;
      }
      // 2. Sort by date number
      const dateA = typeof a.date === 'number' ? a.date : parseInt(String(a.date || 0), 10);
      const dateB = typeof b.date === 'number' ? b.date : parseInt(String(b.date || 0), 10);
      if (dateB !== dateA) return dateB - dateA;
      return 0;
    });
  };

  // Filter attendance records for this intern across all months
  const allInternLogs = useMemo(() => {
    const filtered = attendanceLogs.filter((record) => {
      if (user?.id && record.internId && record.internId !== user.id) {
        return false;
      }
      return true;
    });
    return sortRecordsDesc(filtered);
  }, [attendanceLogs, user?.id]);

  // Filter attendance records for this intern in the selected month
  const monthLogs = useMemo(() => {
    const normSelected = selectedMonth.trim().toLowerCase();
    const normCurrent = currentMonthStr.trim().toLowerCase();

    const filtered = allInternLogs.filter((record) => {
      // 1. Check exact or normalized monthYear match
      if (record.monthYear) {
        return record.monthYear.trim().toLowerCase() === normSelected;
      }

      // 2. Fallback: Parse createdAt timestamp if available
      if (record.createdAt) {
        try {
          const d = new Date(record.createdAt);
          if (!isNaN(d.getTime())) {
            return formatMonthYear(d).trim().toLowerCase() === normSelected;
          }
        } catch (_) {}
      }

      // 3. Fallback for legacy un-tagged records: match against current month
      return normSelected === normCurrent;
    });

    return sortRecordsDesc(filtered);
  }, [allInternLogs, selectedMonth, currentMonthStr]);

  // Active records shown based on scope toggle (month vs all)
  const activeLogs = scopeFilter === 'month' ? monthLogs : allInternLogs;

  // Derive counts from the active scope so cards and table are 100% synchronized
  const officeDaysCount = useMemo(() => {
    return activeLogs.filter((l) => l.locationType === 'office').length;
  }, [activeLogs]);

  const outsideDaysCount = useMemo(() => {
    return activeLogs.filter((l) => l.locationType === 'outside').length;
  }, [activeLogs]);

  // Guaranteed invariant: Office Days + Outside Days = Total Days
  const totalDaysCount = useMemo(() => {
    return officeDaysCount + outsideDaysCount;
  }, [officeDaysCount, outsideDaysCount]);

  // Month-specific supervisor approval review if available
  const currentMonthReview = useMemo(() => {
    if (!supervisorReviews || !user?.id) return null;
    return supervisorReviews.find(
      (r) =>
        r.internId === user.id &&
        r.monthYear?.trim().toLowerCase() === selectedMonth.trim().toLowerCase()
    );
  }, [supervisorReviews, user?.id, selectedMonth]);

  const effectiveApprovalStatus = currentMonthReview?.status || approvalStatus || 'pending';

  return (
    <div className="bg-[#f9f9ff] text-[#041b3c] min-h-screen flex flex-col antialiased font-sans pb-safe">
      {/* TopAppBar */}
      <header className="fixed top-0 w-full z-40 bg-white/95 backdrop-blur-sm border-b border-[#c3c6d6] shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
        <div className="flex justify-between items-center px-4 md:px-6 h-16 w-full max-w-7xl mx-auto">
          <div className="flex items-center gap-2.5">
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
            <div className="hidden sm:flex flex-col">
              <span className="text-[13px] font-bold text-[#041b3c] leading-tight">{user.name}</span>
              <span className="text-[11px] text-[#585f6a]">
                {user.department || 'Intern'} • ID: {user.id.slice(0, 10)}
              </span>
            </div>
          </div>

          <h1 className="text-[18px] md:text-[20px] text-[#003d9b] font-bold tracking-tight">
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
      <main className="flex-grow pt-20 px-4 md:px-6 max-w-5xl mx-auto w-full flex flex-col gap-5 pb-28">
        {/* Month Selector & Scope Filter Bar */}
        <section className="bg-white border border-[#c3c6d6] rounded-2xl p-3 md:p-4 shadow-[0px_4px_12px_rgba(0,0,0,0.03)] flex flex-col sm:flex-row justify-between items-center gap-3 mt-1">
          <div className="flex items-center justify-between w-full sm:w-auto gap-3">
            <button
              onClick={handlePrevMonth}
              disabled={selectedMonthIndex === 0 || scopeFilter === 'all'}
              className="p-2 rounded-full hover:bg-[#f1f3ff] transition-colors active:scale-95 flex items-center justify-center text-[#434654] disabled:opacity-25 cursor-pointer"
              aria-label="Previous Month"
              title="Previous Month"
            >
              <span className="material-symbols-outlined">chevron_left</span>
            </button>
            
            <div className="text-center min-w-[170px]">
              <h2 className="text-[17px] md:text-[19px] font-bold text-[#041b3c]">
                {scopeFilter === 'all' ? 'All Billing Cycles' : selectedMonth}
              </h2>
              <span className="text-[11px] text-[#585f6a] block font-medium">
                {scopeFilter === 'all'
                  ? `Showing full attendance history (${allInternLogs.length} shifts)`
                  : selectedMonth === currentMonthStr
                  ? 'Current Billing Cycle'
                  : 'Past Billing Cycle'}
              </span>
            </div>

            <button
              onClick={handleNextMonth}
              disabled={selectedMonthIndex === months.length - 1 || scopeFilter === 'all'}
              className="p-2 rounded-full hover:bg-[#f1f3ff] transition-colors active:scale-95 flex items-center justify-center text-[#434654] disabled:opacity-25 cursor-pointer"
              aria-label="Next Month"
              title="Next Month"
            >
              <span className="material-symbols-outlined">chevron_right</span>
            </button>
          </div>

          {/* Scope Filter Switch: Selected Month vs All History */}
          <div className="flex items-center gap-1.5 bg-[#f1f3ff] p-1 rounded-xl border border-[#c3c6d6] w-full sm:w-auto justify-center">
            <button
              type="button"
              onClick={() => setScopeFilter('month')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                scopeFilter === 'month'
                  ? 'bg-[#003d9b] text-white shadow-xs'
                  : 'text-[#585f6a] hover:text-[#041b3c]'
              }`}
            >
              {selectedMonth} ({monthLogs.length})
            </button>
            <button
              type="button"
              onClick={() => setScopeFilter('all')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                scopeFilter === 'all'
                  ? 'bg-[#003d9b] text-white shadow-xs'
                  : 'text-[#585f6a] hover:text-[#041b3c]'
              }`}
            >
              All Records ({allInternLogs.length})
            </button>
          </div>
        </section>

        {/* Unified Summary Cards Section (Grouped directly above the day-by-day table) */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Card 1: Total Days */}
          <div className="bg-white border border-[#c3c6d6] p-4 rounded-2xl shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-[#585f6a] uppercase tracking-wider">
                Total Days
              </span>
              <div className="w-8 h-8 rounded-full bg-[#e0e8ff] text-[#003d9b] flex items-center justify-center">
                <span className="material-symbols-outlined text-[18px]">calendar_today</span>
              </div>
            </div>
            <div className="mt-2">
              <span className="text-[26px] font-black text-[#003d9b] leading-tight block">
                {totalDaysCount} Days
              </span>
              <span className="text-[11px] text-[#585f6a] font-medium mt-0.5 block">
                Office ({officeDaysCount}) + Outside ({outsideDaysCount})
              </span>
            </div>
          </div>

          {/* Card 2: Office Days */}
          <div className="bg-white border border-[#c3c6d6] p-4 rounded-2xl shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-[#585f6a] uppercase tracking-wider">
                Office Days
              </span>
              <div className="w-8 h-8 rounded-full bg-[#e0e8ff] text-[#003d9b] flex items-center justify-center">
                <span className="material-symbols-outlined text-[18px]">corporate_fare</span>
              </div>
            </div>
            <div className="mt-2">
              <span className="text-[26px] font-black text-[#003d9b] leading-tight block">
                {officeDaysCount} Days
              </span>
              <span className="text-[11px] text-[#003d9b] font-semibold mt-0.5 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[#003d9b]"></span>
                Bangkok HQ
              </span>
            </div>
          </div>

          {/* Card 3: Outside / Travel Days */}
          <div className="bg-white border border-[#c3c6d6] p-4 rounded-2xl shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-[#585f6a] uppercase tracking-wider">
                Outside / Travel
              </span>
              <div className="w-8 h-8 rounded-full bg-[#dae0ee] text-[#434654] flex items-center justify-center">
                <span className="material-symbols-outlined text-[18px]">travel_explore</span>
              </div>
            </div>
            <div className="mt-2">
              <span className="text-[26px] font-black text-[#434654] leading-tight block">
                {outsideDaysCount} Days
              </span>
              <span className="text-[11px] text-[#434654] font-semibold mt-0.5 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[#434654]"></span>
                Off-site / Field Shifts
              </span>
            </div>
          </div>

          {/* Card 4: Approval Status */}
          <div className="bg-white border border-[#c3c6d6] p-4 rounded-2xl shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-[#585f6a] uppercase tracking-wider">
                Approval Status
              </span>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                effectiveApprovalStatus === 'approved' ? 'bg-[#E6F4EA] text-[#137333]' : 'bg-[#d7e2ff] text-[#003d9b]'
              }`}>
                <span className="material-symbols-outlined text-[18px]">
                  {effectiveApprovalStatus === 'approved' ? 'verified' : 'hourglass_top'}
                </span>
              </div>
            </div>
            <div className="mt-2">
              {effectiveApprovalStatus === 'approved' ? (
                <div className="flex items-center gap-1.5 bg-[#E6F4EA] px-2.5 py-1 rounded-full border border-[#137333]/30 w-fit">
                  <div className="w-2 h-2 rounded-full bg-[#137333]" />
                  <span className="text-[11px] text-[#137333] uppercase font-bold tracking-wide">
                    Approved
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 bg-[#d7e2ff] px-2.5 py-1 rounded-full border border-[#003d9b]/30 w-fit">
                  <div className="w-2 h-2 rounded-full bg-[#003d9b]" />
                  <span className="text-[11px] text-[#003d9b] uppercase font-bold tracking-wide">
                    Pending Review
                  </span>
                </div>
              )}
              <span className="text-[11px] text-[#585f6a] font-medium mt-1.5 block">
                {scopeFilter === 'all' ? 'Latest Cycle Status' : `${selectedMonth} Verification`}
              </span>
            </div>
          </div>
        </section>

        {/* Scrollable Day-by-Day List / Table */}
        <section className="bg-white border border-[#c3c6d6] rounded-2xl shadow-sm overflow-hidden flex flex-col">
          {/* Header & Controls Toolbar */}
          <div className="p-4 md:px-6 border-b border-[#c3c6d6] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-[#fafbfe]">
            <div>
              <h3 className="text-[16px] font-bold text-[#041b3c] flex items-center gap-2">
                <span className="material-symbols-outlined text-[#003d9b]">event_note</span>
                <span>Day-by-Day Attendance History</span>
              </h3>
              <p className="text-[12px] text-[#585f6a] mt-0.5">
                Review daily check-ins, check-outs, work location type, and shift notes
              </p>
            </div>

            <div className="flex items-center gap-2.5 self-end sm:self-auto flex-wrap">
              <span className="text-xs font-semibold text-[#003d9b] bg-[#e0e8ff] px-3 py-1 rounded-full border border-[#003d9b]/20">
                {activeLogs.length} {activeLogs.length === 1 ? 'Record' : 'Records'}
              </span>

              {/* View Switcher: Table vs Cards */}
              <div className="flex items-center bg-[#f1f3ff] rounded-xl p-0.5 border border-[#c3c6d6]">
                <button
                  type="button"
                  onClick={() => setViewMode('table')}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg flex items-center gap-1 transition-all cursor-pointer ${
                    viewMode === 'table'
                      ? 'bg-white text-[#003d9b] shadow-xs'
                      : 'text-[#585f6a] hover:text-[#041b3c]'
                  }`}
                  title="Table View"
                >
                  <span className="material-symbols-outlined text-[16px]">table_chart</span>
                  <span className="hidden sm:inline">Table</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('cards')}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg flex items-center gap-1 transition-all cursor-pointer ${
                    viewMode === 'cards'
                      ? 'bg-white text-[#003d9b] shadow-xs'
                      : 'text-[#585f6a] hover:text-[#041b3c]'
                  }`}
                  title="Card View"
                >
                  <span className="material-symbols-outlined text-[16px]">view_agenda</span>
                  <span className="hidden sm:inline">Cards</span>
                </button>
              </div>
            </div>
          </div>

          {/* Empty State */}
          {activeLogs.length === 0 ? (
            <div className="p-12 text-center flex flex-col items-center justify-center gap-3">
              <div className="w-16 h-16 rounded-full bg-[#f1f3ff] text-[#003d9b] flex items-center justify-center border border-[#c3c6d6]">
                <span className="material-symbols-outlined text-[32px]">calendar_today</span>
              </div>
              <h4 className="text-[16px] font-bold text-[#041b3c]">
                No check-ins recorded for {scopeFilter === 'all' ? 'your account' : selectedMonth}
              </h4>
              <p className="text-[13px] text-[#585f6a] max-w-md leading-relaxed">
                {scopeFilter === 'month' && allInternLogs.length > 0
                  ? `You have ${allInternLogs.length} attendance ${
                      allInternLogs.length === 1 ? 'shift' : 'shifts'
                    } recorded in other billing months. Click below to view all records.`
                  : 'Daily attendance shifts, location breakdowns, and GPS logs will appear here live once you check in on the Home screen.'}
              </p>

              {scopeFilter === 'month' && allInternLogs.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setScopeFilter('all')}
                  className="mt-2 px-4 py-2 bg-[#003d9b] hover:bg-[#002d72] text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">history</span>
                  <span>View All Past Records ({allInternLogs.length})</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onNavigate('checkin')}
                  className="mt-2 px-4 py-2 bg-[#003d9b] hover:bg-[#002d72] text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">touch_app</span>
                  <span>Go to Check-In Screen</span>
                </button>
              )}
            </div>
          ) : viewMode === 'table' ? (
            /* Scrollable Table View */
            <div className="overflow-x-auto max-h-[620px] overflow-y-auto">
              <table className="w-full text-left border-collapse min-w-[740px]">
                <thead className="bg-[#f1f3ff] text-[#041b3c] text-[11px] font-bold uppercase tracking-wider sticky top-0 z-10 border-b border-[#c3c6d6]">
                  <tr>
                    <th className="py-3.5 px-4">Date</th>
                    <th className="py-3.5 px-4">Check-In</th>
                    <th className="py-3.5 px-4">Check-Out</th>
                    <th className="py-3.5 px-4">Work Location</th>
                    <th className="py-3.5 px-4">Duration</th>
                    <th className="py-3.5 px-4">Notes</th>
                    <th className="py-3.5 px-4 text-right">Status / Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#c3c6d6]/60 text-xs">
                  {activeLogs.map((log) => {
                    const isOffice = log.locationType === 'office';
                    const isMissing = isMissingCheckout(log);
                    const notes = getMergedRecordNotes(log);

                    return (
                      <tr
                        key={log.id}
                        className={`hover:bg-[#f6f8ff] transition-colors ${
                          isMissing ? 'bg-[#fffaf8]' : ''
                        }`}
                      >
                        {/* Date Column */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div
                              className={`flex flex-col items-center justify-center p-1.5 rounded-lg min-w-[48px] border text-center ${
                                isMissing
                                  ? 'bg-[#fee2e2] text-[#b91c1c] border-[#f87171]/50'
                                  : 'bg-[#e0e8ff] text-[#003d9b] border-[#c3c6d6]/60'
                              }`}
                            >
                              <span className="text-[10px] font-bold uppercase tracking-wider leading-none">
                                {log.monthName}
                              </span>
                              <span className="text-[17px] font-black leading-tight mt-0.5">
                                {log.date}
                              </span>
                            </div>
                            <div>
                              <span className="font-bold text-[#041b3c] block text-[13px]">
                                {log.dayOfWeek}
                              </span>
                              <span className="text-[11px] text-[#585f6a] block">
                                {log.monthYear || selectedMonth}
                              </span>
                              {(log.isManuallyAdded || log.isManuallyEdited) && (
                                <div className="mt-1">
                                  <AuditBadge
                                    isManuallyAdded={log.isManuallyAdded}
                                    isManuallyEdited={log.isManuallyEdited}
                                    lastEditedBy={log.lastEditedBy}
                                    auditHistory={log.auditHistory}
                                    recordId={log.id}
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Check-In Time */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1.5 font-bold text-[#041b3c]">
                            <span className="w-2 h-2 rounded-full bg-[#10b981] shrink-0" />
                            <span className="text-[13px]">{log.checkInTime}</span>
                          </div>
                        </td>

                        {/* Check-Out Time */}
                        <td className="py-3 px-4">
                          {isMissing ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#b91c1c] bg-[#fee2e2] px-2 py-0.5 rounded-full border border-[#f87171]/50">
                              <span className="material-symbols-outlined text-[13px]">warning</span>
                              Missing Check-out
                            </span>
                          ) : log.checkOutTime ? (
                            <div className="flex items-center gap-1.5 font-bold text-[#041b3c]">
                              <span className="w-2 h-2 rounded-full bg-[#003d9b] shrink-0" />
                              <span className="text-[13px]">{log.checkOutTime}</span>
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#b45309] bg-[#fef3c7] px-2 py-0.5 rounded-full border border-[#fde68a]">
                              Active Shift
                            </span>
                          )}
                        </td>

                        {/* Work Location Type */}
                        <td className="py-3 px-4">
                          {isOffice ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-[#e0e8ff] text-[#003d9b] px-2.5 py-1 rounded-full border border-[#003d9b]/20">
                              <span className="material-symbols-outlined text-[13px]">corporate_fare</span>
                              Office
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-[#eceef4] text-[#434654] px-2.5 py-1 rounded-full border border-[#c3c6d6]">
                              <span className="material-symbols-outlined text-[13px]">travel_explore</span>
                              Outside / Travel
                            </span>
                          )}
                        </td>

                        {/* Duration */}
                        <td className="py-3 px-4">
                          <span className="font-bold text-[#041b3c] text-[13px]">
                            {log.totalDuration || '—'}
                          </span>
                        </td>

                        {/* Notes */}
                        <td className="py-3 px-4 max-w-[280px]">
                          {notes ? (
                            <div
                              className="flex items-start gap-1.5 text-[12px] text-[#041b3c] bg-[#f1f3ff] px-2.5 py-1.5 rounded-lg border border-[#c3c6d6]/60 line-clamp-2"
                              title={notes}
                            >
                              <span className="material-symbols-outlined text-[14px] text-[#0052cc] shrink-0 mt-0.5">
                                notes
                              </span>
                              <span className="leading-snug">{notes}</span>
                            </div>
                          ) : (
                            <span className="text-[#8c919d] text-[12px] pl-1">—</span>
                          )}
                        </td>

                        {/* Status / Action */}
                        <td className="py-3 px-4 text-right">
                          {isMissing ? (
                            onCheckOut && (
                              <button
                                type="button"
                                onClick={() => {
                                  setResolvingLog(log);
                                  setResolveTime('11:30 PM');
                                  setResolveNote('');
                                }}
                                className="px-2.5 py-1 bg-[#ea580c] hover:bg-[#c2410c] text-white text-[11px] font-bold rounded-lg shadow-xs transition-all flex items-center gap-1 cursor-pointer active:scale-95 ml-auto"
                              >
                                <span className="material-symbols-outlined text-[13px]">alarm_on</span>
                                <span>Log Check-out</span>
                              </button>
                            )
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#10B981] bg-[#10B981]/10 px-2.5 py-0.5 rounded-full ml-auto">
                              <span className="material-symbols-outlined text-[13px]">check_circle</span>
                              Recorded
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            /* Scrollable Cards View (Ideal for mobile or user preference) */
            <div className="p-4 md:p-6 space-y-3 max-h-[620px] overflow-y-auto">
              {activeLogs.map((log) => {
                const isOffice = log.locationType === 'office';
                const isMissing = isMissingCheckout(log);
                const notes = getMergedRecordNotes(log);

                return (
                  <div
                    key={log.id}
                    className={`bg-white border rounded-xl p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition-all hover:shadow-xs ${
                      isMissing ? 'border-2 border-[#f87171] bg-[#fffaf8]' : 'border-[#c3c6d6]'
                    }`}
                  >
                    <div className="flex items-center gap-3.5 w-full md:w-auto">
                      {/* Month / Date Badge */}
                      <div
                        className={`flex flex-col items-center justify-center p-2 rounded-lg min-w-[56px] border ${
                          isMissing
                            ? 'bg-[#fee2e2] text-[#b91c1c] border-[#f87171]/50'
                            : 'bg-[#e0e8ff] text-[#003d9b] border-[#c3c6d6]/60'
                        }`}
                      >
                        <span className="text-[11px] font-bold tracking-wider uppercase">
                          {log.monthName}
                        </span>
                        <span className="text-[19px] font-black leading-tight">{log.date}</span>
                      </div>

                      <div className="flex flex-col">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[14px] text-[#041b3c] font-bold">
                            {log.dayOfWeek}
                          </span>

                          {(log.isManuallyAdded || log.isManuallyEdited) && (
                            <AuditBadge
                              isManuallyAdded={log.isManuallyAdded}
                              isManuallyEdited={log.isManuallyEdited}
                              lastEditedBy={log.lastEditedBy}
                              auditHistory={log.auditHistory}
                              recordId={log.id}
                            />
                          )}

                          {/* Location Type Badge */}
                          {isOffice ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-[#e0e8ff] text-[#003d9b] px-2.5 py-0.5 rounded-full border border-[#003d9b]/20">
                              <span className="material-symbols-outlined text-[13px]">
                                corporate_fare
                              </span>
                              Office
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-[#eceef4] text-[#434654] px-2.5 py-0.5 rounded-full border border-[#c3c6d6]">
                              <span className="material-symbols-outlined text-[13px]">
                                travel_explore
                              </span>
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
                          <span className="text-[13px] font-bold text-[#041b3c]">
                            {log.checkInTime}
                          </span>
                          <span className="material-symbols-outlined text-[#737685] text-[15px]">
                            arrow_right_alt
                          </span>
                          <span
                            className={`text-[13px] font-bold ${
                              isMissing ? 'text-[#b91c1c]' : 'text-[#041b3c]'
                            }`}
                          >
                            {log.checkOutTime || '--:--'}
                          </span>
                          {log.totalDuration && (
                            <span className="text-[11px] font-medium text-[#585f6a] bg-[#f1f3ff] px-2 py-0.5 rounded ml-1">
                              {log.totalDuration}
                            </span>
                          )}
                        </div>

                        {/* Notes */}
                        {notes && (
                          <p className="text-[12px] text-[#585f6a] mt-1.5 flex items-center gap-1.5 flex-wrap">
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#0052cc] bg-[#f1f3ff] px-2.5 py-0.5 rounded border border-[#c3c6d6]/60">
                              <span className="material-symbols-outlined text-[13px]">notes</span>
                              <span>Notes:</span>
                              <span className="font-normal text-[#041b3c]">{notes}</span>
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
            </div>
          )}
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
                  Trip to client site logged with GPS coordinates and note saved.
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
