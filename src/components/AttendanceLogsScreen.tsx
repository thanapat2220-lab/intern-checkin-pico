import React, { useState, useMemo, useEffect } from 'react';
import { AttendanceRecord, ScreenView, UserProfile, RawAttendanceLogEntry } from '../types';
import { buildRawAttendanceLogEntries, exportAttendanceLogsToCSV, calculateDurationStr } from '../utils/attendanceLogUtils';
import { InternAttendanceFormModal } from './InternAttendanceFormModal';

interface AttendanceLogsScreenProps {
  user: UserProfile;
  attendanceRecords: AttendanceRecord[];
  allUsers: UserProfile[];
  onLogout: () => void;
  onSwitchScreen: (screen: ScreenView) => void;
}

type SortField =
  | 'timestamp'
  | 'internName'
  | 'internId'
  | 'checkInTime'
  | 'checkOutTime'
  | 'status'
  | 'locationType'
  | 'notes'
  | 'isIrregular';

type SortDirection = 'asc' | 'desc';
type ViewMode = 'all_combined' | 'per_intern';

export const AttendanceLogsScreen: React.FC<AttendanceLogsScreenProps> = ({
  user,
  attendanceRecords,
  allUsers,
  onLogout,
  onSwitchScreen,
}) => {
  // 1. Dual View Mode: 'all_combined' (overview table) vs 'per_intern' (filtered individual history)
  const [viewMode, setViewMode] = useState<ViewMode>('all_combined');
  const [perInternSelectedId, setPerInternSelectedId] = useState<string>('');

  // 2. Real Firestore Users and Attendance Records
  const effectiveUsers = allUsers;
  const effectiveRecords = attendanceRecords;

  // 3. Build flattened raw paired check-in / check-out entries with anomaly analysis
  const rawEntries = useMemo(() => {
    return buildRawAttendanceLogEntries(effectiveRecords, effectiveUsers);
  }, [effectiveRecords, effectiveUsers]);

  // 4. Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedInternId, setSelectedInternId] = useState<string>('all');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'completed' | 'active' | 'missing_checkout'>('all');
  const [selectedLocationType, setSelectedLocationType] = useState<'all' | 'office' | 'outside'>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [showIrregularOnly, setShowIrregularOnly] = useState<boolean>(false);
  // Column display options: Intern ID is hidden by default to keep main view uncluttered
  const [showInternId, setShowInternId] = useState<boolean>(false);

  // 6. Sorting States
  const [sortField, setSortField] = useState<SortField>('timestamp');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // 7. Pagination
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(20);

  // 8. Active selected entry for details modal / tooltip
  const [selectedEntry, setSelectedEntry] = useState<RawAttendanceLogEntry | null>(null);

  // 9. Per-Intern Attendance Form (Pico Format) Print Modal
  const [isPrintFormOpen, setIsPrintFormOpen] = useState<boolean>(false);
  const [printFormInternId, setPrintFormInternId] = useState<string>('');

  // Unique list of interns and departments for filter dropdowns & quick selector
  const internsList = useMemo(() => {
    const map = new Map<string, { id: string; name: string; department: string; initials: string; team?: string; avatarUrl?: string }>();
    effectiveUsers
      .filter((u) => u.role === 'intern')
      .forEach((u) =>
        map.set(u.id, {
          id: u.id,
          name: u.name,
          department: u.department,
          initials: u.initials || u.name.slice(0, 2).toUpperCase(),
          team: u.team,
          avatarUrl: u.avatarUrl,
        })
      );
    rawEntries.forEach((e) => {
      if (!map.has(e.internId)) {
        map.set(e.internId, {
          id: e.internId,
          name: e.internName,
          department: e.internDepartment,
          initials: e.internInitials,
          team: e.internTeam,
          avatarUrl: e.internAvatarUrl,
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [effectiveUsers, rawEntries]);

  const departmentsList = useMemo(() => {
    const set = new Set<string>();
    effectiveUsers.forEach((u) => {
      if (u.department) set.add(u.department);
    });
    rawEntries.forEach((e) => {
      if (e.internDepartment) set.add(e.internDepartment);
    });
    return Array.from(set).sort();
  }, [effectiveUsers, rawEntries]);

  // Overall Statistics Summary (Combined)
  const stats = useMemo(() => {
    const totalDays = rawEntries.length;
    const completed = rawEntries.filter((e) => e.status === 'completed').length;
    const active = rawEntries.filter((e) => e.status === 'active').length;
    const missingCheckout = rawEntries.filter((e) => e.status === 'missing_checkout').length;
    const irregulars = rawEntries.filter((e) => e.isIrregular).length;
    const lateCount = rawEntries.filter((e) => e.isLate).length;
    const officeCount = rawEntries.filter((e) => e.locationType === 'office').length;
    const outsideCount = rawEntries.filter((e) => e.locationType === 'outside').length;

    return { totalDays, completed, active, missingCheckout, irregulars, lateCount, officeCount, outsideCount };
  }, [rawEntries]);

  // Currently Selected Intern Profile for "Per-Intern" View
  const selectedInternProfile = useMemo(() => {
    return (
      effectiveUsers.find((u) => u.id === perInternSelectedId) ||
      effectiveUsers.find((u) => u.role === 'intern') ||
      null
    );
  }, [effectiveUsers, perInternSelectedId]);

  // Dedicated entries for the selected individual intern
  const perInternEntries = useMemo(() => {
    if (!selectedInternProfile) return [];
    return rawEntries.filter((e) => e.internId === selectedInternProfile.id);
  }, [rawEntries, selectedInternProfile]);

  // Statistics for the individual intern
  const perInternStats = useMemo(() => {
    const totalDays = perInternEntries.length;
    const completed = perInternEntries.filter((e) => e.status === 'completed').length;
    const active = perInternEntries.filter((e) => e.status === 'active').length;
    const missingCheckout = perInternEntries.filter((e) => e.status === 'missing_checkout').length;
    const irregularCount = perInternEntries.filter((e) => e.isIrregular).length;

    let totalMinutes = 0;
    perInternEntries.forEach((e) => {
      if (e.checkInTime && e.checkOutTime) {
        const { totalMinutes: mins } = calculateDurationStr(e.checkInTime, e.checkOutTime);
        totalMinutes += mins;
      }
    });
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    const totalHoursStr = `${hours}h ${mins > 0 ? `${mins}m` : ''}`.trim();

    return {
      totalDays,
      completed,
      active,
      missingCheckout,
      irregularCount,
      totalHoursStr,
    };
  }, [perInternEntries]);

  // Handle Sort Toggle
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection(field === 'timestamp' || field === 'isIrregular' ? 'desc' : 'asc');
    }
    setCurrentPage(1);
  };

  // Date Presets Helper
  const applyDatePreset = (preset: 'all' | 'today' | 'this_week' | 'this_month' | 'last_30_days') => {
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const toDateStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    if (preset === 'all') {
      setStartDate('');
      setEndDate('');
    } else if (preset === 'today') {
      const todayStr = toDateStr(now);
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === 'this_week') {
      const day = now.getDay() || 7;
      const monday = new Date(now);
      monday.setDate(now.getDate() - day + 1);
      setStartDate(toDateStr(monday));
      setEndDate(toDateStr(now));
    } else if (preset === 'this_month') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      setStartDate(toDateStr(firstDay));
      setEndDate(toDateStr(now));
    } else if (preset === 'last_30_days') {
      const past30 = new Date(now);
      past30.setDate(now.getDate() - 30);
      setStartDate(toDateStr(past30));
      setEndDate(toDateStr(now));
    }
    setCurrentPage(1);
  };

  // Reset all filters
  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedInternId('all');
    setSelectedDepartment('all');
    setSelectedStatus('all');
    setSelectedLocationType('all');
    setStartDate('');
    setEndDate('');
    setShowIrregularOnly(false);
    setCurrentPage(1);
  };

  // Filter & Sort Entries for the Current View Mode
  const filteredAndSortedEntries = useMemo(() => {
    // Base entries depend on ViewMode:
    const baseList = viewMode === 'per_intern' ? perInternEntries : rawEntries;

    return baseList
      .filter((entry) => {
        // 1. Intern filter (only active in 'all_combined' view)
        if (viewMode === 'all_combined' && selectedInternId !== 'all' && entry.internId !== selectedInternId) {
          return false;
        }

        // 2. Department filter
        if (selectedDepartment !== 'all' && entry.internDepartment !== selectedDepartment) {
          return false;
        }

        // 3. Status filter
        if (selectedStatus !== 'all' && entry.status !== selectedStatus) {
          return false;
        }

        // 4. Location Type filter
        if (selectedLocationType !== 'all' && entry.locationType !== selectedLocationType) {
          return false;
        }

        // 5. Date Range filter
        if (startDate && entry.dateStr < startDate) {
          return false;
        }
        if (endDate && entry.dateStr > endDate) {
          return false;
        }

        // 6. Irregular filter
        if (showIrregularOnly && !entry.isIrregular) {
          return false;
        }

        // 7. Keyword search (Name, department, notes, time, date)
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matchesName = entry.internName.toLowerCase().includes(q);
          const matchesDept = entry.internDepartment.toLowerCase().includes(q);
          const matchesDate = entry.displayDate.toLowerCase().includes(q) || entry.dateStr.includes(q);
          const matchesIn = entry.checkInTime.toLowerCase().includes(q);
          const matchesOut = (entry.checkOutTime || '').toLowerCase().includes(q);
          const matchesNote = entry.locationNote.toLowerCase().includes(q);
          const matchesReason = (entry.irregularityReason || '').toLowerCase().includes(q);
          const matchesCustomNotes = (entry.notes || '').toLowerCase().includes(q);

          if (
            !matchesName &&
            !matchesDept &&
            !matchesDate &&
            !matchesIn &&
            !matchesOut &&
            !matchesNote &&
            !matchesReason &&
            !matchesCustomNotes
          ) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        let valA: any = a[sortField];
        let valB: any = b[sortField];

        if (sortField === 'internName') {
          valA = a.internName.toLowerCase();
          valB = b.internName.toLowerCase();
        } else if (sortField === 'checkInTime') {
          valA = a.checkInTimestamp || a.timestamp;
          valB = b.checkInTimestamp || b.timestamp;
        } else if (sortField === 'checkOutTime') {
          valA = a.checkOutTimestamp || (sortDirection === 'asc' ? 9999999999999 : -1);
          valB = b.checkOutTimestamp || (sortDirection === 'asc' ? 9999999999999 : -1);
        } else if (sortField === 'internId') {
          valA = a.internId.toLowerCase();
          valB = b.internId.toLowerCase();
        } else if (sortField === 'notes') {
          valA = (a.notes || '').toLowerCase();
          valB = (b.notes || '').toLowerCase();
        } else if (sortField === 'isIrregular') {
          valA = a.isIrregular ? 1 : 0;
          valB = b.isIrregular ? 1 : 0;
        }

        if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
  }, [
    viewMode,
    perInternEntries,
    rawEntries,
    selectedInternId,
    selectedDepartment,
    selectedStatus,
    selectedLocationType,
    startDate,
    endDate,
    showIrregularOnly,
    searchQuery,
    sortField,
    sortDirection,
  ]);

  // Pagination calculation
  const totalEntries = filteredAndSortedEntries.length;
  const totalPages = Math.max(1, Math.ceil(totalEntries / pageSize));
  const paginatedEntries = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredAndSortedEntries.slice(start, start + pageSize);
  }, [filteredAndSortedEntries, currentPage, pageSize]);

  // Export to CSV helper
  const handleExportCSV = () => {
    const filename =
      viewMode === 'per_intern' && selectedInternProfile
        ? `Attendance_${selectedInternProfile.name.replace(/\s+/g, '_')}`
        : 'Attendance_Logs_All_Interns';
    exportAttendanceLogsToCSV(filteredAndSortedEntries, filename);
  };

  // Quick switch from combined table directly to an individual intern
  const handleSelectInternForDetails = (internId: string) => {
    setPerInternSelectedId(internId);
    setViewMode('per_intern');
    setCurrentPage(1);
  };

  return (
    <div className="flex-1 bg-[#F4F5F7] min-h-screen flex flex-col">
      {/* Top Navigation & App Header */}
      <header className="bg-white border-b border-[#c3c6d6]/60 sticky top-0 z-20 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#0052cc]/10 border border-[#0052cc]/20 flex items-center justify-center text-[#0052cc]">
              <span className="material-symbols-outlined text-[24px]">list_alt</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-[#041b3c] tracking-tight">Attendance Log</h1>
                <span className="bg-[#e0e8ff] text-[#0052cc] text-[10px] font-bold px-2 py-0.5 rounded-full border border-[#0052cc]/20">
                  Raw Activity Ledger
                </span>
              </div>
              <p className="text-xs text-[#585f6a]">
                Granular daily check-in & check-out pairs across all interns with anomaly detection & missing checkout alerts
              </p>
            </div>
          </div>

          {/* Quick Navigation and CSV Export Action */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="flex items-center bg-[#f1f3ff] rounded-lg p-1 border border-[#c3c6d6]/60 text-xs font-semibold">
              <button
                onClick={() => onSwitchScreen('admin_interns')}
                className="px-2.5 py-1.5 rounded-md text-[#585f6a] hover:text-[#041b3c] transition-colors flex items-center gap-1 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">group</span>
                <span>Interns</span>
              </button>
              <button
                onClick={() => onSwitchScreen('supervisor')}
                className="px-2.5 py-1.5 rounded-md text-[#585f6a] hover:text-[#041b3c] transition-colors flex items-center gap-1 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">verified</span>
                <span>Approvals</span>
              </button>
              <button
                onClick={() => onSwitchScreen('payroll_export')}
                className="px-2.5 py-1.5 rounded-md text-[#585f6a] hover:text-[#041b3c] transition-colors flex items-center gap-1 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">payments</span>
                <span>Payroll</span>
              </button>
            </div>

            <button
              onClick={() => {
                const targetId = viewMode === 'per_intern' && selectedInternProfile ? selectedInternProfile.id : (internsList[0]?.id || '');
                setPrintFormInternId(targetId);
                setIsPrintFormOpen(true);
              }}
              className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all active:scale-95 cursor-pointer"
              title="Print or Save Per-Intern Attendance Form (Pico Format)"
            >
              <span className="material-symbols-outlined text-[16px]">print</span>
              <span>Print Attendance Form</span>
            </button>

            <button
              onClick={handleExportCSV}
              className="px-3.5 py-2 bg-[#0052cc] hover:bg-[#0040a2] text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all active:scale-95 cursor-pointer"
              title="Export filtered records to CSV"
            >
              <span className="material-symbols-outlined text-[16px]">download</span>
              <span>Export CSV ({filteredAndSortedEntries.length})</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-5 space-y-5 flex-1 w-full flex flex-col">
        {/* ========================================================================= */}
        {/* PREVIEW BANNER & VIEW MODE SELECTOR (All Interns Combined vs Per-Intern) */}
        {/* ========================================================================= */}
        <section className="bg-white rounded-2xl border border-[#c3c6d6]/60 p-4 shadow-2xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          {/* Dual View Segmented Toggle */}
          <div className="flex items-center bg-[#f1f3ff] p-1 rounded-xl border border-[#c3c6d6]/70 shadow-2xs">
            <button
              onClick={() => {
                setViewMode('all_combined');
                setCurrentPage(1);
              }}
              className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                viewMode === 'all_combined'
                  ? 'bg-[#0052cc] text-white shadow-xs'
                  : 'text-[#585f6a] hover:text-[#041b3c]'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">table_chart</span>
              <span>1. All Interns Combined Overview</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  viewMode === 'all_combined' ? 'bg-white/20 text-white' : 'bg-[#e0e8ff] text-[#0052cc]'
                }`}
              >
                {rawEntries.length}
              </span>
            </button>

            <button
              onClick={() => {
                setViewMode('per_intern');
                setCurrentPage(1);
              }}
              className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                viewMode === 'per_intern'
                  ? 'bg-[#0052cc] text-white shadow-xs'
                  : 'text-[#585f6a] hover:text-[#041b3c]'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">person</span>
              <span>2. Per-Intern Filtered View</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  viewMode === 'per_intern' ? 'bg-white/20 text-white' : 'bg-[#e0e8ff] text-[#0052cc]'
                }`}
              >
                {selectedInternProfile?.name.split(' ')[0] || 'Selected'}
              </span>
            </button>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* PER-INTERN VIEW BANNER & INTERN SELECTOR CAROUSEL (Active in per_intern)   */}
        {/* ========================================================================= */}
        {viewMode === 'per_intern' && (
          <section className="bg-white rounded-2xl border border-[#c3c6d6]/60 p-5 shadow-2xs space-y-4 animate-in fade-in duration-200">
            {/* Carousel of Intern Pills */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[#585f6a] flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px] text-[#0052cc]">badge</span>
                  <span>Select Intern to Inspect Full History:</span>
                </span>
                <span className="text-[11px] text-[#585f6a]">
                  Showing {internsList.length} total interns
                </span>
              </div>

              {internsList.length === 0 ? (
                <div className="p-4 text-center text-xs text-[#585f6a] bg-[#f9f9ff] rounded-xl border border-dashed border-[#c3c6d6]">
                  No registered interns found. Interns will appear here once they register.
                </div>
              ) : (
                <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
                  {internsList.map((intern) => {
                    const isSelected = intern.id === perInternSelectedId;
                    return (
                      <button
                        key={intern.id}
                        onClick={() => {
                          setPerInternSelectedId(intern.id);
                          setCurrentPage(1);
                        }}
                        className={`px-3 py-2 rounded-xl border text-left flex items-center gap-2 transition-all shrink-0 cursor-pointer ${
                          isSelected
                            ? 'bg-[#0052cc] text-white border-[#0052cc] shadow-sm ring-2 ring-[#0052cc]/30'
                            : 'bg-[#f9f9ff] text-[#041b3c] border-[#c3c6d6]/60 hover:bg-[#f1f3ff] hover:border-[#0052cc]/50'
                        }`}
                      >
                        <div
                          className={`w-7 h-7 rounded-full font-bold text-[11px] flex items-center justify-center shrink-0 ${
                            isSelected ? 'bg-white text-[#0052cc]' : 'bg-[#e0e8ff] text-[#0052cc]'
                          }`}
                        >
                          {intern.initials}
                        </div>
                        <div className="leading-tight">
                          <div className="text-xs font-bold whitespace-nowrap">{intern.name}</div>
                          <div
                            className={`text-[10px] whitespace-nowrap ${
                              isSelected ? 'text-[#b2c5ff]' : 'text-[#585f6a]'
                            }`}
                          >
                            {intern.department}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Selected Intern Profile & Attendance Dossier Card */}
            {selectedInternProfile && (
              <div className="bg-[#f9f9ff] border border-[#c3c6d6]/60 rounded-xl p-4 sm:p-5 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5">
                {/* Profile Identity Block */}
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-[#0052cc] text-white font-black text-xl flex items-center justify-center shadow-md shrink-0">
                    {selectedInternProfile.initials || selectedInternProfile.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-lg font-bold text-[#041b3c]">{selectedInternProfile.name}</h2>
                      <span className="bg-[#e0e8ff] text-[#0052cc] text-[10px] font-bold px-2 py-0.5 rounded-full border border-[#0052cc]/30">
                        {selectedInternProfile.department}
                      </span>
                      {selectedInternProfile.team && (
                        <span className="bg-[#f1f3ff] text-[#585f6a] text-[10px] font-semibold px-2 py-0.5 rounded-full border border-[#c3c6d6]/50">
                          {selectedInternProfile.team}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-[#585f6a] mt-1 flex items-center gap-3 flex-wrap">
                      <span>Email: <strong className="font-mono text-[#041b3c]">{selectedInternProfile.email}</strong></span>
                      <span>Supervisor: <strong className="text-[#041b3c]">{selectedInternProfile.supervisorName || 'Unassigned'}</strong></span>
                      <span>Bank: <strong className="text-[#041b3c]">{selectedInternProfile.bankName} ({selectedInternProfile.accountNumber})</strong></span>
                    </div>
                  </div>
                </div>

                {/* Actions & KPI Metrics for this intern */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto shrink-0">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 flex-1">
                    <div className="bg-white p-2.5 rounded-xl border border-[#c3c6d6]/60 text-center">
                      <span className="text-[10px] uppercase font-bold text-[#585f6a] block">Days Logged</span>
                      <span className="text-base font-black text-[#041b3c] mt-0.5 block">{perInternStats.totalDays}</span>
                    </div>
                    <div className="bg-white p-2.5 rounded-xl border border-[#c3c6d6]/60 text-center">
                      <span className="text-[10px] uppercase font-bold text-[#10b981] block">Completed Shifts</span>
                      <span className="text-base font-black text-[#065f46] mt-0.5 block">{perInternStats.completed}</span>
                    </div>
                    <div className="bg-white p-2.5 rounded-xl border border-[#c3c6d6]/60 text-center">
                      <span className="text-[10px] uppercase font-bold text-[#be123c] block">Missing Out</span>
                      <span className={`text-base font-black mt-0.5 block ${perInternStats.missingCheckout > 0 ? 'text-[#be123c]' : 'text-[#737685]'}`}>
                        {perInternStats.missingCheckout}
                      </span>
                    </div>
                    <div className="bg-white p-2.5 rounded-xl border border-[#c3c6d6]/60 text-center">
                      <span className="text-[10px] uppercase font-bold text-[#0052cc] block">Total Hours</span>
                      <span className="text-base font-black text-[#0052cc] mt-0.5 block">{perInternStats.totalHoursStr || '0h'}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setPrintFormInternId(selectedInternProfile.id);
                      setIsPrintFormOpen(true);
                    }}
                    className="px-3.5 py-2.5 bg-[#22c55e] hover:bg-[#16a34a] text-black font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all active:scale-95 cursor-pointer shrink-0"
                    title="Print or Save Per-Intern Attendance Form (Pico Format)"
                  >
                    <span className="material-symbols-outlined text-[17px]">print</span>
                    <span>Print Form</span>
                  </button>
                </div>
              </div>
            )}

            {/* Contextual Irregularity Warnings if present */}
            {perInternStats.missingCheckout > 0 && (
              <div className="bg-[#fff1f2] border border-[#fecdd3] p-3 rounded-xl flex items-center justify-between text-xs text-[#9f1239]">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] text-[#f43f5e]">alarm_off</span>
                  <span>
                    <strong>Missing Check-out Alert:</strong> {selectedInternProfile?.name} has {perInternStats.missingCheckout} past session with no check-out timestamp. Total hours exclude unclosed shifts.
                  </span>
                </div>
                <span className="px-2 py-0.5 bg-[#ffe4e6] text-[#be123c] font-bold rounded-md text-[10px] uppercase tracking-wider">
                  Needs Audit
                </span>
              </div>
            )}
          </section>
        )}

        {/* ========================================================================= */}
        {/* KPI / METRIC CHIPS (Active in all_combined mode)                           */}
        {/* ========================================================================= */}
        {viewMode === 'all_combined' && (
          <section className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {/* Total Days Logged */}
            <div className="bg-white p-3.5 rounded-xl border border-[#c3c6d6]/60 shadow-2xs flex items-center justify-between">
              <div>
                <span className="text-[11px] font-semibold text-[#585f6a] uppercase tracking-wider block">
                  Total Logs
                </span>
                <span className="text-xl font-bold text-[#041b3c] mt-0.5 block">{stats.totalDays}</span>
              </div>
              <div className="w-8 h-8 rounded-lg bg-[#e0e8ff] text-[#0052cc] flex items-center justify-center">
                <span className="material-symbols-outlined text-[20px]">calendar_today</span>
              </div>
            </div>

            {/* Completed Pairs */}
            <div
              onClick={() => {
                setSelectedStatus(selectedStatus === 'completed' ? 'all' : 'completed');
                setCurrentPage(1);
              }}
              className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between shadow-2xs ${
                selectedStatus === 'completed'
                  ? 'bg-[#ecfdf5] border-[#10b981] ring-2 ring-[#10b981]/30'
                  : 'bg-white border-[#c3c6d6]/60 hover:border-[#10b981]/50'
              }`}
            >
              <div>
                <span className="text-[11px] font-semibold text-[#065f46] uppercase tracking-wider block">
                  Completed
                </span>
                <span className="text-xl font-bold text-[#065f46] mt-0.5 block">{stats.completed}</span>
              </div>
              <div className="w-8 h-8 rounded-lg bg-[#d1fae5] text-[#10b981] flex items-center justify-center">
                <span className="material-symbols-outlined text-[20px]">task_alt</span>
              </div>
            </div>

            {/* Active Shift */}
            <div
              onClick={() => {
                setSelectedStatus(selectedStatus === 'active' ? 'all' : 'active');
                setCurrentPage(1);
              }}
              className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between shadow-2xs ${
                selectedStatus === 'active'
                  ? 'bg-[#eff6ff] border-[#3b82f6] ring-2 ring-[#3b82f6]/30'
                  : 'bg-white border-[#c3c6d6]/60 hover:border-[#3b82f6]/50'
              }`}
            >
              <div>
                <span className="text-[11px] font-semibold text-[#1e40af] uppercase tracking-wider block">
                  Active Shifts
                </span>
                <span className="text-xl font-bold text-[#1e40af] mt-0.5 block">{stats.active}</span>
              </div>
              <div className="w-8 h-8 rounded-lg bg-[#dbeafe] text-[#3b82f6] flex items-center justify-center">
                <span className="material-symbols-outlined text-[20px]">timelapse</span>
              </div>
            </div>

            {/* Missing Check-outs */}
            <div
              onClick={() => {
                setSelectedStatus(selectedStatus === 'missing_checkout' ? 'all' : 'missing_checkout');
                setCurrentPage(1);
              }}
              className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between shadow-2xs ${
                selectedStatus === 'missing_checkout'
                  ? 'bg-[#fff1f2] border-[#f43f5e] ring-2 ring-[#f43f5e]/30'
                  : 'bg-white border-[#c3c6d6]/60 hover:border-[#f43f5e]/50'
              }`}
            >
              <div>
                <span className="text-[11px] font-semibold text-[#9f1239] uppercase tracking-wider block">
                  Missing Out
                </span>
                <span className="text-xl font-bold text-[#be123c] mt-0.5 block">{stats.missingCheckout}</span>
              </div>
              <div className="w-8 h-8 rounded-lg bg-[#ffe4e6] text-[#f43f5e] flex items-center justify-center">
                <span className="material-symbols-outlined text-[20px]">alarm_off</span>
              </div>
            </div>

            {/* Flagged Irregularities */}
            <div
              onClick={() => {
                setShowIrregularOnly(!showIrregularOnly);
                setCurrentPage(1);
              }}
              className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between shadow-2xs ${
                showIrregularOnly
                  ? 'bg-[#fff4e5] border-[#f59e0b] ring-2 ring-[#f59e0b]/40'
                  : 'bg-white border-[#c3c6d6]/60 hover:border-[#f59e0b]/50'
              }`}
            >
              <div>
                <span className="text-[11px] font-semibold text-[#b45309] uppercase tracking-wider block">
                  Flagged Issues
                </span>
                <span className="text-xl font-bold text-[#b45309] mt-0.5 block">{stats.irregulars}</span>
              </div>
              <div className="w-8 h-8 rounded-lg bg-[#fef3c7] text-[#f59e0b] flex items-center justify-center">
                <span className="material-symbols-outlined text-[20px]">warning</span>
              </div>
            </div>
          </section>
        )}

        {/* ========================================================================= */}
        {/* FILTERS PANEL                                                             */}
        {/* ========================================================================= */}
        <section className="bg-white rounded-xl border border-[#c3c6d6]/60 p-4 shadow-2xs space-y-3">
          {/* Row 1: Search, Intern Select, Department, Status */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
            {/* Search Input */}
            <div className="sm:col-span-4 relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#737685] text-[18px]">
                search
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search intern, note, location, date, time..."
                className="w-full pl-9 pr-8 py-2 bg-[#f9f9ff] border border-[#c3c6d6] rounded-lg text-xs text-[#041b3c] focus:outline-none focus:ring-1 focus:ring-[#0052cc] focus:border-[#0052cc]"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#737685] hover:text-[#041b3c]"
                >
                  <span className="material-symbols-outlined text-[16px]">cancel</span>
                </button>
              )}
            </div>

            {/* Intern Filter (Dropdown) */}
            {viewMode === 'all_combined' ? (
              <div className="sm:col-span-3">
                <select
                  value={selectedInternId}
                  onChange={(e) => {
                    setSelectedInternId(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full py-2 px-3 bg-[#f9f9ff] border border-[#c3c6d6] rounded-lg text-xs font-medium text-[#041b3c] focus:outline-none focus:ring-1 focus:ring-[#0052cc]"
                >
                  <option value="all">All Interns ({internsList.length})</option>
                  {internsList.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} ({i.department})
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="sm:col-span-3 flex items-center gap-2">
                <span className="text-xs text-[#585f6a] font-semibold whitespace-nowrap">Current Intern:</span>
                <select
                  value={perInternSelectedId}
                  onChange={(e) => {
                    setPerInternSelectedId(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full py-2 px-3 bg-[#e0e8ff] border border-[#0052cc]/40 rounded-lg text-xs font-bold text-[#0052cc] focus:outline-none focus:ring-1 focus:ring-[#0052cc]"
                >
                  {internsList.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} ({i.department})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Department Filter */}
            <div className="sm:col-span-3">
              <select
                value={selectedDepartment}
                onChange={(e) => {
                  setSelectedDepartment(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full py-2 px-3 bg-[#f9f9ff] border border-[#c3c6d6] rounded-lg text-xs font-medium text-[#041b3c] focus:outline-none focus:ring-1 focus:ring-[#0052cc]"
              >
                <option value="all">All Departments ({departmentsList.length})</option>
                {departmentsList.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div className="sm:col-span-2">
              <select
                value={selectedStatus}
                onChange={(e) => {
                  setSelectedStatus(e.target.value as any);
                  setCurrentPage(1);
                }}
                className="w-full py-2 px-3 bg-[#f9f9ff] border border-[#c3c6d6] rounded-lg text-xs font-semibold text-[#041b3c] focus:outline-none focus:ring-1 focus:ring-[#0052cc]"
              >
                <option value="all">All Statuses</option>
                <option value="completed">✅ Completed</option>
                <option value="active">⏱️ Active Shift</option>
                <option value="missing_checkout">⚠️ Missing Out</option>
              </select>
            </div>
          </div>

          {/* Row 2: Date Presets, Date Range pickers, Location Type, Irregular Checkbox */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#c3c6d6]/40">
            {/* Date Range Inputs & Presets */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 text-xs text-[#585f6a]">
                <span className="font-semibold">From:</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="py-1 px-2 bg-[#f9f9ff] border border-[#c3c6d6] rounded-md text-xs text-[#041b3c] outline-none"
                />
                <span className="font-semibold ml-1">To:</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="py-1 px-2 bg-[#f9f9ff] border border-[#c3c6d6] rounded-md text-xs text-[#041b3c] outline-none"
                />
              </div>

              {/* Quick Presets */}
              <div className="flex items-center gap-1 ml-1">
                <button
                  onClick={() => applyDatePreset('today')}
                  className="px-2 py-1 rounded bg-[#f1f3ff] hover:bg-[#e0e8ff] text-[11px] font-semibold text-[#0052cc] cursor-pointer"
                >
                  Today
                </button>
                <button
                  onClick={() => applyDatePreset('this_week')}
                  className="px-2 py-1 rounded bg-[#f1f3ff] hover:bg-[#e0e8ff] text-[11px] font-semibold text-[#0052cc] cursor-pointer"
                >
                  This Week
                </button>
                <button
                  onClick={() => applyDatePreset('this_month')}
                  className="px-2 py-1 rounded bg-[#f1f3ff] hover:bg-[#e0e8ff] text-[11px] font-semibold text-[#0052cc] cursor-pointer"
                >
                  This Month
                </button>
                <button
                  onClick={() => applyDatePreset('last_30_days')}
                  className="px-2 py-1 rounded bg-[#f1f3ff] hover:bg-[#e0e8ff] text-[11px] font-semibold text-[#0052cc] cursor-pointer"
                >
                  30 Days
                </button>
                {(startDate || endDate) && (
                  <button
                    onClick={() => applyDatePreset('all')}
                    className="px-2 py-1 rounded text-[11px] font-bold text-[#ba1a1a] hover:bg-[#ffdad6] cursor-pointer"
                  >
                    Clear Dates
                  </button>
                )}
              </div>
            </div>

            {/* Location Type & Quick Filter Pills */}
            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-[#585f6a] font-semibold">Location:</span>
                <select
                  value={selectedLocationType}
                  onChange={(e) => {
                    setSelectedLocationType(e.target.value as any);
                    setCurrentPage(1);
                  }}
                  className="py-1 px-2 bg-[#f9f9ff] border border-[#c3c6d6] rounded-md text-xs font-semibold text-[#041b3c] outline-none"
                >
                  <option value="all">All Locations</option>
                  <option value="office">🏢 Office ({stats.officeCount})</option>
                  <option value="outside">📍 Outside ({stats.outsideCount})</option>
                </select>
              </div>

              {/* Irregularity Filter Checkbox */}
              <label
                className={`flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-md border cursor-pointer select-none transition-all ${
                  showIrregularOnly
                    ? 'bg-[#fff4e5] text-[#d97706] border-[#f59e0b] ring-1 ring-[#f59e0b]'
                    : 'bg-[#f8fafc] text-[#64748b] border-[#cbd5e1] hover:bg-[#f1f5f9]'
                }`}
              >
                <input
                  type="checkbox"
                  checked={showIrregularOnly}
                  onChange={(e) => {
                    setShowIrregularOnly(e.target.checked);
                    setCurrentPage(1);
                  }}
                  className="w-3.5 h-3.5 text-[#d97706] rounded border-[#c3c6d6] focus:ring-[#d97706]"
                />
                <span>⚠️ Flagged Issues ({stats.irregulars})</span>
              </label>

              {/* Show Intern ID Column Toggle (Hidden by default to prevent clutter; useful for disambiguation) */}
              <label
                className={`flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-md border cursor-pointer select-none transition-all ${
                  showInternId
                    ? 'bg-[#e0e8ff] text-[#0052cc] border-[#0052cc] ring-1 ring-[#0052cc]'
                    : 'bg-[#f8fafc] text-[#64748b] border-[#cbd5e1] hover:bg-[#f1f5f9]'
                }`}
                title="Toggle visibility of Intern ID column to disambiguate duplicate intern names"
              >
                <input
                  type="checkbox"
                  checked={showInternId}
                  onChange={(e) => setShowInternId(e.target.checked)}
                  className="w-3.5 h-3.5 accent-[#0052cc] rounded border-[#c3c6d6]"
                />
                <span className="material-symbols-outlined text-[15px]">badge</span>
                <span>Show Intern ID</span>
              </label>

              {/* Reset All Filters */}
              <button
                onClick={handleResetFilters}
                className="text-xs text-[#737685] hover:text-[#041b3c] underline font-medium cursor-pointer ml-1"
              >
                Reset All
              </button>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* ATTENDANCE LOG TABLE CARD (Supports both combined & per-intern views)     */}
        {/* ========================================================================= */}
        <section className="bg-white rounded-xl border border-[#c3c6d6]/60 shadow-2xs overflow-hidden flex flex-col flex-1">
          {/* Table Toolbar / Active Filter Summary */}
          <div className="px-4 py-3 bg-[#f9f9ff] border-b border-[#c3c6d6]/60 flex items-center justify-between flex-wrap gap-2 text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-[#041b3c]">
                Showing {filteredAndSortedEntries.length} paired daily entries
              </span>
              {viewMode === 'per_intern' && selectedInternProfile && (
                <span className="bg-[#e0e8ff] text-[#0052cc] px-2 py-0.5 rounded-md font-bold text-[11px]">
                  Filtered to {selectedInternProfile.name}
                </span>
              )}
              {viewMode === 'all_combined' && selectedInternId !== 'all' && (
                <span className="bg-[#e0e8ff] text-[#0052cc] px-2 py-0.5 rounded-md font-semibold text-[11px]">
                  Intern Filtered
                </span>
              )}
              {selectedStatus !== 'all' && (
                <span className="bg-[#f1f3ff] text-[#041b3c] px-2 py-0.5 rounded-md font-semibold text-[11px]">
                  Status: {selectedStatus}
                </span>
              )}
              {showIrregularOnly && (
                <span className="bg-[#fff4e5] text-[#d97706] px-2 py-0.5 rounded-md font-semibold text-[11px]">
                  Irregularities Only
                </span>
              )}
            </div>

            {/* Page Size & View Mode Indicator */}
            <div className="flex items-center gap-3 text-[#585f6a]">
              {viewMode === 'per_intern' && (
                <button
                  onClick={() => setViewMode('all_combined')}
                  className="text-xs text-[#0052cc] font-bold hover:underline cursor-pointer flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-[14px]">arrow_back</span>
                  <span>View All Interns Combined</span>
                </button>
              )}
              <div className="flex items-center gap-1.5">
                <span>Rows per page:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="bg-white border border-[#c3c6d6] rounded px-2 py-0.5 text-xs font-semibold text-[#041b3c]"
                >
                  <option value={15}>15</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>
          </div>

          {/* Table Container with Horizontal Scroll */}
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#f1f3ff] border-b border-[#c3c6d6]/70 text-[#041b3c] uppercase text-[10px] font-bold tracking-wider select-none">
                  {/* Status / Flag Column */}
                  <th
                    onClick={() => handleSort('isIrregular')}
                    className="py-3 px-3 w-10 text-center cursor-pointer hover:bg-[#e0e8ff] transition-colors"
                    title="Sort by Irregularities"
                  >
                    <div className="flex items-center justify-center gap-0.5">
                      <span>Flag</span>
                      {sortField === 'isIrregular' && (
                        <span className="material-symbols-outlined text-[12px]">
                          {sortDirection === 'asc' ? 'arrow_upward' : 'arrow_downward'}
                        </span>
                      )}
                    </div>
                  </th>

                  {/* Intern Name Column (Shows in both views, but highlights in combined) */}
                  <th
                    onClick={() => handleSort('internName')}
                    className="py-3 px-4 cursor-pointer hover:bg-[#e0e8ff] transition-colors min-w-[180px]"
                  >
                    <div className="flex items-center gap-1">
                      <span>Intern Name</span>
                      {sortField === 'internName' && (
                        <span className="material-symbols-outlined text-[14px]">
                          {sortDirection === 'asc' ? 'arrow_upward' : 'arrow_downward'}
                        </span>
                      )}
                    </div>
                  </th>

                  {/* Date Column */}
                  <th
                    onClick={() => handleSort('timestamp')}
                    className="py-3 px-4 cursor-pointer hover:bg-[#e0e8ff] transition-colors min-w-[130px]"
                  >
                    <div className="flex items-center gap-1">
                      <span>Date</span>
                      {sortField === 'timestamp' && (
                        <span className="material-symbols-outlined text-[14px]">
                          {sortDirection === 'asc' ? 'arrow_upward' : 'arrow_downward'}
                        </span>
                      )}
                    </div>
                  </th>

                  {/* Check-in Time */}
                  <th
                    onClick={() => handleSort('checkInTime')}
                    className="py-3 px-4 cursor-pointer hover:bg-[#e0e8ff] transition-colors min-w-[110px]"
                  >
                    <div className="flex items-center gap-1">
                      <span>Check-In</span>
                      {sortField === 'checkInTime' && (
                        <span className="material-symbols-outlined text-[14px]">
                          {sortDirection === 'asc' ? 'arrow_upward' : 'arrow_downward'}
                        </span>
                      )}
                    </div>
                  </th>

                  {/* Check-out Time */}
                  <th
                    onClick={() => handleSort('checkOutTime')}
                    className="py-3 px-4 cursor-pointer hover:bg-[#e0e8ff] transition-colors min-w-[110px]"
                  >
                    <div className="flex items-center gap-1">
                      <span>Check-Out</span>
                      {sortField === 'checkOutTime' && (
                        <span className="material-symbols-outlined text-[14px]">
                          {sortDirection === 'asc' ? 'arrow_upward' : 'arrow_downward'}
                        </span>
                      )}
                    </div>
                  </th>

                  {/* Shift Duration / Status */}
                  <th
                    onClick={() => handleSort('status')}
                    className="py-3 px-4 cursor-pointer hover:bg-[#e0e8ff] transition-colors min-w-[120px]"
                  >
                    <div className="flex items-center gap-1">
                      <span>Shift / Duration</span>
                      {sortField === 'status' && (
                        <span className="material-symbols-outlined text-[14px]">
                          {sortDirection === 'asc' ? 'arrow_upward' : 'arrow_downward'}
                        </span>
                      )}
                    </div>
                  </th>

                  {/* Work Location Type */}
                  <th
                    onClick={() => handleSort('locationType')}
                    className="py-3 px-4 cursor-pointer hover:bg-[#e0e8ff] transition-colors min-w-[110px]"
                  >
                    <div className="flex items-center gap-1">
                      <span>Location</span>
                      {sortField === 'locationType' && (
                        <span className="material-symbols-outlined text-[14px]">
                          {sortDirection === 'asc' ? 'arrow_upward' : 'arrow_downward'}
                        </span>
                      )}
                    </div>
                  </th>

                  {/* Notes */}
                  <th
                    onClick={() => handleSort('notes')}
                    className="py-3 px-4 cursor-pointer hover:bg-[#e0e8ff] transition-colors min-w-[220px]"
                  >
                    <div className="flex items-center gap-1">
                      <span>Notes</span>
                      {sortField === 'notes' && (
                        <span className="material-symbols-outlined text-[14px]">
                          {sortDirection === 'asc' ? 'arrow_upward' : 'arrow_downward'}
                        </span>
                      )}
                    </div>
                  </th>

                  {/* Intern ID (Optional last data column, hidden by default to keep view clean) */}
                  {showInternId && (
                    <th
                      onClick={() => handleSort('internId')}
                      className="py-3 px-4 cursor-pointer hover:bg-[#e0e8ff] transition-colors min-w-[120px]"
                    >
                      <div className="flex items-center gap-1">
                        <span>Intern ID</span>
                        {sortField === 'internId' && (
                          <span className="material-symbols-outlined text-[14px]">
                            {sortDirection === 'asc' ? 'arrow_upward' : 'arrow_downward'}
                          </span>
                        )}
                      </div>
                    </th>
                  )}

                  {/* Audit Actions */}
                  <th className="py-3 px-4 text-right min-w-[90px]">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#c3c6d6]/40 text-[#041b3c]">
                {paginatedEntries.length === 0 ? (
                  <tr>
                    <td colSpan={showInternId ? 10 : 9} className="py-12 text-center text-[#737685]">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <span className="material-symbols-outlined text-[36px] text-[#c3c6d6]">
                          search_off
                        </span>
                        <p className="font-bold text-sm text-[#041b3c]">No attendance logs found</p>
                        <p className="text-xs">
                          Try adjusting your search criteria, dates, or active filter parameters.
                        </p>
                        <button
                          onClick={handleResetFilters}
                          className="mt-2 px-3 py-1.5 bg-[#0052cc] text-white rounded-lg text-xs font-semibold cursor-pointer"
                        >
                          Clear Filters
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedEntries.map((entry) => {
                    const isMissingOut = entry.status === 'missing_checkout';
                    const isActive = entry.status === 'active';
                    const isCompleted = entry.status === 'completed';

                    return (
                      <tr
                        key={entry.id}
                        className={`hover:bg-[#f9f9ff] transition-colors ${
                          entry.isIrregular ? 'bg-[#fffaf0]/80' : ''
                        }`}
                      >
                        {/* Status / Flag Column */}
                        <td className="py-3 px-3 text-center">
                          {entry.isIrregular ? (
                            <div
                              className="relative group inline-block cursor-help"
                              title={entry.irregularityReason}
                            >
                              <span className="material-symbols-outlined text-[18px] text-[#f59e0b] animate-pulse">
                                warning
                              </span>
                              {/* Tooltip on hover */}
                              <div className="absolute left-6 top-1/2 -translate-y-1/2 hidden group-hover:block z-30 w-56 p-2 bg-[#1f2937] text-white text-[11px] rounded-lg shadow-xl border border-gray-700 pointer-events-none">
                                <p className="font-bold text-[#fbbf24] flex items-center gap-1">
                                  <span>⚠️ Flagged Anomaly</span>
                                </p>
                                <p className="mt-1 leading-snug">{entry.irregularityReason}</p>
                              </div>
                            </div>
                          ) : (
                            <span className="material-symbols-outlined text-[16px] text-[#10B981]/70">
                              check_circle
                            </span>
                          )}
                        </td>

                        {/* Intern Name & Department */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            {entry.internAvatarUrl ? (
                              <img
                                src={entry.internAvatarUrl}
                                alt={entry.internName}
                                className="w-8 h-8 rounded-full object-cover border border-[#c3c6d6]"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-[#0052cc] text-white font-bold text-xs flex items-center justify-center shadow-xs">
                                {entry.internInitials}
                              </div>
                            )}
                            <div>
                              <p
                                onClick={() => handleSelectInternForDetails(entry.internId)}
                                className="font-bold text-[#041b3c] hover:text-[#0052cc] cursor-pointer transition-colors"
                                title="Click to open this intern's detailed history"
                              >
                                {entry.internName}
                              </p>
                              <p className="text-[10px] text-[#585f6a]">
                                {entry.internDepartment} {entry.internTeam ? `• ${entry.internTeam}` : ''}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Date */}
                        <td className="py-3 px-4">
                          <div>
                            <span className="font-bold text-[#041b3c] block">{entry.displayDate}</span>
                            <span className="text-[10px] text-[#737685] uppercase tracking-wide">
                              {entry.dayOfWeek}
                            </span>
                          </div>
                        </td>

                        {/* Check-in Time */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1 text-[11px] font-mono font-semibold text-[#065f46]">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#10b981]" />
                            <span>{entry.checkInTime}</span>
                          </div>
                        </td>

                        {/* Check-out Time */}
                        <td className="py-3 px-4">
                          {entry.checkOutTime ? (
                            <div className="flex items-center gap-1 text-[11px] font-mono font-semibold text-[#003d9b]">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#0052cc]" />
                              <span>{entry.checkOutTime}</span>
                            </div>
                          ) : isActive ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#eff6ff] text-[#1e40af] border border-[#bfdbfe]">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#3b82f6] animate-pulse" />
                              <span>On Duty</span>
                            </span>
                          ) : (
                            <span
                              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#fee2e2] text-[#b91c1c] border border-[#f87171]/50"
                              title="No check-out was recorded for this past shift (passed midnight)"
                            >
                              <span className="material-symbols-outlined text-[12px]">warning</span>
                              <span>Missing Check-out</span>
                            </span>
                          )}
                        </td>

                        {/* Shift / Duration */}
                        <td className="py-3 px-4">
                          {isCompleted ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-[#ecfdf5] text-[#065f46] border border-[#a7f3d0]">
                              <span>{entry.duration || 'Completed'}</span>
                            </span>
                          ) : isActive ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-[#eff6ff] text-[#1e40af] border border-[#bfdbfe]">
                              <span>Active</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-[#fee2e2] text-[#b91c1c] border border-[#f87171]/50">
                              <span>Missing Check-out</span>
                            </span>
                          )}
                        </td>

                        {/* Work Location Type */}
                        <td className="py-3 px-4">
                          {entry.locationType === 'office' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-[#f1f3ff] text-[#003d9b] border border-[#c3c6d6]/60">
                              <span className="material-symbols-outlined text-[13px]">apartment</span>
                              <span>Office</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-[#fff7ed] text-[#c2410c] border border-[#fdba74]">
                              <span className="material-symbols-outlined text-[13px]">travel_explore</span>
                              <span>Outside</span>
                            </span>
                          )}
                        </td>

                        {/* Notes */}
                        <td className="py-3 px-4 max-w-[280px]">
                          {entry.notes ? (
                            <p
                              className="text-xs font-medium text-[#041b3c] leading-snug"
                              title={entry.notes}
                            >
                              {entry.notes}
                            </p>
                          ) : (
                            <span className="text-xs text-[#737685]">—</span>
                          )}
                        </td>

                        {/* Intern ID (Optional Column) */}
                        {showInternId && (
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className="font-mono text-[11px] font-semibold text-[#0052cc] bg-[#f1f3ff] px-2 py-0.5 rounded border border-[#c3c6d6]/60">
                              {entry.internId}
                            </span>
                          </td>
                        )}

                        {/* Action Column */}
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => setSelectedEntry(entry)}
                            className="px-2.5 py-1 text-xs font-bold text-[#0052cc] bg-[#f1f3ff] hover:bg-[#e0e8ff] rounded-md transition-colors cursor-pointer inline-flex items-center gap-1"
                          >
                            <span>Audit</span>
                            <span className="material-symbols-outlined text-[14px]">visibility</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Table Footer / Pagination */}
          <div className="px-4 py-3 bg-[#f9f9ff] border-t border-[#c3c6d6]/60 flex items-center justify-between flex-wrap gap-3 text-xs">
            <div className="text-[#585f6a]">
              Showing <span className="font-bold text-[#041b3c]">{paginatedEntries.length}</span> of{' '}
              <span className="font-bold text-[#041b3c]">{filteredAndSortedEntries.length}</span> total entries
              {viewMode === 'per_intern' && selectedInternProfile && (
                <span className="ml-1 text-[#0052cc] font-semibold">
                  for {selectedInternProfile.name}
                </span>
              )}
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="p-1.5 rounded border border-[#c3c6d6] hover:bg-[#f1f3ff] disabled:opacity-30 disabled:hover:bg-white text-[#434654] cursor-pointer"
                title="First Page"
              >
                <span className="material-symbols-outlined text-[16px]">first_page</span>
              </button>
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-2.5 py-1.5 rounded border border-[#c3c6d6] hover:bg-[#f1f3ff] disabled:opacity-30 disabled:hover:bg-white text-[#434654] font-semibold flex items-center gap-0.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[14px]">chevron_left</span>
                <span>Prev</span>
              </button>

              <span className="px-2 py-1 text-xs font-bold text-[#041b3c]">
                Page {currentPage} of {totalPages}
              </span>

              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-2.5 py-1.5 rounded border border-[#c3c6d6] hover:bg-[#f1f3ff] disabled:opacity-30 disabled:hover:bg-white text-[#434654] font-semibold flex items-center gap-0.5 cursor-pointer"
              >
                <span>Next</span>
                <span className="material-symbols-outlined text-[14px]">chevron_right</span>
              </button>
              <button
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded border border-[#c3c6d6] hover:bg-[#f1f3ff] disabled:opacity-30 disabled:hover:bg-white text-[#434654] cursor-pointer"
                title="Last Page"
              >
                <span className="material-symbols-outlined text-[16px]">last_page</span>
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* Entry Audit / Details Modal */}
      {selectedEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-[#c3c6d6] space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between pb-3 border-b border-[#c3c6d6]/60">
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    selectedEntry.status === 'completed'
                      ? 'bg-[#ecfdf5] text-[#10b981]'
                      : selectedEntry.status === 'active'
                      ? 'bg-[#eff6ff] text-[#3b82f6]'
                      : 'bg-[#ffe4e6] text-[#be123c]'
                  }`}
                >
                  <span className="material-symbols-outlined text-[24px]">
                    {selectedEntry.status === 'completed'
                      ? 'task_alt'
                      : selectedEntry.status === 'active'
                      ? 'timelapse'
                      : 'alarm_off'}
                  </span>
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#041b3c]">
                    Attendance Day Audit ({selectedEntry.displayDate})
                  </h3>
                  <p className="text-xs text-[#585f6a]">
                    Intern ID: <span className="font-mono font-semibold text-[#0052cc]">{selectedEntry.internId}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedEntry(null)}
                className="p-1 text-[#737685] hover:text-[#041b3c] rounded-full hover:bg-[#f1f3ff]"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Irregularity Banner if applicable */}
            {selectedEntry.isIrregular && (
              <div className="p-3 bg-[#fff4e5] border border-[#f59e0b] rounded-xl text-xs space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-[#b45309]">
                  <span className="material-symbols-outlined text-[18px] text-[#f59e0b]">warning</span>
                  <span>Flagged Anomaly Alert</span>
                </div>
                <p className="text-[#92400e]">{selectedEntry.irregularityReason}</p>
              </div>
            )}

            {/* Structured details list */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-[#f9f9ff] rounded-xl border border-[#c3c6d6]/40">
                <span className="text-[10px] font-bold text-[#737685] uppercase tracking-wider block">
                  Intern
                </span>
                <p className="font-bold text-[#041b3c] mt-0.5">{selectedEntry.internName}</p>
                <p className="text-[11px] text-[#585f6a]">{selectedEntry.internDepartment}</p>
              </div>

              <div className="p-3 bg-[#f9f9ff] rounded-xl border border-[#c3c6d6]/40">
                <span className="text-[10px] font-bold text-[#737685] uppercase tracking-wider block">
                  Check-in / Check-out Times
                </span>
                <p className="font-bold text-[#041b3c] mt-0.5">
                  In: {selectedEntry.checkInTime}
                </p>
                <p className="text-[11px] text-[#585f6a] font-mono">
                  Out: {selectedEntry.checkOutTime || (selectedEntry.status === 'active' ? 'Active Shift' : 'MISSING')}
                </p>
              </div>

              <div className="p-3 bg-[#f9f9ff] rounded-xl border border-[#c3c6d6]/40">
                <span className="text-[10px] font-bold text-[#737685] uppercase tracking-wider block">
                  Location Type
                </span>
                <p className="font-bold text-[#041b3c] uppercase mt-0.5">{selectedEntry.locationType}</p>
                <p className="text-[11px] text-[#585f6a]">
                  {selectedEntry.locationType === 'office' ? 'Office / On-site' : 'Outside / Remote'}
                </p>
              </div>

              <div className="p-3 bg-[#f9f9ff] rounded-xl border border-[#c3c6d6]/40 col-span-2">
                <span className="text-[10px] font-bold text-[#737685] uppercase tracking-wider block">
                  Notes
                </span>
                <p className="font-semibold text-[#041b3c] mt-0.5">
                  {selectedEntry.notes || '—'}
                </p>
              </div>
            </div>

            <div className="p-3 bg-[#f1f3ff] rounded-xl text-xs space-y-1 border border-[#c3c6d6]/40">
              <span className="text-[10px] font-bold text-[#737685] uppercase tracking-wider block">
                Billing Cycle & Duration
              </span>
              <p className="text-[#041b3c]">
                Billing Cycle: <strong className="font-semibold">{selectedEntry.monthYear}</strong> • Total Duration:{' '}
                <strong className="font-semibold">{selectedEntry.duration || 'Active Shift'}</strong>
              </p>
            </div>

            <div className="pt-2 flex justify-between items-center">
              <button
                onClick={() => {
                  handleSelectInternForDetails(selectedEntry.internId);
                  setSelectedEntry(null);
                }}
                className="text-xs text-[#0052cc] font-bold hover:underline cursor-pointer flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-[16px]">person</span>
                <span>View {selectedEntry.internName}'s Full Ledger</span>
              </button>

              <button
                onClick={() => setSelectedEntry(null)}
                className="px-4 py-2 bg-[#041b3c] text-white text-xs font-bold rounded-lg hover:bg-[#003d9b] transition-colors cursor-pointer"
              >
                Close Audit View
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Per-Intern Attendance Form Modal (Pico Format) */}
      <InternAttendanceFormModal
        isOpen={isPrintFormOpen}
        onClose={() => setIsPrintFormOpen(false)}
        interns={effectiveUsers.filter((u) => u.role === 'intern')}
        initialInternId={printFormInternId || perInternSelectedId}
        attendanceRecords={effectiveRecords}
        allUsers={effectiveUsers}
      />
    </div>
  );
};
