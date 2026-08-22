/**
 * The acceptance tests from chore-board-spec.md section 9, run against the real
 * Supabase project.
 *
 * These create and delete their own children and tasks, prefixed `__test__`, and
 * clean up after themselves. They never touch the seeded family's data.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { performToggle } from '../lib/toggle';
import { getDayForChild, getPerfectDayStreak, getVisibleTasks } from '../lib/queries';
import { addDays, todayInKarachi } from '../lib/dates';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;

const configured = Boolean(url && secret);
const describeIf = configured ? describe : describe.skip;

let db: SupabaseClient;
const today = todayInKarachi();
const yesterday = addDays(today, -1);

// Created in beforeAll
let childA = '';
let childB = '';
let sharedTaskId = '';
let sharedTask2Id = '';

async function makeChild(name: string): Promise<string> {
  const { data, error } = await db
    .from('children')
    .insert({ name, color: '#123456', avatar: '🧪', sort_order: 999 })
    .select('id')
    .single();
  if (error) throw error;
  return data.id as string;
}

async function makeTask(fields: Record<string, unknown>): Promise<string> {
  const { data, error } = await db
    .from('tasks')
    .insert({
      title: '__test__ chore',
      icon: '🧪',
      slot: 'morning',
      points: 5,
      sort_order: 999,
      ...fields,
    })
    .select('id')
    .single();
  if (error) throw error;
  return data.id as string;
}

describeIf('toggle + scoring (integration)', () => {
  beforeAll(async () => {
    db = createClient(url!, secret!, { auth: { persistSession: false } });

    childA = await makeChild('__test__ A');
    childB = await makeChild('__test__ B');

    // Two shared chores, scoped to the test children only by being created with
    // a created_on far in the past so date filtering still works.
    sharedTaskId = await makeTask({ child_id: childA, created_on: '2020-01-01' });
    sharedTask2Id = await makeTask({ child_id: childA, created_on: '2020-01-01', sort_order: 1000 });
  });

  afterAll(async () => {
    if (!configured) return;
    // Completions and tasks cascade from the children.
    await db.from('children').delete().in('id', [childA, childB].filter(Boolean));
  });

  it('1. toggling an unchecked chore creates exactly one completion row', async () => {
    const result = await performToggle({ childId: childA, taskId: sharedTaskId, date: today, today });
    expect(result.ok).toBe(true);
    expect(result.completed).toBe(true);

    const { data } = await db
      .from('completions')
      .select('id')
      .eq('child_id', childA)
      .eq('task_id', sharedTaskId)
      .eq('completed_on', today);
    expect(data).toHaveLength(1);
  });

  it('2. toggling it again deletes that row', async () => {
    const result = await performToggle({ childId: childA, taskId: sharedTaskId, date: today, today });
    expect(result.ok).toBe(true);
    expect(result.completed).toBe(false);

    const { data } = await db
      .from('completions')
      .select('id')
      .eq('child_id', childA)
      .eq('task_id', sharedTaskId)
      .eq('completed_on', today);
    expect(data).toHaveLength(0);
  });

  it('3. toggling twice rapidly does not create two rows', async () => {
    // Both fire before either finishes - the unique constraint is what saves us.
    await Promise.all([
      performToggle({ childId: childA, taskId: sharedTaskId, date: today, today }),
      performToggle({ childId: childA, taskId: sharedTaskId, date: today, today }),
    ]);

    const { data } = await db
      .from('completions')
      .select('id')
      .eq('child_id', childA)
      .eq('task_id', sharedTaskId)
      .eq('completed_on', today);
    expect(data!.length).toBeLessThanOrEqual(1);

    // Leave it unchecked for the tests that follow.
    if (data!.length === 1) {
      await db.from('completions').delete().eq('id', data![0].id);
    }
  });

  it('6. changing a chore\'s point value does not alter an existing score', async () => {
    await performToggle({ childId: childA, taskId: sharedTaskId, date: today, today });
    await db.from('tasks').update({ points: 50 }).eq('id', sharedTaskId);

    const { data } = await db
      .from('completions')
      .select('points_awarded')
      .eq('child_id', childA)
      .eq('task_id', sharedTaskId)
      .eq('completed_on', today)
      .single();

    expect(data!.points_awarded).toBe(5); // snapshot, not the new 50

    await db.from('tasks').update({ points: 5 }).eq('id', sharedTaskId);
    await performToggle({ childId: childA, taskId: sharedTaskId, date: today, today });
  });

  it('8. a write to yesterday fails without a parent override', async () => {
    const denied = await performToggle({
      childId: childA,
      taskId: sharedTaskId,
      date: yesterday,
      today,
    });
    expect(denied.ok).toBe(false);
    expect(denied.error).toMatch(/grown-up/i);

    const allowed = await performToggle({
      childId: childA,
      taskId: sharedTaskId,
      date: yesterday,
      today,
      allowPastWrite: true,
    });
    expect(allowed.ok).toBe(true);

    // Undo it.
    await performToggle({
      childId: childA,
      taskId: sharedTaskId,
      date: yesterday,
      today,
      allowPastWrite: true,
    });
  });

  it('10. the day total equals the sum of points_awarded', async () => {
    await performToggle({ childId: childA, taskId: sharedTaskId, date: today, today });
    const result = await performToggle({ childId: childA, taskId: sharedTask2Id, date: today, today });

    const { data } = await db
      .from('completions')
      .select('points_awarded')
      .eq('child_id', childA)
      .eq('completed_on', today);

    const sum = data!.reduce((acc, r) => acc + (r.points_awarded as number), 0);
    expect(result.earned).toBe(sum);
    expect(sum).toBe(10);
  });

  it('records a perfect day, and clears it when a chore is unchecked', async () => {
    // Child A sees the shared family list too, not just its own test chores, so a
    // perfect day means completing every visible chore.
    const visible = await getVisibleTasks(childA, today);
    for (const task of visible) {
      const { data: already } = await db
        .from('completions')
        .select('id')
        .eq('child_id', childA)
        .eq('task_id', task.id)
        .eq('completed_on', today)
        .maybeSingle();
      if (!already) {
        await performToggle({ childId: childA, taskId: task.id, date: today, today });
      }
    }

    const day = await getDayForChild(childA, today);
    expect(day!.isPerfect).toBe(true);

    const { data: perfect } = await db
      .from('perfect_days')
      .select('on_date')
      .eq('child_id', childA)
      .eq('on_date', today);
    expect(perfect).toHaveLength(1);

    expect(await getPerfectDayStreak(childA, today)).toBe(1);

    // Unchecking one must revoke it.
    const undone = await performToggle({ childId: childA, taskId: sharedTask2Id, date: today, today });
    expect(undone.isPerfect).toBe(false);

    const { data: gone } = await db
      .from('perfect_days')
      .select('on_date')
      .eq('child_id', childA)
      .eq('on_date', today);
    expect(gone).toHaveLength(0);
  });

  it('refuses to toggle a chore that belongs to a different child', async () => {
    const result = await performToggle({ childId: childB, taskId: sharedTaskId, date: today, today });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/not on the list/i);
  });

  describe('extra chores', () => {
    it('a one-off extra chore shows only on its date, and only for its child', async () => {
      const oneOff = await makeTask({ child_id: childA, on_date: today, created_on: today });

      const aToday = await getVisibleTasks(childA, today);
      expect(aToday.map((t) => t.id)).toContain(oneOff);

      const aTomorrow = await getVisibleTasks(childA, addDays(today, 1));
      expect(aTomorrow.map((t) => t.id)).not.toContain(oneOff);

      const bToday = await getVisibleTasks(childB, today);
      expect(bToday.map((t) => t.id)).not.toContain(oneOff);

      await db.from('tasks').delete().eq('id', oneOff);
    });

    it('a recurring extra chore persists, and stays with its child', async () => {
      const recurring = await makeTask({ child_id: childA, on_date: null, created_on: today });

      const aTomorrow = await getVisibleTasks(childA, addDays(today, 1));
      expect(aTomorrow.map((t) => t.id)).toContain(recurring);

      const bTomorrow = await getVisibleTasks(childB, addDays(today, 1));
      expect(bTomorrow.map((t) => t.id)).not.toContain(recurring);

      await db.from('tasks').delete().eq('id', recurring);
    });

    it('a chore added today does not appear on a past day', async () => {
      const addedToday = await makeTask({ child_id: childA, created_on: today });

      const past = await getVisibleTasks(childA, yesterday);
      expect(past.map((t) => t.id)).not.toContain(addedToday);

      await db.from('tasks').delete().eq('id', addedToday);
    });

    it('a soft-deleted chore disappears from the list', async () => {
      const removed = await makeTask({ child_id: childA, created_on: '2020-01-01' });
      await db.from('tasks').update({ is_active: false }).eq('id', removed);

      const visible = await getVisibleTasks(childA, today);
      expect(visible.map((t) => t.id)).not.toContain(removed);

      await db.from('tasks').delete().eq('id', removed);
    });
  });
});
