import React, { useState, useMemo } from 'react';
import { UserProfile, ScreenView, AttendanceRecord } from '../types';
import { ASSET_IMAGES } from '../data/mockData';
import {
  createStaffAccount,
  archiveIntern,
  reactivateIntern,
  deleteInternPermanently,
} from '../services/dbService';
import { InternAttendanceFormModal } from './InternAttendanceFormModal';

interface InternsManagementScreenProps {
  user: UserProfile;
  allUsers: UserProfile[];
  attendanceRecords?: AttendanceRecord[];
  onAssignSupervisor: (internId: string, supervisorId: string | null, supervisorName: string | null) => Promise<void>;
  onLogout: () => void;
  onSwitchScreen: (screen: ScreenView) => void;
}

export const InternsManagementScreen: React.FC<InternsManagementScreenProps> = ({
  user,
  allUsers,
  attendanceRecords = [],
  onAssignSupervisor,
  onLogout,
  onSwitchScreen,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'active' | 'unassigned' | 'assigned' | 'archived' | 'all'>('active');
  const [showArchived, setShowArchived] = useState<boolean>(false);
  const [supervisorFilter, setSupervisorFilter] = useState<string>('all');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [savingInternId, setSavingInternId] = useState<string | null>(null);

  // Archive Modal State
  const [archiveModalIntern, setArchiveModalIntern] = useState<UserProfile | null>(null);
  const [archiveReason, setArchiveReason] = useState<string>('Internship Period Completed');
  const [archiveCustomReason, setArchiveCustomReason] = useState<string>('');
  const [isArchiving, setIsArchiving] = useState<boolean>(false);

  // Delete Permanently Modal State
  const [deleteModalIntern, setDeleteModalIntern] = useState<UserProfile | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Per-Intern Attendance Form Print Modal State
  const [isPrintAttendanceModalOpen, setIsPrintAttendanceModalOpen] = useState<boolean>(false);
  const [printSelectedInternId, setPrintSelectedInternId] = useState<string>('');

  // Use only real Firestore attendance records
  const effectiveAttendance = attendanceRecords;

  // Add Supervisor Modal State
  const [isAddSupervisorOpen, setIsAddSupervisorOpen] = useState<boolean>(false);
  const [newSupName, setNewSupName] = useState<string>('');
  const [newSupEmail, setNewSupEmail] = useState<string>('');
  const [newSupDept, setNewSupDept] = useState<string>('Human Resources / Payroll');
  const [newSupTeam, setNewSupTeam] = useState<string>('Payroll Management');
  const [isCreatingSup, setIsCreatingSup] = useState<boolean>(false);
  const [supFormError, setSupFormError] = useState<string | null>(null);

  // Separate interns into active, archived, and total
  const allInterns = useMemo(() => {
    return allUsers.filter((u) => u.role === 'intern');
  }, [allUsers]);

  const activeInterns = useMemo(() => {
    return allInterns.filter((u) => !u.isArchived && u.status !== 'archived');
  }, [allInterns]);

  const archivedInterns = useMemo(() => {
    return allInterns.filter((u) => u.isArchived || u.status === 'archived');
  }, [allInterns]);

  const interns = allInterns;

  const supervisors = useMemo(() => {
    return allUsers.filter((u) => u.role === 'supervisor' || u.role === 'payroll_admin');
  }, [allUsers]);

  // Toast notification
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // Add Payroll Admin Handlers
  const handleOpenAddSupervisor = () => {
    setNewSupName('');
    setNewSupEmail('');
    setNewSupDept('Human Resources / Payroll');
    setNewSupTeam('Payroll Management');
    setSupFormError(null);
    setIsAddSupervisorOpen(true);
  };

  const handleCloseAddSupervisor = () => {
    setIsAddSupervisorOpen(false);
    setSupFormError(null);
  };

  const handleCreateSupervisor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSupName.trim()) {
      setSupFormError('Please enter the full name.');
      return;
    }
    if (!newSupEmail.trim() || !newSupEmail.includes('@')) {
      setSupFormError('Please enter a valid email address.');
      return;
    }

    try {
      setIsCreatingSup(true);
      setSupFormError(null);
      const created = await createStaffAccount({
        name: newSupName.trim(),
        email: newSupEmail.trim(),
        role: 'payroll_admin',
        department: newSupDept.trim(),
        team: newSupTeam.trim(),
      });
      showToast(`Payroll Admin "${created.name}" (${created.email}) provisioned successfully.`);
      handleCloseAddSupervisor();
    } catch (err: any) {
      console.error('Failed to provision admin account:', err);
      setSupFormError(err.message || 'Failed to provision admin account. Please try again.');
    } finally {
      setIsCreatingSup(false);
    }
  };

  // Filtered interns
  const filteredInterns = useMemo(() => {
    return allInterns.filter((intern) => {
      const isArchived = Boolean(intern.isArchived || intern.status === 'archived');

      // Status filter
      if (statusFilter === 'active') {
        if (isArchived && !showArchived) return false;
      } else if (statusFilter === 'archived') {
        if (!isArchived) return false;
      } else if (statusFilter === 'unassigned') {
        if (isArchived && !showArchived) return false;
        if (intern.supervisorId) return false;
      } else if (statusFilter === 'assigned') {
        if (isArchived && !showArchived) return false;
        if (!intern.supervisorId) return false;
      } else if (statusFilter === 'all') {
        if (isArchived && !showArchived) return false;
      }

      // Search matching
      const q = searchQuery.toLowerCase().trim();
      if (q) {
        const matchesSearch =
          intern.name.toLowerCase().includes(q) ||
          intern.email.toLowerCase().includes(q) ||
          intern.department.toLowerCase().includes(q) ||
          (intern.team && intern.team.toLowerCase().includes(q));
        if (!matchesSearch) return false;
      }

      // Supervisor filter
      if (supervisorFilter !== 'all') {
        const isAssigned = Boolean(intern.supervisorId);
        if (supervisorFilter === 'unassigned') {
          if (isAssigned) return false;
        } else if (intern.supervisorId !== supervisorFilter) {
          return false;
        }
      }

      return true;
    });
  }, [allInterns, searchQuery, statusFilter, supervisorFilter, showArchived]);

  // Counts (Active vs Inactive separation)
  const totalActiveCount = activeInterns.length;
  const unassignedCount = activeInterns.filter((i) => !i.supervisorId).length;
  const assignedCount = totalActiveCount - unassignedCount;
  const archivedCount = archivedInterns.length;
  const totalInternsCount = allInterns.length;

  // Handle Archive Intern
  const handleOpenArchiveModal = (intern: UserProfile) => {
    setArchiveModalIntern(intern);
    setArchiveReason('Internship Period Completed');
    setArchiveCustomReason('');
  };

  const handleConfirmArchive = async () => {
    if (!archiveModalIntern) return;
    try {
      setIsArchiving(true);
      const finalReason =
        archiveReason === 'Other' && archiveCustomReason.trim()
          ? archiveCustomReason.trim()
          : archiveReason;
      await archiveIntern(archiveModalIntern.id, finalReason);
      showToast(`Intern "${archiveModalIntern.name}" marked as Inactive / Archived.`);
      setArchiveModalIntern(null);
    } catch (err) {
      console.error('Failed to archive intern:', err);
      showToast('Error archiving intern. Please try again.');
    } finally {
      setIsArchiving(false);
    }
  };

  // Handle Reactivate Intern
  const handleReactivate = async (intern: UserProfile) => {
    try {
      setSavingInternId(intern.id);
      await reactivateIntern(intern.id);
      showToast(`Intern "${intern.name}" restored to Active roster.`);
    } catch (err) {
      console.error('Failed to reactivate intern:', err);
      showToast('Error reactivating intern. Please try again.');
    } finally {
      setSavingInternId(null);
    }
  };

  // Handle Permanently Delete Intern
  const handleOpenDeleteModal = (intern: UserProfile) => {
    setDeleteModalIntern(intern);
  };

  const handleConfirmDeletePermanently = async () => {
    if (!deleteModalIntern) return;
    try {
      setIsDeleting(true);
      const res = await deleteInternPermanently(deleteModalIntern.id);
      showToast(
        `Intern "${deleteModalIntern.name}" permanently deleted (${res.deletedAttendance} attendance records purged).`
      );
      setDeleteModalIntern(null);
    } catch (err) {
      console.error('Failed to permanently delete intern:', err);
      showToast('Error deleting intern permanently.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Handle Supervisor Change
  const handleSupervisorChange = async (internId: string, selectedSupervisorId: string) => {
    try {
      setSavingInternId(internId);
      if (!selectedSupervisorId || selectedSupervisorId === 'unassigned') {
        await onAssignSupervisor(internId, null, null);
        showToast('Intern marked as Unassigned.');
      } else {
        const foundSupervisor = supervisors.find((s) => s.id === selectedSupervisorId);
        const supervisorName = foundSupervisor ? foundSupervisor.name : 'Assigned Supervisor';
        await onAssignSupervisor(internId, selectedSupervisorId, supervisorName);
        showToast(`Assigned to supervisor ${supervisorName}.`);
      }
    } catch (error) {
      console.error('Failed to update supervisor:', error);
      showToast('Error updating supervisor assignment. Please try again.');
    } finally {
      setSavingInternId(null);
    }
  };

  return (
    <div className="bg-[#F4F5F7] text-[#041b3c] min-h-screen flex flex-col font-sans antialiased text-[14px]">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-16 right-6 z-50 bg-[#041b3c] text-white px-5 py-3 rounded-lg shadow-xl flex items-center gap-3 font-medium text-xs border border-[#c3c6d6] animate-bounce">
          <span className="material-symbols-outlined text-[#10B981] text-[18px]">verified</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header */}
      <header className="bg-white w-full border-b border-[#c3c6d6] sticky top-0 z-20 shadow-xs">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 font-bold text-[#003d9b] text-base">
              <span className="material-symbols-outlined text-[24px]">manage_accounts</span>
              <span>Intern Management Portal</span>
            </div>

            <div className="hidden md:flex items-center gap-2 pl-4 border-l border-[#c3c6d6]">
              <button
                onClick={() => onSwitchScreen('attendance_logs')}
                className="text-xs font-semibold px-3 py-1.5 rounded-md text-[#585f6a] hover:text-[#003d9b] hover:bg-[#f1f3ff] transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">list_alt</span>
                <span>Attendance Log</span>
              </button>
              <button
                onClick={() => onSwitchScreen('payroll_admin')}
                className="text-xs font-semibold px-3 py-1.5 rounded-md text-[#585f6a] hover:text-[#003d9b] hover:bg-[#f1f3ff] transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">payments</span>
                <span>Payroll Export</span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <img
                className="w-8 h-8 rounded-full border border-[#c3c6d6] object-cover"
                src={user.avatarUrl || ASSET_IMAGES.admin}
                alt={user.name}
              />
              <div className="text-right hidden sm:block">
                <p className="text-xs font-bold text-[#041b3c] leading-tight">{user.name}</p>
                <p className="text-[10px] text-[#585f6a] capitalize">{user.role.replace('_', ' ')}</p>
              </div>
            </div>
            <button
              onClick={onLogout}
              className="p-1.5 text-[#585f6a] hover:text-[#ba1a1a] hover:bg-[#f1f3ff] rounded-md transition-colors cursor-pointer"
              title="Sign Out"
            >
              <span className="material-symbols-outlined text-[18px]">logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">
        {/* Page Title & Overview Metrics */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[#041b3c] tracking-tight">
              Intern Directory & Supervisor Assignment
            </h1>
            <p className="text-xs text-[#585f6a] mt-1 max-w-2xl">
              Manage intern profiles and assign supervisors. Supervised interns appear directly in their designated supervisor's approval queue, while unassigned interns remain isolated until configured.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setPrintSelectedInternId(interns[0]?.id || '');
                setIsPrintAttendanceModalOpen(true);
              }}
              className="bg-emerald-700 hover:bg-emerald-800 text-white px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
              title="Print or Save Per-Intern Attendance Form (Pico Format)"
            >
              <span className="material-symbols-outlined text-[16px]">print</span>
              <span>Print Attendance Form</span>
            </button>

            <button
              type="button"
              onClick={handleOpenAddSupervisor}
              className="bg-white border border-[#003d9b] text-[#003d9b] hover:bg-[#f1f3ff] px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
              title="Securely provision Supervisor or Payroll Admin accounts"
            >
              <span className="material-symbols-outlined text-[16px]">admin_panel_settings</span>
              <span>Provision Staff / Admin</span>
            </button>

            <button
              onClick={() => onSwitchScreen('payroll_admin')}
              className="bg-[#003d9b] text-white px-4 py-2 rounded-lg text-xs font-semibold hover:bg-[#0052cc] transition-colors flex items-center gap-2 cursor-pointer shadow-xs"
            >
              <span className="material-symbols-outlined text-[16px]">receipt_long</span>
              <span>Open Payroll View</span>
            </button>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div
            onClick={() => {
              setStatusFilter('active');
            }}
            className={`bg-white border rounded-xl p-4 shadow-xs flex items-center justify-between cursor-pointer transition-all hover:border-[#003d9b] ${
              statusFilter === 'active' ? 'ring-2 ring-[#003d9b]/20 border-[#003d9b]' : 'border-[#c3c6d6]'
            }`}
          >
            <div>
              <p className="text-[11px] font-bold text-[#585f6a] uppercase tracking-wider">Active Interns</p>
              <p className="text-2xl font-black text-[#041b3c] mt-1">{totalActiveCount}</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-[#f1f3ff] text-[#003d9b] flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">groups</span>
            </div>
          </div>

          <div
            onClick={() => {
              setStatusFilter('assigned');
            }}
            className={`bg-white border rounded-xl p-4 shadow-xs flex items-center justify-between cursor-pointer transition-all hover:border-[#10B981] ${
              statusFilter === 'assigned' ? 'ring-2 ring-[#10B981]/20 border-[#10B981]' : 'border-[#c3c6d6]'
            }`}
          >
            <div>
              <p className="text-[11px] font-bold text-[#585f6a] uppercase tracking-wider">Assigned to Supervisor</p>
              <p className="text-2xl font-black text-[#10B981] mt-1">{assignedCount}</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-[#10B981]/15 text-[#10B981] flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">how_to_reg</span>
            </div>
          </div>

          <div
            onClick={() => {
              setStatusFilter('unassigned');
            }}
            className={`bg-white border rounded-xl p-4 shadow-xs flex items-center justify-between cursor-pointer transition-all hover:border-[#f59e0b] ${
              unassignedCount > 0 ? 'border-[#f59e0b] bg-[#fffbeb]/40' : 'border-[#c3c6d6]'
            } ${statusFilter === 'unassigned' ? 'ring-2 ring-[#f59e0b]/30' : ''}`}
          >
            <div>
              <div className="flex items-center gap-1.5">
                <p className="text-[11px] font-bold text-[#b45309] uppercase tracking-wider">Unassigned Interns</p>
                {unassignedCount > 0 && (
                  <span className="bg-[#f59e0b] text-white text-[9px] font-extrabold px-1.5 py-0.2 rounded-full animate-pulse">
                    Action Needed
                  </span>
                )}
              </div>
              <p className={`text-2xl font-black mt-1 ${unassignedCount > 0 ? 'text-[#b45309]' : 'text-[#585f6a]'}`}>
                {unassignedCount}
              </p>
            </div>
            <div className="w-10 h-10 rounded-full bg-[#f59e0b]/20 text-[#b45309] flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">person_off</span>
            </div>
          </div>

          <div
            onClick={() => {
              setStatusFilter('archived');
              setShowArchived(true);
            }}
            className={`bg-white border rounded-xl p-4 shadow-xs flex items-center justify-between cursor-pointer transition-all hover:border-[#64748b] ${
              statusFilter === 'archived' ? 'ring-2 ring-[#64748b]/20 border-[#64748b]' : 'border-[#c3c6d6]'
            }`}
          >
            <div>
              <p className="text-[11px] font-bold text-[#585f6a] uppercase tracking-wider">Archived / Ended</p>
              <p className="text-2xl font-black text-[#64748b] mt-1">{archivedCount}</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-[#f1f5f9] text-[#64748b] flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">archive</span>
            </div>
          </div>
        </div>

        {/* Filter Controls Card */}
        <div className="bg-white border border-[#c3c6d6] rounded-xl p-4 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative w-full md:w-80">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#585f6a] text-[18px]">
              search
            </span>
            <input
              type="text"
              placeholder="Search by name, email, department..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#f9f9ff] border border-[#c3c6d6] rounded-lg pl-9 pr-3 py-2 text-xs text-[#041b3c] focus:border-[#003d9b] focus:ring-1 focus:ring-[#003d9b] outline-none"
            />
          </div>

          {/* Filters */}
          <div className="flex items-center gap-3 w-full md:w-auto flex-wrap">
            {/* Status Filter Pill Group */}
            <div className="flex bg-[#f1f3ff] p-0.5 rounded-lg border border-[#c3c6d6] text-xs">
              <button
                onClick={() => setStatusFilter('active')}
                className={`px-3 py-1.5 rounded-md font-semibold transition-all cursor-pointer ${
                  statusFilter === 'active' ? 'bg-white text-[#003d9b] shadow-xs' : 'text-[#585f6a] hover:text-[#041b3c]'
                }`}
              >
                Active ({totalActiveCount})
              </button>
              <button
                onClick={() => setStatusFilter('unassigned')}
                className={`px-3 py-1.5 rounded-md font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                  statusFilter === 'unassigned' ? 'bg-white text-[#b45309] shadow-xs' : 'text-[#585f6a] hover:text-[#041b3c]'
                }`}
              >
                <span>Unassigned</span>
                {unassignedCount > 0 && (
                  <span className="w-4 h-4 bg-[#f59e0b] text-white rounded-full text-[9px] flex items-center justify-center font-bold">
                    {unassignedCount}
                  </span>
                )}
              </button>
              <button
                onClick={() => setStatusFilter('assigned')}
                className={`px-3 py-1.5 rounded-md font-semibold transition-all cursor-pointer ${
                  statusFilter === 'assigned' ? 'bg-white text-[#10B981] shadow-xs' : 'text-[#585f6a] hover:text-[#041b3c]'
                }`}
              >
                Assigned ({assignedCount})
              </button>
              <button
                onClick={() => {
                  setStatusFilter('archived');
                  setShowArchived(true);
                }}
                className={`px-3 py-1.5 rounded-md font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                  statusFilter === 'archived' ? 'bg-white text-[#64748b] shadow-xs' : 'text-[#585f6a] hover:text-[#041b3c]'
                }`}
              >
                <span className="material-symbols-outlined text-[14px]">archive</span>
                <span>Archived ({archivedCount})</span>
              </button>
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1.5 rounded-md font-semibold transition-all cursor-pointer ${
                  statusFilter === 'all' ? 'bg-white text-[#003d9b] shadow-xs' : 'text-[#585f6a] hover:text-[#041b3c]'
                }`}
              >
                All ({totalInternsCount})
              </button>
            </div>

            {/* Show Archived Checkbox Toggle */}
            <label className="inline-flex items-center gap-1.5 text-xs text-[#585f6a] hover:text-[#041b3c] cursor-pointer select-none bg-[#f1f3ff] px-2.5 py-1.5 rounded-lg border border-[#c3c6d6]">
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(e) => setShowArchived(e.target.checked)}
                className="rounded text-[#003d9b] focus:ring-[#003d9b] cursor-pointer"
              />
              <span>Show Archived</span>
            </label>

            {/* Supervisor Specific Filter */}
            <div className="relative">
              <select
                value={supervisorFilter}
                onChange={(e) => setSupervisorFilter(e.target.value)}
                className="appearance-none bg-white border border-[#c3c6d6] rounded-lg py-2 pl-3 pr-8 text-xs font-semibold text-[#041b3c] focus:border-[#003d9b] outline-none cursor-pointer shadow-xs"
              >
                <option value="all">Filter by Supervisor (All)</option>
                <option value="unassigned">— Unassigned Interns —</option>
                {supervisors.map((s) => (
                  <option key={s.id} value={s.id}>
                    Supervisor: {s.name}
                  </option>
                ))}
              </select>
              <span className="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 text-[#585f6a] pointer-events-none text-[16px]">
                expand_more
              </span>
            </div>
          </div>
        </div>

        {/* Interns Table Card */}
        <div className="bg-white border border-[#c3c6d6] rounded-xl shadow-xs overflow-hidden">
          <div className="px-6 py-4 border-b border-[#c3c6d6] flex items-center justify-between bg-[#fbfbfe]">
            <h2 className="text-sm font-bold text-[#041b3c]">
              Registered Interns ({filteredInterns.length})
            </h2>
            <span className="text-[11px] text-[#585f6a]">
              Select a supervisor from the dropdown to assign or update immediately.
            </span>
          </div>

          {filteredInterns.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-12 h-12 rounded-full bg-[#f1f3ff] text-[#003d9b] mx-auto flex items-center justify-center mb-3">
                <span className="material-symbols-outlined text-[24px]">search_off</span>
              </div>
              <h3 className="text-sm font-bold text-[#041b3c]">No Interns Found</h3>
              <p className="text-xs text-[#585f6a] max-w-sm mx-auto mt-1">
                {searchQuery || statusFilter !== 'all' || supervisorFilter !== 'all'
                  ? 'Try clearing your search query or adjusting your filters to see more results.'
                  : 'No interns have registered on the platform yet. When interns register, they will appear here as Unassigned.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#f1f3ff] border-b border-[#c3c6d6] text-[#434654] font-bold text-[11px] uppercase tracking-wider">
                    <th className="py-3.5 px-6">Intern Name & Email</th>
                    <th className="py-3.5 px-4">Department / Team</th>
                    <th className="py-3.5 px-4">Daily Rate</th>
                    <th className="py-3.5 px-4">Assignment Status</th>
                    <th className="py-3.5 px-6 min-w-[220px]">Assigned Supervisor</th>
                    <th className="py-3.5 px-6 text-right min-w-[260px]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#c3c6d6]/60">
                  {filteredInterns.map((intern) => {
                    const isArchived = Boolean(intern.isArchived || intern.status === 'archived');
                    const isAssigned = Boolean(intern.supervisorId);
                    const isSaving = savingInternId === intern.id;

                    return (
                      <tr
                        key={intern.id}
                        className={`hover:bg-[#f9f9ff] transition-colors ${
                          isArchived
                            ? 'bg-[#f8fafc]/90 opacity-80'
                            : !isAssigned
                            ? 'bg-[#fffbeb]/20'
                            : ''
                        }`}
                      >
                        {/* Intern Info */}
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs shrink-0 shadow-xs border ${
                                isArchived
                                  ? 'bg-[#64748b] text-white border-[#cbd5e1]'
                                  : 'bg-[#003d9b] text-white border-[#c3c6d6]'
                              }`}
                            >
                              {intern.initials || intern.name.slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className={`font-bold ${isArchived ? 'text-[#475569]' : 'text-[#041b3c]'}`}>
                                  {intern.name}
                                </p>
                                {isArchived && (
                                  <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#fee2e2] text-[#991b1b] border border-[#fca5a5]">
                                    <span className="material-symbols-outlined text-[12px]">archive</span>
                                    <span>Inactive</span>
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-[#585f6a]">{intern.email}</p>
                              {isArchived && intern.archivedReason && (
                                <p className="text-[10px] text-[#b45309] font-medium mt-0.5">
                                  Reason: {intern.archivedReason}
                                </p>
                              )}
                              {intern.internshipPeriod && !isArchived && (
                                <p className="text-[10px] text-[#737685] mt-0.5">
                                  Period: {intern.internshipPeriod}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Department / Team */}
                        <td className="py-4 px-4">
                          <div className="space-y-1">
                            <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#e0e8ff] text-[#003d9b]">
                              {intern.department || 'General'}
                            </span>
                            {intern.team && (
                              <p className="text-[11px] text-[#585f6a] pl-0.5 font-medium">
                                {intern.team}
                              </p>
                            )}
                          </div>
                        </td>

                        {/* Daily Rate */}
                        <td className="py-4 px-4 font-mono font-semibold text-[#003d9b]">
                          {intern.dailyRateTHB || 400} THB
                        </td>

                        {/* Status Badge */}
                        <td className="py-4 px-4">
                          {isArchived ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-[#f1f5f9] text-[#64748b] border border-[#cbd5e1]">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#64748b]" />
                              <span>Internship Ended</span>
                            </span>
                          ) : isAssigned ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-[#10B981]/15 text-[#047857] border border-[#10B981]/30">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
                              <span>Assigned</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-[#f59e0b]/20 text-[#b45309] border border-[#f59e0b]/40">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#f59e0b] animate-ping" />
                              <span>⚠️ Unassigned</span>
                            </span>
                          )}
                        </td>

                        {/* Assigned Supervisor Dropdown */}
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-2">
                            <div className="relative flex-1">
                              <select
                                value={intern.supervisorId || 'unassigned'}
                                onChange={(e) => handleSupervisorChange(intern.id, e.target.value)}
                                disabled={isSaving || isArchived}
                                className={`w-full appearance-none border rounded-lg py-2 pl-3 pr-8 text-xs font-semibold focus:outline-none transition-all ${
                                  isArchived
                                    ? 'bg-[#f1f5f9] border-[#cbd5e1] text-[#94a3b8] cursor-not-allowed'
                                    : !isAssigned
                                    ? 'bg-[#fffbeb] border-[#f59e0b] text-[#b45309] focus:border-[#b45309] focus:ring-1 focus:ring-[#b45309] cursor-pointer'
                                    : 'bg-white border-[#c3c6d6] text-[#041b3c] focus:border-[#003d9b] focus:ring-1 focus:ring-[#003d9b] cursor-pointer'
                                } ${isSaving ? 'opacity-50 cursor-wait' : ''}`}
                              >
                                <option value="unassigned">— Unassigned (No Supervisor) —</option>
                                <optgroup label="Available Supervisors">
                                  {supervisors.map((sup) => (
                                    <option key={sup.id} value={sup.id}>
                                      {sup.name} ({sup.email})
                                    </option>
                                  ))}
                                </optgroup>
                              </select>
                              <span className="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 text-[#585f6a] pointer-events-none text-[16px]">
                                {isSaving ? 'sync' : 'arrow_drop_down'}
                              </span>
                            </div>

                            {isAssigned && !isArchived && (
                              <button
                                onClick={() => handleSupervisorChange(intern.id, 'unassigned')}
                                title="Remove Supervisor (Set Unassigned)"
                                className="p-1.5 text-[#737685] hover:text-[#ba1a1a] hover:bg-[#ffdad6]/40 rounded transition-colors cursor-pointer"
                              >
                                <span className="material-symbols-outlined text-[16px]">close</span>
                              </button>
                            )}
                          </div>
                        </td>

                        {/* Actions (Archive / Reactivate + Magic Link + Print Form + Delete Permanently) */}
                        <td className="py-4 px-6 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5 justify-end">
                            {/* Primary Action: Archive or Reactivate */}
                            {!isArchived ? (
                              <button
                                type="button"
                                onClick={() => handleOpenArchiveModal(intern)}
                                title="Archive intern (mark as Inactive / Internship Ended)"
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-[#fff7ed] text-[#c2410c] hover:bg-[#c2410c] hover:text-white border border-[#fed7aa] transition-all shadow-xs cursor-pointer"
                              >
                                <span className="material-symbols-outlined text-[15px]">archive</span>
                                <span>Archive</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleReactivate(intern)}
                                disabled={savingInternId === intern.id}
                                title="Restore intern to Active roster"
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-[#ecfdf5] text-[#047857] hover:bg-[#047857] hover:text-white border border-[#a7f3d0] transition-all shadow-xs cursor-pointer"
                              >
                                <span className="material-symbols-outlined text-[15px]">unarchive</span>
                                <span>Reactivate</span>
                              </button>
                            )}

                            {/* Print Form */}
                            <button
                              type="button"
                              onClick={() => {
                                setPrintSelectedInternId(intern.id);
                                setIsPrintAttendanceModalOpen(true);
                              }}
                              title={`Print Attendance Form for ${intern.name} (Pico Format)`}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-[#10b981]/15 text-[#047857] hover:bg-[#10b981] hover:text-white transition-all shadow-xs cursor-pointer"
                            >
                              <span className="material-symbols-outlined text-[15px]">print</span>
                              <span>Form</span>
                            </button>

                            {/* Delete Permanently (Subtle secondary action) */}
                            <button
                              type="button"
                              onClick={() => handleOpenDeleteModal(intern)}
                              title={`Delete ${intern.name} permanently (for mistakes only)`}
                              className="p-1.5 rounded-lg text-[#9ca3af] hover:text-[#ba1a1a] hover:bg-[#fee2e2]/60 transition-colors cursor-pointer"
                            >
                              <span className="material-symbols-outlined text-[17px]">delete_forever</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Add Lightweight Supervisor Modal */}
      {isAddSupervisorOpen && (
        <div className="fixed inset-0 bg-[#041b3c]/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-[#c3c6d6] overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-5 border-b border-[#c3c6d6] flex items-center justify-between bg-[#fbfbfe]">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#003d9b]/10 text-[#003d9b] flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[20px]">admin_panel_settings</span>
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#041b3c]">Provision Payroll Admin Account</h3>
                  <p className="text-[11px] text-[#585f6a]">
                    Securely provision Payroll Admin accounts with full administrative and payout verification access
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseAddSupervisor}
                className="p-1 text-[#585f6a] hover:text-[#041b3c] hover:bg-[#f1f3ff] rounded-lg transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Modal Form Content */}
            <form onSubmit={handleCreateSupervisor} className="p-5 space-y-4 flex-1 overflow-y-auto">
              {/* Notice Banner */}
              <div className="bg-[#f1f3ff] border border-[#003d9b]/20 rounded-xl p-3.5 flex items-start gap-3">
                <span className="material-symbols-outlined text-[#003d9b] text-[18px] shrink-0 mt-0.5">
                  security
                </span>
                <p className="text-[11px] text-[#041b3c] leading-relaxed">
                  <strong>Controlled Admin Provisioning:</strong> Public registration is strictly restricted to Intern accounts. Only existing Payroll Admins can provision administrative access here. When the user logs in or registers via Firebase Auth with this email, their account will automatically link with the Payroll Admin role.
                </p>
              </div>

              {supFormError && (
                <div className="bg-[#ffdad6]/60 border border-[#ba1a1a]/30 rounded-xl p-3 text-xs text-[#ba1a1a] flex items-center gap-2">
                  <span className="material-symbols-outlined text-[16px] shrink-0">error</span>
                  <span>{supFormError}</span>
                </div>
              )}

              {/* Account Role Confirmation */}
              <div className="p-3 rounded-xl border border-[#003d9b] bg-[#e0e8ff]/60 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] text-[#003d9b]">shield</span>
                  <div>
                    <span className="text-xs font-bold text-[#041b3c] block">Payroll Admin</span>
                    <span className="text-[10px] text-[#585f6a]">Sole administrator with full rights to verify physical paper attendance and approve payouts.</span>
                  </div>
                </div>
                <span className="material-symbols-outlined text-[16px] text-[#003d9b]">check_circle</span>
              </div>

              {/* Full Name */}
              <div>
                <label className="block text-xs font-bold text-[#041b3c] mb-1.5">
                  Full Name <span className="text-[#ba1a1a]">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Enter administrator full name"
                  value={newSupName}
                  onChange={(e) => setNewSupName(e.target.value)}
                  className="w-full bg-[#f9f9ff] border border-[#c3c6d6] rounded-xl px-3.5 py-2.5 text-xs text-[#041b3c] focus:border-[#003d9b] focus:ring-1 focus:ring-[#003d9b] outline-none"
                />
              </div>

              {/* Email Address */}
              <div>
                <label className="block text-xs font-bold text-[#041b3c] mb-1.5">
                  Email Address <span className="text-[#ba1a1a]">*</span>
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g. admin.payroll@company.com"
                  value={newSupEmail}
                  onChange={(e) => setNewSupEmail(e.target.value)}
                  className="w-full bg-[#f9f9ff] border border-[#c3c6d6] rounded-xl px-3.5 py-2.5 text-xs text-[#041b3c] focus:border-[#003d9b] focus:ring-1 focus:ring-[#003d9b] outline-none"
                />
                <p className="text-[10px] text-[#585f6a] mt-1">
                  Used for login linking, notification emails, and administrative alerts.
                </p>
              </div>

              {/* Department & Team */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#041b3c] mb-1.5">
                    Department
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Human Resources / Payroll"
                    value={newSupDept}
                    onChange={(e) => setNewSupDept(e.target.value)}
                    className="w-full bg-[#f9f9ff] border border-[#c3c6d6] rounded-xl px-3.5 py-2.5 text-xs text-[#041b3c] focus:border-[#003d9b] focus:ring-1 focus:ring-[#003d9b] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#041b3c] mb-1.5">
                    Team / Unit
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Payroll Management"
                    value={newSupTeam}
                    onChange={(e) => setNewSupTeam(e.target.value)}
                    className="w-full bg-[#f9f9ff] border border-[#c3c6d6] rounded-xl px-3.5 py-2.5 text-xs text-[#041b3c] focus:border-[#003d9b] focus:ring-1 focus:ring-[#003d9b] outline-none"
                  />
                </div>
              </div>

              {/* Modal Actions */}
              <div className="pt-3 border-t border-[#c3c6d6] flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={handleCloseAddSupervisor}
                  disabled={isCreatingSup}
                  className="px-4 py-2 border border-[#c3c6d6] text-[#585f6a] rounded-xl text-xs font-semibold hover:bg-[#e0e8ff] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingSup}
                  className="px-5 py-2 bg-[#003d9b] hover:bg-[#0052cc] text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isCreatingSup ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Provisioning...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[16px]">check</span>
                      <span>Provision Payroll Admin</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Archive Intern Modal */}
      {archiveModalIntern && (
        <div className="fixed inset-0 bg-[#041b3c]/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-[#c3c6d6] overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-5 border-b border-[#c3c6d6] flex items-center justify-between bg-[#fffbeb]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#f59e0b]/20 text-[#b45309] flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[22px]">archive</span>
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#041b3c]">Archive Intern (Mark Inactive)</h3>
                  <p className="text-[11px] text-[#585f6a]">
                    End internship status while safely retaining all historical records
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setArchiveModalIntern(null)}
                disabled={isArchiving}
                className="p-1 text-[#585f6a] hover:text-[#041b3c] hover:bg-white rounded-lg transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-5 space-y-4 overflow-y-auto">
              {/* Intern Target Summary Card */}
              <div className="bg-[#f8f9fa] border border-[#e2e8f0] rounded-xl p-3.5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#003d9b] text-white flex items-center justify-center font-bold text-sm shrink-0">
                    {archiveModalIntern.initials || archiveModalIntern.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-[#041b3c]">{archiveModalIntern.name}</h4>
                    <p className="text-xs text-[#585f6a]">{archiveModalIntern.email}</p>
                    <p className="text-[11px] text-[#003d9b] font-medium mt-0.5">
                      {archiveModalIntern.department} • {archiveModalIntern.team || 'General'}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold text-[#585f6a] block">Recorded Shifts</span>
                  <span className="text-sm font-black text-[#041b3c]">
                    {effectiveAttendance.filter((r) => r.internId === archiveModalIntern.id).length} Days
                  </span>
                </div>
              </div>

              {/* Informational Guidance */}
              <div className="bg-[#f0fdf4] border border-[#bbf7d0] rounded-xl p-3.5 space-y-1.5 text-xs text-[#166534]">
                <p className="font-bold flex items-center gap-1.5 text-[13px] text-[#15803d]">
                  <span className="material-symbols-outlined text-[16px]">verified</span>
                  <span>How Archiving Works:</span>
                </p>
                <ul className="list-disc pl-4 space-y-1 text-[11px] leading-relaxed">
                  <li><strong>Check-in Disabled:</strong> Account is deactivated so this intern can no longer submit daily check-ins.</li>
                  <li><strong>Removed from Active Roster:</strong> Hidden from Active counts, daily attendance lists, and default payroll calculations.</li>
                  <li><strong>Historical Data Preserved:</strong> All past time records, supervisor reviews, and payouts remain completely intact for accounting audits.</li>
                  <li><strong>Reversible:</strong> You can reactivate this intern anytime from the "Archived" view.</li>
                </ul>
              </div>

              {/* Reason Selector */}
              <div>
                <label className="block text-xs font-bold text-[#041b3c] mb-1">
                  Reason for Archiving / Ending Internship <span className="text-[#ba1a1a]">*</span>
                </label>
                <select
                  value={archiveReason}
                  onChange={(e) => setArchiveReason(e.target.value)}
                  className="w-full bg-[#f9f9ff] border border-[#c3c6d6] rounded-xl px-3.5 py-2.5 text-xs font-semibold text-[#041b3c] focus:border-[#003d9b] outline-none cursor-pointer"
                >
                  <option value="Internship Period Completed">Internship Period Completed (Normal)</option>
                  <option value="Academic Semester Concluded">Academic Semester Concluded</option>
                  <option value="Contract Ended">Contract Term Ended</option>
                  <option value="Early Resignation / Withdrawn">Early Resignation / Withdrawn</option>
                  <option value="Other">Other / Custom Note</option>
                </select>
              </div>

              {/* Optional Custom Note */}
              <div>
                <label className="block text-xs font-bold text-[#041b3c] mb-1">
                  Additional Notes (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Completed final evaluation and university handover"
                  value={archiveCustomReason}
                  onChange={(e) => setArchiveCustomReason(e.target.value)}
                  className="w-full bg-[#f9f9ff] border border-[#c3c6d6] rounded-xl px-3.5 py-2 text-xs text-[#041b3c] focus:border-[#003d9b] outline-none"
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div className="p-4 border-t border-[#c3c6d6] bg-[#f9f9ff] flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setArchiveModalIntern(null)}
                disabled={isArchiving}
                className="px-4 py-2 border border-[#c3c6d6] text-[#585f6a] rounded-xl text-xs font-semibold hover:bg-[#e0e8ff] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmArchive}
                disabled={isArchiving}
                className="px-5 py-2 bg-[#b45309] hover:bg-[#92400e] text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isArchiving ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Archiving...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[16px]">archive</span>
                    <span>Confirm Archive Intern</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Permanently Modal */}
      {deleteModalIntern && (
        <div className="fixed inset-0 bg-[#041b3c]/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-[#ba1a1a]/30 overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-5 border-b border-[#ba1a1a]/20 flex items-center justify-between bg-[#fff1f2]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#fee2e2] text-[#ba1a1a] flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[22px]">warning</span>
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#ba1a1a]">Permanently Delete Intern</h3>
                  <p className="text-[11px] text-[#585f6a]">
                    Irreversible action — intended only for test entries or mistakes
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDeleteModalIntern(null)}
                disabled={isDeleting}
                className="p-1 text-[#585f6a] hover:text-[#041b3c] hover:bg-white rounded-lg transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-5 space-y-4 overflow-y-auto">
              {/* Target Intern Card */}
              <div className="bg-[#fef2f2] border border-[#fecaca] rounded-xl p-3.5 flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-sm text-[#991b1b]">{deleteModalIntern.name}</h4>
                  <p className="text-xs text-[#7f1d1d]">{deleteModalIntern.email}</p>
                  <p className="text-[11px] text-[#991b1b] font-medium mt-0.5">
                    {deleteModalIntern.department}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold text-[#7f1d1d] block">Attendance Logs</span>
                  <span className="text-sm font-black text-[#991b1b]">
                    {effectiveAttendance.filter((r) => r.internId === deleteModalIntern.id).length} Records
                  </span>
                </div>
              </div>

              {/* Warning Notice */}
              <div className="bg-[#fee2e2]/60 border border-[#f87171] rounded-xl p-3.5 space-y-2 text-xs text-[#991b1b]">
                <p className="font-black text-sm text-[#7f1d1d] flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[18px]">report</span>
                  <span>CRITICAL WARNING: This CANNOT be undone!</span>
                </p>
                <p className="text-[11px] leading-relaxed">
                  Permanently deleting this intern will completely erase their user account and cascade delete all associated records from Firestore:
                </p>
                <ul className="list-disc pl-4 space-y-1 text-[11px]">
                  <li>User profile document for <strong>{deleteModalIntern.name}</strong></li>
                  <li><strong>{effectiveAttendance.filter((r) => r.internId === deleteModalIntern.id).length}</strong> check-in and check-out attendance records</li>
                  <li>All monthly supervisor review documents</li>
                  <li>All calculated payroll summary records</li>
                </ul>
              </div>

              {effectiveAttendance.filter((r) => r.internId === deleteModalIntern.id).length > 0 && (
                <div className="bg-[#fffbeb] border border-[#fcd34d] rounded-xl p-3 text-xs text-[#92400e] flex items-start gap-2">
                  <span className="material-symbols-outlined text-[18px] text-[#b45309] shrink-0 mt-0.5">
                    lightbulb
                  </span>
                  <p className="text-[11px] leading-relaxed">
                    <strong>Recommendation:</strong> This intern already has recorded attendance data. If they actually worked shifts at Pico, please click <strong>Cancel</strong> and choose <strong>Archive</strong> instead so their attendance history remains available for auditing and payroll verification.
                  </p>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="p-4 border-t border-[#c3c6d6] bg-[#f9f9ff] flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setDeleteModalIntern(null)}
                disabled={isDeleting}
                className="px-4 py-2 border border-[#c3c6d6] text-[#585f6a] rounded-xl text-xs font-semibold hover:bg-[#e0e8ff] transition-colors cursor-pointer"
              >
                Cancel (Keep Intern)
              </button>
              <button
                type="button"
                onClick={handleConfirmDeletePermanently}
                disabled={isDeleting}
                className="px-5 py-2 bg-[#ba1a1a] hover:bg-[#991b1b] text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Deleting Permanently...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[16px]">delete_forever</span>
                    <span>Yes, Permanently Delete All Data</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Per-Intern Attendance Form Modal (Pico Format) */}
      <InternAttendanceFormModal
        isOpen={isPrintAttendanceModalOpen}
        onClose={() => setIsPrintAttendanceModalOpen(false)}
        interns={interns}
        initialInternId={printSelectedInternId}
        attendanceRecords={effectiveAttendance}
        allUsers={allUsers}
      />
    </div>
  );
};

