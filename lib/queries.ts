import 'server-only';
import { createServiceClient } from './supabase';
import { addDays, monthRange } from './dates';
import {
  completedCount,
  dayTotal,
  dayAvailable,
  groupBySlot,
  isPerfectDay,
} from './scoring';
import type {
  Child,
  ChildDay,
  DayTask,
  DayTotal,
  LatestCompletion,
  MonthTotal,
  Task,
  TvChild,
} from './types';

const TASK_COLUMNS =
  'id,title,icon,slot,points,sort_order,is_active,child_id,on_date,created_on';

/**
 * Every function in this file takes familyId first and filters on it. That is not
 * a style choice: these run under the service-role key, which bypasses row-level
 * security completely, so the `.eq('family_id', ...)` on each query IS the wall
 * between one family's children and everyone else's. A query added here without
 * it leaks the whole table.
 *
 * familyId always comes from lib/session.ts, never from a client argument.
 */

/**
 * THE visibility rule. Every "which chores does this child have on this date"
 * calculation must go through here - the day view, the picker badges, the
 * progress ring, the perfect-day check and the TV board. Duplicating this
 * predicate anywhere is how the ring and the celebration end up disagreeing.
 *
 *   child_id null      -> shared default chore, everyone sees it
 *   child_id match     -> extra chore for this child
 *   on_date  null      -> recurring
 *   on_date  match     -> one-off for this date
 *   created_on <= date -> a chore added today cannot un-perfect a past day
 */
export async function getVisibleTasks(
  familyId: string,
  childId: string,
  date: string,
): Promise<Task[]> {
  const db = createServiceClient();
  const { data, error } = await db
    .from('tasks')
    .select(TASK_COLUMNS)
    .eq('family_id', familyId)
    .eq('is_active', true)
    .or(`child_id.is.null,child_id.eq.${childId}`)
    .or(`on_date.is.null,on_date.eq.${date}`)
    .lte('created_on', date)
    .order('sort_order', { ascending: true });

  if (error) throw error;
  return (data ?? []) as Task[];
}

