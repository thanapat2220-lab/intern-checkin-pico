import React, { useState, useMemo } from 'react';
import { InternMonthlyReview, UserProfile } from '../types';
import { ASSET_IMAGES } from '../data/mockData';
import { formatMonthYear, getRecentMonthDropdownOptions } from '../utils/dateUtils';
import { isMissingCheckout } from '../utils/attendanceLogUtils';

interface SupervisorPortalScreenProps {
  user: UserProfile;
  reviews: InternMonthlyReview[];
  onApproveReview: (reviewId: string) => void;
  onApproveAll: () => void;
  onOpenGpsReview?: (review) => void;
  onOpenDetailReview: (review: InternMonthlyReview) => void;
  onLogout: () => void;
  onSwitchScreen: (screen: any) => void;
}

export const SupervisorPortalScreen: React.FC<SupervisorPortalScreenProps> = ({
  user,
  reviews,
  onApproveReview,
  onApproveAll,
  onOpenDetailReview,
  onLogout,
  onSwitchScreen,
}) => {
  const [selectedMonth, setSelectedMonth] = useState(() => formatMonthYear());
  const monthOptions = useMemo(() => getRecentMonthDropdownOptions(5, 1), []);
  const [activeNavTab, setActiveNavTab] = useState<'monthly_reviews' | 'overview' | 'stats' | 'logs' | 'archive'>('monthly_reviews');
  const [topNavTab, setTopNavTab] = useState<'reports' | 'dashboard' | 'interns' | 'settings'>('reports');
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Filter reviews: Supervisors only see interns specifically assigned to their account
  // Unassigned interns are hidden from all supervisor approval queues until assigned by an admin.
  const visibleReviews = reviews.filter((rev) => {
    if (user.role === 'supervisor') {
      return rev.supervisorId === user.id;
    }
    // Payroll Admins can see all reviews
    return true;
  });

  const pendingCount = visibleReviews.filter((r) => r.status === 'pending').length;
  const approvedCount = visibleReviews.filter((r) => r.status === 'approved').length;
  const pendingWithMissingCount = visibleReviews.filter(
    (r) => r.status === 'pending' && r.records.some(isMissingCheckout)
  ).length;

  const handleApprove = (id: string, name: string) => {
    onApproveReview(id);
    setToastMessage(`Attendance hours for ${name} successfully approved.`);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleApproveAllClick = () => {
    // Approve only reviews assigned to this supervisor that DO NOT have missing checkouts
    const approvable = visibleReviews.filter(
      (r) => r.status === 'pending' && !r.records.some(isMissingCheckout)
    );
    const blocked = visibleReviews.filter(
      (r) => r.status === 'pending' && r.records.some(isMissingCheckout)
    );

    approvable.forEach((r) => onApproveReview(r.id));
    setShowBulkModal(false);

    if (blocked.length > 0) {
      setToastMessage(
        `Approved ${approvable.length} timecard(s). ${blocked.length} intern(s) have Missing Check-out and require manual review.`
      );
    } else {
      setToastMessage('All assigned intern monthly attendance records approved.');
    }
    setTimeout(() => setToastMessage(null), 4000);
  };

  return (
    <div className="bg-[#F4F5F7] text-[#041b3c] h-screen overflow-hidden flex font-sans antialiased text-[14px]">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed top-20 right-8 z-50 bg-[#041b3c] text-white px-5 py-3 rounded-lg shadow-xl flex items-center gap-3 font-medium text-sm border border-[#c3c6d6]">
          <span className="material-symbols-outlined text-[#10B981] text-[20px]">check_circle</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* SideNavBar (Desktop & Tablet) */}
      <aside className="bg-[#f1f3ff] h-screen w-64 fixed left-0 top-0 border-r border-[#c3c6d6] flex flex-col py-6 z-20 shadow-sm">
        {/* Brand Header */}
        <div className="px-4 mb-8 flex items-center gap-3">
          <img
            className="w-10 h-10 rounded-full object-cover shadow-sm border border-[#c3c6d6]"
            src={ASSET_IMAGES.hrLogo}
            alt="HR Operations Logo"
          />
          <div>
            <h2 className="text-[18px] font-bold text-[#041b3c] leading-tight">Supervisor Portal</h2>
            <p className="text-[11px] text-[#434654] font-medium mt-0.5">HR Operations</p>
          </div>
        </div>

        {/* Navigation links */}
        <nav className="flex-1 px-2 space-y-1.5">
          <button
            onClick={() => setActiveNavTab('overview')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all text-left cursor-pointer ${
              activeNavTab === 'overview'
                ? 'bg-[#0052cc]/15 text-[#003d9b] font-bold'
                : 'text-[#434654] hover:bg-[#dae0ee]'
            }`}
          >
            <span className="material-symbols-outlined text-[20px]">dashboard</span>
            <span className="text-[13px]">Overview</span>
          </button>

          <button
            onClick={() => setActiveNavTab('monthly_reviews')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all text-left cursor-pointer ${
              activeNavTab === 'monthly_reviews'
                ? 'bg-[#0052cc]/20 text-[#003d9b] font-bold shadow-xs'
                : 'text-[#434654] hover:bg-[#dae0ee]'
            }`}
          >
            <span className="material-symbols-outlined text-[20px]">calendar_month</span>
            <span className="text-[13px] flex-1">Monthly Reviews</span>
            {pendingCount > 0 && (
              <span className="px-2 py-0.5 bg-[#003d9b] text-white text-[10px] font-bold rounded-full">
                {pendingCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveNavTab('stats')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all text-left cursor-pointer ${
              activeNavTab === 'stats'
                ? 'bg-[#0052cc]/15 text-[#003d9b] font-bold'
                : 'text-[#434654] hover:bg-[#dae0ee]'
            }`}
          >
            <span className="material-symbols-outlined text-[20px]">analytics</span>
            <span className="text-[13px]">Department Stats</span>
          </button>

          <button
            onClick={() => setActiveNavTab('logs')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all text-left cursor-pointer ${
              activeNavTab === 'logs'
                ? 'bg-[#0052cc]/15 text-[#003d9b] font-bold'
                : 'text-[#434654] hover:bg-[#dae0ee]'
            }`}
          >
            <span className="material-symbols-outlined text-[20px]">fact_check</span>
            <span className="text-[13px]">Attendance Log</span>
          </button>

          <button
            onClick={() => setActiveNavTab('archive')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all text-left cursor-pointer ${
              activeNavTab === 'archive'
                ? 'bg-[#0052cc]/15 text-[#003d9b] font-bold'
                : 'text-[#434654] hover:bg-[#dae0ee]'
            }`}
          >
            <span className="material-symbols-outlined text-[20px]">inventory_2</span>
            <span className="text-[13px]">Archive</span>
          </button>
        </nav>

        {/* Sidebar Footer & Bulk Actions */}
        <div className="px-3 mt-auto space-y-2">
          <button
            onClick={() => setShowBulkModal(true)}
            className="w-full flex items-center justify-center gap-2 bg-[#003d9b] text-white py-2.5 rounded-md text-[13px] font-semibold hover:bg-[#0052cc] transition-colors focus:ring-2 focus:ring-offset-2 focus:ring-[#003d9b] cursor-pointer shadow-sm"
          >
            <span className="material-symbols-outlined text-[18px]">auto_awesome_mosaic</span>
            <span>Bulk Approve All</span>
          </button>

          <button
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 bg-transparent text-[#585f6a] hover:text-[#ba1a1a] hover:bg-white/60 py-1.5 rounded-md text-[12px] font-medium transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">logout</span>
            <span>Switch Role / Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 ml-64 flex flex-col h-screen overflow-hidden">
        {/* TopNavBar */}
        <header className="bg-white w-full h-16 border-b border-[#c3c6d6] flex justify-between items-center px-8 z-10 shrink-0 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
          <div className="flex items-center gap-6">
            <h1 className="text-[20px] font-bold text-[#003d9b] tracking-tight">Supervisor Portal</h1>
            {/* Desktop Navigation Links */}
            <nav className="hidden md:flex gap-4">
              <button
                onClick={() => setTopNavTab('dashboard')}
                className={`text-[14px] px-2 py-1 font-medium transition-colors ${
                  topNavTab === 'dashboard'
                    ? 'text-[#003d9b] border-b-2 border-[#003d9b]'
                    : 'text-[#585f6a] hover:text-[#003d9b]'
                }`}
              >
                Dashboard
              </button>
              <button
                onClick={() => setTopNavTab('interns')}
                className={`text-[14px] px-2 py-1 font-medium transition-colors ${
                  topNavTab === 'interns'
                    ? 'text-[#003d9b] border-b-2 border-[#003d9b]'
                    : 'text-[#585f6a] hover:text-[#003d9b]'
                }`}
              >
                Interns
              </button>
              <button
                onClick={() => setTopNavTab('reports')}
                className={`text-[14px] px-2 py-1 font-medium transition-colors ${
                  topNavTab === 'reports'
                    ? 'text-[#003d9b] border-b-2 border-[#003d9b] font-semibold'
                    : 'text-[#585f6a] hover:text-[#003d9b]'
                }`}
              >
                Reports
              </button>
              <button
                onClick={() => setTopNavTab('settings')}
                className={`text-[14px] px-2 py-1 font-medium transition-colors ${
                  topNavTab === 'settings'
                    ? 'text-[#003d9b] border-b-2 border-[#003d9b]'
                    : 'text-[#585f6a] hover:text-[#003d9b]'
                }`}
              >
                Settings
              </button>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            {pendingCount > 0 && (
              <button
                onClick={() => setShowBulkModal(true)}
                className="bg-[#003d9b] text-white px-5 py-2 rounded-md text-[13px] font-semibold hover:bg-[#0052cc] transition-colors focus:ring-2 focus:ring-offset-2 focus:ring-[#003d9b] shadow-sm cursor-pointer active:scale-95"
              >
                Approve All ({pendingCount})
              </button>
            )}
            <div className="flex items-center gap-2 ml-2 pl-2 border-l border-[#c3c6d6]">
              <img
                className="w-8 h-8 rounded-full border border-[#c3c6d6] object-cover"
                src={user.avatarUrl || ASSET_IMAGES.supervisor}
                alt={user.name}
              />
              <span className="text-xs font-semibold text-[#041b3c] hidden xl:inline">
                {user.name}
              </span>
            </div>
          </div>
        </header>

        {/* Scrollable Canvas */}
        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-5xl mx-auto space-y-6">
            {/* Page Header & Controls */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-3">
              <div>
                <h2 className="text-[26px] font-bold text-[#041b3c] tracking-tight">
                  Attendance Reviews & Approvals
                </h2>
                <p className="text-[14px] text-[#434654] mt-0.5">
                  Review and verify intern timecards with location tracking for payroll processing.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="relative">
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="appearance-none bg-white border border-[#c3c6d6] rounded-md py-2 pl-3 pr-9 text-[13px] font-medium text-[#041b3c] focus:outline-none focus:border-[#003d9b] focus:ring-1 focus:ring-[#003d9b] cursor-pointer shadow-xs"
                  >
                    {monthOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.value}
                      </option>
                    ))}
                  </select>
                  <span className="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 text-[#434654] pointer-events-none text-[18px]">
                    expand_more
                  </span>
                </div>
              </div>
            </div>

            {/* Overview Metric Banner */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white border border-[#c3c6d6] rounded-xl p-4 shadow-xs">
                <span className="text-[11px] font-semibold text-[#585f6a] uppercase tracking-wider block">
                  {user.role === 'supervisor' ? 'My Assigned Interns' : 'Total Interns'}
                </span>
                <span className="text-[24px] font-bold text-[#041b3c] mt-1 block">
                  {visibleReviews.length}
                </span>
              </div>
              <div className="bg-white border border-[#c3c6d6] rounded-xl p-4 shadow-xs">
                <span className="text-[11px] font-semibold text-[#585f6a] uppercase tracking-wider block">
                  Pending Verification
                </span>
                <span className="text-[24px] font-bold text-[#003d9b] mt-1 block">
                  {pendingCount}
                </span>
              </div>
              <div className="bg-white border border-[#c3c6d6] rounded-xl p-4 shadow-xs">
                <span className="text-[11px] font-semibold text-[#585f6a] uppercase tracking-wider block">
                  Approved
                </span>
                <span className="text-[24px] font-bold text-[#10B981] mt-1 block">
                  {approvedCount}
                </span>
              </div>
            </div>

            {/* Intern Review Cards List */}
            <div className="space-y-3.5">
              {visibleReviews.length === 0 ? (
                <div className="bg-white border border-[#c3c6d6] rounded-xl p-10 text-center shadow-xs">
                  <div className="w-14 h-14 mx-auto rounded-full bg-[#f1f3ff] text-[#003d9b] flex items-center justify-center mb-3">
                    <span className="material-symbols-outlined text-[28px]">
                      {user.role === 'supervisor' ? 'person_search' : 'assignment_turned_in'}
                    </span>
                  </div>
                  <h3 className="text-[16px] font-bold text-[#041b3c]">
                    {user.role === 'supervisor'
                      ? 'No Assigned Interns for Verification'
                      : `No Monthly Reviews for ${selectedMonth}`}
                  </h3>
                  <p className="text-[13px] text-[#434654] max-w-md mx-auto mt-1">
                    {user.role === 'supervisor'
                      ? 'You only see attendance records for interns assigned to your supervisor account. Once an administrator assigns interns to you in the Intern Directory, their monthly timecards will appear here for verification.'
                      : 'When interns record their daily check-ins and check-outs, their attendance summaries and GPS logs will appear here for verification.'}
                  </p>
                </div>
              ) : (
                visibleReviews.map((rev) => {
                const isApproved = rev.status === 'approved';
                const isPending = rev.status === 'pending';

                // Calculate office vs outside count if not preset
                const officeCount = rev.officeDaysCount ?? (rev.records ? rev.records.filter((r) => r.locationType === 'office').length : 0);
                const outsideCount = rev.outsideDaysCount ?? (rev.records ? rev.records.filter((r) => r.locationType === 'outside').length : 0);
                const missingRecords = rev.records ? rev.records.filter(isMissingCheckout) : [];
                const hasMissing = missingRecords.length > 0;

                return (
                  <div
                    key={rev.id}
                    className={`bg-white border rounded-xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-all ${
                      hasMissing && isPending
                        ? 'border-[#f87171] bg-[#fffdfc] shadow-xs'
                        : isApproved
                        ? 'border-[#c3c6d6] bg-white opacity-90 hover:opacity-100'
                        : 'border-[#003d9b]/30 shadow-xs'
                    }`}
                  >
                    <div className="flex items-center gap-4 w-full md:w-auto">
                      {/* Avatar or Initials Badge */}
                      {rev.avatarUrl ? (
                        <img
                          src={rev.avatarUrl}
                          alt={rev.name}
                          className="w-12 h-12 rounded-full object-cover border border-[#c3c6d6] shrink-0"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-[16px] shrink-0 bg-[#e0e8ff] text-[#003d9b] border border-[#c3c6d6]">
                          {rev.initials}
                        </div>
                      )}

                      <div>
                        <h3 className="text-[17px] font-bold text-[#041b3c]">{rev.name}</h3>
                        
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="text-[12px] text-[#434654] flex items-center gap-1 font-medium">
                            <span className="material-symbols-outlined text-[15px] text-[#585f6a]">
                              {rev.department === 'Engineering'
                                ? 'domain'
                                : rev.department === 'Marketing'
                                ? 'campaign'
                                : 'draw'}
                            </span>
                            {rev.department}
                          </span>
                          <span className="text-[#c3c6d6]">•</span>
                          <span className="text-[12px] font-semibold text-[#041b3c]">
                            {rev.daysLogged} Total Days
                          </span>
                        </div>

                        {/* Location Type & Status Badges */}
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-[#e0e8ff] text-[#003d9b] px-2.5 py-0.5 rounded-full border border-[#003d9b]/20">
                            <span className="material-symbols-outlined text-[12px]">corporate_fare</span>
                            {officeCount} Office
                          </span>

                          {outsideCount > 0 && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-[#eceef4] text-[#434654] px-2.5 py-0.5 rounded-full border border-[#c3c6d6]">
                              <span className="material-symbols-outlined text-[12px]">travel_explore</span>
                              {outsideCount} Outside / Travel
                            </span>
                          )}

                          {hasMissing && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-[#fee2e2] text-[#b91c1c] px-2.5 py-0.5 rounded-full border border-[#f87171]/50">
                              <span className="material-symbols-outlined text-[12px]">warning</span>
                              {missingRecords.length} Missing Check-out
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end border-t border-[#c3c6d6]/60 md:border-t-0 pt-3 md:pt-0">
                      {/* Status Pills */}
                      {isPending && !hasMissing && (
                        <span className="px-3 py-1 bg-[#d7e2ff] text-[#003d9b] rounded-full text-[11px] font-semibold">
                          Pending Review
                        </span>
                      )}

                      {isPending && hasMissing && (
                        <span className="px-3 py-1 bg-[#fee2e2] text-[#b91c1c] border border-[#f87171]/40 rounded-full text-[11px] font-bold flex items-center gap-1">
                          <span className="material-symbols-outlined text-[13px]">rule</span>
                          Action Needed
                        </span>
                      )}

                      {isApproved && (
                        <span className="px-3 py-1 bg-[#E6F4EA] text-[#137333] rounded-full text-[11px] font-semibold flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px]">check_circle</span>
                          Approved
                        </span>
                      )}

                      {/* Action Buttons */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => onOpenDetailReview(rev)}
                          className="px-3.5 py-1.5 border border-[#c3c6d6] rounded-md text-[12px] font-semibold text-[#041b3c] hover:bg-[#f1f3ff] transition-colors cursor-pointer"
                        >
                          Review Logs
                        </button>
                        
                        {isPending && (
                          hasMissing ? (
                            <button
                              onClick={() => onOpenDetailReview(rev)}
                              className="px-3.5 py-1.5 bg-[#ea580c] hover:bg-[#c2410c] text-white rounded-md text-[12px] font-bold transition-colors flex items-center gap-1 cursor-pointer shadow-xs"
                              title="Manual confirmation required before approval"
                            >
                              <span className="material-symbols-outlined text-[16px]">edit_note</span>
                              Manual Confirm
                            </button>
                          ) : (
                            <button
                              onClick={() => handleApprove(rev.id, rev.name)}
                              className="px-3.5 py-1.5 bg-[#003d9b] text-white rounded-md text-[12px] font-semibold hover:bg-[#0052cc] transition-colors flex items-center gap-1 cursor-pointer shadow-xs"
                            >
                              <span className="material-symbols-outlined text-[16px]">check</span>
                              Approve
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Bulk Action Approval Dialog */}
      {showBulkModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl border border-[#c3c6d6]">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-[#e0e8ff] text-[#003d9b] flex items-center justify-center">
                <span className="material-symbols-outlined">auto_awesome_mosaic</span>
              </div>
              <div>
                <h3 className="text-[18px] font-bold text-[#041b3c]">Bulk Review & Approval</h3>
                <p className="text-xs text-[#585f6a]">{selectedMonth} Cycle ({visibleReviews.length} Interns)</p>
              </div>
            </div>

            <div className="my-4 p-3.5 bg-[#f1f3ff] border border-[#c3c6d6]/60 rounded-lg text-xs text-[#434654] space-y-1.5">
              <p className="font-semibold text-[#003d9b]">
                Approve all pending intern attendance submissions for the month.
              </p>
              <p>
                All work logs (both Office and Outside / Traveling entries) will be marked verified and sent to Payroll Admin.
              </p>
            </div>

            {pendingWithMissingCount > 0 && (
              <div className="p-3 bg-[#fff7ed] border border-[#ea580c]/50 rounded-lg text-xs text-[#9a3412] flex items-start gap-2 mb-4">
                <span className="material-symbols-outlined text-[18px] text-[#ea580c] shrink-0">warning</span>
                <div>
                  <span className="font-bold block">Safety Guardrail Active</span>
                  <span>
                    {pendingWithMissingCount} intern(s) have unclosed shifts with Missing Check-out. These records will NOT be auto-approved and will remain pending for manual review with notes.
                  </span>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-2 mt-2">
              <button
                onClick={handleApproveAllClick}
                className="w-full py-2.5 bg-[#003d9b] text-white font-semibold text-xs rounded-md hover:bg-[#0052cc] transition-colors cursor-pointer shadow-xs"
              >
                Confirm & Approve All Timecards
              </button>
              <button
                onClick={() => setShowBulkModal(false)}
                className="w-full py-2 text-[#737685] font-medium text-xs hover:underline cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
