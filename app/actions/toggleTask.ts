'use server';

import { revalidatePath } from 'next/cache';
import { todayInKarachi } from '@/lib/dates';
import { isParentUnlocked } from '@/lib/parentSession';
import { requireFamilyOrThrow } from '@/lib/session';
// A 'use server' module may only export async functions - not types, not
// constants. Import ToggleResult from @/lib/toggle directly.
import { performToggle, type ToggleResult } from '@/lib/toggle';

/**
 * Toggle one chore for one child.
 *
 * Two things in this layer are permissions rather than parameters. The family
 * comes from the signed-in session, so a childId from another family cannot be
 * written to whatever the request body claims. And `parentOverride` is a request,
 * not a permission - the httpOnly PIN cookie is the permission.
 */
export async function toggleTask(input: {
  childId: string;
  taskId: string;
  date?: string;
  parentOverride?: boolean;
}): Promise<ToggleResult> {
  const { familyId } = await requireFamilyOrThrow();

  const today = todayInKarachi();
  const date = input.date ?? today;

  const allowPastWrite = Boolean(input.parentOverride) && (await isParentUnlocked(familyId));

  const result = await performToggle({
    familyId,
    childId: input.childId,
    taskId: input.taskId,
    date,
    today,
    allowPastWrite,
  });

  if (result.ok) {
    revalidatePath('/');
    revalidatePath(`/child/${input.childId}`);
    revalidatePath('/scoreboard');
  }

  return result;
}
