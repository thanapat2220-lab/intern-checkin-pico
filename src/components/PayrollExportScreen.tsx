import React, { useState } from 'react';
import { PayrollRecord, UserProfile } from '../types';
import { ASSET_IMAGES } from '../data/mockData';

interface PayrollExportScreenProps {
  user: UserProfile;
  payrollRecords: PayrollRecord[];
  onUpdateRecord: (updated: PayrollRecord) => void;
  onAddNewRecord: (newRec: PayrollRecord) => void;
  onLogout: () => void;
  onSwitchScreen: (screen: any) => void;
}

export const PayrollExportScreen: React.FC<PayrollExportScreenProps> = ({
  user,
  payrollRecords,
  onUpdateRecord,
  onAddNewRecord,
  onLogout,
  onSwitchScreen,
}) => {
  const [selectedMonth, setSelectedMonth] = useState('November 2023');
  const [selectedDepartment, setSelectedDepartment] = useState('All Departments');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSideTab, setActiveSideTab] = useState<'overview' | 'status' | 'bank' | 'tax' | 'audit'>('overview');
  const [topNavTab, setTopNavTab] = useState<'payroll' | 'dashboard' | 'interns' | 'reports'>('payroll');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState<PayrollRecord | null>(null);

  // New Record form state
  const [newInternName, setNewInternName] = useState('');
  const [newDepartment, setNewDepartment] = useState('Engineering');
  const [newTeam, setNewTeam] = useState('Frontend');
  const [newPeriod, setNewPeriod] = useState('Jul 1 - Dec 31');
  const [newDailyRate, setNewDailyRate] = useState(500);
  const [newDaysWorked, setNewDaysWorked] = useState(20);
  const [newBankName, setNewBankName] = useState('Kasikorn');
  const [newAccountNumber, setNewAccountNumber] = useState('');

  // Filter records
  const filteredRecords = payrollRecords.filter((rec) => {
    const matchesDept =
      selectedDepartment === 'All Departments' || rec.department === selectedDepartment;
    const matchesSearch =
      rec.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rec.team.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rec.bankName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rec.accountNumber.includes(searchQuery);
    return matchesDept && matchesSearch;
  });

  const totalPayrollTHB = filteredRecords.reduce((acc, r) => acc + r.totalAmountTHB, 0);
  const totalDaysWorked = filteredRecords.reduce((acc, r) => acc + r.daysWorked, 0);

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
      'Status',
    ];
    const rows = filteredRecords.map((r) => [
      r.name,
      r.department,
      r.team,
      r.internshipPeriod,
      r.dailyRateTHB,
      r.daysWorked,
      r.totalAmountTHB,
      r.bankName,
      `"${r.accountNumber}"`,
      r.status,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `Intern_Payroll_${selectedMonth.replace(' ', '_')}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setShowExportModal(false);
    setToastMessage(`Exported ${filteredRecords.length} records to CSV successfully.`);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleStatusToggle = (rec: PayrollRecord) => {
    const nextStatus = rec.status === 'Approved' ? 'Pending' : 'Approved';
    onUpdateRecord({ ...rec, status: nextStatus });
    setToastMessage(`Updated ${rec.name} payment status to ${nextStatus}.`);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const handleSaveNewRecord = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newInternName) return;

    const total = newDailyRate * newDaysWorked;
    const newRec: PayrollRecord = {
      id: `pay-${Date.now()}`,
      internId: `intern-${Date.now()}`,
      name: newInternName,
      department: newDepartment,
      team: newTeam,
      internshipPeriod: newPeriod,
      dailyRateTHB: Number(newDailyRate),
      daysWorked: Number(newDaysWorked),
      totalAmountTHB: total,
      bankName: newBankName,
      accountNumber: newAccountNumber || '123-4-56789-0',
      status: 'Pending',
      monthYear: selectedMonth,
    };

    onAddNewRecord(newRec);
    setShowAddModal(false);
    setNewInternName('');
    setToastMessage(`Added payroll entry for ${newRec.name}.`);
    setTimeout(() => setToastMessage(null), 3000);
  };

  return (
    <div className="bg-[#f9f9ff] text-[#041b3c] flex h-screen overflow-hidden font-sans antialiased text-[14px]">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-8 z-50 bg-[#041b3c] text-white px-5 py-3 rounded-lg shadow-xl flex items-center gap-3 font-medium text-sm border border-[#c3c6d6]">
          <span className="material-symbols-outlined text-[#10B981] text-[20px]">check_circle</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* SideNavBar (Desktop & Tablet) */}
      <nav className="h-screen w-64 bg-[#f1f3ff] border-r border-[#c3c6d6] flex flex-col p-4 gap-2 hidden md:flex shrink-0 z-10 shadow-sm">
        <div className="mb-6 px-2">
          <h1 className="text-[20px] font-black text-[#003d9b] tracking-tight">Payroll Admin</h1>
          <p className="text-[13px] text-[#585f6a] mt-0.5">Internal Operations</p>
        </div>

        <div className="flex flex-col gap-1 flex-grow">
          {/* Active Navigation */}
          <button
            onClick={() => setActiveSideTab('overview')}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg font-bold text-[13px] transition-transform duration-150 text-left cursor-pointer ${
              activeSideTab === 'overview'
                ? 'bg-[#dae0ee] text-[#041b3c] scale-98 shadow-xs'
                : 'text-[#434654] hover:bg-[#d7e2ff]/50'
            }`}
          >
            <span
              className="material-symbols-outlined text-[20px] filled"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              payments
            </span>
            <span>Payroll Overview</span>
          </button>

          {/* Interns Directory & Supervisor Assignment */}
          <button
            onClick={() => onSwitchScreen('admin_interns')}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-bold text-[#003d9b] bg-[#e0e8ff]/70 hover:bg-[#d7e2ff] transition-all duration-150 text-left cursor-pointer border border-[#003d9b]/20"
          >
            <span className="material-symbols-outlined text-[20px]">manage_accounts</span>
            <span>Manage Interns</span>
          </button>

          {/* Inactive Navigation */}
          <button
            onClick={() => setActiveSideTab('status')}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-150 text-left cursor-pointer ${
              activeSideTab === 'status'
                ? 'bg-[#dae0ee] text-[#003d9b] font-bold'
                : 'text-[#434654] hover:bg-[#d7e2ff]/50 hover:text-[#003d9b]'
            }`}
          >
            <span className="material-symbols-outlined text-[20px]">account_balance</span>
            <span>Payment Status</span>
          </button>

          <button
            onClick={() => setActiveSideTab('bank')}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-150 text-left cursor-pointer ${
              activeSideTab === 'bank'
                ? 'bg-[#dae0ee] text-[#003d9b] font-bold'
                : 'text-[#434654] hover:bg-[#d7e2ff]/50 hover:text-[#003d9b]'
            }`}
          >
            <span className="material-symbols-outlined text-[20px]">description</span>
            <span>Bank Details</span>
          </button>

          <button
            onClick={() => setActiveSideTab('tax')}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-150 text-left cursor-pointer ${
              activeSideTab === 'tax'
                ? 'bg-[#dae0ee] text-[#003d9b] font-bold'
                : 'text-[#434654] hover:bg-[#d7e2ff]/50 hover:text-[#003d9b]'
            }`}
          >
            <span className="material-symbols-outlined text-[20px]">history</span>
            <span>Tax Documents</span>
          </button>

          <button
            onClick={() => setActiveSideTab('audit')}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-150 text-left cursor-pointer ${
              activeSideTab === 'audit'
                ? 'bg-[#dae0ee] text-[#003d9b] font-bold'
                : 'text-[#434654] hover:bg-[#d7e2ff]/50 hover:text-[#003d9b]'
            }`}
          >
            <span className="material-symbols-outlined text-[20px]">shield</span>
            <span>Audit Logs</span>
          </button>
        </div>

        <div className="space-y-2 mt-auto">
          <button
            onClick={() => setShowExportModal(true)}
            className="w-full bg-[#0052cc] text-white font-semibold text-[13px] py-2.5 rounded-md hover:bg-[#0040a2] transition-colors cursor-pointer shadow-sm flex items-center justify-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[18px]">assessment</span>
            <span>Generate Report</span>
          </button>

          <button
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 bg-transparent text-[#585f6a] hover:text-[#ba1a1a] hover:bg-white/60 py-1.5 rounded-md text-[12px] font-medium transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">logout</span>
            <span>Switch Role / Logout</span>
          </button>
        </div>
      </nav>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* TopAppBar */}
        <header className="bg-white border-b border-[#c3c6d6] flex items-center justify-between px-8 py-3 w-full top-0 z-10 shrink-0 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
          <div className="flex items-center gap-6">
            <div className="text-[24px] font-bold text-[#003d9b] cursor-pointer tracking-tight">
              HR Operations
            </div>
            <nav className="hidden md:flex gap-6 ml-6">
              <button
                onClick={() => setTopNavTab('dashboard')}
                className={`text-[13px] font-medium transition-colors ${
                  topNavTab === 'dashboard'
                    ? 'text-[#003d9b] border-b-2 border-[#003d9b] font-bold pb-1'
                    : 'text-[#585f6a] hover:text-[#003d9b]'
                }`}
              >
                Dashboard
              </button>
              <button
                onClick={() => onSwitchScreen('admin_interns')}
                className="text-[13px] font-medium transition-colors text-[#585f6a] hover:text-[#003d9b] cursor-pointer"
              >
                Interns Directory
              </button>
              <button
                onClick={() => setTopNavTab('payroll')}
                className={`text-[13px] transition-colors ${
                  topNavTab === 'payroll'
                    ? 'text-[#003d9b] border-b-2 border-[#003d9b] pb-1 font-bold'
                    : 'text-[#585f6a] hover:text-[#003d9b]'
                }`}
              >
                Payroll
              </button>
              <button
                onClick={() => setTopNavTab('reports')}
                className={`text-[13px] font-medium transition-colors ${
                  topNavTab === 'reports'
                    ? 'text-[#003d9b] border-b-2 border-[#003d9b] font-bold pb-1'
                    : 'text-[#585f6a] hover:text-[#003d9b]'
                }`}
              >
                Reports
              </button>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative hidden sm:block">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#585f6a] text-[18px]">
                search
              </span>
              <input
                className="pl-9 pr-3 py-1.5 border border-[#c3c6d6] rounded-full text-[13px] focus:border-[#003d9b] focus:ring-1 focus:ring-[#003d9b] outline-none bg-white text-[#041b3c] w-48 lg:w-60 shadow-xs"
                placeholder="Search..."
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <button
              onClick={() => setShowExportModal(true)}
              className="bg-[#0052cc] text-white font-semibold text-[13px] px-4 py-1.5 rounded-md hover:bg-[#0040a2] transition-colors cursor-pointer shadow-sm flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[16px]">file_download</span>
              <span>Export Data</span>
            </button>

            <button
              onClick={() => setShowAddModal(true)}
              className="bg-[#003d9b] text-white font-semibold text-[13px] px-3.5 py-1.5 rounded-md hover:bg-[#0052cc] transition-colors cursor-pointer shadow-sm flex items-center gap-1"
              title="Add New Intern Payroll Entry"
            >
              <span className="material-symbols-outlined text-[16px]">add</span>
              <span className="hidden lg:inline">Add Record</span>
            </button>

            <button
              onClick={() => alert('Payroll Alerts: 1 bank verification required for SCB intern.')}
              className="p-1.5 text-[#585f6a] hover:text-[#003d9b] transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px]">notifications</span>
            </button>

            <button
              onClick={() => alert('Payroll Settings: Currency set to THB, tax withholding at 0% (intern status).')}
              className="p-1.5 text-[#585f6a] hover:text-[#003d9b] transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px]">settings</span>
            </button>

            <div className="flex items-center gap-2 border-l border-[#c3c6d6] pl-2">
              <img
                alt="Admin Profile"
                className="w-8 h-8 rounded-full object-cover border border-[#c3c6d6] cursor-pointer"
                src={user.avatarUrl || ASSET_IMAGES.admin}
              />
              <span className="text-xs font-semibold text-[#041b3c] hidden xl:inline">
                {user.name}
              </span>
            </div>
          </div>
        </header>

        {/* Main Scrollable Content */}
        <main className="flex-1 overflow-y-auto p-8 bg-[#f9f9ff]">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Header Section & Stats Overview */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h2 className="text-[26px] font-bold text-[#041b3c] tracking-tight">
                  Payroll Export
                </h2>
                <p className="text-[14px] text-[#585f6a] mt-0.5">
                  Review and export intern payment records.
                </p>
              </div>

              {/* KPI Chips */}
              <div className="flex items-center gap-3 flex-wrap">
                <div className="bg-white border border-[#c3c6d6] px-3.5 py-2 rounded-lg shadow-xs">
                  <span className="text-[11px] text-[#585f6a] block font-medium uppercase">
                    Total Disbursals
                  </span>
                  <span className="text-[18px] font-bold text-[#003d9b]">
                    {totalPayrollTHB.toLocaleString()} THB
                  </span>
                </div>
                <div className="bg-white border border-[#c3c6d6] px-3.5 py-2 rounded-lg shadow-xs">
                  <span className="text-[11px] text-[#585f6a] block font-medium uppercase">
                    Active Interns
                  </span>
                  <span className="text-[18px] font-bold text-[#041b3c]">
                    {filteredRecords.length}
                  </span>
                </div>
                <div className="bg-white border border-[#c3c6d6] px-3.5 py-2 rounded-lg shadow-xs">
                  <span className="text-[11px] text-[#585f6a] block font-medium uppercase">
                    Total Days Logged
                  </span>
                  <span className="text-[18px] font-bold text-[#10B981]">
                    {totalDaysWorked} Days
                  </span>
                </div>
              </div>
            </div>

            {/* Filters & Search Bar */}
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-white p-4 rounded-lg border border-[#c3c6d6] shadow-xs">
              <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                <div className="relative">
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="border border-[#c3c6d6] rounded-md px-3 py-2 text-[13px] font-medium text-[#041b3c] focus:border-[#003d9b] focus:ring-1 focus:ring-[#003d9b] outline-none bg-white min-w-[160px] cursor-pointer"
                  >
                    <option>November 2023</option>
                    <option>October 2023</option>
                    <option>September 2023</option>
                  </select>
                </div>

                <div className="relative">
                  <select
                    value={selectedDepartment}
                    onChange={(e) => setSelectedDepartment(e.target.value)}
                    className="border border-[#c3c6d6] rounded-md px-3 py-2 text-[13px] font-medium text-[#041b3c] focus:border-[#003d9b] focus:ring-1 focus:ring-[#003d9b] outline-none bg-white min-w-[180px] cursor-pointer"
                  >
                    <option>All Departments</option>
                    <option>Engineering</option>
                    <option>Marketing</option>
                    <option>Design</option>
                  </select>
                </div>
              </div>

              <div className="relative w-full sm:w-72">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#585f6a] text-[18px]">
                  search
                </span>
                <input
                  className="w-full pl-9 pr-3 py-2 border border-[#c3c6d6] rounded-md text-[13px] focus:border-[#003d9b] focus:ring-1 focus:ring-[#003d9b] outline-none bg-white text-[#041b3c]"
                  placeholder="Search interns, banks..."
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            {/* Data Table */}
            <div className="bg-white border border-[#c3c6d6] rounded-lg overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#e8edff] border-b border-[#c3c6d6]">
                      <th className="p-3 text-[12px] font-semibold text-[#434654] whitespace-nowrap">
                        Name
                      </th>
                      <th className="p-3 text-[12px] font-semibold text-[#434654] whitespace-nowrap">
                        Department
                      </th>
                      <th className="p-3 text-[12px] font-semibold text-[#434654] whitespace-nowrap">
                        Team
                      </th>
                      <th className="p-3 text-[12px] font-semibold text-[#434654] whitespace-nowrap">
                        Internship Period
                      </th>
                      <th className="p-3 text-[12px] font-semibold text-[#434654] whitespace-nowrap text-right">
                        Daily Rate (THB)
                      </th>
                      <th className="p-3 text-[12px] font-semibold text-[#434654] whitespace-nowrap text-right">
                        Days Worked
                      </th>
                      <th className="p-3 text-[12px] font-semibold text-[#434654] whitespace-nowrap text-right">
                        Total Amount (THB)
                      </th>
                      <th className="p-3 text-[12px] font-semibold text-[#434654] whitespace-nowrap">
                        Bank Name
                      </th>
                      <th className="p-3 text-[12px] font-semibold text-[#434654] whitespace-nowrap">
                        Account Number
                      </th>
                      <th className="p-3 text-[12px] font-semibold text-[#434654] whitespace-nowrap text-center">
                        Status
                      </th>
                      <th className="p-3 text-[12px] font-semibold text-[#434654] whitespace-nowrap text-center">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="text-[13px]">
                    {filteredRecords.length === 0 ? (
                      <tr>
                        <td colSpan={11} className="p-8 text-center text-[#585f6a]">
                          No payroll records found for this filter combination.
                        </td>
                      </tr>
                    ) : (
                      filteredRecords.map((row, idx) => {
                        const isEven = idx % 2 === 1;
                        const isApproved = row.status === 'Approved';

                        return (
                          <tr
                            key={row.id}
                            className={`border-b border-[#c3c6d6]/60 transition-colors hover:bg-[#d7e2ff]/30 ${
                              isEven ? 'bg-[#fafafa]' : 'bg-white'
                            }`}
                          >
                            <td className="p-3 font-semibold text-[#041b3c] whitespace-nowrap">
                              {row.name}
                            </td>
                            <td className="p-3 text-[#585f6a] whitespace-nowrap">
                              {row.department}
                            </td>
                            <td className="p-3 text-[#585f6a] whitespace-nowrap">{row.team}</td>
                            <td className="p-3 text-[#585f6a] whitespace-nowrap">
                              {row.internshipPeriod}
                            </td>
                            <td className="p-3 text-[#041b3c] text-right whitespace-nowrap font-medium">
                              {row.dailyRateTHB.toLocaleString()}
                            </td>
                            <td className="p-3 text-[#041b3c] text-right whitespace-nowrap font-medium">
                              {row.daysWorked}
                            </td>
                            <td className="p-3 font-bold text-[#041b3c] text-right whitespace-nowrap">
                              {row.totalAmountTHB.toLocaleString()}
                            </td>
                            <td className="p-3 text-[#585f6a] whitespace-nowrap flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-[#0052cc]" />
                              {row.bankName}
                            </td>
                            <td className="p-3 font-mono text-[#585f6a] whitespace-nowrap text-xs">
                              {row.accountNumber}
                            </td>
                            <td className="p-3 text-center whitespace-nowrap">
                              <button
                                onClick={() => handleStatusToggle(row)}
                                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border cursor-pointer transition-transform active:scale-95 ${
                                  isApproved
                                    ? 'bg-[#e6f4ea] text-[#1e8e3e] border-[#1e8e3e]/20 hover:bg-[#d4edd9]'
                                    : 'bg-[#fef7e0] text-[#b06000] border-[#b06000]/20 hover:bg-[#fdeec3]'
                                }`}
                                title="Click to toggle status"
                              >
                                {isApproved ? (
                                  <span className="material-symbols-outlined text-[14px]">
                                    check
                                  </span>
                                ) : (
                                  <span className="material-symbols-outlined text-[14px]">
                                    schedule
                                  </span>
                                )}
                                {row.status}
                              </button>
                            </td>
                            <td className="p-3 text-center whitespace-nowrap">
                              <button
                                onClick={() => setEditingRecord(row)}
                                className="text-[#0052cc] hover:text-[#003d9b] p-1 rounded hover:bg-[#e0e8ff] transition-colors"
                                title="Edit Record"
                              >
                                <span className="material-symbols-outlined text-[18px]">
                                  edit_note
                                </span>
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Export Options Modal */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl border border-[#c3c6d6]">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-[18px] font-bold text-[#041b3c] flex items-center gap-2">
                <span className="material-symbols-outlined text-[#0052cc]">download_for_offline</span>
                Export Payroll Records
              </h3>
              <button
                onClick={() => setShowExportModal(false)}
                className="text-[#737685] hover:text-[#041b3c]"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <p className="text-xs text-[#585f6a] mb-4">
              Export format for {selectedMonth} containing {filteredRecords.length} records.
            </p>

            <div className="space-y-2.5">
              <button
                onClick={handleExportCSV}
                className="w-full flex items-center justify-between p-3 border border-[#c3c6d6] rounded-lg hover:border-[#0052cc] hover:bg-[#f1f3ff] transition-all text-left group"
              >
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-[#10B981] text-[24px]">
                    csv
                  </span>
                  <div>
                    <p className="font-bold text-xs text-[#041b3c]">Standard CSV (.csv)</p>
                    <p className="text-[11px] text-[#737685]">Compatible with Excel, Google Sheets, Payroll ERP</p>
                  </div>
                </div>
                <span className="material-symbols-outlined text-[#737685] group-hover:text-[#0052cc]">
                  arrow_forward
                </span>
              </button>

              <button
                onClick={() => {
                  window.print();
                  setShowExportModal(false);
                }}
                className="w-full flex items-center justify-between p-3 border border-[#c3c6d6] rounded-lg hover:border-[#0052cc] hover:bg-[#f1f3ff] transition-all text-left group"
              >
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-[#0052cc] text-[24px]">
                    print
                  </span>
                  <div>
                    <p className="font-bold text-xs text-[#041b3c]">Print / Save PDF</p>
                    <p className="text-[11px] text-[#737685]">Formatted for bank authorization signature sheets</p>
                  </div>
                </div>
                <span className="material-symbols-outlined text-[#737685] group-hover:text-[#0052cc]">
                  arrow_forward
                </span>
              </button>
            </div>

            <button
              onClick={() => setShowExportModal(false)}
              className="w-full mt-4 py-2 border border-[#c3c6d6] rounded-md text-xs font-semibold text-[#585f6a] hover:bg-[#f1f3ff]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Add New Record Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-2xl border border-[#c3c6d6]">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-[18px] font-bold text-[#041b3c] flex items-center gap-2">
                <span className="material-symbols-outlined text-[#0052cc]">person_add</span>
                Add Intern Payroll Record
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-[#737685] hover:text-[#041b3c]">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveNewRecord} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-[#041b3c] block mb-1">Intern Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Thomas Wayne"
                  value={newInternName}
                  onChange={(e) => setNewInternName(e.target.value)}
                  className="w-full p-2 border border-[#c3c6d6] rounded-md text-xs bg-[#f9f9ff] text-[#041b3c]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-[#041b3c] block mb-1">Department</label>
                  <select
                    value={newDepartment}
                    onChange={(e) => setNewDepartment(e.target.value)}
                    className="w-full p-2 border border-[#c3c6d6] rounded-md text-xs bg-[#f9f9ff]"
                  >
                    <option>Engineering</option>
                    <option>Marketing</option>
                    <option>Design</option>
                    <option>HR</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-[#041b3c] block mb-1">Team</label>
                  <input
                    type="text"
                    value={newTeam}
                    onChange={(e) => setNewTeam(e.target.value)}
                    className="w-full p-2 border border-[#c3c6d6] rounded-md text-xs bg-[#f9f9ff]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-[#041b3c] block mb-1">Daily Rate (THB)</label>
                  <input
                    type="number"
                    value={newDailyRate}
                    onChange={(e) => setNewDailyRate(Number(e.target.value))}
                    className="w-full p-2 border border-[#c3c6d6] rounded-md text-xs bg-[#f9f9ff]"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-[#041b3c] block mb-1">Days Worked</label>
                  <input
                    type="number"
                    value={newDaysWorked}
                    onChange={(e) => setNewDaysWorked(Number(e.target.value))}
                    className="w-full p-2 border border-[#c3c6d6] rounded-md text-xs bg-[#f9f9ff]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-[#041b3c] block mb-1">Bank Name</label>
                  <select
                    value={newBankName}
                    onChange={(e) => setNewBankName(e.target.value)}
                    className="w-full p-2 border border-[#c3c6d6] rounded-md text-xs bg-[#f9f9ff]"
                  >
                    <option>Kasikorn</option>
                    <option>SCB</option>
                    <option>Bangkok Bank</option>
                    <option>Krungthai</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-[#041b3c] block mb-1">Account Number</label>
                  <input
                    type="text"
                    placeholder="012-3-45678-9"
                    value={newAccountNumber}
                    onChange={(e) => setNewAccountNumber(e.target.value)}
                    className="w-full p-2 border border-[#c3c6d6] rounded-md text-xs bg-[#f9f9ff]"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-[#c3c6d6] rounded-md text-xs font-medium text-[#585f6a]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#0052cc] text-white rounded-md text-xs font-semibold hover:bg-[#0040a2]"
                >
                  Add Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Record Modal */}
      {editingRecord && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl border border-[#c3c6d6]">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-[18px] font-bold text-[#041b3c]">Edit Record: {editingRecord.name}</h3>
              <button onClick={() => setEditingRecord(null)} className="text-[#737685] hover:text-[#041b3c]">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-[#041b3c] block mb-1">Days Worked</label>
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
                  className="w-full p-2 border border-[#c3c6d6] rounded-md text-xs bg-[#f9f9ff]"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-[#041b3c] block mb-1">Daily Rate (THB)</label>
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
                  className="w-full p-2 border border-[#c3c6d6] rounded-md text-xs bg-[#f9f9ff]"
                />
              </div>

              <div className="p-3 bg-[#e8edff] rounded-lg">
                <span className="text-xs text-[#585f6a] block">Recalculated Total:</span>
                <span className="text-[18px] font-bold text-[#003d9b]">
                  {editingRecord.totalAmountTHB.toLocaleString()} THB
                </span>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingRecord(null)}
                  className="px-4 py-2 border border-[#c3c6d6] rounded-md text-xs font-medium text-[#585f6a]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onUpdateRecord(editingRecord);
                    setEditingRecord(null);
                    setToastMessage(`Updated ${editingRecord.name} details.`);
                    setTimeout(() => setToastMessage(null), 2500);
                  }}
                  className="px-4 py-2 bg-[#0052cc] text-white rounded-md text-xs font-semibold hover:bg-[#0040a2]"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
