import React, { useState, useMemo, useEffect } from 'react';
import { UserProfile, AttendanceRecord } from '../types';
import { PrintableInternAttendanceForm } from './PrintableInternAttendanceForm';
import { formatMonthYear, getRecentMonthDropdownOptions } from '../utils/dateUtils';

interface InternAttendanceFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  interns: UserProfile[];
  initialInternId?: string;
  initialMonth?: string;
  attendanceRecords: AttendanceRecord[];
  allUsers?: UserProfile[];
}

export const InternAttendanceFormModal: React.FC<InternAttendanceFormModalProps> = ({
  isOpen,
  onClose,
  interns,
  initialInternId,
  initialMonth,
  attendanceRecords,
  allUsers = [],
}) => {
  // Available month options
  const monthOptions = useMemo(() => getRecentMonthDropdownOptions(5, 1), []);

  // Current selected intern & month
  const [selectedInternId, setSelectedInternId] = useState<string>(() => {
    return initialInternId || (interns.length > 0 ? interns[0].id : '');
  });

  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    return initialMonth || formatMonthYear();
  });

  // Sync state when initial props change
  useEffect(() => {
    if (initialInternId) {
      setSelectedInternId(initialInternId);
    } else if (interns.length > 0 && !selectedInternId) {
      setSelectedInternId(interns[0].id);
    }
  }, [initialInternId, interns]);

  useEffect(() => {
    if (initialMonth) {
      setSelectedMonth(initialMonth);
    }
  }, [initialMonth]);

  // Find selected intern
  const currentIntern = useMemo(() => {
    return interns.find((i) => i.id === selectedInternId) || interns[0] || null;
  }, [interns, selectedInternId]);

  // Resolve supervisor name
  const resolvedSupervisorName = useMemo(() => {
    if (!currentIntern) return null;
    if (currentIntern.supervisorName) return currentIntern.supervisorName;
    if (currentIntern.supervisorId && allUsers.length > 0) {
      const sup = allUsers.find((u) => u.id === currentIntern.supervisorId);
      if (sup) return sup.name;
    }
    return null;
  }, [currentIntern, allUsers]);

  if (!isOpen) return null;

  return (
    <>
      {/* 1. Modal Dialog for On-Screen Preview & Controls */}
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex flex-col p-2 sm:p-4 md:p-6 overflow-y-auto print:hidden">
        {/* Top Control Bar */}
        <div className="max-w-[920px] w-full mx-auto bg-[#041b3c] text-white px-5 py-3.5 rounded-t-xl flex flex-wrap items-center justify-between gap-3 shadow-lg shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#0052cc] flex items-center justify-center text-white shrink-0">
              <span className="material-symbols-outlined text-[19px]">description</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-[14px] font-bold tracking-tight text-white">
                  Per-Intern Attendance Form
                </h3>
                <span className="text-[10px] bg-[#22c55e] text-black font-extrabold px-2 py-0.5 rounded uppercase tracking-wider">
                  A4 Portrait
                </span>
                <span className="text-[10px] bg-white/20 text-white font-medium px-1.5 py-0.5 rounded">
                  Pico Format
                </span>
              </div>
              <p className="text-[11px] text-[#b2c5ff]">
                Time Attendance Tracking with daily hours & supervisor sign-off
              </p>
            </div>
          </div>

          {/* Selector Dropdowns & Actions */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Intern Selector Dropdown */}
            <div className="flex items-center gap-1.5 bg-[#0e254a] border border-[#233a60] rounded-lg px-2.5 py-1">
              <label htmlFor="intern-select" className="text-[11px] text-[#b2c5ff] font-medium">Intern:</label>
              <select
                id="intern-select"
                value={currentIntern?.id || ''}
                onChange={(e) => setSelectedInternId(e.target.value)}
                className="bg-transparent text-white text-xs font-semibold focus:outline-hidden cursor-pointer"
              >
                {interns.map((i) => (
                  <option key={i.id} value={i.id} className="bg-[#041b3c] text-white">
                    {i.name} ({i.department})
                  </option>
                ))}
              </select>
            </div>

            {/* Month Selector Dropdown */}
            <div className="flex items-center gap-1.5 bg-[#0e254a] border border-[#233a60] rounded-lg px-2.5 py-1">
              <label htmlFor="month-select" className="text-[11px] text-[#b2c5ff] font-medium">Month:</label>
              <select
                id="month-select"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-transparent text-white text-xs font-semibold focus:outline-hidden cursor-pointer"
              >
                {monthOptions.map((opt) => (
                  <option key={opt.value} value={opt.value} className="bg-[#041b3c] text-white">
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-[#b2c5ff] hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              Close
            </button>

            {/* Print Button */}
            <button
              onClick={() => window.print()}
              className="bg-[#22c55e] hover:bg-[#16a34a] text-black font-bold text-xs px-3.5 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm"
              title="Print or Save A4 Portrait Attendance Form as PDF"
            >
              <span className="material-symbols-outlined text-[17px]">print</span>
              <span>Print / Save as PDF</span>
            </button>
          </div>
        </div>

        {/* Paper Sheet Preview Area */}
        <div className="max-w-[920px] w-full mx-auto bg-slate-200/90 p-4 sm:p-8 rounded-b-xl shadow-2xl overflow-x-auto flex justify-center border-t border-[#1d3052]">
          <div className="bg-white text-black shadow-xl border border-slate-300 w-full min-w-[680px] max-w-[780px] p-8 sm:p-10 rounded-xs">
            {currentIntern ? (
              <PrintableInternAttendanceForm
                intern={currentIntern}
                monthYear={selectedMonth}
                records={attendanceRecords}
                supervisorName={resolvedSupervisorName}
              />
            ) : (
              <div className="p-12 text-center text-gray-500">
                No intern selected. Please select an intern above.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. Standalone Print-Only Container (for window.print / PDF) */}
      <div className="hidden print:block attendance-form-print-container p-0 m-0">
        {currentIntern && (
          <PrintableInternAttendanceForm
            intern={currentIntern}
            monthYear={selectedMonth}
            records={attendanceRecords}
            supervisorName={resolvedSupervisorName}
          />
        )}
      </div>
    </>
  );
};
