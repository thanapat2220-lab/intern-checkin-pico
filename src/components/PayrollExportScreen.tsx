import React, { useState, useMemo, useEffect } from 'react';
import { PayrollRecord, UserProfile, AttendanceRecord, FinalizedPayrollCycle } from '../types';
import { ASSET_IMAGES } from '../data/mockData';
import { formatMonthYear, getRecentMonthDropdownOptions, getMonthPeriodRange } from '../utils/dateUtils';
import { getMergedRecordNotes } from '../utils/noteUtils';
import { PrintablePayrollReport } from './PrintablePayrollReport';
import {
  finalizePayrollCycle,
  unlockPayrollCycle,
  subscribeToFinalizedPayrollCycles,
} from '../services/dbService';

interface PayrollExportScreenProps {
  user: UserProfile;
  payrollRecords: PayrollRecord[];
  attendanceRecords?: AttendanceRecord[];
  allUsers?: UserProfile[];
  finalizedCycles?: FinalizedPayrollCycle[];
  onUpdateRecord?: (updated: PayrollRecord) => void;
  onAddNewRecord?: (newRec: PayrollRecord) => void;
  onLogout: () => void;
  onSwitchScreen: (screen: any) => void;
}

export const PayrollExportScreen: React.FC<PayrollExportScreenProps> = ({
  user,
  payrollRecords,
  attendanceRecords = [],
  allUsers = [],
  finalizedCycles: finalizedCyclesProp,
  onUpdateRecord,
  onAddNewRecord,
  onLogout,
  onSwitchScreen,
}) => {
  // Month selector — default to current month or August 2026
  const [selectedMonth, setSelectedMonth] = useState<string>(() => formatMonthYear());
  const monthOptions = useMemo(() => {
    const list = getRecentMonthDropdownOptions(5, 1);
    const hasAug2026 = list.some((m) => m.value === 'August 2026');
    if (!hasAug2026) {
      return [{ value: 'August 2026', label: 'August 2026' }, ...list];
    }
    return list;
  }, []);

  // Real-time Firestore finalized payroll cycles subscription
  const [localFinalizedCycles, setLocalFinalizedCycles] = useState<FinalizedPayrollCycle[]>([]);

  useEffect(() => {
    const unsub = subscribeToFinalizedPayrollCycles((cycles) => {
      setLocalFinalizedCycles(cycles);
    });
    return () => unsub();
  }, []);

  const activeFinalizedCycles = useMemo(() => {
    if (finalizedCyclesProp && finalizedCyclesProp.length > 0) {
      return finalizedCyclesProp;
    }
    return localFinalizedCycles;
  }, [finalizedCyclesProp, localFinalizedCycles]);

  // Current selected month finalized cycle record (if any)
  const currentFinalizedCycle = useMemo(() => {
    return activeFinalizedCycles.find((c) => c.monthYear === selectedMonth) || null;
  }, [activeFinalizedCycles, selectedMonth]);

  const isCycleFinalized = Boolean(currentFinalizedCycle);

  const [selectedDepartment, setSelectedDepartment] = useState<string>('All Departments');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('All Statuses');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showArchived, setShowArchived] = useState<boolean>(false);
  const [activeSideTab, setActiveSideTab] = useState<'overview' | 'status' | 'bank' | 'tax' | 'audit'>('overview');
  const [topNavTab, setTopNavTab] = useState<'payroll' | 'dashboard' | 'interns' | 'reports'>('payroll');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modals
  const [showExportModal, setShowExportModal] = useState<boolean>(false);
  const [showPrintReportModal, setShowPrintReportModal] = useState<boolean>(false);
  const [showFinalizeModal, setShowFinalizeModal] = useState<boolean>(false);
  const [isFinalizing, setIsFinalizing] = useState<boolean>(false);
  const [showUnlockModal, setShowUnlockModal] = useState<boolean>(false);
  const [isUnlocking, setIsUnlocking] = useState<boolean>(false);
  const [showSubmitPayrollModal, setShowSubmitPayrollModal] = useState<boolean>(false);
  const [isPayrollSubmitted, setIsPayrollSubmitted] = useState<boolean>(false);

  // Column display options: Intern ID hidden by default to keep table clean, toggleable for disambiguating duplicate names
  const [showInternId, setShowInternId] = useState<boolean>(false);
  const [timecardModalIntern, setTimecardModalIntern] = useState<{
    intern: UserProfile;
    record: PayrollRecord;
    logs: AttendanceRecord[];
  } | null>(null);
  const [editingRecord, setEditingRecord] = useState<PayrollRecord | null>(null);
  const [showAddModal, setShowAddModal] = useState<boolean>(false);

  // New Record form state
  const [newInternName, setNewInternName] = useState('');
  const [newDepartment, setNewDepartment] = useState('Engineering');
  const [newTeam, setNewTeam] = useState('Frontend');
  const [newPeriod, setNewPeriod] = useState('Jul 1 - Dec 31');
  const [newDailyRate, setNewDailyRate] = useState(400);
  const [newDaysWorked, setNewDaysWorked] = useState(21);
  const [newBankName, setNewBankName] = useState('Kasikorn Bank (KBANK)');
  const [newAccountNumber, setNewAccountNumber] = useState('');

  // Attendance records pool directly from real Firestore
  const activeAttendanceLogs = attendanceRecords;

  // Active records pool: combines stored Firestore records with auto-calculated records for registered interns
  const activeRecords = useMemo(() => {
    // 1. Existing stored payroll records for this month in Firestore
    const storedMonthRecords = payrollRecords.filter((r) => r.monthYear === selectedMonth);
    const storedInternIds = new Set(storedMonthRecords.map((r) => r.internId));

    // 2. Real registered interns in allUsers who don't have a stored payroll doc yet for this month:
    const registeredInterns = allUsers.filter((u) => {
      if (u.role !== 'intern') return false;
      const isArchived = Boolean(u.isArchived || u.status === 'archived');
      if (!showArchived && isArchived) return false;
      return true;
    });
    const derivedFromAttendance: PayrollRecord[] = [];

    for (const intern of registeredInterns) {
      if (storedInternIds.has(intern.id)) continue;
      // Check real attendance logs for this intern in selectedMonth
      const internLogs = activeAttendanceLogs.filter(
        (r) => r.internId === intern.id && r.monthYear === selectedMonth
      );
      const uniqueDaysWorked = new Set(internLogs.map((r) => r.date)).size;
      const rate = intern.dailyRateTHB || 400;
      derivedFromAttendance.push({
        id: `pay-${intern.id}-${selectedMonth.replace(/\s+/g, '_')}`,
        internId: intern.id,
        name: intern.name,
        department: intern.department || 'General',
        team: intern.team || 'Intern Team',
        internshipPeriod: intern.internshipPeriod || 'Jul 1 - Dec 31',
        dailyRateTHB: rate,
        daysWorked: uniqueDaysWorked,
        totalAmountTHB: uniqueDaysWorked * rate,
        bankName: intern.bankName || 'Kasikorn Bank (KBANK)',
        accountNumber: intern.accountNumber || '',
        status: 'Pending',
        monthYear: selectedMonth,
        supervisorId: intern.supervisorId || null,
        supervisorName: intern.supervisorName || null,
      });
    }

    return [...storedMonthRecords, ...derivedFromAttendance];
  }, [payrollRecords, selectedMonth, allUsers, activeAttendanceLogs, showArchived]);

  // Department options derived from data
  const departmentOptions = useMemo(() => {
    const depts = new Set<string>();
    activeRecords.forEach((r) => depts.add(r.department));
    return ['All Departments', ...Array.from(depts)];
  }, [activeRecords]);

  // Filtered records
  const filteredRecords = useMemo(() => {
    return activeRecords.filter((rec) => {
      // Archived intern check
      if (!showArchived) {
        const internUser = allUsers.find((u) => u.id === rec.internId);
        if (internUser && (internUser.isArchived || internUser.status === 'archived')) {
          return false;
        }
      }

      const matchesDept =
        selectedDepartment === 'All Departments' || rec.department === selectedDepartment;
      const matchesStatus =
        selectedStatusFilter === 'All Statuses' ||
        (selectedStatusFilter === 'Approved' && rec.status === 'Approved') ||
        (selectedStatusFilter === 'Pending' && rec.status === 'Pending');
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        rec.name.toLowerCase().includes(q) ||
        rec.department.toLowerCase().includes(q) ||
        rec.team.toLowerCase().includes(q) ||
        rec.bankName.toLowerCase().includes(q) ||
        rec.accountNumber.includes(q);
      return matchesDept && matchesStatus && matchesSearch;
    });
  }, [activeRecords, selectedDepartment, selectedStatusFilter, searchQuery]);

  // Calculated summary statistics
  const totalPayrollTHB = useMemo(
    () => filteredRecords.reduce((acc, r) => acc + r.totalAmountTHB, 0),
    [filteredRecords]
  );

  const totalDaysWorked = useMemo(
    () => filteredRecords.reduce((acc, r) => acc + r.daysWorked, 0),
    [filteredRecords]
  );

  const approvedCount = useMemo(
    () => filteredRecords.filter((r) => r.status === 'Approved').length,
    [filteredRecords]
  );

  const pendingCount = useMemo(
    () => filteredRecords.filter((r) => r.status === 'Pending').length,
    [filteredRecords]
  );

  // Status toggle handler
  const handleStatusToggle = (rec: PayrollRecord) => {
    const nextStatus = rec.status === 'Approved' ? 'Pending' : 'Approved';
    const updated = { ...rec, status: nextStatus };

    onUpdateRecord?.(updated);

    setToastMessage(`Updated ${rec.name}'s payment status to ${nextStatus}.`);
    setTimeout(() => setToastMessage(null), 2500);
  };

  // Batch approve all pending records
  const handleApproveAllPending = () => {
    activeRecords.forEach((r) => {
      if (r.status === 'Pending') {
        onUpdateRecord?.({ ...r, status: 'Approved' });
      }
    });
    setToastMessage(`Approved all ${filteredRecords.length} intern timecards for ${selectedMonth}.`);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Open Timecard Drilldown Modal
  const handleOpenTimecard = (record: PayrollRecord) => {
    const internProfile =
      allUsers.find((i) => i.id === record.internId) || {
        id: record.internId,
        name: record.name,
        email: `${record.name.toLowerCase().replace(/\s+/g, '.')}@pico.internal`,
        role: 'intern' as const,
        department: record.department,
        team: record.team,
        initials: record.name
          .split(' ')
          .map((n) => n[0])
          .join('')
          .toUpperCase(),
        internshipPeriod: record.internshipPeriod,
        dailyRateTHB: record.dailyRateTHB,
        bankName: record.bankName,
        accountNumber: record.accountNumber,
        supervisorName: record.supervisorName || 'Unassigned',
      };

    const matchingLogs = activeAttendanceLogs.filter(
      (l) => l.internId === record.internId && l.monthYear === selectedMonth
    );

    setTimecardModalIntern({
      intern: internProfile,
      record,
      logs: matchingLogs,
    });
  };

  // Open Print Report Modal
  const handleOpenPrintReport = () => {
    setShowExportModal(false);
    setShowPrintReportModal(true);
  };

  // Handle CSV Export
  const handleExportCSV = () => {
    const headers = [
      'Name',
      'Department',
      'Team',
      'Internship Period',
      'Daily Rate (THB)',
      'Days Worked',
      'Total Amount (THB)',
      'Bank Name',
      'Account Number',
      'Approval Status',
      'Month Period',
      'Intern ID',
    ];

    const rows = filteredRecords.map((r) => [
      `"${r.name}"`,
      `"${r.department}"`,
      `"${r.team}"`,
      `"${r.internshipPeriod}"`,
      r.dailyRateTHB,
      r.daysWorked,
      r.totalAmountTHB,
      `"${r.bankName}"`,
      `"${r.accountNumber}"`,
      `"${r.status}"`,
      `"${selectedMonth}"`,
      `"${r.internId}"`,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `Intern_Payroll_${selectedMonth.replace(/\s+/g, '_')}_Summary.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setShowExportModal(false);
    setToastMessage(`Exported ${filteredRecords.length} records to CSV successfully.`);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Handle Bank Direct Transfer CSV
  const handleExportBankTransferFile = () => {
    const headers = [
      'Beneficiary Name',
      'Bank Name',
      'Account Number',
      'Transfer Amount (THB)',
      'Payment Reference',
      'Disbursal Date',
      'Remittance Advice Note',
      'Intern ID',
    ];

    const rows = filteredRecords.map((r) => [
      `"${r.name}"`,
      `"${r.bankName}"`,
      `"${r.accountNumber}"`,
      r.totalAmountTHB.toFixed(2),
      `"STIPEND-${selectedMonth.replace(/\s+/g, '')}-${(r.internId || r.id).replace(/[^a-zA-Z0-9]/g, '').slice(-4)}"`,
      `"2026-09-07"`,
      `"Monthly Internship Stipend (${r.daysWorked} days @ 400 THB)"`,
      `"${r.internId}"`,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `Bank_Direct_Transfer_Batch_${selectedMonth.replace(/\s+/g, '_')}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setShowExportModal(false);
    setToastMessage(`Generated Bank Direct Transfer batch file (${filteredRecords.length} payees).`);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Handle Finalize Payroll Cycle (Internal Audit Trail in Firestore)
  const handleConfirmFinalizePayroll = async () => {
    setIsFinalizing(true);
    try {
      await finalizePayrollCycle({
        monthYear: selectedMonth,
        user,
        totalInterns: filteredRecords.length,
        totalDaysWorked,
        totalAmountTHB: totalPayrollTHB,
        notes: `Finalized by ${user.name} for offline accounting signature & handoff`,
      });
      setShowFinalizeModal(false);
      setToastMessage(`Payroll cycle for ${selectedMonth} recorded as finalized.`);
      setTimeout(() => setToastMessage(null), 3500);
    } catch (err) {
      console.error('Error finalizing payroll cycle:', err);
      setToastMessage('Error saving finalization record to Firestore.');
      setTimeout(() => setToastMessage(null), 4000);
    } finally {
      setIsFinalizing(false);
    }
  };

  // Handle Unlock Payroll Cycle
  const handleConfirmUnlockPayroll = async () => {
    setIsUnlocking(true);
    try {
      await unlockPayrollCycle(selectedMonth);
      setShowUnlockModal(false);
      setToastMessage(`Payroll cycle for ${selectedMonth} has been unlocked for editing.`);
      setTimeout(() => setToastMessage(null), 3500);
    } catch (err) {
      console.error('Error unlocking payroll cycle:', err);
      setToastMessage('Error unlocking payroll cycle.');
      setTimeout(() => setToastMessage(null), 3500);
    } finally {
      setIsUnlocking(false);
    }
  };

  // Handle Confirm Submit Payroll
  const handleConfirmSubmitPayroll = () => {
    setShowSubmitPayrollModal(false);
    setIsPayrollSubmitted(true);
    setToastMessage(`Payroll batch submitted successfully for ${selectedMonth}.`);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Save new record
  const handleSaveNewRecord = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newInternName) return;

    if (isCycleFinalized) {
      setToastMessage(`${selectedMonth} is finalized and locked. Unlock the cycle to add records.`);
      setTimeout(() => setToastMessage(null), 3500);
      return;
    }

    const total = newDailyRate * newDaysWorked;
    const newRec: PayrollRecord = {
      id: `pay-${Date.now()}`,
      internId: `intern-${Date.now().toString().slice(-4)}`,
      name: newInternName,
      department: newDepartment,
      team: newTeam,
      internshipPeriod: newPeriod,
      dailyRateTHB: Number(newDailyRate),
      daysWorked: Number(newDaysWorked),
      totalAmountTHB: total,
      bankName: newBankName,
      accountNumber: newAccountNumber || '',
      status: 'Approved',
      monthYear: selectedMonth,
      supervisorName: null,
    };

    onAddNewRecord?.(newRec);

    setShowAddModal(false);
    setNewInternName('');
    setToastMessage(`Added payroll entry for ${newRec.name}.`);
    setTimeout(() => setToastMessage(null), 3000);
  };

  return (
    <>
      <div className="bg-[#f9f9ff] text-[#041b3c] flex h-screen overflow-hidden font-sans antialiased text-[14px] print:hidden">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-8 z-50 bg-[#041b3c] text-white px-5 py-3 rounded-lg shadow-xl flex items-center gap-3 font-medium text-sm border border-[#c3c6d6] animate-fade-in">
          <span className="material-symbols-outlined text-[#10B981] text-[20px]">
            check_circle
          </span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* SideNavBar (Desktop & Tablet) */}
      <nav className="h-screen w-64 bg-[#f1f3ff] border-r border-[#c3c6d6] flex flex-col p-4 gap-2 hidden md:flex shrink-0 z-10 shadow-xs">
        <div className="mb-4 px-2">
          <div className="flex items-center gap-2">
            <span
              className="material-symbols-outlined text-[#003d9b] text-[24px] filled"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              account_balance_wallet
            </span>
            <h1 className="text-[19px] font-black text-[#003d9b] tracking-tight">
              Payroll Admin
            </h1>
          </div>
          <p className="text-[12px] text-[#585f6a] mt-0.5">Month-End Disbursals</p>
        </div>

        <div className="flex flex-col gap-1 flex-grow">
          {/* Active Navigation */}
          <button
            onClick={() => setActiveSideTab('overview')}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg font-bold text-[13px] transition-transform duration-150 text-left cursor-pointer ${
              activeSideTab === 'overview'
                ? 'bg-[#dae0ee] text-[#041b3c] shadow-xs'
                : 'text-[#434654] hover:bg-[#d7e2ff]/50'
            }`}
          >
            <span
              className="material-symbols-outlined text-[20px] filled"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              payments
            </span>
            <span>Payroll Summary</span>
          </button>

          {/* Interns Directory */}
          <button
            onClick={() => onSwitchScreen('admin_interns')}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium text-[#434654] hover:bg-[#d7e2ff]/50 transition-colors text-left cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">manage_accounts</span>
            <span>Interns Directory</span>
          </button>

          {/* Raw Attendance Logs */}
          <button
            onClick={() => onSwitchScreen('attendance_logs')}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium text-[#434654] hover:bg-[#d7e2ff]/50 transition-colors text-left cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">list_alt</span>
            <span>Attendance Log</span>
          </button>

          {/* Supervisor Portal */}
          <button
            onClick={() => onSwitchScreen('supervisor_portal')}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium text-[#434654] hover:bg-[#d7e2ff]/50 transition-colors text-left cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">supervisor_account</span>
            <span>Supervisor Portal</span>
          </button>

          <button
            onClick={() => setActiveSideTab('status')}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors text-left cursor-pointer ${
              activeSideTab === 'status'
                ? 'bg-[#dae0ee] text-[#003d9b] font-bold'
                : 'text-[#434654] hover:bg-[#d7e2ff]/50'
            }`}
          >
            <span className="material-symbols-outlined text-[20px]">verified</span>
            <span>Approval Tracking</span>
          </button>

          <button
            onClick={() => setActiveSideTab('bank')}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors text-left cursor-pointer ${
              activeSideTab === 'bank'
                ? 'bg-[#dae0ee] text-[#003d9b] font-bold'
                : 'text-[#434654] hover:bg-[#d7e2ff]/50'
            }`}
          >
            <span className="material-symbols-outlined text-[20px]">account_balance</span>
            <span>Bank Routing</span>
          </button>
        </div>

        <div className="space-y-2 mt-auto pt-4 border-t border-[#c3c6d6]/60">
          {/* Quick Submit Button in Sidebar */}
          <button
            onClick={() => setShowSubmitPayrollModal(true)}
            className="w-full bg-[#003d9b] hover:bg-[#0052cc] text-white font-bold text-[13px] py-2.5 rounded-lg transition-colors cursor-pointer shadow-sm flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]">send</span>
            <span>Submit Payroll</span>
          </button>

          <button
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 bg-transparent text-[#585f6a] hover:text-[#ba1a1a] hover:bg-white/60 py-2 rounded-md text-[12px] font-medium transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">logout</span>
            <span>Switch Role / Logout</span>
          </button>
        </div>
      </nav>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* TopAppBar */}
        <header className="bg-white border-b border-[#c3c6d6] flex items-center justify-between px-6 lg:px-8 py-3 w-full top-0 z-10 shrink-0 shadow-xs">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <span className="text-[20px] font-black text-[#003d9b] tracking-tight">
                Finance & HR Operations
              </span>
              <span className="text-[11px] font-bold uppercase tracking-wider bg-[#dae0ee] text-[#003d9b] px-2.5 py-0.5 rounded-full border border-[#003d9b]/20">
                Payroll Portal
              </span>
            </div>

            <nav className="hidden xl:flex gap-6 ml-4">
              <button
                onClick={() => setTopNavTab('payroll')}
                className={`text-[13px] transition-colors ${
                  topNavTab === 'payroll'
                    ? 'text-[#003d9b] border-b-2 border-[#003d9b] pb-1 font-bold'
                    : 'text-[#585f6a] hover:text-[#003d9b]'
                }`}
              >
                Payroll Summary
              </button>
              <button
                onClick={() => onSwitchScreen('attendance_logs')}
                className="text-[13px] font-medium transition-colors text-[#585f6a] hover:text-[#003d9b] cursor-pointer"
              >
                Attendance Log
              </button>
              <button
                onClick={() => onSwitchScreen('admin_interns')}
                className="text-[13px] font-medium transition-colors text-[#585f6a] hover:text-[#003d9b] cursor-pointer"
              >
                Interns Directory
              </button>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            {/* Search Input */}
            <div className="relative hidden md:block">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#585f6a] text-[18px]">
                search
              </span>
              <input
                className="pl-9 pr-3 py-1.5 border border-[#c3c6d6] rounded-full text-[13px] focus:border-[#003d9b] focus:ring-1 focus:ring-[#003d9b] outline-none bg-[#f9f9ff] text-[#041b3c] w-52 lg:w-64"
                placeholder="Search intern, bank, acc..."
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Print Report Button */}
            <button
              onClick={handleOpenPrintReport}
              className="bg-white border border-[#c3c6d6] text-[#041b3c] hover:bg-[#dae0ee] font-semibold text-[13px] px-3.5 py-1.5 rounded-lg transition-colors cursor-pointer shadow-2xs flex items-center gap-1.5"
              title="Print or Save A4 Landscape Thai Payroll Report"
            >
              <span className="material-symbols-outlined text-[17px] text-[#003d9b]">
                print
              </span>
              <span>Print Report</span>
            </button>

            {/* Export CSV Button */}
            <button
              onClick={() => setShowExportModal(true)}
              className="bg-white border border-[#c3c6d6] text-[#041b3c] hover:bg-[#dae0ee] font-semibold text-[13px] px-3.5 py-1.5 rounded-lg transition-colors cursor-pointer shadow-2xs flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[17px] text-[#003d9b]">
                download
              </span>
              <span>Export CSV</span>
            </button>

            {/* Submit Payroll Primary Button */}
            <button
              onClick={() => setShowSubmitPayrollModal(true)}
              className="bg-[#003d9b] text-white font-bold text-[13px] px-4 py-1.5 rounded-lg hover:bg-[#0052cc] transition-colors cursor-pointer shadow-sm flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[17px]">
                send
              </span>
              <span>Submit Payroll</span>
            </button>

            {/* User Profile avatar */}
            <div className="flex items-center gap-2.5 border-l border-[#c3c6d6] pl-3 ml-1">
              <div className="w-8 h-8 rounded-full bg-[#003d9b] text-white flex items-center justify-center font-bold text-xs">
                {user.initials || 'PA'}
              </div>
              <div className="hidden lg:block text-left">
                <span className="text-[12px] font-bold text-[#041b3c] block leading-none">
                  {user.name}
                </span>
                <span className="text-[10px] text-[#585f6a]">Payroll Admin</span>
              </div>
            </div>
          </div>
        </header>

        {/* Main Scrollable Content */}
        <main className="flex-1 overflow-y-auto p-6 lg:p-8 bg-[#f9f9ff]">
          <div className="max-w-7xl mx-auto space-y-5">
            {/* Month-End Submission Readiness Bar */}
            {isPayrollSubmitted && (
              <div className="bg-[#e6f4ea] border border-[#1e8e3e]/30 rounded-xl p-3.5 flex items-center justify-between gap-3 animate-fade-in shadow-xs">
                <div className="flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-[#1e8e3e] text-[22px]">
                    task_alt
                  </span>
                  <div>
                    <h4 className="text-[13px] font-bold text-[#1e8e3e]">
                      Month-End Payroll Batch Submitted!
                    </h4>
                    <p className="text-[12px] text-[#2e5b38]">
                      Batch reference <code>BATCH-{selectedMonth.replace(/\s+/g, '')}-{filteredRecords.length}INT</code> queued for direct bank debit. All {filteredRecords.length} interns notified.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsPayrollSubmitted(false)}
                  className="text-xs text-[#1e8e3e] font-semibold underline hover:text-[#137333] cursor-pointer"
                >
                  Reset Status
                </button>
              </div>
            )}

            {/* Header Title & Month Selection */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pt-1">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-[24px] font-black text-[#041b3c] tracking-tight">
                    Month-End Payroll Export
                  </h2>
                  <span className="bg-[#dae0ee] text-[#003d9b] text-xs font-bold px-2.5 py-0.5 rounded-full border border-[#c3c6d6]">
                    {selectedMonth}
                  </span>
                </div>
                <p className="text-[13px] text-[#585f6a] mt-0.5">
                  Pre-submission review: verified days worked from check-in logs, calculated at 400 THB/day rate.
                </p>
              </div>

              {/* Month Selector Dropdown & Batch Action */}
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2 bg-white border border-[#c3c6d6] rounded-lg px-3 py-1.5 shadow-2xs">
                  <span className="material-symbols-outlined text-[#585f6a] text-[18px]">
                    calendar_month
                  </span>
                  <label htmlFor="payroll-month-select" className="text-xs font-semibold text-[#585f6a]">
                    Month:
                  </label>
                  <select
                    id="payroll-month-select"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="text-[13px] font-bold text-[#003d9b] bg-transparent outline-none cursor-pointer"
                  >
                    {monthOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.value}
                      </option>
                    ))}
                  </select>
                </div>

                {pendingCount > 0 && (
                  <button
                    onClick={handleApproveAllPending}
                    className="bg-[#e0e8ff] hover:bg-[#d7e2ff] text-[#003d9b] font-bold text-[12px] px-3 py-2 rounded-lg transition-colors border border-[#003d9b]/25 cursor-pointer flex items-center gap-1.5"
                    title="Mark all pending records in this view as Approved"
                  >
                    <span className="material-symbols-outlined text-[16px]">
                      done_all
                    </span>
                    <span>Approve All ({pendingCount})</span>
                  </button>
                )}
              </div>
            </div>

            {/* Top Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Card 1: Total Disbursals */}
              <div className="bg-white border border-[#c3c6d6] rounded-xl p-4 shadow-xs flex flex-col justify-between">
                <div className="flex justify-between items-start">
                  <span className="text-[11px] font-bold text-[#585f6a] uppercase tracking-wider">
                    Total Disbursals
                  </span>
                  <div className="w-8 h-8 rounded-lg bg-[#e8edff] text-[#003d9b] flex items-center justify-center">
                    <span className="material-symbols-outlined text-[18px]">
                      payments
                    </span>
                  </div>
                </div>
                <div className="mt-2">
                  <div className="text-[26px] font-black text-[#003d9b] tracking-tight leading-none">
                    {totalPayrollTHB.toLocaleString()} THB
                  </div>
                  <span className="text-[12px] text-[#585f6a] font-medium mt-1 block">
                    Calculated for {selectedMonth}
                  </span>
                </div>
              </div>

              {/* Card 2: Active Interns */}
              <div className="bg-white border border-[#c3c6d6] rounded-xl p-4 shadow-xs flex flex-col justify-between">
                <div className="flex justify-between items-start">
                  <span className="text-[11px] font-bold text-[#585f6a] uppercase tracking-wider">
                    Active Interns
                  </span>
                  <div className="w-8 h-8 rounded-lg bg-[#dae0ee] text-[#041b3c] flex items-center justify-center">
                    <span className="material-symbols-outlined text-[18px]">
                      group
                    </span>
                  </div>
                </div>
                <div className="mt-2">
                  <div className="text-[26px] font-black text-[#041b3c] tracking-tight leading-none">
                    {filteredRecords.length} Interns
                  </div>
                  <span className="text-[12px] text-[#10B981] font-semibold mt-1 block flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-[#10B981]" />
                    100% On Active Contracts
                  </span>
                </div>
              </div>

              {/* Card 3: Total Days Logged */}
              <div className="bg-white border border-[#c3c6d6] rounded-xl p-4 shadow-xs flex flex-col justify-between">
                <div className="flex justify-between items-start">
                  <span className="text-[11px] font-bold text-[#585f6a] uppercase tracking-wider">
                    Total Days Logged
                  </span>
                  <div className="w-8 h-8 rounded-lg bg-[#e6f4ea] text-[#1e8e3e] flex items-center justify-center">
                    <span className="material-symbols-outlined text-[18px]">
                      event_available
                    </span>
                  </div>
                </div>
                <div className="mt-2">
                  <div className="text-[26px] font-black text-[#1e8e3e] tracking-tight leading-none">
                    {totalDaysWorked} Days
                  </div>
                  <span className="text-[12px] text-[#585f6a] font-medium mt-1 block">
                    Verified via check-in timecards
                  </span>
                </div>
              </div>

              {/* Card 4: Daily Stipend Rate & Approval Ratio */}
              <div className="bg-white border border-[#c3c6d6] rounded-xl p-4 shadow-xs flex flex-col justify-between">
                <div className="flex justify-between items-start">
                  <span className="text-[11px] font-bold text-[#585f6a] uppercase tracking-wider">
                    Rate & Approvals
                  </span>
                  <div className="w-8 h-8 rounded-lg bg-[#fff8e1] text-[#b45309] flex items-center justify-center">
                    <span className="material-symbols-outlined text-[18px]">
                      verified
                    </span>
                  </div>
                </div>
                <div className="mt-2">
                  <div className="text-[26px] font-black text-[#041b3c] tracking-tight leading-none">
                    400 THB<span className="text-[13px] font-normal text-[#585f6a]">/day</span>
                  </div>
                  <span className="text-[12px] text-[#585f6a] font-medium mt-1 block">
                    {approvedCount} of {filteredRecords.length} Approved ({pendingCount} Pending)
                  </span>
                </div>
              </div>
            </div>

            {/* Filter Toolbar */}
            <div className="bg-white border border-[#c3c6d6] p-3.5 rounded-xl shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 flex-wrap w-full sm:w-auto">
                {/* Department Filter */}
                <select
                  value={selectedDepartment}
                  onChange={(e) => setSelectedDepartment(e.target.value)}
                  className="border border-[#c3c6d6] rounded-lg px-3 py-1.5 text-xs font-semibold text-[#041b3c] focus:border-[#003d9b] outline-none bg-[#f9f9ff] cursor-pointer"
                >
                  {departmentOptions.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>

                {/* Status Filter */}
                <select
                  value={selectedStatusFilter}
                  onChange={(e) => setSelectedStatusFilter(e.target.value)}
                  className="border border-[#c3c6d6] rounded-lg px-3 py-1.5 text-xs font-semibold text-[#041b3c] focus:border-[#003d9b] outline-none bg-[#f9f9ff] cursor-pointer"
                >
                  <option value="All Statuses">All Statuses ({activeRecords.length})</option>
                  <option value="Approved">Approved Only ({approvedCount})</option>
                  <option value="Pending">Pending Review ({pendingCount})</option>
                </select>

                <div className="text-xs text-[#585f6a] hidden lg:block">
                  Showing <strong>{filteredRecords.length}</strong> interns
                </div>

                {/* Show Intern ID Toggle (Hidden by default to prevent clutter; toggleable to disambiguate duplicate names) */}
                <label
                  className={`flex items-center gap-1.5 text-xs font-bold px-2.5 py-1.5 rounded-lg border cursor-pointer select-none transition-all ${
                    showInternId
                      ? 'bg-[#e8edff] text-[#003d9b] border-[#003d9b] ring-1 ring-[#003d9b]'
                      : 'bg-[#f9f9ff] text-[#64748b] border-[#c3c6d6] hover:bg-[#f1f3ff]'
                  }`}
                  title="Toggle visibility of Intern ID column to disambiguate duplicate intern names"
                >
                  <input
                    type="checkbox"
                    checked={showInternId}
                    onChange={(e) => setShowInternId(e.target.checked)}
                    className="accent-[#003d9b] rounded w-3.5 h-3.5"
                  />
                  <span className="material-symbols-outlined text-[15px]">badge</span>
                  <span>Show Intern ID</span>
                </label>

                {/* Show Archived Toggle */}
                <label
                  className={`flex items-center gap-1.5 text-xs font-bold px-2.5 py-1.5 rounded-lg border cursor-pointer select-none transition-all ${
                    showArchived
                      ? 'bg-[#fff7ed] text-[#c2410c] border-[#fed7aa] ring-1 ring-[#fed7aa]'
                      : 'bg-[#f9f9ff] text-[#64748b] border-[#c3c6d6] hover:bg-[#f1f3ff]'
                  }`}
                  title="Include archived / inactive interns in payroll calculations and summary"
                >
                  <input
                    type="checkbox"
                    checked={showArchived}
                    onChange={(e) => setShowArchived(e.target.checked)}
                    className="accent-[#c2410c] rounded w-3.5 h-3.5"
                  />
                  <span className="material-symbols-outlined text-[15px]">archive</span>
                  <span>Show Archived</span>
                </label>
              </div>

              {/* Right Side Action Buttons */}
              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  onClick={handleOpenPrintReport}
                  className="bg-white border border-[#c3c6d6] hover:bg-[#dae0ee] text-[#041b3c] font-semibold text-xs px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                  title="Print or Save A4 Landscape Thai Payroll Report"
                >
                  <span className="material-symbols-outlined text-[16px] text-[#003d9b]">
                    print
                  </span>
                  <span>Print Report</span>
                </button>

                <button
                  onClick={() => setShowAddModal(true)}
                  className="bg-white border border-[#c3c6d6] hover:bg-[#dae0ee] text-[#041b3c] font-semibold text-xs px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                >
                  <span className="material-symbols-outlined text-[16px] text-[#003d9b]">
                    person_add
                  </span>
                  <span>Add Intern</span>
                </button>

                <button
                  onClick={handleExportCSV}
                  className="bg-[#003d9b] hover:bg-[#0052cc] text-white font-bold text-xs px-3.5 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1 shadow-xs"
                >
                  <span className="material-symbols-outlined text-[16px]">
                    file_download
                  </span>
                  <span>Export CSV</span>
                </button>
              </div>
            </div>

            {/* Main Payroll Records Table */}
            <div className="bg-white border border-[#c3c6d6] rounded-xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#dae0ee] border-b border-[#c3c6d6]">
                      <th className="p-3.5 text-[12px] font-bold text-[#041b3c] whitespace-nowrap">
                        Name
                      </th>
                      <th className="p-3.5 text-[12px] font-bold text-[#041b3c] whitespace-nowrap">
                        Department
                      </th>
                      <th className="p-3.5 text-[12px] font-bold text-[#041b3c] whitespace-nowrap">
                        Team
                      </th>
                      <th className="p-3.5 text-[12px] font-bold text-[#041b3c] whitespace-nowrap">
                        Internship Period
                      </th>
                      <th className="p-3.5 text-[12px] font-bold text-[#041b3c] whitespace-nowrap text-right">
                        Daily Rate
                      </th>
                      <th className="p-3.5 text-[12px] font-bold text-[#041b3c] whitespace-nowrap text-right">
                        Days Worked
                      </th>
                      <th className="p-3.5 text-[12px] font-bold text-[#041b3c] whitespace-nowrap text-right">
                        Total Amount (THB)
                      </th>
                      <th className="p-3.5 text-[12px] font-bold text-[#041b3c] whitespace-nowrap">
                        Bank Name
                      </th>
                      <th className="p-3.5 text-[12px] font-bold text-[#041b3c] whitespace-nowrap">
                        Account Number
                      </th>
                      <th className="p-3.5 text-[12px] font-bold text-[#041b3c] whitespace-nowrap text-center">
                        Approval Status
                      </th>
                      {showInternId && (
                        <th className="p-3.5 text-[12px] font-bold text-[#041b3c] whitespace-nowrap">
                          Intern ID
                        </th>
                      )}
                      <th className="p-3.5 text-[12px] font-bold text-[#041b3c] whitespace-nowrap text-center">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="text-[13px] divide-y divide-[#c3c6d6]/60">
                    {filteredRecords.length === 0 ? (
                      <tr>
                        <td colSpan={showInternId ? 12 : 11} className="p-12 text-center text-[#585f6a]">
                          <span className="material-symbols-outlined text-[36px] text-[#737685] mb-2 block">
                            search_off
                          </span>
                          <p className="font-semibold text-sm text-[#041b3c]">
                            No payroll records matched your filter criteria.
                          </p>
                          <button
                            onClick={() => {
                              setSelectedDepartment('All Departments');
                              setSelectedStatusFilter('All Statuses');
                              setSearchQuery('');
                            }}
                            className="mt-3 text-xs text-[#003d9b] font-bold underline"
                          >
                            Clear all filters
                          </button>
                        </td>
                      </tr>
                    ) : (
                      filteredRecords.map((row, idx) => {
                        const isEven = idx % 2 === 1;
                        const isApproved = row.status === 'Approved';
                        const internUser = allUsers.find((u) => u.id === row.internId);
                        const isArchived = Boolean(internUser?.isArchived || internUser?.status === 'archived');
                        const initials = row.name
                          .split(' ')
                          .map((w) => w[0])
                          .join('')
                          .toUpperCase();

                        return (
                          <tr
                            key={row.id}
                            className={`transition-colors hover:bg-[#d7e2ff]/35 ${
                              isEven ? 'bg-[#fafafa]' : 'bg-white'
                            }`}
                          >
                            {/* Name */}
                            <td className="p-3.5 whitespace-nowrap">
                              <div className="flex items-center gap-2.5">
                                <div
                                  className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs ${
                                    isArchived ? 'bg-[#64748b] text-white' : 'bg-[#003d9b] text-white'
                                  }`}
                                >
                                  {initials}
                                </div>
                                <div>
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-bold text-[#041b3c] block leading-tight">
                                      {row.name}
                                    </span>
                                    {isArchived && (
                                      <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-[#fee2e2] text-[#991b1b] border border-[#fca5a5]">
                                        Inactive
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-[11px] text-[#585f6a]">
                                    {row.supervisorName ? `Supv: ${row.supervisorName}` : 'Intern'}
                                  </span>
                                </div>
                              </div>
                            </td>

                            {/* Department */}
                            <td className="p-3.5 whitespace-nowrap">
                              <span className="inline-block px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-[#e8edff] text-[#003d9b] border border-[#003d9b]/20">
                                {row.department}
                              </span>
                            </td>

                            {/* Team */}
                            <td className="p-3.5 text-[#434654] whitespace-nowrap font-medium">
                              {row.team}
                            </td>

                            {/* Internship Period */}
                            <td className="p-3.5 text-[#585f6a] whitespace-nowrap text-xs">
                              {row.internshipPeriod}
                            </td>

                            {/* Daily Rate (400 THB) */}
                            <td className="p-3.5 text-[#041b3c] text-right whitespace-nowrap font-bold">
                              400 THB
                            </td>

                            {/* Days Worked (Calculated from attendance check-in logs) */}
                            <td className="p-3.5 text-right whitespace-nowrap">
                              <button
                                onClick={() => handleOpenTimecard(row)}
                                className="inline-flex items-center gap-1 font-bold text-[#003d9b] hover:text-[#0052cc] bg-[#f1f3ff] hover:bg-[#dae0ee] px-2.5 py-1 rounded-md transition-colors cursor-pointer"
                                title="Click to view full days worked check-in logs"
                              >
                                <span>{row.daysWorked} Days</span>
                                <span className="material-symbols-outlined text-[14px]">
                                  visibility
                                </span>
                              </button>
                            </td>

                            {/* Total Amount (THB) */}
                            <td className="p-3.5 font-black text-[#041b3c] text-right whitespace-nowrap text-[14px]">
                              {row.totalAmountTHB.toLocaleString()} THB
                            </td>

                            {/* Bank Name */}
                            <td className="p-3.5 text-[#041b3c] whitespace-nowrap font-medium">
                              <div className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-[#0052cc]" />
                                <span>{row.bankName}</span>
                              </div>
                            </td>

                            {/* Account Number */}
                            <td className="p-3.5 font-mono text-[#434654] whitespace-nowrap text-xs font-semibold">
                              {row.accountNumber}
                            </td>

                            {/* Approval Status */}
                            <td className="p-3.5 text-center whitespace-nowrap">
                              <button
                                onClick={() => handleStatusToggle(row)}
                                className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold border cursor-pointer transition-transform active:scale-95 shadow-2xs ${
                                  isApproved
                                    ? 'bg-[#e6f4ea] text-[#1e8e3e] border-[#1e8e3e]/30 hover:bg-[#d4edd9]'
                                    : 'bg-[#fff8e1] text-[#b45309] border-[#ffe082] hover:bg-[#ffecb3]'
                                }`}
                                title="Click to toggle Approval Status"
                              >
                                <span className="material-symbols-outlined text-[14px]">
                                  {isApproved ? 'check_circle' : 'pending'}
                                </span>
                                <span>{row.status}</span>
                              </button>
                            </td>

                            {/* Intern ID (Optional last data column) */}
                            {showInternId && (
                              <td className="p-3.5 whitespace-nowrap">
                                <span className="font-mono text-[11px] font-semibold text-[#003d9b] bg-[#e8edff] px-2 py-0.5 rounded border border-[#003d9b]/20">
                                  {row.internId}
                                </span>
                              </td>
                            )}

                            {/* Actions */}
                            <td className="p-3.5 text-center whitespace-nowrap">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  onClick={() => handleOpenTimecard(row)}
                                  className="text-[#003d9b] hover:text-[#0052cc] p-1.5 rounded-lg hover:bg-[#dae0ee] transition-colors cursor-pointer"
                                  title="View Timecard Details"
                                >
                                  <span className="material-symbols-outlined text-[18px]">
                                    receipt_long
                                  </span>
                                </button>
                                <button
                                  onClick={() => setEditingRecord(row)}
                                  className="text-[#585f6a] hover:text-[#003d9b] p-1.5 rounded-lg hover:bg-[#dae0ee] transition-colors cursor-pointer"
                                  title="Edit Record"
                                >
                                  <span className="material-symbols-outlined text-[18px]">
                                    edit
                                  </span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                  {/* Table Footer with Summary Row */}
                  {filteredRecords.length > 0 && (
                    <tfoot>
                      <tr className="bg-[#dae0ee] border-t-2 border-[#003d9b]/40 font-bold text-[#041b3c]">
                        <td colSpan={4} className="p-3.5 text-left text-xs uppercase tracking-wider">
                          Summary Totals ({filteredRecords.length} Interns)
                        </td>
                        <td className="p-3.5 text-right text-xs">
                          Rate: 400 THB
                        </td>
                        <td className="p-3.5 text-right font-black text-[#1e8e3e]">
                          {totalDaysWorked} Days
                        </td>
                        <td className="p-3.5 text-right font-black text-[#003d9b] text-[15px]">
                          {totalPayrollTHB.toLocaleString()} THB
                        </td>
                        <td colSpan={4} className="p-3.5 text-xs text-[#585f6a]">
                          {approvedCount} of {filteredRecords.length} Approved for Direct Deposit
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* 1. Modal: Submit Month-End Payroll Confirmation */}
      {showSubmitPayrollModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-[#c3c6d6] animate-fade-in">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-[#003d9b] text-white flex items-center justify-center shadow-xs">
                  <span className="material-symbols-outlined text-[24px]">
                    account_balance
                  </span>
                </div>
                <div>
                  <h3 className="text-[18px] font-black text-[#041b3c] tracking-tight">
                    Submit Month-End Payroll
                  </h3>
                  <p className="text-xs text-[#585f6a]">
                    Month Period: <strong>{selectedMonth}</strong>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowSubmitPayrollModal(false)}
                className="text-[#737685] hover:text-[#041b3c] cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="bg-[#f1f3ff] rounded-xl p-4 border border-[#c3c6d6] space-y-2.5 my-4">
              <div className="flex justify-between items-center text-xs">
                <span className="text-[#585f6a]">Total Active Interns:</span>
                <span className="font-bold text-[#041b3c]">{filteredRecords.length} Interns</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-[#585f6a]">Total Days Worked Logged:</span>
                <span className="font-bold text-[#1e8e3e]">{totalDaysWorked} Days</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-[#585f6a]">Daily Rate Applied:</span>
                <span className="font-bold text-[#041b3c]">400 THB / Day</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-[#585f6a]">Approval Status:</span>
                <span className="font-bold text-[#1e8e3e]">
                  {approvedCount === filteredRecords.length ? '100% Approved by Supervisors' : `${approvedCount} of ${filteredRecords.length} Approved`}
                </span>
              </div>
              <div className="pt-2 border-t border-[#c3c6d6] flex justify-between items-center">
                <span className="text-xs font-bold text-[#041b3c]">Gross Disbursal Payout:</span>
                <span className="text-[20px] font-black text-[#003d9b]">
                  {totalPayrollTHB.toLocaleString()} THB
                </span>
              </div>
            </div>

            <div className="p-3 bg-[#e8edff] rounded-lg text-xs text-[#003d9b] flex items-start gap-2 mb-4">
              <span className="material-symbols-outlined text-[18px] shrink-0 mt-0.5">
                info
              </span>
              <span>
                Submitting this batch generates bank transfer remittance manifests for Kasikorn, SCB, Bangkok Bank, Krungthai, and TMBThanachart.
              </span>
            </div>

            <div className="flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowSubmitPayrollModal(false)}
                className="px-4 py-2 border border-[#c3c6d6] rounded-lg text-xs font-semibold text-[#585f6a] hover:bg-[#f1f3ff] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmSubmitPayroll}
                className="px-5 py-2 bg-[#003d9b] hover:bg-[#0052cc] text-white rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-sm flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[16px]">check_circle</span>
                <span>Confirm & Disburse Payroll</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Modal: Timecard Breakdown Drilldown */}
      {timecardModalIntern && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-[#c3c6d6] max-h-[85vh] flex flex-col animate-fade-in">
            <div className="flex justify-between items-start mb-4 border-b border-[#c3c6d6]/60 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#003d9b] text-white flex items-center justify-center font-bold text-sm">
                  {timecardModalIntern.intern.initials || 'IN'}
                </div>
                <div>
                  <h3 className="text-[17px] font-bold text-[#041b3c]">
                    {timecardModalIntern.intern.name} — Timecard Audit
                  </h3>
                  <p className="text-xs text-[#585f6a]">
                    {timecardModalIntern.intern.department} • {timecardModalIntern.intern.team} • ID: <span className="font-mono text-[#003d9b] font-semibold">{timecardModalIntern.intern.id}</span> • {selectedMonth}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setTimecardModalIntern(null)}
                className="text-[#737685] hover:text-[#041b3c] cursor-pointer"
              >
                <span className="material-symbols-outlined text-[22px]">close</span>
              </button>
            </div>

            {/* Timecard Calculation Summary Card */}
            <div className="grid grid-cols-3 gap-3 p-3.5 bg-[#f1f3ff] rounded-xl border border-[#c3c6d6] mb-4 text-center shrink-0">
              <div>
                <span className="text-[11px] text-[#585f6a] block font-semibold uppercase">
                  Days Worked
                </span>
                <span className="text-[18px] font-bold text-[#003d9b]">
                  {timecardModalIntern.record.daysWorked} Days
                </span>
              </div>
              <div>
                <span className="text-[11px] text-[#585f6a] block font-semibold uppercase">
                  Daily Stipend
                </span>
                <span className="text-[18px] font-bold text-[#041b3c]">
                  400 THB
                </span>
              </div>
              <div>
                <span className="text-[11px] text-[#585f6a] block font-semibold uppercase">
                  Total Month Payout
                </span>
                <span className="text-[18px] font-black text-[#1e8e3e]">
                  {timecardModalIntern.record.totalAmountTHB.toLocaleString()} THB
                </span>
              </div>
            </div>

            {/* Log Records Table */}
            <div className="flex-1 overflow-y-auto border border-[#c3c6d6] rounded-lg">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#dae0ee] sticky top-0 border-b border-[#c3c6d6]">
                  <tr>
                    <th className="p-2.5 font-bold text-[#041b3c]">Date</th>
                    <th className="p-2.5 font-bold text-[#041b3c]">Day</th>
                    <th className="p-2.5 font-bold text-[#041b3c]">Check-in</th>
                    <th className="p-2.5 font-bold text-[#041b3c]">Check-out</th>
                    <th className="p-2.5 font-bold text-[#041b3c]">Duration</th>
                    <th className="p-2.5 font-bold text-[#041b3c]">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#c3c6d6]/60">
                  {timecardModalIntern.logs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-[#585f6a]">
                        No individual punch logs recorded for this month.
                      </td>
                    </tr>
                  ) : (
                    timecardModalIntern.logs.map((log) => (
                      <tr key={log.id} className="hover:bg-[#f1f3ff]/60">
                        <td className="p-2.5 font-bold text-[#041b3c]">
                          {log.monthName} {log.date}, 2026
                        </td>
                        <td className="p-2.5 text-[#585f6a]">{log.dayOfWeek}</td>
                        <td className="p-2.5 font-semibold text-[#041b3c]">
                          {log.checkInTime}
                        </td>
                        <td className="p-2.5 text-[#585f6a]">
                          {log.checkOutTime || 'Active'}
                        </td>
                        <td className="p-2.5 font-semibold text-[#003d9b]">
                          {log.totalDuration}
                        </td>
                        <td className="p-2.5 text-[#434654]">
                          {getMergedRecordNotes(log) || '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="pt-4 flex justify-between items-center mt-2 border-t border-[#c3c6d6]/60">
              <span className="text-xs text-[#585f6a]">
                Bank: <strong>{timecardModalIntern.intern.bankName}</strong> ({timecardModalIntern.intern.accountNumber})
              </span>
              <button
                type="button"
                onClick={() => setTimecardModalIntern(null)}
                className="px-4 py-2 bg-[#003d9b] text-white rounded-lg text-xs font-bold hover:bg-[#0052cc] cursor-pointer"
              >
                Close Audit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Modal: Export Options */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[#c3c6d6] animate-fade-in">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-[18px] font-bold text-[#041b3c] flex items-center gap-2">
                <span className="material-symbols-outlined text-[#003d9b]">
                  download_for_offline
                </span>
                <span>Export Payroll Data</span>
              </h3>
              <button
                onClick={() => setShowExportModal(false)}
                className="text-[#737685] hover:text-[#041b3c] cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <p className="text-xs text-[#585f6a] mb-4">
              Export format for <strong>{selectedMonth}</strong> containing{' '}
              <strong>{filteredRecords.length}</strong> verified intern records.
            </p>

            <div className="space-y-2.5">
              {/* Standard CSV */}
              <button
                onClick={handleExportCSV}
                className="w-full flex items-center justify-between p-3.5 border border-[#c3c6d6] rounded-xl hover:border-[#003d9b] hover:bg-[#f1f3ff] transition-all text-left group cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-[#e6f4ea] text-[#1e8e3e] flex items-center justify-center">
                    <span className="material-symbols-outlined text-[22px]">
                      description
                    </span>
                  </div>
                  <div>
                    <p className="font-bold text-xs text-[#041b3c]">
                      Standard Payroll CSV (.csv)
                    </p>
                    <p className="text-[11px] text-[#585f6a]">
                      Includes Name, Dept, Period, Rate (400), Days Worked, Total THB, Bank, Status, and Intern ID
                    </p>
                  </div>
                </div>
                <span className="material-symbols-outlined text-[#737685] group-hover:text-[#003d9b]">
                  arrow_forward
                </span>
              </button>

              {/* Bank Direct Transfer CSV */}
              <button
                onClick={handleExportBankTransferFile}
                className="w-full flex items-center justify-between p-3.5 border border-[#c3c6d6] rounded-xl hover:border-[#003d9b] hover:bg-[#f1f3ff] transition-all text-left group cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-[#e8edff] text-[#003d9b] flex items-center justify-center">
                    <span className="material-symbols-outlined text-[22px]">
                      account_balance
                    </span>
                  </div>
                  <div>
                    <p className="font-bold text-xs text-[#041b3c]">
                      Bank Direct Transfer Batch CSV
                    </p>
                    <p className="text-[11px] text-[#585f6a]">
                      Formatted for Kasikorn / SCB corporate online direct deposit
                    </p>
                  </div>
                </div>
                <span className="material-symbols-outlined text-[#737685] group-hover:text-[#003d9b]">
                  arrow_forward
                </span>
              </button>

              {/* Print Summary Sheet */}
              <button
                onClick={handleOpenPrintReport}
                className="w-full flex items-center justify-between p-3.5 border border-[#c3c6d6] rounded-xl hover:border-[#003d9b] hover:bg-[#f1f3ff] transition-all text-left group cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-[#dae0ee] text-[#041b3c] flex items-center justify-center">
                    <span className="material-symbols-outlined text-[22px]">
                      print
                    </span>
                  </div>
                  <div>
                    <p className="font-bold text-xs text-[#041b3c]">
                      Print Payroll Report (A4 Landscape Form)
                    </p>
                    <p className="text-[11px] text-[#585f6a]">
                      Standard Thai company format with signature authorization blocks
                    </p>
                  </div>
                </div>
                <span className="material-symbols-outlined text-[#737685] group-hover:text-[#003d9b]">
                  arrow_forward
                </span>
              </button>
            </div>

            <button
              onClick={() => setShowExportModal(false)}
              className="w-full mt-4 py-2 border border-[#c3c6d6] rounded-lg text-xs font-semibold text-[#585f6a] hover:bg-[#f1f3ff] cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* 4. Modal: Add New Intern Record */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-[#c3c6d6] animate-fade-in">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-[18px] font-bold text-[#041b3c] flex items-center gap-2">
                <span className="material-symbols-outlined text-[#003d9b]">
                  person_add
                </span>
                <span>Add Intern to Payroll</span>
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-[#737685] hover:text-[#041b3c] cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveNewRecord} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-[#041b3c] block mb-1">
                  Intern Full Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Worraphat Thanawat"
                  value={newInternName}
                  onChange={(e) => setNewInternName(e.target.value)}
                  className="w-full p-2.5 border border-[#c3c6d6] rounded-lg text-xs bg-[#f9f9ff] text-[#041b3c] outline-none focus:border-[#003d9b]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-[#041b3c] block mb-1">
                    Department
                  </label>
                  <select
                    value={newDepartment}
                    onChange={(e) => setNewDepartment(e.target.value)}
                    className="w-full p-2.5 border border-[#c3c6d6] rounded-lg text-xs bg-[#f9f9ff] text-[#041b3c] outline-none"
                  >
                    <option>Engineering</option>
                    <option>Marketing</option>
                    <option>Human Resources</option>
                    <option>Finance</option>
                    <option>Product Design</option>
                    <option>Operations</option>
                    <option>Data Science</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-[#041b3c] block mb-1">
                    Team
                  </label>
                  <input
                    type="text"
                    value={newTeam}
                    onChange={(e) => setNewTeam(e.target.value)}
                    className="w-full p-2.5 border border-[#c3c6d6] rounded-lg text-xs bg-[#f9f9ff] text-[#041b3c] outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-[#041b3c] block mb-1">
                    Daily Rate (THB)
                  </label>
                  <input
                    type="number"
                    value={newDailyRate}
                    onChange={(e) => setNewDailyRate(Number(e.target.value))}
                    className="w-full p-2.5 border border-[#c3c6d6] rounded-lg text-xs bg-[#f9f9ff] text-[#041b3c] outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-[#041b3c] block mb-1">
                    Days Worked
                  </label>
                  <input
                    type="number"
                    value={newDaysWorked}
                    onChange={(e) => setNewDaysWorked(Number(e.target.value))}
                    className="w-full p-2.5 border border-[#c3c6d6] rounded-lg text-xs bg-[#f9f9ff] text-[#041b3c] outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-[#041b3c] block mb-1">
                    Bank Name
                  </label>
                  <select
                    value={newBankName}
                    onChange={(e) => setNewBankName(e.target.value)}
                    className="w-full p-2.5 border border-[#c3c6d6] rounded-lg text-xs bg-[#f9f9ff] text-[#041b3c] outline-none"
                  >
                    <option>Kasikorn Bank (KBANK)</option>
                    <option>Siam Commercial Bank (SCB)</option>
                    <option>Bangkok Bank (BBL)</option>
                    <option>Krungthai Bank (KTB)</option>
                    <option>TMBThanachart (TTB)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-[#041b3c] block mb-1">
                    Account Number
                  </label>
                  <input
                    type="text"
                    placeholder="123-4-56789-0"
                    value={newAccountNumber}
                    onChange={(e) => setNewAccountNumber(e.target.value)}
                    className="w-full p-2.5 border border-[#c3c6d6] rounded-lg text-xs bg-[#f9f9ff] text-[#041b3c] outline-none"
                  />
                </div>
              </div>

              <div className="p-3 bg-[#e8edff] rounded-xl flex justify-between items-center">
                <span className="text-xs text-[#585f6a]">Calculated Total Amount:</span>
                <span className="text-[18px] font-black text-[#003d9b]">
                  {(newDailyRate * newDaysWorked).toLocaleString()} THB
                </span>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-[#c3c6d6] rounded-lg text-xs font-semibold text-[#585f6a] hover:bg-[#f1f3ff] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#003d9b] hover:bg-[#0052cc] text-white rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-xs"
                >
                  Add Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Modal: Edit Record */}
      {editingRecord && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[#c3c6d6] animate-fade-in">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-[18px] font-bold text-[#041b3c] flex items-center gap-2">
                <span className="material-symbols-outlined text-[#003d9b]">edit_note</span>
                <span>Edit Payroll Entry: {editingRecord.name}</span>
              </h3>
              <button
                onClick={() => setEditingRecord(null)}
                className="text-[#737685] hover:text-[#041b3c] cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-[#041b3c] block mb-1">
                  Days Worked
                </label>
                <input
                  type="number"
                  value={editingRecord.daysWorked}
                  onChange={(e) =>
                    setEditingRecord({
                      ...editingRecord,
                      daysWorked: Number(e.target.value),
                      totalAmountTHB: Number(e.target.value) * editingRecord.dailyRateTHB,
                    })
                  }
                  className="w-full p-2.5 border border-[#c3c6d6] rounded-lg text-xs bg-[#f9f9ff] text-[#041b3c] outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#041b3c] block mb-1">
                  Daily Rate (THB)
                </label>
                <input
                  type="number"
                  value={editingRecord.dailyRateTHB}
                  onChange={(e) =>
                    setEditingRecord({
                      ...editingRecord,
                      dailyRateTHB: Number(e.target.value),
                      totalAmountTHB: editingRecord.daysWorked * Number(e.target.value),
                    })
                  }
                  className="w-full p-2.5 border border-[#c3c6d6] rounded-lg text-xs bg-[#f9f9ff] text-[#041b3c] outline-none"
                />
              </div>

              <div className="p-3 bg-[#e8edff] rounded-xl flex justify-between items-center">
                <span className="text-xs text-[#585f6a]">Recalculated Amount:</span>
                <span className="text-[18px] font-black text-[#003d9b]">
                  {editingRecord.totalAmountTHB.toLocaleString()} THB
                </span>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingRecord(null)}
                  className="px-4 py-2 border border-[#c3c6d6] rounded-lg text-xs font-semibold text-[#585f6a] hover:bg-[#f1f3ff] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onUpdateRecord?.(editingRecord);
                    setEditingRecord(null);
                    setToastMessage(`Saved changes for ${editingRecord.name}.`);
                    setTimeout(() => setToastMessage(null), 2500);
                  }}
                  className="px-4 py-2 bg-[#003d9b] hover:bg-[#0052cc] text-white rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-xs"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>

      {/* Standalone Print-Only Container (Active for browser print / Save as PDF) */}
      <div className="hidden print:block payroll-print-container p-0 m-0">
        <PrintablePayrollReport
          records={filteredRecords}
          selectedMonth={selectedMonth}
          selectedDepartment={selectedDepartment}
          totalDaysWorked={totalDaysWorked}
          totalPayrollTHB={totalPayrollTHB}
        />
      </div>

      {/* Modal: Print Payroll Report Preview */}
      {showPrintReportModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex flex-col p-2 sm:p-4 md:p-6 overflow-y-auto print:hidden">
          {/* Top Control Bar in Modal */}
          <div className="max-w-[1150px] w-full mx-auto bg-[#041b3c] text-white px-5 py-3.5 rounded-t-xl flex items-center justify-between shadow-lg shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#0052cc] flex items-center justify-center text-white">
                <span className="material-symbols-outlined text-[19px]">print</span>
              </div>
              <div>
                <h3 className="text-[14px] font-bold tracking-tight text-white flex items-center gap-2">
                  <span>Print Payroll Report</span>
                  <span className="text-[10px] bg-[#22c55e] text-black font-extrabold px-2 py-0.5 rounded uppercase tracking-wider">
                    A4 Landscape
                  </span>
                </h3>
                <p className="text-[11px] text-[#b2c5ff]">
                  Payroll Internship - {selectedMonth} ({filteredRecords.length} Interns)
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowPrintReportModal(false)}
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-[#b2c5ff] hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                Close Preview
              </button>
              <button
                onClick={() => window.print()}
                className="bg-[#22c55e] hover:bg-[#16a34a] text-black font-bold text-xs px-4 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm"
              >
                <span className="material-symbols-outlined text-[17px]">print</span>
                <span>Print / Save as PDF</span>
              </button>
            </div>
          </div>

          {/* Paper Sheet Preview Area */}
          <div className="max-w-[1150px] w-full mx-auto bg-slate-200/90 p-4 sm:p-8 rounded-b-xl shadow-2xl overflow-x-auto flex justify-center border-t border-[#1d3052]">
            <div className="bg-white text-black shadow-xl border border-slate-300 w-full min-w-[960px] max-w-[1080px] p-8 md:p-10 rounded-xs">
              <PrintablePayrollReport
                records={filteredRecords}
                selectedMonth={selectedMonth}
                selectedDepartment={selectedDepartment}
                totalDaysWorked={totalDaysWorked}
                totalPayrollTHB={totalPayrollTHB}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
};
