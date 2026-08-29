/**
 * The privacy guarantee, tested directly.
 *
 * Every query runs under the service-role key, which bypasses row-level security
 * entirely. That makes the `family_id` filter in lib/queries.ts the only thing
 * standing between one family's children and everybody else's - so it is worth
 * asserting rather than assuming. Two complete families are built here and each
 * read is checked from both sides.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type SupabaseClient } from '@supabase/supabase-js';
import {
  getActiveChildren,
  getAllChildren,
  getChild,
  getDayForChild,
  getDayTotals,
  getExtraChores,
  getLatestCompletion,
  getMonthTotals,
  getPerfectDaysByChild,
  getSharedTasks,
  getStreaksByChild,
  getTvBoardData,
  getVisibleTasks,
  hasParentPin,
} from '../lib/queries';
import { performToggle } from '../lib/toggle';
import { todayInKarachi } from '../lib/dates';
import { configured, createTestFamily, deleteTestFamily, testDb } from './helpers/family';

const describeIf = configured ? describe : describe.skip;

let db: SupabaseClient;
const today = todayInKarachi();
const [year, month] = today.split('-').map(Number);

type Household = { familyId: string; childId: string; sharedTaskId: string };
let one: Household;
let two: Household;

async function buildHousehold(label: string, points: number): Promise<Household> {
  const familyId = await createTestFamily(db, label);

  const { data: child, error: childError } = await db
    .from('children')
    .insert({
      family_id: familyId,
      name: `__test__ ${label} child`,
      color: '#123456',
      avatar: '🧪',
      sort_order: 1,
    })
    .select('id')
    .single();
  if (childError) throw childError;

  const { data: task, error: taskError } = await db
    .from('tasks')
    .insert({
      family_id: familyId,
      title: `__test__ ${label} chore`,
      icon: '🧪',
      slot: 'morning',
      points,
      sort_order: 1,
      child_id: null,
      on_date: null,
      created_on: '2020-01-01',
    })
    .select('id')
    .single();
  if (taskError) throw taskError;

  return { familyId, childId: child!.id as string, sharedTaskId: task!.id as string };
}

describeIf('family isolation (integration)', () => {
  beforeAll(async () => {
    db = testDb();
    // Different point values, so a leak shows up as a wrong number and not just a
    // wrong id.
    one = await buildHousehold('house-one', 5);
    two = await buildHousehold('house-two', 11);

    await performToggle({
      familyId: one.familyId,
      childId: one.childId,
      taskId: one.sharedTaskId,
      date: today,
      today,
    });
    await performToggle({
      familyId: two.familyId,
      childId: two.childId,
      taskId: two.sharedTaskId,
      date: today,
      today,
    });
  });

  afterAll(async () => {
    await deleteTestFamily(db, one?.familyId);
    await deleteTestFamily(db, two?.familyId);
  });

  it('the child lists never overlap', async () => {
    const activeOne = await getActiveChildren(one.familyId);
    const activeTwo = await getActiveChildren(two.familyId);

    expect(activeOne.map((c) => c.id)).toEqual([one.childId]);
    expect(activeTwo.map((c) => c.id)).toEqual([two.childId]);

    expect((await getAllChildren(one.familyId)).map((c) => c.id)).not.toContain(two.childId);
    expect((await getAllChildren(two.familyId)).map((c) => c.id)).not.toContain(one.childId);
  });

  it("looking up another family's child by id returns nothing", async () => {
    // This is what turns a guessed or shared /child/<uuid> link into a 404.
    expect(await getChild(one.familyId, two.childId)).toBeNull();
    expect(await getChild(two.familyId, one.childId)).toBeNull();

    expect(await getDayForChild(one.familyId, two.childId, today)).toBeNull();
    expect(await getDayForChild(two.familyId, one.childId, today)).toBeNull();
  });

  it('the chore lists never overlap', async () => {
    const sharedOne = await getSharedTasks(one.familyId);
    expect(sharedOne.map((t) => t.id)).toEqual([one.sharedTaskId]);

    const visibleOne = await getVisibleTasks(one.familyId, one.childId, today);
    expect(visibleOne.map((t) => t.id)).toEqual([one.sharedTaskId]);
    expect(visibleOne.map((t) => t.id)).not.toContain(two.sharedTaskId);

    expect(await getExtraChores(one.familyId, two.childId, today)).toHaveLength(0);
  });

  it('stars, day totals and month totals stay inside their own family', async () => {
    const dayOne = await getDayTotals(one.familyId, today);
    expect(Object.keys(dayOne)).toEqual([one.childId]);
    expect(dayOne[one.childId].points).toBe(5);

    const dayTwo = await getDayTotals(two.familyId, today);
    expect(Object.keys(dayTwo)).toEqual([two.childId]);
    expect(dayTwo[two.childId].points).toBe(11);

    const monthOne = await getMonthTotals(one.familyId, year, month);
    expect(monthOne[two.childId]).toBeUndefined();
    expect(monthOne[one.childId].points).toBe(5);
  });

  it('perfect days and streaks stay inside their own family', async () => {
    // Each child has exactly one chore and has done it, so both families have a
    // perfect day today - which makes a leak easy to spot.
    const perfectOne = await getPerfectDaysByChild(one.familyId, today, today);
    expect(Object.keys(perfectOne)).toEqual([one.childId]);

    const streaksOne = await getStreaksByChild(one.familyId, today);
    expect(Object.keys(streaksOne)).toEqual([one.childId]);
  });

  it('the TV board shows only its own family', async () => {
    const boardOne = await getTvBoardData(one.familyId, today);
    expect(boardOne.map((r) => r.child.id)).toEqual([one.childId]);
    expect(boardOne[0].points).toBe(5);

    const latestOne = await getLatestCompletion(one.familyId, today);
    expect(latestOne!.taskTitle).toContain('house-one');
    expect(latestOne!.points).toBe(5);

    const latestTwo = await getLatestCompletion(two.familyId, today);
    expect(latestTwo!.taskTitle).toContain('house-two');
  });

  it("a toggle aimed at another family's child is refused", async () => {
    // The shape of a crafted request: a valid session for family one, but ids
    // belonging to family two.
    const wrongChild = await performToggle({
      familyId: one.familyId,
      childId: two.childId,
      taskId: two.sharedTaskId,
      date: today,
      today,
    });
    expect(wrongChild.ok).toBe(false);
    expect(wrongChild.error).toMatch(/not on this board/i);

    // And its own child cannot be pointed at another family's chore.
    const wrongTask = await performToggle({
      familyId: one.familyId,
      childId: one.childId,
      taskId: two.sharedTaskId,
      date: today,
      today,
    });
    expect(wrongTask.ok).toBe(false);
    expect(wrongTask.error).toMatch(/not on the list/i);

    // Nothing was written either way.
    const { data } = await db
      .from('completions')
      .select('id')
      .eq('family_id', one.familyId)
      .eq('child_id', two.childId);
    expect(data).toHaveLength(0);
  });

  it('the parent PIN is per family', async () => {
    expect(await hasParentPin(one.familyId)).toBe(false);

    await db.from('settings').insert({
      family_id: one.familyId,
      key: 'parent_pin_hash',
      value: '$2a$10$notarealhashbutshapedlikeone000000000000000000000000',
    });

    expect(await hasParentPin(one.familyId)).toBe(true);
    // Setting one family's PIN must not unlock, or lock, anyone else's.
    expect(await hasParentPin(two.familyId)).toBe(false);
  });
});
