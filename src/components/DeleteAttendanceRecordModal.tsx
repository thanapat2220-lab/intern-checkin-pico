import React, { useState } from 'react';
import { RawAttendanceLogEntry, UserProfile } from '../types';
import { adminDeleteAttendanceRecord } from '../services/dbService';

interface DeleteAttendanceRecordModalProps {
  isOpen: boolean;
  onClose: () => void;
  entry: RawAttendanceLogEntry | null;
  adminUser: UserProfile;
  onSuccess: () => void;
}

export const DeleteAttendanceRecordModal: React.FC<DeleteAttendanceRecordModalProps> = ({
  isOpen,
  onClose,
  entry,
  adminUser,
  onSuccess,
}) => {
  const [reason, setReason] = useState<string>('Accidental check-in on holiday / scheduled day off');
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  if (!isOpen || !entry) return null;

  const handleDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!reason.trim()) {
      setErrorMsg('Please specify a reason for deleting this record (required for audit trail).');
      return;
    }

    try {
      setIsDeleting(true);
      await adminDeleteAttendanceRecord(entry.recordId, adminUser, reason.trim());
      setIsDeleting(false);
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error deleting attendance record:', err);
      setIsDeleting(false);
      setErrorMsg(err.message || 'Failed to delete attendance record.');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-[#c3c6d6] overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-[#fee2e2] bg-[#fffaf8] flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#fee2e2] text-[#b91c1c] flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[22px]">delete_forever</span>
          </div>
          <div>
            <h3 className="text-[17px] font-bold text-[#b91c1c]">Delete Attendance Record</h3>
            <p className="text-[11px] text-[#737685]">
              Administrative deletion safeguard • Audit recorded
            </p>
          </div>
        </div>

        {/* Content */}
        <form onSubmit={handleDelete} className="p-6 space-y-4 text-xs">
          {errorMsg && (
            <div className="p-3 bg-[#fee2e2] text-[#b91c1c] rounded-xl border border-[#f87171]/50 font-semibold flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">error</span>
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="p-3.5 bg-[#f9f9ff] rounded-xl border border-[#c3c6d6]/60 space-y-1.5">
            <span className="text-[10px] font-bold text-[#585f6a] uppercase tracking-wider block">
              Shift Being Deleted
            </span>
            <div className="flex items-center justify-between">
              <span className="font-bold text-[#041b3c] text-[13px]">{entry.internName}</span>
              <span className="text-[11px] font-semibold text-[#0052cc]">{entry.displayDate}</span>
            </div>
            <div className="text-[11px] text-[#585f6a] flex items-center gap-2 flex-wrap">
              <span>{entry.checkInTime} — {entry.checkOutTime || 'Active'}</span>
              <span>•</span>
              <span className="capitalize">{entry.locationType}</span>
              {entry.duration && (
                <>
                  <span>•</span>
                  <span>{entry.duration}</span>
                </>
              )}
            </div>
          </div>

          <div className="p-3 bg-[#fff7ed] text-[#7c2d12] rounded-xl border border-[#fed7aa] text-[11px] leading-relaxed flex items-start gap-2">
            <span className="material-symbols-outlined text-[18px] text-[#ea580c] shrink-0 mt-0.5">
              warning
            </span>
            <div>
              <span className="font-bold block">Payroll & Review Impact:</span>
              This record will be permanently removed. The intern's Days Worked count and payroll compensation for <strong>{entry.monthYear}</strong> will automatically be reduced by 1 day. A permanent record of this action will be saved in the Audit Trail.
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-[#434654] uppercase tracking-wider mb-1">
              Reason for Deletion <span className="text-[#b91c1c]">*</span>
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Mistaken check-in on day off / official holiday"
              className="w-full px-3 py-2 rounded-xl border border-[#c3c6d6] bg-[#f9f9ff] text-[#041b3c] text-xs font-semibold focus:ring-2 focus:ring-[#b91c1c]/30 outline-none"
              required
            />
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#c3c6d6]/60">
            <button
              type="button"
              onClick={onClose}
              disabled={isDeleting}
              className="px-4 py-2 text-xs font-bold text-[#585f6a] hover:bg-[#f1f3ff] rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isDeleting}
              className="px-5 py-2.5 bg-[#b91c1c] hover:bg-[#991b1b] disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              {isDeleting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Deleting Record...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[16px]">delete</span>
                  <span>Confirm Deletion</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
