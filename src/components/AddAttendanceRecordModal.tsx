import React, { useState, useMemo, useRef, useEffect } from 'react';
import { AttendanceRecord, LocationType, UserProfile } from '../types';
import { calculateDurationStr } from '../utils/attendanceLogUtils';
import { adminCreateAttendanceRecord } from '../services/dbService';

interface AddAttendanceRecordModalProps {
  isOpen: boolean;
  onClose: () => void;
  interns: UserProfile[];
  adminUser: UserProfile;
  initialInternId?: string;
  onSuccess: (record: AttendanceRecord) => void;
}

export const AddAttendanceRecordModal: React.FC<AddAttendanceRecordModalProps> = ({
  isOpen,
  onClose,
  interns,
  adminUser,
  initialInternId,
  onSuccess,
}) => {
  const activeInterns = useMemo(() => {
    return interns.filter((u) => u.role === 'intern');
  }, [interns]);

  const [selectedInternId, setSelectedInternId] = useState<string>(
    initialInternId || (activeInterns[0]?.id || '')
  );

  // Searchable dropdown state
  const [internSearchQuery, setInternSearchQuery] = useState<string>('');
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Update selected intern when initialInternId changes
  useEffect(() => {
    if (initialInternId) {
      setSelectedInternId(initialInternId);
    } else if (activeInterns.length > 0 && !selectedInternId) {
      setSelectedInternId(activeInterns[0].id);
    }
  }, [initialInternId, activeInterns]);

  // Default to today's date YYYY-MM-DD in local time
  const getTodayDateStr = () => {
    const d = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };

  const getYesterdayDateStr = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };

  const [dateStr, setDateStr] = useState<string>(getTodayDateStr());
  const [checkInTime, setCheckInTime] = useState<string>('09:00 AM');
  const [checkOutTime, setCheckOutTime] = useState<string>('06:00 PM');
  const [hasCheckOut, setHasCheckOut] = useState<boolean>(true);
  const [locationType, setLocationType] = useState<LocationType>('office');
  const [locationNote, setLocationNote] = useState<string>('Bangkok HQ');
  const [notes, setNotes] = useState<string>('');
  const [reason, setReason] = useState<string>('Intern worked regular shift; manual entry by admin');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  if (!isOpen) return null;

  const selectedIntern = activeInterns.find((u) => u.id === selectedInternId) || activeInterns[0];

  // Filtered interns for searchable dropdown
  const filteredInterns = activeInterns.filter((i) => {
    if (!internSearchQuery.trim()) return true;
    const q = internSearchQuery.toLowerCase();
    const nameMatch = i.name.toLowerCase().includes(q);
    const deptMatch = i.department?.toLowerCase().includes(q);
    const teamMatch = i.team?.toLowerCase().includes(q);
    const emailMatch = i.email?.toLowerCase().includes(q);
    return nameMatch || deptMatch || teamMatch || emailMatch;
  });

  // Calculate day of week label for selected date
  const selectedDateFormatted = (() => {
    if (!dateStr) return '';
    try {
      const [y, m, d] = dateStr.split('-').map(Number);
      const dateObj = new Date(y, m - 1, d);
      return dateObj.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch (_) {
      return dateStr;
    }
  })();

  // Live duration preview
  const durationPreview = hasCheckOut && checkInTime && checkOutTime
    ? calculateDurationStr(checkInTime, checkOutTime).durationStr
    : 'Active / Ongoing Shift';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!selectedIntern) {
      setErrorMsg('Please select a valid intern.');
      return;
    }

    if (!dateStr) {
      setErrorMsg('Please select a shift date.');
      return;
    }

    if (!checkInTime.trim()) {
      setErrorMsg('Please specify a check-in time.');
      return;
    }

    if (hasCheckOut && !checkOutTime.trim()) {
      setErrorMsg('Please specify a check-out time or uncheck "Shift Completed".');
      return;
    }

    try {
      setIsSubmitting(true);
      // Parse local date (year, month, day) from YYYY-MM-DD
      const [year, month, day] = dateStr.split('-').map(Number);
      const targetDate = new Date(year, month - 1, day, 9, 0, 0);

      const created = await adminCreateAttendanceRecord(
        {
          intern: selectedIntern,
          date: targetDate,
          checkInTime: checkInTime.trim(),
          checkOutTime: hasCheckOut ? checkOutTime.trim() : null,
          locationType,
          locationNote: locationType === 'office' ? 'Bangkok HQ' : (locationNote.trim() || 'Outside Office / Field Site'),
          notes: notes.trim(),
          reason: reason.trim() || 'Manually added by administrator',
        },
        adminUser
      );

      setIsSubmitting(false);
      onSuccess(created);
      onClose();
    } catch (err: any) {
      console.error('Error creating manual attendance record:', err);
      setIsSubmitting(false);
      setErrorMsg(err.message || 'Failed to save attendance record.');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white rounded-2xl max-w-xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-[#c3c6d6] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#c3c6d6] flex justify-between items-center bg-[#f1f3ff]">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-[#0052cc] text-white flex items-center justify-center shadow-xs">
              <span className="material-symbols-outlined text-[22px]">add_circle</span>
            </div>
            <div>
              <h3 className="text-[17px] font-bold text-[#041b3c]">Add Attendance Record</h3>
              <p className="text-[11px] text-[#585f6a]">
                Manual backfill for missing shifts • Audit logged under {adminUser.name}
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

          {/* 1. Searchable Intern Dropdown */}
          <div ref={dropdownRef} className="relative">
            <div className="flex items-center justify-between mb-1">
              <label className="block text-[11px] font-bold text-[#434654] uppercase tracking-wider">
                Select Intern <span className="text-[#b91c1c]">*</span>
              </label>
              <span className="text-[10px] text-[#585f6a]">
                {activeInterns.length} interns registered
              </span>
            </div>

            {/* Selected Intern Card / Dropdown Trigger */}
            <div
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="p-3 bg-[#f9f9ff] border border-[#c3c6d6] hover:border-[#0052cc] rounded-xl flex items-center justify-between cursor-pointer transition-all shadow-2xs group"
            >
              {selectedIntern ? (
                <div className="flex items-center gap-3">
                  {selectedIntern.avatarUrl ? (
                    <img
                      src={selectedIntern.avatarUrl}
                      alt={selectedIntern.name}
                      className="w-8 h-8 rounded-full object-cover border border-[#c3c6d6]"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-[#0052cc] text-white font-bold text-xs flex items-center justify-center">
                      {selectedIntern.initials || selectedIntern.name.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[#041b3c] text-xs group-hover:text-[#0052cc] transition-colors">
                        {selectedIntern.name}
                      </span>
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-[#e0e8ff] text-[#003d9b]">
                        {selectedIntern.department}
                      </span>
                    </div>
                    <span className="text-[10px] text-[#585f6a]">
                      {selectedIntern.team || 'Intern'} • {selectedIntern.email}
                    </span>
                  </div>
                </div>
              ) : (
                <span className="text-[#737685]">Select an intern...</span>
              )}

              <div className="flex items-center gap-1 text-[#737685]">
                <span className="text-[11px] font-semibold text-[#0052cc] hidden sm:inline">Change</span>
                <span className="material-symbols-outlined text-[18px]">
                  {isDropdownOpen ? 'expand_less' : 'expand_more'}
                </span>
              </div>
            </div>

            {/* Floating Searchable Menu */}
            {isDropdownOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 z-30 bg-white border border-[#c3c6d6] rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                {/* Search Box */}
                <div className="p-2 border-b border-[#c3c6d6]/60 bg-[#f1f3ff] flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] text-[#737685]">search</span>
                  <input
                    type="text"
                    value={internSearchQuery}
                    onChange={(e) => setInternSearchQuery(e.target.value)}
                    placeholder="Search by intern name, department, or team..."
                    className="w-full bg-transparent text-xs text-[#041b3c] outline-none placeholder-[#737685]"
                    autoFocus
                  />
                  {internSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setInternSearchQuery('')}
                      className="text-[#737685] hover:text-[#041b3c]"
                    >
                      <span className="material-symbols-outlined text-[16px]">cancel</span>
                    </button>
                  )}
                </div>

                {/* List of Interns */}
                <div className="max-h-52 overflow-y-auto divide-y divide-[#c3c6d6]/30">
                  {filteredInterns.length === 0 ? (
                    <div className="p-4 text-center text-[#737685] text-xs">
                      No interns match "{internSearchQuery}"
                    </div>
                  ) : (
                    filteredInterns.map((intern) => {
                      const isSelected = intern.id === selectedInternId;
                      return (
                        <div
                          key={intern.id}
                          onClick={() => {
                            setSelectedInternId(intern.id);
                            setIsDropdownOpen(false);
                            setInternSearchQuery('');
                          }}
                          className={`p-2.5 flex items-center justify-between hover:bg-[#f1f3ff] cursor-pointer transition-colors ${
                            isSelected ? 'bg-[#e0e8ff]/60 font-bold' : ''
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            {intern.avatarUrl ? (
                              <img
                                src={intern.avatarUrl}
                                alt={intern.name}
                                className="w-7 h-7 rounded-full object-cover border border-[#c3c6d6]"
                              />
                            ) : (
                              <div className="w-7 h-7 rounded-full bg-[#0052cc] text-white font-bold text-[11px] flex items-center justify-center">
                                {intern.initials || intern.name.slice(0, 2).toUpperCase()}
                              </div>
                            )}
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs text-[#041b3c] font-bold">{intern.name}</span>
                                {intern.team && (
                                  <span className="text-[10px] text-[#585f6a]">({intern.team})</span>
                                )}
                              </div>
                              <span className="text-[10px] text-[#585f6a] block">
                                {intern.department} • {intern.email}
                              </span>
                            </div>
                          </div>

                          {isSelected && (
                            <span className="material-symbols-outlined text-[#0052cc] text-[18px]">
                              check_circle
                            </span>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 2. Date Picker */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-[11px] font-bold text-[#434654] uppercase tracking-wider">
                Shift Date <span className="text-[#b91c1c]">*</span>
              </label>
              {selectedDateFormatted && (
                <span className="text-[11px] font-bold text-[#0052cc]">
                  {selectedDateFormatted}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <input
                type="date"
                value={dateStr}
                onChange={(e) => setDateStr(e.target.value)}
                className="flex-1 px-3 py-2.5 rounded-xl border border-[#c3c6d6] bg-[#f9f9ff] text-[#041b3c] font-bold text-xs focus:ring-2 focus:ring-[#0052cc]/30 outline-none"
                required
              />
              <button
                type="button"
                onClick={() => setDateStr(getTodayDateStr())}
                className="px-2.5 py-2 rounded-xl border border-[#c3c6d6] text-[11px] font-bold text-[#041b3c] hover:bg-[#f1f3ff] transition-colors cursor-pointer"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => setDateStr(getYesterdayDateStr())}
                className="px-2.5 py-2 rounded-xl border border-[#c3c6d6] text-[11px] font-bold text-[#041b3c] hover:bg-[#f1f3ff] transition-colors cursor-pointer"
              >
                Yesterday
              </button>
            </div>
          </div>

          {/* 3. Check-In & Check-Out Times */}
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
                    className="px-2 py-0.5 text-[10px] font-semibold bg-[#f1f3ff] text-[#0052cc] rounded hover:bg-[#e0e8ff] transition-colors border border-[#c3c6d6]/60 cursor-pointer"
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
                        className="px-2 py-0.5 text-[10px] font-semibold bg-[#f1f3ff] text-[#0052cc] rounded hover:bg-[#e0e8ff] transition-colors border border-[#c3c6d6]/60 cursor-pointer"
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <div className="p-2.5 bg-[#eff6ff] text-[#1e40af] rounded-xl border border-[#bfdbfe] text-[11px] font-medium flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px]">info</span>
                  <span>Will be recorded as an Active / On-Duty shift</span>
                </div>
              )}
            </div>
          </div>

          {/* 4. Work Location Type Selector */}
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

          {/* Outside Location Description Note */}
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

          {/* 5. Shift Notes */}
          <div>
            <label className="block text-[11px] font-bold text-[#434654] uppercase tracking-wider mb-1">
              Shift Notes
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Full shift completed, verified by supervisor"
              className="w-full px-3 py-2 rounded-xl border border-[#c3c6d6] bg-[#f9f9ff] text-[#041b3c] text-xs"
            />
          </div>

          {/* 6. Admin Audit Reason (Mandatory for audit trail) */}
          <div className="p-3.5 bg-[#fefce8] border border-[#fef08a] rounded-xl space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold text-[#854d0e]">
              <span className="material-symbols-outlined text-[16px]">history_edu</span>
              <span>Admin Reason (Audit Trail Compliance) <span className="text-[#b91c1c]">*</span></span>
            </div>
            <p className="text-[11px] text-[#713f12]">
              Explain why this shift is being added manually. This is logged to the immutable audit trail with your admin account details.
            </p>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Intern forgot to check in; supervisor confirmed attendance"
              className="w-full px-3 py-2 rounded-lg border border-[#fef08a] bg-white text-[#041b3c] text-xs font-semibold focus:ring-2 focus:ring-[#854d0e]/30 outline-none"
              required
            />
          </div>

          {/* Calculated Summary Preview Bar */}
          <div className="p-3 bg-[#f1f3ff] rounded-xl flex items-center justify-between border border-[#c3c6d6]/60">
            <div>
              <span className="text-[10px] font-bold text-[#585f6a] uppercase block">
                Calculated Shift Duration
              </span>
              <span className="text-[13px] font-black text-[#0052cc]">{durationPreview}</span>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-bold text-[#585f6a] uppercase block">
                Payroll Impact
              </span>
              <span className="text-[13px] font-bold text-[#10b981]">
                +1 Day Worked (THB {selectedIntern?.dailyRateTHB || 400})
              </span>
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
                  <span>Saving Record...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[16px]">save</span>
                  <span>Save Attendance Record</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
