'use server';

import { revalidatePath } from 'next/cache';
import { createServiceClient } from '@/lib/supabase';
import { todayInKarachi } from '@/lib/dates';
import { requireParentZone } from '@/lib/parentSession';
import { SLOTS, type Slot } from '@/lib/types';

export type TaskInput = {
  id?: string;
  title: string;
  icon: string;
  slot: Slot;
  points: number;
};

/**
 * Add or edit a chore on the SHARED list - the one every child sees. Extra chores
 * for a single child go through manageExtraChores instead.
 */
export async function saveTask(input: TaskInput): Promise<{ ok: boolean; error?: string }> {
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
  const fields = { title, icon: input.icon || '⭐', slot: input.slot, points };

  if (input.id) {
    // Editing points here deliberately does NOT touch past completions - their
    // points_awarded was snapshotted at check time.
    const { error } = await db
      .from('tasks')
      .update(fields)
      .eq('id', input.id)
      .eq('family_id', familyId)
      .is('child_id', null);
    if (error) return { ok: false, error: error.message };
  } else {
    const { data: last } = await db
      .from('tasks')
      .select('sort_order')
      .eq('family_id', familyId)
      .eq('slot', input.slot)
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle();

    const { error } = await db.from('tasks').insert({
      ...fields,
      family_id: familyId,
      sort_order: (last?.sort_order ?? 0) + 1,
      child_id: null,
      on_date: null,
      created_on: todayInKarachi(),
    });
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath('/parent');
  revalidatePath('/');
  return { ok: true };
}

/** Soft delete - completions point at this row and must keep their history. */
export async function removeTask(taskId: string): Promise<{ ok: boolean; error?: string }> {
  const { familyId } = await requireParentZone();

  const db = createServiceClient();
  const { error } = await db
    .from('tasks')
    .update({ is_active: false })
    .eq('id', taskId)
    .eq('family_id', familyId)
    .is('child_id', null);

  if (error) return { ok: false, error: error.message };

  revalidatePath('/parent');
  revalidatePath('/');
  return { ok: true };
}

/** Moves a shared chore up or down within its slot. */
export async function moveTask(
  taskId: string,
  direction: 'up' | 'down',
): Promise<{ ok: boolean; error?: string }> {
  const { familyId } = await requireParentZone();

  const db = createServiceClient();
  const { data: task } = await db
    .from('tasks')
    .select('id,slot,sort_order')
    .eq('id', taskId)
    .eq('family_id', familyId)
    .maybeSingle();
  if (!task) return { ok: false, error: 'That chore no longer exists.' };

  const { data: siblings } = await db
    .from('tasks')
    .select('id,sort_order')
    .eq('family_id', familyId)
    .eq('slot', task.slot)
    .is('child_id', null)
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  const list = siblings ?? [];
  const index = list.findIndex((t) => t.id === taskId);
  const swapWith = direction === 'up' ? index - 1 : index + 1;
  if (index === -1 || swapWith < 0 || swapWith >= list.length) return { ok: true };

  await db
    .from('tasks')
    .update({ sort_order: list[swapWith].sort_order })
    .eq('id', list[index].id)
    .eq('family_id', familyId);
  await db
    .from('tasks')
    .update({ sort_order: list[index].sort_order })
    .eq('id', list[swapWith].id)
    .eq('family_id', familyId);

  revalidatePath('/parent');
  revalidatePath('/');
  return { ok: true };
}
