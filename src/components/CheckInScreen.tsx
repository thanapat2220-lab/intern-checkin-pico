import React, { useState, useEffect, useMemo } from 'react';
import { AttendanceRecord, LocationType, UserProfile } from '../types';
import { formatMonthYear, formatShortMonth } from '../utils/dateUtils';
import { calculateDurationStr, isMissingCheckout } from '../utils/attendanceLogUtils';
import { formatMergedNotes, getMergedRecordNotes } from '../utils/noteUtils';

interface CheckInScreenProps {
  user: UserProfile;
  attendanceLogs: AttendanceRecord[];
  onCheckIn: (record: AttendanceRecord) => void;
  onCheckOut: (recordId: string, checkOutTime: string, note?: string) => void;
  onNavigate: (tab: 'checkin' | 'history' | 'profile') => void;
  onOpenMenu: () => void;
}

const OFFICE_COORDINATES = {
  lat: 13.7563,
  lng: 100.5018,
};

export const CheckInScreen: React.FC<CheckInScreenProps> = ({
  user,
  attendanceLogs,
  onCheckIn,
  onCheckOut,
  onNavigate,
  onOpenMenu,
}) => {
  // Current local live time
  const [currentTime, setCurrentTime] = useState<string>(() =>
    new Date().toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    })
  );
  const [currentDateStr, setCurrentDateStr] = useState<string>(() =>
    new Date().toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    })
  );
  const [locationType, setLocationType] = useState<LocationType>('office');
  const [locationNote, setLocationNote] = useState<string>('');
  const [checkOutNote, setCheckOutNote] = useState<string>('');
  const [coords, setCoords] = useState<{ lat: number; lng: number }>({
    lat: OFFICE_COORDINATES.lat,
    lng: OFFICE_COORDINATES.lng,
  });
  const [isLocating, setIsLocating] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Identify today's record accurately by matching today's date or monthYear and user.id
  const today = new Date();
  const todayMonthYear = formatMonthYear(today);
  const todayDateNum = today.getDate();
  const storageKey = `pico_checkin_${user.id}_${todayMonthYear}_${todayDateNum}`;

  // Local optimistic record state for instant zero-latency UI updates
  const [localTodayRecord, setLocalTodayRecord] = useState<AttendanceRecord | null>(() => {
    // Check props first
    const fromProps = attendanceLogs.find(
      (log) =>
        log.date === todayDateNum &&
        (log.monthYear === todayMonthYear || !log.monthYear) &&
        (log.internId === user.id || !log.internId)
    );
    if (fromProps) return fromProps;

    // Fallback to local storage cache for instant resilience
    try {
      const cached = localStorage.getItem(storageKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && parsed.date === todayDateNum) {
          return parsed as AttendanceRecord;
        }
      }
    } catch (_) {}
    return null;
  });

  // Sync with incoming attendanceLogs prop updates
  useEffect(() => {
    const found = attendanceLogs.find(
      (log) =>
        log.date === todayDateNum &&
        (log.monthYear === todayMonthYear || !log.monthYear) &&
        (log.internId === user.id || !log.internId)
    );
    if (found) {
      setLocalTodayRecord(found);
      try {
        localStorage.setItem(storageKey, JSON.stringify(found));
      } catch (_) {}
    }
  }, [attendanceLogs, todayDateNum, todayMonthYear, user.id, storageKey]);

  // Confirmation Modal state for accidental tap prevention
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    type: 'check_in' | 'check_out';
    time: string;
  } | null>(null);

  const todayRecord = localTodayRecord;

  // Find any previous day's record that has a missing check-out
  // Rule: If an intern checked in on a given day but has NOT checked out by the time a new calendar day begins
  const missedCheckoutRecord = useMemo(() => {
    return (
      attendanceLogs.find(
        (log) =>
          (log.internId === user.id || !log.internId) &&
          log.id !== todayRecord?.id &&
          isMissingCheckout(log)
      ) || null
    );
  }, [attendanceLogs, user.id, todayRecord?.id]);

  // Modal state for logging missed check-out from a previous day
  const [isMissedCheckoutModalOpen, setIsMissedCheckoutModalOpen] = useState(false);
  const [missedCheckoutTime, setMissedCheckoutTime] = useState('11:30 PM');
  const [missedCheckoutNote, setMissedCheckoutNote] = useState('');

  // Determine today's state:
  // 1. not_checked_in: todayRecord is null
  // 2. checked_in (active shift): todayRecord exists and has NO checkOutTime
  // 3. completed (checked out): todayRecord exists and has checkOutTime
  const isArchived = user.status === 'archived' || Boolean(user.isArchived);
  const hasNotCheckedIn = !todayRecord && !isArchived;
  const isCurrentlyCheckedIn = !!todayRecord && !todayRecord.checkOutTime && !isArchived;
  const isCompletedToday = !!todayRecord && !!todayRecord.checkOutTime;

  // Handle resolving missed check-out
  const handleResolveMissedCheckout = (selectedTime: string, noteText: string) => {
    if (!missedCheckoutRecord) return;
    const finalNote = noteText.trim() || undefined;
    onCheckOut(missedCheckoutRecord.id, selectedTime, finalNote);
    setIsMissedCheckoutModalOpen(false);
    setToastMessage(
      `Check-out recorded for ${missedCheckoutRecord.monthName} ${missedCheckoutRecord.date} at ${selectedTime}. You may now check in for today!`
    );
  };

  // Update clock & fetch initial device GPS coordinates
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const timeStr = now.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
      const dateStr = now.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      });
      setCurrentTime(timeStr);
      setCurrentDateStr(dateStr);
    };

    updateTime();
    const interval = setInterval(updateTime, 10000);

    // Capture real GPS coordinates if geolocation available
    if ('geolocation' in navigator) {
      setIsLocating(true);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCoords({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
          setIsLocating(false);
        },
        (error) => {
          console.log('GPS Geolocation note:', error.message);
          setIsLocating(false);
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    }

    return () => clearInterval(interval);
  }, []);

  // Request Check-in or Check-out (opens confirmation dialog to prevent accidental taps)
  const handleRequestAction = () => {
    if (isArchived) {
      setToastMessage('Your internship account has ended. Check-in is deactivated.');
      return;
    }

    if (isCompletedToday) {
      return; // Shift already completed for today
    }

    if (isCurrentlyCheckedIn && todayRecord) {
      setConfirmDialog({
        isOpen: true,
        type: 'check_out',
        time: currentTime,
      });
    } else if (hasNotCheckedIn) {
      // If intern has a missing check-out from a previous calendar day, require logging it first
      if (missedCheckoutRecord) {
        setIsMissedCheckoutModalOpen(true);
        setToastMessage(
          `Please log your check-out for ${missedCheckoutRecord.monthName} ${missedCheckoutRecord.date} before checking in for today.`
        );
        return;
      }

      setConfirmDialog({
        isOpen: true,
        type: 'check_in',
        time: currentTime,
      });
    }
  };

  // Finalize Check-in or Check-out after user confirms in the modal
  const handleConfirmAction = () => {
    if (!confirmDialog) return;
    const actionTime = confirmDialog.time || currentTime;

    if (confirmDialog.type === 'check_in') {
      const now = new Date();
      const inNote = locationNote.trim();
      const newLog: AttendanceRecord = {
        id: `att-${user.id}-${Date.now()}`,
        internId: user.id,
        monthYear: formatMonthYear(now),
        date: now.getDate(),
        monthName: formatShortMonth(now),
        dayOfWeek: now.toLocaleDateString('en-US', { weekday: 'long' }),
        checkInTime: actionTime,
        checkOutTime: null,
        totalDuration: 'Active',
        totalMinutes: 0,
        status: 'normal',
        locationType: locationType,
        locationNote: inNote || (locationType === 'office' ? 'Bangkok HQ' : 'Outside Office / Traveling'),
        coordinates: { ...coords },
        checkInNote: inNote || undefined,
        notes: inNote || undefined,
      };

      // 1. Immediately update local state so Daily Summary displays time & button switches to Check Out
      setLocalTodayRecord(newLog);
      try {
        localStorage.setItem(storageKey, JSON.stringify(newLog));
      } catch (_) {}

      // 2. Close confirmation modal
      setConfirmDialog(null);

      // 3. Notify parent/Firestore
      onCheckIn(newLog);

      // 4. Feedback toast
      setToastMessage(
        locationType === 'office'
          ? `Checked in at ${actionTime} (Office)`
          : `Checked in at ${actionTime} (Outside / Traveling)`
      );
      setTimeout(() => setToastMessage(null), 4000);
    } else if (confirmDialog.type === 'check_out' && todayRecord) {
      const { durationStr, totalMinutes } = calculateDurationStr(todayRecord.checkInTime, actionTime);
      const outNote = checkOutNote.trim();
      const inNote =
        todayRecord.checkInNote ||
        (todayRecord.locationNote &&
        todayRecord.locationNote !== 'Bangkok HQ' &&
        todayRecord.locationNote !== 'Outside Office / Traveling' &&
        !todayRecord.locationNote.startsWith('Bangkok HQ -')
          ? todayRecord.locationNote
          : todayRecord.notes && !todayRecord.notes.startsWith('[In]')
          ? todayRecord.notes
          : '');
      const mergedNotes = formatMergedNotes(inNote, outNote);

      const updatedLog: AttendanceRecord = {
        ...todayRecord,
        checkOutTime: actionTime,
        totalDuration: durationStr,
        totalMinutes: totalMinutes,
        checkInNote: inNote || todayRecord.checkInNote,
        checkOutNote: outNote || undefined,
        notes: mergedNotes,
      };

      // 1. Immediately update local state so Daily Summary and Completed states show right away
      setLocalTodayRecord(updatedLog);
      try {
        localStorage.setItem(storageKey, JSON.stringify(updatedLog));
      } catch (_) {}

      // 2. Close confirmation modal
      setConfirmDialog(null);
      setCheckOutNote('');

      // 3. Notify parent/Firestore
      onCheckOut(todayRecord.id, actionTime, outNote || undefined);

      // 4. Feedback toast
      setToastMessage(`Checked out at ${actionTime}. Have a great rest of your day!`);
      setTimeout(() => setToastMessage(null), 4000);
    }
  };

  return (
    <div className="bg-[#f9f9ff] text-[#041b3c] min-h-screen flex flex-col pt-16 pb-24 overflow-x-hidden antialiased font-sans relative">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-[#041b3c] text-white px-4 py-2.5 rounded-lg shadow-lg flex items-center gap-2 text-sm font-medium animate-bounce border border-[#c3c6d6]">
          <span className="material-symbols-outlined text-[#10B981] text-[20px]">check_circle</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* TopAppBar */}
      <header className="fixed top-0 w-full z-40 bg-[#f9f9ff] border-b border-[#c3c6d6] flex justify-between items-center px-6 h-16 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
        <button
          onClick={onOpenMenu}
          className="text-[#434654] hover:bg-[#e8edff] transition-colors p-2 rounded-full cursor-pointer active:opacity-80 flex items-center justify-center"
          title="Menu & Switch Screens"
          aria-label="Open Navigation Menu"
        >
          <span className="material-symbols-outlined">menu</span>
        </button>
        <h1 className="text-[20px] font-semibold text-[#003d9b] tracking-tight">Intern Check-in</h1>
        <button
          onClick={() => onNavigate('profile')}
          className="w-10 h-10 rounded-full overflow-hidden border border-[#c3c6d6] bg-[#e8edff] flex items-center justify-center cursor-pointer hover:ring-2 hover:ring-[#0052cc] transition-all"
          title="View Profile"
        >
          {user.avatarUrl ? (
            <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
          ) : (
            <span className="material-symbols-outlined text-[#585f6a]">person</span>
          )}
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-4 sm:px-6 py-4 flex flex-col items-center justify-start gap-5 max-w-md mx-auto w-full">
        {/* Gentle Reminder: Missing Check-out from Previous Day */}
        {missedCheckoutRecord && (
          <div className="w-full bg-[#fff7ed] border-2 border-[#f97316]/50 rounded-xl p-4 shadow-sm flex flex-col gap-3 animate-fadeIn">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-[#ea580c] text-white flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                <span className="material-symbols-outlined text-[22px]">history_toggle_off</span>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[14px] font-bold text-[#9a3412]">
                    Missing Check-out from Previous Shift
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#fee2e2] text-[#b91c1c] border border-[#f87171]/40">
                    Action Required
                  </span>
                </div>
                <p className="text-[12px] text-[#7c2d12] mt-1 leading-relaxed">
                  You checked in on <strong>{missedCheckoutRecord.dayOfWeek}, {missedCheckoutRecord.monthName} {missedCheckoutRecord.date}</strong> at <strong>{missedCheckoutRecord.checkInTime}</strong>, but no check-out was recorded before midnight.
                </p>
                <div className="text-[11px] text-[#9a3412] mt-2 bg-white/80 rounded-lg p-2.5 border border-[#f97316]/20 flex items-start gap-1.5">
                  <span className="material-symbols-outlined text-[15px] text-[#ea580c] shrink-0 mt-0.5">info</span>
                  <span>
                    <em>Event & exhibition work often finishes late into the night. Please log your actual finish time for that day before checking in for today.</em>
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#f97316]/20">
              <button
                type="button"
                id="logMissedCheckoutBannerBtn"
                onClick={() => setIsMissedCheckoutModalOpen(true)}
                className="w-full sm:w-auto px-4 py-2.5 bg-[#ea580c] hover:bg-[#c2410c] text-white rounded-lg text-xs font-bold shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
              >
                <span className="material-symbols-outlined text-[16px]">alarm_on</span>
                <span>Log Missed Check-out Time</span>
              </button>
            </div>
          </div>
        )}

        {/* Work Location Type Selector (Only shown before initial check-in) */}
        {hasNotCheckedIn && (
          <div className="w-full bg-white border border-[#c3c6d6] rounded-xl p-4 shadow-sm">
            <label className="block text-[12px] font-bold text-[#041b3c] uppercase tracking-wider mb-2.5">
              Work Location Type
            </label>
            
            <div className="grid grid-cols-2 gap-2.5">
              {/* Option 1: At Office */}
              <button
                type="button"
                onClick={() => setLocationType('office')}
                className={`p-3 rounded-lg border text-left flex items-center gap-2.5 transition-all cursor-pointer ${
                  locationType === 'office'
                    ? 'bg-[#e0e8ff] border-[#003d9b] text-[#003d9b] font-semibold shadow-xs ring-1 ring-[#003d9b]'
                    : 'bg-[#f9f9ff] border-[#c3c6d6] text-[#434654] hover:bg-[#f1f3ff]'
                }`}
              >
                <span className="material-symbols-outlined text-[20px]">corporate_fare</span>
                <div className="leading-tight">
                  <div className="text-[13px] font-semibold">At Office</div>
                  <div className="text-[10px] opacity-75 font-normal">HQ / Main Office</div>
                </div>
              </button>

              {/* Option 2: Outside Office / Traveling */}
              <button
                type="button"
                onClick={() => setLocationType('outside')}
                className={`p-3 rounded-lg border text-left flex items-center gap-2.5 transition-all cursor-pointer ${
                  locationType === 'outside'
                    ? 'bg-[#dae0ee] border-[#041b3c] text-[#041b3c] font-semibold shadow-xs ring-1 ring-[#041b3c]'
                    : 'bg-[#f9f9ff] border-[#c3c6d6] text-[#434654] hover:bg-[#f1f3ff]'
                }`}
              >
                <span className="material-symbols-outlined text-[20px]">travel_explore</span>
                <div className="leading-tight">
                  <div className="text-[13px] font-semibold">Outside / Traveling</div>
                  <div className="text-[10px] opacity-75 font-normal">Client, Field, Other</div>
                </div>
              </button>
            </div>

            {/* Optional Location Note */}
            <div className="mt-3">
              <div className="flex justify-between items-center mb-1">
                <label className="text-[11px] font-medium text-[#434654]">
                  Location / Note <span className="text-[#737685] font-normal">(Optional)</span>
                </label>
                {locationType === 'outside' && (
                  <span className="text-[10px] text-[#003d9b] font-medium">e.g. Chiang Mai, Client site</span>
                )}
              </div>
              <input
                type="text"
                value={locationNote}
                onChange={(e) => setLocationNote(e.target.value)}
                placeholder={
                  locationType === 'outside'
                    ? 'e.g. Client site - Chiang Mai, WFH, Rayong plant...'
                    : 'e.g. Bangkok HQ - 14th Floor, Innovation Lab...'
                }
                className="w-full px-3 py-2 text-[13px] bg-[#f9f9ff] border border-[#c3c6d6] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#003d9b] focus:border-[#003d9b] text-[#041b3c] placeholder:text-[#8d9199]"
              />
            </div>
          </div>
        )}

        {/* Active Shift Indicator Card */}
        {isCurrentlyCheckedIn && todayRecord && (
          <div className="w-full bg-[#e0e8ff]/80 border border-[#003d9b]/30 rounded-xl p-4 shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#003d9b] text-white flex items-center justify-center">
                <span className="material-symbols-outlined text-[22px]">
                  {todayRecord.locationType === 'office' ? 'corporate_fare' : 'travel_explore'}
                </span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-bold text-[#041b3c]">Currently On Duty</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      todayRecord.locationType === 'office'
                        ? 'bg-[#0052cc] text-white'
                        : 'bg-[#585f6a] text-white'
                    }`}
                  >
                    {todayRecord.locationType === 'office' ? 'Office' : 'Outside'}
                  </span>
                </div>
                <p className="text-[12px] text-[#434654] mt-0.5 font-medium">
                  {todayRecord.locationNote || (todayRecord.locationType === 'office' ? 'Bangkok HQ' : 'Outside Office / Traveling')}
                </p>
                <p className="text-[11px] text-[#0052cc] font-semibold mt-0.5">
                  Checked in at {todayRecord.checkInTime}
                </p>
              </div>
            </div>
            <div className="flex flex-col items-end">
              <span className="flex h-2.5 w-2.5 relative mb-1">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#0052cc] opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#0052cc]" />
              </span>
              <span className="text-[11px] font-bold text-[#003d9b]">Shift Active</span>
            </div>
          </div>
        )}

        {/* Completed Shift Banner */}
        {isCompletedToday && todayRecord && (
          <div className="w-full bg-[#ecfdf5] border border-[#10b981]/40 rounded-xl p-4 shadow-sm flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-[#10b981] text-white flex items-center justify-center">
                  <span className="material-symbols-outlined text-[20px]">task_alt</span>
                </div>
                <div>
                  <h3 className="text-[13px] font-bold text-[#065f46]">Attendance Completed Today</h3>
                  <p className="text-[11px] text-[#047857]">
                    {todayRecord.locationNote || (todayRecord.locationType === 'office' ? 'Bangkok HQ' : 'Outside Office')}
                  </p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-[#10b981]/20 text-[#065f46] text-[11px] font-bold">
                {todayRecord.totalDuration && todayRecord.totalDuration !== 'Active'
                  ? todayRecord.totalDuration
                  : calculateDurationStr(todayRecord.checkInTime, todayRecord.checkOutTime).durationStr}
              </span>
            </div>
            <div className="text-[12px] font-semibold text-[#047857] bg-white/80 rounded-lg p-2.5 border border-[#10b981]/20 flex items-center justify-between">
              <span>🕒 Checked in at <strong>{todayRecord.checkInTime}</strong></span>
              <span className="text-[#9ca3af]">•</span>
              <span>Checked out at <strong>{todayRecord.checkOutTime}</strong></span>
            </div>
          </div>
        )}

        {/* Account Archived / Deactivated Banner */}
        {isArchived && (
          <div className="w-full bg-[#fef2f2] border border-[#ef4444]/40 rounded-xl p-4 shadow-sm text-center space-y-1.5">
            <div className="inline-flex items-center gap-2 text-[#b91c1c] font-bold text-sm">
              <span className="material-symbols-outlined text-[20px]">person_off</span>
              <span>Account Inactive — Internship Ended</span>
            </div>
            <p className="text-xs text-[#7f1d1d] max-w-sm mx-auto leading-relaxed">
              Your internship account has been archived. Check-in and check-out are deactivated.
              All your historical attendance and payroll records remain safely preserved.
            </p>
            {user.archivedReason && (
              <span className="inline-block text-[11px] bg-red-100 text-red-800 font-medium px-2.5 py-0.5 rounded-full">
                Status: {user.archivedReason}
              </span>
            )}
          </div>
        )}

        {/* Check-in / Check-out Button Area */}
        <div className="relative w-full flex justify-center items-center py-3">
          {/* Decorative outer pulsing rings */}
          {!isCompletedToday && !isArchived && (
            <>
              <div
                className={`absolute inset-0 m-auto w-60 h-60 rounded-full border pulse-ring transition-colors ${
                  isCurrentlyCheckedIn ? 'border-[#ea580c]/30' : 'border-[#003d9b]/20'
                }`}
              />
              <div
                className={`absolute inset-0 m-auto w-52 h-52 rounded-full border transition-colors ${
                  isCurrentlyCheckedIn ? 'border-[#ea580c]/40' : 'border-[#003d9b]/40'
                }`}
              />
            </>
          )}

          {/* Main Button with Dynamic States:
              1. Archived / Deactivated: Gray disabled button
              2. Not Checked in: Blue 'Check In' button (or Orange 'Log Missed Out' if past shift unclosed)
              3. Checked in: Orange/Red 'Check Out' button
              4. Completed: Disabled Green 'Completed for Today' button
          */}
          <button
            onClick={handleRequestAction}
            disabled={isCompletedToday || isArchived}
            id="checkInBtn"
            className={`checkin-button relative z-10 w-44 h-44 rounded-full text-white flex flex-col items-center justify-center gap-1.5 group transition-all duration-300 ${
              isArchived
                ? 'bg-[#9ca3af] shadow-none opacity-80 cursor-not-allowed'
                : isCompletedToday
                ? 'bg-[#10b981] shadow-[0_8px_28px_rgba(16,185,129,0.25)] opacity-95 cursor-default'
                : isCurrentlyCheckedIn
                ? 'bg-[#ea580c] shadow-[0_8px_32px_rgba(234,88,12,0.38)] hover:bg-[#c2410c] active:scale-95 cursor-pointer'
                : missedCheckoutRecord
                ? 'bg-[#f97316] shadow-[0_8px_32px_rgba(249,115,22,0.4)] hover:bg-[#ea580c] active:scale-95 cursor-pointer ring-4 ring-[#f97316]/20'
                : 'bg-[#0052cc] shadow-[0_8px_32px_rgba(0,82,204,0.35)] hover:bg-[#0040a2] active:scale-95 cursor-pointer'
            }`}
          >
            <div className="absolute inset-0 rounded-full bg-white opacity-0 group-hover:opacity-10 transition-opacity" />
            
            <span
              className={`material-symbols-outlined text-white transition-transform ${
                !isCompletedToday && !isArchived ? 'group-hover:scale-110' : ''
              } duration-200`}
              style={{ fontSize: '42px' }}
            >
              {isArchived
                ? 'block'
                : isCompletedToday
                ? 'verified'
                : isCurrentlyCheckedIn
                ? 'logout'
                : missedCheckoutRecord
                ? 'history_toggle_off'
                : 'fingerprint'}
            </span>

            <span className="text-[18px] font-bold tracking-wide text-center leading-tight">
              {isArchived
                ? 'Deactivated'
                : isCompletedToday
                ? 'Completed'
                : isCurrentlyCheckedIn
                ? 'Check Out'
                : missedCheckoutRecord
                ? 'Log Missed Out'
                : 'Check In'}
            </span>

            <span className="text-[11px] opacity-90 font-normal px-2 text-center leading-tight">
              {isArchived
                ? 'Internship Ended'
                : isCompletedToday
                ? 'Logged for today'
                : isCurrentlyCheckedIn
                ? 'Tap to end shift'
                : missedCheckoutRecord
                ? `${missedCheckoutRecord.monthName} ${missedCheckoutRecord.date} unclosed`
                : 'Tap to record entry'}
            </span>
          </button>
        </div>

        {/* GPS Coordinates & Live Location Card */}
        <div className="w-full bg-white border border-[#c3c6d6] rounded-xl p-4 relative overflow-hidden shadow-sm">
          <div className="absolute inset-0 opacity-30 bg-map-pattern pointer-events-none" />
          
          <div className="relative z-10 flex flex-col gap-3">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-[#e0e8ff] text-[#003d9b] flex items-center justify-center">
                  <span className="material-symbols-outlined text-[18px]">location_on</span>
                </div>
                <h2 className="text-[14px] font-semibold text-[#041b3c]">GPS Coordinates Captured</h2>
              </div>

              {/* Informational badge */}
              <div className="px-2.5 py-0.5 rounded-full bg-[#f1f3ff] text-[#003d9b] border border-[#c3c6d6]/60 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
                <span className="text-[11px] font-medium">GPS Active</span>
              </div>
            </div>

            <div className="pl-9 flex flex-col gap-1 border-l-2 border-[#e0e8ff] ml-3 py-0.5">
              <p className="text-[13px] text-[#434654] flex items-center gap-1.5 font-mono">
                <span className="material-symbols-outlined text-[15px] opacity-70">my_location</span>
                {coords.lat.toFixed(4)}° N, {coords.lng.toFixed(4)}° E
                {isLocating && <span className="text-[10px] text-[#737685]">(updating...)</span>}
              </p>
              <p className="text-[13px] text-[#585f6a] flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[15px] opacity-70">schedule</span>
                {currentDateStr} • {currentTime}
              </p>
            </div>
          </div>
        </div>

        {/* Daily Summary Card */}
        <div className="w-full bg-white border border-[#c3c6d6] rounded-xl p-4 shadow-sm">
          <h3 className="text-[11px] font-semibold text-[#585f6a] uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[16px]">calendar_today</span>
            Daily Summary
          </h3>
          <div className="flex justify-between items-center bg-[#f9f9ff] p-3 rounded-lg border border-[#e8edff]">
            <div className="flex flex-col gap-0.5">
              <span className="text-[11px] font-medium text-[#434654]">Check-in</span>
              <span className="text-[15px] font-bold text-[#041b3c]">
                {todayRecord?.checkInTime || '--:--'}
              </span>
            </div>
            <div className="h-7 w-px bg-[#c3c6d6]" />
            <div className="flex flex-col gap-0.5 text-center">
              <span className="text-[11px] font-medium text-[#434654]">Status</span>
              <span
                className={`text-[12px] font-bold px-2.5 py-0.5 rounded-full ${
                  isCompletedToday
                    ? 'bg-[#ecfdf5] text-[#065f46]'
                    : isCurrentlyCheckedIn
                    ? 'bg-[#fff7ed] text-[#c2410c]'
                    : missedCheckoutRecord
                    ? 'bg-[#fee2e2] text-[#b91c1c] border border-[#f87171]/40'
                    : 'bg-[#f1f3ff] text-[#585f6a]'
                }`}
              >
                {isCompletedToday
                  ? 'Completed'
                  : isCurrentlyCheckedIn
                  ? 'On Duty'
                  : missedCheckoutRecord
                  ? 'Missing Check-out'
                  : 'Pending'}
              </span>
            </div>
            <div className="h-7 w-px bg-[#c3c6d6]" />
            <div className="flex flex-col gap-0.5 text-right">
              <span className="text-[11px] font-medium text-[#434654]">Check-out</span>
              <span
                className={`text-[15px] font-bold ${
                  todayRecord?.checkOutTime ? 'text-[#041b3c]' : 'text-[#737685]'
                }`}
              >
                {todayRecord?.checkOutTime || '--:--'}
              </span>
            </div>
          </div>

          {/* Unified Notes (In / Out) if exists */}
          {todayRecord && getMergedRecordNotes(todayRecord) && (
            <div className="mt-2.5 pt-2 border-t border-[#e8edff] text-[11px] text-[#585f6a] flex items-center gap-1.5 flex-wrap">
              <span className="font-semibold text-[#0052cc]">Notes:</span>
              <span className="text-[#041b3c]">{getMergedRecordNotes(todayRecord)}</span>
            </div>
          )}

          {/* Prompt if previous day is missing check-out */}
          {missedCheckoutRecord && (
            <div className="mt-2.5 pt-2 border-t border-[#e8edff] flex items-center justify-between text-[11px]">
              <span className="text-[#b91c1c] font-medium flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">warning</span>
                Prior shift ({missedCheckoutRecord.monthName} {missedCheckoutRecord.date}) missing check-out
              </span>
              <button
                type="button"
                id="dailySummaryLogMissedBtn"
                onClick={() => setIsMissedCheckoutModalOpen(true)}
                className="text-[#ea580c] font-bold hover:underline cursor-pointer"
              >
                Log Check-out →
              </button>
            </div>
          )}
        </div>
      </main>

      {/* BottomNavBar */}
      <nav className="fixed bottom-0 left-0 w-full flex justify-around items-center h-20 px-4 bg-white border-t border-[#c3c6d6] z-40">
        {/* Active Tab: Home */}
        <button
          onClick={() => onNavigate('checkin')}
          className="flex flex-col items-center justify-center bg-[#0052cc] text-white rounded-full px-5 py-1.5 active:scale-95 duration-100 cursor-pointer shadow-sm"
        >
          <span className="material-symbols-outlined filled" style={{ fontVariationSettings: "'FILL' 1" }}>
            home
          </span>
          <span className="text-[12px] font-semibold mt-0.5">Home</span>
        </button>

        {/* Inactive Tab: History */}
        <button
          onClick={() => onNavigate('history')}
          className="flex flex-col items-center justify-center text-[#434654] hover:bg-[#f1f3ff] rounded-full px-5 py-1.5 transition-all active:scale-95 duration-100 cursor-pointer"
        >
          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 0" }}>
            history
          </span>
          <span className="text-[12px] font-semibold mt-0.5">History</span>
        </button>

        {/* Inactive Tab: Profile */}
        <button
          onClick={() => onNavigate('profile')}
          className="flex flex-col items-center justify-center text-[#434654] hover:bg-[#f1f3ff] rounded-full px-5 py-1.5 transition-all active:scale-95 duration-100 cursor-pointer"
        >
          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 0" }}>
            person
          </span>
          <span className="text-[12px] font-semibold mt-0.5">Profile</span>
        </button>
      </nav>

      {/* Confirmation Modal to prevent accidental taps */}
      {confirmDialog && (
        <div
          id="confirmationModalOverlay"
          className="fixed inset-0 z-50 bg-[#041b3c]/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setConfirmDialog(null)}
        >
          <div
            id="confirmationModalCard"
            className="bg-white rounded-2xl max-w-sm w-full p-5 sm:p-6 shadow-2xl border border-[#c3c6d6] text-center flex flex-col gap-4 relative animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-dialog-title"
          >
            {/* Close button */}
            <button
              onClick={() => setConfirmDialog(null)}
              className="absolute top-4 right-4 text-[#585f6a] hover:text-[#041b3c] p-1 rounded-full hover:bg-[#f1f3ff] transition-colors cursor-pointer"
              aria-label="Close dialog"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>

            {/* Icon Banner */}
            <div
              className={`w-14 h-14 rounded-2xl mx-auto flex items-center justify-center shadow-xs ${
                confirmDialog.type === 'check_in'
                  ? 'bg-[#e0e8ff] text-[#003d9b]'
                  : 'bg-[#ffedd5] text-[#ea580c]'
              }`}
            >
              <span className="material-symbols-outlined text-[32px]">
                {confirmDialog.type === 'check_in' ? 'fingerprint' : 'logout'}
              </span>
            </div>

            {/* Title & Prompt */}
            <div>
              <h3 id="confirm-dialog-title" className="text-lg font-bold text-[#041b3c]">
                {confirmDialog.type === 'check_in' ? 'Confirm Check-In' : 'Confirm Check-Out'}
              </h3>
              <p className="text-xs text-[#585f6a] mt-1">
                Confirm {confirmDialog.type === 'check_in' ? 'Check-In' : 'Check-Out'} at{' '}
                <span className="font-bold text-[#041b3c]">{confirmDialog.time}</span>?
              </p>
            </div>

            {/* Shift Context Summary Box */}
            <div className="bg-[#f9f9ff] rounded-xl p-3.5 border border-[#e0e8ff] text-left text-xs flex flex-col gap-2">
              <div className="flex justify-between items-center pb-2 border-b border-[#e0e8ff]">
                <span className="text-[#585f6a]">Date</span>
                <span className="font-semibold text-[#041b3c]">{currentDateStr}</span>
              </div>

              <div className="flex justify-between items-center pb-2 border-b border-[#e0e8ff]">
                <span className="text-[#585f6a]">Timestamp</span>
                <span
                  className={`font-bold text-[13px] ${
                    confirmDialog.type === 'check_in' ? 'text-[#0052cc]' : 'text-[#ea580c]'
                  }`}
                >
                  {confirmDialog.time}
                </span>
              </div>

              {confirmDialog.type === 'check_in' ? (
                <>
                  <div className="flex justify-between items-center">
                    <span className="text-[#585f6a]">Work Location</span>
                    <span className="font-semibold text-[#041b3c] flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">
                        {locationType === 'office' ? 'corporate_fare' : 'travel_explore'}
                      </span>
                      {locationType === 'office' ? 'Office' : 'Outside Office'}
                    </span>
                  </div>
                  {locationNote.trim() && (
                    <div className="pt-1 text-[11px] text-[#585f6a] bg-white p-2 rounded-lg border border-[#e0e8ff]">
                      <span className="font-medium text-[#041b3c]">Note:</span> {locationNote.trim()}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="flex justify-between items-center pb-2 border-b border-[#e0e8ff]">
                    <span className="text-[#585f6a]">Check-In Time</span>
                    <span className="font-semibold text-[#041b3c]">{todayRecord?.checkInTime || '--:--'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[#585f6a]">Estimated Shift Duration</span>
                    <span className="font-bold text-[#10b981]">
                      {todayRecord?.checkInTime
                        ? calculateDurationStr(todayRecord.checkInTime, confirmDialog.time).durationStr
                        : 'Active'}
                    </span>
                  </div>

                  <div className="pt-2 border-t border-[#e0e8ff]">
                    <label className="text-[11px] font-semibold text-[#434654] block mb-1">
                      Check-out Note <span className="text-[10px] text-[#737685] font-normal">(Optional)</span>
                    </label>
                    <input
                      type="text"
                      id="checkOutNoteInput"
                      value={checkOutNote}
                      onChange={(e) => setCheckOutNote(e.target.value)}
                      placeholder="e.g. Event ran late, left at 1 AM"
                      className="w-full text-xs px-3 py-2 rounded-lg border border-[#c3c6d6] focus:border-[#0052cc] focus:outline-none bg-white text-[#041b3c]"
                    />
                  </div>
                </>
              )}
            </div>

            <p className="text-[11px] text-[#737685]">
              Tap Confirm to record this timestamp or Cancel to return without saving.
            </p>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <button
                type="button"
                id="cancelConfirmBtn"
                onClick={() => setConfirmDialog(null)}
                className="w-full py-2.5 px-4 rounded-xl border border-[#c3c6d6] text-xs font-semibold text-[#434654] hover:bg-[#f1f3ff] transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                id="confirmActionBtn"
                onClick={handleConfirmAction}
                className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold text-white transition-all shadow-sm cursor-pointer flex items-center justify-center gap-1.5 ${
                  confirmDialog.type === 'check_in'
                    ? 'bg-[#0052cc] hover:bg-[#0040a2] active:scale-95'
                    : 'bg-[#ea580c] hover:bg-[#c2410c] active:scale-95'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">
                  {confirmDialog.type === 'check_in' ? 'check_circle' : 'task_alt'}
                </span>
                <span>{confirmDialog.type === 'check_in' ? 'Confirm Check-In' : 'Confirm Check-Out'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Log Missed Check-Out Modal */}
      {isMissedCheckoutModalOpen && missedCheckoutRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-[#c3c6d6] flex flex-col gap-4 relative max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#e8edff]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#fee2e2] text-[#b91c1c] flex items-center justify-center border border-[#f87171]/40">
                  <span className="material-symbols-outlined text-[22px]">history_toggle_off</span>
                </div>
                <div>
                  <h3 className="text-[16px] font-bold text-[#041b3c]">Log Missed Check-out</h3>
                  <p className="text-[11px] text-[#585f6a]">
                    {missedCheckoutRecord.dayOfWeek}, {missedCheckoutRecord.monthName} {missedCheckoutRecord.date}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsMissedCheckoutModalOpen(false)}
                className="p-1 rounded-full text-[#737685] hover:bg-[#f1f3ff] transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Context Note */}
            <div className="p-3 bg-[#fff7ed] border border-[#f97316]/30 rounded-xl text-[12px] text-[#7c2d12] flex flex-col gap-1">
              <span className="font-bold flex items-center gap-1 text-[#9a3412]">
                <span className="material-symbols-outlined text-[16px]">info</span>
                Event & Exhibition Shift Completion
              </span>
              <p className="text-[11px] leading-relaxed">
                Since finish times vary and can go late into the night, please enter your actual departure time. This will be marked for supervisor manual confirmation.
              </p>
            </div>

            {/* Shift Details Summary */}
            <div className="grid grid-cols-2 gap-2 text-[12px] bg-[#f9f9ff] p-3 rounded-xl border border-[#e8edff]">
              <div>
                <span className="text-[11px] text-[#737685] block font-medium">Check-in Time</span>
                <span className="font-bold text-[#041b3c]">{missedCheckoutRecord.checkInTime}</span>
              </div>
              <div>
                <span className="text-[11px] text-[#737685] block font-medium">Location</span>
                <span className="font-bold text-[#041b3c] truncate block">
                  {missedCheckoutRecord.locationNote || (missedCheckoutRecord.locationType === 'office' ? 'Bangkok HQ' : 'Outside Office')}
                </span>
              </div>
            </div>

            {/* Quick Presets for Late Event Shifts */}
            <div>
              <label className="block text-[11px] font-bold text-[#434654] uppercase tracking-wider mb-2">
                Quick Finish Time Presets
              </label>
              <div className="grid grid-cols-3 gap-2">
                {['09:00 PM', '10:30 PM', '11:45 PM', '01:00 AM', '02:00 AM', '03:00 AM'].map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setMissedCheckoutTime(t)}
                    className={`py-1.5 px-2 text-[11px] font-semibold rounded-lg border transition-all cursor-pointer ${
                      missedCheckoutTime === t
                        ? 'bg-[#003d9b] text-white border-[#003d9b] shadow-xs'
                        : 'bg-[#f1f3ff] text-[#041b3c] border-[#c3c6d6]/60 hover:bg-[#e0e8ff]'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Time Input */}
            <div>
              <label className="block text-[11px] font-bold text-[#434654] uppercase tracking-wider mb-1.5">
                Actual Check-out Time
              </label>
              <input
                type="text"
                id="missedCheckOutTimeInput"
                value={missedCheckoutTime}
                onChange={(e) => setMissedCheckoutTime(e.target.value)}
                placeholder="e.g. 11:30 PM or 01:15 AM"
                className="w-full px-3 py-2.5 text-[14px] font-bold bg-[#f9f9ff] border border-[#c3c6d6] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#003d9b] text-[#041b3c]"
              />
              <div className="flex justify-between items-center mt-1 text-[11px] text-[#585f6a]">
                <span>Calculated Shift:</span>
                <span className="font-bold text-[#003d9b]">
                  {calculateDurationStr(missedCheckoutRecord.checkInTime, missedCheckoutTime).durationStr}
                </span>
              </div>
            </div>

            {/* Note for Supervisor */}
            <div>
              <label className="block text-[11px] font-bold text-[#434654] uppercase tracking-wider mb-1.5">
                Reason / Note for Supervisor
              </label>
              <input
                type="text"
                id="missedCheckOutNoteInput"
                value={missedCheckoutNote}
                onChange={(e) => setMissedCheckoutNote(e.target.value)}
                placeholder="e.g. worked until 1 AM at event, forgot to check out"
                className="w-full px-3 py-2 text-[12px] bg-[#f9f9ff] border border-[#c3c6d6] rounded-xl focus:outline-none focus:ring-1 focus:ring-[#003d9b] text-[#041b3c] placeholder:text-[#8d9199]"
              />
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-[#e8edff]">
              <button
                type="button"
                onClick={() => setIsMissedCheckoutModalOpen(false)}
                className="w-full py-2.5 px-4 rounded-xl border border-[#c3c6d6] text-xs font-semibold text-[#434654] hover:bg-[#f1f3ff] transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                id="submitMissedCheckOutBtn"
                onClick={() => handleResolveMissedCheckout(missedCheckoutTime, missedCheckoutNote)}
                className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-[#ea580c] hover:bg-[#c2410c] transition-all shadow-sm cursor-pointer flex items-center justify-center gap-1.5 active:scale-95"
              >
                <span className="material-symbols-outlined text-[16px]">save</span>
                <span>Record Check-out</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
