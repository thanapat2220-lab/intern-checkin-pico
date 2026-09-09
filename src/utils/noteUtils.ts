/**
 * Note Formatting Utilities
 *
 * Implements the single unified Notes formatting rules:
 * 1. When both a check-in note and a check-out note exist for the same day,
 *    combine them into one string clearly labeled by source:
 *    "[In] <check-in note> | [Out] <check-out note>"
 *    e.g. "[In] Client site - Chiang Mai | [Out] Event ran late, left at 1 AM"
 *
 * 2. If only one of the two notes was filled in, show that single note
 *    without the prefix clutter (e.g. "Client site - Chiang Mai" or "Event ran late, left at 1 AM").
 *
 * 3. Both remain optional — never required (returns empty string if neither).
 */

export function formatMergedNotes(
  checkInNote?: string | null,
  checkOutNote?: string | null
): string {
  const inNote = checkInNote?.trim() || '';
  const outNote = checkOutNote?.trim() || '';

  // Avoid double-formatting if string already has the combined syntax
  if (inNote.startsWith('[In]') && inNote.includes('[Out]')) {
    return inNote;
  }
  if (outNote.startsWith('[In]') && outNote.includes('[Out]')) {
    return outNote;
  }

  if (inNote && outNote) {
    return `[In] ${inNote} | [Out] ${outNote}`;
  }
  if (inNote) {
    return inNote;
  }
  if (outNote) {
    return outNote;
  }
  return '';
}

/**
 * Extracts and resolves the unified Notes string from an attendance record or log entry.
 */
export function getMergedRecordNotes(record?: {
  checkInNote?: string | null;
  checkOutNote?: string | null;
  locationNote?: string | null;
  notes?: string | null;
  locationType?: string | null;
}): string {
  if (!record) return '';

  // If notes is already formatted in the combined syntax, return it directly
  if (record.notes) {
    const trimmedNotes = record.notes.trim();
    if (trimmedNotes.startsWith('[In]') && trimmedNotes.includes('[Out]')) {
      return trimmedNotes;
    }
  }

  // Resolve check-in note
  let inNote = record.checkInNote?.trim() || '';
  if (!inNote && record.locationNote) {
    const loc = record.locationNote.trim();
    // Exclude generic placeholder office defaults
    if (
      loc &&
      loc !== 'Bangkok HQ' &&
      loc !== 'Outside Office / Traveling' &&
      !loc.startsWith('Bangkok HQ -')
    ) {
      inNote = loc;
    }
  }

  // Resolve check-out note
  let outNote = record.checkOutNote?.trim() || '';

  // If record.notes has content that hasn't been mapped yet:
  if (record.notes) {
    const trimmedNotes = record.notes.trim();
    if (!inNote && !outNote) {
      return trimmedNotes;
    } else if (inNote && !outNote && trimmedNotes !== inNote) {
      outNote = trimmedNotes;
    } else if (!inNote && outNote && trimmedNotes !== outNote) {
      inNote = trimmedNotes;
    }
  }

  return formatMergedNotes(inNote, outNote);
}
