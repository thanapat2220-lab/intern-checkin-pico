import React, { useState, useMemo } from 'react';
import { UserProfile, ScreenView } from '../types';
import { ASSET_IMAGES } from '../data/mockData';
import { createApprovalLink, createLightweightSupervisor } from '../services/dbService';

interface InternsManagementScreenProps {
  user: UserProfile;
  allUsers: UserProfile[];
  onAssignSupervisor: (internId: string, supervisorId: string | null, supervisorName: string | null) => Promise<void>;
  onLogout: () => void;
  onSwitchScreen: (screen: ScreenView) => void;
}

export const InternsManagementScreen: React.FC<InternsManagementScreenProps> = ({
  user,
  allUsers,
  onAssignSupervisor,
  onLogout,
  onSwitchScreen,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'unassigned' | 'assigned'>('all');
  const [supervisorFilter, setSupervisorFilter] = useState<string>('all');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [savingInternId, setSavingInternId] = useState<string | null>(null);

  // Add Supervisor Modal State
  const [isAddSupervisorOpen, setIsAddSupervisorOpen] = useState<boolean>(false);
  const [newSupName, setNewSupName] = useState<string>('');
  const [newSupEmail, setNewSupEmail] = useState<string>('');
  const [newSupDept, setNewSupDept] = useState<string>('Engineering');
  const [newSupTeam, setNewSupTeam] = useState<string>('General');
  const [isCreatingSup, setIsCreatingSup] = useState<boolean>(false);
  const [supFormError, setSupFormError] = useState<string | null>(null);

  // Magic Link Generation Modal State
  const [linkModalIntern, setLinkModalIntern] = useState<UserProfile | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>('October 2023');
  const [isGeneratingLink, setIsGeneratingLink] = useState<boolean>(false);
  const [generatedLinkData, setGeneratedLinkData] = useState<{
    token: string;
    approvalUrl: string;
    expiresAt: string;
  } | null>(null);
  const [isCopied, setIsCopied] = useState<boolean>(false);

  // Separate interns and supervisors
  const interns = useMemo(() => {
    return allUsers.filter((u) => u.role === 'intern');
  }, [allUsers]);

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

  // Add Supervisor Handlers
  const handleOpenAddSupervisor = () => {
    setNewSupName('');
    setNewSupEmail('');
    setNewSupDept('Engineering');
    setNewSupTeam('General');
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
      setSupFormError('Please enter the supervisor’s full name.');
      return;
    }
    if (!newSupEmail.trim() || !newSupEmail.includes('@')) {
      setSupFormError('Please enter a valid email address.');
      return;
    }

    try {
      setIsCreatingSup(true);
      setSupFormError(null);
      const created = await createLightweightSupervisor({
        name: newSupName.trim(),
        email: newSupEmail.trim(),
        department: newSupDept.trim(),
        team: newSupTeam.trim(),
      });
      showToast(`Supervisor "${created.name}" (${created.email}) added successfully.`);
      handleCloseAddSupervisor();
    } catch (err: any) {
      console.error('Failed to add supervisor:', err);
      setSupFormError(err.message || 'Failed to add supervisor. Please try again.');
    } finally {
      setIsCreatingSup(false);
    }
  };

  // Magic Link Modal Handlers
  const handleOpenLinkModal = (intern: UserProfile) => {
    setLinkModalIntern(intern);
    setSelectedMonth('October 2023');
    setGeneratedLinkData(null);
    setIsCopied(false);
  };

  const handleCloseLinkModal = () => {
    setLinkModalIntern(null);
    setGeneratedLinkData(null);
    setIsCopied(false);
  };

  const handleGenerateLink = async () => {
    if (!linkModalIntern) return;

    try {
      setIsGeneratingLink(true);
      const assignedSup = supervisors.find((s) => s.id === linkModalIntern.supervisorId);

      const res = await createApprovalLink({
        internId: linkModalIntern.id,
        internName: linkModalIntern.name,
        month: selectedMonth,
        supervisorId: linkModalIntern.supervisorId || null,
        supervisorName: assignedSup ? assignedSup.name : (linkModalIntern.supervisorName || null),
        supervisorEmail: assignedSup ? assignedSup.email : null,
      });

      setGeneratedLinkData({
        token: res.token,
        approvalUrl: res.approvalUrl,
        expiresAt: res.linkDoc.expiresAt,
      });
      showToast(`Magic approval link generated for ${linkModalIntern.name} (${selectedMonth})`);
    } catch (err) {
      console.error('Error generating approval link:', err);
      showToast('Failed to generate approval link. Please try again.');
    } finally {
      setIsGeneratingLink(false);
    }
  };

  const handleCopyLink = async () => {
    if (!generatedLinkData) return;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(generatedLinkData.approvalUrl);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = generatedLinkData.approvalUrl;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setIsCopied(true);
      showToast('Approval link copied to clipboard!');
      setTimeout(() => setIsCopied(false), 3000);
    } catch (err) {
      console.error('Copy error:', err);
      showToast('Unable to copy automatically. Please copy the link manually.');
    }
  };

  const getMailtoUrl = () => {
    if (!linkModalIntern || !generatedLinkData) return '#';
    const assignedSup = supervisors.find((s) => s.id === linkModalIntern.supervisorId);
    const toEmail = assignedSup?.email || '';
    const subject = encodeURIComponent(`Please review ${linkModalIntern.name}'s attendance - ${selectedMonth}`);
    const body = encodeURIComponent(
      `Hello ${assignedSup?.name || 'Supervisor'},\n\n` +
      `Please review and approve ${linkModalIntern.name}'s attendance record for ${selectedMonth} using the secure one-click link below (no login required, valid for 14 days):\n\n` +
      `${generatedLinkData.approvalUrl}\n\n` +
      `Thank you,\nHR & Payroll Team`
    );
    return `mailto:${toEmail}?subject=${subject}&body=${body}`;
  };

  // Filtered interns
  const filteredInterns = useMemo(() => {
    return interns.filter((intern) => {
      // Search matching
      const matchesSearch =
        intern.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        intern.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        intern.department.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (intern.team && intern.team.toLowerCase().includes(searchQuery.toLowerCase()));

      if (!matchesSearch) return false;

      // Status filter
      const isAssigned = Boolean(intern.supervisorId);
      if (statusFilter === 'unassigned' && isAssigned) return false;
      if (statusFilter === 'assigned' && !isAssigned) return false;

      // Supervisor filter
      if (supervisorFilter !== 'all') {
        if (supervisorFilter === 'unassigned') {
          if (isAssigned) return false;
        } else if (intern.supervisorId !== supervisorFilter) {
          return false;
        }
      }

      return true;
    });
  }, [interns, searchQuery, statusFilter, supervisorFilter]);

  // Counts
  const totalCount = interns.length;
  const unassignedCount = interns.filter((i) => !i.supervisorId).length;
  const assignedCount = totalCount - unassignedCount;

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
                onClick={() => onSwitchScreen('payroll_admin')}
                className="text-xs font-semibold px-3 py-1.5 rounded-md text-[#585f6a] hover:text-[#003d9b] hover:bg-[#f1f3ff] transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">payments</span>
                <span>Payroll Export</span>
              </button>
              <button
                onClick={() => onSwitchScreen('supervisor_portal')}
                className="text-xs font-semibold px-3 py-1.5 rounded-md text-[#585f6a] hover:text-[#003d9b] hover:bg-[#f1f3ff] transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">supervisor_account</span>
                <span>Supervisor Portal</span>
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
              onClick={handleOpenAddSupervisor}
              className="bg-white border border-[#003d9b] text-[#003d9b] hover:bg-[#f1f3ff] px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <span className="material-symbols-outlined text-[16px]">person_add</span>
              <span>Add Supervisor</span>
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
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white border border-[#c3c6d6] rounded-xl p-4 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-[#585f6a] uppercase tracking-wider">Total Interns</p>
              <p className="text-2xl font-black text-[#041b3c] mt-1">{totalCount}</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-[#f1f3ff] text-[#003d9b] flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">groups</span>
            </div>
          </div>

          <div className="bg-white border border-[#c3c6d6] rounded-xl p-4 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-[#585f6a] uppercase tracking-wider">Assigned to Supervisor</p>
              <p className="text-2xl font-black text-[#10B981] mt-1">{assignedCount}</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-[#10B981]/15 text-[#10B981] flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">how_to_reg</span>
            </div>
          </div>

          <div className={`bg-white border rounded-xl p-4 shadow-xs flex items-center justify-between ${
            unassignedCount > 0 ? 'border-[#f59e0b] bg-[#fffbeb]/40' : 'border-[#c3c6d6]'
          }`}>
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
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1.5 rounded-md font-semibold transition-all cursor-pointer ${
                  statusFilter === 'all' ? 'bg-white text-[#003d9b] shadow-xs' : 'text-[#585f6a] hover:text-[#041b3c]'
                }`}
              >
                All ({totalCount})
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
            </div>

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
                    <th className="py-3.5 px-6 text-right min-w-[170px]">Magic Link Approval</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#c3c6d6]/60">
                  {filteredInterns.map((intern) => {
                    const isAssigned = Boolean(intern.supervisorId);
                    const isSaving = savingInternId === intern.id;

                    return (
                      <tr
                        key={intern.id}
                        className={`hover:bg-[#f9f9ff] transition-colors ${
                          !isAssigned ? 'bg-[#fffbeb]/20' : ''
                        }`}
                      >
                        {/* Intern Info */}
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-[#003d9b] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs border border-[#c3c6d6]">
                              {intern.initials || intern.name.slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-bold text-[#041b3c]">{intern.name}</p>
                              <p className="text-[11px] text-[#585f6a]">{intern.email}</p>
                              {intern.internshipPeriod && (
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
                          {isAssigned ? (
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
                                disabled={isSaving}
                                className={`w-full appearance-none border rounded-lg py-2 pl-3 pr-8 text-xs font-semibold focus:outline-none transition-all cursor-pointer ${
                                  !isAssigned
                                    ? 'bg-[#fffbeb] border-[#f59e0b] text-[#b45309] focus:border-[#b45309] focus:ring-1 focus:ring-[#b45309]'
                                    : 'bg-white border-[#c3c6d6] text-[#041b3c] focus:border-[#003d9b] focus:ring-1 focus:ring-[#003d9b]'
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

                            {isAssigned && (
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

                        {/* Magic Link Generator Action */}
                        <td className="py-4 px-6 text-right">
                          <button
                            type="button"
                            onClick={() => handleOpenLinkModal(intern)}
                            title="Generate Magic Approval Link"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-[#e0e8ff] text-[#003d9b] hover:bg-[#003d9b] hover:text-white transition-all shadow-xs cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[15px]">send_time_extension</span>
                            <span>Generate Link</span>
                          </button>
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
                  <span className="material-symbols-outlined text-[20px]">person_add</span>
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#041b3c]">Add New Supervisor</h3>
                  <p className="text-[11px] text-[#585f6a]">
                    Create a direct supervisor record for instant assignments & magic links
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
                  info
                </span>
                <p className="text-[11px] text-[#041b3c] leading-relaxed">
                  <strong>Passwordless & Immediate:</strong> No password or initial registration is required. This supervisor will instantly appear in all assignment dropdowns and can review intern timesheets directly via 1-click email magic links. If they register an account later using this email, their record will automatically link.
                </p>
              </div>

              {supFormError && (
                <div className="bg-[#ffdad6]/60 border border-[#ba1a1a]/30 rounded-xl p-3 text-xs text-[#ba1a1a] flex items-center gap-2">
                  <span className="material-symbols-outlined text-[16px] shrink-0">error</span>
                  <span>{supFormError}</span>
                </div>
              )}

              {/* Full Name */}
              <div>
                <label className="block text-xs font-bold text-[#041b3c] mb-1.5">
                  Supervisor Full Name <span className="text-[#ba1a1a]">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dr. Alex Morgan"
                  value={newSupName}
                  onChange={(e) => setNewSupName(e.target.value)}
                  className="w-full bg-[#f9f9ff] border border-[#c3c6d6] rounded-xl px-3.5 py-2.5 text-xs text-[#041b3c] focus:border-[#003d9b] focus:ring-1 focus:ring-[#003d9b] outline-none"
                />
              </div>

              {/* Email Address */}
              <div>
                <label className="block text-xs font-bold text-[#041b3c] mb-1.5">
                  Supervisor Email Address <span className="text-[#ba1a1a]">*</span>
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g. alex.morgan@company.com"
                  value={newSupEmail}
                  onChange={(e) => setNewSupEmail(e.target.value)}
                  className="w-full bg-[#f9f9ff] border border-[#c3c6d6] rounded-xl px-3.5 py-2.5 text-xs text-[#041b3c] focus:border-[#003d9b] focus:ring-1 focus:ring-[#003d9b] outline-none"
                />
                <p className="text-[10px] text-[#585f6a] mt-1">
                  Magic link review invitations and reminder emails will be addressed to this inbox.
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
                    placeholder="e.g. Engineering"
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
                    placeholder="e.g. General"
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
                      <span>Creating...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[16px]">check</span>
                      <span>Save Supervisor</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Magic Link Modal */}
      {linkModalIntern && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full flex flex-col shadow-2xl border border-[#c3c6d6] overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 border-b border-[#c3c6d6] flex justify-between items-center bg-[#f1f3ff]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#003d9b] text-white flex items-center justify-center font-bold shadow-xs">
                  <span className="material-symbols-outlined text-[22px]">link</span>
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#041b3c]">Generate Magic Approval Link</h3>
                  <p className="text-xs text-[#585f6a]">
                    For <strong className="text-[#041b3c]">{linkModalIntern.name}</strong> • No supervisor login required
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseLinkModal}
                className="p-1.5 rounded-full hover:bg-[#e0e8ff] text-[#737685] hover:text-[#041b3c] transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              {/* Target Supervisor Info */}
              <div className="p-3.5 bg-[#fbfbfe] rounded-xl border border-[#c3c6d6] text-xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#585f6a] block mb-1">
                  Recipient Supervisor
                </span>
                {linkModalIntern.supervisorId ? (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-[#041b3c]">
                        {supervisors.find((s) => s.id === linkModalIntern.supervisorId)?.name || linkModalIntern.supervisorName}
                      </p>
                      <p className="text-[11px] text-[#585f6a]">
                        {supervisors.find((s) => s.id === linkModalIntern.supervisorId)?.email || 'No email configured'}
                      </p>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#10B981]/15 text-[#047857]">
                      Assigned
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center justify-between text-[#b45309]">
                    <span>⚠️ No supervisor currently assigned to this intern.</span>
                    <span className="text-[10px] font-semibold underline">You can still generate a universal link</span>
                  </div>
                )}
              </div>

              {/* Month Selection */}
              <div>
                <label className="block text-xs font-bold text-[#041b3c] mb-1.5">
                  Select Attendance Review Month
                </label>
                <select
                  value={selectedMonth}
                  onChange={(e) => {
                    setSelectedMonth(e.target.value);
                    setGeneratedLinkData(null); // Reset when month changes
                  }}
                  className="w-full appearance-none bg-white border border-[#c3c6d6] rounded-lg py-2.5 px-3 text-xs font-semibold text-[#041b3c] focus:border-[#003d9b] focus:ring-1 focus:ring-[#003d9b] outline-none cursor-pointer shadow-xs"
                >
                  <option value="October 2023">October 2023 (Current Cycle)</option>
                  <option value="September 2023">September 2023</option>
                  <option value="August 2023">August 2023</option>
                  <option value="November 2023">November 2023</option>
                </select>
              </div>

              {/* Generate Action Button */}
              {!generatedLinkData ? (
                <button
                  type="button"
                  onClick={handleGenerateLink}
                  disabled={isGeneratingLink}
                  className={`w-full py-2.5 bg-[#003d9b] text-white rounded-xl text-xs font-bold hover:bg-[#0052cc] shadow-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    isGeneratingLink ? 'opacity-60 cursor-wait' : ''
                  }`}
                >
                  {isGeneratingLink ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Generating Secure Token...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[18px]">key</span>
                      <span>Generate Approval Link for {selectedMonth}</span>
                    </>
                  )}
                </button>
              ) : (
                /* Generated URL Box & Actions */
                <div className="space-y-3 animate-fade-in pt-1">
                  <div>
                    <label className="block text-[11px] font-bold text-[#041b3c] mb-1">
                      One-Click Public Approval URL
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={generatedLinkData.approvalUrl}
                        className="flex-1 bg-[#f9f9ff] border border-[#c3c6d6] rounded-lg py-2 px-3 text-[11px] font-mono text-[#041b3c] select-all outline-none"
                      />
                      <button
                        type="button"
                        onClick={handleCopyLink}
                        className={`px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1 shrink-0 cursor-pointer shadow-xs ${
                          isCopied
                            ? 'bg-[#10B981] text-white'
                            : 'bg-[#003d9b] text-white hover:bg-[#0052cc]'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[16px]">
                          {isCopied ? 'check' : 'content_copy'}
                        </span>
                        <span>{isCopied ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Expiration and Email action */}
                  <div className="flex items-center justify-between text-[11px] text-[#585f6a] bg-[#fbfbfe] p-3 rounded-xl border border-[#c3c6d6]">
                    <div className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px] text-[#10B981]">schedule</span>
                      <span>
                        Valid for 14 days (Expires:{' '}
                        <strong>
                          {new Date(generatedLinkData.expiresAt).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </strong>
                        )
                      </span>
                    </div>

                    <a
                      href={getMailtoUrl()}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-[#10B981] text-white hover:bg-[#059669] transition-all shadow-xs cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[15px]">mail</span>
                      <span>Send via Email</span>
                    </a>
                  </div>

                  {/* Direct Test Preview Button */}
                  <div className="pt-1">
                    <a
                      href={generatedLinkData.approvalUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="w-full py-2 bg-[#f1f3ff] hover:bg-[#e0e8ff] text-[#003d9b] border border-[#c3c6d6] rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                      <span>Open Approval Page (Test View)</span>
                    </a>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-[#c3c6d6] bg-[#f9f9ff] flex justify-end">
              <button
                type="button"
                onClick={handleCloseLinkModal}
                className="px-4 py-2 border border-[#c3c6d6] text-[#585f6a] rounded-lg text-xs font-semibold hover:bg-[#e0e8ff] transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