export async function getActiveChildren(familyId: string): Promise<Child[]> {
  const db = createServiceClient();
  const { data, error } = await db
    .from('children')
    .select('*')
    .eq('family_id', familyId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (error) throw error;
  return (data ?? []) as Child[];
}

/** Every child including the removed ones - the parent zone needs to see both. */
export async function getAllChildren(familyId: string): Promise<Child[]> {
  const db = createServiceClient();
  const { data, error } = await db
    .from('children')
    .select('*')
    .eq('family_id', familyId)
    .order('is_active', { ascending: false })
    .order('sort_order', { ascending: true });

  if (error) throw error;
  return (data ?? []) as Child[];
}

/** The shared default list every child sees: child_id is null. */
export async function getSharedTasks(familyId: string): Promise<Task[]> {
  const db = createServiceClient();
  const { data, error } = await db
    .from('tasks')
    .select(TASK_COLUMNS)
    .eq('family_id', familyId)
    .is('child_id', null)
    .eq('is_active', true)
    .order('slot', { ascending: true })
    .order('sort_order', { ascending: true });

  if (error) throw error;
  return (data ?? []) as Task[];
}

/**
 * The extra chores added for one specific child. One-off chores whose date has
 * already passed are hidden - they are history, not something to manage.
 */
export async function getExtraChores(
  familyId: string,
  childId: string,
  today: string,
): Promise<Task[]> {
  const db = createServiceClient();
  const { data, error } = await db
    .from('tasks')
    .select(TASK_COLUMNS)
    .eq('family_id', familyId)
    .eq('child_id', childId)
    .eq('is_active', true)
    .or(`on_date.is.null,on_date.gte.${today}`)
    .order('slot', { ascending: true })
    .order('sort_order', { ascending: true });

  if (error) throw error;
  return (data ?? []) as Task[];
}

/**
 * One child, but only if they belong to this family. Returning null for a child
 * in someone else's family is what turns a guessed id in the URL into a 404.
 */
export async function getChild(familyId: string, childId: string): Promise<Child | null> {
  const db = createServiceClient();
  const { data, error } = await db
    .from('children')
    .select('*')
    .eq('family_id', familyId)
    .eq('id', childId)
    .maybeSingle();

  if (error) throw error;
  return (data as Child) ?? null;
}

/** Active tasks joined with that child's completions for the date. */
export async function getDayForChild(
  familyId: string,
  childId: string,
  date: string,
): Promise<ChildDay | null> {
  const db = createServiceClient();

  // The child lookup comes first and on its own: everything below reads rows
  // keyed by childId, so an id belonging to another family has to fail before
  // any of it runs.
  const child = await getChild(familyId, childId);
  if (!child) return null;

  const [tasks, completionsResult] = await Promise.all([
    getVisibleTasks(familyId, childId, date),
    db
      .from('completions')
      .select('task_id,points_awarded')
      .eq('family_id', familyId)
      .eq('child_id', childId)
      .eq('completed_on', date),
  ]);

  if (completionsResult.error) throw completionsResult.error;

  const done = new Set((completionsResult.data ?? []).map((c) => c.task_id as string));

  const dayTasks: DayTask[] = tasks.map((t) => ({
    ...t,
    completed: done.has(t.id),
    is_extra: t.child_id !== null,
  }));

  return {
    child,
    date,
    slots: groupBySlot(dayTasks),
    total: dayAvailable(dayTasks),
    earned: dayTotal(dayTasks),
    completedCount: completedCount(dayTasks),
    taskCount: dayTasks.length,
    isPerfect: isPerfectDay(dayTasks),
  };
}

/** Points per child for one date - powers the picker badges. */
export async function getDayTotals(
  familyId: string,
  date: string,
): Promise<Record<string, DayTotal>> {
  const db = createServiceClient();
  const children = await getActiveChildren(familyId);

  const [completionsResult, taskLists] = await Promise.all([
    db
      .from('completions')
      .select('child_id,points_awarded')
      .eq('family_id', familyId)
      .eq('completed_on', date),
    Promise.all(children.map((c) => getVisibleTasks(familyId, c.id, date))),
  ]);
  if (completionsResult.error) throw completionsResult.error;

  const totals: Record<string, DayTotal> = {};
  children.forEach((child, i) => {
    totals[child.id] = {
      child_id: child.id,
      points: 0,
      completedCount: 0,
      taskCount: taskLists[i].length,
    };
  });

  for (const row of completionsResult.data ?? []) {
    const entry = totals[row.child_id as string];
    if (!entry) continue;
    entry.points += row.points_awarded as number;
    entry.completedCount += 1;
  }

  return totals;
}

/** Points per child for a calendar month, plus that month's perfect-day count. */
export async function getMonthTotals(
  familyId: string,
  year: number,
  month: number,
): Promise<Record<string, MonthTotal>> {
  const db = createServiceClient();
  const { start, end } = monthRange(year, month);

  const [completions, perfect] = await Promise.all([
    db
      .from('completions')
      .select('child_id,points_awarded')
      .eq('family_id', familyId)
      .gte('completed_on', start)
      .lte('completed_on', end),
    db
      .from('perfect_days')
      .select('child_id')
      .eq('family_id', familyId)
      .gte('on_date', start)
      .lte('on_date', end),
  ]);
  if (completions.error) throw completions.error;
  if (perfect.error) throw perfect.error;

  const totals: Record<string, MonthTotal> = {};
  const bump = (id: string): MonthTotal => {
    totals[id] ??= { child_id: id, points: 0, perfectDays: 0 };
    return totals[id];
  };

  for (const row of completions.data ?? []) {
    bump(row.child_id as string).points += row.points_awarded as number;
  }
  for (const row of perfect.data ?? []) {
    bump(row.child_id as string).perfectDays += 1;
  }

  return totals;
}

/** Every perfect day for a child within a date range - powers the calendar grid. */
export async function getPerfectDays(
  familyId: string,
  childId: string,
  start: string,
  end: string,
): Promise<string[]> {
  const db = createServiceClient();
  const { data, error } = await db
    .from('perfect_days')
    .select('on_date')
    .eq('family_id', familyId)
    .eq('child_id', childId)
    .gte('on_date', start)
    .lte('on_date', end)
    .order('on_date', { ascending: true });

  if (error) throw error;
  return (data ?? []).map((r) => r.on_date as string);
}

/** Perfect days for every child in one range, keyed by child id. One round trip. */
export async function getPerfectDaysByChild(
  familyId: string,
  start: string,
  end: string,
): Promise<Record<string, string[]>> {
  const db = createServiceClient();
  const { data, error } = await db
    .from('perfect_days')
    .select('child_id,on_date')
    .eq('family_id', familyId)
    .gte('on_date', start)
    .lte('on_date', end);

  if (error) throw error;

  const out: Record<string, string[]> = {};
  for (const row of data ?? []) {
    (out[row.child_id as string] ??= []).push(row.on_date as string);
  }
  return out;
}

/**
 * Current streak for every child, in one round trip.
 *
 * A streak can span months, so this cannot be derived from the month view - it
 * reads back from today until the first gap.
 */
export async function getStreaksByChild(
  familyId: string,
  today: string,
): Promise<Record<string, number>> {
  const db = createServiceClient();
  const { data, error } = await db
    .from('perfect_days')
    .select('child_id,on_date')
    .eq('family_id', familyId)
    .lte('on_date', today)
    .order('on_date', { ascending: false })
    .limit(2000);

  if (error) throw error;

  const byChild: Record<string, Set<string>> = {};
  for (const row of data ?? []) {
    (byChild[row.child_id as string] ??= new Set()).add(row.on_date as string);
  }

  const streaks: Record<string, number> = {};
  for (const [childId, days] of Object.entries(byChild)) {
    // Yesterday is a valid anchor: a streak should not read as broken at 09:00,
    // before the child has had any chance to do anything today.
    let cursor = days.has(today) ? today : addDays(today, -1);
    let streak = 0;
    while (days.has(cursor)) {
      streak += 1;
      cursor = addDays(cursor, -1);
    }
    streaks[childId] = streak;
  }

  return streaks;
}

/**
 * Consecutive perfect days ending today or yesterday. Yesterday counts as the
 * anchor too - a streak should not read as broken at 09:00, before the child has
 * had any chance to do anything today.
 */
export async function getPerfectDayStreak(
  familyId: string,
  childId: string,
  today: string,
): Promise<number> {
  const db = createServiceClient();
  const { data, error } = await db
    .from('perfect_days')
    .select('on_date')
    .eq('family_id', familyId)
    .eq('child_id', childId)
    .lte('on_date', today)
    .order('on_date', { ascending: false })
    .limit(400);

  if (error) throw error;
  const days = new Set((data ?? []).map((r) => r.on_date as string));
  if (days.size === 0) return 0;

  let cursor = days.has(today) ? today : addDays(today, -1);
  let streak = 0;
  while (days.has(cursor)) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

/**
 * Everything the TV board needs, in as few round trips as possible. The TV polls
 * this every 30 seconds indefinitely, so an N+1 here would quietly consume the
 * Supabase free tier.
 */
export async function getTvBoardData(familyId: string, date: string): Promise<TvChild[]> {
  const db = createServiceClient();
  const { start, end } = monthRange(Number(date.slice(0, 4)), Number(date.slice(5, 7)));
  const children = await getActiveChildren(familyId);
  if (children.length === 0) return [];

  // Four queries, regardless of how many children are on the board. The TV polls
  // this every 30 seconds forever, so the per-child loop that used to live here
  // was an N+1 that would quietly eat the Supabase free tier.
  const [today, month, perfect, tasks] = await Promise.all([
    db
      .from('completions')
      .select('child_id,points_awarded')
      .eq('family_id', familyId)
      .eq('completed_on', date),
    db
      .from('completions')
      .select('child_id,points_awarded')
      .eq('family_id', familyId)
      .gte('completed_on', start)
      .lte('completed_on', end),
    db.from('perfect_days').select('child_id').eq('family_id', familyId).eq('on_date', date),
    db
      .from('tasks')
      .select('id,child_id')
      .eq('family_id', familyId)
      .eq('is_active', true)
      .or(`on_date.is.null,on_date.eq.${date}`)
      .lte('created_on', date),
  ]);
  if (today.error) throw today.error;
  if (month.error) throw month.error;
  if (perfect.error) throw perfect.error;
  if (tasks.error) throw tasks.error;

  const perfectIds = new Set((perfect.data ?? []).map((r) => r.child_id as string));

  // Mirrors getVisibleTasks: a shared chore (null child_id) counts for everyone,
  // an extra chore counts only for the child it belongs to.
  const sharedCount = (tasks.data ?? []).filter((t) => t.child_id === null).length;
  const extrasByChild = new Map<string, number>();
  for (const task of tasks.data ?? []) {
    if (task.child_id) {
      extrasByChild.set(
        task.child_id as string,
        (extrasByChild.get(task.child_id as string) ?? 0) + 1,
      );
    }
  }

  const dayByChild = new Map<string, { points: number; count: number }>();
  for (const row of today.data ?? []) {
    const entry = dayByChild.get(row.child_id as string) ?? { points: 0, count: 0 };
    entry.points += row.points_awarded as number;
    entry.count += 1;
    dayByChild.set(row.child_id as string, entry);
  }

  const monthByChild = new Map<string, number>();
  for (const row of month.data ?? []) {
    monthByChild.set(
      row.child_id as string,
      (monthByChild.get(row.child_id as string) ?? 0) + (row.points_awarded as number),
    );
  }

  return children.map((child) => {
    const day = dayByChild.get(child.id) ?? { points: 0, count: 0 };
    return {
      child,
      points: day.points,
      completedCount: day.count,
      taskCount: sharedCount + (extrasByChild.get(child.id) ?? 0),
      isPerfect: perfectIds.has(child.id),
      monthPoints: monthByChild.get(child.id) ?? 0,
    };
  });
}

/** Most recent completion, for the TV activity strip. */
export async function getLatestCompletion(
  familyId: string,
  date: string,
): Promise<LatestCompletion | null> {
  const db = createServiceClient();
  const { data, error } = await db
    .from('completions')
    .select('created_at,points_awarded,children(name,color),tasks(title,icon)')
    .eq('family_id', familyId)
    .eq('completed_on', date)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const child = data.children as unknown as { name: string; color: string } | null;
  const task = data.tasks as unknown as { title: string; icon: string } | null;
  if (!child || !task) return null;

  return {
    childName: child.name,
    childColor: child.color,
    taskTitle: task.title,
    taskIcon: task.icon,
    points: data.points_awarded as number,
    at: data.created_at as string,
  };
}

/**
 * Whether this family has chosen a parent PIN yet.
 *
 * A family created by a fresh Google sign-in has none, and the parent zone shows
 * "choose a PIN" instead of "enter your PIN". Before multi-tenancy the PIN was
 * planted by `npm run seed`, which no new user will ever run.
 */
export async function hasParentPin(familyId: string): Promise<boolean> {
  const db = createServiceClient();
  const { data, error } = await db
    .from('settings')
    .select('key')
    .eq('family_id', familyId)
    .eq('key', 'parent_pin_hash')
    .maybeSingle();

  if (error) throw error;
  return data !== null;
}
