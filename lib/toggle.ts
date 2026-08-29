import 'server-only';
import { createServiceClient } from './supabase';
import { getChild, getVisibleTasks } from './queries';
import { isPerfectDay } from './scoring';
import type { DayTask } from './types';

export type ToggleResult = {
  ok: boolean;
  error?: string;
  /** State after the toggle, so the client can reconcile its optimistic guess. */
  completed?: boolean;
  earned?: number;
  completedCount?: number;
  taskCount?: number;
  isPerfect?: boolean;
  /** True only on the transition into a perfect day - the moment worth celebrating. */
  becamePerfect?: boolean;
};

/**
 * Insert if absent, delete if present - the whole product, in one function.
 *
 * This deliberately knows nothing about cookies or requests so it can be tested
 * directly against the database. The caller decides whether a past-day write is
 * allowed; see app/actions/toggleTask.ts, where that decision is the PIN cookie.
 *
 * familyId comes from the signed-in session, never from the request body. Both it
 * and childId are checked below, because the browser can send any id it likes.
 */
export async function performToggle(input: {
  familyId: string;
  childId: string;
  taskId: string;
  /** The date being written to. */
  date: string;
  /** Today's Karachi date. */
  today: string;
  /** Only ever true when the parent zone is genuinely unlocked. */
  allowPastWrite?: boolean;
}): Promise<ToggleResult> {
  const { familyId, childId, taskId, date, today } = input;

  // Days lock at local midnight.
  if (date !== today && !input.allowPastWrite) {
    return { ok: false, error: 'That day is finished. Ask a grown-up to change it.' };
  }

  const db = createServiceClient();

  // Someone else's child, or one that no longer exists. Checked before anything
  // is written: without it a crafted request would attach a completion row from
  // this family to a child in another one.
  const child = await getChild(familyId, childId);
  if (!child) return { ok: false, error: 'That child is not on this board.' };

  // A child may only toggle a chore that is actually theirs on that date. Without
  // this, a crafted request could complete another child's extra chore.
  const visible = await getVisibleTasks(familyId, childId, date);
  const task = visible.find((t) => t.id === taskId);
  if (!task) return { ok: false, error: 'That chore is not on the list today.' };

  const [{ data: existing, error: findError }, { data: priorPerfect }] = await Promise.all([
    db
      .from('completions')
      .select('id')
      .eq('family_id', familyId)
      .eq('child_id', childId)
      .eq('task_id', taskId)
      .eq('completed_on', date)
      .maybeSingle(),
    db
      .from('perfect_days')
      .select('on_date')
      .eq('family_id', familyId)
      .eq('child_id', childId)
      .eq('on_date', date)
      .maybeSingle(),
  ]);
  if (findError) return { ok: false, error: findError.message };

  const wasPerfect = Boolean(priorPerfect);

  if (existing) {
    const { error } = await db.from('completions').delete().eq('id', existing.id);
    if (error) return { ok: false, error: error.message };
  } else {
    // points_awarded is snapshotted so that changing a chore's value later never
    // rewrites past scores. ignoreDuplicates makes a rapid double-tap harmless -
    // the unique constraint already makes double-scoring structurally impossible.
    const { error } = await db.from('completions').upsert(
      {
        family_id: familyId,
        child_id: childId,
        task_id: taskId,
        completed_on: date,
        points_awarded: task.points,
      },
      { onConflict: 'child_id,task_id,completed_on', ignoreDuplicates: true },
    );
    if (error) return { ok: false, error: error.message };
  }

  const { data: rows } = await db
    .from('completions')
    .select('task_id,points_awarded')
    .eq('family_id', familyId)
    .eq('child_id', childId)
    .eq('completed_on', date);

  const done = new Set((rows ?? []).map((r) => r.task_id as string));
  const dayTasks: DayTask[] = visible.map((t) => ({
    ...t,
    completed: done.has(t.id),
    is_extra: t.child_id !== null,
  }));

  const perfect = isPerfectDay(dayTasks);

  // Record or clear the perfect day. The streak counter reads this table rather
  // than trying to reconstruct which chores existed on a past date.
  if (perfect) {
    await db
      .from('perfect_days')
      .upsert(
        { family_id: familyId, child_id: childId, on_date: date },
        { onConflict: 'child_id,on_date' },
      );
  } else {
    await db
      .from('perfect_days')
      .delete()
      .eq('family_id', familyId)
      .eq('child_id', childId)
      .eq('on_date', date);
  }

  return {
    ok: true,
    completed: !existing,
    earned: (rows ?? []).reduce((sum, r) => sum + (r.points_awarded as number), 0),
    completedCount: (rows ?? []).length,
    taskCount: visible.length,
    isPerfect: perfect,
    becamePerfect: perfect && !wasPerfect,
  };
}
