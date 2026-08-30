/**
 * Reliable local timezone-safe date utilities
 */

export function formatLocalDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseLocalDate(dateStr: string): Date {
  if (!dateStr) return new Date();
  const clean = dateStr.split('T')[0];
  const parts = clean.split('-');
  if (parts.length === 3) {
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    // Set to 12:00:00 local time to prevent any DST/timezone boundary shifts
    return new Date(year, month, day, 12, 0, 0);
  }
  return new Date(dateStr);
}

export function getTodayDateStr(): string {
  return formatLocalDate(new Date());
}

export function getStartOfWeek(baseDate: Date): Date {
  const d = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), 12, 0, 0);
  const day = d.getDay(); // 0 is Sunday, 1 is Monday, ..., 6 is Saturday
  const diffToMonday = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diffToMonday);
  return d;
}

export function getWeekDays(baseDate: Date): Date[] {
  const monday = getStartOfWeek(baseDate);
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(monday);
    day.setDate(monday.getDate() + i);
    return day;
  });
}

export function isSameDay(date1: string | Date, date2: string | Date): boolean {
  const str1 = typeof date1 === 'string' ? date1.split('T')[0] : formatLocalDate(date1);
  const str2 = typeof date2 === 'string' ? date2.split('T')[0] : formatLocalDate(date2);
  return str1 === str2;
}
