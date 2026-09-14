/**
 * Date & Time utilities configured explicitly for India Standard Time (IST, UTC+05:30).
 * Prevents UTC midnight boundary bugs and ensures consistency across server, client, and DB.
 */

export const IST_TIMEZONE = 'Asia/Kolkata';

/**
 * Returns today's date in IST formatted as YYYY-MM-DD.
 */
export function getTodayIST(): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: IST_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(new Date());
}

/**
 * Returns the first day of the month for the given IST date (or current month) as YYYY-MM-01.
 */
export function getMonthStartIST(dateStr?: string): string {
  const base = dateStr || getTodayIST();
  return `${base.slice(0, 7)}-01`;
}

/**
 * Formats a YYYY-MM-DD string or Date object into a readable Indian date (e.g. "11 Sep 2026").
 */
export function formatDateIST(
  d: string | Date | undefined | null,
  includeYear: boolean = true,
): string {
  if (!d) return '—';

  if (typeof d === 'string') {
    // If it's a pure YYYY-MM-DD date string
    const match = d.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      const [, y, m, day] = match;
      const dateObj = new Date(Date.UTC(Number(y), Number(m) - 1, Number(day), 12, 0, 0));
      return dateObj.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        ...(includeYear ? { year: 'numeric' } : {}),
        timeZone: 'UTC',
      });
    }
    // Otherwise treat as ISO timestamp string
    const parsed = new Date(d);
    if (isNaN(parsed.getTime())) return d;
    return parsed.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      ...(includeYear ? { year: 'numeric' } : {}),
      timeZone: IST_TIMEZONE,
    });
  }

  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    ...(includeYear ? { year: 'numeric' } : {}),
    timeZone: IST_TIMEZONE,
  });
}

/**
 * Extracts a normalized YYYY-MM-DD date string from a database row,
 * preferring explicit `transaction_date` and falling back to IST-converted `created_at`.
 */
export function extractRowDate(row: {
  transaction_date?: string | null;
  created_at?: string | Date | null;
}): string {
  if (row.transaction_date && typeof row.transaction_date === 'string') {
    return row.transaction_date.slice(0, 10);
  }

  if (row.created_at) {
    const d = typeof row.created_at === 'string' ? new Date(row.created_at) : row.created_at;
    if (!isNaN(d.getTime())) {
      return new Intl.DateTimeFormat('en-CA', {
        timeZone: IST_TIMEZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(d);
    }
  }

  return getTodayIST();
}
