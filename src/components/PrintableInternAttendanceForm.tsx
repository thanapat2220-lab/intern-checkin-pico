import React, { useMemo } from 'react';
import { UserProfile, AttendanceRecord } from '../types';
import { getMergedRecordNotes } from '../utils/noteUtils';

interface PrintableInternAttendanceFormProps {
  intern: UserProfile;
  monthYear: string;
  records: AttendanceRecord[];
  supervisorName?: string | null;
}

/**
 * Calculates the number of days in a given "Month Year" string (e.g. "August 2026" -> 31).
 */
function getDaysInMonth(monthYearStr: string): number {
  if (!monthYearStr) return 31;
  const parts = monthYearStr.trim().split(/\s+/);
  if (parts.length >= 2) {
    const monthName = parts[0].toLowerCase();
    const year = parseInt(parts[1], 10);
    const months = [
      'january', 'february', 'march', 'april', 'may', 'june',
      'july', 'august', 'september', 'october', 'november', 'december'
    ];
    const monthIndex = months.indexOf(monthName);
    if (monthIndex !== -1 && !isNaN(year)) {
      return new Date(year, monthIndex + 1, 0).getDate();
    }
  }
  return 31;
}

export const PrintableInternAttendanceForm: React.FC<PrintableInternAttendanceFormProps> = ({
  intern,
  monthYear,
  records,
  supervisorName,
}) => {
  const totalDays = useMemo(() => getDaysInMonth(monthYear), [monthYear]);

  const daysArray = useMemo(() => {
    return Array.from({ length: totalDays }, (_, i) => i + 1);
  }, [totalDays]);

  // Map attendance records for this intern in this month by day number
  const recordsByDay = useMemo(() => {
    const map = new Map<number, AttendanceRecord>();
    const normalizedMonth = monthYear.trim().toLowerCase();

    records.forEach((r) => {
      // Must match intern
      if (r.internId !== intern.id) return;

      // Check month match if monthYear exists on record
      if (r.monthYear && r.monthYear.trim().toLowerCase() !== normalizedMonth) {
        return;
      }

      // Extract day number (1..31)
      let dayNum: number | null = null;
      if (typeof r.date === 'number') {
        dayNum = r.date;
      } else if (r.date) {
        dayNum = parseInt(String(r.date), 10);
      }

      if (dayNum && dayNum >= 1 && dayNum <= 31) {
        // If there are multiple records, prioritize one with checkout or note
        const existing = map.get(dayNum);
        if (!existing || (!existing.checkOutTime && r.checkOutTime)) {
          map.set(dayNum, r);
        }
      }
    });

    return map;
  }, [records, intern.id, monthYear]);

  const resolvedSupervisor = supervisorName || intern.supervisorName || '—';

  return (
    <div className="w-full bg-white text-black font-sans leading-tight print:w-full">
      {/* Explicit A4 Portrait Orientation CSS */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait !important;
            margin: 8mm 10mm !important;
          }
        }
      `}</style>

      {/* 1. Header: Plain Bold Text (no logo) */}
      <div className="text-center mb-3">
        <h1 className="text-[17px] font-bold text-black tracking-tight uppercase">
          TIME ATTENDANCE TRACKING
        </h1>
      </div>

      {/* 2. Top Info Fields in 2 Columns */}
      <div className="mb-3 border border-black p-2 text-[11px] leading-snug">
        <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
          <div className="flex items-baseline">
            <span className="font-bold w-24 shrink-0">Month:</span>
            <span className="font-medium text-black border-b border-black/40 flex-1 pb-0.5">
              {monthYear}
            </span>
          </div>

          <div className="flex items-baseline">
            <span className="font-bold w-28 shrink-0">Department:</span>
            <span className="font-medium text-black border-b border-black/40 flex-1 pb-0.5">
              {intern.department || '—'}
            </span>
          </div>

          <div className="flex items-baseline">
            <span className="font-bold w-24 shrink-0">Name of Intern:</span>
            <span className="font-medium text-black border-b border-black/40 flex-1 pb-0.5">
              {intern.name}
            </span>
          </div>

          <div className="flex items-baseline">
            <span className="font-bold w-48 shrink-0">Name of Direct Supervisor:</span>
            <span className="font-medium text-black border-b border-black/40 flex-1 pb-0.5">
              {resolvedSupervisor}
            </span>
          </div>
        </div>
      </div>

      {/* 3. Main Attendance Table (1 through 28/29/30/31) */}
      <table className="w-full border-collapse border border-black text-[10px] leading-tight">
        <thead>
          <tr className="bg-gray-100 text-black border-b border-black">
            <th className="border border-black p-1 text-center w-[46px] font-bold">
              Date
            </th>
            <th className="border border-black p-1 text-center font-bold w-[95px]">
              Time - Start
            </th>
            <th className="border border-black p-1 text-center font-bold w-[95px]">
              Time - End
            </th>
            <th className="border border-black p-1 text-center font-bold w-[120px]">
              Intern's Signature
            </th>
            <th className="border border-black p-1 text-left font-bold pl-2">
              Remark (Identify the leave reason)
            </th>
          </tr>
        </thead>
        <tbody>
          {daysArray.map((dayNum) => {
            const record = recordsByDay.get(dayNum);
            const checkIn = record?.checkInTime || '';
            const checkOut = record?.checkOutTime || '';
            const remark = record ? getMergedRecordNotes(record) : '';

            return (
              <tr
                key={dayNum}
                className="border-b border-black/50 h-[21px] max-h-[22px] even:bg-gray-50/40"
              >
                <td className="border border-black p-0.5 text-center font-semibold text-black">
                  {dayNum}
                </td>
                <td className="border border-black p-0.5 text-center font-mono text-gray-900">
                  {checkIn}
                </td>
                <td className="border border-black p-0.5 text-center font-mono text-gray-900">
                  {checkOut}
                </td>
                <td className="border border-black p-0.5 text-center">
                  {/* Empty for physical pen signature */}
                </td>
                <td className="border border-black px-2 py-0.5 text-gray-800 text-[9.5px] truncate max-w-[280px]">
                  {remark}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* 4. Bottom Signature Section: Supervisor & Date on Same Line */}
      <div className="mt-5 pt-3 flex items-center justify-between text-[11px] font-semibold text-black break-inside-avoid">
        <div className="flex items-baseline gap-1.5">
          <span>Direct Supervisor's signature:</span>
          <span className="font-normal tracking-tight">___________________________</span>
        </div>
        <div className="flex items-baseline gap-1.5">
          <span>Date:</span>
          <span className="font-normal tracking-tight">___________________________</span>
        </div>
      </div>
    </div>
  );
};
