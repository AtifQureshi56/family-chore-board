import { describe, expect, it } from 'vitest';
import { earnedBadges, nextGoal } from '../lib/badges';

const none = { streak: 0, monthPoints: 0, monthPerfectDays: 0 };

describe('earnedBadges', () => {
  it('gives nothing on a fresh account', () => {
    expect(earnedBadges(none)).toEqual([]);
  });

  it('awards the first streak badge at three days', () => {
    expect(earnedBadges({ ...none, streak: 2 })).toEqual([]);

    const badges = earnedBadges({ ...none, streak: 3 });
    expect(badges).toHaveLength(1);
    expect(badges[0].label).toBe('On a roll');
    expect(badges[0].detail).toBe('3 perfect days in a row');
  });

  it('shows only the highest streak tier, not every tier passed', () => {
    const badges = earnedBadges({ ...none, streak: 30 });
    const streakBadges = badges.filter((b) => b.id.startsWith('streak-'));
    expect(streakBadges).toHaveLength(1);
    expect(streakBadges[0].label).toBe('A whole month');
  });

  it('awards star and perfect-day badges independently', () => {
    const badges = earnedBadges({ streak: 7, monthPoints: 260, monthPerfectDays: 11 });
    expect(badges.map((b) => b.label)).toEqual([
      'A whole week',
      '250 stars',
      '10 perfect days',
    ]);
  });

  it('formats large star counts with a thousands separator', () => {
    const badges = earnedBadges({ ...none, monthPoints: 1200 });
    expect(badges[0].detail).toBe('1,200 stars this month');
  });

  it('never awards a badge below its threshold', () => {
    expect(earnedBadges({ streak: 0, monthPoints: 99, monthPerfectDays: 4 })).toEqual([]);
  });
});

describe('nextGoal', () => {
  it('gives a fresh account something to aim at', () => {
    const goal = nextGoal(none);
    expect(goal).not.toBeNull();
    expect(goal!.remaining).toBe(3);
    expect(goal!.unit).toBe('more perfect days in a row');
  });

  it('counts down as the streak grows', () => {
    expect(nextGoal({ ...none, streak: 2 })!.remaining).toBe(1);
  });

  it('moves to the next tier once one is earned', () => {
    const goal = nextGoal({ ...none, streak: 3 });
    expect(goal!.label).toBe('A whole week');
    expect(goal!.remaining).toBe(4);
  });

  it('returns null when every tier is earned', () => {
    expect(nextGoal({ streak: 30, monthPoints: 1000, monthPerfectDays: 20 })).toBeNull();
  });

  it('picks the closest goal across the three kinds', () => {
    // 1 perfect day from the 5-day badge beats 2 days of streak.
    const goal = nextGoal({ streak: 1, monthPoints: 0, monthPerfectDays: 4 });
    expect(goal!.remaining).toBe(1);
    expect(goal!.unit).toBe('more perfect days this month');
  });
});
