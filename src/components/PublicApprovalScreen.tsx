import React, { useEffect, useState } from 'react';
import { ApprovalLink, InternMonthlyReview } from '../types';
import { getApprovalLinkByToken, getMonthlyReviewForMagicLink, approveViaMagicLink } from '../services/dbService';
import { getMergedRecordNotes } from '../utils/noteUtils';

interface PublicApprovalScreenProps {
  token?: string | null;
  onGoToLogin?: () => void;
}

export const PublicApprovalScreen: React.FC<PublicApprovalScreenProps> = ({
  token: propToken,
  onGoToLogin,
}) => {
  const [token, setToken] = useState<string | null>(propToken || null);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorState, setErrorState] = useState<{
    type: 'not_found' | 'expired' | 'used' | 'general';
    title: string;
    message: string;
    dateDetail?: string;
  } | null>(null);

  const [approvalLink, setApprovalLink] = useState<ApprovalLink | null>(null);
  const [review, setReview] = useState<InternMonthlyReview | null>(null);
  const [isApproving, setIsApproving] = useState<boolean>(false);
  const [isApprovedSuccess, setIsApprovedSuccess] = useState<boolean>(false);
  const [approvedTimestamp, setApprovedTimestamp] = useState<string | null>(null);

  // Extract token from URL if not passed in props
  useEffect(() => {
    if (propToken) {
      setToken(propToken);
      return;
    }

    // Check query params
    const searchParams = new URLSearchParams(window.location.search);
    let extracted = searchParams.get('token');

    // Check hash params e.g. #/approve?token=XXXX
    if (!extracted && window.location.hash.includes('token=')) {
      const hashQuery = window.location.hash.includes('?')
        ? window.location.hash.split('?')[1]
        : window.location.hash.split('#')[1];
      const hashParams = new URLSearchParams(hashQuery);
      extracted = hashParams.get('token');
    }

    setToken(extracted);
  }, [propToken]);

  // Fetch token and review data
  useEffect(() => {
    if (!token) {
      setLoading(false);
      setErrorState({
        type: 'not_found',
        title: 'Missing Approval Token',
        message: 'No approval authorization token was detected in the URL. Please check the link sent to your email.',
      });
      return;
    }

    const loadApprovalData = async () => {
      setLoading(true);
      setErrorState(null);

      try {
        const link = await getApprovalLinkByToken(token);

        if (!link) {
          setErrorState({
            type: 'not_found',
            title: 'Invalid or Non-Existent Link',
            message: 'This approval link is invalid or has been removed. Please contact the payroll administration team to request a new magic link.',
          });
          setLoading(false);
          return;
        }

        setApprovalLink(link);

        // Check if already used
        if (link.used) {
          setErrorState({
            type: 'used',
            title: 'Approval Already Completed',
            message: `This attendance record for ${link.internName} (${link.month}) has already been approved. No further action is required.`,
            dateDetail: link.usedAt ? new Date(link.usedAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : undefined,
          });
          setLoading(false);
          return;
        }

        // Check if expired (14 days)
        const expiryDate = new Date(link.expiresAt);
        if (expiryDate < new Date()) {
          setErrorState({
            type: 'expired',
            title: 'Approval Link Expired',
            message: `For security and audit compliance, magic approval links are valid for 14 days. This link expired on ${expiryDate.toLocaleDateString('en-US', { dateStyle: 'medium' })}. Please request a refreshed link.`,
            dateDetail: expiryDate.toLocaleDateString('en-US', { dateStyle: 'medium' }),
          });
          setLoading(false);
          return;
        }

        // Fetch monthly review for this intern
        const revData = await getMonthlyReviewForMagicLink(link.internId, link.month);
        if (revData) {
          setReview(revData);
          if (revData.status === 'approved') {
            setIsApprovedSuccess(true);
            setApprovedTimestamp(revData.approvedAt || null);
          }
        } else {
          // If no review document exists yet, fabricate a clean view from link data
          setReview({
            id: `rev-${link.internId}`,
            internId: link.internId,
            name: link.internName,
            initials: link.internName.slice(0, 2).toUpperCase(),
            department: 'Internship Program',
            monthYear: link.month,
            daysLogged: 0,
            officeDaysCount: 0,
            outsideDaysCount: 0,
            status: 'pending',
            records: [],
          });
        }
      } catch (err) {
        console.error('Error loading magic link approval data:', err);
        setErrorState({
          type: 'general',
          title: 'Unable to Load Approval Request',
          message: 'An error occurred while connecting to the database. Please verify your internet connection and try again.',
        });
      } finally {
        setLoading(false);
      }
    };

    loadApprovalData();
  }, [token]);

  // Handle Supervisor Approval Action
  const handleApprove = async () => {
    if (!token || !approvalLink || !review) return;

    try {
      setIsApproving(true);
      await approveViaMagicLink(token, review.id);
      const timestamp = new Date().toISOString();
      setIsApprovedSuccess(true);
      setApprovedTimestamp(timestamp);
      setReview((prev) => (prev ? { ...prev, status: 'approved', approvedAt: timestamp } : null));
    } catch (err) {
      console.error('Error during magic link approval:', err);
      alert('Failed to submit approval. Please try again or log into the portal.');
    } finally {
      setIsApproving(false);
    }
  };

  const records = review?.records || [];
  const officeCount = records.length > 0
    ? records.filter((r) => r.locationType === 'office').length
    : (review?.officeDaysCount ?? 0);
  const outsideCount = records.length > 0
    ? records.filter((r) => r.locationType === 'outside').length
    : (review?.outsideDaysCount ?? 0);
  const totalDays = records.length > 0
    ? officeCount + outsideCount
    : (review?.daysLogged ?? (officeCount + outsideCount));

  return (
    <div className="min-h-screen bg-[#F4F5F7] text-[#041b3c] font-sans antialiased flex flex-col">
      {/* Top Banner */}
      <header className="bg-white border-b border-[#c3c6d6] shadow-xs">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#003d9b] text-white flex items-center justify-center shadow-xs">
              <span className="material-symbols-outlined text-[20px]">verified_user</span>
            </div>
            <div>
              <span className="font-bold text-sm tracking-tight text-[#003d9b]">Supervisor Authorization</span>
              <span className="hidden sm:inline text-xs text-[#585f6a] ml-2 pl-2 border-l border-[#c3c6d6]">
                Passwordless One-Click Approval
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#e0e8ff] text-[#003d9b]">
              <span className="material-symbols-outlined text-[14px]">lock_open_right</span>
              <span>Magic Link Access</span>
            </span>
            {onGoToLogin && (
              <button
                onClick={onGoToLogin}
                className="text-xs font-bold text-[#585f6a] hover:text-[#003d9b] hover:bg-[#f1f3ff] px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
              >
                Sign In to App
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-3xl w-full mx-auto p-4 sm:p-6 md:p-8 flex flex-col justify-center">
        {/* Loading View */}
        {loading && (
          <div className="bg-white rounded-2xl border border-[#c3c6d6] p-12 text-center shadow-sm">
            <div className="w-12 h-12 border-4 border-[#003d9b] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <h3 className="text-base font-bold text-[#041b3c]">Verifying Approval Token...</h3>
            <p className="text-xs text-[#585f6a] mt-1">
              Validating secure cryptographic link and fetching intern attendance summary.
            </p>
          </div>
        )}

        {/* Error / Expired / Used State View */}
        {!loading && errorState && (
          <div className="bg-white rounded-2xl border border-[#c3c6d6] overflow-hidden shadow-md">
            <div
              className={`p-6 border-b flex items-center gap-4 ${
                errorState.type === 'used'
                  ? 'bg-[#ecfdf5] border-[#10B981]/30 text-[#065f46]'
                  : errorState.type === 'expired'
                  ? 'bg-[#fffbeb] border-[#f59e0b]/30 text-[#92400e]'
                  : 'bg-[#ffdad6]/40 border-[#ba1a1a]/20 text-[#ba1a1a]'
              }`}
            >
              <div
                className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${
                  errorState.type === 'used'
                    ? 'bg-[#10B981] text-white'
                    : errorState.type === 'expired'
                    ? 'bg-[#f59e0b] text-white'
                    : 'bg-[#ba1a1a] text-white'
                }`}
              >
                <span className="material-symbols-outlined text-[26px]">
                  {errorState.type === 'used'
                    ? 'task_alt'
                    : errorState.type === 'expired'
                    ? 'history_toggle_off'
                    : 'gpp_bad'}
                </span>
              </div>
              <div>
                <h2 className="text-lg font-bold">{errorState.title}</h2>
                <p className="text-xs opacity-90 mt-0.5">{errorState.message}</p>
                {errorState.dateDetail && (
                  <p className="text-[11px] font-mono mt-1 opacity-75">
                    Timestamp: {errorState.dateDetail}
                  </p>
                )}
              </div>
            </div>

            <div className="p-6 bg-[#fbfbfe] flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-xs text-[#585f6a]">
                Need assistance? Contact the Pico HR & Payroll team at <span className="font-semibold text-[#003d9b]">hr-operations@company.com</span>.
              </div>
              {onGoToLogin && (
                <button
                  onClick={onGoToLogin}
                  className="px-4 py-2 bg-[#003d9b] text-white text-xs font-bold rounded-lg hover:bg-[#0052cc] shadow-xs cursor-pointer transition-colors"
                >
                  Return to Portal Sign-In
                </button>
              )}
            </div>
          </div>
        )}

        {/* Valid Approval Timecard View */}
        {!loading && !errorState && review && (
          <div className="bg-white rounded-2xl border border-[#c3c6d6] shadow-md overflow-hidden flex flex-col">
            {/* Review Header Banner */}
            <div className="p-6 bg-[#f1f3ff] border-b border-[#c3c6d6] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                {review.avatarUrl ? (
                  <img
                    src={review.avatarUrl}
                    alt={review.name}
                    className="w-14 h-14 rounded-full object-cover border-2 border-white shadow-xs"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-[#003d9b] text-white font-bold flex items-center justify-center text-lg shadow-xs">
                    {review.initials || review.name.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-xl font-bold text-[#041b3c]">{review.name}</h1>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#e0e8ff] text-[#003d9b] border border-[#003d9b]/20">
                      Intern
                    </span>
                  </div>
                  <p className="text-xs text-[#585f6a] mt-0.5">
                    {review.department} • Billing Cycle: <strong className="text-[#041b3c]">{approvalLink?.month || review.monthYear}</strong>
                  </p>
                </div>
              </div>

              {/* Status Badge */}
              <div className="text-right">
                {isApprovedSuccess ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-[#10B981]/15 text-[#047857] border border-[#10B981]/30">
                    <span className="material-symbols-outlined text-[16px]">check_circle</span>
                    <span>Approved & Recorded</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-[#f59e0b]/20 text-[#b45309] border border-[#f59e0b]/30">
                    <span className="w-2 h-2 rounded-full bg-[#f59e0b] animate-ping" />
                    <span>Pending Supervisor Approval</span>
                  </span>
                )}
              </div>
            </div>

            {/* Success Notification if just approved */}
            {isApprovedSuccess && (
              <div className="p-4 bg-[#ecfdf5] border-b border-[#10B981]/30 flex items-center gap-3 text-xs text-[#065f46] animate-fade-in">
                <span className="material-symbols-outlined text-[#10B981] text-[22px]">verified</span>
                <div>
                  <span className="font-bold">Authorization confirmed!</span> This timecard is now marked as approved for payroll disbursement.
                  {approvedTimestamp && (
                    <span className="ml-1 opacity-75 font-mono">({new Date(approvedTimestamp).toLocaleTimeString()})</span>
                  )}
                </div>
              </div>
            )}

            {/* Summary Metrics */}
            <div className="p-6 border-b border-[#c3c6d6] bg-[#fbfbfe]">
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-white border border-[#c3c6d6] p-4 rounded-xl text-center shadow-xs">
                  <span className="text-[11px] font-bold text-[#585f6a] uppercase block">Total Days</span>
                  <span className="text-2xl font-black text-[#041b3c] mt-0.5 block">{totalDays}</span>
                </div>
                <div className="bg-white border border-[#c3c6d6] p-4 rounded-xl text-center shadow-xs">
                  <span className="text-[11px] font-bold text-[#585f6a] uppercase block">Office Days</span>
                  <span className="text-2xl font-black text-[#003d9b] mt-0.5 block">{officeCount}</span>
                </div>
                <div className="bg-white border border-[#c3c6d6] p-4 rounded-xl text-center shadow-xs">
                  <span className="text-[11px] font-bold text-[#585f6a] uppercase block">Outside / Site</span>
                  <span className="text-2xl font-black text-[#434654] mt-0.5 block">{outsideCount}</span>
                </div>
              </div>
            </div>

            {/* Daily Attendance Logs */}
            <div className="p-6 flex-1 overflow-y-auto max-h-[420px] space-y-3">
              <div className="flex items-center justify-between pb-1">
                <h3 className="text-xs font-bold text-[#041b3c] uppercase tracking-wider">
                  Daily Attendance & GPS Location Logs ({records.length})
                </h3>
                <span className="text-[11px] text-[#585f6a]">Standard Daily Rate: 400 THB</span>
              </div>

              {records.length === 0 ? (
                <div className="p-8 bg-[#f9f9ff] rounded-xl border border-[#c3c6d6] text-center text-xs text-[#585f6a]">
                  <span className="material-symbols-outlined text-[28px] text-[#585f6a] mb-1 block">event_available</span>
                  All daily check-ins for this cycle have been validated and aggregated.
                </div>
              ) : (
                records.map((rec) => {
                  const isOffice = rec.locationType === 'office';

                  return (
                    <div
                      key={rec.id}
                      className="p-3.5 bg-[#fbfbfe] rounded-xl border border-[#c3c6d6] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 text-xs hover:border-[#003d9b]/40 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="font-bold text-[#003d9b] w-14 leading-tight">
                          <div>{rec.monthName} {rec.date}</div>
                          <div className="text-[10px] font-normal text-[#585f6a]">{rec.dayOfWeek?.slice(0, 3)}</div>
                        </div>

                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-[#041b3c]">
                              {rec.checkInTime} → {rec.checkOutTime || '--:--'}
                            </span>

                            {/* Location Type Badge */}
                            {isOffice ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-[#e0e8ff] text-[#003d9b] px-2 py-0.5 rounded-full border border-[#003d9b]/20">
                                <span className="material-symbols-outlined text-[12px]">corporate_fare</span>
                                Office
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-[#eceef4] text-[#434654] px-2 py-0.5 rounded-full border border-[#c3c6d6]">
                                <span className="material-symbols-outlined text-[12px]">travel_explore</span>
                                Outside
                              </span>
                            )}
                          </div>

                          {/* Notes & GPS Coordinates */}
                          <div className="text-[11px] text-[#585f6a] flex items-center gap-2 flex-wrap mt-0.5">
                            {getMergedRecordNotes(rec) && (
                              <span className="font-medium text-[#041b3c] bg-[#f1f3ff] px-2 py-0.5 rounded border border-[#c3c6d6]/60">
                                <span className="text-[#0052cc] font-semibold mr-1">Notes:</span>
                                {getMergedRecordNotes(rec)}
                              </span>
                            )}
                            {rec.coordinates && (
                              <span className="font-mono text-[#737685]">
                                ({rec.coordinates.lat.toFixed(3)}°, {rec.coordinates.lng.toFixed(3)}°)
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 border-[#c3c6d6]/60 pt-2 sm:pt-0">
                        <span className="font-bold text-[#003d9b] text-[13px]">{rec.totalDuration}</span>
                        <span
                          className="material-symbols-outlined text-[#10B981] text-[18px] filled"
                          style={{ fontVariationSettings: "'FILL' 1" }}
                        >
                          check_circle
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Action Footer */}
            <div className="p-6 bg-[#f1f3ff] border-t border-[#c3c6d6] flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-xs text-[#585f6a] text-center sm:text-left">
                <span>Magic link issued for </span>
                <strong className="text-[#041b3c]">{approvalLink?.supervisorName || 'Assigned Supervisor'}</strong>.
                <span className="block text-[10px] text-[#737685] mt-0.5">
                  Clicking Approve marks this cycle ready for payroll processing.
                </span>
              </div>

              {!isApprovedSuccess ? (
                <button
                  type="button"
                  onClick={handleApprove}
                  disabled={isApproving}
                  className={`w-full sm:w-auto px-6 py-3 bg-[#003d9b] hover:bg-[#0052cc] text-white rounded-xl font-bold text-xs shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    isApproving ? 'opacity-60 cursor-wait' : 'hover:shadow-lg hover:-translate-y-0.5'
                  }`}
                >
                  {isApproving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Recording Authorization...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[18px]">verified</span>
                      <span>Approve Monthly Attendance</span>
                    </>
                  )}
                </button>
              ) : (
                <div className="flex items-center gap-2 text-xs font-bold text-[#047857] bg-white px-4 py-2.5 rounded-xl border border-[#10B981]/30 shadow-xs">
                  <span className="material-symbols-outlined text-[#10B981] text-[18px]">check_circle</span>
                  <span>Approval Recorded</span>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="py-4 border-t border-[#c3c6d6] bg-white text-center text-[11px] text-[#737685]">
        Pico Attendance & Payroll Management System • Secure Magic Link Flow
      </footer>
    </div>
  );
};
