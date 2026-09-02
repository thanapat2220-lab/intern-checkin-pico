import React from 'react';
import { InternMonthlyReview } from '../types';

interface DetailReviewModalProps {
  review: InternMonthlyReview;
  onClose: () => void;
  onApprove: (reviewId: string) => void;
}

export const DetailReviewModal: React.FC<DetailReviewModalProps> = ({
  review,
  onClose,
  onApprove,
}) => {
  const isApproved = review.status === 'approved';
  const records = review.records || [];
  const officeCount = review.officeDaysCount ?? records.filter((r) => r.locationType === 'office').length;
  const outsideCount = review.outsideDaysCount ?? records.filter((r) => r.locationType === 'outside').length;

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

                return (
                  <div
                    key={rec.id}
                    className="p-3.5 bg-[#f9f9ff] rounded-xl border border-[#c3c6d6] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 text-xs"
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
                        </div>

                        {/* Location Note and GPS Coordinates */}
                        <div className="text-[11px] text-[#585f6a] flex items-center gap-2 flex-wrap">
                          {(rec.locationNote || rec.notes) && (
                            <span className="font-medium text-[#041b3c]">
                              {rec.locationNote || rec.notes}
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
                      <span className="material-symbols-outlined text-[#10B981] text-[18px] filled" style={{ fontVariationSettings: "'FILL' 1" }}>
                        check_circle
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#c3c6d6] bg-[#f9f9ff] flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-[#c3c6d6] text-[#585f6a] rounded-md text-xs font-semibold hover:bg-[#e0e8ff] cursor-pointer"
          >
            Close
          </button>
          {!isApproved && (
            <button
              onClick={() => {
                onApprove(review.id);
                onClose();
              }}
              className="px-5 py-2 bg-[#003d9b] text-white rounded-md text-xs font-semibold hover:bg-[#0052cc] shadow-sm flex items-center gap-1 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">check</span>
              Approve Timecard
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
