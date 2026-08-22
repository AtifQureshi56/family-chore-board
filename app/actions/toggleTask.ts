'use server';

import { revalidatePath } from 'next/cache';
import { todayInKarachi } from '@/lib/dates';
import { isParentUnlocked } from '@/lib/parentSession';
// A 'use server' module may only export async functions - not types, not
// constants. Import ToggleResult from @/lib/toggle directly.
import { performToggle, type ToggleResult } from '@/lib/toggle';

/**
 * Toggle one chore for one child.
 *
 * The only thing this layer decides is whether a past-day write is permitted.
 * `parentOverride` from the client is a request, not a permission - the httpOnly
 * PIN cookie is the permission.
 */
export async function toggleTask(input: {
  childId: string;
  taskId: string;
  date?: string;
  parentOverride?: boolean;
}): Promise<ToggleResult> {
  const today = todayInKarachi();
  const date = input.date ?? today;

  const allowPastWrite = Boolean(input.parentOverride) && (await isParentUnlocked());

  const result = await performToggle({
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
