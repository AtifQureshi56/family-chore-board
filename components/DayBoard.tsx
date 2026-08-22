'use client';

import { useCallback, useRef, useState } from 'react';
import { toggleTask } from '@/app/actions/toggleTask';
import { completedCount, dayTotal, isPerfectDay } from '@/lib/scoring';
import type { ChildDay, DayTask } from '@/lib/types';
import CelebrationOverlay from './CelebrationOverlay';
import ProgressRing from './ProgressRing';
import SlotSection from './SlotSection';
import StarCounter from './StarCounter';
import { playCheckSound } from '@/lib/sound';

/**
 * Owns the optimistic state for one child's day.
 *
 * Toggling must feel instant: local state flips first, the server action follows,
 * and only a failure rolls it back. A child who taps and waits 400ms for a spinner
 * will tap again and create confusing state.
 */
export default function DayBoard({ day }: { day: ChildDay }) {
  const { child, date } = day;

  const [tasks, setTasks] = useState<DayTask[]>(() => day.slots.flatMap((s) => s.tasks));
  const [error, setError] = useState<string | null>(null);
  const [celebrating, setCelebrating] = useState(false);

  // A tap already in flight for this chore is ignored rather than queued.
  const inFlight = useRef<Set<string>>(new Set());

  const earned = dayTotal(tasks);
  const done = completedCount(tasks);
  const perfect = isPerfectDay(tasks);

  const handleToggle = useCallback(
    async (taskId: string) => {
      if (inFlight.current.has(taskId)) return;
      inFlight.current.add(taskId);
      setError(null);

      const before = tasks;
      const optimistic = tasks.map((t) => (t.id === taskId ? { ...t, completed: !t.completed } : t));
      const nowChecked = optimistic.find((t) => t.id === taskId)?.completed ?? false;

      setTasks(optimistic);
      if (nowChecked) playCheckSound();

      const wasPerfect = isPerfectDay(before);
      if (!wasPerfect && isPerfectDay(optimistic)) setCelebrating(true);

      try {
        const result = await toggleTask({ childId: child.id, taskId, date });
        if (!result.ok) {
          setTasks(before);
          setCelebrating(false);
          setError(result.error ?? 'That did not save. Try again.');
        }
      } catch {
        setTasks(before);
        setCelebrating(false);
        setError('That did not save. Try again.');
      } finally {
        inFlight.current.delete(taskId);
      }
    },
    [tasks, child.id, date],
  );

  const slots = day.slots.map((slot) => ({
    ...slot,
    tasks: slot.tasks.map((t) => tasks.find((x) => x.id === t.id) ?? t),
  }));

  return (
    <>
      <div
        className="flex items-center justify-between gap-4 rounded-[2rem] p-6 text-white shadow-lg"
        style={{ backgroundColor: child.color }}
      >
        <div className="flex flex-col">
          <StarCounter value={earned} className="text-6xl font-black leading-none" />
          <span className="mt-1 text-lg font-bold text-white/85">stars today</span>
          <span className="text-sm font-semibold text-white/70">
            {done} of {tasks.length} chores done
          </span>
        </div>

        <div className="rounded-full bg-white/15 p-2">
          <ProgressRing completed={done} total={tasks.length} color="#ffffff" size={128} stroke={12}>
            <span className="text-3xl" aria-hidden="true">
              {perfect ? '🎉' : child.avatar}
            </span>
          </ProgressRing>
        </div>
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-2xl bg-amber-50 px-5 py-4 text-center text-lg font-bold text-amber-900 ring-1 ring-amber-200"
        >
          {error}
        </p>
      )}

      {tasks.length === 0 ? (
        <p className="rounded-3xl bg-surface p-8 text-center text-lg font-semibold text-muted shadow-sm ring-1 ring-black/5">
          No chores set up yet.
        </p>
      ) : (
        <div className="flex flex-col gap-7 pb-8">
          {slots.map((slot) => (
            <SlotSection key={slot.slot} slot={slot} color={child.color} onToggle={handleToggle} />
          ))}
        </div>
      )}

      {celebrating && (
        <CelebrationOverlay
          color={child.color}
          name={child.name}
          points={earned}
          onDismiss={() => setCelebrating(false)}
        />
      )}
    </>
  );
}
