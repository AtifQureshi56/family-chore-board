/**
 * Every calendar date in this app is an Asia/Karachi date.
 *
 * `new Date()` must never be used to derive a date string anywhere else in the
 * codebase. Without this, anything checked after 05:00 local time logs to the
 * previous day.
 */

export const TIMEZONE = 'Asia/Karachi';

/** Today's Karachi calendar date as "YYYY-MM-DD". */
export function todayInKarachi(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE }).format(now);
}

/** The Karachi wall-clock hour (0–23) right now. */
export function hourInKarachi(now: Date = new Date()): number {
  const hour = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIMEZONE,
    hour: '2-digit',
    hour12: false,
  }).format(now);
  return Number(hour);
}

/** First and last date of a calendar month, inclusive, as "YYYY-MM-DD". */
export function monthRange(year: number, month: number): { start: string; end: string } {
  const pad = (n: number) => String(n).padStart(2, '0');
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate(); // month is 1-based
  return {
    start: `${year}-${pad(month)}-01`,
    end: `${year}-${pad(month)}-${pad(lastDay)}`,
  };
}

/** The current Karachi month as { year, month } with a 1-based month. */
export function currentMonthInKarachi(now: Date = new Date()): { year: number; month: number } {
  const [year, month] = todayInKarachi(now).split('-').map(Number);
  return { year, month };
}

/** Shift a "YYYY-MM-DD" string by whole days without touching timezones. */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const shifted = new Date(Date.UTC(y, m - 1, d + days));
  return shifted.toISOString().slice(0, 10);
}

/** Days between two "YYYY-MM-DD" strings (b - a). */
export function daysBetween(a: string, b: string): number {
  const toUtc = (s: string) => {
    const [y, m, d] = s.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((toUtc(b) - toUtc(a)) / 86_400_000);
}

/** Which slot the Karachi clock is currently in — used by the TV board header. */
export function currentSlot(now: Date = new Date()): 'morning' | 'afternoon' | 'evening' | 'bedtime' {
  const hour = hourInKarachi(now);
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  if (hour < 20) return 'evening';
  return 'bedtime';
}

/** "Sunday, 23 August" — for the TV board and scoreboard headings. */
export function formatLongDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

/** "August 2026" */
export function formatMonth(year: number, month: number): string {
  return new Intl.DateTimeFormat('en-GB', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}
