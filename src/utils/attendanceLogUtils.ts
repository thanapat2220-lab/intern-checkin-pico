import { AttendanceRecord, RawAttendanceLogEntry, UserProfile } from '../types';
import { formatMergedNotes, getMergedRecordNotes } from './noteUtils';

export { formatMergedNotes, getMergedRecordNotes };

/**
 * Month name to 0-indexed month number mapping
 */
const MONTH_MAP: Record<string, number> = {
  january: 0, jan: 0,
  february: 1, feb: 1,
  march: 2, mar: 2,
  april: 3, apr: 3,
  may: 4,
  june: 5, jun: 5,
  july: 6, jul: 6,
  august: 7, aug: 7,
  september: 8, sep: 8, sept: 8,
  october: 9, oct: 9,
  november: 10, nov: 10,
  december: 11, dec: 11,
};

/**
 * Parse a time string like "09:15 AM" or "17:45" into hours and minutes.
 */
export function parseTimeString(timeStr?: string | null): { hours: number; minutes: number } {
  if (!timeStr) return { hours: 9, minutes: 0 };
  const clean = timeStr.trim().toUpperCase();
  const isPM = clean.includes('PM');
  const isAM = clean.includes('AM');
  const parts = clean.replace(/[APM\s]/g, '').split(':');
  let h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;

  if (isPM && h < 12) h += 12;
  if (isAM && h === 12) h = 0;

  return { hours: h, minutes: m };
}

/**
 * Robustly calculate timestamp (epoch ms) from an AttendanceRecord + time string.
 */
export function computeTimestamp(
  record: AttendanceRecord,
  timeStr: string | null,
  isCheckOut: boolean = false
): { timestamp: number; dateStr: string; displayDate: string } {
  let year = new Date().getFullYear();
  let month = new Date().getMonth();
  let day = record.date || 1;

  if (record.createdAt) {
    const d = new Date(record.createdAt);
    if (!isNaN(d.getTime())) {
      year = d.getFullYear();
      month = d.getMonth();
      day = d.getDate();
    }
  } else if (record.monthYear) {
    const parts = record.monthYear.trim().split(' ');
    if (parts.length >= 2) {
      const mName = parts[0].toLowerCase();
      if (MONTH_MAP[mName] !== undefined) {
        month = MONTH_MAP[mName];
      }
      const yNum = parseInt(parts[1], 10);
      if (!isNaN(yNum) && yNum > 2000) {
        year = yNum;
      }
    }
  }

  const { hours, minutes } = parseTimeString(timeStr);
  const dateObj = new Date(year, month, day, hours, minutes, 0, 0);

  // If checkOut happened after midnight or next morning
  if (isCheckOut && hours < 6) {
    dateObj.setDate(dateObj.getDate() + 1);
  }

  const pad = (n: number) => n.toString().padStart(2, '0');
  const dateStr = `${year}-${pad(month + 1)}-${pad(day)}`;
  const displayDate = dateObj.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return {
    timestamp: dateObj.getTime(),
    dateStr,
    displayDate,
  };
}

/**
 * Calculates duration between two time strings (e.g. "09:00 AM" and "06:30 PM")
 */
export function calculateDurationStr(checkInTime: string, checkOutTime?: string | null): { durationStr: string; totalMinutes: number } {
  if (!checkOutTime) {
    return { durationStr: 'Active Shift', totalMinutes: 0 };
  }

  const inParsed = parseTimeString(checkInTime);
  const outParsed = parseTimeString(checkOutTime);

  let inMinutes = inParsed.hours * 60 + inParsed.minutes;
  let outMinutes = outParsed.hours * 60 + outParsed.minutes;

  if (outMinutes < inMinutes) {
    // Crosses midnight
    outMinutes += 24 * 60;
  }

  const diffMinutes = Math.max(0, outMinutes - inMinutes);
  const hours = Math.floor(diffMinutes / 60);
  const mins = diffMinutes % 60;

  const durationStr = mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  return { durationStr, totalMinutes: diffMinutes };
}

/**
 * Missing check-out detection rule:
 * If an intern checked in on a given day but has NOT checked out by the time a new
 * calendar day begins (i.e. past midnight of the check-in date), automatically mark
 * that day's record as "Missing Check-out".
 *
 * This works well for event/exhibition work where finish times vary and can go late
 * into the night, so we don't use a fixed cutoff hour.
 */
