import React, { useState, useEffect } from 'react';
import { LocationType, RawAttendanceLogEntry, UserProfile } from '../types';
import { calculateDurationStr } from '../utils/attendanceLogUtils';
import { adminUpdateAttendanceRecord } from '../services/dbService';

interface EditAttendanceRecordModalProps {
  isOpen: boolean;
  onClose: () => void;
  entry: RawAttendanceLogEntry | null;
  adminUser: UserProfile;
  onSuccess: () => void;
}

export const EditAttendanceRecordModal: React.FC<EditAttendanceRecordModalProps> = ({
  isOpen,
  onClose,
  entry,
  adminUser,
  onSuccess,
}) => {
  const [checkInTime, setCheckInTime] = useState<string>('');
  const [checkOutTime, setCheckOutTime] = useState<string>('');
  const [hasCheckOut, setHasCheckOut] = useState<boolean>(true);
  const [locationType, setLocationType] = useState<LocationType>('office');
  const [locationNote, setLocationNote] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  useEffect(() => {
    if (entry) {
      setCheckInTime(entry.checkInTime || '09:00 AM');
      setCheckOutTime(entry.checkOutTime || '');
      setHasCheckOut(Boolean(entry.checkOutTime));
      setLocationType(entry.locationType || 'office');
      setLocationNote(entry.locationNote || (entry.locationType === 'office' ? 'Bangkok HQ' : 'Outside Office / Field Site'));
      setNotes(entry.notes || '');
      setReason('');
      setErrorMsg('');
    }
  }, [entry]);

  if (!isOpen || !entry) return null;

  // Live duration preview
  const durationPreview = hasCheckOut && checkInTime && checkOutTime
    ? calculateDurationStr(checkInTime, checkOutTime).durationStr
    : 'Active / Ongoing Shift';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!checkInTime.trim()) {
      setErrorMsg('Please specify a valid check-in time.');
      return;
    }

    if (hasCheckOut && !checkOutTime.trim()) {
      setErrorMsg('Please specify a check-out time or uncheck "Has Checked Out".');
      return;
    }

    if (!reason.trim()) {
      setErrorMsg('Please provide a reason for this administrative edit (required for audit compliance).');
      return;
    }

    try {
      setIsSubmitting(true);
      await adminUpdateAttendanceRecord(
        {
          recordId: entry.recordId,
          checkInTime: checkInTime.trim(),
          checkOutTime: hasCheckOut ? checkOutTime.trim() : null,
          locationType,
          locationNote: locationType === 'office' ? 'Bangkok HQ' : locationNote.trim(),
          notes: notes.trim(),
          reason: reason.trim(),
        },
        adminUser
      );

      setIsSubmitting(false);
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error updating attendance record:', err);
      setIsSubmitting(false);
      setErrorMsg(err.message || 'Failed to update attendance record.');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white rounded-2xl max-w-xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-[#c3c6d6] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#c3c6d6] flex justify-between items-center bg-[#f1f3ff]">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-[#0052cc] text-white flex items-center justify-center shadow-xs">
              <span className="material-symbols-outlined text-[20px]">edit_calendar</span>
            </div>
            <div>
              <h3 className="text-[17px] font-bold text-[#041b3c]">Edit Attendance Record</h3>
              <p className="text-[11px] text-[#585f6a]">
                Admin correction for {entry.internName} • {entry.displayDate}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1 rounded-full text-[#737685] hover:text-[#041b3c] hover:bg-[#e0e8ff] transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 text-xs flex-1">
          {errorMsg && (
            <div className="p-3 bg-[#fee2e2] text-[#b91c1c] rounded-xl border border-[#f87171]/50 font-semibold flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">error</span>
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Intern & Date Info Bar */}
          <div className="p-3.5 bg-[#f9f9ff] border border-[#c3c6d6]/60 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              {entry.internAvatarUrl ? (
                <img
                  src={entry.internAvatarUrl}
                  alt={entry.internName}
                  className="w-9 h-9 rounded-full object-cover border border-[#c3c6d6]"
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-[#0052cc] text-white font-bold text-xs flex items-center justify-center">
                  {entry.internInitials}
                </div>
              )}
              <div>
                <span className="font-bold text-[#041b3c] block text-xs">{entry.internName}</span>
                <span className="text-[10px] text-[#585f6a]">
                  {entry.internDepartment} {entry.internTeam ? `• ${entry.internTeam}` : ''}
                </span>
              </div>
            </div>

            <div className="text-right">
              <span className="font-bold text-[#041b3c] block text-xs">{entry.displayDate}</span>
              <span className="text-[10px] text-[#737685] uppercase tracking-wide">
                {entry.dayOfWeek}
              </span>
            </div>
          </div>

          {/* Check-In & Check-Out Times */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[11px] font-bold text-[#434654] uppercase tracking-wider">
                  Check-in Time <span className="text-[#b91c1c]">*</span>
                </label>
                <span className="text-[10px] text-[#10b981] font-bold">Arrival</span>
              </div>
              <input
                type="text"
                value={checkInTime}
                onChange={(e) => setCheckInTime(e.target.value)}
                placeholder="e.g. 09:00 AM"
                className="w-full px-3 py-2 rounded-xl border border-[#c3c6d6] bg-[#f9f9ff] text-[#041b3c] font-mono font-bold text-xs"
                required
              />
              <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                {['08:30 AM', '09:00 AM', '09:15 AM', '10:00 AM'].map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setCheckInTime(t)}
                    className="px-2 py-0.5 text-[10px] font-semibold bg-[#f1f3ff] text-[#0052cc] rounded hover:bg-[#e0e8ff] transition-colors border border-[#c3c6d6]/60"
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[11px] font-bold text-[#434654] uppercase tracking-wider">
                  Check-out Time
                </label>
                <label className="flex items-center gap-1 text-[10px] font-bold text-[#585f6a] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hasCheckOut}
                    onChange={(e) => setHasCheckOut(e.target.checked)}
                    className="rounded text-[#0052cc]"
                  />
                  <span>Has Checked Out</span>
                </label>
              </div>

              {hasCheckOut ? (
                <>
                  <input
                    type="text"
                    value={checkOutTime}
                    onChange={(e) => setCheckOutTime(e.target.value)}
                    placeholder="e.g. 06:00 PM"
                    className="w-full px-3 py-2 rounded-xl border border-[#c3c6d6] bg-[#f9f9ff] text-[#041b3c] font-mono font-bold text-xs"
                  />
                  <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                    {['05:30 PM', '06:00 PM', '06:30 PM', '07:00 PM', '09:00 PM'].map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setCheckOutTime(t)}
                        className="px-2 py-0.5 text-[10px] font-semibold bg-[#f1f3ff] text-[#0052cc] rounded hover:bg-[#e0e8ff] transition-colors border border-[#c3c6d6]/60"
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <div className="p-2.5 bg-[#eff6ff] text-[#1e40af] rounded-xl border border-[#bfdbfe] text-[11px] font-medium flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px]">info</span>
                  <span>Will be marked as an Active / On-Duty shift</span>
                </div>
              )}
            </div>
          </div>

          {/* Location Type Selector */}
          <div>
            <label className="block text-[11px] font-bold text-[#434654] uppercase tracking-wider mb-1.5">
              Work Location Type <span className="text-[#b91c1c]">*</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setLocationType('office');
                  setLocationNote('Bangkok HQ');
                }}
                className={`p-3 rounded-xl border text-left flex items-center gap-2.5 transition-all cursor-pointer ${
                  locationType === 'office'
                    ? 'bg-[#e0e8ff] border-[#0052cc] text-[#003d9b] ring-2 ring-[#0052cc]/20'
                    : 'bg-[#f9f9ff] border-[#c3c6d6] text-[#434654] hover:bg-[#f1f3ff]'
                }`}
              >
                <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shadow-2xs">
                  <span className="material-symbols-outlined text-[18px] text-[#0052cc]">apartment</span>
                </div>
                <div>
                  <span className="font-bold block text-xs">Office Day</span>
                  <span className="text-[10px] opacity-80">Bangkok HQ On-Site</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setLocationType('outside');
                  setLocationNote('Outside Office / Field Site');
                }}
                className={`p-3 rounded-xl border text-left flex items-center gap-2.5 transition-all cursor-pointer ${
                  locationType === 'outside'
                    ? 'bg-[#fff7ed] border-[#ea580c] text-[#c2410c] ring-2 ring-[#ea580c]/20'
                    : 'bg-[#f9f9ff] border-[#c3c6d6] text-[#434654] hover:bg-[#f1f3ff]'
                }`}
              >
                <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shadow-2xs">
                  <span className="material-symbols-outlined text-[18px] text-[#ea580c]">travel_explore</span>
                </div>
                <div>
                  <span className="font-bold block text-xs">Outside / Travel</span>
                  <span className="text-[10px] opacity-80">Fieldwork or Client Site</span>
                </div>
              </button>
            </div>
          </div>

          {/* Location Description Note */}
          {locationType === 'outside' && (
            <div>
              <label className="block text-[11px] font-bold text-[#434654] uppercase tracking-wider mb-1">
                Outside Location / Site Details
              </label>
              <input
                type="text"
                value={locationNote}
                onChange={(e) => setLocationNote(e.target.value)}
                placeholder="e.g. Chiang Mai Exhibition, Client Site, etc."
                className="w-full px-3 py-2 rounded-xl border border-[#c3c6d6] bg-[#f9f9ff] text-[#041b3c] text-xs"
              />
            </div>
          )}

          {/* Shift Notes */}
          <div>
            <label className="block text-[11px] font-bold text-[#434654] uppercase tracking-wider mb-1">
              Shift Notes
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Logged hours confirmed with supervisor"
              className="w-full px-3 py-2 rounded-xl border border-[#c3c6d6] bg-[#f9f9ff] text-[#041b3c] text-xs"
            />
          </div>

          {/* Admin Audit Reason (Required for accountability) */}
          <div className="p-3.5 bg-[#fefce8] border border-[#fef08a] rounded-xl space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold text-[#854d0e]">
              <span className="material-symbols-outlined text-[16px]">history_edu</span>
              <span>Admin Correction Reason <span className="text-[#b91c1c]">*</span></span>
            </div>
            <p className="text-[11px] text-[#713f12]">
              State why you are modifying this record (e.g. "Supervisor confirmed intern left at 7 PM for team event"). This will be preserved in the audit log.
            </p>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Corrected departure time after supervisor review"
              className="w-full px-3 py-2 rounded-lg border border-[#fef08a] bg-white text-[#041b3c] text-xs font-semibold focus:ring-2 focus:ring-[#854d0e]/30 outline-none"
              required
            />
          </div>

          {/* Live Before & After Diff Box */}
          <div className="p-3 bg-[#f1f3ff] rounded-xl border border-[#c3c6d6]/60 space-y-2">
            <span className="text-[10px] font-bold text-[#585f6a] uppercase block tracking-wider">
              Preview of Changes to be Committed
            </span>
            <div className="grid grid-cols-2 gap-3 text-[11px]">
              <div className="p-2 bg-white rounded-lg border border-[#c3c6d6]/60">
                <span className="text-[10px] font-bold text-[#737685] block uppercase">Original Record</span>
                <p className="font-semibold text-[#041b3c] mt-0.5">
                  In: {entry.checkInTime} • Out: {entry.checkOutTime || 'Active'}
                </p>
                <p className="text-[#585f6a] capitalize">
                  Location: {entry.locationType} • Duration: {entry.duration || '—'}
                </p>
              </div>

              <div className="p-2 bg-[#ecfdf5] rounded-lg border border-[#a7f3d0]">
                <span className="text-[10px] font-bold text-[#065f46] block uppercase">New / Updated Values</span>
                <p className="font-bold text-[#065f46] mt-0.5">
                  In: {checkInTime} • Out: {hasCheckOut ? checkOutTime || '—' : 'Active'}
                </p>
                <p className="text-[#047857] capitalize">
                  Location: {locationType} • Duration: {durationPreview}
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#c3c6d6]">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-bold text-[#585f6a] hover:bg-[#f1f3ff] rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 bg-[#0052cc] hover:bg-[#0040a2] disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              {isSubmitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Updating Record...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[16px]">save</span>
                  <span>Commit Changes</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
