import { describe, expect, it } from 'vitest';
import {
  completedCount,
  dayAvailable,
  dayTotal,
  groupBySlot,
  isPerfectDay,
} from '../lib/scoring';
import type { DayTask, Slot } from '../lib/types';

let n = 0;
function task(overrides: Partial<DayTask> = {}): DayTask {
  n += 1;
  return {
    id: `task-${n}`,
    title: `Chore ${n}`,
    icon: '⭐',
    slot: 'morning' as Slot,
    points: 5,
    sort_order: n,
    is_active: true,
    child_id: null,
    on_date: null,
    created_on: '2026-08-01',
    completed: false,
    is_extra: false,
    ...overrides,
  };
}

describe('dayTotal', () => {
  it('sums only completed chores', () => {
    const tasks = [task({ completed: true }), task({ completed: false }), task({ completed: true })];
    expect(dayTotal(tasks)).toBe(10);
  });

  it('respects a chore worth more than the default 5', () => {
    expect(dayTotal([task({ completed: true, points: 10 })])).toBe(10);
  });

  it('is zero for an untouched day', () => {
    expect(dayTotal([task(), task()])).toBe(0);
  });
});

describe('dayAvailable', () => {
  it('counts every chore, done or not', () => {
    expect(dayAvailable([task({ completed: true }), task({ points: 10 })])).toBe(15);
  });
});

describe('completedCount', () => {
  it('counts completed chores', () => {
    expect(completedCount([task({ completed: true }), task()])).toBe(1);
  });
});

describe('isPerfectDay', () => {
  it('is true when everything visible is done', () => {
    expect(isPerfectDay([task({ completed: true }), task({ completed: true })])).toBe(true);
  });

  it('is false when one chore remains', () => {
    expect(isPerfectDay([task({ completed: true }), task()])).toBe(false);
  });

  it('is false for a child with no chores at all', () => {
    expect(isPerfectDay([])).toBe(false);
  });

  it("counts a child's extra chore toward the perfect day", () => {
    const tasks = [
      task({ completed: true }),
      task({ completed: false, is_extra: true, child_id: 'child-a' }),
    ];
    expect(isPerfectDay(tasks)).toBe(false);

    tasks[1].completed = true;
    expect(isPerfectDay(tasks)).toBe(true);
  });
});

describe('groupBySlot', () => {
  it('returns all four slots in order, even when empty', () => {
    expect(groupBySlot([]).map((s) => s.slot)).toEqual([
      'morning',
      'afternoon',
      'evening',
      'bedtime',
    ]);
  });

  it('places each chore in its slot and sorts within it', () => {
    const grouped = groupBySlot([
      task({ slot: 'bedtime', sort_order: 2, title: 'second' }),
      task({ slot: 'bedtime', sort_order: 1, title: 'first' }),
      task({ slot: 'morning', sort_order: 1, title: 'morning one' }),
    ]);

    expect(grouped[0].tasks.map((t) => t.title)).toEqual(['morning one']);
    expect(grouped[3].tasks.map((t) => t.title)).toEqual(['first', 'second']);
    expect(grouped[1].tasks).toHaveLength(0);
  });
});
