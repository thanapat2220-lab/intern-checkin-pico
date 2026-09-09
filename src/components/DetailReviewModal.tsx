import React, { useState } from 'react';
import { InternMonthlyReview, AttendanceRecord } from '../types';
import { isMissingCheckout, calculateDurationStr } from '../utils/attendanceLogUtils';
import { getMergedRecordNotes } from '../utils/noteUtils';

interface DetailReviewModalProps {
  review: InternMonthlyReview;
  onClose: () => void;
  onApprove: (reviewId: string) => void;
  onConfirmCheckOut?: (reviewId: string, recordId: string, checkOutTime: string, supervisorNote: string) => void;
}

export const DetailReviewModal: React.FC<DetailReviewModalProps> = ({
  review,
  onClose,
  onApprove,
  onConfirmCheckOut,
}) => {
  const isApproved = review.status === 'approved';
  const records = review.records || [];
  const officeCount = review.officeDaysCount ?? records.filter((r) => r.locationType === 'office').length;
  const outsideCount = review.outsideDaysCount ?? records.filter((r) => r.locationType === 'outside').length;

  const missingRecords = records.filter(isMissingCheckout);
  const hasMissingCheckout = missingRecords.length > 0;

  // State for supervisor confirming a missing check-out
  const [editingRecord, setEditingRecord] = useState<AttendanceRecord | null>(null);
  const [confirmTime, setConfirmTime] = useState<string>('01:00 AM');
  const [confirmNote, setConfirmNote] = useState<string>('worked until 1 AM at event, forgot to check out');

  const handleStartConfirm = (rec: AttendanceRecord) => {
    setEditingRecord(rec);
    setConfirmTime(rec.checkOutTime || '01:00 AM');
    setConfirmNote(rec.notes || 'worked until 1 AM at event, forgot to check out');
  };

  const handleSaveConfirm = () => {
    if (!editingRecord || !onConfirmCheckOut) return;
    onConfirmCheckOut(review.id, editingRecord.id, confirmTime, confirmNote);
    setEditingRecord(null);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[88vh] flex flex-col shadow-2xl border border-[#c3c6d6] overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-[#c3c6d6] flex justify-between items-center bg-[#f1f3ff]">
          <div className="flex items-center gap-3">
            {review.avatarUrl ? (
              <img
                src={review.avatarUrl}
                alt={review.name}
                className="w-12 h-12 rounded-full object-cover border border-[#c3c6d6]"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-[#dae0ee] text-[#003d9b] font-bold flex items-center justify-center text-[16px]">
                {review.initials}
              </div>
            )}
            <div>
              <h3 className="text-[18px] font-bold text-[#041b3c]">{review.name}</h3>
              <p className="text-xs text-[#585f6a]">
                {review.department} • {review.monthYear} • {review.daysLogged} Days Logged
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-[#e0e8ff] text-[#737685] hover:text-[#041b3c] transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Missing Check-out Banner for Supervisor Review */}
          {hasMissingCheckout && (
            <div className="p-3.5 bg-[#fff7ed] border-2 border-[#ea580c] rounded-xl flex items-start gap-3 text-xs text-[#7c2d12] shadow-xs">
              <span className="material-symbols-outlined text-[24px] text-[#ea580c] shrink-0">history_toggle_off</span>
              <div className="flex-1">
                <span className="font-bold text-[13px] text-[#9a3412] block">
                  Action Required: {missingRecords.length} Shift with Missing Check-out
                </span>
                <p className="mt-0.5 text-[11px] leading-relaxed">
                  Since event and exhibition finish times vary and can go late into the night, this record cannot be auto-approved. Please manually review the shift, confirm the intern's actual finish time, and add a note before approving for payroll.
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div className="bg-[#f9f9ff] border border-[#c3c6d6] p-3 rounded-xl text-center">
              <span className="text-[11px] text-[#585f6a] block uppercase font-medium">Total Days</span>
              <span className="text-[20px] font-bold text-[#041b3c]">{review.daysLogged}</span>
            </div>
            <div className="bg-[#f9f9ff] border border-[#c3c6d6] p-3 rounded-xl text-center">
              <span className="text-[11px] text-[#585f6a] block uppercase font-medium">Office Days</span>
              <span className="text-[20px] font-bold text-[#003d9b]">{officeCount}</span>
            </div>
            <div className="bg-[#f9f9ff] border border-[#c3c6d6] p-3 rounded-xl text-center">
              <span className="text-[11px] text-[#585f6a] block uppercase font-medium">Outside / Travel</span>
              <span className="text-[20px] font-bold text-[#434654]">{outsideCount}</span>
            </div>
          </div>

          <h4 className="text-xs font-bold text-[#041b3c] uppercase tracking-wider mt-3 flex items-center justify-between">
            <span>Daily Attendance & Location Breakdown</span>
            <span className="text-[11px] text-[#585f6a] font-normal">
              {records.length} Entries
            </span>
          </h4>

          <div className="space-y-2.5">
            {records.length === 0 ? (
              <div className="p-4 bg-[#f9f9ff] rounded-lg border border-[#c3c6d6] text-xs text-[#585f6a] text-center">
                All daily entries verified and archived for this billing period.
              </div>
            ) : (
              records.map((rec) => {
                const isOffice = rec.locationType === 'office';
                const isMissing = isMissingCheckout(rec);

                return (
                  <div
                    key={rec.id}
                    className={`p-3.5 rounded-xl border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 text-xs transition-all ${
                      isMissing ? 'bg-[#fffaf8] border-[#f87171] ring-1 ring-[#f87171]/40' : 'bg-[#f9f9ff] border-[#c3c6d6]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`font-bold w-14 leading-tight p-1.5 rounded-lg text-center ${
                        isMissing ? 'bg-[#fee2e2] text-[#b91c1c]' : 'bg-[#e0e8ff] text-[#003d9b]'
                      }`}>
                        <div>{rec.monthName} {rec.date}</div>
                        <div className="text-[10px] font-normal opacity-80">{rec.dayOfWeek?.slice(0, 3)}</div>
                      </div>

                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`font-semibold ${isMissing ? 'text-[#b91c1c]' : 'text-[#041b3c]'}`}>
                            {rec.checkInTime} → {rec.checkOutTime || '--:--'}
                          </span>

                          {/* Location Type Badge */}
                          {isOffice ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-[#e0e8ff] text-[#003d9b] px-2 py-0.5 rounded-full border border-[#003d9b]/20">
                              <span className="material-symbols-outlined text-[12px]">corporate_fare</span>
                              Office
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-[#eceef4] text-[#434654] px-2 py-0.5 rounded-full border border-[#c3c6d6]">
                              <span className="material-symbols-outlined text-[12px]">travel_explore</span>
                              Outside
                            </span>
                          )}

                          {/* Missing Check-out badge */}
                          {isMissing && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-[#fee2e2] text-[#b91c1c] px-2 py-0.5 rounded-full border border-[#f87171]/50">
                              <span className="material-symbols-outlined text-[11px]">warning</span>
                              Missing Check-out
                            </span>
                          )}
                        </div>

                        {/* Notes and GPS Coordinates */}
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
                      {isMissing ? (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleStartConfirm(rec)}
                            className="px-3 py-1.5 bg-[#ea580c] hover:bg-[#c2410c] text-white font-bold rounded-lg text-[11px] shadow-xs flex items-center gap-1 cursor-pointer transition-all active:scale-95"
                          >
                            <span className="material-symbols-outlined text-[14px]">edit_note</span>
                            <span>Review & Confirm</span>
                          </button>
                        </div>
                      ) : (
                        <>
                          <span className="font-bold text-[#003d9b] text-[13px]">{rec.totalDuration}</span>
                          <span className="material-symbols-outlined text-[#10B981] text-[18px] filled" style={{ fontVariationSettings: "'FILL' 1" }}>
                            check_circle
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#c3c6d6] bg-[#f9f9ff] flex flex-col sm:flex-row justify-between items-center gap-3">
          <div className="text-xs text-[#737685]">
            {hasMissingCheckout ? (
              <span className="text-[#b91c1c] font-semibold flex items-center gap-1">
                <span className="material-symbols-outlined text-[15px]">info</span>
                Confirm all missing check-outs before approving timecard
              </span>
            ) : (
              <span>All attendance days validated for payroll export.</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-[#c3c6d6] text-[#585f6a] rounded-md text-xs font-semibold hover:bg-[#e0e8ff] cursor-pointer"
            >
              Close
            </button>
            {!isApproved && (
              <button
                disabled={hasMissingCheckout}
                onClick={() => {
                  if (hasMissingCheckout) return;
                  onApprove(review.id);
                  onClose();
                }}
                className={`px-5 py-2 rounded-md text-xs font-semibold shadow-sm flex items-center gap-1 ${
                  hasMissingCheckout
                    ? 'bg-[#c3c6d6] text-white cursor-not-allowed opacity-60'
                    : 'bg-[#003d9b] text-white hover:bg-[#0052cc] cursor-pointer'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">check</span>
                Approve Timecard
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Supervisor Confirm Check-out Form Sub-modal */}
      {editingRecord && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-[#c3c6d6] flex flex-col gap-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#e8edff]">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[22px] text-[#ea580c]">rate_review</span>
                <h3 className="text-base font-bold text-[#041b3c]">
                  Confirm Check-out for {editingRecord.monthName} {editingRecord.date}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingRecord(null)}
                className="text-[#737685] hover:text-[#041b3c]"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <p className="text-xs text-[#585f6a]">
              Intern <strong>{review.name}</strong> checked in at <strong>{editingRecord.checkInTime}</strong>. Enter the verified departure time and a confirmation note for the audit ledger.
            </p>

            {/* Presets */}
            <div>
              <label className="block text-[11px] font-bold text-[#434654] uppercase tracking-wider mb-1.5">
                Quick Event/Exhibition Presets
              </label>
              <div className="grid grid-cols-3 gap-2">
                {['10:30 PM', '11:45 PM', '01:00 AM', '02:00 AM', '03:00 AM'].map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setConfirmTime(t)}
                    className={`py-1 px-2 text-[11px] font-semibold rounded-lg border cursor-pointer ${
                      confirmTime === t
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
                Verified Check-out Time
              </label>
              <input
                type="text"
                value={confirmTime}
                onChange={(e) => setConfirmTime(e.target.value)}
                placeholder="e.g. 01:00 AM"
                className="w-full px-3 py-2 text-sm font-bold bg-[#f9f9ff] border border-[#c3c6d6] rounded-xl text-[#041b3c]"
              />
              <span className="text-[11px] text-[#585f6a] mt-0.5 block">
                Calculated duration: <strong>{calculateDurationStr(editingRecord.checkInTime, confirmTime).durationStr}</strong>
              </span>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#434654] uppercase tracking-wider mb-1">
                Supervisor Verification Note (Audit Trail)
              </label>
              <textarea
                rows={2}
                value={confirmNote}
                onChange={(e) => setConfirmNote(e.target.value)}
                placeholder="e.g. worked until 1 AM at event, forgot to check out"
                className="w-full px-3 py-2 text-xs bg-[#f9f9ff] border border-[#c3c6d6] rounded-xl text-[#041b3c] placeholder:text-[#8d9199]"
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-[#e8edff]">
              <button
                type="button"
                onClick={() => setEditingRecord(null)}
                className="w-full py-2 px-4 rounded-xl border border-[#c3c6d6] text-xs font-semibold text-[#434654] hover:bg-[#f1f3ff]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveConfirm}
                className="w-full py-2 px-4 rounded-xl text-xs font-bold text-white bg-[#ea580c] hover:bg-[#c2410c] flex items-center justify-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[16px]">check_circle</span>
                <span>Confirm Check-out</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

