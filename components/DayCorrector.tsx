'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';
import { loadDayForCorrection } from '@/app/actions/correctDay';
import { toggleTask } from '@/app/actions/toggleTask';
import { SLOT_META, type Child, type ChildDay } from '@/lib/types';

/**
 * Fix a past day.
 *
 * Every toggle here passes parentOverride, which the server only honours while
 * the PIN cookie is valid - the flag alone grants nothing.
 */
export default function DayCorrector({ kids, today }: { kids: Child[]; today: string }) {
  const [childId, setChildId] = useState(kids[0]?.id ?? '');
  const [date, setDate] = useState(today);
  const [day, setDay] = useState<ChildDay | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const load = useCallback(() => {
    if (!childId) return;
    setError(null);
    startTransition(async () => {
      const result = await loadDayForCorrection(childId, date);
      if (result.ok && result.day) setDay(result.day);
      else {
        setDay(null);
        setError(result.error ?? 'Could not load that day.');
      }
    });
  }, [childId, date]);

  useEffect(load, [load]);

  const toggle = (taskId: string) => {
    startTransition(async () => {
      const result = await toggleTask({ childId, taskId, date, parentOverride: true });
      if (!result.ok) setError(result.error ?? 'That did not save.');
      else {
        setError(null);
        const refreshed = await loadDayForCorrection(childId, date);
        if (refreshed.ok && refreshed.day) setDay(refreshed.day);
      }
    });
  };

  const field = 'w-full rounded-2xl bg-surface px-4 text-lg font-semibold shadow-sm ring-1 ring-black/10';
  const tasks = day ? day.slots.flatMap((s) => s.tasks) : [];

  if (kids.length === 0) {
    return <p className="font-semibold text-muted">Add a child first.</p>;
  }

  return (
    <div className="flex flex-col gap-5">
      <p className="text-muted">
        Days lock at midnight so a child cannot change yesterday. You can.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-2">
          <span className="font-bold">Child</span>
          <select
            value={childId}
            onChange={(e) => setChildId(e.target.value)}
            className={field}
            style={{ height: 64 }}
          >
            {kids.map((c) => (
              <option key={c.id} value={c.id}>
                {c.avatar} {c.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-2">
          <span className="font-bold">Day</span>
          <input
            type="date"
            value={date}
            max={today}
            onChange={(e) => setDate(e.target.value)}
            className={field}
            style={{ height: 64 }}
          />
        </label>
      </div>

      {error && (
        <p role="alert" className="rounded-2xl bg-amber-50 px-4 py-3 font-bold text-amber-900">
          {error}
        </p>
      )}

      {day && (
        <>
          <p className="font-bold">
            {day.earned} stars · {day.completedCount} of {day.taskCount} done
            {day.isPerfect && ' · 🎉 perfect day'}
          </p>

          {tasks.length === 0 ? (
            <p className="font-semibold text-muted">No chores existed on that day.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {tasks.map((task) => (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => toggle(task.id)}
                  disabled={pending}
                  aria-pressed={task.completed}
                  className="flex items-center gap-3 rounded-2xl bg-surface p-3 text-left shadow-sm ring-1 ring-black/5 active:scale-[0.99] disabled:opacity-50"
                  style={{ minHeight: 64 }}
                >
                  <span className="text-2xl" aria-hidden="true">
                    {task.icon}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className={`truncate font-bold ${task.completed ? 'text-muted line-through' : ''}`}>
                      {task.title}
                    </span>
                    <span className="text-sm font-semibold text-muted">
                      {SLOT_META[task.slot].label} · +{task.points}
                      {task.is_extra && ' · extra'}
                    </span>
                  </span>
                  <span
                    className="grid h-12 w-12 shrink-0 place-items-center rounded-full text-2xl"
                    style={{
                      backgroundColor: task.completed ? day.child.color : 'var(--waiting)',
                      color: task.completed ? '#fff' : 'var(--waiting-ink)',
                    }}
                    aria-hidden="true"
                  >
                    {task.completed ? '✓' : ''}
                  </span>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
