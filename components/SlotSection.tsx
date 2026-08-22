'use client';

import { SLOT_META, type DaySlot } from '@/lib/types';
import TaskCard from './TaskCard';

/** Heading plus the list of TaskCards for one slot. */
type Props = {
  slot: DaySlot;
  color: string;
  onToggle?: (taskId: string) => void;
  disabled?: boolean;
};

export default function SlotSection({ slot, color, onToggle, disabled }: Props) {
  if (slot.tasks.length === 0) return null;

  const meta = SLOT_META[slot.slot];
  const done = slot.tasks.filter((t) => t.completed).length;
  const allDone = done === slot.tasks.length;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="flex items-center gap-3 px-2">
        <span className="text-3xl" aria-hidden="true">
          {meta.icon}
        </span>
        <span className="text-xl font-extrabold uppercase tracking-wide text-muted">
          {meta.label}
        </span>
        <span
          className="ml-auto rounded-full px-3 py-1 text-sm font-bold"
          style={{
            backgroundColor: allDone ? `${color}1f` : 'var(--waiting)',
            color: allDone ? color : 'var(--waiting-ink)',
          }}
        >
          {done}/{slot.tasks.length}
        </span>
      </h2>

      <div className="flex flex-col gap-3">
        {slot.tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            color={color}
            disabled={disabled}
            onToggle={onToggle ? () => onToggle(task.id) : undefined}
          />
        ))}
      </div>
    </section>
  );
}
