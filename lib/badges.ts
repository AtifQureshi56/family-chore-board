/**
 * Badges for streaks and monthly milestones.
 *
 * Pure functions over numbers the app already has, so a badge can never disagree
 * with the score it is derived from.
 *
 * Two rules shape the thresholds:
 * - Nothing is ever revoked as a punishment. A month badge reflects that month;
 *   a streak badge reflects the streak as it stands. Losing a streak simply means
 *   the next badge is not there yet - the app never shows a "lost" state.
 * - The first badge is reachable in three days. A four-year-old will not wait a
 *   month for the first sign that any of this is working.
 */

export type Badge = {
  id: string;
  icon: string;
  label: string;
  /** Shown under the label - what earned it. */
  detail: string;
};

export type BadgeTier = { threshold: number; icon: string; label: string };

/** Consecutive perfect days. */
export const STREAK_TIERS: BadgeTier[] = [
  { threshold: 3, icon: '🔥', label: 'On a roll' },
  { threshold: 7, icon: '⭐', label: 'A whole week' },
  { threshold: 14, icon: '💎', label: 'Two weeks' },
  { threshold: 30, icon: '👑', label: 'A whole month' },
];

/** Stars earned within one calendar month. */
export const STAR_TIERS: BadgeTier[] = [
  { threshold: 100, icon: '🌟', label: '100 stars' },
  { threshold: 250, icon: '🏅', label: '250 stars' },
  { threshold: 500, icon: '🏆', label: '500 stars' },
  { threshold: 1000, icon: '🚀', label: '1000 stars' },
];

/** Perfect days within one calendar month. */
export const PERFECT_TIERS: BadgeTier[] = [
  { threshold: 5, icon: '🎯', label: '5 perfect days' },
  { threshold: 10, icon: '🌈', label: '10 perfect days' },
  { threshold: 20, icon: '🦄', label: '20 perfect days' },
];

/** The highest tier reached, or null. Only the top tier of each kind is shown. */
function topTier(tiers: BadgeTier[], value: number): BadgeTier | null {
  let best: BadgeTier | null = null;
  for (const tier of tiers) {
    if (value >= tier.threshold) best = tier;
  }
  return best;
}

export function earnedBadges(input: {
  streak: number;
  monthPoints: number;
  monthPerfectDays: number;
}): Badge[] {
  const badges: Badge[] = [];

  const streak = topTier(STREAK_TIERS, input.streak);
  if (streak) {
    badges.push({
      id: `streak-${streak.threshold}`,
      icon: streak.icon,
      label: streak.label,
      detail: `${input.streak} perfect days in a row`,
    });
  }

  const stars = topTier(STAR_TIERS, input.monthPoints);
  if (stars) {
    badges.push({
      id: `stars-${stars.threshold}`,
      icon: stars.icon,
      label: stars.label,
      detail: `${input.monthPoints.toLocaleString()} stars this month`,
    });
  }

  const perfect = topTier(PERFECT_TIERS, input.monthPerfectDays);
  if (perfect) {
    badges.push({
      id: `perfect-${perfect.threshold}`,
      icon: perfect.icon,
      label: perfect.label,
      detail: `${input.monthPerfectDays} perfect days this month`,
    });
  }

  return badges;
}

/**
 * The next thing within reach, so a child with no badges yet still has something
 * to aim at. Returns null once every tier is earned.
 */
export function nextGoal(input: {
  streak: number;
  monthPoints: number;
  monthPerfectDays: number;
}): { icon: string; label: string; remaining: number; unit: string } | null {
  const candidates = [
    ...STREAK_TIERS.filter((t) => input.streak < t.threshold).map((t) => ({
      tier: t,
      remaining: t.threshold - input.streak,
      unit: 'more perfect days in a row',
    })),
    ...STAR_TIERS.filter((t) => input.monthPoints < t.threshold).map((t) => ({
      tier: t,
      remaining: t.threshold - input.monthPoints,
      unit: 'more stars this month',
    })),
    ...PERFECT_TIERS.filter((t) => input.monthPerfectDays < t.threshold).map((t) => ({
      tier: t,
      remaining: t.threshold - input.monthPerfectDays,
      unit: 'more perfect days this month',
    })),
  ];

  if (candidates.length === 0) return null;

  // Whichever goal is closest in its own units - stars count down fastest, so a
  // streak goal wins ties and keeps the daily habit in front of the child.
  candidates.sort((a, b) => a.remaining - b.remaining);
  const best = candidates[0];

  return {
    icon: best.tier.icon,
    label: best.tier.label,
    remaining: best.remaining,
    unit: best.unit,
  };
}
