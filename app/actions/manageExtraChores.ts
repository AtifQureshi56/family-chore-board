'use server';

import { revalidatePath } from 'next/cache';
import { createServiceClient } from '@/lib/supabase';
import { todayInKarachi } from '@/lib/dates';
import { requireParentZone } from '@/lib/parentSession';
import { SLOTS, type Slot } from '@/lib/types';

export type ExtraChoreInput = {
  childId: string;
  slot: Slot;
  title: string;
  icon: string;
  points: number;
  /** true = today only; false = every day until removed */
  todayOnly: boolean;
};

/**
 * Adds one extra chore to one child's list.
 *
 * The shared default list is never touched - this inserts a task row with
 * child_id set, which is what makes it visible to that child and nobody else.
 * `on_date` decides whether it is a one-off or part of their daily routine.
 */
export async function addExtraChore(
  input: ExtraChoreInput,
): Promise<{ ok: boolean; error?: string }> {
  const { familyId } = await requireParentZone();

  const title = input.title.trim();
  if (!title) return { ok: false, error: 'Give the chore a name.' };
  if (title.length > 60) return { ok: false, error: 'That name is too long.' };
  if (!SLOTS.includes(input.slot)) return { ok: false, error: 'Pick a time of day.' };

  const points = Math.round(input.points);
  if (!Number.isFinite(points) || points < 1 || points > 100) {
    return { ok: false, error: 'Points must be between 1 and 100.' };
  }

  const db = createServiceClient();
  const today = todayInKarachi();
  const onDate = input.todayOnly ? today : null;

  // Confirms the child is on THIS family's board, not just that the id exists.
  const { data: child } = await db
    .from('children')
    .select('id')
    .eq('id', input.childId)
    .eq('family_id', familyId)
    .eq('is_active', true)
    .maybeSingle();
  if (!child) return { ok: false, error: 'That child is not on the board.' };

  // A double-submit must not produce two identical chores.
  const duplicate = db
    .from('tasks')
    .select('id')
    .eq('family_id', familyId)
    .eq('child_id', input.childId)
    .eq('slot', input.slot)
    .eq('title', title)
    .eq('is_active', true);

  const { data: existing } = await (onDate
    ? duplicate.eq('on_date', onDate)
    : duplicate.is('on_date', null));

  if (existing && existing.length > 0) {
    return { ok: false, error: `${title} is already on their list.` };
  }

  // Sits at the end of its slot, after the shared chores.
  const { data: last } = await db
    .from('tasks')
    .select('sort_order')
    .eq('family_id', familyId)
    .eq('slot', input.slot)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await db.from('tasks').insert({
    family_id: familyId,
    title,
    icon: input.icon || '⭐',
    slot: input.slot,
    points,
    sort_order: (last?.sort_order ?? 0) + 1,
    child_id: input.childId,
    on_date: onDate,
    created_on: today,
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath('/parent');
  revalidatePath('/');
  revalidatePath(`/child/${input.childId}`);
  return { ok: true };
}

/**
 * Soft-deletes an extra chore. Never a hard delete: completions point at it, and
 * removing the row would erase points the child has already earned.
 */
export async function removeExtraChore(taskId: string): Promise<{ ok: boolean; error?: string }> {
  const { familyId } = await requireParentZone();

  const db = createServiceClient();

  const { data: task } = await db
    .from('tasks')
    .select('id,child_id')
    .eq('id', taskId)
    .eq('family_id', familyId)
    .maybeSingle();

  if (!task) return { ok: false, error: 'That chore no longer exists.' };
  if (!task.child_id) {
    return { ok: false, error: 'That is a shared chore. Remove it from the chore list instead.' };
  }

  const { error } = await db
    .from('tasks')
    .update({ is_active: false })
    .eq('id', taskId)
    .eq('family_id', familyId);
  if (error) return { ok: false, error: error.message };

  revalidatePath('/parent');
  revalidatePath('/');
  revalidatePath(`/child/${task.child_id}`);
  return { ok: true };
}
