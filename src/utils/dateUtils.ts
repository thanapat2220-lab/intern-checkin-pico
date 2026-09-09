/**
 * Date and Month utility helpers for dynamic calculations relative to the real current date.
 */

/**
 * Returns the formatted Month Year string for a given date (e.g. "September 2026", "March 2025").
 */
export function formatMonthYear(date: Date = new Date()): string {
  return date.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
}

/**
 * Returns the short uppercase month name (e.g. "SEP", "OCT").
 */
export function formatShortMonth(date: Date = new Date()): string {
  return date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
}

/**
 * Returns the Month Year string offset by a number of months from baseDate.
 * offset = 0: current month
 * offset = -1: previous month
 * offset = 1: next month
 */
export function getMonthYearOffset(offsetMonths: number, baseDate: Date = new Date()): string {
  const d = new Date(baseDate.getFullYear(), baseDate.getMonth() + offsetMonths, 1);
  return formatMonthYear(d);
}

export interface MonthOption {
  value: string;
  label: string;
  isCurrent: boolean;
}

/**
 * Generates dynamic month dropdown options relative to today (new Date()).
 * By default: Current month (tagged as Current Cycle), previous 5 months, and optionally future 1 month.
 * Arranged newest / future first down to oldest.
 */
export function getRecentMonthDropdownOptions(
  pastMonths: number = 5,
  futureMonths: number = 0,
  baseDate: Date = new Date()
): MonthOption[] {
  const options: MonthOption[] = [];
  const currentMonthStr = formatMonthYear(baseDate);

  // Future months first (if any)
  for (let i = futureMonths; i >= 1; i--) {
    const monthStr = getMonthYearOffset(i, baseDate);
    options.push({
      value: monthStr,
      label: monthStr,
      isCurrent: false,
    });
  }

  // Current month
  options.push({
    value: currentMonthStr,
    label: `${currentMonthStr} (Current Cycle)`,
    isCurrent: true,
  });

  // Past months
  for (let i = 1; i <= pastMonths; i++) {
    const monthStr = getMonthYearOffset(-i, baseDate);
    options.push({
      value: monthStr,
      label: monthStr,
      isCurrent: false,
    });
  }

  return options;
}

/**
 * Generates an array of month-year strings in chronological order (oldest to newest).
 * Ideal for navigation sliders, past histories, etc.
 */
export function getChronologicalMonthsList(
  pastMonths: number = 4,
  futureMonths: number = 1,
  baseDate: Date = new Date()
): string[] {
  const list: string[] = [];
  for (let i = -pastMonths; i <= futureMonths; i++) {
    list.push(getMonthYearOffset(i, baseDate));
  }
  return list;
}

/**
 * Returns a readable date range string for a full calendar month,
 * e.g. "1 August 2026 - 31 August 2026" from "August 2026".
 */
export function getMonthPeriodRange(monthYearStr: string): string {
  if (!monthYearStr) return '';
  const parts = monthYearStr.trim().split(/\s+/);
  if (parts.length >= 2) {
    const monthName = parts[0];
    const year = parseInt(parts[1], 10);
    const months = [
      'january', 'february', 'march', 'april', 'may', 'june',
      'july', 'august', 'september', 'october', 'november', 'december'
    ];
    const monthIndex = months.indexOf(monthName.toLowerCase());
    if (monthIndex !== -1 && !isNaN(year)) {
      const lastDay = new Date(year, monthIndex + 1, 0).getDate();
      return `1 ${monthName} ${year} - ${lastDay} ${monthName} ${year}`;
    }
  }
  return monthYearStr;
}
