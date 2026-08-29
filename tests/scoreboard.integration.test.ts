/**
 * Phase 5: "Done when monthly totals reconcile against a manual count."
 *
 * These count the completion rows by hand and compare against what the scoreboard
 * queries report, including the month-boundary cases.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type SupabaseClient } from '@supabase/supabase-js';
import {
  getMonthTotals,
  getPerfectDaysByChild,
  getStreaksByChild,
  getPerfectDayStreak,
} from '../lib/queries';
import { addDays, monthRange, todayInKarachi } from '../lib/dates';
import { configured, createTestFamily, deleteTestFamily, testDb } from './helpers/family';

const describeIf = configured ? describe : describe.skip;

let db: SupabaseClient;
let familyId = '';
let childId = '';
let taskId = '';

const today = todayInKarachi();
const [year, month] = today.split('-').map(Number);
const { start, end } = monthRange(year, month);

describeIf('scoreboard (integration)', () => {
  beforeAll(async () => {
    db = testDb();
    familyId = await createTestFamily(db, 'scoreboard');

    const { data: child } = await db
      .from('children')
      .insert({
        family_id: familyId,
        name: '__test__ S1',
        color: '#123456',
        avatar: '🧪',
        sort_order: 997,
      })
      .select('id')
      .single();
    childId = child!.id as string;

    const { data: task } = await db
      .from('tasks')
      .insert({
        family_id: familyId,
        title: '__test__ scoreboard chore',
        icon: '🧪',
        slot: 'morning',
        points: 5,
        sort_order: 600,
        child_id: childId,
        created_on: '2020-01-01',
      })
      .select('id')
      .single();
    taskId = task!.id as string;
  });

  afterAll(async () => {
    await deleteTestFamily(db, familyId);
  });

  it('the month total equals a hand count of points_awarded', async () => {
    // Three completions inside the month, with deliberately different values.
    const inMonth = [
      { on: start, points: 5 },
      { on: addDays(start, 1), points: 10 },
      { on: end, points: 3 },
    ];

    await db.from('completions').insert(
      inMonth.map((row) => ({
        family_id: familyId,
        child_id: childId,
        task_id: taskId,
        completed_on: row.on,
        points_awarded: row.points,
      })),
    );

    const handCount = inMonth.reduce((sum, r) => sum + r.points, 0);
    expect(handCount).toBe(18);

    const totals = await getMonthTotals(familyId, year, month);
    expect(totals[childId].points).toBe(handCount);

    // And it agrees with a raw query over the same window.
    const { data } = await db
      .from('completions')
      .select('points_awarded')
      .eq('child_id', childId)
      .gte('completed_on', start)
      .lte('completed_on', end);

    expect(data!.reduce((s, r) => s + (r.points_awarded as number), 0)).toBe(handCount);
  });

  it('excludes days either side of the month boundary', async () => {
    const dayBefore = addDays(start, -1);
    const dayAfter = addDays(end, 1);

    await db.from('completions').insert([
      { family_id: familyId, child_id: childId, task_id: taskId, completed_on: dayBefore, points_awarded: 99 },
      { family_id: familyId, child_id: childId, task_id: taskId, completed_on: dayAfter, points_awarded: 99 },
    ]);

    const totals = await getMonthTotals(familyId, year, month);
    // Still 18 - the 99s belong to the neighbouring months.
    expect(totals[childId].points).toBe(18);

    await db
      .from('completions')
      .delete()
      .eq('child_id', childId)
      .in('completed_on', [dayBefore, dayAfter]);
  });

  it('counts perfect days and reports them per child', async () => {
    await db.from('perfect_days').insert([
      { family_id: familyId, child_id: childId, on_date: start },
      { family_id: familyId, child_id: childId, on_date: addDays(start, 1) },
    ]);

    const totals = await getMonthTotals(familyId, year, month);
    expect(totals[childId].perfectDays).toBe(2);

    const byChild = await getPerfectDaysByChild(familyId, start, end);
    expect(byChild[childId].sort()).toEqual([start, addDays(start, 1)].sort());
  });

  it('the batched streak agrees with the single-child streak', async () => {
    // A clean three-day run ending today.
    await db.from('perfect_days').delete().eq('child_id', childId);
    await db.from('perfect_days').insert([
      { family_id: familyId, child_id: childId, on_date: today },
      { family_id: familyId, child_id: childId, on_date: addDays(today, -1) },
      { family_id: familyId, child_id: childId, on_date: addDays(today, -2) },
      // A gap, then an older run that must not be counted.
      { family_id: familyId, child_id: childId, on_date: addDays(today, -5) },
    ]);

    const batched = await getStreaksByChild(familyId, today);
    const single = await getPerfectDayStreak(familyId, childId, today);

    expect(single).toBe(3);
    expect(batched[childId]).toBe(3);
  });

  it('a streak ending yesterday still counts', async () => {
    await db.from('perfect_days').delete().eq('child_id', childId);
    await db.from('perfect_days').insert([
      { family_id: familyId, child_id: childId, on_date: addDays(today, -1) },
      { family_id: familyId, child_id: childId, on_date: addDays(today, -2) },
    ]);

    // Not broken just because today is not finished yet.
    expect(await getPerfectDayStreak(familyId, childId, today)).toBe(2);
  });

  it('a streak broken two days ago reads as zero', async () => {
    await db.from('perfect_days').delete().eq('child_id', childId);
    await db.from('perfect_days').insert([{ family_id: familyId, child_id: childId, on_date: addDays(today, -2) }]);

    expect(await getPerfectDayStreak(familyId, childId, today)).toBe(0);
  });
});