export function isMissingCheckout(record: AttendanceRecord, now: Date = new Date()): boolean {
  if (record.status === 'missing_checkout') return true;
  if (!record.checkInTime) return false;
  if (record.checkOutTime) return false;

  const pad = (n: number) => n.toString().padStart(2, '0');
  const nowYear = now.getFullYear();
  const nowMonth = pad(now.getMonth() + 1);
  const nowDay = pad(now.getDate());
  const todayDateStr = `${nowYear}-${nowMonth}-${nowDay}`;

  const { dateStr } = computeTimestamp(record, record.checkInTime, false);
  return dateStr < todayDateStr;
}

/**
 * Transforms raw AttendanceRecord list and UserProfile list into comprehensive
 * daily paired check-in & check-out entries with automatic irregularity detection.
 * Each entry clearly presents both Check-in and Check-out times on the same row,
 * distinctly flagging active shifts vs missing check-outs on past days.
 */
export function buildRawAttendanceLogEntries(
  records: AttendanceRecord[],
  users: UserProfile[]
): RawAttendanceLogEntry[] {
  const userMap = new Map<string, UserProfile>();
  users.forEach((u) => userMap.set(u.id, u));

  // Group records by internId to analyze chronological sequences per individual
  const recordsByIntern = new Map<string, AttendanceRecord[]>();
  records.forEach((rec) => {
    const list = recordsByIntern.get(rec.internId) || [];
    list.push(rec);
    recordsByIntern.set(rec.internId, list);
  });

  const allEntries: RawAttendanceLogEntry[] = [];
  const today = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  const todayDateStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

  recordsByIntern.forEach((internRecords, internId) => {
    const intern = userMap.get(internId);
    const internName = intern?.name || `Intern #${internId.slice(-4)}`;
    const internDepartment = intern?.department || 'Operations';
    const internTeam = intern?.team;
    const internAvatarUrl = intern?.avatarUrl;
    const internInitials =
      intern?.initials ||
      internName
        .split(' ')
        .map((n) => n[0])
        .filter(Boolean)
        .join('')
        .slice(0, 2)
        .toUpperCase() || 'IN';

    // Sort intern records chronologically
    const sorted = [...internRecords].sort((a, b) => {
      const timeA = computeTimestamp(a, a.checkInTime).timestamp;
      const timeB = computeTimestamp(b, b.checkInTime).timestamp;
      return timeA - timeB;
    });

    sorted.forEach((rec, index) => {
      const prevRec = index > 0 ? sorted[index - 1] : null;
      const { timestamp: inTimestamp, dateStr, displayDate } = computeTimestamp(
        rec,
        rec.checkInTime,
        false
      );

      const outTimestamp = rec.checkOutTime
        ? computeTimestamp(rec, rec.checkOutTime, true).timestamp
        : undefined;

      // Determine Status using missing check-out detection rule
      const isToday = dateStr === todayDateStr;
      const isPastDay = dateStr < todayDateStr;
      const missingCheckout = isMissingCheckout(rec, today);

      let status: 'completed' | 'active' | 'missing_checkout' = 'completed';

      if (!rec.checkOutTime) {
        status = missingCheckout ? 'missing_checkout' : (isToday ? 'active' : 'missing_checkout');
      } else if (rec.status === 'missing_checkout') {
        status = 'missing_checkout';
      }

      // Compute calculated duration
      const { durationStr } = calculateDurationStr(rec.checkInTime, rec.checkOutTime);
      const displayDuration = rec.totalDuration && rec.totalDuration !== 'Active'
        ? rec.totalDuration
        : (rec.checkOutTime ? durationStr : (status === 'missing_checkout' ? 'Missing Check-out' : (isToday ? 'Active' : 'Missing Check-out')));

      // --- Anomaly / Irregularity Evaluation ---
      let isIrregular = false;
      let irregularityType: RawAttendanceLogEntry['irregularityType'] = undefined;
      let irregularityReason: string | undefined = undefined;

      // 1. Missing Check-out past midnight of check-in date
      if (status === 'missing_checkout') {
        isIrregular = true;
        irregularityType = 'unclosed_session';
        irregularityReason = 'Missing Check-out: Intern checked in but did not check out before midnight of the check-in date. Requires manual review.';
      }

      // 2. Consecutive check-ins without previous checkout
      else if (prevRec && !prevRec.checkOutTime) {
        isIrregular = true;
        irregularityType = 'consecutive_checkin';
        irregularityReason = 'Consecutive Check-in: Previous day session was never closed with a check-out.';
      }

      // 3. Timestamp anomaly (check-out earlier than check-in)
      else if (outTimestamp && outTimestamp <= inTimestamp && rec.checkInTime) {
        isIrregular = true;
        irregularityType = 'abnormal_time';
        irregularityReason = 'Timestamp Anomaly: Check-out time is earlier than or equal to Check-in time.';
      }

      // 4. Missing location note for outside work
      else if (rec.locationType === 'outside' && (!rec.locationNote || rec.locationNote.trim() === '')) {
        isIrregular = true;
        irregularityType = 'missing_note';
        irregularityReason = 'Missing Note: Outside work location logged without location description.';
      }

      // 5. Abnormal Check-in time (e.g. late night between 11 PM and 5 AM)
      const inHour = new Date(inTimestamp).getHours();
      if (inHour >= 23 || inHour < 5) {
        if (!isIrregular) {
          isIrregular = true;
          irregularityType = 'abnormal_time';
          irregularityReason = `Unusual Hours: Check-in recorded during irregular hours (${rec.checkInTime || 'night'}).`;
        }
      }

      // Late arrival detection (standard cutoff: 09:15 AM)
      const inParsed = parseTimeString(rec.checkInTime);
      const isLate = rec.status === 'late' || rec.flagLabel === 'Late Arrival' || (inParsed.hours > 9 || (inParsed.hours === 9 && inParsed.minutes > 15));

      // Create paired day entry
      allEntries.push({
        id: `att-pair-${rec.id}`,
        recordId: rec.id,
        internId,
        internName,
        internDepartment,
        internTeam,
        internAvatarUrl,
        internInitials,
        dateStr,
        displayDate,
        dayOfWeek: rec.dayOfWeek || new Date(inTimestamp).toLocaleDateString('en-US', { weekday: 'long' }),
        time: rec.checkInTime || '—',
        checkInTime: rec.checkInTime || '—',
        checkOutTime: rec.checkOutTime || null,
        timestamp: inTimestamp,
        checkInTimestamp: inTimestamp,
        checkOutTimestamp: outTimestamp,
        action: 'paired_day',
        locationType: rec.locationType || 'office',
        locationNote: rec.locationNote || (rec.locationType === 'office' ? 'Bangkok HQ' : 'Outside Office / Traveling'),
        coordinates: rec.coordinates || { lat: 13.7563, lng: 100.5018 },
        duration: displayDuration,
        status,
        isIrregular,
        irregularityType,
        irregularityReason,
        isLate,
        flagLabel: rec.flagLabel || (isLate ? 'Late Arrival' : undefined),
        checkInNote: rec.checkInNote,
        checkOutNote: rec.checkOutNote,
        notes: getMergedRecordNotes(rec),
        monthYear: rec.monthYear || 'Current Cycle',
      });
    });
  });

  // Default Sort: Most recent first (timestamp descending)
  return allEntries.sort((a, b) => b.timestamp - a.timestamp);
}

