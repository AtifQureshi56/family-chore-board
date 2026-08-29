'use server';

import { requireParentZone } from '@/lib/parentSession';
import { getDayForChild } from '@/lib/queries';
import type { ChildDay } from '@/lib/types';

/**
 * Loads any child's day, past or present, for the parent zone's correction tool.
 * PIN-gated: the ordinary child screens can only ever load today.
 */
export async function loadDayForCorrection(
  childId: string,
  date: string,
): Promise<{ ok: boolean; day?: ChildDay; error?: string }> {
  const { familyId } = await requireParentZone();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { ok: false, error: 'Pick a valid date.' };
  }

  const day = await getDayForChild(familyId, childId, date);
  if (!day) return { ok: false, error: 'That child is not on the board.' };

  return { ok: true, day };
}
