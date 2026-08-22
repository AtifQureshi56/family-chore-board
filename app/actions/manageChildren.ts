'use server';

import { revalidatePath } from 'next/cache';
import { createServiceClient } from '@/lib/supabase';
import { requireParent } from '@/lib/parentSession';

export type ChildInput = {
  id?: string;
  name: string;
  color: string;
  avatar: string;
};

function validate(input: ChildInput): string | null {
  if (!input.name.trim()) return 'Give them a name.';
  if (input.name.trim().length > 24) return 'That name is too long.';
  if (!/^#[0-9a-fA-F]{6}$/.test(input.color)) return 'Pick a colour.';
  if (!input.avatar.trim()) return 'Pick an avatar.';
  return null;
}

export async function saveChild(input: ChildInput): Promise<{ ok: boolean; error?: string }> {
  await requireParent();

  const problem = validate(input);
  if (problem) return { ok: false, error: problem };

  const db = createServiceClient();
  const fields = {
    name: input.name.trim(),
    color: input.color,
    avatar: input.avatar.trim(),
  };

  if (input.id) {
    const { error } = await db.from('children').update(fields).eq('id', input.id);
    if (error) return { ok: false, error: error.message };
  } else {
    // Appends at the end of the picker.
    const { data: last } = await db
      .from('children')
      .select('sort_order')
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle();

    const { error } = await db
      .from('children')
      .insert({ ...fields, sort_order: (last?.sort_order ?? 0) + 1 });
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath('/parent');
  revalidatePath('/');
  return { ok: true };
}

/**
 * Soft delete: hides them from the picker but preserves their history, so their
 * past months still reconcile.
 */
export async function removeChild(childId: string): Promise<{ ok: boolean; error?: string }> {
  await requireParent();

  const db = createServiceClient();
  const { error } = await db.from('children').update({ is_active: false }).eq('id', childId);
  if (error) return { ok: false, error: error.message };

  revalidatePath('/parent');
  revalidatePath('/');
  return { ok: true };
}

export async function restoreChild(childId: string): Promise<{ ok: boolean; error?: string }> {
  await requireParent();

  const db = createServiceClient();
  const { error } = await db.from('children').update({ is_active: true }).eq('id', childId);
  if (error) return { ok: false, error: error.message };

  revalidatePath('/parent');
  revalidatePath('/');
  return { ok: true };
}

/** Moves a child one place up or down in the picker. */
export async function moveChild(
  childId: string,
  direction: 'up' | 'down',
): Promise<{ ok: boolean; error?: string }> {
  await requireParent();

  const db = createServiceClient();
  const { data: children, error } = await db
    .from('children')
    .select('id,sort_order')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (error) return { ok: false, error: error.message };

  const list = children ?? [];
  const index = list.findIndex((c) => c.id === childId);
  const swapWith = direction === 'up' ? index - 1 : index + 1;
  if (index === -1 || swapWith < 0 || swapWith >= list.length) return { ok: true };

  // Swap the two sort_order values.
  await db
    .from('children')
    .update({ sort_order: list[swapWith].sort_order })
    .eq('id', list[index].id);
  await db
    .from('children')
    .update({ sort_order: list[index].sort_order })
    .eq('id', list[swapWith].id);

  revalidatePath('/parent');
  revalidatePath('/');
  return { ok: true };
}