/**
 * Generates and downloads a CSV export of filtered raw attendance logs.
 * Combines check-in and check-out notes into a SINGLE "Notes" column.
 * Removes internal Record ID entirely, and moves Intern ID to the very last column.
 */
export function exportAttendanceLogsToCSV(
  entries: RawAttendanceLogEntry[],
  filenamePrefix: string = 'Attendance_Logs'
): void {
  const headers = [
    'Intern Name',
    'Department',
    'Date',
    'Day of Week',
    'Check-in Time',
    'Check-out Time',
    'Shift Status',
    'Total Duration',
    'Location Type',
    'Notes',
    'Irregularity Flag',
    'Irregularity Note',
    'Cycle Month',
    'Intern ID',
  ];

  const escapeCSV = (val: string | number | null | undefined): string => {
    if (val === null || val === undefined) return '""';
    const s = String(val).replace(/"/g, '""');
    return `"${s}"`;
  };

  const rows = entries.map((e) => [
    escapeCSV(e.internName),
    escapeCSV(e.internDepartment),
    escapeCSV(e.dateStr),
    escapeCSV(e.dayOfWeek),
    escapeCSV(e.checkInTime),
    escapeCSV(e.checkOutTime || (e.status === 'active' ? 'Active Shift' : 'MISSING CHECK-OUT')),
    escapeCSV(e.status.toUpperCase()),
    escapeCSV(e.duration || ''),
    escapeCSV(e.locationType.toUpperCase()),
    escapeCSV(e.notes || ''),
    escapeCSV(e.isIrregular ? 'FLAGGED' : 'NORMAL'),
    escapeCSV(e.irregularityReason || ''),
    escapeCSV(e.monthYear),
    escapeCSV(e.internId),
  ]);

  const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  const todayStr = new Date().toISOString().split('T')[0];
  link.setAttribute('href', url);
  link.setAttribute('download', `${filenamePrefix}_${todayStr}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
