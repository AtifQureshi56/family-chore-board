import { describe, expect, it } from 'vitest';
import {
  addDays,
  currentSlot,
  daysBetween,
  hourInKarachi,
  monthRange,
  todayInKarachi,
} from '../lib/dates';

// Karachi is UTC+5 with no daylight saving, so these UTC instants are exact.
const at = (utc: string) => new Date(utc);

describe('todayInKarachi', () => {
  it('rolls the date at Karachi midnight, not UTC midnight', () => {
    // 23:59 Karachi on the 23rd = 18:59 UTC on the 23rd
    expect(todayInKarachi(at('2026-08-23T18:59:00Z'))).toBe('2026-08-23');
    // 00:01 Karachi on the 24th = 19:01 UTC on the 23rd
    expect(todayInKarachi(at('2026-08-23T19:01:00Z'))).toBe('2026-08-24');
  });

  it('logs an early-morning check to that day, not the previous UTC day', () => {
    // 06:00 Karachi on the 24th = 01:00 UTC on the 24th - same date either way
    expect(todayInKarachi(at('2026-08-24T01:00:00Z'))).toBe('2026-08-24');
    // 05:00 Karachi on the 24th = 00:00 UTC on the 24th
    expect(todayInKarachi(at('2026-08-24T00:00:00Z'))).toBe('2026-08-24');
    // 04:00 Karachi on the 24th = 23:00 UTC on the 23rd - the case that breaks
    // naive implementations
    expect(todayInKarachi(at('2026-08-23T23:00:00Z'))).toBe('2026-08-24');
  });

  it('returns an ISO YYYY-MM-DD string', () => {
    expect(todayInKarachi(at('2026-01-05T12:00:00Z'))).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('hourInKarachi', () => {
  it('reads the Karachi wall clock', () => {
    expect(hourInKarachi(at('2026-08-23T00:00:00Z'))).toBe(5);
    expect(hourInKarachi(at('2026-08-23T19:00:00Z'))).toBe(0);
  });
});

describe('monthRange', () => {
  it('covers a 31-day month', () => {
    expect(monthRange(2026, 8)).toEqual({ start: '2026-08-01', end: '2026-08-31' });
  });

  it('covers a 30-day month', () => {
    expect(monthRange(2026, 4)).toEqual({ start: '2026-04-01', end: '2026-04-30' });
  });

  it('handles February in a leap year', () => {
    expect(monthRange(2028, 2)).toEqual({ start: '2028-02-01', end: '2028-02-29' });
    expect(monthRange(2026, 2)).toEqual({ start: '2026-02-01', end: '2026-02-28' });
  });
});

describe('addDays', () => {
  it('steps backwards across a month boundary', () => {
    expect(addDays('2026-09-01', -1)).toBe('2026-08-31');
  });

  it('steps forwards across a year boundary', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });
});

describe('daysBetween', () => {
  it('counts whole days', () => {
    expect(daysBetween('2026-08-23', '2026-08-30')).toBe(7);
    expect(daysBetween('2026-08-30', '2026-08-23')).toBe(-7);
  });
});

describe('currentSlot', () => {
  it('maps the Karachi hour to a slot', () => {
    expect(currentSlot(at('2026-08-23T03:00:00Z'))).toBe('morning'); // 08:00
    expect(currentSlot(at('2026-08-23T09:00:00Z'))).toBe('afternoon'); // 14:00
    expect(currentSlot(at('2026-08-23T13:00:00Z'))).toBe('evening'); // 18:00
    expect(currentSlot(at('2026-08-23T16:00:00Z'))).toBe('bedtime'); // 21:00
  });
});
