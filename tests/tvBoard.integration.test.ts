/**
 * Phase 7: the TV board's data layer.
 *
 * getTvBoardData computes each child's chore count in memory from one tasks
 * query, rather than calling getVisibleTasks per child. That is faster but it
 * duplicates the visibility rule, so these tests pin the two together: if they
 * ever disagree, the TV shows a different total from the tablet.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getLatestCompletion, getTvBoardData, getVisibleTasks } from '../lib/queries';
import { performToggle } from '../lib/toggle';
import { addDays, todayInKarachi } from '../lib/dates';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
const describeIf = url && secret ? describe : describe.skip;

let db: SupabaseClient;
let childA = '';
let childB = '';
const created: string[] = [];
const today = todayInKarachi();

async function makeTask(fields: Record<string, unknown>): Promise<string> {
  const { data, error } = await db
    .from('tasks')
    .insert({
      title: '__test__ tv chore',
      icon: '🧪',
      slot: 'morning',
      points: 5,
      sort_order: 700,
      created_on: '2020-01-01',
      ...fields,
    })
    .select('id')
    .single();
  if (error) throw error;
  created.push(data!.id as string);
  return data!.id as string;
}

describeIf('tv board (integration)', () => {
  beforeAll(async () => {
    db = createClient(url!, secret!, { auth: { persistSession: false } });

    const { data } = await db
      .from('children')
      .insert([
        { name: '__test__ TV1', color: '#111111', avatar: '🧪', sort_order: 990 },
        { name: '__test__ TV2', color: '#222222', avatar: '🧪', sort_order: 991 },
      ])
      .select('id');

    childA = data![0].id as string;
    childB = data![1].id as string;
  });

  afterAll(async () => {
    if (created.length) await db.from('tasks').delete().in('id', created);
    await db.from('children').delete().in('id', [childA, childB].filter(Boolean));
  });

  it('agrees with getVisibleTasks on every child, including extras', async () => {
    // One extra for A only, plus a one-off for A today.
    await makeTask({ child_id: childA });
    await makeTask({ child_id: childA, on_date: today });
    await makeTask({ child_id: childB });

    const board = await getTvBoardData(today);
    expect(board.length).toBeGreaterThanOrEqual(2);

    for (const row of board) {
      const visible = await getVisibleTasks(row.child.id, today);
      expect(row.taskCount).toBe(visible.length);
    }
  });

  it('excludes a one-off chore dated yesterday', async () => {
    const stale = await makeTask({ child_id: childA, on_date: addDays(today, -1) });

    const board = await getTvBoardData(today);
    const rowA = board.find((r) => r.child.id === childA)!;
    const visible = await getVisibleTasks(childA, today);

    expect(rowA.taskCount).toBe(visible.length);
    expect(visible.map((t) => t.id)).not.toContain(stale);
  });

  it('excludes a soft-deleted chore', async () => {
    const removed = await makeTask({ child_id: childB });
    const before = (await getTvBoardData(today)).find((r) => r.child.id === childB)!.taskCount;

    await db.from('tasks').update({ is_active: false }).eq('id', removed);

    const after = (await getTvBoardData(today)).find((r) => r.child.id === childB)!.taskCount;
    expect(after).toBe(before - 1);
  });

  it("reports today's points, completed count and month total", async () => {
    const task = await makeTask({ child_id: childA, points: 7 });
    await performToggle({ childId: childA, taskId: task, date: today, today });

    const rowA = (await getTvBoardData(today)).find((r) => r.child.id === childA)!;
    expect(rowA.points).toBeGreaterThanOrEqual(7);
    expect(rowA.completedCount).toBeGreaterThanOrEqual(1);
    expect(rowA.monthPoints).toBeGreaterThanOrEqual(rowA.points);
    expect(rowA.isPerfect).toBe(false); // other chores remain

    await db.from('completions').delete().eq('task_id', task);
  });

  it('getLatestCompletion carries the names the activity strip needs', async () => {
    const task = await makeTask({ child_id: childA, points: 5, title: '__test__ take a shower' });
    await performToggle({ childId: childA, taskId: task, date: today, today });

    const latest = await getLatestCompletion(today);
    expect(latest).not.toBeNull();
    expect(latest!.childName).toBe('__test__ TV1');
    expect(latest!.taskTitle).toBe('__test__ take a shower');
    expect(latest!.points).toBe(5);
    expect(latest!.childColor).toBe('#111111');

    await db.from('completions').delete().eq('task_id', task);
  });

  it('a child with no chores at all is never marked perfect', async () => {
    const board = await getTvBoardData(today);
    for (const row of board) {
      if (row.taskCount === 0) expect(row.isPerfect).toBe(false);
    }
  });
});
