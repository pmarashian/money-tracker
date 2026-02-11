/**
 * Parse a date-only string (YYYY-MM-DD, optional T... suffix) as local midnight.
 * Avoids UTC-midnight parsing which shifts the calendar day in timezones behind UTC.
 */
export function parseDateOnlyAsLocal(dateStr: string): Date | null {
  const dateOnly = dateStr.split('T')[0];
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateOnly);
  if (!match) return null;
  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10) - 1;
  const day = parseInt(match[3], 10);
  const d = new Date(year, month, day);
  return isNaN(d.getTime()) ? null : d;
}
