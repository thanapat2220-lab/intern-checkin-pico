import React, { useState, useMemo } from 'react';
import { AttendanceAuditLog, UserProfile } from '../types';

interface AttendanceAuditTrailModalProps {
  isOpen: boolean;
  onClose: () => void;
  auditLogs: AttendanceAuditLog[];
  filterRecordId?: string | null;
  onClearRecordFilter?: () => void;
  interns: UserProfile[];
}

export const AttendanceAuditTrailModal: React.FC<AttendanceAuditTrailModalProps> = ({
  isOpen,
  onClose,
  auditLogs,
  filterRecordId,
  onClearRecordFilter,
  interns: _interns,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState<'all' | 'created_by_admin' | 'edited_by_admin' | 'deleted_by_admin'>('all');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const filteredLogs = useMemo(() => {
    return auditLogs.filter((log) => {
      // Record filter if active
      if (filterRecordId && log.recordId !== filterRecordId) {
        return false;
      }

      // Action type filter
      if (actionFilter !== 'all' && log.action !== actionFilter) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const internMatch = log.internName?.toLowerCase().includes(q);
        const adminMatch = log.adminName?.toLowerCase().includes(q) || log.adminEmail?.toLowerCase().includes(q);
        const reasonMatch = log.reason?.toLowerCase().includes(q);
        const summaryMatch = log.changesSummary?.toLowerCase().includes(q);
        if (!internMatch && !adminMatch && !reasonMatch && !summaryMatch) {
          return false;
        }
      }

      return true;
    });
  }, [auditLogs, filterRecordId, actionFilter, searchQuery]);

  if (!isOpen) return null;

  const formatTimestamp = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return isoStr;
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (_) {
      return isoStr;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-[#c3c6d6] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#c3c6d6] flex justify-between items-center bg-[#f1f3ff]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#0052cc] text-white flex items-center justify-center shadow-xs">
              <span className="material-symbols-outlined text-[22px]">history_edu</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-[17px] font-bold text-[#041b3c]">Attendance Audit Trail</h3>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#e0e8ff] text-[#003d9b]">
                  {auditLogs.length} Events Logged
                </span>
              </div>
              <p className="text-[11px] text-[#585f6a]">
                Immutable record of manual check-in additions, edits, and deletions
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full text-[#737685] hover:text-[#041b3c] hover:bg-[#e0e8ff] transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Toolbar & Filters */}
        <div className="p-4 bg-[#fafbfe] border-b border-[#c3c6d6]/60 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 text-xs">
          {/* Search box */}
          <div className="relative flex-1">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#737685] text-[18px]">
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by intern, admin, or reason..."
              className="w-full pl-9 pr-3 py-2 bg-white border border-[#c3c6d6] rounded-xl text-xs text-[#041b3c] placeholder-[#737685] focus:ring-2 focus:ring-[#0052cc]/30 outline-none"
            />
          </div>

          {/* Action pills */}
          <div className="flex items-center gap-1 bg-[#f1f3ff] p-1 rounded-xl border border-[#c3c6d6]/60 overflow-x-auto">
            <button
              type="button"
              onClick={() => setActionFilter('all')}
              className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                actionFilter === 'all'
                  ? 'bg-white text-[#0052cc] shadow-xs'
                  : 'text-[#585f6a] hover:text-[#041b3c]'
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setActionFilter('created_by_admin')}
              className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                actionFilter === 'created_by_admin'
                  ? 'bg-white text-[#059669] shadow-xs'
                  : 'text-[#585f6a] hover:text-[#041b3c]'
              }`}
            >
              Added
            </button>
            <button
              type="button"
              onClick={() => setActionFilter('edited_by_admin')}
              className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                actionFilter === 'edited_by_admin'
                  ? 'bg-white text-[#d97706] shadow-xs'
                  : 'text-[#585f6a] hover:text-[#041b3c]'
              }`}
            >
              Edited
            </button>
            <button
              type="button"
              onClick={() => setActionFilter('deleted_by_admin')}
              className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                actionFilter === 'deleted_by_admin'
                  ? 'bg-white text-[#dc2626] shadow-xs'
                  : 'text-[#585f6a] hover:text-[#041b3c]'
              }`}
            >
              Deleted
            </button>
          </div>
        </div>

        {/* Filter Record Id Indicator */}
        {filterRecordId && (
          <div className="px-6 py-2.5 bg-[#fefce8] border-b border-[#fef08a] flex items-center justify-between text-xs text-[#854d0e]">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">filter_alt</span>
              <span>
                Filtered to specific record: <strong className="font-mono text-[11px]">{filterRecordId}</strong>
              </span>
            </div>
            {onClearRecordFilter && (
              <button
                type="button"
                onClick={onClearRecordFilter}
                className="font-bold underline hover:text-[#713f12] cursor-pointer"
              >
                Show All Records
              </button>
            )}
          </div>
        )}

        {/* Audit List Body */}
        <div className="p-6 overflow-y-auto space-y-3.5 flex-1">
          {filteredLogs.length === 0 ? (
            <div className="p-12 text-center flex flex-col items-center justify-center gap-2 text-[#737685]">
              <span className="material-symbols-outlined text-[36px] text-[#c3c6d6]">
                receipt_long
              </span>
              <p className="font-bold text-sm text-[#041b3c]">No audit trail entries found</p>
              <p className="text-xs max-w-sm">
                Whenever an administrator manually adds, modifies, or deletes an intern attendance shift, an unalterable audit log will be created here.
              </p>
            </div>
          ) : (
            filteredLogs.map((log) => {
              const isAdded = log.action === 'created_by_admin';
              const isEdited = log.action === 'edited_by_admin';
              const isDeleted = log.action === 'deleted_by_admin';
              const isExpanded = expandedLogId === log.id;

              return (
                <div
                  key={log.id}
                  className="bg-[#f9f9ff] border border-[#c3c6d6]/60 rounded-xl p-4 transition-all hover:border-[#0052cc]/40 space-y-2.5 text-xs shadow-2xs"
                >
                  {/* Top Bar: Action badge, Intern, and Timestamp */}
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      {isAdded && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-[#ecfdf5] text-[#065f46] px-2.5 py-0.5 rounded-full border border-[#a7f3d0]">
                          <span className="material-symbols-outlined text-[13px]">add_circle</span>
                          Record Added
                        </span>
                      )}
                      {isEdited && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-[#fffbeb] text-[#92400e] px-2.5 py-0.5 rounded-full border border-[#fde68a]">
                          <span className="material-symbols-outlined text-[13px]">edit_note</span>
                          Record Corrected
                        </span>
                      )}
                      {isDeleted && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-[#fef2f2] text-[#991b1b] px-2.5 py-0.5 rounded-full border border-[#fecaca]">
                          <span className="material-symbols-outlined text-[13px]">delete</span>
                          Record Deleted
                        </span>
                      )}

                      <span className="font-bold text-[#041b3c] text-[13px]">
                        {log.internName || 'Intern'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 text-[11px] text-[#737685]">
                      <span className="material-symbols-outlined text-[15px]">schedule</span>
                      <span>{formatTimestamp(log.timestamp)}</span>
                    </div>
                  </div>

                  {/* Admin Author Line */}
                  <div className="flex items-center gap-2 text-[11px] text-[#585f6a]">
                    <span className="material-symbols-outlined text-[15px] text-[#0052cc]">
                      account_circle
                    </span>
                    <span>
                      Performed by: <strong className="text-[#041b3c]">{log.adminName}</strong> ({log.adminEmail})
                    </span>
                  </div>

                  {/* Reason Box */}
                  <div className="p-2.5 bg-white rounded-lg border border-[#c3c6d6]/60">
                    <span className="text-[10px] font-bold text-[#585f6a] uppercase block">
                      Admin Correction Reason
                    </span>
                    <p className="font-medium text-[#041b3c] mt-0.5">
                      {log.reason || 'Manual entry / adjustment'}
                    </p>
                  </div>

                  {/* Summary / Changes */}
                  {log.changesSummary && (
                    <p className="text-[11px] text-[#434654] font-medium leading-relaxed">
                      {log.changesSummary}
                    </p>
                  )}

                  {/* Specific Field Changes Table (if edited) */}
                  {log.fieldChanges && log.fieldChanges.length > 0 && (
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                        className="text-[11px] text-[#0052cc] font-bold hover:underline inline-flex items-center gap-1 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[15px]">
                          {isExpanded ? 'expand_less' : 'tune'}
                        </span>
                        <span>
                          {isExpanded ? 'Hide Before & After Values' : `View ${log.fieldChanges.length} Changed Fields`}
                        </span>
                      </button>

                      {isExpanded && (
                        <div className="mt-2 border border-[#c3c6d6]/60 rounded-lg overflow-hidden bg-white">
                          <table className="w-full text-left text-[11px]">
                            <thead className="bg-[#f1f3ff] text-[#585f6a] uppercase text-[10px] font-bold">
                              <tr>
                                <th className="p-2">Field</th>
                                <th className="p-2 text-[#737685]">Previous Value</th>
                                <th className="p-2 text-[#065f46]">Updated Value</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#c3c6d6]/40">
                              {log.fieldChanges.map((f, i) => (
                                <tr key={i} className="hover:bg-[#f9f9ff]">
                                  <td className="p-2 font-bold text-[#041b3c]">{f.label || f.field}</td>
                                  <td className="p-2 font-mono text-[#737685]">{String(f.before || '—')}</td>
                                  <td className="p-2 font-mono font-bold text-[#065f46]">{String(f.after || '—')}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-[#fafbfe] border-t border-[#c3c6d6] flex justify-between items-center text-xs">
          <span className="text-[#585f6a]">
            Total Entries: <strong className="text-[#041b3c]">{filteredLogs.length}</strong>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-[#0052cc] text-white font-bold rounded-xl hover:bg-[#0040a2] transition-colors cursor-pointer"
          >
            Close Audit Trail
          </button>
        </div>
      </div>
    </div>
  );
};
