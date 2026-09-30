import React, { useState } from 'react';
import { AttendanceAdminEditMeta, AttendanceAuditLog } from '../types';

interface AuditBadgeProps {
  isManuallyAdded?: boolean;
  isManuallyEdited?: boolean;
  lastEditedBy?: AttendanceAdminEditMeta;
  auditHistory?: AttendanceAuditLog[];
  recordId?: string;
  onClickAudit?: (recordId?: string) => void;
  className?: string;
  size?: 'sm' | 'xs';
}

export const AuditBadge: React.FC<AuditBadgeProps> = ({
  isManuallyAdded,
  isManuallyEdited,
  lastEditedBy,
  auditHistory: _auditHistory,
  recordId,
  onClickAudit,
  className = '',
  size = 'xs',
}) => {
  const [showTooltip, setShowTooltip] = useState(false);

  if (!isManuallyAdded && !isManuallyEdited) {
    return null;
  }

  const isAdded = Boolean(isManuallyAdded);
  const adminName = lastEditedBy?.adminName || 'Admin';
  const adminEmail = lastEditedBy?.adminEmail || '';
  const reason = lastEditedBy?.reason || (isAdded ? 'Manual attendance entry' : 'Administrative correction');
  const summary = lastEditedBy?.summary || '';
  const editedAt = lastEditedBy?.editedAt;

  const formattedDate = editedAt
    ? (() => {
        try {
          const d = new Date(editedAt);
          if (isNaN(d.getTime())) return editedAt;
          return d.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          });
        } catch (_) {
          return editedAt;
        }
      })()
    : null;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onClickAudit) {
      onClickAudit(recordId);
    }
  };

  return (
    <div
      className={`relative inline-block ${className}`}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <button
        type="button"
        onClick={handleClick}
        className={`inline-flex items-center gap-1 font-bold rounded-full transition-all cursor-pointer shadow-2xs active:scale-95 ${
          size === 'sm' ? 'px-2.5 py-0.5 text-[11px]' : 'px-2 py-0.5 text-[10px]'
        } ${
          isAdded
            ? 'bg-[#f3e8ff] text-[#7e22ce] border border-[#d8b4fe] hover:bg-[#ede9fe]'
            : 'bg-[#fef3c7] text-[#92400e] border border-[#fde68a] hover:bg-[#fde68a]'
        }`}
        title={`Click to view audit history: ${isAdded ? 'Added' : 'Edited'} by ${adminName}`}
      >
        <span className="material-symbols-outlined text-[12px]">
          {isAdded ? 'verified_user' : 'edit_note'}
        </span>
        <span>{isAdded ? 'Added by Admin' : 'Edited by Admin'}</span>
      </button>

      {/* Floating Detailed Hover Popover */}
      {showTooltip && (
        <div
          className="absolute bottom-full left-0 mb-2 z-50 w-72 p-3 bg-white rounded-xl shadow-xl border border-[#c3c6d6] text-left text-xs pointer-events-auto animate-in fade-in zoom-in-95 duration-100"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[#c3c6d6]/60 pb-1.5 mb-2">
            <span
              className={`inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wide px-2 py-0.5 rounded-full ${
                isAdded
                  ? 'bg-[#f3e8ff] text-[#7e22ce]'
                  : 'bg-[#fef3c7] text-[#92400e]'
              }`}
            >
              <span className="material-symbols-outlined text-[11px]">
                {isAdded ? 'verified_user' : 'edit_note'}
              </span>
              {isAdded ? 'Admin Created Record' : 'Admin Edited Record'}
            </span>
            {formattedDate && (
              <span className="text-[10px] text-[#737685] font-medium">{formattedDate}</span>
            )}
          </div>

          {/* Admin Info */}
          <div className="space-y-1.5 text-[11px]">
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[14px] text-[#0052cc]">
                shield_person
              </span>
              <span className="text-[#585f6a]">
                Admin: <strong className="text-[#041b3c]">{adminName}</strong>
                {adminEmail ? ` (${adminEmail})` : ''}
              </span>
            </div>

            {/* Reason */}
            <div className="p-2 bg-[#f9f9ff] rounded-lg border border-[#c3c6d6]/60">
              <span className="text-[9px] font-bold uppercase text-[#585f6a] block">Reason</span>
              <p className="font-semibold text-[#041b3c] mt-0.5 text-[11px] leading-tight">
                {reason}
              </p>
            </div>

            {/* Changes Summary if available */}
            {summary && (
              <div className="text-[10px] text-[#585f6a] font-medium leading-snug">
                <span className="font-bold text-[#041b3c]">Changes: </span>
                <span>{summary}</span>
              </div>
            )}
          </div>

          {/* Action to view full audit */}
          {onClickAudit && (
            <button
              type="button"
              onClick={handleClick}
              className="mt-2.5 w-full py-1.5 px-2 bg-[#0052cc] hover:bg-[#0040a2] text-white rounded-lg text-[11px] font-bold transition-colors flex items-center justify-center gap-1 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[13px]">history_edu</span>
              <span>View Full Audit Trail</span>
            </button>
          )}

          {/* Arrow */}
          <div className="absolute top-full left-4 -mt-1 w-2 h-2 bg-white border-b border-r border-[#c3c6d6] rotate-45" />
        </div>
      )}
    </div>
  );
};
