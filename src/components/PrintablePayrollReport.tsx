import React from 'react';
import { PayrollRecord } from '../types';
import { getMonthPeriodRange } from '../utils/dateUtils';

interface PrintablePayrollReportProps {
  records: PayrollRecord[];
  selectedMonth: string;
  selectedDepartment?: string;
  totalDaysWorked: number;
  totalPayrollTHB: number;
  companyName?: string;
}

export const PrintablePayrollReport: React.FC<PrintablePayrollReportProps> = ({
  records,
  selectedMonth,
  totalDaysWorked,
  totalPayrollTHB,
}) => {
  const periodRange = getMonthPeriodRange(selectedMonth);

  return (
    <div className="w-full bg-white text-black font-sans print:w-full">
      {/* Explicit A4 Landscape Orientation for Payroll Report */}
      <style>{`
        @media print {
          @page {
            size: A4 landscape !important;
            margin: 8mm 10mm !important;
          }
        }
      `}</style>

      {/* 1. Simple Title */}
      <div className="mb-3">
        <h1 className="text-[17px] font-bold text-black tracking-tight">
          Payroll Internship - {selectedMonth}
        </h1>
      </div>

      {/* 2. Main Payroll Table Formatted for A4 Landscape */}
      <table className="w-full border-collapse border border-black text-[11px] leading-tight">
        <thead>
          <tr className="bg-gray-100 text-black border-b border-black">
            <th className="border border-black p-2 text-center w-[35px] font-bold">
              No.
            </th>
            <th className="border border-black p-2 text-left font-bold min-w-[130px]">
              Name
            </th>
            <th className="border border-black p-2 text-left font-bold min-w-[100px]">
              Department
            </th>
            <th className="border border-black p-2 text-left font-bold min-w-[90px]">
              Team
            </th>
            <th className="border border-black p-2 text-center font-bold min-w-[160px]">
              Period
            </th>
            <th className="border border-black p-2 text-right font-bold w-[90px]">
              Daily Rate (THB)
            </th>
            <th className="border border-black p-2 text-center font-bold w-[75px]">
              Days Worked
            </th>
            <th className="border border-black p-2 text-right font-bold w-[105px]">
              Total Amount (THB)
            </th>
            <th className="border border-black p-2 text-left font-bold min-w-[110px]">
              Account Number
            </th>
            <th className="border border-black p-2 text-left font-bold min-w-[130px]">
              Bank Name
            </th>
          </tr>
        </thead>
        <tbody>
          {records.length === 0 ? (
            <tr>
              <td
                colSpan={10}
                className="border border-black p-6 text-center text-gray-500 italic"
              >
                No verified payroll records available for {selectedMonth}.
              </td>
            </tr>
          ) : (
            records.map((r, index) => (
              <tr
                key={r.id || index}
                className="border-b border-black/40 even:bg-gray-50/50"
              >
                <td className="border border-black p-2 text-center font-medium text-gray-800">
                  {index + 1}
                </td>
                <td className="border border-black p-2 font-semibold text-black whitespace-nowrap">
                  {r.name}
                </td>
                <td className="border border-black p-2 text-gray-800 whitespace-nowrap">
                  {r.department}
                </td>
                <td className="border border-black p-2 text-gray-800 whitespace-nowrap">
                  {r.team || 'General'}
                </td>
                <td className="border border-black p-2 text-center text-gray-700 whitespace-nowrap">
                  {periodRange}
                </td>
                <td className="border border-black p-2 text-right font-mono text-gray-800 whitespace-nowrap">
                  {r.dailyRateTHB.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </td>
                <td className="border border-black p-2 text-center font-bold text-black whitespace-nowrap">
                  {r.daysWorked}
                </td>
                <td className="border border-black p-2 text-right font-bold font-mono text-black whitespace-nowrap">
                  {r.totalAmountTHB.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </td>
                <td className="border border-black p-2 font-mono text-gray-900 whitespace-nowrap">
                  {r.accountNumber}
                </td>
                <td className="border border-black p-2 text-gray-800 whitespace-nowrap">
                  {r.bankName}
                </td>
              </tr>
            ))
          )}
        </tbody>
        <tfoot>
          {/* Total Row Summing All Amounts */}
          <tr className="bg-gray-200 text-black font-bold border-t-2 border-black">
            <td
              colSpan={5}
              className="border border-black p-2 text-right uppercase tracking-wider text-[11px]"
            >
              Total (รวมทั้งสิ้น) — {records.length} Persons:
            </td>
            <td className="border border-black p-2 text-right text-gray-600 font-normal">
              -
            </td>
            <td className="border border-black p-2 text-center text-[12px] font-bold">
              {totalDaysWorked}
            </td>
            <td className="border border-black p-2 text-right text-[12px] font-bold font-mono">
              {totalPayrollTHB.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </td>
            <td className="border border-black p-2 text-center text-gray-600 font-normal">
              -
            </td>
            <td className="border border-black p-2 text-center text-gray-600 font-normal">
              -
            </td>
          </tr>
        </tfoot>
      </table>

      {/* 3. Three Signature Line Blocks Side by Side */}
      <div className="mt-8 pt-4 print-signatures break-inside-avoid">
        <div className="grid grid-cols-3 gap-8 text-center">
          {/* Block 1: Checked by */}
          <div className="flex flex-col items-center">
            <p className="text-[12px] font-semibold text-black mb-2">
              Checked by: _______________
            </p>
            <p className="text-[11px] text-gray-700">
              Date: _____ / _____ / _____
            </p>
          </div>

          {/* Block 2: Verified by */}
          <div className="flex flex-col items-center">
            <p className="text-[12px] font-semibold text-black mb-2">
              Verified by: _______________
            </p>
            <p className="text-[11px] text-gray-700">
              Date: _____ / _____ / _____
            </p>
          </div>

          {/* Block 3: Approved by */}
          <div className="flex flex-col items-center">
            <p className="text-[12px] font-semibold text-black mb-2">
              Approved by: _______________
            </p>
            <p className="text-[11px] text-gray-700">
              Date: _____ / _____ / _____
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
