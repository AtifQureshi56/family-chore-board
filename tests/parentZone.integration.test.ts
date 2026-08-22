/**
 * Phase 4 behaviour, against the real database.
 *
 * The server actions themselves need a request context (cookies), so these test
 * the layer underneath them plus the rules that the actions enforce: soft delete
 * preserves history, the PIN is hashed and verifiable, and extra chores land on
 * exactly one child's list.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import bcrypt from 'bcryptjs';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getExtraChores, getMonthTotals, getSharedTasks, getVisibleTasks } from '../lib/queries';
import { performToggle } from '../lib/toggle';
import { addDays, todayInKarachi } from '../lib/dates';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
const describeIf = url && secret ? describe : describe.skip;

let db: SupabaseClient;
const today = todayInKarachi();

let childId = '';
let otherChildId = '';

describeIf('parent zone (integration)', () => {
  beforeAll(async () => {
    db = createClient(url!, secret!, { auth: { persistSession: false } });

    const { data } = await db
      .from('children')
      .insert([
        { name: '__test__ P1', color: '#123456', avatar: '🧪', sort_order: 998 },
        { name: '__test__ P2', color: '#654321', avatar: '🧪', sort_order: 999 },
      ])
      .select('id');

    childId = data![0].id as string;
    otherChildId = data![1].id as string;
  });

  afterAll(async () => {
    await db.from('children').delete().in('id', [childId, otherChildId].filter(Boolean));
  });

  it('the PIN is stored hashed, never in plain text', async () => {
    const { data } = await db
      .from('settings')
      .select('value')
      .eq('key', 'parent_pin_hash')
      .single();

    const hash = String(data!.value);
    expect(hash).not.toBe('1234');
    expect(hash.startsWith('$2')).toBe(true); // bcrypt
    expect(bcrypt.compareSync('1234', hash)).toBe(true);
    expect(bcrypt.compareSync('9999', hash)).toBe(false);
  });

  it('an extra chore lands on one child only, and never on the shared list', async () => {
    const { data: extra } = await db
      .from('tasks')
      .insert({
        title: '__test__ water the plants',
        icon: '🪴',
        slot: 'evening',
        points: 5,
        sort_order: 500,
        child_id: childId,
        on_date: null,
        created_on: today,
      })
      .select('id')
      .single();

    const mine = await getVisibleTasks(childId, today);
    expect(mine.map((t) => t.id)).toContain(extra!.id);

    const theirs = await getVisibleTasks(otherChildId, today);
    expect(theirs.map((t) => t.id)).not.toContain(extra!.id);

    // The shared list - what every child gets by default - must be unchanged.
    const shared = await getSharedTasks();
    expect(shared.map((t) => t.id)).not.toContain(extra!.id);
    expect(shared.every((t) => t.child_id === null)).toBe(true);

    await db.from('tasks').delete().eq('id', extra!.id);
  });

  it('a child with no extras sees exactly the shared list', async () => {
    const shared = await getSharedTasks();
    const visible = await getVisibleTasks(otherChildId, today);
    expect(visible.map((t) => t.id).sort()).toEqual(shared.map((t) => t.id).sort());
  });

  it('getExtraChores hides a one-off whose day has passed', async () => {
    const { data: rows } = await db
      .from('tasks')
      .insert([
        {
          title: '__test__ yesterday one-off',
          icon: '🧪',
          slot: 'morning',
          points: 5,
          sort_order: 501,
          child_id: childId,
          on_date: addDays(today, -1),
          created_on: addDays(today, -1),
        },
        {
          title: '__test__ today one-off',
          icon: '🧪',
          slot: 'morning',
          points: 5,
          sort_order: 502,
          child_id: childId,
          on_date: today,
          created_on: today,
        },
      ])
      .select('id,title');

    const extras = await getExtraChores(childId, today);
    const titles = extras.map((t) => t.title);
    expect(titles).toContain('__test__ today one-off');
    expect(titles).not.toContain('__test__ yesterday one-off');

    await db.from('tasks').delete().in('id', rows!.map((r) => r.id));
  });

  it('a soft-deleted chore vanishes from the list but keeps its earned stars', async () => {
    const { data: task } = await db
      .from('tasks')
      .insert({
        title: '__test__ soft delete me',
        icon: '🧪',
        slot: 'morning',
        points: 7,
        sort_order: 503,
        child_id: childId,
        created_on: '2020-01-01',
      })
      .select('id')
      .single();

    await performToggle({ childId, taskId: task!.id, date: today, today });

    // Soft delete, exactly as removeExtraChore does.
    await db.from('tasks').update({ is_active: false }).eq('id', task!.id);

    const visible = await getVisibleTasks(childId, today);
    expect(visible.map((t) => t.id)).not.toContain(task!.id);

    // The completion - and its 7 points - survives.
    const { data: completion } = await db
      .from('completions')
      .select('points_awarded')
      .eq('child_id', childId)
      .eq('task_id', task!.id)
      .eq('completed_on', today)
      .maybeSingle();

    expect(completion?.points_awarded).toBe(7);

    await db.from('completions').delete().eq('task_id', task!.id);
    await db.from('tasks').delete().eq('id', task!.id);
  });

  it('7. soft-deleting a child hides them but preserves their month total', async () => {
    const shared = await getSharedTasks();
    await performToggle({ childId, taskId: shared[0].id, date: today, today });

    const [year, month] = today.split('-').map(Number);
    const before = (await getMonthTotals(year, month))[childId];
    expect(before.points).toBeGreaterThan(0);

    await db.from('children').update({ is_active: false }).eq('id', childId);

    const { data: active } = await db.from('children').select('id').eq('is_active', true);
    expect(active!.map((c) => c.id)).not.toContain(childId);

    const after = (await getMonthTotals(year, month))[childId];
    expect(after.points).toBe(before.points);

    await db.from('children').update({ is_active: true }).eq('id', childId);
    await db.from('completions').delete().eq('child_id', childId);
  });
});
