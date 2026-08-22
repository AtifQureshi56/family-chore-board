'use client';

import type { DayTask } from '@/lib/types';

/**
 * Large tappable row: icon, title, check state, points.
 *
 * Design rules enforced here:
 * - minimum 64px tall (this is 88px) - young children have poor fine motor control
 * - icon before text, always - pre-readers navigate by icon
 * - incomplete is neutral grey and waiting, NEVER red; the app rewards, it does not scold
 * - completed chores stay visible, styled as done, so progress is visible
 *
 * Without `onToggle` this renders read-only.
 */
type Props = {
  task: DayTask;
  color: string;
  onToggle?: () => void;
  disabled?: boolean;
};

export default function TaskCard({ task, color, onToggle, disabled = false }: Props) {
  const done = task.completed;
  const interactive = Boolean(onToggle) && !disabled;

  const body = (
    <>
      <span
        className="grid shrink-0 place-items-center rounded-2xl text-4xl transition-colors"
        style={{
          width: 64,
          height: 64,
          backgroundColor: done ? `${color}22` : 'var(--waiting)',
        }}
        aria-hidden="true"
      >
        {task.icon}
      </span>

      <span className="flex min-w-0 flex-1 flex-col items-start gap-1">
        <span
          className={`truncate text-2xl font-bold ${done ? 'text-muted line-through decoration-2' : 'text-foreground'}`}
        >
          {task.title}
        </span>
        <span className="flex items-center gap-2">
          <span className="text-base font-semibold text-muted">+{task.points}</span>
          {task.is_extra && (
            <span
              className="rounded-full px-2 py-0.5 text-xs font-bold uppercase tracking-wide"
              style={{ backgroundColor: `${color}1f`, color }}
            >
              Extra
            </span>
          )}
        </span>
      </span>

      <span
        className={`grid shrink-0 place-items-center rounded-full text-3xl transition-all ${done ? 'animate-pop-in text-white' : 'text-waiting-ink'}`}
        style={{
          width: 56,
          height: 56,
          backgroundColor: done ? color : 'var(--waiting)',
        }}
        aria-hidden="true"
      >
        {done ? '✓' : ''}
      </span>
    </>
  );

  const className = `flex w-full items-center gap-4 rounded-3xl bg-surface p-4 text-left shadow-sm ring-1 ring-black/5 transition-transform ${
    interactive ? 'active:scale-[0.98]' : ''
  } ${disabled ? 'opacity-60' : ''}`;

  if (!interactive) {
    return (
      <div className={className} style={{ minHeight: 88 }} aria-label={`${task.title}, ${done ? 'done' : 'not done yet'}`}>
        {body}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onToggle}
      className={className}
      style={{ minHeight: 88 }}
      aria-pressed={done}
      aria-label={`${task.title}, ${done ? 'done' : 'not done yet'}`}
    >
      {body}
    </button>
  );
}
